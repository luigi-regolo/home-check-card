/**
 * Home Check Card — Home Assistant dashboard card. Version 1.1
 * Copyright (c) 2026 luigi-regolo. SPDX-License-Identifier: GPL-3.0-only.
 * Read-only: the card never sends commands.
 * No external scripts, fonts, analytics or assets.
 */
(() => {
  'use strict';

  const VERSION = '1.1';
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
    alarm:  { label: 'Allarme',           help: 'Sola lettura. Esco: segnala l\u2019allarme in casa da disattivare. Notte: richiede \u00abin casa\u00bb. Vacanza: richiede \u00abfuori casa\u00bb.', icon: 'mdi:shield-check' }
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
    theme_mode: 'auto', max_rows: 2, row_tap: true, default_profile: 'esco'
  };
  const LV_HEAD = { ok: 'Tutto a posto', warn: 'Da sistemare', crit: 'Critico', unk: 'Non verificabile', none: 'Nessun controllo' };
  const NODE_ICON = { ok: 'mdi:check', warn: 'mdi:alert', crit: 'mdi:alert', unk: 'mdi:help', none: 'mdi:minus' };
  const TAG_TXT = { warn: 'Da sistemare', crit: 'Critico', unk: 'Non verificabile' };
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
  --hc-warn:#C89643;--hc-on-warn:#2b1c04;--hc-warn-text:#7a520f;--hc-alert:#B85D55;--hc-on-alert:#ffffff;--hc-alert-text:#9a3f37;--hc-idle:#858E89;
  display:block;font-family:var(--ha-font-family-body,var(--paper-font-body1_-_font-family,Roboto,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif));color:var(--hc-fg);font-size:14px;line-height:1.4;text-align:left}
