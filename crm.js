/* Wine Alchemist CRM — core (auth, router, shell, Home, Clienti)
   Dipendenze: supabase-js v2, crm_map.js, crm_insights.js, crm_client_form.js */
const CRM = (() => {
'use strict';

const CFG = Object.freeze(Object.assign({
  schema: 'crm', nome: 'Wine Alchemist', zona: 'Milano', cartone: 6, mappaCentro: [45.4642, 9.19]
}, window.WA_CONFIG || {}));

const CDN_SUPABASE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
let sb;   // assegnato da start(), dopo il caricamento della libreria

const loadScript = src => new Promise((ok, ko) => {
  const t = document.createElement('script');
  t.src = src; t.async = false;
  t.onload = ok;
  t.onerror = () => ko(new Error('Non riesco a caricare ' + src));
  document.head.appendChild(t);
});
const timeout = (p, ms, msg) => Promise.race([p,
  new Promise((_, ko) => setTimeout(() => ko(new Error(msg)), ms))]);

const S = { me: null, agents: {}, clients: [], view: null, busy: false, filtro: { q: '', set: 'tutti' } };

/* ---------- utilità ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (v == null ? 0 : +v);
const eur = n => (n == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n));
const dmy = d => d ? new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const gg = d => d ? Math.round((Date.now() - new Date(d)) / 864e5) : null;
const ini = s => String(s || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const LBL = {
  prospect: 'Prospect', contattato: 'Contattato', visitato: 'Visitato', trattativa: 'In trattativa',
  attivo: 'Attivo', dormiente: 'Dormiente', perso: 'Perso',
  bozza: 'Bozza', inviato: 'Inviato', confermato: 'Confermato', evaso: 'Evaso', annullato: 'Annullato',
  disponibile: 'Disponibile', limitato: 'Limitato', in_esaurimento: 'In esaurimento', in_arrivo: 'In arrivo',
  su_prenotazione: 'Su prenotazione', assegnazione: 'Assegnazione', esaurito: 'Esaurito',
  anticipato: 'Anticipato (−4%)', bonifico_30: 'Bonifico 30 gg f.m.', riba_60: 'Ri.Ba. 60 gg f.m.',
  ristorante: 'Ristorante', enoteca: 'Enoteca', bar: 'Bar', hotel: 'Hotel', gastronomia: 'Gastronomia', altro: 'Altro'
};
const lbl = k => LBL[k] || k || '—';
const pill = k => `<span class="pill ${esc(k || '')}">${esc(lbl(k))}</span>`;
const ICON = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  clienti: 'M4 9l1.5-5h13L20 9M4 9h16v11H4zM10 20v-5h4v5',
  ordini: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  catalogo: 'M10 2h4v4l1.5 3v12a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V9L10 6zM8.5 13h7',
  mappa: 'M9 4l6 2 6-2v16l-6 2-6-2-6 2V6zM9 4v16M15 6v16',
  analisi: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  cerca: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M21 21l-5-5',
  chev: 'M9 6l6 6-6 6', piu: 'M12 5v14M5 12h14',
  tel: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  chat: 'M4 5h16v11H9l-5 4z', mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  pin: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  star: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'
};
const svg = (k, sz = 20, cls = '') =>
  `<svg class="${cls}" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[k]}"></path></svg>`;

let toastT;
function toast(msg, ms = 2600) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), ms);
}
const err = e => toast(e?.message ? e.message.replace(/^.*?:\s*/, '') : String(e), 4200);
async function go(fn) { try { return await fn(); } catch (e) { console.error(e); err(e); } }

/* ---------- accesso ---------- */
async function boot() {
  const ses = await sb.auth.getSession();
  if (ses.error) throw ses.error;
  const session = ses.data.session;
  sb.auth.onAuthStateChange((_e, s) => { if (!s) { S.me = null; renderLogin(); } });
  if (!session) return renderLogin();
  const { data, error } = await sb.from('agents').select('*').eq('id', session.user.id).maybeSingle();
  if (error) return err(error);
  if (!data) return renderLogin('Utente senza profilo agente. Contatta l\'amministratore.');
  if (!data.attivo) return renderLogin('Profilo non ancora attivato dall\'amministratore.');
  S.me = data;
  const { data: ags } = await sb.from('agents').select('id, nome, colore, ruolo, attivo');
  S.agents = Object.fromEntries((ags || []).map(a => [a.id, a]));
  window.addEventListener('hashchange', route);
  renderShell();
  route();
}

function renderLogin(msg) {
  window.CRM_AVVIATO = true;
  document.title = CFG.nome + ' CRM';
  $('#root').innerHTML = `<div id="login"><form id="lf" novalidate>
    <div class="brand">${esc(CFG.nome)}</div>
    ${msg ? `<div class="empty" style="padding:0 0 6px">${esc(msg)}</div>` : ''}
    <div class="inset">
      <div class="row"><label for="em">Email</label><input id="em" type="email" autocomplete="username" required></div>
      <div class="row"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required></div>
    </div>
    <button class="btn" type="submit">Accedi</button>
    <button class="btn line sm" type="button" id="rst">Password dimenticata</button>
  </form></div>`;
  $('#lf').addEventListener('submit', e => {
    e.preventDefault();
    go(async () => {
      const { error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
      if (error) throw error;
      $('#root').innerHTML = '<div class="spin"></div>';
      await boot();
    });
  });
  $('#rst').addEventListener('click', () => go(async () => {
    const email = $('#em').value.trim();
    if (!email) return toast('Inserisci prima la tua email');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href });
    if (error) throw error;
    toast('Ti abbiamo inviato il link per reimpostare la password');
  }));
}

/* ---------- shell ---------- */
const NAV = [
  ['home', 'Home', '#/home'], ['clienti', 'Clienti', '#/clienti'], ['ordini', 'Ordini', '#/ordini'],
  ['catalogo', 'Catalogo', '#/catalogo'], ['mappa', 'Mappa', '#/mappa'], ['analisi', 'Analisi', '#/analisi']
];
function renderShell() {
  window.CRM_AVVIATO = true;
  $('#root').innerHTML = `<div id="app">
    <aside id="side">
      <div class="brand">${esc(CFG.nome)}</div>
      <nav>${NAV.map(([k, l, h]) =>
        `<a href="${h}" data-nav="${k}">${svg(k, 18)}<span>${l}</span><span class="n" data-n="${k}"></span></a>`).join('')}</nav>
      <div class="me">
        <span class="av round">${esc(ini(S.me.nome))}</span>
        <span><span class="ttl" style="font-size:13px">${esc(S.me.nome)}</span><br>
        <span class="sub">${S.me.ruolo === 'admin' ? 'Amministratore' : 'Agente'}</span></span>
        <button class="btn line sm" id="out" style="margin-left:auto">Esci</button>
      </div>
    </aside>
    <main id="main"></main>
    <nav id="tabbar">${NAV.filter(n => n[0] !== 'analisi').map(([k, l, h]) =>
      `<a href="${h}" data-nav="${k}">${svg(k, 25)}<span>${l}</span></a>`).join('')}</nav>
  </div>`;
  $('#out').addEventListener('click', () => go(async () => { await sb.auth.signOut(); location.hash = ''; renderLogin(); }));
}
const isAdmin = () => S.me?.ruolo === 'admin';
const mine = c => c.agent_id === S.me.id;
const canEdit = c => isAdmin() || mine(c);

function setNav(k) {
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === k));
}
const paint = html => { $('#main').innerHTML = html; window.scrollTo(0, 0); };
const loading = () => paint('<div class="spin"></div>');

/* ---------- router ---------- */
const ROUTES = [];
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  const [seg, ...rest] = h.split('/');
  const r = ROUTES.find(r => r.seg === seg) || ROUTES[0];
  S.view = seg;
  setNav(r.nav || r.seg);
  loading();
  go(() => r.run(rest[0], rest[1]));
}
const addRoute = (seg, run, nav) => ROUTES.push({ seg, run, nav });

