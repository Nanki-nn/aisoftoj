import { reduceQuestionContext } from './aiPageContext';

describe('AI page question context', () => {
  it('publishes the latest rendered question after entering from a query-param link', () => {
    const initial = reduceQuestionContext(null, { type: 'publish', questionId: 123 });
    expect(reduceQuestionContext(initial, { type: 'publish', questionId: 124 })).toBe(124);
  });

  it('does not let stale cleanup erase a newer page question', () => {
    const latest = reduceQuestionContext(124, { type: 'clear', questionId: 123 });
    expect(latest).toBe(124);
    expect(reduceQuestionContext(latest, { type: 'clear', questionId: 124 })).toBeNull();
  });
});
