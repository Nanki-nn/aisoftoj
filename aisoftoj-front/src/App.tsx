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
import { continuePracticeSession, startPaperSession } from './lib/api';

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
      const session = await startPaperSession(paper.id);
      setSession(session);
      navigate(`${ROUTES.examSessionBase}/${session.id}`);
    } catch (error) {
      alert('开始考试失败：' + (error as Error).message);
    }
  };

  const handleStartExam = (config: ExamConfigType) => {
    try {
      setLastConfig(config);
      const session = startExam(config);
      navigate(`${ROUTES.examSessionBase}/${session.id}`);
    } catch (error) {
      alert('开始考试失败：' + (error as Error).message);
    }
  };

  const handleCompleteExam = () => {
    const session = completeExam();
    if (session) {
      navigate(`${ROUTES.examResultBase}/${session.id}`);
    }
  };

  const handleRestartExam = () => {
    if (lastConfig) {
      handleStartExam(lastConfig);
    }
  };

  const handleBackToHome = () => {
    resetSession();
    navigate(ROUTES.home);
  };

  const handleBackToConfig = () => {
    resetSession();
    navigate(ROUTES.home);
  };

  const handleContinuePractice = () => {
    resetSession();
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
        <Route path={ROUTES.examConfig} element={<ExamConfig onStartExam={handleStartExam} />} />
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
