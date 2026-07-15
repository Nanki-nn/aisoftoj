import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LearningLanding } from './components/LearningLanding';
import { FoundationPage } from './components/FoundationPage';
import { EssaySprintPage } from './components/EssaySprintPage';
import { PapersPage } from './components/PapersPage';
import { ExamConfig } from './components/ExamConfig';
import { ExamSession } from './components/ExamSession';
import { ExamResult } from './components/ExamResult';
import { AuthPage } from './components/AuthPage';
import { ProfilePage } from './components/ProfilePage';
import { PracticeHistory } from './components/PracticeHistory';
import { WrongQuestions } from './components/WrongQuestions';
import { EssayHome } from './components/EssayHome';
import { EssayEditor } from './components/EssayEditor';
import { EssayResult } from './components/EssayResult';
import { EssayHistory } from './components/EssayHistory';
import { AppHeader } from './components/AppHeader';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminUsers } from './components/admin/AdminUsers';
import { AdminQuestions } from './components/admin/AdminQuestions';
import { AdminOssUpload } from './components/admin/AdminOssUpload';
import { AdminRouteGuard } from './components/admin/AdminRouteGuard';
import { useExamSession } from './hooks/useExamSession';
import { useAuth } from './hooks/useAuth';
import { ExamConfig as ExamConfigType, ExamPaper } from './types/exam';
import { PracticeRecord, PracticeSessionRecord } from './types/record';
import {
  cachePracticeSessionAnswers,
  continuePracticeSession,
  startPaperSession,
  submitPracticeSession,
  updatePracticeQuestionRecord,
} from './lib/api';

const ROUTES = {
  home: '/',
  foundation: '/foundation',
  papers: '/papers',
  auth: '/login',
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
  onCompleteExam,
  onBackToConfig,
}: {
  currentSession: ReturnType<typeof useExamSession>['currentSession'];
  setSession: ReturnType<typeof useExamSession>['setSession'];
  updateAnswer: ReturnType<typeof useExamSession>['updateAnswer'];
  onCompleteExam: () => void;
  onBackToConfig: () => void;
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
      onCompleteExam={onCompleteExam}
      onBackToConfig={onBackToConfig}
    />
  );
}

type UpdateAnswerFn = ReturnType<typeof useExamSession>['updateAnswer'];

function ResultRoute({
  currentSession,
  onRestartExam,
  onBackToHome,
  onContinuePractice,
  onBackToExam,
}: {
  currentSession: ReturnType<typeof useExamSession>['currentSession'];
  onRestartExam: () => void;
  onBackToHome: () => void;
  onContinuePractice: () => void;
  onBackToExam: () => void;
}) {
  const { sessionId } = useParams();

  if (!currentSession || !sessionId || currentSession.id !== sessionId) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <ExamResult
      session={currentSession}
      onRestartExam={onRestartExam}
      onBackToHome={onBackToHome}
      onContinuePractice={onContinuePractice}
      onBackToExam={onBackToExam}
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
      <AppHeader onShowAuth={onShowAuth} onShowProfile={onShowProfile} />
      {children}
    </>
  );
}

