# 🛡️ KeyGuard

**Give an AI agent money — without handing it the keys to the house.**

KeyGuard is a static web app (no backend, no server) that creates **scoped
NEAR FunctionCall access keys** and hands them to AI agents or trial users
via a **shareable link or QR code** — with a **sandbox that proves the
limits** (allowed call succeeds, forbidden call is rejected by the protocol)
and **one-click revoke**.

Built for **NEAR Hackathon 2026**, track **AI Security & Defense**.

## How a scoped key works

NEAR accounts can hold many keys, each with its own permission. A
**FunctionCall key** is defined by three attributes, all enforced by the
protocol itself — not by any app:

| Attribute     | Meaning                                               |
| ------------- | ----------------------------------------------------- |
| `receiverId`  | The **only contract** this key may call               |
| `methodNames` | The **only methods** it may call on that contract     |
| `allowance`   | The **gas + storage budget** (NEAR) the key may spend |

Consequences that matter for AI agents:

- A scoped key **cannot transfer NEAR**, cannot add/remove keys, and cannot
  redeploy a contract — even if the agent holding it is compromised.
- When the allowance is spent, **the key stops working on its own** — no
  revoke needed.
- In the NEAR protocol, an **empty method list means ALL methods are
  allowed**. KeyGuard refuses to create a key with an empty list.

## The flow

1. **Builder** — connect a wallet (testnet) → set the policy (target
   contract, allowed methods, allowance) → a fresh ed25519 keypair is
   generated **in the browser** → its public key is registered with an
   `addKey` transaction you sign.
2. **Share** — you get a link + QR code. The secret key lives only in the
   **URL fragment** (`#...`): never in the query string, never sent to a
   server (there is no server), never saved to localStorage.
3. **Key-Session** — open the link on another device: the key is imported
   into that page's memory only. Refresh the page and the key is gone.
4. **Sandbox** — call an **allowed** method and a **forbidden** method side
   by side with the scoped key. The demo moment: success on the left,
   protocol rejection on the right.
5. **Manage Keys** — see every access key on your account and **revoke**
   (`deleteKey`) any of them.

### Security rules enforced by the UI

- `methodNames` must not be empty (see above).
- The share card warns explicitly: **anyone holding the link can use the
  key within its policy** until you revoke it.
- The sandbox warns against pasting a full-access key.

## 2-minute demo

1. Open the Builder → connect a testnet wallet (MyNearWallet).
2. Policy: receiverId = `keyguard-demo.testnet`, methods = `deposit` +
   `increment`, allowance = `0.25` Ⓝ → **Create Key** → approve in wallet.
3. Copy the share link / scan the QR on another device → **Open
   Key-Session**.
4. In the **Sandbox**: call `increment` (✅ succeeds, with a tx hash), then
   call `withdraw` (⛔ rejected — the raw protocol error is shown verbatim).
5. In **Manage Keys**: revoke the demo key → done.

### Verified end-to-end (testnet, 9 Nov 2026)

- Demo contract deployed + initialized: `keyguard-demo.testnet`
  (deploy tx `8SWvQhscMgdsjkSfvF7td4rcpEpkMLhK2ypbMpCqdUSP`)
- Scoped key created (`deposit`, `increment`, 1 NEAR allowance):
  `FQJRxcnqepHzphrWK5KbGtrh7nPZUDyN5GpPnUkaNQSh`
- Sandbox: `increment` ✅ succeeded — counter became 1
  (tx `4hQTWaYfpyzR8T67cFdM58Zah7iHdJqGb4Re7MEDuEH2`); `withdraw` ⛔
  rejected — `"Transaction method name withdraw isn't allowed by the access key"`
- Revoke (`deleteKey`) verified — key gone from the access key list:
  `99p4ytzShFM2DW9hiiK8uef3UwZQhu8wZnkG8vFt56un`

Re-run after hardening (testnet, 9 Nov 2026, post-audit): new scoped key
(`deposit`, `increment`, 1 NEAR allowance):
`6rjW2Vn1VDcPYRVKRFPQatxDdYXY5zSjFUH7T2C4NpdW`; sandbox `increment` ✅
succeeded — counter 1 → 2
(tx `3PyQJ9dYdHiUSf2MWWY4Hu9LfTEZrFvmucK2KFmpbwU1`); `withdraw` ⛔
rejected with the same protocol error; revoke verified:
`CCVZez4RtrVDLiuDoeBsMWwaw6KSiLBn2auWWD4Ks6Li`. 47 unit tests pass
(`npm test`).

## Demo contract

A small vault/counter contract in `contract/` (near-sdk-js 2.0.0), deployed
at `keyguard-demo.testnet`:

| Method                                 | Allowed for the demo scoped key? |
| -------------------------------------- | -------------------------------- |
| `deposit()` (payable)                  | ✅ Yes                           |
| `increment()`                          | ✅ Yes                           |
| `withdraw({amount})`                   | ⛔ No — owner only               |
| `reset()`                              | ⛔ No — owner only               |
| `get_count()`, `get_total_deposited()` | views                            |

```bash
cd contract
./build.sh                                  # -> build/contract.wasm
ACCOUNT_ID=you.testnet ./deploy.sh          # needs near CLI + testnet faucet
```

