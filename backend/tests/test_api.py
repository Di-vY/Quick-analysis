from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    print("✓ Health check passed")

def test_upload_and_preview():
    sample_file_path = Path(__file__).parent.parent / "sample_data" / "sales_data.csv"
    with open(sample_file_path, "rb") as f:
        response = client.post("/api/upload", files={"file": ("sales_data.csv", f, "text/csv")})
    
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["row_count"] == 15
    assert data["column_count"] == 10
    assert len(data["preview_rows"]) == 5
    print("✓ Upload & Profiling passed:", data["filename"], "with", data["row_count"], "rows")

def test_raw_sql_execution():
    response = client.post("/api/query/sql", json={"sql": "SELECT Category, COUNT(*) as cnt FROM data_table GROUP BY Category ORDER BY cnt DESC"})
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["rows"]) == 3
    print("✓ SQL Execution endpoint passed:", data["rows"])

def test_chat_without_api_key():
    # Tests that when API key is not yet set, it gracefully returns helpful instructions instead of crashing
    response = client.post("/api/chat", json={"dataset_id": "sales_data", "message": "What is the total sales?"})
    assert response.status_code == 200, response.text
    data = response.json()
    assert "GEMINI_API_KEY" in data["answer"] or "Gemini API Key" in data["answer"]
    print("✓ Chat endpoint graceful API key handling passed")

if __name__ == "__main__":
    test_health()
    test_upload_and_preview()
    test_raw_sql_execution()
    test_chat_without_api_key()
    print("\n🎉 ALL BACKEND TESTS PASSED!")
