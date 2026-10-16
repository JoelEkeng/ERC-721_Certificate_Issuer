/**
 * Block explorer URL helpers.
 * Maps chain IDs to their block explorer base URLs.
 */

const EXPLORER_URLS: Record<number, string> = {
  1: "https://etherscan.io",
  11155111: "https://sepolia.etherscan.io",
  4202: "https://sepolia-blockscout.lisk.com",
  31337: "", // Anvil — no explorer
};

export function getExplorerUrl(chainId: number | undefined): string | null {
  if (!chainId) return null;
  return EXPLORER_URLS[chainId] ?? null;
}

export function getTxUrl(
  chainId: number | undefined,
  txHash: string
): string | null {
  const base = getExplorerUrl(chainId);
  if (!base) return null;
  return `${base}/tx/${txHash}`;
}

export function getAddressUrl(
  chainId: number | undefined,
  address: string
): string | null {
  const base = getExplorerUrl(chainId);
  if (!base) return null;
  return `${base}/address/${address}`;
}

export function getTokenUrl(
  chainId: number | undefined,
  contractAddress: string,
  tokenId: string | number | bigint
): string | null {
  const base = getExplorerUrl(chainId);
  if (!base) return null;
  return `${base}/nft/${contractAddress}/${tokenId.toString()}`;
}
