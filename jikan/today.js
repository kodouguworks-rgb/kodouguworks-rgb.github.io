/* today.js — 記録のタブ（絵 A1〜A6）。作りの決め.md §6。Store・UI・App は在る物として使う。 */
(function(){ 'use strict';
  window.Views = window.Views || {};

  var MIN = 60000;
  var rootEl = null;
  var picking = null;     // 選ぶ画面：null か {mode:'free'|'focus'}
  var endedDone = null;   // 「終わった直後」を閉じた log の id
  var endedId = null;     // いま出している「終わった直後」の log の id
  var shown = '';         // いま描いている状態の名前

  function now(){ return App.now(); }
  function esc(s){ return UI.esc(s); }
  function findLog(id){
    var a = Store.data.logs;
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }
  function hasItem(id){
    return Store.data.items.some(function(it){ return it.id === id; });
  }
  function visibleItems(){
    return Store.data.items.filter(function(it){ return !it.hidden; });
  }
  function setText(id, text){
    var el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  }
  function focusLabel(){ return Store.data.focus.len + '分 集中'; }
  function totalText(t){ return 'きょう ' + UI.hm(Store.totalOfDay(Store.dayStart(t), t)); }
  function remainSec(until, t){ return Math.max(0, Math.ceil((until - t) / 1000)); }

  /* ---------- 状態を決める ---------- */
  function decide(param, t){
    var id = param && param.ended;
    if (id && id !== endedDone) {
      var l = findLog(id);
      if (l && l.end !== null) { endedId = id; picking = null; return 'ended'; }
    }
    endedId = null;
    if (picking) return 'pick';
    var rest = Store.data.rest;
    if (rest) {
      if (rest.until > t) return 'rest';
      Store.data.rest = null; Store.save();   // 開いた時に、もう過ぎていた休みは、静かに片づける
    }
    var run = Store.running();
    if (run) return run.mode === 'focus' ? 'focus' : 'free';
    if (Store.data.logs.length === 0) return 'first';
    return 'idle';
  }

  /* ---------- 部品 ---------- */
  function itemsHtml(){
    var h = '';
    visibleItems().forEach(function(it){
      h += '<button type="button" class="weak t-it" data-a="pick" data-id="' + esc(it.id) + '">' + esc(it.name) + '</button>';
    });
    return h;
  }

  function bandHtml(t){
    var segs = Store.segmentsOfDay(Store.dayStart(t), t);
    if (!segs.length) return '<div class="sub g8">きょうの記録は、まだ在りません</div>';
    var h = '<div class="g8">';
    segs.forEach(function(g){
      var l = g.log, it = Store.item(l.item);
      if (l.end === null) {
        h += '<div class="brow"><span class="tm">' + UI.clock(g.from) + '</span><span class="dot"></span>' +
          '<span class="nm">いま ' + UI.clock(l.start) + '〜 ' + esc(it.name) + '</span><span class="mn">計測中</span></div>';
      } else {
        h += '<button type="button" class="brow t-row" data-a="edit" data-id="' + esc(l.id) + '">' +
          '<span class="tm">' + UI.clock(g.from) + '</span><span class="bar ' + UI.toneClass(it.tone) + '"></span>' +
          '<span class="nm">' + esc(it.name) + '</span><span class="mn">' + UI.hm(Store.minutes(g.from, g.to)) + '</span></button>';
        if (l.memo) h += '<div class="memo">' + esc(l.memo) + '</div>';
      }
    });
    return h + '</div>';
  }

  /* ---------- 画面 ---------- */
  function htmlEnded(t){
    var l = findLog(endedId), it = Store.item(l.item);
    var n = Store.focusCountOfDay(Store.dayStart(t));
    return '<div class="c g32"><div class="t24">' + UI.hm(Store.minutes(l.start, l.end)) + 'を記録しました</div>' +
      '<div class="sub g8">' + esc(it.name) + ' ・ ' + n + '回目</div></div>' +
      '<button type="button" class="btn main g24" data-a="rest">' + Store.data.focus.rest + '分休む</button>' +
      '<div class="dk g16"><button type="button" class="link" data-a="again">もう1回 集中</button>' +
      '<button type="button" class="link" data-a="memo">一言メモを書く ›</button></div>';
  }

  function htmlRest(t){
    return '<div class="c g32"><div class="m18">休み</div>' +
      '<div class="big g8" id="t-clock">' + UI.mmss(remainSec(Store.data.rest.until, t)) + '</div></div>' +
      '<div class="g24"><button type="button" class="weak t-w" data-a="restend">休みを終える</button></div>';
  }

  function htmlFocus(t){
    var l = Store.running(), it = Store.item(l.item);
    var n = Store.focusCountOfDay(Store.dayStart(t));
    return '<div class="c g32"><div class="m18">' + esc(it.name) + '</div>' +
      '<div class="big g8" id="t-clock">' + UI.mmss(remainSec(l.start + l.plan * MIN, t)) + '</div>' +
      '<div class="sub g8">集中 ' + n + '回目</div></div>' +
      '<div class="g24"><button type="button" class="weak t-w" data-a="stop">途中で終える</button></div>' +
      '<div class="grow"></div>' +
      '<div class="c sub t-foot">閉じると、終わりの音が鳴らないことがあります</div>';
  }

  function htmlFree(t){
    var l = Store.running(), it = Store.item(l.item);
    return '<div class="c g8"><div class="m18">' + esc(it.name) + '</div>' +
      '<div class="big g8" id="t-clock">' + UI.mmss(Math.floor((t - l.start) / 1000)) + '</div></div>' +
      '<button type="button" class="btn main g16" data-a="stop">終える</button>' +
      '<button type="button" class="link t-mid" data-a="switch">ほかの事に替える</button>' +
      '<div class="h18 g8" id="t-total">' + totalText(t) + '</div>' + bandHtml(t);
  }

  function htmlPick(){
    var f = picking.mode === 'focus';
    return '<div class="c g16"><div class="t24">何の時間を記録しますか？</div></div>' +
      '<div class="seg g16">' +
      '<button type="button" data-a="seg" data-m="free" class="' + (f ? '' : 'on') + '" aria-pressed="' + (f ? 'false' : 'true') + '">そのまま</button>' +
      '<button type="button" data-a="seg" data-m="focus" class="' + (f ? 'on' : '') + '" aria-pressed="' + (f ? 'true' : 'false') + '">' + focusLabel() + '</button></div>' +
      '<div class="grid2 g16">' + itemsHtml() + '</div>' +
      '<button type="button" class="weak t-w g12" data-a="name">＋ 名前を入力</button>' +
      '<div class="c sub g8">押すと、始まります</div>' +
      '<button type="button" class="link t-mid" data-a="cancel">やめる</button>';
  }

  function htmlFirst(){
    return '<div class="c g32"><div class="t24">何の時間を記録しますか？</div></div>' +
      '<div class="grid2 g24">' + itemsHtml() + '</div>' +
      '<button type="button" class="weak t-w g12" data-a="name">＋ 名前を入力</button>' +
      '<div class="c sub g16">押すと、始まります</div>';
  }

  function lastItem(){
    var a = Store.data.logs;
    for (var i = a.length - 1; i >= 0; i--) if (a[i].end !== null && hasItem(a[i].item)) return Store.item(a[i].item);
    return visibleItems()[0] || null;
  }

  function htmlIdle(t){
    var it = lastItem(), h = '';
    if (it) h += '<button type="button" class="btn main g8" data-a="quick" data-id="' + esc(it.id) + '">' + esc(it.name) + 'を始める</button>';
    return h + '<div class="grid2 g12"><button type="button" class="weak t-w" data-a="other">ほかの事を始める</button>' +
      '<button type="button" class="weak t-w" data-a="focus">' + focusLabel() + '</button></div>' +
      '<div class="h18 g24" id="t-total">' + totalText(t) + '</div>' + bandHtml(t);
  }

  /* ---------- 動き ---------- */
  function redraw(){ App.refresh(); }

  function stopNow(){
    var r = Store.stop(now());
    if (r.short) UI.toast('1分未満は記録しません');
    else if (r.log) UI.toast(UI.hm(Store.minutes(r.log.start, r.log.end)) + 'を記録しました');
    return r;
  }

  function begin(itemId, mode){
    if (Store.running()) stopNow();
    Store.start(itemId, mode === 'focus' ? 'focus' : 'free', now());
    picking = null;
    if (endedId) endedDone = endedId;
    redraw();
  }

  function askName(mode){
    UI.sheet(
      '<label class="h18" for="t-name">名前を入力</label>' +
      '<input type="text" id="t-name" class="g12" maxlength="12" autocomplete="off">' +
      '<button type="button" class="btn main g16" id="t-name-ok">始める</button>',
      function(box){
        var inp = box.querySelector('#t-name');
        function ok(){
          var it = Store.addItem(inp.value);
          if (!it) { inp.focus(); return; }
          UI.closeSheet();
          begin(it.id, mode);
        }
        box.querySelector('#t-name-ok').addEventListener('click', ok);
        inp.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.isComposing) ok(); });
      });
  }

  function askMemo(id){
    var l = findLog(id);
    if (!l) return;
    UI.sheet(
      '<label class="h18" for="t-memo">一言メモ</label>' +
      '<input type="text" id="t-memo" class="g12" maxlength="200" autocomplete="off" value="' + esc(l.memo) + '">' +
      '<div class="sub g8" id="t-memo-err" hidden></div>' +
      '<button type="button" class="btn main g16" id="t-memo-ok">保存</button>',
      function(box){
        var inp = box.querySelector('#t-memo'), err = box.querySelector('#t-memo-err');
        function ok(){
          var r = Store.updateLog(id, {memo: inp.value}, now());
          if (!r.ok) { err.textContent = r.error; err.hidden = false; return; }
          UI.closeSheet();
          UI.toast('メモを保存しました');
        }
        box.querySelector('#t-memo-ok').addEventListener('click', ok);
        inp.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.isComposing) ok(); });
      });
  }

  /* 時刻の字（HH:MM）を、元の日のまま ms に。字が元と同じなら、元の ms をそのまま返す（秒をずらさない） */
  function timeOn(orig, value){
    if (value === UI.clock(orig)) return orig;
    var m = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
    if (!m) return NaN;
    var d = new Date(orig);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(m[1]), Number(m[2]), 0, 0).getTime();
  }

  function editLog(id, onDone){
    var l = findLog(id);
    if (!l) return;
    function done(){
      UI.closeSheet();
      if (typeof onDone === 'function') onDone(); else App.refresh();
    }
    var opts = '', found = false;
    Store.data.items.forEach(function(it){
      var sel = it.id === l.item;
      if (sel) found = true;
      if (it.hidden && !sel) return;
      opts += '<option value="' + esc(it.id) + '"' + (sel ? ' selected' : '') + '>' + esc(it.name) + '</option>';
    });
    if (!found) opts = '<option value="' + esc(l.item) + '" selected>' + esc(Store.item(l.item).name) + '</option>' + opts;
    var closed = l.end !== null;
    UI.sheet(
      '<div class="h18">記録を直す</div>' +
      '<label class="sub t-f" for="t-e-item">項目</label><select id="t-e-item">' + opts + '</select>' +
      '<label class="sub t-f" for="t-e-start">始まり</label><input type="time" id="t-e-start" value="' + UI.clock(l.start) + '">' +
      (closed ? '<label class="sub t-f" for="t-e-end">終わり</label><input type="time" id="t-e-end" value="' + UI.clock(l.end) + '">' : '') +
      '<label class="sub t-f" for="t-e-memo">メモ</label><input type="text" id="t-e-memo" maxlength="200" autocomplete="off" value="' + esc(l.memo) + '">' +
      '<div class="sub g12" id="t-e-err" role="alert" hidden></div>' +
      '<button type="button" class="btn main g16" id="t-e-ok">保存</button>' +
      '<button type="button" class="link g8 t-mid" id="t-e-del">この記録を消す</button>',
      function(box){
        var err = box.querySelector('#t-e-err'), del = box.querySelector('#t-e-del'), armed = false;
        function fail(text){ err.textContent = text; err.hidden = false; }
        box.querySelector('#t-e-ok').addEventListener('click', function(){
          var patch = {memo: box.querySelector('#t-e-memo').value};
          var item = box.querySelector('#t-e-item').value;
          if (item !== l.item) patch.item = item;
          patch.start = timeOn(l.start, box.querySelector('#t-e-start').value);
          if (closed) patch.end = timeOn(l.end, box.querySelector('#t-e-end').value);
          if (isNaN(patch.start) || (closed && isNaN(patch.end))) { fail('時刻が読めません'); return; }
          var r = Store.updateLog(id, patch, now());
          if (!r.ok) { fail(r.error); return; }
          done();
        });
        del.addEventListener('click', function(){
          if (!armed) { armed = true; del.textContent = 'もう1度押すと、消えます'; return; }
          Store.deleteLog(id);
          done();
        });
      });
  }

  function onClick(e){
    var b = e.target && e.target.closest ? e.target.closest('[data-a]') : null;
    if (!b || !rootEl || !rootEl.contains(b)) return;
    var a = b.getAttribute('data-a'), id = b.getAttribute('data-id'), t = now(), l;
    if (a === 'pick') begin(id, shown === 'pick' && picking ? picking.mode : 'free');
    else if (a === 'quick') begin(id, 'free');
    else if (a === 'name') askName(shown === 'pick' && picking ? picking.mode : 'free');
    else if (a === 'other' || a === 'switch') { picking = {mode: 'free'}; redraw(); }
    else if (a === 'focus') { picking = {mode: 'focus'}; redraw(); }
    else if (a === 'seg') { picking = {mode: b.getAttribute('data-m') === 'focus' ? 'focus' : 'free'}; redraw(); }
    else if (a === 'cancel') { picking = null; redraw(); }
    else if (a === 'stop') { stopNow(); redraw(); }
    else if (a === 'edit') editLog(id);
    else if (a === 'rest') {
      endedDone = endedId;
      Store.data.rest = {until: t + Store.data.focus.rest * MIN};
      Store.save();
      redraw();
    }
    else if (a === 'restend') { Store.data.rest = null; Store.save(); redraw(); }
    else if (a === 'again') { l = findLog(endedId); if (l) begin(l.item, 'focus'); }
    else if (a === 'memo') askMemo(endedId);
  }

  function render(root, param){
    rootEl = root;
    if (!root._todayWired) { root._todayWired = true; root.addEventListener('click', onClick); }
    var t = now();
    shown = decide(param, t);
    root.innerHTML =
      shown === 'ended' ? htmlEnded(t) :
      shown === 'pick' ? htmlPick() :
      shown === 'rest' ? htmlRest(t) :
      shown === 'focus' ? htmlFocus(t) :
      shown === 'free' ? htmlFree(t) :
      shown === 'first' ? htmlFirst() : htmlIdle(t);
  }

  /* 毎秒：字だけを書き替える。描き直すのは、休みが終わった時だけ */
  function tick(t){
    var rest = Store.data.rest, run;
    if (rest && rest.until <= t) {
      UI.beep();
      Store.data.rest = null; Store.save();
      UI.toast('休みが終わりました');
      if (shown === 'rest') redraw();
      return;
    }
    if (shown === 'rest' && rest) { setText('t-clock', UI.mmss(remainSec(rest.until, t))); return; }
    run = Store.running();
    if (shown === 'focus' && run && run.plan) setText('t-clock', UI.mmss(remainSec(run.start + run.plan * MIN, t)));
    else if (shown === 'free' && run) {
      setText('t-clock', UI.mmss(Math.floor((t - run.start) / 1000)));
      setText('t-total', totalText(t));
    }
    else if (shown === 'idle') setText('t-total', totalText(t));
  }

  Views.today = { render: render, tick: tick, editLog: editLog };
})();
