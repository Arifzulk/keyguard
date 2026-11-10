// @vitest-environment jsdom
/**
 * Unit tests for src/lib/policy.ts — policy validation + share payload.
 * Runs in jsdom because encode/decode use btoa/atob and
 * buildShareLink / payloadFromLocation use window.location.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { KeyPair } from "@near-js/crypto";
import {
  isValidAccountId,
  isValidMethodName,
  isPositiveNumber,
  policySummary,
  encodeSharePayload,
  decodeSharePayload,
  buildShareLink,
  payloadFromLocation,
  buildAgentConfig,
  agentConfigJson,
  agentUsageExample,
  DEMO_METHODS,
  DEMO_ALLOWED_DEFAULTS,
  ALLOWANCE_PRESETS,
  type SharePayload,
} from "../policy";

function makePayload(overrides: Partial<SharePayload> = {}): SharePayload {
  const kp = KeyPair.fromRandom("ed25519");
  return {
    secret: kp.toString(),
    accountId: "alice.testnet",
    receiverId: "vault.alice.testnet",
    methodNames: ["deposit", "increment"],
    ...overrides,
  };
}

describe("isValidAccountId", () => {
  it("accepts a valid account ID (named + subaccount)", () => {
    expect(isValidAccountId("alice.testnet")).toBe(true);
    expect(isValidAccountId("keyguard-demo.testnet")).toBe(true);
    expect(isValidAccountId("a-b_c.testnet")).toBe(true);
    expect(isValidAccountId("zvlk.near")).toBe(true);
  });

  it("accepts an implicit account (64 hex)", () => {
    expect(isValidAccountId("a".repeat(64))).toBe(true);
  });

  it("rejects an invalid format", () => {
    expect(isValidAccountId("")).toBe(false);
    expect(isValidAccountId("a")).toBe(false); // min 2 char
    expect(isValidAccountId("A".repeat(65))).toBe(false); // max 64 + uppercase
    expect(isValidAccountId("Alice.testnet")).toBe(false); // uppercase
    expect(isValidAccountId("alice..testnet")).toBe(false);
    expect(isValidAccountId(".alice.testnet")).toBe(false);
    expect(isValidAccountId("alice.testnet.")).toBe(false);
    expect(isValidAccountId("alice testnet")).toBe(false);
    expect(isValidAccountId("alice@testnet")).toBe(false);
  });

  it("tolerates trailing spaces (trim)", () => {
    expect(isValidAccountId("  alice.testnet  ")).toBe(true);
  });
});

describe("isValidMethodName", () => {
  it("accepts a valid method name", () => {
    expect(isValidMethodName("increment")).toBe(true);
    expect(isValidMethodName("get_count")).toBe(true);
    expect(isValidMethodName("method123")).toBe(true);
  });

  it("rejects an invalid method name", () => {
    expect(isValidMethodName("")).toBe(false);
    expect(isValidMethodName("with-dash")).toBe(false);
    expect(isValidMethodName("with space")).toBe(false);
    expect(isValidMethodName("with.dot")).toBe(false);
    expect(isValidMethodName("<script>")).toBe(false);
    expect(isValidMethodName("x".repeat(65))).toBe(false);
  });
});

describe("isPositiveNumber", () => {
  it("accepts a positive number", () => {
    expect(isPositiveNumber("0.25")).toBe(true);
    expect(isPositiveNumber("1")).toBe(true);
    expect(isPositiveNumber("1e-9")).toBe(true);
  });

  it("rejects zero / negative / non-number", () => {
    expect(isPositiveNumber("0")).toBe(false);
    expect(isPositiveNumber("-1")).toBe(false);
    expect(isPositiveNumber("")).toBe(false);
    expect(isPositiveNumber("abc")).toBe(false);
    expect(isPositiveNumber("NaN")).toBe(false);
    expect(isPositiveNumber("Infinity")).toBe(false);
  });
});

describe("encode/decode share payload", () => {
  it("round-trip: decode(encode(p)) == p", () => {
    const p = makePayload();
    expect(decodeSharePayload(encodeSharePayload(p))).toEqual(p);
  });

  it("round-trip with unicode-ish method & receiver stays stable", () => {
    const p = makePayload({ methodNames: ["stake_v2", "a".repeat(64)] });
    expect(decodeSharePayload(encodeSharePayload(p))).toEqual(p);
  });

  it("rejects broken base64", () => {
    expect(() => decodeSharePayload("!!!not-base64!!!")).toThrow();
    expect(() => decodeSharePayload("")).toThrow();
  });

  it("rejects non-object JSON / missing fields", () => {
    const b64 = (o: unknown) =>
      btoa(unescape(encodeURIComponent(JSON.stringify(o))))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    expect(() => decodeSharePayload(b64(null))).toThrow();
    expect(() => decodeSharePayload(b64({}))).toThrow();
    expect(() => decodeSharePayload(b64({ secret: "ed25519:x" }))).toThrow();
    expect(() => decodeSharePayload(b64("just a string"))).toThrow();
  });

  it("rejects a non-ed25519 / non-base58 secret", () => {
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ secret: "secp256k1:abc" }))),
    ).toThrow();
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ secret: "ed25519:!!!not-base58!!!" }))),
    ).toThrow();
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ secret: "ed25519:short" }))),
    ).toThrow();
  });

  it("rejects an invalid accountId / receiverId", () => {
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ accountId: "Alice.testnet" }))),
    ).toThrow();
    expect(() => decodeSharePayload(encodeSharePayload(makePayload({ receiverId: "" })))).toThrow();
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ receiverId: "a" }))),
    ).toThrow();
  });

  it("REJECTS empty methodNames — an empty list means all methods in the protocol", () => {
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ methodNames: [] }))),
    ).toThrow();
  });

  it("REJECTS a crafted method name (XSS / illegal characters)", () => {
    const evil = "<img src=x onerror=alert(1)>";
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ methodNames: [evil] }))),
    ).toThrow();
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ methodNames: ["ok", "bad-name"] }))),
    ).toThrow();
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ methodNames: ["ok", 123 as never] }))),
    ).toThrow();
  });

  it("drops duplicate methods, keeps the order", () => {
    const p = makePayload({ methodNames: ["deposit", "increment", "deposit"] });
    const out = decodeSharePayload(encodeSharePayload(p));
    expect(out.methodNames).toEqual(["deposit", "increment"]);
  });
});

describe("buildShareLink / payloadFromLocation", () => {
  beforeEach(() => {
    // jsdom: reset to the root path on the same origin (cross-origin
    // replaceState — e.g. changing port — is rejected with SecurityError).
    window.history.replaceState(null, "", "/");
  });

  it("the link puts the secret ONLY in the fragment — never in the query string", () => {
    const p = makePayload();
    const link = buildShareLink(p);
    const url = new URL(link);
    expect(url.search).toBe("");
    expect(url.hash).toContain("#/key-session#");
    expect(url.hash).toContain(encodeSharePayload(p));
    // The secret does not leak into other parts of the URL.
    expect(link.split("#")[0]).not.toContain("ed25519");
  });

  it("payloadFromLocation reads the payload back from the hash", () => {
    const p = makePayload();
    window.location.hash = `#/key-session#${encodeSharePayload(p)}`;
    expect(payloadFromLocation()).toEqual(p);
  });

  it("payloadFromLocation returns null when there is no payload", () => {
    window.location.hash = "#/key-session";
    expect(payloadFromLocation()).toBeNull();
    window.location.hash = "#/";
    expect(payloadFromLocation()).toBeNull();
  });

  it("payloadFromLocation returns null for a broken payload (not a throw)", () => {
    window.location.hash = "#/key-session#<img src=x onerror=alert(1)>";
    expect(payloadFromLocation()).toBeNull();
  });
});

describe("policySummary", () => {
  it("mentions the method, contract, and allowance", () => {
    const s = policySummary({
      receiverId: "vault.alice.testnet",
      methodNames: ["deposit", "increment"],
      allowanceNear: "0.25",
    });
    expect(s).toContain("deposit, increment");
    expect(s).toContain("vault.alice.testnet");
    expect(s).toContain("0.25");
    expect(s).toContain("may NOT call any other method");
  });
});

describe("agent config / usage example", () => {
  it("buildAgentConfig carries the fields near-api-js needs", () => {
    const p = makePayload();
    const cfg = buildAgentConfig(p);
    expect(cfg.networkId).toBe("testnet");
    expect(cfg.accountId).toBe(p.accountId);
    expect(cfg.contractId).toBe(p.receiverId);
    expect(cfg.keyPairSecret).toBe(p.secret);
    expect(cfg.allowedMethods).toEqual(p.methodNames);
    expect(JSON.parse(agentConfigJson(p))).toEqual(cfg);
  });

  it("agentUsageExample uses the observed protocol error message", () => {
    const ex = agentUsageExample(makePayload());
    expect(ex).toContain("Transaction method name <method> isn't allowed by the access key");
    expect(ex).toContain("KeyPair.fromString");
    // Example uses the policy's first method as the allowed example.
    expect(ex).toContain('"deposit"');
  });
});

describe("preset demo", () => {
  it("demo method presets are consistent", () => {
    expect(DEMO_METHODS).toContain("deposit");
    expect(DEMO_METHODS).toContain("withdraw");
    for (const m of DEMO_ALLOWED_DEFAULTS) {
      expect(DEMO_METHODS).toContain(m);
      expect(isValidMethodName(m)).toBe(true);
    }
    for (const a of ALLOWANCE_PRESETS) {
      expect(isPositiveNumber(a)).toBe(true);
    }
  });
});
