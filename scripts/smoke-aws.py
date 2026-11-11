#!/usr/bin/env python3
"""Check AWS configuration locally with disposable data, loopback TLS and cached native images."""
import importlib.util
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import tempfile
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, HTTPCookieProcessor, Request, build_opener
from http.cookiejar import CookieJar
import uuid

from auth_smoke import verify_auth

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'bms-aws-smoke-' + uuid.uuid4().hex[:10]
spec = importlib.util.spec_from_file_location('aws_prepare', ROOT / 'infra/aws/prepare.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def main():
    # Snap-packaged Docker has a private /tmp; use an ignored repository path.
    generated = ROOT / 'infra/aws/generated'
    generated.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=PROJECT + '-', dir=generated) as temporary:
        directory = Path(temporary)
        images = {f'{service.upper()}_IMAGE': f'example.test/{service}@sha256:' + '0' * 64
                  for service in ['frontend', 'backend', 'keycloak']}
        prepare.prepare('demo.example.test', images, directory)
        secrets = dict(line.split('=', 1) for line in (directory / '.env').read_text().splitlines())
        assert (directory / '.env').stat().st_mode & 0o777 == 0o600
        realm = json.loads((directory / 'bus-management-realm.json').read_text())
        assert not realm.get('users') and realm['sslRequired'] == 'all'
        assert 'localhost' not in json.dumps(realm)
        for invalid in ['localhost', '127.0.0.1', 'https://demo.example.test', 'demo.example.test/path']:
            try:
                prepare.prepare(invalid, images, directory / 'invalid')
            except ValueError:
                pass
            else:
                raise AssertionError('Preparation accepted an invalid public hostname')
        try:
            prepare.prepare('demo.example.test', images, directory)
        except ValueError:
            pass
        else:
            raise AssertionError('Preparation overwrote existing credentials')

        # Production config remains ARM64/digest-pinned. The local run uses cached
        # native images, a localhost certificate, random loopback ports and its own realm.
        native = subprocess.run(['docker', 'info', '--format', '{{.Architecture}}'],
                                check=True, capture_output=True, text=True).stdout.strip()
        platform = 'linux/arm64' if native in ('aarch64', 'arm64') else 'linux/amd64'
        services = {service: {'platform': platform} for service in
                    ['db', 'database-init', 'keycloak', 'backend', 'frontend']}
        for service in ['frontend', 'backend', 'keycloak']:
            services[service]['image'] = f'bus-management-system-{service}:local'
        services['frontend'].update(environment={'APP_HOST': 'localhost'}, ports=[
            '127.0.0.1:0:8080', '127.0.0.1:0:8443'])
        services['keycloak'].update(environment={
            'KC_HOSTNAME': 'https://localhost/identity', 'APP_PUBLIC_URL': 'https://localhost'},
            volumes=[f'{directory}/bus-management-realm.json:/opt/keycloak/data/import/bus-management-realm.json:ro'])
        services['backend']['environment'] = {
            'APP_PUBLIC_URL': 'https://localhost',
            'OIDC_ISSUER': 'https://localhost/identity/realms/bus-management'}
        # An extends file inherits the AWS model without merging its public host ports.
        override = directory / 'compose.json'
        for service in services:
            services[service]['extends'] = {'file': str(ROOT / 'compose.aws.yaml'), 'service': service}
        # extends merges unique port entries: explicitly reset in a following override.
        services['frontend'].pop('ports')
        override.write_text(json.dumps({'services': services, 'volumes': {
            'postgres_data': {}, 'caddy_data': {}}}))
        ports = directory / 'ports.yaml'
        ports.write_text('services:\n  frontend:\n    ports: !override\n'
                         '      - "127.0.0.1:0:8080"\n      - "127.0.0.1:0:8443"\n')
        command = ['docker', 'compose', '--project-name', PROJECT, '--env-file', str(directory / '.env'),
                   '--project-directory', str(ROOT), '-f', str(override), '-f', str(ports)]
        env = {key: value for key, value in os.environ.items()
               if key not in secrets and key not in ['COMPOSE_FILE', 'COMPOSE_PROJECT_NAME', 'COMPOSE_PROFILES']}

        production = json.loads(subprocess.run(
            ['docker', 'compose', '--env-file', str(directory / '.env'), '-f', str(ROOT / 'compose.aws.yaml'),
             'config', '--format', 'json'], cwd=ROOT, env=env, check=True, capture_output=True, text=True).stdout)
        for name, service in production['services'].items():
            assert service['platform'] == 'linux/arm64' and 'build' not in service
            assert '@sha256:' in service['image']
            if name != 'frontend':
                assert not service.get('ports'), 'Only the HTTPS gateway may publish ports'
        local = json.loads(subprocess.run(
            ['docker', 'compose', '--env-file', str(ROOT / '.env.example'), '-f', str(ROOT / 'compose.yaml'),
             'config', '--format', 'json'], cwd=ROOT, env=dict(env, POSTGRES_PASSWORD='synthetic-check-only'),
            check=True, capture_output=True, text=True).stdout)
        assert production['services']['db']['image'] == local['services']['db']['image']
        assert production['services']['database-init']['image'] == local['services']['db']['image']
        assert 'POSTGRES_ADMIN_PASSWORD' not in production['services']['backend']['environment']

        def compose(*args, input=None):
            return subprocess.run(command + list(args), cwd=ROOT, env=env, input=input,
                                  check=True, capture_output=True, text=True).stdout

        def admin(*args, input=None):
            return compose('exec', '-T', 'keycloak', '/opt/keycloak/bin/kcadm.sh', *args,
                           '--config', '/tmp/aws-smoke-admin.config', input=input)

        def sql(query):
            return compose('exec', '-T', 'db', 'psql', '-U', 'bus_management', '-d', 'bus_management',
                           '-v', 'ON_ERROR_STOP=1', '-Atc', query).strip()

        original_connection = socket.create_connection
        original_context = ssl._create_default_https_context
        try:
            print('Starting disposable AWS-config stack:', PROJECT, flush=True)
            compose('up', '--pull', 'never', '--no-build', '-d', '--wait', '--wait-timeout', '300')
            print('PASS: bounded startup and container health', flush=True)
            assert sql("SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname='bus_management'") == 'f'
            assert sql("SELECT has_database_privilege('bus_management', 'keycloak', 'CONNECT')") == 'f'
            assert sql("SELECT has_database_privilege('keycloak', 'bus_management', 'CONNECT')") == 'f'
            port = int(compose('port', 'frontend', '8443').strip().rsplit(':', 1)[1])
            ca = directory / 'root.crt'
            compose('cp', 'frontend:/tmp/data/caddy/pki/authorities/local/root.crt', str(ca))
            context = ssl.create_default_context(cafile=str(ca))
            ssl._create_default_https_context = lambda: context

            def connection(address, *args, **kwargs):
                if address[0] == 'localhost' and address[1] == 443:
                    address = ('127.0.0.1', port)
                return original_connection(address, *args, **kwargs)

            # Preserve the public HTTPS origin while remapping only this process's
            # localhost:443 connections to the disposable, random host port.
            socket.create_connection = connection
            cookies = CookieJar()
            client = build_opener(HTTPCookieProcessor(cookies))

            class NoRedirect(HTTPRedirectHandler):
                def redirect_request(self, request, fp, code, message, headers, new_url):
                    return None

            redirect_client = build_opener(NoRedirect())
            http_port = compose('port', 'frontend', '8080').strip().rsplit(':', 1)[1]
            try:
                redirect_client.open('http://localhost:' + http_port + '/overview', timeout=15)
            except HTTPError as error:
                assert error.code == 308 and error.headers['Location'] == 'https://localhost/overview'
            else:
                raise AssertionError('HTTP must redirect to the canonical HTTPS origin')
            for path in ['/identity/admin/', '/identity/realms/master/.well-known/openid-configuration',
                         '/actuator/health', '/identity/health', '/missing.js']:
                try:
                    client.open('https://localhost' + path, timeout=15)
                except HTTPError as error:
                    assert error.code == 404, (path, error.code)
                else:
                    raise AssertionError('Private/missing route was publicly available: ' + path)
            with client.open('https://localhost/api/auth/login', timeout=15) as response:
                assert response.geturl().startswith('https://localhost/identity/')
            session = next(cookie for cookie in cookies if cookie.name == 'JSESSIONID')
            assert session.secure and session.has_nonstandard_attr('HttpOnly')
            request = Request('https://localhost/api/auth/login', headers={
                'Forwarded': 'proto=http;host=attacker.invalid',
                'X-Forwarded-Host': 'attacker.invalid', 'X-Forwarded-Proto': 'http',
                'X-Forwarded-Prefix': '/attacker', 'X-Forwarded-Port': '1234'})
            with client.open(request, timeout=15) as response:
                assert response.geturl().startswith('https://localhost/identity/')
            print('PASS: TLS, canonical redirects, secure cookies and private routes', flush=True)

            admin('config', 'credentials', '--server', 'http://localhost:8080/identity',
                  '--realm', 'master', '--user', 'deployment-admin',
                  '--password', secrets['KEYCLOAK_ADMIN_PASSWORD'])
            assert json.loads(admin('get', 'users', '-r', 'bus-management')) == [], 'No seeded deployment users'
            password = 'Synthetic-aws-smoke-only-123'
            fixtures = json.loads((ROOT / 'infra/keycloak/bus-management-realm.json').read_text())['users']
            for user in fixtures:
                roles = user.pop('clientRoles')['bus-management']
                user['credentials'][0]['value'] = password
                admin('create', 'users', '-r', 'bus-management', '-f', '-', input=json.dumps(user))
                if roles != ['PASSENGER']:
                    admin('remove-roles', '-r', 'bus-management', '--uusername', user['username'],
                          '--rolename', 'default-roles-bus-management')
                admin('add-roles', '-r', 'bus-management', '--uusername', user['username'],
                      '--cclientid', 'bus-management', '--rolename', roles[0])
            compose('exec', '-T', 'keycloak', 'rm', '-f', '/tmp/aws-smoke-admin.config')
            registered = verify_auth('https://localhost', password)
            print('PASS: private CLI administration and HTTPS authentication/CRUD', flush=True)
            sql("INSERT INTO bus_management.buses (registration_number, capacity) VALUES ('AWS-SMOKE-ONLY', 40)")
            compose('stop', 'frontend', 'backend', 'keycloak')
            for database in ['bus_management', 'keycloak']:
                backup = directory / (database + '.dump')
                with backup.open('wb') as stream:
                    subprocess.run(command + ['exec', '-T', 'db', 'pg_dump', '-U', 'deployment_db_admin',
                                              '-d', database, '-Fc'], env=env, check=True,
                                   stdout=stream, stderr=subprocess.PIPE)
            sql("DELETE FROM bus_management.buses WHERE registration_number='AWS-SMOKE-ONLY'")
            for database in ['bus_management', 'keycloak']:
                with (directory / (database + '.dump')).open('rb') as stream:
                    subprocess.run(command + ['exec', '-T', 'db', 'pg_restore', '--exit-on-error',
                                              '--clean', '--if-exists', '-U', 'deployment_db_admin', '-d', database],
                                   env=env, check=True, stdin=stream, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print('PASS: restricted database roles and application/identity backup restoration', flush=True)
            certificate = ca.read_bytes()
            compose('down')
            compose('up', '--pull', 'never', '--no-build', '-d', '--wait', '--wait-timeout', '300')
            port = int(compose('port', 'frontend', '8443').strip().rsplit(':', 1)[1])
            compose('cp', 'frontend:/tmp/data/caddy/pki/authorities/local/root.crt', str(ca))
            assert ca.read_bytes() == certificate, 'TLS storage must survive stack recreation'
            assert sql("SELECT count(*) FROM bus_management.buses WHERE registration_number='AWS-SMOKE-ONLY'") == '1'
            verify_auth('https://localhost', password, registered)
            for container in compose('ps', '-q').split():
                detail = json.loads(subprocess.run(['docker', 'inspect', container], check=True,
                                                   capture_output=True, text=True).stdout)[0]
                assert not detail['State']['OOMKilled'] and detail['RestartCount'] == 0
            print('PASS: HTTPS/session cookies, private routes, fresh realm, OIDC/roles/CRUD, '
                  'database role isolation, backup/restore, database/identity/TLS persistence and bounded startup')
        except BaseException:
            print(compose('logs', '--no-color', '--tail', '40'), flush=True)
            raise
        finally:
            socket.create_connection = original_connection
            ssl._create_default_https_context = original_context
            compose('down', '--volumes', '--remove-orphans')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        print(error.stderr.decode() if isinstance(error.stderr, bytes) else error.stderr, flush=True)
        raise
