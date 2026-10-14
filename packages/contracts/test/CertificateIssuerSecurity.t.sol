// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CertificateIssuer.sol";
import "openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title MaliciousRecipient
 * @dev A contract recipient that attempts reentrancy during onERC721Received.
 *      This verifies that the issueCertificate function is safe against
 *      reentrancy via the _safeMint callback.
 */
contract MaliciousRecipient is IERC721Receiver {
    CertificateIssuer public issuer;
    address public attacker;
    bool public reentrancyAttempted;
    bool public reentrancySucceeded;

    constructor(CertificateIssuer _issuer, address _attacker) {
        issuer = _issuer;
        attacker = _attacker;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        reentrancyAttempted = true;
        // Attempt to issue another certificate during the callback
        // This should fail because msg.sender in the reentrant call is
        // this contract, not the owner.
        try issuer.issueCertificate(address(this), "Hacker", "Exploit") {
            reentrancySucceeded = true;
        } catch {
            reentrancySucceeded = false;
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}

/**
 * @title RevertingRecipient
 * @dev A contract that reverts on ERC721 receive, testing atomic rollback.
 */
contract RevertingRecipient is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        revert("I refuse certificates");
    }
}

/**
 * @title NonERC721Recipient
 * @dev A contract with no onERC721Received, testing _safeMint rejection.
 */
contract NonERC721Recipient {}

/**
 * @title CertificateIssuerSecurityTest
 * @dev Security-focused tests covering threat vectors from the audit.
 */
