from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator, model_validator

MineruState = Literal[
    "waiting-file",
    "uploading",
    "pending",
    "running",
    "converting",
    "done",
    "failed",
]
_IDENTIFIER_RE = re.compile(r"^[A-Za-z0-9_.-]{1,128}$")
_SEED_RE = re.compile(r"^[A-Za-z0-9_]{1,64}$")


class MineruParseOptions(BaseModel):
    """Options shared by MinerU V4 requests.

    The model is deliberately fixed to ``vlm`` by :class:`MineruClient`.
    """

    model_config = ConfigDict(extra="forbid")

    is_ocr: bool = False
    enable_formula: bool = True
    enable_table: bool = True
    language: str = Field(default="ch", min_length=1, max_length=32)
    data_id: str | None = None
    callback: AnyHttpUrl | None = None
    seed: str | None = Field(default=None, max_length=64)
    extra_formats: list[Literal["docx", "html", "latex"]] = Field(default_factory=list)
    page_ranges: str | None = Field(default=None, max_length=1024)
    no_cache: bool = False
    cache_tolerance: int = Field(default=900, ge=0)

    @field_validator("data_id")
    @classmethod
    def validate_data_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not _IDENTIFIER_RE.fullmatch(value):
            raise ValueError("data_id contains unsupported characters")
        return value

    @field_validator("seed")
    @classmethod
    def validate_seed(cls, value: str | None) -> str | None:
        if value is not None and not _SEED_RE.fullmatch(value):
            raise ValueError("seed contains unsupported characters")
        return value

    @model_validator(mode="after")
    def validate_callback_seed(self) -> MineruParseOptions:
        if self.callback is not None and self.seed is None:
            raise ValueError("seed is required when callback is configured")
        return self

    def to_payload(self, *, include_data_id: bool = True) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "is_ocr": self.is_ocr,
            "enable_formula": self.enable_formula,
            "enable_table": self.enable_table,
            "language": self.language,
            "no_cache": self.no_cache,
            "cache_tolerance": self.cache_tolerance,
        }
        if include_data_id and self.data_id is not None:
            payload["data_id"] = self.data_id
        if self.callback is not None:
            payload["callback"] = str(self.callback)
            payload["seed"] = self.seed
        if self.extra_formats:
            payload["extra_formats"] = self.extra_formats
        if self.page_ranges is not None:
            payload["page_ranges"] = self.page_ranges
        return payload


class MineruUrlFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: AnyHttpUrl
    data_id: str | None = None
    is_ocr: bool | None = None
    page_ranges: str | None = Field(default=None, max_length=1024)

    @field_validator("data_id")
    @classmethod
    def validate_data_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not _IDENTIFIER_RE.fullmatch(value):
            raise ValueError("data_id contains unsupported characters")
        return value

    def to_payload(self, options: MineruParseOptions) -> dict[str, Any]:
        payload: dict[str, Any] = {"url": str(self.url)}
        if self.data_id is not None:
            payload["data_id"] = self.data_id
        if self.is_ocr is not None:
            payload["is_ocr"] = self.is_ocr
        if self.page_ranges is not None:
            payload["page_ranges"] = self.page_ranges
        return payload


class MineruFileSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=512)
    data_id: str | None = None
    is_ocr: bool | None = None
    page_ranges: str | None = Field(default=None, max_length=1024)

    @field_validator("data_id")
    @classmethod
    def validate_data_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not _IDENTIFIER_RE.fullmatch(value):
            raise ValueError("data_id contains unsupported characters")
        return value

    def to_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"name": self.name}
        if self.data_id is not None:
            payload["data_id"] = self.data_id
        if self.is_ocr is not None:
            payload["is_ocr"] = self.is_ocr
        if self.page_ranges is not None:
            payload["page_ranges"] = self.page_ranges
        return payload


class MineruTaskRef(BaseModel):
    model_config = ConfigDict(extra="ignore")

    task_id: str = Field(min_length=1)


class MineruBatchRef(BaseModel):
    model_config = ConfigDict(extra="ignore")

    batch_id: str = Field(min_length=1)


class MineruUploadBatch(BaseModel):
    model_config = ConfigDict(extra="ignore")

    batch_id: str = Field(min_length=1)
    file_urls: list[AnyHttpUrl] = Field(min_length=1, max_length=50)


class MineruBatchTask(BaseModel):
    model_config = ConfigDict(extra="ignore")

    file_name: str = Field(min_length=1)
    state: MineruState
    data_id: str | None = None
    full_zip_url: AnyHttpUrl | None = None
    markdown_url: AnyHttpUrl | None = None
    err_code: int | str | None = None
    err_msg: str | None = None
    extract_progress: dict[str, Any] | None = None


class MineruTaskResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    task_id: str = Field(min_length=1)
    state: MineruState
    data_id: str | None = None
    full_zip_url: AnyHttpUrl | None = None
    markdown_url: AnyHttpUrl | None = None
    err_code: int | str | None = None
    err_msg: str | None = None
    extract_progress: dict[str, Any] | None = None


class MineruBatchResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    batch_id: str = Field(min_length=1)
    extract_result: list[MineruBatchTask]
