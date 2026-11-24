/**
 * Self-contained Leaflet map HTML for WebView.
 * Right-side icon rail: Roads · Satellite · Terrain · Traffic · Transit · 3D · AQI · Street View.
 * Extends Esri/#47 basemap work (Esri imagery + Carto/OSM roads) with Terrain + overlays.
 * Vehicle DivIcon = LIVE GPS — not a canned polyline demo.
 */

/** Carto raster basemaps need a free key since 2026-09-25 — carto.com/basemaps/apikey */
function roadsTileUrl(): { url: string; kind: 'carto' | 'osm' } {
  const raw = (process.env.EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY ?? '').trim();
  const key = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  if (key) {
    return {
      kind: 'carto',
      url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${key}`,
    };
  }
  return {
    kind: 'osm',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  };
}

function mapboxToken(): string {
  return (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '').trim();
}

function tomtomKey(): string {
  return (
    process.env.EXPO_PUBLIC_TOMTOM_API_KEY ??
    process.env.TOMTOM_API_KEY ??
    ''
  )
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Live traffic tile overlay — no free global no-key feed.
 * Prefer TomTom flow (traffic-only), else Mapbox traffic-day style raster.
 */
export function trafficTileConfig(
  mapbox?: string,
  tomtom?: string,
): {
  url: string;
  kind: 'tomtom' | 'mapbox' | 'none';
  opacity: number;
  tileSize?: number;
  zoomOffset?: number;
} | null {
  const tt = (tomtom ?? tomtomKey()).replace(/[^a-zA-Z0-9_-]/g, '');
  if (tt) {
    return {
      kind: 'tomtom',
      // relative0 = green/yellow/red flow vs free-flow — traffic-only overlay.
      url: `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${tt}&tileSize=256`,
      opacity: 0.72,
    };
  }
  const mb = (mapbox ?? mapboxToken()).replace(/[^a-zA-Z0-9._-]/g, '');
  if (mb) {
    return {
      kind: 'mapbox',
      url: `https://api.mapbox.com/styles/v1/mapbox/traffic-day-v2/tiles/256/{z}/{x}/{y}?access_token=${mb}`,
      opacity: 0.55,
      tileSize: 256,
    };
  }
  return null;
}

export type GpsMapBoot = {
  lat: number;
  lon: number;
  mode: 'voiture' | 'camion';
  truckHeightM: number;
  truckWidthM: number;
  truckPtacT: number;
  /** Device GPS only — never silent Lille-as-device. */
  gpsOk: boolean;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  /** Optional Mapbox token for 3D buildings + traffic fallback. */
  mapboxToken?: string;
  /** Optional TomTom key for traffic-only flow overlay (preferred for traffic). */
  tomtomApiKey?: string;
};

