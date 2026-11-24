/**
 * Fil (discussion) live AI agent — wraps Multi-IA with subject-scoped prompts
 * for car · truck · parts · diagnostic · truckers. Replies stay short and
 * context-aware for the active subject + vehicle.
 */

import {
  runMultiIaDiagnostic,
  type IaEngineId,
  type MultiIaResult,
} from './multiIaRouter';
import {
  buildFilAiPrompt,
  emptyFilAiQuestionReply,
  formatFilAiReply,
  type FilAiChatTurn,
  type FilAiSubject,
} from './filAiPrompts';
import type { VehicleProfile } from '../../types/vehicle';

export {
  FIL_AI_SUBJECTS,
  buildFilAiPrompt,
  formatFilAiReply,
  type FilAiChatTurn,
  type FilAiSubject,
} from './filAiPrompts';

export type FilAiAskOpts = {
  message: string;
  subject: FilAiSubject;
  vehicle?: VehicleProfile | null;
  /** Prior turns (newest last). Last few are folded into context. */
  history?: FilAiChatTurn[];
  /** Optional engine subset — default = all Multi-IA engines. */
  enabled?: IaEngineId[];
  locale?: string;
};

export type FilAiReply = {
  ok: boolean;
  reply: string;
  subject: FilAiSubject;
  label: string;
  severity: MultiIaResult['severity'];
  likelyParts: string[];
  liveCount: number;
  emailVerificationRequired?: boolean;
  raw: MultiIaResult;
};

/**
 * Ask the Fil live AI agent (Multi-IA under the hood).
 */
export async function askFilAiAgent(opts: FilAiAskOpts): Promise<FilAiReply> {
  const message = opts.message.trim();
  const subject = opts.subject;

  if (!message) {
    const empty = await runMultiIaDiagnostic({ prompt: '' });
    return {
      ok: false,
      reply: emptyFilAiQuestionReply(opts.locale),
      subject,
      label: empty.label,
      severity: 'info',
      likelyParts: [],
      liveCount: 0,
      raw: empty,
    };
  }

  const { prompt, context } = buildFilAiPrompt({
    message,
    subject,
    vehicle: opts.vehicle,
    history: opts.history,
    locale: opts.locale,
  });

  const raw = await runMultiIaDiagnostic({
    prompt,
    context,
    enabled: opts.enabled,
  });

  const engineSummaries = raw.engines
    .filter((e) => e.ok && e.summary.trim())
    // Prefer live model text, then heuristics — never drop usable answers.
    .sort((a, b) => {
      const rank = (s: string) => (s === 'live' ? 0 : s === 'heuristic' ? 1 : 2);
      return rank(a.source) - rank(b.source);
    })
    .map((e) => e.summary);

  return {
    ok: raw.ok,
    reply: formatFilAiReply(
      {
        ok: raw.ok,
        consensus: raw.consensus,
        likelyParts: raw.likelyParts,
        severity: raw.severity,
        engineSummaries,
      },
      subject,
      opts.locale,
    ),
    subject,
    label: raw.label,
    severity: raw.severity,
    likelyParts: raw.likelyParts,
    liveCount: raw.liveCount,
    emailVerificationRequired: raw.emailVerificationRequired,
    raw,
  };
}
