#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Usage: $0 <full-git-sha> <output-directory>" >&2
  exit 2
}

[[ $# -eq 2 ]] || usage
release_sha="$1"
output_dir="$2"
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || usage

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
backend_jar="${repo_root}/aisoftoj-backend/target/aisoftoj-backend-1.0.0.jar"
frontend_dir="${repo_root}/aisoftoj-front/build"
workflow_path="${GITHUB_WORKFLOW_REF:-Nanki-nn/aisoftoj/.github/workflows/production.yml@refs/heads/main}"
run_id="${GITHUB_RUN_ID:-local}"
build_time="${SOURCE_DATE_EPOCH:-$(date +%s)}"

[[ -f "$backend_jar" ]]
[[ -f "${frontend_dir}/index.html" ]]
compgen -G "${frontend_dir}/assets/*.js" > /dev/null

rm -rf "$output_dir"
mkdir -p "$output_dir/stage"

cp "$backend_jar" "$output_dir/stage/backend.jar"
COPYFILE_DISABLE=1 tar \
  --sort=name \
  --mtime="@${build_time}" \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  -C "$frontend_dir" \
  -czf "$output_dir/stage/frontend.tar.gz" .

cat > "$output_dir/stage/release.env" <<EOF
REPOSITORY=Nanki-nn/aisoftoj
WORKFLOW_PATH=.github/workflows/production.yml
WORKFLOW_REF=${workflow_path}
GIT_REF=refs/heads/main
GIT_SHA=${release_sha}
RUN_ID=${run_id}
BUILD_EPOCH=${build_time}
EOF

(
  cd "$output_dir/stage"
  sha256sum backend.jar frontend.tar.gz release.env > manifest.sha256
)

archive="release-${release_sha}.tar.gz"
COPYFILE_DISABLE=1 tar \
  --sort=name \
  --mtime="@${build_time}" \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  -C "$output_dir/stage" \
  -czf "$output_dir/$archive" \
  backend.jar frontend.tar.gz manifest.sha256 release.env

(
  cd "$output_dir"
  sha256sum "$archive" > "${archive}.sha256"
)

rm -rf "$output_dir/stage"
printf '%s\n' "$output_dir/$archive"
