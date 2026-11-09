# Kontrak Demo KeyGuard

Vault/counter sederhana untuk NEAR testnet — target sandbox demo KeyGuard.

| Method | Jenis | Keterangan |
|---|---|---|
| `init({owner})` | init | Sekali saja, set owner |
| `deposit()` | call, payable | Terima deposit NEAR — **boleh** untuk scoped key demo |
| `increment()` | call | Naikkan counter — **boleh** untuk scoped key demo |
| `get_count()` | view | Baca counter |
| `get_total_deposited()` | view | Baca total deposit (yocto) |
| `withdraw({amount})` | call | Tarik dana — **hanya owner**, scoped key demo DITOLAK |
| `reset()` | call | Reset state — **hanya owner**, scoped key demo DITOLAK |

## Build

```bash
cd contract
npm install   # lihat "Catatan toolchain" bila postinstall gagal
./build.sh    # -> build/contract.wasm
```

## Deploy ke testnet

Butuh: [near CLI](https://docs.near.org/tools/near-cli) + akun `.testnet`
berisi saldo dari faucet https://near-faucet.io.

```bash
cd contract
ACCOUNT_ID=akunanda.testnet ./deploy.sh
```

Setelah deploy, isi `DEMO_CONTRACT_ID` di `../src/config.ts` dengan account ID
kontrak agar UI Builder menampilkan tombol "Pakai kontrak demo".

## Catatan toolchain

`near-sdk-js@2.0.0` mengunduh binaryen + QuickJS + wasi-sdk dari GitHub saat
`npm install` (postinstall). Bila postinstall gagal (mis. `tar` gagal karena
aturan ownership di container), unduh & ekstrak manual ke
`node_modules/near-sdk-js/lib/cli/deps/`:

- `binaryen/` — dari https://github.com/ailisp/binaryen/releases (tag v0.1.16)
- `qjsc` (binary, chmod +x) — dari https://github.com/near/quickjs/releases (tag v0.1.3)
- `quickjs/` — source tag v0.1.3
- `wasi-sdk/` — dari https://github.com/WebAssembly/wasi-sdk/releases (wasi-sdk-11)

Gunakan `tar --no-same-owner -xf ...` bila ekstraksi gagal karena ownership.

Selain itu, `@types/node` di-pin ke `16.18.126`: tsc bawaan near-sdk-js
(TypeScript 4.7) tidak bisa mem-parse `@types/node` versi baru.
