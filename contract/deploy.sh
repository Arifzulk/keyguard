#!/usr/bin/env bash
# Deploy the KeyGuard demo contract to NEAR testnet.
#
# Usage:
#   ACCOUNT_ID=<account>.testnet ./deploy.sh
#
# Requirements:
# - near CLI installed (https://docs.near.org/tools/near-cli) and logged in to testnet:
#     near login   # or: npx near-cli login
# - The account holds testnet balance (faucet: https://near-faucet.io)
# - build/contract.wasm is already built (./build.sh)
#
# This script deploys to THE ACCOUNT ITSELF (not a sub-account), then inits it with
# owner = that account.
set -euo pipefail
cd "$(dirname "$0")"

: "${ACCOUNT_ID:?Set it first: ACCOUNT_ID=youraccount.testnet ./deploy.sh}"
WASM="build/contract.wasm"

if [ ! -f "$WASM" ]; then
  echo "File $WASM is missing. Run ./build.sh first." >&2
  exit 1
fi

echo "Deploy $WASM to $ACCOUNT_ID ..."
near deploy "$ACCOUNT_ID" "$WASM" --networkId testnet

echo "Init contract (owner = $ACCOUNT_ID) ..."
near call "$ACCOUNT_ID" init "{\"owner\":\"$ACCOUNT_ID\"}" \
  --accountId "$ACCOUNT_ID" --networkId testnet

echo "Verify: get_count ..."
near view "$ACCOUNT_ID" get_count --networkId testnet

echo
echo "Done. Set DEMO_CONTRACT_ID=\"$ACCOUNT_ID\" in ../src/config.ts"
echo "so the Builder UI offers the 'Use demo contract' button."
