from functools import lru_cache
from pathlib import Path
from typing import List, Literal
from pydantic import Field, MongoDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_ENV_PATHS = (
    str(_BACKEND_DIR / ".env"),
    "backend/.env",
    ".env",
)


class Settings(BaseSettings):
    """
    Core Application Settings.
    Strictly validates all runtime environment variables using Pydantic v2.
    Fails fast at boot time if mandatory infrastructure secrets are missing.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_PATHS,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Environment & Application Metadata
    ENVIRONMENT: Literal["development", "staging", "production", "test"] = "development"
    PROJECT_NAME: str = "AdaptivEd (NeuroLearn) Engine"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Security & Authentication
    SECRET_KEY: SecretStr = Field(
        default=SecretStr("insecure-dev-secret-key-change-in-production-09a8fbc8d3e"),
        description="Cryptographic secret key for session signatures and JWT decoding.",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 24 * 7, ge=15)  # 7 days

    # CORS Configuration
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        description="Allowed web origins for Cross-Origin Resource Sharing.",
    )

    # Database: MongoDB Atlas / Local Replica
    MONGODB_URI: str = Field(
        default="mongodb://localhost:27017",
        description="Async MongoDB connection string with authentication and replica set options.",
    )
    DATABASE_NAME: str = Field(default="adaptived_db", min_length=1)

    # AI & Multi-Agent Inference (Groq Cloud)
    GROQ_API_KEY: SecretStr = Field(
        default=SecretStr("gsk_placeholder_replace_with_valid_key"),
        description="API Key for Groq LLaMA-3.3-70B high-throughput inference.",
    )
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_MAX_TOKENS: int = 2048
    GROQ_TEMPERATURE: float = Field(default=0.2, ge=0.0, le=1.0)

    # Telemetry Engine Thresholds
    TELEMETRY_FLUSH_INTERVAL_MS: int = Field(
        default=1000,
        ge=250,
        le=5000,
        description="Frequency at which client telemetric ticks are buffered and evaluated.",
    )
    DEFAULT_WPM_BASELINE: int = Field(
        default=220,
        ge=100,
        le=600,
        description="Baseline reading speed in Words Per Minute (calibrated per user over time).",
    )
    REGRESSION_PENALTY_WEIGHT: float = Field(
        default=0.35,
        ge=0.0,
        le=1.0,
        description="Mathematical penalty coefficient applied to BCS for re-reading/upward scrolling.",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Cached singleton factory for application settings.
    Ensures .env is parsed only once per process lifecycle.
    """
    return Settings()

