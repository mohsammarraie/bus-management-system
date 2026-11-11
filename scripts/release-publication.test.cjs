const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { verifyReleaseCi, WORKFLOWS, REPOSITORY_ID } = require('./release-ci.cjs');
const { publishImages, ACCOUNT, REGION, SERVICES } = require('../infra/aws/publish-images.cjs');

const sha = 'a'.repeat(40);
function context(changes = {}) {
  return { eventName: 'workflow_dispatch', ref: 'refs/heads/main', sha,
    repo: { owner: 'mohsammarraie', repo: 'bus-management-system' },
    payload: { repository: { id: REPOSITORY_ID } }, ...changes };
}
function run(changes = {}) {
  return { id: 100, run_attempt: 1, head_sha: sha, head_branch: 'main',
    head_repository: { id: REPOSITORY_ID }, event: 'push', status: 'completed',
    conclusion: 'success', updated_at: '2026-11-11T12:00:00Z',
    html_url: 'https://github.com/mohsammarraie/bus-management-system/actions/runs/100', ...changes };
}
function github(results = {}) {
  return { rest: { actions: { listWorkflowRuns: Symbol('listWorkflowRuns') } },
    async paginate(endpoint, params) {
      assert.equal(params.head_sha, sha);
      assert.equal(params.branch, 'main');
      assert.equal(params.status, undefined, 'A success filter would hide failures and pending reruns');
      return results[params.workflow_id] ?? [run()];
    } };
}

test('CI gate requires all three workflows for the exact main commit', async () => {
  const result = await verifyReleaseCi({ github: github(), context: context() });
  assert.equal(result.commit, sha);
  assert.deepEqual(result.ci.map(item => item.workflow), WORKFLOWS);
});

for (const [name, changes] of Object.entries({
  'PR event': { eventName: 'pull_request' },
  'feature branch': { ref: 'refs/heads/feature' },
  'other repository': { repo: { owner: 'someone', repo: 'bus-management-system' } },
  'recreated repository name': { payload: { repository: { id: 999 } } },
  'invalid commit': { sha: 'main' },
})) {
  test(`CI gate rejects ${name}`, async () => {
    await assert.rejects(verifyReleaseCi({ github: github(), context: context(changes) }));
  });
}

for (const conclusion of ['failure', 'cancelled', 'skipped', 'neutral', 'timed_out', null]) {
  test(`CI gate rejects ${conclusion} workflow results`, async () => {
    await assert.rejects(verifyReleaseCi({ github: github({ 'frontend-ci.yml': [run({ conclusion })] }),
      context: context() }), /frontend-ci.yml has not passed/);
  });
}

test('CI gate cannot reuse a different commit, PR, fork or missing workflow', async () => {
  for (const records of [[], [run({ head_sha: 'b'.repeat(40) })], [run({ event: 'pull_request' })],
    [run({ head_repository: { id: 999 } })], [run({ head_branch: 'feature' })]]) {
    await assert.rejects(verifyReleaseCi({ github: github({ 'container-ci.yml': records }),
      context: context() }), /container-ci.yml has not passed/);
  }
});

test('pending rerun blocks publication despite an earlier success', async () => {
  await assert.rejects(verifyReleaseCi({ github: github({ 'backend-ci.yml': [run(),
    run({ id: 101, status: 'queued', conclusion: null })] }), context: context() }), /still running/);
});

test('a failed rerun of an older run blocks a newer historical success', async () => {
  await assert.rejects(verifyReleaseCi({ github: github({ 'backend-ci.yml': [run({ id: 200 }),
    run({ id: 100, run_attempt: 2, conclusion: 'failure', updated_at: '2026-11-11T13:00:00Z' })] }),
  context: context() }), /has not passed/);
});

test('GitHub API errors fail closed', async () => {
  const api = github();
  api.paginate = async () => { throw new Error('API unavailable'); };
  await assert.rejects(verifyReleaseCi({ github: api, context: context() }), /API unavailable/);
});

function environment(changes = {}) {
  return { GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main',
    GITHUB_REPOSITORY: 'mohsammarraie/bus-management-system', GITHUB_REPOSITORY_ID: String(REPOSITORY_ID),
    GITHUB_SHA: sha, GITHUB_RUN_ID: '1234', GITHUB_RUN_ATTEMPT: '1',
    CI_RUNS_JSON: JSON.stringify(WORKFLOWS.map(workflow => ({ workflow, runId: 100, attempt: 1 }))),
    ...changes };
}
function fakeCommands({ account = ACCOUNT, wrongPlatform = false, failPush = false, badDigest = false } = {}) {
  const calls = [];
  return { calls, execute(program, args, options = {}) {
    calls.push({ program, args, options });
    if (program === 'aws' && args[0] === 'sts') return account + '\n';
    if (program === 'aws' && args[1] === 'get-login-password') return 'synthetic-registry-token\n';
    if (program === 'aws' && args[1] === 'describe-images') {
      return badDigest ? 'invalid\n' : 'sha256:' + '1'.repeat(64) + '\n';
    }
    if (program === 'docker' && args[0] === 'image') return wrongPlatform ? 'linux/amd64\n' : 'linux/arm64\n';
    if (program === 'docker' && args[0] === 'push' && failPush) throw new Error('Upload failed');
    return '';
  } };
}