contract CertificateIssuerSecurityTest is Test {
    CertificateIssuer public issuer;

    address public owner = address(0xABCD);
    address public recipient = address(0xBEEF);
    address public attacker = address(0xDEAD);

    function setUp() public {
        vm.prank(owner);
        issuer = new CertificateIssuer("On-Chain Certificate", "CERT");
    }

    // =========================================================================
    // Reentrancy via _safeMint callback
    // =========================================================================

    function testReentrancyViaOnERC721ReceivedBlocked() public {
        MaliciousRecipient malicious = new MaliciousRecipient(issuer, attacker);

        vm.prank(owner);
        // The mint should succeed — the reentrancy attempt should fail
        uint256 tokenId = issuer.issueCertificate(address(malicious), "Victim", "Course");

        assertEq(issuer.ownerOf(tokenId), address(malicious));
        assertTrue(malicious.reentrancyAttempted());
        assertFalse(malicious.reentrancySucceeded());
    }

    // =========================================================================
    // Malicious / contract recipients
    // =========================================================================

    function testRevertingRecipientRollsBackIssuance() public {
        RevertingRecipient reverter = new RevertingRecipient();

        vm.prank(owner);
        vm.expectRevert("I refuse certificates");
        issuer.issueCertificate(address(reverter), "Nobody", "Course");

        // Token counter should not have advanced
        assertEq(issuer.totalIssued(), 0);
    }

    function testNonERC721RecipientReverts() public {
        NonERC721Recipient noReceiver = new NonERC721Recipient();

        vm.prank(owner);
        vm.expectRevert(); // ERC721InvalidReceiver
        issuer.issueCertificate(address(noReceiver), "Nobody", "Course");

        assertEq(issuer.totalIssued(), 0);
    }

    // =========================================================================
    // Multi-actor authorization
    // =========================================================================

    function testMultipleActorsCannotIssue() public {
        address[] memory actors = new address[](5);
        actors[0] = address(0x1001);
        actors[1] = address(0x1002);
        actors[2] = address(0x1003);
        actors[3] = address(0x1004);
        actors[4] = address(0x1005);

        for (uint256 i = 0; i < actors.length; i++) {
            vm.prank(actors[i]);
            vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, actors[i]));
            issuer.issueCertificate(recipient, "Name", "Course");
        }

        // Only owner can issue
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");
        assertEq(tokenId, 0);
    }

    function testMultipleActorsCannotRevoke() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        // Try revocation from multiple non-owner addresses
        address[] memory actors = new address[](3);
        actors[0] = recipient; // Even the certificate holder
        actors[1] = attacker;
        actors[2] = address(0x9999);

        for (uint256 i = 0; i < actors.length; i++) {
            vm.prank(actors[i]);
            vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, actors[i]));
            issuer.revoke(tokenId);
        }

        // Certificate still valid
        CertificateIssuer.VerificationResult memory result = issuer.verifyCertificate(tokenId);
        assertEq(uint256(result.status), uint256(CertificateIssuer.CertificateStatus.Valid));
    }

    // =========================================================================
    // Ownership transfer security
    // =========================================================================

    function testOwnershipTransferRevokesOldOwnerAuthority() public {
        address newOwner = address(0x5678);

        vm.prank(owner);
        issuer.transferOwnership(newOwner);

        // Old owner cannot issue
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        issuer.issueCertificate(recipient, "Name", "Course");

        // Old owner cannot revoke
        vm.prank(newOwner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        issuer.revoke(tokenId);

        // New owner can revoke
        vm.prank(newOwner);
        issuer.revoke(tokenId);
    }

    function testCannotTransferOwnershipToZero() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        issuer.transferOwnership(address(0));
    }

    function testNonOwnerCannotTransferOwnership() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        issuer.transferOwnership(attacker);
    }

    // =========================================================================
    // Existence checks
    // =========================================================================

    function testVerifyNonexistentTokenReturnsNonexistent() public view {
        CertificateIssuer.VerificationResult memory result = issuer.verifyCertificate(type(uint256).max);
        assertEq(uint256(result.status), uint256(CertificateIssuer.CertificateStatus.Nonexistent));
        assertEq(result.owner, address(0));
    }

    function testGetCertificateNonexistentReverts() public {
        vm.expectRevert();
        issuer.getCertificate(type(uint256).max);
    }

    function testTokenURINonexistentReverts() public {
        vm.expectRevert();
        issuer.tokenURI(type(uint256).max);
    }

    // =========================================================================
    // Gas DoS: max-length strings
    // =========================================================================

    function testIssueCertificateWithMaxLengthStringsSucceeds() public {
        bytes memory maxName = new bytes(128);
        bytes memory maxCourse = new bytes(256);
        for (uint256 i = 0; i < 128; i++) maxName[i] = "X";
        for (uint256 i = 0; i < 256; i++) maxCourse[i] = "Y";

        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, string(maxName), string(maxCourse));

        // tokenURI should still work (may be expensive but not OOG)
        string memory uri = issuer.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0);
    }

    // =========================================================================
    // Event correctness
    // =========================================================================

    function testCertificateIssuedEventFields() public {
        vm.warp(1700000000);

        vm.expectEmit(true, true, false, true);
        emit CertificateIssuer.CertificateIssued(0, recipient, "Alice", "Course", 1700000000);

        vm.prank(owner);
        issuer.issueCertificate(recipient, "Alice", "Course");
    }

    function testCertificateRevokedEventField() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        vm.expectEmit(true, false, false, false);
        emit CertificateIssuer.CertificateRevoked(tokenId);

        vm.prank(owner);
        issuer.revoke(tokenId);
    }

    // =========================================================================
    // ERC-721 interface compliance
    // =========================================================================

    function testSupportsERC721Interface() public view {
        // ERC-721 interface ID: 0x80ac58cd
        assertTrue(issuer.supportsInterface(0x80ac58cd));
    }

    function testSupportsERC721MetadataInterface() public view {
        // ERC-721 Metadata interface ID: 0x5b5e139f
        assertTrue(issuer.supportsInterface(0x5b5e139f));
    }

    function testSupportsERC165Interface() public view {
        // ERC-165 interface ID: 0x01ffc9a7
        assertTrue(issuer.supportsInterface(0x01ffc9a7));
    }

    function testBalanceOfAfterMultipleIssuances() public {
        vm.startPrank(owner);
        issuer.issueCertificate(recipient, "Alice", "Course A");
        issuer.issueCertificate(recipient, "Alice", "Course B");
        issuer.issueCertificate(recipient, "Alice", "Course C");
        vm.stopPrank();

        assertEq(issuer.balanceOf(recipient), 3);
    }

    // =========================================================================
    // Revocation does not burn
    // =========================================================================

    function testRevocationPreservesOwnership() public {
        vm.startPrank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");
        issuer.revoke(tokenId);
        vm.stopPrank();

        // Token still exists and has an owner
        assertEq(issuer.ownerOf(tokenId), recipient);
        assertEq(issuer.balanceOf(recipient), 1);
    }

    function testRevocationPreservesMetadata() public {
        vm.warp(1700000000);

        vm.startPrank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");
        issuer.revoke(tokenId);
        vm.stopPrank();

        (address certOwner, string memory name, string memory course, uint256 date, bool revoked) =
            issuer.getCertificate(tokenId);

        assertEq(certOwner, recipient);
        assertEq(name, "Alice");
        assertEq(course, "Solidity 101");
        assertEq(date, 1700000000);
        assertTrue(revoked);
    }

    // =========================================================================
    // Token ID collision resistance
    // =========================================================================

    function testTokenIdNeverReused() public {
        vm.startPrank(owner);
        uint256 id0 = issuer.issueCertificate(recipient, "A", "Course");
        uint256 id1 = issuer.issueCertificate(recipient, "B", "Course");
        uint256 id2 = issuer.issueCertificate(recipient, "C", "Course");

        // Revoke middle one
        issuer.revoke(id1);

        // Issue another — should NOT reuse id1
        uint256 id3 = issuer.issueCertificate(recipient, "D", "Course");
        vm.stopPrank();

        assertTrue(id3 != id0 && id3 != id1 && id3 != id2);
        assertEq(id3, 3);
    }

    // =========================================================================
    // Timestamp edge cases
    // =========================================================================

    function testIssueDateMatchesBlockTimestamp() public {
        vm.warp(1000000);

        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        (, , , uint256 issueDate, ) = issuer.getCertificate(tokenId);
        assertEq(issueDate, 1000000);
    }

    function testIssueDateAtZeroTimestamp() public {
        vm.warp(0);

        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        (, , , uint256 issueDate, ) = issuer.getCertificate(tokenId);
        assertEq(issueDate, 0);
    }

    function testIssueDateFarFuture() public {
        // Year ~2100
        vm.warp(4102444800);

        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        (, , , uint256 issueDate, ) = issuer.getCertificate(tokenId);
        assertEq(issueDate, 4102444800);

        // tokenURI should still format correctly
        string memory uri = issuer.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0);
    }

    // =========================================================================
    // Constructor validation
    // =========================================================================

    function testEmptyNameAndSymbolAllowed() public {
        vm.prank(owner);
        CertificateIssuer emptyIssuer = new CertificateIssuer("", "");
        assertEq(emptyIssuer.name(), "");
        assertEq(emptyIssuer.symbol(), "");
    }

    function testConstructorSetsOwner() public {
        address deployer = address(0x7777);
        vm.prank(deployer);
        CertificateIssuer newIssuer = new CertificateIssuer("Test", "TST");
        assertEq(newIssuer.owner(), deployer);
    }
}
