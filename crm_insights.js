// Ricerca locale (OpenStreetMap: Photon + Nominatim, gratuito) + wrapper RPC analytics
const CrmInsights = (() => {

  const TIPO = {
    restaurant: 'ristorante', fast_food: 'ristorante', bar: 'bar', pub: 'bar', cafe: 'bar',
    wine_bar: 'enoteca', wine: 'enoteca', alcohol: 'enoteca', hotel: 'hotel',
    deli: 'gastronomia', delicatessen: 'gastronomia'
  };
  const CUCINA = {
    italian: 'italiana', pizza: 'pizza', regional: 'regionale', seafood: 'di pesce', japanese: 'giapponese',
    sushi: 'sushi', chinese: 'cinese', french: 'francese', spanish: 'spagnola', mexican: 'messicana',
    indian: 'indiana', burger: 'burger', steak_house: 'carne alla griglia', vegetarian: 'vegetariana',
    vegan: 'vegana', mediterranean: 'mediterranea', fusion: 'fusion', lombard: 'lombarda',
    milanese: 'milanese', coffee_shop: 'caffetteria', tapas: 'tapas', greek: 'greca', thai: 'thailandese'
  };


  // Autocomplete nome locale: Photon (OSM, veloce, CORS) + dettagli da Nominatim alla scelta
  const PHOTON = 'https://photon.komoot.io/api/';
  const NOMI = 'https://nominatim.openstreetmap.org/lookup';
  const LOCALI = /^(amenity:(restaurant|bar|pub|cafe|wine_bar|fast_food|biergarten|ice_cream)|shop:(wine|alcohol|deli|pasta|bakery|pastry)|tourism:(hotel|guest_house))$/;
  const cap = v => (v && !/^\d{3}00$/.test(v) ? v : null);   // 20100 = CAP generico: meglio vuoto
  const zonaDi = a => a.quarter || a.neighbourhood || a.locality ||
    (/^Municipio/.test(a.suburb || a.district || '') ? null : a.suburb) || a.suburb || a.district ||
    ((a.city || a.town || a.village) && !/^Mil(ano|an)$/.test(a.city) ? a.city || a.town || a.village : null);
  let ctrl;
  async function searchVenue(name, limit = 6) {
    const q = name.trim();
    if (q.length < 3) return [];
    ctrl?.abort();
    ctrl = new AbortController();
    const res = await fetch(`${PHOTON}?q=${encodeURIComponent(q)}&lat=45.4642&lon=9.19&limit=15&lang=default&bbox=8.95,45.33,9.40,45.60`,
      { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Ricerca locali HTTP ${res.status}`);
    const { features = [] } = await res.json();
    return features.filter(f => f.properties?.name && LOCALI.test(`${f.properties.osm_key}:${f.properties.osm_value}`))
      .slice(0, limit).map(({ properties: p, geometry: g }) => ({
        osm_ref: `${p.osm_type}${p.osm_id}`,
        insegna: p.name,
        tipologia: TIPO[p.osm_value] ?? 'altro',
        indirizzo: [p.street, p.housenumber].filter(Boolean).join(' ') || null,
        cap: cap(p.postcode),
        citta: p.city === 'Milan' ? 'Milano' : (p.city || p.town || p.village || 'Milano'),
        zona: zonaDi(p),
        lat: g?.coordinates?.[1] ?? null, lng: g?.coordinates?.[0] ?? null, geo_manual: false
      }));
  }

  // Dettagli completi del locale scelto (CAP esatto, quartiere, telefono, sito, orari, cucina)
  async function venueDetails(cand) {
    try {
      const res = await fetch(`${NOMI}?format=jsonv2&addressdetails=1&extratags=1&osm_ids=${cand.osm_ref}`,
        { headers: { 'Accept-Language': 'it' } });
      const [h] = res.ok ? await res.json() : [];
      if (!h) return cand;
      const a = h.address || {}, t = h.extratags || {};
      const cucina = (t.cuisine ?? '').split(';').map(c => CUCINA[c.trim()] ?? c.trim().replace(/_/g, ' ')).filter(Boolean).join(', ');
      const via = [a.road, a.house_number].filter(Boolean).join(' ');
      return {
        ...cand,
        indirizzo: via || cand.indirizzo,
        cap: cap(a.postcode) || cand.cap,
        citta: a.city || a.town || a.village || cand.citta,
        zona: a.quarter || a.neighbourhood || cand.zona || zonaDi(a),
        ragione_sociale: t.operator || null,
        cucina: cucina || null,
        orari: t.opening_hours ?? null,
        sito: t.website ?? t['contact:website'] ?? null,
        telefono: t.phone ?? t['contact:phone'] ?? null,
        email: t.email ?? t['contact:email'] ?? null,
        instagram: t['contact:instagram'] ? '@' + t['contact:instagram'].replace(/^.*instagram\.com\//, '').replace(/[/@]/g, '') : null
      };
    } catch { return cand; }
  }

  // Merge nel form: non sovrascrive campi già compilati dall'agente
  // (l'insegna scelta sostituisce il testo parziale digitato)
  const applyCandidate = (form, cand) => {
    const { osm_ref, ...c } = cand;
    return { ...Object.fromEntries(Object.entries({ ...c, ...Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== null && v !== '' && v !== undefined)) })), insegna: c.insegna };
  };

  // ---------- RPC ----------
  const rpc = async (sb, fn, args) => {
    const { data, error } = await sb.schema('crm').rpc(fn, args);
    if (error) throw error;
    return data;
  };
  const iso = d => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);

  // Descrizione del locale generata da un modello con ricerca web (Edge Function Supabase)
  async function describeVenue(sb, c) {
    if (!sb?.functions?.invoke) throw new Error('Descrizione AI non disponibile in questa modalità');
    const { data, error } = await sb.functions.invoke('descrivi-locale', {
      body: {
        nome: c.insegna || c.ragione_sociale, indirizzo: c.indirizzo, citta: c.citta || 'Milano',
        tipologia: c.tipologia, cucina: c.cucina, sito: c.sito, orari: c.orari
      }
    });
    if (error) throw new Error(error.message || 'Errore della funzione descrivi-locale');
    if (data?.error) throw new Error(data.error);
    return data?.descrizione || '';
  }

  return {
    searchVenue, venueDetails, zonaDi, describeVenue,
    applyCandidate,
    trend:      (sb, from, to, { agent = null, grain = 'month' } = {}) =>
                  rpc(sb, 'sales_trend', { p_from: iso(from), p_to: iso(to), p_agent: agent, p_grain: grain }),
    breakdown:  (sb, from, to, dim, { agent = null, limit = 50 } = {}) =>
                  rpc(sb, 'sales_breakdown', { p_from: iso(from), p_to: iso(to), p_dim: dim, p_agent: agent, p_limit: limit }),
    suggest:    (sb, clientId, limit = 10) => rpc(sb, 'suggest_wines', { p_client: clientId, p_limit: limit }),
    reorder:    (sb, giorni = 30, finestra = 90) => rpc(sb, 'reorder_suggestions', { p_giorni: giorni, p_finestra: finestra }),
    toRecall:   sb => rpc(sb, 'clients_to_recall', {}),
    orderHistory: async (sb, clientId) => {
      const { data, error } = await sb.schema('crm').from('orders')
        .select('id, numero, stato, totale, inviato_at, created_at, agent_id, order_items(wine_label, qty, prezzo_unitario, sconto_pct), order_log(da, a, at)')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  };
})();