/* ---------- Home ---------- */
addRoute('home', async () => {
  const oggi = new Date(), da = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
  const [trend, recall, ordini] = await Promise.all([
    CrmInsights.trend(sb, da, oggi, { grain: 'month' }),
    CrmInsights.toRecall(sb),
    sb.from('orders').select('id, numero, stato, totale, created_at, client_id').order('created_at', { ascending: false }).limit(6)
  ]);
  if (ordini.error) throw ordini.error;
  const t = (trend || [])[0] || {};
  const attesa = (ordini.data || []).filter(o => o.stato === 'inviato').length;
  await ensureClients();
  const nome = c => { const x = S.clients.find(k => k.id === c); return x ? (x.insegna || x.ragione_sociale) : '—'; };
  paint(`
    <div class="bar"><div><div class="sub">${esc(new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
      <h1>Ciao, ${esc(S.me.nome.split(' ')[0])}</h1></div></div>
    <div class="kpis">
      ${kpi('Fatturato mese', eur(t.fatturato || 0), `${t.ordini || 0} ordini confermati`)}
      ${kpi('In attesa', String(attesa), 'ordini inviati da confermare', attesa ? 'orange' : '')}
      ${kpi('Clienti', String(S.clients.filter(c => isAdmin() || mine(c)).length), isAdmin() ? 'in rete' : 'assegnati a te')}
      ${kpi('Da richiamare', String((recall || []).length), 'oltre il ritmo abituale', recall?.length ? 'orange' : '')}
    </div>
    <div class="group"><h3>Da richiamare</h3><div class="inset">
      ${(recall || []).slice(0, 6).map(r => rowLink(`#/cliente/${r.client_id}`, r.nome,
        `Ultimo ordine ${r.giorni} gg fa · ritmo ${Math.round(r.intervallo_medio || 0)} gg`,
        S.agents[r.agent_id] ? `<span class="pill">${esc(S.agents[r.agent_id].nome)}</span>` : '')).join('')
        || '<div class="empty">Nessun cliente in ritardo.</div>'}
    </div></div>
    <div class="group"><h3>Ultimi ordini</h3><div class="inset">
      ${(ordini.data || []).map(o => rowLink(`#/ordine/${o.id}`, o.numero,
        `${nome(o.client_id)} · ${dmy(o.created_at)}`, `<span class="mono">${eur(o.totale)}</span>${pill(o.stato)}`)).join('')
        || '<div class="empty">Nessun ordine.</div>'}
    </div></div>`);
});
const kpi = (l, v, n, tone = '') =>
  `<div class="kpi"><span class="l">${esc(l)}</span><span class="v mono">${esc(v)}</span>
   <span class="n" ${tone === 'orange' ? 'style="color:var(--orange)"' : ''}>${esc(n)}</span></div>`;
const rowLink = (href, ttl, sub, right = '') => `<a href="${href}"><div class="row">
  <span class="av">${esc(ini(ttl))}</span>
  <span style="flex:1;min-width:0"><span class="ttl">${esc(ttl)}</span><br><span class="sub">${esc(sub)}</span></span>
  ${right}${svg('chev', 14, 'chev')}</div></a>`;

/* ---------- Clienti ---------- */
async function ensureClients(force) {
  if (S.clients.length && !force) return S.clients;
  const { data, error } = await sb.from('clients').select('*').order('ragione_sociale');
  if (error) throw error;
  S.clients = data || [];
  return S.clients;
}

addRoute('clienti', async () => {
  await ensureClients(true);
  const draw = () => {
    const q = S.filtro.q.toLowerCase(), set = S.filtro.set;
    const list = S.clients.filter(c => {
      if (set === 'miei' && !mine(c)) return false;
      if (set === 'prospect' && !['prospect', 'contattato', 'trattativa'].includes(c.stato)) return false;
      if (!q) return true;
      return [c.ragione_sociale, c.insegna, c.zona, c.citta, c.stato].join(' ').toLowerCase().includes(q);
    });
    $('#lista').innerHTML = list.map(c => rowLink(`#/cliente/${c.id}`, c.insegna || c.ragione_sociale,
      [lbl(c.tipologia), c.zona || c.citta].filter(Boolean).join(' · '),
      `${pill(c.stato)}<span class="pill">${esc(S.agents[c.agent_id]?.nome?.split(' ')[0] || '—')}</span>`)).join('')
      || '<div class="empty">Nessun cliente con questi filtri.</div>';
    $('#cnt').textContent = list.length + ' clienti';
  };
  paint(`<div class="bar"><h1>Clienti</h1>
      <button class="btn sm" id="nuovo">${svg('piu', 16)} Nuovo</button></div>
    <div class="search">${svg('cerca', 16)}<label class="sr" for="q">Cerca clienti</label>
      <input id="q" type="search" placeholder="Nome, zona, stato" value="${esc(S.filtro.q)}"></div>
    <div class="seg" style="margin:10px 0">
      ${[['tutti', 'Tutti'], ['miei', 'I miei'], ['prospect', 'Da lavorare']].map(([k, l]) =>
        `<button data-set="${k}" class="${S.filtro.set === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="sub" id="cnt" style="padding:2px 4px 8px"></div>
    <div class="inset" id="lista"></div>`);
  $('#q').addEventListener('input', e => { S.filtro.q = e.target.value; draw(); });
  $('.seg').addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    S.filtro.set = b.dataset.set;
    document.querySelectorAll('[data-set]').forEach(x => x.classList.toggle('on', x === b));
    draw();
  });
  $('#nuovo').addEventListener('click', () => (location.hash = '#/cliente/nuovo'));
  draw();
});

addRoute('cliente', async (id) => {
  if (id === 'nuovo') return editCliente(null);
  const [{ data: c, error }, { data: ct }, storico, sugg] = await Promise.all([
    sb.from('clients').select('*').eq('id', id).single(),
    sb.from('client_contacts').select('*').eq('client_id', id).order('principale', { ascending: false }),
    CrmInsights.orderHistory(sb, id),
    CrmInsights.suggest(sb, id, 5).catch(() => [])
  ]);
  if (error) throw error;
  const ed = canEdit(c), ag = S.agents[c.agent_id];
  const bt = o => (o.order_items || []).reduce((a, r) => a + r.qty, 0);
  paint(`
    <div class="bar">
      <a href="#/clienti" class="btn line sm">Clienti</a>
      <span style="flex:1"></span>
      ${ed ? `<button class="btn line sm" id="att">Attività</button>
              <button class="btn line sm" id="mod">Modifica</button>
              <button class="btn sm" id="ord">Nuovo ordine</button>` : '<span class="pill">Sola lettura</span>'}
    </div>
    <div class="row" style="padding:0 4px 12px;border:0;align-items:flex-start">
      <span class="av" style="width:58px;height:58px;border-radius:15px;font-size:19px;background:var(--accent);color:#fff">
        ${esc(ini(c.insegna || c.ragione_sociale))}</span>
      <span style="flex:1;min-width:0">
        <h1 style="font-size:24px">${esc(c.insegna || c.ragione_sociale)}</h1>
        <span class="sub">${esc([lbl(c.tipologia), c.indirizzo, c.zona || c.citta].filter(Boolean).join(' · '))}</span><br>
        <span style="display:inline-flex;gap:6px;margin-top:6px">${pill(c.stato)}
          ${c.priorita ? `<span class="pill">Priorità ${esc(c.priorita)}</span>` : ''}
          <span class="pill">${esc(ag?.nome || '—')}</span></span>
      </span>
    </div>
    <div class="inset" style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--sep)">
      ${[['tel', 'Chiama', c.telefono ? 'tel:' + c.telefono : ''], ['chat', 'WhatsApp', waLink(c, ct)],
         ['pin', 'Mappa', mapsLink(c)], ['mail', 'Email', c.email ? 'mailto:' + c.email : '']]
        .map(([i, l, href]) => `<a href="${href || '#'}" ${href ? '' : 'aria-disabled="true"'}
          style="background:var(--card);min-height:62px;display:flex;flex-direction:column;align-items:center;
          justify-content:center;gap:4px;font-size:12px;font-weight:600;${href ? '' : 'opacity:.4;pointer-events:none'}">
          ${svg(i, 21)}${l}</a>`).join('')}
    </div>
    <div class="group"><h3>Referenti</h3><div class="inset">
      ${(ct || []).map(p => `<div class="row">
        <span class="av round">${esc(ini(p.nome + ' ' + (p.cognome || '')))}</span>
        <span style="flex:1;min-width:0"><span class="ttl">${esc([p.nome, p.cognome].filter(Boolean).join(' '))}</span>
          ${p.principale ? '<span class="pill" style="margin-left:6px">Principale</span>' : ''}<br>
          <span class="sub">${esc([lbl(p.ruolo), p.decisore ? 'decide gli acquisti' : '', p.reperibilita].filter(Boolean).join(' · '))}</span></span>
        ${p.telefono ? `<a class="btn ghost sm" href="tel:${esc(p.telefono)}" aria-label="Chiama ${esc(p.nome)}">${svg('tel', 16)}</a>` : ''}
        ${p.email ? `<a class="btn ghost sm" href="mailto:${esc(p.email)}" aria-label="Email ${esc(p.nome)}">${svg('mail', 16)}</a>` : ''}
      </div>`).join('') || '<div class="empty">Nessun referente registrato.</div>'}
    </div></div>
    <div class="group"><h3>Profilo carta vini</h3><div class="inset">
      ${kv('Fascia', [lbl(c.fascia), c.coperti ? c.coperti + ' coperti' : ''].filter(Boolean).join(' · '))}
      ${kv('Referenze in carta', c.n_referenze_carta)}
      ${kv('Prezzo medio / ricarico', [c.prezzo_medio_carta ? eur(c.prezzo_medio_carta) : null,
           c.ricarico_medio ? c.ricarico_medio + '×' : null].filter(Boolean).join(' · '))}
      ${kv('Al calice', c.vino_calice ? [c.n_etichette_calice ? c.n_etichette_calice + ' etichette' : 'sì', c.sistema_mescita].filter(Boolean).join(' · ') : 'No')}
      ${kv('Visite', c.orari_visita)}${kv('Consegna', c.finestra_consegna)}
      ${kv('Pagamento', c.termini_pagamento)}
      ${chipsRow('Stili e territori', [].concat(c.tipologie_pref || [], c.stili_pref || [], c.regioni_pref || []))}
      ${c.descrizione ? `<div class="row col"><label>Descrizione</label><span>${esc(c.descrizione)}</span></div>` : ''}
    </div></div>
    <div class="group"><h3>${svg('star', 13)} Da proporre</h3><div class="inset">
      ${(sugg || []).map(s => `<div class="row">
        <span style="flex:1;min-width:0"><span class="ttl">${esc(s.label)}</span><br>
        <span class="sub">${esc((s.motivo || '').split(' · ').slice(0, 2).join(' · '))}</span></span>
        <span class="mono">${eur(s.prezzo)}</span>${pill(s.disponibilita)}</div>`).join('')
        || '<div class="empty">Ancora pochi dati per suggerire referenze.</div>'}
    </div></div>
    <div class="group"><h3>Storico ordini</h3><div class="inset">
      ${(storico || []).map(o => `<a href="#/ordine/${o.id}"><div class="row">
        <span style="flex:1;min-width:0"><span class="ttl mono">${esc(o.numero)}</span><br>
        <span class="sub">${dmy(o.inviato_at || o.created_at)} · ${bt(o)} bt · ${(o.order_items || []).length} referenze</span></span>
        <span class="mono">${eur(o.totale)}</span>${pill(o.stato)}${svg('chev', 14, 'chev')}</div></a>`).join('')
        || '<div class="empty">Nessun ordine registrato.</div>'}
    </div></div>`);
  if (ed) {
    $('#mod').addEventListener('click', () => editCliente(c, ct || []));
    $('#ord').addEventListener('click', () => (location.hash = '#/ordine/nuovo/' + c.id));
    $('#att').addEventListener('click', () => nuovaAttivita(c, ct || []));
  }
});
const kv = (k, v) => (v == null || v === '' ? '' :
  `<div class="row"><label>${esc(k)}</label><span class="v">${esc(v)}</span></div>`);
const chipsRow = (k, arr) => (!arr || !arr.length ? '' :
  `<div class="row col"><label>${esc(k)}</label><div class="chips">
   ${arr.map(x => `<span class="chip on">${esc(x)}</span>`).join('')}</div></div>`);
const mapsLink = c => c.lat != null ? `https://maps.apple.com/?daddr=${c.lat},${c.lng}`
  : (c.indirizzo ? `https://maps.apple.com/?daddr=${encodeURIComponent([c.indirizzo, c.cap, c.citta].filter(Boolean).join(' '))}` : '');
