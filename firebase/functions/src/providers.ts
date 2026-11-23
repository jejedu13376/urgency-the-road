import { clampParts, clampSeverity, extractJsonObject } from './parse';
import type { IaEngineId, ProxySuccessBody, Severity } from './types';

const SYSTEM = `Tu es un expert diagnostic automobile / PL (camions) pour l'app Urgence Mécanique (Canada / FR).
Réponds UNIQUEMENT en JSON valide, sans markdown, schéma exact:
{"summary":"string FR courte (2-4 phrases)","likelyParts":["pièce1","pièce2"],"severity":"info"|"warn"|"critique"}
Règles: pas de conseils dangereux; si urgence freinage/incendie/surchauffe → severity "critique";
liste 2 à 5 pièces / organes probables; sois concret et actionnable.`;

type ProviderResult = Omit<ProxySuccessBody, 'engine' | 'latencyMs'>;

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function userContent(prompt: string, context: string): string {
  return context
    ? `Contexte véhicule / symptômes:\n${context}\n\nDemande:\n${prompt}`
    : prompt;
}

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

function missingKey(secretName: string): never {
  const err = new Error(`Provider key not configured on server (${secretName})`);
  (err as Error & { status: number; code: string }).status = 503;
  (err as Error & { status: number; code: string }).code = 'provider/missing-key';
  throw err;
}

function toSuccess(
  provider: string,
  summary: string,
  likelyParts: string[],
  severity: Severity,
): ProviderResult {
  return {
    summary: summary.trim().slice(0, 1200) || `(${provider}) réponse vide`,
    likelyParts,
    severity,
    provider,
  };
}

function fromModelText(provider: string, text: string): ProviderResult {
  const parsed = extractJsonObject(text);
  if (parsed) {
    const summary =
      typeof parsed.summary === 'string' ? parsed.summary : text.slice(0, 600);
    return toSuccess(
      provider,
      summary,
      clampParts(parsed.likelyParts),
      clampSeverity(parsed.severity),
    );
  }
  return toSuccess(provider, text.slice(0, 600), [], 'info');
}

async function fetchJson(
  url: string,
  init: RequestInit,
  label: string,
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`${label} HTTP ${res.status}: ${text.slice(0, 200)}`);
      (err as Error & { status: number; code: string }).status = 502;
      (err as Error & { status: number; code: string }).code = 'provider/upstream';
      throw err;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      const err = new Error(`${label} returned non-JSON`);
      (err as Error & { status: number; code: string }).status = 502;
      (err as Error & { status: number; code: string }).code = 'provider/bad-json';
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }
}

/** OpenAI-compatible chat completions (OpenAI, Grok/xAI, Mistral, DeepSeek). */
async function openAiCompatible(opts: {
  label: string;
  url: string;
  apiKey: string;
  model: string;
  prompt: string;
  context: string;
}): Promise<ProviderResult> {
  const body = {
    model: opts.model,
    temperature: 0.2,
    max_tokens: 500,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userContent(opts.prompt, opts.context) },
    ] satisfies ChatMessage[],
  };
  const data = (await fetchJson(
    opts.url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
    },
    opts.label,
  )) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  return fromModelText(opts.label, text);
}

async function callClaude(prompt: string, context: string): Promise<ProviderResult> {
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) missingKey('ANTHROPIC_API_KEY');
  const model = env('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514';
  const data = (await fetchJson(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature: 0.2,
        system: SYSTEM,
        messages: [{ role: 'user', content: userContent(prompt, context) }],
      }),
    },
    'Anthropic',
  )) as { content?: Array<{ type?: string; text?: string }> };
  const text =
    data.content?.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n') ??
    '';
  return fromModelText('Anthropic', text);
}

async function callGemini(prompt: string, context: string): Promise<ProviderResult> {
  const apiKey = env('GEMINI_API_KEY') || env('GOOGLE_AI_API_KEY');
  if (!apiKey) missingKey('GEMINI_API_KEY');
  const model = env('GEMINI_MODEL') || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const data = (await fetchJson(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: userContent(prompt, context) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
      }),
    },
    'Gemini',
  )) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';
  return fromModelText('Gemini', text);
}

