"""Security helpers: read-only SQL validation, access-key auth, and rate limiting."""
import re
import secrets
import threading
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException

from app.config import settings


class UnsafeQueryError(ValueError):
    """Raised when a SQL statement is not a single read-only query."""


# Statements that may start a permitted read-only query. DuckDB allows FROM-first syntax.
_ALLOWED_LEADING_KEYWORDS = {"select", "with", "from", "values", "describe", "summarize"}

# Keywords that modify data, touch the filesystem, load code, or change settings.
_BLOCKED_KEYWORDS = {
    "insert", "update", "delete", "merge", "upsert", "create", "drop", "alter", "truncate",
    "attach", "detach", "copy", "export", "import", "install", "load", "pragma", "set",
    "reset", "call", "checkpoint", "vacuum", "begin", "commit", "rollback", "transaction",
    "use", "grant", "revoke", "execute", "prepare", "deallocate", "secret",
}

# Table functions that read files or external systems.
_BLOCKED_FUNCTION_PATTERN = re.compile(
    r"\b(read_\w+|parquet_\w+|sniff_csv|glob|delta_scan|iceberg_\w+|sqlite_\w+|"
    r"postgres_\w+|mysql_\w+|duckdb_secrets|query_table|query)\s*\(",
    re.IGNORECASE,
)

_COMMENT_PATTERN = re.compile(r"--[^\n]*|/\*.*?\*/", re.DOTALL)
_STRING_PATTERN = re.compile(r"'(?:[^']|'')*'")
_IDENTIFIER_PATTERN = re.compile(r'"(?:[^"]|"")*"')
# A string literal directly after FROM/JOIN is a DuckDB "replacement scan" of a file path.
_FILE_SCAN_PATTERN = re.compile(r"\b(from|join)\s*\(?\s*'", re.IGNORECASE)


def validate_read_only_sql(sql: str) -> str:
    """Returns the cleaned query if it is a single read-only statement, else raises."""
    if not sql or not sql.strip():
        raise UnsafeQueryError("SQL query is empty.")
    if len(sql) > settings.MAX_SQL_LENGTH:
        raise UnsafeQueryError(f"SQL query exceeds {settings.MAX_SQL_LENGTH} characters.")

    no_comments = _COMMENT_PATTERN.sub(" ", sql)

    # Detect file scans while string literals are still visible.
    if _FILE_SCAN_PATTERN.search(_IDENTIFIER_PATTERN.sub('"x"', no_comments)):
        raise UnsafeQueryError("Reading files by path is not allowed. Query the loaded tables instead.")

    # Remove literals and quoted identifiers so their contents cannot trigger false matches.
    scrubbed = _STRING_PATTERN.sub("''", no_comments)
    scrubbed = _IDENTIFIER_PATTERN.sub('"x"', scrubbed)
    scrubbed = scrubbed.strip().rstrip(";").strip()

    if ";" in scrubbed:
        raise UnsafeQueryError("Only one SQL statement can be run at a time.")
    if not scrubbed:
        raise UnsafeQueryError("SQL query is empty.")

    first_word = re.match(r"\(*\s*([a-zA-Z_]+)", scrubbed)
    if not first_word or first_word.group(1).lower() not in _ALLOWED_LEADING_KEYWORDS:
        raise UnsafeQueryError("Only read-only SELECT queries are allowed.")

    words = {w.lower() for w in re.findall(r"\b[a-zA-Z_]+\b", scrubbed)}
    blocked = sorted(words & _BLOCKED_KEYWORDS)
    if blocked:
        raise UnsafeQueryError(
            f"Statement keyword '{blocked[0].upper()}' is not allowed. Only read-only SELECT queries can run."
        )

    fn_match = _BLOCKED_FUNCTION_PATTERN.search(scrubbed)
    if fn_match:
        raise UnsafeQueryError(f"Function '{fn_match.group(1)}' is not allowed.")

    # Return the original text minus trailing semicolons/whitespace.
    return sql.strip().rstrip(";").strip()


async def require_access_key(x_api_key: str | None = Header(default=None)) -> None:
    """FastAPI dependency. Enforces X-API-Key when APP_ACCESS_KEY is configured."""
    expected = settings.APP_ACCESS_KEY
    if not expected:
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid access key. Enter the access key in Settings.",
        )


class SlidingWindowRateLimiter:
    """In-memory per-key sliding-window limiter (single-process deployments)."""

    def __init__(self, window_seconds: float = 60.0):
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int) -> tuple[bool, int]:
        """Records a hit. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= limit:
                retry_after = int(self.window - (now - hits[0])) + 1
                return False, max(retry_after, 1)
            hits.append(now)
            if len(self._hits) > 10_000:
                for stale_key in [k for k, v in self._hits.items() if not v]:
                    del self._hits[stale_key]
            return True, 0


rate_limiter = SlidingWindowRateLimiter()


def rate_limit_for_path(path: str) -> int | None:
    """Returns the per-minute limit for a request path, or None if exempt."""
    if not path.startswith("/api/") or path == "/api/health":
        return None
    if path.startswith("/api/chat"):
        return settings.RATE_LIMIT_CHAT_PER_MIN
    if path.startswith("/api/upload"):
        return settings.RATE_LIMIT_UPLOAD_PER_MIN
    if path.startswith("/api/query/sql"):
        return settings.RATE_LIMIT_SQL_PER_MIN
    return settings.RATE_LIMIT_DEFAULT_PER_MIN
