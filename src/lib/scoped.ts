/**
 * Scoped keypair: stored ONLY in memory (InMemoryKeyStore).
 * NEVER written to localStorage / query string / server.
 */
import { KeyPair } from "@near-js/crypto";
import { InMemoryKeyStore } from "@near-js/keystores";
import { Account } from "@near-js/accounts";
import { KeyPairSigner } from "@near-js/signers";
import { NETWORK_ID } from "../config";
import { getProvider } from "./near";
import type { SharePayload } from "./policy";

/** @near-js/crypto does not export this type from its index — local definition. */
type KeyPairString = `ed25519:${string}` | `secp256k1:${string}`;

export interface ScopedSession {
  account: Account;
  keyPair: KeyPair;
  payload: SharePayload;
}

/**
 * Build a scoped session from a share link payload.
 * The key is imported into the InMemoryKeyStore only; a page refresh = key gone.
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
 * Build a scoped session from manual input (secret key pasted by the user).
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

/** Public key (ed25519:...) for a secret. */
export function publicKeyOf(secret: string): string {
  return KeyPair.fromString(secret.trim() as KeyPairString)
    .getPublicKey()
    .toString();
}
