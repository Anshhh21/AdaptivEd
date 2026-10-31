import logging
from typing import List, Type
from beanie import Document, init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.core.config import get_settings

logger = logging.getLogger("adaptived.database")


class DatabaseManager:
    """
    Singleton Manager for MongoDB async client connection pool and Beanie ODM initialization.
    Enforces clean connection pooling and structured lifecycle events.
    """

    client: AsyncIOMotorClient | None = None

    @classmethod
    async def connect_and_init(cls, document_models: List[Type[Document]]) -> None:
        """
        Establishes connection to MongoDB, validates connectivity via ping,
        and initializes Beanie ODM with the registered document schemas.
        """
        settings = get_settings()
        connection_url = str(settings.MONGODB_URI).strip()
        if connection_url.startswith("mongodb+srv://") and ":27017" in connection_url:
            connection_url = connection_url.replace(":27017", "")

        logger.info("Initializing async MongoDB connection pool...")
        try:
            # Configure high-concurrency client pooling
            cls.client = AsyncIOMotorClient(
                connection_url,
                maxPoolSize=100,
                minPoolSize=10,
                serverSelectionTimeoutMS=5000,
                uuidRepresentation="standard",
            )

            # Eager connectivity ping before serving traffic
            await cls.client.admin.command("ping")
            logger.info("MongoDB connection ping succeeded.")

            # Initialize Beanie ODM
            database = cls.client[settings.DATABASE_NAME]
            await init_beanie(
                database=database,
                document_models=document_models,
            )
            logger.info(
                f"Beanie ODM initialized with database '{settings.DATABASE_NAME}' and {len(document_models)} models."
            )
        except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
            logger.critical(f"FATAL: Unable to connect to MongoDB cluster: {exc}")
            raise RuntimeError(f"Database initialization failed: {exc}") from exc

    @classmethod
    async def close_connection(cls) -> None:
        """
        Gracefully drains and terminates the async connection pool.
        """
        if cls.client is not None:
            logger.info("Closing MongoDB async connection pool...")
            cls.client.close()
            cls.client = None
            logger.info("MongoDB connection pool cleanly shutdown.")

    @classmethod
    async def ping(cls) -> bool:
        """
        Lightweight health-check probe used by readiness/liveness endpoints.
        """
        if cls.client is None:
            return False
        try:
            await cls.client.admin.command("ping")
            return True
        except Exception as exc:
            logger.error(f"MongoDB ping health check failed: {exc}")
            return False


db_manager = DatabaseManager()

