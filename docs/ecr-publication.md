# ARM64 image publication

Status: AWS repositories/OIDC role applied and ARM64 publication verified on 12 November 2026 in account `749789489994`, Frankfurt `eu-central-1`. [First successful publication](https://github.com/mohsammarraie/bus-management-system/actions/runs/43124299907), attempt 3. EC2 deployment is a separate, operator-run step. After the disposable demo, all three repositories and their images were deleted; they must be restored before another publication.

## Workflow

[ECR publication](../.github/workflows/ecr-publication.yml) runs fast, dependency-free Node configuration/security tests on PRs and `main` pushes. It does not build containers or contact AWS on those events. Publication requires **Actions → ECR publication → Run workflow → main**, available after merging the workflow.

The publication job:

1. Requires successful Backend CI, Frontend CI and Container CI for the selected exact `main` commit. PR/fork/older-commit successes do not qualify; pending or failed reruns block publication. Missing checks fail immediately rather than spending runner time waiting.
2. Builds the three application images on a native `ubuntu-24.04-arm` runner and runs the existing Compose smoke scenario against those images. This is ARM release verification in the manual workflow; routine PR container checks stay unchanged. The heavier `smoke-aws.py` remains a local manual check.
3. Rechecks CI, then uses GitHub OIDC to assume the publisher role for 15 minutes. No permanent AWS access keys or application secrets are stored in GitHub.
4. Verifies account/architecture and uploads the same tested images, without rebuilding. Tags are `git-<commit>-<run-id>-<attempt>`; reruns do not overwrite earlier images.
5. Uploads `release.json` containing the source commit, successful CI references and the three ECR digest references. The publisher cannot deploy, create AWS resources or delete images.

This step is manually triggered publication. Automatic publication after CI and the manually triggered EC2 CD workflow can follow the first working release/deployment. Forks/feature branches cannot use the publishing role. Publication jobs are serialized; a newer push does not interrupt an upload in progress.

## One-time AWS setup

[ecr-publication.json](../infra/aws/ecr-publication.json) is a CloudFormation template with these resources:

| Resource | Configuration |
|---|---|
| Three private ECR repositories | `bus-management-system/frontend`, `/backend`, `/keycloak`; AES256 encryption and immutable tags |
| GitHub IAM OIDC provider | Created only when no existing provider ARN is supplied; never duplicate or replace a shared provider |
| `bus-management-ecr-publisher` role | Upload/describe access scoped to those repositories; `ecr:GetAuthorizationToken` alone uses `Resource: *` |

The trust policy requires audience `sts.amazonaws.com` and the exact subject below. This repository was created after GitHub's immutable-subject rollout; the IDs were verified through GitHub's public API:

```text
repo:mohsammarraie@31845082/bus-management-system@1448687716:ref:refs/heads/main
```

The publication job intentionally has no GitHub environment, which would change the subject. If OIDC has been customized, reconcile that configuration before applying the trust policy; do not broaden the policy to arbitrary repositories/branches. Main-branch workflow review is part of the trust boundary; IAM does not evaluate GitHub CI status itself.

Use an authenticated AWS operator session, such as CloudShell, for setup. Confirm the target account and check for an existing provider:

```bash
aws sts get-caller-identity --query Account --output text
aws iam list-open-id-connect-providers
```

The account must be `749789489994`. If the GitHub provider already exists, set `GITHUB_OIDC_PROVIDER_ARN` to its existing ARN; otherwise leave it empty. With the checked-out template, prepare a change set for review:

```bash
GITHUB_OIDC_PROVIDER_ARN=""
# If present, instead use arn:aws:iam::749789489994:oidc-provider/token.actions.githubusercontent.com
aws cloudformation deploy \
  --region eu-central-1 \
  --stack-name bus-management-ecr-publication \
  --template-file infra/aws/ecr-publication.json \
  --parameter-overrides ExistingGitHubOidcProviderArn="$GITHUB_OIDC_PROVIDER_ARN" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
```

Review and execute the change set in CloudFormation only when ready to create these resources. The setup operator needs resource-creation permissions; these are not granted to the publisher. No GitHub AWS secrets, repository variables, EC2 instance, DNS record or deployment role is needed for image publication.

Repositories and any newly created OIDC provider use `Retain` on stack deletion. Tagged images are retained for rollback; only untagged images older than seven days are selected by the lifecycle rule. Storage/transfer still count toward the AWS budget, including retained resources after deleting the stack. Clean up obsolete tagged releases deliberately without deleting a deployed or rollback digest. Registry scanning configuration is not changed and enhanced scanning is not enabled by this template.

## Storage and cleanup

Empty private repositories have no image-storage charge. Charges apply to stored images/artifacts, applicable data transfer and any separately enabled services. For development pauses, keep the repositories/configuration and delete unwanted images from **inside** each repository. A later publication builds/pushes fresh images. See [ECR pricing](https://aws.amazon.com/ecr/pricing/).

Cleanup on 12 November 2026 removed the repositories as well as their images. Their deletion is drift from the applied CloudFormation stack. Before the next publication, reconcile/restore `bus-management-system/frontend`, `/backend` and `/keycloak` with the template's encryption, immutable tags and lifecycle policy, then verify the publisher role's access. The publication workflow does not recreate repositories; the deleted release's digest references cannot be pulled until images with those digests exist again. Keep the existing OIDC provider and role when restoring this setup.

## First publication and deployment handoff

After setup and merge, wait for all three source/container workflows on `main` to pass, then manually run ECR publication from `main`. Download the `arm64-release-...` artifact from a successful run. A partial upload is not a complete release; failed attempts can leave tagged images, and the next attempt uses new tags. GitHub keeps the manifest artifact for 30 days, so keep the selected manifest with deployment records.

Check out `release.json`'s exact source commit for the deployment files. Copy its three image references into `FRONTEND_IMAGE`, `BACKEND_IMAGE` and `KEYCLOAK_IMAGE`, then follow [AWS configuration generation](aws-deployment.md#images-and-configuration) on the VM. Each reference has this form:

```text
749789489994.dkr.ecr.eu-central-1.amazonaws.com/bus-management-system/frontend@sha256:<digest>
```

Only the three application images are published; PostgreSQL keeps its pinned upstream image. Publication neither runs `prepare.py` nor touches database data, application credentials, EC2 or IONOS. EC2 will need a separate pull/management role in the deployment step.

## Verification

`node --test scripts/release-publication.test.cjs` checks CI gating, publication failure paths, image/account checks and the IAM contract without contacting AWS. CloudFormation schema validation uses `cfn-lint --template infra/aws/ecr-publication.json --regions eu-central-1`; workflow syntax uses actionlint. Native ARM builds, real OIDC/ECR authentication and digest publication passed in the linked hosted run. Local x86 checks alone do not establish those results.

References: [GitHub AWS OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [immutable subjects](https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims), [public ARM runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [ECR push permissions](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-push-iam.html), [tag immutability](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html), [lifecycle behavior](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html).
