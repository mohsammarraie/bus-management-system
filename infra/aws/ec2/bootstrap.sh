#!/bin/bash
set -euo pipefail
# Run explicitly on a fresh Ubuntu 24.04 ARM64 EC2 host, not on the workstation.
[ "$(id -u)" -eq 0 ] || { echo 'Run with sudo bash.' >&2; exit 1; }
. /etc/os-release
[ "$ID" = ubuntu ] && [ "$VERSION_ID" = 24.04 ] || { echo 'Requires Ubuntu 24.04.' >&2; exit 1; }
[ "$(dpkg --print-architecture)" = arm64 ] || { echo 'Requires ARM64.' >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin
cloud-init status --wait
apt-get -o APT::Update::Error-Mode=any update
apt-get -o DPkg::Lock::Timeout=180 install -y ca-certificates curl git python3
install -m 0755 -d /etc/apt/keyrings
curl --fail --silent --show-error --location --retry 3 https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod 0644 /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<'EOF'
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: arm64
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get -o APT::Update::Error-Mode=any update
apt-get -o DPkg::Lock::Timeout=180 install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
if ! command -v aws >/dev/null 2>&1; then snap install aws-cli --classic; fi
docker version --format '{{.Server.Version}}'
docker compose version
aws --version
aws sts get-caller-identity --region eu-central-1 --query '{Account:Account,Arn:Arn}' --output json
uname -m
free -h
df -h /
