/**
 * Scoped keypair: HANYA disimpan di memory (InMemoryKeyStore).
 * TIDAK PERNAH ditulis ke localStorage / query string / server.
 */
import { KeyPair } from "@near-js/crypto";
import { InMemoryKeyStore } from "@near-js/keystores";
import { Account } from "@near-js/accounts";
import { KeyPairSigner } from "@near-js/signers";
import { NETWORK_ID } from "../config";
import { getProvider } from "./near";
import type { SharePayload } from "./policy";

/** @near-js/crypto tidak mengekspor tipe ini dari index — definisi lokal. */
type KeyPairString = `ed25519:${string}` | `secp256k1:${string}`;

export interface ScopedSession {
  account: Account;
  keyPair: KeyPair;
  payload: SharePayload;
}

/**
 * Bangun sesi scoped dari payload share link.
 * Key diimpor ke InMemoryKeyStore saja; refresh halaman = key hilang.
 */
export async function scopedSessionFromPayload(payload: SharePayload): Promise<ScopedSession> {
  const keyPair = KeyPair.fromString(payload.secret as KeyPairString);
  const keyStore = new InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, payload.accountId, keyPair);
  const signer = new KeyPairSigner(keyPair);
  const account = new Account(payload.accountId, getProvider(), signer);
  return { account, keyPair, payload };
}

/**
 * Bangun sesi scoped dari input manual (secret key ditempel user).
 */
export async function scopedSessionFromSecret(
  secret: string,
  accountId: string,
): Promise<ScopedSession> {
  const trimmed = secret.trim();
  if (!trimmed.startsWith("ed25519:")) {
    throw new Error("The secret key must be in ed25519:... format.");
  }
  const keyPair = KeyPair.fromString(trimmed as KeyPairString);
  const keyStore = new InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, accountId, keyPair);
  const signer = new KeyPairSigner(keyPair);
  const account = new Account(accountId, getProvider(), signer);
  const payload: SharePayload = {
    secret: trimmed,
    accountId,
    receiverId: "",
    methodNames: [],
  };
  return { account, keyPair, payload };
}

/** Public key (ed25519:...) dari secret. */
export function publicKeyOf(secret: string): string {
  return KeyPair.fromString(secret.trim() as KeyPairString)
    .getPublicKey()
    .toString();
}
