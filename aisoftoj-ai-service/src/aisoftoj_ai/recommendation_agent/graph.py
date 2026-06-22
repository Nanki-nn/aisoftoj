import json
from typing import Any, Literal, TypedDict

import httpx
from deepagents import create_deep_agent
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

from aisoftoj_ai.config import get_settings


class RecommendationAgentState(TypedDict):
    days: int
    daily_minutes: int
    recommendations: list[dict[str, Any]]
    observations: list[str]
    strategy: dict[str, Any]
    roadmap: dict[str, Any]
    next_action: Literal["think", "ask_for_practice"]


def build_recommendation_agent():
    graph = StateGraph(RecommendationAgentState)
    graph.add_node("observe", observe)
    graph.add_node("think", think)
    graph.add_node("ask_for_practice", ask_for_practice)
    graph.add_node("act", act)
    graph.add_edge(START, "observe")
    graph.add_conditional_edges(
        "observe",
        lambda state: state["next_action"],
        {
            "think": "think",
            "ask_for_practice": "ask_for_practice",
        },
    )
    graph.add_edge("think", "act")
    graph.add_edge("ask_for_practice", "act")
    graph.add_edge("act", END)
    return graph.compile()


async def observe(state: RecommendationAgentState) -> dict[str, Any]:
    observations: list[str] = []
    for item in state["recommendations"][:8]:
        name = item.get("name") or "未命名知识点"
        score = int(item.get("score") or 0)
        error_count = int(item.get("errorCount") or 0)
        wrong_count = int(item.get("wrongQuestionCount") or 0)
        evidences = item.get("evidences") or []
        observations.append(
            f"{name}: 薄弱分 {score}, 错误 {error_count} 次, 命中 {wrong_count} 道错题, "
            f"证据 {len(evidences)} 条"
        )
    if not observations:
        return {
            "observations": ["暂无错题证据，需要先完成练习形成诊断样本"],
            "next_action": "ask_for_practice",
        }
    return {"observations": observations, "next_action": "think"}


async def think(state: RecommendationAgentState) -> dict[str, Any]:
    agent = _deepagent()
    prompt = {
        "role": "学习路线规划专家",
        "instruction": "基于软考错题证据和知识点图谱，先判断前置补齐顺序，再输出紧凑 JSON。",
        "days": state["days"],
        "daily_minutes": state["daily_minutes"],
        "observations": state["observations"],
        "recommendations": state["recommendations"],
        "output_schema": {
            "primary": ["优先突破知识点"],
            "prerequisites": ["前置知识点"],
            "related": ["关联扩展知识点"],
            "principle": "路线规划原则",
        },
    }
    result = await agent.ainvoke({"messages": [HumanMessage(content=json.dumps(prompt, ensure_ascii=False))]})
    strategy = _extract_json(_last_content(result))
    if not strategy:
        raise ValueError("学习路线 Agent 未返回有效 JSON 策略")
    return {"strategy": strategy}


async def ask_for_practice(state: RecommendationAgentState) -> dict[str, Any]:
    return {
        "strategy": {
            "primary": ["完成一次综合练习"],
            "prerequisites": [],
            "related": [],
            "principle": "当前缺少错题证据，先通过练习采集诊断样本。",
        }
    }


