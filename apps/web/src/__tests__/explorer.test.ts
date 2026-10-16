import { describe, it, expect } from "vitest";
import {
  getExplorerUrl,
  getTxUrl,
  getAddressUrl,
  getTokenUrl,
} from "@/lib/explorer";

describe("getExplorerUrl", () => {
  it("returns Etherscan mainnet for chain 1", () => {
    expect(getExplorerUrl(1)).toBe("https://etherscan.io");
  });

  it("returns Sepolia for chain 11155111", () => {
    expect(getExplorerUrl(11155111)).toBe("https://sepolia.etherscan.io");
  });

  it("returns null for Anvil (no explorer)", () => {
    expect(getExplorerUrl(31337)).toBe("");
  });

  it("returns null for unknown chain", () => {
    expect(getExplorerUrl(99999)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(getExplorerUrl(undefined)).toBeNull();
  });
});

describe("getTxUrl", () => {
  it("builds correct transaction URL", () => {
    const url = getTxUrl(11155111, "0xabc123");
    expect(url).toBe("https://sepolia.etherscan.io/tx/0xabc123");
  });

  it("returns null for unknown chain", () => {
    expect(getTxUrl(99999, "0xabc")).toBeNull();
  });

  it("returns null for Anvil (empty base)", () => {
    expect(getTxUrl(31337, "0xabc")).toBeNull();
  });
});

describe("getAddressUrl", () => {
  it("builds correct address URL", () => {
    const url = getAddressUrl(1, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(url).toBe(
      "https://etherscan.io/address/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    );
  });
});

describe("getTokenUrl", () => {
  it("builds correct token URL with bigint", () => {
    const url = getTokenUrl(11155111, "0xContract", 42n);
    expect(url).toBe("https://sepolia.etherscan.io/nft/0xContract/42");
  });

  it("builds correct token URL with number", () => {
    const url = getTokenUrl(11155111, "0xContract", 0);
    expect(url).toBe("https://sepolia.etherscan.io/nft/0xContract/0");
  });
});
