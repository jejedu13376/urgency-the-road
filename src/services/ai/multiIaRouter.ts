/**
 * Module 6 — multi-IA diagnostic router.
 * - Parallel heuristic engine votes (always available, no secrets)
 * - Optional LIVE votes ONLY via EXPO_PUBLIC_MULTI_IA_PROXY_URL (server holds LLM keys)
 * - Never reads provider API keys from EXPO_PUBLIC_* — those would ship in the JS bundle
 */

import { getFirebase } from '../../firebase/config';

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
  /** True when signed in but email not verified — LIVE proxy blocked server-side. */
  emailVerificationRequired?: boolean;
};

const ALL: IaEngineId[] = ['Claude', 'Gemini', 'GPT-4o', 'Grok', 'Mistral', 'DeepSeek'];

function proxyUrl(): string {
  return (process.env.EXPO_PUBLIC_MULTI_IA_PROXY_URL ?? '').trim();
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

/**
 * Reload Auth user + force-refresh ID token so emailVerified is fresh after the
 * user clicks the verification link (without requiring full sign-out).
 */
async function refreshAuthUserForProxy(): Promise<{
  bearer?: string;
  needsVerification: boolean;
}> {
  try {
    const fb = getFirebase();
    const user = fb?.auth.currentUser;
    if (!user) return { needsVerification: false };
    await user.reload();
    const fresh = fb.auth.currentUser;
    if (!fresh) return { needsVerification: false };
    if (!fresh.emailVerified) return { needsVerification: true };
    const token = await fresh.getIdToken(true);
    return token
      ? { bearer: `Bearer ${token}`, needsVerification: false }
      : { needsVerification: false };
  } catch {
    return { needsVerification: false };
  }
}

/**
 * Live vote via server proxy only. Proxy holds OpenAI/Anthropic/etc. keys and
 * requires a Firebase ID token. Without auth / on 401·403·429·503 → null (heuristic).
 */
async function liveProxyVote(
  engine: IaEngineId,
  prompt: string,
  context: string,
  bearer: string | undefined,
): Promise<IaEngineVote | null> {
  const base = proxyUrl();
  if (!base || !bearer) return null;
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: bearer,
    };
    const res = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ engine, prompt, context }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      // Auth / rate / missing key → fall back to heuristic (null), not a hard error vote.
      if (
        res.status === 401 ||
        res.status === 403 ||
        res.status === 429 ||
        res.status === 503
      ) {
        return null;
      }
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

async function engineVote(
  engine: IaEngineId,
  prompt: string,
  context: string,
  bearer: string | undefined,
): Promise<IaEngineVote> {
  const viaProxy = await liveProxyVote(engine, prompt, context, bearer);
  if (viaProxy) return viaProxy;
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
 * Run enabled engines in parallel (Promise.allSettled).
 */
export async function runMultiIaDiagnostic(opts: {
  prompt: string;
  context?: string;
  enabled?: IaEngineId[];
}): Promise<MultiIaResult> {
  const t0 = Date.now();
  const prompt = opts.prompt.trim();
  const context = (opts.context ?? '').trim();
  // undefined/omitted → all engines; explicit [] → none (no silent fallback to ALL)
  const enabled =
    opts.enabled === undefined
      ? [...ALL]
      : opts.enabled.filter((e) => ALL.includes(e));

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

  if (enabled.length === 0) {
    return {
      ok: false,
      prompt,
      context,
      engines: [],
      consensus: 'Aucun moteur activé — réactivez au moins un modèle.',
      likelyParts: [],
      severity: 'info',
      liveCount: 0,
      heuristicCount: 0,
      totalMs: Date.now() - t0,
      label: 'Multi-IA — 0 moteur sélectionné',
    };
  }

  // One reload + force token refresh for the whole diagnostic (not per engine).
  const authState = proxyUrl()
    ? await refreshAuthUserForProxy()
    : { needsVerification: false as boolean, bearer: undefined as string | undefined };

  const settled = await Promise.allSettled(
    enabled.map((engine) => engineVote(engine, prompt, context, authState.bearer)),
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
  const emailVerificationRequired = authState.needsVerification;
  const ms = Date.now() - t0;

  let label: string;
  if (liveCount > 0) {
    label = `Multi-IA LIVE proxy (${liveCount}) + heuristique (${heuristicCount}) · ${ms} ms`;
  } else if (emailVerificationRequired && hasProxy) {
    label = `Multi-IA — vérifie ton email pour le LIVE · heuristique ${heuristicCount} · ${ms} ms`;
  } else if (hasProxy) {
    label = `Multi-IA — proxy KO · heuristique ${heuristicCount}`;
  } else {
    label = `Multi-IA heuristique croisée (${heuristicCount} moteurs) · proxy serveur optionnel · ${ms} ms`;
  }

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
    totalMs: ms,
    label,
    emailVerificationRequired,
  };
}

export function listIaEngines(): IaEngineId[] {
  return [...ALL];
}
