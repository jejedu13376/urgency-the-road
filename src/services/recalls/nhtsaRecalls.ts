/**
 * Live manufacturer recalls via NHTSA (free, no API key) — Module 6 web path.
 * https://api.nhtsa.gov/recalls/recallsByVehicle
 */

export type RecallHit = {
  id: string;
  title: string;
  source: string;
  severity: 'info' | 'warn' | 'critique';
  region: string;
  component?: string;
};

export type RecallSearchResult = {
  ok: boolean;
  items: RecallHit[];
  label: string;
  source: 'nhtsa' | 'empty' | 'error';
};

type CacheEntry = { at: number; result: RecallSearchResult };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

export async function fetchRecallsByVehicle(opts: {
  make?: string;
  model?: string;
  year?: number | string;
}): Promise<RecallSearchResult> {
  const make = (opts.make ?? '').trim();
  const model = (opts.model ?? '').trim();
  const year = String(opts.year ?? '').trim();
  if (!make || !model || !year) {
    return {
      ok: false,
      items: [],
      label: 'VIN/flotte incomplet — recalls NHTSA non interrogés',
      source: 'empty',
    };
  }

  const key = `${make}|${model}|${year}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;

  const url = new URL('https://api.nhtsa.gov/recalls/recallsByVehicle');
  url.searchParams.set('make', make);
  url.searchParams.set('model', model);
  url.searchParams.set('modelYear', year);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const result: RecallSearchResult = {
        ok: false,
        items: [],
        label: `NHTSA recalls HTTP ${res.status}`,
        source: 'error',
      };
      return result;
    }
    const body = (await res.json()) as {
      results?: {
        NHTSACampaignNumber?: string;
        Component?: string;
        Summary?: string;
        Consequence?: string;
      }[];
      Count?: number;
    };
    const items: RecallHit[] = (body.results ?? []).slice(0, 8).map((r, i) => {
      const consequence = (r.Consequence ?? '').toLowerCase();
      const severity: RecallHit['severity'] = /fire|crash|injury|death|accident/.test(consequence)
        ? 'critique'
        : /brake|steer|air bag|airbag/.test((r.Component ?? '').toLowerCase())
          ? 'warn'
          : 'info';
      return {
        id: r.NHTSACampaignNumber ?? `nhtsa-${i}`,
        title: (r.Summary ?? r.Component ?? 'Rappel NHTSA').slice(0, 160),
        source: 'NHTSA recallsByVehicle',
        severity,
        region: 'NA',
        component: r.Component,
      };
    });
    const result: RecallSearchResult = {
      ok: true,
      items,
      label:
        items.length > 0
          ? `NHTSA LIVE — ${items.length} rappel(s) ${make} ${model} ${year}`
          : `NHTSA LIVE — aucun rappel pour ${make} ${model} ${year}`,
      source: 'nhtsa',
    };
    cache.set(key, { at: Date.now(), result });
    return result;
  } catch (e) {
    return {
      ok: false,
      items: [],
      label: e instanceof Error ? e.message : 'NHTSA recalls erreur réseau',
      source: 'error',
    };
  }
}
