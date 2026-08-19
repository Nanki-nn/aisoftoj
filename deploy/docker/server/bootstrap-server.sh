#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Usage: $0 <deploy-public-key-file> <release-signing-public-key-file>" >&2
  exit 2
}

[[ $# -eq 2 ]] || usage
deploy_public_key_file=$1
release_public_key_file=$2
[[ "$(id -u)" -eq 0 ]] || { echo 'Run as root' >&2; exit 1; }
[[ -f "$deploy_public_key_file" ]]
[[ -f "$release_public_key_file" ]]

script_dir="$(cd "$(dirname "$0")" && pwd)"
template_source="$(cd "${script_dir}/.." && pwd)"

install_docker() {
  if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
    return
  fi

  apt-get update
  apt-get install -y ca-certificates curl gnupg git openssl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
    "${UBUNTU_CODENAME:-$VERSION_CODENAME}" > /etc/apt/sources.list.d/docker.sources
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

install_docker

if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
fi
passwd --lock deploy >/dev/null 2>&1 || true

install -d -o root -g root -m 0755 /usr/local/lib/aisoftoj-deploy
install -d -o root -g root -m 0755 /usr/local/sbin
install -d -o root -g root -m 0755 /opt/aisoftoj /opt/aisoftoj/releases /opt/aisoftoj/uploads
install -d -o root -g root -m 0700 /var/lib/aisoftoj-deploy /var/backups/aisoftoj

install -o root -g root -m 0644 "${template_source}/compose.production.yml" /usr/local/lib/aisoftoj-deploy/compose.production.yml
install -o root -g root -m 0644 "${template_source}/host-nginx.conf" /usr/local/lib/aisoftoj-deploy/host-nginx.conf
install -o root -g root -m 0644 "${template_source}/backend.Dockerfile" /usr/local/lib/aisoftoj-deploy/backend.Dockerfile
install -o root -g root -m 0644 "${template_source}/frontend.Dockerfile" /usr/local/lib/aisoftoj-deploy/frontend.Dockerfile
install -o root -g root -m 0644 "${template_source}/frontend-nginx.conf" /usr/local/lib/aisoftoj-deploy/frontend-nginx.conf
install -o root -g root -m 0644 "$release_public_key_file" /usr/local/lib/aisoftoj-deploy/release-signing-public.pem

for command_name in aisoftoj-deploy aisoftoj-rollback aisoftoj-deploy-dispatch aisoftoj-deploy-recover; do
  install -o root -g root -m 0755 "${script_dir}/${command_name}" "/usr/local/sbin/${command_name}"
done
install -o root -g root -m 0644 "${script_dir}/deploy-lib.sh" /usr/local/lib/aisoftoj-deploy/deploy-lib.sh

install -d -o deploy -g deploy -m 0700 /home/deploy/.ssh
deploy_public_key="$(cat "$deploy_public_key_file")"
printf 'restrict,command="/usr/local/sbin/aisoftoj-deploy-dispatch" %s\n' "$deploy_public_key" \
  > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 0600 /home/deploy/.ssh/authorized_keys

cat > /etc/sudoers.d/aisoftoj-deploy <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/local/sbin/aisoftoj-deploy *
EOF
chmod 0440 /etc/sudoers.d/aisoftoj-deploy
visudo --check --file=/etc/sudoers.d/aisoftoj-deploy

install -o root -g root -m 0644 "${script_dir}/aisoftoj-deploy-recover.service" /etc/systemd/system/aisoftoj-deploy-recover.service
systemctl daemon-reload
systemctl enable aisoftoj-deploy-recover.service

if [[ ! -f /var/lib/aisoftoj-deploy/state.env ]]; then
  cat > /var/lib/aisoftoj-deploy/state.env <<'EOF'
STAGE=IDLE
TARGET_SHA=''
PREVIOUS_SHA=''
BACKUP_DIR=''
LEGACY_WAS_ACTIVE=0
LEGACY_WAS_ENABLED=0
UPDATED_AT=''
EOF
  chmod 0600 /var/lib/aisoftoj-deploy/state.env
fi

docker --version
docker compose version
echo 'AisoftOJ Docker deployment bootstrap completed'
