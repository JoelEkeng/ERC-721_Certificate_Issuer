"""Application configuration loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Backend settings — all values can be set via environment variables or .env file."""

    # Blockchain RPC endpoint (Anvil default for local dev)
    rpc_url: str = "http://127.0.0.1:8545"

    # Deployed CertificateIssuer contract address
    contract_address: str = "0x0000000000000000000000000000000000000000"

    # Chain ID (31337 = Anvil local)
    chain_id: int = 31337

    # Database URL — defaults to local SQLite for development.
    # Production: postgresql+asyncpg://user:pass@host/db
    database_url: str = "sqlite+aiosqlite:///./certificates.db"

    # CORS origins allowed (comma-separated in env, parsed below)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # API host/port
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Indexer settings
    indexer_poll_interval: int = 5  # seconds between polls
    indexer_block_batch_size: int = 2000  # blocks per getLogs call
    indexer_confirmation_depth: int = 1  # blocks to wait for finality (1 for Anvil)
    indexer_max_retries: int = 5
    indexer_backoff_base: float = 1.5  # exponential backoff base seconds

    # SIWE auth
    siwe_domain: str = "localhost"
    siwe_uri: str = "http://localhost:3000"
    siwe_nonce_ttl: int = 300  # seconds

    # Rate limiting
    rate_limit_per_minute: int = 60

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
