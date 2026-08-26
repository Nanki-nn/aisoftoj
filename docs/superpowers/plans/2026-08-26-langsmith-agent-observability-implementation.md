# LangSmith Agent Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in, secret-safe LangSmith SaaS tracing to every Python Agent run without changing Agent business outcomes when trace export fails.

**Architecture:** A focused observability package parses LangSmith environment configuration, recursively redacts credentials, and owns the LangSmith `Client`. `Worker` opens one tracing context around the existing LangGraph `astream` call and passes root run name, tags, and business metadata through `RunnableConfig`; FastAPI lifespan creates and closes the provider.

**Tech Stack:** Python 3.12, LangSmith 0.11.x, LangChain/LangGraph RunnableConfig, FastAPI lifespan, Pydantic SecretStr, pytest, Ruff, mypy, uv.

---

> Corresponding spec: `docs/superpowers/specs/2026-08-26-langsmith-agent-observability-design.md`

## File map

- Create `aisoftoj-ai/packages/harness/aisoftoj_agent/observability/__init__.py`: public exports only.
- Create `aisoftoj-ai/packages/harness/aisoftoj_agent/observability/config.py`: environment parsing and validation, with no SDK/network work.
- Create `aisoftoj-ai/packages/harness/aisoftoj_agent/observability/redaction.py`: pure recursive secret redaction.
- Create `aisoftoj-ai/packages/harness/aisoftoj_agent/observability/langsmith.py`: Client construction, tracing context, safe error callback, bounded close.
- Create `aisoftoj-ai/tests/harness/observability/test_config.py`: configuration contract tests.
- Create `aisoftoj-ai/tests/harness/observability/test_redaction.py`: redaction and preservation tests.
- Create `aisoftoj-ai/tests/harness/observability/test_langsmith.py`: provider, context, error and close tests with fake clients.
- Modify `aisoftoj-ai/packages/harness/aisoftoj_agent/runtime/worker.py`: inject provider and merge its RunnableConfig into graph execution.
- Modify `aisoftoj-ai/tests/harness/runtime/test_worker_streaming.py`: prove root metadata/config injection without network.
- Modify `aisoftoj-ai/app/lifespan.py`: create provider, inject it, and close after run drain.
- Modify `aisoftoj-ai/tests/app/test_api.py`: keep manual AppState construction compatible and check disabled default.
- Modify `aisoftoj-ai/pyproject.toml` and `aisoftoj-ai/uv.lock`: make LangSmith an explicit dependency while retaining the locked 0.11.x version.
- Modify `aisoftoj-ai/config.example.yaml`, `aisoftoj-ai/README.md`: document environment-only secrets, sampling, validation and manual verification.
- Inspect only `deploy/docker/ai-compose.service.yml`: its existing `env_file` already forwards LangSmith variables, so no edit is expected.

### Task 1: Environment configuration contract

**Files:**
- Create: `aisoftoj-ai/packages/harness/aisoftoj_agent/observability/config.py`
- Create: `aisoftoj-ai/packages/harness/aisoftoj_agent/observability/__init__.py`
- Test: `aisoftoj-ai/tests/harness/observability/test_config.py`

- [ ] **Step 1: Write failing configuration tests**

Create tests that exercise only an injected mapping, never the real process environment:

```python
def enabled_env(**overrides: str) -> dict[str, str]:
    result = {
        "LANGSMITH_TRACING": "true",
        "LANGSMITH_API_KEY": "lsv2_test_secret_value",
    }
    result.update(overrides)
    return result


def test_tracing_is_disabled_without_environment() -> None:
    config = LangSmithConfig.from_env({})
    assert config.enabled is False
    assert config.api_key is None


def test_enabled_tracing_requires_api_key() -> None:
    with pytest.raises(ValueError, match="LANGSMITH_API_KEY"):
        LangSmithConfig.from_env({"LANGSMITH_TRACING": "true"})


@pytest.mark.parametrize("value", ["nan", "inf", "-0.1", "1.1"])
def test_sampling_rate_must_be_finite_unit_interval(value: str) -> None:
    with pytest.raises(ValueError, match="SAMPLING_RATE"):
        LangSmithConfig.from_env(enabled_env(LANGSMITH_TRACING_SAMPLING_RATE=value))


def test_enabled_configuration_uses_documented_defaults() -> None:
    config = LangSmithConfig.from_env(enabled_env())
    assert config.project == "aisoftoj-agent-dev"
    assert config.environment == "development"
    assert config.agent_version == "local"
    assert config.sampling_rate == 1.0
    assert config.flush_timeout_seconds == 2.0
```

