from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class DocumentState(StrEnum):
    QUEUED = "queued"
    LOADING = "loading"
    WORKING = "working"
    NEEDS_HUMAN = "needs_human"
    RESULT_READY = "result_ready"
    DOWNLOADING = "downloading"
    DOWNLOADED = "downloaded"
    ERROR = "error"


@dataclass(slots=True)
class Supplier:
    cnpj: str
    uf: str


@dataclass(slots=True)
class DocumentJob:
    provider_id: str
    title: str
    state: DocumentState = DocumentState.QUEUED
    message: str = "Na fila"
    file_path: str | None = None
