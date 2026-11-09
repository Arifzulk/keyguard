# KeyGuard — Agent Sandbox (Node)

Skrip demo untuk AI agent: memegang **scoped key** dari link share KeyGuard,
mencoba method yang **diizinkan** (harus berhasil) dan yang **terlarang**
(harus ditolak protokol). Hasil tercetak berdampingan — momen demo utama KeyGuard.

## Install & jalan

```bash
cd agent-sandbox
npm install
node demo.mjs --link "https://keyguard.pages.dev/#/key-session#<payload>"
```

Opsi:

| Flag | Arti |
|---|---|
| `--link` | Link share KeyGuard (payload di fragment) — secret, akun, kontrak, method diambil dari sini |
| `--account`, `--secret`, `--contract`, `--allowed` | Mode manual (tanpa link) |
| `--forbidden` | Method terlarang yang dicoba (default: `withdraw`) |
| `--allowed-args` | Args JSON untuk panggilan diizinkan (default: `{}`) |
| `--deposit-near` | Deposit NEAR untuk panggilan diizinkan (default: `0`) |

Secret sebaiknya tidak dilewatkan lewat `--secret` (terlihat di `ps` dan
shell history). Gunakan env var sebagai gantinya:

```bash
KEYGUARD_LINK="https://keyguard.pages.dev/#/key-session#<payload>" node demo.mjs
KEYGUARD_SECRET=ed25519:... node demo.mjs --account alice.testnet \
  --contract vault.alice.testnet --allowed increment --forbidden withdraw
```

## Contoh output

```
================================================================
🛡️  KeyGuard — Agent Sandbox
================================================================
Akun pemilik : alice.testnet
Public key   : ed25519:AbC...
Kontrak      : vault.alice.testnet
Method boleh : deposit, increment

1️⃣  METHOD DIIZINKAN: increment @ vault.alice.testnet
   ✅ BERHASIL (812 ms)
   tx: 7fK...
   explorer: https://testnet.nearblocks.io/txns/7fK...

2️⃣  METHOD TERLARANG: withdraw @ vault.alice.testnet
   ⛔ DITOLAK (640 ms)
   error protokol (apa adanya):
   | Transaction method name withdraw isn't allowed by the access key

================================================================
RINGKASAN
================================================================
✅ Method diizinkan BERHASIL — scoped key berfungsi untuk agent.
✅ Method terlarang DITOLAK protokol — batas key terbukti di level protokol.

🎬 Demo sandbox SUKSES.
```

Exit code: `0` bila demo sesuai ekspektasi (allowed OK + forbidden ditolak),
`2` bila tidak, `1` bila argumen/error fatal.

## Keamanan

- Script ini **HANYA untuk scoped (function-call) key**. Jangan jalankan dengan
  full-access key.
- Secret tidak disimpan ke disk — hanya di memori proses (InMemoryKeyStore).
- Untuk demo, pakai tombol **"Copy for agent"** di kartu share KeyGuard
  (config JSON siap-tempel) atau `--link` langsung dari QR/link share.
