from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.routes import router as api_router

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for AI Data Analyst Helper powered by DuckDB & Gemini",
    version="1.0.0"
)

# CORS configuration (supports local dev + Vercel / Railway / Render cloud deployments)
origins = list(settings.ALLOWED_ORIGINS)
if settings.FRONTEND_URL:
    origins.append(settings.FRONTEND_URL.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.(vercel\.app|onrender\.com|up\.railway\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.APP_NAME,
        "docs": "/docs"
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
