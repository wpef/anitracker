#!/usr/bin/env bash
# Bumps the version across all config files.
# Usage: scripts/bump-version.sh <patch|minor|major>
#   or:  scripts/bump-version.sh 1.2.3  (explicit version)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Read current version from package.json
CURRENT=$(node -p "require('./package.json').version")

if [ $# -lt 1 ]; then
  echo "Current version: $CURRENT"
  echo "Usage: $0 <patch|minor|major|x.y.z>"
  exit 1
fi

ARG="$1"

# Compute new version
case "$ARG" in
  patch|minor|major)
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    case "$ARG" in
      patch) PATCH=$((PATCH + 1)) ;;
      minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
      major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    esac
    NEW="$MAJOR.$MINOR.$PATCH"
    ;;
  *)
    # Explicit version string
    NEW="$ARG"
    ;;
esac

echo "Bumping version: $CURRENT → $NEW"

# 1. package.json (source of truth)
cd "$ROOT"
node -e "
  const pkg = require('./package.json');
  pkg.version = '$NEW';
  require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# 2. manifest.json — add version field
MANIFEST="$ROOT/manifest.json"
if [ -f "$MANIFEST" ]; then
  node -e "
    const m = JSON.parse(require('fs').readFileSync('$MANIFEST', 'utf8'));
    m.version = '$NEW';
    require('fs').writeFileSync('$MANIFEST', JSON.stringify(m, null, 2) + '\n');
  "
  echo "  ✔ manifest.json"
fi

# 3. capacitor.config.json
CAP_CFG="$ROOT/capacitor.config.json"
if [ -f "$CAP_CFG" ]; then
  node -e "
    const c = JSON.parse(require('fs').readFileSync('$CAP_CFG', 'utf8'));
    c.appVersion = '$NEW';
    require('fs').writeFileSync('$CAP_CFG', JSON.stringify(c, null, 2) + '\n');
  "
  echo "  ✔ capacitor.config.json"
fi

# 4. Android build.gradle (if exists)
GRADLE="$ROOT/android/app/build.gradle"
if [ -f "$GRADLE" ]; then
  # Compute versionCode from semver: MAJOR*10000 + MINOR*100 + PATCH
  IFS='.' read -r M MI P <<< "$NEW"
  VCODE=$((M * 10000 + MI * 100 + P))
  sed -i "s/versionName \".*\"/versionName \"$NEW\"/" "$GRADLE"
  sed -i "s/versionCode [0-9]*/versionCode $VCODE/" "$GRADLE"
  echo "  ✔ android/app/build.gradle (versionCode=$VCODE)"
fi

# 5. iOS Info.plist (if exists)
PLIST="$ROOT/ios/App/App/Info.plist"
if [ -f "$PLIST" ]; then
  # Use sed to replace CFBundleShortVersionString and CFBundleVersion
  sed -i "/<key>CFBundleShortVersionString<\/key>/{n;s|<string>.*</string>|<string>$NEW</string>|}" "$PLIST"
  IFS='.' read -r M MI P <<< "$NEW"
  VCODE=$((M * 10000 + MI * 100 + P))
  sed -i "/<key>CFBundleVersion<\/key>/{n;s|<string>.*</string>|<string>$VCODE</string>|}" "$PLIST"
  echo "  ✔ ios/App/App/Info.plist"
fi

echo ""
echo "✔ Version bumped to $NEW"
echo "  Run 'npm run cap:sync' to sync native projects."
