from pathlib import PurePosixPath

from aisoftoj_ai.rag.models import Citation, SearchResult


def build_citations(results: list[SearchResult]) -> list[Citation]:
    """将检索结果转换为前端可展示的引用列表。"""
    citations: list[Citation] = []
    for index, item in enumerate(results, start=1):
        citations.append(
            Citation(
                index=index,
                result_id=item.id,
                title=item.title or "知识库资料",
                source="知识库" if item.source == "knowledge_base" else "互联网",
                content=item.content,
                score=item.score,
                document_id=item.document_id,
                version=item.version,
                content_type=item.content_type,
                asset_name=PurePosixPath(item.asset_url).name if item.asset_url else None,
                page=item.page,
                heading_path=item.heading_path,
                url=item.url,
                asset_url=item.asset_url,
            )
        )
    return citations
