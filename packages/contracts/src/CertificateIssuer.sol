// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import "openzeppelin-contracts/contracts/utils/Strings.sol";
import "openzeppelin-contracts/contracts/utils/Base64.sol";

/**
 * @title CertificateIssuer
 * @dev A soulbound ERC-721 contract that issues on-chain certificates of completion.
 *      Certificates cannot be transferred or sold after minting, ensuring they remain
 *      tied to the original recipient. The contract owner (institution) can issue and
 *      revoke certificates.
 *
 *      Soulbound enforcement: all external transfer, approval, and operator-approval
 *      functions revert with `NonTransferable()`. The internal `_update` hook is NOT
 *      overridden because `_safeMint` calls `_update` internally — blocking it there
 *      would prevent minting. Instead, every public entry point that could move a
 *      token is sealed, which is correct for OpenZeppelin v5.x where `transferFrom`
 *      and `safeTransferFrom` are the only external paths through `_update`.
 *
 *      Ownership uses OpenZeppelin Ownable2Step: transferring ownership requires
 *      the new owner to call `acceptOwnership()`, preventing accidental transfers
 *      to incorrect addresses. Renunciation is disabled. If the owner role is
 *      lost, no further certificates can be issued or revoked.
 *
 *      On-chain metadata: `tokenURI` returns a Base64-encoded JSON blob with an
 *      embedded SVG certificate image. Recipient name and course title are escaped
 *      for both XML (SVG) and JSON contexts. Certificate struct fields (recipientName,
 *      courseTitle, issueDate) are permanently immutable once written — the contract
 *      provides no update function. Only the `revoked` flag can change (set, never
 *      cleared).
 */
