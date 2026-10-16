// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CertificateIssuer.sol";

/**
 * @title DeployCertificateIssuer
 * @dev Foundry deployment script for the CertificateIssuer contract.
 *
 *      Environment variables:
 *        CERTIFICATE_NAME    — ERC-721 collection name (default: "On-Chain Certificate")
 *        CERTIFICATE_SYMBOL  — ERC-721 collection symbol (default: "CERT")
 *        EXPECTED_CHAIN_ID   — Optional safety guard: reverts if the RPC chain ID
 *                              does not match. Prevents accidental mainnet deployment.
 *        DEPLOYER_ADDRESS    — Optional: log expected deployer for verification.
 *
 *      Usage (local Anvil):
 *        forge script script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
 *          --rpc-url http://127.0.0.1:8545 \
 *          --private-key $PRIVATE_KEY \
 *          --broadcast
 *
 *      Usage (testnet with chain-ID guard):
 *        EXPECTED_CHAIN_ID=11155111 forge script script/DeployCertificateIssuer.s.sol:DeployCertificateIssuer \
 *          --rpc-url $RPC_URL \
 *          --private-key $PRIVATE_KEY \
 *          --broadcast --verify
 *
 *      IMPORTANT: Never hardcode private keys. Use environment variables or
 *      `--ledger` / `--trezor` for hardware wallet signing.
 */
contract DeployCertificateIssuer is Script {
    function run() external returns (CertificateIssuer) {
        // --- Configuration ---
        string memory name = vm.envOr("CERTIFICATE_NAME", string("On-Chain Certificate"));
        string memory symbol = vm.envOr("CERTIFICATE_SYMBOL", string("CERT"));

        // --- Chain ID safety guard ---
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", uint256(0));
        if (expectedChainId != 0) {
            require(
                block.chainid == expectedChainId,
                string.concat(
                    "Chain ID mismatch: expected ",
                    vm.toString(expectedChainId),
                    " but got ",
                    vm.toString(block.chainid),
                    ". Aborting to prevent deployment to wrong network."
                )
            );
            console.log("Chain ID verified:", block.chainid);
        }

        // --- Pre-deployment logging ---
        console.log("=== CertificateIssuer Deployment ===");
        console.log("Chain ID:     ", block.chainid);
        console.log("Name:         ", name);
        console.log("Symbol:       ", symbol);

        // --- Deploy ---
        vm.startBroadcast();
        CertificateIssuer issuer = new CertificateIssuer(name, symbol);
        vm.stopBroadcast();

        // --- Post-deployment verification ---
        console.log("");
        console.log("=== Deployment Successful ===");
        console.log("Contract:     ", address(issuer));
        console.log("Owner:        ", issuer.owner());
        console.log("ERC-721 Name: ", issuer.name());
        console.log("ERC-721 Symbol:", issuer.symbol());
        console.log("");
        console.log("Verify with:");
        console.log("  cast call", address(issuer), '"owner()(address)"', "--rpc-url $RPC_URL");

        return issuer;
    }
}
