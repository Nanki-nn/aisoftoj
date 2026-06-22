import asyncio
import json

from aisoftoj_ai.kg_pdf.workflow import run_kg_pdf_extraction


async def main() -> None:
    content_list = [
        {"type": "title", "text_level": 1, "text": "风险管理", "page": 112},
        {
            "type": "text",
            "text": "风险识别需要持续发现项目中的不确定因素，并为后续风险应对提供依据。",
            "page": 114,
        },
        {
            "type": "text",
            "text": "项目团队应记录风险来源、触发条件和可能影响。",
            "page": 114,
        },
    ]
    result = await run_kg_pdf_extraction(
        chat=None,
        document_id="demo-risk",
        content_list=content_list,
        document_title="系统架构设计师教程",
        max_chunks=8,
    )
    print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
