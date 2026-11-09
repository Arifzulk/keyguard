#!/usr/bin/env bash
# Build kontrak demo KeyGuard (near-sdk-js 2.0.0) -> build/contract.wasm
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x node_modules/near-sdk-js/lib/cli/deps/qjsc ]; then
  echo "Toolchain near-sdk-js belum lengkap (postinstall gagal?)." >&2
  echo "Lihat README.md bagian 'Catatan toolchain' untuk instalasi manual." >&2
  exit 1
fi

npm run build
echo "OK -> build/contract.wasm"