test('publisher tags tested local images and records three immutable digest references', () => {
  const fake = fakeCommands();
  const release = publishImages(environment(), fake.execute);
  assert.equal(release.commit, sha);
  assert.equal(release.tag, `git-${sha}-1234-1`);
  assert.equal(release.platform, 'linux/arm64');
  assert.deepEqual(Object.keys(release.images), SERVICES);
  for (const service of SERVICES) {
    assert.equal(release.images[service], `${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/bus-management-system/${service}@sha256:${'1'.repeat(64)}`);
  }
  const login = fake.calls.find(call => call.args[0] === 'login');
  assert.equal(login.options.input, 'synthetic-registry-token\n');
  assert(!JSON.stringify(login.args).includes('synthetic-registry-token'));
  assert(!JSON.stringify(release).includes('synthetic-registry-token'));
  assert.equal(fake.calls.filter(call => call.args[0] === 'push').length, 3);
  assert(!fake.calls.some(call => call.args.includes('build')), 'Publish must not rebuild tested images');
  assert.equal(fake.calls.at(-1).args[0], 'logout');
});

test('publisher rejects the wrong AWS account before accessing ECR', () => {
  const fake = fakeCommands({ account: '111111111111' });
  assert.throws(() => publishImages(environment(), fake.execute), /unexpected AWS account/);
  assert.equal(fake.calls.length, 1);
});

test('publisher rejects x86 images before obtaining a registry token or pushing', () => {
  const fake = fakeCommands({ wrongPlatform: true });
  assert.throws(() => publishImages(environment(), fake.execute), /linux\/arm64/);
  assert(!fake.calls.some(call => call.args[1] === 'get-login-password' || call.args[0] === 'push'));
});

test('publisher rejects non-main contexts and missing CI evidence before invoking commands', () => {
  for (const changes of [{ GITHUB_REF: 'refs/heads/feature' }, { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_REPOSITORY_ID: '999' }, { CI_RUNS_JSON: '[]' }]) {
    const fake = fakeCommands();
    assert.throws(() => publishImages(environment(changes), fake.execute));
    assert.equal(fake.calls.length, 0);
  }
});

for (const failure of ['failPush', 'badDigest']) {
  test(`publisher returns no release and logs out after ${failure}`, () => {
    const fake = fakeCommands({ [failure]: true });
    assert.throws(() => publishImages(environment(), fake.execute));
    assert.equal(fake.calls.at(-1).args[0], 'logout');
  });
}

test('reruns use a different immutable tag without deleting or overwriting a previous release', () => {
  const first = publishImages(environment(), fakeCommands().execute);
  const second = publishImages(environment({ GITHUB_RUN_ATTEMPT: '2' }), fakeCommands().execute);
  assert.notEqual(first.tag, second.tag);
});

test('IAM grants only ECR publication, with main-only immutable OIDC trust', () => {
  const template = JSON.parse(readFileSync(resolve(__dirname, '../infra/aws/ecr-publication.json')));
  assert.equal(template.Metadata.IntendedAccount, ACCOUNT);
  assert.equal(template.Metadata.IntendedRegion, REGION);
  assert.deepEqual([...new Set(Object.values(template.Resources).map(resource => resource.Type))].sort(),
    ['AWS::ECR::Repository', 'AWS::IAM::OIDCProvider', 'AWS::IAM::Role']);
  const role = template.Resources.PublisherRole.Properties;
  const trust = role.AssumeRolePolicyDocument.Statement[0];
  assert.equal(trust.Action, 'sts:AssumeRoleWithWebIdentity');
  assert.equal(trust.Condition.StringEquals['token.actions.githubusercontent.com:aud'], 'sts.amazonaws.com');
  assert.equal(trust.Condition.StringEquals['token.actions.githubusercontent.com:sub'],
    'repo:mohsammarraie@31845082/bus-management-system@1448687716:ref:refs/heads/main');
  const statements = role.Policies[0].PolicyDocument.Statement;
  assert.equal(statements.filter(item => item.Resource === '*').length, 1);
  assert.equal(statements.find(item => item.Resource === '*').Action, 'ecr:GetAuthorizationToken');
  const scoped = statements.find(item => Array.isArray(item.Resource));
  assert(scoped.Action.every(action => action.startsWith('ecr:') && !action.includes('*') && !/Delete|Create/.test(action)));
  assert.equal(scoped.Resource.length, 3);
  for (const resource of scoped.Resource) {
    const repository = template.Resources[resource['Fn::GetAtt'][0]];
    assert.equal(repository.Type, 'AWS::ECR::Repository');
    assert.equal(repository.Properties.ImageTagMutability, 'IMMUTABLE');
    assert.equal(repository.Properties.EmptyOnDelete, false);
    assert.equal(repository.DeletionPolicy, 'Retain');
    const rules = JSON.parse(repository.Properties.LifecyclePolicy.LifecyclePolicyText).rules;
    assert(rules.every(rule => rule.selection.tagStatus === 'untagged'));
  }
});
