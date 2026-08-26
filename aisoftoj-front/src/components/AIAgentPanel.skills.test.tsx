// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  sendMessage: vi.fn(),
  listAISkills: vi.fn(),
}));

vi.mock('../hooks/useAgentPanel', () => ({
  useAgentPanel: () => ({ isOpen: true, close: mocks.close, currentQuestionId: null }),
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
    sendMessage: mocks.sendMessage,
    retryMessage: vi.fn(),
    cancelCurrentRun: vi.fn(),
    newConversation: vi.fn(),
    selectThread: vi.fn(),
  }),
}));

vi.mock('../lib/aiApi', () => ({
  listAISkills: mocks.listAISkills,
}));

const skillResponse = {
  total: 2,
  items: [
    {
      name: 'essay-writing-coach',
      description: '辅导软考论文审题、提纲和润色',
      category: 'public',
      enabled: true,
      license: 'internal',
    },
    {
      name: 'question-explanation',
      description: '讲解软考题目和选项依据',
      category: 'public',
      enabled: true,
      license: 'internal',
    },
  ],
};

describe('AIAgentPanel Slash Skill menu', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_AI_ASSISTANT_ENABLED', 'true');
    mocks.close.mockReset();
    mocks.sendMessage.mockReset();
    mocks.listAISkills.mockReset().mockResolvedValue(skillResponse);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  async function renderPanel() {
    const { AIAgentPanel } = await import('./AIAgentPanel');
    render(<AIAgentPanel />);
    const input = screen.getByRole('combobox') as HTMLTextAreaElement;
    fireEvent.focus(input);
    await waitFor(() => expect(mocks.listAISkills).toHaveBeenCalledTimes(1));
    return input;
  }

  it('opens on slash, cycles options, and fills without sending', async () => {
    const input = await renderPanel();
    fireEvent.change(input, { target: { value: '/' } });

    const options = await screen.findAllByRole('option');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('/question-explanation ');
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('filters results and resets the highlight to the first option', async () => {
    const input = await renderPanel();
    fireEvent.change(input, { target: { value: '/' } });
    await screen.findAllByRole('option');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.change(input, { target: { value: '/essay' } });

    const option = (await screen.findAllByRole('option'))[0];
    expect(option.textContent).toContain('/essay-writing-coach');
    expect(option.getAttribute('aria-selected')).toBe('true');
  });

  it('lets Escape close only the menu and guards IME and Shift+Enter', async () => {
    const input = await renderPanel();
    fireEvent.change(input, { target: { value: '/' } });
    await screen.findByRole('listbox');

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(input.value).toBe('/');
    expect(mocks.sendMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(mocks.close).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '/e' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps ordinary chat working when Skill discovery fails', async () => {
    mocks.listAISkills.mockRejectedValueOnce(new Error('offline'));
    const input = await renderPanel();
    fireEvent.change(input, { target: { value: '继续复习' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mocks.sendMessage).toHaveBeenCalledWith('继续复习', undefined);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
