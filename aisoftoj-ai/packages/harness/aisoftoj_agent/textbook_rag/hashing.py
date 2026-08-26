from __future__ import annotations

import hashlib
import json
import re

from ..integrations.aisoftoj.models import TextbookCatalog, TextbookTraceQuestion

_WHITESPACE = re.compile(r"\s+")


def normalized_question_payload(question: TextbookTraceQuestion) -> dict[str, object]:
    return {
        "questionId": question.question_id,
        "name": _normalize(question.name),
        "content": _normalize(question.content),
        "options": [
            {"key": _normalize(option.key), "content": _normalize(option.content)}
            for option in question.options
        ],
        "analysis": _normalize(question.analysis or ""),
        "questionType": question.question_type,
        "difficulty": question.difficulty,
        "subjectName": _normalize(question.subject_name),
    }


def question_content_hash(question: TextbookTraceQuestion) -> str:
    raw = json.dumps(
        normalized_question_payload(question),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def question_retrieval_text(question: TextbookTraceQuestion) -> str:
    options = " ".join(f"{item.key}. {item.content}" for item in question.options)
    return _normalize(
        "\n".join(
            part
            for part in [question.name, question.content, options, question.analysis or ""]
            if part
        )
    )


def catalog_content_hash(catalog: TextbookCatalog) -> str:
    payload = catalog.model_dump(
        mode="json", exclude={"official_url", "viewer_page_template"}
    )
    raw = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _normalize(value: str) -> str:
    return _WHITESPACE.sub(" ", value).strip()
