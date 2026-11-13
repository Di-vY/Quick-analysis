"""Security regression tests (sandbox-safe, runs without socket-based TestClient).
Run from backend/: venv\\Scripts\\python.exe -m tests.test_security
"""
import io
import uuid
from pathlib import Path


def _run(coro):
    """Runs a coroutine that awaits only in-memory operations without creating an asyncio socketpair."""
    try:
        while True:
            coro.send(None)
    except StopIteration as stop:
        return stop.value

import httpx
from fastapi import HTTPException, UploadFile

from app.api.routes import _safe_display_name, execute_raw_sql, upload_dataset
from app.config import UPLOAD_DIR, settings
from app.core import llm as llm_module
from app.core.db import dataset_manager
from app.core.security import (
    UnsafeQueryError,
    rate_limiter,
    require_access_key,
    validate_read_only_sql,
)
from app.models.schemas import SqlQueryRequest

SAMPLE_CSV = (
    "Order_ID,Region,Sales,Profit\n"
    "1,West,100.5,10\n2,East,200,20\n3,West,50,-5\n"
)


def _reset_limits():
    rate_limiter._hits.clear()


class _MemoryUploadFile:
    """In-memory UploadFile test double whose async read avoids anyio worker threads."""

    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.file = io.BytesIO(content)

    async def read(self, size: int = -1) -> bytes:
        return self.file.read(size)


def _make_upload(filename: str, content: bytes) -> UploadFile:
    return _MemoryUploadFile(filename=filename, content=content)  # type: ignore[return-value]


# ---------------------------------------------------------------- SQL validator
def test_validator_allows_read_only_queries():
    allowed = [
        "SELECT * FROM data_table",
        "select Region, sum(Sales) from data_table group by 1;",
        "WITH t AS (SELECT * FROM data_table) SELECT count(*) FROM t",
        'SELECT "Copy", "Delete_Flag" FROM data_table',
        "SELECT * FROM data_table WHERE Region = 'drop; table'",
        "FROM data_table SELECT Region",
        "SELECT a.Region FROM sales_data a JOIN region_targets b ON a.Region = b.Region",
        "SELECT replace(Region, 'W', 'w') FROM data_table -- trailing comment",
    ]
    for sql in allowed:
        validate_read_only_sql(sql)
    print("PASS: Validator allows legitimate read-only queries")


def test_validator_blocks_dangerous_queries():
    blocked = [
        "DROP TABLE data_table",
        "SELECT 1; DROP TABLE data_table",
        "COPY (SELECT * FROM data_table) TO 'out.csv'",
        "SELECT * FROM read_csv_auto('C:/Windows/win.ini')",
        "SELECT * FROM read_text('/etc/passwd')",
        "SELECT * FROM '/etc/passwd'",
        "SELECT * FROM data_table JOIN 'secrets.csv' USING (id)",
        "ATTACH 'x.db'",
        "INSTALL httpfs",
        "SET enable_external_access = true",
        "PRAGMA database_list",
        "CREATE TABLE x AS SELECT 1",
        "SELECT * FROM glob('*')",
        "WITH t AS (SELECT 1) INSERT INTO data_table SELECT * FROM t",
        "",
        "SELECT 1 /* hidden */ ; DELETE FROM data_table",
    ]
    for sql in blocked:
        try:
            validate_read_only_sql(sql)
        except UnsafeQueryError:
            continue
        raise AssertionError(f"Validator failed to block: {sql!r}")
    print("PASS: Validator blocks writes, file access, settings changes, and stacked SQL")


# ---------------------------------------------------------------- DuckDB sandbox + timeout
def test_duckdb_blocks_file_access_and_config_changes():
    try:
        dataset_manager.con.execute("SELECT * FROM read_text('C:/Windows/win.ini')").fetchall()
    except Exception as exc:  # noqa: BLE001
        assert "Permission" in str(exc) or "disabled" in str(exc), exc
    else:
        raise AssertionError("DuckDB allowed reading a file outside uploads/")

    try:
        dataset_manager.con.execute("SET enable_external_access = true")
    except Exception as exc:  # noqa: BLE001
        assert "locked" in str(exc).lower(), exc
    else:
        raise AssertionError("DuckDB configuration is not locked")
    print("PASS: DuckDB blocks outside file access and configuration changes")


def test_query_timeout_and_recovery():
    tmp_path = UPLOAD_DIR / f"{uuid.uuid4().hex}.csv"
    tmp_path.write_text(SAMPLE_CSV, encoding="utf-8")
    try:
        dataset_manager.load_file(tmp_path, "sales_data.csv")
    finally:
        tmp_path.unlink(missing_ok=True)

    original = settings.QUERY_TIMEOUT_SECONDS
    settings.QUERY_TIMEOUT_SECONDS = 0.5
    try:
        try:
            _run(execute_raw_sql(SqlQueryRequest(sql="SELECT count(*) FROM range(100000000000) a")))
            raise AssertionError("Long query was not timed out")
        except HTTPException as exc:
            assert exc.status_code == 408, exc
    finally:
        settings.QUERY_TIMEOUT_SECONDS = original

    res = _run(execute_raw_sql(SqlQueryRequest(sql="SELECT Region, SUM(Sales) AS total FROM data_table GROUP BY Region")))
    assert res["count"] == 2
    print("PASS: Long-running queries return 408 timeout and connection recovers cleanly")


