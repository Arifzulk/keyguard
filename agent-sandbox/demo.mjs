#!/usr/bin/env node
/**
 * KeyGuard — Agent Sandbox demo (Node, near-api-js).
 *
 * Skrip kecil yang memegang SCOPED KEY dan mencoba:
 *   1. method yang DIIZINKAN policy  → harus BERHASIL (tx hash tercetak)
 *   2. method yang TERLARANG policy  → harus DITOLAK protokol (error mentah tercetak)
 *
 * Hasil ditampilkan BERDAMPINGAN — momen demo utama KeyGuard.
 *
 * Sumber key: link share KeyGuard atau argumen eksplisit.
 *   node demo.mjs --link "https://host/#/key-session#<payload>"
 *     [--forbidden withdraw] [--allowed-args '{"n":1}'] [--deposit-near 0]
 *   node demo.mjs --account alice.testnet --secret ed25519:... \
 *     --contract vault.alice.testnet --allowed increment [--forbidden withdraw]
 *
 * Secret sebaiknya TIDAK dilewatkan lewat argumen CLI (--secret terlihat
 * di `ps` dan shell history). Alternatif yang aman:
 *   KEYGUARD_SECRET=ed25519:... node demo.mjs --account ... --contract ... --allowed ...
 *   KEYGUARD_LINK="https://host/#/key-session#..." node demo.mjs
 * (env var tidak muncul di daftar proses.)
 *
 * ⚠️ Script ini HANYA menerima SCOPED KEY (function-call). Jangan jalankan
 * dengan full-access key — tidak ada pengecekan, tapi itu bukan demo yang benar.
 */

import { connect, keyStores, KeyPair } from "near-api-js";

const NETWORK_ID = "testnet";
const NODE_URL = "https://rpc.testnet.near.org";
const GAS = "30000000000000"; // 30 Tgas

function usage(exit = 1) {
  console.error(`Usage:
  node demo.mjs --link "<share-link>" [--forbidden withdraw] [--allowed-args '{}'] [--deposit-near 0]
  node demo.mjs --account alice.testnet --secret ed25519:... --contract vault.alice.testnet --allowed increment [--forbidden withdraw]
  (prefer env vars over CLI args for secrets: KEYGUARD_LINK / KEYGUARD_SECRET)`);
  process.exit(exit);
}

/** Parse argumen CLI sederhana: --flag value / --flag (boolean). */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) usage();
    const key = a.slice(2);
    if (
      [
        "link",
        "account",
        "secret",
        "contract",
        "allowed",
        "forbidden",
        "allowed-args",
        "deposit-near",
      ].includes(key)
    ) {
      out[key] = argv[++i];
      if (out[key] === undefined) usage();
    } else usage();
  }
  return out;
}