- [ ] **Step 2: Run the tests and verify import failure**

Run:

```bash
cd aisoftoj-ai
uv run pytest tests/harness/observability/test_config.py -q
```

Expected: collection fails because `observability.config` does not exist.

- [ ] **Step 3: Implement the immutable environment configuration**

Implement a frozen, slotted dataclass with this public shape:

```python
@dataclass(frozen=True, slots=True)
class LangSmithConfig:
    enabled: bool
    api_key: SecretStr | None
    endpoint: str
    project: str
    sampling_rate: float
    environment: str
    agent_version: str
    flush_timeout_seconds: float

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> LangSmithConfig:
        source = os.environ if environ is None else environ
        enabled = _parse_bool(source.get("LANGSMITH_TRACING", "false"))
        if not enabled:
            return cls(False, None, DEFAULT_ENDPOINT, DEFAULT_PROJECT, 1.0, "development", "local", 2.0)
        # Read, trim, and validate all remaining documented variables.
```

Validation must use `math.isfinite`, `urllib.parse.urlsplit`, `str.isprintable`, and
`re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", value)`. Accept true values
`1,true,yes,on` and false values `0,false,no,off,''`, case-insensitively; reject any other boolean.
Project is 1..128 printable characters after trimming, endpoint has scheme `http` or `https` and a
non-empty netloc, sampling is `0 <= value <= 1`, and flush timeout is finite in `0.1..10`.

- [ ] **Step 4: Run focused tests and static checks**

```bash
cd aisoftoj-ai
uv run pytest tests/harness/observability/test_config.py -q
uv run ruff check packages/harness/aisoftoj_agent/observability tests/harness/observability
uv run mypy packages/harness/aisoftoj_agent/observability
```

Expected: all commands pass.

- [ ] **Step 5: Commit configuration unit**

```bash
git add aisoftoj-ai/packages/harness/aisoftoj_agent/observability/__init__.py \
  aisoftoj-ai/packages/harness/aisoftoj_agent/observability/config.py \
  aisoftoj-ai/tests/harness/observability/test_config.py
git commit -m "feat(ai): define LangSmith tracing configuration"
```

### Task 2: Recursive secret redaction

**Files:**
- Create: `aisoftoj-ai/packages/harness/aisoftoj_agent/observability/redaction.py`
- Test: `aisoftoj-ai/tests/harness/observability/test_redaction.py`

- [ ] **Step 1: Write failing redaction tests**

Cover normalized sensitive keys, explicit runtime secrets, every specified credential pattern,
nested containers, and preservation of normal Agent content:

