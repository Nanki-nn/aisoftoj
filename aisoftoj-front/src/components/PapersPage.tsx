import React from 'react';
import { ExamPaper } from '../data/examPapers';
import { ExamHome } from './ExamHome';

type PapersPageProps = {
  onStartPaper: (paper: ExamPaper, mode: 'practice' | 'exam') => void;
  onShowProfile: () => void;
  onShowAuth: () => void;
  onShowPracticeHistory: () => void;
  onShowWrongQuestions: () => void;
};

export function PapersPage(props: PapersPageProps) {
  return <ExamHome {...props} />;
}
