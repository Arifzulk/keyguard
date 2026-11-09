#!/usr/bin/env bash
# Deploy kontrak demo KeyGuard ke NEAR testnet.
#
# Cara pakai:
#   ACCOUNT_ID=<akun>.testnet ./deploy.sh
#
# Syarat:
# - near CLI terinstall (https://docs.near.org/tools/near-cli) dan login testnet:
#     near login   # atau: npx near-cli login
# - Akun punya saldo testnet (faucet: https://near-faucet.io)
# - build/contract.wasm sudah dibangun (./build.sh)
#
# Skrip ini me-deploy ke AKUN ITU SENDIRI (bukan sub-akun), lalu init dengan
# owner = akun tersebut.
set -euo pipefail
cd "$(dirname "$0")"

: "${ACCOUNT_ID:?Isi dulu: ACCOUNT_ID=akunanda.testnet ./deploy.sh}"
WASM="build/contract.wasm"

if [ ! -f "$WASM" ]; then
  echo "File $WASM tidak ada. Jalankan ./build.sh dulu." >&2
  exit 1
fi

echo "Deploy $WASM ke $ACCOUNT_ID ..."
near deploy "$ACCOUNT_ID" "$WASM" --networkId testnet

echo "Init kontrak (owner = $ACCOUNT_ID) ..."
near call "$ACCOUNT_ID" init "{\"owner\":\"$ACCOUNT_ID\"}" \
  --accountId "$ACCOUNT_ID" --networkId testnet

echo "Verifikasi: get_count ..."
near view "$ACCOUNT_ID" get_count --networkId testnet

echo
echo "Selesai. Isi DEMO_CONTRACT_ID=\"$ACCOUNT_ID\" di ../src/config.ts"
echo "agar UI Builder menawarkan tombol 'Pakai kontrak demo'."