```python
def test_redacts_sensitive_keys_without_removing_token_metrics() -> None:
    redactor = SecretRedactor([])
    result = redactor({
        "authorization": "Bearer abcdefgh1234",
        "platform-service-key": "platform-secret",
        "prompt_tokens": 321,
    })
    assert result == {
        "authorization": REDACTED,
        "platform-service-key": REDACTED,
        "prompt_tokens": 321,
    }


def test_redacts_explicit_secrets_and_bearer_values_inside_text() -> None:
    redactor = SecretRedactor(["llm-secret-123", "service-secret-456"])
    value = {"text": "keys llm-secret-123; Authorization: Bearer abcdefgh.123456"}
    rendered = redactor(value)["text"]
    assert "llm-secret-123" not in rendered
    assert "abcdefgh.123456" not in rendered
    assert REDACTED in rendered


@pytest.mark.parametrize("credential", [
    "sk-proj-abcdefghijklmnop",
    "sk-ant-abcdefghijklmnop",
    "sk-abcdefghijklmnop",
    "AIzaabcdefghijklmnopqrst",
    "ghp_abcdefghijklmnopqrst",
    "github_pat_abcdefghijklmnopqrst",
    "xoxb-abcdefghijklmnop",
])
def test_redacts_supported_credential_patterns(credential: str) -> None:
    assert credential not in SecretRedactor([])({"text": credential})["text"]


def test_preserves_complete_business_content() -> None:
    payload = {"question": "令牌桶算法是什么？", "answer": ["完整解析", {"score": 0.9}]}
    assert SecretRedactor([])(payload) == payload


def test_hides_provider_reasoning_but_preserves_visible_text() -> None:
    payload = {
        "additional_kwargs": {"reasoning_content": "private chain"},
        "content": [
            {"type": "reasoning", "reasoning": "private block"},
            {"type": "text", "text": "visible answer"},
        ],
    }
    result = SecretRedactor([])(payload)
    assert result["additional_kwargs"]["reasoning_content"] == HIDDEN_REASONING
    assert result["content"][0]["reasoning"] == HIDDEN_REASONING
    assert result["content"][1]["text"] == "visible answer"
```

- [ ] **Step 2: Run tests and verify missing implementation**

```bash
cd aisoftoj-ai
uv run pytest tests/harness/observability/test_redaction.py -q
```

Expected: import or symbol failure for `SecretRedactor`.

- [ ] **Step 3: Implement a pure non-mutating redactor**

Use exact normalized key names from the spec, precompiled regexes in longest-prefix-first order,
and explicit secrets sorted longest first:

```python
REDACTED = "[REDACTED]"
HIDDEN_REASONING = "[HIDDEN_REASONING]"
SENSITIVE_KEYS = frozenset({
    "apikey", "authorization", "cookie", "setcookie", "token", "accesstoken",
    "refreshtoken", "bearertoken", "password", "secret", "servicekey",
    "llmapikey", "platformservicekey", "langsmithapikey",
})


class SecretRedactor:
    def __init__(self, secrets: Iterable[str]) -> None:
        self._secrets = tuple(sorted({item for item in secrets if len(item) >= 8}, key=len, reverse=True))

    def __call__(self, payload: dict[str, Any]) -> dict[str, Any]:
        return cast(dict[str, Any], self._redact(payload))

    def _redact(self, value: Any) -> Any:
        if isinstance(value, Mapping):
            return {
                key: REDACTED if _is_sensitive_key(key) else self._redact(item)
                for key, item in value.items()
            }
        if isinstance(value, list):
            return [self._redact(item) for item in value]
        if isinstance(value, tuple):
            return tuple(self._redact(item) for item in value)
        if isinstance(value, str):
            return self._redact_text(value)
        return value
```

`_redact_text` first replaces exact secrets with `str.replace`, then replaces the compiled Bearer
and API-key patterns with `REDACTED`. Do not log either the original payload or matched secret.

- [ ] **Step 4: Run focused tests and quality checks**

```bash
cd aisoftoj-ai
uv run pytest tests/harness/observability/test_redaction.py -q
uv run ruff check packages/harness/aisoftoj_agent/observability/redaction.py \
  tests/harness/observability/test_redaction.py
uv run mypy packages/harness/aisoftoj_agent/observability/redaction.py
```

Expected: all pass.

- [ ] **Step 5: Commit redaction unit**

```bash
git add aisoftoj-ai/packages/harness/aisoftoj_agent/observability/redaction.py \
  aisoftoj-ai/tests/harness/observability/test_redaction.py
git commit -m "feat(ai): redact secrets from Agent traces"
```

### Task 3: LangSmith provider and explicit dependency

