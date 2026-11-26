(function(){ 'use strict';
  window.Views = window.Views || {};

  function $(root, sel){ return root.querySelector(sel); }

  function findItem(id){
    var a = Store.data.items;
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }

  var showAll = false;   // 始める物を、全部出しているか

  function p2(n){ return (n < 10 ? '0' : '') + n; }

  function render(root){
    var d = Store.data;
    var h = '';

    h += '<div class="hd"><span class="t24">設定</span></div>';
    h += '<div class="sec" style="margin-top:8px">始める物</div>';
    var rest = Math.max(0, d.items.length - 3);
    d.items.forEach(function(it, i){
      if (!showAll && i >= 3) return;
      h += '<div class="sr"><span class="set-nm' + (it.hidden ? ' set-off' : '') + '">' + UI.esc(it.name) +
        (it.hidden ? '（隠している）' : '') + '</span>' +
        '<button type="button" class="a" data-edit="' + UI.esc(it.id) + '">直す</button></div>';
    });
    h += '<div class="sr">' + (rest > 0 ? '<button type="button" class="set-more" data-act="more" aria-expanded="' + (showAll ? 'true' : 'false') + '">' + (showAll ? '初めの3つだけにする' : 'ほか' + rest + 'つ ›') + '</button>' : '<span></span>') +
      '<button type="button" class="a" data-act="add">＋ 足す</button></div>';

    h += '<div class="sec">集中の長さ・休みの長さ</div>';
    h += '<div class="sr"><span>集中の長さ　' + Number(d.focus.len) + '分</span><button type="button" class="a" data-act="len">変える</button></div>';
    h += '<div class="sr"><span>休みの長さ　' + Number(d.focus.rest) + '分</span><button type="button" class="a" data-act="rest">変える</button></div>';

    h += '<div class="sec">使うタブ</div>';
    h += '<div class="sr"><span>習慣</span><button type="button" class="set-sw" role="switch" aria-checked="' + (d.tabs.habit ? 'true' : 'false') + '" aria-label="習慣のタブ" data-tab-sw="habit">' + (d.tabs.habit ? '入' : '切') + '</button></div>';
    h += '<div class="sr"><span>カレンダー</span><button type="button" class="set-sw" role="switch" aria-checked="' + (d.tabs.cal ? 'true' : 'false') + '" aria-label="カレンダーのタブ" data-tab-sw="cal">' + (d.tabs.cal ? '入' : '切') + '</button></div>';

    h += '<div class="sec">記録の控え</div>';
    h += '<button type="button" class="sr set-row" data-act="save"><span>控えを保存</span><span class="a">›</span></button>';
    h += '<button type="button" class="sr set-row" data-act="load"><span>控えから戻す</span><span class="a">›</span></button>';
    h += '<input type="file" id="set-file" accept=".json,application/json" hidden>';

    h += '<div class="sub g12">登録は要りません。広告は出ません。</div>';
    h += '<div class="sub g8">記録は、この端末の中だけに保存します。ほかの端末とは同期しません。</div>';
    h += '<div class="sub g8">ホーム画面に足すと、記録が消えにくく成ります。</div>';

    root.innerHTML = h;

    root.onclick = function(e){
      var t = e.target && e.target.closest ? e.target.closest('[data-edit],[data-act],[data-tab-sw]') : null;
      if (!t || !root.contains(t)) return;
      if (t.hasAttribute('data-edit')) { editItem(t.getAttribute('data-edit')); return; }
      if (t.hasAttribute('data-tab-sw')) {
        var k = t.getAttribute('data-tab-sw');
        Store.data.tabs[k] = !Store.data.tabs[k];
        Store.save();
        App.refresh();
        return;
      }
      var act = t.getAttribute('data-act');
      if (act === 'more') { showAll = !showAll; App.refresh(); }
      else if (act === 'add') addItem();
      else if (act === 'len') editNumber('集中の長さ（分）', 'len', 1, 240);
      else if (act === 'rest') editNumber('休みの長さ（分）', 'rest', 1, 60);
      else if (act === 'save') saveBackup();
      else if (act === 'load') { var f = $(root, '#set-file'); f.value = ''; f.click(); }
    };

    $(root, '#set-file').onchange = function(){
      var file = this.files && this.files[0];
      if (!file) return;
      var fr = new FileReader();
      fr.onload = function(){ confirmRestore(String(fr.result || '')); };
      fr.onerror = function(){ UI.toast('このファイルは読めませんでした'); };
      fr.readAsText(file);
    };
  }

  function editItem(id){
    var it = findItem(id);
    if (!it) return;
    UI.sheet(
      '<div class="h18">名前を直す</div>' +
      '<input class="g12" type="text" id="set-name" maxlength="12" autocomplete="off" aria-label="名前（12字まで）" value="' + UI.esc(it.name) + '">' +
      '<button type="button" class="btn main g16" id="set-ok">保存</button>' +
      '<button type="button" class="weak g12" style="width:100%" id="set-hide">' + (it.hidden ? '一覧に出す' : '一覧から隠す') + '</button>' +
      '<button type="button" class="link" style="margin:8px auto 0" id="set-cancel">やめる</button>',
      function(box){
        function ok(){
          var name = String($(box, '#set-name').value || '').trim().slice(0, 12);
          if (!name) { UI.toast('名前を入れてください'); return; }
          var same = Store.data.items.some(function(x){ return x.id !== it.id && x.name === name; });
          if (same) { UI.toast('同じ名前が、もう在ります'); return; }
          it.name = name;
          Store.save();
          UI.closeSheet();
          App.refresh();
        }
        $(box, '#set-ok').onclick = ok;
        $(box, '#set-name').onkeydown = function(e){ if (e.key === 'Enter' && !e.isComposing) ok(); };
        $(box, '#set-hide').onclick = function(){
          it.hidden = !it.hidden;
          Store.save();
          UI.closeSheet();
          App.refresh();
        };
        $(box, '#set-cancel').onclick = UI.closeSheet;
      });
  }

  function addItem(){
    UI.sheet(
      '<div class="h18">始める物を足す</div>' +
      '<input class="g12" type="text" id="set-name" maxlength="12" autocomplete="off" aria-label="名前（12字まで）" placeholder="名前（12字まで）">' +
      '<button type="button" class="btn main g16" id="set-ok">足す</button>' +
      '<button type="button" class="link" style="margin:8px auto 0" id="set-cancel">やめる</button>',
      function(box){
        function ok(){
          var name = String($(box, '#set-name').value || '').trim().slice(0, 12);
          if (!name) { UI.toast('名前を入れてください'); return; }
          Store.addItem(name);
          showAll = true;   // 足した物が見える様に
          UI.closeSheet();
          App.refresh();
        }
        $(box, '#set-ok').onclick = ok;
        $(box, '#set-name').onkeydown = function(e){ if (e.key === 'Enter' && !e.isComposing) ok(); };
        $(box, '#set-cancel').onclick = UI.closeSheet;
      });
  }

  function editNumber(title, key, min, max){
    UI.sheet(
      '<div class="h18">' + UI.esc(title) + '</div>' +
      '<input class="g12" type="number" id="set-num" inputmode="numeric" min="' + min + '" max="' + max + '" step="1" aria-label="' + UI.esc(title) + '" value="' + Number(Store.data.focus[key]) + '">' +
      '<div class="sub g8">' + min + '〜' + max + '分</div>' +
      '<button type="button" class="btn main g16" id="set-ok">保存</button>' +
      '<button type="button" class="link" style="margin:8px auto 0" id="set-cancel">やめる</button>',
      function(box){
        function ok(){
          var raw = String($(box, '#set-num').value || '').trim();
          var n = Number(raw);
          if (!/^\d+$/.test(raw) || n < min || n > max) { UI.toast(min + '〜' + max + ' の数を入れてください'); return; }
          Store.data.focus[key] = n;
          Store.save();
          UI.closeSheet();
          App.refresh();
        }
        $(box, '#set-ok').onclick = ok;
        $(box, '#set-num').onkeydown = function(e){ if (e.key === 'Enter') ok(); };
        $(box, '#set-cancel').onclick = UI.closeSheet;
      });
  }

  function saveBackup(){
    var d = new Date(App.now());
    var name = 'jikan_控え_' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '.json';
    UI.download(name, Store.exportJSON(), 'application/json');
  }

  function confirmRestore(text){
    UI.sheet(
      '<div class="h18">控えから戻す</div>' +
      '<div class="g12">いまの記録を、この控えの中身に入れ替えます</div>' +
      '<button type="button" class="link" style="margin:8px auto 0" id="set-cancel">やめる</button>' +
      '<button type="button" class="btn main g8" id="set-ok">入れ替える</button>',
      function(box){
        $(box, '#set-cancel').onclick = UI.closeSheet;
        $(box, '#set-ok').onclick = function(){
          var r = Store.importJSON(text);
          UI.closeSheet();
          if (!r || !r.ok) { UI.toast((r && r.error) || 'この控えの形ではありません'); return; }
          UI.toast('控えの中身に入れ替えました');
          App.refresh();
        };
      });
  }

  Views.settings = { render: render };
})();
