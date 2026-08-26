describe('AI Skill API', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_AI_ASSISTANT_ENABLED', 'true');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => key === 'authToken' ? 'token-1' : null,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('loads the authenticated Skill metadata envelope', async () => {
    const payload = {
      items: [{
        name: 'essay-writing-coach',
        description: '论文写作教练',
        category: 'public',
        enabled: true,
        license: null,
      }],
      total: 1,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { listAISkills } = await import('./aiApi');

    await expect(listAISkills()).resolves.toEqual(payload);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/ai/skills');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer token-1');
  });
});