function b64urlDecode(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

/** Ekstrak SharePayload dari link share KeyGuard (fragment #/key-session#<payload>). */
function payloadFromLink(link) {
  const marker = "#/key-session#";
  const idx = link.indexOf(marker);
  if (idx === -1) throw new Error("Link bukan link share KeyGuard (tidak ada #/key-session#).");
  const p = JSON.parse(b64urlDecode(link.slice(idx + marker.length)));
  if (typeof p.secret !== "string" || !p.secret.startsWith("ed25519:"))
    throw new Error("Payload link tidak valid (secret hilang).");
  return p;
}

function banner(text) {
  console.log("=".repeat(64));
  console.log(text);
  console.log("=".repeat(64));
}

function explorerTxUrl(hash) {
  return `https://testnet.nearblocks.io/txns/${hash}`;
}

async function tryCall(account, { contractId, methodName, args, depositYocto }, label, emoji) {
  const start = Date.now();
  try {
    const outcome = await account.functionCall({
      contractId,
      methodName,
      args,
      gas: GAS,
      attachedDeposit: depositYocto,
    });
    const hash = outcome?.transaction?.hash ?? "unknown";
    console.log(`${emoji} ${label}: ${methodName} @ ${contractId}`);
    console.log(`   ✅ BERHASIL (${Date.now() - start} ms)`);
    console.log(`   tx: ${hash}`);
    console.log(`   explorer: ${explorerTxUrl(hash)}`);
    return { ok: true, hash };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`${emoji} ${label}: ${methodName} @ ${contractId}`);
    console.log(`   ⛔ DITOLAK (${Date.now() - start} ms)`);
    console.log(`   error protokol (apa adanya):`);
    for (const line of msg.split("\n")) console.log(`   | ${line}`);
    return { ok: false, error: msg };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Secret boleh datang dari env var (lebih aman: tidak terlihat di `ps`
  // / shell history). Argumen CLI tetap didukung untuk kenyamanan, tapi
  // diberi peringatan eksplisit.
  const link = args.link || process.env.KEYGUARD_LINK;
  const cliSecret = args.secret || process.env.KEYGUARD_SECRET;
  if (args.secret) {
    console.error(
      "⚠️  Peringatan: --secret terlihat di daftar proses (`ps`) dan shell history. " +
        "Untuk pemakaian serius, gunakan env var KEYGUARD_SECRET.",
    );
  }

  let accountId, secret, contractId, allowedMethods;
  if (link) {
    const p = payloadFromLink(link);
    accountId = p.accountId;
    secret = p.secret;
    contractId = args.contract || p.receiverId;
    allowedMethods = p.methodNames || [];
  } else {
    if (!args.account || !cliSecret || !args.contract || !args.allowed) usage();
    accountId = args.account;
    secret = cliSecret;
    contractId = args.contract;
    allowedMethods = [args.allowed];
  }
  if (!secret.startsWith("ed25519:")) usage();

  const allowedMethod = args.allowed || allowedMethods[0];
  if (!allowedMethod) {
    console.error(
      "Tidak ada method diizinkan yang diketahui (payload kosong dan --allowed tidak diisi).",
    );
    process.exit(1);
  }
  const forbiddenMethod = args["forbidden"] || "withdraw";
  let allowedArgs = {};
  if (args["allowed-args"]) {
    try {
      allowedArgs = JSON.parse(args["allowed-args"]);
    } catch {
      console.error("--allowed-args bukan JSON valid.");
      process.exit(1);
    }
  }
  const depositYocto = String(Math.round(Number(args["deposit-near"] || "0") * 1e24));

  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = KeyPair.fromString(secret);
  await keyStore.setKey(NETWORK_ID, accountId, keyPair);
  const near = await connect({ networkId: NETWORK_ID, nodeUrl: NODE_URL, deps: { keyStore } });
  const account = await near.account(accountId);

  banner("🛡️  KeyGuard — Agent Sandbox");
  console.log(`Akun pemilik : ${accountId}`);
  console.log(`Public key   : ${keyPair.getPublicKey().toString()}`);
  console.log(`Kontrak      : ${contractId}`);
  console.log(`Method boleh : ${allowedMethods.join(", ") || "(tidak tercatat di link)"}`);
  console.log();

  const allowed = await tryCall(
    account,
    { contractId, methodName: allowedMethod, args: allowedArgs, depositYocto },
    "METHOD DIIZINKAN",
    "1️⃣ ",
  );
  console.log();
  const forbidden = await tryCall(
    account,
    { contractId, methodName: forbiddenMethod, args: {}, depositYocto: "0" },
    "METHOD TERLARANG",
    "2️⃣ ",
  );
  console.log();
  banner("RINGKASAN");
  console.log(
    allowed.ok
      ? "✅ Method diizinkan BERHASIL — scoped key berfungsi untuk agent."
      : "❌ Method diizinkan GAGAL — cek policy / allowance / kontrak.",
  );
  console.log(
    !forbidden.ok
      ? "✅ Method terlarang DITOLAK protokol — batas key terbukti di level protokol."
      : "❌ Method terlarang malah BERHASIL — key ini terlalu longgar, REVOKE SEGERA.",
  );
  const demoOk = allowed.ok && !forbidden.ok;
  console.log(demoOk ? "\n🎬 Demo sandbox SUKSES." : "\n⚠️ Demo sandbox TIDAK sesuai ekspektasi.");
  process.exit(demoOk ? 0 : 2);
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
