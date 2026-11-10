/**
 * Unit tests for src/lib/scoped.ts — scoped key session (in-memory only).
 * No network: Account is created lazily, keystore is in-memory.
 */
import { describe, it, expect } from "vitest";
import { KeyPair } from "@near-js/crypto";
import { publicKeyOf, scopedSessionFromPayload, scopedSessionFromSecret } from "../scoped";
import type { SharePayload } from "../policy";

describe("publicKeyOf", () => {
  it("derives the correct public key from the secret", () => {
    const kp = KeyPair.fromRandom("ed25519");
    expect(publicKeyOf(kp.toString())).toBe(kp.getPublicKey().toString());
  });

  it("tolerates trailing spaces on the secret", () => {
    const kp = KeyPair.fromRandom("ed25519");
    expect(publicKeyOf(`  ${kp.toString()}  `)).toBe(kp.getPublicKey().toString());
  });

  it("throws for a broken secret (without echoing the secret)", () => {
    expect(() => publicKeyOf("ed25519:xyz")).toThrow();
    expect(() => publicKeyOf("bukan-key")).toThrow();
  });
});

describe("scopedSessionFromPayload", () => {
  it("builds a session with a public key matching the secret", async () => {
    const kp = KeyPair.fromRandom("ed25519");
    const payload: SharePayload = {
      secret: kp.toString(),
      accountId: "alice.testnet",
      receiverId: "vault.alice.testnet",
      methodNames: ["deposit", "increment"],
    };
    const session = await scopedSessionFromPayload(payload);
    expect(session.keyPair.getPublicKey().toString()).toBe(kp.getPublicKey().toString());
    expect(session.account.accountId).toBe("alice.testnet");
    expect(session.payload).toEqual(payload);
  });

  it("rejects a secret that cannot be imported", async () => {
    const payload: SharePayload = {
      secret: "ed25519:xyz",
      accountId: "alice.testnet",
      receiverId: "vault.alice.testnet",
      methodNames: ["increment"],
    };
    await expect(scopedSessionFromPayload(payload)).rejects.toThrow();
  });
});

describe("scopedSessionFromSecret", () => {
  it("builds a session from a manual secret", async () => {
    const kp = KeyPair.fromRandom("ed25519");
    const session = await scopedSessionFromSecret(kp.toString(), "bob.testnet");
    expect(session.keyPair.getPublicKey().toString()).toBe(kp.getPublicKey().toString());
    expect(session.account.accountId).toBe("bob.testnet");
  });

  it("rejects a non-ed25519 secret", async () => {
    await expect(scopedSessionFromSecret("secp256k1:abc", "bob.testnet")).rejects.toThrow(
      "ed25519:... format",
    );
    await expect(scopedSessionFromSecret("", "bob.testnet")).rejects.toThrow();
  });
});