function waLink(c, ct) {
  const n = ((ct || []).find(p => p.canale_pref === 'whatsapp' || p.principale) || {}).telefono || c.telefono;
  return n ? 'https://wa.me/' + n.replace(/[^\d+]/g, '').replace(/^\+/, '') : '';
}

/* ---------- scheda cliente: modale di modifica ---------- */
function modal(inner) {
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = `<div>${inner}</div>`;
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
  return el;
}

function editCliente(c, contatti = []) {
  const nuovo = !c;
  const m = modal(`<div class="bar"><h2>${nuovo ? 'Nuovo cliente' : 'Modifica scheda'}</h2>
      <span style="flex:1"></span><button class="btn line sm" data-x>Chiudi</button></div>
    <div id="cf"></div>
    <div id="vs" class="empty hide"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn ghost" id="desc" style="flex:1">Descrizione dal web</button>
      <button class="btn" id="save" style="flex:2">Salva</button>
    </div>`);
  const host = $('#cf', m);
  const draw = (vals, cts) => { host.innerHTML = CrmClientForm.render(vals, cts, { ro: false }); };
  draw(c || {}, contatti);
  m.querySelector('[data-x]').addEventListener('click', () => m.remove());
  CrmClientForm.bind(host, {
    rerender: ({ client, contacts }) => draw(client, contacts),
    onVenueInput: q => go(async () => {
      if (!nuovo || q.trim().length < 3) return;
      const cand = await CrmInsights.searchVenue(q, 6);
      if (!cand.length) return;
      const box = $('#vs', m);
      box.className = 'inset';
      box.innerHTML = `<div class="row"><label>Trovati su OpenStreetMap</label></div>` + cand.map((x, i) =>
        `<button class="row" data-cand="${i}"><span style="flex:1;min-width:0">
          <span class="ttl">${esc(x.insegna)}</span><br><span class="sub">${esc(x.indirizzo || x.citta)}</span></span>
          ${svg('chev', 14, 'chev')}</button>`).join('');
      box.onclick = e => {
        const b = e.target.closest('[data-cand]'); if (!b) return;
        const cur = CrmClientForm.read(host.querySelector('form'));
        draw(CrmClientForm.applyCandidate(cur.client, cand[+b.dataset.cand]), cur.contacts);
        box.className = 'empty hide'; box.innerHTML = '';
      };
    })
  });
  $('#desc', m).addEventListener('click', e => go(async () => {
    const form = host.querySelector('form');
    const cur = CrmClientForm.read(form);
    if (!cur.client.insegna && !cur.client.ragione_sociale) return toast('Scrivi prima il nome del locale');
    e.target.disabled = true; e.target.textContent = 'Sto cercando…';
    try {
      const txt = await CrmInsights.describeVenue(sb, cur.client);
      if (!txt) return toast('Nessuna informazione trovata sul web');
      const ta = form.elements.descrizione;
      ta.value = txt; ta.dispatchEvent(new Event('input', { bubbles: true }));
      toast('Descrizione generata: rileggila prima di salvare');
    } finally { e.target.disabled = false; e.target.textContent = 'Descrizione dal web'; }
  }));

  $('#save', m).addEventListener('click', () => go(async () => {
    const form = host.querySelector('form');
    const payload = CrmClientForm.read(form);
    const errs = CrmClientForm.validate(payload);
    if (errs.length) return toast(errs[0]);
    const btn = $('#save', m); btn.disabled = true;
    try {
      const geo = await CrmMap.geoPatch(payload.client, c || null);
      Object.assign(payload.client, geo);
      if (nuovo) payload.client.agent_id = S.me.id;
      const saved = await CrmClientForm.save(sb, payload, { id: c?.id, prevContactIds: contatti.map(x => x.id) });
      m.remove();
      S.clients = [];
      toast(nuovo ? 'Cliente creato' : 'Scheda aggiornata');
      location.hash = '#/cliente/' + saved.id;
      if (S.view === 'cliente' && c) route();
    } finally { btn.disabled = false; }
  }));
}

