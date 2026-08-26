export const AI_ASSISTANT_UNAVAILABLE_MESSAGE = 'AI 助手线上请求暂未开放';

export function resolveAIAssistantEnabled(
  rawValue: string | undefined,
  isDevelopment: boolean,
): boolean {
  return rawValue === undefined ? isDevelopment : rawValue === 'true';
}

export const AI_ASSISTANT_ENABLED = resolveAIAssistantEnabled(
  import.meta.env.VITE_AI_ASSISTANT_ENABLED,
  import.meta.env.DEV,
);
