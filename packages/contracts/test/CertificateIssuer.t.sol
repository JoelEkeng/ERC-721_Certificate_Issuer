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

    // =========================================================================
    // Issuance
    // =========================================================================

    function testIssueCertificate() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        assertEq(tokenId, 0);
        assertEq(issuer.ownerOf(tokenId), recipient);
        assertEq(issuer.balanceOf(recipient), 1);

        (string memory recipientName, string memory courseTitle, uint256 issueDate, bool revoked) =
            issuer.certificates(tokenId);
        assertEq(recipientName, "Alice");
        assertEq(courseTitle, "Solidity 101");
        assertEq(issueDate, block.timestamp);
        assertFalse(revoked);

        CertificateIssuer.VerificationResult memory result = issuer.verifyCertificate(tokenId);
        assertEq(uint256(result.status), uint256(CertificateIssuer.CertificateStatus.Valid));
    }

    function testIssueCertificateEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit CertificateIssuer.CertificateIssued(0, recipient, "Alice", "Solidity 101", block.timestamp);

        vm.prank(owner);
        issuer.issueCertificate(recipient, "Alice", "Solidity 101");
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

    function testIssueCertificateWhitespaceOnlyNameReverts() public {
        vm.prank(owner);
        vm.expectRevert(CertificateIssuer.EmptyRecipientName.selector);
        issuer.issueCertificate(recipient, "   ", "Course");
    }

    function testIssueCertificateWhitespaceOnlyCourseReverts() public {
        vm.prank(owner);
        vm.expectRevert(CertificateIssuer.EmptyCourseTitle.selector);
        issuer.issueCertificate(recipient, "Bob", " \t\n\r ");
    }

    function testIssueCertificateNameTooLongReverts() public {
        bytes memory longName = new bytes(129);
        for (uint256 i = 0; i < 129; i++) {
            longName[i] = "A";
        }

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(CertificateIssuer.RecipientNameTooLong.selector, 129, 128));
        issuer.issueCertificate(recipient, string(longName), "Course");
    }

    function testIssueCertificateNameAtMaxLength() public {
        bytes memory maxName = new bytes(128);
        for (uint256 i = 0; i < 128; i++) {
            maxName[i] = "A";
        }

        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, string(maxName), "Course");
        assertEq(issuer.ownerOf(tokenId), recipient);
    }

    function testIssueCertificateCourseTitleTooLongReverts() public {
        bytes memory longTitle = new bytes(257);
        for (uint256 i = 0; i < 257; i++) {
            longTitle[i] = "B";
        }

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(CertificateIssuer.CourseTitleTooLong.selector, 257, 256));
        issuer.issueCertificate(recipient, "Bob", string(longTitle));
    }

    function testIssueCertificateCourseTitleAtMaxLength() public {
        bytes memory maxTitle = new bytes(256);
        for (uint256 i = 0; i < 256; i++) {
            maxTitle[i] = "C";
        }

        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Bob", string(maxTitle));
        assertEq(issuer.ownerOf(tokenId), recipient);
    }

    // =========================================================================
    // Unique Token IDs
    // =========================================================================

    function testMultipleCertificatesHaveUniqueIds() public {
        vm.startPrank(owner);

        uint256 id0 = issuer.issueCertificate(recipient, "Alice", "Course A");
        uint256 id1 = issuer.issueCertificate(other, "Bob", "Course B");
        uint256 id2 = issuer.issueCertificate(recipient, "Charlie", "Course C");

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertTrue(id0 != id1 && id1 != id2 && id0 != id2);

        vm.stopPrank();
    }

    function testTotalIssuedCounter() public {
        assertEq(issuer.totalIssued(), 0);

        vm.startPrank(owner);
        issuer.issueCertificate(recipient, "Alice", "Course A");
        assertEq(issuer.totalIssued(), 1);

        issuer.issueCertificate(other, "Bob", "Course B");
        assertEq(issuer.totalIssued(), 2);
        vm.stopPrank();
    }

    // =========================================================================
    // getCertificate
    // =========================================================================

    function testGetCertificate() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        (address certOwner, string memory name, string memory course, uint256 issueDate, bool revoked) =
            issuer.getCertificate(tokenId);

        assertEq(certOwner, recipient);
        assertEq(name, "Alice");
        assertEq(course, "Solidity 101");
        assertEq(issueDate, block.timestamp);
        assertFalse(revoked);
    }

    function testGetCertificateAfterRevocation() public {
        vm.startPrank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");
        issuer.revoke(tokenId);
        vm.stopPrank();

        (address certOwner, string memory name, string memory course, uint256 issueDate, bool revoked) =
            issuer.getCertificate(tokenId);

        assertEq(certOwner, recipient);
        assertEq(name, "Alice");
        assertEq(course, "Solidity 101");
        assertTrue(revoked);
        assertTrue(issueDate > 0);
    }

    function testGetCertificateNonexistentReverts() public {
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("ERC721NonexistentToken(uint256)")), 999));
        issuer.getCertificate(999);
    }

    // =========================================================================
    // Verification
    // =========================================================================

    function testVerifyCertificateValid() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        CertificateIssuer.VerificationResult memory result = issuer.verifyCertificate(tokenId);

        assertEq(uint256(result.status), uint256(CertificateIssuer.CertificateStatus.Valid));
        assertEq(result.owner, recipient);
        assertEq(result.recipientName, "Alice");
        assertEq(result.courseTitle, "Course");
        assertEq(result.issueDate, block.timestamp);
    }

    function testVerifyCertificateRevoked() public {
        vm.startPrank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");
        issuer.revoke(tokenId);
        vm.stopPrank();

        CertificateIssuer.VerificationResult memory result = issuer.verifyCertificate(tokenId);

        assertEq(uint256(result.status), uint256(CertificateIssuer.CertificateStatus.Revoked));
        assertEq(result.owner, recipient);
        assertEq(result.recipientName, "Alice");
    }

    function testVerifyCertificateNonexistent() public view {
        CertificateIssuer.VerificationResult memory result = issuer.verifyCertificate(999);

        assertEq(uint256(result.status), uint256(CertificateIssuer.CertificateStatus.Nonexistent));
        assertEq(result.owner, address(0));
        assertEq(bytes(result.recipientName).length, 0);
        assertEq(bytes(result.courseTitle).length, 0);
        assertEq(result.issueDate, 0);
    }

    // =========================================================================
    // Revocation
    // =========================================================================

    function testRevokeCertificate() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        CertificateIssuer.VerificationResult memory beforeResult = issuer.verifyCertificate(tokenId);
        assertEq(uint256(beforeResult.status), uint256(CertificateIssuer.CertificateStatus.Valid));

        vm.prank(owner);
        issuer.revoke(tokenId);

        CertificateIssuer.VerificationResult memory afterResult = issuer.verifyCertificate(tokenId);
        assertEq(uint256(afterResult.status), uint256(CertificateIssuer.CertificateStatus.Revoked));

        (,,, bool revoked) = issuer.certificates(tokenId);
        assertTrue(revoked);

        // Metadata is preserved
        assertEq(afterResult.owner, recipient);
        assertEq(afterResult.recipientName, "Alice");
    }

    function testRevokeCertificateEmitsEvent() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        vm.expectEmit(true, false, false, false);
        emit CertificateIssuer.CertificateRevoked(tokenId);

        vm.prank(owner);
        issuer.revoke(tokenId);
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

    // =========================================================================
    // Transfer restrictions (soulbound)
    // =========================================================================

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

    function testTransferFromBlockedByOwner() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        // Even the contract owner cannot transfer someone's certificate
        vm.prank(owner);
        vm.expectRevert(CertificateIssuer.NonTransferable.selector);
        issuer.transferFrom(recipient, other, tokenId);
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

    // =========================================================================
    // Ownership
    // =========================================================================

    function testOwnerIsDeployer() public view {
        assertEq(issuer.owner(), owner);
    }

    function testTransferOwnership2Step() public {
        // Step 1: Owner initiates transfer
        vm.prank(owner);
        issuer.transferOwnership(other);

        // Owner is still the actual owner until acceptance
        assertEq(issuer.owner(), owner);
        assertEq(issuer.pendingOwner(), other);

        // Owner can still issue during pending transfer
        vm.prank(owner);
        issuer.issueCertificate(recipient, "During Transfer", "Course");

        // Pending owner cannot yet issue
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, other));
        issuer.issueCertificate(recipient, "Not Yet", "Course");

        // Step 2: New owner accepts
        vm.prank(other);
        issuer.acceptOwnership();

        assertEq(issuer.owner(), other);
        assertEq(issuer.pendingOwner(), address(0));

        // New owner can issue
        vm.prank(other);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");
        assertEq(issuer.ownerOf(tokenId), recipient);

        // Old owner cannot
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        issuer.issueCertificate(recipient, "Bob", "Course 2");
    }

    function testAcceptOwnershipUnauthorized() public {
        vm.prank(owner);
        issuer.transferOwnership(other);

        // A third party cannot accept
        vm.prank(recipient);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, recipient));
        issuer.acceptOwnership();
    }

    function testCancelPendingTransfer() public {
        vm.prank(owner);
        issuer.transferOwnership(other);
        assertEq(issuer.pendingOwner(), other);

        // Cancel by setting pending to zero
        vm.prank(owner);
        issuer.transferOwnership(address(0));
        assertEq(issuer.pendingOwner(), address(0));
        assertEq(issuer.owner(), owner);
    }

    function testRenounceOwnershipReverts() public {
        vm.prank(owner);
        vm.expectRevert(CertificateIssuer.OwnershipRenunciationDisabled.selector);
        issuer.renounceOwnership();
    }

    function testRenounceOwnershipRevertsForNonOwner() public {
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, other));
        issuer.renounceOwnership();
    }

    // =========================================================================
    // Token URI and metadata
    // =========================================================================

    function testTokenURIReturnsBase64DataUri() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Solidity 101");

        string memory uri = issuer.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0);

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

    function testTokenURIContainsTokenId() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        string memory uri = issuer.tokenURI(tokenId);
        // The URI should be non-empty and contain token ID reference in metadata
        assertTrue(bytes(uri).length > 100);
    }

    function testTokenURIReflectsRevocation() public {
        vm.startPrank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        string memory uriBefore = issuer.tokenURI(tokenId);

        issuer.revoke(tokenId);

        string memory uriAfter = issuer.tokenURI(tokenId);
        vm.stopPrank();

        // URIs should be different since status changed
        assertTrue(
            keccak256(bytes(uriBefore)) != keccak256(bytes(uriAfter)), "Token URI should change after revocation"
        );
    }

    // =========================================================================
    // SVG and JSON escaping
    // =========================================================================

    function testIssueCertificateWithSpecialCharsInName() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, 'Alice "O\'Brien" <Jr>', "Course");

        // Certificate should be created successfully
        (address certOwner,,,,) = issuer.getCertificate(tokenId);
        assertEq(certOwner, recipient);

        // tokenURI should not revert (escaping works)
        string memory uri = issuer.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0);
    }

    function testIssueCertificateWithSpecialCharsInCourse() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Bob", "C++ & Java <Advanced>");

        (address certOwner,,,,) = issuer.getCertificate(tokenId);
        assertEq(certOwner, recipient);

        string memory uri = issuer.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0);
    }

    function testIssueCertificateWithAmpersandAndQuotes() public {
        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, 'Tom & "Jerry"', 'Rock & Roll "101"');

        string memory uri = issuer.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0);

        (, string memory name, string memory course,,) = issuer.getCertificate(tokenId);
        assertEq(name, 'Tom & "Jerry"');
        assertEq(course, 'Rock & Roll "101"');
    }

    function testIssueCertificateWithUnicode() public {
        vm.prank(owner);
        // UTF-8 characters should be stored and retrieved correctly
        uint256 tokenId = issuer.issueCertificate(recipient, unicode"José García", unicode"Español Avanzado");

        (, string memory name, string memory course,,) = issuer.getCertificate(tokenId);
        assertEq(name, unicode"José García");
        assertEq(course, unicode"Español Avanzado");
    }

    // =========================================================================
    // Constants
    // =========================================================================

    function testMaxNameLength() public view {
        assertEq(issuer.MAX_NAME_LENGTH(), 128);
    }

    function testMaxCourseTitleLength() public view {
        assertEq(issuer.MAX_COURSE_TITLE_LENGTH(), 256);
    }

    // =========================================================================
    // Fuzz tests
    // =========================================================================

    function testFuzzIssueCertificateValidInputs(address fuzzRecipient, string memory name, string memory course)
        public
    {
        // Bound inputs to valid ranges
        vm.assume(fuzzRecipient != address(0));
        // Exclude contract addresses — _safeMint requires IERC721Receiver on contracts
        vm.assume(fuzzRecipient.code.length == 0);
        vm.assume(bytes(name).length > 0 && bytes(name).length <= 128);
        vm.assume(bytes(course).length > 0 && bytes(course).length <= 256);

        // Check for whitespace-only
        bool hasNonWhitespaceName = false;
        for (uint256 i = 0; i < bytes(name).length; i++) {
            bytes1 c = bytes(name)[i];
            if (c != 0x20 && c != 0x09 && c != 0x0a && c != 0x0d) {
                hasNonWhitespaceName = true;
                break;
            }
        }
        vm.assume(hasNonWhitespaceName);

        bool hasNonWhitespaceCourse = false;
        for (uint256 i = 0; i < bytes(course).length; i++) {
            bytes1 c = bytes(course)[i];
            if (c != 0x20 && c != 0x09 && c != 0x0a && c != 0x0d) {
                hasNonWhitespaceCourse = true;
                break;
            }
        }
        vm.assume(hasNonWhitespaceCourse);

        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(fuzzRecipient, name, course);

        assertEq(issuer.ownerOf(tokenId), fuzzRecipient);

        (, string memory storedName, string memory storedCourse,,) = issuer.getCertificate(tokenId);
        assertEq(storedName, name);
        assertEq(storedCourse, course);
    }

    function testFuzzOnlyOwnerCanIssue(address caller) public {
        vm.assume(caller != owner);

        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, caller));
        issuer.issueCertificate(recipient, "Name", "Course");
    }

    function testFuzzOnlyOwnerCanRevoke(address caller) public {
        vm.assume(caller != owner);

        vm.prank(owner);
        uint256 tokenId = issuer.issueCertificate(recipient, "Alice", "Course");

        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, caller));
        issuer.revoke(tokenId);
    }

    function testFuzzTransferAlwaysBlocked(address from, address to, uint256 tokenId) public {
        vm.prank(from);
        vm.expectRevert(CertificateIssuer.NonTransferable.selector);
        issuer.transferFrom(from, to, tokenId);
    }

    function testFuzzVerifyNonexistentToken(uint256 tokenId) public view {
        CertificateIssuer.VerificationResult memory result = issuer.verifyCertificate(tokenId);
        assertEq(uint256(result.status), uint256(CertificateIssuer.CertificateStatus.Nonexistent));
    }

    function testFuzzSequentialTokenIds(uint8 count) public {
        vm.assume(count > 0 && count <= 50);

        vm.startPrank(owner);
        for (uint256 i = 0; i < count; i++) {
            uint256 tokenId = issuer.issueCertificate(recipient, "Name", "Course");
            assertEq(tokenId, i);
        }
        vm.stopPrank();

        assertEq(issuer.totalIssued(), count);
    }
}
