"""Real OIDC HTTP checks against the synthetic local Keycloak realm (no password grant)."""
from html.parser import HTMLParser
from http.cookiejar import CookieJar, DefaultCookiePolicy
import json
import hashlib
import re
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import build_opener, HTTPCookieProcessor, Request
import uuid


class Forms(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self.stylesheets = []
        self.scripts = []
        self.current = None

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.stylesheets.append(attrs.get('href', ''))
        if tag == 'script' and attrs.get('src'):
            self.scripts.append(attrs['src'])
        if tag == 'form':
            self.current = {'action': attrs.get('action'), 'fields': {}, 'id': attrs.get('id')}
            self.forms.append(self.current)
        if tag == 'input' and self.current is not None and attrs.get('name'):
            if attrs.get('type') in ('hidden', 'submit'):
                self.current['fields'][attrs['name']] = attrs.get('value', '')

    def handle_endtag(self, tag):
        if tag == 'form':
            self.current = None


class LocalDemoCookiePolicy(DefaultCookiePolicy):
    def return_ok_secure(self, cookie, request):
        # Browsers allow Secure cookies on localhost. Match that only in this local verifier.
        address = urlparse(request.get_full_url())
        if address.scheme == 'http' and address.hostname == 'localhost':
            return True
        return super().return_ok_secure(cookie, request)


def verify_auth(base, password, registered=None):
    def new_client():
        cookies = CookieJar(policy=LocalDemoCookiePolicy())
        return build_opener(HTTPCookieProcessor(cookies)), cookies

    def send(client, path, fields=None, headers=None, json_body=None, method=None):
        target = path if path.startswith('http') else base + path
        # Never submit synthetic credentials to an unexpected form origin.
        assert urlparse(target).netloc == urlparse(base).netloc, target
        request_headers = dict(headers or {})
        data = urlencode(fields).encode() if fields is not None else None
        if json_body is not None:
            data = json.dumps(json_body).encode()
            request_headers['Content-Type'] = 'application/json'
        request = Request(target, data=data, headers=request_headers, method=method)
        try:
            response = client.open(request, timeout=15)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.read().decode(), response.geturl()

    def form(body, identifier):
        parser = Forms()
        parser.feed(body)
        return next(item for item in parser.forms if item['id'] == identifier)

    def account(client):
        status, body, _ = send(client, '/api/auth/me')
        assert status == 200, (status, body)
        value = json.loads(body)
        assert set(value) == {'id', 'username', 'roles'}, value
        return value

    def login(username):
        client, cookies = new_client()
        status, body, _ = send(client, '/api/auth/login')
        assert status == 200
        parser = Forms()
        parser.feed(body)
        stylesheet = next((path for path in parser.stylesheets
                           if re.search(r'/css/bus-management\.[0-9a-f]{12}\.css$', path)), None)
        assert stylesheet, 'The configured Keycloak login theme must load'
        status, css, _ = send(client, stylesheet)
        assert status == 200 and '--bms-primary:' in css, 'The theme stylesheet must be served'
        assert hashlib.sha256(css.encode()).hexdigest()[:12] in stylesheet, 'CSS URL must match its content hash'
        appearance = next((path for path in parser.scripts
                           if re.search(r'/js/appearance\.[0-9a-f]{12}\.js$', path)), None)
        assert appearance, 'The identity appearance script must load'
        status, script, _ = send(client, appearance)
        assert status == 200 and 'bus-management.appearance=' in script, 'The appearance script must be served'
        assert hashlib.sha256(script.encode()).hexdigest()[:12] in appearance, 'Script URL must match its content hash'
        initial_session = next(cookie.value for cookie in cookies if cookie.name == 'JSESSIONID')
        page = form(body, 'kc-form-login')
        fields = dict(page['fields'], username=username, password=password)
        status, _, destination = send(client, page['action'], fields)
        assert status == 200 and destination == base + '/overview', destination.split('?')[0]
        session = next(cookie for cookie in cookies if cookie.name == 'JSESSIONID')
        assert session.value != initial_session, 'Session ID must rotate on authentication'
        assert session.has_nonstandard_attr('HttpOnly')
        return client, cookies

    def verify_buses(client, cookies, role):
        api = '/api/v1/buses'
        docs_status, schema, _ = send(client, '/api/openapi')
        assert docs_status == (200 if role == 'admin' else 403)
        assert send(client, '/api/docs')[0] == (200 if role == 'admin' else 403)
        if role == 'admin':
            assert '/api/v1/buses' in json.loads(schema)['paths']
            assert send(client, '/api/swagger-ui/swagger-ui-bundle.js')[0] == 200
        assert send(client, api)[0] == (200 if role == 'admin' else 403)
        assert send(client, '/api/auth/csrf')[0] == 200
        token = next(cookie.value for cookie in cookies if cookie.name == 'XSRF-TOKEN')
        headers = {'X-XSRF-TOKEN': token}
        payload = {'registrationNumber': 'SMOKE-' + uuid.uuid4().hex[:8], 'capacity': 40, 'active': True}
        assert send(client, api, json_body=payload)[0] == 403, 'Bus creation must require CSRF'
        status, body, _ = send(client, api, headers=headers, json_body=payload)
        if role != 'admin':
            assert status == 403, 'Driver/passenger accounts must not manage buses'
            return
        assert status == 201, status
        bus = json.loads(body)
        resource = api + '/' + str(bus['id'])
        assert send(client, resource)[0] == 200
        status, duplicate, _ = send(client, api, headers=headers, json_body=payload)
        assert status == 409 and json.loads(duplicate)['code'] == 'BUS_REGISTRATION_CONFLICT'
        changed = dict(payload, capacity=45, active=False, version=bus['version'])
        status, body, _ = send(client, resource, headers=headers, json_body=changed, method='PUT')
        assert status == 200 and json.loads(body)['active'] is False
        version = json.loads(body)['version']
        assert version == bus['version'] + 1
        status, stale, _ = send(client, resource, headers=headers, json_body=changed, method='PUT')
        assert status == 409 and json.loads(stale)['code'] == 'BUS_VERSION_CONFLICT'
        assert send(client, resource + '?version=' + str(version), headers=headers, method='DELETE')[0] == 204
        assert send(client, resource)[0] == 404

    identities = [(registered['username'], 'passenger')] if registered else [
        ('demo-' + role, role) for role in ['admin', 'driver', 'passenger']]
    for username, role in identities:
        client, cookies = login(username)
        current = account(client)
        assert current['roles'] == [role.upper()]
        if registered:
            assert current == registered, 'Registered identity must survive recreation/recovery'
        verify_buses(client, cookies, role)
        # These intentionally nonexistent routes test the filter boundary without fake APIs.
        assert send(client, '/api/admin/auth-smoke-not-found')[0] == (404 if role == 'admin' else 403)
        assert send(client, '/api/driver/auth-smoke-not-found')[0] == (403 if role == 'passenger' else 404)
        assert send(client, '/api/auth/logout', {})[0] == 403, 'Logout must require CSRF'
        status, body, _ = send(client, '/api/auth/csrf')
        assert status == 200
        csrf = next(cookie.value for cookie in cookies if cookie.name == 'XSRF-TOKEN')
        assert json.loads(body)['headerName'] == 'X-XSRF-TOKEN'
        assert send(client, '/api/auth/logout', {}, {'X-XSRF-TOKEN': csrf})[0] == 200
        assert send(client, '/api/auth/me')[0] == 401
        _, body, _ = send(client, '/api/auth/login')
        assert 'kc-form-login' in body, 'Keycloak SSO must also be signed out'

    if registered:
        print('PASS: registered identity login after recreation/recovery')
        return registered
    client, _ = new_client()
    status, body, _ = send(client, '/api/auth/signup')
    assert status == 200
    page = form(body, 'kc-register-form')
    username = 'smoke-' + uuid.uuid4().hex[:12]
    fields = dict(page['fields'], username=username, firstName='Synthetic', lastName='Passenger',
                  email=username + '@example.test', password=password)
    fields['password-confirm'] = password
    status, body, destination = send(client, page['action'], fields)
    assert status == 200 and destination == base + '/overview', destination.split('?')[0]
    value = account(client)
    assert value['username'] == username and value['roles'] == ['PASSENGER'], value
    print('PASS: real OIDC logins, ADMIN bus CRUD/conflicts, role/CSRF boundaries, session rotation, logout/SSO and passenger signup')
    return value
