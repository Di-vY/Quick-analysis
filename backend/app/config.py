from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = (BASE_DIR / "uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Explicitly load .env from BASE_DIR if present
load_dotenv(BASE_DIR / ".env")
load_dotenv()


class Settings(BaseSettings):
    APP_NAME: str = "Quick Analysis API"

    # --- AI provider ---
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"

    # --- CORS ---
    # Comma-separated list of exact frontend origins allowed in production,
    # e.g. "https://my-app.vercel.app,https://www.example.com". No wildcards.
    FRONTEND_URL: str = ""
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://racing-krypton-xyk3apu-divykamalpuria04-gmailcoms-projects.vercel.app",
        "https://racing-krypton-xyk3apu-pz3uvcpej.vercel.app",
    ]

    # --- Access control ---
    # When set, every /api route except /api/health requires the header
    # `X-API-Key: <APP_ACCESS_KEY>`. Leave empty for local development only.
    APP_ACCESS_KEY: str = ""

    # --- Upload limits ---
    MAX_UPLOAD_MB: int = 50
    MAX_TABLES: int = 10

    # --- DuckDB resource limits ---
    DUCKDB_MEMORY_LIMIT: str = "1GB"
    DUCKDB_THREADS: int = 2
    QUERY_TIMEOUT_SECONDS: float = 15.0
    MAX_SQL_LENGTH: int = 10_000

    # --- Rate limits (requests per minute per client IP) ---
    RATE_LIMIT_CHAT_PER_MIN: int = 20
    RATE_LIMIT_UPLOAD_PER_MIN: int = 10
    RATE_LIMIT_SQL_PER_MIN: int = 60
    RATE_LIMIT_DEFAULT_PER_MIN: int = 120

    # --- API docs ---
    ENABLE_API_DOCS: bool = True

    model_config = SettingsConfigDict(
        env_file=(str(BASE_DIR / ".env"), ".env"),
        extra="ignore",
    )

    def cors_origins(self) -> list[str]:
        origins = list(self.ALLOWED_ORIGINS)
        for origin in self.FRONTEND_URL.split(","):
            origin = origin.strip().rstrip("/")
            if origin and origin not in origins:
                origins.append(origin)
        return origins


settings = Settings()