contract CertificateIssuer is ERC721, Ownable2Step {
    using Strings for uint256;
    using Strings for address;

    // --- Constants ---

    /// @notice Maximum byte length for recipient name (on-chain storage cost guard).
    uint256 public constant MAX_NAME_LENGTH = 128;

    /// @notice Maximum byte length for course title (on-chain storage cost guard).
    uint256 public constant MAX_COURSE_TITLE_LENGTH = 256;

    // --- Types ---

    struct Certificate {
        string recipientName;
        string courseTitle;
        uint256 issueDate;
        bool revoked;
    }

    /// @notice Verification status returned by `verifyCertificate`.
    enum CertificateStatus {
        Nonexistent,
        Valid,
        Revoked
    }

    /// @notice Full verification result for a certificate.
    struct VerificationResult {
        CertificateStatus status;
        address owner;
        string recipientName;
        string courseTitle;
        uint256 issueDate;
    }

    // --- State ---

    uint256 private _nextTokenId;
    mapping(uint256 => Certificate) public certificates;

    // --- Events ---

    event CertificateIssued(
        uint256 indexed tokenId, address indexed recipient, string recipientName, string courseTitle, uint256 issueDate
    );

    event CertificateRevoked(uint256 indexed tokenId);

    // --- Errors ---

    error EmptyRecipientName();
    error EmptyCourseTitle();
    error RecipientNameTooLong(uint256 length, uint256 maxLength);
    error CourseTitleTooLong(uint256 length, uint256 maxLength);
    error InvalidRecipient();
    error CertificateNonExistent();
    error CertificateAlreadyRevoked();
    error NonTransferable();
    error OwnershipRenunciationDisabled();

    // --- Constructor ---

    constructor(string memory name, string memory symbol) ERC721(name, symbol) Ownable(msg.sender) {}

    // --- Core operations ---

    /**
     * @notice Issue a new certificate to a recipient.
     * @dev Only the contract owner (institution) can call this. The function is atomic:
     *      if any validation or minting step fails, no state changes persist.
     * @param recipient The address that will receive the certificate.
     * @param recipientName The name of the certificate recipient. Must be non-empty,
     *        not whitespace-only, and at most MAX_NAME_LENGTH bytes.
     * @param courseTitle The title of the completed course. Must be non-empty,
     *        not whitespace-only, and at most MAX_COURSE_TITLE_LENGTH bytes.
     * @return tokenId The ID of the newly minted certificate.
     */
    function issueCertificate(address recipient, string memory recipientName, string memory courseTitle)
        public
        onlyOwner
        returns (uint256)
    {
        if (recipient == address(0)) revert InvalidRecipient();
        _validateString(recipientName, MAX_NAME_LENGTH, true);
        _validateString(courseTitle, MAX_COURSE_TITLE_LENGTH, false);

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
     * @notice Retrieve full certificate details including the current owner.
     * @dev Reverts with ERC721NonexistentToken if the token does not exist.
     * @param tokenId The certificate token ID.
     * @return owner The current holder of the certificate NFT.
     * @return recipientName The name stored at issuance.
     * @return courseTitle The course title stored at issuance.
     * @return issueDate The block.timestamp at issuance.
     * @return revoked Whether the certificate has been revoked.
     */
    function getCertificate(uint256 tokenId)
        public
        view
        returns (address owner, string memory recipientName, string memory courseTitle, uint256 issueDate, bool revoked)
    {
        owner = _requireOwned(tokenId);
        Certificate memory cert = certificates[tokenId];
        return (owner, cert.recipientName, cert.courseTitle, cert.issueDate, cert.revoked);
    }

    /**
     * @notice Verify whether a certificate is authentic, revoked, or nonexistent.
     * @dev Does not revert for nonexistent tokens — returns Nonexistent status instead.
     *      This allows callers to distinguish the three states without try/catch.
     * @param tokenId The certificate token ID to verify.
     * @return result A VerificationResult struct containing:
     *         - status: Nonexistent, Valid, or Revoked
     *         - owner: the current holder (address(0) if nonexistent)
     *         - recipientName, courseTitle, issueDate: certificate data (empty/0 if nonexistent)
     */
    function verifyCertificate(uint256 tokenId) public view returns (VerificationResult memory result) {
        address tokenOwner = _ownerOf(tokenId);

        if (tokenOwner == address(0)) {
            result.status = CertificateStatus.Nonexistent;
            return result;
        }

        Certificate memory cert = certificates[tokenId];
        result.owner = tokenOwner;
        result.recipientName = cert.recipientName;
        result.courseTitle = cert.courseTitle;
        result.issueDate = cert.issueDate;

        if (cert.revoked) {
            result.status = CertificateStatus.Revoked;
        } else {
            result.status = CertificateStatus.Valid;
        }
    }

    /**
     * @notice Revoke an existing certificate, e.g. in case of fraud or error.
     * @dev Only the contract owner can revoke. Revocation is permanent — the flag
     *      can be set but never cleared. The NFT is not burned; historical data and
     *      ownership are preserved. Verification will immediately reflect the change.
     * @param tokenId The certificate token ID to revoke.
     */
    function revoke(uint256 tokenId) public onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert CertificateNonExistent();
        if (certificates[tokenId].revoked) revert CertificateAlreadyRevoked();

        certificates[tokenId].revoked = true;
        emit CertificateRevoked(tokenId);
    }

    /**
     * @notice Returns the total number of certificates ever issued (including revoked).
     * @dev Since token IDs are sequential starting from 0, this also equals the next
     *      token ID that will be assigned.
     */
    function totalIssued() public view returns (uint256) {
        return _nextTokenId;
    }

    // --- Soulbound / non-transferable overrides ---

    /// @dev Disabled. Certificates are soulbound — approvals serve no purpose.
    function approve(address, uint256) public virtual override {
        revert NonTransferable();
    }

    /// @dev Disabled. Certificates are soulbound — operator approvals serve no purpose.
    function setApprovalForAll(address, bool) public virtual override {
        revert NonTransferable();
    }

    /// @dev Disabled. Certificates are non-transferable after minting.
    function transferFrom(address, address, uint256) public virtual override {
        revert NonTransferable();
    }

    /**
     * @dev Disabled. Certificates are non-transferable after minting.
     *      The 3-argument `safeTransferFrom(from, to, tokenId)` in OZ v5 delegates
     *      to this 4-argument version, so both are blocked by this single override.
     */
    function safeTransferFrom(address, address, uint256, bytes memory) public virtual override {
        revert NonTransferable();
    }

    // --- Ownership ---

    /**
     * @dev Prevents renouncing ownership. Losing the issuer role would permanently
     *      prevent new certificate issuance and revocation, which is almost certainly
     *      not the intended behavior. Use `transferOwnership` instead.
     */
    function renounceOwnership() public view override onlyOwner {
        revert OwnershipRenunciationDisabled();
    }

    // --- On-chain metadata ---

    /**
     * @notice Returns the on-chain JSON metadata for a certificate, including a generated SVG image.
     * @dev The SVG contains: certificate heading, recipient name, course title, token ID,
     *      issue date, and status. User-provided text is escaped for both XML and JSON.
     *      Reverts with ERC721NonexistentToken for nonexistent tokens.
     *
     *      Immutable fields: name, description, image layout, course, recipient, issue date.
     *      Mutable via revocation only: the "Status" attribute and the status line in the SVG.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireOwned(tokenId);

        Certificate memory cert = certificates[tokenId];
        string memory status = cert.revoked ? "REVOKED" : "VALID";
        string memory statusColor = cert.revoked ? "#c0392b" : "#27ae60";
        string memory escapedName = _escapeXml(cert.recipientName);
        string memory escapedCourse = _escapeXml(cert.courseTitle);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
            '<rect width="800" height="600" fill="#f8f1dc" stroke="#c9a227" stroke-width="10"/>',
            '<rect x="30" y="30" width="740" height="540" fill="none" stroke="#c9a227" stroke-width="2"/>',
            '<text x="400" y="90" font-family="serif" font-size="36" text-anchor="middle" fill="#333" font-weight="bold">Certificate of Completion</text>',
            '<line x1="200" y1="110" x2="600" y2="110" stroke="#c9a227" stroke-width="2"/>',
            '<text x="400" y="170" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#555">This certifies that</text>',
            '<text x="400" y="220" font-family="serif" font-size="32" text-anchor="middle" fill="#1a1a1a" font-weight="bold">',
            escapedName,
            "</text>",
            '<text x="400" y="280" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#555">has successfully completed</text>',
            '<text x="400" y="330" font-family="serif" font-size="28" text-anchor="middle" fill="#1a1a1a" font-weight="bold">',
            escapedCourse,
            "</text>"
        );

        svg = string.concat(
            svg,
            '<text x="400" y="400" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#777">Certificate #',
            tokenId.toString(),
            "</text>",
            '<text x="400" y="430" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#777">Issued: ',
            _formatTimestamp(cert.issueDate),
            "</text>",
            '<text x="400" y="500" font-family="sans-serif" font-size="22" text-anchor="middle" fill="',
            statusColor,
            '" font-weight="bold">',
            status,
            "</text>",
            "</svg>"
        );

        string memory json = string.concat(
            '{"name":"Certificate #',
            tokenId.toString(),
            '","description":"On-chain soulbound certificate of completion issued by ',
            _escapeJson(name()),
            '","attributes":[{"trait_type":"Recipient","value":"',
            _escapeJson(cert.recipientName),
            '"},{"trait_type":"Course","value":"',
            _escapeJson(cert.courseTitle),
            '"},{"trait_type":"Issue Date","display_type":"date","value":',
            cert.issueDate.toString(),
            '},{"trait_type":"Status","value":"',
            status,
            '"},{"trait_type":"Token ID","display_type":"number","value":',
            tokenId.toString(),
            '}],"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    // --- Internal helpers ---

    /**
     * @dev Validates a string input: checks for empty, whitespace-only, and max length.
     * @param value The string to validate.
     * @param maxLen The maximum byte length allowed.
     * @param isName True if this is a recipient name (for error selection).
     */
    function _validateString(string memory value, uint256 maxLen, bool isName) internal pure {
        bytes memory b = bytes(value);

        if (b.length == 0) {
            if (isName) revert EmptyRecipientName();
            revert EmptyCourseTitle();
        }

        if (b.length > maxLen) {
            if (isName) revert RecipientNameTooLong(b.length, maxLen);
            revert CourseTitleTooLong(b.length, maxLen);
        }

        // Check for whitespace-only strings (ASCII spaces, tabs, newlines, carriage returns)
        bool hasNonWhitespace = false;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c != 0x20 && c != 0x09 && c != 0x0a && c != 0x0d) {
                hasNonWhitespace = true;
                break;
            }
        }

        if (!hasNonWhitespace) {
            if (isName) revert EmptyRecipientName();
            revert EmptyCourseTitle();
        }
    }

    /**
     * @dev Escapes XML special characters for safe SVG embedding.
     *      Handles: & < > " '
     */
    function _escapeXml(string memory value) internal pure returns (string memory) {
        bytes memory valueBytes = bytes(value);
        // Worst case: every char becomes 6 bytes (&quot; is longest at 6)
        bytes memory result = new bytes(valueBytes.length * 6);
        uint256 resultLength = 0;

        for (uint256 i = 0; i < valueBytes.length; i++) {
            bytes1 char = valueBytes[i];
            if (char == "&") {
                result[resultLength++] = "&";
                result[resultLength++] = "a";
                result[resultLength++] = "m";
                result[resultLength++] = "p";
                result[resultLength++] = ";";
            } else if (char == "<") {
                result[resultLength++] = "&";
                result[resultLength++] = "l";
                result[resultLength++] = "t";
                result[resultLength++] = ";";
            } else if (char == ">") {
                result[resultLength++] = "&";
                result[resultLength++] = "g";
                result[resultLength++] = "t";
                result[resultLength++] = ";";
            } else if (char == '"') {
                result[resultLength++] = "&";
                result[resultLength++] = "q";
                result[resultLength++] = "u";
                result[resultLength++] = "o";
                result[resultLength++] = "t";
                result[resultLength++] = ";";
            } else if (char == "'") {
                result[resultLength++] = "&";
                result[resultLength++] = "a";
                result[resultLength++] = "p";
                result[resultLength++] = "o";
                result[resultLength++] = "s";
                result[resultLength++] = ";";
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

    /**
     * @dev Escapes special characters for safe JSON string embedding.
     *      Handles: backslash, double quote, and control characters (< 0x20).
     *      Control characters are encoded as \uXXXX.
     */
    function _escapeJson(string memory value) internal pure returns (string memory) {
        bytes memory valueBytes = bytes(value);
        // Worst case: every char becomes 6 bytes (\uXXXX)
        bytes memory result = new bytes(valueBytes.length * 6);
        uint256 resultLength = 0;

        for (uint256 i = 0; i < valueBytes.length; i++) {
            bytes1 char = valueBytes[i];
            if (char == '"') {
                result[resultLength++] = "\\";
                result[resultLength++] = '"';
            } else if (char == "\\") {
                result[resultLength++] = "\\";
                result[resultLength++] = "\\";
            } else if (uint8(char) < 0x20) {
                // Encode control characters as \uXXXX
                result[resultLength++] = "\\";
                result[resultLength++] = "u";
                result[resultLength++] = "0";
                result[resultLength++] = "0";
                result[resultLength++] = _hexChar(uint8(char) >> 4);
                result[resultLength++] = _hexChar(uint8(char) & 0x0f);
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

    /// @dev Returns the hex character for a nibble (0-15).
    function _hexChar(uint8 nibble) internal pure returns (bytes1) {
        if (nibble < 10) return bytes1(nibble + 0x30); // '0'-'9'
        return bytes1(nibble + 0x57); // 'a'-'f'
    }

    /// @dev Formats a Unix timestamp as a YYYY-MM-DD string for the SVG.
    ///      Uses a simplified civil calendar conversion.
    function _formatTimestamp(uint256 timestamp) internal pure returns (string memory) {
        // Days since epoch
        uint256 z = timestamp / 86400 + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 d = doy - (153 * mp + 2) / 5 + 1;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) y += 1;

        return string.concat(
            y.toString(),
            "-",
            m < 10 ? string.concat("0", m.toString()) : m.toString(),
            "-",
            d < 10 ? string.concat("0", d.toString()) : d.toString()
        );
    }
}