export default function App() {
  const [lastConfig, setLastConfig] = useState<ExamConfigType | null>(null);
  const [examConfigDraft, setExamConfigDraft] = useState<Partial<ExamConfigType> | null>(null);
  const {
    currentSession,
    startExam,
    updateAnswer,
    completeExam,
    resetSession,
    setSession,
  } = useExamSession();
  const { checkAuthStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 检查用户登录状态
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    const isResultRoute = location.pathname.startsWith(ROUTES.examResultBase);

    if (isResultRoute && !currentSession) {
      navigate(ROUTES.home, { replace: true });
    }
  }, [location.pathname, currentSession, navigate]);

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
      setLastConfig(config);
      setExamConfigDraft(config);
      const session = config.paperId
        ? await startPaperSession(config.paperId, config.examMode)
        : startExam(config);
      navigate(`${ROUTES.examSessionBase}/${session.id}`);
    } catch (error) {
      alert('开始考试失败：' + (error as Error).message);
    }
  };

  const handleCompleteExam = async () => {
    if (currentSession && !String(currentSession.id).startsWith('exam_')) {
      try {
        await submitPracticeSession(currentSession.id, currentSession.answers);
      } catch (error) {
        alert('交卷失败：' + (error as Error).message);
        return;
      }
    }

    const session = completeExam();
    if (session) {
      navigate(`${ROUTES.examResultBase}/${session.id}`);
    }
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

  const handleRestartExam = () => {
    const restartConfig = currentSession?.paperId
      ? {
          paperId: currentSession.paperId,
          paperName: currentSession.paperName || currentSession.subject,
          subject: currentSession.subject,
          category: currentSession.category,
          questionCount: currentSession.questions.length,
          examMode: currentSession.examMode,
          randomOrder: false,
        }
      : lastConfig;

    if (!restartConfig) {
      navigate(ROUTES.examConfig);
      return;
    }

    if (restartConfig.paperId) {
      void (async () => {
        try {
          const session = await startPaperSession(restartConfig.paperId!, restartConfig.examMode ?? 'practice');
          setSession(session);
          navigate(`${ROUTES.examSessionBase}/${session.id}`);
        } catch (error) {
          alert('开始考试失败：' + (error as Error).message);
        }
      })();
      return;
    }

    setExamConfigDraft(restartConfig);
    navigate(ROUTES.examConfig);
  };

  const handleBackToHome = () => {
    resetSession();
    setExamConfigDraft(null);
    navigate(ROUTES.home);
  };

  const handleBackToConfig = () => {
    resetSession();
    setExamConfigDraft(null);
    navigate(ROUTES.home);
  };

  const handleContinuePractice = () => {
    const continueConfig = currentSession?.paperId
      ? {
          paperId: currentSession.paperId,
          paperName: currentSession.paperName || currentSession.subject,
          subject: currentSession.subject,
          category: currentSession.category,
          questionCount: currentSession.questions.length,
          examMode: 'practice' as const,
          randomOrder: false,
        }
      : null;
    resetSession();
    if (continueConfig?.paperId) {
      void (async () => {
        try {
          const session = await startPaperSession(continueConfig.paperId!, 'practice');
          setSession(session);
          navigate(`${ROUTES.examSessionBase}/${session.id}`);
        } catch (error) {
          alert('继续练习失败：' + (error as Error).message);
        }
      })();
      return;
    }
    setExamConfigDraft(continueConfig);
    navigate(ROUTES.examConfig);
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

  const handleShowPracticeHistory = () => {
    navigate(ROUTES.practiceHistory);
  };

  const handleShowWrongQuestions = () => {
    navigate(ROUTES.wrongQuestions);
  };

  const handleContinuePracticeFromHistory = async (recordId: string, status: PracticeSessionRecord['status']) => {
    try {
      const session = await continuePracticeSession(recordId);
      setSession(session);
      navigate(`${ROUTES.examSessionBase}/${session.id}`);
    } catch (error) {
      alert(`${status === 'completed' ? '查看' : '继续'}记录失败：` + (error as Error).message);
    }
  };

  const handleViewPracticeResultFromHistory = async (recordId: string) => {
    try {
      const session = await continuePracticeSession(recordId);
      setSession({
        ...session,
        isCompleted: true,
        endTime: session.endTime || new Date(),
      });
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
      const session = await continuePracticeSession(String(record.sessionId));
      setSession({
        ...session,
        isCompleted: true,
        endTime: session.endTime || new Date(),
      });
      navigate(`${ROUTES.examSessionBase}/${session.id}?questionId=${record.questionId}`);
    } catch (error) {
      alert('查看错题失败：' + (error as Error).message);
    }
  };

  const handleLoginSuccess = () => {
    navigate(ROUTES.home);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
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
              onShowPracticeHistory={handleShowPracticeHistory}
              onShowWrongQuestions={handleShowWrongQuestions}
            />
          }
        />
        <Route path={ROUTES.auth} element={<AuthPage onLoginSuccess={handleLoginSuccess} />} />
        <Route path={ROUTES.profile} element={<ProfilePage onBack={handleBackToHome} />} />
        <Route
          path={ROUTES.practiceHistory}
          element={
            <AppShell onShowAuth={handleShowAuth} onShowProfile={handleShowProfile}>
              <PracticeHistory
                onBack={handleBackToHome}
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
              <WrongQuestions onBack={handleBackToHome} onViewQuestion={handleViewWrongQuestion} />
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
                onCompleteExam={handleCompleteExam}
                onBackToConfig={handleBackToConfig}
              />
            </AppShell>
          }
        />
        <Route
          path={`${ROUTES.examResultBase}/:sessionId`}
          element={
            <ResultRoute
              currentSession={currentSession}
              onRestartExam={handleRestartExam}
              onBackToHome={handleBackToHome}
              onContinuePractice={handleContinuePractice}
              onBackToExam={handleBackToExam}
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
        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    </div>
  );
}
