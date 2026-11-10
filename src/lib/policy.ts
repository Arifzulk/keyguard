/**
 * Policy rules + KeyGuard share link utils.
 */

export interface Policy {
  receiverId: string;
  methodNames: string[];
  allowanceNear: string; // decimal string, e.g. "0.25"
}

/** Preset methods of the KeyGuard demo contract (vault/counter). */
export const DEMO_METHODS = ["deposit", "increment", "withdraw", "reset"];

/** Demo methods considered safe to pre-check as the default policy. */
export const DEMO_ALLOWED_DEFAULTS = ["deposit", "increment"];

/** Preset allowance in NEAR. */
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
 * Plain-language policy summary.
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

/** Share link payload: secret ONLY in the URL fragment, never in the query string. */
export interface SharePayload {
  secret: string; // "ed25519:..." — scoped keypair
  accountId: string; // account owner
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
 * Strict validation for share-link payloads (untrusted data: anyone can
 * craft a link). Rules:
 * - secret must be ed25519 + base58; 43–45 chars (32-byte seed)
 *   or 86–88 chars (64-byte secret key from @near-js/crypto, the form
 *   produced by KeyPair.fromRandom);
 * - accountId / receiverId must be valid NEAR account ID format;
 * - methodNames must NOT be empty (in the NEAR protocol, an empty list =
 *   ALL methods allowed) and every entry must be a valid method name.
 * This is the first line of defense against crafted share links —
 * only payloads that pass validation here may be rendered / used.
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
  // Normalize: drop duplicates, keep order.
  return { ...p, methodNames: [...new Set(p.methodNames)] };
}

/** Build the share link: origin + #/key-session#<payload>. */
export function buildShareLink(payload: SharePayload): string {
  return `${window.location.origin}${window.location.pathname}#/key-session#${encodeSharePayload(payload)}`;
}

/**
 * Paste-ready agent config JSON for an AI agent using `near-api-js`.
 * Contains the scoped key secret — share it only with a trusted agent,
 * just like the share link.
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

/** Agent code sample (near-api-js) holding the scoped key. */
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
 * Read the payload from location.hash, format: #/key-session#<payload>
 * Returns null when there is no payload.
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
