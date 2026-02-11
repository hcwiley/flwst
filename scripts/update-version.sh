#!/usr/bin/env bash
# Update VERSION file with current git info
# Can be called by post-commit hook, CI/CD builds, or manually

VERSION_FILE="VERSION"
GIT_SHA=$(git rev-parse --short=7 HEAD)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Read version from root package.json
VERSION=$(node -p "require('./package.json').version")

# Write VERSION file
cat > "$VERSION_FILE" << EOF
version=$VERSION
gitSha=$GIT_SHA
buildTime=$BUILD_TIME
EOF

echo "Updated VERSION file: v$VERSION ($GIT_SHA) at $BUILD_TIME"
