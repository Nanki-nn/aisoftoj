import json
import re
from typing import Any

import httpx
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

from aisoftoj_ai.api.schemas import ChatRequest
from aisoftoj_ai.config import get_settings
from aisoftoj_ai.rag.citations import build_citations
from aisoftoj_ai.rag.models import SearchResult

_CHECKPOINTER = MemorySaver()

TOOL_TITLES = {
    "search_knowledge_base": "检索知识库",
    "search_web": "联网搜索",
    "analyze_wrong_questions": "分析错题",
    "list_recommended_knowledge_points": "读取推荐知识点",
    "query_knowledge_graph_context": "查询图谱上下文",
    "propose_graph_edit": "规划图谱修改",
}

SYSTEM_PROMPT = """你是知构软考刷题平台的全能备考 Agent。
你的目标不是只查知识库，而是先判断用户意图，再选择工具：
1. 问概念、论文、案例、对比题时，优先检索知识库；证据不足且用户开启联网时再联网。
2. 问“我的错题、薄弱点、怎么复盘”时，先分析错题和推荐知识点。
3. 问图谱关系时，先查询图谱上下文；涉及改图谱时，只有用户明确表达修改目标才给出修改建议。
4. 需要长期偏好时使用用户画像；需要前文时使用会话摘要和最近对话。
5. 不要编造本地数据，不要给假的学习路线兜底；工具失败就明确说明失败原因。

回答要求：中文、结构清晰、可执行。引用知识库或网页资料时保留来源线索。

会话摘要：
{session_summary}

用户画像：
{user_profile}
"""


