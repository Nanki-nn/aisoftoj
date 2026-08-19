import React, { createContext, useCallback, useContext, useMemo, useReducer, useState } from 'react';
import { reduceQuestionContext } from '../lib/aiPageContext';

type AgentPanelContextValue = {
  isOpen: boolean;
  currentQuestionId: number | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  publishQuestion: (questionId: number) => void;
  clearQuestion: (questionId: number) => void;
};

const AgentPanelContext = createContext<AgentPanelContextValue | null>(null);

export function AgentPanelProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentQuestionId, dispatchQuestionContext] = useReducer(reduceQuestionContext, null);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(value => !value), []);
  const publishQuestion = useCallback((questionId: number) => {
    dispatchQuestionContext({ type: 'publish', questionId });
  }, []);
  const clearQuestion = useCallback((questionId: number) => {
    dispatchQuestionContext({ type: 'clear', questionId });
  }, []);

  const value = useMemo(() => ({
    isOpen,
    currentQuestionId,
    open,
    close,
    toggle,
    publishQuestion,
    clearQuestion,
  }), [clearQuestion, close, currentQuestionId, isOpen, open, publishQuestion, toggle]);

  return <AgentPanelContext.Provider value={value}>{children}</AgentPanelContext.Provider>;
}

export function useAgentPanel() {
  const context = useContext(AgentPanelContext);
  if (!context) {
    throw new Error('useAgentPanel must be used within AgentPanelProvider');
  }
  return context;
}
