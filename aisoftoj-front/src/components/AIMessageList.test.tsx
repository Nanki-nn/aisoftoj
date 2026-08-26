// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AIMessageList } from './AIMessageList';
import { MessageGroup } from '../lib/aiMessageGroups';
import { createRunViewState } from '../lib/aiEvents';

describe('AIMessageList', () => {
  it('renders an auto-collapsed terminal process without a spinner', () => {
    const groups: MessageGroup[] = [{
      type: 'assistant:processing',
      key: 'run-1:processing',
      run: {
        ...createRunViewState('run-1'),
        phase: 'completed',
        processNotes: [{ text: '读取学习记录', sequence: 2 }],
        tools: [{
          callId: 'call-1',
          toolName: 'list_practice_history',
          input: {},
          status: 'completed',
          sequence: 3,
          summary: { record_count: 3, total_count: 8 },
        }],
      },
    }];

    const { container } = render(<AIMessageList groups={groups} onRetry={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /完成 1 个步骤/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.animate-spin')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('读取学习记录')).toBeTruthy();
  });

  it('renders headings, lists, tables and code inside the explicit markdown body', () => {
    const groups: MessageGroup[] = [{
      type: 'assistant:answer',
      key: 'run-1:answer',
      streaming: false,
      content: '## 今日安排\n\n- 复习错题\n\n| 科目 | 数量 |\n| --- | ---: |\n| 综合 | 3 |\n\n使用 `复习模式`。',
    }];

    const { container } = render(<AIMessageList groups={groups} onRetry={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '今日安排', level: 2 })).toBeTruthy();
    expect(container.querySelector('.markdown-body ul')).toBeTruthy();
    expect(container.querySelector('.markdown-table-scroll table')).toBeTruthy();
    expect(container.querySelector('.markdown-body code')?.textContent).toBe('复习模式');
  });
});
