/**
 * Home Check Card — Home Assistant dashboard card. Version 1.6
 * Copyright (c) 2026 luigi-regolo. SPDX-License-Identifier: GPL-3.0-only.
 * Quick actions are optional: turn off lights, TVs and plugs, close covers, arm or disarm the alarm with a code. Locks are never commanded.
 * No external scripts, fonts, analytics or assets.
 */
(() => {
  'use strict';

  const VERSION = '1.6';
  const TAG = 'home-check-card';
  const EDITOR_TAG = 'home-check-card-editor';

  /* ---------------------------------------------------------------- data */
  const KINDS = {
    door:   { label: 'Porte e serrature', help: 'Serrature (lock) e sensori porta o porta garage.', icon: 'mdi:door-closed-lock' },
    window: { label: 'Finestre',          help: 'Sensori finestra o apertura.',                       icon: 'mdi:window-open-variant' },
    light:  { label: 'Luci',              help: 'Luci accese.',                                        icon: 'mdi:lightbulb-on' },
    tv:     { label: 'TV e media',        help: 'Media player di tipo TV accesi.',                     icon: 'mdi:television' },
    cover:  { label: 'Tapparelle',        help: 'Tapparelle e tende non chiuse.',                      icon: 'mdi:blinds-horizontal' },
    plug:   { label: 'Prese',             help: 'Prese (switch di tipo presa) accese.',                icon: 'mdi:power-plug' },
    leak:   { label: 'Perdite',           help: 'Sensori di perdita acqua.',                           icon: 'mdi:water-alert' },
    alarm:  { label: 'Allarme',           help: 'Esco: segnala l\u2019allarme in casa da disattivare. Notte: richiede \u00abin casa\u00bb. Vacanza: richiede \u00abfuori casa\u00bb.', icon: 'mdi:shield-check' }
  };
  const KIND_ORDER = ['door', 'window', 'light', 'tv', 'cover', 'plug', 'leak', 'alarm'];
  const PROFILES = {
    esco:    { label: 'Esco di casa', short: 'Esco',    ok: 'Puoi uscire' },
    notte:   { label: 'Notte',        short: 'Notte',   ok: 'Puoi andare a letto' },
    vacanza: { label: 'Vacanza',      short: 'Vacanza', ok: 'Puoi partire' }
  };
  const PROFILE_IDS = Object.keys(PROFILES);
  const DEFAULT_CATS = {
    esco:    { door: false, window: true, light: true, tv: true, cover: false, plug: true, leak: true, alarm: true },
    notte:   { door: true,  window: true, light: true, tv: true, cover: true,  plug: true, leak: true, alarm: true },
    vacanza: { door: true,  window: true, light: true, tv: true, cover: true,  plug: true, leak: true, alarm: true }
  };
  const DEFAULTS = {
    eyebrow: 'HOME CHECK CARD', title: 'Controllo casa', show_eyebrow: true, show_title: true,
    theme_mode: 'auto', max_rows: 2, row_tap: true, default_profile: 'esco',
    row_actions: true, bulk_action: true, cover_close: false, alarm_panel: true
  };
  const LV_HEAD = { ok: 'Tutto a posto', warn: 'Da sistemare', crit: 'Critico', unk: 'Non verificabile', none: 'Nessun controllo' };
  const NODE_ICON = { ok: 'mdi:check', warn: 'mdi:alert', crit: 'mdi:alert', unk: 'mdi:help', none: 'mdi:minus' };
  const TAG_TXT = { warn: 'Da sistemare', crit: 'Critico', unk: 'Non verificabile' };
  const ACT = {
    light: { dom: 'light', svc: 'turn_off', label: 'Spegni' },
    tv: { dom: 'media_player', svc: 'turn_off', label: 'Spegni' },
    plug: { dom: 'switch', svc: 'turn_off', label: 'Spegni' },
    cover: { dom: 'cover', svc: 'close_cover', label: 'Chiudi' }
  };
  const ALARM_BTN = { esco: 'Disattiva allarme', notte: 'Inserisci in casa', vacanza: 'Inserisci fuori casa' };
  const ALARM_REQ = { esco: 'Disinserito', notte: 'Inserito in casa', vacanza: 'Inserito fuori casa' };
  const RANK = { ok: 0, none: 0, unk: 1, warn: 2, crit: 3 };
  const IS_PHONE = Math.min(window.screen ? window.screen.width : 9999, window.screen ? window.screen.height : 9999) < 600;

  /* ------------------------------------------------------------- helpers */
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const ic = (name) => '<ha-icon icon="' + esc(name) + '"></ha-icon>';
  const dur = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? m + ' min' : (m < 2880 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' g'); };
  const cleanTitle = (t) => String(t == null ? '' : t).trim().replace(/\.+$/, '');

  function normalizeConfig(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Configurazione non valida');
    const c = Object.assign({}, DEFAULTS, raw);
    const n = parseInt(c.max_rows, 10);
    c.max_rows = Math.max(1, Math.min(5, isFinite(n) ? n : DEFAULTS.max_rows));
    if (['auto', 'light', 'dark'].indexOf(c.theme_mode) < 0) c.theme_mode = 'auto';
    c.show_eyebrow = c.show_eyebrow !== false;
    c.show_title = c.show_title !== false;
    c.row_tap = c.row_tap !== false;
    c.row_actions = c.row_actions !== false;
    c.bulk_action = c.bulk_action !== false;
    c.cover_close = c.cover_close === true;
    c.alarm_panel = c.alarm_panel !== false;
    if (PROFILE_IDS.indexOf(c.default_profile) < 0) c.default_profile = 'esco';
    c.excluded = Array.isArray(raw.excluded) ? raw.excluded.filter((x) => typeof x === 'string') : [];
    c.rooms = Array.isArray(raw.rooms)
      ? raw.rooms.filter((r) => r && typeof r.area_id === 'string').map((r) => ({ area_id: r.area_id, on: r.on !== false }))
      : null;
    c.categories = {};
    PROFILE_IDS.forEach((p) => {
      const src = (raw.categories && raw.categories[p]) || {};
      c.categories[p] = {};
      KIND_ORDER.forEach((k) => { c.categories[p][k] = typeof src[k] === 'boolean' ? src[k] : DEFAULT_CATS[p][k]; });
    });
    c.alarm_entity = typeof raw.alarm_entity === 'string' && raw.alarm_entity.indexOf('alarm_control_panel.') === 0 ? raw.alarm_entity : '';
    c.simulation_entity = typeof raw.simulation_entity === 'string' && raw.simulation_entity.indexOf('.') > 0 ? raw.simulation_entity : '';
    return c;
  }

  function classify(entityId, st) {
    const d = entityId.split('.')[0];
    const dc = st && st.attributes ? st.attributes.device_class : undefined;
    if (d === 'lock') return 'door';
    if (d === 'binary_sensor') {
      if (dc === 'door' || dc === 'garage_door') return 'door';
      if (dc === 'window' || dc === 'opening') return 'window';
      if (dc === 'moisture') return 'leak';
      return null;
    }
    if (d === 'light') return 'light';
    if (d === 'cover') return ['garage', 'gate', 'door'].indexOf(dc) >= 0 ? null : 'cover';
    if (d === 'switch') return dc === 'outlet' ? 'plug' : null;
    if (d === 'media_player') return dc === 'tv' ? 'tv' : null;
    return null;
  }

  let _discCache = { k: null, v: [] };
  function discover(hass) {
    if (!hass || !hass.entities || !hass.states) return [];
    const key = [hass.entities, hass.devices, Object.keys(hass.states).length];
    if (_discCache.k && _discCache.k[0] === key[0] && _discCache.k[1] === key[1] && _discCache.k[2] === key[2]) return _discCache.v;
    const out = [];
    const dev = hass.devices || {};
    Object.keys(hass.entities).forEach((id) => {
      const e = hass.entities[id];
      if (!e || e.hidden || e.entity_category) return;
      const st = hass.states[e.entity_id || id];
      if (!st) return;
      const kind = classify(e.entity_id || id, st);
      if (!kind) return;
      const area = e.area_id || (e.device_id && dev[e.device_id] ? dev[e.device_id].area_id : null);
      if (!area) return;
      out.push({ entity_id: e.entity_id || id, area_id: area, kind: kind });
    });
    _discCache = { k: key, v: out };
    return out;
  }

  function areaName(hass, id) {
    const a = hass && hass.areas ? hass.areas[id] : null;
    return a && a.name ? a.name : id;
  }

  /* discovered areas merged with the saved selection (saved order first) */
  function roomList(hass, cfg) {
    const tracked = discover(hass);
    const ids = [];
    tracked.forEach((t) => { if (ids.indexOf(t.area_id) < 0) ids.push(t.area_id); });
    const byName = (a, b) => areaName(hass, a).localeCompare(areaName(hass, b), 'it');
    if (!cfg.rooms) return ids.sort(byName).map((id) => ({ area_id: id, on: true }));
    const out = [];
    cfg.rooms.forEach((r) => { if (ids.indexOf(r.area_id) >= 0) out.push({ area_id: r.area_id, on: r.on }); });
    ids.filter((id) => !out.some((r) => r.area_id === id)).sort(byName).forEach((id) => out.push({ area_id: id, on: false }));
    return out;
  }

  /* --------------------------------------------------------- evaluation */
  function evalEntity(kind, st) {
    const s = st.state;
    if (s === 'unavailable' || s === 'unknown') return { lv: 'unk', detail: 'sensore non disponibile' };
    const since = st.last_changed ? Date.now() - new Date(st.last_changed).getTime() : 0;
    const dd = since > 0 ? ' da ' + dur(since) : '';
    switch (kind) {
      case 'door':
        if (s === 'locked' || s === 'off') return { lv: 'ok', detail: s === 'locked' ? 'chiusa e bloccata' : 'chiusa' };
        if (s === 'on' || s === 'open') return { lv: 'warn', detail: 'aperta' + dd };
        return { lv: 'warn', detail: 'non bloccata' };
      case 'window':
        return s === 'on' ? { lv: 'warn', detail: 'aperta' + dd } : { lv: 'ok', detail: 'chiusa' };
      case 'light':
        return s === 'on' ? { lv: 'warn', detail: 'accesa' + dd } : { lv: 'ok', detail: 'spenta' };
      case 'tv':
        return (s === 'off' || s === 'standby') ? { lv: 'ok', detail: 'spenta' } : { lv: 'warn', detail: 'accesa' + dd };
      case 'cover':
        return s === 'closed' ? { lv: 'ok', detail: 'chiusa' } : { lv: 'warn', detail: s === 'opening' || s === 'closing' ? 'in movimento' : 'aperta' };
      case 'plug':
        return s === 'on' ? { lv: 'warn', detail: 'accesa' + dd } : { lv: 'ok', detail: 'spenta' };
      default:
        return s === 'on' ? { lv: 'crit', detail: 'perdita rilevata' } : { lv: 'ok', detail: 'asciutto' };
    }
  }

  function evalAlarm(state, profile) {
    const S = { armed_home: 'inserito in casa', armed_night: 'inserito notte', armed_away: 'inserito fuori casa', armed_vacation: 'inserito vacanza', armed_custom_bypass: 'inserito', disarmed: 'disinserito' };
    if (state === 'unavailable' || state === 'unknown' || state == null) return { lv: 'unk', detail: 'stato non disponibile' };
    if (state === 'triggered') return { lv: 'crit', detail: 'allarme scattato' };
    if (state === 'arming' || state === 'pending' || state === 'disarming') {
      return profile === 'esco' && state === 'arming' ? { lv: 'ok', detail: 'in inserimento' } : { lv: 'unk', detail: 'in corso' };
    }
    const home = state === 'armed_home' || state === 'armed_night';
    const away = state === 'armed_away' || state === 'armed_vacation';
    const txt = S[state] || state;
    if (profile === 'esco') return home ? { lv: 'warn', detail: txt + ' \u00b7 disattivalo' } : { lv: 'ok', detail: txt };
    if (profile === 'notte') return home ? { lv: 'ok', detail: txt } : { lv: 'warn', detail: txt + ' \u00b7 inseriscilo in casa' };
    return away ? { lv: 'ok', detail: txt } : { lv: 'warn', detail: txt + ' \u00b7 inseriscilo fuori casa' };
  }

  function entityName(hass, st, entityId, area) {
    let n = (st && st.attributes && st.attributes.friendly_name) || entityId;
    if (area && n.toLowerCase().indexOf(area.toLowerCase() + ' ') === 0) {
      const t = n.slice(area.length).trim();
      if (t) n = cap(t);
    }
    return n;
  }

  function compute(hass, cfg, profile) {
    const cats = cfg.categories[profile];
    const rooms = roomList(hass, cfg).filter((r) => r.on);
    const tracked = discover(hass);
    const checks = [];
    rooms.forEach((r) => {
      const an = areaName(hass, r.area_id);
      tracked.forEach((t) => {
        if (t.area_id !== r.area_id || !cats[t.kind] || cfg.excluded.indexOf(t.entity_id) >= 0) return;
        const st = hass.states[t.entity_id]; if (!st) return;
        const ev = evalEntity(t.kind, st);
        checks.push({ room: an, area_id: r.area_id, entity_id: t.entity_id, name: entityName(hass, st, t.entity_id, an), kind: t.kind, state: st.state, lv: ev.lv, detail: ev.detail });
      });
    });
    const house = [];
    if (cats.alarm && cfg.alarm_entity) {
      const st = hass.states[cfg.alarm_entity];
      const ev = evalAlarm(st ? st.state : null, profile);
      const c = { room: 'Casa', area_id: '', entity_id: cfg.alarm_entity, name: 'Allarme', kind: 'alarm', state: st ? st.state : 'unavailable', lv: ev.lv, detail: ev.detail };
      house.push(c); checks.push(c);
    }
    const byRank = (a, b) => (RANK[b.lv] - RANK[a.lv]) || ((b.kind === 'alarm') - (a.kind === 'alarm'));
    const roomOut = rooms.map((r) => {
      const an = areaName(hass, r.area_id);
      const mine = checks.filter((c) => c.area_id === r.area_id && c.room === an);
      let lv = mine.length ? 'ok' : 'none';
      mine.forEach((c) => { if (RANK[c.lv] > RANK[lv]) lv = c.lv; });
      const bad = mine.filter((c) => c.lv !== 'ok').sort(byRank);
      return { area_id: r.area_id, name: an, lv: lv, checks: mine, note: bad.length ? bad.slice(0, 2).map((c) => c.lv === 'crit' && c.kind === 'leak' ? 'Perdita d\u2019acqua rilevata' : (c.lv === 'unk' ? c.name + ': ' + c.detail : c.name + ' ' + c.detail)).join(' \u00b7 ') : (mine.length ? 'Tutto a posto' : 'Nessun controllo') };
    });
    return { checks: checks, rooms: roomOut, house: house, items: checks.filter((c) => c.lv !== 'ok').sort(byRank) };
  }

  function verdictOf(D, prof) {
    const crit = D.items.filter((i) => i.lv === 'crit'), warn = D.items.filter((i) => i.lv === 'warn'), unk = D.items.filter((i) => i.lv === 'unk');
    const unkTxt = unk.length + ' non verificabil' + (unk.length === 1 ? 'e' : 'i');
    if (!D.checks.length) return { lv: 'none', title: 'Nessun controllo attivo', sub: 'Abilita almeno una categoria nell\u2019editor' };
    if (crit.length) return { lv: 'crit', title: crit[0].kind === 'leak' ? 'Perdita d\u2019acqua rilevata' : 'Allarme scattato', sub: crit[0].room + (warn.length ? ' \u00b7 +' + warn.length + ' da sistemare' : '') };
    if (warn.length) return { lv: 'warn', title: warn.length + (warn.length === 1 ? ' cosa' : ' cose') + ' da sistemare', sub: prof.label + (unk.length ? ' \u00b7 ' + unkTxt : '') };
    if (unk.length) return { lv: 'unk', title: 'Non posso confermare', sub: prof.label + ' \u00b7 ' + unkTxt };
    return { lv: 'ok', title: prof.ok, sub: prof.label + (D.rooms.length ? ' \u00b7 tutte le ' + D.rooms.length + ' stanze a posto' : '') };
  }

  function iconFor(c) {
    if (c.lv === 'unk' && c.kind !== 'alarm') return KINDS[c.kind].icon;
    switch (c.kind) {
      case 'window': return c.state === 'on' ? 'mdi:window-open-variant' : 'mdi:window-closed-variant';
      case 'light': return c.state === 'on' ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline';
      case 'door': return c.state === 'locked' ? 'mdi:door-closed-lock' : 'mdi:lock-open-variant-outline';
      case 'cover': return c.state === 'closed' ? 'mdi:blinds-horizontal-closed' : 'mdi:blinds-horizontal';
      case 'plug': return c.state === 'on' ? 'mdi:power-plug' : 'mdi:power-plug-outline';
      case 'tv': return (c.state === 'off' || c.state === 'standby') ? 'mdi:television-off' : 'mdi:television';
      case 'alarm': return c.state === 'disarmed' ? 'mdi:shield-off-outline' : (c.state === 'armed_home' || c.state === 'armed_night' ? 'mdi:shield-home' : 'mdi:shield-check');
      default: return c.state === 'on' ? 'mdi:water-alert' : 'mdi:water';
    }
  }

  /* ----------------------------------------------------------------- CSS */
  const CARD_CSS = `
:host{display:block}
.hc{--hc-accent:#0a7156;--hc-bg:#fafbf9;--hc-tile:#f0f2ef;--hc-circle:#ffffff;--hc-line:#e0e5df;--hc-fg:#18221c;--hc-muted:#56675c;--hc-btn-fg:#0a7156;
  --hc-warn-bg:#f9f3de;--hc-warn-bd:#d3bd63;--hc-warn-fg:#5f4a10;--hc-crit-bg:#b83a42;--hc-crit-bd:#b83a42;--hc-crit-fg:#ffffff;--hc-crit-text:#ae4742;--hc-idle:#858E89;
  display:block;font-family:var(--ha-font-family-body,Roboto,Arial,sans-serif);color:var(--hc-fg);font-size:var(--ha-font-size-m,14px);line-height:1.4;text-align:left}
.hc[data-mode="dark"]{--hc-accent:#0e795d;--hc-bg:#101211;--hc-tile:#191c1a;--hc-circle:#282b29;--hc-line:#2b302c;--hc-fg:#f5f7f4;--hc-muted:#bbc5bd;--hc-btn-fg:#f5f7f4;
  --hc-warn-bg:#302b1b;--hc-warn-bd:#816e31;--hc-warn-fg:#f1d78b;--hc-crit-bg:#b83a42;--hc-crit-bd:#b83a42;--hc-crit-fg:#ffffff;--hc-crit-text:#e85e64;--hc-idle:#8B918E}
.hc *,.hc *::before,.hc *::after{box-sizing:border-box}
.hc button{font:inherit;color:inherit;cursor:pointer}
.hc button:focus-visible{outline:2px solid var(--hc-accent);outline-offset:3px}
.hc ha-icon{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;line-height:1;flex:none;width:var(--is,18px);height:var(--is,18px);--mdc-icon-size:var(--is,18px)}
.hc-wrap{container-type:inline-size;width:100%;max-width:100%;min-width:0}
.hc-shell{background:var(--hc-bg);color:var(--hc-fg);border:1px solid var(--hc-line);border-radius:26px;padding:18px;width:100%;min-width:0}
.hc-top{display:grid;gap:12px;margin-bottom:17px}
.hc-head{margin:2px 4px 0;min-width:0}
.hc-eyebrow{font-size:10px;letter-spacing:1.7px;font-weight:750;color:var(--hc-muted);margin-bottom:7px;overflow-wrap:anywhere}
.hc-title{font-size:25px;line-height:1.14;font-weight:780;letter-spacing:-.7px;overflow-wrap:anywhere}
.hc-title b{color:var(--hc-accent);font-weight:800}
.hc-prof{display:flex;gap:4px;padding:3px;background:var(--hc-tile);border:1px solid var(--hc-line);border-radius:999px}
.hc-prof button{flex:1;min-width:0;min-height:34px;border:0;border-radius:999px;background:transparent;color:var(--hc-muted);font-size:13px;font-weight:600}
.hc-prof button[aria-pressed="true"]{background:var(--hc-accent);color:#fff}
.hc-body{display:grid;gap:10px;grid-template-columns:minmax(0,1fr);grid-template-areas:"hero" "spine" "list"}
.hc-hero{grid-area:hero;min-width:0}.hc-spine{grid-area:spine;min-width:0}.hc-list{grid-area:list;min-width:0}
.hc-label{margin:0 4px 10px;color:var(--hc-muted);font-size:10px;letter-spacing:1.3px;font-weight:600;text-transform:uppercase}
.hc-hero-label{display:none}
.hc-panel{background:var(--hc-tile);border:1px solid var(--hc-line);border-radius:24px;padding:13px;min-width:0}
.hc-verdict{display:flex;align-items:center;gap:12px;min-width:0}
.hc-orb{width:40px;height:40px;flex:none;border-radius:50%;display:grid;place-items:center;--is:24px}
.hc-orb[data-lv="ok"]{background:var(--hc-accent);color:#fff}
.hc-orb[data-lv="warn"]{background:var(--hc-warn-bg);border:2px solid var(--hc-warn-bd);color:var(--hc-warn-fg)}
.hc-orb[data-lv="crit"]{background:var(--hc-crit-bg);border:2px solid var(--hc-crit-bd);color:var(--hc-crit-fg)}
.hc-orb[data-lv="unk"]{background:var(--hc-circle);border:2px dashed var(--hc-idle);color:var(--hc-muted)}
.hc-orb[data-lv="none"]{background:var(--hc-circle);border:1px solid var(--hc-line);color:var(--hc-muted)}
.hc-vt{font-size:18px;font-weight:700;line-height:1.15;letter-spacing:-.4px;overflow-wrap:anywhere}
.hc-vs{margin-top:2px;font-size:11px;color:var(--hc-muted)}
.hc-line{display:flex;padding:4px 0 2px}
.hc-st{position:relative;flex:1 1 0;min-width:44px;display:flex;flex-direction:column;align-items:center;gap:7px;padding:0 0 2px;border:0;background:none;border-radius:10px}
.hc-sl,.hc-sr{position:absolute;top:9.5px;width:50%;height:3px;border-radius:2px;background:var(--hc-line)}
.hc-sl{left:0}.hc-sr{right:0}
.hc-node{position:relative;z-index:1;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:none;box-shadow:0 0 0 3px var(--hc-bg);--is:13px}
.hc-sname{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:var(--hc-muted)}
.hc-snote{display:none;max-width:100%;padding:0 6px;text-align:center;font-size:11.5px;line-height:1.3;color:var(--hc-muted)}
.hc-st[data-lv="ok"] .hc-node{background:var(--hc-accent);color:#fff}
.hc-st[data-lv="ok"] .hc-sl,.hc-st[data-lv="ok"] .hc-sr{background:color-mix(in srgb,var(--hc-accent) 45%,transparent)}
.hc-st[data-lv="warn"] .hc-node{background:var(--hc-warn-bg);border:1.5px solid var(--hc-warn-bd);color:var(--hc-warn-fg);box-shadow:0 0 0 3px var(--hc-bg),0 0 0 6px color-mix(in srgb,var(--hc-warn-bd) 25%,transparent)}
.hc-st[data-lv="warn"] .hc-sl,.hc-st[data-lv="warn"] .hc-sr{background:color-mix(in srgb,var(--hc-warn-bd) 70%,transparent)}
.hc-st[data-lv="crit"] .hc-node{background:var(--hc-crit-bg);border:1.5px solid var(--hc-crit-bd);color:var(--hc-crit-fg);box-shadow:0 0 0 3px var(--hc-bg),0 0 0 6px color-mix(in srgb,var(--hc-crit-bd) 25%,transparent)}
.hc-st[data-lv="crit"] .hc-sl,.hc-st[data-lv="crit"] .hc-sr{background:color-mix(in srgb,var(--hc-crit-bd) 70%,transparent)}
.hc-st[data-lv="unk"] .hc-node{background:var(--hc-bg);border:1.5px dashed var(--hc-idle);color:var(--hc-muted)}
.hc-st[data-lv="unk"] .hc-sl,.hc-st[data-lv="unk"] .hc-sr{height:0;background:none;border-top:3px dotted var(--hc-idle);border-radius:0}
.hc-st[data-lv="none"] .hc-node{background:var(--hc-tile);border:1px solid var(--hc-line);color:var(--hc-muted)}
.hc-st:not([data-lv="ok"]):not([data-lv="none"]) .hc-sname{color:var(--hc-fg);font-weight:700}
.hc-st[data-lv="warn"] .hc-snote{color:var(--hc-warn-fg)}
.hc-st[data-lv="crit"] .hc-snote{color:var(--hc-crit-text)}
.hc-items{display:flex;flex-direction:column;gap:6px}
.hc-row{display:flex;align-items:center;gap:10px;min-width:0;padding:7px 10px;background:var(--hc-tile);border:1px solid var(--hc-line);border-radius:16px;text-align:left;font:inherit;width:100%}
.hc button.hc-row{cursor:pointer}
.hc button.hc-row:hover{border-color:color-mix(in srgb,var(--hc-accent) 45%,var(--hc-line))}
.hc-ico{width:32px;height:32px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--hc-circle);--is:18px}
.hc-row{min-height:50px;box-sizing:border-box}
.hc-ph{visibility:hidden;pointer-events:none}
.hc-row[data-lv="warn"] .hc-ico{background:var(--hc-warn-bg);box-shadow:inset 0 0 0 1px var(--hc-warn-bd);color:var(--hc-warn-fg)}
.hc-row[data-lv="crit"] .hc-ico{background:var(--hc-crit-bg);box-shadow:inset 0 0 0 1px var(--hc-crit-bd);color:var(--hc-crit-fg)}
.hc-row[data-lv="unk"] .hc-ico{border:1.5px dashed var(--hc-idle);color:var(--hc-muted)}
.hc-rt{flex:1;min-width:0}
.hc-rn{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hc-rs{font-size:11px;margin-top:2px;color:var(--hc-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hc-row[data-lv="warn"] .d{color:var(--hc-warn-fg);font-weight:600}
.hc-row[data-lv="crit"] .d{color:var(--hc-crit-text);font-weight:600}
.hc-tag{display:none;flex:none;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.hc-row[data-lv="warn"] .hc-tag{background:var(--hc-warn-bg);color:var(--hc-warn-fg);box-shadow:inset 0 0 0 1px var(--hc-warn-bd)}
.hc-row[data-lv="crit"] .hc-tag{background:var(--hc-crit-bg);color:var(--hc-crit-fg);box-shadow:inset 0 0 0 1px var(--hc-crit-bd)}
.hc-row[data-lv="unk"] .hc-tag{border:1px dashed var(--hc-idle);color:var(--hc-muted)}
.hc .hc-more{align-self:flex-start;margin:0 4px;padding:6px 4px;border:0;background:none;color:var(--hc-muted);font-size:12px;text-decoration:underline;text-underline-offset:3px}
.hc-empty .hc-ico{background:var(--hc-accent);color:#fff}
.hc-empty .hc-rn{white-space:normal}
.hc-sim{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--hc-line);border-radius:16px;font-size:12px;color:var(--hc-muted)}
.hc-foot{margin-top:10px}
.hc .hc-detail{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:40px;padding:8px 14px;border-radius:999px;font-weight:600;font-size:13.5px;line-height:1.2;color:var(--hc-btn-fg);border:1px solid color-mix(in srgb,var(--hc-accent) 45%,transparent);background:color-mix(in srgb,var(--hc-accent) 12%,transparent)}
.hc .hc-detail:hover{background:color-mix(in srgb,var(--hc-accent) 22%,transparent)}
@container (max-width:380px){.hc-shell{padding:13px;border-radius:23px}.hc-title{font-size:23px}.hc-panel{padding:10px}}
@container (max-width:310px){.hc-shell{padding:10px}.hc-title{font-size:21px}.hc-eyebrow{font-size:9px}.hc-panel{padding:8px}}
@container (min-width:480px){
  .hc-tag{display:inline-flex}.hc-vt{font-size:20px}
  .hc-orb{width:44px;height:44px;--is:26px}.hc-panel{padding:13px}
}
@container (min-width:640px){
  .hc-shell{padding:18px}
  .hc-top{grid-template-columns:minmax(0,1fr) 300px;align-items:end;margin-bottom:18px}
  .hc-top.no-head{grid-template-columns:minmax(0,1fr)}
  .hc-body{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:20px;row-gap:16px;align-items:start;grid-template-rows:auto 1fr;grid-template-areas:"hero list" "spine list"}
  .hc-hero-label{display:block}.hc-sname{font-size:11.5px}
}
@container (min-width:960px){
  .hc-shell{padding:18px}
  .hc-top{grid-template-columns:minmax(0,1fr) 340px}
  .hc-body{grid-template-rows:auto auto;grid-template-areas:"hero list" "spine spine"}
  .hc-vt{font-size:22px}.hc-orb{width:48px;height:48px;--is:28px}
  .hc-node{width:28px;height:28px;--is:16px}.hc-sl,.hc-sr{top:12.5px}
  .hc-sname{font-size:13px}.hc-snote{display:block}.hc-line{padding-top:6px}
}
/* popup */
.hc-backdrop{position:fixed;inset:0;z-index:9999;overscroll-behavior:contain;background:#0009;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
.hc-dialog{width:min(390px,100%);max-width:100%;min-width:0;align-self:center;height:min(calc(100vh - 40px),680px);height:min(calc(100dvh - 40px),680px);display:flex;flex-direction:column;background:var(--hc-bg);color:var(--hc-fg);border:1px solid var(--hc-line);border-radius:26px;overflow:hidden;box-shadow:0 18px 60px #0005}
.hc-mhead{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 12px 18px;background:var(--hc-bg);border-bottom:1px solid var(--hc-line)}
.hc-mtitle{flex:1;min-width:0;margin:0;font-size:17px;font-weight:600;line-height:1.3}
.hc .hc-close{display:grid;place-items:center;line-height:0;margin:0;padding:0;width:40px;height:40px;flex:none;border:1px solid var(--hc-line);border-radius:50%;background:var(--hc-tile);color:var(--hc-fg)}
.hc .hc-close ha-icon{display:block;flex:none;margin:0;--mdc-icon-size:18px;width:18px;height:18px}
.hc-mbody{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:12px 18px 18px;min-width:0}
.hc-psub{margin:2px 4px 12px;font-size:12px;color:var(--hc-muted)}
.hc-pfilters{display:flex;gap:6px;margin-bottom:4px}
.hc .hc-chip{min-height:36px;padding:0 14px;border:1px solid var(--hc-line);border-radius:999px;background:var(--hc-tile);color:var(--hc-muted);font-size:13px}
.hc .hc-chip[aria-pressed="true"]{background:color-mix(in srgb,var(--hc-accent) 14%,transparent);border-color:color-mix(in srgb,var(--hc-accent) 45%,transparent);color:var(--hc-fg);font-weight:600}
.hc-grp{min-width:0}
.hc-rh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:17px 0 10px;color:var(--hc-fg);font-size:13px;font-weight:600}
.hc-rh+.hc-metric{margin-top:0}
.hc-rh em{font-style:normal;letter-spacing:.2px;text-transform:none;font-size:11px;font-weight:600}
.hc-rh em[data-lv="warn"]{color:var(--hc-warn-fg)}.hc-rh em[data-lv="crit"]{color:var(--hc-crit-text)}.hc-rh em[data-lv="ok"]{color:var(--hc-accent)}
.hc-metric{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;background:var(--hc-tile);border:1px solid var(--hc-line);padding:12px 14px;border-radius:14px;margin-top:8px;text-align:left;font:inherit}
.hc button.hc-metric{cursor:pointer}
.hc-metric .m-l{display:flex;align-items:center;gap:10px;min-width:0;color:var(--hc-muted);font-size:12px}
.hc-metric strong{font-size:13px;font-weight:600;text-align:right}
.m-g{display:grid;place-items:center;width:22px;height:22px;flex:none;border-radius:50%;font-style:normal;--is:13px}
.hc-metric[data-lv="ok"] .m-g{background:var(--hc-accent);color:#fff}
.hc-metric[data-lv="warn"] .m-g{background:var(--hc-warn-bg);box-shadow:inset 0 0 0 1px var(--hc-warn-bd);color:var(--hc-warn-fg)}
.hc-metric[data-lv="crit"] .m-g{background:var(--hc-crit-bg);box-shadow:inset 0 0 0 1px var(--hc-crit-bd);color:var(--hc-crit-fg)}
.hc-metric[data-lv="unk"] .m-g{border:1.5px dashed var(--hc-idle);color:var(--hc-muted)}
.hc-metric[data-lv="warn"] strong{color:var(--hc-warn-fg)}.hc-metric[data-lv="crit"] strong{color:var(--hc-crit-text)}
:host([data-popup="wide"]) .hc-dialog{width:min(1120px,100%);height:min(80vh,560px);height:min(80dvh,560px)}
:host([data-popup="wide"]) .hc-mbody{padding:12px 22px 22px}
.hc-metric.hc-act{padding:8px 8px 8px 14px}
.hc-act strong{white-space:nowrap}
.hc-act .m-l{overflow:hidden}
.hc-mmain{display:flex;flex:1;min-width:0;justify-content:space-between;align-items:center;gap:12px;background:none;border:0;padding:0;margin:0;color:inherit;font:inherit;text-align:left}
.hc button.hc-mmain{cursor:pointer}
.hc .hc-do{flex:none;min-height:34px;padding:0 13px;border-radius:999px;border:1px solid var(--hc-line);background:var(--hc-bg);color:var(--hc-fg);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.hc .hc-do[disabled]{color:var(--hc-muted);cursor:default}
.hc .hc-do[data-s="fail"]{border-color:var(--hc-crit-text);color:var(--hc-crit-text)}
.hc .hc-all{display:block;width:100%;margin:16px 0 2px;min-height:40px;border-radius:999px;border:1px solid var(--hc-line);background:var(--hc-tile);color:var(--hc-fg);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.hc .hc-all[data-s="confirm"]{border-color:var(--hc-warn-bd);background:var(--hc-warn-bg);color:var(--hc-warn-fg)}
.hc-abig{display:flex;align-items:center;gap:12px;margin:4px 0 12px;padding:14px;border-radius:24px;background:var(--hc-tile);border:1px solid var(--hc-line)}
.hc-aorb{display:grid;place-items:center;flex:none;width:46px;height:46px;border-radius:50%;--is:24px;background:var(--hc-tile);border:2px solid var(--hc-idle);color:var(--hc-muted)}
.hc-abig[data-lv="ok"] .hc-aorb{background:var(--hc-accent);border-color:var(--hc-accent);color:#fff}
.hc-abig[data-lv="warn"] .hc-aorb{background:var(--hc-warn-bg);border-color:var(--hc-warn-bd);color:var(--hc-warn-fg)}
.hc-abig[data-lv="crit"] .hc-aorb{background:var(--hc-crit-bg);border-color:var(--hc-crit-bd);color:var(--hc-crit-fg)}
.hc-ast{display:flex;gap:8px;margin:0 0 14px}
.hc-ast>div{flex:1;min-width:0;padding:10px 12px;border-radius:16px;background:var(--hc-tile);border:1px solid var(--hc-line)}
.hc-ast span{display:block;font-size:11px;color:var(--hc-muted)}.hc-ast b{display:block;margin-top:3px;font-size:13px;font-weight:600}
.hc-adots{display:flex;gap:10px;justify-content:center;margin:2px 0 10px}
.hc-adots i{width:11px;height:11px;border-radius:50%;border:1.5px solid var(--hc-muted)}.hc-adots i.f{background:var(--hc-fg);border-color:var(--hc-fg)}
.hc-akeys{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 12px}
.hc-akeys button{min-height:46px;border-radius:14px;border:1px solid var(--hc-line);background:var(--hc-tile);color:var(--hc-fg);font:inherit;font-size:17px;font-weight:600;cursor:pointer}
.hc-akeys button ha-icon{--mdc-icon-size:20px;width:20px;height:20px}
.hc-code{width:100%;box-sizing:border-box;min-height:44px;margin:0 0 12px;padding:0 14px;border-radius:14px;border:1px solid var(--hc-line);background:var(--hc-tile);color:var(--hc-fg);font:inherit;font-size:16px}
.hc-amsg{margin:0 4px 12px;font-size:12px;color:var(--hc-muted)}.hc-amsg[role="alert"]{color:var(--hc-crit-text);font-weight:600}
.hc .hc-acta{display:block;width:100%;min-height:44px;border-radius:999px;border:0;background:var(--hc-accent);color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.hc .hc-acta[disabled]{opacity:.45;cursor:default}
.hc-cols{display:grid;grid-template-columns:repeat(var(--n,1),minmax(0,1fr));column-gap:18px;align-items:start}
.hc-col{min-width:0}
.hc-col>.hc-rh:first-child{margin-top:4px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;

  /* ------------------------------------------------------------ the card */
  class HomeCheckCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = '<style>' + CARD_CSS + '</style><div id="r"></div>';
      this._root = this.shadowRoot.getElementById('r');
      this._cfg = null; this._hass = null; this._sig = null;
      this._profile = 'esco'; this._compact = true;
      this._popup = false; this._view = 'list'; this._code = ''; this._pend = {}; this._confirm = false; this._alarmBusy = false; this._alarmErr = ''; this._aconf = false;
      this._filter = 'all'; this._room = null; this._ret = 'open'; this._focus = '';
      this._onKey = (e) => this._key(e);
      this._onResize = () => { this._applyLayout(); if (this._popup && this._colCount() !== this._cols) this._render(); };
      this._timer = null; this._ro = null;
      this.shadowRoot.addEventListener('click', (e) => this._click(e));
      this.shadowRoot.addEventListener('input', (e) => { const t = e.target; if (t && t.dataset && t.dataset.code) { this._code = t.value; this._alarmErr = ''; const go = this._root.querySelector('.hc-acta'); if (go) go.disabled = !this._code || this._alarmBusy; } });
    }

    static getStubConfig() { return {}; }
    static getConfigElement() { return document.createElement(EDITOR_TAG); }
    getCardSize() { return 6; }
    getGridOptions() { return { columns: 12, min_columns: 6 }; }

    setConfig(config) {
      this._cfg = normalizeConfig(config);
      let saved = null;
      try { saved = window.localStorage.getItem('home-check-card:profile'); } catch (e) { /* storage unavailable */ }
      this._profile = PROFILE_IDS.indexOf(saved) >= 0 ? saved : this._cfg.default_profile;
      this._sig = null;
      this._render();
    }

    set hass(h) {
      this._hass = h;
      if (!this._cfg) return;
      const sig = this._signature();
      if (sig === this._sig) return;
      this._sig = sig;
      this._render();
    }
    get hass() { return this._hass; }

    connectedCallback() {
      window.addEventListener('resize', this._onResize);
      this._applyLayout();
      this._timer = window.setInterval(() => { if (this._cfg && this._hass) this._render(); }, 60000);
      if (typeof ResizeObserver !== 'undefined') {
        this._ro = new ResizeObserver((entries) => {
          const w = entries[0] ? entries[0].contentRect.width : 0;
          const c = w < 640;
          if (w && c !== this._compact) { this._compact = c; this._render(); }
        });
        this._ro.observe(this);
      }
    }
    disconnectedCallback() {
      window.removeEventListener('resize', this._onResize);
      document.removeEventListener('keydown', this._onKey, true);
      if (this._timer) window.clearInterval(this._timer);
      if (this._ro) this._ro.disconnect();
    }

    _applyLayout() {
      const wide = !IS_PHONE && window.matchMedia('(min-width:640px) and (min-height:600px)').matches;
      this.setAttribute('data-popup', wide ? 'wide' : 'phone');
    }

    _colCount() {
      if (this.getAttribute('data-popup') !== 'wide') return 1;
      const w = Math.min(1120, window.innerWidth - 32) - 46;
      return Math.max(1, Math.min(4, Math.floor((w + 18) / 278)));
    }

    _signature() {
      const h = this._hass, c = this._cfg;
      if (!h) return '';
      const parts = [h.themes && h.themes.darkMode ? 'd' : 'l', Object.keys(h.areas || {}).length];
      discover(h).forEach((t) => { const s = h.states[t.entity_id]; parts.push(t.entity_id + ':' + (s ? s.state : '-')); });
      if (c.alarm_entity) { const s = h.states[c.alarm_entity]; parts.push('A:' + (s ? s.state : '-')); }
      if (c.simulation_entity) { const s = h.states[c.simulation_entity]; parts.push('S:' + (s ? s.state : '-')); }
      parts.push('P:' + JSON.stringify(this._pend || {}));
      return parts.join('|');
    }

    _mode() {
      const m = this._cfg.theme_mode;
      if (m === 'light' || m === 'dark') return m;
      return this._hass && this._hass.themes && this._hass.themes.darkMode ? 'dark' : 'light';
    }

    /* ---- markup ---- */
    _rowHTML(c) {
      // The rows of the main card are informational only: no tap, no entity dialog, no commands.
      return '<div class="hc-row" data-lv="' + c.lv + '">' +
        '<div class="hc-ico">' + ic(iconFor(c)) + '</div><div class="hc-rt"><div class="hc-rn">' + esc(c.name) + '</div><div class="hc-rs">' + esc(c.room) + ' \u00b7 <span class="d">' + esc(c.detail) + '</span></div></div>' +
        '<span class="hc-tag">' + TAG_TXT[c.lv] + '</span></div>';
    }
    _actFor(c) {
      const a = ACT[c.kind];
      if (!a || !this._cfg.row_actions || c.lv !== 'warn' || !c.entity_id || c.entity_id.indexOf(a.dom + '.') !== 0) return null;
      if (c.kind === 'cover' && !this._cfg.cover_close) return null;
      return a;
    }
    _metricHTML(c) {
      const tap = this._cfg.row_tap && c.entity_id;
      const inner = '<span class="m-l"><i class="m-g">' + ic(NODE_ICON[c.lv]) + '</i>' + esc(c.name) + '</span><strong>' + esc(cap(c.detail)) + '</strong>';
      const act = this._actFor(c);
      if (act) {
        const st = this._pend[c.entity_id] || '';
        const lab = st === 'busy' ? 'Invio…' : st === 'fail' ? 'Riprova' : act.label;
        return '<div class="hc-metric hc-act" data-lv="' + c.lv + '">' +
          (tap ? '<button type="button" class="hc-mmain" data-more="' + esc(c.entity_id) + '">' + inner + '</button>' : '<div class="hc-mmain">' + inner + '</div>') +
          '<button type="button" class="hc-do" data-do="' + esc(c.entity_id) + '" data-s="' + st + '" data-focus="d-' + esc(c.entity_id) + '"' + (st === 'busy' ? ' disabled' : '') + '>' + lab + '</button></div>';
      }
      if (c.kind === 'alarm' && this._cfg.alarm_panel && c.entity_id) return '<button type="button" class="hc-metric" data-lv="' + c.lv + '" data-alarm="1">' + inner + '</button>';
      return tap ? '<button type="button" class="hc-metric" data-lv="' + c.lv + '" data-more="' + esc(c.entity_id) + '">' + inner + '</button>'
                 : '<div class="hc-metric" data-lv="' + c.lv + '">' + inner + '</div>';
    }
    _popupHTML(D, prof) {
      if (this._view === 'alarm') return this._alarmHTML(prof);
      const f = this._filter;
      let body = '<div class="hc-psub">Profilo ' + esc(prof.label) + '</div><div class="hc-pfilters" role="group" aria-label="Filtro controlli">' +
        [['bad', 'Da sistemare'], ['all', 'Tutti']].map((a) => '<button type="button" class="hc-chip" data-filter="' + a[0] + '" data-focus="f-' + a[0] + '" aria-pressed="' + (f === a[0]) + '">' + a[1] + '</button>').join('') + '</div>';
      const blocks = [];
      const mkHead = (key, name, lv, cont) => '<div class="hc-rh"' + (cont ? '' : ' data-room-h="' + esc(key) + '"') + '><span>' + esc(name) + (cont ? ' · segue' : '') + '</span>' + (cont ? '' : '<em data-lv="' + lv + '">' + LV_HEAD[lv] + '</em>') + '</div>';
      if (D.house.length) {
        const hr = f === 'all' ? D.house : D.house.filter((c) => c.lv !== 'ok');
        if (hr.length) {
          let hl = 'ok'; hr.forEach((c) => { if (RANK[c.lv] > RANK[hl]) hl = c.lv; });
          blocks.push({ key: '__casa', name: 'Casa', lv: hl, rows: hr.map((c) => this._metricHTML(c)) });
        }
      }
      D.rooms.forEach((r) => {
        const own = r.checks.filter((c) => c.kind !== 'alarm');
        const rows = f === 'all' ? own : own.filter((c) => c.lv !== 'ok');
        if (!rows.length && !(f === 'all' && !own.length)) return;
        blocks.push({ key: r.area_id, name: r.name, lv: r.lv, rows: rows.length ? rows.map((c) => this._metricHTML(c)) : ['<div class="hc-metric"><span class="m-l">Nessun controllo attivo per questa stanza</span></div>'] });
      });
      const N = this._colCount();
      this._cols = N;
      const items = [];
      blocks.forEach((bl) => {
        items.push({ h: true, bl: bl, w: 0.66 });
        bl.rows.forEach((html) => items.push({ h: false, bl: bl, html: html, w: 1 }));
      });
      const n = items.length, pre = [0];
      items.forEach((it) => pre.push(pre[pre.length - 1] + it.w));
      const seg = (i, j) => (j <= i || items[j - 1].h) ? Infinity : pre[j] - pre[i] + (items[i].h ? -0.23 : 0.43);
      const best = [], cut = [];
      for (let k = 0; k <= N; k++) { best.push(new Array(n + 1).fill(Infinity)); cut.push(new Array(n + 1).fill(0)); }
      best[0][0] = 0;
      for (let k = 1; k <= N; k++) {
        for (let j = 1; j <= n; j++) {
          for (let i = k - 1; i < j; i++) {
            if (best[k - 1][i] === Infinity) continue;
            const v = Math.max(best[k - 1][i], seg(i, j));
            if (v < best[k][j]) { best[k][j] = v; cut[k][j] = i; }
          }
        }
      }
      let kk = N, jj = n;
      if (best[N][n] === Infinity) { items.forEach((it) => { it.c = 0; }); }
      else { while (kk > 0) { const i = cut[kk][jj]; for (let x = i; x < jj; x++) items[x].c = kk - 1; jj = i; kk--; } }
      const cols = [];
      for (let k = 0; k < N; k++) cols.push('');
      const seen = {};
      items.forEach((it, i) => {
        const k = it.c;
        if (it.h) { seen[it.bl.key] = true; cols[k] += mkHead(it.bl.key, it.bl.name, it.bl.lv, false); return; }
        const prev = items[i - 1];
        if (prev && prev.c !== k) cols[k] += mkHead(it.bl.key, it.bl.name, it.bl.lv, true);
        cols[k] += it.html;
      });
      body += '<div class="hc-cols" style="--n:' + N + '">' + (blocks.length ? cols.map((h) => '<div class="hc-col">' + h + '</div>').join('') : '<div class="hc-col"><div class="hc-metric"><span class="m-l">' + (f === 'bad' ? 'Niente da sistemare' : 'Nessuna stanza configurata') + '</span></div></div>');
      body += '</div>';
      const bulk = this._cfg.bulk_action ? D.items.filter((c) => c.kind !== 'cover' && this._actFor(c)) : [];
      if (bulk.length) {
        const nn = bulk.length + ' entità';
        body += '<button type="button" class="hc-all" data-all="1" data-focus="all" data-s="' + (this._confirm ? 'confirm' : '') + '">' + (this._confirm ? 'Conferma: spegni ' + nn : 'Spegni tutto · ' + nn) + '</button>';
      }
      return '<div class="hc-backdrop" role="presentation"><div class="hc-dialog" role="dialog" aria-modal="true" aria-labelledby="hc-pt">' +
        '<div class="hc-mhead"><h3 class="hc-mtitle" id="hc-pt">Dettagli controllo</h3><button type="button" class="hc-close" data-close="1" data-focus="close" aria-label="Chiudi">' + ic('mdi:close') + '</button></div>' +
        '<div class="hc-mbody">' + body + '</div></div></div>';
    }

    _alarmHTML(prof) {
      const id = this._cfg.alarm_entity, h = this._hass, st = h && h.states[id], s0 = st ? st.state : 'unavailable';
      const attr = (st && st.attributes) || {}, pid = this._profile;
      const ev = evalAlarm(s0, pid);
      const triggered = s0 === 'triggered';
      const act = triggered || pid === 'esco' ? 'disarm' : (pid === 'notte' ? 'arm_home' : 'arm_away');
      const label = triggered ? ALARM_BTN.esco : ALARM_BTN[pid];
      const lvIcon = ev.lv === 'ok' ? 'mdi:shield-check' : ev.lv === 'unk' ? 'mdi:shield-alert-outline' : 'mdi:shield-home';
      let body = '<div class="hc-abig" data-lv="' + ev.lv + '"><span class="hc-aorb">' + ic(lvIcon) + '</span><div style="min-width:0"><div class="hc-vt">' + esc(cap(ev.detail.split(' · ')[0])) + '</div><div class="hc-vs">' + esc(ev.lv === 'warn' ? (pid === 'esco' ? 'Per uscire serve disattivarlo' : 'Non è nello stato richiesto') : ev.lv === 'ok' ? 'Già nello stato richiesto' : ev.lv === 'crit' ? 'Allarme scattato' : 'Nessun comando possibile') + '</div></div></div>';
      body += '<div class="hc-ast"><div><span>Ora</span><b>' + esc(cap(ev.detail.split(' · ')[0])) + '</b></div><div><span>Richiesto in ' + esc(prof.label) + '</span><b>' + ALARM_REQ[pid] + '</b></div></div>';
      const canAct = ev.lv !== 'unk' && (ev.lv !== 'ok' || triggered);
      if (canAct) {
        const hasCode = !!attr.code_format, text = attr.code_format === 'text';
        const n = this._code.length;
        if (hasCode) body += '<div class="hc-label">Codice richiesto</div>';
        if (!hasCode) { /* nessun codice impostato sull'entità */ }
        else if (text) {
          body += '<input class="hc-code" type="password" autocomplete="off" aria-label="Codice allarme" data-code="1" data-focus="code" value="' + esc(this._code) + '">';
        } else {
          let dots = ''; for (let i = 0; i < Math.max(4, n); i++) dots += '<i' + (i < n ? ' class="f"' : '') + '></i>';
          body += '<div class="hc-adots" aria-label="Cifre inserite: ' + n + '">' + dots + '</div><div class="hc-akeys">' +
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'b', '0', ''].map((k) => k === '' ? '<span></span>' : '<button type="button" data-key="' + k + '" data-focus="k-' + k + '" aria-label="' + (k === 'b' ? 'Cancella' : k) + '">' + (k === 'b' ? ic('mdi:backspace-outline') : k) + '</button>').join('') + '</div>';
        }
        if (this._alarmErr) body += '<div class="hc-amsg" role="alert">' + esc(this._alarmErr) + '</div>';
        const dis = (hasCode && !n) || this._alarmBusy;
        body += '<button type="button" class="hc-acta" data-alarm-go="' + act + '" data-focus="go"' + (dis ? ' disabled' : '') + '>' + (this._alarmBusy ? 'Invio…' : (this._aconf ? 'Conferma: ' + label.toLowerCase() : label)) + '</button>';
      } else if (this._alarmErr) {
        body += '<div class="hc-amsg" role="alert">' + esc(this._alarmErr) + '</div>';
      }
      return '<div class="hc-backdrop" role="presentation"><div class="hc-dialog" role="dialog" aria-modal="true" aria-labelledby="hc-pt">' +
        '<div class="hc-mhead"><h3 class="hc-mtitle" id="hc-pt">Allarme</h3><button type="button" class="hc-close" data-close="1" data-focus="close" aria-label="Chiudi">' + ic('mdi:close') + '</button></div>' +
        '<div class="hc-mbody">' + body + '</div></div></div>';
    }
    _doAction(id, noRender) {
      const dom = id.split('.')[0], a = ACT[Object.keys(ACT).filter((k) => ACT[k].dom === dom)[0]];
      if (!a || !this._hass || this._pend[id] === 'busy') return;
      this._pend[id] = 'busy';
      const fail = () => { if (this._pend[id] === 'busy') { this._pend[id] = 'fail'; this._render(); } };
      try { Promise.resolve(this._hass.callService(a.dom, a.svc, { entity_id: id })).catch(fail); } catch (err) { fail(); }
      window.setTimeout(fail, 8000);
      if (!noRender) this._render();
    }
    _doAll() {
      if (!this._confirm) {
        this._confirm = true; this._focus = 'all'; this._render();
        window.clearTimeout(this._confT); this._confT = window.setTimeout(() => { if (this._confirm) { this._confirm = false; this._render(); } }, 5000);
        return;
      }
      this._confirm = false; window.clearTimeout(this._confT);
      const D = compute(this._hass, this._cfg, this._profile);
      D.items.filter((c) => c.kind !== 'cover' && this._actFor(c)).forEach((c) => this._doAction(c.entity_id, true));
      this._focus = 'all'; this._render();
    }
    _openAlarm() {
      this._ret = 'r-' + this._cfg.alarm_entity; this._view = 'alarm'; this._code = ''; this._alarmErr = ''; this._aconf = false; this._alarmBusy = false;
      this._popup = true; this._focus = 'close';
      document.addEventListener('keydown', this._onKey, true);
      this._render();
    }
    _alarmGo(act) {
      const stt = this._hass && this._hass.states[this._cfg.alarm_entity], need = !!(stt && stt.attributes && stt.attributes.code_format);
      if (this._alarmBusy || (need && !this._code)) return;
      if (!need && act === 'disarm' && !this._aconf) {
        this._aconf = true; this._focus = 'go'; this._render();
        window.clearTimeout(this._aconfT); this._aconfT = window.setTimeout(() => { if (this._aconf) { this._aconf = false; this._render(); } }, 5000);
        return;
      }
      this._aconf = false; window.clearTimeout(this._aconfT);
      this._alarmBusy = true; this._alarmErr = ''; this._focus = 'go'; this._render();
      const data = { entity_id: this._cfg.alarm_entity };
      if (need) data.code = this._code;
      const done = (ok) => { this._alarmBusy = false; if (ok) this._code = ''; else this._alarmErr = 'Codice errato o comando rifiutato.'; this._render(); };
      try { Promise.resolve(this._hass.callService('alarm_control_panel', 'alarm_' + act, data)).then(() => done(true), () => done(false)); } catch (err) { done(false); }
    }

    _render() {
      if (!this._cfg) return;
      const root = this._root;
      const body0 = root.querySelector('.hc-mbody');
      const keep = body0 ? body0.scrollTop : 0;
      const active = this.shadowRoot.activeElement;
      const want = this._focus || (active ? active.getAttribute('data-focus') : '');
      this._focus = '';
      const cfg = this._cfg, hass = this._hass;
      if (!hass) { root.innerHTML = '<div class="hc" data-mode="' + this._mode() + '"><div class="hc-wrap"><div class="hc-shell"><div class="hc-psub">Caricamento\u2026</div></div></div></div>'; return; }
      const prof = PROFILES[this._profile];
      const D = compute(hass, cfg, this._profile), V = verdictOf(D, prof);
      Object.keys(this._pend).forEach((k) => { const c = D.checks.filter((x) => x.entity_id === k)[0]; if (!c || c.lv === 'ok') delete this._pend[k]; });
      const capRows = this._compact ? Math.min(2, cfg.max_rows) : cfg.max_rows;
      const shown = D.items.slice(0, capRows), more = D.items.length - shown.length;
      const title = cleanTitle(cfg.title) || 'Controllo casa';
      const head = (cfg.show_eyebrow && cfg.eyebrow ? '<div class="hc-eyebrow">' + esc(cfg.eyebrow) + '</div>' : '') + (cfg.show_title ? '<div class="hc-title" role="heading" aria-level="2">' + esc(title) + '<b>.</b></div>' : '');
      const profBtns = PROFILE_IDS.map((id) => '<button type="button" data-profile="' + id + '" data-focus="p-' + id + '" aria-pressed="' + (id === this._profile) + '">' + PROFILES[id].short + '</button>').join('');
      const stations = D.rooms.map((r, i) => '<button type="button" class="hc-st" data-lv="' + r.lv + '" data-area="' + esc(r.area_id) + '" data-focus="s-' + i + '" aria-label="' + esc(r.name) + ': ' + LV_HEAD[r.lv].toLowerCase() + '. Apri i dettagli">' +
        (i > 0 ? '<i class="hc-sl"></i>' : '') + (i < D.rooms.length - 1 ? '<i class="hc-sr"></i>' : '') +
        '<span class="hc-node">' + ic(NODE_ICON[r.lv]) + '</span><span class="hc-sname">' + esc(r.name) + '</span><span class="hc-snote">' + esc(r.note) + '</span></button>').join('');
      let list = '<div class="hc-label">Da sistemare' + (D.items.length ? ' \u00b7 ' + D.items.length : '') + '</div><div class="hc-items">' + shown.map((c) => this._rowHTML(c)).join('');
      const slots = Math.max(1, capRows), filled = shown.length + (D.items.length ? 0 : 1);
      if (more > 0) list += '<button type="button" class="hc-more" data-open="1" data-focus="more">+' + more + (more === 1 ? ' altra nel popup' : ' altre nel popup') + '</button>';
      if (!D.items.length) list += '<div class="hc-row hc-empty"><div class="hc-ico">' + ic(D.checks.length ? 'mdi:check' : 'mdi:minus') + '</div><div class="hc-rt"><div class="hc-rn">' + (D.checks.length ? 'Niente da sistemare' : 'Nessun controllo attivo') + '</div><div class="hc-rs" style="white-space:normal">' + (D.checks.length ? 'Tutti i controlli del profilo ' + esc(prof.label) + ' sono a posto' : 'Abilita una categoria nell\u2019editor') + '</div></div></div>';
      for (let i = filled; i < slots; i++) list += '<div class="hc-row hc-ph" aria-hidden="true"></div>';
      if (more <= 0) list += '<div class="hc-more hc-ph" aria-hidden="true">&nbsp;</div>';
      if (this._profile !== 'vacanza' && cfg.simulation_entity) list += '<div class="hc-sim hc-ph" aria-hidden="true">' + ic('mdi:clock-outline') + '<span>Simulazione presenza non attiva</span></div>';
      if (this._profile === 'vacanza' && cfg.simulation_entity) {
        const ss = hass.states[cfg.simulation_entity];
        list += '<div class="hc-sim">' + ic('mdi:clock-outline') + '<span>' + (ss && ss.state === 'on' ? 'Simulazione presenza attiva' : (ss && (ss.state === 'unavailable' || ss.state === 'unknown') ? 'Simulazione presenza non verificabile' : 'Simulazione presenza non attiva')) + '</span></div>';
      }
      list += '</div>';
      // Keep the card's height while its content is replaced, so the dashboard around it never shrinks and re-scrolls.
      const h0 = root.offsetHeight; if (h0) root.style.minHeight = h0 + 'px';
      root.innerHTML = '<div class="hc" data-mode="' + this._mode() + '"><div class="hc-wrap"><div class="hc-shell">' +
        '<div class="hc-top' + (head ? '' : ' no-head') + '">' + (head ? '<div class="hc-head">' + head + '</div>' : '') + '<div class="hc-prof" role="group" aria-label="Profilo">' + profBtns + '</div></div>' +
        '<div class="hc-body">' +
        '<section class="hc-hero"><div class="hc-label hc-hero-label">Verdetto</div><div class="hc-panel"><div class="hc-verdict"><div class="hc-orb" data-lv="' + V.lv + '">' + ic(NODE_ICON[V.lv]) + '</div><div style="min-width:0"><div class="hc-vt">' + esc(V.title) + '</div><div class="hc-vs">' + esc(V.sub) + '</div></div></div></div></section>' +
        (D.rooms.length ? '<section class="hc-spine"><div class="hc-label">Percorso \u00b7 ' + D.rooms.length + (D.rooms.length === 1 ? ' stanza' : ' stanze') + '</div><div class="hc-line">' + stations + '</div></section>' : '') +
        '<section class="hc-list">' + list + '</section></div>' +
        '<div class="hc-foot"><button type="button" class="hc-detail" data-open="1" data-focus="open">Dettagli e stato ' + ic('mdi:chevron-right') + '</button></div>' +
        '</div></div>' + (this._popup ? this._popupHTML(D, prof) : '') + '</div>';
      const nb = root.querySelector('.hc-mbody');
      if (nb) {
        nb.scrollTop = keep;
        if (this._room) {
          const h = nb.querySelector('[data-room-h="' + String(this._room).replace(/["\\]/g, '\\$&') + '"]');
          if (h) nb.scrollTop = Math.max(0, nb.scrollTop + h.getBoundingClientRect().top - nb.getBoundingClientRect().top - 8);
          this._room = null;
        }
      }
      if (this._popup) this._lockScroll();
      if (h0) window.requestAnimationFrame(() => { root.style.minHeight = ''; });
      if (want) { const el = root.querySelector('[data-focus="' + want + '"]'); if (el) el.focus({ preventScroll: true }); }
    }

    /* ---- interaction ---- */
    _click(e) {
      if (e.target && e.target.classList && e.target.classList.contains('hc-backdrop')) { this._closePopup(); return; }
      const t = e.target.closest ? e.target.closest('[data-profile],[data-open],[data-close],[data-filter],[data-area],[data-entity],[data-more],[data-do],[data-all],[data-alarm],[data-key],[data-alarm-go]') : null;
      if (!t) return;
      if (t.dataset.profile) {
        this._profile = t.dataset.profile;
        try { window.localStorage.setItem('home-check-card:profile', this._profile); } catch (err) { /* storage unavailable */ }
        this._render(); return;
      }
      if (t.dataset.do) { this._doAction(t.dataset.do); return; }
      if (t.dataset.all) { this._doAll(); return; }
      if (t.dataset.alarm) { this._openAlarm(); return; }
      if (t.dataset.key) { const k = t.dataset.key; this._code = k === 'b' ? this._code.slice(0, -1) : (this._code.length < 12 ? this._code + k : this._code); this._alarmErr = ''; this._focus = 'k-' + k; this._render(); return; }
      if (t.dataset.alarmGo) { this._alarmGo(t.dataset.alarmGo); return; }
      if (t.dataset.open) { this._openPopup(null, 'open'); return; }
      if (t.dataset.area) { this._openPopup(t.dataset.area, t.getAttribute('data-focus')); return; }
      if (t.dataset.entity) { this._moreInfo(t.dataset.entity); return; }
      if (t.dataset.more) { const id = t.dataset.more; this._closePopup(true); this._moreInfo(id); return; }
      if (t.dataset.close) { this._closePopup(); return; }
      if (t.dataset.filter) { this._filter = t.dataset.filter; this._render(); }
    }
    _moreInfo(entityId) {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: entityId }, bubbles: true, composed: true }));
    }
    _openPopup(room, ret) {
      this._ret = ret || 'open'; this._popup = true; this._view = 'list'; this._confirm = false; this._filter = compute(this._hass, this._cfg, this._profile).items.length ? 'bad' : 'all'; this._room = room; this._focus = 'close';
      document.addEventListener('keydown', this._onKey, true);
      this._render();
    }
    _closePopup(silent) {
      if (!this._popup) return;
      this._popup = false; this._view = 'list'; this._code = ''; this._alarmErr = ''; this._aconf = false; this._confirm = false; document.removeEventListener('keydown', this._onKey, true);
      this._focus = silent ? '' : this._ret; this._render();
    }
    // While the popup is open the dashboard behind must not move: the page is never restyled,
    // scroll gestures that would leave the dialog body are simply cancelled.
    _lockScroll() {
      const overlay = this._root.querySelector('.hc-backdrop');
      if (!overlay) return;
      const body = overlay.querySelector('.hc-mbody');
      const atEdge = (dy) => !body || (dy < 0 && body.scrollTop <= 0) || (dy > 0 && body.scrollTop + body.clientHeight >= body.scrollHeight - 1);
      overlay.addEventListener('wheel', (e) => { if (!body || !body.contains(e.target) || atEdge(e.deltaY)) e.preventDefault(); }, { passive: false });
      let y = 0;
      overlay.addEventListener('touchstart', (e) => { const t = e.touches[0]; y = t ? t.clientY : 0; }, { passive: true });
      overlay.addEventListener('touchmove', (e) => { const t = e.touches[0], dy = y - (t ? t.clientY : y); if (!body || !body.contains(e.target) || atEdge(dy)) e.preventDefault(); }, { passive: false });
    }
    _key(e) {
      if (!this._popup) return;
      if (e.key === 'Escape') { e.stopPropagation(); this._closePopup(); return; }
      if (e.key === 'Tab') {
        const dlg = this._root.querySelector('.hc-dialog'); if (!dlg) return;
        const f = [].slice.call(dlg.querySelectorAll('button')); if (!f.length) return;
        const first = f[0], last = f[f.length - 1], act = this.shadowRoot.activeElement;
        if (e.shiftKey && act === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
        else if (!dlg.contains(act)) { e.preventDefault(); first.focus(); }
      }
    }
  }

  /* ----------------------------------------------------------- the editor */
  const EDITOR_CSS = `
:host{display:block;color:var(--primary-text-color,#19221E);font-family:var(--ha-font-family-body,Roboto,Arial,sans-serif)}
*{box-sizing:border-box}
.ed{font-size:14px}
button,input,select{font:inherit;color:inherit}
.tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:14px;border-bottom:1px solid var(--divider-color,#E1E5E1)}
.tab{border:0;background:none;color:var(--secondary-text-color,#68716C);border-radius:13px;padding:10px 13px;white-space:nowrap;cursor:pointer}
.tab[aria-pressed="true"]{color:var(--primary-text-color,#19221E);background:var(--secondary-background-color,#F1F3EF);font-weight:650}
.heading{font-size:21px;font-weight:500;margin:25px 0 9px}
.desc{color:var(--secondary-text-color,#68716C);font-size:13px;line-height:1.5;margin-bottom:24px}
.field{display:block;margin:20px 0}
.label{font-size:14px;margin-bottom:10px}
.input{display:block;width:100%;background:var(--secondary-background-color,#F1F3EF);color:var(--primary-text-color,#19221E);border:0;border-bottom:1px solid var(--divider-color,#E1E5E1);padding:14px 13px;min-height:50px;border-radius:11px 11px 0 0}
.row{border-bottom:1px solid var(--divider-color,#E1E5E1);padding:13px 0;display:flex;align-items:center;justify-content:space-between;gap:15px}
.row label{flex:1;min-width:0}
.row input[type=checkbox],.room input[type=checkbox]{width:18px;height:18px;accent-color:var(--primary-color,#064E3B);flex:none}
.muted{font-size:12px;line-height:1.5;color:var(--secondary-text-color,#68716C)}
.tiny{font-size:11px;color:var(--secondary-text-color,#68716C);margin:9px 0}
.action{background:var(--secondary-background-color,#F1F3EF);border:1px solid var(--divider-color,#E1E5E1);color:var(--primary-text-color,#19221E);padding:5px 9px;min-width:34px;border-radius:10px;cursor:pointer}
.action:disabled{opacity:.45;cursor:not-allowed}
.more{margin:19px 0 10px;border-bottom:1px solid var(--divider-color,#E1E5E1);padding:0 0 11px}
.more summary{cursor:pointer;padding:13px 4px;color:var(--secondary-text-color,#68716C);font-size:13px;list-style:none}
.more summary::before{content:"\\25B8";font-size:10px;margin-right:10px}
.more[open] summary::before{content:"\\25BE"}
.more summary::-webkit-details-marker{display:none}
.picker{display:flex;gap:5px;overflow-x:auto;border-bottom:1px solid var(--divider-color,#E1E5E1);padding:14px 0 12px}
.chip{border:0;border-radius:13px;padding:10px 12px;flex:none;background:none;color:var(--secondary-text-color,#68716C);font-size:13px;cursor:pointer}
.chip[aria-pressed="true"]{background:var(--secondary-background-color,#F1F3EF);color:var(--primary-text-color,#19221E);font-weight:650}
.room{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--divider-color,#E1E5E1);padding:10px 0}
.room label{flex:1;min-width:0}
.ctl{display:flex;gap:6px;flex:none}
`;

  class HomeCheckCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = {}; this._hass = null; this._tab = 'controlli'; this._prof = 'esco'; this._more = false; this._last = ''; this._built = false;
      this.shadowRoot.addEventListener('click', (e) => this._click(e));
      this.shadowRoot.addEventListener('change', (e) => this._change(e));
      this.shadowRoot.addEventListener('input', (e) => this._input(e));
      this.shadowRoot.addEventListener('toggle', (e) => { if (e.target && e.target.id === 'more') this._more = e.target.open; }, true);
    }
    setConfig(config) {
      const j = JSON.stringify(config || {});
      if (this._built && j === this._last) return;
      this._config = clone(config || {}); this._last = j; this._render();
    }
    set hass(h) {
      const first = !this._hass; this._hass = h;
      if (first && this._built) this._render();
      else this.shadowRoot.querySelectorAll('ha-selector').forEach((s) => { s.hass = h; });
    }
    get hass() { return this._hass; }

    _emit(cfg) {
      this._config = cfg; this._last = JSON.stringify(cfg);
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: cfg }, bubbles: true, composed: true }));
    }
    _norm() { try { return normalizeConfig(this._config); } catch (e) { return normalizeConfig({}); } }
    _set(key, value) { const c = clone(this._config); if (value === undefined || value === '') delete c[key]; else c[key] = value; this._emit(c); }

    _fieldHTML(label, inner, help) { return '<div class="field"><div class="label">' + esc(label) + '</div>' + inner + (help ? '<div class="tiny">' + esc(help) + '</div>' : '') + '</div>'; }
    _checkHTML(id, label, help, on, extra) {
      return '<div class="row"><label for="' + id + '">' + esc(label) + (help ? '<div class="muted">' + esc(help) + '</div>' : '') + '</label><input type="checkbox" id="' + id + '" ' + (on ? 'checked' : '') + ' ' + (extra || '') + '></div>';
    }
    _controlli(n) {
      const p = this._prof, cats = n.categories[p];
      let h = '<div class="heading">Configurazione controlli</div><div class="desc">Seleziona un profilo, poi scegli cosa controllare. Le stanze arrivano dalle aree di Home Assistant.</div>' +
        '<div class="picker" role="group" aria-label="Profilo da configurare">' + PROFILE_IDS.map((id) => '<button type="button" class="chip" data-prof="' + id + '" id="p-' + id + '" aria-pressed="' + (id === p) + '">' + PROFILES[id].label + '</button>').join('') + '</div>' +
        '<div class="heading">Profilo ' + esc(PROFILES[p].label) + '</div><div class="desc">Categorie controllate quando questo profilo \u00e8 attivo. Uno stato non disponibile compare come \u00abnon verificabile\u00bb e non conta mai come a posto.</div>';
      KIND_ORDER.forEach((k) => { h += this._checkHTML('cat-' + k, KINDS[k].label, KINDS[k].help, cats[k], 'data-cat="' + k + '"'); });
      const rooms = roomList(this._hass, n);
      h += '<div class="heading">Stanze</div><div class="desc">Ordine del percorso e stanze incluse. Le aree nuove compaiono qui disattivate.</div>';
      if (!rooms.length) h += '<div class="muted">' + (this._hass ? 'Nessuna area con entit\u00e0 controllabili trovata. Assegna le entit\u00e0 a un\u2019area in Home Assistant.' : 'Caricamento delle aree\u2026') + '</div>';
      rooms.forEach((r, i) => {
        const nm = areaName(this._hass, r.area_id);
        h += '<div class="room"><input type="checkbox" id="room-' + i + '" data-room-on="' + i + '" ' + (r.on ? 'checked' : '') + '><label for="room-' + i + '">' + esc(nm) + '</label>' +
          '<div class="ctl"><button type="button" class="action" id="up-' + i + '" data-move="' + i + ':-1" aria-label="Sposta su ' + esc(nm) + '" ' + (i === 0 ? 'disabled' : '') + '>\u2191</button>' +
          '<button type="button" class="action" id="down-' + i + '" data-move="' + i + ':1" aria-label="Sposta gi\u00f9 ' + esc(nm) + '" ' + (i === rooms.length - 1 ? 'disabled' : '') + '>\u2193</button></div></div>';
      });
      h += '<details class="more" id="more" ' + (this._more ? 'open' : '') + '><summary>Altre opzioni</summary>' +
        this._fieldHTML('Escludi singole entit\u00e0 (facoltativo)', '<div data-slot="excluded"></div>', 'Utile per una finestra sempre aperta o una luce che resta accesa di proposito.') + '</details>';
      return h;
    }
    _aspetto(n) {
      return '<div class="heading">Aspetto Edera</div><div class="desc">Titolo, intestazione e tema, coerenti con le altre card.</div>' +
        this._fieldHTML('Intestazione superiore', '<input class="input" type="text" id="eyebrow" maxlength="60" value="' + esc(n.eyebrow) + '">') +
        this._fieldHTML('Titolo', '<input class="input" type="text" id="title" maxlength="60" value="' + esc(n.title) + '">', 'Il punto verde finale lo aggiunge la card.') +
        this._checkHTML('show-eyebrow', 'Mostra intestazione superiore', '', n.show_eyebrow) +
        this._checkHTML('show-title', 'Mostra titolo', '', n.show_title) +
        this._fieldHTML('Tema', '<select class="input" id="theme">' + [['auto', 'Automatico (Home Assistant)'], ['light', 'Light Edera'], ['dark', 'Dark Edera']].map((o) => '<option value="' + o[0] + '" ' + (n.theme_mode === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select>') +
        this._fieldHTML('Righe da sistemare visibili (1\u20135)', '<input class="input" type="number" id="rows" min="1" max="5" value="' + n.max_rows + '">', 'Su smartphone la card ne mostra al massimo 2; le altre sono nel popup.');
    }
    _avanzate(n) {
      return '<div class="heading">Azioni rapide</div><div class="desc">Dal popup puoi spegnere le entit\u00e0 da sistemare. Il pannello allarme chiede il codice se l\u2019entit\u00e0 ne ha uno impostato in Home Assistant. Le serrature non vengono mai comandate.</div>' +
        this._checkHTML('row-actions', 'Azioni sulle righe', 'Pulsante Spegni per luci, TV e prese accese.', n.row_actions) +
        this._checkHTML('bulk-action', 'Spegni tutto', 'Pulsante in fondo al popup, con conferma. Non include le tapparelle.', n.bulk_action) +
        this._checkHTML('cover-close', 'Tapparelle: pulsante Chiudi', 'Disattivato di default. Chiude la singola tapparella solo su tuo tocco.', n.cover_close) +
        this._checkHTML('alarm-panel', 'Pannello allarme', 'Un tocco sulla riga dell\u2019allarme apre il pannello con il pulsante. Il codice compare solo se l\u2019entit\u00e0 allarme ne ha uno impostato in Home Assistant; senza codice il pulsante comanda direttamente.', n.alarm_panel) +
        '<div class="heading">Interazione</div>' +
        this._checkHTML('row-tap', 'Un tocco su una riga del popup apre i dettagli', 'Nel popup apre i dettagli dell\u2019entit\u00e0 di Home Assistant. Le righe della card principale sono solo informative.', n.row_tap) +
        '<div class="heading">Allarme</div><div class="desc">Esco segnala l\u2019allarme in casa da disattivare, Notte richiede \u00abinserito in casa\u00bb, Vacanza \u00abinserito fuori casa\u00bb.</div>' +
        this._fieldHTML('Allarme (alarm_control_panel)', '<div data-slot="alarm"></div>') +
        '<div class="heading">Vacanza</div>' +
        this._fieldHTML('Automazione simulazione presenza (facoltativa)', '<div data-slot="sim"></div>', 'La card ne mostra soltanto lo stato, non la esegue.') +
        '<div class="muted" style="margin-top:18px">Le entit\u00e0 non disponibili sono sempre \u00abnon verificabili\u00bb, mai a posto.</div>';
    }
    _mount(slot, selector, value, cb) {
      const el = document.createElement('ha-selector');
      el.hass = this._hass; el.selector = selector; el.value = value; el.required = false;
      el.addEventListener('value-changed', (ev) => { ev.stopPropagation(); cb(ev.detail ? ev.detail.value : undefined); });
      slot.appendChild(el);
    }
    _render() {
      const n = this._norm(), t = this._tab;
      const act = this.shadowRoot.activeElement ? this.shadowRoot.activeElement.id : '';
      this.shadowRoot.innerHTML = '<style>' + EDITOR_CSS + '</style><div class="ed"><div class="tabs" role="group" aria-label="Sezioni">' +
        [['controlli', 'Controlli'], ['aspetto', 'Aspetto'], ['avanzate', 'Avanzate']].map((a) => '<button type="button" class="tab" data-tab="' + a[0] + '" id="t-' + a[0] + '" aria-pressed="' + (t === a[0]) + '">' + a[1] + '</button>').join('') + '</div>' +
        (t === 'controlli' ? this._controlli(n) : t === 'aspetto' ? this._aspetto(n) : this._avanzate(n)) + '</div>';
      this._built = true;
      const sl = (name) => this.shadowRoot.querySelector('[data-slot="' + name + '"]');
      if (sl('excluded')) this._mount(sl('excluded'), { entity: { multiple: true } }, n.excluded, (v) => { const c = clone(this._config); if (Array.isArray(v) && v.length) c.excluded = v; else delete c.excluded; this._emit(c); });
      if (sl('alarm')) this._mount(sl('alarm'), { entity: { domain: 'alarm_control_panel' } }, n.alarm_entity || undefined, (v) => this._set('alarm_entity', v || undefined));
      if (sl('sim')) this._mount(sl('sim'), { entity: { domain: ['automation', 'input_boolean', 'switch'] } }, n.simulation_entity || undefined, (v) => this._set('simulation_entity', v || undefined));
      if (act) { const el = this.shadowRoot.getElementById(act); if (el && !el.disabled) el.focus({ preventScroll: true }); }
    }
    _materializeRooms(mutator) {
      const n = this._norm(); const list = roomList(this._hass, n); mutator(list);
      const c = clone(this._config); c.rooms = list.map((r) => ({ area_id: r.area_id, on: r.on })); this._emit(c);
    }
    _click(e) {
      let t = e.target.closest('[data-tab]'); if (t) { this._tab = t.dataset.tab; this._render(); return; }
      t = e.target.closest('[data-prof]'); if (t) { this._prof = t.dataset.prof; this._render(); return; }
      t = e.target.closest('[data-move]');
      if (t) {
        const a = t.dataset.move.split(':').map(Number), i = a[0], j = i + a[1];
        this._materializeRooms((list) => { if (j < 0 || j >= list.length) return; const tmp = list[i]; list[i] = list[j]; list[j] = tmp; });
        this._render();
      }
    }
    _change(e) {
      const el = e.target, c = clone(this._config), n = this._norm();
      if (el.dataset && el.dataset.cat) {
        c.categories = c.categories || {};
        c.categories[this._prof] = Object.assign({}, n.categories[this._prof], { [el.dataset.cat]: el.checked });
        this._emit(c); return;
      }
      if (el.dataset && el.dataset.roomOn !== undefined) { this._materializeRooms((list) => { list[Number(el.dataset.roomOn)].on = el.checked; }); return; }
      if (el.id === 'show-eyebrow') { c.show_eyebrow = el.checked; this._emit(c); return; }
      if (el.id === 'show-title') { c.show_title = el.checked; this._emit(c); return; }
      if (el.id === 'row-tap') { c.row_tap = el.checked; this._emit(c); return; }
      if (el.id === 'row-actions') { c.row_actions = el.checked; this._emit(c); return; }
      if (el.id === 'bulk-action') { c.bulk_action = el.checked; this._emit(c); return; }
      if (el.id === 'cover-close') { c.cover_close = el.checked; this._emit(c); return; }
      if (el.id === 'alarm-panel') { c.alarm_panel = el.checked; this._emit(c); return; }
      if (el.id === 'theme') { c.theme_mode = el.value; this._emit(c); return; }
      if (el.id === 'rows') { const v = Math.max(1, Math.min(5, parseInt(el.value, 10) || 2)); el.value = v; c.max_rows = v; this._emit(c); }
    }
    _input(e) {
      const el = e.target;
      if (el.id === 'eyebrow') this._set('eyebrow', el.value);
      else if (el.id === 'title') this._set('title', el.value);
    }
  }

  if (!customElements.get(TAG)) customElements.define(TAG, HomeCheckCard);
  if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, HomeCheckCardEditor);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === TAG)) {
    window.customCards.push({ type: TAG, name: 'Home Check Card', description: 'Controllo unico per uscire di casa o andare a letto: stanze, profili Esco / Notte / Vacanza e azioni rapide.', preview: true });
  }
  // eslint-disable-next-line no-console
  console.info('%c HOME-CHECK-CARD %c ' + VERSION + ' ', 'color:#fff;background:#0a7156;font-weight:700', 'color:#0a7156;background:#fff');
})();