async def stream_study_agent(body: ChatRequest, services, redis, trace_id: str):
    """Stream a ReAct-style study agent with tool/action events."""
    memory = await _load_memory(redis, body.user_id, body.session_id)
    collected_results: list[SearchResult] = []
    page_context = body.page_context or {}
    prefetched_messages: list[dict[str, str]] = []

    yield _event("agent_action", "理解意图", "正在判断是否需要查知识库、错题、图谱或联网资料。", trace_id)
    if _needs_wrong_question_context(body.question):
        wrong_context = _wrong_question_context(page_context)
        prefetched_messages.append({"role": "system", "content": f"已读取用户错题上下文：\n{wrong_context}"})
        yield _event("agent_action", "分析错题", "正在读取错题证据和推荐知识点。", trace_id)
        yield _event("tool_result", "错题分析结果", _compact(wrong_context, 260), trace_id)
    if _needs_graph_context(body.question):
        graph_context = _graph_context(page_context)
        prefetched_messages.append({"role": "system", "content": f"已读取图谱上下文：\n{graph_context}"})
        yield _event("agent_action", "查询图谱上下文", "正在读取薄弱知识点之间的关系线索。", trace_id)
        yield _event("tool_result", "图谱上下文", _compact(graph_context, 260), trace_id)

    @tool("search_knowledge_base")
    async def search_knowledge_base(query: str, limit: int = 8) -> str:
        """检索当前会话绑定的知识库，适合回答教材、资料、论文和概念问题。"""
        if not body.knowledge_base_ids:
            return "当前会话没有选中的知识库。"
        results = await services.search.search(
            query,
            body.knowledge_base_ids,
            max(1, min(limit, 12)),
        )
        collected_results.extend(results)
        return _format_search_results(results)

    @tool("search_web")
    async def search_web(query: str) -> str:
        """联网搜索公开资料。只有用户开启联网搜索时才会返回结果。"""
        if not body.web_enabled:
            return "用户没有开启联网搜索，本轮不能访问公开网页。"
        results = await services.searxng.search(query)
        collected_results.extend(results)
        return _format_search_results(results[:8])

    @tool("analyze_wrong_questions")
    async def analyze_wrong_questions(knowledge_point: str = "") -> str:
        """分析用户错题证据，适合回答薄弱点、相关错题、复盘优先级。"""
        evidences = page_context.get("wrong_question_evidences") or []
        normalized = knowledge_point.strip().lower()
        if normalized:
            evidences = [
                item for item in evidences
                if normalized in str(item.get("knowledgePointName") or item.get("questionName") or "").lower()
            ]
        if not evidences:
            return "没有找到匹配的错题证据。"
        lines = []
        for item in evidences[:12]:
            lines.append(
                f"- {item.get('knowledgePointName') or item.get('questionName')}: "
                f"{item.get('paperName') or item.get('subjectName') or '软考题库'}，"
                f"错 {item.get('errorCount') or 1} 次，重要级别 {item.get('importanceLevel') or 'medium'}"
            )
        return "\n".join(lines)

    @tool("list_recommended_knowledge_points")
    async def list_recommended_knowledge_points() -> str:
        """读取后端根据错题统计出的推荐知识点。"""
        recommendations = page_context.get("knowledge_recommendations") or []
        if not recommendations:
            return "当前没有推荐知识点。"
        lines = []
        for item in recommendations[:10]:
            lines.append(
                f"- {item.get('name')}: 薄弱分 {item.get('score')}, "
                f"错题 {item.get('wrongQuestionCount')} 道，建议：{item.get('suggestion')}"
            )
        return "\n".join(lines)

    @tool("query_knowledge_graph_context")
    async def query_knowledge_graph_context(knowledge_point: str = "") -> str:
        """查询图谱可用上下文，适合解释知识点之间的前置、关联、易混淆关系。"""
        recommendations = page_context.get("knowledge_recommendations") or []
        evidences = page_context.get("wrong_question_evidences") or []
        name = knowledge_point.strip()
        matched = [
            item for item in recommendations
            if not name or name in str(item.get("name") or "")
        ]
        if not matched:
            return "没有在当前错题图谱上下文中找到匹配知识点。"
        evidence_count = len(evidences)
        lines = [f"当前错题图谱有 {len(recommendations)} 个推荐知识点，{evidence_count} 条错题证据。"]
        for item in matched[:8]:
            lines.append(
                f"- {item.get('name')}: {item.get('reason')} "
                f"前置：{', '.join(item.get('prerequisiteNames') or []) or '暂无'}；"
                f"关联：{', '.join(item.get('relatedNames') or []) or '暂无'}"
            )
        return "\n".join(lines)

    @tool("propose_graph_edit")
    async def propose_graph_edit(source: str, target: str, relation_type: str) -> str:
        """为明确的图谱修改请求生成修改建议；真正保存由图谱页编辑区完成。"""
        allowed = {"PREREQUISITE_OF": "前置", "RELATED_TO": "关联", "CONTAINS": "包含", "CONFUSED_WITH": "易混淆"}
        relation = allowed.get(relation_type.upper(), relation_type)
        return (
            f"建议把“{source}”到“{target}”的关系设为“{relation}”。"
            "图谱页已提供关系编辑区，点击对应关系后可保存为人工编辑，刷新后不会被 Agent 覆盖。"
        )

    model = _agent_model()
    agent = create_react_agent(
        model,
        [
            search_knowledge_base,
            search_web,
            analyze_wrong_questions,
            list_recommended_knowledge_points,
            query_knowledge_graph_context,
            propose_graph_edit,
        ],
        checkpointer=_CHECKPOINTER,
    )

    agent_prompt = SYSTEM_PROMPT.format(
        session_summary=memory["session_summary"] or "无",
        user_profile=memory["user_profile"] or "无",
    )
    messages = _agent_messages(body, prefetched_messages, agent_prompt)
    final_text = ""
    try:
        async for event in agent.astream_events(
            {"messages": messages},
            config={"configurable": {"thread_id": body.session_id or trace_id}},
            version="v2",
        ):
            kind = event.get("event")
            name = str(event.get("name") or "")
            if kind == "on_tool_start":
                yield _event("agent_action", TOOL_TITLES.get(name, "调用工具"), f"正在执行：{TOOL_TITLES.get(name, name)}", trace_id)
            elif kind == "on_tool_end":
                output = str(event.get("data", {}).get("output") or "")
                yield _event("tool_result", TOOL_TITLES.get(name, "工具结果"), _compact(output, 180), trace_id)
            elif kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                content = getattr(chunk, "content", "")
                if isinstance(content, str) and content:
                    final_text += content
                    yield {"type": "token", "content": content, "traceId": trace_id}
    except Exception as exc:
        raise RuntimeError("study agent failed") from exc

    citations = build_citations(collected_results)
    yield {
        "type": "citation",
        "citations": [item.model_dump() for item in citations],
        "traceId": trace_id,
    }
    memory_update = await _save_memory(redis, body, final_text, memory)
    if memory_update:
        yield _event("memory_update", "记忆更新", memory_update, trace_id)


def _agent_model() -> ChatOpenAI:
    settings = get_settings()
    return ChatOpenAI(
        base_url=settings.chat_base_url,
        api_key=settings.chat_api_key,
        model=settings.chat_model,
        temperature=0.15,
        timeout=120,
        http_client=httpx.Client(timeout=120, trust_env=False),
        http_async_client=httpx.AsyncClient(timeout=120, trust_env=False),
    )


def _agent_messages(
    body: ChatRequest,
    prefetched_messages: list[dict[str, str]],
    agent_prompt: str,
) -> list[dict[str, str]]:
    compacted = _compact_history([item.model_dump() for item in body.history])
    context_parts = [
        item.get("content", "")
        for item in [*compacted, *prefetched_messages]
        if item.get("role") == "system" and item.get("content")
    ]
    conversation = [item for item in compacted if item.get("role") != "system"]
    question = f"{agent_prompt}\n\n用户问题：{body.question}"
    if context_parts:
        question = (
            f"{agent_prompt}\n\n本轮已读取的上下文：\n"
            + "\n\n".join(context_parts)
            + f"\n\n用户问题：{body.question}"
        )
    conversation.append({"role": "user", "content": question})
    return conversation


