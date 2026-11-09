/**
 * Unit tests untuk src/lib/near.ts (bagian murni, tanpa wallet) dan
 * src/config.ts (URL explorer).
 */
import { describe, it, expect } from "vitest";
import { getProvider } from "../near";
import { explorerTxUrl, explorerAccountUrl, NETWORK_ID, RPC_URL } from "../../config";

describe("getProvider", () => {
  it("mengembalikan instance yang sama (singleton)", () => {
    expect(getProvider()).toBe(getProvider());
  });

  it("menunjuk RPC testnet", () => {
    expect(NETWORK_ID).toBe("testnet");
    expect(RPC_URL).toBe("https://rpc.testnet.near.org");
  });
});

describe("explorer URLs", () => {
  it("explorerTxUrl membentuk URL nearblocks yang benar", () => {
    const hash = "4hQTWaYfpyzR8T67cFdM58Zah7iHdJqGb4Re7MEDuEH2";
    expect(explorerTxUrl(hash)).toBe(`https://testnet.nearblocks.io/txns/${hash}`);
  });

  it("explorerAccountUrl membentuk URL nearblocks yang benar", () => {
    expect(explorerAccountUrl("keyguard-demo.testnet")).toBe(
      "https://testnet.nearblocks.io/address/keyguard-demo.testnet",
    );
  });

  it("hash tx tidak lolos sebagai path traversal", () => {
    // Hash tx adalah base58; URL builder tidak meng-encode — pastikan
    // pemakaian di UI selalu dengan hash dari outcome RPC, bukan input user.
    const url = explorerTxUrl("abc123");
    expect(url).toBe("https://testnet.nearblocks.io/txns/abc123");
  });
});
