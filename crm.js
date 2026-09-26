/* Wine Alchemist CRM — core (auth, router, shell, Home, Clienti)
   Dipendenze: supabase-js v2, crm_map.js, crm_insights.js, crm_client_form.js */
const CRM = (() => {
'use strict';

const CFG = Object.freeze(Object.assign({
  schema: 'crm', nome: 'Wine Alchemist', zona: 'Milano', cartone: 6, mappaCentro: [45.4642, 9.19]
}, window.WA_CONFIG || {}));

const CDN_SUPABASE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
let sb;   // assegnato da start(), dopo il caricamento della libreria

const fase = t => { const r = document.getElementById('root');
  if (r) r.innerHTML = '<div class="spin"></div><div class="empty" style="padding-top:0">' + t + '</div>'; };

const loadScript = src => new Promise((ok, ko) => {
  const t = document.createElement('script');
  t.src = src; t.async = false;
  t.onload = ok;
  t.onerror = () => ko(new Error('Non riesco a caricare ' + src));
  document.head.appendChild(t);
});
const timeout = (p, ms, msg) => Promise.race([p,
  new Promise((_, ko) => setTimeout(() => ko(new Error(msg)), ms))]);

const S = { me: null, agents: {}, clients: [], view: null, busy: false, filtro: { q: '', set: 'tutti', agente: '', stato: '', sort: 'nome' }, anim: false };

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
  anticipato: 'Anticipato (−4%)', bonifico_30: 'Bonifico 30 gg f.m.', riba_60: 'Ri.Ba. 60 gg f.m.', riba_90_fm: 'Ri.Ba. 90 gg f.m.',
  ristorante: 'Ristorante', enoteca: 'Enoteca', bar: 'Bar', hotel: 'Hotel', gastronomia: 'Gastronomia', altro: 'Altro'
};
const lbl = k => LBL[k] || k || '—';
const isRiba = p => String(p || '').startsWith('riba_');
const pill = k => `<span class="pill ${esc(k || '')}">${esc(lbl(k))}</span>`;
const inPromo = w => num(w?.promo_pct) > 0;
const prezzoBase = w => w.prezzo_listino == null ? null
  : inPromo(w) ? Math.round(num(w.prezzo_listino) * (100 - num(w.promo_pct))) / 100 : num(w.prezzo_listino);
const prezzoHtml = w => inPromo(w)
  ? `<s class="was">${eur(w.prezzo_listino)}</s> <span class="promo">Prezzo promo ${eur(prezzoBase(w))}</span>` : eur(w.prezzo_listino);
const tipoDoc = o => o?.tipo === 'prenotazione' ? 'Prenotazione' : o?.tipo === 'campionatura' ? 'Campionatura' : 'Ordine';
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
  chat: 'M4 5h16v11H9l-5 4z', provvigioni: 'M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10.5h9M4 13.5h9', matita: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', scarica: 'M12 4v11M7 10l5 5 5-5M5 20h14', tema: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  cart: 'M3 4h2.5l2.3 11.2h10.4L21 8H6.6M9.5 20.2h.01M17.5 20.2h.01', cal: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5', doc: 'M7 3h8l4 4v14H7zM15 3v4h4M10 13h6M10 17h4',
  rifai: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5', mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
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
  fase('Verifico l\'accesso…');
  let session = null;
  try {
    const ses = await timeout(sb.auth.getSession(), 8000, 'sessione');
    if (ses.error) throw ses.error;
    session = ses.data.session;
  } catch (e) {
    console.warn('[WA CRM] sessione non leggibile:', e);
    try { await sb.auth.signOut({ scope: 'local' }); } catch (e2) {}
    return renderLogin('Sessione non leggibile: accedi di nuovo.');
  }
  sb.auth.onAuthStateChange((_e, s) => { if (!s) { S.me = null; renderLogin(); } });
  if (!session) return renderLogin();
  fase('Carico il profilo…');
  const { data, error } = await timeout(
    sb.from('agents').select('*').eq('id', session.user.id).maybeSingle(), 12000, 'Il database non risponde');
  if (error) return err(error);
  if (!data) return renderLogin('Utente senza profilo agente. Contatta l\'amministratore.');
  if (!data.attivo) return renderLogin('Profilo non ancora attivato dall\'amministratore.');
  S.me = data;
  const { data: ags } = await sb.from('agents').select('id, nome, colore, ruolo, attivo, provvigioni, dettaglio_visibile_a');
  S.agents = Object.fromEntries((ags || []).map(a => [a.id, a]));
  window.addEventListener('hashchange', route);
  renderShell();
  route();
  feedLive();
  sb.from('feed').select('id', { count: 'exact', head: true }).gt('created_at', new Date(feedSeen()).toISOString())
    .then(({ count }) => { if (S.view !== 'home' && count) feedBadge(count); }, () => {});
}

function renderLogin(msg) {
  window.CRM_AVVIATO = true; hideSplash();
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
      const b = $('#lf').querySelector('button[type=submit]');
      b.disabled = true; b.textContent = 'Accesso…';
      try {
        const { error } = await timeout(
          sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value }),
          15000, 'Il server non risponde: riprova');
        if (error) throw error;
      } finally { b.disabled = false; b.textContent = 'Accedi'; }
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
  ['catalogo', 'Catalogo', '#/catalogo'], ['mappa', 'Mappa', '#/mappa'], ['analisi', 'Analisi', '#/analisi'],
  ['provvigioni', 'Provvigioni', '#/provvigioni']
];
function renderShell() {
  window.CRM_AVVIATO = true; hideSplash();
  $('#root').innerHTML = `<div id="app">
    <aside id="side">
      <div class="brand">${esc(CFG.nome)}</div>
      <nav>${NAV.filter(n => n[0] !== 'provvigioni' || S.me.provvigioni).map(([k, l, h]) =>
        `<a href="${h}" data-nav="${k}">${svg(k, 18)}<span>${l}</span><span class="n" data-n="${k}"></span></a>`).join('')}</nav>
      ${temaBtn()}
      <div class="me">
        <span class="av round">${esc(ini(S.me.nome))}</span>
        <span><span class="ttl" style="font-size:13px">${esc(S.me.nome)}</span><br>
        <span class="sub">${S.me.ruolo === 'admin' ? 'Amministratore' : S.me.ruolo === 'viewer' ? 'Direzione' : 'Agente'}</span></span>
        <button class="btn line sm" id="out" style="margin-left:auto">Esci</button>
      </div>
    </aside>
    <main id="main"></main>
    <nav id="tabbar">${NAV.filter(n => n[0] !== 'provvigioni').map(([k, l, h]) =>
      `<a href="${h}" data-nav="${k}">${svg(k, 25)}<span>${l}</span></a>`).join('')}</nav>
  </div>`;
  document.addEventListener('click', e => { if (e.target.id === 'out2') $('#out').click(); });
  $('#out').addEventListener('click', () => go(async () => { await sb.auth.signOut(); location.hash = ''; renderLogin(); }));
}
const isAdmin = () => S.me?.ruolo === 'admin';
function hideSplash() {
  const sp = document.getElementById('splash'); if (!sp || sp.classList.contains('out')) return;
  setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 500); }, 350);
}
const TEMI = [['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']];
const temaCorrente = () => { try { return localStorage.getItem('wa-theme') || 'auto'; } catch (e) { return 'auto'; } };
function applicaTema(t) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { t === 'auto' ? localStorage.removeItem('wa-theme') : localStorage.setItem('wa-theme', t); } catch (e) {}
  document.querySelectorAll('[data-tema-lbl]').forEach(el => (el.textContent = TEMI.find(x => x[0] === t)[1]));
}
document.addEventListener('click', e => {
  if (!e.target.closest('.theme-btn')) return;
  const i = TEMI.findIndex(x => x[0] === temaCorrente());
  applicaTema(TEMI[(i + 1) % TEMI.length][0]);
});
const temaBtn = (cls = '') => `<button class="btn line sm theme-btn ${cls}" type="button" aria-label="Cambia tema">${svg('tema', 15)}
  <span data-tema-lbl>${TEMI.find(x => x[0] === temaCorrente())[1]}</span></button>`;
const isViewer = () => S.me?.ruolo === 'viewer';
const mine = c => c.agent_id === S.me.id;
const canEdit = c => isAdmin() || mine(c);
const canOrder = c => isAdmin() || isViewer() || mine(c);
const PROSPECT = ['prospect', 'contattato', 'visitato', 'trattativa'];
const scadeProspect = c => { const d = new Date(c.assegnato_at); d.setMonth(d.getMonth() + 3); return d.toISOString(); };

function setNav(k) {
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === k));
}
const paint = html => {
  const m = $('#main'); m.innerHTML = html; window.scrollTo(0, 0);
  if (S.anim) { S.anim = false; m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter'); countUp(m); }
};
function countUp(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.querySelectorAll('.kpi .v').forEach(el => {
    const txt = el.textContent.trim(), m = txt.match(/^([\d.]+(?:,\d+)?)(\s*€)?$/);
    if (!m) return;
    const val = parseFloat(m[1].replace(/\./g, '').replace(',', '.')); if (!val) return;
    const money = !!m[2], dur = 900, t0 = performance.now();
    const fmt = v => money ? eur(v) : Math.round(v).toLocaleString('it-IT');
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(val * e); if (k < 1) requestAnimationFrame(step); else el.textContent = txt; };
    requestAnimationFrame(step);
  });
}
const loading = () => paint(`<div class="sk sk-t"></div>
  ${S.view === 'home' || S.view === 'analisi' ? '<div class="sk-k"><div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>' : '<div class="sk" style="height:42px;margin-bottom:14px"></div>'}
  <div class="sk-l">${'<div class="sk-r"><span class="sk a"></span><span class="b"><i class="sk" style="width:55%"></i><i class="sk" style="width:35%"></i></span></div>'.repeat(6)}</div>`);

/* ---------- router ---------- */
const ROUTES = [];
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  const [seg, ...rest] = h.split('/');
  const r = ROUTES.find(r => r.seg === seg) || ROUTES[0];
  S.view = seg;
  setNav(r.nav || r.seg);
  loading();
  S.anim = true;
  go(() => r.run(rest[0], rest[1]));
}
const addRoute = (seg, run, nav) => ROUTES.push({ seg, run, nav });

/* ---------- Home ---------- */
addRoute('home', async () => {
  const oggi = new Date(), da = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
  const da6 = new Date(oggi.getFullYear(), oggi.getMonth() - 5, 1);
  const [trend6, recall, ordini, { data: prom }, { data: feed }] = await Promise.all([
    CrmInsights.trend(sb, da6, oggi, { grain: 'month' }).catch(() => []),
    CrmInsights.toRecall(sb),
    sb.from('v_ordini').select('*').order('created_at', { ascending: false }).limit(6),
    (() => { let q = sb.from('reminders').select('*').eq('fatto', false)
      .lte('due_at', new Date(Date.now() + 7 * 864e5).toISOString()).order('due_at').limit(20);
      return q; })(),
    sb.from('feed').select('*').order('created_at', { ascending: false }).limit(40)
  ]);
  if (ordini.error) throw ordini.error;
  const mesi = [...Array(6)].map((_, i) => { const d = new Date(oggi.getFullYear(), oggi.getMonth() - 5 + i, 1);
    const r = (trend6 || []).find(x => { const p = new Date(x.periodo); return p.getFullYear() === d.getFullYear() && p.getMonth() === d.getMonth(); });
    return { d, v: num(r?.fatturato), r }; });
  const t = mesi[5].r || {}, maxM = Math.max(1, ...mesi.map(m => m.v));
  const spark = `<div class="spark" title="Fatturato ultimi 6 mesi">${mesi.map((m, i) =>
    `<i class="${i === 5 ? 'cur' : ''}" style="height:${Math.max(8, Math.round(m.v / maxM * 100))}%;animation-delay:${i * 50}ms"
      title="${m.d.toLocaleDateString('it-IT', { month: 'short' })}: ${eur(m.v)}"></i>`).join('')}</div>`;
  const attesa = (ordini.data || []).filter(o => o.stato === 'inviato').length;
  await ensureClients();
  const nome = c => { const x = S.clients.find(k => k.id === c); return x ? (x.insegna || x.ragione_sociale) : '—'; };
  paint(`
    <div class="bar"><div><div class="sub">${esc(new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
      <h1>Ciao, ${esc(S.me.nome.split(' ')[0])}</h1></div><span style="flex:1"></span>
      <span class="hide-desktop" style="display:flex;gap:8px">${temaBtn()}<button class="btn line sm" id="out2">Esci</button></span></div>
    <div class="kpis">
      ${kpi('Fatturato mese', eur(t.fatturato || 0), `${t.ordini || 0} ordini confermati`, '', spark)}
      ${kpi('In attesa', String(attesa), 'ordini inviati da confermare', attesa ? 'orange' : '')}
      ${kpi('Clienti', String(S.clients.length), isAdmin() || isViewer() ? 'in rete' : `in rete · ${S.clients.filter(mine).length} tuoi`)}
      ${kpi('Da richiamare', String((recall || []).length), 'oltre il ritmo abituale', recall?.length ? 'orange' : '')}
    </div>
    ${S.me.provvigioni ? `<a href="#/provvigioni" class="hide-desktop"><div class="inset" style="margin-top:12px"><div class="row">
      ${svg('provvigioni', 20)}<span style="flex:1"><span class="ttl" style="font-size:15px">Le mie provvigioni</span></span>${svg('chev', 14, 'chev')}</div></div></a>` : ''}
    <div class="group"><h3>Promemoria · prossimi 7 giorni</h3><div class="inset" id="promList">
      ${(prom || []).map(r => rigaProm(r, true)).join('') || '<div class="empty">Niente in agenda. Aggiungi promemoria e appuntamenti dalla scheda cliente.</div>'}
    </div></div>
    <div class="group"><h3>Attività</h3><div class="inset" id="feedList">${feedHtml(feed || [])}</div></div>
    <div class="group"><h3>Da richiamare</h3><div class="inset">
      ${(recall || []).slice(0, 6).map(r => rowLink(`#/cliente/${r.client_id}`, r.nome,
        `Ultimo ordine ${r.giorni} gg fa · ritmo ${Math.round(r.intervallo_medio || 0)} gg`,
        S.agents[r.agent_id] ? `<span class="pill">${esc(S.agents[r.agent_id].nome)}</span>` : '', true, S.agents[r.agent_id]?.colore)).join('')
        || '<div class="empty">Nessun cliente in ritardo.</div>'}
    </div></div>
    <div class="group"><h3>Ultimi ordini</h3><div class="inset">
      ${(ordini.data || []).map(o => rowLink(`#/ordine/${o.id}`, o.numero,
        `${nome(o.client_id)} · ${dmy(o.created_at)}${S.agents[o.agent_id] && innerWidth < 720 ? ' · ' + S.agents[o.agent_id].nome : ''}`, `${S.agents[o.agent_id] ? `<span class="pill hide-m"><i class="dot-ag" style="--ac:${S.agents[o.agent_id].colore}"></i>${esc(S.agents[o.agent_id].nome)}</span>` : ''}${o.dettaglio ? `<span class="mono">${eur(o.totale)}</span>` : '<span class="pill" title="Dettaglio riservato all\'agente">🔒 riservato</span>'}${pill(o.stato)}`, false)).join('')
        || '<div class="empty">Nessun ordine.</div>'}
    </div></div>`);
  bindProm($('#promList'), prom);
  bindFeed();
});

/* ---------- Attività del team (crm.feed, alimentata da trigger) ---------- */
const FEED_VIS = 8;
const feedKey = () => 'wa-feed-seen-' + S.me.id;
const feedSeen = () => { try { return +localStorage.getItem(feedKey()) || Date.now(); } catch (e) { return Date.now(); } };
const quando = d => { const m = Math.round((Date.now() - new Date(d)) / 6e4);
  if (m < 1) return 'ora'; if (m < 60) return m + ' min fa'; if (m < 24 * 60 && new Date(d).getDate() === new Date().getDate()) return Math.round(m / 60) + ' h fa';
  const ieri = new Date(); ieri.setDate(ieri.getDate() - 1);
  return new Date(d).toDateString() === ieri.toDateString() ? 'ieri, ' + hm(d) : dmy(d); };
const agNome = id => S.agents[id]?.nome || '';
function feedTesto(f) {
  const chi = agNome(f.actor_id), da = chi ? ' da ' + chi : '';
  switch (f.tipo) {
    case 'nuovo': return 'Nuovo cliente aggiunto' + da;
    case 'import': return 'Importati' + da;
    case 'preso': return 'Preso in carico' + da;
    case 'liberato': return f.actor_id ? 'Rilasciato' + da : 'Tornato libero, prospect scaduto';
    case 'prenotazione_scaduta': return 'Prenotazione scaduta, bottiglie liberate' + (f.meta?.numero ? ' · ' + f.meta.numero : '');
    case 'primo_ordine': return (f.meta?.tipo === 'prenotazione' ? 'Prima prenotazione inviata' : 'Primo ordine inviato') + (f.meta?.numero ? ' · ' + f.meta.numero : '') + (chi ? ' · ' + chi : '');
    case 'stato':
      if (f.a === 'attivo') return (PROSPECT.includes(f.da) ? 'Convertito in cliente' : 'Tornato attivo') + (chi ? ' · ' + chi : '');
      if (f.a === 'perso') return 'Segnato come perso' + da;
      if (f.a === 'dormiente') return 'Diventato dormiente' + (chi ? ' · ' + chi : '');
      return 'Passato a ' + lbl(f.a).toLowerCase() + (chi ? ' · ' + chi : '');
  }
  return lbl(f.tipo);
}
function rigaFeed(f, seen) {
  const c = S.clients.find(k => k.id === f.client_id);
  const imp = f.tipo === 'import';
  const ttl = imp ? `${f.n} nuovi clienti` : (c ? c.insegna || c.ragione_sociale : 'Cliente rimosso');
  const href = f.meta?.order_id ? `#/ordine/${f.meta.order_id}` : imp ? '#/clienti' : c ? `#/cliente/${c.id}` : '';
  const destra = f.tipo === 'stato' || f.tipo === 'nuovo' ? pill(f.a) : '';
  const col = S.agents[f.actor_id]?.colore;
  const nuovo = new Date(f.created_at).getTime() > seen;
  const body = `<div class="row feed${nuovo ? ' new' : ''}">
    <span class="av${col ? ' ag' : ''}" ${col ? `style="--ac:${col}"` : ''}>${imp ? esc(String(f.n)) : esc(ini(ttl))}</span>
    <span style="flex:1;min-width:0"><span class="ttl" style="font-size:15px">${esc(ttl)}</span><br>
      <span class="sub">${esc(feedTesto(f))} · ${esc(quando(f.created_at))}</span></span>
    ${destra}${href ? svg('chev', 14, 'chev') : ''}</div>`;
  return href ? `<a href="${href}" data-f="${f.id}">${body}</a>` : `<div data-f="${f.id}">${body}</div>`;
}
function feedHtml(feed) {
  if (!feed.length) return '<div class="empty">Nessuna attività recente.</div>';
  const seen = feedSeen();
  return feed.map((f, i) => i < FEED_VIS ? rigaFeed(f, seen) : rigaFeed(f, seen).replace(/^<(a|div) /, '<$1 hidden ')).join('')
    + (feed.length > FEED_VIS ? `<button class="row" id="feedMore" style="justify-content:center;color:var(--accent);font-weight:600">Mostra altre ${feed.length - FEED_VIS}</button>` : '');
}
function bindFeed() {
  $('#feedMore')?.addEventListener('click', e => {
    $('#feedList').querySelectorAll('[data-f][hidden]').forEach(el => el.hidden = false); e.currentTarget.remove(); });
  try { localStorage.setItem(feedKey(), Date.now()); } catch (e) {}
  feedBadge(0);
}
let feedNuovi = 0;
function feedBadge(n) {
  feedNuovi = n;
  document.querySelectorAll('[data-n="home"]').forEach(el => (el.textContent = n ? String(n) : ''));
}
function feedLive() {
  sb.channel('crm-feed').on('postgres_changes', { event: 'INSERT', schema: CFG.schema, table: 'feed' }, async ({ new: f }) => {
    if (f.tipo === 'nuovo' || f.tipo === 'import' || !S.clients.find(k => k.id === f.client_id)) await ensureClients(true).catch(() => {});
    const box = $('#feedList');
    if (S.view === 'home' && box) {
      box.querySelector('.empty')?.remove();
      box.insertAdjacentHTML('afterbegin', rigaFeed(f, 0));
      try { localStorage.setItem(feedKey(), Date.now()); } catch (e) {}
    } else feedBadge(feedNuovi + 1);
  }).subscribe();
}
const kpi = (l, v, n, tone = '', extra = '') =>
  `<div class="kpi"><span class="l">${esc(l)}</span><span class="v mono">${esc(v)}</span>
   <span class="n" ${tone === 'orange' ? 'style="color:var(--orange)"' : ''}>${esc(n)}</span>${extra}</div>`;
