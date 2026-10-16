import { http } from "wagmi";
import { hardhat, sepolia, liskSepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import type { Address } from "viem";

/**
 * Contract address — set via NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local.
 * Falls back to zero address (will fail gracefully on read calls).
 */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as Address;

/**
 * WalletConnect project ID — required for RainbowKit.
 * Get one free at https://cloud.walletconnect.com
 */
const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo";

export const wagmiConfig = getDefaultConfig({
  appName: "On-Chain Certificate Issuer",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [hardhat, sepolia, liskSepolia],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [sepolia.id]: http(),
    [liskSepolia.id]: http(),
  },
  ssr: true,
});
