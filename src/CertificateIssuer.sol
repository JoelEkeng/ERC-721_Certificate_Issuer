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

     enum CertificateType {
            CertificateOfCompletion,
            CertificateOfAchievement,
            CertificateOfExcellence,
            CertificateOfParticipation,
            CertificateOfMerit,
            CertificateOfRecognition,
            CertificateOfDistinction,
            CertificateOfHonor,
            CertificateOfProficiency,
            CertificateOfCompetence,
            CertificateOfMastery,
            CertificateOfGraduation,
            CertificateOfAccomplishment,
            CertificateOfSuccess,
            CertificateOfCompletionWithDistinction,
            CertificateOfCompletionWithHonors
        }

    struct Certificate {
        string recipientName;
        string courseTitle;
        CertificateType certType;
        uint256 issueDate;
        bool revoked;
        
       
    }

    uint256 private _nextTokenId;

    mapping(uint256 => Certificate) public certificates;

    event CertificateIssued(
        uint256 indexed tokenId, address indexed recipient, string recipientName, string courseTitle, CertificateType certificateType,uint256 issueDate
    );

    event CertificateRevoked(uint256 indexed tokenId);
    event CertificateisValid(uint256 indexed tokenId);

    error EmptyRecipientName();
    error EmptyCourseTitle();
    error InvalidRecipient();
    error CertificateNonExistent();
    error CertificateAlreadyRevoked();
    error NonTransferable();
    error recipientNameTooLong();

    constructor(string memory name, string memory symbol) ERC721(name, symbol) Ownable(msg.sender) {}

    /**
     * @notice Issue a new certificate to a recipient.
     * @param recipient The address that will receive the certificate.
     * @param recipientName The name of the certificate recipient.
     * @param courseTitle The title of the completed course.
     * @param certType The type of the certificate.
     * @return tokenId The ID of the newly minted certificate.
     */
    function issueCertificate(address recipient, string memory recipientName, string memory courseTitle, CertificateType certType)
        public
        onlyOwner
        returns (uint256)
    {
        if (bytes(recipientName).length == 0) revert EmptyRecipientName();
        if (bytes(courseTitle).length == 0) revert EmptyCourseTitle();
        if (bytes(recipientName).length > 100) revert recipientNameTooLong();
        if (recipient == address(0)) revert InvalidRecipient();

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        certificates[tokenId] = Certificate({
            recipientName: recipientName, courseTitle: courseTitle, certType: certType, issueDate: block.timestamp, revoked: false
        });

        _safeMint(recipient, tokenId);

        emit CertificateIssued(tokenId, recipient, recipientName, courseTitle, certType, block.timestamp);
        return tokenId;
    }

   /**
 * @notice Verifies whether a certificate exists and returns its details.
 * @param tokenId The ID of the certificate to verify.
 * @return exists True if the certificate exists.
 * @return certificate The certificate details, including its revocation status.
 */

    function verifyCertificate(uint256 tokenId)
    public
    view
    returns (bool exists, Certificate memory certificate)
{
    if (_ownerOf(tokenId) == address(0)) {
        return (false, certificate);
    }

    return (true, certificates[tokenId]);
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
        string memory certTypeName = _certificateTypeToString(cert.certType);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
            '<rect width="800" height="600" fill="#f8f1dc" stroke="#ff0000" stroke-width="10"/>',
            '<text x="400" y="100" font-family="serif" font-size="40" text-anchor="middle" fill="#333">',
            certTypeName,
            "</text>",
            '<text x="400" y="200" font-family="sans-serif" font-size="28" text-anchor="middle" fill="#555">This certifies that</text>',
            '<text x="400" y="260" font-family="serif" font-size="36" text-anchor="middle" fill="#000">',
            _escapeXml(cert.recipientName),
            "</text>",
            '<text x="400" y="320" font-family="sans-serif" font-size="24" text-anchor="middle" fill="#555">was one of the students of </text>',
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
            '"description":"On-chain certificate issued by this institution",',
            '"attributes":[',
            '{"trait_type":"Recipient","value":"',
            _escapeJson(cert.recipientName),
            '"},',
            '{"trait_type":"Course","value":"',
            _escapeJson(cert.courseTitle),
            '"},',
            '{"trait_type":"Certificate-Type","value":"',
            _escapeJson(_certificateTypeToString(cert.certType)),
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

    function _certificateTypeToString(
    CertificateType certType
) internal pure returns (string memory) {
    if (certType == CertificateType.CertificateOfCompletion)
        return "Certificate of Completion";

    if (certType == CertificateType.CertificateOfAchievement)
        return "Certificate of Achievement";

    if (certType == CertificateType.CertificateOfExcellence)
        return "Certificate of Excellence";

    if (certType == CertificateType.CertificateOfParticipation)
        return "Certificate of Participation";

    if (certType == CertificateType.CertificateOfMerit)
        return "Certificate of Merit";

    if (certType == CertificateType.CertificateOfRecognition)
        return "Certificate of Recognition";

    if (certType == CertificateType.CertificateOfDistinction)
        return "Certificate of Distinction";

    if (certType == CertificateType.CertificateOfHonor)
        return "Certificate of Honor";

    if (certType == CertificateType.CertificateOfProficiency)
        return "Certificate of Proficiency";

    if (certType == CertificateType.CertificateOfCompetence)
        return "Certificate of Competence";

    if (certType == CertificateType.CertificateOfMastery)
        return "Certificate of Mastery";

    if (certType == CertificateType.CertificateOfGraduation)
        return "Certificate of Graduation";

    if (certType == CertificateType.CertificateOfAccomplishment)
        return "Certificate of Accomplishment";

    if (certType == CertificateType.CertificateOfSuccess)
        return "Certificate of Success";

    if (certType == CertificateType.CertificateOfCompletionWithDistinction)
        return "Certificate of Completion With Distinction";

    if (certType == CertificateType.CertificateOfCompletionWithHonors)
        return "Certificate of Completion With Honors";

    return "Unknown Certificate Type";
}
}
