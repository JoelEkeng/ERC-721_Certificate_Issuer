// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/access/Ownable.sol";
import "openzeppelin-contracts/contracts/utils/Strings.sol";
import "openzeppelin-contracts/contracts/utils/Base64.sol";

/**
 * @title CertificateIssuer
 * @dev A soulbound ERC-721 contract that issues on-chain certificates of completion.
 *      Certificates cannot be transferred or sold after minting, ensuring they remain
 *      tied to the original recipient. The contract owner (institution) can issue and
 *      revoke certificates.
 */
contract CertificateIssuer is ERC721, Ownable {
    using Strings for uint256;

    struct Certificate {
        string recipientName;
        string courseTitle;
        uint256 issueDate;
        bool revoked;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => Certificate) public certificates;

    event CertificateIssued(
        uint256 indexed tokenId, address indexed recipient, string recipientName, string courseTitle, uint256 issueDate
    );

    event CertificateRevoked(uint256 indexed tokenId);

    error EmptyRecipientName();
    error EmptyCourseTitle();
    error InvalidRecipient();
    error CertificateNonExistent();
    error CertificateAlreadyRevoked();
    error NonTransferable();

    constructor(string memory name, string memory symbol) ERC721(name, symbol) Ownable(msg.sender) {}

    /**
     * @notice Issue a new certificate to a recipient.
     * @param recipient The address that will receive the certificate.
     * @param recipientName The name of the certificate recipient.
     * @param courseTitle The title of the completed course.
     * @return tokenId The ID of the newly minted certificate.
     */
    function issueCertificate(address recipient, string memory recipientName, string memory courseTitle)
        public
        onlyOwner
        returns (uint256)
    {
        if (bytes(recipientName).length == 0) revert EmptyRecipientName();
        if (bytes(courseTitle).length == 0) revert EmptyCourseTitle();
        if (recipient == address(0)) revert InvalidRecipient();

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        certificates[tokenId] = Certificate({
            recipientName: recipientName, courseTitle: courseTitle, issueDate: block.timestamp, revoked: false
        });

        _safeMint(recipient, tokenId);

        emit CertificateIssued(tokenId, recipient, recipientName, courseTitle, block.timestamp);
        return tokenId;
    }

    /**
     * @notice Verify whether a certificate is authentic and valid (not revoked).
     * @param tokenId The certificate token ID to verify.
     * @return True if the certificate exists and has not been revoked.
     */
    function verifyCertificate(uint256 tokenId) public view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) return false;
        return !certificates[tokenId].revoked;
    }

    /**
     * @notice Revoke an existing certificate, e.g. in case of fraud or error.
     * @param tokenId The certificate token ID to revoke.
     */
    function revoke(uint256 tokenId) public onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert CertificateNonExistent();
        if (certificates[tokenId].revoked) revert CertificateAlreadyRevoked();

        certificates[tokenId].revoked = true;
        emit CertificateRevoked(tokenId);
    }

    /**
     * @notice Returns the on-chain JSON metadata for a certificate, including a generated SVG image.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireOwned(tokenId);

        Certificate memory cert = certificates[tokenId];
        string memory status = cert.revoked ? "REVOKED" : "VALID";

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
            '<rect width="800" height="600" fill="#f8f1dc" stroke="#c9a227" stroke-width="10"/>',
            '<text x="400" y="100" font-family="serif" font-size="40" text-anchor="middle" fill="#333">Certificate of Completion</text>',
            '<text x="400" y="200" font-family="sans-serif" font-size="28" text-anchor="middle" fill="#555">This certifies that</text>',
            '<text x="400" y="260" font-family="serif" font-size="36" text-anchor="middle" fill="#000">',
            _escapeXml(cert.recipientName),
            "</text>",
            '<text x="400" y="320" font-family="sans-serif" font-size="24" text-anchor="middle" fill="#555">has successfully completed</text>',
            '<text x="400" y="380" font-family="serif" font-size="32" text-anchor="middle" fill="#000">',
            _escapeXml(cert.courseTitle),
            "</text>",
            '<text x="400" y="460" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#777">Issued on: ',
            cert.issueDate.toString(),
            "</text>",
            '<text x="400" y="520" font-family="sans-serif" font-size="24" text-anchor="middle" fill="#900">Status: ',
            status,
            "</text>",
            "</svg>"
        );

        string memory json = string.concat(
            '{"name":"Certificate #',
            tokenId.toString(),
            '",',
            '"description":"On-chain certificate of completion issued by the institution",',
            '"attributes":[',
            '{"trait_type":"Recipient","value":"',
            _escapeJson(cert.recipientName),
            '"},',
            '{"trait_type":"Course","value":"',
            _escapeJson(cert.courseTitle),
            '"},',
            '{"trait_type":"Issue Date","display_type":"date","value":',
            cert.issueDate.toString(),
            "},",
            '{"trait_type":"Status","value":"',
            status,
            '"}],',
            '"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    // --- Soulbound / non-transferable overrides ---

    function approve(address, uint256) public virtual override {
        revert NonTransferable();
    }

    function setApprovalForAll(address, bool) public virtual override {
        revert NonTransferable();
    }

    function transferFrom(address, address, uint256) public virtual override {
        revert NonTransferable();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public virtual override {
        revert NonTransferable();
    }

    // --- Internal helpers ---

    function _escapeXml(string memory value) internal pure returns (string memory) {
        bytes memory valueBytes = bytes(value);
        bytes memory result = new bytes(valueBytes.length * 6);
        uint256 resultLength = 0;

        for (uint256 i = 0; i < valueBytes.length; i++) {
            bytes1 char = valueBytes[i];
            if (char == "&") {
                bytes memory replacement = "&amp;";
                for (uint256 j = 0; j < replacement.length; j++) {
                    result[resultLength++] = replacement[j];
                }
            } else if (char == "<") {
                bytes memory replacement = "&lt;";
                for (uint256 j = 0; j < replacement.length; j++) {
                    result[resultLength++] = replacement[j];
                }
            } else if (char == ">") {
                bytes memory replacement = "&gt;";
                for (uint256 j = 0; j < replacement.length; j++) {
                    result[resultLength++] = replacement[j];
                }
            } else if (char == '"') {
                bytes memory replacement = "&quot;";
                for (uint256 j = 0; j < replacement.length; j++) {
                    result[resultLength++] = replacement[j];
                }
            } else if (char == "'") {
                bytes memory replacement = "&apos;";
                for (uint256 j = 0; j < replacement.length; j++) {
                    result[resultLength++] = replacement[j];
                }
            } else {
                result[resultLength++] = char;
            }
        }

        bytes memory trimmed = new bytes(resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            trimmed[i] = result[i];
        }
        return string(trimmed);
    }

    function _escapeJson(string memory value) internal pure returns (string memory) {
        bytes memory valueBytes = bytes(value);
        bytes memory result = new bytes(valueBytes.length * 2);
        uint256 resultLength = 0;

        for (uint256 i = 0; i < valueBytes.length; i++) {
            bytes1 char = valueBytes[i];
            if (char == '"' || char == "\\") {
                result[resultLength++] = "\\";
                result[resultLength++] = char;
            } else if (uint8(char) < 0x20) {
                // Control characters omitted for simplicity.
            } else {
                result[resultLength++] = char;
            }
        }

        bytes memory trimmed = new bytes(resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            trimmed[i] = result[i];
        }
        return string(trimmed);
    }
}
