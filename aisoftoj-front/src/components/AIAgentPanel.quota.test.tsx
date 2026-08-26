// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

const panelMocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  retryMessage: vi.fn(),
  cancelCurrentRun: vi.fn(),
  newConversation: vi.fn(),
  selectThread: vi.fn(),
}));

vi.mock('../hooks/useAgentPanel', () => ({
  useAgentPanel: () => ({ isOpen: true, close: vi.fn(), currentQuestionId: null }),
}));

vi.mock('../hooks/useAIConversation', () => ({
  useAIConversation: () => ({
    threads: [],
    currentThread: null,
    messages: [],
    runStates: {},
    isLoading: false,
    isGenerating: false,
    error: null,
    quotaExhausted: true,
    quotaResetAt: '2026-08-28T00:00:00+08:00',
    ...panelMocks,
  }),
}));

describe('AIAgentPanel quota exhausted state', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AI_ASSISTANT_ENABLED', 'true');
    Object.values(panelMocks).forEach(mock => mock.mockReset());
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it('shows only the exhaustion notice and blocks new requests', async () => {
    const { AIAgentPanel } = await import('./AIAgentPanel');
    render(<AIAgentPanel />);

    expect(screen.getByRole('status').textContent).toContain(
      '今日 AI 助手额度已用完，将于明日 00:00 恢复',
    );
    const input = screen.getByRole('combobox') as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe('今日额度已用完，明日 00:00 恢复');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(panelMocks.sendMessage).not.toHaveBeenCalled();
  });
});
