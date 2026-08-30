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

  it('renders skill activation and skill resource loading as explicit steps', () => {
    const groups: MessageGroup[] = [{
      type: 'assistant:processing',
      key: 'run-1:processing',
      run: {
        ...createRunViewState('run-1'),
        phase: 'completed',
        skillActivations: [{
          skillName: 'essay-writing-coach',
          category: 'public',
          sequence: 2,
        }],
        tools: [{
          callId: 'call-1',
          toolName: 'load_skill',
          input: { has_path: true },
          status: 'completed',
          sequence: 3,
          summary: { status: 'success', truncated: false },
        }],
      },
    }];

    render(<AIMessageList groups={groups} onRetry={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /完成 2 个步骤/ });
    fireEvent.click(toggle);

    expect(screen.getByText('启用论文写作辅导 Skill')).toBeTruthy();
    expect(screen.getByText('已应用 /essay-writing-coach 工作规程')).toBeTruthy();
    expect(screen.getByText('读取 Skill 参考资料')).toBeTruthy();
    expect(screen.getByText('Skill 资料已加载')).toBeTruthy();
  });

  it('renders retrieved knowledge sources in the tool process', () => {
    const groups: MessageGroup[] = [{
      type: 'assistant:processing',
      key: 'run-1:processing',
      run: {
        ...createRunViewState('run-1'),
        phase: 'completed',
        tools: [{
          callId: 'call-1',
          toolName: 'search_knowledge',
          input: {},
          status: 'completed',
          sequence: 2,
          summary: {
            status: 'found',
            source_count: 1,
            sources: [{
              title: '系统架构设计教程',
              heading_path: ['第 1 章', '架构基础'],
              page_start: 12,
              page_end: 13,
              evidence: '架构设计用于平衡质量属性。',
            }],
          },
        }],
      },
    }];

    render(<AIMessageList groups={groups} onRetry={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /完成 1 个步骤/ }));
    expect(screen.getByText('检索学习资料')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '查看 1 个命中片段' }));
    expect(screen.getByText('系统架构设计教程')).toBeTruthy();
    expect(screen.getByText('架构设计用于平衡质量属性。')).toBeTruthy();
  });
});