async function callGpt4o(prompt: string, context: string): Promise<ProviderResult> {
  const apiKey = env('OPENAI_API_KEY');
  if (!apiKey) missingKey('OPENAI_API_KEY');
  return openAiCompatible({
    label: 'OpenAI',
    url: env('OPENAI_BASE_URL') || 'https://api.openai.com/v1/chat/completions',
    apiKey,
    model: env('OPENAI_MODEL') || 'gpt-4o',
    prompt,
    context,
  });
}

async function callGrok(prompt: string, context: string): Promise<ProviderResult> {
  const apiKey = env('XAI_API_KEY') || env('GROK_API_KEY');
  if (!apiKey) missingKey('XAI_API_KEY');
  return openAiCompatible({
    label: 'xAI',
    url: env('XAI_BASE_URL') || 'https://api.x.ai/v1/chat/completions',
    apiKey,
    model: env('XAI_MODEL') || 'grok-2-latest',
    prompt,
    context,
  });
}

async function callMistral(prompt: string, context: string): Promise<ProviderResult> {
  const apiKey = env('MISTRAL_API_KEY');
  if (!apiKey) missingKey('MISTRAL_API_KEY');
  return openAiCompatible({
    label: 'Mistral',
    url: env('MISTRAL_BASE_URL') || 'https://api.mistral.ai/v1/chat/completions',
    apiKey,
    model: env('MISTRAL_MODEL') || 'mistral-small-latest',
    prompt,
    context,
  });
}

async function callDeepSeek(prompt: string, context: string): Promise<ProviderResult> {
  const apiKey = env('DEEPSEEK_API_KEY');
  if (!apiKey) missingKey('DEEPSEEK_API_KEY');
  return openAiCompatible({
    label: 'DeepSeek',
    url: env('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/chat/completions',
    apiKey,
    model: env('DEEPSEEK_MODEL') || 'deepseek-chat',
    prompt,
    context,
  });
}

export async function runProvider(
  engine: IaEngineId,
  prompt: string,
  context: string,
): Promise<ProxySuccessBody> {
  const t0 = Date.now();
  let result: ProviderResult;
  switch (engine) {
    case 'Claude':
      result = await callClaude(prompt, context);
      break;
    case 'Gemini':
      result = await callGemini(prompt, context);
      break;
    case 'GPT-4o':
      result = await callGpt4o(prompt, context);
      break;
    case 'Grok':
      result = await callGrok(prompt, context);
      break;
    case 'Mistral':
      result = await callMistral(prompt, context);
      break;
    case 'DeepSeek':
      result = await callDeepSeek(prompt, context);
      break;
    default: {
      const err = new Error(`Unsupported engine: ${String(engine)}`);
      (err as Error & { status: number; code: string }).status = 400;
      (err as Error & { status: number; code: string }).code = 'bad-request/engine';
      throw err;
    }
  }
  return {
    engine,
    summary: result.summary,
    likelyParts: result.likelyParts,
    severity: result.severity,
    provider: result.provider,
    latencyMs: Date.now() - t0,
  };
}

/** Which engines have a server key configured (no secret values exposed). */
export function configuredEngines(): IaEngineId[] {
  const checks: Array<[IaEngineId, boolean]> = [
    ['Claude', Boolean(env('ANTHROPIC_API_KEY'))],
    ['Gemini', Boolean(env('GEMINI_API_KEY') || env('GOOGLE_AI_API_KEY'))],
    ['GPT-4o', Boolean(env('OPENAI_API_KEY'))],
    ['Grok', Boolean(env('XAI_API_KEY') || env('GROK_API_KEY'))],
    ['Mistral', Boolean(env('MISTRAL_API_KEY'))],
    ['DeepSeek', Boolean(env('DEEPSEEK_API_KEY'))],
  ];
  return checks.filter(([, ok]) => ok).map(([id]) => id);
}