**Files:**
- Create: `aisoftoj-ai/packages/harness/aisoftoj_agent/observability/langsmith.py`
- Modify: `aisoftoj-ai/packages/harness/aisoftoj_agent/observability/__init__.py`
- Modify: `aisoftoj-ai/pyproject.toml`
- Modify: `aisoftoj-ai/uv.lock`
- Test: `aisoftoj-ai/tests/harness/observability/test_langsmith.py`

- [ ] **Step 1: Write failing provider tests with no network**

Use a fake Client factory that records constructor arguments and `close(timeout=2.0)`. Patch the
module-level `tracing_context` with a recording context manager. Assert:

```python
def test_disabled_provider_does_not_construct_client(settings: Settings) -> None:
    factory = Mock()
    provider = build_langsmith_tracing(settings, environ={}, client_factory=factory)
    assert provider.enabled is False
    factory.assert_not_called()


def test_enabled_provider_builds_batched_secret_safe_client(settings: Settings) -> None:
    provider = build_langsmith_tracing(
        settings,
        environ=enabled_env(),
        client_factory=client_factory,
    )
    kwargs = client_factory.call_args.kwargs
    assert kwargs["api_url"] == "https://api.smith.langchain.com"
    assert kwargs["auto_batch_tracing"] is True
    assert kwargs["tracing_sampling_rate"] == 1.0
    assert callable(kwargs["anonymizer"])
    assert callable(kwargs["tracing_error_callback"])
    assert provider.enabled is True


def test_trace_run_yields_root_runnable_config(provider: LangSmithTracing) -> None:
    with provider.trace_run(
        run_id="run-1", thread_id="thread-1", user_id=7,
        question_id=None, model="gpt-test",
    ) as runnable:
        assert runnable["run_name"] == "aisoftoj-agent-run"
        assert runnable["metadata"]["question_id"] is None
        assert "environment:development" in runnable["tags"]


async def test_close_passes_one_whole_sequence_timeout(fake_client: FakeClient) -> None:
    await provider.aclose()
    assert fake_client.close_calls == [2.0]
```

Also call the tracing error callback with an exception containing a sentinel secret and use `caplog`
to prove the log contains only `event=langsmith_trace_export_failed` and exception type.

- [ ] **Step 2: Run tests and verify missing provider**

```bash
cd aisoftoj-ai
uv run pytest tests/harness/observability/test_langsmith.py -q
```

Expected: import/symbol failure.

- [ ] **Step 3: Declare and lock the direct dependency**

Add this runtime dependency to `pyproject.toml`:

```toml
"langsmith>=0.11,<0.12",
```

Then run:

```bash
cd aisoftoj-ai
uv lock
uv sync --frozen
```

Expected: `uv.lock` lists LangSmith under the root `aisoftoj-ai` dependencies and retains a 0.11.x
resolved package.

- [ ] **Step 4: Implement provider construction and trace context**

Expose these public operations:

```python
class LangSmithTracing:
    @classmethod
    def disabled(cls) -> LangSmithTracing:
        return cls(LangSmithConfig.from_env({}), None)

    @property
    def enabled(self) -> bool:
        return self._client is not None

    @contextmanager
    def trace_run(
        self, *, run_id: str, thread_id: str, user_id: int,
        question_id: int | None, model: str,
    ) -> Iterator[RunnableConfig]:
        metadata = {
            "run_id": run_id,
            "thread_id": thread_id,
            "user_id": user_id,
            "question_id": question_id,
            "agent_name": "aisoftoj-assistant",
            "agent_version": self.config.agent_version,
            "model": model,
            "environment": self.config.environment,
        }
        tags = [
            f"environment:{self.config.environment}",
            "agent:aisoftoj-assistant",
            f"agent-version:{self.config.agent_version}",
        ]
        kwargs = {
            "parent": False,
            "enabled": self.enabled,
            "client": self._client,
            "project_name": self.config.project if self.enabled else None,
            "tags": tags,
            "metadata": metadata,
        }
        with tracing_context(**kwargs):
            yield RunnableConfig(
                run_name="aisoftoj-agent-run",
                tags=tags,
                metadata=metadata,
            )

    async def aclose(self) -> None:
        if self._client is None:
            return
        try:
            await asyncio.to_thread(
                self._client.close,
                timeout=self.config.flush_timeout_seconds,
            )
        except Exception as exc:
            logger.warning(
                "event=langsmith_trace_close_failed error_type=%s",
                type(exc).__name__,
            )


def build_langsmith_tracing(
    settings: Settings,
    *,
    environ: Mapping[str, str] | None = None,
    client_factory: Callable[..., Client] = Client,
) -> LangSmithTracing:
    config = LangSmithConfig.from_env(environ)
    if not config.enabled or config.api_key is None:
        return LangSmithTracing(config, None)
    api_key = config.api_key.get_secret_value()
    redactor = SecretRedactor([
        settings.llm_api_key.get_secret_value(),
        settings.platform_service_key.get_secret_value(),
        api_key,
    ])
    client = client_factory(
        api_url=config.endpoint,
        api_key=api_key,
        auto_batch_tracing=True,
        anonymizer=redactor,
        tracing_sampling_rate=config.sampling_rate,
        tracing_error_callback=_trace_error,
    )
    return LangSmithTracing(config, client)
```

