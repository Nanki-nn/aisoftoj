// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  isOpen: true,
  runStates: {} as Record<string, unknown>,
  messages: [] as unknown[],
  threads: [] as Array<{ id: string; title: string; created_at: string; updated_at: string }>,
  close: vi.fn(),
  sendMessage: vi.fn(),
  newConversation: vi.fn(),
  selectThread: vi.fn(),
  listAISkills: vi.fn(),
}));

vi.mock('../hooks/useAgentPanel', () => ({
  useAgentPanel: () => ({ isOpen: mocks.isOpen, close: mocks.close, currentQuestionId: null }),
}));

vi.mock('../hooks/useAIConversation', () => ({
  useAIConversation: () => ({
    threads: mocks.threads,
    currentThread: null,
    messages: mocks.messages,
    runStates: mocks.runStates,
    isLoading: false,
    isGenerating: false,
    error: null,
    sendMessage: mocks.sendMessage,
    retryMessage: vi.fn(),
    cancelCurrentRun: vi.fn(),
    newConversation: mocks.newConversation,
    selectThread: mocks.selectThread,
  }),
}));

vi.mock('../lib/aiApi', () => ({ listAISkills: mocks.listAISkills }));

describe('AIAgentPanel stream auto-follow', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_AI_ASSISTANT_ENABLED', 'true');
    mocks.isOpen = true;
    mocks.runStates = {};
    mocks.messages = [];
    mocks.threads = [];
    mocks.close.mockReset();
    mocks.sendMessage.mockReset();
    mocks.newConversation.mockReset();
    mocks.selectThread.mockReset();
    mocks.listAISkills.mockReset().mockResolvedValue({ items: [], total: 0 });
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

  async function setupScrollPanel() {
    const { AIAgentPanel } = await import('./AIAgentPanel');
    const view = render(<AIAgentPanel />);
    await waitFor(() => expect(mocks.listAISkills).toHaveBeenCalledTimes(1));
    const container = document.querySelector('[aria-live="polite"]') as HTMLDivElement;
    let scrollTop = 600;
    Object.defineProperties(container, {
      scrollHeight: { configurable: true, get: () => 1000 },
      clientHeight: { configurable: true, get: () => 400 },
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: value => { scrollTop = Number(value); },
      },
    });
    const scrollTo = vi.fn();
    Object.defineProperty(container, 'scrollTo', { configurable: true, value: scrollTo });
    return { AIAgentPanel, container, scrollTo, view, setScrollTop: (value: number) => { scrollTop = value; } };
  }

  it('follows streaming state at the bottom and pauses while the user reads history', async () => {
    const { AIAgentPanel, container, scrollTo, view, setScrollTop } = await setupScrollPanel();
    fireEvent.scroll(container);
    scrollTo.mockClear();

    mocks.runStates = { 'run-1': { answer: '第一段' } };
    view.rerender(<AIAgentPanel />);
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });

    setScrollTop(300);
    fireEvent.scroll(container);
    scrollTo.mockClear();
    mocks.runStates = { 'run-1': { answer: '第一段第二段' } };
    view.rerender(<AIAgentPanel />);
    expect(scrollTo).not.toHaveBeenCalled();

    setScrollTop(600);
    fireEvent.scroll(container);
    mocks.runStates = { 'run-1': { answer: '第一段第二段第三段' } };
    view.rerender(<AIAgentPanel />);
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
  });

  it('does not scroll while closed and resumes when the panel reopens', async () => {
    const { AIAgentPanel, scrollTo, view } = await setupScrollPanel();
    scrollTo.mockClear();
    mocks.isOpen = false;
    mocks.runStates = { 'run-1': { answer: '关闭期间更新' } };
    view.rerender(<AIAgentPanel />);
    expect(scrollTo).not.toHaveBeenCalled();

    mocks.isOpen = true;
    view.rerender(<AIAgentPanel />);
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
  });

  it('reenables following after send, new conversation, and thread selection', async () => {
    const { AIAgentPanel, container, scrollTo, view, setScrollTop } = await setupScrollPanel();
    const pauseFollowing = () => {
      setScrollTop(200);
      fireEvent.scroll(container);
      scrollTo.mockClear();
    };
    const streamUpdate = (answer: string) => {
      mocks.runStates = { 'run-1': { answer } };
      view.rerender(<AIAgentPanel />);
    };

    pauseFollowing();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '继续复习' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    streamUpdate('发送后更新');
    expect(scrollTo).toHaveBeenCalled();

    pauseFollowing();
    fireEvent.click(screen.getByRole('button', { name: '新对话' }));
    streamUpdate('新会话更新');
    expect(scrollTo).toHaveBeenCalled();

    pauseFollowing();
    mocks.threads = [{
      id: 'thread-1',
      title: '历史会话',
      created_at: '2026-08-26T00:00:00Z',
      updated_at: '2026-08-26T00:00:00Z',
    }];
    view.rerender(<AIAgentPanel />);
    fireEvent.click(screen.getByRole('button', { name: '打开对话列表' }));
    fireEvent.click(screen.getByRole('button', { name: '历史会话' }));
    streamUpdate('切换会话后更新');
    expect(scrollTo).toHaveBeenCalled();
  });
});
