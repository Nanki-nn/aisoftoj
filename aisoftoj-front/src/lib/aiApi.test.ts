import { buildRunRequestBody, parseSSEStream } from './aiApi';

function chunkedStream(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      parts.forEach(part => controller.enqueue(encoder.encode(part)));
      controller.close();
    },
  });
}

describe('AI SSE parser', () => {
  it('parses events split across network chunks and ignores heartbeats', async () => {
    const events: Array<{ event: string; id: number | null; data: Record<string, unknown> }> = [];
    await parseSSEStream(
      chunkedStream([
        ': ping 1\n\nid: 4\nevent: message.',
        'delta\ndata: {"sequence":4,"data":{"delta":"你"}}\n\n',
        'event: stream.end\ndata: {"status":"completed","last_sequence":4}\n\n',
      ]),
      event => events.push(event),
    );

    expect(events).toEqual([
      {
        event: 'message.delta',
        id: 4,
        data: { sequence: 4, data: { delta: '你' } },
      },
      {
        event: 'stream.end',
        id: null,
        data: { status: 'completed', last_sequence: 4 },
      },
    ]);
  });
});

describe('AI run request', () => {
  it('keeps page context separate from the user message', () => {
    expect(buildRunRequestBody('讲讲这题', { questionId: 123 })).toEqual({
      message: '讲讲这题',
      context: { question_id: 123 },
    });
  });

  it('omits context outside question pages', () => {
    expect(buildRunRequestBody('今天学什么')).toEqual({ message: '今天学什么' });
  });
});
