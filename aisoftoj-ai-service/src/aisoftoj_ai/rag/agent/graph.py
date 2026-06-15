from langgraph.graph import END, START, StateGraph

from aisoftoj_ai.rag.agent.nodes import build_nodes
from aisoftoj_ai.rag.agent.state import RagState
from aisoftoj_ai.rag.agent.tools import build_tools


def build_rag_graph(chat, search, searxng):
    """构建完整的 RAG LangGraph 工作流。"""
    search_tool, web_tool = build_tools(search, searxng)
    rewrite, retrieve, judge, search_web, answer = build_nodes(chat, search_tool, web_tool)

    graph = StateGraph(RagState)
    graph.add_node("改写查询", rewrite)
    graph.add_node("检索知识库", retrieve)
    graph.add_node("判断证据", judge)
    graph.add_node("搜索互联网", search_web)
    graph.add_node("生成回答", answer)
    graph.add_edge(START, "改写查询")
    graph.add_edge("改写查询", "检索知识库")
    graph.add_edge("检索知识库", "判断证据")
    graph.add_conditional_edges(
        "判断证据",
        lambda state: (
            "生成回答"
            if state["evidence_enough"] or not state.get("web_enabled", False)
            else "搜索互联网"
        ),
        {"生成回答": "生成回答", "搜索互联网": "搜索互联网"},
    )
    graph.add_edge("搜索互联网", "生成回答")
    graph.add_edge("生成回答", END)
    return graph.compile()
