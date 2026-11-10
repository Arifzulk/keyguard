#!/usr/bin/env node
/**
 * KeyGuard — Agent Sandbox demo (Node, near-api-js).
 *
 * A small script that holds a SCOPED KEY and tries:
 *   1. a method ALLOWED by the policy  → must SUCCEED (tx hash printed)
 *   2. a method FORBIDDEN by the policy → must be REJECTED by the protocol (raw error printed)
 *
 * Results print SIDE BY SIDE — KeyGuard's main demo moment.
 *
 * Key source: KeyGuard share link or explicit arguments.
 *   node demo.mjs --link "https://host/#/key-session#<payload>"
 *     [--forbidden withdraw] [--allowed-args '{"n":1}'] [--deposit-near 0]
 *   node demo.mjs --account alice.testnet --secret ed25519:... \
 *     --contract vault.alice.testnet --allowed increment [--forbidden withdraw]
 *
 * The secret should NOT be passed via CLI arguments (--secret shows up in
 * `ps` and shell history). Safe alternatives:
 *   KEYGUARD_SECRET=ed25519:... node demo.mjs --account ... --contract ... --allowed ...
 *   KEYGUARD_LINK="https://host/#/key-session#..." node demo.mjs
 * (env vars do not show up in the process list.)
 *
 * ⚠️ This script ONLY accepts a SCOPED KEY (function-call). Do not run it
 * with a full-access key — there is no check, but that is not a real demo.
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

/** Parse simple CLI arguments: --flag value / --flag (boolean). */
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

/** Extract the SharePayload from a KeyGuard share link (fragment #/key-session#<payload>). */
function payloadFromLink(link) {
  const marker = "#/key-session#";
  const idx = link.indexOf(marker);
  if (idx === -1) throw new Error("Not a KeyGuard share link (no #/key-session#).");
  const p = JSON.parse(b64urlDecode(link.slice(idx + marker.length)));
  if (typeof p.secret !== "string" || !p.secret.startsWith("ed25519:"))
    throw new Error("Invalid link payload (secret missing).");
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
    console.log(`   ✅ SUCCEEDED (${Date.now() - start} ms)`);
    console.log(`   tx: ${hash}`);
    console.log(`   explorer: ${explorerTxUrl(hash)}`);
    return { ok: true, hash };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`${emoji} ${label}: ${methodName} @ ${contractId}`);
    console.log(`   ⛔ REJECTED (${Date.now() - start} ms)`);
    console.log(`   protocol error (verbatim):`);
    for (const line of msg.split("\n")) console.log(`   | ${line}`);
    return { ok: false, error: msg };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // The secret may come from an env var (safer: not visible in `ps`
  // / shell history). CLI arguments are still supported for convenience,
  // but with an explicit warning.
  const link = args.link || process.env.KEYGUARD_LINK;
  const cliSecret = args.secret || process.env.KEYGUARD_SECRET;
  if (args.secret) {
    console.error(
      "⚠️  Warning: --secret is visible in the process list (`ps`) and shell history. " +
        "For serious use, use the KEYGUARD_SECRET env var.",
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
    console.error("No known allowed method (empty payload and --allowed not provided).");
    process.exit(1);
  }
  const forbiddenMethod = args["forbidden"] || "withdraw";
  let allowedArgs = {};
  if (args["allowed-args"]) {
    try {
      allowedArgs = JSON.parse(args["allowed-args"]);
    } catch {
      console.error("--allowed-args is not valid JSON.");
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
  console.log(`Owner        : ${accountId}`);
  console.log(`Public key   : ${keyPair.getPublicKey().toString()}`);
  console.log(`Contract     : ${contractId}`);
  console.log(`Methods      : ${allowedMethods.join(", ") || "(not listed in the link)"}`);
  console.log();

  const allowed = await tryCall(
    account,
    { contractId, methodName: allowedMethod, args: allowedArgs, depositYocto },
    "ALLOWED METHOD",
    "1️⃣ ",
  );
  console.log();
  const forbidden = await tryCall(
    account,
    { contractId, methodName: forbiddenMethod, args: {}, depositYocto: "0" },
    "FORBIDDEN METHOD",
    "2️⃣ ",
  );
  console.log();
  banner("SUMMARY");
  console.log(
    allowed.ok
      ? "✅ Allowed method SUCCEEDED — scoped key works for the agent."
      : "❌ Allowed method FAILED — check policy / allowance / contract.",
  );
  console.log(
    !forbidden.ok
      ? "✅ Forbidden method REJECTED by the protocol — key limits proven at the protocol level."
      : "❌ Forbidden method SUCCEEDED instead — this key is too loose, REVOKE IMMEDIATELY.",
  );
  const demoOk = allowed.ok && !forbidden.ok;
  console.log(
    demoOk ? "\n🎬 Sandbox demo SUCCEEDED." : "\n⚠️ Sandbox demo did NOT match expectations.",
  );
  process.exit(demoOk ? 0 : 2);
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