async def act(state: RecommendationAgentState) -> dict[str, Any]:
    strategy = state.get("strategy") or _rule_strategy(state["recommendations"])
    primary = _as_list(strategy.get("primary")) or ["错题复盘"]
    prerequisites = _as_list(strategy.get("prerequisites"))
    related = _as_list(strategy.get("related"))
    days = state["days"]
    daily_minutes = state["daily_minutes"]
    items: list[dict[str, Any]] = []
    for day in range(1, days + 1):
        point = primary[(day - 1) % len(primary)]
        phase = _phase(day, days)
        knowledge_points = [point]
        if phase == "补前置" and prerequisites:
            knowledge_points = [prerequisites[(day - 1) % len(prerequisites)], point]
        elif phase == "扩关联" and related:
            knowledge_points = [point, related[(day - 1) % len(related)]]
        items.append(
            {
                "day": day,
                "title": f"Day {day} · {phase}",
                "goal": f"围绕「{point}」完成理解、错题复盘和同类练习",
                "knowledgePoints": _unique(knowledge_points),
                "tasks": [
                    f"{max(10, daily_minutes // 3)} 分钟梳理概念边界和常见考法",
                    "回看该知识点关联错题，标出错误原因",
                    "完成一组同类题，记录仍不稳定的选项或关键词",
                ],
                "reviewQuestions": _evidence_names(state["recommendations"], point)[:3],
                "practiceTarget": f"{point} 专项练习 8-12 题",
                "checkpoint": "能用自己的话解释考点，并在同类题中稳定排除干扰项",
            }
        )
    return {
        "roadmap": {
            "days": days,
            "dailyMinutes": daily_minutes,
            "summary": f"Deepagent 已完成观察、思考、行动：{strategy.get('principle') or '先补前置，再攻薄弱点，最后综合巩固。'}",
            "aiEnhanced": True,
            "items": items,
        }
    }


def _deepagent():
    settings = get_settings()

    @tool("analyze_wrong_question_observations")
    async def analyze_wrong_question_observations(observations: list[str]) -> str:
        """观察错题证据，提取高频薄弱点和风险信号。"""
        return "\n".join(observations)

    @tool("plan_knowledge_path")
    async def plan_knowledge_path(recommendations: list[dict[str, Any]]) -> str:
        """根据前置知识、关联知识和薄弱分规划学习路径。"""
        return json.dumps(_rule_strategy(recommendations), ensure_ascii=False)

    return create_deep_agent(
        model=ChatOpenAI(
            base_url=settings.chat_base_url,
            api_key=settings.chat_api_key,
            model=settings.chat_model,
            temperature=0.15,
            timeout=120,
            http_client=httpx.Client(timeout=120, trust_env=False),
            http_async_client=httpx.AsyncClient(timeout=120, trust_env=False),
        ),
        tools=[analyze_wrong_question_observations, plan_knowledge_path],
        system_prompt=(
            "你是知构软考刷题平台的学习路线 Deepagent。必须体现观察、思考、行动："
            "先观察错题证据，再思考知识图谱路径，最后输出可执行学习策略。"
            "输出必须是 JSON，不要 Markdown。"
        ),
    )


def _rule_strategy(recommendations: list[dict[str, Any]]) -> dict[str, Any]:
    sorted_items = sorted(recommendations, key=lambda item: int(item.get("score") or 0), reverse=True)
    primary = _unique([item.get("name") or "" for item in sorted_items])[:6]
    prerequisites: list[str] = []
    related: list[str] = []
    for item in sorted_items:
        prerequisites.extend(item.get("prerequisiteNames") or [])
        related.extend(item.get("relatedNames") or [])
    return {
        "primary": primary or ["错题复盘"],
        "prerequisites": _unique(prerequisites)[:4],
        "related": _unique(related)[:4],
        "principle": "先补前置知识，再集中突破高频错题知识点，最后用关联题巩固迁移。",
    }


def _phase(day: int, days: int) -> str:
    if day <= max(1, days // 4):
        return "补前置"
    if day <= max(2, days * 3 // 4):
        return "攻薄弱"
    return "扩关联"


def _evidence_names(recommendations: list[dict[str, Any]], point: str) -> list[str]:
    for item in recommendations:
        if item.get("name") == point:
            return [
                evidence.get("questionName") or evidence.get("paperName") or point
                for evidence in item.get("evidences") or []
            ]
    return []


def _last_content(result: Any) -> str:
    messages = result.get("messages") if isinstance(result, dict) else None
    if messages:
        return getattr(messages[-1], "content", str(messages[-1]))
    return str(result)


def _extract_json(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except Exception:
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(content[start : end + 1])
            except Exception:
                return {}
    return {}


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _unique(items: list[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        if item and item not in result:
            result.append(item)
    return result
