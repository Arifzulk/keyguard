#!/usr/bin/env bash
# Build the KeyGuard demo contract (near-sdk-js 2.0.0) -> build/contract.wasm
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x node_modules/near-sdk-js/lib/cli/deps/qjsc ]; then
  echo "near-sdk-js toolchain is incomplete (postinstall failed?)." >&2
  echo "See README.md, 'Toolchain notes', for manual installation." >&2
  exit 1
fi

npm run build
echo "OK -> build/contract.wasm"