Add an explicit `__init__(self, config: LangSmithConfig, client: Client | None)` that stores both
values. `_trace_error` logs only `event=langsmith_trace_export_failed` and the exception type. The
disabled implementation enters `tracing_context(enabled=False, parent=False)` so ambient process
configuration cannot accidentally enable export.

`aclose` calls `await asyncio.to_thread(client.close, timeout=flush_timeout_seconds)`. Catch and
log only exception type; do not call `flush` separately because LangSmith 0.11 `Client.close`
already performs the bounded drain.

- [ ] **Step 5: Run focused provider and package checks**

```bash
cd aisoftoj-ai
uv run pytest tests/harness/observability -q
uv run ruff check packages/harness/aisoftoj_agent/observability tests/harness/observability
uv run mypy packages/harness/aisoftoj_agent/observability
```

Expected: all pass and no HTTP request is made by tests.

- [ ] **Step 6: Commit provider and dependency**

```bash
git add aisoftoj-ai/pyproject.toml aisoftoj-ai/uv.lock \
  aisoftoj-ai/packages/harness/aisoftoj_agent/observability \
  aisoftoj-ai/tests/harness/observability
git commit -m "feat(ai): add LangSmith tracing provider"
```

### Task 4: Worker root Trace integration

**Files:**
- Modify: `aisoftoj-ai/packages/harness/aisoftoj_agent/runtime/worker.py`
- Modify: `aisoftoj-ai/tests/harness/runtime/test_worker_streaming.py`

- [ ] **Step 1: Extend the existing streaming test with a recording provider**

Add a fake context manager and make `FakeGraph` save the kwargs passed to `astream`:

```python
class RecordingTracing:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    @contextmanager
    def trace_run(self, **metadata: object):
        self.calls.append(metadata)
        yield {
            "run_name": "aisoftoj-agent-run",
            "tags": ["environment:test"],
            "metadata": metadata,
        }


async def test_worker_passes_business_metadata_to_root_trace() -> None:
    tracing = RecordingTracing()
    graph = FakeGraph()
    worker = prepared_worker(graph=graph, tracing=tracing, question_id=123)
    await worker._execute("run-1", agent_context())
    assert tracing.calls == [{
        "run_id": "run-1", "thread_id": "thread-1", "user_id": 1,
        "question_id": 123, "model": "test-model",
    }]
    assert graph.kwargs["config"]["run_name"] == "aisoftoj-agent-run"
    assert graph.kwargs["config"]["configurable"] == {"thread_id": "run-1"}
```

- [ ] **Step 2: Run the focused test and verify constructor/config failure**

```bash
cd aisoftoj-ai
uv run pytest tests/harness/runtime/test_worker_streaming.py::test_worker_passes_business_metadata_to_root_trace -q
```

Expected: failure because Worker has no tracing dependency and FakeGraph does not capture config.

