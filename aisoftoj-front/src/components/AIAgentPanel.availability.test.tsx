// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

const panelMocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  retryMessage: vi.fn(),
  cancelCurrentRun: vi.fn(),
  newConversation: vi.fn(),
  selectThread: vi.fn(),
  runStates: {},
}));

vi.mock('../hooks/useAgentPanel', () => ({
  useAgentPanel: () => ({
    isOpen: true,
    close: vi.fn(),
    currentQuestionId: null,
  }),
}));

vi.mock('../hooks/useAIConversation', () => ({
  useAIConversation: () => ({
    threads: [],
    currentThread: null,
    messages: [],
    runStates: panelMocks.runStates,
    isLoading: false,
    isGenerating: false,
    error: null,
    ...panelMocks,
  }),
}));

describe('AIAgentPanel unavailable state', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_AI_ASSISTANT_ENABLED', 'false');
    Object.values(panelMocks).forEach(mock => {
      if (typeof mock === 'function') mock.mockReset();
    });
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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows the notice and disables every request control', async () => {
    const { AIAgentPanel } = await import('./AIAgentPanel');
    render(<AIAgentPanel />);

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('AI 助手线上请求暂未开放');
    expect(status.textContent).toContain('欢迎加入交流群，查看项目最新进度');
    const input = screen.getByRole('combobox') as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe('AI 助手线上请求暂未开放');
    expect((screen.getByRole('button', { name: '发送消息' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '新对话' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '对话记录' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '打开对话列表' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(panelMocks.sendMessage).not.toHaveBeenCalled();
  });
});
