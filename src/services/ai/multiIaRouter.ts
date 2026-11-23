/**
 * Module 6 — multi-IA diagnostic router.
 * - Parallel engine votes (local heuristics always available)
 * - Optional live providers when EXPO_PUBLIC_* keys or MULTI_IA_PROXY are set
 * - Consensus synthesis + confidence — never throws
 */

export type IaEngineId = 'Claude' | 'Gemini' | 'GPT-4o' | 'Grok' | 'Mistral' | 'DeepSeek';

export type IaEngineVote = {
  engine: IaEngineId;
  ok: boolean;
  source: 'live' | 'heuristic' | 'skipped' | 'error';
  latencyMs: number;
  summary: string;
  likelyParts: string[];
  severity: 'info' | 'warn' | 'critique';
};

export type MultiIaResult = {
  ok: boolean;
  prompt: string;
  context: string;
  engines: IaEngineVote[];
  consensus: string;
  likelyParts: string[];
  severity: 'info' | 'warn' | 'critique';
  liveCount: number;
  heuristicCount: number;
  totalMs: number;
  label: string;
};

const ALL: IaEngineId[] = ['Claude', 'Gemini', 'GPT-4o', 'Grok', 'Mistral', 'DeepSeek'];

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

function proxyUrl(): string {
  return env('EXPO_PUBLIC_MULTI_IA_PROXY_URL');
}

function providerKey(engine: IaEngineId): string {
  switch (engine) {
    case 'Claude':
      return env('EXPO_PUBLIC_ANTHROPIC_API_KEY');
    case 'Gemini':
      return env('EXPO_PUBLIC_GEMINI_API_KEY');
    case 'GPT-4o':
      return env('EXPO_PUBLIC_OPENAI_API_KEY');
    case 'Grok':
      return env('EXPO_PUBLIC_GROK_API_KEY');
    case 'Mistral':
      return env('EXPO_PUBLIC_MISTRAL_API_KEY');
    case 'DeepSeek':
      return env('EXPO_PUBLIC_DEEPSEEK_API_KEY');
    default:
      return '';
  }
}

/** Keyword → parts / severity heuristics (deterministic per engine bias). */
function heuristicVote(engine: IaEngineId, prompt: string, context: string): IaEngineVote {
  const t0 = Date.now();
  const text = `${prompt} ${context}`.toLowerCase();
  const parts: string[] = [];
  let severity: IaEngineVote['severity'] = 'info';
  let focus = 'diagnostic général';

  if (/frein|plaquette|étrier|braking|brake/.test(text)) {
    parts.push('Plaquettes de frein', 'Disques', 'Étrier');
    severity = 'warn';
    focus = 'freinage';
  }
  if (/bruit|cliquetis|cognement|roulement|squeal|noise/.test(text)) {
    parts.push('Roulement moyeu', 'Courroie accessoire', 'Silentbloc');
    severity = severity === 'info' ? 'warn' : severity;
    focus = focus === 'diagnostic général' ? 'acoustique' : focus;
  }
  if (/fumée|smoke|huile|huileuse|bleu|noir/.test(text)) {
    parts.push('Joint de queue de soupape', 'Turbo', 'Guide soupape');
    severity = 'critique';
    focus = 'étanchéité / combustion';
  }
  if (/adblue|nox|scr|def/.test(text)) {
    parts.push('Capteur NOx', 'Pompe AdBlue', 'Catalyseur SCR');
    severity = 'warn';
    focus = 'antipollution PL';
  }
  if (/batterie|démarrage|voltage|start/.test(text)) {
    parts.push('Batterie 12V', 'Alternateur', 'Démarreur');
    severity = 'warn';
    focus = 'électrique démarrage';
  }
  if (/surchauffe|température|radiateur|overheat/.test(text)) {
    parts.push('Thermostat', 'Pompe à eau', 'Radiateur');
    severity = 'critique';
    focus = 'refroidissement';
  }
  if (!parts.length) {
    parts.push('Filtre à air', 'Bougies / injecteurs', 'Capteur O2');
  }

  // Light engine-specific bias so “croisement” is visible without live APIs
  const bias: Record<IaEngineId, string> = {
    Claude: 'analyse causale structurée',
    Gemini: 'corrélation capteurs / historique',
    'GPT-4o': 'plan de réparation étape par étape',
    Grok: 'signaux faibles / cas terrain',
    Mistral: 'synthèse FR concise',
    DeepSeek: 'checklist pièces + outils',
  };

  return {
    engine,
    ok: true,
    source: 'heuristic',
    latencyMs: Date.now() - t0,
    summary: `[${engine}/${bias[engine]}] Focus ${focus} — pistes: ${parts.slice(0, 3).join(', ')}.`,
    likelyParts: parts.slice(0, 4),
    severity,
  };
}

