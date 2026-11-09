/**
 * Aturan policy + util share link KeyGuard.
 */

export interface Policy {
  receiverId: string;
  methodNames: string[];
  allowanceNear: string; // string desimal, mis. "0.25"
}

/** Preset method kontrak demo KeyGuard (vault/counter). */
export const DEMO_METHODS = ["deposit", "increment", "withdraw", "reset"];

/** Method demo yang dianggap aman untuk dicentang sebagai default policy. */
export const DEMO_ALLOWED_DEFAULTS = ["deposit", "increment"];

/** Preset allowance dalam NEAR. */
export const ALLOWANCE_PRESETS = ["0.1", "0.25", "1"];

const ACCOUNT_ID_RE = /^(([a-z\d]+[\-_])*[a-z\d]+\.)*([a-z\d]+[\-_])*[a-z\d]+$/;

/** Validasi format account ID NEAR (implisit + testnet: 2–64 char). */
export function isValidAccountId(accountId: string): boolean {
  const v = accountId.trim();
  if (v.length < 2 || v.length > 64) return false;
  return ACCOUNT_ID_RE.test(v);
}

export function isValidMethodName(name: string): boolean {
  return /^[a-zA-Z0-9_]{1,64}$/.test(name.trim());
}

export function isPositiveNumber(v: string): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

/**
 * Ringkasan policy dalam bahasa sederhana.
 */
export function policySummary(p: Policy): string {
  const methods = p.methodNames.join(", ");
  return (
    `This key MAY call ${methods} on contract ${p.receiverId}, ` +
    `with a gas + storage budget of ${p.allowanceNear} NEAR. ` +
    `It may NOT call any other method, ` +
    `cannot transfer NEAR, and cannot change the contract.`
  );
}

/** Payload share link: secret HANYA di URL fragment, tidak pernah di query string. */
export interface SharePayload {
  secret: string; // "ed25519:..." — keypair scoped
  accountId: string; // pemilik akun
  receiverId: string;
  methodNames: string[];
}

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode<T>(s: string): T {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  const json = decodeURIComponent(escape(atob(b64 + (pad ? "=".repeat(4 - pad) : ""))));
  return JSON.parse(json) as T;
}

export function encodeSharePayload(p: SharePayload): string {
  return base64UrlEncode(p);
}

/**
 * Validasi ketat untuk payload dari link share (data tidak tepercaya:
 * siapa pun bisa membuat link). Aturan:
 * - secret harus ed25519 + base58; panjang 43–45 karakter (32-byte seed)
 *   atau 86–88 karakter (64-byte secret key dari @near-js/crypto, bentuk
 *   yang dihasilkan KeyPair.fromRandom);
 * - accountId / receiverId harus format account ID NEAR yang valid;
 * - methodNames TIDAK BOLEH kosong (di protokol NEAR, list kosong = SEMUA
 *   method diizinkan) dan setiap entry harus nama method yang valid.
 * Ini adalah garis pertahanan pertama melawan link share hasil rekayasa —
 * payload lolos validasi di sini baru boleh dirender / dipakai.
 */
const ED25519_SECRET_RE =
  /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,45}$|^ed25519:[1-9A-HJ-NP-Za-km-z]{86,88}$/;

export function decodeSharePayload(s: string): SharePayload {
  const p = base64UrlDecode<SharePayload>(s);
  if (
    typeof p !== "object" ||
    p === null ||
    typeof p.secret !== "string" ||
    !ED25519_SECRET_RE.test(p.secret) ||
    typeof p.accountId !== "string" ||
    !isValidAccountId(p.accountId) ||
    typeof p.receiverId !== "string" ||
    !isValidAccountId(p.receiverId) ||
    !Array.isArray(p.methodNames) ||
    p.methodNames.length === 0 ||
    p.methodNames.some((m) => typeof m !== "string" || !isValidMethodName(m))
  ) {
    throw new Error("Invalid share payload format.");
  }
  // Normalisasi: buang duplikat, pertahankan urutan.
  return { ...p, methodNames: [...new Set(p.methodNames)] };
}

/** Bangun link share: origin + #/key-session#<payload>. */
export function buildShareLink(payload: SharePayload): string {
  return `${window.location.origin}${window.location.pathname}#/key-session#${encodeSharePayload(payload)}`;
}

/**
 * Config JSON siap-tempel untuk AI agent yang memakai `near-api-js`.
 * Berisi secret scoped key — hanya dibagikan ke agent yang dipercaya,
 * sama seperti link share.
 */
export interface AgentConfig {
  networkId: string;
  nodeUrl: string;
  accountId: string;
  keyPairSecret: string;
  contractId: string;
  allowedMethods: string[];
  note: string;
}

export function buildAgentConfig(payload: SharePayload): AgentConfig {
  return {
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    accountId: payload.accountId,
    keyPairSecret: payload.secret,
    contractId: payload.receiverId,
    allowedMethods: payload.methodNames,
    note: "Scoped key — it may only call allowedMethods on contractId, cannot transfer NEAR, and cannot change other keys. Refreshing the page / KeyGuard does not store this key.",
  };
}

export function agentConfigJson(payload: SharePayload): string {
  return JSON.stringify(buildAgentConfig(payload), null, 2);
}

/** Contoh kode agent (near-api-js) yang memegang scoped key. */
export function agentUsageExample(payload: SharePayload): string {
  return `// npm install near-api-js
import { connect, keyStores, KeyPair } from "near-api-js";

const keyStore = new keyStores.InMemoryKeyStore();
await keyStore.setKey(
  "testnet",
  ${JSON.stringify(payload.accountId)},
  KeyPair.fromString(${JSON.stringify(payload.secret)}),
);
const near = await connect({
  networkId: "testnet",
  nodeUrl: "https://rpc.testnet.near.org",
  deps: { keyStore },
});
const account = await near.account(${JSON.stringify(payload.accountId)});

// ✅ Method ALLOWED by the policy:
await account.functionCall({
  contractId: ${JSON.stringify(payload.receiverId)},
  methodName: ${JSON.stringify(payload.methodNames[0] ?? "<method>")},
  args: {},
  gas: "30000000000000",
});

// ⛔ Method OUTSIDE the policy → REJECTED by the protocol:
//    "Transaction method name <method> isn't allowed by the access key"
`;
}

/**
 * Ambil payload dari location.hash dengan format: #/key-session#<payload>
 * Mengembalikan null bila tidak ada payload.
 */
export function payloadFromLocation(): SharePayload | null {
  const hash = window.location.hash;
  const marker = "#/key-session#";
  const idx = hash.indexOf(marker);
  if (idx === -1) return null;
  const encoded = hash.slice(idx + marker.length);
  if (!encoded) return null;
  try {
    return decodeSharePayload(encoded);
  } catch {
    return null;
  }
}