const rowLink = (href, ttl, sub, right = '', av = true, col = '') => `<a href="${href}"><div class="row">
  ${av ? `<span class="av${col ? ' ag' : ''}" ${col ? `style="--ac:${col}"` : ''}>${esc(ini(ttl))}</span>` : ''}
  <span style="flex:1;min-width:0"><span class="ttl${av ? '' : ' mono'}">${esc(ttl)}</span><br><span class="sub">${esc(sub)}</span></span>
  ${right}${svg('chev', 14, 'chev')}</div></a>`;

/* ---------- Clienti ---------- */
async function ensureClients(force) {
  if (S.clients.length && !force) return S.clients;
  await sb.rpc('libera_prospect_scaduti').then(() => {}, () => {}); // prospect non convertiti da 3 mesi tornano liberi
  const { data, error } = await sb.from('clients').select('*').order('ragione_sociale');
  if (error) throw error;
  S.clients = data || [];
  return S.clients;
}

addRoute('clienti', async () => {
  await ensureClients(true);
  const { data: ords } = await sb.from('v_ordini').select('client_id, created_at').neq('stato', 'annullato');
  const last = {};
  (ords || []).forEach(o => { if (!last[o.client_id] || o.created_at > last[o.client_id]) last[o.client_id] = o.created_at; });
  const F = S.filtro;
  const draw = () => {
    const q = F.q.toLowerCase(), set = F.set;
    const list = S.clients.filter(c => {
      if (F.agente && c.agent_id !== F.agente) return false;
      if (F.stato && c.stato !== F.stato) return false;
      if (set === 'miei' && !mine(c)) return false;
      if (set === 'prospect' && !['prospect', 'contattato', 'trattativa'].includes(c.stato)) return false;
      if (!q) return true;
      return [c.ragione_sociale, c.insegna, c.zona, c.citta, c.stato].join(' ').toLowerCase().includes(q);
    });
    const nm = c => (c.insegna || c.ragione_sociale || '').toLowerCase();
    if (F.sort === 'ordine') list.sort((a, b) => (last[b.id] || '').localeCompare(last[a.id] || '') || nm(a).localeCompare(nm(b)));
    else if (F.sort === 'recenti') list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    else list.sort((a, b) => nm(a).localeCompare(nm(b), 'it'));
    $('#lista').innerHTML = list.map(c => rowLink(`#/cliente/${c.id}`, c.insegna || c.ragione_sociale,
      [lbl(c.tipologia), c.zona || c.citta, F.sort === 'ordine' ? (last[c.id] ? 'ultimo ordine ' + dmy(last[c.id]) : 'mai ordinato') : null].filter(Boolean).join(' · '),
      `<span class="tags">${pill(c.stato)}<span class="pill"><i class="dot-ag" style="--ac:${S.agents[c.agent_id]?.colore || 'var(--fg3)'}"></i>${esc(S.agents[c.agent_id]?.nome?.split(' ')[0] || (c.agent_id ? '—' : 'Libero'))}</span></span>`,
      true, S.agents[c.agent_id]?.colore)).join('')
      || '<div class="empty">Nessun cliente con questi filtri.</div>';
    $('#cnt').textContent = list.length + ' clienti';
  };
  paint(`<div class="bar"><h1>Clienti</h1><span style="flex:1"></span>
      ${isViewer() ? '' : `<button class="btn sm" id="nuovo">${svg('piu', 16)} Nuovo</button>`}</div>
    <div class="search">${svg('cerca', 16)}<label class="sr" for="q">Cerca clienti</label>
      <input id="q" type="search" placeholder="Nome, zona, stato" value="${esc(S.filtro.q)}"></div>
    <div class="seg" style="margin:10px 0">
      ${[['tutti', 'Tutti'], ['miei', 'I miei'], ['prospect', 'Da lavorare']].map(([k, l]) =>
        `<button data-set="${k}" class="${S.filtro.set === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="filtri">
      <select id="fAg" aria-label="Agente"><option value="">Tutti gli agenti</option>
        ${Object.values(S.agents).filter(a => a.attivo && a.ruolo !== 'viewer').map(a =>
          `<option value="${a.id}" ${F.agente === a.id ? 'selected' : ''}>${esc(a.nome)}</option>`).join('')}</select>
      <select id="fSt" aria-label="Stato"><option value="">Tutti gli stati</option>
        ${STATI.map(x => `<option value="${x}" ${F.stato === x ? 'selected' : ''}>${lbl(x)}</option>`).join('')}</select>
      <select id="fSo" aria-label="Ordina per">
        ${[['nome', 'Nome A–Z'], ['ordine', 'Ultimo ordine'], ['recenti', 'Inseriti di recente']].map(([k, l]) =>
          `<option value="${k}" ${F.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="sub" id="cnt" style="padding:2px 4px 8px"></div>
    <div class="inset" id="lista"></div>`);
  $('#q').addEventListener('input', e => { S.filtro.q = e.target.value; draw(); });
  [['#fAg', 'agente'], ['#fSt', 'stato'], ['#fSo', 'sort']].forEach(([id, k]) =>
    $(id).addEventListener('change', e => { F[k] = e.target.value; draw(); }));
  $('.seg').addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    S.filtro.set = b.dataset.set;
    document.querySelectorAll('[data-set]').forEach(x => x.classList.toggle('on', x === b));
    draw();
  });
  $('#nuovo')?.addEventListener('click', () => (location.hash = '#/cliente/nuovo'));
  draw();
});

