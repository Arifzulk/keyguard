/**
 * Wallet connection via NEAR Wallet Selector (testnet, MyNearWallet)
 * + shared RPC provider.
 */
import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import "@near-wallet-selector/modal-ui/styles.css";
import { JsonRpcProvider } from "@near-js/providers";
import { NETWORK_ID, RPC_URL } from "../config";

let selector: WalletSelector | null = null;
let modal: WalletSelectorModal | null = null;

export async function getSelector(): Promise<WalletSelector> {
  if (selector) return selector;
  selector = await setupWalletSelector({
    network: NETWORK_ID as "testnet",
    modules: [setupMyNearWallet()],
  });
  return selector;
}

export async function getModal(): Promise<WalletSelectorModal> {
  const s = await getSelector();
  if (!modal) {
    modal = setupModal(s, {
      description: "Connect a testnet wallet to create a KeyGuard scoped key.",
    });
  }
  return modal;
}

/** The currently connected account ID, or null. */
export async function getConnectedAccountId(): Promise<string | null> {
  const s = await getSelector();
  const state = s.store.getState();
  const accounts = state.accounts;
  if (!accounts || accounts.length === 0) return null;
  return accounts[0].accountId;
}

/** Active wallet (full-access session) for signing transactions. */
export async function getActiveWallet() {
  const s = await getSelector();
  const wallet = await s.wallet();
  return wallet;
}

export async function signOut(): Promise<void> {
  const s = await getSelector();
  const wallet = await s.wallet();
  await wallet.signOut();
}

let provider: JsonRpcProvider | null = null;

export function getProvider(): JsonRpcProvider {
  if (!provider) {
    provider = new JsonRpcProvider({ url: RPC_URL });
  }
  return provider;
}
