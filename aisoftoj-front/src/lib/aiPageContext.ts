export type QuestionContextAction =
  | { type: 'publish'; questionId: number }
  | { type: 'clear'; questionId: number };

export function reduceQuestionContext(
  currentQuestionId: number | null,
  action: QuestionContextAction,
): number | null {
  if (action.type === 'publish') return action.questionId;
  return currentQuestionId === action.questionId ? null : currentQuestionId;
}
