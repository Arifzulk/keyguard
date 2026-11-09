/**
 * Unit tests untuk src/lib/scoped.ts — sesi scoped key (in-memory only).
 * Tidak ada network: Account dibuat lazy, keystore in-memory.
 */
import { describe, it, expect } from "vitest";
import { KeyPair } from "@near-js/crypto";
import { publicKeyOf, scopedSessionFromPayload, scopedSessionFromSecret } from "../scoped";
import type { SharePayload } from "../policy";

describe("publicKeyOf", () => {
  it("menurunkan public key yang benar dari secret", () => {
    const kp = KeyPair.fromRandom("ed25519");
    expect(publicKeyOf(kp.toString())).toBe(kp.getPublicKey().toString());
  });

  it("mentolerir spasi di ujung secret", () => {
    const kp = KeyPair.fromRandom("ed25519");
    expect(publicKeyOf(`  ${kp.toString()}  `)).toBe(kp.getPublicKey().toString());
  });

  it("melempar untuk secret rusak (tanpa menggemakan secret)", () => {
    expect(() => publicKeyOf("ed25519:xyz")).toThrow();
    expect(() => publicKeyOf("bukan-key")).toThrow();
  });
});

describe("scopedSessionFromPayload", () => {
  it("membangun sesi dengan public key yang cocok dengan secret", async () => {
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

  it("menolak secret yang tidak bisa diimpor", async () => {
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
  it("membangun sesi dari secret manual", async () => {
    const kp = KeyPair.fromRandom("ed25519");
    const session = await scopedSessionFromSecret(kp.toString(), "bob.testnet");
    expect(session.keyPair.getPublicKey().toString()).toBe(kp.getPublicKey().toString());
    expect(session.account.accountId).toBe("bob.testnet");
  });

  it("menolak secret bukan ed25519", async () => {
    await expect(scopedSessionFromSecret("secp256k1:abc", "bob.testnet")).rejects.toThrow(
      "ed25519:... format",
    );
    await expect(scopedSessionFromSecret("", "bob.testnet")).rejects.toThrow();
  });
});
