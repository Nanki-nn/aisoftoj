from __future__ import annotations

import re

from .models import RetrievedChunk

_ASCII_WORD = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_+.-]*")
_CJK = re.compile(r"[\u3400-\u9fff]")


def rerank(query: str, candidates: list[RetrievedChunk]) -> list[RetrievedChunk]:
    ranked: list[RetrievedChunk] = []
    for candidate in candidates:
        lexical = lexical_overlap(query, candidate.chunk.text)
        dense = max(0.0, min(1.0, candidate.dense_score))
        score = round((dense * 0.82) + (lexical * 0.18), 6)
        ranked.append(
            RetrievedChunk(
                chunk=candidate.chunk,
                dense_score=candidate.dense_score,
                relevance_score=score,
            )
        )
    return sorted(ranked, key=lambda item: (-item.relevance_score, item.chunk.chunk_id))


def lexical_overlap(left: str, right: str) -> float:
    left_terms = _terms(left)
    right_terms = _terms(right)
    union = left_terms | right_terms
    return len(left_terms & right_terms) / len(union) if union else 0.0


def _terms(text: str) -> set[str]:
    lowered = text.lower()
    terms = {match.group(0) for match in _ASCII_WORD.finditer(lowered)}
    chinese = "".join(_CJK.findall(lowered))
    terms.update(chinese[index : index + 2] for index in range(max(0, len(chinese) - 1)))
    return {term for term in terms if term}
