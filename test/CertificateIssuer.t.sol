// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CertificateIssuer.sol";

contract CertificateIssuerTest is Test {
    CertificateIssuer public issuer;

    address public owner = address(0xABCD);
    address public recipient = address(0xBEEF);
    address public other = address(0xCAFE);

    function setUp() public {
        vm.prank(owner);
        issuer = new CertificateIssuer("On-Chain Certificate", "CERT");
    }

    function testIssueCertificate() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        assertEq(issuer.ownerOf(tokenId), recipient);
        assertEq(issuer.balanceOf(recipient), 1);

        (string memory recipientName, string memory courseTitle, uint256 issueDate, bool revoked) =
            issuer.certificates(tokenId);
        assertEq(recipientName, "Alice");
        assertEq(courseTitle, "Solidity 101");
        assertEq(issueDate, block.timestamp);
        assertFalse(revoked);

        assertTrue(issuer.verifyCertificate(tokenId));
    }

    function testOnlyOwnerCanIssue() public {
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, other));
        issuer.issueCertificate(recipient, "Bob", "Course");
    }

    function testIssueCertificateEmptyNameReverts() public {
        vm.prank(owner);
        vm.expectRevert(CertificateIssuer.EmptyRecipientName.selector);
        issuer.issueCertificate(recipient, "", "Course");
    }

    function testIssueCertificateEmptyCourseReverts() public {
        vm.prank(owner);
        vm.expectRevert(CertificateIssuer.EmptyCourseTitle.selector);
        issuer.issueCertificate(recipient, "Bob", "");
    }

    function testIssueCertificateToZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert(CertificateIssuer.InvalidRecipient.selector);
        issuer.issueCertificate(address(0), "Bob", "Course");
    }

    function testTransferFromBlocked() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        vm.prank(recipient);
        vm.expectRevert(CertificateIssuer.NonTransferable.selector);
        issuer.transferFrom(recipient, other, tokenId);
    }

    function testSafeTransferFromBlocked() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        vm.prank(recipient);
        vm.expectRevert(CertificateIssuer.NonTransferable.selector);
        issuer.safeTransferFrom(recipient, other, tokenId);
    }

    function testSafeTransferFromWithDataBlocked() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        vm.prank(recipient);
        vm.expectRevert(CertificateIssuer.NonTransferable.selector);
        issuer.safeTransferFrom(recipient, other, tokenId, "");
    }

    function testApproveBlocked() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        vm.prank(recipient);
        vm.expectRevert(CertificateIssuer.NonTransferable.selector);
        issuer.approve(other, tokenId);
    }

    function testSetApprovalForAllBlocked() public {
        vm.prank(recipient);
        vm.expectRevert(CertificateIssuer.NonTransferable.selector);
        issuer.setApprovalForAll(other, true);
    }

    function testVerifyNonExistentCertificate() public view {
        assertFalse(issuer.verifyCertificate(999));
    }

    function testRevokeCertificate() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");
        assertTrue(issuer.verifyCertificate(tokenId));

        vm.prank(owner);
        issuer.revoke(tokenId);

        assertFalse(issuer.verifyCertificate(tokenId));

        (,,, bool revoked) = issuer.certificates(tokenId);
        assertTrue(revoked);
    }

    function testOnlyOwnerCanRevoke() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, other));
        issuer.revoke(tokenId);
    }

    function testRevokeNonExistentCertificateReverts() public {
        vm.prank(owner);
        vm.expectRevert(CertificateIssuer.CertificateNonExistent.selector);
        issuer.revoke(999);
    }

    function testRevokeAlreadyRevokedReverts() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        vm.prank(owner);
        issuer.revoke(tokenId);

        vm.prank(owner);
        vm.expectRevert(CertificateIssuer.CertificateAlreadyRevoked.selector);
        issuer.revoke(tokenId);
    }

    function testTokenURIReturnsBase64DataUri() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        string memory uri = issuer.tokenURI(tokenId);
        assertEq(bytes(uri).length > 0, true);

        bytes memory uriBytes = bytes(uri);
        bytes memory prefix = bytes("data:application/json;base64,");
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(uriBytes[i], prefix[i]);
        }
    }

    function testTokenURINonExistentReverts() public {
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("ERC721NonexistentToken(uint256)")), 999));
        issuer.tokenURI(999);
    }
}