def _compact_history(history: list[dict[str, str]]) -> list[dict[str, str]]:
    if len(history) <= 8 and sum(len(item.get("content", "")) for item in history) <= 12000:
        return history[-8:]
    old = history[:-8]
    recent = history[-8:]
    summary = "；".join(_compact(item.get("content", ""), 120) for item in old[-12:])
    return [{"role": "system", "content": f"较早对话压缩摘要：{summary}"}, *recent]


async def _load_memory(redis, user_id: str | None, session_id: str | None) -> dict[str, str]:
    session_summary = ""
    user_profile = ""
    if session_id:
        raw = await redis.get(f"agent:session:{session_id}:summary")
        session_summary = _decode(raw)
    if user_id:
        raw = await redis.get(f"agent:user:{user_id}:profile")
        user_profile = _decode(raw)
    return {"session_summary": session_summary, "user_profile": user_profile}


async def _save_memory(redis, body: ChatRequest, answer: str, memory: dict[str, str]) -> str:
    updates = []
    if body.session_id:
        summary = _merge_summary(memory.get("session_summary", ""), body.question, answer)
        await redis.set(f"agent:session:{body.session_id}:summary", summary)
        await redis.expire(f"agent:session:{body.session_id}:summary", 30 * 24 * 3600)
    if body.user_id:
        profile = _merge_profile(memory.get("user_profile", ""), body)
        if profile != (memory.get("user_profile") or ""):
            await redis.set(f"agent:user:{body.user_id}:profile", profile)
            updates.append("已更新用户画像")
    return "，".join(updates)


def _merge_summary(previous: str, question: str, answer: str) -> str:
    item = f"用户问：{_compact(question, 100)}；助手答：{_compact(answer, 160)}"
    merged = f"{previous}\n{item}".strip()
    return _compact(merged, 1800)


def _merge_profile(previous: str, body: ChatRequest) -> str:
    facts = [line.strip() for line in previous.splitlines() if line.strip()]
    text = body.question
    time_match = re.search(r"(每天|每日|一天).{0,8}?(\d+)\s*(分钟|小时|h)", text)
    if time_match:
        facts.append(f"学习时间偏好：{time_match.group(0)}")
    if "系统架构" in text and not any("考试目标" in item for item in facts):
        facts.append("考试目标：系统架构设计师")
    recommendations = body.page_context.get("knowledge_recommendations") if body.page_context else []
    if recommendations:
        weak = "、".join(str(item.get("name")) for item in recommendations[:4] if item.get("name"))
        if weak:
            facts.append(f"近期薄弱点：{weak}")
    unique = []
    for fact in facts:
        if fact not in unique:
            unique.append(fact)
    return "\n".join(unique[-12:])


def _needs_wrong_question_context(question: str) -> bool:
    return any(keyword in question for keyword in ("错题", "薄弱", "掌握", "复盘", "推荐知识点"))


def _needs_graph_context(question: str) -> bool:
    return any(keyword in question for keyword in ("图谱", "关系", "前置", "关联", "易混淆", "知识点"))


def _wrong_question_context(page_context: dict[str, Any]) -> str:
    recommendations = page_context.get("knowledge_recommendations") or []
    evidences = page_context.get("wrong_question_evidences") or []
    lines = []
    if recommendations:
        lines.append("推荐知识点：")
        for item in recommendations[:8]:
            lines.append(
                f"- {item.get('name')}: 薄弱分 {item.get('score')}，"
                f"错题 {item.get('wrongQuestionCount')} 道，累计错误 {item.get('errorCount')} 次。"
            )
    if evidences:
        lines.append("最近错题证据：")
        for item in evidences[:10]:
            lines.append(
                f"- {item.get('knowledgePointName') or item.get('questionName')}: "
                f"{item.get('paperName') or item.get('subjectName') or '软考题库'}，"
                f"错 {item.get('errorCount') or 1} 次。"
            )
    return "\n".join(lines) if lines else "没有可用的错题上下文。"


def _graph_context(page_context: dict[str, Any]) -> str:
    recommendations = page_context.get("knowledge_recommendations") or []
    if not recommendations:
        return "没有可用的图谱上下文。"
    lines = []
    for item in recommendations[:8]:
        prerequisites = "、".join(item.get("prerequisiteNames") or []) or "暂无"
        related = "、".join(item.get("relatedNames") or []) or "暂无"
        lines.append(f"- {item.get('name')}: 前置 {prerequisites}；关联 {related}；{item.get('reason')}")
    return "\n".join(lines)


def _format_search_results(results: list[SearchResult]) -> str:
    if not results:
        return "没有检索到可用资料。"
    lines = []
    for index, item in enumerate(results[:8], start=1):
        title = item.title or item.source or "资料"
        location = " / ".join(item.heading_path or [])
        lines.append(f"[{index}] {title}{f'（{location}）' if location else ''}\n{_compact(item.content, 520)}")
    return "\n\n".join(lines)


def _event(event_type: str, title: str, message: str, trace_id: str) -> dict[str, str]:
    return {"type": event_type, "title": title, "message": message, "traceId": trace_id}


def _compact(value: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", value or "").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _decode(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    return str(value)
