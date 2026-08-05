import { updatePracticeQuestionRecord } from './api';

const requests: Array<Record<string, unknown>> = [];

function successResponse(data: unknown): Response {
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

describe('revisioned practice answer writes', () => {
  beforeEach(() => {
    requests.length = 0;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null },
    });
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(body);
      return successResponse({
        recordId: 901,
        answerRevision: Number(body.expectedRevision) + 1,
        mutationId: body.mutationId,
        userAnswer: body.userAnswer,
      });
    };
  });

  it('serializes saves for one record and advances the expected revision', async () => {
    await Promise.all([
      updatePracticeQuestionRecord('901', 'A'),
      updatePracticeQuestionRecord('901', 'B'),
    ]);

    expect(requests).toHaveLength(2);
    expect(requests[0].expectedRevision).toBe(0);
    expect(requests[1].expectedRevision).toBe(1);
    expect(requests[0].mutationId).toEqual(expect.any(String));
    expect(requests[1].mutationId).not.toBe(requests[0].mutationId);
  });

  it('does not auto-overwrite after a server revision conflict', async () => {
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(body);
      return new Response(JSON.stringify({
        code: 409,
        message: '答案版本冲突',
        data: {
          recordId: 902,
          answerRevision: 5,
          mutationId: 'server-mutation',
          userAnswer: 'C',
        },
        timestamp: Date.now(),
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const results = await Promise.allSettled([
      updatePracticeQuestionRecord('902', 'A'),
      updatePracticeQuestionRecord('902', 'B'),
    ]);

    expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(requests).toHaveLength(1);
  });
});
