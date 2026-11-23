import {
  isIaEngineId,
  type IaEngineId,
  type ProxyRequestBody,
  type Severity,
} from './types';

const MAX_PROMPT = 4000;
const MAX_CONTEXT = 4000;

export type ParsedRequest = {
  engine: IaEngineId;
  prompt: string;
  context: string;
};

export function parseProxyBody(raw: unknown): ParsedRequest {
  const body = (raw ?? {}) as ProxyRequestBody;
  if (!isIaEngineId(body.engine)) {
    const err = new Error('Body.engine must be one of Claude|Gemini|GPT-4o|Grok|Mistral|DeepSeek');
    (err as Error & { status: number; code: string }).status = 400;
    (err as Error & { status: number; code: string }).code = 'bad-request/engine';
    throw err;
  }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    const err = new Error('Body.prompt is required');
    (err as Error & { status: number; code: string }).status = 400;
    (err as Error & { status: number; code: string }).code = 'bad-request/prompt';
    throw err;
  }
  if (prompt.length > MAX_PROMPT) {
    const err = new Error(`Body.prompt exceeds ${MAX_PROMPT} characters`);
    (err as Error & { status: number; code: string }).status = 400;
    (err as Error & { status: number; code: string }).code = 'bad-request/prompt-too-long';
    throw err;
  }
  const context =
    typeof body.context === 'string' ? body.context.trim().slice(0, MAX_CONTEXT) : '';
  return { engine: body.engine, prompt, context };
}

export function clampSeverity(value: unknown): Severity {
  if (value === 'warn' || value === 'critique' || value === 'info') return value;
  return 'info';
}

export function clampParts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim().slice(0, 80))
    .slice(0, 6);
}

/** Best-effort extract JSON object from model text (fenced or raw). */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
