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

    # CORS origins allowed (comma-separated in env, parsed below)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # API host/port
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