/* ---------- attività ---------- */
function nuovaAttivita(c, ct) {
  const m = modal(`<div class="bar"><h2>Registra attività</h2><span style="flex:1"></span>
      <button class="btn line sm" data-x>Chiudi</button></div>
    <div class="inset">
      <div class="row"><label for="at">Tipo</label><select id="at">
        ${['visita', 'chiamata', 'degustazione', 'email', 'nota'].map(t => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
      </select></div>
      <div class="row"><label for="ac">Con</label><select id="ac"><option value="">—</option>
        ${(ct || []).map(p => `<option value="${p.id}">${esc([p.nome, p.cognome].filter(Boolean).join(' '))} · ${esc(lbl(p.ruolo))}</option>`).join('')}
      </select></div>
      <div class="row"><label for="as">Stato dopo</label><select id="as"><option value="">Non cambiare</option>
        ${['contattato', 'visitato', 'trattativa', 'attivo', 'dormiente', 'perso'].map(s => `<option value="${s}">${lbl(s)}</option>`).join('')}
      </select></div>
      <div class="row"><label for="af">Follow-up</label><input id="af" type="date"></div>
      <div class="row col"><label for="ae">Esito</label><textarea id="ae" rows="3"></textarea></div>
    </div>
    <button class="btn" id="asave" style="width:100%;margin-top:14px">Salva attività</button>`);
  m.querySelector('[data-x]').addEventListener('click', () => m.remove());
  $('#asave', m).addEventListener('click', () => go(async () => {
    const { error } = await sb.from('activities').insert({
      client_id: c.id, agent_id: S.me.id, tipo: $('#at', m).value,
      contact_id: $('#ac', m).value || null, stato_dopo: $('#as', m).value || null,
      follow_up_at: $('#af', m).value || null, esito: $('#ae', m).value.trim() || null
    });
    if (error) throw error;
    m.remove(); toast('Attività registrata'); S.clients = []; route();
  }));
}

/* ---------- Mappa ---------- */
const STATI = ['prospect', 'contattato', 'visitato', 'trattativa', 'attivo', 'dormiente', 'perso'];
addRoute('mappa', async () => {
  await ensureClients(true);
  const f = { stati: new Set(), soloMiei: false };
  paint(`<div class="bar"><h1>Mappa</h1><span style="flex:1"></span>
      <button class="btn line sm" id="geo">Trova indirizzi mancanti</button></div>
    <div class="chips" style="margin-bottom:10px" id="fil">
      ${STATI.map(s => `<button class="chip" data-st="${s}">
        <span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${CrmMap.STATUS[s]};margin-right:5px"></span>
        ${lbl(s)}</button>`).join('')}
      <button class="chip" data-miei>Solo i miei</button></div>
    <div style="position:relative;height:min(62vh,560px);min-height:320px;border-radius:var(--r);overflow:hidden">
      <div id="map"></div></div>
    <div class="group hide" id="sel"></div>
    <div class="sub" id="cnt" style="padding:8px 4px"></div>`);

  const M = CrmMap.create($('#map'));
  setTimeout(() => M.map.invalidateSize(), 60);

  const mostra = c => {
    const box = $('#sel'), ag = S.agents[c.agent_id];
    box.classList.remove('hide');
    box.innerHTML = `<div class="inset"><div class="row">
      <span class="av">${esc(ini(c.insegna || c.ragione_sociale))}</span>
      <span style="flex:1;min-width:0"><span class="ttl">${esc(c.insegna || c.ragione_sociale)}</span><br>
        <span class="sub">${esc([lbl(c.tipologia), c.indirizzo, ag?.nome].filter(Boolean).join(' · '))}</span></span>
      ${pill(c.stato)}</div>
      <div class="row" style="gap:8px">
        <a class="btn sm" style="flex:1" href="#/cliente/${c.id}">Apri scheda</a>
        <a class="btn ghost sm" style="flex:1" href="${mapsLink(c)}" target="_blank" rel="noopener">Indicazioni</a>
      </div></div>`;
  };

  const draw = () => {
    const list = S.clients.filter(c => !f.soloMiei || mine(c));
    CrmMap.render(M, list, S.agents, {
      stati: f.stati, meId: S.me.id, isAdmin: isAdmin(), onOpen: mostra,
      onMove: (c, ll) => go(async () => {
        const { error } = await sb.from('clients')
          .update({ lat: ll.lat, lng: ll.lng, geo_manual: true }).eq('id', c.id);
        if (error) throw error;
        Object.assign(c, { lat: ll.lat, lng: ll.lng, geo_manual: true });
        toast('Posizione aggiornata');
      })
    });
    const vis = list.filter(c => c.lat != null && (!f.stati.size || f.stati.has(c.stato))).length;
    const senza = S.clients.filter(c => c.lat == null && c.indirizzo).length;
    $('#cnt').textContent = `${vis} locali sulla mappa` +
      (senza ? ` · ${senza} senza coordinate` : '') +
      ' · trascina il segnaposto per correggere la posizione';
  };
  draw();

  $('#fil').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.st !== undefined) { f.stati.has(b.dataset.st) ? f.stati.delete(b.dataset.st) : f.stati.add(b.dataset.st); }
    else f.soloMiei = !f.soloMiei;
    b.classList.toggle('on');
    draw();
  });
  $('#geo').addEventListener('click', e => go(async () => {
    const da = S.clients.filter(c => c.lat == null && c.indirizzo && canEdit(c));
    if (!da.length) return toast('Tutti i locali hanno già le coordinate');
    e.target.disabled = true;
    try {
      await CrmMap.geocodeMissing(sb, da, (i, n) => { e.target.textContent = `Ricerca ${i}/${n}…`; });
      await ensureClients(true);
      draw();
      toast('Indirizzi aggiornati');
    } finally { e.target.disabled = false; e.target.textContent = 'Trova indirizzi mancanti'; }
  }));
});

/* ---------- Catalogo ---------- */
const TIPI = ['rosso', 'bianco', 'rosato', 'bollicine', 'champagne', 'macerato', 'rifermentato', 'accessorio'];
const CSVCOLS = ['codice', 'produttore', 'nome', 'annata', 'tipologia', 'formato_cl', 'regione', 'nazione',
  'zona_produzione', 'esclusiva', 'vendibile_milano', 'disponibilita', 'prezzo_listino', 'no_sconto',
  'max_per_cliente', 'linea', 'stili', 'in_inventario'];

function parseCSV(txt) {
  const out = []; let row = [], v = '', q = false;
  txt = txt.replace(/^\uFEFF/, '');
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { v += '"'; i++; } else q = false; }
      else v += c;
    } else if (c === '"') q = true;
    else if (c === ';') { row.push(v); v = ''; }
    else if (c === '\n') { row.push(v); out.push(row); row = []; v = ''; }
    else if (c !== '\r') v += c;
  }
  if (v || row.length) { row.push(v); out.push(row); }
  return out.filter(r => r.some(x => x !== ''));
}
function csvToWines(txt) {
  const [head, ...righe] = parseCSV(txt);
  const idx = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  const manca = CSVCOLS.filter(c => !(c in idx));
  if (manca.length) throw new Error('Colonne mancanti nel CSV: ' + manca.join(', '));
  const val = (r, c) => (r[idx[c]] ?? '').trim();
  return righe.map(r => ({
    codice: val(r, 'codice'), produttore: val(r, 'produttore'), nome: val(r, 'nome'),
    annata: val(r, 'annata') || null, tipologia: val(r, 'tipologia'), formato_cl: +val(r, 'formato_cl') || 0,
    regione: val(r, 'regione') || null, nazione: val(r, 'nazione') || null,
    zona_produzione: val(r, 'zona_produzione') || null, esclusiva: val(r, 'esclusiva') || null,
    vendibile_milano: val(r, 'vendibile_milano') === 'SI',
    disponibilita: val(r, 'disponibilita') || 'disponibile',
    prezzo_listino: val(r, 'prezzo_listino') ? +val(r, 'prezzo_listino').replace('.', '').replace(',', '.') : null,
    no_sconto: val(r, 'no_sconto') === 'SI',
    max_per_cliente: val(r, 'max_per_cliente') ? +val(r, 'max_per_cliente') : null,
    linea: val(r, 'linea') || null,
    stili: val(r, 'stili') ? val(r, 'stili').split('|').filter(Boolean) : [],
    in_inventario: val(r, 'in_inventario') === 'SI'
  })).filter(w => w.codice && w.produttore);
}

