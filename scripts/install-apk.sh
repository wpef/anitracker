#!/usr/bin/env bash
#
# install-apk.sh — Level 1 delivery: grab the freshest debug APK built by the
# "Build Android Debug (APK)" workflow (android-debug.yml) and sideload it onto
# a USB-connected phone with adb. No Play Store, no cloud, no waiting.
#
# WHAT IT DOES
#   1. Finds the latest run of android-debug.yml (optionally the latest
#      *successful* one) via the GitHub REST API.
#   2. Downloads its "anitracker-debug-*" artifact (a zip containing
#      app-debug.apk) — this requires a GitHub token because artifact downloads
#      are authenticated even on public repos.
#   3. Unzips it and runs `adb install -r` on the connected device.
#
# PREREQUISITES
#   - adb          Android Platform Tools, on your PATH.
#                    macOS:  brew install android-platform-tools
#                    Debian: sudo apt install adb
#                    Arch:   sudo pacman -S android-tools
#   - curl, jq, unzip  (jq: brew/apt/pacman install jq)
#   - A GitHub token with `actions:read` (and `contents:read`) on wpef/anitracker.
#       Classic PAT: scope `repo` is enough for a private repo, or `public_repo`.
#       Fine-grained PAT: Repository permissions → Actions: Read-only.
#       Export it before running:  export GITHUB_TOKEN=ghp_xxx
#       (GH_TOKEN is also accepted.)
#   - Your phone:
#       * Settings → About phone → tap "Build number" 7× to unlock Developer options.
#       * Settings → Developer options → enable "USB debugging".
#       * Plug in via USB, then accept the "Allow USB debugging?" prompt on the
#         phone (run `adb devices` — the device must show as "device", not
#         "unauthorized").
#       * Because it is not a Play install, the first launch may ask you to allow
#         installs from this source.
#
# USAGE
#   export GITHUB_TOKEN=ghp_xxx
#   ./scripts/install-apk.sh                 # latest successful run, install to phone
#   ./scripts/install-apk.sh --run-id 123456 # a specific workflow run
#   ./scripts/install-apk.sh --any-status    # latest run even if it failed/pending
#   ./scripts/install-apk.sh --download-only # fetch the APK, skip the adb install
#   ./scripts/install-apk.sh --serial ABC123 # target a specific adb device
#
# ENV OVERRIDES
#   REPO=wpef/anitracker   WORKFLOW=android-debug.yml   BRANCH=<git ref>
#
set -euo pipefail

# --- config / defaults ------------------------------------------------------
REPO="${REPO:-wpef/anitracker}"
WORKFLOW="${WORKFLOW:-android-debug.yml}"
BRANCH="${BRANCH:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
API="https://api.github.com"

RUN_ID=""
REQUIRE_SUCCESS=1
DOWNLOAD_ONLY=0
ADB_SERIAL=""

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/anitracker-apk.XXXXXX")"
trap 'rm -rf "$WORKDIR"' EXIT

err()  { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; }
info() { printf '\033[36m→ %s\033[0m\n' "$*" >&2; }
ok()   { printf '\033[32m✓ %s\033[0m\n' "$*" >&2; }

# --- args -------------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --run-id)        RUN_ID="${2:?--run-id needs a value}"; shift 2 ;;
    --any-status)    REQUIRE_SUCCESS=0; shift ;;
    --download-only) DOWNLOAD_ONLY=1; shift ;;
    --serial)        ADB_SERIAL="${2:?--serial needs a value}"; shift 2 ;;
    -h|--help)       sed -n '2,60p' "$0"; exit 0 ;;
    *)               err "Unknown argument: $1"; exit 2 ;;
  esac
done

# --- prerequisite checks ----------------------------------------------------
for bin in curl jq unzip; do
  command -v "$bin" >/dev/null 2>&1 || { err "Missing required tool: $bin"; exit 1; }
done
if [ "$DOWNLOAD_ONLY" -eq 0 ] && ! command -v adb >/dev/null 2>&1; then
  err "adb not found. Install Android Platform Tools, or use --download-only."
  exit 1
fi
if [ -z "$TOKEN" ]; then
  err "No GitHub token. Set GITHUB_TOKEN (or GH_TOKEN) — see the header of this script."
  exit 1
fi

gh_api() {
  # gh_api <path> — authenticated GET, fails loudly on HTTP errors.
  curl -fsSL \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@"
}

# --- resolve the run --------------------------------------------------------
if [ -z "$RUN_ID" ]; then
  info "Looking up the latest run of $WORKFLOW on $REPO…"
  query="per_page=1"
  [ "$REQUIRE_SUCCESS" -eq 1 ] && query="$query&status=success"
  [ -n "$BRANCH" ] && query="$query&branch=$BRANCH"
  runs_json="$(gh_api "$API/repos/$REPO/actions/workflows/$WORKFLOW/runs?$query")"
  RUN_ID="$(printf '%s' "$runs_json" | jq -r '.workflow_runs[0].id // empty')"
  if [ -z "$RUN_ID" ]; then
    err "No matching run found. Has the workflow run yet? Try --any-status."
    exit 1
  fi
  run_url="$(printf '%s' "$runs_json" | jq -r '.workflow_runs[0].html_url')"
  ok "Run #$RUN_ID  ($run_url)"
fi

# --- find + download the artifact ------------------------------------------
info "Fetching artifacts for run #$RUN_ID…"
arts_json="$(gh_api "$API/repos/$REPO/actions/runs/$RUN_ID/artifacts")"

# Prefer an artifact named like the workflow's (anitracker-debug-*); fall back
# to any non-expired artifact if the run only produced one.
art="$(printf '%s' "$arts_json" | jq -r '
  ([.artifacts[] | select(.expired == false)]) as $live
  | ( ($live | map(select(.name | startswith("anitracker-debug"))) | .[0])
      // ($live | .[0]) ) // empty')"

if [ -z "$art" ] || [ "$art" = "null" ]; then
  err "No downloadable APK artifact on run #$RUN_ID (expired after 14 days, or the build failed)."
  exit 1
fi

art_name="$(printf '%s' "$art" | jq -r '.name')"
art_url="$(printf '%s' "$art" | jq -r '.archive_download_url')"
info "Downloading artifact: $art_name"
gh_api -o "$WORKDIR/artifact.zip" "$art_url"

unzip -q -o "$WORKDIR/artifact.zip" -d "$WORKDIR/extracted"
apk="$(find "$WORKDIR/extracted" -name '*.apk' -type f | head -n1)"
if [ -z "$apk" ]; then
  err "Artifact contained no .apk file."
  exit 1
fi

# Keep a copy next to the repo so it survives the temp-dir cleanup.
dest="./anitracker-debug.apk"
cp "$apk" "$dest"
ok "APK ready: $dest ($(du -h "$dest" | cut -f1))"

if [ "$DOWNLOAD_ONLY" -eq 1 ]; then
  info "--download-only: skipping install."
  exit 0
fi

# --- install via adb --------------------------------------------------------
adb_cmd=(adb)
[ -n "$ADB_SERIAL" ] && adb_cmd+=(-s "$ADB_SERIAL")

info "Checking for a connected device…"
if ! "${adb_cmd[@]}" get-state >/dev/null 2>&1; then
  err "No authorized device. Run 'adb devices' — it must list your phone as 'device'."
  err "(Plug in USB, enable USB debugging, and accept the on-phone prompt.)"
  exit 1
fi

info "Installing (adb install -r)…"
"${adb_cmd[@]}" install -r "$dest"
ok "Installed AniTracker debug build. Launch it from the app drawer."
