// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CertificateIssuer.sol";

contract CertificateIssuerTest is Test {
    CertificateIssuer public issuer;

    address public owner = makeAddr("owner");
    address public recipient = makeAddr("recipient");
    address public other = makeAddr("other");

    function setUp() public {
        vm.prank(owner);

        issuer = new CertificateIssuer(
            "On-Chain Certificate",
            "CERTVERI"
        );
    }

    function testIssueCertificate() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );

        assertEq(issuer.ownerOf(tokenId), recipient);
        assertEq(issuer.balanceOf(recipient), 1);

        (
            string memory recipientName,
            string memory courseTitle,
            CertificateIssuer.CertificateType certType,
            uint256 issueDate,
            bool revoked
        ) = issuer.certificates(tokenId);

        assertEq(recipientName, "Alice");
        assertEq(courseTitle, "Solidity 101");

        assertEq(
            uint256(certType),
            uint256(
                CertificateIssuer.CertificateType.CertificateOfCompletion
            )
        );

        assertEq(issueDate, block.timestamp);
        assertFalse(revoked);

        (
            bool exists,
            CertificateIssuer.Certificate memory certificate
        ) = issuer.verifyCertificate(tokenId);

        assertTrue(exists);
        assertEq(certificate.recipientName, "Alice");
        assertEq(certificate.courseTitle, "Solidity 101");
        assertFalse(certificate.revoked);
    }

    function testIssueAchievementCertificate() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfAchievement
        );

        (
            ,
            ,
            CertificateIssuer.CertificateType certType,
            ,
            
        ) = issuer.certificates(tokenId);

        assertEq(
            uint256(certType),
            uint256(
                CertificateIssuer.CertificateType.CertificateOfAchievement
            )
        );
    }

    function testIssueExcellenceCertificate() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfExcellence
        );

        (
            ,
            ,
            CertificateIssuer.CertificateType certType,
            ,
            
        ) = issuer.certificates(tokenId);

        assertEq(
            uint256(certType),
            uint256(
                CertificateIssuer.CertificateType.CertificateOfExcellence
            )
        );
    }

    function testOnlyOwnerCanIssue() public {
        vm.prank(other);

        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                other
            )
        );

        issuer.issueCertificate(
            recipient,
            "Bob",
            "Course",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );
    }

    function testIssueCertificateEmptyNameReverts() public {
        vm.prank(owner);

        vm.expectRevert(
            CertificateIssuer.EmptyRecipientName.selector
        );

        issuer.issueCertificate(
            recipient,
            "",
            "Course",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );
    }

    function testIssueCertificateEmptyCourseReverts() public {
        vm.prank(owner);

        vm.expectRevert(
            CertificateIssuer.EmptyCourseTitle.selector
        );

        issuer.issueCertificate(
            recipient,
            "Bob",
            "",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );
    }

    function testIssueCertificateToZeroAddressReverts() public {
        vm.prank(owner);

        vm.expectRevert(
            CertificateIssuer.InvalidRecipient.selector
        );

        issuer.issueCertificate(
            address(0),
            "Bob",
            "Course",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );
    }

    function testRecipientNameTooLongReverts() public {
        string memory longName = string(
            new bytes(101)
        );

        vm.prank(owner);

        vm.expectRevert(
            CertificateIssuer.recipientNameTooLong.selector
        );

        issuer.issueCertificate(
            recipient,
            longName,
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );
    }

    function testTransferFromBlocked() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );

        vm.prank(recipient);

        vm.expectRevert(
            CertificateIssuer.NonTransferable.selector
        );

        issuer.transferFrom(
            recipient,
            other,
            tokenId
        );
    }

    function testSafeTransferFromBlocked() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );

        vm.prank(recipient);

        vm.expectRevert(
            CertificateIssuer.NonTransferable.selector
        );

        issuer.safeTransferFrom(
            recipient,
            other,
            tokenId
        );
    }

    function testSafeTransferFromWithDataBlocked() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );

        vm.prank(recipient);

        vm.expectRevert(
            CertificateIssuer.NonTransferable.selector
        );

        issuer.safeTransferFrom(
            recipient,
            other,
            tokenId,
            ""
        );
    }

    function testApproveBlocked() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );

        vm.prank(recipient);

        vm.expectRevert(
            CertificateIssuer.NonTransferable.selector
        );

        issuer.approve(other, tokenId);
    }

    function testSetApprovalForAllBlocked() public {
        vm.prank(recipient);

        vm.expectRevert(
            CertificateIssuer.NonTransferable.selector
        );

        issuer.setApprovalForAll(other, true);
    }

    function testVerifyNonExistentCertificate() public {
        (
            bool exists,
            CertificateIssuer.Certificate memory certificate
        ) = issuer.verifyCertificate(999);

        assertFalse(exists);
        assertEq(bytes(certificate.recipientName).length, 0);
        assertEq(bytes(certificate.courseTitle).length, 0);
        assertFalse(certificate.revoked);
    }

    function testRevokeCertificate() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );

        (
            bool existsBefore,
            CertificateIssuer.Certificate memory certificateBefore
        ) = issuer.verifyCertificate(tokenId);

        assertTrue(existsBefore);
        assertFalse(certificateBefore.revoked);

        vm.prank(owner);
        issuer.revoke(tokenId);

        (
            bool existsAfter,
            CertificateIssuer.Certificate memory certificateAfter
        ) = issuer.verifyCertificate(tokenId);

        assertTrue(existsAfter);
        assertTrue(certificateAfter.revoked);

        (
            ,
            ,
            ,
            ,
            bool revoked
        ) = issuer.certificates(tokenId);

        assertTrue(revoked);
    }

    function testOnlyOwnerCanRevoke() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );

        vm.prank(other);

        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                other
            )
        );

        issuer.revoke(tokenId);
    }

    function testRevokeNonExistentCertificateReverts() public {
        vm.prank(owner);

        vm.expectRevert(
            CertificateIssuer.CertificateNonExistent.selector
        );

        issuer.revoke(999);
    }

    function testRevokeAlreadyRevokedReverts() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );

        vm.prank(owner);
        issuer.revoke(tokenId);

        vm.prank(owner);

        vm.expectRevert(
            CertificateIssuer.CertificateAlreadyRevoked.selector
        );

        issuer.revoke(tokenId);
    }

    function testTokenURIReturnsBase64DataUri() public {
        vm.prank(owner);

        uint256 tokenId = issuer.issueCertificate(
            recipient,
            "Alice",
            "Solidity 101",
            CertificateIssuer.CertificateType.CertificateOfCompletion
        );

        string memory uri = issuer.tokenURI(tokenId);

        assertTrue(bytes(uri).length > 0);

        bytes memory uriBytes = bytes(uri);
        bytes memory prefix = bytes(
            "data:application/json;base64,"
        );

        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(uriBytes[i], prefix[i]);
        }
    }

    function testTokenURINonExistentReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(
                    keccak256(
                        "ERC721NonexistentToken(uint256)"
                    )
                ),
                999
            )
        );

        issuer.tokenURI(999);
    }
}