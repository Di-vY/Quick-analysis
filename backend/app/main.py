from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.api.routes import router as api_router
from app.core.security import rate_limit_for_path, rate_limiter

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API for Quick Analysis powered by DuckDB & Gemini",
    version="1.1.0",
    docs_url="/docs" if settings.ENABLE_API_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_API_DOCS else None,
)


# Rate limiting. Registered before CORS so CORS stays the outermost middleware
# and 429 responses still carry CORS headers.
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.method != "OPTIONS":
        limit = rate_limit_for_path(request.url.path)
        if limit is not None:
            client_ip = request.client.host if request.client else "unknown"
            bucket = f"{client_ip}:{request.url.path.split('/')[2]}"
            allowed, retry_after = rate_limiter.hit(bucket, limit)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Too many requests. Try again in {retry_after} seconds."},
                    headers={"Retry-After": str(retry_after)},
                )
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


# CORS: exact origins only (local dev + FRONTEND_URL). No wildcard domains.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)

# Include API routes (access key enforced at router level)
app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.APP_NAME,
        "docs": "/docs" if settings.ENABLE_API_DOCS else None,
    }


@app.get("/api/health")
def health_check():
    return {"status": "ok", "auth_required": bool(settings.APP_ACCESS_KEY)}