export function buildGpsMapHtml(boot: GpsMapBoot): string {
  const token = (boot.mapboxToken ?? mapboxToken()).replace(/[^a-zA-Z0-9._-]/g, '');
  const tomtom = (boot.tomtomApiKey ?? tomtomKey()).replace(/[^a-zA-Z0-9_-]/g, '');
  const traffic = trafficTileConfig(token, tomtom);
  const bootPayload = {
    ...boot,
    mapboxToken: token || undefined,
    tomtomApiKey: tomtom || undefined,
  };
  const bootJson = JSON.stringify(bootPayload).replace(/</g, '\\u003c');
  const roads = roadsTileUrl();
  const roadsUrlJson = JSON.stringify(roads.url);
  const mapboxTokenJson = JSON.stringify(token);
  const trafficJson = JSON.stringify(traffic);
  const hasMapbox = token.length > 0;

  // CSP: allow Esri, Carto, OSM, OpenTopoMap, ÖPNVKarte transit, TomTom/Mapbox traffic, OSM Buildings.
  const csp = [
    "default-src 'none'",
    "script-src https://unpkg.com/leaflet@1.9.4/ https://cdn.osmbuildings.org https://api.mapbox.com 'unsafe-inline'",
    "style-src https://unpkg.com/leaflet@1.9.4/ https://api.mapbox.com https://cdn.osmbuildings.org 'unsafe-inline'",
    "img-src https://server.arcgisonline.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://tile.opentopomap.org https://*.tile.opentopomap.org https://tile.memomaps.de https://*.tile.memomaps.de https://a.tiles.mapbox.com https://b.tiles.mapbox.com https://c.tiles.mapbox.com https://d.tiles.mapbox.com https://api.mapbox.com https://api.tomtom.com data: blob:",
    "connect-src https://unpkg.com https://cdn.osmbuildings.org https://data.osmbuildings.org https://api.mapbox.com https://events.mapbox.com https://api.tomtom.com",
    "worker-src blob: 'self'",
    "child-src blob:",
    "font-src data: https://api.mapbox.com",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<meta http-equiv="Content-Security-Policy" content="${csp}"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
${hasMapbox ? '<link href="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css" rel="stylesheet"/><script src="https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.js"></script>' : ''}
<style>
  :root{
    --pad-top:0px;--pad-right:0px;--pad-bottom:0px;--pad-left:0px;
    --ink:#101820;--slate:#2C3A47;--signal:#C45C26;--garage:#1F6B4A;--paper:#F7F4EF;--muted:#6B7785;
  }
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#1B2430;overflow:hidden}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  .hud{
    position:absolute;z-index:1000;
    left:calc(10px + var(--pad-left));right:calc(10px + var(--pad-right));
    top:calc(8px + var(--pad-top));
    display:flex;flex-direction:column;gap:6px;pointer-events:none;
  }
  .chip-row{display:flex;gap:6px;pointer-events:auto}
  .chip{
    flex:1;border:0;border-radius:14px;padding:10px 12px;font:650 12px/1.15 system-ui,sans-serif;
    background:rgba(255,255,255,.96);color:var(--ink);
    box-shadow:0 2px 10px rgba(16,24,32,.14),0 1px 2px rgba(16,24,32,.06);
    transition:background .2s ease,color .2s ease,transform .15s ease;
  }
  .chip.on{background:var(--signal);color:#fff}
  .chip.on.truck{background:var(--garage)}
  .chip small{display:block;font-weight:550;opacity:.72;margin-top:2px;font-size:10px;letter-spacing:.01em}
  .chip .chip-ico{display:inline-flex;vertical-align:-1px;margin-right:5px;opacity:.9}
  .chip .chip-ico svg{display:block}
  .status{
    align-self:flex-start;max-width:94%;
    background:rgba(27,36,48,.9);color:#fff;border-radius:9px;padding:7px 10px;
    font:550 11px/1.35 system-ui,sans-serif;letter-spacing:.01em;
  }
  .bottom{
    position:absolute;z-index:1000;
    left:calc(10px + var(--pad-left));right:auto;
    bottom:calc(14px + var(--pad-bottom));
    display:flex;flex-direction:column;align-items:flex-start;gap:8px;pointer-events:none;
  }
  .bottom > *{pointer-events:auto}
  .bottom-actions{display:flex;flex-direction:row;align-items:center;gap:8px}
  .go{
    border:0;border-radius:16px;padding:13px 18px;font:750 13px system-ui,sans-serif;
    background:var(--signal);color:#fff;box-shadow:0 4px 14px rgba(196,92,38,.32);
    transition:opacity .2s ease,transform .15s ease,box-shadow .2s ease;
    letter-spacing:.01em;
  }
  .go:disabled{opacity:.4;box-shadow:none}
  .go:active:not(:disabled){transform:scale(.97)}
  .ghost{
    border:0;border-radius:16px;padding:13px 14px;font:650 12px system-ui,sans-serif;
    background:rgba(255,255,255,.96);color:var(--ink);
    box-shadow:0 2px 10px rgba(16,24,32,.14);
  }
  .ghost:active{transform:scale(.97)}
  /* Google Maps-style trip summary under Itinéraire: time + distance. */
  .eta-bar{
    display:none;align-self:flex-start;max-width:min(280px,78vw);
    background:rgba(255,255,255,.97);color:var(--ink);
    border-radius:12px;padding:10px 14px;
    font:750 14px/1.25 system-ui,-apple-system,sans-serif;
    letter-spacing:.01em;
    box-shadow:0 2px 10px rgba(0,0,0,.18);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .eta-bar.on{display:block}
  .eta-bar .eta-time{font-weight:800}
  .eta-bar .eta-dist{font-weight:600;opacity:.78}
  @media (prefers-color-scheme: dark){
    .eta-bar{
      background:rgba(32,33,36,.96);color:#E8EAED;
      box-shadow:0 2px 12px rgba(0,0,0,.45);
    }
    .eta-bar .eta-dist{opacity:.72}
  }
  /* Right-side map control rail — icon FABs, rounded cards, light shadows. */
  .map-rail{
    position:absolute;z-index:1100;
    right:calc(10px + var(--pad-right));
    top:50%;
    transform:translateY(-42%);
    display:flex;flex-direction:column;align-items:flex-end;gap:10px;
    pointer-events:none;
  }
  .map-rail-card{
    pointer-events:auto;
    display:flex;flex-direction:column;gap:2px;
    padding:4px;
    background:rgba(255,255,255,.96);
    border-radius:16px;
    box-shadow:0 2px 12px rgba(16,24,32,.16),0 1px 3px rgba(16,24,32,.08);
    border:1px solid rgba(255,255,255,.7);
  }
  .map-fab{
    width:42px;height:42px;border:0;border-radius:12px;
    display:flex;align-items:center;justify-content:center;
    background:transparent;color:var(--slate);
    transition:background .18s ease,color .18s ease,transform .12s ease;
    -webkit-appearance:none;appearance:none;
  }
  .map-fab svg{width:20px;height:20px;display:block;pointer-events:none}
  .map-fab:active{transform:scale(.94)}
  .map-fab.on{
    background:rgba(196,92,38,.14);color:var(--signal);
  }
  .map-fab.on[data-tog]{
    background:rgba(31,107,74,.12);color:var(--garage);
  }
  .map-fab:disabled{opacity:.38}
  .map-fab.locked{color:var(--muted)}
  .map-fab[data-act="streetview"]{color:var(--ink)}
  .map-rail-hint{
    pointer-events:none;
    font:600 9px/1 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;
    color:var(--muted);text-align:center;padding:2px 0 4px;
  }
  /* Google Maps-style directional chevron — tip = heading, no cartoon vehicle. */
  .vehicle-wrap{
    width:40px;height:40px;display:flex;align-items:center;justify-content:center;
    transition:transform .18s linear;will-change:transform;
  }
  .vehicle-wrap.camion{width:40px;height:40px}
  .vehicle-icon{
    width:36px;height:36px;background:transparent;border:0;border-radius:0;
    display:flex;align-items:center;justify-content:center;
    filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));
  }
  .vehicle-icon.camion{width:36px;height:36px;filter:drop-shadow(0 2px 3px rgba(15,47,34,.5))}
  .vehicle-icon svg{width:36px;height:36px;display:block}
  .vehicle-icon.camion svg{width:36px;height:36px;display:block}
  .dest-pin{
    width:28px;height:36px;display:flex;align-items:flex-end;justify-content:center;
    filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));
  }
  .dest-pin svg{width:28px;height:36px;display:block}
  .layer-pin{
    min-width:28px;height:28px;padding:0 6px;border-radius:8px;display:flex;align-items:center;justify-content:center;
    font:750 10px/1 system-ui,sans-serif;color:#fff;box-shadow:0 1px 6px rgba(0,0,0,.3);
    white-space:nowrap;
  }
  .layer-pin.bridge-ok{background:var(--garage)}
  .layer-pin.bridge-no{background:#A61B1B}
  .layer-pin.bridge-unk{background:var(--slate)}
  .layer-pin.weigh-on{background:#B08900;border:2px solid #fff}
  .layer-pin.weigh-off{background:var(--muted)}
  .layer-pin.weigh-alert{
    background:#E74C3C;border:2px solid #fff;
    animation:weighBlink .55s ease-in-out infinite alternate;
    transform:scale(1.25);
  }
  .layer-pin.report{background:#3B5BDB}
  .layer-pin.report-accident{background:#C0392B}
  .layer-pin.report-ralentissement{background:#D68910}
  .layer-pin.report-police{background:#3B5BDB}
  .layer-pin.report-danger{background:#A61B1B}
  .layer-pin.report-travaux{background:#7D6608}
  .layer-pin.report-obstacle{background:#5D6D7E}
  .layer-pin.report-autre{background:#566573}
  .draft-pin{
    width:28px;height:36px;display:flex;align-items:flex-end;justify-content:center;
    filter:drop-shadow(0 2px 4px rgba(16,24,32,.4));
  }
  .draft-pin svg{width:28px;height:36px;display:block}
  /* Google Maps-style right bubble — quick report picks only (no form). */
  .report-bubble{
    display:none;position:absolute;z-index:1200;
    right:calc(64px + var(--pad-right));
    top:50%;transform:translateY(-42%);
    width:min(208px,46vw);
    pointer-events:auto;
    background:rgba(255,255,255,.98);
    border-radius:18px;
    padding:10px 10px 8px;
    box-shadow:0 8px 28px rgba(16,24,32,.22),0 2px 8px rgba(16,24,32,.1);
    border:1px solid rgba(16,24,32,.08);
  }
  .report-bubble.on{display:block}
  .report-bubble-title{
    font:800 15px/1.25 system-ui,-apple-system,sans-serif;
    letter-spacing:.04em;color:var(--ink);
    padding:4px 6px 8px;margin:0;
  }
  .report-bubble-hint{
    font:600 12px/1.35 system-ui,-apple-system,sans-serif;
    letter-spacing:.03em;color:var(--muted);
    padding:0 6px 10px;margin:0;
  }
  .report-opt{
    display:flex;align-items:center;gap:10px;width:100%;
    border:0;border-radius:14px;margin:0 0 6px;padding:12px 12px;
    min-height:48px;text-align:left;cursor:pointer;
    background:#F3F0EA;color:var(--ink);
    font:750 15px/1.2 system-ui,-apple-system,sans-serif;
    letter-spacing:.03em;
    transition:background .15s ease,transform .12s ease;
    -webkit-appearance:none;appearance:none;
  }
  .report-opt:last-of-type{margin-bottom:4px}
  .report-opt:active{transform:scale(.98)}
  .report-opt .dot{
    width:12px;height:12px;border-radius:6px;flex-shrink:0;
  }
  .report-opt[data-kind="accident"] .dot{background:#C0392B}
  .report-opt[data-kind="ralentissement"] .dot{background:#D68910}
  .report-opt[data-kind="police"] .dot{background:#3B5BDB}
  .report-opt[data-kind="danger"] .dot{background:#A61B1B}
  .report-opt[data-kind="travaux"] .dot{background:#7D6608}
  .report-opt[data-kind="obstacle"] .dot{background:#5D6D7E}
  .report-opt[data-kind="destination"]{
    background:rgba(196,92,38,.12);color:var(--signal);
  }
  .report-opt[data-kind="destination"] .dot{background:var(--signal)}
  .report-cancel{
    display:block;width:100%;border:0;border-radius:12px;
    padding:11px 12px;min-height:44px;margin-top:2px;
    background:transparent;color:var(--muted);
    font:700 14px/1.2 system-ui,-apple-system,sans-serif;
    letter-spacing:.03em;cursor:pointer;
    -webkit-appearance:none;appearance:none;
  }
  .report-cancel:active{color:var(--ink)}
  @keyframes weighBlink{from{opacity:.55;box-shadow:0 0 0 0 rgba(231,76,60,.2)}to{opacity:1;box-shadow:0 0 0 10px rgba(231,76,60,.05)}}
  .route-line{transition:opacity .35s ease}
  /* Smooth live GPS marker — CSS lerp between setLatLng ticks (no snap jitter). */
  .leaflet-marker-pane .leaflet-marker-icon{
    transition:transform .22s linear;will-change:transform;
  }
  #mb3d{
    position:absolute;inset:0;z-index:450;pointer-events:none;opacity:0;
    transition:opacity .35s ease;
  }
  #mb3d.on{opacity:.5}
</style>
</head>
<body>
<div id="map"></div>
<div id="mb3d" aria-hidden="true"></div>
<div class="hud">
  <div class="chip-row">
    <button type="button" class="chip" id="btnCar"><span>Voiture</span><small>Profil auto</small></button>
    <button type="button" class="chip" id="btnTruck"><span class="chip-ico" aria-hidden="true"><svg viewBox="0 0 96 48" width="22" height="11"><rect x="1" y="9" width="56" height="23" rx="2" fill="currentColor" opacity=".92"/><path d="M71 12.5 H83.5 L91 26.5 H71 Z" fill="currentColor"/><rect x="58" y="11" width="13" height="16.5" rx="2" fill="currentColor"/><rect x="71" y="12.5" width="13" height="14.5" rx="1.4" fill="currentColor"/><rect x="58" y="26.5" width="35" height="5.5" rx="1.2" fill="currentColor" opacity=".75"/><circle cx="11" cy="38.5" r="5.2" fill="currentColor"/><circle cx="21" cy="38.5" r="5.2" fill="currentColor"/><circle cx="65" cy="38.5" r="5.2" fill="currentColor"/><circle cx="75" cy="38.5" r="5.2" fill="currentColor"/><circle cx="88" cy="38.5" r="4.8" fill="currentColor"/></svg></span><span>Camion</span><small>Semi / fret</small></button>
  </div>
  <div class="status" id="status">Choisissez Voiture ou Camion en haut, puis touchez / cherchez une destination</div>
</div>
<div class="bottom">
  <div class="bottom-actions">
    <button type="button" class="go" id="btnGo" disabled>itinéraire</button>
    <button type="button" class="ghost" id="btnRecenter">GPS</button>
  </div>
  <div class="eta-bar" id="etaBar" aria-live="polite" hidden></div>
</div>
<div class="map-rail" id="mapTypeMenu" role="toolbar" aria-label="Contrôles carte">
  <div class="map-rail-card" aria-label="Fonds de carte">
    <button type="button" class="map-fab on" data-base="roads" title="Routes" aria-label="Routes" aria-pressed="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4l-3 16"/><path d="M15 4l3 16"/><path d="M4 9h16"/><path d="M3 15h18"/></svg>
    </button>
    <button type="button" class="map-fab" data-base="satellite" title="Satellite" aria-label="Satellite" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M3 12h18"/><path d="M12 4a14 14 0 0 1 0 16"/><path d="M12 4a14 14 0 0 0 0 16"/></svg>
    </button>
    <button type="button" class="map-fab" data-base="terrain" title="Terrain" aria-label="Terrain" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18l6-9 4 5 3-4 5 8H3z"/><path d="M14 10l2-3 3 3"/></svg>
    </button>
  </div>
  <div class="map-rail-card" aria-label="Couches">
    <button type="button" class="map-fab" data-tog="traffic" id="btnTraffic" title="Trafic temps réel" aria-label="Trafic temps réel" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 19V9a4 4 0 0 1 8 0v10"/><path d="M8 13h8"/><circle cx="9.5" cy="17" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.5" cy="17" r="1.2" fill="currentColor" stroke="none"/><path d="M10 6h4"/></svg>
    </button>
    <button type="button" class="map-fab" data-tog="transit" title="Transport en commun" aria-label="Transport en commun" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="12" height="14" rx="3"/><path d="M6 10h12"/><path d="M9 18v2"/><path d="M15 18v2"/><circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/></svg>
    </button>
    <button type="button" class="map-fab" data-tog="buildings3d" title="Bâtiments 3D" aria-label="Bâtiments 3D" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V9l8-4 8 4v11"/><path d="M9 20v-6h6v6"/><path d="M4 12h16"/></svg>
    </button>
    <button type="button" class="map-fab" data-tog="aqi" title="Qualité de l’air" aria-label="Qualité de l’air" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14c2-1 3-1 5 0s3 1 5 0 3-1 5 0"/><path d="M4 10c2-1 3-1 5 0s3 1 5 0 3-1 5 0"/><path d="M4 18c2-1 3-1 5 0s3 1 5 0 3-1 5 0"/></svg>
    </button>
  </div>
  <div class="map-rail-card">
    <button type="button" class="map-fab" data-act="streetview" title="Street View (pin)" aria-label="Street View">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="7" r="3"/><path d="M6 20c1.5-4 4-6 6-6s4.5 2 6 6"/><path d="M12 10v3"/></svg>
    </button>
  </div>
</div>
<div class="report-bubble" id="reportBubble" role="dialog" aria-label="Signaler ici" aria-hidden="true" hidden>
  <p class="report-bubble-title">Signaler ici</p>
  <p class="report-bubble-hint">Choisissez une option</p>
  <button type="button" class="report-opt" data-kind="accident"><span class="dot" aria-hidden="true"></span>Accident</button>
  <button type="button" class="report-opt" data-kind="ralentissement"><span class="dot" aria-hidden="true"></span>Ralentissement</button>
  <button type="button" class="report-opt" data-kind="police"><span class="dot" aria-hidden="true"></span>Police</button>
  <button type="button" class="report-opt" data-kind="danger"><span class="dot" aria-hidden="true"></span>Danger</button>
  <button type="button" class="report-opt" data-kind="travaux"><span class="dot" aria-hidden="true"></span>Travaux</button>
  <button type="button" class="report-opt" data-kind="obstacle"><span class="dot" aria-hidden="true"></span>Obstacle</button>
  <button type="button" class="report-opt" data-kind="destination"><span class="dot" aria-hidden="true"></span>Itinéraire</button>
  <button type="button" class="report-cancel" id="reportCancel">Annuler</button>
</div>
<script>
(function(){
  var BOOT = ${bootJson};
  var ROADS_URL = ${roadsUrlJson};
  var MAPBOX_TOKEN = ${mapboxTokenJson};
  var TRAFFIC_CFG = ${trafficJson};
  var mode = BOOT.mode === 'camion' ? 'camion' : 'voiture';
  var gpsOk = !!BOOT.gpsOk;
  var origin = { lat: BOOT.lat, lon: BOOT.lon };
  var headingDeg = null;
  var dest = null;
  var routeCoords = [];
  var vehicleMarker = null;
  var routeLine = null;
  var altRouteLines = [];
  var stopMarkers = [];
  var destMarker = null;
  var draftMarker = null;
  var draftLL = null;
  var followLive = false;
  /** True only after startNavigation — not mere recenter / followLive. */
  var navTripActive = false;
  /** User dragged/pinched — pause camera follow; marker + route + ETA keep updating. */
  var userExploring = false;
  var exploreResumeTimer = null;
  var EXPLORE_RESUME_MS = 3500;
  /** Ignore drag/zoom events caused by our own panTo/setView (not user explore). */
  var programmaticCamera = false;
  var programmaticCameraTimer = null;
  /** Display fix (optionally snapped to route) used for marker + follow camera. */
  var displayOrigin = { lat: origin.lat, lon: origin.lon };
  var arrivedPosted = false;
  var layerGroup = null;
  var aqiGroup = null;
  var lastPanAt = 0;
  var baseKind = 'roads';
  var roadsLayer = null;
  var satLayer = null;
  var terrainLayer = null;
  var transitLayer = null;
  var trafficLayer = null;
  var transitOn = false;
  var trafficOn = false;
  var buildingsOn = false;
  var aqiOn = false;
  var osmBuildings = null;
  var mbMap = null;
  var weighMarkers = {};
  var alertWeighId = null;

  function haversineM(a, b){
    var R = 6371000;
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLon = (b.lon - a.lon) * toRad;
    var lat1 = a.lat * toRad;
    var lat2 = b.lat * toRad;
    var h = Math.sin(dLat/2)*Math.sin(dLat/2) +
      Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** Local equirectangular projection onto a segment — for route snap. */
  function projectOnSegment(p, a, b){
    var x = p.lon, y = p.lat;
    var x1 = a.lon, y1 = a.lat;
    var x2 = b.lon, y2 = b.lat;
    var dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return { lat: y1, lon: x1 };
    var t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return { lat: y1 + t * dy, lon: x1 + t * dx };
  }

  /**
   * Snap raw GPS onto the active route polyline when close enough (GPS noise).
   * Keeps the chevron on-route without inventing a fake path far off-road.
   */
  function snapToRoute(lat, lon, maxM){
    if (!routeCoords || routeCoords.length < 2) {
      return { lat: lat, lon: lon, snapped: false };
    }
    var lim = typeof maxM === 'number' ? maxM : 40;
    var p = { lat: lat, lon: lon };
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < routeCoords.length - 1; i++) {
      var a = { lat: routeCoords[i][0], lon: routeCoords[i][1] };
      var b = { lat: routeCoords[i + 1][0], lon: routeCoords[i + 1][1] };
      var proj = projectOnSegment(p, a, b);
      var d = haversineM(p, proj);
      if (d < bestD) {
        bestD = d;
        best = proj;
      }
    }
    if (best && bestD <= lim) {
      return { lat: best.lat, lon: best.lon, snapped: true, distM: bestD };
    }
    return { lat: lat, lon: lon, snapped: false, distM: bestD };
  }

  function clearExploreResumeTimer(){
    if (exploreResumeTimer) {
      clearTimeout(exploreResumeTimer);
      exploreResumeTimer = null;
    }
  }

  function markProgrammaticCamera(ms){
    programmaticCamera = true;
    if (programmaticCameraTimer) clearTimeout(programmaticCameraTimer);
    programmaticCameraTimer = setTimeout(function(){
      programmaticCameraTimer = null;
      programmaticCamera = false;
    }, typeof ms === 'number' ? ms : 360);
  }

  /** User pan/zoom — free explore; camera stops auto-follow until resume. */
  function beginExplore(){
    if (programmaticCamera) return;
    if (!followLive && !navTripActive) return;
    userExploring = true;
    clearExploreResumeTimer();
    exploreResumeTimer = setTimeout(function(){
      exploreResumeTimer = null;
      resumeFollowAfterExplore();
    }, EXPLORE_RESUME_MS);
  }

  function resumeFollowAfterExplore(){
    userExploring = false;
    clearExploreResumeTimer();
    if (!navTripActive && !followLive) return;
    followLive = true;
    ensureVehicleMarker();
    lastPanAt = Date.now();
    markProgrammaticCamera(400);
    map.panTo([displayOrigin.lat, displayOrigin.lon], {
      animate: true,
      duration: 0.32,
      easeLinearity: 0.22,
    });
    if (navTripActive) {
      setStatus('Navigation — suivi GPS live (glissez pour explorer)');
    }
  }

  function endExploreNow(){
    userExploring = false;
    clearExploreResumeTimer();
  }

  /** Smooth camera follow — every GPS tick while not exploring (no 700ms lag throttle). */
  function panFollowCamera(lat, lon){
    if (!followLive || userExploring) return;
    lastPanAt = Date.now();
    markProgrammaticCamera(320);
    map.panTo([lat, lon], { animate: true, duration: 0.28, easeLinearity: 0.2 });
  }

  function applyChrome(p){
    var r = document.documentElement.style;
    r.setProperty('--pad-top', (p.padTop||0) + 'px');
    r.setProperty('--pad-right', (p.padRight||0) + 'px');
    r.setProperty('--pad-bottom', (p.padBottom||0) + 'px');
    r.setProperty('--pad-left', (p.padLeft||0) + 'px');
  }
  applyChrome(BOOT);

  function post(msg){
    var data = JSON.stringify(msg);
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(data);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(data, '*');
      }
    } catch (e) {}
  }

  function setStatus(t){ document.getElementById('status').textContent = t; }

  function syncChips(){
    var car = document.getElementById('btnCar');
    var truck = document.getElementById('btnTruck');
    car.classList.toggle('on', mode === 'voiture');
    truck.classList.toggle('on', mode === 'camion');
    truck.classList.toggle('truck', mode === 'camion');
  }

  /**
   * Google Maps–style navigation chevron (tip = forward / heading 0° = up).
   * Cleaner than a side-view truck/car when CSS-rotated with device heading.
   */
  function navArrowSvg(fill){
    var color = fill || '#1A73E8';
    return '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      /* White halo then filled chevron — tip up = heading 0° */
      '<path d="M24 5 L41 40 L24 31 L7 40 Z" fill="#fff"/>' +
      '<path d="M24 9.5 L36.5 36.5 L24 29 L11.5 36.5 Z" fill="' + color + '"/>' +
      '</svg>';
  }
  function carSvg(){
    return navArrowSvg('#1A73E8');
  }
  /** Same modern nav arrow — garage green so camion mode stays distinct. */
  function truckSvg(){
    return navArrowSvg('#1F6B4A');
  }

  function vehicleHtml(){
    var truck = mode === 'camion';
    var wrapCls = truck ? 'vehicle-wrap camion' : 'vehicle-wrap';
    var cls = truck ? 'vehicle-icon camion' : 'vehicle-icon';
    var rot = (headingDeg != null && isFinite(headingDeg)) ? headingDeg : 0;
    return '<div class="' + wrapCls + '" style="transform:rotate(' + rot + 'deg)"><div class="' + cls + '">' +
      (truck ? truckSvg() : carSvg()) + '</div></div>';
  }

  function vehicleDivIcon(){
    return L.divIcon({
      className: '',
      html: vehicleHtml(),
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  }

  function destDivIcon(){
    return L.divIcon({
      className: '',
      html: '<div class="dest-pin" aria-hidden="true"><svg viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="#C45C26"/><circle cx="14" cy="14" r="5.5" fill="#fff"/></svg></div>',
      iconSize: [28, 36],
      iconAnchor: [14, 36],
    });
  }

  document.addEventListener('click', function(ev){
    var t = ev.target;
    while (t && t !== document) {
      if (t.tagName === 'A') { ev.preventDefault(); return false; }
      t = t.parentNode;
    }
  }, true);

  /* No Leaflet chrome (Esri/#47). Pinch/scroll zoom still works.
     Default base = colored roads; Satellite = Esri; Terrain = OpenTopoMap. */
  var map = L.map('map', { zoomControl: false, attributionControl: false, preferCanvas: true })
    .setView([origin.lat, origin.lon], gpsOk ? 14 : 5);
  roadsLayer = L.tileLayer(ROADS_URL, { maxZoom: 19, attribution: '' });
  satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: ''
  });
  terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17, attribution: '', subdomains: 'abc'
  });
  /* ÖPNVKarte / memomaps — free OSM-based public transit lines (no key). */
  transitLayer = L.tileLayer('https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png', {
    maxZoom: 18, opacity: 0.85, attribution: ''
  });
  /* Live traffic — TomTom flow (preferred) or Mapbox traffic-day; no free no-key feed. */
  if (TRAFFIC_CFG && TRAFFIC_CFG.url) {
    trafficLayer = L.tileLayer(TRAFFIC_CFG.url, {
      maxZoom: 19,
      opacity: TRAFFIC_CFG.opacity != null ? TRAFFIC_CFG.opacity : 0.65,
      attribution: '',
      tileSize: TRAFFIC_CFG.tileSize || 256,
      zoomOffset: TRAFFIC_CFG.zoomOffset || 0,
    });
  }
  roadsLayer.addTo(map);
  layerGroup = L.layerGroup().addTo(map);
  aqiGroup = L.layerGroup().addTo(map);
  (function initTrafficBtn(){
    var btn = document.getElementById('btnTraffic');
    if (!btn) return;
    if (!trafficLayer) {
      btn.disabled = true;
      btn.classList.add('locked');
      btn.title = 'Trafic — clé requise (TomTom ou Mapbox)';
      btn.setAttribute('aria-label', 'Trafic indisponible — clé requise');
    }
  })();

  function currentBaseLayer(){
    if (baseKind === 'satellite') return satLayer;
    if (baseKind === 'terrain') return terrainLayer;
    return roadsLayer;
  }

  function setBaseLayer(next){
    if (next !== 'roads' && next !== 'satellite' && next !== 'terrain') return;
    if (next === baseKind) return;
    map.removeLayer(currentBaseLayer());
    baseKind = next;
    currentBaseLayer().addTo(map);
    if (transitOn) {
      map.removeLayer(transitLayer);
      transitLayer.addTo(map);
    }
    if (trafficOn && trafficLayer) {
      map.removeLayer(trafficLayer);
      trafficLayer.addTo(map);
    }
    syncMapTypeMenu();
    post(maptypePayload());
  }

  function syncMapTypeMenu(){
    var menu = document.getElementById('mapTypeMenu');
    if (!menu) return;
    var buttons = menu.querySelectorAll('button[data-base]');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var active = b.getAttribute('data-base') === baseKind;
      b.classList.toggle('on', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    function syncTog(sel, on){
      var el = menu.querySelector(sel);
      if (!el) return;
      el.classList.toggle('on', !!on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    syncTog('button[data-tog="transit"]', transitOn);
    syncTog('button[data-tog="traffic"]', trafficOn);
    syncTog('button[data-tog="buildings3d"]', buildingsOn);
    syncTog('button[data-tog="aqi"]', aqiOn);
  }

  function maptypePayload(){
    return { type: 'maptype', base: baseKind, transit: transitOn, traffic: trafficOn, buildings3d: buildingsOn, aqi: aqiOn, trafficSource: TRAFFIC_CFG ? TRAFFIC_CFG.kind : 'none' };
  }

  function setTransit(on){
    transitOn = !!on;
    if (transitOn) transitLayer.addTo(map);
    else map.removeLayer(transitLayer);
    syncMapTypeMenu();
    post(maptypePayload());
  }

  function setTraffic(on){
    if (!trafficLayer) {
      setStatus('Trafic live — clé requise: EXPO_PUBLIC_TOMTOM_API_KEY (préf.) ou EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN. Pas de tuiles gratuites sans clé.');
      trafficOn = false;
      syncMapTypeMenu();
      post(maptypePayload());
      return;
    }
    trafficOn = !!on;
    if (trafficOn) trafficLayer.addTo(map);
    else map.removeLayer(trafficLayer);
    syncMapTypeMenu();
    if (trafficOn) {
      setStatus(
        TRAFFIC_CFG.kind === 'tomtom'
          ? 'Trafic live · TomTom flow (relative)'
          : 'Trafic live · Mapbox traffic-day (opacité ~0.55)'
      );
    }
    post(maptypePayload());
  }

  function destroyOsmBuildings(){
    try {
      if (osmBuildings) {
        if (typeof osmBuildings.remove === 'function') osmBuildings.remove();
        else if (map.removeLayer) map.removeLayer(osmBuildings);
      }
    } catch (e) {}
    osmBuildings = null;
  }

  function destroyMapbox3d(){
    try {
      if (mbMap) { mbMap.remove(); }
    } catch (e) {}
    mbMap = null;
    var el = document.getElementById('mb3d');
    if (el) { el.classList.remove('on'); el.innerHTML = ''; }
  }

  function syncMapboxCamera(){
    if (!mbMap) return;
    try {
      var c = map.getCenter();
      var z = map.getZoom();
      mbMap.jumpTo({ center: [c.lng, c.lat], zoom: Math.max(0, z - 1), bearing: 0, pitch: 55 });
    } catch (e) {}
  }

  function ensureMapbox3d(){
    if (!MAPBOX_TOKEN || typeof mapboxgl === 'undefined') return false;
    var el = document.getElementById('mb3d');
    if (!el) return false;
    if (mbMap) {
      el.classList.add('on');
      syncMapboxCamera();
      return true;
    }
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      mbMap = new mapboxgl.Map({
        container: el,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [origin.lon, origin.lat],
        zoom: Math.max(0, map.getZoom() - 1),
        pitch: 55,
        bearing: 0,
        interactive: false,
        attributionControl: false,
        logoPosition: 'bottom-left',
      });
      mbMap.on('load', function(){
        try {
          var layers = mbMap.getStyle().layers || [];
          for (var i = 0; i < layers.length; i++) {
            var id = layers[i].id;
            var type = layers[i].type;
            if (type === 'fill-extrusion') {
              mbMap.setPaintProperty(id, 'fill-extrusion-opacity', 0.5);
            } else if (type !== 'background') {
              // Keep basemap faintly visible under extruded buildings.
              try { mbMap.setPaintProperty(id, 'opacity' in (layers[i].paint||{}) ? 'opacity' : id, 0.15); } catch (e2) {}
            }
          }
          // Explicit building extrusion opacity ~0.5 so Leaflet map shows through overlay.
          if (mbMap.getLayer('building')) {
            mbMap.setPaintProperty('building', 'fill-extrusion-opacity', 0.5);
          }
        } catch (e) {}
      });
      el.classList.add('on');
      map.on('move', syncMapboxCamera);
      map.on('zoom', syncMapboxCamera);
      syncMapboxCamera();
      return true;
    } catch (e) {
      destroyMapbox3d();
      return false;
    }
  }

  var osmBuildingsScriptLoading = false;
  var osmBuildingsScriptWaiters = [];

  function loadOsmBuildingsScript(done){
    if (typeof OSMBuildings !== 'undefined') { done(true); return; }
    osmBuildingsScriptWaiters.push(done);
    if (osmBuildingsScriptLoading) return;
    osmBuildingsScriptLoading = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.osmbuildings.org/4.1.1/OSMBuildings-Leaflet.js';
    s.async = true;
    s.onload = function(){
      osmBuildingsScriptLoading = false;
      var ok = typeof OSMBuildings !== 'undefined';
      var q = osmBuildingsScriptWaiters.splice(0, osmBuildingsScriptWaiters.length);
      for (var i = 0; i < q.length; i++) q[i](ok);
    };
    s.onerror = function(){
      osmBuildingsScriptLoading = false;
      var q = osmBuildingsScriptWaiters.splice(0, osmBuildingsScriptWaiters.length);
      for (var j = 0; j < q.length; j++) q[j](false);
    };
    document.head.appendChild(s);
  }

  function mountOsmBuildings(){
    if (typeof OSMBuildings === 'undefined') return false;
    destroyOsmBuildings();
    try {
      osmBuildings = new OSMBuildings(map).date(new Date()).style({
        color: 'rgb(220, 210, 200)',
        wallsColor: 'rgba(180,160,140,0.5)',
        roofColor: 'rgba(200,180,160,0.5)',
      });
      // Semi-transparent so basemap shows through (~0.5).
      try {
        var canv = document.querySelector('.osmb-layer, canvas.osmb');
        if (canv && canv.style) canv.style.opacity = '0.5';
      } catch (e2) {}
      return true;
    } catch (e) {
      osmBuildings = null;
      return false;
    }
  }

  function ensureOsmBuildings(done){
    if (typeof OSMBuildings !== 'undefined') {
      if (!buildingsOn) { done(false); return; }
      done(mountOsmBuildings());
      return;
    }
    loadOsmBuildingsScript(function(ok){
      // User may have toggled 3D off while the CDN script was in flight.
      if (!buildingsOn) { done(false); return; }
      done(ok ? mountOsmBuildings() : false);
    });
  }

  function setBuildings3d(on){
    buildingsOn = !!on;
    if (!buildingsOn) {
      destroyMapbox3d();
      destroyOsmBuildings();
      syncMapTypeMenu();
      post(maptypePayload());
      return;
    }
    function finish(ok, viaMapbox){
      if (!buildingsOn) {
        destroyMapbox3d();
        destroyOsmBuildings();
        syncMapTypeMenu();
        post(maptypePayload());
        return;
      }
      if (!ok) {
        buildingsOn = false;
        setStatus('Bâtiments 3D indisponibles — EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ou OSM Buildings CDN');
      } else if (viaMapbox) {
        setStatus('Bâtiments 3D Mapbox · opacite ~0.5');
      } else {
        setStatus('Bâtiments 3D OSM Buildings · opacite ~0.5 (pas de Mapbox token)');
      }
      syncMapTypeMenu();
      post(maptypePayload());
    }
    if (MAPBOX_TOKEN && ensureMapbox3d()) {
      finish(true, true);
      return;
    }
    ensureOsmBuildings(function(ok){ finish(ok, false); });
  }

  function setAqiOverlay(on){
    aqiOn = !!on;
    if (!aqiOn) aqiGroup.clearLayers();
    syncMapTypeMenu();
    post(maptypePayload());
    if (aqiOn) post({ type: 'aqi_request', lat: origin.lat, lon: origin.lon });
  }

  var lastVehicleMode = mode;

  function syncVehicleIconDom(){
    if (!vehicleMarker) return;
    var el = vehicleMarker.getElement();
    if (!el) return;
    var wrap = el.querySelector('.vehicle-wrap');
    if (!wrap) return;
    var truck = mode === 'camion';
    wrap.className = truck ? 'vehicle-wrap camion' : 'vehicle-wrap';
    var icon = wrap.querySelector('.vehicle-icon');
    if (icon) icon.className = truck ? 'vehicle-icon camion' : 'vehicle-icon';
    var rot = (headingDeg != null && isFinite(headingDeg)) ? headingDeg : 0;
    wrap.style.transform = 'rotate(' + rot + 'deg)';
    // Rebuild SVG only when vehicle class flips (rare).
    if (lastVehicleMode !== mode && icon) {
      icon.innerHTML = truck ? truckSvg() : carSvg();
      lastVehicleMode = mode;
    }
  }

  function ensureVehicleMarker(){
    if (!gpsOk) {
      if (vehicleMarker) { map.removeLayer(vehicleMarker); vehicleMarker = null; }
      return;
    }
    var lat = displayOrigin.lat;
    var lon = displayOrigin.lon;
    if (!vehicleMarker) {
      vehicleMarker = L.marker([lat, lon], {
        icon: vehicleDivIcon(),
        zIndexOffset: 900,
        interactive: false,
      }).addTo(map);
      lastVehicleMode = mode;
    } else {
      vehicleMarker.setLatLng([lat, lon]);
      // Avoid DivIcon recreate every GPS tick — mutate transform/DOM instead.
      syncVehicleIconDom();
    }
  }
  ensureVehicleMarker();

  syncChips();
  syncMapTypeMenu();
  if (!gpsOk) {
    setStatus('GPS appareil refusé — activez la localisation (bouton GPS). Pas de départ silencieux.');
  } else {
    setStatus(mode === 'camion'
      ? 'GPS live · mode camion — touchez / cherchez une destination'
      : 'GPS live · mode voiture — touchez / cherchez une destination');
  }

  function setEtaBar(distanceKm, durationMin){
    var el = document.getElementById('etaBar');
    if (!el) return;
    var mins = typeof durationMin === 'number' && isFinite(durationMin) ? Math.round(durationMin) : null;
    var km = typeof distanceKm === 'number' && isFinite(distanceKm) ? distanceKm : null;
    if (mins == null || km == null) {
      el.classList.remove('on');
      el.setAttribute('hidden', 'hidden');
      el.textContent = '';
      el.removeAttribute('aria-label');
      return;
    }
    var kmTxt = (Math.round(km * 10) / 10).toLocaleString('fr-FR');
    var label = '~' + mins + ' min · ' + kmTxt + ' km';
    el.textContent = '';
    var timeSpan = document.createElement('span');
    timeSpan.className = 'eta-time';
    timeSpan.textContent = '~' + mins + ' min';
    var distSpan = document.createElement('span');
    distSpan.className = 'eta-dist';
    distSpan.textContent = ' · ' + kmTxt + ' km';
    el.appendChild(timeSpan);
    el.appendChild(distSpan);
    el.setAttribute('aria-label', 'Temps de trajet ' + label);
    el.classList.add('on');
    el.removeAttribute('hidden');
  }

  function clearAltRoutes(){
    for (var i = 0; i < altRouteLines.length; i++) {
      try { map.removeLayer(altRouteLines[i]); } catch (e) {}
    }
    altRouteLines = [];
  }
  function clearStopMarkers(){
    for (var j = 0; j < stopMarkers.length; j++) {
      try { map.removeLayer(stopMarkers[j]); } catch (e) {}
    }
    stopMarkers = [];
  }
  function clearRouteGraphics(){
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    clearAltRoutes();
    clearStopMarkers();
    routeCoords = [];
    document.getElementById('btnGo').disabled = true;
    setEtaBar(null, null);
    followLive = false;
    navTripActive = false;
    endExploreNow();
  }

  function applyMode(next, opts){
    mode = next;
    syncChips();
    ensureVehicleMarker();
    if (!opts || !opts.silent) post({ type: 'mode', mode: mode });
    setStatus(mode === 'camion'
      ? 'Mode camion — touchez / cherchez une destination'
      : 'Mode voiture — touchez / cherchez une destination');
    // skipRoute: sync chips/BOOT without posting another route (avoids RN↔map loops).
    if (dest && gpsOk && !(opts && opts.skipRoute)) requestRoute();
  }

  function draftDivIcon(){
    return L.divIcon({
      className: '',
      html: '<div class="draft-pin" aria-hidden="true"><svg viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="#3B5BDB"/><circle cx="14" cy="14" r="5.5" fill="#fff"/></svg></div>',
      iconSize: [28, 36],
      iconAnchor: [14, 36],
    });
  }

  function closeReportBubble(){
    var bubble = document.getElementById('reportBubble');
    if (bubble) {
      bubble.classList.remove('on');
      bubble.setAttribute('aria-hidden', 'true');
      bubble.setAttribute('hidden', '');
    }
    if (draftMarker) {
      try { map.removeLayer(draftMarker); } catch (e) {}
      draftMarker = null;
    }
    draftLL = null;
  }

  function openReportBubble(latlng){
    if (!latlng || !isFinite(latlng.lat) || !isFinite(latlng.lng)) return;
    draftLL = { lat: latlng.lat, lon: latlng.lng };
    if (draftMarker) {
      try { map.removeLayer(draftMarker); } catch (e) {}
    }
    draftMarker = L.marker([draftLL.lat, draftLL.lon], {
      icon: draftDivIcon(),
      zIndexOffset: 760,
    }).addTo(map);
    var bubble = document.getElementById('reportBubble');
    if (bubble) {
      bubble.classList.add('on');
      bubble.removeAttribute('hidden');
      bubble.setAttribute('aria-hidden', 'false');
    }
    setStatus('Point choisi — choisissez Accident, Ralentissement… ou Itinéraire');
  }

  function reportKindLabel(kind){
    if (kind === 'accident') return 'ACC';
    if (kind === 'ralentissement') return 'RAL';
    if (kind === 'police') return 'POL';
    if (kind === 'danger') return 'DAN';
    if (kind === 'travaux') return 'TRX';
    if (kind === 'obstacle') return 'OBS';
    return 'ALR';
  }

  function reportKindClass(kind){
    var k = String(kind || '').toLowerCase();
    if (k === 'accident') return 'report report-accident';
    if (k === 'ralentissement') return 'report report-ralentissement';
    if (k === 'police') return 'report report-police';
    if (k === 'danger') return 'report report-danger';
    if (k === 'travaux') return 'report report-travaux';
    if (k === 'obstacle') return 'report report-obstacle';
    return 'report report-autre';
  }

  function setDestination(latlng, label){
    if (!gpsOk) {
      setStatus('GPS appareil requis — pas d’itinéraire sans position réelle');
      return;
    }
    closeReportBubble();
    dest = { lat: latlng.lat, lon: latlng.lng };
    arrivedPosted = false;
    navTripActive = false;
    followLive = false;
    endExploreNow();
    if (destMarker) map.removeLayer(destMarker);
    destMarker = L.marker([dest.lat, dest.lon], { icon: destDivIcon(), zIndexOffset: 700 }).addTo(map);
    setStatus(
      (label ? 'Destination · ' + label + ' · ' : 'Destination · ') +
      (mode === 'camion' ? 'camion' : 'voiture')
    );
    requestRoute();
  }

  function requestRoute(){
    if (!dest) return;
    if (!gpsOk) {
      setStatus('GPS appareil requis — autorisez la localisation');
      return;
    }
    setStatus('Calcul itinéraire ' + (mode === 'camion' ? 'camion' : 'voiture') + '…');
    setEtaBar(null, null);
    document.getElementById('btnGo').disabled = true;
    post({
      type: 'route',
      mode: mode,
      from: origin,
      to: dest,
      truck: {
        heightM: BOOT.truckHeightM,
        widthM: BOOT.truckWidthM,
        weightT: BOOT.truckPtacT,
      },
    });
  }

  window.__gpsApplyRoute = function(payload){
    try {
      if (!payload || !payload.ok || !payload.coords || !payload.coords.length) {
        setStatus((payload && payload.label) || 'Itinéraire indisponible');
        clearRouteGraphics();
        return;
      }
      if (routeLine) map.removeLayer(routeLine);
      clearAltRoutes();
      clearStopMarkers();
      routeCoords = payload.coords;
      var primaryColor = mode === 'camion' ? '#1F6B4A' : '#C45C26';
      // Alt routes under primary (lighter).
      var alts = payload.alternatives || [];
      for (var ai = 0; ai < alts.length; ai++) {
        var ac = alts[ai] && alts[ai].coords;
        if (!ac || ac.length < 2) continue;
        altRouteLines.push(L.polyline(ac, {
          color: '#6B7785',
          weight: 4,
          opacity: 0.45,
          dashArray: '8 10',
          lineCap: 'round',
          lineJoin: 'round',
          smoothFactor: 1.15,
          className: 'route-line',
        }).addTo(map));
      }
      routeLine = L.polyline(routeCoords, {
        color: primaryColor,
        weight: 5,
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1.15,
        className: 'route-line',
      }).addTo(map);
      var stops = payload.waypoints || [];
      for (var si = 0; si < stops.length; si++) {
        var sp = stops[si];
        if (!sp || !isFinite(sp.lat) || !isFinite(sp.lon)) continue;
        stopMarkers.push(L.marker([sp.lat, sp.lon], {
          icon: L.divIcon({
            className: '',
            html: '<div class="layer-pin report">' + (si + 1) + '</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
          zIndexOffset: 650,
        }).addTo(map));
      }
      markProgrammaticCamera(500);
      map.fitBounds(routeLine.getBounds(), { padding: [52, 52], animate: true, duration: 0.45 });
      ensureVehicleMarker();
      document.getElementById('btnGo').disabled = false;
      setEtaBar(payload.distanceKm, payload.durationMin);
      setStatus(payload.label || 'Itinéraire prêt — tapez itinéraire pour le suivi live');
      post({ type: 'routed', mode: mode, distanceKm: payload.distanceKm, durationMin: payload.durationMin, label: payload.label });
    } catch (e) {
      setStatus('Affichage itinéraire KO');
      setEtaBar(null, null);
    }
  };

  function haversineKmHtml(aLat, aLon, bLat, bLon){
    var R = 6371;
    var dLat = (bLat - aLat) * Math.PI / 180;
    var dLon = (bLon - aLon) * Math.PI / 180;
    var lat1 = aLat * Math.PI / 180;
    var lat2 = bLat * Math.PI / 180;
    var h = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  }

  window.__gpsUpdatePosition = function(lat, lon, ok, heading, speed){
    gpsOk = ok !== false;
    if (!gpsOk) {
      ensureVehicleMarker();
      setStatus('GPS appareil perdu — réactivez la localisation');
      return;
    }
    origin = { lat: lat, lon: lon };
    if (typeof heading === 'number' && isFinite(heading) && heading >= 0) headingDeg = heading;
    // During nav: snap onto route for clean alignment; keep raw origin for arrival.
    var snapped = (navTripActive || followLive) && routeCoords.length >= 2
      ? snapToRoute(lat, lon, 40)
      : { lat: lat, lon: lon, snapped: false };
    displayOrigin = { lat: snapped.lat, lon: snapped.lon };
    ensureVehicleMarker();
    // Default auto-follow — free pan while exploring (no snap-back until resume).
    panFollowCamera(displayOrigin.lat, displayOrigin.lon);
    // Post-trip voice logbook + trip history: only after an explicit startNavigation trip.
    if (navTripActive && dest && !arrivedPosted) {
      var distM = haversineM(origin, dest);
      if (distM <= 80) {
        arrivedPosted = true;
        navTripActive = false;
        followLive = false;
        endExploreNow();
        setStatus('Arrivée — note vocale trajet dispo');
        post({ type: 'arrived', mode: mode, to: { lat: dest.lat, lon: dest.lon } });
      }
    }
    if (buildingsOn && mbMap) syncMapboxCamera();
  };

  window.__gpsSetOrigin = function(lat, lon, ok){
    window.__gpsUpdatePosition(lat, lon, ok, headingDeg, null);
    if (ok !== false) {
      endExploreNow();
      followLive = true;
      markProgrammaticCamera(500);
      map.setView([displayOrigin.lat, displayOrigin.lon], Math.max(map.getZoom(), 14), { animate: true });
      setStatus(mode === 'camion'
        ? 'GPS appareil OK — mode camion, touchez une destination'
        : 'GPS appareil OK — touchez une destination');
    } else {
      setStatus('GPS one-shot refusé — itinéraire conservé (réessayez GPS)');
    }
  };

  window.__gpsApplyMode = function(next, truck, opts){
    if (truck) {
      if (truck.heightM != null) BOOT.truckHeightM = truck.heightM;
      if (truck.widthM != null) BOOT.truckWidthM = truck.widthM;
      if (truck.weightT != null) BOOT.truckPtacT = truck.weightT;
    }
    applyMode(next === 'camion' ? 'camion' : 'voiture', {
      silent: true,
      skipRoute: !!(opts && opts.skipRoute),
    });
  };

  /** Update BOOT gabarit only — never requestRoute (safe from RN route handler). */
  window.__gpsSetTruckDims = function(truck){
    if (!truck) return;
    if (truck.heightM != null) BOOT.truckHeightM = truck.heightM;
    if (truck.widthM != null) BOOT.truckWidthM = truck.widthM;
    if (truck.weightT != null) BOOT.truckPtacT = truck.weightT;
  };

  window.__gpsSetChrome = function(p){ applyChrome(p || {}); };

  window.__gpsProposeDestination = function(lat, lon, label){
    setDestination(L.latLng(lat, lon), label || '');
  };

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function tipEl(text){
    var el = document.createElement('span');
    el.textContent = String(text == null ? '' : text);
    return el;
  }
  function finiteLatLon(lat, lon){
    return typeof lat === 'number' && isFinite(lat) && typeof lon === 'number' && isFinite(lon)
      && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  var pendingLayers = null;
  var layersReady = false;
  function weighHtml(s, alert){
    var on = !!s.litUp || s.status === 'open';
    var cls = alert ? 'weigh-alert' : (on ? 'weigh-on' : 'weigh-off');
    var txt = alert ? '!' : (on ? 'ON' : '?');
    return '<div class="layer-pin ' + cls + '" data-weigh="' + esc(String(s.id || '')) + '">' + txt + '</div>';
  }
  function applyLayersPayload(payload){
    try {
      layerGroup.clearLayers();
      weighMarkers = {};
      if (!payload) return;
      var bridges = payload.bridges || [];
      var weigh = payload.weigh || [];
      var reports = payload.reports || [];
      bridges.forEach(function(b){
        if (!finiteLatLon(b.lat, b.lon)) return;
        var pass = b.pass === 'ok' || b.pass === 'no' ? b.pass : 'unknown';
        var cls = pass === 'ok' ? 'bridge-ok' : pass === 'no' ? 'bridge-no' : 'bridge-unk';
        var h = typeof b.maxheightM === 'number' && isFinite(b.maxheightM) ? (b.maxheightM + 'm') : '?';
        var w = typeof b.maxweightT === 'number' && isFinite(b.maxweightT) ? ('/' + b.maxweightT + 't') : '';
        var html = '<div class="layer-pin ' + cls + '">' + esc(h + w) + '</div>';
        L.marker([b.lat, b.lon], {
          icon: L.divIcon({ className: '', html: html, iconSize: [48, 28], iconAnchor: [24, 14] }),
          zIndexOffset: 400,
        }).bindTooltip(tipEl((b.name || 'Ouvrage') + ' · ' + (pass === 'ok' ? 'PASS' : pass === 'no' ? 'NO-PASS' : 'UNKNOWN')), { direction: 'top' })
          .addTo(layerGroup);
      });
      weigh.forEach(function(s){
        if (!finiteLatLon(s.lat, s.lon)) return;
        var id = String(s.id || (s.lat + ',' + s.lon));
        var alert = alertWeighId && alertWeighId === id;
        var on = !!s.litUp || s.status === 'open';
        var m = L.marker([s.lat, s.lon], {
          icon: L.divIcon({ className: '', html: weighHtml(Object.assign({}, s, { id: id }), alert), iconSize: [36, 28], iconAnchor: [18, 14] }),
          zIndexOffset: alert ? 650 : 450,
        }).bindTooltip(tipEl((s.name || 'Balance') + (on ? ' · scale ON (advisory OSM CA/US/EU)' : ' · statut inconnu / fermé')), { direction: 'top' })
          .addTo(layerGroup);
        weighMarkers[id] = { marker: m, data: Object.assign({}, s, { id: id }) };
      });
      reports.forEach(function(r){
        if (!finiteLatLon(r.lat, r.lon)) return;
        var kind = String(r.kind || 'alerte').replace(/[^a-z0-9_-]/gi, '').slice(0, 20) || 'alerte';
        var label = reportKindLabel(kind);
        var html = '<div class="layer-pin ' + reportKindClass(kind) + '">' + esc(label) + '</div>';
        var tip = kind + (r.note ? ' — ' + String(r.note).slice(0, 80) : '') + ' · expire crowd';
        L.marker([r.lat, r.lon], {
          icon: L.divIcon({ className: '', html: html, iconSize: [40, 28], iconAnchor: [20, 14] }),
          zIndexOffset: 500,
        }).bindTooltip(tipEl(tip), { direction: 'top' })
          .addTo(layerGroup);
      });
    } catch (e) {}
  }
  window.__gpsSetLayers = function(payload){
    pendingLayers = payload || null;
    if (!layersReady) return;
    applyLayersPayload(pendingLayers);
  };

  window.__gpsHighlightWeigh = function(id){
    alertWeighId = id ? String(id) : null;
    if (pendingLayers) applyLayersPayload(pendingLayers);
  };

  window.__gpsSetAqi = function(payload){
    try {
      aqiGroup.clearLayers();
      if (!aqiOn || !payload || !payload.samples) return;
      (payload.samples || []).forEach(function(s){
        if (!finiteLatLon(s.lat, s.lon)) return;
        var color = s.color || '#7F8C8D';
        L.circle([s.lat, s.lon], {
          radius: 2800,
          color: color,
          fillColor: color,
          fillOpacity: 0.28,
          weight: 1,
          opacity: 0.5,
        }).bindTooltip(tipEl('AQI ' + (s.aqi != null ? s.aqi : '?') + ' · ' + (s.label || '')), { direction: 'top' })
          .addTo(aqiGroup);
      });
    } catch (e) {}
  };

  window.__gpsSetMapType = function(opts){
    opts = opts || {};
    if (opts.base) setBaseLayer(opts.base);
    if (typeof opts.transit === 'boolean') setTransit(opts.transit);
    if (typeof opts.traffic === 'boolean') setTraffic(opts.traffic);
    if (typeof opts.buildings3d === 'boolean') setBuildings3d(opts.buildings3d);
    if (typeof opts.aqi === 'boolean') setAqiOverlay(opts.aqi);
  };

  window.addEventListener('message', function(ev){
    if (ev.source !== window.parent) return;
    var raw = ev.data;
    var msg = null;
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (!msg || msg.__gps !== 1 || typeof msg.cmd !== 'string') return;
    if (msg.cmd === 'applyRoute') window.__gpsApplyRoute(msg.payload);
    else if (msg.cmd === 'setOrigin') window.__gpsSetOrigin(msg.lat, msg.lon, msg.ok);
    else if (msg.cmd === 'updatePosition') window.__gpsUpdatePosition(msg.lat, msg.lon, msg.ok, msg.heading, msg.speed);
    else if (msg.cmd === 'applyMode') window.__gpsApplyMode(msg.mode, msg.truck, msg.opts);
    else if (msg.cmd === 'setTruckDims') window.__gpsSetTruckDims(msg.truck);
    else if (msg.cmd === 'setChrome') window.__gpsSetChrome(msg.pads);
    else if (msg.cmd === 'proposeDestination') window.__gpsProposeDestination(msg.lat, msg.lon, msg.label);
    else if (msg.cmd === 'startNavigation') window.__gpsStartNavigation && window.__gpsStartNavigation();
    else if (msg.cmd === 'setLayers') window.__gpsSetLayers(msg.payload);
    else if (msg.cmd === 'highlightWeigh') window.__gpsHighlightWeigh(msg.id);
    else if (msg.cmd === 'setAqi') window.__gpsSetAqi(msg.payload);
    else if (msg.cmd === 'setMapType') window.__gpsSetMapType(msg);
    else if (msg.cmd === 'reportResult') window.__gpsReportResult && window.__gpsReportResult(msg);
  });

  /* Mouse: single click opens right report bubble (draft pin).
     Touch: long-press ~2s OR double-tap — same bubble. Destination = « Itinéraire » pick. */
  var LONG_PRESS_MS = 2000;
  var TOUCH_MOVE_PX = 12;
  var DOUBLE_TAP_MS = 350;
  var DOUBLE_TAP_PX = 36;
  var touchPressTimer = null;
  var touchStartPt = null;
  var touchStartLL = null;
  var touchMoved = false;
  var longPressPlaced = false;
  var suppressClickUntil = 0;
  var lastTapAt = 0;
  var lastTapPt = null;
  var mapEl = map.getContainer();

  function clearTouchPressTimer(){
    if (touchPressTimer) {
      clearTimeout(touchPressTimer);
      touchPressTimer = null;
    }
  }

  function touchPoint(t){
    return L.point(t.clientX, t.clientY);
  }

  function latLngFromTouch(t){
    return map.mouseEventToLatLng(t);
  }

  function placePinFromTouch(ll){
    if (!ll) return;
    /* Block Leaflet/browser ghost clicks after touch pin placement. */
    suppressClickUntil = Date.now() + 500;
    openReportBubble(ll);
  }

  var reportBusy = false;

  function setReportBubbleBusy(busy){
    reportBusy = !!busy;
    var bubble = document.getElementById('reportBubble');
    if (!bubble) return;
    var buttons = bubble.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (b.id === 'reportCancel') {
        b.disabled = !!busy;
        continue;
      }
      b.disabled = !!busy;
    }
  }

  window.__gpsReportResult = function(msg){
    msg = msg || {};
    setReportBubbleBusy(false);
    if (msg.ok) {
      closeReportBubble();
      setStatus(msg.label
        ? ('Signalement · ' + msg.label + ' · posé')
        : 'Signalement posé sur la carte');
      return;
    }
    /* Keep draft pin + bubble so the user can retry without re-tapping. */
    if (draftLL) {
      var bubble = document.getElementById('reportBubble');
      if (bubble) {
        bubble.classList.add('on');
        bubble.removeAttribute('hidden');
        bubble.setAttribute('aria-hidden', 'false');
      }
    }
    setStatus(msg.error
      ? String(msg.error).slice(0, 120)
      : 'Signalement refusé — réessayez');
  };

  var reportBubbleEl = document.getElementById('reportBubble');
  if (reportBubbleEl) {
    reportBubbleEl.addEventListener('click', function(ev){
      if (ev && ev.stopPropagation) ev.stopPropagation();
      var t = ev.target;
      if (t && t.closest) t = t.closest('button');
      else {
        while (t && t.tagName !== 'BUTTON' && t !== reportBubbleEl) t = t.parentNode;
      }
      if (!t || t.tagName !== 'BUTTON' || t.disabled) return;
      if (t.id === 'reportCancel') {
        if (reportBusy) return;
        closeReportBubble();
        setStatus(mode === 'camion'
          ? 'Mode camion — touchez / cherchez une destination'
          : 'Mode voiture — touchez / cherchez une destination');
        return;
      }
      var kind = t.getAttribute('data-kind');
      if (!kind || !draftLL) return;
      if (kind === 'destination') {
        setDestination(L.latLng(draftLL.lat, draftLL.lon));
        return;
      }
      var allowed = {
        accident: 1,
        ralentissement: 1,
        police: 1,
        danger: 1,
        travaux: 1,
        obstacle: 1,
      };
      if (!allowed[kind]) return;
      if (reportBusy) return;
      var lat = draftLL.lat;
      var lon = draftLL.lon;
      /* Keep draft until RN ack — rate-limit must not strand status on « envoi… ». */
      setReportBubbleBusy(true);
      setStatus('Signalement · ' + kind + ' · envoi…');
      post({ type: 'report', kind: kind, lat: lat, lon: lon });
    });
  }

  mapEl.addEventListener('touchstart', function(ev){
    /* Any finger contact: ignore following synthetic click (mouse stays intact). */
    suppressClickUntil = Date.now() + 700;
    if (ev.touches.length !== 1) {
      clearTouchPressTimer();
      touchMoved = true;
      longPressPlaced = false;
      touchStartPt = null;
      touchStartLL = null;
      lastTapAt = 0;
      lastTapPt = null;
      return;
    }
    var t = ev.touches[0];
    touchStartPt = touchPoint(t);
    touchStartLL = latLngFromTouch(t);
    touchMoved = false;
    longPressPlaced = false;
    clearTouchPressTimer();
    touchPressTimer = setTimeout(function(){
      touchPressTimer = null;
      if (!touchMoved && touchStartLL) {
        longPressPlaced = true;
        placePinFromTouch(touchStartLL);
      }
    }, LONG_PRESS_MS);
  }, { passive: true });

  mapEl.addEventListener('touchmove', function(ev){
    if (!touchStartPt || !ev.touches.length) return;
    var t = ev.touches[0];
    if (touchStartPt.distanceTo(touchPoint(t)) > TOUCH_MOVE_PX) {
      touchMoved = true;
      clearTouchPressTimer();
    }
  }, { passive: true });

  mapEl.addEventListener('touchend', function(ev){
    clearTouchPressTimer();
    if (longPressPlaced) {
      longPressPlaced = false;
      touchStartPt = null;
      touchStartLL = null;
      lastTapAt = 0;
      lastTapPt = null;
      return;
    }
    if (touchMoved || !touchStartPt || !ev.changedTouches || !ev.changedTouches.length) {
      touchStartPt = null;
      touchStartLL = null;
      return;
    }
    var t = ev.changedTouches[0];
    var pt = touchPoint(t);
    var now = Date.now();
    if (
      lastTapAt &&
      (now - lastTapAt) <= DOUBLE_TAP_MS &&
      lastTapPt &&
      lastTapPt.distanceTo(pt) <= DOUBLE_TAP_PX
    ) {
      lastTapAt = 0;
      lastTapPt = null;
      placePinFromTouch(latLngFromTouch(t));
      /* Prefer pin over Leaflet double-tap zoom for this gesture. */
      if (ev.cancelable && ev.preventDefault) ev.preventDefault();
    } else {
      lastTapAt = now;
      lastTapPt = pt;
    }
    touchStartPt = null;
    touchStartLL = null;
  }, { passive: false });

  mapEl.addEventListener('touchcancel', function(){
    clearTouchPressTimer();
    touchMoved = true;
    longPressPlaced = false;
    touchStartPt = null;
    touchStartLL = null;
  }, { passive: true });

  map.on('click', function(e){
    if (Date.now() < suppressClickUntil) return;
    openReportBubble(e.latlng);
  });

  function startNavigation(){
    if (!routeCoords.length || !gpsOk || !dest) return false;
    endExploreNow();
    followLive = true;
    navTripActive = true;
    arrivedPosted = false;
    var snap = snapToRoute(origin.lat, origin.lon, 40);
    displayOrigin = { lat: snap.lat, lon: snap.lon };
    ensureVehicleMarker();
    setStatus('Navigation — suivi GPS live (glissez pour explorer)');
    post({ type: 'navigating', mode: mode, to: dest });
    lastPanAt = Date.now();
    markProgrammaticCamera(400);
    map.panTo([displayOrigin.lat, displayOrigin.lon], { animate: true, duration: 0.35 });
    return true;
  }
  window.__gpsStartNavigation = startNavigation;

  /* Free pan/zoom during nav: pause forced follow; resume after idle. Route + ETA stay. */
  map.on('dragstart', function(){ beginExplore(); });
  map.on('zoomstart', function(){
    /* User pinch/wheel only — programmatic setView/panTo guarded via programmaticCamera. */
    beginExplore();
  });

  document.getElementById('btnCar').onclick = function(){ applyMode('voiture'); };
  document.getElementById('btnTruck').onclick = function(){ applyMode('camion'); };
  document.getElementById('btnGo').onclick = function(){ startNavigation(); };
  document.getElementById('btnRecenter').onclick = function(){
    endExploreNow();
    followLive = true;
    post({ type: 'recenter' });
  };

  var menu = document.getElementById('mapTypeMenu');
  menu.onclick = function(ev){
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var t = ev.target;
    if (t && t.closest) t = t.closest('button');
    else {
      while (t && t.tagName !== 'BUTTON' && t !== menu) t = t.parentNode;
    }
    if (!t || t.tagName !== 'BUTTON' || t.disabled) return;
    var base = t.getAttribute('data-base');
    var tog = t.getAttribute('data-tog');
    var act = t.getAttribute('data-act');
    if (base) setBaseLayer(base);
    else if (tog === 'transit') setTransit(!transitOn);
    else if (tog === 'traffic') setTraffic(!trafficOn);
    else if (tog === 'buildings3d') setBuildings3d(!buildingsOn);
    else if (tog === 'aqi') setAqiOverlay(!aqiOn);
    else if (act === 'streetview') {
      var focus = draftLL || dest || origin;
      post({ type: 'streetview', lat: focus.lat, lon: focus.lon });
    }
  };

  layersReady = true;
  if (pendingLayers) applyLayersPayload(pendingLayers);
  post({ type: 'ready', mode: mode });
})();
</script>
</body>
</html>`;
}
