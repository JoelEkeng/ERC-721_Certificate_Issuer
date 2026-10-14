"""Web3 contract interaction layer.

This module provides read-only access to the CertificateIssuer contract.
Write operations (issue, revoke) are performed by the frontend via wallet
signing — the backend never holds private keys.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from web3 import Web3
from web3.contract import Contract
from web3.exceptions import ContractLogicError

from .config import settings

logger = logging.getLogger(__name__)

# Load ABI from the Foundry build artifact
_ABI_PATH = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "out" / "CertificateIssuer.sol" / "CertificateIssuer.json"


def _load_abi() -> list[dict[str, Any]]:
    """Load the contract ABI from the Foundry compilation output."""
    if not _ABI_PATH.exists():
        raise FileNotFoundError(
            f"Contract artifact not found at {_ABI_PATH}. "
            "Run `forge build` in packages/contracts/ first."
        )
    with open(_ABI_PATH) as f:
        artifact = json.load(f)
    return artifact["abi"]


def get_web3() -> Web3:
    """Create a Web3 instance connected to the configured RPC."""
    w3 = Web3(Web3.HTTPProvider(settings.rpc_url))
    return w3


def get_contract(w3: Web3 | None = None) -> Contract:
    """Return a Contract instance bound to the configured address."""
    if w3 is None:
        w3 = get_web3()
    abi = _load_abi()
    address = Web3.to_checksum_address(settings.contract_address)
    return w3.eth.contract(address=address, abi=abi)


def get_certificate(token_id: int) -> dict[str, Any] | None:
    """
    Read certificate data from the contract using `getCertificate`.
    Returns None if the token does not exist (the contract reverts).
    """
    w3 = get_web3()
    contract = get_contract(w3)
    try:
        result = contract.functions.getCertificate(token_id).call()
        # getCertificate returns: (owner, recipientName, courseTitle, issueDate, revoked)
        owner, recipient_name, course_title, issue_date, revoked = result
        return {
            "tokenId": token_id,
            "recipientName": recipient_name,
            "courseTitle": course_title,
            "issueDate": issue_date,
            "revoked": revoked,
            "owner": owner,
            "status": "revoked" if revoked else "valid",
        }
    except ContractLogicError:
        return None
    except Exception as exc:
        if "ERC721NonexistentToken" in str(exc) or "revert" in str(exc).lower():
            return None
        raise


# Contract CertificateStatus enum: 0 = Nonexistent, 1 = Valid, 2 = Revoked
_STATUS_MAP = {0: "nonexistent", 1: "valid", 2: "revoked"}


def verify_certificate(token_id: int) -> dict[str, Any]:
    """
    Verify a certificate using the contract's `verifyCertificate` function.
    Returns a full VerificationResult including status, owner, and metadata.
    Clearly distinguishes valid, revoked, and nonexistent certificates.
    """
    w3 = get_web3()
    contract = get_contract(w3)
    result = contract.functions.verifyCertificate(token_id).call()
    # verifyCertificate returns a struct: (status, owner, recipientName, courseTitle, issueDate)
    status_enum, owner, recipient_name, course_title, issue_date = result
    status = _STATUS_MAP.get(status_enum, "nonexistent")

    if status == "nonexistent":
        return {
            "tokenId": token_id,
            "status": "nonexistent",
            "valid": False,
            "recipientName": None,
            "courseTitle": None,
            "issueDate": None,
            "owner": None,
            "revoked": None,
        }

    return {
        "tokenId": token_id,
        "status": status,
        "valid": status == "valid",
        "recipientName": recipient_name,
        "courseTitle": course_title,
        "issueDate": issue_date,
        "owner": owner,
        "revoked": status == "revoked",
    }


def get_certificate_events(from_block: int = 0) -> list[dict[str, Any]]:
    """
    Fetch CertificateIssued and CertificateRevoked events from the contract.
    Used for indexing / listing all certificates.
    """
    w3 = get_web3()
    contract = get_contract(w3)
    issued_events: list[dict[str, Any]] = []

    try:
        issued_filter = contract.events.CertificateIssued.create_filter(from_block=from_block)
        for event in issued_filter.get_all_entries():
            issued_events.append({
                "tokenId": event.args.tokenId,
                "recipient": event.args.recipient,
                "recipientName": event.args.recipientName,
                "courseTitle": event.args.courseTitle,
                "issueDate": event.args.issueDate,
                "blockNumber": event.blockNumber,
                "transactionHash": event.transactionHash.hex(),
            })
    except Exception as exc:
        logger.warning("Failed to fetch CertificateIssued events: %s", exc)

    return issued_events


def get_token_uri(token_id: int) -> str | None:
    """Fetch the on-chain tokenURI for a certificate."""
    w3 = get_web3()
    contract = get_contract(w3)
    try:
        return contract.functions.tokenURI(token_id).call()
    except (ContractLogicError, Exception):
        return None
