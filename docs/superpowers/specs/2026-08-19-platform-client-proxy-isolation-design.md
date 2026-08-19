# Platform Client Proxy Isolation Design

## Problem

The AI service uses `PlatformClient` to call the Java service on a loopback URL.
`httpx.AsyncClient` currently trusts system proxy settings, so macOS can route
`127.0.0.1:8080` through a desktop proxy. A proxy failure is then surfaced as
`PLATFORM_UNAVAILABLE`, causing authenticated AI thread requests to return 503.

## Design

Set `trust_env=False` only on the `httpx.AsyncClient` owned by
`PlatformClient`. This client is restricted by configuration validation to a
loopback platform URL, so it must never use environment or system proxies.

Do not change the LLM client. External model requests may still require the
user's configured proxy.

## Verification

- Add a focused test that intercepts `httpx.AsyncClient` construction and
  asserts `trust_env` is disabled while preserving the configured base URL.
- Run the platform-client tests and the full AI test suite.
- Verify a real `PlatformClient` request reaches the local Java service without
  setting `NO_PROXY`.

