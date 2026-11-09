/**
 * KeyGuard network config.
 * The demo runs on NEAR testnet only.
 */
export const NETWORK_ID = "testnet";
export const RPC_URL = "https://rpc.testnet.near.org";

/**
 * Account ID of the demo contract (vault/counter) on testnet.
 * Empty until the contract is deployed (see contract/deploy.sh).
 * The UI shows a "demo contract not deployed" banner while empty;
 * users can still enter another contract's receiverId manually.
 */
export const DEMO_CONTRACT_ID = "keyguard-demo.testnet";

/** Link to a transaction on the testnet explorer. */
export const explorerTxUrl = (txHash: string): string =>
  `https://testnet.nearblocks.io/txns/${txHash}`;

/** Link to an account on the testnet explorer. */
export const explorerAccountUrl = (accountId: string): string =>
  `https://testnet.nearblocks.io/address/${accountId}`;