Set `DEMO_CONTRACT_ID` in `src/config.ts` so the Builder offers a
"Use demo contract" button (already set to `keyguard-demo.testnet`).

## Agent sandbox (Node)

A CLI for an AI agent holding a scoped key — it tries the **allowed**
method (must succeed) and the **forbidden** method (must be rejected by the
protocol), printing the results side by side:

```bash
cd agent-sandbox
npm install
node demo.mjs --link "<keyguard-share-link>"
```

Manual mode:

```bash
node demo.mjs --account alice.testnet --secret ed25519:... \
  --contract vault.alice.testnet --allowed increment --forbidden withdraw
```

Exit `0` when the demo matches expectations (allowed OK + forbidden
rejected), `2` otherwise. Details: `agent-sandbox/README.md`.

## Running it

```bash
npm install
npm run dev      # dev server
npm run build    # -> dist/ (static hosting)
npm run preview
npm test         # Vitest: 47 unit tests (policy, scoped keys, provider, contract)
npm run format:check
```

Network: **NEAR testnet** only (see `src/config.ts`).

## Security model (audited, 9 Nov 2026)

The scoped secret key is a bearer credential — the design assumes anyone
holding the link can use the key within its policy. What KeyGuard does to
keep it from leaking anywhere else:

- **Fragment only**: the secret lives in the URL fragment (`#...`), never
  in the query string — fragments are never sent to a server (and there is
  no server), never appear in `Referer` headers, and never reach analytics.
- **Memory only**: the key is imported into an `InMemoryKeyStore`. No
  `localStorage`, no `sessionStorage`, no cookies. Refresh the page and the
  key is gone.
- **No exfiltration paths in the app**: no `fetch`/XHR/beacon/analytics
  calls anywhere in the web app; the only network traffic is the NEAR RPC
  and wallet-selector calls. `console` output never contains key material
  (verified: `KeyPair.fromString` errors do not echo their input).
- **Untrusted link data is validated, not trusted**: `decodeSharePayload`
  strictly validates the payload from a share link — ed25519 secret format,
  valid NEAR account IDs, a non-empty method list (empty = all methods at
  protocol level), and valid method names. A crafted link cannot smuggle
  arbitrary strings into the UI: all payload values are rendered via
  `textContent`, never interpolated into `innerHTML` (previously an XSS
  vector that could have read the secret from `location.hash`).
- **Clipboard only on explicit user action**: "Copy link" / "Copy for
  agent" copy the secret only when the user clicks them.
- **CLI**: `agent-sandbox/demo.mjs` accepts the secret via env var
  (`KEYGUARD_LINK` / `KEYGUARD_SECRET`) so it never appears in `ps` output
  or shell history; `--secret` prints a warning. The e2e helper script no
  longer prints secrets to stdout.

## Honest limitations

- **Testnet only.** Nothing here touches mainnet; the demo contract lives
  at `keyguard-demo.testnet`.
- **FunctionCall keys have no time expiry.** A key lives until its
  allowance is spent or the owner revokes it (`deleteKey`). There is no
  "valid for 1 hour" — plan allowance accordingly.
- **The share link is a bearer credential.** Anyone holding the link can
  use the key within its policy until it is revoked. Treat the link (and
  its QR code) like a password; revoke when the demo is done.
- **Allowance exhaustion kills the key silently.** When the budget is
  spent, calls fail with an allowance error — the UI cannot distinguish
  that from other failures without a chain lookup.
- **Contract unit tests mock the NEAR runtime** (`near.*` calls are stubbed
  in `contract/__tests__/contract.test.ts`): they prove the contract's
  logic (owner guard, deposit accounting, withdraw bounds), not on-chain
  behavior. On-chain behavior is proven by the live end-to-end run below
  (real transactions on testnet).

## Architecture

```
src/
  main.ts            Hash router (#/, #/key-session, #/sandbox, #/keys)
  pages/builder.ts   Wallet connect + policy form + addKey + share card
  pages/keySession.ts Import a scoped key from a link fragment (memory only)
  pages/sandbox.ts   Allowed-vs-forbidden calls, side by side
  pages/keys.ts      Access key list + revoke (deleteKey)
  lib/near.ts        Wallet Selector (testnet, MyNearWallet) + RPC provider
  lib/policy.ts      Policy validation, share-link encode/decode, agent config
  lib/scoped.ts      In-memory keystore sessions (never localStorage)
  components.ts      Shared UI: banners, tx cards, share card + QR
contract/            Demo vault/counter (near-sdk-js)
agent-sandbox/       Node CLI demo for agents (near-api-js)
```

## Tech

- Vite + TypeScript, plain CSS (no UI framework)
- `@near-js/*` 2.5.1 (accounts, keystores, transactions, crypto, utils,
  providers, signers)
- `@near-wallet-selector/*` 10.1.4 (core, my-near-wallet, modal-ui)
- `qrcode` — client-side QR rendering
- Demo contract: `near-sdk-js` 2.0.0
- Agent sandbox: `near-api-js` 5.1.1
- Tests: Vitest 5 + jsdom (`npm test`); formatting: Prettier
  (`npm run format:check`)

## License

MIT — see [LICENSE](LICENSE).