async function liveProxyVote(
  engine: IaEngineId,
  prompt: string,
  context: string,
): Promise<IaEngineVote | null> {
  const base = proxyUrl();
  if (!base) return null;
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine, prompt, context }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        engine,
        ok: false,
        source: 'error',
        latencyMs: Date.now() - t0,
        summary: `Proxy ${engine} HTTP ${res.status}`,
        likelyParts: [],
        severity: 'info',
      };
    }
    const body = (await res.json()) as {
      summary?: string;
      likelyParts?: string[];
      severity?: IaEngineVote['severity'];
    };
    return {
      engine,
      ok: true,
      source: 'live',
      latencyMs: Date.now() - t0,
      summary: body.summary ?? `(${engine}) réponse proxy`,
      likelyParts: body.likelyParts ?? [],
      severity: body.severity ?? 'info',
    };
  } catch (e) {
    return {
      engine,
      ok: false,
      source: 'error',
      latencyMs: Date.now() - t0,
      summary: e instanceof Error ? e.message : String(e),
      likelyParts: [],
      severity: 'info',
    };
  }
}

/** OpenAI-compatible chat (GPT-4o / DeepSeek / Grok / Mistral variants). */
async function liveOpenAiCompat(
  engine: IaEngineId,
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string,
  context: string,
): Promise<IaEngineVote> {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 320,
        messages: [
          {
            role: 'system',
            content:
              'Tu es un technicien auto/PL. Réponds en français, court: causes, pièces, gravité (info|warn|critique).',
          },
          { role: 'user', content: `Contexte: ${context || 'n/a'}\nProblème: ${prompt}` },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        engine,
        ok: false,
        source: 'error',
        latencyMs: Date.now() - t0,
        summary: body.error?.message ?? `HTTP ${res.status}`,
        likelyParts: [],
        severity: 'info',
      };
    }
    const summary = body.choices?.[0]?.message?.content?.trim() || `(${engine}) vide`;
    return {
      engine,
      ok: true,
      source: 'live',
      latencyMs: Date.now() - t0,
      summary: summary.slice(0, 600),
      likelyParts: [],
      severity: /critique|urgent|danger/i.test(summary) ? 'critique' : 'warn',
    };
  } catch (e) {
    return {
      engine,
      ok: false,
      source: 'error',
      latencyMs: Date.now() - t0,
      summary: e instanceof Error ? e.message : String(e),
      likelyParts: [],
      severity: 'info',
    };
  }
}

async function liveEngineVote(
  engine: IaEngineId,
  prompt: string,
  context: string,
): Promise<IaEngineVote> {
  const viaProxy = await liveProxyVote(engine, prompt, context);
  if (viaProxy) return viaProxy;

  const key = providerKey(engine);
  if (!key) return heuristicVote(engine, prompt, context);

  if (engine === 'GPT-4o') {
    return liveOpenAiCompat(
      engine,
      'https://api.openai.com/v1/chat/completions',
      key,
      'gpt-4o-mini',
      prompt,
      context,
    );
  }
  if (engine === 'DeepSeek') {
    return liveOpenAiCompat(
      engine,
      'https://api.deepseek.com/chat/completions',
      key,
      'deepseek-chat',
      prompt,
      context,
    );
  }
  if (engine === 'Mistral') {
    return liveOpenAiCompat(
      engine,
      'https://api.mistral.ai/v1/chat/completions',
      key,
      'mistral-small-latest',
      prompt,
      context,
    );
  }
  if (engine === 'Grok') {
    return liveOpenAiCompat(
      engine,
      'https://api.x.ai/v1/chat/completions',
      key,
      'grok-beta',
      prompt,
      context,
    );
  }
  // Claude / Gemini without SDK: fall back to heuristic unless proxy set
  return heuristicVote(engine, prompt, context);
}

