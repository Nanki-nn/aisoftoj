#!/usr/bin/env bash

DEPLOY_ROOT=/opt/aisoftoj
RELEASES_DIR=${DEPLOY_ROOT}/releases
UPLOADS_DIR=${DEPLOY_ROOT}/uploads
CURRENT_LINK=${DEPLOY_ROOT}/current
TEMPLATE_DIR=/usr/local/lib/aisoftoj-deploy
COMPOSE_FILE=${TEMPLATE_DIR}/compose.production.yml
HOST_NGINX_TEMPLATE=${TEMPLATE_DIR}/host-nginx.conf
NGINX_CONFIG=/etc/nginx/sites-available/aisoftoj
STATE_DIR=/var/lib/aisoftoj-deploy
STATE_FILE=${STATE_DIR}/state.env
BACKUP_ROOT=/var/backups/aisoftoj
ENV_FILE=/etc/aisoftoj/aisoftoj.env
LEGACY_UNIT=aisoftoj.service
DEPLOY_LOCK=/var/lock/aisoftoj-deploy.lock
REPOSITORY=Nanki-nn/aisoftoj
REPOSITORY_URL=https://github.com/Nanki-nn/aisoftoj.git
PUBLIC_BASE_URL=https://aisoftoj.cn

log() {
  printf '[%s] %s\n' "$(date --iso-8601=seconds)" "$*"
}

die() {
  log "ERROR: $*"
  exit 1
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die 'This command must run as root'
}

validate_sha() {
  [[ "${1:-}" =~ ^[0-9a-f]{40}$ ]] || die 'Release must be a full lowercase Git SHA'
}

atomic_state() {
  local stage=$1
  local target_sha=${2:-}
  local previous_sha=${3:-}
  local backup_dir=${4:-}
  local legacy_was_active=${5:-0}
  local legacy_was_enabled=${6:-0}
  local tmp

  mkdir -p "$STATE_DIR"
  chmod 0700 "$STATE_DIR"
  tmp="$(mktemp "${STATE_DIR}/.state.XXXXXX")"
  {
    printf 'STAGE=%q\n' "$stage"
    printf 'TARGET_SHA=%q\n' "$target_sha"
    printf 'PREVIOUS_SHA=%q\n' "$previous_sha"
    printf 'BACKUP_DIR=%q\n' "$backup_dir"
    printf 'LEGACY_WAS_ACTIVE=%q\n' "$legacy_was_active"
    printf 'LEGACY_WAS_ENABLED=%q\n' "$legacy_was_enabled"
    printf 'UPDATED_AT=%q\n' "$(date --iso-8601=seconds)"
  } > "$tmp"
  chmod 0600 "$tmp"
  sync -f "$tmp"
  mv -f "$tmp" "$STATE_FILE"
  sync -f "$STATE_DIR"
}

load_state() {
  STAGE=IDLE
  TARGET_SHA=
  PREVIOUS_SHA=
  BACKUP_DIR=
  LEGACY_WAS_ACTIVE=0
  LEGACY_WAS_ENABLED=0
  UPDATED_AT=
  if [[ -f "$STATE_FILE" ]]; then
    # The file is root-owned and only written by atomic_state.
    # shellcheck disable=SC1090
    source "$STATE_FILE"
  fi
}

release_dir() {
  printf '%s/%s\n' "$RELEASES_DIR" "$1"
}

runtime_env() {
  printf '%s/runtime.env\n' "$(release_dir "$1")"
}

compose_for() {
  local sha=$1
  shift
  docker compose \
    --project-name aisoftoj \
    --env-file "$(runtime_env "$sha")" \
    --file "$COMPOSE_FILE" \
    "$@"
}

current_sha() {
  if [[ -L "$CURRENT_LINK" ]]; then
    basename "$(readlink -f "$CURRENT_LINK")"
  fi
}

atomic_current_link() {
  local sha=$1
  local target
  local tmp_link=${DEPLOY_ROOT}/.current.new
  target="$(release_dir "$sha")"
  [[ -d "$target" ]] || die "Release directory is missing: $target"
  rm -f "$tmp_link"
  ln -s "$target" "$tmp_link"
  mv -Tf "$tmp_link" "$CURRENT_LINK"
  sync -f "$DEPLOY_ROOT"
}

container_health() {
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null || true
}

wait_for_container() {
  local container=$1
  local timeout_seconds=$2
  local elapsed=0
  while (( elapsed < timeout_seconds )); do
    if [[ "$(container_health "$container")" == healthy ]]; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  docker logs --tail 80 "$container" >&2 || true
  return 1
}

public_smoke() {
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' RETURN

  curl --fail --silent --show-error "${PUBLIC_BASE_URL}/" > "${tmp_dir}/home.html"
  curl --fail --silent --show-error "${PUBLIC_BASE_URL}/login" > /dev/null
  curl --fail --silent --show-error "${PUBLIC_BASE_URL}/papers" > /dev/null
  curl --fail --silent --show-error "${PUBLIC_BASE_URL}/api/paper/list" > "${tmp_dir}/paper.json"
  grep -q '"code":200' "${tmp_dir}/paper.json"

  local admin_status not_found_status uploads_status
  admin_status="$(curl --silent --output "${tmp_dir}/admin.json" --write-out '%{http_code}' "${PUBLIC_BASE_URL}/api/admin/dashboard")"
  not_found_status="$(curl --silent --output "${tmp_dir}/not-found.json" --write-out '%{http_code}' "${PUBLIC_BASE_URL}/api/not-found")"
  uploads_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "${PUBLIC_BASE_URL}/uploads")"
  [[ "$admin_status" == 401 ]]
  [[ "$not_found_status" == 404 ]]
  [[ "$uploads_status" == 308 ]]
}

restore_nginx() {
  local backup_file=$1
  [[ -f "$backup_file" ]] || return 0
  install -o root -g root -m 0644 "$backup_file" "$NGINX_CONFIG"
  nginx -t
  systemctl reload nginx
}

install_container_nginx() {
  install -o root -g root -m 0644 "$HOST_NGINX_TEMPLATE" "$NGINX_CONFIG"
  nginx -t
  systemctl reload nginx
}

read_env_value() {
  local key=$1
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -1
}