- [ ] **Step 3: Inject tracing without restructuring current Worker behavior**

Add optional constructor parameters that preserve all current tests:

```python
def __init__(
    self,
    session_factory: async_sessionmaker[AsyncSession],
    agent: AgentGraph,
    stream_bridge: StreamBridge,
    *,
    max_run_seconds: int,
    tracing: LangSmithTracing | None = None,
    model_name: str = "unknown",
) -> None:
    self.session_factory = session_factory
    self.agent = agent
    self.stream_bridge = stream_bridge
    self.event_sequence = RunEventSequence()
    self.max_run_seconds = max_run_seconds
    self.tracing = tracing or LangSmithTracing.disabled()
    self.model_name = model_name
```

Inside `_execute`, after loading `question_id` and before `graph.astream`, open:

```python
with self.tracing.trace_run(
    run_id=run_id,
    thread_id=context.thread_id,
    user_id=context.user_id,
    question_id=question_id,
    model=self.model_name,
) as trace_config:
    graph_config: RunnableConfig = {
        **trace_config,
        "configurable": {"thread_id": run_id},
    }
```

Pass `graph_config` to the existing `self.agent.graph.astream` call, then indent the current stream
loop under the context manager without changing its arguments or body.

Extract the existing stream loop into a narrowly named private method only if required to avoid a
large indentation-only diff. Do not alter Skill activation, process note, event sequencing, hidden
reasoning filtering or completion behavior.

- [ ] **Step 4: Run Worker regression tests**

```bash
cd aisoftoj-ai
uv run pytest tests/harness/runtime/test_worker_streaming.py \
  tests/harness/runtime/test_worker_context.py \
  tests/harness/runtime/test_event_contracts.py -q
uv run ruff check packages/harness/aisoftoj_agent/runtime/worker.py \
  tests/harness/runtime/test_worker_streaming.py
uv run mypy packages/harness/aisoftoj_agent/runtime/worker.py
```

Expected: all pass.

- [ ] **Step 5: Commit Worker integration**

```bash
git add aisoftoj-ai/packages/harness/aisoftoj_agent/runtime/worker.py \
  aisoftoj-ai/tests/harness/runtime/test_worker_streaming.py
git commit -m "feat(ai): trace Agent runs with business metadata"
```

### Task 5: FastAPI lifecycle wiring and safe shutdown

**Files:**
- Modify: `aisoftoj-ai/app/lifespan.py`
- Modify: `aisoftoj-ai/tests/app/test_api.py`
- Test: `aisoftoj-ai/tests/app/test_lifespan_observability.py`

- [ ] **Step 1: Write lifecycle tests around provider injection and close ordering**

Patch `build_langsmith_tracing` to return a fake provider. Assert the Worker receives the same
provider, AppState exposes it, and shutdown calls `aclose` once after `run_manager.shutdown`.
Use `AsyncMock` and a call list rather than starting a real Client or database.

Also keep direct `AppState` construction in `test_api.py` valid by asserting its default
provider is disabled:

```python
assert app.state.container.langsmith_tracing.enabled is False
```

- [ ] **Step 2: Run lifecycle tests and verify missing state/wiring**

```bash
cd aisoftoj-ai
uv run pytest tests/app/test_lifespan_observability.py tests/app/test_api.py -q
```

Expected: failure because AppState has no provider field and lifespan does not build/close it.

- [ ] **Step 3: Wire provider into AppState, Worker and shutdown**

Add after existing defaulted AppState fields:

```python
langsmith_tracing: LangSmithTracing = field(default_factory=LangSmithTracing.disabled)
```

In lifespan, build once after settings/logging are ready:

```python
langsmith_tracing = build_langsmith_tracing(settings)
worker = Worker(
    session_factory,
    agent,
    stream_bridge,
    max_run_seconds=settings.agent_max_run_seconds,
    tracing=langsmith_tracing,
    model_name=settings.llm_default_model,
)
```

