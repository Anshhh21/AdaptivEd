from datetime import datetime, timezone
from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class AppBaseModel(BaseModel):
    """
    Foundational abstract base model for all AdaptivEd schemas.
    Configured for Pydantic v2 with strict ORM-mode reflection and aliasing.
    """

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        validate_assignment=True,
        arbitrary_types_allowed=False,
        str_strip_whitespace=True,
    )


class TimestampedModel(AppBaseModel):
    """
    Standard temporal contract ensuring UTC consistency across all stored and serialized models.
    """

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC creation timestamp.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC last update timestamp.",
    )


class ResponseEnvelope(AppBaseModel, Generic[T]):
    """
    Standardized top-level API response envelope.
    Ensures the Next.js client receives a deterministic contract for every HTTP request.
    """

    success: bool = Field(default=True, description="Indicates operational success.")
    data: Optional[T] = Field(default=None, description="Typed payload of the response.")
    message: Optional[str] = Field(default=None, description="Human-readable status summary.")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Server timestamp at serialization.",
    )


class PaginationMeta(AppBaseModel):
    """Metadata describing a paginated list payload."""

    total_count: int = Field(ge=0, description="Total matching items across all pages.")
    page: int = Field(ge=1, description="Current 1-indexed page.")
    page_size: int = Field(ge=1, le=100, description="Items per page.")
    total_pages: int = Field(ge=0, description="Total computed pages.")
    has_next: bool = Field(description="True if another page exists.")
    has_prev: bool = Field(description="True if a previous page exists.")


class PaginatedResponseEnvelope(ResponseEnvelope[List[T]], Generic[T]):
    """Standardized envelope for paginated collections."""

    meta: PaginationMeta = Field(description="Pagination window metadata.")


class ErrorDetail(AppBaseModel):
    """Structured granular error explanation, ideal for form fields and validation errors."""

    field: Optional[str] = Field(default=None, description="Field path causing the failure.")
    message: str = Field(description="Actionable explanation of the error.")
    code: str = Field(default="VALIDATION_ERROR", description="Machine-readable error category.")


class APIErrorResponse(AppBaseModel):
    """Deterministic failure contract for 4xx and 5xx API exceptions."""

    success: bool = Field(default=False)
    error_code: str = Field(description="High-level classification (e.g. UNAUTHORIZED, NOT_FOUND).")
    message: str = Field(description="Human-readable error explanation.")
    details: List[ErrorDetail] = Field(
        default_factory=list,
        description="Granular field-level errors if applicable.",
    )
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

