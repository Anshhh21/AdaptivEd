from contextlib import asynccontextmanager
import logging
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.db.session import db_manager
from app.models import ALL_DOCUMENT_MODELS
from app.schemas.base import APIErrorResponse, ErrorDetail, ResponseEnvelope
from app.api.v1.router import api_v1_router

# Configure structured application logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("adaptived.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Manages stateful application lifecycle:
    - Connects to MongoDB connection pool and registers Beanie ODM schemas on boot.
    - Gracefully drains and closes database sockets on shutdown.
    """
    settings = get_settings()
    logger.info(f"Starting {settings.PROJECT_NAME} in [{settings.ENVIRONMENT}] mode...")

    # Boot database connection pool
    try:
        await db_manager.connect_and_init(document_models=ALL_DOCUMENT_MODELS)
        logger.info("Database and ODM document models ready.")
    except Exception as exc:
        logger.critical(f"Fatal startup failure during database initialization: {exc}")
        if settings.ENVIRONMENT == "production":
            raise exc
        logger.warning("Continuing in development/offline mode without live database.")

    yield

    # Clean shutdown
    logger.info("Initiating graceful application shutdown...")
    await db_manager.close_connection()
    logger.info("All connection pools closed.")


def create_application() -> FastAPI:
    """
    Application factory building the production-ready FastAPI instance.
    """
    settings = get_settings()

    application = FastAPI(
        title=settings.PROJECT_NAME,
        version="1.0.0",
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json"
        if settings.ENVIRONMENT != "production"
        else None,
        lifespan=lifespan,
    )

    # Cross-Origin Resource Sharing (CORS) Configuration
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception Handler: Request Validation Errors (HTTP 422 -> Deterministic APIErrorResponse)
    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            ErrorDetail(
                field=" -> ".join(str(loc) for loc in err.get("loc", [])),
                message=err.get("msg", "Validation error"),
                code="INVALID_FIELD_TYPE",
            )
            for err in exc.errors()
        ]
        error_payload = APIErrorResponse(
            error_code="VALIDATION_FAILED",
            message="Incoming request payload violated schema constraints.",
            details=details,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_payload.model_dump(mode="json"),
        )

    # Exception Handler: Catch-all internal exceptions (HTTP 500)
    @application.exception_handler(Exception)
    async def global_unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.error(f"Unhandled exception encountered at {request.url.path}: {exc}", exc_info=True)
        error_payload = APIErrorResponse(
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred while processing the request.",
            details=[],
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_payload.model_dump(mode="json"),
        )

    # Root & Health Probes
    @application.get("/health", response_model=ResponseEnvelope[dict], tags=["Monitoring"])
    async def health_check() -> ResponseEnvelope[dict]:
        db_healthy = await db_manager.ping()
        return ResponseEnvelope(
            success=db_healthy,
            message="Healthy" if db_healthy else "Degraded: Database connection unverified",
            data={
                "status": "online" if db_healthy else "degraded",
                "database_connected": db_healthy,
                "environment": settings.ENVIRONMENT,
            },
        )

    # Mount API v1 Routes
    application.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    return application


app = create_application()