addRoute('catalogo', async () => {
  const [{ data: wines, error }, { data: stock }] = await Promise.all([
    sb.from('wines').select('*').order('produttore').order('nome'),
    sb.rpc('stock')
  ]);
  if (error) throw error;
  const ST = Object.fromEntries((stock || []).map(s => [s.wine_id, s]));
  const f = { q: '', tipo: '', set: 'inventario' };

  const disegna = () => {
    const q = f.q.toLowerCase();
    const list = (wines || []).filter(w => {
      if (f.tipo && w.tipologia !== f.tipo) return false;
      if (f.set === 'inventario' && !w.in_inventario) return false;
      if (f.set === 'fuori' && w.in_inventario) return false;
      if (f.set === 'giacenza' && !w.gestione_giacenza) return false;
      if (!q) return true;
      return [w.produttore, w.nome, w.annata, w.regione, w.zona_produzione].join(' ').toLowerCase().includes(q);
    });
    $('#cnt').textContent = `${list.length} referenze · ${(wines || []).filter(w => w.in_inventario).length} in inventario`;
    $('#lista').innerHTML = list.slice(0, 400).map(w => {
      const s = ST[w.id] || {};
      return `<button class="row" data-w="${w.id}">
        <span style="flex:1;min-width:0">
          <span class="ttl">${esc(w.nome)}${w.annata ? ' <span class="sub">' + esc(w.annata) + '</span>' : ''}</span><br>
          <span class="sub">${esc([w.produttore, w.formato_cl ? w.formato_cl + ' cl' : null, w.regione].filter(Boolean).join(' · '))}</span>
          ${w.no_sconto ? '<span class="pill" style="margin-top:4px;display:inline-block">No sconto</span>' : ''}
          ${!w.vendibile_milano ? '<span class="pill perso" style="margin-top:4px;display:inline-block">Fuori zona</span>' : ''}
          ${w.gestione_giacenza ? `<span class="pill" style="margin-top:4px;display:inline-block">Giacenza ${s.disponibile ?? 0}</span>` : ''}
        </span>
        <span class="mono">${eur(w.prezzo_listino)}</span>
        ${pill(w.disponibilita)}
        <span class="pill ${w.in_inventario ? 'attivo' : ''}">${w.in_inventario ? 'In inventario' : 'Escluso'}</span>
      </button>`;
    }).join('') || '<div class="empty">Nessuna referenza con questi filtri.</div>';
    if (list.length > 400) $('#lista').insertAdjacentHTML('beforeend',
      '<div class="empty">Mostrate le prime 400: restringi la ricerca.</div>');
  };

  paint(`<div class="bar"><h1>Catalogo</h1><span style="flex:1"></span>
      ${isAdmin() ? `<button class="btn line sm" id="imp">Importa CSV</button>
        <input type="file" id="file" accept=".csv,text/csv" class="hide">` : ''}</div>
    <div class="search">${svg('cerca', 16)}<label class="sr" for="q">Cerca nel catalogo</label>
      <input id="q" type="search" placeholder="Produttore, vino, regione"></div>
    <div class="seg" style="margin:10px 0">
      ${[['inventario', 'In inventario'], ['tutte', 'Tutte'], ['fuori', 'Escluse'], ['giacenza', 'A giacenza']]
        .map(([k, l]) => `<button data-set="${k}" class="${f.set === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="chips" style="margin-bottom:10px" id="tipi">
      ${TIPI.map(t => `<button class="chip" data-tipo="${t}">${t}</button>`).join('')}</div>
    <div class="sub" id="cnt" style="padding:2px 4px 8px"></div>
    <div class="inset" id="lista"></div>`);

  $('#q').addEventListener('input', e => { f.q = e.target.value; disegna(); });
  $('.seg').addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    f.set = b.dataset.set;
    document.querySelectorAll('[data-set]').forEach(x => x.classList.toggle('on', x === b));
    disegna();
  });
  $('#tipi').addEventListener('click', e => {
    const b = e.target.closest('[data-tipo]'); if (!b) return;
    f.tipo = f.tipo === b.dataset.tipo ? '' : b.dataset.tipo;
    document.querySelectorAll('[data-tipo]').forEach(x => x.classList.toggle('on', x.dataset.tipo === f.tipo));
    disegna();
  });
  $('#lista').addEventListener('click', e => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    const w = wines.find(x => x.id === b.dataset.w);
    schedaVino(w, ST[w.id], () => { disegna(); });
  });
  if (isAdmin()) {
    $('#imp').addEventListener('click', () => $('#file').click());
    $('#file').addEventListener('change', e => go(async () => {
      const file = e.target.files[0]; if (!file) return;
      const btn = $('#imp'); btn.disabled = true;
      try {
        const righe = csvToWines(await file.text());
        btn.textContent = `0/${righe.length}`;
        let n = 0;
        for (let i = 0; i < righe.length; i += 100) {
          const blocco = righe.slice(i, i + 100);
          const { error } = await sb.from('wines').upsert(blocco, { onConflict: 'codice' });
          if (error) throw error;
          n += blocco.length; btn.textContent = `${n}/${righe.length}`;
        }
        toast(`Importate ${n} referenze`);
        route();
      } finally { btn.disabled = false; btn.textContent = 'Importa CSV'; e.target.value = ''; }
    }));
  }
  disegna();
});

function schedaVino(w, s, done) {
  const admin = isAdmin();
  const m = modal(`<div class="bar"><h2 style="font-size:19px">${esc(w.nome)}</h2><span style="flex:1"></span>
      <button class="btn line sm" data-x>Chiudi</button></div>
    <div class="sub" style="margin:-8px 0 12px">${esc([w.produttore, w.annata, w.formato_cl ? w.formato_cl + ' cl' : null,
      w.zona_produzione, w.regione].filter(Boolean).join(' · '))}</div>
    <div class="inset">
      ${kv('Prezzo di listino', eur(w.prezzo_listino))}
      ${kv('Disponibilità', lbl(w.disponibilita))}
      ${kv('Esclusiva', w.esclusiva)}
      ${kv('Vendibile su ' + CFG.zona, w.vendibile_milano ? 'Sì' : 'No')}
      ${kv('Sconti', w.no_sconto ? 'Non ammessi' : (w.disponibilita === 'assegnazione' ? 'Non ammessi (assegnazione)' : 'Ammessi'))}
      ${kv('Massimo per cliente', w.max_per_cliente)}
      ${kv('Linea', w.linea)}
      ${w.gestione_giacenza ? kv('Giacenza', `${s?.giacenza ?? 0} · impegnate ${s?.impegnato ?? 0} · libere ${s?.disponibile ?? 0}`) : ''}
      ${chipsRow('Stili', w.stili)}
    </div>
    ${admin ? `<div class="group"><h3>Impostazioni</h3><div class="inset">
      <div class="row"><label for="inv">In inventario</label>
        <input id="inv" type="checkbox" ${w.in_inventario ? 'checked' : ''}></div>
      <div class="row"><label for="gg">Gestisci giacenza</label>
        <input id="gg" type="checkbox" ${w.gestione_giacenza ? 'checked' : ''}></div>
      <div class="row"><label for="sm">Scorta minima</label>
        <input id="sm" type="number" min="0" value="${w.scorta_min ?? 0}"></div>
      <div class="row"><label for="lt">Giorni di consegna</label>
        <input id="lt" type="number" min="0" value="${w.lead_time_gg ?? 14}"></div>
      <div class="row"><label for="pm">Prezzo minimo</label>
        <input id="pm" type="number" step="0.01" min="0" value="${w.prezzo_min ?? ''}"></div>
      <div class="row"><label for="ca">Carico bottiglie</label>
        <input id="ca" type="number" step="1" placeholder="0"></div>
    </div></div>
    <button class="btn" id="sv" style="width:100%">Salva</button>` : ''}`);
  m.querySelector('[data-x]').addEventListener('click', () => m.remove());
  if (!admin) return;
  $('#sv', m).addEventListener('click', () => go(async () => {
    const patch = {
      in_inventario: $('#inv', m).checked, gestione_giacenza: $('#gg', m).checked,
      scorta_min: +$('#sm', m).value || 0, lead_time_gg: +$('#lt', m).value || 14,
      prezzo_min: $('#pm', m).value === '' ? null : +$('#pm', m).value
    };
    const { error } = await sb.from('wines').update(patch).eq('id', w.id);
    if (error) throw error;
    const carico = +$('#ca', m).value;
    if (carico) {
      const r = await sb.from('stock_movements').insert({ wine_id: w.id, tipo: 'carico', qty: carico, nota: 'Carico manuale' });
      if (r.error) throw r.error;
    }
    Object.assign(w, patch);
    m.remove(); toast('Referenza aggiornata'); done && done();
  }));
}

/* ---------- Ordini ---------- */
const STATI_ORD = [['', 'Tutti'], ['bozza', 'Bozze'], ['inviato', 'Inviati'], ['confermato', 'Confermati'], ['evaso', 'Evasi']];
const nomeCli = id => { const c = S.clients.find(x => x.id === id); return c ? (c.insegna || c.ragione_sociale) : '—'; };

function pickCliente(cb) {
  const list = S.clients.filter(c => isAdmin() || mine(c));
  const m = modal(`<div class="bar"><h2>Per quale cliente?</h2><span style="flex:1"></span>
      <button class="btn line sm" data-x>Chiudi</button></div>
    <div class="search">${svg('cerca', 16)}<label class="sr" for="pq">Cerca cliente</label>
      <input id="pq" type="search" placeholder="Nome del locale"></div>
    <div class="inset" id="pl" style="margin-top:10px"></div>`);
  const draw = (q = '') => {
    $('#pl', m).innerHTML = list.filter(c => (c.insegna || c.ragione_sociale).toLowerCase().includes(q.toLowerCase()))
      .slice(0, 60).map(c => `<button class="row" data-c="${c.id}">
        <span class="av">${esc(ini(c.insegna || c.ragione_sociale))}</span>
        <span style="flex:1;min-width:0"><span class="ttl">${esc(c.insegna || c.ragione_sociale)}</span><br>
          <span class="sub">${esc([lbl(c.tipologia), c.zona].filter(Boolean).join(' · '))}</span></span>
        ${pill(c.stato)}</button>`).join('') || '<div class="empty">Nessun cliente.</div>';
  };
  draw();
  m.querySelector('[data-x]').addEventListener('click', () => m.remove());
  $('#pq', m).addEventListener('input', e => draw(e.target.value));
  $('#pl', m).addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    m.remove(); cb(list.find(c => c.id === b.dataset.c));
  });
}

addRoute('ordini', async () => {
  await ensureClients();
  const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  const f = { stato: '', q: '' };
  const draw = () => {
    const list = (data || []).filter(o => (!f.stato || o.stato === f.stato) &&
      (!f.q || (o.numero + ' ' + nomeCli(o.client_id)).toLowerCase().includes(f.q.toLowerCase())));
    $('#lista').innerHTML = list.map(o => `<a href="#/ordine/${o.id}"><div class="row">
      <span style="flex:1;min-width:0"><span class="ttl mono">${esc(o.numero)}</span><br>
        <span class="sub">${esc(nomeCli(o.client_id))} · ${dmy(o.inviato_at || o.created_at)}
        ${o.scade_at ? ' · scade ' + dmy(o.scade_at) : ''}</span></span>
      <span class="mono">${eur(o.totale)}</span>${pill(o.stato)}${svg('chev', 14, 'chev')}</div></a>`).join('')
      || '<div class="empty">Nessun ordine.</div>';
    $('#cnt').textContent = `${list.length} ordini · ${eur(list.reduce((a, o) => a + num(o.totale), 0))}`;
  };
  paint(`<div class="bar"><h1>Ordini</h1><span style="flex:1"></span>
      <button class="btn sm" id="new">${svg('piu', 16)} Nuovo</button></div>
    <div class="search">${svg('cerca', 16)}<label class="sr" for="q">Cerca ordini</label>
      <input id="q" type="search" placeholder="Numero o cliente"></div>
    <div class="seg" style="margin:10px 0">${STATI_ORD.map(([k, l]) =>
      `<button data-st="${k}" class="${f.stato === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="sub" id="cnt" style="padding:2px 4px 8px"></div>
    <div class="inset" id="lista"></div>`);
  $('#q').addEventListener('input', e => { f.q = e.target.value; draw(); });
  $('.seg').addEventListener('click', e => {
    const b = e.target.closest('[data-st]'); if (!b) return;
    f.stato = b.dataset.st;
    document.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('on', x === b));
    draw();
  });
  $('#new').addEventListener('click', () => pickCliente(c => (location.hash = '#/ordine/nuovo/' + c.id)));
  draw();
});

addRoute('ordine', async (id, extra) => {
  await ensureClients();
  if (id === 'nuovo') {
    if (!extra) { paint('<div class="empty">Scegli il cliente…</div>'); return pickCliente(c => (location.hash = '#/ordine/nuovo/' + c.id)); }
    const { data, error } = await sb.from('orders')
      .insert({ client_id: extra, agent_id: S.me.id, pagamento: 'anticipato' }).select().single();
    if (error) throw error;
    location.replace('#/ordine/' + data.id);
    return;
  }
  const [{ data: o, error }, { data: rows }, { data: ws }, { data: stock }] = await Promise.all([
    sb.from('orders').select('*').eq('id', id).single(),
    sb.from('order_items').select('*').eq('order_id', id),
    sb.from('wines').select('*').eq('in_inventario', true).order('produttore'),
    sb.rpc('stock')
  ]);
  if (error) throw error;
  const cli = S.clients.find(c => c.id === o.client_id) || {};
  const ST = Object.fromEntries((stock || []).map(s => [s.wine_id, s]));
  const catalogo = (ws || []).filter(w => ST[w.id]?.vendibile);
  const items = new Map((rows || []).map(i => [i.wine_id, i]));
  const editabile = o.stato === 'bozza' && (isAdmin() || o.agent_id === S.me.id);
  const passo = w => (w.formato_cl >= 150 || w.tipologia === 'accessorio' ? 1 : (CFG.cartone || 6));
  const f = { q: '', tipo: '' };

  async function setQty(w, q) {
    const it = items.get(w.id);
    if (q <= 0 && it) {
      const r = await sb.from('order_items').delete().eq('id', it.id);
      if (r.error) throw r.error;
      items.delete(w.id);
    } else if (it) {
      const r = await sb.from('order_items').update({ qty: q }).eq('id', it.id);
      if (r.error) throw r.error;
      it.qty = q;
    } else if (q > 0) {
      const r = await sb.from('order_items').insert({ order_id: o.id, wine_id: w.id, qty: q }).select().single();
      if (r.error) throw r.error;
      items.set(w.id, r.data);
    }
    const fresh = await sb.from('orders').select('*').eq('id', o.id).single();
    if (fresh.data) Object.assign(o, fresh.data);
    render();
  }

  const rigaVino = w => {
    const it = items.get(w.id), q = it ? it.qty : 0, s = ST[w.id] || {};
    const disp = w.gestione_giacenza ? `Libere ${s.disponibile ?? 0}` : lbl(w.disponibilita);
    const tono = w.gestione_giacenza && s.disponibile <= 12 ? 'var(--orange)' : 'var(--fg2)';
    return `<div class="row" style="${q ? 'background:var(--accent-tint)' : ''}">
      <span style="flex:1;min-width:0">
        <span class="ttl" style="font-size:15px">${esc(w.nome)}${w.annata ? ' ' + esc(w.annata) : ''}</span><br>
        <span class="sub">${esc([w.produttore, w.formato_cl ? w.formato_cl + ' cl' : null].filter(Boolean).join(' · '))}</span><br>
        <span class="sub mono" style="font-weight:600">${eur(w.prezzo_listino)}
          <span style="color:${tono}">· ${esc(disp)}</span>
          ${w.no_sconto || w.disponibilita === 'assegnazione' ? '· no sconto' : ''}</span></span>
      ${editabile ? `<span class="step">
        <button data-dec="${w.id}" aria-label="Togli" ${q ? '' : 'disabled'}>−</button>
        <span class="q">${q}</span>
        <button data-inc="${w.id}" aria-label="Aggiungi">+</button></span>`
        : `<span class="mono">${q} bt</span>`}
    </div>`;
  };

  function render() {
    const scelti = catalogo.filter(w => items.has(w.id));
    const q = f.q.toLowerCase();
    const resto = editabile ? catalogo.filter(w => !items.has(w.id) &&
      (!f.tipo || w.tipologia === f.tipo) &&
      (!q || [w.produttore, w.nome, w.annata, w.regione].join(' ').toLowerCase().includes(q))) : [];
    const bt = [...items.values()].reduce((a, i) => a + i.qty, 0);
    const azioni = [];
    if (editabile) azioni.push(['inviato', 'Invia ordine', 'btn']);
    if (isAdmin() && o.stato === 'inviato') azioni.push(['confermato', 'Conferma', 'btn'], ['annullato', 'Annulla', 'btn ghost']);
    if (isAdmin() && o.stato === 'confermato') azioni.push(['evaso', 'Segna evaso', 'btn']);

    paint(`<div class="bar"><a href="#/ordini" class="btn line sm">Ordini</a><span style="flex:1"></span>
        <button class="btn line sm" id="share">Condividi</button>${pill(o.stato)}</div>
      <h1 class="mono" style="font-size:22px">${esc(o.numero)}</h1>
      <div class="inset" style="margin-top:12px">
        <a href="#/cliente/${cli.id}"><div class="row">
          <span class="av">${esc(ini(cli.insegna || cli.ragione_sociale || '?'))}</span>
          <span style="flex:1;min-width:0"><span class="ttl">${esc(cli.insegna || cli.ragione_sociale || '—')}</span><br>
            <span class="sub">${esc([cli.indirizzo, cli.finestra_consegna ? 'consegna ' + cli.finestra_consegna : null].filter(Boolean).join(' · '))}</span></span>
          ${svg('chev', 14, 'chev')}</div></a>
        <div class="row"><label for="pag">Pagamento</label>
          <select id="pag" ${editabile ? '' : 'disabled'}>
            ${['anticipato', 'bonifico_30', 'riba_60'].map(p =>
              `<option value="${p}" ${o.pagamento === p ? 'selected' : ''}>${lbl(p)}</option>`).join('')}
          </select></div>
        ${o.scade_at ? kv('Prenotazione valida fino al', dmy(o.scade_at)) : ''}
      </div>

      <div class="group"><h3>Nel carrello${bt ? ' · ' + bt + ' bottiglie' : ''}</h3><div class="inset">
        ${scelti.map(rigaVino).join('') || '<div class="empty">Nessuna referenza. Aggiungile qui sotto.</div>'}
      </div></div>

      ${editabile ? `<div class="group"><h3>Catalogo</h3>
        <div class="search">${svg('cerca', 16)}<label class="sr" for="cq">Cerca referenze</label>
          <input id="cq" type="search" placeholder="Produttore, vino, regione" value="${esc(f.q)}"></div>
        <div class="chips" style="margin:8px 0" id="tipi">
          ${TIPI.filter(t => t !== 'accessorio').map(t =>
            `<button class="chip ${f.tipo === t ? 'on' : ''}" data-tipo="${t}">${t}</button>`).join('')}</div>
        <div class="inset">${resto.slice(0, 80).map(rigaVino).join('') || '<div class="empty">Nessuna referenza.</div>'}
        ${resto.length > 80 ? '<div class="empty">Mostrate le prime 80: affina la ricerca.</div>' : ''}</div>
      </div>` : ''}

      <div class="group"><h3>Riepilogo</h3><div class="inset">
        ${kv('Imponibile', eur(o.imponibile))}
        ${o.sconto_pagamento ? kv('Sconto pagamento anticipato', '− ' + eur(o.sconto_pagamento)) : ''}
        ${o.omaggio_bt ? kv('Sconto merce', `${o.omaggio_bt} bt omaggio · ${esc(items.get(o.omaggio_wine_id)?.wine_label || '')}`) : ''}
        ${kv('Trasporto', o.porto_franco ? 'Porto franco' : `Sotto i ${eur(400)}: trasporto a carico del cliente`)}
        <div class="row"><label>Totale</label><span class="v mono" style="font-size:19px;font-weight:700;color:var(--fg)">${eur(o.totale)}</span></div>
      </div></div>
      ${azioni.length ? `<div class="sheet">
        <span style="flex:1"><span class="sub">${bt} bt · ${items.size} referenze</span><br>
          <span class="mono" style="font-size:20px;font-weight:700">${eur(o.totale)}</span></span>
        ${azioni.map(([st, l, c]) => `<button class="${c}" data-go="${st}">${l}</button>`).join('')}
      </div>` : ''}`);

    $('#pag').addEventListener('change', e => go(async () => {
      const r = await sb.from('orders').update({ pagamento: e.target.value }).eq('id', o.id).select().single();
      if (r.error) throw r.error;
      Object.assign(o, r.data); render();
    }));
    const cq = $('#cq');
    if (cq) {
      if (f.q) { cq.focus(); cq.setSelectionRange(f.q.length, f.q.length); }
      cq.addEventListener('input', e => { f.q = e.target.value; render(); });
      $('#tipi').addEventListener('click', e => {
        const b = e.target.closest('[data-tipo]'); if (!b) return;
        f.tipo = f.tipo === b.dataset.tipo ? '' : b.dataset.tipo; render();
      });
    }
    $('#main').onclick = e => {                 // assegnazione: non accumula listener a ogni render
      const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
      if (!inc && !dec) return;
      const w = catalogo.find(x => x.id === (inc || dec).dataset[inc ? 'inc' : 'dec']);
      const cur = items.get(w.id)?.qty || 0;
      go(() => setQty(w, cur + (inc ? passo(w) : -passo(w))));
    };
    $('#share').addEventListener('click', () => condividi(o, [...items.values()], cli));
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(async () => {
      b.disabled = true;
      try {
        const r = await sb.from('orders').update({ stato: b.dataset.go }).eq('id', o.id).select().single();
        if (r.error) throw r.error;
        toast('Ordine ' + lbl(b.dataset.go).toLowerCase());
        route();
      } finally { b.disabled = false; }
    })));
  }
  render();
}, 'ordini');

