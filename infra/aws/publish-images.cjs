const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ACCOUNT = '749789489994';
const REGION = 'eu-central-1';
const SERVICES = ['frontend', 'backend', 'keycloak'];

function publishImages(env, run = (program, args, options = {}) =>
  execFileSync(program, args, { encoding: 'utf8', ...options })) {
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REF !== 'refs/heads/main' ||
      env.GITHUB_REPOSITORY !== 'mohsammarraie/bus-management-system' ||
      env.GITHUB_REPOSITORY_ID !== '1448687716' ||
      !/^[0-9a-f]{40}$/.test(env.GITHUB_SHA) ||
      !/^\d+$/.test(env.GITHUB_RUN_ID) || !/^\d+$/.test(env.GITHUB_RUN_ATTEMPT)) {
    throw new Error('Expected a trusted manual GitHub publication context on main.');
  }
  const ci = JSON.parse(env.CI_RUNS_JSON);
  if (!Array.isArray(ci) || ci.length !== 3) throw new Error('Missing successful CI gate evidence.');
  const registry = `${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com`;
  const tag = `git-${env.GITHUB_SHA}-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
  const account = run('aws', ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text']).trim();
  if (account !== ACCOUNT) throw new Error('Refusing publication into an unexpected AWS account.');
  // Check every image before pushing any. CI builds and smoke-tests these same
  // local images on a native ARM runner; publishing never rebuilds them.
  for (const service of SERVICES) {
    const platform = run('docker', ['image', 'inspect', '--format', '{{.Os}}/{{.Architecture}}',
      `bus-management-system-${service}:local`]).trim();
    if (platform !== 'linux/arm64') throw new Error(`${service} must be a native linux/arm64 image.`);
  }
  const password = run('aws', ['ecr', 'get-login-password', '--region', REGION]);
  try {
    run('docker', ['login', '--username', 'AWS', '--password-stdin', registry], { input: password });
    const images = {};
    for (const service of SERVICES) {
      const repository = `bus-management-system/${service}`;
      const target = `${registry}/${repository}:${tag}`;
      run('docker', ['tag', `bus-management-system-${service}:local`, target]);
      run('docker', ['push', target], { stdio: 'inherit' });
      const digest = run('aws', ['ecr', 'describe-images', '--region', REGION,
        '--repository-name', repository, '--image-ids', `imageTag=${tag}`,
        '--query', 'imageDetails[0].imageDigest', '--output', 'text']).trim();
      if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error(`Invalid published digest for ${service}.`);
      images[service] = `${registry}/${repository}@${digest}`;
    }
    return { schemaVersion: 1, commit: env.GITHUB_SHA, platform: 'linux/arm64', account: ACCOUNT,
      region: REGION, tag, ci,
      runUrl: `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
      images };
  } finally {
    try {
      run('docker', ['logout', registry]);
    } catch {
      console.warn('Docker registry logout failed; the disposable runner must not be reused.');
    }
  }
}

if (require.main === module) {
  const release = publishImages(process.env);
  const directory = resolve('publication-results');
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'release.json'), JSON.stringify(release, null, 2) + '\n');
  console.log(`Published release ${release.tag}; manifest: publication-results/release.json`);
}

module.exports = { publishImages, ACCOUNT, REGION, SERVICES };