Store it in AppState. In `finally`, after
`await run_manager.shutdown(settings.shutdown_drain_seconds)`, execute
`await langsmith_tracing.aclose()` before closing the platform HTTP client and database engine.
`aclose` owns its error suppression so the remaining cleanup always executes.

- [ ] **Step 4: Run APP and regression tests**

```bash
cd aisoftoj-ai
uv run pytest tests/app/test_lifespan_observability.py tests/app -q
uv run ruff check app/lifespan.py tests/app
uv run mypy app/lifespan.py
```

Expected: all pass.

- [ ] **Step 5: Commit lifecycle integration**

```bash
git add aisoftoj-ai/app/lifespan.py aisoftoj-ai/tests/app/test_api.py \
  aisoftoj-ai/tests/app/test_lifespan_observability.py
git commit -m "feat(ai): manage LangSmith tracing lifecycle"
```

### Task 6: Operator documentation and full verification

**Files:**
- Modify: `aisoftoj-ai/README.md`
- Modify: `aisoftoj-ai/config.example.yaml`
- Inspect: `deploy/docker/ai-compose.service.yml`

- [ ] **Step 1: Document local opt-in and production sampling**

Add a README section containing exact examples:

```bash
# Local/test: full tracing
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY='replace-me'
export LANGSMITH_PROJECT='aisoftoj-agent-dev'
export LANGSMITH_ENVIRONMENT='development'
export LANGSMITH_AGENT_VERSION='local'
export LANGSMITH_TRACING_SAMPLING_RATE='1.0'
export LANGSMITH_FLUSH_TIMEOUT_SECONDS='2'
```

Document that production starts at `0.2`, input/output and Tool payloads are visible in LangSmith,
credential fields/patterns are redacted, hidden reasoning is not intentionally collected, invalid
enabled configuration prevents startup, export failure does not fail Agent runs, and disabling is
`LANGSMITH_TRACING=false` or removing the variable.

Add only a comment to `config.example.yaml` stating LangSmith credentials are environment-only.
Do not duplicate API Key values into YAML.

- [ ] **Step 2: Confirm deployment already passes environment variables**

Inspect `deploy/docker/ai-compose.service.yml` and verify the existing
`env_file: /etc/aisoftoj/aisoftoj.env` is present. Do not edit Compose unless that line is absent.

- [ ] **Step 3: Run dependency and focused test verification**

```bash
cd aisoftoj-ai
uv lock --check
uv sync --frozen
uv run pytest tests/harness/observability tests/harness/runtime/test_worker_streaming.py \
  tests/app/test_lifespan_observability.py -q
```

Expected: lock is current, sync succeeds, and all focused tests pass.

- [ ] **Step 4: Run full AI service quality gates**

```bash
cd aisoftoj-ai
uv run ruff check .
uv run mypy app packages config.py server.py
uv run pytest
```

Expected: all commands pass. If an unrelated pre-existing failure occurs, record the exact command
and failure without changing unrelated code.

- [ ] **Step 5: Review the final diff for scope and secrets**

```bash
git diff --check
git status --short
git diff -- aisoftoj-ai deploy/docker/ai-compose.service.yml
rg -n "LANGSMITH_API_KEY=.*[^'=]" aisoftoj-ai deploy || true
```

Expected: only planned LangSmith files are changed, no real key is present, and unrelated untracked
`.superpowers/brainstorm` and `aisoft-ai` files remain untouched.

- [ ] **Step 6: Commit documentation and any final test-only fixes**

```bash
git add aisoftoj-ai/README.md aisoftoj-ai/config.example.yaml
git commit -m "docs(ai): document LangSmith tracing operations"
```

- [ ] **Step 7: Perform manual SaaS smoke test when credentials are available**

Start the service with a development LangSmith Project, issue one Agent request that invokes a
Tool, and verify in LangSmith UI that the `aisoftoj-agent-run` root has Agent/LLM/Tool children,
business metadata, complete safe content, and no sentinel secret. If credentials are unavailable,
report this manual check as pending; automated tests and offline service behavior remain required.
