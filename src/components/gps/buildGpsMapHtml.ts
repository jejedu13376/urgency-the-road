/**
 * Self-contained Leaflet + OSM map HTML for WebView.
 * Tap destination → voiture/camion picker (truck SVG) → route + animate vehicle.
 */
export type GpsMapBoot = {
  lat: number;
  lon: number;
  mode: 'voiture' | 'camion';
  truckHeightM: number;
  truckWidthM: number;
  truckPtacT: number;
};

export function buildGpsMapHtml(boot: GpsMapBoot): string {
  const bootJson = JSON.stringify(boot).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#1B2430;overflow:hidden}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  .hud{
    position:absolute;z-index:1000;left:10px;right:10px;top:10px;
    display:flex;flex-direction:column;gap:8px;pointer-events:none;
  }
  .hud > *{pointer-events:auto}
  .chip-row{display:flex;gap:8px}
  .chip{
    flex:1;border:0;border-radius:12px;padding:10px 12px;font:700 13px/1.2 system-ui,sans-serif;
    background:rgba(255,255,255,.94);color:#101820;box-shadow:0 2px 10px rgba(0,0,0,.18);
  }
  .chip.on{background:#C45C26;color:#fff}
  .chip small{display:block;font-weight:600;opacity:.75;margin-top:2px;font-size:11px}
  .status{
    align-self:flex-start;max-width:92%;
    background:rgba(27,36,48,.88);color:#fff;border-radius:10px;padding:8px 10px;
    font:600 11px/1.35 system-ui,sans-serif;
  }
  .picker{
    display:none;position:absolute;z-index:1100;left:50%;top:50%;transform:translate(-50%,-50%);
    width:min(300px,86vw);background:rgba(255,255,255,.97);border-radius:16px;padding:14px;
    box-shadow:0 8px 28px rgba(0,0,0,.35);font:600 13px system-ui,sans-serif;color:#101820;
  }
  .picker.show{display:block}
  .picker h3{margin:0 0 6px;font-size:15px}
  .picker p{margin:0 0 12px;color:#6B7785;font-weight:500;font-size:12px;line-height:1.35}
  .pick-row{display:flex;gap:8px}
  .pick{
    flex:1;border:1px solid #D3D9DF;border-radius:12px;background:#F7F4EF;padding:12px 8px;
    display:flex;flex-direction:column;align-items:center;gap:6px;font:800 13px system-ui,sans-serif;
  }
  .pick:active{transform:scale(.98)}
  .icon{width:36px;height:36px}
  .bottom{
    position:absolute;z-index:1000;left:10px;right:10px;bottom:18px;display:flex;gap:8px;pointer-events:none;
  }
  .bottom > *{pointer-events:auto}
  .go{
    flex:1;border:0;border-radius:14px;padding:14px;font:800 14px system-ui,sans-serif;
    background:#C45C26;color:#fff;box-shadow:0 4px 14px rgba(196,92,38,.4);
  }
  .go:disabled{opacity:.45}
  .ghost{
    border:0;border-radius:14px;padding:14px 12px;font:700 12px system-ui,sans-serif;
    background:rgba(255,255,255,.94);color:#101820;
  }
  .vehicle-icon{
    width:34px;height:34px;border-radius:17px;background:#fff;border:2px solid #C45C26;
    display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.35);
  }
  .vehicle-icon svg{width:22px;height:22px}
</style>
</head>
<body>
<div id="map"></div>
<div class="hud">
  <div class="chip-row">
    <button type="button" class="chip" id="btnCar"><span>Voiture</span><small>Itinéraire auto</small></button>
    <button type="button" class="chip" id="btnTruck"><span>🚛 Camion</span><small>Profil truck</small></button>
  </div>
  <div class="status" id="status">Touchez la carte pour choisir la destination</div>
</div>
<div class="picker" id="picker">
  <h3>Mode de navigation</h3>
  <p id="pickerHint">Destination sélectionnée — voiture ou camion ?</p>
  <div class="pick-row">
    <button type="button" class="pick" id="pickCar">
      <svg class="icon" viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="28" width="48" height="16" rx="4" fill="#2C3A47"/><circle cx="18" cy="46" r="6" fill="#101820"/><circle cx="46" cy="46" r="6" fill="#101820"/><path d="M14 28 L22 16 H42 L50 28" fill="#C45C26"/></svg>
      Voiture
    </button>
    <button type="button" class="pick" id="pickTruck">
      <svg class="icon" viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="22" width="34" height="20" rx="3" fill="#1F6B4A"/><rect x="38" y="28" width="20" height="14" rx="2" fill="#C45C26"/><circle cx="16" cy="46" r="6" fill="#101820"/><circle cx="48" cy="46" r="6" fill="#101820"/><rect x="8" y="26" width="10" height="8" fill="#D7EDE3"/></svg>
      Camion
    </button>
  </div>
</div>
<div class="bottom">
  <button type="button" class="ghost" id="btnRecenter">GPS</button>
  <button type="button" class="go" id="btnGo" disabled>Démarrer</button>
</div>
<script>
(function(){
  var BOOT = ${bootJson};
  var mode = BOOT.mode === 'camion' ? 'camion' : 'voiture';
  var origin = { lat: BOOT.lat, lon: BOOT.lon };
  var dest = null;
  var routeCoords = [];
  var animTimer = null;
  var vehicleMarker = null;
  var routeLine = null;
  var destMarker = null;
  var pendingPick = null;

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
    document.getElementById('btnCar').classList.toggle('on', mode === 'voiture');
    document.getElementById('btnTruck').classList.toggle('on', mode === 'camion');
  }

  function carIconHtml(){
    return '<div class="vehicle-icon"><svg viewBox="0 0 64 64"><rect x="8" y="28" width="48" height="16" rx="4" fill="#2C3A47"/><circle cx="18" cy="46" r="6" fill="#101820"/><circle cx="46" cy="46" r="6" fill="#101820"/><path d="M14 28 L22 16 H42 L50 28" fill="#C45C26"/></svg></div>';
  }
  function truckIconHtml(){
    return '<div class="vehicle-icon"><svg viewBox="0 0 64 64"><rect x="4" y="22" width="34" height="20" rx="3" fill="#1F6B4A"/><rect x="38" y="28" width="20" height="14" rx="2" fill="#C45C26"/><circle cx="16" cy="46" r="6" fill="#101820"/><circle cx="48" cy="46" r="6" fill="#101820"/><rect x="8" y="26" width="10" height="8" fill="#D7EDE3"/></svg></div>';
  }

  function vehicleDivIcon(){
    return L.divIcon({
      className: '',
      html: mode === 'camion' ? truckIconHtml() : carIconHtml(),
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }

  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([origin.lat, origin.lon], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  var originMarker = L.circleMarker([origin.lat, origin.lon], {
    radius: 7, color: '#C45C26', fillColor: '#F3D9C8', fillOpacity: 1, weight: 2
  }).addTo(map).bindTooltip('Départ');

  syncChips();
  setStatus(mode === 'camion'
    ? 'Mode camion — touchez une destination (Valhalla truck + alertes gabarit)'
    : 'Mode voiture — touchez une destination');

  function stopAnim(){
    if (animTimer) { clearInterval(animTimer); animTimer = null; }
  }

  function clearRoute(){
    stopAnim();
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (vehicleMarker) { map.removeLayer(vehicleMarker); vehicleMarker = null; }
    routeCoords = [];
    document.getElementById('btnGo').disabled = true;
  }

  function showPicker(latlng){
    pendingPick = latlng;
    document.getElementById('pickerHint').textContent =
      'Destination ' + latlng.lat.toFixed(4) + ', ' + latlng.lng.toFixed(4) + ' — voiture ou camion ?';
    document.getElementById('picker').classList.add('show');
  }

  function hidePicker(){ document.getElementById('picker').classList.remove('show'); }

  function applyMode(next){
    mode = next;
    syncChips();
    post({ type: 'mode', mode: mode });
    if (dest) requestRoute();
  }

  function setDestination(latlng){
    dest = { lat: latlng.lat, lon: latlng.lng };
    if (destMarker) map.removeLayer(destMarker);
    destMarker = L.marker([dest.lat, dest.lon]).addTo(map);
    requestRoute();
  }

  function requestRoute(){
    if (!dest) return;
    clearRoute();
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
        return;
      }
      routeCoords = payload.coords;
      routeLine = L.polyline(routeCoords, {
        color: mode === 'camion' ? '#1F6B4A' : '#C45C26',
        weight: 5,
        opacity: 0.9,
      }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [48, 48] });
      vehicleMarker = L.marker(routeCoords[0], { icon: vehicleDivIcon(), zIndexOffset: 800 }).addTo(map);
      document.getElementById('btnGo').disabled = false;
      setStatus(payload.label || 'Itinéraire prêt');
      post({ type: 'routed', mode: mode, distanceKm: payload.distanceKm, durationMin: payload.durationMin, label: payload.label });
    } catch (e) {
      setStatus('Affichage itinéraire KO');
    }
  };

  window.__gpsSetOrigin = function(lat, lon){
    origin = { lat: lat, lon: lon };
    originMarker.setLatLng([lat, lon]);
    map.setView([lat, lon], Math.max(map.getZoom(), 13));
  };

  function animateDrive(){
    if (!routeCoords.length) return;
    stopAnim();
    if (vehicleMarker) map.removeLayer(vehicleMarker);
    vehicleMarker = L.marker(routeCoords[0], { icon: vehicleDivIcon(), zIndexOffset: 900 }).addTo(map);
    var i = 0;
    var step = Math.max(1, Math.floor(routeCoords.length / 120));
    setStatus('Navigation ' + (mode === 'camion' ? 'camion' : 'voiture') + ' — animation sur l’itinéraire');
    post({ type: 'navigating', mode: mode, to: dest });
    animTimer = setInterval(function(){
      i += step;
      if (i >= routeCoords.length) {
        i = routeCoords.length - 1;
        vehicleMarker.setLatLng(routeCoords[i]);
        stopAnim();
        setStatus('Arrivée — ouvrez Maps pour le guidage GPS live');
        post({ type: 'arrived', mode: mode, to: dest });
        return;
      }
      vehicleMarker.setLatLng(routeCoords[i]);
      map.panTo(routeCoords[i], { animate: true, duration: 0.25 });
    }, 120);
  }

  map.on('click', function(e){
    hidePicker();
    showPicker(e.latlng);
  });

  document.getElementById('pickCar').onclick = function(){
    hidePicker();
    applyMode('voiture');
    if (pendingPick) setDestination(pendingPick);
  };
  document.getElementById('pickTruck').onclick = function(){
    hidePicker();
    applyMode('camion');
    if (pendingPick) setDestination(pendingPick);
  };
  document.getElementById('btnCar').onclick = function(){ applyMode('voiture'); };
  document.getElementById('btnTruck').onclick = function(){ applyMode('camion'); };
  document.getElementById('btnGo').onclick = function(){ animateDrive(); };
  document.getElementById('btnRecenter').onclick = function(){
    post({ type: 'recenter' });
    map.setView([origin.lat, origin.lon], 14);
  };

  post({ type: 'ready', mode: mode });
})();
</script>
</body>
</html>`;
}