addRoute('cliente', async (id) => {
  if (id === 'nuovo') return editCliente(null);
  const [{ data: c, error }, { data: ct }, storico, sugg, { data: prom }, { data: diario }, { data: storicoAltrove }] = await Promise.all([
    sb.from('clients').select('*').eq('id', id).single(),
    sb.from('client_contacts').select('*').eq('client_id', id).order('principale', { ascending: false }),
    Promise.all([sb.from('v_ordini').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      sb.from('v_referenze').select('order_id, wine_label, qty').eq('client_id', id)])
      .then(([a, b]) => (a.data || []).map(o => ({ ...o, refs: (b.data || []).filter(r => r.order_id === o.id) }))),
    CrmInsights.suggest(sb, id, 5).catch(() => []),
    sb.from('reminders').select('*').eq('client_id', id).eq('fatto', false).order('due_at'),
    sb.from('activities').select('*').eq('client_id', id).order('data', { ascending: false }).order('created_at', { ascending: false }).limit(30),
    sb.from('client_contacts').select('nome,cognome,ruolo,data_inizio,data_fine,client_id,clients(insegna,ragione_sociale)')
      .neq('client_id', id).not('data_fine', 'is', null).order('data_fine', { ascending: false }).limit(500)
  ]);
  if (error) throw error;
  const ed = canEdit(c), ag = S.agents[c.agent_id];
  const precedentemente = p => {
    if (!p.nome) return '';
    const key = s => (s || '').trim().toLowerCase();
    const prev = (storicoAltrove || []).find(x => key(x.nome) === key(p.nome) && key(x.cognome) === key(p.cognome));
    if (!prev) return '';
    const loc = prev.clients?.insegna || prev.clients?.ragione_sociale || '—';
    const periodo = [prev.data_inizio ? dmy(prev.data_inizio) : null, dmy(prev.data_fine)].filter(Boolean).join(' – ');
    return `<span class="sub" style="display:block;margin-top:2px">↳ Precedentemente da ${esc(loc)}${periodo ? ' (' + esc(periodo) + ')' : ''}</span>`;
  };
  const bt = o => (o.order_items || []).reduce((a, r) => a + r.qty, 0);
  paint(`
    <div class="bar acts">
      <a href="#/clienti" class="btn line sm" aria-label="Clienti">‹<span class="hide-m">&nbsp;Clienti</span></a>
      <span style="flex:1"></span>
      ${ed ? `<button class="btn line sm" id="att">Attività</button>
              <button class="btn line sm" id="mod">Modifica</button>` : !c.agent_id ? '<span class="pill">Libero</span><button class="btn sm" id="prendi">Prendi in carico</button>' : '<span class="pill">Sola lettura</span>'}
      ${c.agent_id && c.assegnato_at && PROSPECT.includes(c.stato) && (mine(c) || isAdmin()) ? `<span class="pill" title="Se non diventa cliente entro questa data torna libero per tutti">libero dal ${dmy(scadeProspect(c))}</span>` : ''}
      ${canOrder(c) ? '<button class="btn sm" id="ord">Nuovo ordine</button>' : ''}
    </div>
    <div class="row" style="padding:0 4px 12px;border:0;align-items:flex-start">
      <span class="av big" style="--ac:${ag?.colore || 'var(--accent)'}">
        ${esc(ini(c.insegna || c.ragione_sociale))}</span>
      <span style="flex:1;min-width:0">
        <h1 style="font-size:24px">${esc(c.insegna || c.ragione_sociale)}</h1>
        <span class="sub">${esc([lbl(c.tipologia), c.indirizzo, c.zona || c.citta].filter(Boolean).join(' · '))}</span><br>
        <span style="display:inline-flex;gap:6px;margin-top:6px;flex-wrap:wrap">${pill(c.stato)}${c.gruppo ? '<span class="pill" style="background:var(--gold-t);color:var(--gold)">Gruppo</span>' : ''}
          ${c.priorita ? `<span class="pill">Priorità ${esc(c.priorita)}</span>` : ''}
          <span class="pill"><i class="dot-ag" style="--ac:${ag?.colore || 'var(--fg3)'}"></i>${esc(ag?.nome || '—')}</span></span>
      </span>
    </div>
    <div class="inset quick">
      ${[['tel', 'Chiama', c.telefono ? 'tel:' + c.telefono : ''], ['chat', 'WhatsApp', waLink(c, ct)],
         ['pin', 'Mappa', mapsLink(c)], ['mail', 'Email', c.email ? 'mailto:' + c.email : '']]
        .map(([i, l, href]) => `<a href="${href || '#'}" ${href ? '' : 'aria-disabled="true" class="off"'}>${svg(i, 21)}${l}</a>`).join('')}
      <button type="button" id="appt" ${canOrder(c) ? '' : 'class="off"'}>${svg('cal', 21)}Agenda</button>
    </div>
    <div class="group"><h3>Referenti</h3><div class="inset">
      ${(ct || []).filter(p => !p.data_fine).map(p => `<div class="row">
        <span class="av round">${esc(ini(p.nome + ' ' + (p.cognome || '')))}</span>
        <span style="flex:1;min-width:0"><span class="ttl">${esc([p.nome, p.cognome].filter(Boolean).join(' '))}</span>
          ${p.principale ? '<span class="pill" style="margin-left:6px">Principale</span>' : ''}<br>
          <span class="sub">${esc([lbl(p.ruolo), p.decisore ? 'decide gli acquisti' : '', p.reperibilita].filter(Boolean).join(' · '))}</span>
          ${precedentemente(p)}</span>
        ${p.telefono ? `<a class="btn ghost sm" href="tel:${esc(p.telefono)}" aria-label="Chiama ${esc(p.nome)}">${svg('tel', 16)}</a>` : ''}
        ${p.email ? `<a class="btn ghost sm" href="mailto:${esc(p.email)}" aria-label="Email ${esc(p.nome)}">${svg('mail', 16)}</a>` : ''}
        ${ed ? `<button class="btn ghost sm" data-lascia="${p.id}" title="Segna come andato via" aria-label="Segna come andato via" style="font-weight:700">✕</button>` : ''}
      </div>`).join('') || '<div class="empty">Nessun referente registrato.</div>'}
      ${(ct || []).filter(p => p.data_fine).length ? `<div class="row" style="opacity:.65">
        <span style="flex:1;min-width:0"><span class="sub">Ex referenti: ${
          esc((ct || []).filter(p => p.data_fine).map(p => `${[p.nome, p.cognome].filter(Boolean).join(' ')} (fino a ${dmy(p.data_fine)})`).join(', '))
        }</span></span></div>` : ''}
    </div></div>
    <div class="group"><h3>Spedizione e fatturazione</h3><div class="inset">
      ${(() => { const d = datiCli(null, c); return `
      ${kv('Spedire a', [d.sped_destinatario, indSped(d)].filter(Boolean).join(' · ') || '—')}
      ${c.sped_diversa && c.sped_telefono ? kv('Tel. consegna', c.sped_telefono) : ''}
      ${kv('Ragione sociale', c.ragione_sociale)}
      ${kv('Sede fatturazione', indFatt(d) || '—')}
      ${kv('P.IVA', c.p_iva || '—')}${kv('Codice fiscale', c.codice_fiscale)}
      ${kv('Codice SDI', c.codice_sdi || (c.pec ? '' : '—'))}${kv('PEC', c.pec)}
      ${!c.p_iva || !(c.codice_sdi || c.pec) ? '<div class="row"><span class="sub" style="color:var(--orange)">Mancano dati per la fattura: completali da Modifica → Fatturazione</span></div>' : ''}`; })()}
    </div></div>
    <div class="group"><h3>Condizioni commerciali</h3><div class="inset">
      ${kv('Termini di pagamento', lbl(c.termini_pagamento) || '—')}
      ${c.modalita_pagamento ? kv('Note pagamento', c.modalita_pagamento) : ''}
      <div class="row"><label>Sconto concordato</label>
        <span class="v mono" style="font-weight:700;color:${c.sconto_concordato_pct ? 'var(--green)' : 'var(--fg2)'}">${c.sconto_concordato_pct ? c.sconto_concordato_pct + '%' : 'Nessuno'}</span></div>
    </div></div>
    <div class="group"><h3>Profilo carta vini</h3><div class="inset">
      ${kv('Fascia', [lbl(c.fascia), c.coperti ? c.coperti + ' coperti' : ''].filter(Boolean).join(' · '))}
      ${kv('Referenze in carta', c.n_referenze_carta)}
      ${kv('Prezzo medio / ricarico', [c.prezzo_medio_carta ? eur(c.prezzo_medio_carta) : null,
           c.ricarico_medio ? c.ricarico_medio + '×' : null].filter(Boolean).join(' · '))}
      ${kv('Al calice', c.vino_calice ? [c.n_etichette_calice ? c.n_etichette_calice + ' etichette' : 'sì', c.sistema_mescita].filter(Boolean).join(' · ') : 'No')}
      ${kv('Visite', c.orari_visita)}${kv('Consegna', c.finestra_consegna)}
      ${chipsRow('Stili e territori', [].concat(c.tipologie_pref || [], c.stili_pref || [], c.regioni_pref || []))}
      ${c.descrizione ? `<div class="row col"><label>Descrizione</label><span>${esc(c.descrizione)}</span></div>` : ''}
    </div></div>
    <div class="group"><h3 class="h3act"><span>Promemoria e appuntamenti</span>
      ${canOrder(c) ? `<button class="btn line sm" id="promNew">${svg('piu', 14)} Aggiungi</button>` : ''}</h3><div class="inset" id="promList">
      ${(prom || []).map(rigaProm).join('') || '<div class="empty">Nessun promemoria aperto.</div>'}
    </div></div>
    <div class="group"><h3>Note / Diario</h3><div class="inset">
      ${c.note ? `<div class="row col"><label>Nota fissa</label><span>${esc(c.note)}</span></div>` : ''}
      ${(diario || []).map(a => `<div class="row col">
        <label>${dmy(a.data || a.created_at)} · ${esc(a.tipo ? a.tipo[0].toUpperCase() + a.tipo.slice(1) : 'Nota')}${S.agents[a.agent_id] ? ' · ' + esc(S.agents[a.agent_id].nome) : ''}</label>
        <span>${esc(a.esito || '—')}</span>
      </div>`).join('') || (c.note ? '' : '<div class="empty">Nessuna nota registrata. Usa "Attività" per aggiungerne una.</div>')}
    </div></div>
    <div class="group"><h3>${svg('star', 13)} Da proporre</h3><div class="inset">
      ${(sugg || []).map(s => `<div class="row">
        <span style="flex:1;min-width:0"><span class="ttl">${esc(s.label)}</span><br>
        <span class="sub">${esc((s.motivo || '').split(' · ').slice(0, 2).join(' · '))}</span></span>
        <span class="mono">${eur(s.prezzo)}</span>${pill(s.disponibilita)}</div>`).join('')
        || '<div class="empty">Ancora pochi dati per suggerire referenze.</div>'}
    </div></div>
    <div class="group"><h3 class="h3act"><span>Storico ordini</span>
      ${canOrder(c) && (storico || []).some(o => o.stato !== 'annullato' && o.dettaglio)
        ? `<button class="btn line sm" id="rifai">${svg('rifai', 14)} Rifai ultimo ordine</button>` : ''}</h3><div class="inset">
      ${(storico || []).map(o => `<a href="#/ordine/${o.id}"><div class="row">
        <span style="flex:1;min-width:0"><span class="ttl mono">${esc(o.numero)}</span><br>
        <span class="sub">${dmy(o.inviato_at || o.created_at)}${S.agents[o.agent_id] ? ' · ' + esc(S.agents[o.agent_id].nome) : ''} · ${o.dettaglio ? o.refs.reduce((a, r) => a + (r.qty || 0), 0) + ' bt · ' : ''}${o.refs.length} referenze</span>
        <span class="sub refs">${esc(o.refs.slice(0, 4).map(r => r.wine_label.replace(/ \[FUORI ZONA\]$/, '')).join(' · '))}${o.refs.length > 4 ? ` · +${o.refs.length - 4}` : ''}</span></span>
        ${o.dettaglio ? `<span class="mono">${eur(o.totale)}</span>` : '<span class="pill" title="Dettaglio riservato all\'agente">🔒 riservato</span>'}${pill(o.stato)}${svg('chev', 14, 'chev')}</div></a>`).join('')
        || '<div class="empty">Nessun ordine registrato.</div>'}
    </div></div>`);
  $('#ord')?.addEventListener('click', () => (location.hash = '#/ordine/nuovo/' + c.id));
  $('#prendi')?.addEventListener('click', () => go(async () => {
    const { error } = await sb.rpc('prendi_cliente', { p_id: c.id });
    if (error) throw error;
    toast('Cliente preso in carico: hai 3 mesi per convertirlo');
    S.clients = []; route();
  }));
  if (ed) {
    const MAPPA = { 'Referenti': 'contatti', 'Spedizione e fatturazione': 'amministrazione', 'Condizioni commerciali': 'amministrazione',
      'Profilo carta vini': 'carta', 'Note / Diario': 'note' };
    document.querySelectorAll('#main .group > h3').forEach(h => {
      const sec = MAPPA[h.textContent.trim()]; if (!sec) return;
      h.classList.add('h3act');
      h.innerHTML = `<span>${h.innerHTML}</span><button class="btn line sm edit-sec" data-sec="${sec}" aria-label="Modifica">${svg('matita', 13)} Modifica</button>`;
      const box = h.nextElementSibling;
      if (box && sec !== 'contatti') { box.classList.add('editable'); box.dataset.sec = sec; }
    });
    $('#main').addEventListener('click', e => {
      const t = e.target.closest('.edit-sec, .inset.editable');
      if (!t || e.target.closest('a,button:not(.edit-sec)')) return;
      editCliente(c, ct || [], t.dataset.sec);
    });
    document.querySelector('#main h1')?.addEventListener('click', () => editCliente(c, ct || [], 'anagrafica'));
  }
  $('#appt').addEventListener('click', () => nuovoPromemoria(c, 'appuntamento'));
  $('#promNew')?.addEventListener('click', () => nuovoPromemoria(c, 'promemoria'));
  bindProm($('#promList'), prom);
  $('#rifai')?.addEventListener('click', () => go(async () => {
    const o = (storico || []).find(x => x.stato !== 'annullato' && x.dettaglio);
    if (!o || !confirm(`Creare una nuova bozza uguale all'ordine ${o.numero}?`)) return;
    location.hash = '#/ordine/' + await duplicaOrdine(o.id);
    toast('Nuova bozza creata da ' + o.numero);
  }));
  if (ed) {
    $('#mod').addEventListener('click', () => editCliente(c, ct || []));
    $('#att').addEventListener('click', () => nuovaAttivita(c, ct || []));
    document.querySelectorAll('[data-lascia]').forEach(b => b.addEventListener('click', () => go(async () => {
      const p = (ct || []).find(x => x.id === b.dataset.lascia);
      if (!p || !confirm(`Segnare ${[p.nome, p.cognome].filter(Boolean).join(' ')} come non più presente in questo locale?`)) return;
      const { error } = await sb.from('client_contacts').update({ data_fine: new Date().toISOString().slice(0, 10) }).eq('id', p.id);
      if (error) throw error;
      toast('Referente aggiornato'); route();
    })));
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
  el.remove = () => {                          // chiusura animata
    if (el.classList.contains('out')) return;
    el.classList.add('out');
    setTimeout(() => Element.prototype.remove.call(el), 190);
  };
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
  return el;
}

function editCliente(c, contatti = [], sezione) {
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
  if (sezione) setTimeout(() => {
    const el = m.querySelector(`[data-sec="${sezione}"]`); if (!el) return;
    const box = m.firstElementChild;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 12;
    const y0 = box.scrollTop, t0 = performance.now(), dur = 450;
    const passo = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      box.scrollTop = y0 + (top - y0) * e; if (k < 1) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
    setTimeout(() => { if (Math.abs(box.scrollTop - top) > 20) box.scrollTop = top; }, dur + 150);
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600);
  }, 420);
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
    const fu = $('#af', m).value;
    if (fu) await sb.from('reminders').insert({ client_id: c.id, agent_id: S.me.id, tipo: 'promemoria',
      due_at: new Date(fu + 'T09:00').toISOString(), testo: 'Follow-up: ' + ($('#ae', m).value.trim() || $('#at', m).value) });
    m.remove(); toast('Attività registrata'); S.clients = []; route();
  }));
}

