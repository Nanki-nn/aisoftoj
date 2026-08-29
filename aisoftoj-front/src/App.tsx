import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LearningLanding } from './components/LearningLanding';
import { FoundationPage } from './components/FoundationPage';
import { EssaySprintPage } from './components/EssaySprintPage';
import { PapersPage } from './components/PapersPage';
import { ExamConfig } from './components/ExamConfig';
import { ExamSession } from './components/ExamSession';
import { ExamResult } from './components/ExamResult';
import { AuthPage } from './components/AuthPage';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { ProfilePage } from './components/ProfilePage';
import { PracticeHistory } from './components/PracticeHistory';
import { WrongQuestions } from './components/WrongQuestions';
import { EssayHome } from './components/EssayHome';
import { EssayEditor } from './components/EssayEditor';
import { EssayResult } from './components/EssayResult';
import { EssayHistory } from './components/EssayHistory';
import { AppHeader } from './components/AppHeader';
import { AIAgentPanel } from './components/AIAgentPanel';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminUsers } from './components/admin/AdminUsers';
import { AdminQuestions } from './components/admin/AdminQuestions';
import { AdminOssUpload } from './components/admin/AdminOssUpload';
import { AdminRouteGuard } from './components/admin/AdminRouteGuard';
import { AdminAISettings } from './components/admin/AdminAISettings';
import { AdminTokenUsage } from './components/admin/AdminTokenUsage';
import { useExamSession } from './hooks/useExamSession';
import { useAuth } from './hooks/useAuth';
import { useAgentPanel } from './hooks/useAgentPanel';
import { ExamConfig as ExamConfigType, ExamPaper } from './types/exam';
import { PracticeRecord, PracticeSessionRecord } from './types/record';
import {
  cachePracticeSessionAnswers,
  continuePracticeSession,
  fetchPracticeSessionResult,
  pausePracticeSession,
  pausePracticeSessionOnPageHide,
  startPaperSession,
  submitPracticeSession,
  updatePracticeQuestionRecord,
} from './lib/api';
import { fetchAICapability } from './lib/aiApi';
import { AI_ASSISTANT_ENABLED } from './lib/aiAvailability';

const ROUTES = {
  home: '/',
  foundation: '/foundation',
  papers: '/papers',
  auth: '/login',
  forgotPassword: '/forgot-password',
  profile: '/profile',
  practiceHistory: '/practice-history',
  wrongQuestions: '/wrong-questions',
  examConfig: '/exam/config',
  examSessionBase: '/exam/session',
  examResultBase: '/exam/result',
  essay: '/essay',
  essaySprint: '/essay-sprint',
  essayWriteBase: '/essay/write',
  essayResultBase: '/essay/result',
  essayHistory: '/essay/history',
} as const;

function SessionRoute({
  currentSession,
  setSession,
  updateAnswer,
  onConfirmAnswer,
  onCompleteExam,
  onPause,
  onCleanupAfterPause,
  onPauseOnPageHide,
  onResumeAfterPageShow,
}: {
  currentSession: ReturnType<typeof useExamSession>['currentSession'];
  setSession: ReturnType<typeof useExamSession>['setSession'];
  updateAnswer: ReturnType<typeof useExamSession>['updateAnswer'];
  onConfirmAnswer: (questionId: string, answer: string | string[]) => Promise<void>;
  onCompleteExam: () => Promise<boolean>;
  onPause: () => Promise<void>;
  onCleanupAfterPause: () => void;
  onPauseOnPageHide: () => void;
  onResumeAfterPageShow: () => Promise<void>;
}) {
  const { sessionId } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || currentSession?.id === sessionId) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    continuePracticeSession(sessionId)
      .then((session) => {
        if (isMounted) {
          setSession(session);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLoadError((error as Error).message || '刷题会话加载失败');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentSession?.id, sessionId, setSession]);

  if (!sessionId) {
    return <Navigate to={ROUTES.home} replace />;
  }

  if (loadError) {
    return <div className="min-h-screen bg-background p-6 text-red-600">{loadError}</div>;
  }

  if (isLoading || !currentSession || currentSession.id !== sessionId) {
    return <div className="min-h-screen bg-background p-6 text-slate-500">正在加载刷题会话...</div>;
  }

  return (
    <ExamSession
      session={currentSession}
      onUpdateAnswer={updateAnswer}
      onConfirmAnswer={onConfirmAnswer}
      onCompleteExam={onCompleteExam}
      onPause={onPause}
      onCleanupAfterPause={onCleanupAfterPause}
      onPauseOnPageHide={onPauseOnPageHide}
      onResumeAfterPageShow={onResumeAfterPageShow}
    />
  );
}

