const WORKFLOWS = ['backend-ci.yml', 'frontend-ci.yml', 'container-ci.yml'];
const REPOSITORY = 'mohsammarraie/bus-management-system';
const REPOSITORY_ID = 1448687716;

async function verifyReleaseCi({ github, context }) {
  if (context.eventName !== 'workflow_dispatch' || context.ref !== 'refs/heads/main' ||
      `${context.repo.owner}/${context.repo.repo}` !== REPOSITORY ||
      context.payload.repository.id !== REPOSITORY_ID) {
    throw new Error('Publication is restricted to manual runs from this repository on main.');
  }
  if (!/^[a-f0-9]{40}$/.test(context.sha)) {
    throw new Error('Expected an immutable source commit SHA.');
  }

  const ci = [];
  for (const workflow of WORKFLOWS) {
    const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
      ...context.repo, workflow_id: workflow, branch: 'main', head_sha: context.sha, per_page: 100,
    });
    // Never substitute a PR run or an older commit's green status. Evaluate the
    // latest trusted run, including a queued/failed rerun, rather than any success.
    const trusted = runs.filter(item => item.head_sha === context.sha && item.head_branch === 'main' &&
      item.head_repository?.id === REPOSITORY_ID &&
      ['push', 'workflow_dispatch'].includes(item.event));
    if (trusted.some(item => item.status !== 'completed')) {
      throw new Error(`${workflow} is still running for ${context.sha}. Wait for CI, then retry publication.`);
    }
    const run = trusted.sort((left, right) =>
      Date.parse(right.updated_at) - Date.parse(left.updated_at) || right.id - left.id)[0];
    if (!run || run.status !== 'completed' || run.conclusion !== 'success') {
      throw new Error(`${workflow} has not passed for ${context.sha}. Wait for CI or fix/rerun it, then retry publication.`);
    }
    ci.push({ workflow, runId: run.id, attempt: run.run_attempt, url: run.html_url });
  }
  return { commit: context.sha, ci };
}

module.exports = { verifyReleaseCi, WORKFLOWS, REPOSITORY, REPOSITORY_ID };
