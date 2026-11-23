/** Engines mirror `src/services/ai/multiIaRouter.ts` on the client. */
export type IaEngineId = 'Claude' | 'Gemini' | 'GPT-4o' | 'Grok' | 'Mistral' | 'DeepSeek';

export type Severity = 'info' | 'warn' | 'critique';

export type ProxyRequestBody = {
  engine?: unknown;
  prompt?: unknown;
  context?: unknown;
};

/** Response shape expected by `liveProxyVote` in multiIaRouter.ts */
export type ProxySuccessBody = {
  summary: string;
  likelyParts: string[];
  severity: Severity;
  engine: IaEngineId;
  provider: string;
  latencyMs: number;
};

export type ProxyErrorBody = {
  error: string;
  code: string;
  engine?: IaEngineId;
};

export const ALL_ENGINES: readonly IaEngineId[] = [
  'Claude',
  'Gemini',
  'GPT-4o',
  'Grok',
  'Mistral',
  'DeepSeek',
] as const;

export function isIaEngineId(value: unknown): value is IaEngineId {
  return typeof value === 'string' && (ALL_ENGINES as readonly string[]).includes(value);
}