type UpdateAnswerFn = ReturnType<typeof useExamSession>['updateAnswer'];

function ResultRoute({
  currentSession,
  setSession,
  onViewAnswerRecord,
  onBackToPapers,
}: {
  currentSession: ReturnType<typeof useExamSession>['currentSession'];
  setSession: ReturnType<typeof useExamSession>['setSession'];
  onViewAnswerRecord: () => void;
  onBackToPapers: () => void | Promise<void>;
}) {
  const { sessionId } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || (currentSession?.id === sessionId && currentSession.isCompleted)) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);
    fetchPracticeSessionResult(sessionId)
      .then((session) => {
        if (isMounted) {
          setSession(session);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLoadError((error as Error).message || '考试结果加载失败');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentSession?.id, currentSession?.isCompleted, sessionId, setSession]);

  if (loadError) {
    return <div className="min-h-screen bg-background p-6 text-red-600">{loadError}</div>;
  }

  if (isLoading) {
    return <div className="min-h-screen bg-background p-6 text-slate-500">正在加载考试结果...</div>;
  }

  if (!currentSession || !sessionId || currentSession.id !== sessionId) {
    return sessionId
      ? <div className="min-h-screen bg-background p-6 text-slate-500">正在加载考试结果...</div>
      : <Navigate to={ROUTES.home} replace />;
  }

  return (
    <ExamResult
      session={currentSession}
      onViewAnswerRecord={onViewAnswerRecord}
      onBackToPapers={onBackToPapers}
    />
  );
}

function AppShell({
  children,
  onShowAuth,
  onShowProfile,
}: {
  children: React.ReactNode;
  onShowAuth: () => void;
  onShowProfile: () => void;
}) {
  return (
    <>
      <AppHeader
        onShowAuth={onShowAuth}
        onShowProfile={onShowProfile}
      />
      {children}
    </>
  );
}