function testoOrdine(o, items, cli) {
  return [
    `${CFG.nome} · ordine ${o.numero}`,
    `Cliente: ${cli.insegna || cli.ragione_sociale || '—'}`,
    '',
    ...items.map(i => `${i.qty} bt · ${i.wine_label} · ${eur(i.prezzo_unitario)}`),
    '',
    `Imponibile: ${eur(o.imponibile)}`,
    o.sconto_pagamento ? `Sconto anticipato: − ${eur(o.sconto_pagamento)}` : '',
    o.omaggio_bt ? `Sconto merce: ${o.omaggio_bt} bt in omaggio` : '',
    `Totale (iva escl.): ${eur(o.totale)}`,
    o.porto_franco ? 'Porto franco' : 'Trasporto a carico del cliente',
    `Pagamento: ${lbl(o.pagamento)}`
  ].filter(Boolean).join('\n');
}
async function condividi(o, items, cli) {
  const text = testoOrdine(o, items, cli);
  if (navigator.share) { try { return await navigator.share({ title: o.numero, text }); } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Ordine copiato negli appunti'); }
  catch (e) { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); }
}

/* ---------- Analisi ---------- */
const PERIODI = [['mese', 'Mese', 0], ['trim', 'Trimestre', 2], ['anno', '12 mesi', 11]];
addRoute('analisi', async () => {
  const per = S.per || 'anno', agente = S.agente || null;
  const mesi = (PERIODI.find(p => p[0] === per) || PERIODI[2])[2];
  const oggi = new Date(), da = new Date(oggi.getFullYear(), oggi.getMonth() - mesi, 1);
  const [trend, top, perAgente, perZona, riordini, recall] = await Promise.all([
    CrmInsights.trend(sb, da, oggi, { agent: agente, grain: 'month' }),
    CrmInsights.breakdown(sb, da, oggi, 'wine', { agent: agente, limit: 8 }),
    isAdmin() ? CrmInsights.breakdown(sb, da, oggi, 'agent', { agent: agente, limit: 10 }) : [],
    CrmInsights.breakdown(sb, da, oggi, 'zona', { agent: agente, limit: 8 }),
    CrmInsights.reorder(sb).catch(() => []),
    CrmInsights.toRecall(sb)
  ]);
  const tot = (trend || []).reduce((a, t) => ({
    f: a.f + num(t.fatturato), o: a.o + num(t.ordini), b: a.b + num(t.bottiglie)
  }), { f: 0, o: 0, b: 0 });
  const clienti = new Set((perZona || []).map(z => z.chiave)).size;
  const max = Math.max(1, ...(trend || []).map(t => num(t.fatturato)));
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

  const classifica = (titolo, arr, unita = 'bt') => `<div class="group"><h3>${titolo}</h3><div class="inset">
    ${(arr || []).map((r, i) => `<div class="row">
      <span class="sub" style="width:18px">${i + 1}</span>
      <span style="flex:1;min-width:0"><span class="ttl" style="font-size:15px">${esc(r.label || r.chiave)}</span></span>
      <span class="sub mono">${r.bottiglie} ${unita}</span>
      <span class="mono" style="font-weight:600">${eur(r.fatturato)}</span></div>`).join('')
      || '<div class="empty">Nessun dato nel periodo.</div>'}</div></div>`;

  paint(`<div class="bar"><h1>Analisi</h1></div>
    <div class="seg" style="margin-bottom:12px">${PERIODI.map(([k, l]) =>
      `<button data-per="${k}" class="${per === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${isAdmin() ? `<div class="row inset" style="margin-bottom:12px"><label for="ag">Agente</label>
      <select id="ag"><option value="">Tutta la rete</option>
        ${Object.values(S.agents).filter(a => a.ruolo === 'agent').map(a =>
          `<option value="${a.id}" ${agente === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}
      </select></div>` : ''}
    <div class="kpis">
      ${kpi('Fatturato', eur(tot.f), `${mesi + 1} mesi`)}
      ${kpi('Ordini', String(tot.o), tot.o ? 'medio ' + eur(tot.f / tot.o) : '—')}
      ${kpi('Bottiglie', String(tot.b), tot.b ? eur(tot.f / tot.b) + ' / bt' : '—')}
      ${kpi('Zone servite', String(clienti), 'con ordini nel periodo')}
    </div>
    <div class="card" style="margin-top:14px">
      <h3 style="margin-bottom:12px">Fatturato per mese</h3>
      <div style="display:flex;align-items:flex-end;gap:6px;height:170px;border-bottom:1px solid var(--sep)">
        ${(trend || []).map(t => {
          const d = new Date(t.periodo);
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%">
            <span class="sub mono" style="font-size:10px">${Math.round(num(t.fatturato) / 100) / 10}k</span>
            <div style="width:100%;max-width:38px;height:${Math.round(num(t.fatturato) / max * 130)}px;
              background:var(--accent);opacity:${d.getMonth() === oggi.getMonth() ? 1 : .45};border-radius:6px 6px 0 0"></div>
            <span class="sub" style="font-size:10px">${MESI[d.getMonth()]}</span></div>`;
        }).join('') || '<div class="empty" style="flex:1">Nessuna vendita nel periodo.</div>'}
      </div>
    </div>
    ${classifica('Referenze più vendute', top)}
    ${isAdmin() ? classifica('Per agente', perAgente) : ''}
    ${classifica('Per zona', perZona)}
    <div class="group"><h3>Da riordinare</h3><div class="inset">
      ${(riordini || []).slice(0, 10).map(r => `<div class="row">
        <span style="flex:1;min-width:0"><span class="ttl" style="font-size:15px">${esc(r.label)}</span><br>
          <span class="sub">${r.copertura_gg != null ? 'copertura ' + r.copertura_gg + ' gg' : 'nessuna rotazione'} · libere ${r.disponibile}</span></span>
        <span class="mono" style="font-weight:600">${r.qty_suggerita} bt</span>
        <span class="pill ${r.urgenza === 'esaurito' ? 'perso' : r.urgenza === 'riordina' ? 'trattativa' : ''}">${esc(r.urgenza)}</span>
      </div>`).join('') || '<div class="empty">Nessuna referenza a giacenza gestita da riordinare.</div>'}
    </div></div>
    <div class="group"><h3>Clienti da richiamare</h3><div class="inset">
      ${(recall || []).slice(0, 10).map(r => rowLink(`#/cliente/${r.client_id}`, r.nome,
        `${r.giorni} gg dall'ultimo ordine · ritmo ${Math.round(r.intervallo_medio || 0)} gg`,
        `<span class="pill">${r.ordini} ordini</span>`)).join('') || '<div class="empty">Nessuno in ritardo.</div>'}
    </div></div>`);

  $('.seg').addEventListener('click', e => {
    const b = e.target.closest('[data-per]'); if (!b) return;
    S.per = b.dataset.per; route();
  });
  const ag = $('#ag');
  if (ag) ag.addEventListener('change', e => { S.agente = e.target.value || null; route(); });
});

/* ---------- avvio ---------- */
function fatal(e, dettaglio) {
  window.CRM_AVVIATO = true;
  document.getElementById('root').innerHTML = `<div id="login"><div style="max-width:380px">
    <div class="brand" style="text-align:center">${esc(CFG.nome)}</div>
    <div class="inset" style="margin-top:16px;padding:16px">
      <div class="ttl" style="margin-bottom:6px">L'app non è riuscita ad avviarsi</div>
      <div class="sub">${esc(e?.message || String(e))}</div>
      ${dettaglio ? `<div class="sub" style="margin-top:8px">${esc(dettaglio)}</div>` : ''}
    </div>
    <button class="btn" style="width:100%;margin-top:14px" onclick="location.reload()">Riprova</button>
  </div></div>`;
  console.error('[WA CRM]', e);
}

async function start() {
  try {
    if (!window.supabase) {
      await timeout(loadScript(CFG.demo ? 'crm_demo.js' : CDN_SUPABASE), 20000,
        'Libreria non caricata: connessione assente o bloccata');
    }
    if (!window.supabase || !window.supabase.createClient) throw new Error('Libreria Supabase non disponibile');
    if (!CFG.demo && (!CFG.supabaseUrl || /TUO-PROGETTO|TUA-ANON/.test(CFG.supabaseUrl + CFG.supabaseKey))) {
      throw new Error('URL o chiave Supabase non configurati in index.html');
    }
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
      db: { schema: CFG.schema }, auth: { persistSession: true, autoRefreshToken: true }
    });
    await timeout(boot(), 25000, 'Il server non risponde: controlla la connessione');
  } catch (e) {
    fatal(e, CFG.demo ? 'Modalità demo: serve il file crm_demo.js accanto a index.html.'
                      : 'Progetto: ' + (CFG.supabaseUrl || '—'));
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

return { sb, CFG, S, go, toast, paint, loading, svg, esc, eur, dmy, gg, ini, lbl, pill, kpi, rowLink, kv,
         modal, addRoute, route, ensureClients, isAdmin, mine, canEdit, err };
})();