def test_raw_sql_route_blocks_unsafe_sql():
    for sql in [
        "SELECT * FROM read_csv_auto('C:/Windows/win.ini')",
        "COPY (SELECT 1) TO 'x.csv'",
        "SELECT 1; DROP TABLE data_table",
    ]:
        try:
            _run(execute_raw_sql(SqlQueryRequest(sql=sql)))
            raise AssertionError(f"Route allowed unsafe SQL: {sql}")
        except HTTPException as exc:
            assert exc.status_code == 403, (sql, exc.status_code, exc.detail)
    print("PASS: /api/query/sql route rejects unsafe SQL with 403")


# ---------------------------------------------------------------- Uploads
def test_upload_size_limit():
    original = settings.MAX_UPLOAD_MB
    settings.MAX_UPLOAD_MB = 1
    try:
        big = ("a,b\n" + ("1,2\n" * 400_000)).encode()  # ~1.6 MB
        try:
            _run(upload_dataset(_make_upload("big.csv", big)))
            raise AssertionError("Oversized upload was allowed")
        except HTTPException as exc:
            assert exc.status_code == 413, (exc.status_code, exc.detail)
    finally:
        settings.MAX_UPLOAD_MB = original
    print("PASS: Oversized uploads are rejected with 413")


def test_upload_path_traversal_and_cleanup():
    before = set(UPLOAD_DIR.iterdir())
    assert _safe_display_name("../../../evil<script>.csv") == "evil_script_.csv"
    summary = _run(upload_dataset(_make_upload("../../../evil_sales.csv", SAMPLE_CSV.encode())))
    assert "/" not in summary.filename and "\\" not in summary.filename and ".." not in summary.filename
    assert summary.table_name == "evil_sales"
    after = set(UPLOAD_DIR.iterdir())
    assert after == before, f"Raw upload left on disk: {after - before}"
    assert not (UPLOAD_DIR.parent.parent / "evil_sales.csv").exists()
    print("PASS: Client filenames are sanitized and raw upload files are deleted after ingestion")


def test_empty_and_bad_extension_uploads():
    for fname, content in [("empty.csv", b""), ("script.py", b"print(1)")]:
        try:
            _run(upload_dataset(_make_upload(fname, content)))
            raise AssertionError(f"Bad upload allowed: {fname}")
        except HTTPException as exc:
            assert exc.status_code == 400, (fname, exc.status_code)
    print("PASS: Empty files and unsupported extensions are rejected with 400")


# ---------------------------------------------------------------- Access key
def test_access_key_enforced_when_configured():
    original = settings.APP_ACCESS_KEY
    settings.APP_ACCESS_KEY = "test-secret-key"
    try:
        for bad in [None, "", "wrong"]:
            try:
                _run(require_access_key(bad))
                raise AssertionError(f"Accepted bad key: {bad!r}")
            except HTTPException as exc:
                assert exc.status_code == 401
        _run(require_access_key("test-secret-key"))
    finally:
        settings.APP_ACCESS_KEY = original
    print("PASS: X-API-Key dependency enforces APP_ACCESS_KEY with constant-time compare")


# ---------------------------------------------------------------- Rate limiting
def test_rate_limiter():
    _reset_limits()
    results = [rate_limiter.hit("127.0.0.1:dataset", 3) for _ in range(5)]
    assert [r[0] for r in results] == [True, True, True, False, False], results
    assert results[3][1] >= 1
    _reset_limits()
    print("PASS: Sliding-window rate limiter enforces quota and returns Retry-After")


# ---------------------------------------------------------------- CORS
def test_cors_allows_exact_origins_only():
    origins = settings.cors_origins()
    assert "http://localhost:3000" in origins
    assert "https://racing-krypton-xyk3apu-divykamalpuria04-gmailcoms-projects.vercel.app" in origins
    assert not any("*" in o for o in origins), origins
    print("PASS: CORS origins contain exact allowlisted domains with zero wildcards")


# ---------------------------------------------------------------- Gemini key handling
def test_gemini_key_sent_in_header_not_url():
    captured = {}

    def fake_post(self, url, json=None, headers=None, **kwargs):  # noqa: A002
        captured["url"] = str(url)
        captured["headers"] = headers or {}
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "{}"}]}}]})

    original_post = httpx.Client.post
    original_key = settings.GEMINI_API_KEY
    httpx.Client.post = fake_post
    settings.GEMINI_API_KEY = "fake-key-123"
    try:
        llm_module.analyst_engine._call_gemini_with_fallback("hello")
    finally:
        httpx.Client.post = original_post
        settings.GEMINI_API_KEY = original_key
    assert "fake-key-123" not in captured["url"], captured["url"]
    assert captured["headers"].get("x-goog-api-key") == "fake-key-123"
    print("PASS: Gemini API key is sent in x-goog-api-key header, never in URL")


ALL_TESTS = [
    test_validator_allows_read_only_queries,
    test_validator_blocks_dangerous_queries,
    test_duckdb_blocks_file_access_and_config_changes,
    test_query_timeout_and_recovery,
    test_raw_sql_route_blocks_unsafe_sql,
    test_upload_size_limit,
    test_upload_path_traversal_and_cleanup,
    test_empty_and_bad_extension_uploads,
    test_access_key_enforced_when_configured,
    test_rate_limiter,
    test_cors_allows_exact_origins_only,
    test_gemini_key_sent_in_header_not_url,
]

if __name__ == "__main__":
    for test in ALL_TESTS:
        test()
    print(f"\nALL {len(ALL_TESTS)} SECURITY TESTS PASSED!")
