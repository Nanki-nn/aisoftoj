// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { useAIConversation } from './useAIConversation';

const apiMocks = vi.hoisted(() => ({
  cancelAIRun: vi.fn(),
  createAIRun: vi.fn(),
  createAIThread: vi.fn(),
  getAIRun: vi.fn(),
  listAIMessages: vi.fn(),
  listAIRunEvents: vi.fn(),
  listAIRuns: vi.fn(),
  listAIThreads: vi.fn(),
  runAIStreamSession: vi.fn(),
}));

vi.mock('../lib/aiApi', () => ({
  AIApiError: class AIApiError extends Error {},
  ...apiMocks,
}));

vi.mock('../lib/aiRunSession', () => ({
  runAIStreamSession: apiMocks.runAIStreamSession,
}));

describe('useAIConversation unavailable state', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach(mock => mock.mockReset());
  });

  it('does not call any AI API from initialization or public actions', async () => {
    const { result } = renderHook(() => useAIConversation({
      active: true,
      available: false,
    }));

    await act(async () => {
      result.current.sendMessage('test');
      result.current.retryMessage('message-1');
      await result.current.cancelCurrentRun();
      await result.current.newConversation();
      await result.current.selectThread({
        id: 'thread-1',
        title: 'thread',
        created_at: '2026-08-26T00:00:00Z',
        updated_at: '2026-08-26T00:00:00Z',
      });
    });

    Object.values(apiMocks).forEach(mock => {
      expect(mock).not.toHaveBeenCalled();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isGenerating).toBe(false);
  });
});
