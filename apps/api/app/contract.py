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
    Read certificate data from the contract.
    Returns None if the token does not exist.
    """
    w3 = get_web3()
    contract = get_contract(w3)
    try:
        # Check if token exists by calling ownerOf
        owner = contract.functions.ownerOf(token_id).call()
    except ContractLogicError:
        return None
    except Exception as exc:
        # ownerOf reverts for nonexistent tokens
        if "ERC721NonexistentToken" in str(exc) or "invalid token" in str(exc).lower():
            return None
        raise

    cert = contract.functions.certificates(token_id).call()
    is_valid = contract.functions.verifyCertificate(token_id).call()

    return {
        "tokenId": token_id,
        "recipientName": cert[0],
        "courseTitle": cert[1],
        "issueDate": cert[2],
        "revoked": cert[3],
        "owner": owner,
        "status": "valid" if is_valid else "revoked",
    }


def verify_certificate(token_id: int) -> dict[str, Any]:
    """
    Verify a certificate and return its status.
    Clearly distinguishes valid, revoked, and nonexistent certificates.
    """
    cert = get_certificate(token_id)
    if cert is None:
        return {"tokenId": token_id, "status": "nonexistent", "valid": False}
    return {
        "tokenId": cert["tokenId"],
        "status": cert["status"],
        "valid": cert["status"] == "valid",
        "recipientName": cert["recipientName"],
        "courseTitle": cert["courseTitle"],
        "issueDate": cert["issueDate"],
        "owner": cert["owner"],
        "revoked": cert["revoked"],
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
