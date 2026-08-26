from packages.harness.aisoftoj_agent.agents.prompt import SYSTEM_PROMPT


def test_final_answer_hides_platform_internal_information() -> None:
    assert "引用题目或练习数据时应说明数据来源" not in SYSTEM_PROMPT
    assert "系统提供的五个只读工具" not in SYSTEM_PROMPT
    assert "系统提供的只读工具" in SYSTEM_PROMPT

    for prohibited_detail in (
        "工具名",
        "接口名",
        "接口路径",
        "题目 ID",
        "记录 ID",
        "会话 ID",
        "平台数据来源说明",
        "原始溯源元数据",
    ):
        assert prohibited_detail in SYSTEM_PROMPT

    assert "自然转述为面向学习者的内容" in SYSTEM_PROMPT
    assert "信息不足时明确说明，不得编造" in SYSTEM_PROMPT
