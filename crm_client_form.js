// Scheda cliente HoReCa: schema dichiarativo -> liste raggruppate stile iOS
const CrmClientForm = (() => {
  const OPT = {
    tipologia: [['ristorante','Ristorante'],['enoteca','Enoteca / wine bar'],['bar','Bar / cocktail bar'],
                ['hotel','Hotel'],['gastronomia','Gastronomia'],['altro','Altro']],
    stato: [['prospect','Prospect'],['contattato','Contattato'],['visitato','Visitato'],['trattativa','In trattativa'],
            ['attivo','Attivo'],['dormiente','Dormiente'],['perso','Perso']],
    priorita: [['A','A · strategico'],['B','B · interessante'],['C','C · occasionale']],
    fascia: [['bistrot','Bistrot / trattoria'],['media','Fascia media'],['alta','Fascia alta'],['fine_dining','Fine dining']],
    ruolo: [['titolare','Titolare'],['sommelier','Sommelier'],['buyer','Buyer / resp. acquisti'],['direttore','Direttore / maître'],
            ['chef','Chef'],['bar_manager','Bar manager'],['amministrazione','Amministrazione'],['altro','Altro']],
    canale: [['telefono','Telefono'],['whatsapp','WhatsApp'],['email','Email'],['di_persona','Di persona']],
    tipologie: ['rosso','bianco','rosato','orange','bollicine italiane','champagne','dolce/passito','fortificato'],
    stili: ['naturale','biologico','biodinamico','vitigni autoctoni','piccoli produttori','grandi etichette',
            'metodo classico','vecchie annate','affinamento in anfora','bassa gradazione'],
    regioni: ['Piemonte','Lombardia','Veneto','Trentino-Alto Adige','Friuli-Venezia Giulia','Liguria','Emilia-Romagna',
              'Toscana','Umbria','Marche','Lazio','Abruzzo','Molise','Campania','Puglia','Basilicata','Calabria',
              'Sicilia','Sardegna','Valle d\'Aosta','Francia','Spagna','Germania','Austria','Portogallo','Resto del mondo'],
    guide: ['Michelin stella','Michelin Bib Gourmand','Michelin selezione','Gambero Rosso','Guida Espresso',
            'Slow Food Osterie','50 Top Pizza','Vini Buoni d\'Italia'],
    giorni: ['lun','mar','mer','gio','ven','sab','dom'],
    pagamento: ['Rimessa diretta','Bonifico 30 gg DFFM','Bonifico 60 gg DFFM','RiBa 30 gg','RiBa 60 gg','Contrassegno']
  };

  // type: text | tel | email | url | number | money | select | chips | bool | textarea | list(datalist)
  const SECTIONS = [
    { id: 'anagrafica', title: 'Locale', fields: [
      { k: 'insegna', l: 'Insegna', t: 'text', req: true, venueSearch: true },
      { k: 'ragione_sociale', l: 'Ragione sociale', t: 'text', req: true },
      { k: 'tipologia', l: 'Tipologia', t: 'select', o: OPT.tipologia },
      { k: 'indirizzo', l: 'Indirizzo', t: 'text' },
      { k: 'cap', l: 'CAP', t: 'text', inputmode: 'numeric', max: 5 },
      { k: 'citta', l: 'Città', t: 'text' },
      { k: 'zona', l: 'Zona', t: 'text', placeholder: 'es. Isola, Navigli, Brera' },
      { k: 'telefono', l: 'Telefono locale', t: 'tel' },
      { k: 'email', l: 'Email locale', t: 'email' },
      { k: 'sito', l: 'Sito', t: 'url' },
      { k: 'instagram', l: 'Instagram', t: 'text', placeholder: '@account' },
      { k: 'descrizione', l: 'Descrizione', t: 'textarea' }
    ]},
    { id: 'commerciale', title: 'Commerciale', fields: [
      { k: 'stato', l: 'Stato', t: 'select', o: OPT.stato },
      { k: 'priorita', l: 'Priorità', t: 'select', o: OPT.priorita, empty: true },
      { k: 'potenziale_annuo', l: 'Potenziale annuo', t: 'money' },
      { k: 'fornitori_attuali', l: 'Fornitori / distributori attuali', t: 'textarea' },
      { k: 'guide', l: 'Guide e riconoscimenti', t: 'chips', o: OPT.guide }
    ]},
    { id: 'sala', title: 'Sala e cucina', fields: [
      { k: 'fascia', l: 'Fascia', t: 'select', o: OPT.fascia, empty: true },
      { k: 'cucina', l: 'Cucina', t: 'text', placeholder: 'es. milanese, pesce, fusion' },
      { k: 'coperti', l: 'Coperti', t: 'number' },
      { k: 'scontrino_medio', l: 'Scontrino medio', t: 'money' }
    ]},
    { id: 'carta', title: 'Carta dei vini', fields: [
      { k: 'n_referenze_carta', l: 'Referenze in carta', t: 'number' },
      { k: 'prezzo_medio_carta', l: 'Prezzo medio bottiglia in carta', t: 'money' },
      { k: 'ricarico_medio', l: 'Ricarico medio (×)', t: 'number', step: '0.1', placeholder: 'es. 2.8' },
      { k: 'vino_calice', l: 'Vino al calice', t: 'bool' },
      { k: 'n_etichette_calice', l: 'Etichette al calice', t: 'number', showIf: v => v.vino_calice },
      { k: 'sistema_mescita', l: 'Sistema di mescita', t: 'text', placeholder: 'es. Coravin, Enomatic', showIf: v => v.vino_calice },
      { k: 'cantina_capacita', l: 'Capienza cantina (bt)', t: 'number' },
      { k: 'cantina_climatizzata', l: 'Cantina climatizzata', t: 'bool' },
      { k: 'tipologie_pref', l: 'Tipologie richieste', t: 'chips', o: OPT.tipologie },
      { k: 'stili_pref', l: 'Stili / filosofia', t: 'chips', o: OPT.stili },
      { k: 'regioni_pref', l: 'Territori in carta', t: 'chips', o: OPT.regioni }
    ]},
    { id: 'operativita', title: 'Visite e consegne', fields: [
      { k: 'giorni_chiusura', l: 'Giorni di chiusura', t: 'chips', o: OPT.giorni },
      { k: 'chiusura_stagionale', l: 'Chiusura stagionale', t: 'text', placeholder: 'es. 2ª e 3ª settimana di agosto' },
      { k: 'orari_visita', l: 'Momento migliore per la visita', t: 'text', placeholder: 'es. mar-ven 15:30-18' },
      { k: 'finestra_consegna', l: 'Finestra di consegna', t: 'text', placeholder: 'es. 9-11:30' },
      { k: 'note_consegna', l: 'Note consegna', t: 'textarea', placeholder: 'ZTL, ingresso merci, citofono…' }
    ]},
    { id: 'amministrazione', title: 'Fatturazione', fields: [
      { k: 'p_iva', l: 'Partita IVA', t: 'text', inputmode: 'numeric', max: 11 },
      { k: 'codice_fiscale', l: 'Codice fiscale', t: 'text', max: 16, upper: true },
      { k: 'codice_sdi', l: 'Codice SDI', t: 'text', max: 7, upper: true },
      { k: 'pec', l: 'PEC', t: 'email' },
      { k: 'sede_legale', l: 'Sede legale', t: 'text' },
      { k: 'termini_pagamento', l: 'Termini di pagamento', t: 'list', o: OPT.pagamento },
      { k: 'modalita_pagamento', l: 'Note pagamento', t: 'text' },
      { k: 'sconto_concordato_pct', l: 'Sconto concordato (%)', t: 'number', placeholder: 'es. 5', min: 0, max: 100 }
    ]},
    { id: 'note', title: 'Note', fields: [{ k: 'note', l: 'Note', t: 'textarea' }] }
  ];

  const CONTACT_FIELDS = [
    { k: 'ruolo', l: 'Ruolo', t: 'select', o: OPT.ruolo },
    { k: 'nome', l: 'Nome', t: 'text', req: true },
    { k: 'cognome', l: 'Cognome', t: 'text' },
    { k: 'telefono', l: 'Cellulare', t: 'tel' },
    { k: 'email', l: 'Email', t: 'email' },
    { k: 'canale_pref', l: 'Canale preferito', t: 'select', o: OPT.canale, empty: true },
    { k: 'reperibilita', l: 'Reperibilità', t: 'text', placeholder: 'es. dopo le 15' },
    { k: 'decisore', l: 'Decide gli acquisti', t: 'bool' },
    { k: 'principale', l: 'Contatto principale', t: 'bool' },
    { k: 'note', l: 'Note', t: 'textarea', placeholder: 'Gusti, formazione (AIS, WSET…), preferenze' }
  ];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const opts = (o, v, empty) => (empty ? '<option value=""></option>' : '')
    + o.map(([val, lab]) => `<option value="${val}"${val === v ? ' selected' : ''}>${esc(lab)}</option>`).join('');

  function field(f, v, ro, prefix = '') {
    const name = prefix + f.k, val = v[f.k], dis = ro ? ' disabled' : '';
    if (f.showIf && !f.showIf(v)) return '';
    let input;
    switch (f.t) {
      case 'select':
        input = `<select name="${name}"${dis}>${opts(f.o, val, f.empty)}</select>`; break;
      case 'bool':
        input = `<input type="checkbox" role="switch" class="ios-switch" name="${name}"${val ? ' checked' : ''}${dis}>`; break;
      case 'textarea':
        return `<div class="row col"><label>${esc(f.l)}</label><textarea name="${name}" rows="3"
          placeholder="${esc(f.placeholder ?? '')}"${dis}>${esc(val)}</textarea></div>`;
      case 'chips':
        return `<div class="row col"><label>${esc(f.l)}</label><div class="chips" data-name="${name}">${
          f.o.map(o => `<button type="button" class="chip${(val ?? []).includes(o) ? ' on' : ''}"
            data-v="${esc(o)}"${dis}>${esc(o)}</button>`).join('')}</div></div>`;
      case 'list':
        input = `<input name="${name}" list="dl-${name}" value="${esc(val)}"${dis}>
          <datalist id="dl-${name}">${f.o.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`; break;
      default: {
        const type = { money: 'number', number: 'number', tel: 'tel', email: 'email', url: 'url' }[f.t] ?? 'text';
        const step = f.t === 'money' ? '0.01' : (f.step ?? '1');
        input = `<input type="${type}" name="${name}" value="${esc(val)}"${type === 'number' ? ` step="${step}" min="0"` : ''}
          ${f.inputmode ? `inputmode="${f.inputmode}"` : ''} ${f.max ? `maxlength="${f.max}"` : ''}
          placeholder="${esc(f.placeholder ?? '')}" ${f.req ? 'required' : ''} ${f.upper ? 'data-upper' : ''}
          ${f.venueSearch ? 'data-venue-search autocomplete="off"' : ''}${dis}>`;
      }
    }
    return `<div class="row"><label>${esc(f.l)}</label>${input}</div>`;
  }

  const contactCard = (c, i, ro = false) => `<div class="inset contact" data-i="${i}" data-id="${c.id ?? ''}">
    ${CONTACT_FIELDS.map(f => field(f, { ruolo: 'sommelier', ...c }, ro, `c${i}.`)).join('')}
    ${ro ? '' : '<button type="button" class="row danger" data-del-contact>Rimuovi contatto</button>'}</div>`;

  // ro = true per clienti di altri agenti (sola lettura, coerente con RLS)
  function render(client = {}, contacts = [], { ro = false } = {}) {
    const v = { tipologia: 'ristorante', stato: 'prospect', citta: 'Milano', ...client };
    const sec = s => `<section class="group" data-sec="${s.id}"><h3>${s.title}</h3>
      <div class="inset">${s.fields.map(f => field(f, v, ro)).join('')}</div></section>`;
    return `<form class="client-form">
      ${sec(SECTIONS[0])}
      <section class="group" data-sec="contatti"><h3>Referenti</h3>
        <div class="contacts">${contacts.map((c, i) => contactCard(c, i, ro)).join('')}</div>
        ${ro ? '' : '<button type="button" class="add-row" data-add-contact>＋ Aggiungi referente</button>'}
      </section>
      ${SECTIONS.slice(1).map(sec).join('')}
    </form>`;
  }

  const castField = (f, raw) => {
    if (f.t === 'number' || f.t === 'money') return raw === '' ? null : Number(raw);
    const s = String(raw ?? '').trim();
    return s === '' ? null : (f.upper ? s.toUpperCase() : s);
  };

  function read(form) {
    const fd = new FormData(form);
    const out = {}, contacts = [];
    const all = SECTIONS.flatMap(s => s.fields);
    for (const f of all) {
      if (f.t === 'bool') out[f.k] = form.elements[f.k]?.checked ?? false;
      else if (f.t === 'chips') out[f.k] = [...form.querySelectorAll(`[data-name="${f.k}"] .chip.on`)].map(b => b.dataset.v);
      else if (fd.has(f.k)) out[f.k] = castField(f, fd.get(f.k));
    }
    form.querySelectorAll('.contact').forEach(el => {
      const i = el.dataset.i, c = el.dataset.id ? { id: el.dataset.id } : {};
      for (const f of CONTACT_FIELDS) {
        const n = `c${i}.${f.k}`;
        c[f.k] = f.t === 'bool' ? form.elements[n].checked : castField(f, fd.get(n));
      }
      if (c.nome) contacts.push(c);
    });
    return { client: out, contacts };
  }

  function validate({ client, contacts }) {
    const e = [];
    if (!client.insegna) e.push('Insegna obbligatoria');
    if (!client.ragione_sociale) e.push('Ragione sociale obbligatoria');
    if (client.p_iva && !/^\d{11}$/.test(client.p_iva)) e.push('Partita IVA non valida');
    if (client.codice_sdi && !/^[A-Z0-9]{7}$/.test(client.codice_sdi)) e.push('Codice SDI non valido');
    if (contacts.filter(c => c.principale).length > 1) e.push('Un solo contatto principale');
    return e;
  }

  // Eventi: chips, add/remove referente, re-render condizionali (vino al calice)
  function bind(root, { onVenueInput, rerender } = {}) {
    root.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (chip && !chip.disabled) chip.classList.toggle('on');
      if (e.target.closest('[data-del-contact]')) e.target.closest('.contact').remove();
      if (e.target.closest('[data-add-contact]')) {
        const box = root.querySelector('.contacts');
        const i = Date.now();
        box.insertAdjacentHTML('beforeend', contactCard({}, i));
        box.lastElementChild.querySelector('input[name$=".nome"]')?.focus();
      }
    });
    root.addEventListener('change', e => { if (e.target.name === 'vino_calice') rerender?.(read(root.querySelector('form'))); });
    let t;
    root.addEventListener('input', e => {
      if (!e.target.matches('[data-venue-search]')) return;
      clearTimeout(t);
      t = setTimeout(() => onVenueInput?.(e.target.value), 600);
    });
  }

  // Salvataggio: client + diff contatti
  async function save(sb, { client, contacts }, { id, prevContactIds = [] } = {}) {
    const db = sb.schema('crm');
    const { data: saved, error } = id
      ? await db.from('clients').update(client).eq('id', id).select().single()
      : await db.from('clients').insert(client).select().single();
    if (error) throw error;
    const keep = contacts.filter(c => c.id).map(c => c.id);
    const del = prevContactIds.filter(x => !keep.includes(x));
    if (del.length) { const r = await db.from('client_contacts').delete().in('id', del); if (r.error) throw r.error; }
    // principale: prima si azzera, poi si scrive (indice unico parziale)
    await db.from('client_contacts').update({ principale: false }).eq('client_id', saved.id).eq('principale', true);
    if (contacts.length) {
      const rows = contacts.map(c => ({ ...c, client_id: saved.id }));
      const upd = rows.filter(r => r.id), ins = rows.filter(r => !r.id).map(({ id: _, ...r }) => r);
      if (upd.length) { const r = await db.from('client_contacts').upsert(upd); if (r.error) throw r.error; }
      if (ins.length) { const r = await db.from('client_contacts').insert(ins); if (r.error) throw r.error; }
    }
    return saved;
  }

  return { OPT, SECTIONS, CONTACT_FIELDS, render, read, validate, bind, save };
})();
