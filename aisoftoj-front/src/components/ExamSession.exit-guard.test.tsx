// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AgentPanelProvider } from '../hooks/useAgentPanel';
import { ExamSession as ExamSessionType } from '../types/exam';
import { ExamSession } from './ExamSession';

function createSession(overrides: Partial<ExamSessionType> = {}): ExamSessionType {
  return {
    id: '1',
    subject: '系统架构设计师',
    category: '综合知识',
    questions: [{
      id: '101',
      type: 'single',
      subject: '系统架构设计师',
      category: '综合知识',
      difficulty: 'easy',
      question: '测试题目',
      options: ['A. 选项 A', 'B. 选项 B'],
      correctAnswer: 'A',
      explanation: '测试解析',
    }],
    answers: {},
    startTime: new Date(),
    isCompleted: false,
    examMode: 'practice',
    ...overrides,
  };
}

function renderSession({
  session = createSession(),
  onPause = vi.fn().mockResolvedValue(undefined),
  onCleanupAfterPause = vi.fn(),
  onPauseOnPageHide = vi.fn(),
  onResumeAfterPageShow = vi.fn().mockResolvedValue(undefined),
  onCompleteExam,
}: {
  session?: ExamSessionType;
  onPause?: ReturnType<typeof vi.fn>;
  onCleanupAfterPause?: ReturnType<typeof vi.fn>;
  onPauseOnPageHide?: ReturnType<typeof vi.fn>;
  onResumeAfterPageShow?: ReturnType<typeof vi.fn>;
  onCompleteExam?: (router: ReturnType<typeof createMemoryRouter>) => Promise<boolean>;
} = {}) {
  let router: ReturnType<typeof createMemoryRouter>;
  const completeExam = onCompleteExam ?? vi.fn().mockResolvedValue(false);
  const element = (
    <AgentPanelProvider>
      <ExamSession
        session={session}
        onUpdateAnswer={vi.fn()}
        onConfirmAnswer={vi.fn().mockResolvedValue(undefined)}
        onCompleteExam={() => completeExam(router)}
        onPause={() => onPause()}
        onCleanupAfterPause={() => onCleanupAfterPause()}
        onPauseOnPageHide={() => onPauseOnPageHide()}
        onResumeAfterPageShow={() => onResumeAfterPageShow()}
      />
    </AgentPanelProvider>
  );
  router = createMemoryRouter([
    { path: '/exam/session/:sessionId', element },
    { path: '/papers', element: <div>试卷列表页</div> },
    { path: '/exam/result/:sessionId', element: <div>考试结果页</div> },
  ], { initialEntries: ['/exam/session/1'] });
  const view = render(<RouterProvider router={router} />);
  return {
    ...view,
    router,
    onPause,
    onCleanupAfterPause,
    onPauseOnPageHide,
    onResumeAfterPageShow,
    completeExam,
  };
}

describe('ExamSession exit guard', () => {
  it('asks before route navigation and keeps answering when cancelled', async () => {
    const { router, onPause } = renderSession();

    fireEvent.click(screen.getByRole('button', { name: '首页' }));
    expect(await screen.findByText('确认退出试卷')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '继续答题' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/exam/session/1'));
    expect(onPause).not.toHaveBeenCalled();
  });

  it('pauses first and then proceeds to the original destination', async () => {
    const onPause = vi.fn().mockResolvedValue(undefined);
    const onCleanupAfterPause = vi.fn();
    const { router } = renderSession({ onPause, onCleanupAfterPause });

    fireEvent.click(screen.getByRole('button', { name: '首页' }));
    fireEvent.click(await screen.findByRole('button', { name: '离开试卷' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/papers'));
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onCleanupAfterPause).toHaveBeenCalledTimes(1);
  });

  it('uses native unload protection and handles page lifecycle pause/resume', async () => {
    const onPauseOnPageHide = vi.fn();
    const onResumeAfterPageShow = vi.fn().mockResolvedValue(undefined);
    renderSession({ onPauseOnPageHide, onResumeAfterPageShow });

    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    window.dispatchEvent(new Event('pagehide'));
    expect(onPauseOnPageHide).toHaveBeenCalledTimes(1);

    const pageShow = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(pageShow, 'persisted', { value: true });
    window.dispatchEvent(pageShow);
    await waitFor(() => expect(onResumeAfterPageShow).toHaveBeenCalledTimes(1));
  });

  it('allows the result route synchronously while still blocking unrelated routes', async () => {
    let startResultNavigation: (() => void) | undefined;
    const resultNavigationGate = new Promise<void>((resolve) => {
      startResultNavigation = resolve;
    });
    const { router } = renderSession({
      session: createSession({ answers: { '101': 'A' } }),
      onCompleteExam: async (activeRouter) => {
        await resultNavigationGate;
        await activeRouter.navigate('/exam/result/1');
        return true;
      },
    });

    fireEvent.click(screen.getByRole('button', { name: '交卷' }));
    void router.navigate('/papers');
    expect(await screen.findByText('确认退出试卷')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/exam/session/1');
    fireEvent.click(screen.getByRole('button', { name: '继续答题' }));

    startResultNavigation?.();
    await waitFor(() => expect(router.state.location.pathname).toBe('/exam/result/1'));
    expect(screen.getByText('考试结果页')).toBeTruthy();
  });
});
