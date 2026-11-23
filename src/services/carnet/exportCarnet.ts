/**
 * Module 10 — carnet export.
 * Shares plain-text + HTML-lite via the OS share sheet.
 * Never claims "PDF certifié" — certification needs a signed backend.
 */
import { Share, Platform } from 'react-native';

export type CarnetExportLine = {
  title: string;
  km: number;
  dateIso: string;
  cost?: number;
  currency?: string;
  invoiceRef?: string;
};

export type CarnetExportInput = {
  vehicleLabel: string;
  vin?: string;
  odometerKm: number;
  entries: CarnetExportLine[];
  maintenanceDone?: string[];
};

export function buildCarnetText(input: CarnetExportInput): string {
  const lines: string[] = [
    'URGENCE MÉCANIQUE — CARNET NUMÉRIQUE',
    `Véhicule : ${input.vehicleLabel}`,
    input.vin ? `VIN : ${input.vin}` : 'VIN : —',
    `Km actuel : ${input.odometerKm.toLocaleString('fr-FR')}`,
    `Export : ${new Date().toLocaleString('fr-FR')}`,
    '',
    '— Interventions —',
  ];
  if (!input.entries.length) {
    lines.push('(aucune entrée)');
  } else {
    for (const e of input.entries) {
      const cost =
        e.cost != null ? ` · ${e.cost} ${e.currency ?? ''}`.trimEnd() : '';
      const inv = e.invoiceRef ? ` · ${e.invoiceRef}` : '';
      lines.push(
        `• ${e.dateIso} · ${e.km.toLocaleString('fr-FR')} km — ${e.title}${cost}${inv}`,
      );
    }
  }
  if (input.maintenanceDone?.length) {
    lines.push('', '— Entretiens marqués faits —');
    for (const t of input.maintenanceDone) lines.push(`• ${t}`);
  }
  lines.push(
    '',
    'Note : export texte / HTML-lite partageable — pas un PDF certifié / signé serveur.',
  );
  return lines.join('\n');
}

/** Printable HTML-lite for mail clients / browsers — not a signed PDF. */
export function buildCarnetHtml(input: CarnetExportInput): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rows = input.entries.length
    ? input.entries
        .map((e) => {
          const cost =
            e.cost != null ? `${e.cost}&nbsp;${esc(e.currency ?? '')}` : '—';
          return `<tr><td>${esc(e.dateIso)}</td><td>${e.km.toLocaleString('fr-FR')}</td><td>${esc(e.title)}</td><td>${cost}</td><td>${esc(e.invoiceRef ?? '—')}</td></tr>`;
        })
        .join('')
    : '<tr><td colspan="5">(aucune entrée)</td></tr>';
  const done = input.maintenanceDone?.length
    ? `<ul>${input.maintenanceDone.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '<p>—</p>';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>Carnet ${esc(input.vehicleLabel)}</title>
<style>body{font-family:system-ui,sans-serif;color:#1a1a1a;max-width:720px;margin:24px auto;padding:0 16px}
h1{font-size:1.25rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:14px}
th{background:#f4f4f4}.note{color:#666;font-size:12px;margin-top:24px}</style></head><body>
<h1>Urgence Mécanique — Carnet numérique</h1>
<p><strong>Véhicule :</strong> ${esc(input.vehicleLabel)}<br/>
<strong>VIN :</strong> ${esc(input.vin ?? '—')}<br/>
<strong>Km :</strong> ${input.odometerKm.toLocaleString('fr-FR')}<br/>
<strong>Export :</strong> ${esc(new Date().toLocaleString('fr-FR'))}</p>
<table><thead><tr><th>Date</th><th>Km</th><th>Intervention</th><th>Coût</th><th>Facture</th></tr></thead>
<tbody>${rows}</tbody></table>
<h2>Entretiens faits</h2>${done}
<p class="note">HTML-lite partageable — <strong>pas</strong> un PDF certifié / signé serveur. Branchez un backend de signature pour la certification.</p>
</body></html>`;
}

export async function shareCarnetText(input: CarnetExportInput): Promise<{
  ok: boolean;
  message: string;
}> {
  const message = buildCarnetText(input);
  try {
    const res = await Share.share({
      message,
      title: 'Carnet Urgence Mécanique',
      url: Platform.OS === 'ios' ? undefined : undefined,
    });
    if (res.action === Share.sharedAction) {
      return {
        ok: true,
        message: 'Carnet texte partagé (non certifié). PDF certifié = backend signature à brancher.',
      };
    }
    return { ok: false, message: 'Partage annulé — aucun fichier certifié généré.' };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Échec partage carnet',
    };
  }
}

/** Share HTML-lite (mail / notes) — still not a certified PDF. */
export async function shareCarnetHtmlLite(input: CarnetExportInput): Promise<{
  ok: boolean;
  message: string;
}> {
  const html = buildCarnetHtml(input);
  const message = `${buildCarnetText(input)}\n\n—— HTML-lite ——\n${html}`;
  try {
    const res = await Share.share({
      message,
      title: 'Carnet HTML-lite Urgence Mécanique',
    });
    if (res.action === Share.sharedAction) {
      return {
        ok: true,
        message:
          'Carnet HTML-lite partagé (imprimable via mail/navigateur). PDF certifié / signature serveur non branché.',
      };
    }
    return { ok: false, message: 'Partage HTML annulé — aucun PDF certifié généré.' };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Échec partage HTML carnet',
    };
  }
}
