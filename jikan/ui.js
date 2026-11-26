(function(){ 'use strict';
  var UI = {};
  var WD = ['日','月','火','水','木','金','土'];
  var toastTimer = null;
  var sheetBack = null;   // 紙を開く前に焦点が在った所
  var audio = null;

  function p2(n){ return (n < 10 ? '0' : '') + n; }

  UI.esc = function(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  UI.hm = function(min){
    min = Math.max(0, Math.floor(Number(min) || 0));
    var h = Math.floor(min / 60), m = min % 60;
    if (h === 0) return m + '分';
    if (m === 0) return h + '時間';
    return h + '時間' + m + '分';
  };

  UI.clock = function(ms){
    var d = new Date(ms);
    return p2(d.getHours()) + ':' + p2(d.getMinutes());
  };

  UI.mmss = function(sec){
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return h + ':' + p2(m) + ':' + p2(s);
    return p2(m) + ':' + p2(s);
  };

  UI.dateLabel = function(ms){
    var d = new Date(ms);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WD[d.getDay()] + '）';
  };

  UI.toneClass = function(tone){
    return tone === 0 ? 's1' : (tone === 1 ? 's2' : 's3');
  };

  function onKey(e){
    if (e.key === 'Escape' || e.keyCode === 27) UI.closeSheet();
  }

  UI.sheet = function(html, onReady){
    var el = document.getElementById('sheet');
    if (!el) return null;
    if (!el.classList.contains('on')) sheetBack = document.activeElement;
    el.innerHTML = '<div class="sheet-box" role="dialog" aria-modal="true">' + html + '</div>';
    el.classList.add('on');
    if (!el._wired) {
      el._wired = true;
      el.addEventListener('click', function(e){ if (e.target === el) UI.closeSheet(); });
    }
    document.removeEventListener('keydown', onKey);
    document.addEventListener('keydown', onKey);
    var box = el.firstChild;
    if (typeof onReady === 'function') onReady(box);
    var f = box.querySelector('input:not([type=hidden]):not([type=file]),textarea,select') || box.querySelector('button,a[href]');
    if (f && f.focus) {
      try { f.focus(); if (f.select && f.type !== 'number') f.select(); } catch (err) {}
    }
    return box;
  };

  UI.closeSheet = function(){
    var el = document.getElementById('sheet');
    if (!el) return;
    el.classList.remove('on');
    el.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    if (sheetBack && sheetBack.focus && document.body.contains(sheetBack)) {
      try { sheetBack.focus(); } catch (err) {}
    }
    sheetBack = null;
  };

  UI.toast = function(text){
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = String(text);
    el.classList.add('on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ el.classList.remove('on'); toastTimer = null; }, 2000);
  };

  UI.beep = function(){
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audio) audio = new AC();
      if (audio.state === 'suspended' && audio.resume) audio.resume();
      var t = audio.currentTime;
      [[880, 0], [1175, 0.22]].forEach(function(n){
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine';
        o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t + n[1]);
        g.gain.exponentialRampToValueAtTime(0.25, t + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + 0.2);
        o.connect(g); g.connect(audio.destination);
        o.start(t + n[1]); o.stop(t + n[1] + 0.22);
      });
    } catch (err) {}
  };

  function saveAs(name, text, mime){
    var blob = new Blob([text], {type: mime});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  UI.download = function(name, text, mime){
    mime = mime || 'text/plain';
    try {
      if (typeof File === 'function' && navigator.canShare && navigator.share) {
        var file = new File([text], name, {type: mime});
        if (navigator.canShare({files: [file]})) {
          navigator.share({files: [file]}).catch(function(err){
            // 使う人が閉じた時（AbortError）は何もしない。ほかの失敗は、保存に替える
            if (!err || err.name !== 'AbortError') saveAs(name, text, mime);
          });
          return;
        }
      }
    } catch (err) {}
    saveAs(name, text, mime);
  };

  window.UI = UI;
  if (typeof module !== 'undefined') module.exports = UI;
})();
