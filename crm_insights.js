// Ricerca locale (OpenStreetMap / Overpass, gratuito) + wrapper RPC analytics
const CrmInsights = (() => {
  const BBOX = '45.33,8.95,45.60,9.40'; // Milano + hinterland
  const OVERPASS = 'https://overpass-api.de/api/interpreter';

  const TIPO = {
    restaurant: 'ristorante', fast_food: 'ristorante', bar: 'bar', pub: 'bar', cafe: 'bar',
    wine_bar: 'enoteca', wine: 'enoteca', alcohol: 'enoteca', hotel: 'hotel',
    deli: 'gastronomia', delicatessen: 'gastronomia'
  };
  const LABEL = {
    ristorante: 'Ristorante', bar: 'Bar', enoteca: 'Enoteca / wine bar',
    hotel: 'Hotel', gastronomia: 'Gastronomia', altro: 'Locale'
  };
  const CUCINA = {
    italian: 'italiana', pizza: 'pizza', regional: 'regionale', seafood: 'di pesce', japanese: 'giapponese',
    sushi: 'sushi', chinese: 'cinese', french: 'francese', spanish: 'spagnola', mexican: 'messicana',
    indian: 'indiana', burger: 'burger', steak_house: 'carne alla griglia', vegetarian: 'vegetariana',
    vegan: 'vegana', mediterranean: 'mediterranea', fusion: 'fusion', lombard: 'lombarda',
    milanese: 'milanese', coffee_shop: 'caffetteria', tapas: 'tapas', greek: 'greca', thai: 'thailandese'
  };

  const reEsc = s => s.replace(/[\\.^$|?*+()[\]{}"]/g, '\\$&');

  function toCandidate(el) {
    const t = el.tags ?? {};
    const tipologia = TIPO[t.amenity] ?? TIPO[t.shop] ?? TIPO[t.tourism] ?? 'altro';
    const via = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
    const citta = t['addr:city'] ?? 'Milano';
    const cucina = (t.cuisine ?? '').split(';').map(c => CUCINA[c.trim()] ?? c.trim().replace(/_/g, ' '))
      .filter(Boolean).join(', ');
    const extra = [
      t.outdoor_seating === 'yes' && 'posti all\'aperto',
      t.reservation === 'required' && 'prenotazione obbligatoria',
      t.reservation === 'yes' && 'accetta prenotazioni',
      t.takeaway === 'yes' && 'asporto',
      t['diet:vegan'] === 'yes' && 'opzioni vegane',
      t['drink:wine'] === 'yes' && 'selezione vini'
    ].filter(Boolean);

    const descrizione = [
      `${LABEL[tipologia]}${cucina ? ` di cucina ${cucina}` : ''}${via ? `, ${via}` : ''} (${citta}).`,
      t.description,
      extra.length && `Servizi: ${extra.join(', ')}.`,
      t.opening_hours && `Orari: ${t.opening_hours}.`
    ].filter(Boolean).join(' ');

    return {
      osm_ref: `${el.type}/${el.id}`,
      insegna: t.name,
      ragione_sociale: t.operator || t.name,
      tipologia,
      indirizzo: via || null,
      cap: t['addr:postcode'] ?? null,
      citta,
      lat: el.lat ?? el.center?.lat ?? null,
      lng: el.lon ?? el.center?.lon ?? null,
      geo_manual: false,
      cucina: cucina || null,
      orari: t.opening_hours ?? null,
      sito: t.website ?? t['contact:website'] ?? null,
      telefono: t.phone ?? t['contact:phone'] ?? null,
      email: t.email ?? t['contact:email'] ?? null,
      descrizione
    };
  }

  // Autocomplete nome locale: debounce >= 600 ms lato UI, min 3 caratteri
  let ctrl;
  async function searchVenue(name, limit = 8) {
    const q = name.trim();
    if (q.length < 3) return [];
    ctrl?.abort();
    ctrl = new AbortController();
    const rx = reEsc(q);
    const query = `[out:json][timeout:12];(
      nwr["name"~"${rx}",i]["amenity"~"^(restaurant|bar|pub|cafe|wine_bar|fast_food)$"](${BBOX});
      nwr["name"~"${rx}",i]["shop"~"^(wine|alcohol|deli)$"](${BBOX});
      nwr["name"~"${rx}",i]["tourism"="hotel"](${BBOX});
    );out center tags ${limit};`;
    const res = await fetch(OVERPASS, {
      method: 'POST', body: new URLSearchParams({ data: query }), signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const { elements = [] } = await res.json();
    return elements.filter(e => e.tags?.name).map(toCandidate);
  }

  // Merge nel form: non sovrascrive campi già compilati dall'agente
  const applyCandidate = (form, cand) =>
    Object.fromEntries(Object.entries({ ...cand, ...Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== null && v !== '' && v !== undefined)) }));

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
    searchVenue, describeVenue,
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
