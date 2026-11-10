# KeyGuard — NEAR Hackathon 2026

**Track:** AI Security & Defense · **Network:** NEAR testnet ·
**Demo contract:** `keyguard-demo.testnet`

## The problem

AI agents need to act on-chain on a user's behalf — but today they either
get nothing (the user signs every step by hand) or everything (a full-access
key or a shared seed phrase). The moment an agent is compromised, prompt-
injected, or just buggy, the whole account is gone. There is no middle
ground with a human-friendly UI.

## The solution

KeyGuard is a visual builder for NEAR **FunctionCall access keys** — a
protocol-native primitive with no equivalent on other chains. The user
picks a contract, ticks the methods the agent may call, and sets a gas
allowance. KeyGuard generates a fresh keypair in the browser, registers
its public key with a signed `addKey` transaction, and packages the
private key as a **shareable link / QR code** (secret only in the URL
fragment — it never touches a server, because there is no server).

The agent receives the link, and KeyGuard proves the limits instead of
just claiming them: the **sandbox** calls an allowed method (it succeeds)
and a forbidden method (the protocol rejects it) side by side. The owner
can **revoke** the key with one click, and the key also dies on its own
when its allowance runs out.

## The demo moment (2 minutes)

1. Builder: connect a testnet wallet → policy `keyguard-demo.testnet`,
   methods `deposit` + `increment`, allowance `0.25` Ⓝ → **Create Key**.
2. Share the link / QR with the agent → open **Key-Session** (plain
   "this key CAN / CANNOT" explanation).
3. Sandbox: `increment` ✅ succeeds (counter becomes 1, real tx hash);
   `withdraw` ⛔ is rejected by the protocol —
   _"Transaction method name withdraw isn't allowed by the access key"_.
4. Manage Keys: revoke the demo key.

Verified end-to-end on testnet, 9 Nov 2026 — deploy, `addKey`, sandbox
(allowed OK / forbidden rejected), and `deleteKey` revoke, all with real
transaction hashes (see README).

## Why it is original

Prior-art research (Oct 2026, refreshed Nov 2026) found no product that
combines a visual policy builder + shareable link/QR of a real scoped
private key + a live allowed-vs-rejected sandbox + revocation, aimed at
delegating to AI agents:

- **Keypom** (closest): an access-key factory for onboarding linkdrops —
  keys are scoped to the Keypom contract, not free-form keys on any
  contract; effectively dormant (SDK untouched ~3 years, team acquired
  Dec 2024).
- **Wallets** (Meteor, HOT, Sender): only _revoke_ keys granted to dapps;
  none _issues_ an arbitrary scoped key to a third party.
- **NEAR MCP / langchain-near-account / gas keys (NEP-611)**: agent-facing
  or protocol-level — no human UI for issuing a scoped key.
- **NEAR Agent Spend Guard** (closest project in this hackathon's SEC
  track): a single-purpose guard contract — the agent gets a function-call
  key for one method (`spend`) on that contract. KeyGuard is the generic
  tool: a builder for _any_ contract and _any_ methods, plus link/QR
  packaging, sandbox proof, and a revoke dashboard.
- **KeyProof** (SEC track, swept 10 Nov 2026): a read-only _auditor_ — it
  reads an agent's existing NEAR access keys over RPC and checks them
  against a plain-English policy. It never _issues_ a key. Complementary
  to KeyGuard: KeyGuard issues the scoped key, KeyProof audits keys that
  already exist.

## What is built

- Static web app (Vite + TypeScript, `@near-js/*` 2.5.1, Wallet Selector
  10.1.4): Builder, Key-Session, Sandbox, Manage Keys + revoke.
- Demo vault/counter contract (`near-sdk-js` 2.0.0), deployed on testnet.
- Agent sandbox CLI (`agent-sandbox/demo.mjs`, near-api-js) that holds a
  scoped key and proves allowed vs forbidden, exit `0` on success.
- No backend, no custody, no incentives or liquidity needed: the key is
  enforced by the NEAR protocol itself.
- 47 automated unit tests (Vitest): policy validation, share-payload
  encode/decode, scoped-key sessions, provider, and contract logic
  (`npm test`).

## Limits (honest)

- **Testnet only.** No mainnet usage.
- **FunctionCall keys have no time expiry** — a key lives until its
  allowance runs out or the owner revokes it.
- **The share link is a bearer credential**: anyone holding it can use the
  key within its policy until revoked. Treat the link and its QR like a
  password.
- Contract unit tests mock the NEAR runtime (they prove logic, not
  on-chain behavior); on-chain behavior is proven by the live end-to-end
  run in the README (real testnet transactions).
