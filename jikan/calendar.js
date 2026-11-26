/* calendar.js — カレンダーのタブ（画面E。絵 C1 週・C2 その日・C3 書き出す）
   param：{week: ms}｜{day: ms}｜{out:'day'|'week', at: ms}。無ければ今週。 */
(function(){ 'use strict';
  window.Views = window.Views || {};

  var HOUR = 3600000, MIN = 60000;
  var PX = 16;                 // 1時間の高さ（絵と同じ＝18時間で288px）
  var HEAD = 44;               // 列の頭（曜日・日）の高さ
  var WD = ['月','火','水','木','金','土','日'];
  var lastMinute = -1;
  var lastParam = {};

  function esc(s){ return UI.esc(s); }
  function addDays(ms, n){ var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); }
  function num(x){ return typeof x === 'number' && isFinite(x); }
  function md(ms){ var d = new Date(ms); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function weekLabel(ws){
    var a = new Date(ws), b = new Date(addDays(ws, 6));
    return md(ws) + '〜' + (a.getMonth() === b.getMonth() ? b.getDate() + '日' : md(b.getTime()));
  }
  function go(param){ App.go('calendar', param); }

  /* ---------- 1. 週 ---------- */
  function renderWeek(root, at, now){
    var ws = Store.weekStart(at), thisWeek = Store.weekStart(now), today = Store.dayStart(now);
    if (ws > thisWeek) ws = thisWeek;
    var days = [], early = false, total = 0, sums = {}, i;
    for (i = 0; i < 7; i++) {
      var day = addDays(ws, i);
      var segs = Store.segmentsOfDay(day, now) || [];
      segs.forEach(function(s){
        if (s.from < day + 6 * HOUR) early = true;
        var m = Store.minutes(s.from, s.to);
        total += m;
        sums[s.log.item] = (sums[s.log.item] || 0) + m;
      });
      days.push({day: day, segs: segs});
    }
    var h0 = early ? 0 : 6, H = (24 - h0) * PX;

    var html = '<div class="hd"><h1 class="t24">カレンダー</h1>' +
      '<button type="button" class="add" data-cal="out-week" data-at="' + ws + '">書き出す</button></div>' +
      '<div class="dk"><button type="button" class="cal-nav" data-cal="week" data-at="' + addDays(ws, -7) + '" aria-label="前の週へ">‹</button>' +
      '<span>' + weekLabel(ws) + '</span>' +
      '<button type="button" class="cal-nav r" data-cal="week" data-at="' + addDays(ws, 7) + '" aria-label="次の週へ"' + (ws >= thisWeek ? ' disabled' : '') + '>›</button></div>';

    html += '<div class="cal-grid">';
    for (var h = h0; h < 24; h += 3) {
      html += '<span class="cal-ax" aria-hidden="true" style="top:' + (HEAD + (h - h0) * PX - 10) + 'px">' + h + '</span>';
    }
    days.forEach(function(d, idx){
      var dt = new Date(d.day);
      html += '<button type="button" class="cal-col" data-cal="day" data-at="' + d.day + '" aria-label="' + esc(UI.dateLabel(d.day)) + 'の記録を見る">' +
        '<span class="cal-hd' + (d.day === today ? ' td' : '') + '">' + WD[idx] + '<br>' + dt.getDate() + '</span>' +
        '<span class="cal-tr" style="height:' + H + 'px">';
      d.segs.forEach(function(s){
        var base = d.day + h0 * HOUR;
        var top = Math.max(0, (s.from - base) / HOUR * PX);
        var hgt = Math.max(4, (s.to - Math.max(s.from, base)) / HOUR * PX);
        if (top + hgt > H) top = Math.max(0, H - hgt);
        top = Math.round(top); hgt = Math.round(hgt);
        var it = Store.item(s.log.item);
        var label = hgt >= 20 ? esc(Array.from(String(it.name || '')).slice(0, 2).join('')) : '';
        html += '<span class="cal-blk ' + UI.toneClass(it.tone) + '" style="top:' + top + 'px;height:' + hgt + 'px;line-height:' + hgt + 'px">' + label + '</span>';
      });
      html += '</span></button>';
    });
    html += '</div>';

    if (total === 0) {
      html += '<div class="sub g16">この週の記録は、まだ在りません</div>';
    } else {
      html += '<div class="h18 g16">この週 ' + UI.hm(total) + '</div><div class="g8">';
      Object.keys(sums).sort(function(a, b){ return sums[b] - sums[a]; }).forEach(function(id){
        var it = Store.item(id);
        html += '<div class="brow cal-sum"><span class="bar ' + UI.toneClass(it.tone) + '"></span>' +
          '<span class="nm">' + esc(it.name) + '</span><span class="mn">' + UI.hm(sums[id]) + '</span></div>';
      });
      html += '</div>';
    }
    root.innerHTML = html;
  }

  /* ---------- 2. その日 ---------- */
  function renderDay(root, at, now){
    var day = Store.dayStart(at);
    var segs = Store.segmentsOfDay(day, now) || [];
    var canEdit = !!(window.Views.today && typeof window.Views.today.editLog === 'function');
    var canAdd = typeof Store.addLog === 'function';
    var total = 0;
    segs.forEach(function(s){ total += Store.minutes(s.from, s.to); });

    var html = '<div class="hd"><button type="button" class="link" data-cal="week" data-at="' + day + '">‹ カレンダー</button></div>' +
      '<h1 class="t24">' + esc(UI.dateLabel(day)) + '</h1>';
    if (segs.length === 0) {
      html += '<div class="sub g8">この日の記録は、在りません</div>';
    } else {
      html += '<div class="m18 g8">記録した時間 ' + UI.hm(total) + '</div><div class="g16">';
      segs.forEach(function(s){
        var it = Store.item(s.log.item);
        var inner = '<span class="tm">' + UI.clock(s.from) + '</span><span class="bar ' + UI.toneClass(it.tone) + '"></span>' +
          '<span class="nm">' + esc(it.name) + '</span><span class="mn">' + UI.hm(Store.minutes(s.from, s.to)) + '</span>';
        if (s.log.end !== null && canEdit) {
          html += '<button type="button" class="brow cal-row" data-cal="edit" data-id="' + esc(s.log.id) + '">' + inner + '</button>';
        } else {
          html += '<div class="brow">' + inner + '</div>';
        }
        if (s.log.memo) html += '<div class="memo">' + esc(s.log.memo) + '</div>';
      });
      html += '</div>';
    }
    html += '<div class="grow"></div>';
    if (canAdd) html += '<button type="button" class="link" data-cal="add" data-at="' + day + '">＋ この日に記録を足す</button>';
    html += '<button type="button" class="weak cal-out" data-cal="out-day" data-at="' + day + '">この日をカレンダーに書き出す</button>';
    root.innerHTML = html;
  }

  function p2(n){ return (n < 10 ? '0' : '') + n; }
  function timeToMs(day, v){
    var m = /^(\d{1,2}):(\d{2})/.exec(String(v || ''));
    if (!m) return NaN;
    var d = new Date(day);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(m[1]), Number(m[2])).getTime();
  }

  function openAdd(day){
    var items = (Store.data.items || []).filter(function(it){ return !it.hidden; });
    if (items.length === 0) return;
    var now = App.now(), isToday = Store.dayStart(now) === day;
    var endH = isToday ? new Date(now).getHours() : 10;
    var endM = isToday ? new Date(now).getMinutes() : 0;
    var stH = Math.max(0, endH - 1);
    var html = '<div class="h18">この日に記録を足す</div><div class="sub g8">' + esc(UI.dateLabel(day)) + '</div>' +
      '<label class="sub g16 cal-lb" for="cal-add-item">項目</label><select id="cal-add-item">';
    items.forEach(function(it){ html += '<option value="' + esc(it.id) + '">' + esc(it.name) + '</option>'; });
    html += '</select><div class="grid2 g12">' +
      '<div><label class="sub cal-lb" for="cal-add-s">始まり</label><input type="time" id="cal-add-s" value="' + p2(stH) + ':' + p2(stH === endH ? 0 : endM) + '"></div>' +
      '<div><label class="sub cal-lb" for="cal-add-e">終わり</label><input type="time" id="cal-add-e" value="' + p2(endH) + ':' + p2(endM) + '"></div></div>' +
      '<div class="sub g12" id="cal-add-err" role="alert"></div>' +
      '<button type="button" class="btn main g12" id="cal-add-ok">足す</button>' +
      '<button type="button" class="link cal-cancel" id="cal-add-no">やめる</button>';
    UI.sheet(html, function(box){
      box.querySelector('#cal-add-no').addEventListener('click', function(){ UI.closeSheet(); });
      box.querySelector('#cal-add-ok').addEventListener('click', function(){
        var err = box.querySelector('#cal-add-err');
        var s = timeToMs(day, box.querySelector('#cal-add-s').value);
        var e = timeToMs(day, box.querySelector('#cal-add-e').value);
        if (!num(s) || !num(e)) { err.textContent = '時刻を入れてください'; return; }
        var r = Store.addLog(box.querySelector('#cal-add-item').value, s, e, '', App.now());
        if (r && r.ok === false) { err.textContent = String(r.error || '足せませんでした'); return; }
        UI.closeSheet();
        App.refresh();
      });
    });
  }

  /* ---------- 3. 書き出す ---------- */
  /* 閉じた記録だけ。その日（その週）に始まった物を、切らずに1件で */
  function logsFor(kind, at, now){
    var from = kind === 'week' ? Store.weekStart(at) : Store.dayStart(at);
    var n = kind === 'week' ? 7 : 1, to = addDays(from, n), out = [], seen = {}, i;
    for (i = 0; i < n; i++) {
      (Store.segmentsOfDay(addDays(from, i), now) || []).forEach(function(s){
        var l = s.log;
        if (!l || l.end === null || seen[l.id] || l.start < from || l.start >= to) return;
        seen[l.id] = 1;
        out.push(l);
      });
    }
    out.sort(function(a, b){ return a.start - b.start; });
    return {from: from, last: addDays(from, n - 1), logs: out};
  }
  function itemOf(id){ return Store.item(id); }

  function renderOut(root, kind, at, now){
    var got = logsFor(kind, at, now), logs = got.logs;
    var events = Ics.fromLogs(logs, itemOf);
    var back = kind === 'week' ? 'week' : 'day';
    var html = '<div class="hd"><button type="button" class="link" data-cal="' + back + '" data-at="' + got.from + '">‹ カレンダー</button></div>' +
      '<h1 class="t24">カレンダーに書き出す</h1>';
    if (events.length === 0) {
      html += '<div class="sub g8">書き出す記録が、まだ在りません</div>';
      root.innerHTML = html;
      return;
    }
    html += '<div class="sub g8">' + esc(kind === 'week' ? weekLabel(got.from) : UI.dateLabel(got.from)) + 'の記録 ' + events.length + '件</div>' +
      '<div class="g16 cal-list">';
    events.forEach(function(ev, i){
      var it = Store.item(logs[i].item);
      var head = kind === 'week' ? new Date(ev.start).getDate() + '日 ' : '';
      html += '<div class="brow"><span class="bar ' + UI.toneClass(it.tone) + '"></span>' +
        '<span class="nm">' + head + UI.clock(ev.start) + '〜' + UI.clock(ev.end) + ' ' + esc(it.name) + '</span>' +
        '<a class="add cal-g" target="_blank" rel="noopener" href="' + esc(Ics.googleUrl(ev)) + '">Google に追加 ›</a></div>';
    });
    html += '</div><div class="grow"></div>' +
      '<button type="button" class="btn main g16" data-cal="save" data-kind="' + kind + '" data-at="' + got.from + '">' + events.length + '件をまとめて保存（.ics）</button>' +
      '<div class="c sub g8">保存したファイルを開くと、カレンダーに入ります</div>' +
      '<div class="c sub g8">記録は、この端末の外へは、ここで押した時だけ出ます</div>';
    root.innerHTML = html;
  }

  function saveIcs(kind, at){
    var now = App.now(), got = logsFor(kind, at, now);
    var events = Ics.fromLogs(got.logs, itemOf);
    if (events.length === 0) return;
    var name = kind === 'week' ? Ics.fileName(got.from, got.last) : Ics.fileName(got.from);
    UI.download(name, Ics.build(events, now), 'text/calendar');
  }

  /* ---------- 押した時 ---------- */
  function onClick(e){
    var b = e.target && e.target.closest ? e.target.closest('[data-cal]') : null;
    if (!b || b.disabled) return;
    var act = b.getAttribute('data-cal'), at = Number(b.getAttribute('data-at'));
    if (act === 'week') go({week: at});
    else if (act === 'day') go({day: at});
    else if (act === 'out-week') go({out: 'week', at: at});
    else if (act === 'out-day') go({out: 'day', at: at});
    else if (act === 'add') openAdd(at);
    else if (act === 'save') saveIcs(b.getAttribute('data-kind') === 'week' ? 'week' : 'day', at);
    else if (act === 'edit') {
      var t = window.Views.today;
      if (t && typeof t.editLog === 'function') t.editLog(b.getAttribute('data-id'), function(){ App.refresh(); });
    }
  }

  window.Views.calendar = {
    render: function(root, param){
      var now = App.now(), p = param || {};
      lastParam = p;
      lastMinute = Math.floor(now / MIN);
      if (!root._calWired) { root._calWired = true; root.addEventListener('click', onClick); }
      if ((p.out === 'day' || p.out === 'week') && num(p.at)) renderOut(root, p.out, p.at, now);
      else if (num(p.day)) renderDay(root, p.day, now);
      else renderWeek(root, num(p.week) ? p.week : now, now);
    },
    tick: function(now){
      var m = Math.floor(now / MIN);
      if (m === lastMinute) return;
      lastMinute = m;
      if (!Store.running()) return;
      var sh = document.getElementById('sheet');
      if (sh && sh.classList.contains('on')) return;
      App.refresh();
    }
  };
})();
