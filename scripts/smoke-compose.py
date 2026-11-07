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

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--browser-tests', action='store_true', help='Also run installed Playwright tests against the built frontend')
parser.add_argument('--report-dir', type=Path, help='Save bounded diagnostics before cleanup')
args = parser.parse_args()

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'bms-smoke-' + uuid.uuid4().hex[:10]
ENV = dict(os.environ, POSTGRES_DB='bus_management', POSTGRES_USER='bus_management',
           POSTGRES_PASSWORD='synthetic-smoke-only', FRONTEND_PORT=os.environ.get('SMOKE_PORT', '18082'))
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


def sql(query):
    return compose('exec', '-T', 'db', 'psql', '-U', 'bus_management', '-d', 'bus_management',
                   '-v', 'ON_ERROR_STOP=1', '-Atc', query, capture=True).strip()


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
    compose('up', '-d', '--wait', '--wait-timeout', '180')
    assert health(200)['status'] == 'UP'
    for route in ['/', '/overview', '/preferences', '/unknown-page']:
        status, body = get(route)
        assert status == 200 and '<app-root' in body, route
    for route in ['/missing.js', '/api/v1/missing', '/api', '/actuator/health']:
        status, body = get(route)
        assert status == 404 and '<app-root' not in body, route
    for service in ['frontend', 'backend']:
        assert compose('exec', '-T', service, 'id', '-u', capture=True).strip() == '10001'
    if args.browser_tests:
        subprocess.run(['npm', 'run', 'test:e2e'], cwd=ROOT / 'frontend',
                       env=dict(ENV, CI='true', PLAYWRIGHT_BASE_URL=BASE), check=True)
    assert sql('SELECT count(*) FROM bus_management.flyway_schema_history WHERE success AND version IS NOT NULL') == '1'
    sql("INSERT INTO bus_management.buses (registration_number, capacity) VALUES ('SMOKE-ONLY', 40)")
    compose('down')  # Keep this disposable project's volume to verify recreation.
    compose('up', '-d', '--wait', '--wait-timeout', '180')
    assert sql("SELECT count(*) FROM bus_management.buses WHERE registration_number='SMOKE-ONLY'") == '1'
    assert sql('SELECT count(*) FROM bus_management.flyway_schema_history WHERE success AND version IS NOT NULL') == '1'
    compose('stop', 'db')
    assert health(503)['status'] == 'DOWN'
    compose('start', 'db')
    assert health(200)['status'] == 'UP'
    passed = True
    print('PASS: routing, proxy health, non-root users, migration, persistence and database recovery')
except BaseException as error:
    failure = f'{type(error).__name__}: {error}'
    raise
finally:
    save_diagnostics()
    compose('down', '--volumes', '--remove-orphans')
