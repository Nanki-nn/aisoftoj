from aisoftoj_ai.clients.mineru import Mineru


def test_mineru_json_keeps_heading_path_and_page_metadata():
    mineru = Mineru("http://mineru")

    result = mineru.normalize(
        {
            "results": {
                "sample.pdf": {
                    "md_content": "# 第一章\n\n## CAP 定理",
                    "content_list": [
                        {"type": "title", "text": "第一章", "text_level": 1},
                        {"type": "title", "text": "CAP 定理", "text_level": 2},
                        {
                            "type": "text",
                            "text": "一致性、可用性和分区容错性。",
                            "page_idx": 2,
                            "bbox": [1, 2, 3, 4],
                        },
                        {"type": "title", "text": "第二章", "text_level": 1},
                        {
                            "type": "table",
                            "table_body": "| A | B |",
                            "page_idx": 3,
                        },
                    ],
                }
            }
        }
    )

    blocks = result.blocks
    assert result.markdown.startswith("# 第一章")
    assert blocks[0].heading_path == ["第一章", "CAP 定理"]
    assert blocks[0].page == 2
    assert blocks[1].heading_path == ["第二章"]
    assert blocks[1].content_type == "table"
