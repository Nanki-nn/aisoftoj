import { continuePracticeSession, fetchPracticeSessionResult } from './api';
import {
  CONTENT_CRYPTO_ENCRYPTED_HEADER,
  CONTENT_CRYPTO_PUBLIC_KEY_HEADER,
  resetContentCryptoForTests,
} from './contentCrypto';
import { encryptForBrowserPublicKey } from './contentCrypto.test-utils';

async function successResponse(data: unknown, init?: RequestInit): Promise<Response> {
  const publicKey = new Headers(init?.headers).get(CONTENT_CRYPTO_PUBLIC_KEY_HEADER);
  if (!publicKey) {
    throw new Error('missing content crypto public key');
  }
  const envelope = await encryptForBrowserPublicKey(publicKey, {
    code: 200,
    message: '操作成功',
    data,
    timestamp: Date.now(),
  });
  return new Response(JSON.stringify(envelope), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      [CONTENT_CRYPTO_ENCRYPTED_HEADER]: '1',
    },
  });
}

function sessionResponse(status: number, answer: string | null, analysis: string | null) {
  return {
    id: 12,
    paperId: 3,
    paperName: '测试试卷',
    examMode: 'practice',
    status,
    paper: { paperCateId: 1, subjectName: '系统架构设计师' },
    questionList: [{
      id: 9,
      name: '测试题',
      intro: '题干',
      options: [],
      answer,
      analysis,
      questionType: 2,
      difficulty: 2,
      questionRecordId: 30,
    }],
  };
}

describe('server-side answer visibility', () => {
  beforeEach(() => {
    resetContentCryptoForTests();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
      },
    });
  });

  it('maps an ongoing redacted multiple-choice question without crashing', async () => {
    globalThis.fetch = async (_input, init) => successResponse(sessionResponse(0, null, null), init);

    const session = await continuePracticeSession('12');

    expect(session.questions[0].correctAnswer).toEqual([]);
    expect(session.questions[0].explanation).toBe('');
    expect(session.isCompleted).toBe(false);
  });

  it('loads completed review content only from the result endpoint', async () => {
    const paths: string[] = [];
    globalThis.fetch = async (input, init) => {
      const path = String(input);
      paths.push(path);
      return path.endsWith('/result')
        ? successResponse(sessionResponse(1, 'A,B', '完成解析'), init)
        : successResponse(sessionResponse(1, null, null), init);
    };

    const session = await continuePracticeSession('12');

    expect(paths.map(path => new URL(path).pathname)).toEqual([
      '/session/12',
      '/session/12/result',
    ]);
    expect(session.questions[0].correctAnswer).toEqual(['A', 'B']);
    expect(session.questions[0].explanation).toBe('完成解析');
    expect(session.isCompleted).toBe(true);
  });

  it('supports direct cold-start result recovery', async () => {
    let requestedPath = '';
    globalThis.fetch = async (input, init) => {
      requestedPath = new URL(String(input)).pathname;
      return successResponse(sessionResponse(1, 'A,B', '完成解析'), init);
    };

    await fetchPracticeSessionResult('12');

    expect(requestedPath).toBe('/session/12/result');
  });
});
