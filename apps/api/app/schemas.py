"""Pydantic schemas for API request/response validation."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CertificateResponse(BaseModel):
    """Full certificate details."""
    token_id: int = Field(alias="tokenId")
    recipient_name: str = Field(alias="recipientName")
    course_title: str = Field(alias="courseTitle")
    issue_date: int = Field(alias="issueDate")
    revoked: bool
    owner: str
    status: str  # "valid" | "revoked"

    model_config = {"populate_by_name": True}


class VerifyResponse(BaseModel):
    """Certificate verification result."""
    token_id: int = Field(alias="tokenId")
    status: str  # "valid" | "revoked" | "nonexistent"
    valid: bool
    recipient_name: str | None = Field(None, alias="recipientName")
    course_title: str | None = Field(None, alias="courseTitle")
    issue_date: int | None = Field(None, alias="issueDate")
    owner: str | None = None
    revoked: bool | None = None

    model_config = {"populate_by_name": True}


class CertificateEvent(BaseModel):
    """A certificate issuance event from the blockchain."""
    token_id: int = Field(alias="tokenId")
    recipient: str
    recipient_name: str = Field(alias="recipientName")
    course_title: str = Field(alias="courseTitle")
    issue_date: int = Field(alias="issueDate")
    block_number: int = Field(alias="blockNumber")
    transaction_hash: str = Field(alias="transactionHash")

    model_config = {"populate_by_name": True}


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    chain_id: int
    contract_address: str
    rpc_connected: bool
