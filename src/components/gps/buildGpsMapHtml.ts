/**
 * Self-contained Leaflet map HTML for WebView.
 * Base layers: Esri World Imagery ↔ multi-color roads (Carto Voyager if key, else OSM).
 * Vehicle DivIcon = LIVE GPS (parent injects ticks) — not a canned polyline demo.
 * Voiture/camion = top chips only (once). Tap / search = destination only → Valhalla.
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
};

export function buildGpsMapHtml(boot: GpsMapBoot): string {
  const bootJson = JSON.stringify(boot).replace(/</g, '\\u003c');
  const roads = roadsTileUrl();
  const roadsUrlJson = JSON.stringify(roads.url);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://unpkg.com/leaflet@1.9.4/ 'unsafe-inline'; style-src https://unpkg.com/leaflet@1.9.4/ 'unsafe-inline'; img-src https://server.arcgisonline.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org data: blob:; connect-src https://unpkg.com; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
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
  /* Only chips capture taps — status text must not steal map clicks. */
  .chip-row{display:flex;gap:6px;pointer-events:auto}
  .chip{
    flex:1;border:0;border-radius:11px;padding:9px 10px;font:650 12px/1.15 system-ui,sans-serif;
    background:rgba(255,255,255,.94);color:var(--ink);box-shadow:0 1px 8px rgba(0,0,0,.16);
    transition:background .2s ease,color .2s ease,transform .15s ease;
  }
  .chip.on{background:var(--signal);color:#fff}
  .chip.on.truck{background:var(--garage)}
  .chip small{display:block;font-weight:550;opacity:.72;margin-top:2px;font-size:10px;letter-spacing:.01em}
  .status{
    align-self:flex-start;max-width:94%;
    background:rgba(27,36,48,.9);color:#fff;border-radius:9px;padding:7px 10px;
    font:550 11px/1.35 system-ui,sans-serif;letter-spacing:.01em;
  }
  .bottom{
    position:absolute;z-index:1000;
    left:calc(10px + var(--pad-left));right:auto;
    bottom:calc(14px + var(--pad-bottom));
    display:flex;flex-direction:row;align-items:center;gap:8px;pointer-events:none;
  }
  .bottom > *{pointer-events:auto}
  /* Compact bottom-left CTA — replaces full-width « Suivre GPS ». */
  .go{
    border:0;border-radius:13px;padding:12px 16px;font:750 13px system-ui,sans-serif;
    background:var(--signal);color:#fff;box-shadow:0 3px 12px rgba(196,92,38,.38);
    transition:opacity .2s ease,transform .15s ease;
    letter-spacing:.01em;
  }
  .go:disabled{opacity:.4}
  .ghost{
    border:0;border-radius:13px;padding:12px 11px;font:650 11px system-ui,sans-serif;
    background:rgba(255,255,255,.94);color:var(--ink);
  }
  /* Small basemap toggle — bottom-right (replaces old Leaflet zoom/attribution chrome). */
  .layer-toggle{
    position:absolute;z-index:1000;
    right:calc(10px + var(--pad-right));
    bottom:calc(14px + var(--pad-bottom));
    border:0;border-radius:13px;padding:11px 12px;min-width:52px;
    font:700 11px/1.1 system-ui,sans-serif;letter-spacing:.02em;
    background:rgba(255,255,255,.94);color:var(--ink);
    box-shadow:0 2px 10px rgba(0,0,0,.22);
  }
  .layer-toggle small{display:block;font-weight:550;opacity:.7;margin-top:3px;font-size:9px}
  .vehicle-wrap{
    width:42px;height:42px;display:flex;align-items:center;justify-content:center;
    transition:transform .18s linear;
    will-change:transform;
  }
  .vehicle-icon{
    width:36px;height:36px;border-radius:18px;background:#fff;border:2.5px solid var(--signal);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 10px rgba(0,0,0,.35);
    transition:border-color .25s ease,box-shadow .25s ease;
  }
  .vehicle-icon.camion{border-color:var(--garage);box-shadow:0 2px 10px rgba(31,107,74,.35)}
  .vehicle-icon svg{width:24px;height:24px;display:block}
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
  .layer-pin.report{background:#3B5BDB}
  .route-line{transition:opacity .35s ease}
</style>
</head>
<body>
<div id="map"></div>
<div class="hud">
  <div class="chip-row">
    <button type="button" class="chip" id="btnCar"><span>Voiture</span><small>Profil auto</small></button>
    <button type="button" class="chip" id="btnTruck"><span>Camion</span><small>Profil truck</small></button>
  </div>
  <div class="status" id="status">Choisissez Voiture ou Camion en haut, puis touchez / cherchez une destination</div>
</div>
<div class="bottom">
  <button type="button" class="go" id="btnGo" disabled>itinéraire</button>
  <button type="button" class="ghost" id="btnRecenter">GPS</button>
</div>
<button type="button" class="layer-toggle" id="btnLayer" aria-label="Changer fond de carte"><span id="layerLabel">Sat</span><small id="layerHint">→ Routes</small></button>
<script>
(function(){
  var BOOT = ${bootJson};
  var ROADS_URL = ${roadsUrlJson};
  var mode = BOOT.mode === 'camion' ? 'camion' : 'voiture';
  var gpsOk = !!BOOT.gpsOk;
  var origin = { lat: BOOT.lat, lon: BOOT.lon };
  var headingDeg = null;
  var dest = null;
  var routeCoords = [];
  var vehicleMarker = null;
  var routeLine = null;
  var destMarker = null;
  var followLive = false;
  /** True only after startNavigation — not mere recenter / followLive. */
  var navTripActive = false;
  var arrivedPosted = false;
  var layerGroup = null;
  var lastPanAt = 0;
  var baseKind = 'esri';
  var esriLayer = null;
  var roadsLayer = null;

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

  function carSvg(){
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 30 L20 18 H44 L52 30 Z" fill="#C45C26"/><rect x="10" y="30" width="44" height="14" rx="5" fill="#2C3A47"/><circle cx="20" cy="46" r="5.5" fill="#101820"/><circle cx="44" cy="46" r="5.5" fill="#101820"/><rect x="16" y="33" width="10" height="6" rx="1.5" fill="#E8EEF2"/><rect x="38" y="33" width="10" height="6" rx="1.5" fill="#E8EEF2"/></svg>';
  }
  function truckSvg(){
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="20" width="32" height="22" rx="3" fill="#1F6B4A"/><rect x="36" y="26" width="22" height="16" rx="3" fill="#C45C26"/><rect x="40" y="29" width="10" height="7" rx="1.5" fill="#F3D9C8"/><circle cx="16" cy="46" r="5.5" fill="#101820"/><circle cx="48" cy="46" r="5.5" fill="#101820"/><rect x="8" y="24" width="12" height="8" rx="1" fill="#D7EDE3"/></svg>';
  }

  function vehicleHtml(){
    var cls = mode === 'camion' ? 'vehicle-icon camion' : 'vehicle-icon';
    var rot = (headingDeg != null && isFinite(headingDeg)) ? headingDeg : 0;
    return '<div class="vehicle-wrap" style="transform:rotate(' + rot + 'deg)"><div class="' + cls + '">' +
      (mode === 'camion' ? truckSvg() : carSvg()) + '</div></div>';
  }

  function vehicleDivIcon(){
    return L.divIcon({
      className: '',
      html: vehicleHtml(),
      iconSize: [42, 42],
      iconAnchor: [21, 21],
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

  /* No Leaflet chrome: zoom +/- and attribution banner hidden.
     Pinch/scroll zoom still works. Tile credit lives in GpsDestinationMenu sources.
     Base layers: Esri World Imagery ↔ Carto Voyager (or OSM if no Carto key). */
  var map = L.map('map', { zoomControl: false, attributionControl: false, preferCanvas: true })
    .setView([origin.lat, origin.lon], gpsOk ? 14 : 5);
  esriLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: ''
  });
  roadsLayer = L.tileLayer(ROADS_URL, {
    maxZoom: 19,
    attribution: ''
  });
  esriLayer.addTo(map);
  layerGroup = L.layerGroup().addTo(map);

  function syncLayerBtn(){
    var label = document.getElementById('layerLabel');
    var hint = document.getElementById('layerHint');
    if (baseKind === 'esri') {
      label.textContent = 'Sat';
      hint.textContent = '→ Routes';
    } else {
      label.textContent = 'Routes';
      hint.textContent = '→ Sat';
    }
  }

  function setBaseLayer(next){
    if (next === baseKind) return;
    if (next === 'roads') {
      map.removeLayer(esriLayer);
      roadsLayer.addTo(map);
      baseKind = 'roads';
    } else {
      map.removeLayer(roadsLayer);
      esriLayer.addTo(map);
      baseKind = 'esri';
    }
    syncLayerBtn();
  }
  syncLayerBtn();

  function ensureVehicleMarker(){
    if (!gpsOk) {
      if (vehicleMarker) { map.removeLayer(vehicleMarker); vehicleMarker = null; }
      return;
    }
    if (!vehicleMarker) {
      vehicleMarker = L.marker([origin.lat, origin.lon], {
        icon: vehicleDivIcon(),
        zIndexOffset: 900,
        interactive: false,
      }).addTo(map);
    } else {
      vehicleMarker.setLatLng([origin.lat, origin.lon]);
      vehicleMarker.setIcon(vehicleDivIcon());
    }
  }
  ensureVehicleMarker();

  syncChips();
  if (!gpsOk) {
    setStatus('GPS appareil refusé — activez la localisation (bouton GPS). Pas de départ silencieux.');
  } else {
    setStatus(mode === 'camion'
      ? 'GPS live · mode camion — touchez / cherchez une destination'
      : 'GPS live · mode voiture — touchez / cherchez une destination');
  }

  function clearRouteGraphics(){
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    routeCoords = [];
    document.getElementById('btnGo').disabled = true;
    followLive = false;
    navTripActive = false;
  }

  function applyMode(next, opts){
    mode = next;
    syncChips();
    ensureVehicleMarker();
    if (!opts || !opts.silent) post({ type: 'mode', mode: mode });
    setStatus(mode === 'camion'
      ? 'Mode camion — touchez / cherchez une destination'
      : 'Mode voiture — touchez / cherchez une destination');
    if (dest && gpsOk) requestRoute();
  }

  /** Destination only — mode comes from top chips, never re-prompted on tap. */
  function setDestination(latlng, label){
    if (!gpsOk) {
      setStatus('GPS appareil requis — pas d’itinéraire sans position réelle');
      return;
    }
    dest = { lat: latlng.lat, lon: latlng.lng };
    arrivedPosted = false;
    navTripActive = false;
    followLive = false;
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
      routeCoords = payload.coords;
      routeLine = L.polyline(routeCoords, {
        color: mode === 'camion' ? '#1F6B4A' : '#C45C26',
        weight: 5,
        opacity: 0.88,
        className: 'route-line',
      }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [52, 52], animate: true, duration: 0.45 });
      ensureVehicleMarker();
      document.getElementById('btnGo').disabled = false;
      setStatus(payload.label || 'Itinéraire prêt — tapez itinéraire pour le suivi live');
      post({ type: 'routed', mode: mode, distanceKm: payload.distanceKm, durationMin: payload.durationMin, label: payload.label });
    } catch (e) {
      setStatus('Affichage itinéraire KO');
    }
  };

  /** LIVE GPS tick — never remount map; marker = device coords. */
  window.__gpsUpdatePosition = function(lat, lon, ok, heading, speed){
    gpsOk = ok !== false;
    if (!gpsOk) {
      ensureVehicleMarker();
      setStatus('GPS appareil perdu — réactivez la localisation');
      return;
    }
    origin = { lat: lat, lon: lon };
    if (typeof heading === 'number' && isFinite(heading) && heading >= 0) headingDeg = heading;
    ensureVehicleMarker();
    var now = Date.now();
    if (followLive && now - lastPanAt > 700) {
      lastPanAt = now;
      map.panTo([lat, lon], { animate: true, duration: 0.55, easeLinearity: 0.3 });
    }
    // Post-trip voice logbook: only after an explicit startNavigation trip.
    if (navTripActive && dest && !arrivedPosted) {
      var distM = haversineM(origin, dest);
      if (distM <= 80) {
        arrivedPosted = true;
        navTripActive = false;
        setStatus('Arrivée — note vocale trajet dispo');
        post({ type: 'arrived', mode: mode, to: { lat: dest.lat, lon: dest.lon } });
      }
    }
  };

  window.__gpsSetOrigin = function(lat, lon, ok){
    window.__gpsUpdatePosition(lat, lon, ok, headingDeg, null);
    if (ok !== false) {
      map.setView([lat, lon], Math.max(map.getZoom(), 14), { animate: true });
      setStatus(mode === 'camion'
        ? 'GPS appareil OK — mode camion, touchez une destination'
        : 'GPS appareil OK — touchez une destination');
    } else {
      // One-shot GPS fail must NOT wipe live route / destination while watch may recover.
      setStatus('GPS one-shot refusé — itinéraire conservé (réessayez GPS)');
    }
  };

  window.__gpsApplyMode = function(next, truck){
    if (truck) {
      if (truck.heightM != null) BOOT.truckHeightM = truck.heightM;
      if (truck.widthM != null) BOOT.truckWidthM = truck.widthM;
      if (truck.weightT != null) BOOT.truckPtacT = truck.weightT;
    }
    applyMode(next === 'camion' ? 'camion' : 'voiture', { silent: true });
  };

  window.__gpsSetChrome = function(p){ applyChrome(p || {}); };

  window.__gpsProposeDestination = function(lat, lon, label){
    setDestination(L.latLng(lat, lon), label || '');
  };

  /** Escape untrusted OSM/crowd strings before any HTML sink (DivIcon / tooltips). */
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  /** Leaflet tooltip via textContent — never innerHTML with raw notes/names. */
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
  function applyLayersPayload(payload){
    try {
      layerGroup.clearLayers();
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
        var on = !!s.litUp || s.status === 'open';
        var html = '<div class="layer-pin ' + (on ? 'weigh-on' : 'weigh-off') + '">' + (on ? 'ON' : '?') + '</div>';
        L.marker([s.lat, s.lon], {
          icon: L.divIcon({ className: '', html: html, iconSize: [32, 28], iconAnchor: [16, 14] }),
          zIndexOffset: 450,
        }).bindTooltip(tipEl((s.name || 'Pesage') + (on ? ' · scale ON (advisory OSM)' : ' · statut inconnu / fermé')), { direction: 'top' })
          .addTo(layerGroup);
      });
      reports.forEach(function(r){
        if (!finiteLatLon(r.lat, r.lon)) return;
        var kind = String(r.kind || 'alerte').replace(/[^a-z0-9_-]/gi, '').slice(0, 12) || 'alerte';
        var label = kind.slice(0, 3).toUpperCase();
        var html = '<div class="layer-pin report">' + esc(label) + '</div>';
        var tip = kind + (r.note ? ' — ' + String(r.note).slice(0, 80) : '') + ' · expire crowd';
        L.marker([r.lat, r.lon], {
          icon: L.divIcon({ className: '', html: html, iconSize: [36, 28], iconAnchor: [18, 14] }),
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

  window.addEventListener('message', function(ev){
    if (ev.source !== window.parent) return;
    var raw = ev.data;
    var msg = null;
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (!msg || msg.__gps !== 1 || typeof msg.cmd !== 'string') return;
    if (msg.cmd === 'applyRoute') window.__gpsApplyRoute(msg.payload);
    else if (msg.cmd === 'setOrigin') window.__gpsSetOrigin(msg.lat, msg.lon, msg.ok);
    else if (msg.cmd === 'updatePosition') window.__gpsUpdatePosition(msg.lat, msg.lon, msg.ok, msg.heading, msg.speed);
    else if (msg.cmd === 'applyMode') window.__gpsApplyMode(msg.mode, msg.truck);
    else if (msg.cmd === 'setChrome') window.__gpsSetChrome(msg.pads);
    else if (msg.cmd === 'proposeDestination') window.__gpsProposeDestination(msg.lat, msg.lon, msg.label);
    else if (msg.cmd === 'startNavigation') window.__gpsStartNavigation && window.__gpsStartNavigation();
    else if (msg.cmd === 'setLayers') window.__gpsSetLayers(msg.payload);
  });

  map.on('click', function(e){
    setDestination(e.latlng);
  });

  function startNavigation(){
    if (!routeCoords.length || !gpsOk || !dest) return false;
    followLive = true;
    navTripActive = true;
    arrivedPosted = false;
    setStatus('Navigation — marqueur = position appareil (pas de démo polyline)');
    post({ type: 'navigating', mode: mode, to: dest });
    map.panTo([origin.lat, origin.lon], { animate: true, duration: 0.4 });
    return true;
  }
  window.__gpsStartNavigation = startNavigation;

  document.getElementById('btnCar').onclick = function(){ applyMode('voiture'); };
  document.getElementById('btnTruck').onclick = function(){ applyMode('camion'); };
  document.getElementById('btnGo').onclick = function(){ startNavigation(); };
  document.getElementById('btnRecenter').onclick = function(){
    followLive = true;
    post({ type: 'recenter' });
  };
  document.getElementById('btnLayer').onclick = function(ev){
    if (ev && ev.stopPropagation) ev.stopPropagation();
    setBaseLayer(baseKind === 'esri' ? 'roads' : 'esri');
  };

  layersReady = true;
  if (pendingLayers) applyLayersPayload(pendingLayers);
  post({ type: 'ready', mode: mode });
})();
</script>
</body>
</html>`;
}
