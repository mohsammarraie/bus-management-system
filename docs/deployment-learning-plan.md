# Deployment and monitoring learning plan

Status: future milestone; no cloud resources or deployment automation implemented.
Preference recorded 7 November 2026.

## Goal and budget

Prefer AWS so the developer can build on their AWS Cloud Practitioner certification with hands-on deployment and observability practice. Deploy a temporary personal demo for the developer and one or two friends, not a high-traffic production service. The intended application includes Angular/Caddy, Spring Boot, PostgreSQL and planned Keycloak authentication.

Aim for no out-of-pocket spend. Do not promise that the entire stack can run indefinitely within a free tier. Before selecting services, check the actual account's plan, creation date, eligible offers, remaining credits, expiration dates, region and current prices. AWS currently advertises an eligible-new-account Free plan for up to six months or until credits are exhausted; an existing account may not qualify. Recheck these terms when deployment work begins. Small user numbers do not eliminate baseline CPU/RAM, storage or networking needs. Measure the complete stack, including both JVM services, before choosing compute capacity.

Keep the existing Docker setup portable. Evaluate the simplest AWS hosting arrangement that fits measured requirements and the no-spend constraint; no EC2/ECS/RDS topology or instance size is selected yet. Include compute, disks/snapshots, public addressing, network transfer, image storage and observability in the estimate. Prefer an on-demand demo schedule over an unattended always-on environment. Stopping compute can leave other billable resources behind, so provide complete teardown instructions. If AWS cannot meet the constraint, evaluate another hosting option at that time or retain a local demo rather than silently accepting charges.

## Monitoring practice

Start with a small CloudWatch-based exercise, subject to applicable allowances/pricing:

- Explain logs (events), metrics (measurements over time), dashboards and alarms through this application.
- Observe host/container CPU, memory and disk use; health/availability; HTTP request rate, errors and latency; JVM memory and database-pool pressure where available.
- Distinguish automatically available infrastructure metrics from metrics requiring an agent/exporter or application instrumentation. Backend observability endpoints remain private; existing public exposure is health only.
- Use a small number of metrics, bounded log volume and short retention. Do not export passwords/tokens into logs or personal identifiers as metric labels; keep real trip coordinates out of demo diagnostics.
- Create a useful dashboard and one failure/health alarm, deliberately trigger a safe synthetic failure, and verify detection and recovery. Add tracing only if it serves a later learning objective.

Monitoring itself can incur costs. Verify the chosen CloudWatch features, log ingestion/storage, custom metrics and alarms against account allowances before enabling them. Cost/usage alerts are useful but are delayed notifications, not a guaranteed hard spending cap.

## Delivery acceptance

At the deployment milestone, produce a resource/cost inventory, reproducible setup and teardown, access/secret handling, HTTPS and correct identity-provider redirect URLs. HTTPS is also needed for real-phone geolocation. Use synthetic demo data and verify remote login, role restrictions, a basic business flow, restart/persistence and monitoring. Document limitations and measured resource use for the portfolio. Do not publish cloud credentials or start services as part of merely recording this plan.

Deployment/monitoring follows the runnable MVP. Authentication remains the next application milestone. SMTP/email verification remains optional post-MVP; this deployment preference introduces no email-service requirement.

Sources checked when recording this preference: [AWS Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/), [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/), [AWS Budgets behavior](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html). Offers/pricing must be checked again before deployment.
