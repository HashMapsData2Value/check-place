#!/bin/bash
set -eux

# marker file to verify user-data execution and result
MARKER="/var/log/check-place-user-data.marker"
echo "user-data start: $(date -u) pid=$$" > "$MARKER" || true
# ensure we always write an exit code and timestamp on exit
trap 'rc=$?; echo "user-data exit: rc=$rc time=$(date -u)" >> "$MARKER" || true; if [ "$rc" -eq 0 ]; then echo "user-data status: SUCCESS" >> "$MARKER" || true; else echo "user-data status: FAILURE" >> "$MARKER" || true; fi' EXIT

# collect quick diagnostics to the marker for debugging
arch_now="$(uname -m || true)"
echo "arch: $arch_now" >> "$MARKER" || true
echo "uname: $(uname -a || true)" >> "$MARKER" || true
{ command -v aws >/dev/null 2>&1 && aws --version 2>&1 || echo "aws: not-found-or-error" ; } >> "$MARKER" 2>&1 || true
{ command -v docker >/dev/null 2>&1 && docker --version 2>&1 || echo "docker: not-found-or-error" ; } >> "$MARKER" 2>&1 || true
{ command -v git >/dev/null 2>&1 && git --version 2>&1 || echo "git: not-found-or-error" ; } >> "$MARKER" 2>&1 || true
{ docker compose version 2>&1 || echo "docker-compose-cli: not-available" ; } >> "$MARKER" 2>&1 || true
{ systemctl is-active amazon-ssm-agent 2>&1 || echo "ssm-agent: unknown" ; } >> "$MARKER" 2>&1 || true

# Install dependencies (Amazon Linux 2 compatible)
if command -v yum >/dev/null 2>&1; then
  yum update -y
  amazon-linux-extras install -y docker
  yum install -y git
  yum install -y awscli || true
  yum install -y unzip curl || true
  systemctl enable --now docker
  usermod -a -G docker ec2-user || true
  # install compose plugin if available
  yum install -y docker-compose-plugin || true
else
  apt-get update -y
  apt-get install -y docker.io docker-compose git
  apt-get install -y awscli || true
  apt-get install -y unzip curl || true
  systemctl enable --now docker
fi

# Ensure SSM agent is running so SSM/Parameter Store calls work
systemctl enable --now amazon-ssm-agent || true

# Ensure AWS CLI v2 is present (v1 may be installed by package manager)
## Ensure AWS CLI v2 is present (pick correct arch; handle installer failures)
arch="$(uname -m || true)"
if command -v aws >/dev/null 2>&1; then
  if ! aws --version 2>&1 | grep -q "aws-cli/2"; then
    WANT_INSTALL=true
  else
    WANT_INSTALL=false
  fi
else
  WANT_INSTALL=true
fi
if [ "$WANT_INSTALL" = "true" ]; then
  # choose installer for architecture
  case "$arch" in
    x86_64|amd64)
      aws_zip_url="https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip"
      ;;
    aarch64|arm64)
      aws_zip_url="https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip"
      ;;
    *)
      aws_zip_url="https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip"
      ;;
  esac
  rm -f /usr/local/bin/aws || true
  rm -rf /tmp/aws || true
  curl -sSL "$aws_zip_url" -o /tmp/awscliv2.zip || true
  unzip -o /tmp/awscliv2.zip -d /tmp || true
  # installer may fail if arch mismatch; ignore errors but leave a usable aws if present
  /tmp/aws/install --update || true
fi

## Attempt to fetch a private deploy key from SSM (works whether Terraform created it or you added it manually)
mkdir -p /home/ec2-user/.ssh
chown ec2-user:ec2-user /home/ec2-user/.ssh

## fetch private key from SSM with retries (requires instance role permission: ssm:GetParameter)
MAX_RETRIES=5
SLEEP_SECONDS=6
FOUND_KEY=0
for i in $(seq 1 $MAX_RETRIES); do
  if aws ssm get-parameter --name "${deploy_key_ssm_name}" --region "${aws_region}" --with-decryption --query Parameter.Value --output text > /home/ec2-user/.ssh/id_deploy 2>/dev/null; then
    if [ -s /home/ec2-user/.ssh/id_deploy ]; then
      FOUND_KEY=1
      break
    fi
  fi
  sleep $SLEEP_SECONDS
done
if [ "$FOUND_KEY" -eq 1 ]; then
  chmod 600 /home/ec2-user/.ssh/id_deploy
  chown ec2-user:ec2-user /home/ec2-user/.ssh/id_deploy

  # ssh config to use this key for github.com
  cat > /home/ec2-user/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  IdentityFile /home/ec2-user/.ssh/id_deploy
  IdentitiesOnly yes
EOF
  chmod 600 /home/ec2-user/.ssh/config
  chown ec2-user:ec2-user /home/ec2-user/.ssh/config
fi

# always ensure github.com known hosts entry exists (avoids host verification failures)
ssh-keyscan github.com >> /home/ec2-user/.ssh/known_hosts 2>/dev/null || true
chmod 644 /home/ec2-user/.ssh/known_hosts || true
chown ec2-user:ec2-user /home/ec2-user/.ssh/known_hosts || true

# Ensure docker compose CLI plugin present; fall back to direct download if package not available
machine_arch="$(uname -m || true)"
if ! docker compose version >/dev/null 2>&1; then
  sudo mkdir -p /usr/local/lib/docker/cli-plugins || true
  case "$machine_arch" in
    aarch64|arm64)
      plugin_url="https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-linux-aarch64"
      ;;
    x86_64|amd64)
      plugin_url="https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-linux-x86_64"
      ;;
    *)
      plugin_url="https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-linux-x86_64"
      ;;
  esac
  curl -sSL "$plugin_url" -o /usr/local/lib/docker/cli-plugins/docker-compose || true
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose || true
fi

# Clone repo and bring up services (run as ec2-user so files are owned)
cd /home/ec2-user || true
if [ ! -d app ]; then
  sudo -u ec2-user git clone "${repo_url}" app || true
else
  cd app && sudo -u ec2-user git pull || true
fi
cd app || exit 0

# before starting compose, try to populate backend/.env from SSM
if aws ssm get-parameter --name "/check-place/backend/env" --region "${aws_region}" --with-decryption --query Parameter.Value --output text > /home/ec2-user/app/backend/.env 2>/dev/null; then
  echo "wrote backend/.env from SSM" >> "$MARKER" || true
  chown ec2-user:ec2-user /home/ec2-user/app/backend/.env || true
  chmod 600 /home/ec2-user/app/backend/.env || true
else
  echo "no SSM /check-place/backend/env parameter found or retrieval failed" >> "$MARKER" || true
fi

# Run compose (assumes docker compose v2 plugin or docker-compose present)
docker compose pull || true
docker compose up -d || true

# Optionally remove the private key after clone to reduce on-disk secrets
if [ "${cleanup_deploy_key}" = "true" ] || [ "${cleanup_deploy_key}" = "True" ]; then
  if [ -f /home/ec2-user/.ssh/id_deploy ]; then
    rm -f /home/ec2-user/.ssh/id_deploy || true
  fi
  if [ -f /home/ec2-user/.ssh/config ]; then
    rm -f /home/ec2-user/.ssh/config || true
  fi
fi