export default function App() {
  const [examConfigDraft, setExamConfigDraft] = useState<Partial<ExamConfigType> | null>(null);
  const pageHidePauseRef = useRef<Promise<void> | null>(null);
  const currentSessionRef = useRef<ReturnType<typeof useExamSession>['currentSession']>(null);
  const activeExamSessionIdRef = useRef<string | null>(null);
  const {
    currentSession,
    startExam,
    updateAnswer,
    completeExam,
    resetSession,
    setSession,
  } = useExamSession();
  const { checkAuthStatus, user } = useAuth();
  const [aiCapabilityEnabled, setAiCapabilityEnabled] = useState(false);
  const { isOpen: isAgentOpen, close: closeAgent } = useAgentPanel();
  const navigate = useNavigate();
  const location = useLocation();
  currentSessionRef.current = currentSession;
  activeExamSessionIdRef.current = location.pathname.startsWith(`${ROUTES.examSessionBase}/`)
    ? currentSession?.id ?? null
    : null;
  const agentVisibleOnRoute = aiCapabilityEnabled
    && !location.pathname.startsWith('/admin')
    && location.pathname !== ROUTES.auth
    && location.pathname !== ROUTES.forgotPassword;

  // 检查用户登录状态
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    let active = true;
    if (!user || !AI_ASSISTANT_ENABLED) {
      setAiCapabilityEnabled(false);
      return () => { active = false; };
    }
    fetchAICapability()
      .then((value) => {
        if (active) setAiCapabilityEnabled(value.ai_enabled);
      })
      .catch(() => {
        if (active) setAiCapabilityEnabled(false);
      });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!agentVisibleOnRoute && isAgentOpen) {
      closeAgent();
    }
  }, [agentVisibleOnRoute, closeAgent, isAgentOpen]);

  const handleStartPaper = async (paper: ExamPaper, mode: 'practice' | 'exam') => {
    try {
      const session = paper.status === 'in_progress' && paper.doingSessionId
        ? await continuePracticeSession(paper.doingSessionId)
        : await startPaperSession(paper.id, mode);
      setSession(session);
      navigate(`${ROUTES.examSessionBase}/${session.id}`);
    } catch (error) {
      alert('开始考试失败：' + (error as Error).message);
    }
  };

  const handleStartExam = async (config: ExamConfigType) => {
    try {
      setExamConfigDraft(config);
      const session = config.paperId
        ? await startPaperSession(config.paperId, config.examMode)
        : startExam(config);
      navigate(`${ROUTES.examSessionBase}/${session.id}`);
    } catch (error) {
      alert('开始考试失败：' + (error as Error).message);
    }
  };

  const handleCompleteExam = async (): Promise<boolean> => {
    if (currentSession && !String(currentSession.id).startsWith('exam_')) {
      try {
        await submitPracticeSession(currentSession.id, currentSession.answers);
        const completedSession = await fetchPracticeSessionResult(currentSession.id);
        setSession(completedSession);
        navigate(`${ROUTES.examResultBase}/${completedSession.id}`);
        return true;
      } catch (error) {
        alert('交卷失败：' + (error as Error).message);
        return false;
      }
    }

    const session = completeExam();
    if (session) {
      navigate(`${ROUTES.examResultBase}/${session.id}`);
      return true;
    }
    return false;
  };

  const handleUpdateAnswer: UpdateAnswerFn = (questionId, answer) => {
    updateAnswer(questionId, answer);

    const question = currentSession?.questions.find(item => item.id === questionId);
    if (currentSession) {
      cachePracticeSessionAnswers(currentSession.id, {
        ...currentSession.answers,
        [questionId]: answer,
      });
    }
    if (!question?.questionRecordId) {
      return;
    }

    void updatePracticeQuestionRecord(question.questionRecordId, answer).catch((error) => {
      console.error('保存答题记录失败', error);
    });
  };

  const handleConfirmAnswer = async (questionId: string, answer: string | string[]) => {
    if (!currentSession) {
      return;
    }
    const question = currentSession.questions.find(item => item.id === questionId);
    const answers = {
      ...currentSession.answers,
      [questionId]: answer,
    };
    updateAnswer(questionId, answer);
    cachePracticeSessionAnswers(currentSession.id, answers);

    if (!question?.questionRecordId || String(currentSession.id).startsWith('exam_')) {
      setSession({
        ...currentSession,
        answers,
        questions: currentSession.questions.map(item => item.id === questionId
          ? { ...item, userAnswer: answer, confirmedAt: new Date() }
          : item),
      });
      return;
    }

    const updatedRecord = await updatePracticeQuestionRecord(question.questionRecordId, answer, 0, true);
    if (activeExamSessionIdRef.current !== currentSession.id) {
      return;
    }
    const latestSession = currentSessionRef.current;
    if (!latestSession || latestSession.id !== currentSession.id) {
      return;
    }
    setSession({
      ...latestSession,
      answers: {
        ...latestSession.answers,
        [questionId]: answer,
      },
      questions: latestSession.questions.map(item => item.id === questionId
        ? {
            ...item,
            userAnswer: answer,
            isSubmitted: updatedRecord.isSubmitted ?? item.isSubmitted,
            isCorrect: updatedRecord.isCorrect ?? item.isCorrect,
            spendTime: updatedRecord.spendTime ?? item.spendTime,
            confirmedAt: updatedRecord.confirmedAt
              ? new Date(updatedRecord.confirmedAt)
              : item.confirmedAt,
          }
        : item),
    });
  };

  const handleBackToHome = () => {
    resetSession();
    setExamConfigDraft(null);
    navigate(ROUTES.home);
  };

  const handlePauseExam = async () => {
    if (
      currentSession
      && !currentSession.isCompleted
      && !String(currentSession.id).startsWith('exam_')
    ) {
      await pausePracticeSession(currentSession.id);
    }
  };

  const handleCleanupAfterPause = () => {
    activeExamSessionIdRef.current = null;
    currentSessionRef.current = null;
    resetSession();
    setExamConfigDraft(null);
  };

  const handlePauseOnPageHide = () => {
    if (
      currentSession
      && !currentSession.isCompleted
      && !String(currentSession.id).startsWith('exam_')
    ) {
      pageHidePauseRef.current = pausePracticeSessionOnPageHide(currentSession.id);
    }
  };

  const handleResumeAfterPageShow = async () => {
    if (
      !currentSession
      || currentSession.isCompleted
      || String(currentSession.id).startsWith('exam_')
    ) {
      return;
    }
    await pageHidePauseRef.current;
    pageHidePauseRef.current = null;
    setSession(await continuePracticeSession(currentSession.id));
  };

  const handleBackToPapers = () => {
    setExamConfigDraft(null);
    navigate(ROUTES.papers);
  };

  const handleBackToExam = () => {
    if (currentSession) {
      navigate(`${ROUTES.examSessionBase}/${currentSession.id}`);
    } else {
      navigate(ROUTES.home);
    }
  };

  const handleShowAuth = () => {
    navigate(ROUTES.auth);
  };

  const handleShowProfile = () => {
    navigate(ROUTES.profile);
  };

  const handleContinuePracticeFromHistory = async (recordId: string, status: PracticeSessionRecord['status']) => {
    try {
      const session = status === 'completed'
        ? await fetchPracticeSessionResult(recordId)
        : await continuePracticeSession(recordId);
      setSession(session);
      navigate(`${ROUTES.examSessionBase}/${session.id}`);
    } catch (error) {
      alert(`${status === 'completed' ? '查看' : '继续'}记录失败：` + (error as Error).message);
    }
  };

  const handleViewPracticeResultFromHistory = async (recordId: string) => {
    try {
      const session = await fetchPracticeSessionResult(recordId);
      setSession(session);
      navigate(`${ROUTES.examResultBase}/${session.id}`);
    } catch (error) {
      alert('查看考试结果失败：' + (error as Error).message);
    }
  };

  const handleViewWrongQuestion = async (record: PracticeRecord) => {
    if (!record.sessionId || !record.questionId) {
      alert('这条错题缺少对应刷题会话，暂时无法查看原题');
      return;
    }

    try {
      const session = await fetchPracticeSessionResult(String(record.sessionId));
      setSession(session);
      navigate(`${ROUTES.examSessionBase}/${session.id}?questionId=${record.questionId}`);
    } catch (error) {
      alert('查看错题失败：' + (error as Error).message);
    }
  };

  const handleLoginSuccess = () => {
    navigate(ROUTES.home);
  };

  return (
    <div
      className={`min-h-screen bg-background text-foreground transition-[padding] duration-300 ease-out ${
        agentVisibleOnRoute && isAgentOpen ? 'xl:pr-[400px]' : ''
      }`}
    >
      <Routes>
        <Route
          path={ROUTES.home}
          element={
            <LearningLanding
              onShowAuth={handleShowAuth}
              onShowProfile={handleShowProfile}
            />
          }
        />
        <Route
          path={ROUTES.foundation}
          element={<FoundationPage onShowAuth={handleShowAuth} onShowProfile={handleShowProfile} />}
        />
        <Route
          path={ROUTES.papers}
          element={
            <PapersPage
              onStartPaper={handleStartPaper}
              onShowProfile={handleShowProfile}
              onShowAuth={handleShowAuth}
            />
          }
        />
        <Route path={ROUTES.auth} element={<AuthPage onLoginSuccess={handleLoginSuccess} />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.profile} element={<ProfilePage onBack={handleBackToHome} />} />
        <Route
          path={ROUTES.practiceHistory}
          element={
            <AppShell onShowAuth={handleShowAuth} onShowProfile={handleShowProfile}>
              <PracticeHistory
                onContinue={handleContinuePracticeFromHistory}
                onViewResult={handleViewPracticeResultFromHistory}
              />
            </AppShell>
          }
        />
        <Route
          path={ROUTES.wrongQuestions}
          element={
            <AppShell onShowAuth={handleShowAuth} onShowProfile={handleShowProfile}>
              <WrongQuestions onViewQuestion={handleViewWrongQuestion} />
            </AppShell>
          }
        />
        <Route
          path={ROUTES.examConfig}
          element={<ExamConfig onStartExam={handleStartExam} initialConfig={examConfigDraft} />}
        />
        <Route
          path={`${ROUTES.examSessionBase}/:sessionId`}
          element={
            <AppShell onShowAuth={handleShowAuth} onShowProfile={handleShowProfile}>
              <SessionRoute
                currentSession={currentSession}
                setSession={setSession}
                updateAnswer={handleUpdateAnswer}
                onConfirmAnswer={handleConfirmAnswer}
                onCompleteExam={handleCompleteExam}
                onPause={handlePauseExam}
                onCleanupAfterPause={handleCleanupAfterPause}
                onPauseOnPageHide={handlePauseOnPageHide}
                onResumeAfterPageShow={handleResumeAfterPageShow}
              />
            </AppShell>
          }
        />
        <Route
          path={`${ROUTES.examResultBase}/:sessionId`}
          element={
            <ResultRoute
              currentSession={currentSession}
              setSession={setSession}
              onViewAnswerRecord={handleBackToExam}
              onBackToPapers={handleBackToPapers}
            />
          }
        />
        <Route path={ROUTES.essay} element={<EssayHome />} />
        <Route
          path={ROUTES.essaySprint}
          element={<EssaySprintPage onShowAuth={handleShowAuth} onShowProfile={handleShowProfile} />}
        />
        <Route path={`${ROUTES.essayWriteBase}/:questionId`} element={<EssayEditor />} />
        <Route path={`${ROUTES.essayResultBase}/:submissionId`} element={<EssayResult />} />
        <Route path={ROUTES.essayHistory} element={<EssayHistory />} />
        <Route
          path="/admin"
          element={
            <AdminRouteGuard>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </AdminRouteGuard>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRouteGuard>
              <AdminLayout>
                <AdminUsers />
              </AdminLayout>
            </AdminRouteGuard>
          }
        />
        <Route
          path="/admin/questions"
          element={
            <AdminRouteGuard>
              <AdminLayout>
                <AdminQuestions />
              </AdminLayout>
            </AdminRouteGuard>
          }
        />
        <Route
          path="/admin/oss"
          element={
            <AdminRouteGuard>
              <AdminLayout>
                <AdminOssUpload />
              </AdminLayout>
            </AdminRouteGuard>
          }
        />
        <Route
          path="/admin/ai"
          element={
            <AdminRouteGuard>
              <AdminLayout>
                <AdminAISettings />
              </AdminLayout>
            </AdminRouteGuard>
          }
        />
        <Route
          path="/admin/token-usage"
          element={
            <AdminRouteGuard>
              <AdminLayout>
                <AdminTokenUsage />
              </AdminLayout>
            </AdminRouteGuard>
          }
        />
        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
      {agentVisibleOnRoute && <AIAgentPanel />}
    </div>
  );
}
