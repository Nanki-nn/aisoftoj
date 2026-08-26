import { resolveAIAssistantEnabled } from './aiAvailability';

describe('AI assistant availability', () => {
  it.each([
    { raw: undefined, dev: true, expected: true },
    { raw: undefined, dev: false, expected: false },
    { raw: 'true', dev: true, expected: true },
    { raw: 'true', dev: false, expected: true },
    { raw: 'false', dev: true, expected: false },
    { raw: '', dev: true, expected: false },
    { raw: 'TRUE', dev: true, expected: false },
    { raw: 'invalid', dev: false, expected: false },
  ])('resolves raw=$raw dev=$dev to $expected', ({ raw, dev, expected }) => {
    expect(resolveAIAssistantEnabled(raw, dev)).toBe(expected);
  });
});
