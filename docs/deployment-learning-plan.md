# Deployment and monitoring learning plan

Status: ARM64 image publication and a disposable Frankfurt EC2 demo were verified on 12 November 2026, including public HTTPS, OIDC/roles and buses CRUD from desktop/mobile. The [manual deployment guide](aws-deployment.md) records setup and cleanup. Operator-performed instance/root-disk/DNS cleanup was verified, with no snapshot for the disk. ECR images and repositories were deleted; restore the repositories before the next publication. Empty repositories can be retained without image-storage charges. Automated EC2 CD remains planned.

## Goal and budget

Deploy the current Angular/Caddy, Spring Boot, PostgreSQL and Keycloak stack as a temporary personal demo for the developer and one or two friends. Exercise signup/login/logout and buses CRUD on desktop and a real mobile phone. AWS is preferred to build on the developer's Cloud Practitioner certification.

The developer reports a new AWS Free plan with $100 credit and access until 11 May 2027 or credit exhaustion (console status supplied 11 November 2026). The account API confirmed an active Free plan with $100 remaining on 12 November 2026; billing updates are delayed. Aim for no out-of-pocket spend; track credit consumption and do not upgrade the account plan as part of deployment. Prefer Frankfurt (`eu-central-1`) for the developer and demo users in Germany; Stockholm is a slightly cheaper alternative. Confirm account eligibility and offers before provisioning.

## Hosting decision

Recommend all four runtime containers on one EC2 VM with Docker Compose for the temporary demo. Running Spring Boot directly on the same VM changes packaging, with little effect on allocated infrastructure cost. Keeping Angular/Caddy on that VM preserves the same-origin authentication/appearance setup; its measured footprint is small. Build images locally or in CI, then pull runtime images onto the VM; image-build capacity was not included in the measurements.

| Alternative | Assessment |
|---|---|
| EC2 On-Demand + Compose | Preferred for occasional testing: reuse the stack, stop compute between demos, retain durable data and budget storage/addressing separately. Single-host availability and self-managed database backups/updates are demo trade-offs. |
| Lightsail Linux VM + Compose | Simpler bundled alternative for an always-online demo: advertised IPv4 bundles are $12/month for 2 GB or $24/month for 4 GB, including disk/transfer allowances. Stopped instances still accrue charges. Confirm Free-plan availability in the account before selecting; AWS offer pages are not fully consistent on Lightsail eligibility. |
| Separate application/container services and managed database | Useful future operational practice, but requires a new connectivity/session/persistence design and separate pricing. Moving only the frontend off the VM is unlikely to reduce the required VM size. No managed-service topology has been selected. |
| Render free preview | Idle services sleep after 15 minutes, free hours are shared, PostgreSQL expires after 30 days and free web services cannot receive private traffic. A temporary fallback requiring adaptation. |

## Capacity assessment — 11 November 2026

Measured source `8ac2edf` on Linux amd64 with a 29 GiB host, cgroup v2 and freshly built runtime images. Two disposable synthetic projects each completed cold startup, 30 seconds idle, five sequential real OIDC/CRUD/role/CSRF/signup smoke rounds and 30 seconds after the workload. Both finished healthy with zero container restarts or OOM kills; their containers/networks/volumes were removed.

Without container limits, post-workload working sets totaled about 1.74 GiB. The bounded run used 1,600 MiB of configured memory limits, disabled container swap and CPU quotas totaling two cores (0.75 per JVM, 0.25 each for database/frontend):

| Service | Limit (MiB) | Post-workload working set (MiB) | Cgroup peak (MiB) |
|---|---:|---:|---:|
| frontend | 64 | 13 | 20 |
| backend | 512 | 298 | 304 |
| keycloak | 768 | 549 | 728 |
| db | 256 | 91 | 170 |

The bounded run reached readiness in 105 seconds; post-workload working sets totaled about 950 MiB. Cgroup peaks include charged cache and are per-container lifetime maxima, not a simultaneous total. `docker stats` working sets subtract inactive file cache. This is a short local capacity probe, not a concurrency/load test or a whole-VM measurement; OS/Docker/monitoring memory, EC2 CPU-credit behavior and real cloud startup remain to be validated.

The developer also ran the full stack on a MacBook Air M4: all four runtime images inspect as `linux/arm64`, and login/buses CRUD succeeded. Reported Docker container memory stayed around 1.32–1.34 GB after use. This is evidence of native ARM compatibility, not an EC2 capacity test or startup peak; the screenshot's 5.65 GB is Docker's available memory, not application demand.

Validated for the short demo: **t4g.small (2 vCPU, 2 GiB, ARM64), On-Demand**, with explicit container limits and prebuilt `linux/arm64` images. After cloud login/CRUD checks the host used about 1.4 GiB RAM with roughly 393 MiB available, and all four containers were healthy with zero restarts. Keycloak first initialization exceeded the original readiness deadline; the AWS Compose grace period is now longer. These readings are not a concurrency/load test; validate peaks and CPU-credit behavior for sustained use. **t3.small (2 GiB, x86-64)** remains an alternative; **c7i-flex.large (4 GiB)** is the documented Free-plan fallback for more memory. One-GiB micro instances are too tight for the observed stack. Do not assume `t3.medium` eligibility: it is absent from AWS's current documented Free-plan list.

