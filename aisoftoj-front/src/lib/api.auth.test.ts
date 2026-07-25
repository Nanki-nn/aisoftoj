import {
  loginByEmailCode,
  registerByEmail,
  requestEmailCode,
  resetPasswordByEmail,
} from './api';

const memoryStorage = new Map<string, string>();
const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

function successResponse(data: unknown = null): Response {
  return new Response(JSON.stringify({
    code: 200,
    message: '操作成功',
    data,
    timestamp: Date.now(),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('email authentication API', () => {
  beforeEach(() => {
    requests.length = 0;
    memoryStorage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => memoryStorage.get(key) ?? null,
        setItem: (key: string, value: string) => memoryStorage.set(key, value),
        removeItem: (key: string) => memoryStorage.delete(key),
        clear: () => memoryStorage.clear(),
      },
    });
    globalThis.fetch = async (input, init) => {
      requests.push({ input, init });
      return successResponse({ token: 'token', user: { id: '1' } });
    };
  });

  it('requests a scene-bound registration code', async () => {
    await requestEmailCode('candidate@example.com', 'REGISTER');

    expect(String(requests[0].input)).toMatch(/\/auth\/email\/code$/);
    expect(requests[0].init?.method).toBe('POST');
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      email: 'candidate@example.com',
      scene: 'REGISTER',
    });
  });

  it('submits the code for passwordless login', async () => {
    await loginByEmailCode({ email: 'candidate@example.com', code: '123456' });

    expect(String(requests[0].input)).toMatch(/\/auth\/email\/login$/);
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      email: 'candidate@example.com',
      code: '123456',
    });
  });

  it('submits email proof and matching passwords for reset', async () => {
    await resetPasswordByEmail({
      email: 'candidate@example.com',
      code: '654321',
      newPassword: 'new-password-123',
      confirmPassword: 'new-password-123',
    });

    expect(String(requests[0].input)).toMatch(/\/auth\/password\/reset$/);
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      email: 'candidate@example.com',
      code: '654321',
      newPassword: 'new-password-123',
      confirmPassword: 'new-password-123',
    });
  });

  it('includes the email code in registration', async () => {
    await registerByEmail({
      username: 'candidate',
      email: 'candidate@example.com',
      emailCode: '123456',
      password: 'password-123',
      confirmPassword: 'password-123',
      phone: '',
      agreeToTerms: true,
    });

    expect(String(requests[0].input)).toMatch(/\/auth\/register$/);
    expect(JSON.parse(String(requests[0].init?.body))).toEqual(expect.objectContaining({
      email: 'candidate@example.com',
      emailCode: '123456',
      agreeToTerms: true,
    }));
  });
});
