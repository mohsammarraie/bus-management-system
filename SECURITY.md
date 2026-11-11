# Security policy

## Maintenance scope

Bus Management System is a learning and portfolio project. Security fixes target the latest `main`; older commits, feature branches and the original graduation-project repository are not maintained here. There is no guaranteed support period or response time.

## Reporting a vulnerability

Do not publish vulnerability details in public issues, pull requests or discussions.

GitHub private vulnerability reporting is currently disabled for this repository. Open an issue titled **Security contact request** containing only a request for a private reporting channel. Wait for the maintainer to provide private contact instructions before sharing the finding.

Once a private channel is established, include:

- Affected commit or image version and deployment mode.
- A description, expected/actual behavior and potential impact.
- Minimal reproduction steps or a proof of concept using synthetic data.
- Relevant sanitized logs or screenshots; omit passwords, tokens, cookies and personal data.

## Response and disclosure

Reports are reviewed on a best-effort basis. The maintainer will work with the reporter to confirm the issue and coordinate remediation and disclosure. Please allow time for a fix before publishing technical details. Reporter credit can be agreed before disclosure.

## Deployment scope

The local Compose setup uses development defaults and is not ready for direct internet exposure. Public deployments need HTTPS, fresh secrets, restricted administrative/internal endpoints and durable data with a backup/restore path. See the [deployment plan](docs/deployment-learning-plan.md).
