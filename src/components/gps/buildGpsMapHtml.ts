/**
 * Self-contained Leaflet map HTML for WebView.
 * Map-type menu (+): Default roads · Satellite · Terrain · Transit · 3D · AQI.
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
  /** Optional Mapbox token for 3D buildings (preferred). */
  mapboxToken?: string;
};

export function buildGpsMapHtml(boot: GpsMapBoot): string {
  const token = (boot.mapboxToken ?? mapboxToken()).replace(/[^a-zA-Z0-9._-]/g, '');
  const bootPayload = { ...boot, mapboxToken: token || undefined };
  const bootJson = JSON.stringify(bootPayload).replace(/</g, '\\u003c');
  const roads = roadsTileUrl();
  const roadsUrlJson = JSON.stringify(roads.url);
  const mapboxTokenJson = JSON.stringify(token);
  const hasMapbox = token.length > 0;

  // CSP: allow Esri, Carto, OSM, OpenTopoMap, ÖPNVKarte transit, OSM Buildings / Mapbox GL when used.
  const csp = [
    "default-src 'none'",
    "script-src https://unpkg.com/leaflet@1.9.4/ https://cdn.osmbuildings.org https://api.mapbox.com 'unsafe-inline'",
    "style-src https://unpkg.com/leaflet@1.9.4/ https://api.mapbox.com https://cdn.osmbuildings.org 'unsafe-inline'",
    "img-src https://server.arcgisonline.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://tile.opentopomap.org https://*.tile.opentopomap.org https://tile.memomaps.de https://*.tile.memomaps.de https://a.tiles.mapbox.com https://b.tiles.mapbox.com https://c.tiles.mapbox.com https://d.tiles.mapbox.com https://api.mapbox.com data: blob:",
    "connect-src https://unpkg.com https://cdn.osmbuildings.org https://data.osmbuildings.org https://api.mapbox.com https://events.mapbox.com",
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
<script src="https://cdn.osmbuildings.org/4.1.1/OSMBuildings-Leaflet.js"></script>
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
  /* Google Maps-style small + map-type control (extends Esri Sat/Routes). */
  .maptype-wrap{
    position:absolute;z-index:1100;
    right:calc(10px + var(--pad-right));
    bottom:calc(14px + var(--pad-bottom));
    display:flex;flex-direction:column;align-items:flex-end;gap:6px;
    pointer-events:none;
  }
  .maptype-wrap > *{pointer-events:auto}
  .maptype-plus{
    width:44px;height:44px;border:0;border-radius:13px;
    font:800 22px/1 system-ui,sans-serif;background:rgba(255,255,255,.96);color:var(--ink);
    box-shadow:0 2px 10px rgba(0,0,0,.22);
  }
  .maptype-menu{
    display:none;flex-direction:column;gap:2px;min-width:168px;
    background:rgba(255,255,255,.97);border-radius:12px;padding:6px;
    box-shadow:0 4px 18px rgba(0,0,0,.28);
  }
  .maptype-menu.open{display:flex}
  .maptype-menu button{
    border:0;background:transparent;text-align:left;padding:9px 10px;border-radius:8px;
    font:650 12px/1.2 system-ui,sans-serif;color:var(--ink);
  }
  .maptype-menu button.on{background:rgba(196,92,38,.14);color:var(--signal);font-weight:800}
  .maptype-menu button:disabled{opacity:.45}
  .maptype-menu .sep{height:1px;background:rgba(0,0,0,.08);margin:4px 2px}
  .vehicle-wrap{
    width:42px;height:42px;display:flex;align-items:center;justify-content:center;
    transition:transform .18s linear;will-change:transform;
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
  .layer-pin.weigh-alert{
    background:#E74C3C;border:2px solid #fff;
    animation:weighBlink .55s ease-in-out infinite alternate;
    transform:scale(1.25);
  }
  .layer-pin.report{background:#3B5BDB}
  @keyframes weighBlink{from{opacity:.55;box-shadow:0 0 0 0 rgba(231,76,60,.2)}to{opacity:1;box-shadow:0 0 0 10px rgba(231,76,60,.05)}}
  .route-line{transition:opacity .35s ease}
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
    <button type="button" class="chip" id="btnTruck"><span>Camion</span><small>Profil truck</small></button>
  </div>
  <div class="status" id="status">Choisissez Voiture ou Camion en haut, puis touchez / cherchez une destination</div>
</div>
<div class="bottom">
  <button type="button" class="go" id="btnGo" disabled>itinéraire</button>
  <button type="button" class="ghost" id="btnRecenter">GPS</button>
</div>
<div class="maptype-wrap">
  <div class="maptype-menu" id="mapTypeMenu" role="menu">
    <button type="button" data-base="roads" class="on">Default · routes</button>
    <button type="button" data-base="satellite">Satellite</button>
    <button type="button" data-base="terrain">Terrain</button>
    <div class="sep"></div>
    <button type="button" data-tog="transit">Transport en commun</button>
    <button type="button" data-tog="buildings3d">Bâtiments 3D</button>
    <button type="button" data-tog="aqi">Qualité de l’air</button>
    <div class="sep"></div>
    <button type="button" data-act="streetview">Street View (pin)</button>
  </div>
  <button type="button" class="maptype-plus" id="btnMapType" aria-label="Types de carte" aria-expanded="false">+</button>
</div>
<script>
(function(){
  var BOOT = ${bootJson};
  var ROADS_URL = ${roadsUrlJson};
  var MAPBOX_TOKEN = ${mapboxTokenJson};
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
  var aqiGroup = null;
  var lastPanAt = 0;
  var baseKind = 'roads';
  var roadsLayer = null;
  var satLayer = null;
  var terrainLayer = null;
  var transitLayer = null;
  var transitOn = false;
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
  roadsLayer.addTo(map);
  layerGroup = L.layerGroup().addTo(map);
  aqiGroup = L.layerGroup().addTo(map);

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
    syncMapTypeMenu();
    post({ type: 'maptype', base: baseKind, transit: transitOn, buildings3d: buildingsOn, aqi: aqiOn });
  }

  function syncMapTypeMenu(){
    var menu = document.getElementById('mapTypeMenu');
    if (!menu) return;
    var buttons = menu.querySelectorAll('button[data-base]');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      b.classList.toggle('on', b.getAttribute('data-base') === baseKind);
    }
    var togTransit = menu.querySelector('button[data-tog="transit"]');
    var tog3d = menu.querySelector('button[data-tog="buildings3d"]');
    var togAqi = menu.querySelector('button[data-tog="aqi"]');
    if (togTransit) togTransit.classList.toggle('on', transitOn);
    if (tog3d) tog3d.classList.toggle('on', buildingsOn);
    if (togAqi) togAqi.classList.toggle('on', aqiOn);
  }

  function setTransit(on){
    transitOn = !!on;
    if (transitOn) transitLayer.addTo(map);
    else map.removeLayer(transitLayer);
    syncMapTypeMenu();
    post({ type: 'maptype', base: baseKind, transit: transitOn, buildings3d: buildingsOn, aqi: aqiOn });
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

  function ensureOsmBuildings(){
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

  function setBuildings3d(on){
    buildingsOn = !!on;
    if (!buildingsOn) {
      destroyMapbox3d();
      destroyOsmBuildings();
      syncMapTypeMenu();
      post({ type: 'maptype', base: baseKind, transit: transitOn, buildings3d: buildingsOn, aqi: aqiOn });
      return;
    }
    var ok = false;
    if (MAPBOX_TOKEN) ok = ensureMapbox3d();
    if (!ok) ok = ensureOsmBuildings();
    if (!ok) {
      buildingsOn = false;
      setStatus('Bâtiments 3D indisponibles — EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ou OSM Buildings CDN');
    } else if (MAPBOX_TOKEN && mbMap) {
      setStatus('Bâtiments 3D Mapbox · opacite ~0.5');
    } else {
      setStatus('Bâtiments 3D OSM Buildings · opacite ~0.5 (pas de Mapbox token)');
    }
    syncMapTypeMenu();
    post({ type: 'maptype', base: baseKind, transit: transitOn, buildings3d: buildingsOn, aqi: aqiOn });
  }

  function setAqiOverlay(on){
    aqiOn = !!on;
    if (!aqiOn) aqiGroup.clearLayers();
    syncMapTypeMenu();
    post({ type: 'maptype', base: baseKind, transit: transitOn, buildings3d: buildingsOn, aqi: aqiOn });
    if (aqiOn) post({ type: 'aqi_request', lat: origin.lat, lon: origin.lon });
  }

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
  syncMapTypeMenu();
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
    ensureVehicleMarker();
    var now = Date.now();
    if (followLive && now - lastPanAt > 700) {
      lastPanAt = now;
      map.panTo([lat, lon], { animate: true, duration: 0.55, easeLinearity: 0.3 });
    }
    // Post-trip voice logbook + trip history: only after an explicit startNavigation trip.
    if (navTripActive && dest && !arrivedPosted) {
      var distM = haversineM(origin, dest);
      if (distM <= 80) {
        arrivedPosted = true;
        navTripActive = false;
        followLive = false;
        setStatus('Arrivée — note vocale trajet dispo');
        post({ type: 'arrived', mode: mode, to: { lat: dest.lat, lon: dest.lon } });
      }
    }
    if (buildingsOn && mbMap) syncMapboxCamera();
  };

  window.__gpsSetOrigin = function(lat, lon, ok){
    window.__gpsUpdatePosition(lat, lon, ok, headingDeg, null);
    if (ok !== false) {
      map.setView([lat, lon], Math.max(map.getZoom(), 14), { animate: true });
      setStatus(mode === 'camion'
        ? 'GPS appareil OK — mode camion, touchez une destination'
        : 'GPS appareil OK — touchez une destination');
    } else {
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
    else if (msg.cmd === 'applyMode') window.__gpsApplyMode(msg.mode, msg.truck);
    else if (msg.cmd === 'setChrome') window.__gpsSetChrome(msg.pads);
    else if (msg.cmd === 'proposeDestination') window.__gpsProposeDestination(msg.lat, msg.lon, msg.label);
    else if (msg.cmd === 'startNavigation') window.__gpsStartNavigation && window.__gpsStartNavigation();
    else if (msg.cmd === 'setLayers') window.__gpsSetLayers(msg.payload);
    else if (msg.cmd === 'highlightWeigh') window.__gpsHighlightWeigh(msg.id);
    else if (msg.cmd === 'setAqi') window.__gpsSetAqi(msg.payload);
    else if (msg.cmd === 'setMapType') window.__gpsSetMapType(msg);
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

  var menu = document.getElementById('mapTypeMenu');
  var btnMapType = document.getElementById('btnMapType');
  btnMapType.onclick = function(ev){
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var open = menu.classList.toggle('open');
    btnMapType.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  menu.onclick = function(ev){
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var t = ev.target;
    if (!t || t.tagName !== 'BUTTON') return;
    var base = t.getAttribute('data-base');
    var tog = t.getAttribute('data-tog');
    var act = t.getAttribute('data-act');
    if (base) setBaseLayer(base);
    else if (tog === 'transit') setTransit(!transitOn);
    else if (tog === 'buildings3d') setBuildings3d(!buildingsOn);
    else if (tog === 'aqi') setAqiOverlay(!aqiOn);
    else if (act === 'streetview') {
      var focus = dest || origin;
      post({ type: 'streetview', lat: focus.lat, lon: focus.lon });
      menu.classList.remove('open');
      btnMapType.setAttribute('aria-expanded', 'false');
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
