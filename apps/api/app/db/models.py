"""SQLAlchemy ORM models for the certificate indexer."""

from __future__ import annotations

import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Shared declarative base for all models."""


class Certificate(Base):
    """Indexed certificate record — projection of on-chain state."""

    __tablename__ = "certificates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Certificate identity (unique per chain + contract + token)
    chain_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    contract_address: Mapped[str] = mapped_column(String(42), nullable=False)
    token_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)

    # Certificate data
    recipient_wallet: Mapped[str] = mapped_column(String(42), nullable=False, index=True)
    recipient_name: Mapped[str] = mapped_column(String(256), nullable=False)
    course_title: Mapped[str] = mapped_column(String(512), nullable=False)
    issue_timestamp: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Transaction metadata
    issue_tx_hash: Mapped[str] = mapped_column(String(66), nullable=False)
    issue_block_number: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Revocation state
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    revoke_tx_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    revoke_block_number: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # Sync metadata
    last_synced_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("chain_id", "contract_address", "token_id", name="uq_certificate_identity"),
        Index("ix_cert_search", "recipient_name", "course_title"),
    )


class IndexerCheckpoint(Base):
    """Persistent cursor for the event indexer — one row per chain+contract."""

    __tablename__ = "indexer_checkpoints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chain_id: Mapped[int] = mapped_column(Integer, nullable=False)
    contract_address: Mapped[str] = mapped_column(String(42), nullable=False)
    last_block: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("chain_id", "contract_address", name="uq_checkpoint_identity"),
    )


class Institution(Base):
    """Institution profile — tracks known issuer addresses."""

    __tablename__ = "institutions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chain_id: Mapped[int] = mapped_column(Integer, nullable=False)
    contract_address: Mapped[str] = mapped_column(String(42), nullable=False)
    owner_address: Mapped[str] = mapped_column(String(42), nullable=False)
    name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    last_verified_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("chain_id", "contract_address", name="uq_institution_identity"),
    )


class AuditLog(Base):
    """Administrative audit trail for backend actions."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    actor: Mapped[str | None] = mapped_column(String(42), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    chain_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contract_address: Mapped[str | None] = mapped_column(String(42), nullable=True)
    token_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class AuthNonce(Base):
    """SIWE nonce store for replay protection."""

    __tablename__ = "auth_nonces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nonce: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