.hc[data-mode="dark"]{--hc-accent:#0e795d;--hc-bg:#101211;--hc-tile:#191c1a;--hc-circle:#282b29;--hc-line:#2b302c;--hc-fg:#f5f7f4;--hc-muted:#bbc5bd;--hc-btn-fg:#f5f7f4;
  --hc-warn:#D8B05D;--hc-on-warn:#2b1c04;--hc-warn-text:#e3bc6c;--hc-alert:#D27369;--hc-on-alert:#2a0d0a;--hc-alert-text:#eb978d;--hc-idle:#8B918E}
.hc *,.hc *::before,.hc *::after{box-sizing:border-box}
.hc button{font:inherit;color:inherit;cursor:pointer}
.hc button:focus-visible{outline:2px solid var(--hc-accent);outline-offset:3px}
.hc ha-icon{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;line-height:1;flex:none;width:var(--is,18px);height:var(--is,18px);--mdc-icon-size:var(--is,18px)}
.hc-wrap{container-type:inline-size;width:100%;max-width:100%;min-width:0}
.hc-shell{background:var(--hc-bg);color:var(--hc-fg);border:1px solid var(--hc-line);border-radius:26px;padding:14px;width:100%;min-width:0}
.hc-top{display:grid;gap:8px;margin-bottom:10px}
.hc-head{margin:2px 4px 0;min-width:0}
.hc-eyebrow{font-size:10px;letter-spacing:1.7px;font-weight:750;color:var(--hc-muted);margin-bottom:7px;overflow-wrap:anywhere}
.hc-title{font-size:23px;line-height:1.14;font-weight:780;letter-spacing:-.7px;overflow-wrap:anywhere}
.hc-title b{color:var(--hc-accent);font-weight:800}
.hc-prof{display:flex;gap:4px;padding:3px;background:var(--hc-tile);border:1px solid var(--hc-line);border-radius:999px}
.hc-prof button{flex:1;min-width:0;min-height:34px;border:0;border-radius:999px;background:transparent;color:var(--hc-muted);font-size:13px;font-weight:600}
.hc-prof button[aria-pressed="true"]{background:var(--hc-accent);color:#fff}
.hc-body{display:grid;gap:10px;grid-template-columns:minmax(0,1fr);grid-template-areas:"hero" "spine" "list"}
.hc-hero{grid-area:hero;min-width:0}.hc-spine{grid-area:spine;min-width:0}.hc-list{grid-area:list;min-width:0}
.hc-label{margin:0 4px 8px;color:var(--hc-muted);font-size:10px;letter-spacing:1.7px;font-weight:700;text-transform:uppercase}
.hc-hero-label{display:none}
.hc-panel{background:var(--hc-tile);border:1px solid var(--hc-line);border-radius:20px;padding:10px 12px;min-width:0}
.hc-verdict{display:flex;align-items:center;gap:12px;min-width:0}
.hc-orb{width:40px;height:40px;flex:none;border-radius:50%;display:grid;place-items:center;--is:24px}
.hc-orb[data-lv="ok"]{background:var(--hc-accent);color:#fff}
.hc-orb[data-lv="warn"]{background:var(--hc-warn);color:var(--hc-on-warn)}
.hc-orb[data-lv="crit"]{background:var(--hc-alert);color:var(--hc-on-alert)}
.hc-orb[data-lv="unk"]{background:var(--hc-circle);border:2px dashed var(--hc-idle);color:var(--hc-muted)}
.hc-orb[data-lv="none"]{background:var(--hc-circle);border:1px solid var(--hc-line);color:var(--hc-muted)}
.hc-vt{font-size:18px;font-weight:700;line-height:1.15;letter-spacing:-.4px;overflow-wrap:anywhere}
.hc-vs{margin-top:2px;font-size:12px;color:var(--hc-muted)}
.hc-line{display:flex;padding:4px 0 2px}
.hc-st{position:relative;flex:1 1 0;min-width:44px;display:flex;flex-direction:column;align-items:center;gap:7px;padding:0 0 2px;border:0;background:none;border-radius:10px}
.hc-sl,.hc-sr{position:absolute;top:9.5px;width:50%;height:3px;border-radius:2px;background:var(--hc-line)}
.hc-sl{left:0}.hc-sr{right:0}
.hc-node{position:relative;z-index:1;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:none;box-shadow:0 0 0 3px var(--hc-bg);--is:13px}
.hc-sname{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;color:var(--hc-muted)}
.hc-snote{display:none;max-width:100%;padding:0 6px;text-align:center;font-size:11.5px;line-height:1.3;color:var(--hc-muted)}
.hc-st[data-lv="ok"] .hc-node{background:var(--hc-accent);color:#fff}
.hc-st[data-lv="ok"] .hc-sl,.hc-st[data-lv="ok"] .hc-sr{background:color-mix(in srgb,var(--hc-accent) 45%,transparent)}
.hc-st[data-lv="warn"] .hc-node{background:var(--hc-warn);color:var(--hc-on-warn);box-shadow:0 0 0 3px var(--hc-bg),0 0 0 6px color-mix(in srgb,var(--hc-warn) 22%,transparent)}
.hc-st[data-lv="warn"] .hc-sl,.hc-st[data-lv="warn"] .hc-sr{background:color-mix(in srgb,var(--hc-warn) 55%,transparent)}
.hc-st[data-lv="crit"] .hc-node{background:var(--hc-alert);color:var(--hc-on-alert);box-shadow:0 0 0 3px var(--hc-bg),0 0 0 6px color-mix(in srgb,var(--hc-alert) 24%,transparent)}
.hc-st[data-lv="crit"] .hc-sl,.hc-st[data-lv="crit"] .hc-sr{background:color-mix(in srgb,var(--hc-alert) 60%,transparent)}
.hc-st[data-lv="unk"] .hc-node{background:var(--hc-bg);border:1.5px dashed var(--hc-idle);color:var(--hc-muted)}
.hc-st[data-lv="unk"] .hc-sl,.hc-st[data-lv="unk"] .hc-sr{height:0;background:none;border-top:3px dotted var(--hc-idle);border-radius:0}
.hc-st[data-lv="none"] .hc-node{background:var(--hc-tile);border:1px solid var(--hc-line);color:var(--hc-muted)}
.hc-st:not([data-lv="ok"]):not([data-lv="none"]) .hc-sname{color:var(--hc-fg);font-weight:700}
.hc-st[data-lv="warn"] .hc-snote{color:var(--hc-warn-text)}
.hc-st[data-lv="crit"] .hc-snote{color:var(--hc-alert-text)}
.hc-items{display:flex;flex-direction:column;gap:6px}
.hc-row{display:flex;align-items:center;gap:10px;min-width:0;padding:7px 10px;background:var(--hc-tile);border:1px solid var(--hc-line);border-radius:16px;text-align:left;font:inherit;width:100%}
.hc button.hc-row{cursor:pointer}
.hc button.hc-row:hover{border-color:color-mix(in srgb,var(--hc-accent) 45%,var(--hc-line))}
.hc-ico{width:32px;height:32px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--hc-circle);--is:18px}
.hc-row[data-lv="warn"] .hc-ico{background:color-mix(in srgb,var(--hc-warn) 24%,var(--hc-circle));color:var(--hc-warn-text)}
.hc-row[data-lv="crit"] .hc-ico{background:color-mix(in srgb,var(--hc-alert) 24%,var(--hc-circle));color:var(--hc-alert-text)}
.hc-row[data-lv="unk"] .hc-ico{border:1.5px dashed var(--hc-idle);color:var(--hc-muted)}
.hc-rt{flex:1;min-width:0}
.hc-rn{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hc-rs{font-size:12px;margin-top:2px;color:var(--hc-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hc-row[data-lv="warn"] .d{color:var(--hc-warn-text);font-weight:600}
.hc-row[data-lv="crit"] .d{color:var(--hc-alert-text);font-weight:600}
.hc-tag{display:none;flex:none;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.hc-row[data-lv="warn"] .hc-tag{background:color-mix(in srgb,var(--hc-warn) 20%,transparent);color:var(--hc-warn-text)}
.hc-row[data-lv="crit"] .hc-tag{background:color-mix(in srgb,var(--hc-alert) 20%,transparent);color:var(--hc-alert-text)}
.hc-row[data-lv="unk"] .hc-tag{border:1px dashed var(--hc-idle);color:var(--hc-muted)}
.hc .hc-more{align-self:flex-start;margin:0 4px;padding:6px 4px;border:0;background:none;color:var(--hc-muted);font-size:12px;text-decoration:underline;text-underline-offset:3px}
.hc-empty .hc-ico{background:var(--hc-accent);color:#fff}
.hc-empty .hc-rn{white-space:normal}
.hc-sim{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--hc-line);border-radius:16px;font-size:12px;color:var(--hc-muted)}
.hc-foot{margin-top:10px}
.hc .hc-detail{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:40px;padding:8px 14px;border-radius:999px;font-weight:600;font-size:13.5px;line-height:1.2;color:var(--hc-btn-fg);border:1px solid color-mix(in srgb,var(--hc-accent) 45%,transparent);background:color-mix(in srgb,var(--hc-accent) 12%,transparent)}
.hc .hc-detail:hover{background:color-mix(in srgb,var(--hc-accent) 22%,transparent)}
@container (max-width:420px){.hc-shell{padding:12px;border-radius:23px}.hc-title{font-size:21px}}
@container (min-width:480px){
  .hc-tag{display:inline-flex}.hc-vt{font-size:20px}
  .hc-orb{width:44px;height:44px;--is:26px}.hc-panel{padding:12px 14px}
}
@container (min-width:640px){
  .hc-shell{padding:16px}
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
.hc .hc-close{display:flex;justify-content:center;align-items:center;line-height:0;margin:0;width:40px;height:40px;padding:0;flex:none;border:1px solid var(--hc-line);border-radius:50%;background:var(--hc-tile);color:var(--hc-fg);--is:18px}
.hc-mbody{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:12px 18px 18px;min-width:0}
.hc-psub{margin:2px 4px 12px;font-size:12px;color:var(--hc-muted)}
.hc-pfilters{display:flex;gap:6px;margin-bottom:4px}
.hc .hc-chip{min-height:36px;padding:0 14px;border:1px solid var(--hc-line);border-radius:999px;background:var(--hc-tile);color:var(--hc-muted);font-size:13px}
.hc .hc-chip[aria-pressed="true"]{background:color-mix(in srgb,var(--hc-accent) 14%,transparent);border-color:color-mix(in srgb,var(--hc-accent) 45%,transparent);color:var(--hc-fg);font-weight:600}
.hc-grp{min-width:0}
.hc-rh{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:18px 4px 2px;color:var(--hc-muted);font-size:10px;letter-spacing:1.7px;font-weight:700;text-transform:uppercase}
.hc-rh em{font-style:normal;letter-spacing:.2px;text-transform:none;font-size:11px;font-weight:700}
.hc-rh em[data-lv="warn"]{color:var(--hc-warn-text)}.hc-rh em[data-lv="crit"]{color:var(--hc-alert-text)}.hc-rh em[data-lv="ok"]{color:var(--hc-accent)}
.hc-metric{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;background:var(--hc-tile);border:1px solid var(--hc-line);padding:12px 14px;border-radius:14px;margin-top:8px;text-align:left;font:inherit}
.hc button.hc-metric{cursor:pointer}
.hc-metric .m-l{display:flex;align-items:center;gap:10px;min-width:0;color:var(--hc-muted);font-size:12px}
.hc-metric strong{font-size:13px;font-weight:600;text-align:right}
.m-g{display:grid;place-items:center;width:22px;height:22px;flex:none;border-radius:50%;font-style:normal;--is:13px}
.hc-metric[data-lv="ok"] .m-g{background:var(--hc-accent);color:#fff}
.hc-metric[data-lv="warn"] .m-g{background:var(--hc-warn);color:var(--hc-on-warn)}
.hc-metric[data-lv="crit"] .m-g{background:var(--hc-alert);color:var(--hc-on-alert)}
.hc-metric[data-lv="unk"] .m-g{border:1.5px dashed var(--hc-idle);color:var(--hc-muted)}
.hc-metric[data-lv="warn"] strong{color:var(--hc-warn-text)}.hc-metric[data-lv="crit"] strong{color:var(--hc-alert-text)}
:host([data-popup="wide"]) .hc-dialog{width:min(1120px,100%);height:min(80vh,560px);height:min(80dvh,560px)}
:host([data-popup="wide"]) .hc-mbody{padding:12px 22px 22px}
:host([data-popup="wide"]) .hc-cols{column-width:260px;column-gap:18px;column-fill:balance}
:host([data-popup="wide"]) .hc-grp{break-inside:avoid;padding-top:12px}
:host([data-popup="wide"]) .hc-grp .hc-rh{margin-top:6px}
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
      this._popup = false; this._filter = 'all'; this._room = null; this._ret = 'open'; this._focus = '';
      this._prevOverflow = null;
      this._onKey = (e) => this._key(e);
      this._onResize = () => this._applyLayout();
      this._timer = null; this._ro = null;
      this.shadowRoot.addEventListener('click', (e) => this._click(e));
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
      this._unlock();
    }

    _applyLayout() {
      const wide = !IS_PHONE && window.matchMedia('(min-width:640px) and (min-height:600px)').matches;
      this.setAttribute('data-popup', wide ? 'wide' : 'phone');
    }

    _signature() {
      const h = this._hass, c = this._cfg;
      if (!h) return '';
      const parts = [h.themes && h.themes.darkMode ? 'd' : 'l', Object.keys(h.areas || {}).length];
      discover(h).forEach((t) => { const s = h.states[t.entity_id]; parts.push(t.entity_id + ':' + (s ? s.state : '-')); });
      if (c.alarm_entity) { const s = h.states[c.alarm_entity]; parts.push('A:' + (s ? s.state : '-')); }
      if (c.simulation_entity) { const s = h.states[c.simulation_entity]; parts.push('S:' + (s ? s.state : '-')); }
      return parts.join('|');
    }

    _mode() {
      const m = this._cfg.theme_mode;
      if (m === 'light' || m === 'dark') return m;
      return this._hass && this._hass.themes && this._hass.themes.darkMode ? 'dark' : 'light';
    }

    /* ---- markup ---- */
    _rowHTML(c) {
      const tap = this._cfg.row_tap && c.entity_id;
      const tagN = tap ? 'button type="button"' : 'div', end = tap ? 'button' : 'div';
      return '<' + tagN + ' class="hc-row" data-lv="' + c.lv + '"' + (tap ? ' data-entity="' + esc(c.entity_id) + '" data-focus="r-' + esc(c.entity_id) + '"' : '') + '>' +
        '<div class="hc-ico">' + ic(iconFor(c)) + '</div><div class="hc-rt"><div class="hc-rn">' + esc(c.name) + '</div><div class="hc-rs">' + esc(c.room) + ' \u00b7 <span class="d">' + esc(c.detail) + '</span></div></div>' +
        '<span class="hc-tag">' + TAG_TXT[c.lv] + '</span></' + end + '>';
    }
    _metricHTML(c) {
      const tap = this._cfg.row_tap && c.entity_id;
      const inner = '<span class="m-l"><i class="m-g">' + ic(NODE_ICON[c.lv]) + '</i>' + esc(c.name) + '</span><strong>' + esc(cap(c.detail)) + '</strong>';
      return tap ? '<button type="button" class="hc-metric" data-lv="' + c.lv + '" data-more="' + esc(c.entity_id) + '">' + inner + '</button>'
                 : '<div class="hc-metric" data-lv="' + c.lv + '">' + inner + '</div>';
    }
    _popupHTML(D, prof) {
      const f = this._filter;
      let body = '<div class="hc-psub">Profilo ' + esc(prof.label) + '</div><div class="hc-pfilters" role="group" aria-label="Filtro controlli">' +
        [['all', 'Tutti'], ['bad', 'Da sistemare']].map((a) => '<button type="button" class="hc-chip" data-filter="' + a[0] + '" data-focus="f-' + a[0] + '" aria-pressed="' + (f === a[0]) + '">' + a[1] + '</button>').join('') + '</div>';
      let any = false;
      body += '<div class="hc-cols">';
      if (D.house.length) {
        const hr = f === 'all' ? D.house : D.house.filter((c) => c.lv !== 'ok');
        if (hr.length) {
          any = true; let hl = 'ok'; hr.forEach((c) => { if (RANK[c.lv] > RANK[hl]) hl = c.lv; });
          body += '<div class="hc-grp"><div class="hc-rh" data-room-h="__casa"><span>Casa</span><em data-lv="' + hl + '">' + LV_HEAD[hl] + '</em></div>' + hr.map((c) => this._metricHTML(c)).join('') + '</div>';
        }
      }
      D.rooms.forEach((r) => {
        const own = r.checks.filter((c) => c.kind !== 'alarm');
        const rows = f === 'all' ? own : own.filter((c) => c.lv !== 'ok');
        if (!rows.length && !(f === 'all' && !own.length)) return;
        any = true;
        body += '<div class="hc-grp"><div class="hc-rh" data-room-h="' + esc(r.area_id) + '"><span>' + esc(r.name) + '</span><em data-lv="' + r.lv + '">' + LV_HEAD[r.lv] + '</em></div>' +
          (rows.length ? rows.map((c) => this._metricHTML(c)).join('') : '<div class="hc-metric"><span class="m-l">Nessun controllo attivo per questa stanza</span></div>') + '</div>';
      });
      if (!any) body += '<div class="hc-metric"><span class="m-l">' + (f === 'bad' ? 'Niente da sistemare' : 'Nessuna stanza configurata') + '</span></div>';
      body += '</div>';
      return '<div class="hc-backdrop" role="presentation"><div class="hc-dialog" role="dialog" aria-modal="true" aria-labelledby="hc-pt">' +
        '<div class="hc-mhead"><h3 class="hc-mtitle" id="hc-pt">Dettagli controllo</h3><button type="button" class="hc-close" data-close="1" data-focus="close" aria-label="Chiudi">' + ic('mdi:close') + '</button></div>' +
        '<div class="hc-mbody">' + body + '</div></div></div>';
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
      const capRows = this._compact ? Math.min(2, cfg.max_rows) : cfg.max_rows;
      const shown = D.items.slice(0, capRows), more = D.items.length - shown.length;
      const title = cleanTitle(cfg.title) || 'Controllo casa';
      const head = (cfg.show_eyebrow && cfg.eyebrow ? '<div class="hc-eyebrow">' + esc(cfg.eyebrow) + '</div>' : '') + (cfg.show_title ? '<div class="hc-title" role="heading" aria-level="2">' + esc(title) + '<b>.</b></div>' : '');
      const profBtns = PROFILE_IDS.map((id) => '<button type="button" data-profile="' + id + '" data-focus="p-' + id + '" aria-pressed="' + (id === this._profile) + '">' + PROFILES[id].short + '</button>').join('');
      const stations = D.rooms.map((r, i) => '<button type="button" class="hc-st" data-lv="' + r.lv + '" data-area="' + esc(r.area_id) + '" data-focus="s-' + i + '" aria-label="' + esc(r.name) + ': ' + LV_HEAD[r.lv].toLowerCase() + '. Apri i dettagli">' +
        (i > 0 ? '<i class="hc-sl"></i>' : '') + (i < D.rooms.length - 1 ? '<i class="hc-sr"></i>' : '') +
        '<span class="hc-node">' + ic(NODE_ICON[r.lv]) + '</span><span class="hc-sname">' + esc(r.name) + '</span><span class="hc-snote">' + esc(r.note) + '</span></button>').join('');
      let list = '<div class="hc-label">Da sistemare' + (D.items.length ? ' \u00b7 ' + D.items.length : '') + '</div><div class="hc-items">' + shown.map((c) => this._rowHTML(c)).join('');
      if (more > 0) list += '<button type="button" class="hc-more" data-open="1" data-focus="more">+' + more + (more === 1 ? ' altra nel popup' : ' altre nel popup') + '</button>';
      if (!D.items.length) list += '<div class="hc-row hc-empty"><div class="hc-ico">' + ic(D.checks.length ? 'mdi:check' : 'mdi:minus') + '</div><div class="hc-rt"><div class="hc-rn">' + (D.checks.length ? 'Niente da sistemare' : 'Nessun controllo attivo') + '</div><div class="hc-rs" style="white-space:normal">' + (D.checks.length ? 'Tutti i controlli del profilo ' + esc(prof.label) + ' sono a posto' : 'Abilita una categoria nell\u2019editor') + '</div></div></div>';
      if (this._profile === 'vacanza' && cfg.simulation_entity) {
        const ss = hass.states[cfg.simulation_entity];
        list += '<div class="hc-sim">' + ic('mdi:clock-outline') + '<span>' + (ss && ss.state === 'on' ? 'Simulazione presenza attiva' : (ss && (ss.state === 'unavailable' || ss.state === 'unknown') ? 'Simulazione presenza non verificabile' : 'Simulazione presenza non attiva')) + '</span></div>';
      }
      list += '</div>';
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
      if (want) { const el = root.querySelector('[data-focus="' + want + '"]'); if (el) el.focus({ preventScroll: true }); }
    }

    /* ---- interaction ---- */
    _click(e) {
      if (e.target && e.target.classList && e.target.classList.contains('hc-backdrop')) { this._closePopup(); return; }
      const t = e.target.closest ? e.target.closest('[data-profile],[data-open],[data-close],[data-filter],[data-area],[data-entity],[data-more]') : null;
      if (!t) return;
      if (t.dataset.profile) {
        this._profile = t.dataset.profile;
        try { window.localStorage.setItem('home-check-card:profile', this._profile); } catch (err) { /* storage unavailable */ }
        this._render(); return;
      }
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
      this._ret = ret || 'open'; this._popup = true; this._filter = 'all'; this._room = room; this._focus = 'close';
      this._lock(); document.addEventListener('keydown', this._onKey, true);
      this._render();
    }
    _closePopup(silent) {
      if (!this._popup) return;
      this._popup = false; document.removeEventListener('keydown', this._onKey, true); this._unlock();
      this._focus = silent ? '' : this._ret; this._render();
    }
    _lock() { if (this._prevOverflow === null) { this._prevOverflow = document.documentElement.style.overflow || ''; document.documentElement.style.overflow = 'hidden'; } }
    _unlock() { if (this._prevOverflow !== null) { document.documentElement.style.overflow = this._prevOverflow; this._prevOverflow = null; } }
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
      return '<div class="heading">Interazione</div><div class="desc">La card \u00e8 in sola lettura: non comanda nessuna entit\u00e0.</div>' +
        this._checkHTML('row-tap', 'Un tocco su una riga apre i dettagli', 'Apre i dettagli dell\u2019entit\u00e0 di Home Assistant, dove usi le card dedicate (luci, tapparelle, allarme).', n.row_tap) +
        '<div class="heading">Allarme</div><div class="desc">Sola lettura. Esco segnala l\u2019allarme in casa da disattivare, Notte richiede \u00abinserito in casa\u00bb, Vacanza \u00abinserito fuori casa\u00bb. I comandi restano nella card dell\u2019allarme.</div>' +
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
    window.customCards.push({ type: TAG, name: 'Home Check Card', description: 'Controllo unico per uscire di casa o andare a letto: stanze, profili Esco / Notte / Vacanza, sola lettura.', preview: true });
  }
  // eslint-disable-next-line no-console
  console.info('%c HOME-CHECK-CARD %c ' + VERSION + ' ', 'color:#fff;background:#0a7156;font-weight:700', 'color:#0a7156;background:#fff');
})();
