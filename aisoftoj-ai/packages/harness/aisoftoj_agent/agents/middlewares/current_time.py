"""每次模型调用前把服务器当前时间注入系统提示词。

agent graph 只在服务启动时构建一次，因此不能把时间写死在 SYSTEM_PROMPT 里，
否则模型看到的一直是启动时刻。这里通过中间件在每个模型调用前刷新当前时间，
保证模型能感知实时日期，正确处理考试日期、倒计时、当天计划等时间相关提问。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain_core.messages import SystemMessage

_TIME_BLOCK_TAG = "<aisoftoj-current-time>"
_TIME_BLOCK_END = "</aisoftoj-current-time>"

_WEEKDAYS = ("星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日")


def format_current_time(now: datetime | None = None) -> str:
    """把当前时刻格式化为模型可见的自然语言描述。

    输出包含日期、时分秒、星期与 UTC 偏移，偏移标识保证不同时区部署下时间依然无歧义。
    """
    moment = now or datetime.now().astimezone()
    offset = moment.utcoffset() or UTC.utcoffset(None)
    total_minutes = int(offset.total_seconds() // 60)
    sign = "+" if total_minutes >= 0 else "-"
    abs_minutes = abs(total_minutes)
    offset_label = f"UTC{sign}{abs_minutes // 60:02d}:{abs_minutes % 60:02d}"
    return (
        f"{moment.year}年{moment.month:02d}月{moment.day:02d}日 "
        f"{moment.hour:02d}:{moment.minute:02d}:{moment.second:02d}"
        f"（{_WEEKDAYS[moment.weekday()]}，{offset_label}）"
    )


def _time_block(now: datetime | None = None) -> str:
    return (
        f"{_TIME_BLOCK_TAG}\n"
        f"当前时间：{format_current_time(now)}。\n"
        "涉及考试日期、倒计时、当天计划或任何日期时间判断时，一律以该时间为准。\n"
        f"{_TIME_BLOCK_END}"
    )


def _strip_time_block(content: str) -> str:
    """移除可能存在的旧时间块（含重复注入产生的多个块），返回清理后的内容。"""
    while True:
        start = content.find(_TIME_BLOCK_TAG)
        if start == -1:
            break
        end = content.find(_TIME_BLOCK_END, start)
        if end == -1:
            # 缺少闭合标签的异常情况：删除到行尾
            end = content.find("\n", start)
            end = len(content) if end == -1 else end
        else:
            end += len(_TIME_BLOCK_END)
        content = content[:start] + content[end:]
    return content.strip("\n")


class CurrentTimeMiddleware(AgentMiddleware[Any, Any, Any]):
    """在每个模型调用前把服务器当前时间注入系统提示词。"""

    def __init__(self, clock: Callable[[], datetime] | None = None) -> None:
        self._clock = clock or (lambda: datetime.now().astimezone())

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
    ) -> ModelResponse[Any]:
        return await handler(self._prepare(request))

    def _prepare(self, request: ModelRequest[Any]) -> ModelRequest[Any]:
        block = _time_block(self._clock())
        base = request.system_message
        base_content = _message_text(base) if base is not None else ""
        base_content = _strip_time_block(base_content)
        content = f"{block}\n\n{base_content}" if base_content else block
        return request.override(system_message=SystemMessage(content=content))


def _message_text(message: Any) -> str:
    content = getattr(message, "content", None)
    if not isinstance(content, str):
        raise TypeError("message content must be text")
    return content
