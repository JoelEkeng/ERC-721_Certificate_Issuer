"""Pydantic schemas for API request/response validation."""

from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response."""

    status: str  # "ok" | "degraded" | "error"
    chain_id: int
    contract_address: str
    rpc_connected: bool
    database_connected: bool
    indexer_block: int | None = None


class CertificateResponse(BaseModel):
    """Full certificate details from the index."""

    token_id: int
    chain_id: int
    contract_address: str
    recipient_wallet: str
    recipient_name: str
    course_title: str
    issue_timestamp: int
    issue_tx_hash: str
    issue_block_number: int
    revoked: bool
    revoke_tx_hash: str | None = None
    revoke_block_number: int | None = None
    # Indexed data is provisional — always verify on-chain
    data_source: str = "indexed"


class CertificateSearchResponse(BaseModel):
    """Paginated certificate search results."""

    results: list[CertificateResponse]
    total: int
    page: int
    page_size: int


class VerifyResponse(BaseModel):
    """On-chain verification result — authoritative."""

    token_id: int
    status: str  # "valid" | "revoked" | "nonexistent" | "unavailable"
    valid: bool
    recipient_name: str | None = None
    course_title: str | None = None
    issue_date: int | None = None
    owner: str | None = None
    revoked: bool | None = None
    data_source: str = "on-chain"


class InstitutionResponse(BaseModel):
    """Institution profile from the index."""

    chain_id: int
    contract_address: str
    owner_address: str
    name: str | None = None
    certificates_issued: int = 0


class TransactionResponse(BaseModel):
    """Transaction lookup result from the index."""

    tx_hash: str
    block_number: int
    chain_id: int
    contract_address: str
    event_type: str  # "issuance" | "revocation"
    token_id: int


class AuditLogResponse(BaseModel):
    """Audit log entry."""

    action: str
    actor: str | None = None
    detail: str | None = None
    created_at: str


class ErrorResponse(BaseModel):
    """Structured API error."""

    detail: str
    code: str | None = None
