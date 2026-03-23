import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ExamHome } from './components/ExamHome';
import { ExamConfig } from './components/ExamConfig';
import { ExamSession } from './components/ExamSession';
import { ExamResult } from './components/ExamResult';
import { AuthPage } from './components/AuthPage';
import { ProfilePage } from './components/ProfilePage';
import { PracticeHistory } from './components/PracticeHistory';
import { WrongQuestions } from './components/WrongQuestions';
import { useExamSession } from './hooks/useExamSession';
import { useAuth } from './hooks/useAuth';
import { ExamConfig as ExamConfigType } from './types/exam';
import { ExamPaper } from './data/examPapers';
import { continuePracticeSession, startPaperSession, submitPracticeSession } from './lib/api';

const ROUTES = {
  home: '/',
  auth: '/login',
  profile: '/profile',
  practiceHistory: '/practice-history',
  wrongQuestions: '/wrong-questions',
  examConfig: '/exam/config',
  examSessionBase: '/exam/session',
  examResultBase: '/exam/result',
} as const;

function SessionRoute({
  currentSession,
  updateAnswer,
  onCompleteExam,
  onBackToConfig,
}: {
  currentSession: ReturnType<typeof useExamSession>['currentSession'];
  updateAnswer: ReturnType<typeof useExamSession>['updateAnswer'];
  onCompleteExam: () => void;
  onBackToConfig: () => void;
}) {
  const { sessionId } = useParams();

  if (!currentSession || !sessionId || currentSession.id !== sessionId) {
    return <Navigate to={ROUTES.home} replace />;
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
    const isSessionRoute = location.pathname.startsWith(ROUTES.examSessionBase);
    const isResultRoute = location.pathname.startsWith(ROUTES.examResultBase);

    if ((isSessionRoute || isResultRoute) && !currentSession) {
      navigate(ROUTES.home, { replace: true });
    }
  }, [location.pathname, currentSession, navigate]);

  const handleStartPaper = async (paper: ExamPaper) => {
    try {
      setExamConfigDraft(null);
      const session = await startPaperSession(paper.id);
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

  const handleRestartExam = () => {
    const restartConfig =
      currentSession
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
    const continueConfig =
      currentSession
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

  const handleContinuePracticeFromHistory = async (recordId: string) => {
    try {
      const session = await continuePracticeSession(recordId);
      setSession(session);
      navigate(`${ROUTES.examSessionBase}/${session.id}`);
    } catch (error) {
      alert('继续练习失败：' + (error as Error).message);
    }
  };

  const handleLoginSuccess = () => {
    navigate(ROUTES.home);
  };

  return (
    <div className="min-h-screen bg-background">
      <Routes>
        <Route
          path={ROUTES.home}
          element={
            <ExamHome
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
            <PracticeHistory
              onBack={handleBackToHome}
              onContinue={handleContinuePracticeFromHistory}
            />
          }
        />
        <Route path={ROUTES.wrongQuestions} element={<WrongQuestions onBack={handleBackToHome} />} />
        <Route
          path={ROUTES.examConfig}
          element={<ExamConfig onStartExam={handleStartExam} initialConfig={examConfigDraft} />}
        />
        <Route
          path={`${ROUTES.examSessionBase}/:sessionId`}
          element={
            <SessionRoute
              currentSession={currentSession}
              updateAnswer={updateAnswer}
              onCompleteExam={handleCompleteExam}
              onBackToConfig={handleBackToConfig}
            />
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
        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    </div>
  );
}
