// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CertificateIssuer.sol";

contract DeployCertificateIssuer is Script {
    function run() external returns (CertificateIssuer) {
        string memory name = vm.envOr("CERTIFICATE_NAME", string("On-Chain Certificate"));
        string memory symbol = vm.envOr("CERTIFICATE_SYMBOL", string("CERT"));

        vm.startBroadcast();
        CertificateIssuer issuer = new CertificateIssuer(name, symbol);
        vm.stopBroadcast();

        return issuer;
    }
}
