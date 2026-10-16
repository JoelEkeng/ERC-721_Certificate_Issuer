import type { Address } from "viem";

/**
 * Known deployment addresses per chain ID.
 * Update after deploying to a new network.
 *
 * For local development with Anvil, deploy with `forge script` and
 * update the `31337` entry (or set CONTRACT_ADDRESS in .env).
 */
export const contractAddresses: Record<number, Address> = {
  // Anvil / local
  31337: "0x0000000000000000000000000000000000000000",

  // Ethereum Sepolia testnet (update after deployment)
  11155111: "0x0000000000000000000000000000000000000000",

  // Lisk Sepolia testnet (update after deployment)
  4202: "0x0000000000000000000000000000000000000000",
};

/**
 * Resolve the contract address for a given chain.
 * Prefers the CONTRACT_ADDRESS environment variable when set.
 */
export function getContractAddress(chainId: number): Address {
  const envAddr = typeof process !== "undefined"
    ? (process.env?.CONTRACT_ADDRESS ?? process.env?.NEXT_PUBLIC_CONTRACT_ADDRESS)
    : undefined;

  if (envAddr && /^0x[0-9a-fA-F]{40}$/.test(envAddr)) {
    return envAddr as Address;
  }

  const addr = contractAddresses[chainId];
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      `No contract address configured for chain ${chainId}. ` +
      `Set CONTRACT_ADDRESS env var or update packages/web3/src/addresses.ts.`
    );
  }
  return addr;
}
