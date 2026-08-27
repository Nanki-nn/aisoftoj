// @vitest-environment jsdom

describe('disabled AI API', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_AI_ASSISTANT_ENABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects regular and streaming calls before fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const api = await import('./aiApi');

    await expect(api.listAIThreads()).rejects.toMatchObject({
      status: 503,
      code: 'FEATURE_NOT_AVAILABLE',
      message: 'AI 助手线上请求暂未开放',
    });
    await expect(api.streamAIRun(
      'thread-1',
      'run-1',
      0,
      new AbortController().signal,
      vi.fn(),
    )).rejects.toMatchObject({
      status: 503,
      code: 'FEATURE_NOT_AVAILABLE',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows administrators to manage quota while the user assistant is disabled', async () => {
    localStorage.setItem('authToken', 'admin-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily_token_limit: 30_000,
        updated_by_user_id: null,
        updated_at: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = await import('./aiApi');

    await expect(api.getAIQuotaConfig()).resolves.toMatchObject({
      daily_token_limit: 30_000,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        records: [],
        total: 0,
        page: 1,
        page_size: 10,
        usage_date: '2026-08-27',
      }),
    });
    await expect(api.listAdminAIQuotaUsage({ date: '2026-08-27' })).resolves.toMatchObject({
      total: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    localStorage.removeItem('authToken');
  });
});