## Cost and operating schedule

Public AWS regional price catalog checked 11 November 2026 (Frankfurt, Linux shared tenancy). Estimates use one public IPv4 address ($0.005/hour) and 30 GB gp3 storage ($0.0952/GB-month), with 730 hours/month. The 24-hour column assumes disk/IP allocated for only that day; the monthly column retains them throughout. Amounts are before applying the developer's $100 account credit, rather than cash invoices or guaranteed quotes.

| Candidate | Compute/hour | Running 24 hours | Running 730 hours/month |
|---|---:|---:|---:|
| t4g.small, within current compute promotion | $0 | $0.21 | $6.51 |
| t4g.small, standard rate | $0.01920 | $0.67 | $20.52 |
| t3.small, standard rate | $0.02400 | $0.79 | $24.03 |

AWS currently advertises an automatic **750 t4g.small compute hours/month through 31 December 2026**, including Frankfurt, shared across regions. Covered compute appears as $0 and should not consume account credit. The promotion covers neither EBS, public IPv4 nor surplus CPU charges; eligible ancillary usage can still consume the $100 balance. Standard compute pricing applies from 1 January 2027 or after the monthly allowance. This promotion has a separate expiry from the developer's account credit; verify both in billing after launch.

Exclude tax, domain registration, backups/snapshots, registry storage, transfers outside allowances, CloudWatch and any T3/T4g Unlimited surplus CPU charges; inventory these before launch. Basic monitoring and bounded logs should be priced separately. After the promotion, continuously running t4g.small at this estimate exceeds $100 over six months; a limited operating schedule preserves credit.

On-Demand is a billing model, not automatic shutdown when HTTP traffic stops. Stop EC2 explicitly between test sessions; stopping only Compose leaves EC2 running. EBS and a retained Elastic IP continue accruing costs while stopped. Keeping an address avoids changing demo URLs; releasing it requires a DNS/public-URL update plan. Choose CPU-credit mode explicitly: Standard can throttle, Unlimited can add charges. CPU performance credits are separate from promotional dollar credit. Cost alerts are delayed notifications, not a hard spending cap. No cloud resources, registry publications or account settings have been created/changed by this assessment.

References: [AWS EC2 Free-plan eligibility](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html), [T4g trial terms](https://aws.amazon.com/ec2/faqs/), [Frankfurt price catalog](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/eu-central-1/index.json), [EC2 On-Demand](https://aws.amazon.com/ec2/pricing/on-demand/), [public IPv4](https://aws.amazon.com/vpc/pricing/), [stop/start behavior](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/how-ec2-instance-stop-start-works.html), [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/), [Lightsail billing](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html), [Render limits](https://render.com/docs/free). Recheck account eligibility and rates before provisioning.

## Deployment preparation

- Complete the [private-reporting setup](next-steps.md#to-do-before-public-deployment-private-vulnerability-reporting) and keep [SECURITY.md](../SECURITY.md) aligned with the verified reporting channel before public exposure.
- Keep Docker images portable and use separate deployment configuration; preserve both local startup modes. Define reproducible provisioning, updates, rollback and teardown. Automatic deployment on merge is a later decision.
- Use a reachable HTTPS hostname for the app, API and identity paths. Replace loopback-only public URLs with exact public issuer, callback and logout URLs; preserve correct internal OIDC connectivity. HTTPS also prepares for later phone geolocation.
- Set secure session cookies and trusted proxy headers; expose only intended public routes. Keep PostgreSQL, backend management endpoints and Keycloak administration private or access-restricted. The current loopback HTTP Compose/Caddy setup is not ready for direct internet exposure.
- Use fresh deployment secrets and controlled demo roles; do not reuse example credentials or publish secrets. Use synthetic users and bus data, with a documented signup policy; SMTP/email verification remains post-MVP.
- Preserve application/identity database and role separation, durable data, and a backup/restore path. Plan exports before free-tier expiry; ephemeral container storage is not persistence.

## Monitoring practice

Start with service logs, health, host/container CPU, memory and disk use. For AWS, add a small CloudWatch exercise within verified allowances: short log retention, a useful dashboard and one failure/health alarm. Verify a safe synthetic failure and recovery. Provider-native equivalents are acceptable on another host.

Keep backend observability endpoints private. Distinguish infrastructure metrics from those needing an agent/exporter or application instrumentation. Bound log volume and metric count; do not log secrets or real trip coordinates, or put personal identifiers in metric labels. Richer HTTP/JVM/database dashboards and tracing can follow the first working demo.

Check [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/) and [AWS Budgets behavior](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) before enabling features.

## Delivery acceptance

Record the selected host, measured resource use, account allowances/expiry, resource inventory and cost estimate. Provide setup/update/teardown instructions and a reachable HTTPS demo URL. Verify remote signup/login/logout, passenger/admin boundaries, ADMIN bus CRUD, secure cookies/CSRF and restart/persistence. Exercise the actual phone browser, responsive layouts, en/de/ar and RTL; record limitations rather than claiming complete device/accessibility coverage. Demonstrate health/log visibility and failure recovery with synthetic data.

After the demo and its operating/cleanup instructions are reviewed, resume routes and stops. Public deployment, resource creation and changes to GitHub repository settings are separate implementation steps; none are performed by this planning update.
