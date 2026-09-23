// Richiede Leaflet 1.9.4:
// <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
// <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
const CrmMap = (() => {
  const STATUS = {
    prospect: '#8E8E93', contattato: '#0A84FF', visitato: '#5E5CE6', trattativa: '#FF9F0A',
    attivo: '#30D158', dormiente: '#BF8B30', perso: '#FF453A'
  };
  const MILANO = [45.4642, 9.19];
  const VIEWBOX = '8.95,45.60,9.40,45.33'; // area metropolitana
  const cache = new Map();
  let lastCall = 0;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  document.head.insertAdjacentHTML('beforeend', `<style>
    .leaflet-tile-pane{filter:grayscale(1) contrast(.92) brightness(1.04)}
    .crm-pin{display:block;width:22px;height:22px;border-radius:50%;background:var(--c);
      border:3px solid var(--r);box-shadow:0 1px 5px rgb(0 0 0/.35)}
    .leaflet-popup-content-wrapper{border-radius:14px;font:14px/1.35 -apple-system,system-ui,sans-serif}
  </style>`);

  // Nominatim: max 1 req/s, risultati salvati su DB -> una sola chiamata per indirizzo
  async function geocode({ indirizzo, cap, citta = 'Milano' }) {
    const q = [indirizzo, cap, citta, 'Italia'].filter(Boolean).join(', ');
    const key = q.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const wait = 1100 - (Date.now() - lastCall);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCall = Date.now();
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=it'
      + `&viewbox=${VIEWBOX}&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'it' } });
    if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
    const [hit] = await res.json();
    const out = hit ? { lat: +hit.lat, lng: +hit.lon } : null;
    cache.set(key, out);
    return out;
  }

  // Da chiamare prima di insert/update cliente: restituisce i campi geo da aggiungere al payload
  async function geoPatch(next, prev) {
    const changed = !prev || ['indirizzo', 'cap', 'citta'].some(k => (prev[k] ?? '') !== (next[k] ?? ''));
    if (!changed || !next.indirizzo) return {};
    const p = await geocode(next).catch(() => null);
    return p ? { ...p, geo_manual: false } : { lat: null, lng: null, geo_manual: false };
  }

  // Import massivo: geocodifica sequenziale dei clienti senza coordinate
  async function geocodeMissing(sb, clients, onProgress) {
    const todo = clients.filter(c => c.lat == null && c.indirizzo);
    for (const [i, c] of todo.entries()) {
      const p = await geocode(c).catch(() => null);
      if (p) await sb.schema('crm').from('clients').update(p).eq('id', c.id);
      onProgress?.(i + 1, todo.length);
    }
  }

  function create(el) {
    const map = L.map(el, { zoomControl: false }).setView(MILANO, 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    return { map, layer: L.layerGroup().addTo(map) };
  }

  // opts: { stati:Set, agentId, meId, isAdmin, onOpen(client), onMove(client, {lat,lng}) }
  function render({ map, layer }, clients, agentsById, opts = {}) {
    layer.clearLayers();
    const bounds = [];
    for (const c of clients) {
      if (c.lat == null) continue;
      if (opts.stati?.size && !opts.stati.has(c.stato)) continue;
      if (opts.agentId && c.agent_id !== opts.agentId) continue;
      const a = agentsById[c.agent_id] ?? {};
      const editable = opts.isAdmin || c.agent_id === opts.meId;
      const icon = L.divIcon({
        className: '', iconSize: [22, 22], iconAnchor: [11, 11],
        html: `<span class="crm-pin" style="--c:${STATUS[c.stato]};--r:${a.colore ?? '#fff'}"></span>`
      });
      const m = L.marker([c.lat, c.lng], { icon, draggable: editable, title: c.insegna || c.ragione_sociale })
        .bindPopup(`<b>${esc(c.insegna || c.ragione_sociale)}</b><br>${esc(c.indirizzo)}
          <br><small>${esc(c.stato)} · ${esc(a.nome)}</small>`)
        .on('popupopen', () => opts.onOpen?.(c))
        .addTo(layer);
      if (editable) m.on('dragend', e => opts.onMove?.(c, e.target.getLatLng()));
      bounds.push([c.lat, c.lng]);
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }

  // onMove consigliato:
  // (c, ll) => sb.schema('crm').from('clients').update({ lat: ll.lat, lng: ll.lng, geo_manual: true }).eq('id', c.id)
  return { STATUS, geocode, geoPatch, geocodeMissing, create, render };
})();
