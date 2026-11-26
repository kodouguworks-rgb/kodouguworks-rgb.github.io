/* ics.js — .ics（iCalendar・RFC 5545）の字と、Google の予定追加のリンクを作る（画面に触らない） */
(function () {
  'use strict';

  function p2(n) { return (n < 10 ? '0' : '') + n; }

  /* ms → UTC の YYYYMMDDTHHMMSSZ */
  function utc(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + 'T' +
      p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + 'Z';
  }

  /* TEXT の値の逃がし（RFC 5545 3.3.11）：\ ; , 改行 */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n');
  }

  function bytesOf(ch) {
    var c = ch.codePointAt(0);
    return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }

  /* 1行を75オクテット以下に折る（字の途中では切らない。続きの行の頭は空白1つで、それも数に入れる） */
  function fold(line) {
    var out = [], cur = '', n = 0;
    Array.from(line).forEach(function (ch) {
      var b = bytesOf(ch);
      if (n + b > 75) { out.push(cur); cur = ' '; n = 1; }
      cur += ch; n += b;
    });
    out.push(cur);
    return out.join('\r\n');
  }

  function build(events, now) {
    var stamp = utc(typeof now === 'number' && isFinite(now) ? now : Date.now());
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//jikan//JP', 'CALSCALE:GREGORIAN'];
    (Array.isArray(events) ? events : []).forEach(function (e) {
      if (!e || typeof e.start !== 'number' || typeof e.end !== 'number') return;
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + String(e.uid == null ? '' : e.uid).replace(/[^A-Za-z0-9_-]/g, '_') + '@jikan');
      lines.push('DTSTAMP:' + stamp);
      lines.push('DTSTART:' + utc(e.start));
      lines.push('DTEND:' + utc(e.end));
      lines.push('SUMMARY:' + esc(e.title));
      if (e.note) lines.push('DESCRIPTION:' + esc(e.note));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  /* 【未確認】この URL の形（action=TEMPLATE・text・dates・details）は、Google の公式の説明が見つかっていない */
  function googleUrl(event) {
    var e = event || {};
    var u = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(String(e.title == null ? '' : e.title)) +
      '&dates=' + utc(e.start) + '/' + utc(e.end);
    if (e.note) u += '&details=' + encodeURIComponent(String(e.note));
    return u;
  }

  /* log の並び（または segmentsOfDay の {log, from, to} の並び）→ events。
     区切った物が来ても、元の log の始まり〜終わりで1つにする（同じ id は1回だけ）。end が null の物は入れない */
  function fromLogs(segmentsOrLogs, itemOf) {
    var out = [], seen = {};
    if (typeof itemOf !== 'function') {
      itemOf = function (id) {
        return typeof window !== 'undefined' && window.Store ? window.Store.item(id) : { name: '' };
      };
    }
    (Array.isArray(segmentsOrLogs) ? segmentsOrLogs : []).forEach(function (x) {
      var l = x && x.log ? x.log : x;
      if (!l || typeof l.start !== 'number' || typeof l.end !== 'number' || seen[l.id]) return;
      seen[l.id] = 1;
      var it = itemOf(l.item);
      out.push({ uid: l.id, start: l.start, end: l.end, title: (it && it.name) || '', note: l.memo || '' });
    });
    return out;
  }

  function ymd(ms) { var d = new Date(ms); return '' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()); }

  /* 日付は端末の時刻。同じ日（または toMs 無し）なら1つだけ */
  function fileName(fromMs, toMs) {
    var a = ymd(fromMs), b = typeof toMs === 'number' && isFinite(toMs) ? ymd(toMs) : a;
    return 'jikan_' + (a === b ? a : a + '-' + b) + '.ics';
  }

  var Ics = { build: build, googleUrl: googleUrl, fromLogs: fromLogs, fileName: fileName, _utc: utc, _esc: esc, _fold: fold };

  if (typeof window !== 'undefined') window.Ics = Ics;
  if (typeof module !== 'undefined') module.exports = Ics;
})();
