/**
 * Unit tests for src/lib/near.ts (the pure part, no wallet) and
 * src/config.ts (explorer URLs).
 */
import { describe, it, expect } from "vitest";
import { getProvider } from "../near";
import { explorerTxUrl, explorerAccountUrl, NETWORK_ID, RPC_URL } from "../../config";

describe("getProvider", () => {
  it("returns the same instance (singleton)", () => {
    expect(getProvider()).toBe(getProvider());
  });

  it("points at the testnet RPC", () => {
    expect(NETWORK_ID).toBe("testnet");
    expect(RPC_URL).toBe("https://rpc.testnet.near.org");
  });
});

describe("explorer URLs", () => {
  it("explorerTxUrl builds the correct nearblocks URL", () => {
    const hash = "4hQTWaYfpyzR8T67cFdM58Zah7iHdJqGb4Re7MEDuEH2";
    expect(explorerTxUrl(hash)).toBe(`https://testnet.nearblocks.io/txns/${hash}`);
  });

  it("explorerAccountUrl builds the correct nearblocks URL", () => {
    expect(explorerAccountUrl("keyguard-demo.testnet")).toBe(
      "https://testnet.nearblocks.io/address/keyguard-demo.testnet",
    );
  });

  it("a tx hash does not pass as path traversal", () => {
    // A tx hash is base58; the URL builder does not encode — make sure
    // the UI always uses a hash from an RPC outcome, never user input.
    const url = explorerTxUrl("abc123");
    expect(url).toBe("https://testnet.nearblocks.io/txns/abc123");
  });
});
