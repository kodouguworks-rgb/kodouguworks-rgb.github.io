(function(){ 'use strict';
  var App = {};
  var NAMES = ['today', 'habit', 'calendar', 'settings'];
  var TABS = [['today', '記録'], ['habit', '習慣'], ['calendar', 'カレンダー']];
  var cur = 'today';
  var curParam = null;
  var askedPersist = false;
  var fixedNow = null;
  var isDemo = false;

  (function readUrl(){
    var q = String(location.search || '');
    var m = /[?&]now=(\d+)/.exec(q);
    if (m) fixedNow = Number(m[1]);
    isDemo = /[?&]demo=1(&|$)/.test(q);
  })();

  App.now = function(){ return fixedNow !== null ? fixedNow : Date.now(); };

  function allowed(name){
    if (NAMES.indexOf(name) < 0) return false;
    var t = (window.Store && Store.data && Store.data.tabs) || {};
    if (name === 'habit' && t.habit === false) return false;
    if (name === 'calendar' && t.cal === false) return false;
    return true;
  }

  function nameFromHash(){
    var h = String(location.hash || '').replace(/^#/, '').split(/[?&\/]/)[0];
    return allowed(h) ? h : 'today';
  }

  function drawHeader(){
    // 上の1行（日付と「設定」）は、記録のタブの時だけ出す。ほかの画面は、自分の見出しを main の中に描く
    var hd = document.getElementById('hd');
    var d = document.getElementById('hd-date'), s = document.getElementById('hd-set');
    if (!hd || !d || !s) return;
    var show = (cur === 'today');
    if (hd.hidden === show) hd.hidden = !show;
    if (!show) return;
    var label = UI.dateLabel(App.now());
    if (d.textContent !== label) d.textContent = label;
    d.className = 'sub';
    s.hidden = false;
  }

  function drawTabs(){
    var nav = document.getElementById('tabs');
    if (!nav) return;
    var running = !!(window.Store && Store.running && Store.running());
    var html = '';
    TABS.forEach(function(t){
      if (!allowed(t[0])) return;
      var here = (t[0] === cur);
      var on = here || (cur === 'settings' && t[0] === 'today');   // 設定は、記録のタブの奥（絵 S1）
      html += '<button type="button" data-tab="' + t[0] + '" class="' + (on ? 'on' : '') + '"' + (here ? ' aria-current="page"' : '') + '>' +
        t[1] + (t[0] === 'today' ? '<i class="dot" id="tab-dot"' + (running ? '' : ' hidden') + '></i>' : '') + '</button>';
    });
    nav.innerHTML = html;
  }

  function drawDot(){
    var dot = document.getElementById('tab-dot');
    if (!dot) return;
    var running = !!Store.running();
    if (dot.hidden === running) dot.hidden = !running;
  }

  function draw(){
    var root = document.getElementById('view');
    var v = (window.Views || {})[cur];
    drawHeader();
    drawTabs();
    if (!root) return;
    if (v && typeof v.render === 'function') v.render(root, curParam || {});
    else root.innerHTML = '';
  }

  App.go = function(name, param){
    if (!allowed(name)) name = 'today';
    var changed = (name !== cur);
    cur = name;
    curParam = param || null;
    if (String(location.hash || '').replace(/^#/, '') !== name) {
      try { location.hash = name; } catch (err) {}
    }
    if (window.UI) UI.closeSheet();
    draw();
    if (changed) window.scrollTo(0, 0);
  };

  App.refresh = function(){
    if (!allowed(cur)) { App.go('today'); return; }
    draw();
  };

  App.current = function(){ return cur; };

  App.onFocusEnd = function(result){
    UI.beep();
    App.go('today', {ended: result && result.log ? result.log.id : null});
  };

  function askPersist(){
    if (askedPersist || Store.readonly) return;
    if (!Store.data || !Store.data.logs || Store.data.logs.length === 0) return;
    askedPersist = true;
    try {
      if (navigator.storage && navigator.storage.persist) {
        var p = navigator.storage.persist();
        if (p && p.catch) p.catch(function(){});
      }
    } catch (err) {}
  }

  function tick(){
    var now = App.now();
    var r = Store.settle(now);
    if (r) App.onFocusEnd(r);
    drawHeader();
    drawDot();
    askPersist();
    var v = (window.Views || {})[cur];
    if (v && typeof v.tick === 'function') v.tick(now);
  }

  function boot(){
    Store.load();
    cur = nameFromHash();
    var first = Store.settle(App.now());
    if (first) { cur = 'today'; curParam = {ended: first.log ? first.log.id : null}; }
    if (String(location.hash || '').replace(/^#/, '') !== cur && location.hash) {
      try { location.hash = cur; } catch (err) {}
    }
    draw();

    document.getElementById('tabs').addEventListener('click', function(e){
      var b = e.target && e.target.closest ? e.target.closest('[data-tab]') : null;
      if (b) App.go(b.getAttribute('data-tab'));
    });
    document.getElementById('hd-set').addEventListener('click', function(){ App.go('settings'); });
    window.addEventListener('hashchange', function(){
      var n = nameFromHash();
      if (n !== cur) App.go(n);
    });

    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'visible') tick();
    });

    var host = location.hostname;
    var okPlace = location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1';
    if (okPlace && !isDemo && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function(){});
    }
  }

  window.App = App;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
