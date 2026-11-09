// @vitest-environment jsdom
/**
 * Unit tests untuk src/lib/policy.ts — validasi policy + share payload.
 * Menjalankan di jsdom karena encode/decode memakai btoa/atob dan
 * buildShareLink / payloadFromLocation memakai window.location.
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
  it("menerima account ID valid (named + subaccount)", () => {
    expect(isValidAccountId("alice.testnet")).toBe(true);
    expect(isValidAccountId("keyguard-demo.testnet")).toBe(true);
    expect(isValidAccountId("a-b_c.testnet")).toBe(true);
    expect(isValidAccountId("zvlk.near")).toBe(true);
  });

  it("menerima implicit account (64 hex)", () => {
    expect(isValidAccountId("a".repeat(64))).toBe(true);
  });

  it("menolak format invalid", () => {
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

  it("mentolerir spasi di ujung (trim)", () => {
    expect(isValidAccountId("  alice.testnet  ")).toBe(true);
  });
});

describe("isValidMethodName", () => {
  it("menerima nama method valid", () => {
    expect(isValidMethodName("increment")).toBe(true);
    expect(isValidMethodName("get_count")).toBe(true);
    expect(isValidMethodName("method123")).toBe(true);
  });

  it("menolak nama method invalid", () => {
    expect(isValidMethodName("")).toBe(false);
    expect(isValidMethodName("with-dash")).toBe(false);
    expect(isValidMethodName("with space")).toBe(false);
    expect(isValidMethodName("with.dot")).toBe(false);
    expect(isValidMethodName("<script>")).toBe(false);
    expect(isValidMethodName("x".repeat(65))).toBe(false);
  });
});

describe("isPositiveNumber", () => {
  it("menerima angka positif", () => {
    expect(isPositiveNumber("0.25")).toBe(true);
    expect(isPositiveNumber("1")).toBe(true);
    expect(isPositiveNumber("1e-9")).toBe(true);
  });

  it("menolak nol / negatif / bukan angka", () => {
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

  it("round-trip dengan method & receiver unicode-ish tetap stabil", () => {
    const p = makePayload({ methodNames: ["stake_v2", "a".repeat(64)] });
    expect(decodeSharePayload(encodeSharePayload(p))).toEqual(p);
  });

  it("menolak base64 rusak", () => {
    expect(() => decodeSharePayload("!!!not-base64!!!")).toThrow();
    expect(() => decodeSharePayload("")).toThrow();
  });

  it("menolak JSON bukan objek / field hilang", () => {
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

  it("menolak secret bukan ed25519 / bukan base58", () => {
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

  it("menolak accountId / receiverId invalid", () => {
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ accountId: "Alice.testnet" }))),
    ).toThrow();
    expect(() => decodeSharePayload(encodeSharePayload(makePayload({ receiverId: "" })))).toThrow();
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ receiverId: "a" }))),
    ).toThrow();
  });

  it("MENOLAK methodNames kosong — list kosong = semua method di protokol", () => {
    expect(() =>
      decodeSharePayload(encodeSharePayload(makePayload({ methodNames: [] }))),
    ).toThrow();
  });

  it("MENOLAK method name hasil rekayasa (XSS / karakter ilegal)", () => {
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

  it("membuang duplikat method, mempertahankan urutan", () => {
    const p = makePayload({ methodNames: ["deposit", "increment", "deposit"] });
    const out = decodeSharePayload(encodeSharePayload(p));
    expect(out.methodNames).toEqual(["deposit", "increment"]);
  });
});

describe("buildShareLink / payloadFromLocation", () => {
  beforeEach(() => {
    // jsdom: reset ke path root di origin yang sama (replaceState lintas
    // origin — mis. ganti port — ditolak SecurityError).
    window.history.replaceState(null, "", "/");
  });

  it("link menaruh secret HANYA di fragment — tidak pernah di query string", () => {
    const p = makePayload();
    const link = buildShareLink(p);
    const url = new URL(link);
    expect(url.search).toBe("");
    expect(url.hash).toContain("#/key-session#");
    expect(url.hash).toContain(encodeSharePayload(p));
    // Secret tidak bocor ke bagian URL lain.
    expect(link.split("#")[0]).not.toContain("ed25519");
  });

  it("payloadFromLocation membaca kembali payload dari hash", () => {
    const p = makePayload();
    window.location.hash = `#/key-session#${encodeSharePayload(p)}`;
    expect(payloadFromLocation()).toEqual(p);
  });

  it("payloadFromLocation mengembalikan null bila tidak ada payload", () => {
    window.location.hash = "#/key-session";
    expect(payloadFromLocation()).toBeNull();
    window.location.hash = "#/";
    expect(payloadFromLocation()).toBeNull();
  });

  it("payloadFromLocation mengembalikan null untuk payload rusak (bukan throw)", () => {
    window.location.hash = "#/key-session#<img src=x onerror=alert(1)>";
    expect(payloadFromLocation()).toBeNull();
  });
});

describe("policySummary", () => {
  it("menyebut method, kontrak, dan allowance", () => {
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
  it("buildAgentConfig memuat field yang dibutuhkan near-api-js", () => {
    const p = makePayload();
    const cfg = buildAgentConfig(p);
    expect(cfg.networkId).toBe("testnet");
    expect(cfg.accountId).toBe(p.accountId);
    expect(cfg.contractId).toBe(p.receiverId);
    expect(cfg.keyPairSecret).toBe(p.secret);
    expect(cfg.allowedMethods).toEqual(p.methodNames);
    expect(JSON.parse(agentConfigJson(p))).toEqual(cfg);
  });

  it("agentUsageExample memakai pesan error protokol yang terobservasi", () => {
    const ex = agentUsageExample(makePayload());
    expect(ex).toContain("Transaction method name <method> isn't allowed by the access key");
    expect(ex).toContain("KeyPair.fromString");
    // Contoh memakai method pertama dari policy sebagai contoh allowed.
    expect(ex).toContain('"deposit"');
  });
});

describe("preset demo", () => {
  it("preset method demo konsisten", () => {
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
