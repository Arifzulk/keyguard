# KeyGuard — Agent Sandbox (Node)

Demo script for an AI agent: it holds a **scoped key** from a KeyGuard share link,
tries an **allowed** method (must succeed) and a **forbidden** one
(must be rejected by the protocol). The results print side by side — KeyGuard's
main demo moment.

## Install & run

```bash
cd agent-sandbox
npm install
node demo.mjs --link "https://keyguard.pages.dev/#/key-session#<payload>"
```

Options:

| Flag | Meaning |
|---|---|
| `--link` | KeyGuard share link (payload in the fragment) — secret, account, contract, and methods are taken from it |
| `--account`, `--secret`, `--contract`, `--allowed` | Manual mode (no link) |
| `--forbidden` | Forbidden method to try (default: `withdraw`) |
| `--allowed-args` | JSON args for the allowed call (default: `{}`) |
| `--deposit-near` | NEAR deposit for the allowed call (default: `0`) |

The secret should not be passed via `--secret` (visible in `ps` and
shell history). Use an env var instead:

```bash
KEYGUARD_LINK="https://keyguard.pages.dev/#/key-session#<payload>" node demo.mjs
KEYGUARD_SECRET=ed25519:... node demo.mjs --account alice.testnet \
  --contract vault.alice.testnet --allowed increment --forbidden withdraw
```

## Example output

```
================================================================
🛡️  KeyGuard — Agent Sandbox
================================================================
Owner        : alice.testnet
Public key   : ed25519:AbC...
Contract     : vault.alice.testnet
Methods      : deposit, increment

1️⃣  ALLOWED METHOD: increment @ vault.alice.testnet
   ✅ SUCCEEDED (812 ms)
   tx: 7fK...
   explorer: https://testnet.nearblocks.io/txns/7fK...

2️⃣  FORBIDDEN METHOD: withdraw @ vault.alice.testnet
   ⛔ REJECTED (640 ms)
   protocol error (verbatim):
   | Transaction method name withdraw isn't allowed by the access key

================================================================
SUMMARY
================================================================
✅ Allowed method SUCCEEDED — scoped key works for the agent.
✅ Forbidden method REJECTED by the protocol — key limits proven at the protocol level.

🎬 Sandbox demo SUCCEEDED.
```

Exit code: `0` when the demo matches expectations (allowed OK + forbidden rejected),
`2` when it does not, `1` for bad arguments / fatal errors.

## Security

- This script is **ONLY for scoped (function-call) keys**. Do not run it with a
  full-access key.
- The secret is never written to disk — only kept in process memory (InMemoryKeyStore).
- For the demo, use the **"Copy for agent"** button on the KeyGuard share card
  (paste-ready agent config JSON) or `--link` straight from the QR / share link.
