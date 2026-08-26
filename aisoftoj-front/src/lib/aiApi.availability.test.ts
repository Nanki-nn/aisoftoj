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
});
