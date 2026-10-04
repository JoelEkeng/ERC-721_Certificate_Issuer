// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/CertificateIssuer.sol";

contract DeployCertificateIssuer is Script {
    function run() external returns (CertificateIssuer) {
        string memory name = vm.envString("CERTIFICATE_NAME");
        string memory symbol = vm.envString("CERTIFICATE_SYMBOL");

        vm.startBroadcast();

        CertificateIssuer issuer = new CertificateIssuer(name, symbol);

        vm.stopBroadcast();

        return issuer;
    }
}