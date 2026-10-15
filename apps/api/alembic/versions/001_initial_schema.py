"""Initial schema — certificates, checkpoints, institutions, audit, auth.

Revision ID: 001
Revises: None
Create Date: 2024-01-01 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "certificates",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("chain_id", sa.Integer, nullable=False, index=True),
        sa.Column("contract_address", sa.String(42), nullable=False),
        sa.Column("token_id", sa.BigInteger, nullable=False, index=True),
        sa.Column("recipient_wallet", sa.String(42), nullable=False, index=True),
        sa.Column("recipient_name", sa.String(256), nullable=False),
        sa.Column("course_title", sa.String(512), nullable=False),
        sa.Column("issue_timestamp", sa.BigInteger, nullable=False),
        sa.Column("issue_tx_hash", sa.String(66), nullable=False),
        sa.Column("issue_block_number", sa.BigInteger, nullable=False),
        sa.Column("revoked", sa.Boolean, nullable=False, default=False),
        sa.Column("revoke_tx_hash", sa.String(66), nullable=True),
        sa.Column("revoke_block_number", sa.BigInteger, nullable=True),
        sa.Column(
            "last_synced_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "chain_id", "contract_address", "token_id", name="uq_certificate_identity"
        ),
    )
    op.create_index("ix_cert_search", "certificates", ["recipient_name", "course_title"])

    op.create_table(
        "indexer_checkpoints",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("chain_id", sa.Integer, nullable=False),
        sa.Column("contract_address", sa.String(42), nullable=False),
        sa.Column("last_block", sa.BigInteger, nullable=False, default=0),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("chain_id", "contract_address", name="uq_checkpoint_identity"),
    )

    op.create_table(
        "institutions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("chain_id", sa.Integer, nullable=False),
        sa.Column("contract_address", sa.String(42), nullable=False),
        sa.Column("owner_address", sa.String(42), nullable=False),
        sa.Column("name", sa.String(256), nullable=True),
        sa.Column(
            "last_verified_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("chain_id", "contract_address", name="uq_institution_identity"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("action", sa.String(64), nullable=False, index=True),
        sa.Column("actor", sa.String(42), nullable=True),
        sa.Column("detail", sa.Text, nullable=True),
        sa.Column("chain_id", sa.Integer, nullable=True),
        sa.Column("contract_address", sa.String(42), nullable=True),
        sa.Column("token_id", sa.BigInteger, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "auth_nonces",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("nonce", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean, nullable=False, default=False),
    )


def downgrade() -> None:
    op.drop_table("auth_nonces")
    op.drop_table("audit_logs")
    op.drop_table("institutions")
    op.drop_table("indexer_checkpoints")
    op.drop_index("ix_cert_search", table_name="certificates")
    op.drop_table("certificates")