/* ---------- Promemoria e appuntamenti ---------- */
const hm = d => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
function rigaProm(r, conCliente) {
  const late = new Date(r.due_at) < new Date();
  const cli = conCliente ? S.clients.find(c => c.id === r.client_id) : null;
  return `<div class="row prom${late ? ' late' : ''}" data-r="${r.id}">
    <button class="chk" data-done="${r.id}" aria-label="Segna come fatto"></button>
    <span style="flex:1;min-width:0">
      <span class="ttl" style="font-size:15px">${cli ? `<a href="#/cliente/${cli.id}">${esc(cli.insegna || cli.ragione_sociale)}</a> · ` : ''}${esc(r.testo || (r.tipo === 'appuntamento' ? 'Appuntamento' : 'Promemoria'))}</span><br>
      <span class="sub">${r.tipo === 'appuntamento' ? svg('cal', 12) + ' ' : ''}${dmy(r.due_at)} · ${hm(r.due_at)}${late ? ' · scaduto' : ''}${S.agents[r.agent_id] && S.agents[r.agent_id].id !== S.me.id ? ' · ' + esc(S.agents[r.agent_id].nome) : ''}</span></span>
    ${r.tipo === 'appuntamento' ? `<button class="btn line sm" data-cal="${r.id}" aria-label="Aggiungi al calendario">${svg('cal', 15)}<span class="hide-m">&nbsp;Calendario</span></button>` : ''}
  </div>`;
}
function outlookLink(r, c) {
  const a = new Date(r.due_at), b = new Date(a.getTime() + (r.durata_min || 60) * 60000);
  const q = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', startdt: a.toISOString(), enddt: b.toISOString(),
    subject: `${c?.insegna || c?.ragione_sociale || 'Cliente'} · ${r.testo || 'Appuntamento'}`,
    location: [c?.indirizzo, c?.cap, c?.citta].filter(Boolean).join(', '), body: `${CFG.nome} CRM` });
  return 'https://outlook.office.com/calendar/deeplink/compose?' + q;
}
function sceltaCalendario(r, c) {
  const m = modal(`<div class="bar"><h2>Aggiungi al calendario</h2><span style="flex:1"></span><button class="btn line sm" data-x>Chiudi</button></div>
    <div class="sub" style="padding:0 4px 12px">${esc(c?.insegna || c?.ragione_sociale || '')} · ${dmy(r.due_at)} ${hm(r.due_at)}${r.testo ? ' · ' + esc(r.testo) : ''}</div>
    <div class="calsel">
      <a class="btn line" href="${gcalLink(r, c)}" target="_blank" rel="noopener">Google Calendar</a>
      <a class="btn line" href="${outlookLink(r, c)}" target="_blank" rel="noopener">Outlook</a>
      <button class="btn line" data-ics>Calendario del computer / iPhone (.ics)</button></div>
    <div class="sub" style="padding:10px 4px 0">Il file .ics si apre con Calendario di Mac, iPhone e Outlook desktop, con avviso 30 minuti prima.</div>`);
  m.querySelector('[data-x]').addEventListener('click', () => m.remove());
  m.querySelector('[data-ics]').addEventListener('click', () => { scaricaIcs(r, c); m.remove(); });
}
function bindProm(box, lista) {
  if (!box) return;
  box.addEventListener('click', e => {
    const cb = e.target.closest('[data-cal]');
    if (cb) { const r = (lista || []).find(x => x.id === cb.dataset.cal); if (r) sceltaCalendario(r, S.clients.find(c => c.id === r.client_id)); return; }
    const b = e.target.closest('[data-done]'); if (!b) return;
    go(async () => {
      b.classList.add('on');
      const { error } = await sb.from('reminders').update({ fatto: true }).eq('id', b.dataset.done);
      if (error) { b.classList.remove('on'); throw error; }
      const row = b.closest('.row'); row.classList.add('bye');
      setTimeout(() => { row.remove(); if (!box.querySelector('.row')) box.innerHTML = '<div class="empty">Nessun promemoria aperto.</div>'; }, 260);
      toast('Fatto ✓');
    });
  });
}
const icsDate = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function gcalLink(r, c) {
  const a = new Date(r.due_at), b = new Date(a.getTime() + (r.durata_min || 60) * 60000);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${c?.insegna || c?.ragione_sociale || 'Cliente'} · ${r.testo || 'Appuntamento'}`,
    dates: icsDate(a) + '/' + icsDate(b), details: `${CFG.nome} CRM`, location: [c?.indirizzo, c?.cap, c?.citta].filter(Boolean).join(', ') });
  return 'https://calendar.google.com/calendar/render?' + q;
}
function scaricaIcs(r, c) {
  const a = new Date(r.due_at), b = new Date(a.getTime() + (r.durata_min || 60) * 60000);
  const t = s => String(s || '').replace(/[,;\\]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wine Alchemist//CRM//IT', 'BEGIN:VEVENT',
    'UID:' + r.id + '@wa-crm', 'DTSTAMP:' + icsDate(new Date()), 'DTSTART:' + icsDate(a), 'DTEND:' + icsDate(b),
    'SUMMARY:' + t(`${c.insegna || c.ragione_sociale} · ${r.testo || 'Appuntamento'}`),
    'LOCATION:' + t([c.indirizzo, c.cap, c.citta].filter(Boolean).join(', ')),
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Promemoria', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const u = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const l = Object.assign(document.createElement('a'), { href: u, download: 'appuntamento.ics' });
  document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
}
function nuovoPromemoria(c, tipo) {
  const dom = new Date(Date.now() + 864e5), ymd = d => d.toLocaleDateString('sv-SE');
  const m = modal(`<div class="bar"><h2>${tipo === 'appuntamento' ? 'Fissa appuntamento' : 'Nuovo promemoria'}</h2><span style="flex:1"></span>
      <button class="btn line sm" data-x>Chiudi</button></div>
    <div class="sub" style="padding:0 4px 10px">${esc(c.insegna || c.ragione_sociale)}</div>
    <div class="seg" style="margin-bottom:12px" id="rt">
      <button data-t="appuntamento" class="${tipo === 'appuntamento' ? 'on' : ''}">Appuntamento</button>
      <button data-t="promemoria" class="${tipo === 'promemoria' ? 'on' : ''}">Promemoria</button></div>
    <div class="inset">
      <div class="row"><label for="rd">Giorno</label><input id="rd" type="date" value="${ymd(dom)}"></div>
      <div class="row"><label for="rh">Ora</label><input id="rh" type="time" value="${tipo === 'appuntamento' ? '15:00' : '09:00'}"></div>
      <div class="row" id="rdur"><label for="rm">Durata</label><select id="rm">
        ${[30, 45, 60, 90, 120].map(x => `<option value="${x}" ${x === 60 ? 'selected' : ''}>${x} min</option>`).join('')}</select></div>
      <div class="row col"><label for="rx">Cosa</label>
        <input id="rx" placeholder="${tipo === 'appuntamento' ? 'es. Degustazione nuove referenze' : 'es. Richiamare per riordino'}"></div>
    </div>
    <button class="btn" id="rsave" style="width:100%;margin-top:14px">Salva</button>
    <div id="rcal" class="hide" style="margin-top:14px">
      <div class="sub" style="padding:0 4px 8px">Salvato. Aggiungilo anche al tuo calendario:</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <a class="btn line" id="rg" target="_blank" rel="noopener">Google Calendar</a>
        <a class="btn line" id="ro" target="_blank" rel="noopener">Outlook</a>
        <button class="btn line" id="ri" style="grid-column:1/-1">Calendario del computer / iPhone (.ics)</button></div></div>`);
  let t = tipo;
  const syncT = () => { $('#rdur', m).style.display = t === 'appuntamento' ? '' : 'none'; };
  syncT();
  m.querySelector('[data-x]').addEventListener('click', () => m.remove());
  $('#rt', m).addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    t = b.dataset.t; m.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b)); syncT();
  });
  $('#rsave', m).addEventListener('click', () => go(async () => {
    const d = $('#rd', m).value, h = $('#rh', m).value || '09:00';
    if (!d) return toast('Scegli il giorno');
    const b = $('#rsave', m); b.disabled = true;
    const { data: r, error } = await sb.from('reminders').insert({
      client_id: c.id, agent_id: S.me.id, tipo: t, due_at: new Date(`${d}T${h}`).toISOString(),
      durata_min: t === 'appuntamento' ? +$('#rm', m).value : null, testo: $('#rx', m).value.trim() || null
    }).select().single();
    b.disabled = false;
    if (error) throw error;
    toast(t === 'appuntamento' ? 'Appuntamento salvato' : 'Promemoria salvato');
    if (t !== 'appuntamento') { m.remove(); if (S.view === 'cliente' || S.view === 'home') route(); return; }
    b.classList.add('hide'); $('#rcal', m).classList.remove('hide');
    $('#rg', m).href = gcalLink(r, c); $('#ro', m).href = outlookLink(r, c);
    $('#ri', m).addEventListener('click', () => scaricaIcs(r, c));
    m.querySelector('[data-x]').onclick = () => { m.remove(); route(); };
  }));
}

async function duplicaOrdine(id) {
  const [{ data: o, error }, { data: righe }] = await Promise.all([
    sb.from('orders').select('*').eq('id', id).single(), sb.from('order_items').select('*').eq('order_id', id)]);
  if (error) throw error;
  const ins = await sb.from('orders').insert({ client_id: o.client_id, agent_id: S.me.id, pagamento: o.pagamento, iban: o.iban,
    sconto_cliente_pct: o.sconto_cliente_pct, note: o.note }).select().single();
  if (ins.error) throw ins.error;
  if ((righe || []).length) {
    const r = await sb.from('order_items').insert(righe.map(i => ({
      order_id: ins.data.id, wine_id: i.wine_id, qty: i.qty, sconto_pct: i.sconto_pct, qty_omaggio: i.qty_omaggio || 0 })));
    if (r.error) toast('Alcune referenze non sono più ordinabili: controlla la bozza', 4500);
  }
  return ins.data.id;
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
    <div style="position:relative;isolation:isolate;height:min(62vh,560px);min-height:320px;border-radius:var(--r);overflow:hidden">
      <div id="map"></div></div>
    <div class="chips" style="margin-top:10px">${Object.values(S.agents).filter(x => x.attivo && x.ruolo !== 'viewer').map(x =>
      `<span class="chip" style="cursor:default"><b style="display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;
        background:${x.colore};color:#fff;font-size:10.5px;margin-right:6px">${esc(x.nome[0].toUpperCase())}</b>${esc(x.nome)}</span>`).join('')}</div>
    <div class="group hide" id="sel"></div>
    <div class="sub" id="cnt" style="padding:8px 4px"></div>`);

  const M = CrmMap.create($('#map'));
  setTimeout(() => M.map.invalidateSize(), 60);
  if (window.ResizeObserver) new ResizeObserver(() => M.map.invalidateSize()).observe($('#map'));

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
const TIPO_COL = { rosso: '#9B1B30', bianco: '#B8A12A', rosato: '#E07A93', bollicine: '#2F7FC1', champagne: '#C08A1E',
  macerato: '#D2691E', rifermentato: '#2A9D8F', accessorio: '#8A8A85' };
const tcol = t => TIPO_COL[t] || '#8A8A85';
const tipoTag = w => w.tipologia ? `<span class="tipo" style="--tp:${tcol(w.tipologia)}">${esc(w.tipologia)}</span>` : '';
const nazW = w => w.nazione || 'Altro';
const ordinaCat = list => [...list].sort((a, b) =>
  (nazW(a) === 'Italia' ? 0 : 1) - (nazW(b) === 'Italia' ? 0 : 1) || nazW(a).localeCompare(nazW(b), 'it') ||
  (a.regione || '').localeCompare(b.regione || '', 'it') || (a.produttore || '').localeCompare(b.produttore || '', 'it') ||
  (a.nome || '').localeCompare(b.nome || '', 'it') || String(a.annata || '').localeCompare(String(b.annata || '')));
const CAT_SORT = [['zona', 'Per zona'], ['az', 'Produttore A–Z'], ['pz_asc', 'Prezzo ↑'], ['pz_desc', 'Prezzo ↓']];
const sortCat = (list, k) => {
  const az = (a, b) => (a.produttore || '').localeCompare(b.produttore || '', 'it') || (a.nome || '').localeCompare(b.nome || '', 'it') ||
    String(a.annata || '').localeCompare(String(b.annata || ''));
  if (k === 'az') return [...list].sort(az);
  const d = k === 'pz_desc' ? -1 : 1, pz = w => (w.prezzo_listino == null ? null : num(w.prezzo_listino));
  return [...list].sort((a, b) => { const x = pz(a), y = pz(b);
    return x === y ? az(a, b) : x == null ? 1 : y == null ? -1 : (x - y) * d; });
};
function gruppiCat(list, row) {
  const cnt = {}; list.forEach(w => { const k = nazW(w) + '|' + (w.regione || '—'); cnt[k] = (cnt[k] || 0) + 1; });
  let n0 = null, r0 = null;
  return list.map(w => {
    const n = nazW(w), r = w.regione || '—'; let h = '';
    if (n !== n0) { h += `<div class="grp-n">${esc(n)}</div>`; n0 = n; r0 = null; }
    if (r !== r0) { h += `<div class="grp-h"><span>${esc(r)}</span><span>${cnt[n + '|' + r]}</span></div>`; r0 = r; }
    return h + row(w);
  }).join('');
}
const zoneOpts = (list, sel) => {
  const m = {}; list.forEach(w => { (m[nazW(w)] ||= new Set()).add(w.regione || '—'); });
  return `<option value="">Tutte le zone</option>` + Object.keys(m)
    .sort((a, b) => (a === 'Italia' ? -1 : b === 'Italia' ? 1 : a.localeCompare(b, 'it')))
    .map(n => `<optgroup label="${esc(n)}"><option value="N:${esc(n)}" ${sel === 'N:' + n ? 'selected' : ''}>Tutta ${esc(n)}</option>` +
      [...m[n]].sort((a, b) => a.localeCompare(b, 'it')).map(r =>
        `<option value="R:${esc(n)}|${esc(r)}" ${sel === `R:${n}|${r}` ? 'selected' : ''}>${esc(r)}</option>`).join('') + '</optgroup>').join('');
};
const inZona = (w, z) => !z || (z.startsWith('N:') ? nazW(w) === z.slice(2) : `R:${nazW(w)}|${w.regione || '—'}` === z);
const nomeVino = w => `<span class="prod">${esc(w.produttore || '—')}</span>
  <span class="wn">${tipoTag(w)}${esc(w.nome)}${w.annata ? ' <span class="ann">' + esc(w.annata) + '</span>' : ''}</span>
  ${w.vitigni ? `<span class="vit">${esc(w.vitigni)}</span>` : ''}`;
const bottSvg = t => `<svg viewBox="0 0 24 64" aria-hidden="true"><path fill="${tcol(t)}" opacity=".55" d="M9 2h6v14c0 3 5 6 5 12v32a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V28c0-6 5-9 5-12z"/></svg>`;
const fotoVino = (w, m) => `<span class="${m === 'big' ? 'fotobig' : 'thumb'}"${w.foto_url && m === 'zoom' ? ` data-zoom="${esc(w.foto_url)}"` : ''}>${w.foto_url
  ? `<img src="${esc(w.foto_url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : bottSvg(w.tipologia)}</span>`;
document.addEventListener('click', e => {
  const t = e.target.closest('[data-zoom]'); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  const m = document.createElement('div'); m.className = 'lightbox';
  m.innerHTML = `<img src="${t.dataset.zoom}" alt="">`;
  m.addEventListener('click', () => m.remove()); document.body.append(m);
}, true);
const chipTipo = (t, on) => `<button class="chip ${on ? 'on' : ''}" data-tipo="${t}" style="--tp:${tcol(t)}"><i class="dot"></i>${t}</button>`;
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
  const f = { q: '', tipo: '', set: 'inventario', zona: '' };

  const disegna = () => {
    const q = f.q.toLowerCase();
    const list = ordinaCat((wines || []).filter(w => {
      if (f.tipo && w.tipologia !== f.tipo) return false;
      if (!inZona(w, f.zona)) return false;
      if (f.set === 'inventario' && !w.in_inventario) return false;
      if (f.set === 'fuori' && w.in_inventario) return false;
      if (f.set === 'giacenza' && !w.gestione_giacenza) return false;
      if (!q) return true;
      return [w.produttore, w.nome, w.annata, w.regione, w.zona_produzione, w.vitigni].join(' ').toLowerCase().includes(q);
    }));
    $('#cnt').textContent = `${list.length} referenze · ${(wines || []).filter(w => w.in_inventario).length} in inventario`;
    $('#lista').innerHTML = gruppiCat(list, w => {
      const s = ST[w.id] || {};
      return `<button class="row tp" data-w="${w.id}" style="--tp:${tcol(w.tipologia)}">
        ${fotoVino(w)}<span style="flex:1;min-width:0">
          ${nomeVino(w)}
          <span class="sub">${esc([w.formato_cl ? w.formato_cl + ' cl' : null, w.zona_produzione].filter(Boolean).join(' · '))}</span>
          ${w.no_sconto || !w.vendibile_milano || w.gestione_giacenza ? `<span class="tags" style="margin-top:4px">
            ${w.no_sconto ? '<span class="pill">No sconto</span>' : ''}
            ${!w.vendibile_milano ? `<span class="stamp">Fuori zona</span>` : ''}
            ${w.gestione_giacenza ? `<span class="pill">Giacenza ${s.disponibile ?? 0}</span>` : ''}</span>` : ''}
        </span>
        <span class="meta"><span class="mono" style="font-weight:600">${prezzoHtml(w)}</span>
          ${pill(w.disponibilita)}
          ${f.set === 'inventario' ? '' : `<span class="pill ${w.in_inventario ? 'attivo' : ''}">${w.in_inventario ? 'In inventario' : 'Escluso'}</span>`}</span>
      </button>`;
    }) || '<div class="empty">Nessuna referenza con questi filtri.</div>';
  };

  paint(`<div class="bar"><h1>Catalogo</h1><span style="flex:1"></span>
      ${isAdmin() ? `<button class="btn line sm" id="imp">Importa CSV</button>
        <input type="file" id="file" accept=".csv,text/csv" class="hide">` : ''}</div>
    <div class="search">${svg('cerca', 16)}<label class="sr" for="q">Cerca nel catalogo</label>
      <input id="q" type="search" placeholder="Produttore, vino, regione"></div>
    <div class="seg" style="margin:10px 0">
      ${[['inventario', 'In inventario'], ['tutte', 'Tutte'], ['fuori', 'Escluse'], ['giacenza', 'A giacenza']]
        .map(([k, l]) => `<button data-set="${k}" class="${f.set === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="chips wide-only" style="margin-bottom:10px" id="tipi">
      ${TIPI.map(t => chipTipo(t, false)).join('')}</div>
    <div class="filtri f2"><select class="tipo-sel" id="tipoSel" aria-label="Tipologia"><option value="">Tutte le tipologie</option>
      ${TIPI.map(t => `<option value="${t}" ${f.tipo === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select>
      <select id="zona" class="zona" aria-label="Filtra per zona">${zoneOpts(wines || [], '')}</select></div>
    <div class="sub" id="cnt" style="padding:2px 4px 8px"></div>
    <div class="inset" id="lista"></div>`);

  $('#q').addEventListener('input', e => { f.q = e.target.value; disegna(); });
  $('#zona').addEventListener('change', e => { f.zona = e.target.value; disegna(); });
  $('#tipoSel').addEventListener('change', e => {
    f.tipo = e.target.value;
    document.querySelectorAll('[data-tipo]').forEach(x => x.classList.toggle('on', x.dataset.tipo === f.tipo));
    disegna();
  });
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
    $('#tipoSel').value = f.tipo;
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
    ${fotoVino(w, 'big')}
    <div class="sub" style="margin:-8px 0 12px">${esc([w.produttore, w.annata, w.formato_cl ? w.formato_cl + ' cl' : null,
      w.zona_produzione, w.regione].filter(Boolean).join(' · '))}</div>
    <div class="inset">
      ${kv('Vitigni', w.vitigni || '—')}
      ${kv('Prezzo di listino', eur(w.prezzo_listino))}
      ${inPromo(w) ? kv('Prezzo promo', `${eur(prezzoBase(w))} (−${num(w.promo_pct)}%)`) : ''}
      ${kv('Disponibilità', lbl(w.disponibilita))}
      ${kv('Esclusiva', w.esclusiva)}
      ${kv('Vendibile su ' + CFG.zona, w.vendibile_milano ? 'Sì' : 'No')}
      ${kv('Sconti', inPromo(w) ? 'Non cumulabili con la promo' : w.no_sconto ? 'Non ammessi' : (w.disponibilita === 'assegnazione' ? 'Non ammessi (assegnazione)' : 'Ammessi'))}
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
      <div class="row"><label for="pp">Sconto promo %</label>
        <input id="pp" type="number" step="1" min="0" max="90" placeholder="nessuna" value="${w.promo_pct ?? ''}"></div>
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
      prezzo_min: $('#pm', m).value === '' ? null : +$('#pm', m).value,
      promo_pct: +$('#pp', m).value > 0 ? +$('#pp', m).value : null
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
const STATI_ORD = [['', 'Tutti'], ['pren', 'Prenotazioni'], ['bozza', 'Bozze'], ['inviato', 'Inviati'], ['confermato', 'Confermati'], ['evaso', 'Evasi'], ['annullato', 'Annullati']];
const nomeCli = id => { const c = S.clients.find(x => x.id === id); return c ? (c.insegna || c.ragione_sociale) : '—'; };

function pickCliente(cb) {
  const list = S.clients.filter(c => isAdmin() || isViewer() || mine(c));
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
  const { data, error } = await sb.from('v_ordini').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  const f = { stato: '', q: '' };
  const draw = () => {
    const list = (data || []).filter(o => (!f.stato || o.stato === f.stato ||
        (f.stato === 'pren' && (o.tipo === 'prenotazione' || o.scade_at) && !['annullato', 'evaso'].includes(o.stato))) &&
      (!f.q || (o.numero + ' ' + nomeCli(o.client_id)).toLowerCase().includes(f.q.toLowerCase())));
    $('#lista').innerHTML = list.map(o => `<a href="#/ordine/${o.id}"><div class="row">
      <span style="flex:1;min-width:0"><span class="ttl mono">${esc(o.numero)}</span><br>
        <span class="sub">${o.tipo && o.tipo !== 'ordine' ? tipoDoc(o) + ' · ' : ''}${esc(nomeCli(o.client_id))} · ${dmy(o.inviato_at || o.created_at)}${S.agents[o.agent_id] ? ' · ' + esc(S.agents[o.agent_id].nome) : ''}
        ${o.scade_at && o.stato === 'inviato' ? ' · scade ' + dmy(o.scade_at) : ''}</span></span>
      ${o.dettaglio ? `<span class="mono">${eur(o.totale)}</span>` : `<span class="sub">${o.n_referenze} ref.</span><span class="pill" title="Dettaglio riservato all'agente">🔒 riservato</span>`}${pill(o.stato)}${svg('chev', 14, 'chev')}</div></a>`).join('')
      || '<div class="empty">Nessun ordine.</div>';
    $('#cnt').textContent = `${list.length} ${list.length === 1 ? 'ordine' : 'ordini'} · ${eur(list.reduce((a, o) => a + num(o.totale), 0))}`;
  };
  paint(`<div class="bar"><h1>Ordini</h1><span style="flex:1"></span>
      <button class="btn line sm" id="newPren">${svg('piu', 16)} Prenotazione</button>
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
  $('#newPren').addEventListener('click', () => pickCliente(c => (location.hash = '#/ordine/prenota/' + c.id)));
  draw();
});

addRoute('ordine', async (id, extra) => {
  await ensureClients();
  if (id === 'nuovo' || id === 'prenota') {
    if (!extra) { paint('<div class="empty">Scegli il cliente…</div>'); return pickCliente(c => (location.hash = `#/ordine/${id}/` + c.id)); }
    const { data, error } = await sb.from('orders')
      .insert({ client_id: extra, agent_id: S.me.id, pagamento: 'anticipato', tipo: id === 'prenota' ? 'prenotazione' : 'ordine',
        sconto_cliente_pct: S.clients.find(c => c.id === extra)?.sconto_concordato_pct ?? null }).select().single();
    if (error) throw error;
    location.replace('#/ordine/' + data.id);
    return;
  }
  const { data: vo } = await sb.from('v_ordini').select('*').eq('id', id).maybeSingle();
  if (vo && !vo.dettaglio) return ordineRiservato(vo);
  const [{ data: o, error }, { data: rows }, { data: ws }, { data: stock }] = await Promise.all([
    sb.from('orders').select('*').eq('id', id).single(),
    sb.from('order_items').select('*').eq('order_id', id),
    sb.from('wines').select('*').or('in_inventario.eq.true,vendibile_milano.eq.false').order('produttore'),
    sb.rpc('stock')
  ]);
  if (error) throw error;
  const cli = S.clients.find(c => c.id === o.client_id) || {};
  const { data: storia } = await sb.from('order_items')
    .select('wine_id, qty, qty_omaggio, prezzo_unitario, sconto_pct, orders!inner(id, client_id, stato, numero, created_at, inviato_at)')
    .eq('orders.client_id', o.client_id).neq('orders.stato', 'annullato').neq('orders.stato', 'bozza').neq('order_id', id);
  const ultimo = {};
  (storia || []).forEach(i => { const d = i.orders.inviato_at || i.orders.created_at;
    if (!ultimo[i.wine_id] || d > ultimo[i.wine_id].d) ultimo[i.wine_id] = { ...i, d }; });
  const ST = Object.fromEntries((stock || []).map(s => [s.wine_id, s]));
  const fz = w => !w.vendibile_milano;
  const catalogo = ordinaCat((ws || []).filter(w => ST[w.id]?.vendibile ||
    (fz(w) && w.prezzo_listino != null && !['esaurito', 'in_arrivo'].includes(w.disponibilita))));
  const items = new Map((rows || []).map(i => [i.wine_id, i]));
  let editabile = o.stato === 'bozza' && (isAdmin() || o.agent_id === S.me.id);
  const boss = isAdmin() || isViewer();
  let sort0 = 'zona'; try { sort0 = localStorage.getItem('crm.catSort') || 'zona'; } catch {}
  const f = { q: '', tipo: '', zona: '', sort: CAT_SORT.some(([k]) => k === sort0) ? sort0 : 'zona', primo: true, sconto: num(o.sconto_cliente_pct ?? cli.sconto_concordato_pct ?? 0) };
  const noSc = w => w.no_sconto || w.disponibilita === 'assegnazione';
  const netto = (w, it) => (it.qty - (it.qty_omaggio || 0)) * num(it.prezzo_unitario ?? prezzoBase(w)) * (1 - num(it.sconto_pct) / 100);

  // aggiornamento immediato a schermo, salvataggio raggruppato in sottofondo
  const srv = new Map((rows || []).map(i => [i.wine_id, i]));
  const pend = new Set(); let flushT = null, flushing = null;
  function setQty(w, q) {
    q = Math.max(0, Math.round(q));
    const it = items.get(w.id);
    if (!it && q > 0 && fz(w)) toast(`⚠︎ Fuori zona: ${w.esclusiva || 'non vendibile su ' + CFG.zona}. Verifica prima di inviare.`, 5000);
    if (q <= 0) items.delete(w.id);
    else if (it) { it.qty = q; if ((it.qty_omaggio || 0) > q) it.qty_omaggio = q; }
    else items.set(w.id, { wine_id: w.id, qty: q, sconto_pct: f.sconto || 0, qty_omaggio: 0, prezzo_unitario: prezzoBase(w) });
    pend.add(w.id); f.dirty = true;
    render();
    clearTimeout(flushT); flushT = setTimeout(() => go(flush), 450);
  }
  async function flush() {
    if (flushing) { await flushing; }
    const ids = [...pend]; pend.clear(); if (!ids.length) return;
    flushing = (async () => {
      try {
        for (const wid of ids) {
          const loc = items.get(wid), row = srv.get(wid), q = loc?.qty || 0;
          if (!q && row) {
            const r = await sb.from('order_items').delete().eq('id', row.id); if (r.error) throw r.error; srv.delete(wid);
          } else if (q && row) {
            if (row.qty === q && (row.qty_omaggio || 0) === (loc.qty_omaggio || 0)) continue;
            const r = await sb.from('order_items').update({ qty: q, qty_omaggio: Math.min(loc.qty_omaggio || 0, q) }).eq('id', row.id).select().single();
            if (r.error) throw r.error; srv.set(wid, r.data);
          } else if (q) {
            const r = await sb.from('order_items').insert({ order_id: o.id, wine_id: wid, qty: q, sconto_pct: loc.sconto_pct || 0 }).select().single();
            if (r.error) throw r.error; srv.set(wid, r.data);
          }
          if (!pend.has(wid) && srv.has(wid) && items.has(wid)) items.set(wid, { ...srv.get(wid) });
        }
      } catch (e) {
        // riallinea con il database e mostra l'errore
        const { data } = await sb.from('order_items').select('*').eq('order_id', o.id);
        srv.clear(); items.clear(); (data || []).forEach(i => { srv.set(i.wine_id, i); items.set(i.wine_id, { ...i }); });
        throw e;
      } finally {
        const fresh = await sb.from('orders').select('*').eq('id', o.id).single();
        if (fresh.data) Object.assign(o, fresh.data);
        f.dirty = pend.size > 0; flushing = null; render();
      }
    })();
    return flushing;
  }

  async function setRiga(w, patch) {
    if (pend.size) { clearTimeout(flushT); await flush(); }
    const row = srv.get(w.id); if (!row) return;
    const r = await sb.from('order_items').update(patch).eq('id', row.id).select().single();
    if (r.error) throw r.error;
    srv.set(w.id, r.data); items.set(w.id, { ...r.data });
    const fresh = await sb.from('orders').select('*').eq('id', o.id).single();
    if (fresh.data) Object.assign(o, fresh.data);
    render();
  }

  async function applySconto(val) {
    if (pend.size) { clearTimeout(flushT); await flush(); }
    f.sconto = Math.max(0, Math.min(100, Number(val) || 0));
    const u = await sb.from('orders').update({ sconto_cliente_pct: f.sconto }).eq('id', o.id);
    if (u.error) throw u.error;
    if (items.size) {
      const r = await sb.from('order_items').update({ sconto_pct: f.sconto }).eq('order_id', o.id);
      if (r.error) throw r.error;
      const rows = await sb.from('order_items').select('*').eq('order_id', o.id);
      items.clear(); srv.clear();
      (rows.data || []).forEach(i => { items.set(i.wine_id, { ...i }); srv.set(i.wine_id, i); });
    }
    const fresh = await sb.from('orders').select('*').eq('id', o.id).single();
    if (fresh.data) Object.assign(o, fresh.data);
    render();
  }

  // promo "sconto merce": l'agente sceglie la referenza (di solito la meno cara dell'ordine)
  const idonea = w => !w.no_sconto && !inPromo(w) && w.disponibilita !== 'assegnazione' && w.tipologia !== 'accessorio';
  async function togliPromo() {
    if (pend.size || flushing) { clearTimeout(flushT); await flush(); }
    const wid = o.omaggio_wine_id, n = o.omaggio_bt || 0, row = wid && srv.get(wid);
    if (row && n) {
      const q = Math.max(0, row.qty - n), qo = Math.max(0, (row.qty_omaggio || 0) - n);
      const r = q ? await sb.from('order_items').update({ qty: q, qty_omaggio: Math.min(qo, q) }).eq('id', row.id).select().single()
                  : await sb.from('order_items').delete().eq('id', row.id);
      if (r.error) throw r.error;
      if (q) { srv.set(wid, r.data); items.set(wid, { ...r.data }); } else { srv.delete(wid); items.delete(wid); }
    }
    const u = await sb.from('orders').update({ applica_omaggio: false, omaggio_wine_id: null, omaggio_bt: 0 }).eq('id', o.id).select().single();
    if (u.error) throw u.error;
    Object.assign(o, u.data);
  }
  async function applicaPromo(wid) {
    if (o.applica_omaggio) await togliPromo();
    const n = o.omaggio_possibile, row = srv.get(wid);
    if (!row || !n) throw new Error('Referenza non presente nell\'ordine');
    const r = await sb.from('order_items').update({ qty: row.qty + n, qty_omaggio: (row.qty_omaggio || 0) + n }).eq('id', row.id).select().single();
    if (r.error) throw r.error;
    srv.set(wid, r.data); items.set(wid, { ...r.data });
    const u = await sb.from('orders').update({ applica_omaggio: true, omaggio_wine_id: wid, omaggio_bt: n }).eq('id', o.id).select().single();
    if (u.error) throw u.error;
    Object.assign(o, u.data);
  }
  function scegliOmaggio() {
    go(async () => {
      if (pend.size || flushing) { clearTimeout(flushT); await flush(); }
      const n = o.omaggio_possibile;
      const cand = catalogo.filter(w => items.has(w.id) && idonea(w)).sort((a, b) => num(a.prezzo_listino) - num(b.prezzo_listino));
      if (!n) return toast('L\'ordine non raggiunge ancora la soglia della promo');
      if (!cand.length) return toast('Nessuna referenza dell\'ordine può andare in omaggio');
      const sel = o.omaggio_wine_id || cand[0].id;
      const m = modal(`<div class="bar"><h2>Sconto merce · ${n} bt</h2><span style="flex:1"></span><button class="btn line sm" data-x>Chiudi</button></div>
        <div class="sub" style="padding:0 4px 12px">Scegli quale referenza dell'ordine regalare. Le ${n} bottiglie si aggiungono alla riga come omaggio (a costo zero). In cima le meno care.</div>
        <div class="inset">${cand.map(w => `<label class="row" style="cursor:pointer">
          <input type="radio" name="om" value="${w.id}" ${w.id === sel ? 'checked' : ''} style="width:20px;height:20px;accent-color:#7A1F2B">
          <span style="flex:1;min-width:0">${nomeVino(w)}<span class="sub">${items.get(w.id).qty} bt nell'ordine</span></span>
          <span class="mono">${eur(w.prezzo_listino)}</span></label>`).join('')}</div>
        <button class="btn" id="omOk" style="width:100%;margin-top:14px">Metti ${n} bt in omaggio</button>`);
      m.querySelector('[data-x]').addEventListener('click', () => m.remove());
      $('#omOk', m).addEventListener('click', () => go(async () => {
        const wid = m.querySelector('input[name=om]:checked')?.value; if (!wid) return;
        $('#omOk', m).disabled = true;
        try { await applicaPromo(wid); m.remove(); toast('Omaggio applicato'); render(); }
        finally { const b = $('#omOk', m); if (b) b.disabled = false; }
      }));
    });
  }

  const rigaVino = w => {
    const it = items.get(w.id), q = it ? it.qty : 0, s = ST[w.id] || {};
    const disp = w.gestione_giacenza ? `Libere ${s.disponibile ?? 0}` : lbl(w.disponibilita);
    const tono = w.gestione_giacenza && s.disponibile <= 12 ? 'var(--orange)' : 'var(--fg2)';
    return `<div class="row tp${fz(w) ? ' fz' : ''}" style="--tp:${tcol(w.tipologia)};${q ? 'background:var(--accent-tint)' : ''}">
      ${fotoVino(w, 'zoom')}<span style="flex:1;min-width:0">
        ${fz(w) ? `<span class="stamp" title="${esc(w.esclusiva || '')}">Fuori zona</span>` : ''}
        ${nomeVino(w)}
        ${fz(w) && w.esclusiva ? `<span class="sub" style="display:block;color:var(--red)">${esc(w.esclusiva)}</span>` : ''}
        ${ultimo[w.id] ? (() => { const u = ultimo[w.id], net = num(u.prezzo_unitario) * (1 - num(u.sconto_pct) / 100),
            d = num(prezzoBase(w)) - num(u.prezzo_unitario);
          return `<span class="hist" title="Ordine ${esc(u.orders.numero)}">↺ Ultimo: ${u.qty} bt a ${eur(net)}${num(u.sconto_pct) ? ` (−${num(u.sconto_pct)}%)` : ''} · ${dmy(u.d)}${Math.abs(d) > 0.004 ? ` · <b style="color:${d > 0 ? 'var(--orange)' : 'var(--green)'}">listino ${d > 0 ? '+' : '−'}${eur(Math.abs(d))}</b>` : ''}</span>`; })() : ''}
        <span class="sub">${esc([w.formato_cl ? w.formato_cl + ' cl' : null, w.zona_produzione].filter(Boolean).join(' · '))}</span><br>
        <span class="sub mono" style="font-weight:600">${prezzoHtml(w)}
          <span style="color:${tono}">· ${esc(disp)}</span>
          ${!inPromo(w) && (w.no_sconto || w.disponibilita === 'assegnazione') ? '· no sconto' : ''}</span></span>
      ${editabile ? `<span class="step">
        <input class="q" data-qty="${w.id}" type="number" min="0" step="1" inputmode="numeric" value="${q}" aria-label="Quantità"></span>`
        : `<span class="mono">${q} bt</span>`}
    </div>`;
  };

  const rigaCarrello = w => {
    const it = items.get(w.id), q = it ? it.qty : 0, om = it?.qty_omaggio || 0, sc = num(it?.sconto_pct);
    const lordo = num(it?.prezzo_unitario ?? prezzoBase(w)) * q, net = it ? netto(w, it) : 0;
    const bloccato = inPromo(w) || (noSc(w) && !boss);
    const info = [sc ? `−${sc}%` : '', om ? `${om} omaggio` : ''].filter(Boolean).join(' · ');
    return `<div class="cart-item tp${fz(w) ? ' fz' : ''}" style="--tp:${tcol(w.tipologia)}">
      <div class="cart-row">
        <span style="flex:1;min-width:0">
          ${fz(w) ? '<span class="stamp sm">Fuori zona</span>' : ''}<span class="prod" style="font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w.produttore || '')}</span>
          <span class="ttl" style="font-size:14px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w.nome)}${w.annata ? ' ' + esc(w.annata) : ''}</span>
          <span class="sub mono">${net < lordo - 0.004 ? `<s>${eur(lordo)}</s> ` : ''}<b>${eur(net)}</b>${info ? ` <span style="color:var(--green)">${info}</span>` : ''}</span></span>
        ${editabile ? `<span class="step">
          <input class="q" data-qty="${w.id}" type="number" min="0" step="1" inputmode="numeric" value="${q}" aria-label="Quantità"></span>`
          : `<span class="mono">${q} bt</span>`}
      </div>
      ${editabile ? `<div class="cart-opts">
        <label>Sconto <input class="num-in" type="number" min="0" max="100" step="0.5" inputmode="decimal" data-rsc="${w.id}" value="${sc}" ${bloccato ? 'disabled title="Referenza non scontabile"' : ''}> %</label>
        <label>Omaggio <input class="num-in" type="number" min="0" max="${q}" step="1" inputmode="numeric" data-rom="${w.id}" value="${om}" ${bloccato ? 'disabled' : ''}> bt</label>
      </div>` : ''}
    </div>`;
  };

  function render() {
    const scelti = catalogo.filter(w => items.has(w.id));
    const q = f.q.toLowerCase();
    const filtrati = editabile ? catalogo.filter(w =>
      (!f.tipo || w.tipologia === f.tipo) && inZona(w, f.zona) &&
      (!q || [w.produttore, w.nome, w.annata, w.regione, w.vitigni].join(' ').toLowerCase().includes(q))) : [];
    const bt = [...items.values()].reduce((a, i) => a + i.qty, 0);
    const lordoTot = scelti.reduce((a, w) => { const it = items.get(w.id); return a + it.qty * num(it.prezzo_unitario ?? prezzoBase(w)); }, 0);
    const scontiTot = lordoTot - num(o.imponibile);
    const impLoc = scelti.reduce((a, w) => a + netto(w, items.get(w.id)), 0);
    const riep = f.dirty ? `${kv('Imponibile (provvisorio)', eur(impLoc))}
          <div class="row"><label>Totale</label><span class="v sub">aggiornamento…</span></div>` : `          ${scontiTot > 0.004 ? kv('Totale listino', eur(lordoTot)) + kv('Sconti e omaggi', '− ' + eur(scontiTot)) : ''}
          ${kv('Imponibile', eur(o.imponibile))}
          ${o.sconto_pagamento ? kv('Sconto pagamento anticipato', '− ' + eur(o.sconto_pagamento)) : ''}
          ${o.omaggio_bt ? kv('Sconto merce', `${o.omaggio_bt} bt omaggio · ${esc(items.get(o.omaggio_wine_id)?.wine_label || '')}`) : ''}
          ${kv('Trasporto', o.porto_franco ? 'Porto franco' : `Sotto i ${eur(400)}: trasporto a carico del cliente`)}
          <div class="row"><label>Totale</label><span class="v mono" style="font-size:19px;font-weight:700;color:var(--fg)">${eur(o.totale)}</span></div>
`;
    const azioni = [];
    const pren = o.tipo === 'prenotazione';
    if (editabile && o.stato === 'bozza') azioni.push(['inviato', pren ? 'Invia prenotazione' : 'Invia ordine', 'btn']);
    if ((isAdmin() || isViewer()) && o.stato === 'inviato') azioni.push(['confermato', pren ? 'Pagata o ritirata' : 'Conferma', 'btn'],
      ['annullato', pren ? 'Libera bottiglie' : 'Annulla', 'btn ghost']);
    if ((isAdmin() || isViewer()) && o.stato === 'confermato') azioni.push(['evaso', 'Segna evaso', 'btn']);

    const mio = isAdmin() || o.agent_id === S.me.id;
    const y0 = f.primo ? 0 : window.scrollY, cy0 = $('.ord-cart')?.scrollTop || 0;
    f.primo = false;
    paint(`<div class="ord-layout">
      <div class="ord-header">
        <div class="bar acts"><a href="#/ordini" class="btn line sm" aria-label="Ordini">‹<span class="hide-m">&nbsp;Ordini</span></a><span style="flex:1"></span>
          <button class="btn line sm" id="pdfOrd" aria-label="PDF">${svg('doc', 16)}<span class="hide-m">&nbsp;PDF</span></button>
          <button class="btn line sm" id="dup">Duplica</button>
          ${mio && (o.stato === 'annullato' || (o.stato === 'inviato' && !isAdmin())) ? '<button class="btn line sm" id="riapri">Modifica</button>' : ''}
          ${isAdmin() && ['inviato', 'confermato', 'evaso'].includes(o.stato) && !f.mod ? '<button class="btn line sm" id="modOrd">Modifica</button>' : ''}
          ${(o.stato === 'bozza' && mio) || isAdmin() ? '<button class="btn line sm" id="delOrd" style="color:var(--red)">Elimina</button>' : ''}
          <button class="btn line sm" id="mailOrd" aria-label="Email">${svg('mail', 16)}<span class="hide-m">&nbsp;Email</span></button>
          <button class="btn line sm" id="waOrd" aria-label="WhatsApp">${svg('chat', 16)}<span class="hide-m">&nbsp;WhatsApp</span></button></div>
        <h1 class="mono" style="font-size:22px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">${esc(o.numero)} ${pill(o.stato)}
          ${o.tipo && o.tipo !== 'ordine' ? `<span class="pill trattativa" style="font-family:var(--font)">${tipoDoc(o)}</span>` : ''}
          ${o.email_inviata_at ? `<span class="pill attivo" style="font-family:var(--font)">✓ email inviata ${dmy(o.email_inviata_at)}</span>` : ''}
          ${o.stato !== 'bozza' && !o.email_inviata_at && (isAdmin() || o.agent_id === S.me.id) ? '<button class="btn line sm" id="reMail" style="font-family:var(--font)">Invia email ora</button>' : ''}</h1>
        ${f.mod ? `<div class="inset" style="margin-top:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--orange)">
          <span style="flex:1;min-width:200px"><b>Modifica ordine ${esc(lbl(o.stato).toLowerCase())}</b><br><span class="sub">Le modifiche si salvano subito. Lo stato resta invariato.</span></span>
          <button class="btn sm" id="fineMod">Fine modifiche</button></div>`
        : o.stato === 'inviato' && o.scade_at ? `<div class="inset" style="margin-top:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--orange)">
          <span style="flex:1;min-width:200px"><b>Bottiglie bloccate fino al ${dmy(o.scade_at)}</b><br><span class="sub">${new Date(o.scade_at) < new Date() ? 'Scaduta' : `Mancano ${Math.ceil((new Date(o.scade_at) - Date.now()) / 864e5)} giorni`}. Senza pagamento o ritiro entro la scadenza la prenotazione si annulla e le bottiglie tornano disponibili.</span></span>
          ${isAdmin() || isViewer() ? '<button class="btn sm" data-go="confermato">Pagata o ritirata</button>' : ''}</div>`
        : isAdmin() && o.stato === 'inviato' ? `<div class="inset" style="margin-top:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="flex:1;min-width:200px"><b>In attesa di conferma</b><br><span class="sub">Quando è approvato, segnalo qui: entra nel fatturato del mese.</span></span>
          <button class="btn sm" data-go="confermato">Segna confermato</button></div>` : ''}
        ${['confermato', 'evaso'].includes(o.stato) && o.pagamento !== 'anticipato' && o.tipo !== 'campionatura' ? `<div class="inset" style="margin-top:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap${o.pagato_at ? '' : ';border:1px solid var(--orange)'}">
          <span style="flex:1;min-width:200px"><b>${o.pagato_at ? '✓ Pagato il ' + dmy(o.pagato_at) : 'Da incassare'}</b><br><span class="sub">${o.pagato_at ? 'Provvigione confermata.' : esc(lbl(o.pagamento)) + ': la provvigione si conferma quando l\'ordine risulta pagato.'}</span></span>
          ${isAdmin() || isViewer() ? `<button class="btn ${o.pagato_at ? 'line ' : ''}sm" id="pagOrd">${o.pagato_at ? 'Annulla pagato' : 'Segna pagato'}</button>` : ''}</div>` : ''}
        <div class="inset" style="margin-top:12px">
          <a href="#/cliente/${cli.id}"><div class="row">
            <span class="av">${esc(ini(cli.insegna || cli.ragione_sociale || '?'))}</span>
            <span style="flex:1;min-width:0"><span class="ttl">${esc(cli.insegna || cli.ragione_sociale || '—')}</span><br>
              <span class="sub">${esc([indSped(datiCli(o, cli)) ? 'Spedizione: ' + indSped(datiCli(o, cli)) : null, cli.finestra_consegna ? 'consegna ' + cli.finestra_consegna : null].filter(Boolean).join(' · '))}</span>
              ${!cli.p_iva || !(cli.codice_sdi || cli.pec) ? '<br><span class="sub" style="color:var(--orange)">Dati di fatturazione incompleti (P.IVA / SDI o PEC)</span>' : ''}</span>
            ${svg('chev', 14, 'chev')}</div></a>
          ${editabile && o.stato === 'bozza' ? `<div class="row"><label>Tipo</label>
            <div class="seg" id="oTipo" style="margin-left:auto;min-width:220px">
              ${['ordine', 'prenotazione', 'campionatura'].map(t => `<button data-tipo-doc="${t}" class="${(o.tipo || 'ordine') === t ? 'on' : ''}">${tipoDoc({ tipo: t })}</button>`).join('')}</div></div>`
            : pren ? kv('Tipo', 'Prenotazione') : ''}
          <div class="row"><label for="pag">Pagamento</label>
            <select id="pag" ${editabile ? '' : 'disabled'}>
              ${['anticipato', 'bonifico_30', 'riba_60', 'riba_90_fm'].map(p =>
                `<option value="${p}" ${o.pagamento === p ? 'selected' : ''}>${lbl(p)}</option>`).join('')}
            </select></div>
          ${isRiba(o.pagamento) ? `<div class="row"><label for="oIban">IBAN cliente${o.iban && !ibanOk(o.iban) ? '<br><span class="sub" style="color:var(--red)">IBAN non valido</span>' : !o.iban ? '<br><span class="sub" style="color:var(--orange)">Obbligatorio per Ri.Ba.</span>' : ''}</label>
            <input id="oIban" type="text" class="mono" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="42"
              placeholder="IT00 X000 0000 0000 0000 0000 000" value="${esc(ibanFmt(o.iban))}" ${editabile ? '' : 'disabled'} style="flex:1;min-width:0;max-width:320px;margin-left:auto;text-transform:uppercase"></div>` : ''}
          <div class="row"><label for="scontoCli">Sconto cliente</label>
            ${editabile
              ? `<input id="scontoCli" type="number" min="0" max="100" step="0.5" inputmode="decimal" class="num-in" value="${f.sconto || 0}"> %`
              : `<span class="v mono">${f.sconto ? f.sconto + '%' : '—'}</span>`}</div>
          ${o.omaggio_possibile > 0 || o.applica_omaggio ? `<div class="row"><label for="oProm">Promo ${o.omaggio_possibile || ''} bt in omaggio
              ${o.applica_omaggio ? `<br><span class="sub" style="color:var(--green)">${o.omaggio_bt} bt di ${esc(catalogo.find(w => w.id === o.omaggio_wine_id)?.nome || '')}</span>` : ''}
              ${o.applica_omaggio && !o.omaggio_possibile ? '<br><span class="sub" style="color:var(--orange)">L\'ordine è sceso sotto la soglia: togli l\'omaggio</span>' : ''}</label>
            <span style="margin-left:auto;display:flex;align-items:center;gap:8px">
              ${o.applica_omaggio && editabile ? '<button class="btn line sm" id="oPromCambia">Cambia</button>' : ''}
              <input id="oProm" type="checkbox" class="sw" ${o.applica_omaggio ? 'checked' : ''} ${editabile ? '' : 'disabled'}></span></div>` : ''}
          <div class="row"><label for="oCons">Consegna richiesta</label>
            <input id="oCons" type="date" value="${o.data_consegna || ''}" ${editabile ? '' : 'disabled'}></div>
          <div class="row col"><label for="oNote">Note ordine</label>
            <textarea id="oNote" rows="2" placeholder="es. consegna dopo le 15, fattura a nome di…" ${editabile ? '' : 'disabled'}>${esc(o.note || '')}</textarea></div>
          ${o.scade_at ? kv('Prenotazione valida fino al', dmy(o.scade_at)) : ''}
        </div>
      </div>

      <div class="ord-main">
        ${editabile ? `<div class="group" style="margin-top:0"><h3>Catalogo</h3>
          <div class="search">${svg('cerca', 16)}<label class="sr" for="cq">Cerca referenze</label>
            <input id="cq" type="search" placeholder="Produttore, vino, regione" value="${esc(f.q)}"></div>
          <div class="chips wide-only" style="margin:8px 0" id="tipi">
            ${TIPI.filter(t => t !== 'accessorio').map(t => chipTipo(t, f.tipo === t)).join('')}</div>
          <div class="filtri f2 f3"><select class="tipo-sel" id="tipoSel" aria-label="Tipologia"><option value="">Tutte le tipologie</option>
      ${TIPI.filter(t => t !== 'accessorio').map(t => `<option value="${t}" ${f.tipo === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select>
            <select id="zona" class="zona" aria-label="Filtra per zona">${zoneOpts(catalogo, f.zona)}</select>
            <select id="catSort" aria-label="Ordina">${CAT_SORT.map(([k, l]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="sub" style="padding:2px 4px 8px">${filtrati.length} referenze</div>
          <div class="inset">${(f.sort === 'zona' ? gruppiCat(filtrati, rigaVino) : sortCat(filtrati, f.sort).map(rigaVino).join('')) || '<div class="empty">Nessuna referenza.</div>'}</div>
        </div>` : `<div class="group" style="margin-top:0"><h3>Referenze</h3><div class="inset">
          ${gruppiCat(scelti, rigaVino) || '<div class="empty">Nessuna referenza.</div>'}
        </div></div>`}
      </div>

      <aside class="ord-cart">
        <div class="group" style="margin-top:0"><h3>Carrello${bt ? ` · ${items.size} ${items.size === 1 ? 'referenza' : 'referenze'} · ${bt} ${bt === 1 ? 'bottiglia' : 'bottiglie'}` : ''}</h3><div class="inset">
          ${scelti.map(rigaCarrello).join('') || '<div class="cart-empty">Nessuna referenza selezionata.</div>'}
        </div></div>
        <div class="group"><h3>Riepilogo</h3><div class="inset">${riep}</div></div>
        ${azioni.map(([st, l, c], i) => `<button class="${c}${i ? '' : ' only-desktop'}" style="width:100%;margin-bottom:8px" data-go="${st}">${l}</button>`).join('')}
      </aside>
    </div>
    ${azioni.length ? `<div class="sheet hide-desktop">
      <button class="cartbtn" id="goCart" aria-label="Apri carrello">${svg('cart', 22)}${bt ? `<span class="badge${bt !== f.lastBt && f.lastBt != null ? ' bump' : ''}">${bt}</span>` : ''}</button>
      <button class="tot" id="goCart2"><span class="sub">${bt} bt · ${items.size} ${items.size === 1 ? 'referenza' : 'referenze'}</span><br>
        <span class="mono" style="font-size:20px;font-weight:700;color:var(--fg)">${eur(o.totale)}</span></button>
      <button class="${azioni[0][2]}" data-go="${azioni[0][0]}">${azioni[0][1]}</button>
    </div>` : ''}`);

    window.scrollTo(0, y0); const oc = $('.ord-cart'); if (oc) oc.scrollTop = cy0;
    f.lastBt = bt;
    const cartHtml = () => `<div class="bar"><h2>Carrello${bt ? ` · ${items.size} ref. · ${bt} bt` : ''}</h2><span style="flex:1"></span>
        <button class="btn line sm" data-x>Chiudi</button></div>
      <div class="inset">${scelti.map(rigaCarrello).join('') || '<div class="cart-empty">Nessuna referenza selezionata.</div>'}</div>
      <div class="group"><h3>Riepilogo</h3><div class="inset">${riep}</div></div>`;
    if (f.cartM?.isConnected) f.cartM.firstElementChild.innerHTML = cartHtml();
    const apriCarrello = () => {
      const m = modal(cartHtml()); f.cartM = m;
      m.addEventListener('click', e => { if (e.target.closest('[data-x]')) return m.remove(); $('#main').onclick?.(e); });
      m.addEventListener('change', e => $('#main').onchange?.(e));
      m.addEventListener('keydown', e => $('#main').onkeydown?.(e));
      m.addEventListener('focusin', e => $('#main').onfocusin?.(e));
    };
    $('#goCart')?.addEventListener('click', apriCarrello);
    $('#goCart2')?.addEventListener('click', apriCarrello);
    const zs = $('#zona');
    if (zs) zs.addEventListener('change', e => { f.zona = e.target.value; render(); });
    $('#tipoSel')?.addEventListener('change', e => { f.tipo = e.target.value; render(); });
    $('#catSort')?.addEventListener('change', e => { f.sort = e.target.value; try { localStorage.setItem('crm.catSort', f.sort); } catch {} render(); });
    $('#pag').addEventListener('change', e => go(async () => {
      const r = await sb.from('orders').update({ pagamento: e.target.value }).eq('id', o.id).select().single();
      if (r.error) throw r.error;
      Object.assign(o, r.data); render();
    }));
    const sc = $('#scontoCli');
    if (sc) sc.addEventListener('change', e => go(() => applySconto(e.target.value)));
    $('#main').onkeydown = e => { if (e.key === 'Enter' && e.target.matches('input.q, .num-in')) e.target.blur(); };
    $('#main').onfocusin = e => { if (e.target.matches('input.q, .num-in')) e.target.select(); };
    $('#main').onchange = e => {
      const t = e.target;
      if (t.dataset.qty) {
        const w = catalogo.find(x => x.id === t.dataset.qty); if (!w) return;
        const n = Math.max(0, Math.round(Number(t.value) || 0));
        if (n !== (items.get(w.id)?.qty || 0)) go(() => setQty(w, n));
        return;
      }
      const id = t.dataset.rsc || t.dataset.rom; if (!id) return;
      const w = catalogo.find(x => x.id === id), it = items.get(id); if (!w || !it) return;
      go(() => t.dataset.rsc
        ? setRiga(w, { sconto_pct: Math.max(0, Math.min(100, Number(t.value) || 0)) })
        : setRiga(w, { qty_omaggio: Math.max(0, Math.min(it.qty, Math.round(Number(t.value) || 0))) }));
    };
    const cq = $('#cq');
    if (cq) {
      if (f.focus) { f.focus = false; cq.focus({ preventScroll: true }); cq.setSelectionRange(f.q.length, f.q.length); }
      cq.addEventListener('input', e => { f.q = e.target.value; f.focus = true; render(); });
      $('#tipi').addEventListener('click', e => {
        const b = e.target.closest('[data-tipo]'); if (!b) return;
        f.tipo = f.tipo === b.dataset.tipo ? '' : b.dataset.tipo; render();
      });
    }
    $('#main').onclick = null;
    $('#main').onwheel = e => { if (e.target === document.activeElement && e.target.matches('input.q')) e.target.blur(); };
    $('#pagOrd')?.addEventListener('click', () => go(async () => {
      const r = await sb.rpc('segna_pagato', { p_order: o.id, p_pagato: !o.pagato_at });
      if (r.error) throw r.error;
      toast(r.data ? 'Ordine segnato come pagato: provvigione confermata' : 'Pagamento annullato'); route();
    }));
    $('#mailOrd').addEventListener('click', () => mailOrdine(o, [...items.values()], cli));
    $('#waOrd').addEventListener('click', () => waOrdine(o, [...items.values()], cli));
    $('#dup').addEventListener('click', () => go(async () => {
      const nid = await duplicaOrdine(o.id);
      toast('Ordine duplicato in bozza');
      location.hash = '#/ordine/' + nid;
    }));
    $('#pdfOrd').addEventListener('click', () => pdfOrdine(o, [...items.values()], cli));
    $('#reMail')?.addEventListener('click', () => go(async () => {
      const res = await inviaEmailOrdine(o.id);
      if (res === 'ok') { toast('Email inviata'); route(); }
      else if (res === 'off') mailOrdine(o, [...items.values()], cli);
      else toast('Email non inviata: ' + res, 6000);
    }));
    $('#oProm')?.addEventListener('change', e => {
      if (e.target.checked) { e.target.checked = false; scegliOmaggio(); }
      else go(async () => { await togliPromo(); render(); });
    });
    $('#oPromCambia')?.addEventListener('click', () => scegliOmaggio());
    $('#oTipo')?.addEventListener('click', e => {
      const b = e.target.closest('[data-tipo-doc]'); if (!b || b.dataset.tipoDoc === o.tipo) return;
      go(async () => {
        const r = await sb.from('orders').update({ tipo: b.dataset.tipoDoc }).eq('id', o.id).select().single();
        if (r.error) throw r.error;
        Object.assign(o, r.data); render();
        if (o.tipo === 'prenotazione') toast('Prenotazione: le bottiglie restano bloccate 15 giorni dall\'invio', 3500);
        if (o.tipo === 'campionatura') toast('Campionatura: nessun fatturato né provvigione, il valore a listino scala dal budget campioni', 4500);
      });
    });
    [['#oNote', 'note'], ['#oCons', 'data_consegna'], ['#oIban', 'iban']].forEach(([id, k]) => {
      const el = $(id); if (!el || el.disabled) return;
      el.addEventListener('change', e => go(async () => {
        const r = await sb.from('orders').update({ [k]: e.target.value.trim() || null }).eq('id', o.id).select().single();
        if (r.error) throw r.error;
        Object.assign(o, r.data);
        if (k === 'iban') render(); else toast('Salvato');
      }));
    });
    const delB = $('#delOrd');
    if (delB) delB.addEventListener('click', () => go(async () => {
      const cosa = o.stato === 'bozza' ? 'la bozza' : `l'ordine (${lbl(o.stato).toLowerCase()})`;
      if (!confirm(`Eliminare definitivamente ${cosa} ${o.numero}?\n\nL'operazione non si può annullare.`)) return;
      const r = await sb.from('orders').delete().eq('id', o.id).select('id');
      if (r.error) throw r.error;
      if (!r.data?.length) throw new Error('Eliminazione non consentita dai permessi del database');
      toast(o.stato === 'bozza' ? 'Bozza eliminata' : 'Ordine eliminato');
      location.hash = '#/ordini';
    }));
    $('#modOrd')?.addEventListener('click', () => { f.mod = true; editabile = true; render(); });
    $('#fineMod')?.addEventListener('click', () => go(async () => {
      if (pend.size || flushing) { clearTimeout(flushT); await flush(); }
      f.mod = false; editabile = false;
      if (confirm(`Inviare l'email con l'ordine ${o.numero} aggiornato?`)) {
        const res = await inviaEmailOrdine(o.id);
        if (res === 'ok') toast('Email aggiornata inviata a ' + ORD_EMAIL_TO[0], 4000);
        else if (res === 'off') mailOrdine(o, [...items.values()], cli);
        else toast('Email non partita: ' + res + '. Usa il tasto Email.', 6000);
      } else toast('Modifiche salvate');
      route();
    }));
    $('#riapri')?.addEventListener('click', () => go(async () => {
      if (!confirm(`Riaprire ${o.numero} per modificarlo?\n\nTorna in bozza: potrai cambiarlo e poi premere di nuovo "Invia ordine".` +
        (o.email_inviata_at ? '\nL\'email è già partita: al nuovo invio ne partirà una aggiornata.' : ''))) return;
      let r = await sb.from('orders').update({ stato: 'bozza', email_inviata_at: null }).eq('id', o.id).select().single();
      if (r.error) r = await sb.from('orders').update({ stato: 'bozza' }).eq('id', o.id).select().single();
      if (r.error) throw r.error;
      toast('Ordine riaperto: ora puoi modificarlo');
      route();
    }));
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(async () => {
      if (pend.size || flushing) { clearTimeout(flushT); await flush(); }
      if (b.dataset.go === 'inviato' && isRiba(o.pagamento) && !ibanOk(o.iban)) {
        toast('Pagamento Ri.Ba.: inserisci un IBAN valido prima di inviare', 4000); $('#oIban')?.focus(); return; }
      const fuori = scelti.filter(fz);
      if (b.dataset.go === 'inviato' && fuori.length &&
          !confirm(`Attenzione: l'ordine contiene ${fuori.length} referenz${fuori.length === 1 ? 'a' : 'e'} fuori zona:\n\n` +
            fuori.map(w => `• ${w.produttore} · ${w.nome}${w.esclusiva ? ' (' + w.esclusiva + ')' : ''}`).join('\n') + '\n\nInviare comunque?')) return;
      b.disabled = true;
      try {
        const r = await sb.from('orders').update({ stato: b.dataset.go }).eq('id', o.id).select().single();
        if (r.error) throw r.error;
        if (b.dataset.go === 'inviato') {
          const res = await inviaEmailOrdine(o.id);
          const inv = tipoDoc(o) + ' inviat' + (o.tipo === 'ordine' || !o.tipo ? 'o' : 'a');
          if (res === 'ok') toast(inv + ' · email partita a ' + ORD_EMAIL_TO[0], 4000);
          else if (res === 'off') { toast(inv + '. Invio email automatico non attivo: uso la tua app di posta', 4500);
            mailOrdine(Object.assign(o, r.data), [...items.values()], cli); }
          else toast(inv + ', ma l\'email non è partita: ' + res + '. Usa il tasto Email.', 6000);
        } else toast('Ordine ' + lbl(b.dataset.go).toLowerCase());
        route();
      } finally { b.disabled = false; }
    })));
  }
  render();
}, 'ordini');

