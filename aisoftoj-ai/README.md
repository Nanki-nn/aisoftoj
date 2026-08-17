# aisoftoj AI service

This is the Python runtime for the platform's built-in, read-only AI assistant.
It runs beside the Java service and accepts the browser's existing Bearer JWT.
The Python service validates that JWT through Java's internal profile endpoint,
then forwards the same JWT and the private `X-AI-Service-Key` to Java for every
business-tool request.

## Run locally

```bash
cd /Users/bytedance/aisoftoj/aisoftoj-ai
cp config.example.yaml config.yaml
# Edit config.yaml. The AI tables live in the shared aisoftoj MySQL database.
/opt/homebrew/bin/uv sync
/opt/homebrew/bin/uv run alembic upgrade head
/opt/homebrew/bin/uv run python server.py
```

Flyway owns the Java platform tables and Alembic owns only the `ai_*` tables
plus `alembic_version`; both migration systems use the shared `aisoftoj`
database. The AI database account should be restricted to that database.

The service listens on `127.0.0.1:8000` by default. Readiness is exposed at
`/readyz`; liveness is exposed at `/livez`.

## API

- `POST /api/ai/threads` creates a local conversation thread.
- `GET /api/ai/threads` and `GET /api/ai/threads/{thread_id}` read threads.
- `GET /api/ai/threads/{thread_id}/messages` reads persisted messages.
- `POST /api/ai/threads/{thread_id}/runs` starts a run. Send a unique
  `Idempotency-Key` header; retries return the original run.
- `GET /api/ai/threads/{thread_id}/runs/{run_id}/stream` provides resumable SSE.
  Use `Last-Event-ID` or `after_seq` to reconnect.
- `POST /api/ai/threads/{thread_id}/runs/{run_id}/cancel` requests cancellation.

The agent has exactly five platform tools: `get_my_profile`, `list_papers`,
`get_question`, `review_wrong_question`, and `list_practice_history`. There are
no filesystem, shell, subagent, practice-creation, answer-update, submit, or
paper-submission tools. The Java internal API and service key are required for
startup; configure `AI_INTERNAL_SERVICE_KEY` for the Java service and use the
same value as `platform_service_key` in `config.yaml`.

## Production wiring

`deploy/docker/ai-compose.service.yml` is a host-networked service fragment.
Merge it into the production Compose project and provide
`/etc/aisoftoj/ai-config.yaml` with mode `0600`. Run the migration from the AI
image before the first start:

```bash
docker run --rm --network host \
  --env-file /etc/aisoftoj/aisoftoj.env \
  -v /etc/aisoftoj/ai-config.yaml:/etc/aisoftoj/ai-config.yaml:ro \
  -e AGENT_CONFIG_FILE=/etc/aisoftoj/ai-config.yaml \
  aisoftoj-ai:$RELEASE_SHA \
  /app/.venv/bin/alembic -c /app/alembic.ini upgrade head
```

Add `deploy/docker/ai-host-nginx-snippet.conf` before the generic Java
`/api/` location. This keeps browser traffic on the public origin while the
Python process remains bound to loopback.
