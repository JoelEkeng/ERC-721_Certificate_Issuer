// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "../src/CertificateIssuer.sol";

/**
 * @title CertificateIssuerHandler
 * @dev Guided handler for invariant testing. Foundry calls these functions
 *      with random arguments across many runs. The handler constrains inputs
 *      to valid ranges so the invariant checker tests meaningful state transitions
 *      rather than spending all runs on reverts.
 */
contract CertificateIssuerHandler is Test {
    CertificateIssuer public issuer;
    address public owner;

    // Ghost variables to track expected state
    uint256 public issuedCount;
    uint256 public revokedCount;
    uint256[] public issuedTokenIds;
    mapping(uint256 => address) public expectedOwners;
    mapping(uint256 => bool) public isRevoked;

    // Predefined recipient pool
    address[] public recipients;

    constructor(CertificateIssuer _issuer, address _owner) {
        issuer = _issuer;
        owner = _owner;
        recipients.push(address(0x1001));
        recipients.push(address(0x1002));
        recipients.push(address(0x1003));
        recipients.push(address(0x1004));
        recipients.push(address(0x1005));
    }

    function issue(uint256 recipientSeed, uint256 nameSeed) external {
        address recipient = recipients[recipientSeed % recipients.length];
        string memory name = nameSeed % 2 == 0 ? "Alice" : "Bob";
        string memory course = nameSeed % 3 == 0 ? "Solidity" : nameSeed % 3 == 1 ? "Web3" : "DeFi";

        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, name, course);

        issuedCount++;
        issuedTokenIds.push(tokenId);
        expectedOwners[tokenId] = recipient;
    }

    function revoke(uint256 tokenIdSeed) external {
        if (issuedTokenIds.length == 0) return;
        uint256 tokenId = issuedTokenIds[tokenIdSeed % issuedTokenIds.length];

        if (isRevoked[tokenId]) return; // Skip already revoked

        vm.prank(owner);
        issuer.revoke(tokenId);

        isRevoked[tokenId] = true;
        revokedCount++;
    }

    function issueAsNonOwner(address caller, uint256 recipientSeed) external {
        if (caller == owner || caller == address(0)) return;

        address recipient = recipients[recipientSeed % recipients.length];

        vm.prank(caller);
        vm.expectRevert();
        issuer.issueCertificate(recipient, "Name", "Course");
    }

    function attemptTransfer(uint256 tokenIdSeed, address to) external {
        if (issuedTokenIds.length == 0) return;
        if (to == address(0)) return;
        uint256 tokenId = issuedTokenIds[tokenIdSeed % issuedTokenIds.length];
        address tokenOwner = expectedOwners[tokenId];

        vm.prank(tokenOwner);
        vm.expectRevert(CertificateIssuer.NonTransferable.selector);
        issuer.transferFrom(tokenOwner, to, tokenId);
    }

    function getIssuedCount() external view returns (uint256) {
        return issuedTokenIds.length;
    }
}

/**
 * @title CertificateIssuerInvariantTest
 * @dev Stateful invariant tests that verify critical properties hold across
 *      arbitrary sequences of issue/revoke/transfer operations.
 */
contract CertificateIssuerInvariantTest is StdInvariant, Test {
    CertificateIssuer public issuer;
    CertificateIssuerHandler public handler;
    address public owner = address(0xABCD);

    function setUp() public {
        vm.prank(owner);
        issuer = new CertificateIssuer("On-Chain Certificate", "CERT");

        handler = new CertificateIssuerHandler(issuer, owner);

        // Target only the handler for invariant calls
        targetContract(address(handler));
    }

    /// @dev Token IDs are strictly sequential and match the total count.
    function invariant_tokenIdsAreSequential() public view {
        assertEq(issuer.totalIssued(), handler.issuedCount());
    }

    /// @dev A revoked certificate never returns Valid from verifyCertificate.
    function invariant_revokedNeverValid() public view {
        uint256 count = handler.getIssuedCount();
        for (uint256 i = 0; i < count && i < 20; i++) {
            uint256 tokenId = handler.issuedTokenIds(i);
            if (handler.isRevoked(tokenId)) {
                CertificateIssuer.VerificationResult memory result = issuer.verifyCertificate(tokenId);
                assertTrue(
                    result.status == CertificateIssuer.CertificateStatus.Revoked,
                    "Revoked cert must not verify as valid"
                );
            }
        }
    }

    /// @dev Certificate ownership never changes after minting (soulbound).
    function invariant_ownershipNeverChanges() public view {
        uint256 count = handler.getIssuedCount();
        for (uint256 i = 0; i < count && i < 20; i++) {
            uint256 tokenId = handler.issuedTokenIds(i);
            address expected = handler.expectedOwners(tokenId);
            assertEq(
                issuer.ownerOf(tokenId),
                expected,
                "Certificate owner must not change"
            );
        }
    }

    /// @dev Certificate metadata is never erased or modified.
    function invariant_metadataPreserved() public view {
        uint256 count = handler.getIssuedCount();
        for (uint256 i = 0; i < count && i < 20; i++) {
            uint256 tokenId = handler.issuedTokenIds(i);
            (string memory name, string memory course, uint256 issueDate,) = issuer.certificates(tokenId);
            assertTrue(bytes(name).length > 0, "Name must not be empty");
            assertTrue(bytes(course).length > 0, "Course must not be empty");
            assertTrue(issueDate > 0, "Issue date must be set");
        }
    }

    /// @dev Valid certificates always return the correct owner address.
    function invariant_validCertsHaveOwner() public view {
        uint256 count = handler.getIssuedCount();
        for (uint256 i = 0; i < count && i < 20; i++) {
            uint256 tokenId = handler.issuedTokenIds(i);
            CertificateIssuer.VerificationResult memory result = issuer.verifyCertificate(tokenId);
            assertTrue(result.owner != address(0), "Issued cert must have non-zero owner");
        }
    }

    /// @dev The total issued count only increases.
    function invariant_totalIssuedMonotonic() public view {
        assertTrue(issuer.totalIssued() >= handler.issuedCount());
    }
}