const ibanNorm = v => String(v || '').replace(/\s+/g, '').toUpperCase();
const ibanFmt = v => ibanNorm(v).replace(/(.{4})(?=.)/g, '$1 ');
function ibanOk(v) {
  const s = ibanNorm(v);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s) || (s.startsWith('IT') && s.length !== 27)) return false;
  let m = 0;
  for (const c of s.slice(4) + s.slice(0, 4)) { const n = parseInt(c, 36); m = (m * (n > 9 ? 100 : 10) + n) % 97; }
  return m === 1;
}
function datiCli(o, c) {
  if (o?.dati_cliente) return o.dati_cliente;
  c = c || {};
  const d = !!c.sped_diversa;
  return { ragione_sociale: c.ragione_sociale, insegna: c.insegna, p_iva: c.p_iva, codice_fiscale: c.codice_fiscale,
    codice_sdi: c.codice_sdi, pec: c.pec, fatt_indirizzo: c.fatt_indirizzo || c.sede_legale, fatt_cap: c.fatt_cap,
    fatt_citta: c.fatt_citta, fatt_prov: c.fatt_prov,
    sped_destinatario: d ? c.sped_destinatario : (c.insegna || c.ragione_sociale), sped_indirizzo: d ? c.sped_indirizzo : c.indirizzo,
    sped_cap: d ? c.sped_cap : c.cap, sped_citta: d ? c.sped_citta : c.citta, sped_telefono: (d && c.sped_telefono) || c.telefono,
    finestra_consegna: c.finestra_consegna, note_consegna: c.note_consegna };
}
const indSped = d => [d.sped_indirizzo, [d.sped_cap, d.sped_citta].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const indFatt = d => [d.fatt_indirizzo, [d.fatt_cap, d.fatt_citta, d.fatt_prov ? '(' + d.fatt_prov + ')' : ''].filter(Boolean).join(' ')].filter(Boolean).join(', ');
function righeDati(d) {
  return [
    'SPEDIZIONE',
    d.sped_destinatario ? `Destinatario: ${d.sped_destinatario}` : '',
    indSped(d) ? `Indirizzo: ${indSped(d)}` : '',
    d.sped_telefono ? `Tel: ${d.sped_telefono}` : '',
    d.finestra_consegna ? `Orari consegna: ${d.finestra_consegna}` : '',
    d.note_consegna ? `Note consegna: ${d.note_consegna}` : '',
    '—',
    'FATTURAZIONE',
    d.ragione_sociale ? `Ragione sociale: ${d.ragione_sociale}` : '',
    indFatt(d) ? `Sede: ${indFatt(d)}` : '',
    d.p_iva ? `P.IVA: ${d.p_iva}` : '',
    d.codice_fiscale ? `C.F.: ${d.codice_fiscale}` : '',
    d.codice_sdi ? `SDI: ${d.codice_sdi}` : '',
    d.pec ? `PEC: ${d.pec}` : ''
  ];
}
async function ordineRiservato(o) {
  const { data: refs } = await sb.from('v_referenze').select('wine_id, wine_label').eq('order_id', o.id);
  const cli = S.clients.find(c => c.id === o.client_id) || {}, ag = S.agents[o.agent_id];
  paint(`<div class="bar"><a href="#/ordini" class="btn line sm">‹<span class="hide-m">&nbsp;Ordini</span></a></div>
    <h1 class="mono" style="font-size:22px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">${esc(o.numero)} ${pill(o.stato)}</h1>
    <div class="inset" style="margin-top:12px">
      <a href="#/cliente/${cli.id}"><div class="row"><span class="av">${esc(ini(cli.insegna || cli.ragione_sociale || '?'))}</span>
        <span style="flex:1;min-width:0"><span class="ttl">${esc(cli.insegna || cli.ragione_sociale || '—')}</span><br>
        <span class="sub">${esc([cli.indirizzo, cli.zona || cli.citta].filter(Boolean).join(' · '))}</span></span>${svg('chev', 14, 'chev')}</div></a>
      ${kv('Agente', ag?.nome || '—')}${kv('Data', dmy(o.inviato_at || o.created_at))}
    </div>
    <div class="group"><h3>Referenze ordinate · ${(refs || []).length}</h3><div class="inset">
      ${(refs || []).map(r => `<div class="row"><span style="flex:1;min-width:0"><span class="ttl" style="font-size:15px">${esc(r.wine_label)}</span></span></div>`).join('')
        || '<div class="empty">Nessuna referenza.</div>'}
    </div></div>
    <div class="empty" style="padding:14px 4px">🔒 Quantità e importi sono visibili solo a ${esc(ag?.nome || "all'agente")}. Le referenze servono per capire cosa proporre ai locali vicini.</div>`);
}
function testoOrdine(o, items, cli) {
  return [
    `${CFG.nome} · ${tipoDoc(o).toLowerCase()} ${o.numero}`,
    o.scade_at && o.stato === 'inviato' ? `Bottiglie bloccate fino al ${dmy(o.scade_at)}: senza pagamento o ritiro entro questa data la prenotazione decade` : '',
    `Cliente: ${cli.insegna || cli.ragione_sociale || '—'}`,
    '—',
    ...items.map(i => [`${i.qty} bt · ${i.wine_label} · ${eur(i.prezzo_unitario)}`,
      num(i.sconto_pct) ? `sconto ${num(i.sconto_pct)}%` : '',
      i.qty_omaggio ? `di cui ${i.qty_omaggio} omaggio` : ''].filter(Boolean).join(' · ')),
    o.sconto_cliente_pct ? `Sconto cliente: ${num(o.sconto_cliente_pct)}%` : '',
    '—',
    `Imponibile: ${eur(o.imponibile)}`,
    o.sconto_pagamento ? `Sconto anticipato: − ${eur(o.sconto_pagamento)}` : '',
    o.omaggio_bt ? `Sconto merce: ${o.omaggio_bt} bt in omaggio` : '',
    `Totale (iva escl.): ${eur(o.totale)}`,
    o.porto_franco ? 'Porto franco' : 'Trasporto a carico del cliente',
    `Pagamento: ${lbl(o.pagamento)}`,
    isRiba(o.pagamento) && o.iban ? `IBAN: ${ibanFmt(o.iban)}` : '',
    o.data_consegna ? `Consegna richiesta: ${dmy(o.data_consegna)}` : '',
    o.note ? `Note: ${o.note}` : '',
    '—',
    ...righeDati(datiCli(o, cli))
  ].filter(Boolean).map(x => x === '—' ? '' : x).join('\n');
}
function pdfOrdine(o, items, cli) {
  const w = window.open('', '_blank');
  if (!w) return toast('Consenti i popup per generare il PDF');
  const ag = S.agents[o.agent_id], D = datiCli(o, cli);
  const righe = items.map(i => {
    const paid = i.qty - (i.qty_omaggio || 0), net = paid * num(i.prezzo_unitario) * (1 - num(i.sconto_pct) / 100);
    return `<tr><td>${esc(i.wine_label)}</td><td class="r">${i.qty}${i.qty_omaggio ? `<small>di cui ${i.qty_omaggio} omaggio</small>` : ''}</td>
      <td class="r">${eur(i.prezzo_unitario)}</td><td class="r">${num(i.sconto_pct) ? num(i.sconto_pct) + '%' : '—'}</td><td class="r">${eur(net)}</td></tr>`;
  }).join('');
  const lordo = items.reduce((a, i) => a + i.qty * num(i.prezzo_unitario), 0);
  w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${tipoDoc(o)} ${esc(o.numero)}</title>
  <style>
    @page{size:A4;margin:16mm}*{box-sizing:border-box}
    body{font:12px/1.45 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#161614;margin:0}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #161614;padding-bottom:10px;margin-bottom:18px}
    .brand{font-size:20px;font-weight:800;letter-spacing:.18em}.muted{color:#6B6B66}
    h1{font-size:15px;margin:0;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-bottom:18px}
    .box h3{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#6B6B66;margin:0 0 4px}
    table{width:100%;border-collapse:collapse}th{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#6B6B66;text-align:left;border-bottom:1px solid #161614;padding:6px 4px}
    td{padding:7px 4px;border-bottom:1px solid #E4E4DE;vertical-align:top}.r{text-align:right;white-space:nowrap}
    small{display:block;color:#1F7A35;font-size:10px}
    .tot{margin:14px 0 0 auto;width:280px}.tot div{display:flex;justify-content:space-between;padding:4px 0}
    .tot .big{font-size:16px;font-weight:800;border-top:2px solid #161614;margin-top:6px;padding-top:8px}
    .note{margin-top:22px;padding:10px 12px;background:#F4F4EF;border-radius:4px}
    footer{margin-top:30px;font-size:10px;color:#6B6B66}
  </style></head><body>
  <header><div><div class="brand">${esc(CFG.nome.toUpperCase())}</div><div class="muted">${o.tipo && o.tipo !== 'ordine' ? tipoDoc(o) : 'Conferma d\'ordine'}</div></div>
    <div style="text-align:right"><h1>${esc(o.numero)}</h1><div class="muted">${dmy(o.inviato_at || o.created_at)} · ${esc(lbl(o.stato))}</div>${o.scade_at && o.stato === 'inviato' ? `<div class="muted">Valida fino al ${dmy(o.scade_at)}</div>` : ''}</div></header>
  <div class="grid">
    <div class="box"><h3>Fatturazione</h3><strong>${esc(D.ragione_sociale || D.insegna || '')}</strong>
      ${indFatt(D) ? `<br>${esc(indFatt(D))}` : ''}
      ${D.p_iva ? `<br>P.IVA ${esc(D.p_iva)}` : ''}${D.codice_fiscale ? ` · C.F. ${esc(D.codice_fiscale)}` : ''}
      ${D.codice_sdi ? `<br>SDI ${esc(D.codice_sdi)}` : ''}${D.pec ? `${D.codice_sdi ? ' · ' : '<br>'}PEC ${esc(D.pec)}` : ''}</div>
    <div class="box"><h3>Spedizione</h3><strong>${esc(D.sped_destinatario || '')}</strong>
      ${indSped(D) ? `<br>${esc(indSped(D))}` : ''}
      ${D.sped_telefono ? `<br>Tel. ${esc(D.sped_telefono)}` : ''}
      ${D.finestra_consegna ? `<br>Orari consegna: ${esc(D.finestra_consegna)}` : ''}
      ${D.note_consegna ? `<br><span class="muted">${esc(D.note_consegna)}</span>` : ''}</div>
    <div class="box"><h3>Condizioni</h3>Pagamento: ${esc(lbl(o.pagamento))}
      ${isRiba(o.pagamento) && o.iban ? `<br>IBAN: <span class="mono">${esc(ibanFmt(o.iban))}</span>` : ''}
      ${o.data_consegna ? `<br>Consegna richiesta: ${dmy(o.data_consegna)}` : ''}
      <br>${o.porto_franco ? 'Porto franco' : 'Trasporto a carico del cliente'}
      ${ag ? `<br>Agente: ${esc(ag.nome)}` : ''}</div>
  </div>
  <table><thead><tr><th>Referenza</th><th class="r">Bt</th><th class="r">Listino</th><th class="r">Sconto</th><th class="r">Importo</th></tr></thead>
    <tbody>${righe}</tbody></table>
  <div class="tot">
    ${lordo - num(o.imponibile) > 0.004 ? `<div><span>Totale listino</span><span>${eur(lordo)}</span></div><div><span>Sconti e omaggi</span><span>− ${eur(lordo - num(o.imponibile))}</span></div>` : ''}
    <div><span>Imponibile</span><span>${eur(o.imponibile)}</span></div>
    ${o.sconto_pagamento ? `<div><span>Sconto pagamento anticipato</span><span>− ${eur(o.sconto_pagamento)}</span></div>` : ''}
    ${o.omaggio_bt ? `<div><span>Omaggio</span><span>${o.omaggio_bt} bt</span></div>` : ''}
    <div class="big"><span>Totale IVA esclusa</span><span>${eur(o.totale)}</span></div>
  </div>
  ${o.note ? `<div class="note"><strong>Note:</strong> ${esc(o.note)}</div>` : ''}
  <footer>Documento generato dal CRM ${esc(CFG.nome)} · prezzi IVA esclusa</footer>
  <script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  w.document.close();
}
async function inviaEmailOrdine(id) {
  try {
    const { data, error } = await sb.functions.invoke('invia-ordine', { body: { order_id: id } });
    if (!error && data?.ok) return 'ok';
    const st = error?.context?.status;
    if (st === 501) return 'off';
    let msg = error?.message || 'errore';
    try { msg = (await error.context.json()).error || msg; } catch (e) {}
    return msg;
  } catch (e) { return String(e.message || e); }
}
const ORD_EMAIL_TO = ['ordini@winealchemist.it', 'info@winealchemist.it'];
const ORD_WHATSAPP = '393914175784'; // Fabio
function mailOrdine(o, items, cli) {
  const text = testoOrdine(o, items, cli);
  const subject = `${tipoDoc(o)} ${o.numero} - ${cli.insegna || cli.ragione_sociale || ''}`;
  const url = `mailto:${ORD_EMAIL_TO.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  window.location.href = url;
}
function waOrdine(o, items, cli) {
  const text = testoOrdine(o, items, cli);
  window.open(`https://wa.me/${ORD_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank');
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
    CrmInsights.breakdown(sb, da, oggi, 'agent', { agent: agente, limit: 10 }),
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
    ${true ? `<div class="row inset" style="margin-bottom:12px"><label for="ag">Agente</label>
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
    ${classifica('Per agente', perAgente)}
    ${isAdmin() ? `<div class="group"><h3>Backup</h3><div class="inset"><div class="row">
      <span style="flex:1"><span class="ttl" style="font-size:15px">Copia completa dei dati</span><br>
      <span class="sub">Automatica ogni 3 giorni nel database. Qui la scarichi in Excel per tenerla anche sul computer.</span></span>
      <button class="btn line sm" id="bkp">${svg('scarica', 15)} Scarica Excel</button></div></div></div>` : ''}
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
  $('#bkp')?.addEventListener('click', () => go(scaricaBackup));
});

function caricaScript(src) {
  return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Libreria non caricata')); document.head.appendChild(s); });
}
async function scaricaBackup() {
  toast('Preparo il backup…');
  if (!window.XLSX) await caricaScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const tab = ['clients', 'client_contacts', 'orders', 'order_items', 'wines', 'activities', 'reminders', 'agents'];
  const wb = XLSX.utils.book_new();
  for (const t of tab) {
    const { data, error } = await sb.from(t).select('*').limit(20000);
    if (error) throw error;
    const rows = (data || []).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v && typeof v === 'object' ? JSON.stringify(v) : v])));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), t.slice(0, 31));
  }
  XLSX.writeFile(wb, `backup-wine-alchemist-${new Date().toLocaleDateString('sv-SE')}.xlsx`);
  toast('Backup scaricato');
}

/* ---------- Provvigioni ---------- */
const PROV = { base: 10, alta: 12, gruppo: 5, soglia: 70000, campioni: 300, scontoCampioni: 25 };
addRoute('provvigioni', async () => {
  if (!S.me.provvigioni) { paint('<div class="empty">Pagina non disponibile per il tuo profilo.</div>'); return; }
  await ensureClients();
  const anno = S.provAnno || new Date().getFullYear();
  const agenti = Object.values(S.agents).filter(a => a.provvigioni && (a.id === S.me.id || (a.dettaglio_visibile_a || []).includes(S.me.id)));
  const ids = agenti.map(x => x.id).sort((x, z) => (x === S.me.id ? -1 : z === S.me.id ? 1 : 0));
  const agId = agenti.length > 1 && (!S.provAgente || !ids.includes(S.provAgente)) ? 'tutti' : (S.provAgente || S.me.id);
  const sel = agId === 'tutti' ? ids : [agId], insieme = sel.length > 1;
  const chi = sel.map(i => S.agents[i]?.nome || '').filter(Boolean).join(' e ');
  const da = new Date(anno - 1, 0, 1).toISOString(), a = new Date(anno + 1, 0, 1).toISOString();
  const { data: ords, error } = await sb.from('orders')
    .select('id, numero, client_id, agent_id, tipo, stato, pagamento, pagato_at, provvigione_pagata_at, totale, imponibile, inviato_at, created_at, omaggio_valore, order_items(wine_id, wine_label, qty, qty_omaggio, prezzo_unitario)')
    .in('agent_id', sel).in('stato', ['inviato', 'confermato', 'evaso']).gte('created_at', da).lt('created_at', a);
  if (error) throw error;
  const y = o => new Date(o.inviato_at || o.created_at).getFullYear();
  const isGr = o => !!S.clients.find(c => c.id === o.client_id)?.gruppo;
  const chiusi = o => o.stato === 'confermato' || o.stato === 'evaso';
  const maturata = o => chiusi(o) && (o.pagamento === 'anticipato' || !!o.pagato_at);   // anticipato = già incassato
  const [{ data: sPrec }, { data: sCur }] = await Promise.all([
    sb.rpc('fatturato_soglia', { p_anno: anno - 1 }), sb.rpc('fatturato_soglia', { p_anno: anno })]);
  const fattPrec = num(sPrec), fattSoglia = num(sCur);   // fatturato congiunto di chi ha le provvigioni, gruppo incluso
  const pct = fattPrec >= PROV.soglia ? PROV.alta : PROV.base;
  const isCamp = o => o.tipo === 'campionatura';
  const campOrd = (ords || []).filter(o => y(o) === anno && isCamp(o));
  const cur = (ords || []).filter(o => y(o) === anno && !isCamp(o)).map(o => {
    const gr = isGr(o), p = gr ? PROV.gruppo : pct;
    return { ...o, gr, p, prov: Math.round(num(o.totale) * p) / 100 };
  }).sort((x, z) => (z.inviato_at || z.created_at).localeCompare(x.inviato_at || x.created_at));
  const ok = cur.filter(maturata), att = cur.filter(o => !maturata(o)), conf = cur.filter(chiusi);
  const daIncassare = att.filter(chiusi).length, daConfermare = att.length - daIncassare;
  const sum = (l, k) => l.reduce((s, o) => s + num(o[k]), 0);
  const fattCat = sum(conf.filter(o => !o.gr), 'totale'), fattGr = sum(conf.filter(o => o.gr), 'totale');
  const provOk = sum(ok, 'prov'), provAtt = sum(att, 'prov');
  const liq = ok.filter(o => o.provvigione_pagata_at), daLiq = ok.filter(o => !o.provvigione_pagata_at);
  const canLiq = isAdmin() || isViewer();
  const statoProv = o => !maturata(o) ? (chiusi(o) ? ['Da incassare', 'orange'] : null)
    : o.provvigione_pagata_at ? ['Ricevuta ' + dmy(o.provvigione_pagata_at), 'green'] : ['Da ricevere', 'blue'];
  const dOrd = o => o.inviato_at || o.created_at;
  const campRighe = campOrd.flatMap(o => (o.order_items || []).map(i => ({ o, i, v: i.qty * num(i.prezzo_unitario) })))
    .concat(cur.flatMap(o => (o.order_items || []).filter(i => i.qty_omaggio).map(i => ({ o, i: { ...i, qty: i.qty_omaggio }, v: 0, om: true }))))
    .sort((x, z) => dOrd(z.o).localeCompare(dOrd(x.o)));
  const campioni = campOrd.reduce((s, o) => s + (o.order_items || []).reduce((t, i) => t + i.qty * num(i.prezzo_unitario), 0), 0)
    + cur.reduce((s, o) => s + Math.max(0, (o.order_items || []).reduce((t, i) => t + (i.qty_omaggio || 0) * num(i.prezzo_unitario), 0) - num(o.omaggio_valore)), 0);
  const perc = v => Math.min(100, Math.round(v * 100));
  const budget = PROV.campioni * sel.length;
  const mesi = [...Array(12)].map((_, m) => { const l = ok.filter(o => new Date(o.inviato_at || o.created_at).getMonth() === m);
    return { m, fatt: sum(l, 'totale'), prov: sum(l, 'prov') }; });
  const maxP = Math.max(1, ...mesi.map(x => x.prov));
  paint(`<div class="bar"><h1>Provvigioni</h1><span style="flex:1"></span>
      <select id="pAnno" class="btn line sm" style="padding-right:26px">${[0, 1, 2].map(k => new Date().getFullYear() - k).map(v =>
        `<option ${v === anno ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    ${agenti.length > 1 ? `<div class="seg" style="margin-bottom:12px"><button data-pag="tutti" class="${insieme ? 'on' : ''}">Insieme</button>${ids.map(i =>
      `<button data-pag="${i}" class="${!insieme && i === agId ? 'on' : ''}">${esc(S.agents[i].nome)}</button>`).join('')}</div>` : ''}
    <div class="kpis">
      ${kpi('Ricevute', eur(sum(liq, 'prov')), `${liq.length} ordini · liquidate da ${CFG.nome}`, liq.length ? 'green' : '')}
      ${kpi('Da ricevere', eur(sum(daLiq, 'prov')), `${daLiq.length} ordini pagati dal cliente`, daLiq.length ? 'blue' : '')}
      ${kpi('In attesa', eur(provAtt), [daIncassare ? `${daIncassare} da incassare` : '', daConfermare ? `${daConfermare} da confermare` : ''].filter(Boolean).join(' · ') || 'nessun ordine', att.length ? 'orange' : '')}
      ${kpi('Aliquota catalogo ' + anno, pct + '%', `${anno - 1} insieme: ${eur(fattPrec)}`)}
    </div>
    <div class="group"><h3>Verso il ${PROV.alta}% nel ${anno + 1}</h3><div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap">
        <span><b class="mono" style="font-size:20px">${eur(fattSoglia)}</b> <span class="sub">di ${eur(PROV.soglia)} · fatturato catalogo ${anno} di ${esc(Object.values(S.agents).filter(a => a.provvigioni).map(a => a.nome).join(' e '))} insieme</span></span>
        <span class="sub">${fattSoglia >= PROV.soglia ? `✓ Soglia superata: nel ${anno + 1} provvigioni al ${PROV.alta}%` : `Mancano ${eur(PROV.soglia - fattSoglia)}`}</span></div>
      <div class="meter"><i style="width:${perc(fattSoglia / PROV.soglia)}%"></i></div>
      <div class="sub" style="margin-top:6px">${insieme ? 'Ordini di ' : 'Di cui ordini di '}${esc(chi)}: ${eur(fattCat + fattGr)}${fattGr ? ` (gruppo ${eur(fattGr)})` : ''}</div>
      <div class="sub" style="margin-top:8px">Se il fatturato annuo complessivo supera ${eur(PROV.soglia)}, l'anno successivo la provvigione sul catalogo sale al ${PROV.alta}%; se scende sotto, torna al ${PROV.base}%. Gli ordini dei ristoranti del gruppo hanno provvigione al ${PROV.gruppo}% ma contano per la soglia.</div>
    </div></div>
    <div class="group"><h3>Campionatura ${anno}</h3><div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap">
        <span><b class="mono" style="font-size:20px">${eur(campioni)}</b> <span class="sub">usati di ${eur(budget)}</span></span>
        <span class="sub" style="${campioni > budget ? 'color:var(--orange)' : ''}">${campioni > budget
          ? `Budget superato di ${eur(campioni - budget)}: i campioni extra si acquistano con sconto ${PROV.scontoCampioni}%`
          : `Restano ${eur(budget - campioni)}`}</span></div>
      <div class="meter ${campioni > budget ? 'over' : ''}"><i style="width:${perc(campioni / budget)}%"></i></div>
      <div class="sub" style="margin-top:8px">Conta il valore a listino degli ordini di tipo «Campionatura» e delle bottiglie segnate come "Omaggio" negli ordini, escluse quelle della promo sconto merce.</div>
      ${campRighe.length ? `<div class="inset" style="margin-top:10px">${campRighe.map(({ o, i, v, om }) => `<a href="#/ordine/${o.id}"><div class="row">
        <span style="flex:1;min-width:0"><span class="ttl" style="font-size:14px">${esc(i.wine_label || '')}</span><br>
          <span class="sub">${dmy(dOrd(o))} · ${esc(nomeCli(o.client_id))} · ${esc(o.numero)}${om ? ' · omaggio in ordine' : ''}${insieme ? ' · ' + esc(S.agents[o.agent_id]?.nome || '') : ''}</span></span>
        <span class="mono">${i.qty} bt${v ? ' · ' + eur(v) : ''}</span></div></a>`).join('')}</div>` : ''}
    </div></div>
    <div class="group"><h3>Andamento mensile</h3><div class="card">
      <div class="spark" style="height:90px;gap:6px">${mesi.map(x => `<i class="${x.m === new Date().getMonth() && anno === new Date().getFullYear() ? 'cur' : ''}"
        style="height:${Math.max(4, Math.round(x.prov / maxP * 100))}%" title="${new Date(anno, x.m).toLocaleDateString('it-IT', { month: 'long' })}: ${eur(x.prov)} su ${eur(x.fatt)}"></i>`).join('')}</div>
      <div style="display:flex;gap:6px;margin-top:4px">${mesi.map(x => `<span class="sub" style="flex:1;text-align:center;font-size:10.5px">${new Date(anno, x.m).toLocaleDateString('it-IT', { month: 'narrow' })}</span>`).join('')}</div>
    </div></div>
    <div class="group"><h3 style="display:flex;align-items:center;gap:8px">Dettaglio ordini ${anno}<span style="flex:1"></span>
      ${canLiq && daLiq.length ? `<button class="btn line sm" id="liqTutte" style="text-transform:none;letter-spacing:0">Segna ricevute tutte (${daLiq.length} · ${eur(sum(daLiq, 'prov'))})</button>` : ''}</h3><div class="inset">
      ${cur.map(o => `<a href="#/ordine/${o.id}"><div class="row">
        <span style="flex:1;min-width:0"><span class="ttl mono" style="font-size:15px">${esc(o.numero)}</span>
          ${o.gr ? '<span class="pill" style="background:var(--gold-t);color:var(--gold);margin-left:6px">Gruppo</span>' : ''}${insieme ? `<span class="pill" style="margin-left:6px">${esc(S.agents[o.agent_id]?.nome || '')}</span>` : ''}<br>
          <span class="sub">${esc(nomeCli(o.client_id))} · ${dmy(o.inviato_at || o.created_at)} · netto ${eur(o.totale)} × ${o.p}%</span></span>
        <span class="mono" style="font-weight:700${maturata(o) ? '' : ';color:var(--fg2)'}">${eur(o.prov)}</span>${(sp => sp ? `<span class="pill" style="background:var(--${sp[1]}-t);color:var(--${sp[1]})">${sp[0]}</span>` : pill(o.stato))(statoProv(o))}
        ${canLiq && maturata(o) ? `<button class="btn line sm" data-liq="${o.id}" data-v="${o.provvigione_pagata_at ? 0 : 1}" title="${o.provvigione_pagata_at ? 'Annulla: provvigione non ancora ricevuta' : 'Segna provvigione ricevuta'}">${o.provvigione_pagata_at ? '↺' : '✓'}</button>` : ''}</div></a>`).join('')
        || '<div class="empty">Nessun ordine inviato in questo anno.</div>'}
    </div></div>
    <div class="empty" style="padding:12px 4px">«Ricevuta» indica che ${esc(CFG.nome)} ha liquidato la provvigione. La provvigione spetta quando l'ordine è pagato dal cliente: subito per il pagamento anticipato, per Bonifico e Ri.Ba. quando l'ordine viene segnato «pagato». Calcolo sul netto dell'ordine: dopo sconti di riga, sconto cliente e sconto pagamento anticipato; IVA e trasporto esclusi. Le bottiglie in omaggio non generano provvigione.</div>`);
  $('#pAnno').addEventListener('change', e => { S.provAnno = +e.target.value; route(); });
  document.querySelectorAll('[data-pag]').forEach(b => b.addEventListener('click', () => { S.provAgente = b.dataset.pag; route(); }));
  const liquida = (idsOrd, v) => go(async () => {
    const r = await sb.rpc('segna_provvigione_pagata', { p_orders: idsOrd, p_pagata: v });
    if (r.error) throw r.error;
    toast(v ? `${r.data} provvigion${r.data === 1 ? 'e segnata ricevuta' : 'i segnate ricevute'}` : 'Provvigione di nuovo da ricevere'); route();
  });
  document.querySelectorAll('[data-liq]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation(); liquida([b.dataset.liq], b.dataset.v === '1'); }));
  $('#liqTutte')?.addEventListener('click', () => {
    if (confirm(`Segnare come ricevute ${daLiq.length} provvigioni per ${eur(sum(daLiq, 'prov'))}?`)) liquida(daLiq.map(o => o.id), true); });
}, 'provvigioni');

/* ---------- avvio ---------- */
function fatal(e, dettaglio) {
  window.CRM_AVVIATO = true; hideSplash();
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
      fase('Carico la libreria…');
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
    await boot();
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
