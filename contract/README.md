# KeyGuard Demo Contract

A simple vault/counter for NEAR testnet — the target of the KeyGuard sandbox demo.

| Method | Type | Notes |
|---|---|---|
| `init({owner})` | init | Once only, sets the owner |
| `deposit()` | call, payable | Accept a NEAR deposit — **allowed** for the demo scoped key |
| `increment()` | call | Increase the counter — **allowed** for the demo scoped key |
| `get_count()` | view | Read the counter |
| `get_total_deposited()` | view | Read the total deposit (yocto) |
| `withdraw({amount})` | call | Withdraw funds — **owner only**, demo scoped key REJECTED |
| `reset()` | call | Reset state — **owner only**, demo scoped key REJECTED |

## Build

```bash
cd contract
npm install   # see "Toolchain notes" if postinstall fails
./build.sh    # -> build/contract.wasm
```

## Deploy to testnet

Needs: [near CLI](https://docs.near.org/tools/near-cli) + a `.testnet` account
funded from the faucet https://near-faucet.io.

```bash
cd contract
ACCOUNT_ID=youraccount.testnet ./deploy.sh
```

After deploying, set `DEMO_CONTRACT_ID` in `../src/config.ts` to the contract's
account ID so the Builder UI shows the "Use demo contract" button.

## Toolchain notes

`near-sdk-js@2.0.0` downloads binaryen + QuickJS + wasi-sdk from GitHub during
`npm install` (postinstall). If postinstall fails (e.g. `tar` fails because of
ownership rules in a container), download & extract them manually into
`node_modules/near-sdk-js/lib/cli/deps/`:

- `binaryen/` — from https://github.com/ailisp/binaryen/releases (tag v0.1.16)
- `qjsc` (binary, chmod +x) — from https://github.com/near/quickjs/releases (tag v0.1.3)
- `quickjs/` — source tag v0.1.3
- `wasi-sdk/` — from https://github.com/WebAssembly/wasi-sdk/releases (wasi-sdk-11)

Use `tar --no-same-owner -xf ...` if extraction fails because of ownership.

Also, `@types/node` is pinned to `16.18.126`: the tsc bundled with near-sdk-js
(TypeScript 4.7) cannot parse newer `@types/node` versions.
