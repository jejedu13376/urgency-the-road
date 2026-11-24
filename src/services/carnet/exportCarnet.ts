/**
 * Module 10 — carnet export.
 * Shares plain-text + HTML-lite via the OS share sheet.
 * PDF via expo-print is a real printable file with local attestation hash
 * (not a server-signed / legally certified PDF).
 */
import { Share, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { attestCarnet, type CarnetAttestation } from './carnetAttestation';

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

/** Single frozen timestamp so text + HTML in one share share the same hash. */
function attestationFor(
  input: CarnetExportInput,
  exportedAtIso: string,
): CarnetAttestation {
  return attestCarnet({
    vehicleLabel: input.vehicleLabel,
    vin: input.vin,
    odometerKm: input.odometerKm,
    entries: input.entries,
    maintenanceDone: input.maintenanceDone,
    exportedAtIso,
  });
}

export function buildCarnetText(
  input: CarnetExportInput,
  exportedAtIso: string = new Date().toISOString(),
): string {
  const att = attestationFor(input, exportedAtIso);
  const lines: string[] = [
    'URGENCE MÉCANIQUE — CARNET NUMÉRIQUE',
    `Véhicule : ${input.vehicleLabel}`,
    input.vin ? `VIN : ${input.vin}` : 'VIN : —',
    `Km actuel : ${input.odometerKm.toLocaleString('fr-FR')}`,
    `Export : ${new Date(exportedAtIso).toLocaleString('fr-FR')}`,
    `Attestation locale : ${att.hash}`,
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
    att.label,
    'Note : PDF / texte avec hash local — signature serveur juridique = option externe.',
  );
  return lines.join('\n');
}

/** Printable HTML-lite for mail clients / browsers — local attestation, not server-signed. */
export function buildCarnetHtml(
  input: CarnetExportInput,
  exportedAtIso: string = new Date().toISOString(),
): string {
  const att = attestationFor(input, exportedAtIso);
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
th{background:#f4f4f4}.note{color:#666;font-size:12px;margin-top:24px}code{font-size:11px;word-break:break-all}</style></head><body>
<h1>Urgence Mécanique — Carnet numérique</h1>
<p><strong>Véhicule :</strong> ${esc(input.vehicleLabel)}<br/>
<strong>VIN :</strong> ${esc(input.vin ?? '—')}<br/>
<strong>Km :</strong> ${input.odometerKm.toLocaleString('fr-FR')}<br/>
<strong>Export :</strong> ${esc(new Date(exportedAtIso).toLocaleString('fr-FR'))}<br/>
<strong>Attestation locale :</strong> <code>${esc(att.hash)}</code></p>
<table><thead><tr><th>Date</th><th>Km</th><th>Intervention</th><th>Coût</th><th>Facture</th></tr></thead>
<tbody>${rows}</tbody></table>
<h2>Entretiens faits</h2>${done}
<p class="note">${esc(att.label)}. Signature serveur juridique = option externe (hors MVP logiciel).</p>
</body></html>`;
}

/**
 * Generate a real PDF file from the carnet HTML and open the share sheet.
 * Explicitly not certified / not cryptographically signed.
 */
export async function shareCarnetPdf(input: CarnetExportInput): Promise<{
  ok: boolean;
  message: string;
  uri?: string;
}> {
  const iso = new Date().toISOString();
  const html = buildCarnetHtml(input, iso);
  try {
    const file = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Carnet PDF (attestation locale)',
      });
      return {
        ok: true,
        uri: file.uri,
        message: `PDF généré (${file.numberOfPages} page(s)) — attestation locale incluse ; pas de signature serveur.`,
      };
    }
    return {
      ok: true,
      uri: file.uri,
      message: `PDF généré (${file.uri}) — partage OS indisponible ; attestation locale dans le fichier.`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Échec génération PDF carnet',
    };
  }
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
  // One frozen ISO so text + HTML embed the same attestation hash.
  const iso = new Date().toISOString();
  const html = buildCarnetHtml(input, iso);
  const text = buildCarnetText(input, iso);
  const message = `${text}\n\n—— HTML-lite ——\n${html}`;
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
