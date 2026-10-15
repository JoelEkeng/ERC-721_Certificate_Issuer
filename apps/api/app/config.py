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
    # Storage for rate limiting. Default: in-memory (per-process).
    # For multi-worker: use "redis://localhost:6379" or similar.
    rate_limit_storage_uri: str = "memory://"

    # Session token signing key. If set, used for HMAC signing.
    # If empty, a random key is generated per-startup (sessions
    # do not survive restarts). For production, set to a stable
    # base64-encoded 32+ byte secret managed outside source control.
    session_secret: str = ""

    # Debug mode — set False in production. Controls verbose error responses.
    debug: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()


def validate_settings() -> list[str]:
    """Validate settings for production readiness. Returns a list of warnings."""
    warnings: list[str] = []
    if settings.contract_address == "0x0000000000000000000000000000000000000000":
        warnings.append("CONTRACT_ADDRESS is the zero address — set it to the deployed contract")
    if settings.database_url.startswith("sqlite"):
        warnings.append("Using SQLite — use PostgreSQL for production (DATABASE_URL)")
    if not settings.session_secret:
        warnings.append("SESSION_SECRET is not set — sessions will not survive restarts")
    if settings.rate_limit_storage_uri == "memory://":
        warnings.append(
            "Rate-limit storage is in-memory — does not share across workers. "
            "Use Redis for multi-worker deployments."
        )
    if settings.cors_origins == "http://localhost:3000,http://127.0.0.1:3000":
        warnings.append("CORS_ORIGINS is set to localhost defaults — update for production")
    if settings.siwe_domain == "localhost":
        warnings.append("SIWE_DOMAIN is 'localhost' — update for production")
    if settings.indexer_confirmation_depth < 12 and settings.chain_id == 1:
        warnings.append(
            f"INDEXER_CONFIRMATION_DEPTH={settings.indexer_confirmation_depth} "
            "is low for mainnet — use >= 12"
        )
    return warnings
