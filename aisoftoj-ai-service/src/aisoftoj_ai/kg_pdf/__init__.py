"""Structure-aware PDF knowledge graph extraction.

This package is intentionally separate from ``aisoftoj_ai.rag``. It may reuse
raw document parse artifacts, but it never consumes RAG chunks, embeddings, or
vector-store retrieval output as extraction input.
"""

from aisoftoj_ai.kg_pdf.workflow import run_kg_pdf_extraction

__all__ = ["run_kg_pdf_extraction"]
