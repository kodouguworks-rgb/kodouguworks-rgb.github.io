/* store.js — 時間の記録 v5 の記録の形・読む・保存・引き継ぎ・計算（画面に触らない）
   仕様：作りの決め.md §3・§4。鍵 jikan_v5 だけに書く。jikan_v3・jikan_v1 は読むだけ。 */
(function () {
  'use strict';

  var MIN = 60000, DAY = 86400000;
  var KEY = 'jikan_v5', KEY_V3 = 'jikan_v3';
  var DEFAULT_NAMES = ['仕事', '学び', '家事', '運動', '休憩', '趣味'];
  var seq = 0;

  /* ---------- 小さな道具 ---------- */
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function chars(s, n) { return Array.from(String(s == null ? '' : s)).slice(0, n).join(''); }
  function sid(x) { return String(x == null ? '' : x).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32) || '_'; }
  function intIn(x, lo, hi, def) {
    var n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x;
    if (!isNum(n)) return def;
    n = Math.floor(n);
    return n >= lo && n <= hi ? n : def;
  }
  function cleanName(x) { return chars(String(x == null ? '' : x).replace(/[\r\n\t]+/g, ' ').trim(), 12); }
  function cleanText(x) { return chars(x, 200); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function nowOr(now) { return isNum(now) ? now : Date.now(); }

  function uid() {
    seq = (seq + 1) % 1296;
    return 'x' + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36) + seq.toString(36);
  }

  function defaultItems() {
    return DEFAULT_NAMES.map(function (n, i) { return { id: 'i' + (i + 1), name: n, tone: i % 3, hidden: false }; });
  }
  function fresh() {
    return { v: 5, items: defaultItems(), logs: [], focus: { len: 25, rest: 5 }, rest: null, habits: [], tabs: { habit: true, cal: true }, old: null };
  }

  /* ---------- 日付（端末の時刻） ---------- */
  function dayStart(ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function addDays(ms, n) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function weekStart(ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime(); }

  /* ---------- 形をそろえる ---------- */
  function sanitizeHabit(h) {
    if (!isObj(h) || (h.kind !== 'do' && h.kind !== 'quit')) return null;
    var o = { id: sid(h.id), kind: h.kind, name: cleanName(h.name) || '名前なし' };
    if (h.kind === 'do') {
      o.perWeek = intIn(h.perWeek, 1, 7, 3);
      o.marks = {};
      if (isObj(h.marks)) Object.keys(h.marks).forEach(function (k) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && (h.marks[k] === 'done' || h.marks[k] === 'skip')) o.marks[k] = h.marks[k];
      });
    } else {
      if (!isNum(h.since) || h.since < 0) return null;
      o.since = h.since;
      o.unit = chars(String(h.unit == null ? '' : h.unit).trim(), 4) || '回';
      o.perDay = intIn(h.perDay, 0, 999, 0);
      o.price = intIn(h.price, 0, 99999, 0);
      o.resets = [];
      if (Array.isArray(h.resets)) h.resets.forEach(function (r) {
        if (isObj(r) && isNum(r.at) && isNum(r.since)) o.resets.push({ at: r.at, since: r.since });
      });
      o.why = cleanText(h.why);
    }
    return o;
  }

  var T_MIN = new Date(2000, 0, 1).getTime();   /* これより前の start は捨てる */
  function sanitize(obj, now) {
    var o = fresh();
    if (!isObj(obj)) return o;
    var seen, tMax = nowOr(now) + 24 * 60 * MIN;   /* いま＋1日より先の時刻は捨てる */

    if (Array.isArray(obj.items)) {
      o.items = []; seen = Object.create(null);
      obj.items.forEach(function (it) {
        if (!isObj(it)) return;
        var id = sid(it.id);
        if (seen[id]) return;
        seen[id] = 1;
        o.items.push({ id: id, name: cleanName(it.name) || '名前なし', tone: intIn(it.tone, 0, 2, 0), hidden: it.hidden === true });
      });
    }

    if (isObj(obj.focus)) {
      o.focus.len = intIn(obj.focus.len, 1, 240, 25);
      o.focus.rest = intIn(obj.focus.rest, 1, 60, 5);
    }

    if (Array.isArray(obj.logs)) {
      seen = Object.create(null);
      obj.logs.forEach(function (l) {
        if (!isObj(l) || !isNum(l.start) || l.start < 0) return;
        var end = isNum(l.end) ? l.end : null;
        if (end !== null && end < l.start) return;
        if (l.start < T_MIN || l.start > tMax || (end !== null && end > tMax)) return;
        if (end !== null && end - l.start < MIN) return;   /* 閉じていて60秒未満は、記録に残さない（計測中は残す） */
        var id = sid(l.id);
        if (seen[id]) id = uid();
        seen[id] = 1;
        var focus = l.mode === 'focus';
        o.logs.push({ id: id, item: sid(l.item), start: l.start, end: end, mode: focus ? 'focus' : 'free', plan: focus ? intIn(l.plan, 1, 240, 25) : null, memo: cleanText(l.memo) });
      });
      o.logs.sort(function (a, b) { return a.start - b.start; });
      var keep = null;
      o.logs.forEach(function (l) { if (l.end === null) keep = l; }); /* start の順なので、最後＝新しい1つ */
      o.logs.forEach(function (l) { if (l.end === null && l !== keep) l.end = l.start + MIN; });
    }

    if (isObj(obj.rest) && isNum(obj.rest.until)) o.rest = { until: obj.rest.until };

    if (Array.isArray(obj.habits)) {
      seen = Object.create(null);
      obj.habits.forEach(function (h) {
        var n = sanitizeHabit(h);
        if (!n || seen[n.id]) return;
        seen[n.id] = 1;
        o.habits.push(n);
      });
    }

    if (isObj(obj.tabs)) o.tabs = { habit: obj.tabs.habit !== false, cal: obj.tabs.cal !== false };

    if (isObj(obj.old)) { try { o.old = clone(obj.old); } catch (e) { o.old = null; } }
    return o;
  }

  /* ---------- 前の版（jikan_v3）から ---------- */
  function validV3(d) {
    return isObj(d) && Array.isArray(d.kinds) && Array.isArray(d.entries) &&
      d.entries.every(function (e) { return isObj(e) && isNum(e.start); });
  }
  function migrateV3(v3, now) {
    var o = fresh();
    if (!isObj(v3)) return o;
    o.items = [];
    var old = { kinds: [], counts: [], todos: [], notes: [] };
    var memos = {}, ids = {};
    (Array.isArray(v3.kinds) ? v3.kinds : []).forEach(function (k) {
      if (!isObj(k)) return;
      if (k.type === 'span' || k.type === 'fixed' || k.type == null) {
        o.items.push({ id: k.id, name: k.name, tone: o.items.length % 3, hidden: k.hidden === true });
      } else old.kinds.push(k);
    });
    (Array.isArray(v3.entries) ? v3.entries : []).forEach(function (e) { if (isObj(e)) ids[sid(e.id)] = 1; });
    (Array.isArray(v3.notes) ? v3.notes : []).forEach(function (n) {
      if (!isObj(n)) return;
      var eid = n.entry ? sid(n.entry) : null;
      if (eid && ids[eid]) {
        var t = String(n.text == null ? '' : n.text);
        if (t) memos[eid] = memos[eid] ? memos[eid] + '\n' + t : t;
      } else old.notes.push(n);
    });
    (Array.isArray(v3.entries) ? v3.entries : []).forEach(function (e) {
      if (!isObj(e)) return;
      if (isNum(e.start) && isNum(e.end) && e.end - e.start < MIN) return;   /* 前の版の1分未満の記録は、引き継がない（old にも入れない） */
      var p = parseInt(e.planned, 10), focus = p >= 1 && p <= 240;
      o.logs.push({ id: e.id, item: e.kind, start: e.start, end: e.end == null ? null : e.end, mode: focus ? 'focus' : 'free', plan: focus ? p : null, memo: memos[sid(e.id)] || '' });
    });
    if (Array.isArray(v3.counts)) old.counts = v3.counts;
    if (Array.isArray(v3.todos)) old.todos = v3.todos;
    if (old.kinds.length || old.counts.length || old.todos.length || old.notes.length) o.old = old;
    return sanitize(o, now);
  }

  /* ---------- 保存の口（差し替えられる） ---------- */
  var ls = null;
  try { if (typeof localStorage !== 'undefined' && localStorage) ls = localStorage; } catch (e) { ls = null; }

  function readKey(k) {
    try { if (!Store._ls) return null; var t = Store._ls.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }
  function search() { try { return typeof location !== 'undefined' && location ? String(location.search || '') : ''; } catch (e) { return ''; } }

  var Store = {
    KEY: KEY,
    data: fresh(),
    readonly: false,
    _ls: ls,

    load: function (now) {
      var q = search();
      if (/[?&]demo=1(&|$)/.test(q)) {
        var m = /[?&]now=(\d+)/.exec(q);
        Store.readonly = true;
        var dn = isNum(now) ? now : (m ? Number(m[1]) : Date.now());
        Store.data = sanitize(Store.demo(dn), dn);
        return Store.data;
      }
      Store.readonly = false;
      var v5 = readKey(KEY);
      if (isObj(v5)) { Store.data = sanitize(v5, now); return Store.data; }
      var v3 = readKey(KEY_V3);
      if (validV3(v3)) { Store.data = migrateV3(v3, now); Store.save(); return Store.data; }
      Store.data = fresh();
      return Store.data;
    },

    save: function () {
      if (Store.readonly) return false;
      try { if (!Store._ls) return false; Store._ls.setItem(KEY, JSON.stringify(Store.data)); return true; } catch (e) { return false; }
    },

    sanitize: sanitize,
    migrateV3: migrateV3,
    uid: uid,
    dayStart: dayStart,
    dayKey: dayKey,
    weekStart: weekStart,

    item: function (id) {
      var a = Store.data.items;
      for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
      return { id: id, name: '（消した項目）', tone: 2 };
    },

    running: function () {
      var a = Store.data.logs;
      for (var i = a.length - 1; i >= 0; i--) if (a[i].end === null) return a[i];
      return null;
    },

    start: function (itemId, mode, now) {
      now = nowOr(now);
      if (Store.running()) Store.stop(now);
      var focus = mode === 'focus';
      var log = { id: uid(), item: sid(itemId), start: now, end: null, mode: focus ? 'focus' : 'free', plan: focus ? Store.data.focus.len : null, memo: '' };
      Store.data.logs.push(log);
      Store.data.rest = null;
      Store.save();
      return log;
    },

    stop: function (now) {
      now = nowOr(now);
      var log = Store.running();
      if (!log) return { log: null, short: false, full: false };
      var end = now, full = false;
      if (log.mode === 'focus' && log.plan && now >= log.start + log.plan * MIN) { end = log.start + log.plan * MIN; full = true; }
      if (end - log.start < MIN) {
        Store.data.logs = Store.data.logs.filter(function (l) { return l !== log; });
        Store.save();
        return { log: null, short: true };
      }
      log.end = end;
      Store.save();
      return { log: log, short: false, full: full };
    },

    settle: function (now) {
      now = nowOr(now);
      var log = Store.running();
      if (!log || log.mode !== 'focus' || !log.plan) return null;
      var due = log.start + log.plan * MIN;
      if (now < due) return null;
      log.end = due;
      Store.save();
      return { log: log, full: true };
    },

    addItem: function (name) {
      var n = cleanName(name);
      if (!n) return null;
      var a = Store.data.items;
      for (var i = 0; i < a.length; i++) if (a[i].name === n) {
        if (a[i].hidden) { a[i].hidden = false; Store.save(); }
        return a[i];
      }
      var it = { id: uid(), name: n, tone: a.length % 3, hidden: false };
      a.push(it);
      Store.save();
      return it;
    },

    segmentsOfDay: function (dayMs, now) {
      now = nowOr(now);
      var d0 = dayStart(dayMs), d1 = addDays(d0, 1), out = [];
      Store.data.logs.forEach(function (l) {
        var e = l.end === null ? now : l.end;
        var from = Math.max(l.start, d0), to = Math.min(e, d1);
        if (to > from) out.push({ log: l, from: from, to: to });
      });
      out.sort(function (a, b) { return a.from - b.from; });
      return out;
    },

    minutes: function (from, to) { return Math.max(0, Math.floor((to - from) / MIN)); },

    totalOfDay: function (dayMs, now) {
      return Store.segmentsOfDay(dayMs, now).reduce(function (s, g) { return s + Store.minutes(g.from, g.to); }, 0);
    },

    focusCountOfDay: function (dayMs) {
      var d0 = dayStart(dayMs), d1 = addDays(d0, 1);
      return Store.data.logs.filter(function (l) { return l.mode === 'focus' && l.start >= d0 && l.start < d1; }).length;
    },

    /* 3つ目の now は、未来かどうかを比べる為（無ければ Date.now()） */
    updateLog: function (id, patch, now) {
      now = nowOr(now);
      patch = isObj(patch) ? patch : {};
      var logs = Store.data.logs, log = null, i;
      for (i = 0; i < logs.length; i++) if (logs[i].id === id) log = logs[i];
      if (!log) return { ok: false, error: '記録が見つかりません' };
      var start = patch.start === undefined ? log.start : patch.start;
      var end = patch.end === undefined ? log.end : patch.end;
      if (!isNum(start) || start < 0 || (end !== null && !isNum(end))) return { ok: false, error: '時刻が読めません' };
      if (end === null && log.end !== null) return { ok: false, error: '時刻が読めません' };
      var e2 = end === null ? now : end;
      if (end !== null && end <= start) return { ok: false, error: '終わりは、始まりより後にしてください' };
      if (start > now || (end !== null && end > now)) return { ok: false, error: '未来の時刻にはできません' };
      for (i = 0; i < logs.length; i++) {
        var o = logs[i];
        if (o === log) continue;
        var oe = o.end === null ? now : o.end;
        if (start < oe && e2 > o.start) return { ok: false, error: 'ほかの記録と重なっています' };
      }
      log.start = start; log.end = end;
      if (patch.memo !== undefined) log.memo = cleanText(patch.memo);
      if (patch.item !== undefined) log.item = sid(patch.item);
      logs.sort(function (a, b) { return a.start - b.start; });
      Store.save();
      return { ok: true, log: log };
    },

    /* 始めるのを忘れた記録を、後から手で足す（閉じた log・mode 'free'） */
    addLog: function (itemId, start, end, memo, now) {
      now = nowOr(now);
      var items = Store.data.items, logs = Store.data.logs, found = false, i;
      for (i = 0; i < items.length; i++) if (items[i].id === itemId) found = true;
      if (!found) return { ok: false, error: '項目が在りません' };
      if (!isNum(start) || start < 0 || !isNum(end)) return { ok: false, error: '時刻が読めません' };
      if (end <= start) return { ok: false, error: '終わりは、始まりより後にしてください' };
      if (start > now || end > now) return { ok: false, error: '未来の時刻にはできません' };
      if (end - start < MIN) return { ok: false, error: '1分より短い記録は、足せません' };
      for (i = 0; i < logs.length; i++) {
        var oe = logs[i].end === null ? now : logs[i].end;
        if (start < oe && end > logs[i].start) return { ok: false, error: 'ほかの記録と重なっています' };
      }
      var log = { id: uid(), item: itemId, start: start, end: end, mode: 'free', plan: null, memo: cleanText(memo) };
      logs.push(log);
      logs.sort(function (a, b) { return a.start - b.start; });
      Store.save();
      return { ok: true, log: log };
    },

    deleteLog: function (id) {
      var n = Store.data.logs.length;
      Store.data.logs = Store.data.logs.filter(function (l) { return l.id !== id; });
      Store.save();
      return Store.data.logs.length < n;
    },

    habit: function (id) {
      var a = Store.data.habits;
      for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
      return null;
    },

    /* 表に無い足し：習慣を足す・消す（形をそろえてから入れる） */
    addHabit: function (h, now) {
      var src = isObj(h) ? clone(h) : {};
      src.id = uid();
      if (src.kind === 'quit' && !isNum(src.since)) src.since = nowOr(now);
      var n = sanitizeHabit(src);
      if (!n) return null;
      Store.data.habits.push(n);
      Store.save();
      return n;
    },
    deleteHabit: function (id) {
      var n = Store.data.habits.length;
      Store.data.habits = Store.data.habits.filter(function (h) { return h.id !== id; });
      Store.save();
      return Store.data.habits.length < n;
    },

    habitWeek: function (h, now) {
      now = nowOr(now);
      var ws = weekStart(now), today = dayKey(now), marks = (h && h.marks) || {}, days = [], done = 0;
      for (var i = 0; i < 7; i++) {
        var t = addDays(ws, i), key = dayKey(t), mark = marks[key] === 'done' || marks[key] === 'skip' ? marks[key] : null;
        if (mark === 'done') done++;
        days.push({ key: key, mark: mark, isToday: key === today, future: t > now });
      }
      return { done: done, days: days };
    },

    markHabit: function (id, key, mark) {
      var h = Store.habit(id);
      if (!h || h.kind !== 'do' || !/^\d{4}-\d{2}-\d{2}$/.test(String(key))) return false;
      if (mark === 'done' || mark === 'skip') h.marks[key] = mark; else delete h.marks[key];
      Store.save();
      return true;
    },

    quitDays: function (h, now) {
      now = nowOr(now);
      var ms = Math.max(0, now - ((h && h.since) || 0));
      return { ms: ms, days: Math.floor(ms / DAY), hours: Math.floor(ms / 3600000) % 24 };
    },

    resetQuit: function (id, now) {
      now = nowOr(now);
      var h = Store.habit(id);
      if (!h || h.kind !== 'quit') return false;
      h.resets.push({ at: now, since: h.since });
      h.since = now;
      Store.save();
      return true;
    },

    exportJSON: function (now) {
      return JSON.stringify({ app: 'jikan_v5', saved: nowOr(now), data: Store.data });
    },

    importJSON: function (text, now) {
      var bad = { ok: false, error: 'この控えの形ではありません' }, j;
      try { j = JSON.parse(text); } catch (e) { return bad; }
      if (!isObj(j)) return bad;
      var next;
      if (j.app === 'jikan_v5' && isObj(j.data) && Array.isArray(j.data.items) && Array.isArray(j.data.logs)) next = sanitize(j.data, now);
      else if (j.app === 'jikan_v3' && validV3(j.data)) next = migrateV3(j.data, now);
      else return bad;
      Store.data = next;
      Store.save();
      return { ok: true };
    },

    demo: function (now) {
      now = nowOr(now);
      var d0 = dayStart(now), o = fresh(), n = 0;
      function at(day, h, m) { var d = new Date(day); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime(); }
      function add(day, h, m, item, min, focus) {
        var s = at(day, h, m);
        o.logs.push({ id: 'd' + (++n), item: item, start: s, end: s + min * MIN, mode: focus ? 'focus' : 'free', plan: focus ? min : null, memo: '' });
      }
      var ws = weekStart(now);
      for (var i = 0; i < 3; i++) {
        var day = addDays(ws, i);
        if (day >= d0) break;
        add(day, 9, 0, 'i1', [75, 80, 52][i], false);   // 月・火は75分以上＝週の表の帯に名前が入る（絵 C1）
        if (i === 1) add(day, 18, 45, 'i3', 30, false);
        if (i === 2) add(day, 19, 0, 'i3', 30, false);
        add(day, 20, 0, 'i2', 40, true);
      }
      add(d0, 9, 10, 'i1', 43, false);
      add(d0, 12, 30, 'i2', 25, true);
      add(d0, 18, 40, 'i3', 20, false);
      add(d0, 20, 5, 'i2', 25, true);
      var m1 = {}, m2 = {};
      for (var k = 0; k < 7; k++) {
        var t = addDays(ws, k);
        if (t > d0) break;
        if (k % 2 === 0) m1[dayKey(t)] = 'done';
        if (k === 1 || k === 3) m2[dayKey(t)] = 'done';   // 運動：木曜に開くと 今週 2 / 3・きょう済み（絵 B1）
        if (k === 2) m2[dayKey(t)] = 'skip';
      }
      o.habits = [
        { id: 'h1', kind: 'do', name: '読書', perWeek: 4, marks: m1 },
        { id: 'h2', kind: 'do', name: '運動', perWeek: 3, marks: m2 },
        { id: 'h3', kind: 'quit', name: 'たばこ', since: now - 10 * DAY - 5 * 3600000, unit: '本', perDay: 20, price: 25, resets: [], why: '' }
      ];
      return o;
    }
  };

  if (typeof window !== 'undefined') window.Store = Store;
  if (typeof module !== 'undefined') module.exports = Store;
})();