function synthesize(votes: IaEngineVote[], prompt: string): Pick<
  MultiIaResult,
  'consensus' | 'likelyParts' | 'severity'
> {
  const okVotes = votes.filter((v) => v.ok);
  const partScores = new Map<string, number>();
  for (const v of okVotes) {
    for (const p of v.likelyParts) {
      partScores.set(p, (partScores.get(p) ?? 0) + 1);
    }
  }
  const likelyParts = [...partScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p]) => p);

  let severity: MultiIaResult['severity'] = 'info';
  if (okVotes.some((v) => v.severity === 'critique')) severity = 'critique';
  else if (okVotes.some((v) => v.severity === 'warn')) severity = 'warn';

  const live = okVotes.filter((v) => v.source === 'live').length;
  const lines = [
    `Consensus sur « ${prompt.slice(0, 100)} » — ${okVotes.length} moteur(s), dont ${live} live.`,
    likelyParts.length
      ? `Pièces les plus citées : ${likelyParts.join(', ')}.`
      : 'Pas de pièce dominante — précisez bruit / voyant / fumée.',
    `Gravité agrégée : ${severity}.`,
    'Suite : catalogue M3 · OBD M5 · tutoriels YouTube M11.',
  ];
  return { consensus: lines.join(' '), likelyParts, severity };
}

/**
 * Run enabled engines in parallel (Promise.allSettled) with per-engine timeout budget.
 */
export async function runMultiIaDiagnostic(opts: {
  prompt: string;
  context?: string;
  enabled?: IaEngineId[];
}): Promise<MultiIaResult> {
  const t0 = Date.now();
  const prompt = opts.prompt.trim();
  const context = (opts.context ?? '').trim();
  const enabled = (opts.enabled?.length ? opts.enabled : ALL).filter((e) => ALL.includes(e));

  if (!prompt) {
    return {
      ok: false,
      prompt,
      context,
      engines: [],
      consensus: 'Prompt vide',
      likelyParts: [],
      severity: 'info',
      liveCount: 0,
      heuristicCount: 0,
      totalMs: 0,
      label: 'Multi-IA — prompt requis',
    };
  }

  const settled = await Promise.allSettled(
    enabled.map((engine) => liveEngineVote(engine, prompt, context)),
  );

  const engines: IaEngineVote[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    return {
      engine: enabled[i],
      ok: false,
      source: 'error' as const,
      latencyMs: 0,
      summary: s.reason instanceof Error ? s.reason.message : 'échec',
      likelyParts: [],
      severity: 'info' as const,
    };
  });

  const { consensus, likelyParts, severity } = synthesize(engines, prompt);
  const liveCount = engines.filter((e) => e.source === 'live' && e.ok).length;
  const heuristicCount = engines.filter((e) => e.source === 'heuristic' && e.ok).length;
  const hasProxy = Boolean(proxyUrl());
  const hasAnyKey = ALL.some((e) => providerKey(e));

  return {
    ok: engines.some((e) => e.ok),
    prompt,
    context,
    engines,
    consensus,
    likelyParts,
    severity,
    liveCount,
    heuristicCount,
    totalMs: Date.now() - t0,
    label:
      liveCount > 0
        ? `Multi-IA LIVE (${liveCount}) + heuristique (${heuristicCount}) · ${Date.now() - t0} ms`
        : hasProxy || hasAnyKey
          ? `Multi-IA — clés présentes mais votes live KO · heuristique ${heuristicCount}`
          : `Multi-IA heuristique croisée (${heuristicCount} moteurs) · proxy/clés optionnels · ${Date.now() - t0} ms`,
  };
}

export function listIaEngines(): IaEngineId[] {
  return [...ALL];
}
