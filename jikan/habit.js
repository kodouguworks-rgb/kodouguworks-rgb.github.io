/* 習慣のタブ（画面D・絵 B1〜B3）。一覧／続けたい事の1つ／やめたい事の1つ／足す・直す・消すの紙 */
(function(){ 'use strict';
  var DAY = 86400000, HOUR = 3600000, MINUTE = 60000;
  var WDAY = ['月','火','水','木','金','土','日'];
  var STEPS = [1, 3, 7, 14, 30, 60, 90, 180, 365];
  var rootEl = null;
  var curId = null;       // いま出している1つ（一覧の時は null）
  var urgeStart = null;   // 「今、したくなった」の紙を開いた時刻
  var form = null;        // 足す・直すの紙の、入れかけの中身

  function esc(s){ return UI.esc(s); }
  function now(){ return App.now(); }
  function chars(s, n){ return Array.from(String(s == null ? '' : s)).slice(0, n).join(''); }
  function intIn(x, lo, hi, def){
    var n = Math.floor(Number(x));
    if (x === '' || x === null || x === undefined || !isFinite(n)) return def;
    return Math.min(hi, Math.max(lo, n));
  }
  function comma(n){ return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function md(ms){ var d = new Date(ms); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function setText(id, text){
    var el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  /* ---------- やめたい事の数え方 ---------- */
  function elapsed(h, t){ return Store.quitDays(h, t); }
  function bigText(h, t){
    var q = elapsed(h, t);
    if (q.days >= 1) return q.days + '日 ' + q.hours + '時間';
    return q.hours + '時間 ' + (Math.floor(q.ms / MINUTE) % 60) + '分';
  }
  function shortText(h, t){
    var q = elapsed(h, t);
    if (q.days >= 1) return q.days + '日';
    if (q.hours >= 1) return q.hours + '時間';
    return (Math.floor(q.ms / MINUTE) % 60) + '分';
  }
  function spanText(ms){
    ms = Math.max(0, ms);
    var d = Math.floor(ms / DAY), hr = Math.floor(ms / HOUR) % 24, mi = Math.floor(ms / MINUTE) % 60;
    if (d >= 1) return d + '日' + hr + '時間';
    if (hr >= 1) return hr + '時間' + mi + '分';
    return mi + '分';
  }
  function spanShort(ms){
    ms = Math.max(0, ms);
    var d = Math.floor(ms / DAY), hr = Math.floor(ms / HOUR), mi = Math.floor(ms / MINUTE);
    if (d >= 1) return d + '日';
    if (hr >= 1) return hr + '時間';
    return mi + '分';
  }
  function nextStep(ms){
    var i, days;
    for (i = 0; i < STEPS.length; i++) if (ms < STEPS[i] * DAY) return { days: STEPS[i], label: STEPS[i] + '日' };
    var y = Math.floor(ms / (365 * DAY)) + 1;
    days = y * 365;
    return { days: days, label: y + '年' };
  }
  function nextLabel(h, t){ return '次の節目 ' + nextStep(elapsed(h, t).ms).label + 'まで'; }
  function nextValue(h, t){
    var ms = elapsed(h, t).ms;
    return spanText(nextStep(ms).days * DAY - ms);
  }
  function saved(h, t){ return Math.floor(elapsed(h, t).ms / DAY * h.perDay); }

  /* ---------- 一覧（B1） ---------- */
  function todayMark(h, t){ return (h.marks || {})[Store.dayKey(t)] || null; }

  function listHtml(t){
    var hs = Store.data.habits || [];
    var dos = hs.filter(function(h){ return h.kind === 'do'; });
    var quits = hs.filter(function(h){ return h.kind === 'quit'; });
    var s = '<div class="hd"><h1 class="t24">習慣</h1>' +
      (hs.length ? '<button type="button" class="link" data-act="h-add">＋ 足す</button>' : '') + '</div>';
    if (!hs.length) {
      return s + '<div class="sub g16">続けたい事・やめたい事を足すと、ここに出ます</div>' +
        '<button type="button" class="weak g16 hb-w" data-act="h-add">＋ 足す</button>';
    }
    if (dos.length) {
      s += '<div class="sub g16">続けたい事</div>';
      dos.forEach(function(h){
        var w = Store.habitWeek(h, t), m = todayMark(h, t), b;
        if (m === 'done') b = '<button type="button" class="hb-st hb-did" data-act="h-undo" data-id="' + esc(h.id) + '" aria-label="' + esc(h.name) + ' できた。押すと取り消す">✓ できた</button>';
        else if (m === 'skip') b = '<button type="button" class="hb-st hb-skip" data-act="h-undo" data-id="' + esc(h.id) + '" aria-label="' + esc(h.name) + ' 休み。押すと取り消す">休み</button>';
        else b = '<button type="button" class="hb-st hb-do" data-act="h-done" data-id="' + esc(h.id) + '" aria-label="' + esc(h.name) + ' できた">できた</button>';
        s += '<div class="hrow"><button type="button" class="hb-nm" data-act="h-open" data-id="' + esc(h.id) + '">' + esc(h.name) + '</button>' +
          '<span class="sub hb-wk1">今週 ' + w.done + ' / ' + h.perWeek + '日</span>' + b + '</div>';
      });
    }
    if (quits.length) {
      s += '<div class="sub ' + (dos.length ? 'g24' : 'g16') + '">やめたい事</div>';
      quits.forEach(function(h){
        s += '<button type="button" class="hrow hb-row" data-act="h-open" data-id="' + esc(h.id) + '"><span class="hb-nm2">' + esc(h.name) + '</span>' +
          '<span class="sub"><span data-hq="' + esc(h.id) + '">' + shortText(h, t) + '</span>　›</span></button>';
      });
    }
    return s;
  }

  /* ---------- 続けたい事の1つ（B2） ---------- */
  function markChar(d){ return d.mark === 'done' ? '✓' : (d.mark === 'skip' ? '—' : (d.future ? '・' : '')); }
  function markWord(d){ return d.mark === 'done' ? 'できた' : (d.mark === 'skip' ? '休み' : '未記録'); }

  function doHtml(h, t){
    var w = Store.habitWeek(h, t), m = todayMark(h, t), id = esc(h.id);
    var s = '<div class="hd"><button type="button" class="link" data-act="h-back">‹ 習慣</button></div>' +
      '<h1 class="t24 hb-brk">' + esc(h.name) + '</h1>' +
      '<div class="c g16"><div class="m18">' + (m === 'done' ? 'きょうは できた' : (m === 'skip' ? 'きょうは 休み' : 'きょうは未記録')) + '</div></div>';
    if (m === 'done') s += '<button type="button" class="weak g12 hb-w" data-act="h-undo" data-id="' + id + '">取り消す</button>';
    else s += '<button type="button" class="btn main g12" data-act="h-done" data-id="' + id + '">今日できた</button>';
    s += '<div class="wk hb-wk g12">';
    w.days.forEach(function(d, i){
      var c = markChar(d);
      if (d.future) s += '<div>' + WDAY[i] + '<span>' + c + '</span></div>';
      else s += '<div>' + WDAY[i] + '<button type="button" class="hb-day' + (d.isToday ? ' td' : '') + '" data-act="h-cycle" data-id="' + id + '" data-key="' + d.key + '" aria-label="' + WDAY[i] + '曜 ' + markWord(d) + '">' + c + '</button></div>';
    });
    s += '</div><div class="m18 g12">今週 ' + w.done + ' / ' + h.perWeek + '日</div>';

    var d0 = new Date(t), y = d0.getFullYear(), mo = d0.getMonth();
    var last = new Date(y, mo + 1, 0).getDate(), lead = (new Date(y, mo, 1).getDay() + 6) % 7;
    var today = Store.dayKey(t), cnt = 0, i, key, g = '';
    for (i = 0; i < lead; i++) g += '<i class="e"></i>';
    for (i = 1; i <= last; i++) {
      key = Store.dayKey(new Date(y, mo, i).getTime());
      if (h.marks[key] === 'done') { cnt++; g += '<i class="d"></i>'; }
      else g += '<i class="' + (key === today ? 't' : '') + '"></i>';
    }
    s += '<div class="mg g12" aria-hidden="true">' + g + '</div><div class="sub g8">今月 ' + cnt + '日</div>' +
      '<div class="grow"></div><div class="hb-links g16">' +
      '<button type="button" class="link" data-act="h-edit" data-id="' + id + '">直す</button>' +
      '<button type="button" class="link" data-act="h-del" data-id="' + id + '">消す</button></div>';
    return s;
  }

  /* ---------- やめたい事の1つ（B3） ---------- */
  function quitHtml(h, t){
    var id = esc(h.id), n = saved(h, t);
    var s = '<div class="hd"><button type="button" class="link" data-act="h-back">‹ 習慣</button></div>' +
      '<h1 class="t24 hb-brk">' + esc(h.name) + '</h1>' +
      '<div class="c g24"><div class="big" id="hq-big">' + bigText(h, t) + '</div><div class="sub g8">やめてから</div></div>' +
      '<button type="button" class="weak g24 hb-w" data-act="h-urge" data-id="' + id + '">今、したくなった</button><div class="g16">';
    if (h.perDay > 0) {
      s += '<div class="dk"><span class="hb-k">やめた分（目安）</span><span><span id="hq-cnt">' + comma(n) + '</span>' + esc(h.unit) + '</span></div>';
      if (h.price > 0) s += '<div class="dk"><span class="hb-k">浮いたお金（目安）</span><span><span id="hq-money">' + comma(n * h.price) + '</span>円</span></div>';
    }
    s += '<div class="dk"><span class="hb-k" id="hq-nl">' + nextLabel(h, t) + '</span><span id="hq-nv">' + nextValue(h, t) + '</span></div></div>' +
      '<div class="grow"></div>' +
      '<div class="dk g16"><button type="button" class="link" data-act="h-hist" data-id="' + id + '">これまでの記録 ›</button>' +
      '<button type="button" class="link" data-act="h-reset" data-id="' + id + '">数え直す ›</button></div>' +
      '<div class="hb-links"><button type="button" class="link" data-act="h-edit" data-id="' + id + '">直す</button>' +
      '<button type="button" class="link" data-act="h-del" data-id="' + id + '">消す</button></div>';
    return s;
  }

  /* ---------- 紙：足す・直す ---------- */
  function freshForm(t){
    return { id: null, kind: 'do', name: '', perWeek: 3, date: Store.dayKey(t), date0: null, perDay: '', unit: '', price: '', why: '' };
  }
  function formHtml(){
    var f = form, i, s = '<div class="h18">' + (f.id ? '直す' : '足す') + '</div>';
    if (!f.id) {
      s += '<div class="seg g16">' +
        '<button type="button" data-fa="kind" data-v="do" class="' + (f.kind === 'do' ? 'on' : '') + '" aria-pressed="' + (f.kind === 'do') + '">続けたい事</button>' +
        '<button type="button" data-fa="kind" data-v="quit" class="' + (f.kind === 'quit' ? 'on' : '') + '" aria-pressed="' + (f.kind === 'quit') + '">やめたい事</button></div>';
    }
    s += '<label class="hb-l" for="hf-name">名前（12字まで）</label><input type="text" id="hf-name" maxlength="12" autocomplete="off" value="' + esc(f.name) + '">';
    if (f.kind === 'do') {
      s += '<div class="hb-l" id="hf-pw-l">週に何日</div><div class="seg" role="group" aria-labelledby="hf-pw-l">';
      for (i = 1; i <= 7; i++) s += '<button type="button" data-fa="pw" data-v="' + i + '" class="' + (f.perWeek === i ? 'on' : '') + '" aria-pressed="' + (f.perWeek === i) + '">' + i + '</button>';
      s += '</div>';
    } else {
      s += '<label class="hb-l" for="hf-date">やめた日</label><input type="date" id="hf-date" max="' + Store.dayKey(now()) + '" value="' + esc(f.date) + '">' +
        '<div class="grid2"><div><label class="hb-l" for="hf-pd">1日の数（分かれば）</label><input type="number" id="hf-pd" inputmode="numeric" min="0" max="999" value="' + esc(f.perDay) + '"></div>' +
        '<div><label class="hb-l" for="hf-unit">数え方（本・杯・回 など）</label><input type="text" id="hf-unit" maxlength="4" autocomplete="off" value="' + esc(f.unit) + '"></div></div>' +
        '<label class="hb-l" for="hf-price">1つの値段（円・分かれば）</label><input type="number" id="hf-price" inputmode="numeric" min="0" max="99999" value="' + esc(f.price) + '">' +
        '<label class="hb-l" for="hf-why">やめた理由（自分に見せる1行）</label><input type="text" id="hf-why" maxlength="200" autocomplete="off" value="' + esc(f.why) + '">';
    }
    s += '<button type="button" class="btn main g24" data-fa="save">' + (f.id ? '直す' : '足す') + '</button>' +
      '<button type="button" class="link hb-mid" data-fa="close">閉じる</button>';
    return s;
  }
  function readForm(box){
    function v(id){ var el = box.querySelector('#' + id); return el ? el.value : null; }
    var x;
    if ((x = v('hf-name')) !== null) form.name = x;
    if ((x = v('hf-date')) !== null) form.date = x;
    if ((x = v('hf-pd')) !== null) form.perDay = x;
    if ((x = v('hf-unit')) !== null) form.unit = x;
    if ((x = v('hf-price')) !== null) form.price = x;
    if ((x = v('hf-why')) !== null) form.why = x;
  }
  function sinceFrom(dateStr, t){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
    if (!m) return null;
    if (dateStr === Store.dayKey(t)) return t;
    var ms = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    if (!isFinite(ms) || ms > t) return null;
    return ms;
  }
  function saveForm(){
    var f = form, t = now();
    var name = chars(String(f.name).replace(/[\r\n\t]+/g, ' ').trim(), 12);
    if (!name) { UI.toast('名前を入れてください'); return; }
    var since = null;
    if (f.kind === 'quit' && !(f.id && f.date === f.date0)) {
      since = sinceFrom(f.date, t);
      if (since === null) { UI.toast('やめた日は、きょうまでの日にしてください'); return; }
    }
    var unit = chars(String(f.unit).trim(), 4) || '回';
    var perDay = intIn(f.perDay, 0, 999, 0), price = intIn(f.price, 0, 99999, 0), why = chars(f.why, 200);
    if (f.id) {
      var h = Store.habit(f.id);
      if (h) {
        h.name = name;
        if (h.kind === 'do') h.perWeek = intIn(f.perWeek, 1, 7, 3);
        else {
          if (since !== null) h.since = since;
          h.unit = unit; h.perDay = perDay; h.price = price; h.why = why;
        }
        Store.save();
      }
    } else if (f.kind === 'do') {
      Store.addHabit({ kind: 'do', name: name, perWeek: intIn(f.perWeek, 1, 7, 3), marks: {} }, t);
    } else {
      Store.addHabit({ kind: 'quit', name: name, since: since, unit: unit, perDay: perDay, price: price, resets: [], why: why }, t);
    }
    form = null;
    UI.closeSheet();
    App.refresh();
  }
  function openForm(){
    UI.sheet(formHtml(), function(box){
      box.onclick = function(e){
        var b = e.target && e.target.closest ? e.target.closest('[data-fa]') : null;
        if (!b || !form) return;
        var a = b.getAttribute('data-fa'), v = b.getAttribute('data-v');
        if (a === 'close') { form = null; UI.closeSheet(); return; }
        readForm(box);
        if (a === 'save') { saveForm(); return; }
        if (a === 'kind') form.kind = (v === 'quit' ? 'quit' : 'do');
        if (a === 'pw') form.perWeek = intIn(v, 1, 7, 3);
        openForm();
        var again = document.querySelector('#sheet [data-fa="' + a + '"][data-v="' + v + '"]');
        if (again) { try { again.focus(); } catch (err) {} }
      };
    });
  }
  function openAdd(){ form = freshForm(now()); openForm(); }
  function openEdit(h){
    form = freshForm(now());
    form.id = h.id; form.kind = h.kind; form.name = h.name;
    if (h.kind === 'do') form.perWeek = h.perWeek;
    else {
      form.date = form.date0 = Store.dayKey(h.since);
      form.perDay = h.perDay > 0 ? String(h.perDay) : '';
      form.unit = h.unit; form.price = h.price > 0 ? String(h.price) : ''; form.why = h.why || '';
    }
    openForm();
  }

  /* ---------- 紙：確かめ・記録・待つ ---------- */
  function simpleSheet(html, onYes){
    UI.sheet(html, function(box){
      box.onclick = function(e){
        var b = e.target && e.target.closest ? e.target.closest('[data-sa]') : null;
        if (!b) return;
        if (b.getAttribute('data-sa') === 'yes' && onYes) onYes();
        else { urgeStart = null; UI.closeSheet(); }
      };
    });
  }
  function openDelete(h){
    var text = h.kind === 'do' ? '『' + esc(h.name) + '』と、その印を消します' : '『' + esc(h.name) + '』と、その記録を消します';
    simpleSheet('<div class="m18 hb-brk">' + text + '</div>' +
      '<button type="button" class="weak g24 hb-w" data-sa="yes">消す</button>' +
      '<button type="button" class="link hb-mid" data-sa="no">閉じる</button>', function(){
      Store.deleteHabit(h.id);
      UI.closeSheet();
      App.go('habit');
    });
  }
  function openReset(h){
    var t = now();
    simpleSheet('<div class="m18">いまから数え直します。これまでの ' + shortText(h, t) + ' は、記録に残ります。</div>' +
      '<button type="button" class="btn main g24" data-sa="yes">数え直す</button>' +
      '<button type="button" class="link hb-mid" data-sa="no">閉じる</button>', function(){
      Store.resetQuit(h.id, now());
      UI.closeSheet();
      App.refresh();
    });
  }
  function openHistory(h){
    var s = '<div class="h18">これまでの記録</div>', rs = (h.resets || []).slice().sort(function(a, b){ return b.at - a.at; });
    if (!rs.length) s += '<div class="sub g16">数え直した記録は、在りません</div>';
    else {
      s += '<div class="g8">';
      rs.forEach(function(r){
        s += '<div class="dk"><span>' + md(r.since) + '〜' + md(r.at) + '</span><span>' + spanShort(r.at - r.since) + '</span></div>';
      });
      s += '</div>';
    }
    simpleSheet(s + '<button type="button" class="weak g24 hb-w" data-sa="no">閉じる</button>');
  }
  function urgeLeft(t){ return Math.max(0, 60 - Math.floor((t - urgeStart) / 1000)); }
  function openUrge(h){
    urgeStart = now();
    var s = '';
    if (h.why) s += '<div class="m18 hb-brk">' + esc(h.why) + '</div>';
    s += '<div class="c ' + (h.why ? 'g24' : '') + '"><div id="hq-msg">1分だけ、待ってみる</div>' +
      '<div class="big g8" id="hq-sec" aria-hidden="true">60秒</div></div>' +
      '<button type="button" class="weak g24 hb-w" data-sa="no">閉じる</button>';
    simpleSheet(s);
  }

  /* ---------- 押した時 ---------- */
  function onClick(e){
    if (!window.App || App.current() !== 'habit') return;
    var b = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b || !rootEl || !rootEl.contains(b)) return;
    var a = b.getAttribute('data-act'), id = b.getAttribute('data-id'), key = b.getAttribute('data-key');
    if (a.indexOf('h-') !== 0) return;
    var h = id ? Store.habit(id) : null, t = now(), refocus = null;
    if (a === 'h-add') { openAdd(); return; }
    if (a === 'h-back') { App.go('habit'); return; }
    if (!h) return;
    if (a === 'h-open') { App.go('habit', { id: h.id }); return; }
    if (a === 'h-edit') { openEdit(h); return; }
    if (a === 'h-del') { openDelete(h); return; }
    if (a === 'h-urge') { openUrge(h); return; }
    if (a === 'h-hist') { openHistory(h); return; }
    if (a === 'h-reset') { openReset(h); return; }
    if (a === 'h-done') { Store.markHabit(h.id, Store.dayKey(t), 'done'); refocus = '[data-act="h-undo"][data-id="' + h.id + '"]'; }
    else if (a === 'h-undo') { Store.markHabit(h.id, Store.dayKey(t), null); refocus = '[data-act="h-done"][data-id="' + h.id + '"]'; }
    else if (a === 'h-cycle') {
      if (!key || key > Store.dayKey(t)) return;
      var m = (h.marks || {})[key] || null;
      Store.markHabit(h.id, key, m === 'done' ? 'skip' : (m === 'skip' ? null : 'done'));
      refocus = '[data-act="h-cycle"][data-key="' + key + '"]';
    } else return;
    App.refresh();
    var el = refocus && rootEl ? rootEl.querySelector(refocus) : null;
    if (el) { try { el.focus(); } catch (err) {} }
  }

  /* ---------- 外に出す物 ---------- */
  window.Views = window.Views || {};
  window.Views.habit = {
    render: function(root, param){
      var t = now(), h = (param && param.id) ? Store.habit(String(param.id)) : null;
      rootEl = root;
      curId = h ? h.id : null;
      root.onclick = onClick;
      root.innerHTML = !h ? listHtml(t) : (h.kind === 'quit' ? quitHtml(h, t) : doHtml(h, t));
    },
    tick: function(t){
      if (!rootEl) return;
      if (urgeStart !== null) {
        var sec = document.getElementById('hq-sec');
        if (!sec) urgeStart = null;
        else {
          var left = urgeLeft(t);
          if (left > 0) setText('hq-sec', left + '秒');
          else { setText('hq-msg', '1分、過ぎました'); if (!sec.hidden) sec.hidden = true; }
        }
      }
      if (curId) {
        var h = Store.habit(curId);
        if (!h || h.kind !== 'quit') return;
        var n = saved(h, t);
        setText('hq-big', bigText(h, t));
        setText('hq-cnt', comma(n));
        setText('hq-money', comma(n * h.price));
        setText('hq-nl', nextLabel(h, t));
        setText('hq-nv', nextValue(h, t));
        return;
      }
      var els = rootEl.querySelectorAll('[data-hq]'), i, q, txt;
      for (i = 0; i < els.length; i++) {
        q = Store.habit(els[i].getAttribute('data-hq'));
        if (!q || q.kind !== 'quit') continue;
        txt = shortText(q, t);
        if (els[i].textContent !== txt) els[i].textContent = txt;
      }
    }
  };
})();
