#!/usr/bin/env bash
# Prepares @flwst/types for Firebase Functions deploy: copy built types into
# RESOURCE_DIR and rewrite package.json to "type": "commonjs" for Node runtime.
# Run from servers/firebase; RESOURCE_DIR must be set (e.g. by Firebase predeploy).

set -e

if [[ -z "${RESOURCE_DIR:-}" ]]; then
  echo "firebase_types.bash: RESOURCE_DIR is not set" >&2
  exit 1
fi

echo "go into resource directory: $RESOURCE_DIR"
rm -rf "$RESOURCE_DIR/types/" "$RESOURCE_DIR/lib/"
mkdir -p "$RESOURCE_DIR/types/"
cp -r ../../types/*.json "$RESOURCE_DIR/types/"
# Firebase Functions run on Node CommonJS; types package is built as ESM.
sed -E -i '' 's/"type": "module"/"type": "commonjs"/' "$RESOURCE_DIR/types/package.json"
cp -r ../../types/dist-firebase "$RESOURCE_DIR/types/dist"
