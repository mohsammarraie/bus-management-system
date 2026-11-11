#!/usr/bin/env python3
"""Create fresh, ignored AWS runtime configuration; never overwrite an existing setup."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets

ROOT = Path(__file__).resolve().parents[2]


def prepare(hostname, images, output):
    hostname = hostname.lower()
    label = r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
    if (len(hostname) > 253 or not re.fullmatch(rf'{label}(?:\.{label})+', hostname)
            or re.fullmatch(r'[0-9.]+', hostname)):
        raise ValueError('Use a DNS hostname without a scheme, port or path.')
    for image in images.values():
        if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9._:/-]*@sha256:[0-9a-f]{64}', image):
            raise ValueError('Each image must be a published repository@sha256:<64 hex digits> reference.')

    env_path = output / '.env'
    realm_path = output / 'bus-management-realm.json'
    if env_path.exists() or realm_path.exists():
        raise ValueError('Configuration already exists; update it deliberately without regenerating credentials.')
    output.mkdir(parents=True, exist_ok=True)

    realm = json.loads((ROOT / 'infra/keycloak/bus-management-realm.json').read_text())
    realm.pop('users', None)
    realm['sslRequired'] = 'all'
    client = next(item for item in realm['clients'] if item['clientId'] == 'bus-management')
    client['redirectUris'] = ['${APP_PUBLIC_URL}/api/login/oauth2/code/keycloak']
    client['attributes']['post.logout.redirect.uris'] = '${APP_PUBLIC_URL}/overview'

    values = {'APP_HOST': hostname, **images}
    for key in ['POSTGRES_ADMIN_PASSWORD', 'POSTGRES_PASSWORD', 'KEYCLOAK_DB_PASSWORD',
                'KEYCLOAK_ADMIN_PASSWORD', 'OIDC_CLIENT_SECRET']:
        values[key] = secrets.token_hex(32)
    # Exclusive creation and 0600 apply before any secret bytes are written.
    with os.fdopen(os.open(env_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as stream:
        stream.write(''.join(f'{key}={value}\n' for key, value in values.items()))
    with realm_path.open('x') as stream:
        stream.write(json.dumps(realm, indent=2) + '\n')
    realm_path.chmod(0o644)  # Non-root Keycloak must read this secret-free template.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--hostname', default='bms.timbalonia.de',
                        help='Public DNS hostname (default: bms.timbalonia.de)')
    for service in ['frontend', 'backend', 'keycloak']:
        parser.add_argument(f'--{service}-image', required=True)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'infra/aws/generated')
    args = parser.parse_args()
    images = {f'{service.upper()}_IMAGE': getattr(args, f'{service}_image')
              for service in ['frontend', 'backend', 'keycloak']}
    try:
        prepare(args.hostname, images, args.output_dir)
    except (ValueError, OSError) as error:
        parser.exit(1, f'Preparation failed: {error}\n')
    print(f'Created {args.output_dir}/.env and realm template; no resources created or images published.')
    print('Keep the generated credentials private. Existing realms require explicit administrative updates.')


if __name__ == '__main__':
    main()
