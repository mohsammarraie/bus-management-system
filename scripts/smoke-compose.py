#!/usr/bin/env python3
"""Verify a disposable Compose project; never touch the normal project's volume."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from auth_smoke import verify_auth

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--browser-tests', action='store_true', help='Also run installed Playwright tests against the built frontend')
parser.add_argument('--report-dir', type=Path, help='Save bounded diagnostics before cleanup')
args = parser.parse_args()

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'bms-smoke-' + uuid.uuid4().hex[:10]
ENV = dict(os.environ, POSTGRES_DB='bus_management', POSTGRES_USER='bus_management',
           POSTGRES_PASSWORD='synthetic-smoke-only',
           POSTGRES_PORT='0',  # Docker assigns a free loopback port, independent of local development.
           KEYCLOAK_DB_PASSWORD='synthetic-identity-db-only',
           KEYCLOAK_ADMIN_PASSWORD='synthetic-identity-admin-only',
           OIDC_CLIENT_SECRET='synthetic-client-secret-only',
           DEMO_USER_PASSWORD='synthetic-demo-password-only', FRONTEND_PORT=os.environ.get('SMOKE_PORT', '18082'))
COMMAND = ['docker', 'compose', '--project-name', PROJECT, '--env-file', str(ROOT / '.env.example'),
           '-f', str(ROOT / 'compose.yaml')]
BASE = 'http://127.0.0.1:' + ENV['FRONTEND_PORT']


def compose(*args, capture=False):
    return subprocess.run(COMMAND + list(args), cwd=ROOT, env=ENV, check=True,
                          capture_output=capture, text=True).stdout


def get(path):
    try:
        response = urllib.request.urlopen(BASE + path, timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    return response.status, response.read().decode()


def health(expected):
    for _ in range(45):
        try:
            status, body = get('/api/health')
            if status == expected:
                return json.loads(body)
        except (OSError, ValueError):
            pass
        time.sleep(1)
    raise AssertionError('Health did not reach HTTP ' + str(expected))


def backend_probe(healthy):
    container = compose('ps', '-q', 'backend', capture=True).strip()
    test = subprocess.run(['docker', 'inspect', '--format', '{{json .Config.Healthcheck.Test}}',
                           container], env=ENV, check=True, capture_output=True, text=True)
    command = json.loads(test.stdout)
    assert command[0] == 'CMD', 'Expected an exec-form backend health check'
    probe = subprocess.run(COMMAND + ['exec', '-T', 'backend'] + command[1:],
                           cwd=ROOT, env=ENV, capture_output=True, text=True, timeout=10)
    assert (probe.returncode == 0) == healthy, 'Backend health check returned an unexpected result'


def keycloak_health(expected):
    # The management port is internal. Read its DB-aware readiness response inside the container.
    request = ("exec 3<>/dev/tcp/127.0.0.1/9000; "
               "printf 'GET /health/ready HTTP/1.0\\r\\nHost: localhost\\r\\nConnection: close\\r\\n\\r\\n' >&3; "
               "cat <&3")
    deadline = time.monotonic() + 90
    last = 'No readiness response'
    while time.monotonic() < deadline:
        try:
            result = subprocess.run(COMMAND + ['exec', '-T', 'keycloak', 'bash', '-ec', request],
                                    cwd=ROOT, env=ENV, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                headers, _, body = result.stdout.partition('\n\n')
                status = int(headers.splitlines()[0].split()[1])
                health = json.loads(body)
                database = next((check for check in health.get('checks', [])
                                 if 'database' in check['name'].lower()), None)
                assert database is not None, 'Keycloak readiness must include the database check'
                wanted = 'UP' if expected == 200 else 'DOWN'
                last = f"HTTP {status}, database {database['status']}"
                if status == expected and health['status'] == wanted and database['status'] == wanted:
                    print('PASS: Keycloak database readiness ' + wanted)
                    return
        except (OSError, ValueError, IndexError, subprocess.TimeoutExpired) as error:
            last = type(error).__name__
        time.sleep(1)
    raise AssertionError(f'Keycloak database readiness did not reach HTTP {expected}: {last}')


def sql(query):
    return compose('exec', '-T', 'db', 'psql', '-U', 'bus_management', '-d', 'bus_management',
                   '-v', 'ON_ERROR_STOP=1', '-Atc', query, capture=True).strip()


def verify_demo_data():
    assert sql('SELECT count(*) FROM bus_management.buses') == '0', 'Startup must not seed buses'

    def seed():
        subprocess.run(['sh', str(ROOT / 'scripts/seed-demo-data.sh')], cwd=ROOT,
                       env=dict(ENV, COMPOSE_PROJECT_NAME=PROJECT), check=True)

    seed()
    assert sql('''SELECT count(*) || ',' || count(*) FILTER (WHERE active) || ',' ||
                  count(*) FILTER (WHERE NOT active) FROM bus_management.buses''') == '30,24,6'
    assert sql('SELECT count(*) FROM bus_management.buses WHERE version = 0') == '30'
    assert sql('SELECT count(DISTINCT capacity) FROM bus_management.buses') == '4'
    # Simulate an existing edited row and an unrelated user-created bus.
    sql("UPDATE bus_management.buses SET capacity=55, active=false, version=1 WHERE registration_number='DEMO-BUS-001'")
    sql("INSERT INTO bus_management.buses (registration_number, capacity) VALUES ('USER-CREATED-SMOKE', 35)")
    snapshot_query = '''SELECT id, registration_number, capacity, active, version
                        FROM bus_management.buses ORDER BY id'''
    before = sql(snapshot_query)
    seed()
    assert sql(snapshot_query) == before, 'Rerunning the seed must preserve every existing row'
    sql("DELETE FROM bus_management.buses WHERE registration_number='DEMO-BUS-030'")
    seed()
    assert sql('SELECT count(*) FROM bus_management.buses') == '31', 'Missing demo registrations must be restored'
    assert sql("SELECT capacity || ',' || version FROM bus_management.buses WHERE registration_number='DEMO-BUS-001'") == '55,1'
    assert sql("SELECT count(*) FROM bus_management.buses WHERE registration_number='USER-CREATED-SMOKE'") == '1'
    print('PASS: opt-in demo seed, varied data, safe reruns and preservation of edits/versions/user records')


def save_diagnostics():
    if args.report_dir is None:
        return
    try:
        args.report_dir.mkdir(parents=True, exist_ok=True)
        commands = {
            'compose-status.json': ['ps', '--all', '--format', 'json'],
            'compose-logs.txt': ['logs', '--no-color', '--timestamps', '--tail', '200'],
        }
        for filename, arguments in commands.items():
            result = subprocess.run(COMMAND + arguments, cwd=ROOT, env=ENV,
                                    capture_output=True, text=True, timeout=15)
            (args.report_dir / filename).write_text(result.stdout + result.stderr)
        (args.report_dir / 'result.json').write_text(json.dumps({
            'project': PROJECT, 'passed': passed, 'error': failure,
        }, indent=2) + '\n')
    except (OSError, subprocess.TimeoutExpired) as error:
        # Diagnostics must not prevent cleanup or hide the original test failure.
        print('Could not save all diagnostics:', error, file=sys.stderr)


passed = False
failure = None


try:
    compose('up', '-d', '--wait', '--wait-timeout', '240')
    assert health(200)['status'] == 'UP'
    backend_probe(True)
    keycloak_health(200)
    for route in ['/', '/overview', '/preferences', '/unknown-page']:
        status, body = get(route)
        assert status == 200 and '<app-root' in body, route
    for route in ['/missing.js', '/actuator/health']:
        status, body = get(route)
        assert status == 404 and '<app-root' not in body, route
    for route in ['/api/v1/missing', '/api', '/api/auth/me']:
        assert get(route)[0] == 401, route
    registered = verify_auth('http://localhost:' + ENV['FRONTEND_PORT'], ENV['DEMO_USER_PASSWORD'])
    verify_demo_data()
    for service in ['frontend', 'backend']:
        assert compose('exec', '-T', service, 'id', '-u', capture=True).strip() == '10001'
    if args.browser_tests:
        subprocess.run(['npm', 'run', 'test:e2e'], cwd=ROOT / 'frontend',
                       env=dict(ENV, CI='true', PLAYWRIGHT_BASE_URL=BASE), check=True)
        subprocess.run(['node', 'e2e/auth-browser-smoke.ts'], cwd=ROOT / 'frontend',
                       env=dict(ENV, PLAYWRIGHT_BASE_URL='http://localhost:' + ENV['FRONTEND_PORT']), check=True)
    assert sql('SELECT count(*) FROM bus_management.flyway_schema_history WHERE success AND version IS NOT NULL') == '1'
    sql("INSERT INTO bus_management.buses (registration_number, capacity) VALUES ('SMOKE-ONLY', 40)")
    compose('down')  # Keep this disposable project's volume to verify recreation.
    compose('up', '-d', '--wait', '--wait-timeout', '240')
    assert sql("SELECT count(*) FROM bus_management.buses WHERE registration_number='SMOKE-ONLY'") == '1'
    assert sql("SELECT capacity || ',' || version FROM bus_management.buses WHERE registration_number='DEMO-BUS-001'") == '55,1'
    assert sql("SELECT count(*) FROM bus_management.buses WHERE registration_number='USER-CREATED-SMOKE'") == '1'
    assert sql('SELECT count(*) FROM bus_management.flyway_schema_history WHERE success AND version IS NOT NULL') == '1'
    keycloak_health(200)
    verify_auth('http://localhost:' + ENV['FRONTEND_PORT'], ENV['DEMO_USER_PASSWORD'], registered)
    compose('stop', 'db')
    assert health(503)['status'] == 'DOWN'
    backend_probe(False)
    keycloak_health(503)
    compose('start', 'db')
    assert health(200)['status'] == 'UP'
    backend_probe(True)
    keycloak_health(200)
    compose('up', '-d', '--wait', '--wait-timeout', '240')
    verify_auth('http://localhost:' + ENV['FRONTEND_PORT'], ENV['DEMO_USER_PASSWORD'], registered)
    passed = True
    print('PASS: routing, proxy health, non-root users, migration, persistence and database recovery')
except BaseException as error:
    failure = f'{type(error).__name__}: {error}'
    raise
finally:
    save_diagnostics()
    compose('down', '--volumes', '--remove-orphans')
