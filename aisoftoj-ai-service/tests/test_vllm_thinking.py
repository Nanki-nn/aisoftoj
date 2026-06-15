from aisoftoj_ai.clients.vllm import _get_reasoning, _ThinkingContentParser


def test_reasoning_uses_latest_vllm_field():
    assert (
        _get_reasoning(
            {
                "reasoning": "latest",
                "reasoning_content": "legacy",
            }
        )
        == "latest"
    )


def test_reasoning_supports_legacy_vllm_field():
    assert _get_reasoning({"reasoning_content": "legacy"}) == "legacy"


def test_thinking_parser_handles_split_tags():
    parser = _ThinkingContentParser()
    events = []
    for chunk in ["<thi", "nk>分析", "过程</th", "ink>最终", "答案"]:
        events.extend(parser.feed(chunk))
    events.extend(parser.finish())

    assert "".join(text for kind, text in events if kind == "reasoning") == "分析过程"
    assert "".join(text for kind, text in events if kind == "token") == "最终答案"


def test_thinking_parser_keeps_plain_content_as_answer():
    parser = _ThinkingContentParser()
    events = []
    for chunk in ["普通", "回答"]:
        events.extend(parser.feed(chunk))
    events.extend(parser.finish())

    assert "".join(text for kind, text in events if kind == "reasoning") == ""
    assert "".join(text for kind, text in events if kind == "token") == "普通回答"
