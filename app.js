'use strict';
// Gトレ — G検定の勉強アプリ。Udemy講座の章に沿って「図解 → 問題 → 復習」を回す。

const KEY = 'gtore:v1';
const IV = [0, 1, 3, 7];          // 復習の間隔（日）。box 0〜3 は復習中、4 で「習得」
const MOCKS = [
  { id: 'mini', n: 30, min: 20, ttl: 'ミニ模試', sub: '30問・20分' },
  { id: 'half', n: 70, min: 50, ttl: 'ハーフ模試', sub: '70問・50分' },
  { id: 'full', n: 145, min: 100, ttl: '本番模試', sub: '145問・100分（本番と同じ）' },
];

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (c, n) => n ? Math.round(c / n * 100) : 0;
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const chap = n => G.chapters.find(c => c.n === n);
const chLabel = n => `第${n}章`;

const IC = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M4 22V4c4-2 8 2 12 0v10c-4 2-8-2-12 0"/></svg>',
};
const TABS = [['home', 'ホーム', IC.home], ['course', '講座', IC.book], ['review', '復習', IC.redo], ['mock', '模試', IC.timer], ['stats', '記録', IC.chart]];

// ---------- 保存 ----------
function blank() { return { v: 1, exam: '', goal: 20, theme: '', q: {}, cards: {}, seen: {}, days: {}, mocks: [] }; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(blank(), s); } catch (e) { /* 読めなければ新規 */ }
  return blank();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('保存できませんでした'); } }
let S = load();

// ---------- 集計 ----------
const lessonOf = (ch, lec) => G.lessons.find(l => l.ch === ch && l.lec === lec);
const qsOf = (ch, lec) => G.qs.filter(q => (!ch || q.ch === ch) && (!lec || q.lec === lec));
const cardsOf = (ch, lec) => G.cards.filter(c => (!ch || c.ch === ch) && (!lec || c.lec === lec));
function summary(qs) {
  let done = 0, n = 0, c = 0, wrong = 0, master = 0;
  for (const q of qs) {
    const s = S.q[q.id]; if (!s) continue;
    done++; n += s.n; c += s.c;
    if (s.box < 4) wrong++; else master++;
  }
  return { total: qs.length, done, n, c, acc: pct(c, n), wrong, master };
}
const dueList = () => G.qs.filter(q => { const s = S.q[q.id]; return s && s.box < 4 && s.due <= today(); });
const wrongList = () => G.qs.filter(q => { const s = S.q[q.id]; return s && s.box < 4; });
function streak() {
  let d = today(), n = 0;
  if (!S.days[d]) d = addDays(d, -1);
  while (S.days[d]) { n++; d = addDays(d, -1); }
  return n;
}
// 講座の順で、まだ解いていない問題があるレクチャー
function nextLecture() {
  for (const c of G.chapters) for (const lec of c.lecs) {
    const qs = qsOf(c.n, lec);
    if (qs.length && qs.some(q => !S.q[q.id])) return { ch: c.n, lec, left: qs.filter(q => !S.q[q.id]).length, lesson: !!lessonOf(c.n, lec) };
  }
  return null;
}

function record(q, ok) {
  const t = today();
  const s = S.q[q.id] || (S.q[q.id] = { n: 0, c: 0, box: 0, due: t, w: 0 });
  s.n++; if (ok) s.c++;
  s.last = t;
  if (!ok) { s.box = 0; s.due = t; s.w++; }
  else if (s.n === 1) s.box = 4;                       // 最初から正解 → 習得
  else if (s.box < 4) { s.box++; if (s.box < 4) s.due = addDays(t, IV[s.box]); }
  S.days[t] = (S.days[t] || 0) + 1;
}

// ---------- 画面の状態 ----------
const V = { tab: 'home', stack: [] };   // stack: 講座タブ内の階層 {p:'ch',ch} / {p:'lec',ch,lec}
let Z = null;                           // 問題・カードのセッション

function render() {
  const due = dueList().length;
  $('#tabbar').innerHTML = TABS.map(([id, label, ic]) =>
    `<button class="tab${V.tab === id ? ' on' : ''}" data-a="tab" data-id="${id}">${ic}<span>${label}</span>${id === 'review' && due ? `<span class="dot num">${due}</span>` : ''}</button>`).join('');
  const page = { home: pHome, course: pCourse, review: pReview, mock: pMock, stats: pStats }[V.tab];
  $('#main').innerHTML = page();
}

// ---------- ホーム ----------
function pHome() {
  const t = today(), done = S.days[t] || 0, goal = S.goal || 20;
  const all = summary(G.qs), due = dueList().length, st = streak();
  const nx = nextLecture();
  const r = 32, L = 2 * Math.PI * r, f = Math.min(1, done / goal);
  let exam = '';
  if (S.exam) {
    const left = daysBetween(t, S.exam);
    const remain = G.qs.length - all.done;
    const perDay = left > 0 ? Math.ceil(remain / Math.max(1, left - 7)) : 0;
    exam = left >= 0
      ? `<div class="card pad"><div class="muted small">本番（${S.exam.replace(/-/g, '/')}）まで</div><div style="font-size:30px;font-weight:800;letter-spacing:-.02em">あと <span class="num">${left}</span> 日</div>${remain > 0 && left > 7 ? `<div class="small muted">まだ解いていない問題 ${remain}問 → 1日 <b class="num">${perDay}</b>問ペースで最後の1週間を復習にあてられます</div>` : `<div class="small muted">ラストスパート！復習と模試で仕上げましょう</div>`}</div>`
      : `<div class="card pad"><div class="bold">受験おつかれさまでした！</div><div class="small muted">受験日は記録タブの設定で変えられます</div></div>`;
  } else {
    exam = `<button class="card pad tap" data-a="tab" data-id="stats" style="width:100%"><div class="bold">📅 受験日を設定する</div><div class="small muted">残り日数と1日のペースを表示します（記録タブ → 設定）</div></button>`;
  }
  return `
  <div class="page-h"><h1>Gトレ</h1><span class="pill gd">🔥 ${st}日連続</span></div>
  ${exam}
  <div class="card hero mt12">
    <svg class="ring" viewBox="0 0 76 76"><circle class="bg" cx="38" cy="38" r="${r}"/><circle class="fg" cx="38" cy="38" r="${r}" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - f)}"/><text x="38" y="38">${Math.round(f * 100)}%</text></svg>
    <div><div class="muted small">今日解いた問題</div><div class="big num">${done}<small>/ ${goal}問</small></div><div class="small muted">${done >= goal ? '今日の目標クリア！🎉' : `あと${goal - done}問で目標達成`}</div></div>
  </div>
  <div class="mt12">${nx ? `<button class="next tap" data-a="lec" data-ch="${nx.ch}" data-lec="${esc(nx.lec)}">
      <div class="k">続きから ・ ${chLabel(nx.ch)}（Udemyセクション${chap(nx.ch).sec}）</div>
      <div class="t">${esc(nx.lec)}</div>
      <div class="s">${nx.lesson ? '📘 図解 ＋ ' : ''}まだ解いていない問題 ${nx.left}問</div></button>`
      : `<div class="card pad">🎉 すべての問題に1回は挑戦しました。模試で仕上げましょう！</div>`}</div>
  <div class="grid2 mt12">
    <button class="card tile tap${due ? ' alert' : ''}" data-a="startDue"><span class="ic">🔁</span><span class="t">復習 ${due}問</span><span class="s">${due ? '間違えた問題が待っています' : '今日の復習はありません'}</span></button>
    <button class="card tile tap" data-a="random"><span class="ic">🎲</span><span class="t">ランダム10問</span><span class="s">全章からまんべんなく</span></button>
    <button class="card tile tap" data-a="weak"><span class="ic">🎯</span><span class="t">苦手つぶし</span><span class="s">正答率の低い章から10問</span></button>
    <button class="card tile tap" data-a="cardsAll"><span class="ic">📇</span><span class="t">用語カード</span><span class="s">まだ覚えていない用語を20枚</span></button>
  </div>
  <button class="card li tap mt12" data-a="notes" data-ch="0" style="border-radius:var(--r)"><span class="emo">📝</span><span class="grow"><div class="ttl">まとめノート</div><div class="small muted">全レクチャーの要点を一気に見直す（試験前に）</div></span><span class="chev">${IC.chev}</span></button>
  <div class="sec-h">ぜんたいの進み具合</div>
  <div class="card kpis"><div><b class="num">${all.done}<small class="muted" style="font-size:13px">/${all.total}</small></b><span>挑戦した問題</span></div><div><b class="num">${all.n ? all.acc + '%' : '—'}</b><span>正答率</span></div><div><b class="num">${all.master}</b><span>習得した問題</span></div></div>
  <p class="small muted" style="margin:14px 4px">使い方：Udemyで1レクチャー見る → 講座タブで同じレクチャーを開いて図解を読む → 問題を解く。間違えた問題は1日後・3日後・7日後に復習タブに出てきます。</p>`;
}

// ---------- 講座 ----------
function pCourse() {
  const top = V.stack[V.stack.length - 1];
  if (top && top.p === 'lec') return pLecture(top.ch, top.lec);
  if (top && top.p === 'notes') return pNotes(top.ch);
  if (top && top.p === 'ch') return pChapter(top.ch);
  return `<div class="page-h"><h1>講座</h1></div>
  <p class="small muted" style="margin:-6px 4px 12px">Udemy「G検定 集中講義」と同じ順番です。</p>
  <button class="card li tap mb12" data-a="notes" data-ch="0" style="border-radius:var(--r)"><span class="emo">📝</span><span class="grow"><div class="ttl">全章のまとめノート</div><div class="small muted">全レクチャーの「ここを覚える」を一気に見直す</div></span><span class="chev">${IC.chev}</span></button>
  <div class="card list">${G.chapters.map(c => {
    const s = summary(qsOf(c.n)), nl = G.lessons.filter(l => l.ch === c.n).length;
    return `<button class="li tap" data-a="ch" data-ch="${c.n}"><span class="emo">${c.emo}</span><span class="grow">
      <span class="tiny muted">${chLabel(c.n)} ・ セクション${c.sec}</span><div class="ttl">${esc(c.title)}</div>
      <div class="badges"><span class="pill">${s.done}/${s.total}問</span>${s.n ? `<span class="pill ${s.acc >= 70 ? 'ok' : 'ng'}">正答率 ${s.acc}%</span>` : ''}${nl ? `<span class="pill ac">📘 図解 ${nl}</span>` : ''}</div>
      <div class="bar"><i style="width:${pct(s.done, s.total)}%"></i></div></span><span class="chev">${IC.chev}</span></button>`;
  }).join('')}</div>`;
}

function lecStatus(ch, lec) {
  const qs = qsOf(ch, lec); const s = summary(qs);
  if (!qs.length) return '';
  if (!s.done) return `<span class="pill">${qs.length}問</span>`;
  if (s.wrong) return `<span class="pill ng">${s.done}/${qs.length} ・ 復習${s.wrong}</span>`;
  if (s.done < qs.length) return `<span class="pill ac">${s.done}/${qs.length}</span>`;
  return `<span class="pill ok">✓ ${qs.length}問</span>`;
}

function pChapter(n) {
  const c = chap(n), qs = qsOf(n), s = summary(qs), cs = cardsOf(n);
  const wr = qs.filter(q => S.q[q.id] && S.q[q.id].box < 4).length;
  return `<button class="back" data-a="pop">${IC.back}講座</button>
  <div class="tiny muted">${chLabel(n)} ・ Udemyセクション${c.sec}</div>
  <div class="page-h" style="margin-top:2px"><h1 style="font-size:24px">${c.emo} ${esc(c.title)}</h1></div>
  <div class="row2"><button class="btn primary" data-a="chQuiz" data-ch="${n}">章の問題 ${qs.length}問</button><button class="btn soft" data-a="chCards" data-ch="${n}">用語カード ${cs.length}</button></div>
  <button class="btn gray block mt8" data-a="notes" data-ch="${n}">📝 この章のまとめノート</button>
  ${wr ? `<button class="btn danger block mt8" data-a="chWrong" data-ch="${n}">この章の間違えた問題 ${wr}問</button>` : ''}
  <div class="small muted mt8" style="margin-left:4px">挑戦 ${s.done}/${s.total}問${s.n ? ` ・ 正答率 ${s.acc}%` : ''}</div>
  <div class="sec-h">レクチャー</div>
  <div class="card list">${c.lecs.map((lec, i) => {
    const l = lessonOf(n, lec), seen = l && S.seen[l.id];
    return `<button class="li tap" data-a="lec" data-ch="${n}" data-lec="${esc(lec)}"><span class="tiny muted num" style="width:18px;text-align:right">${i + 1}</span><span class="grow"><div class="ttl">${esc(lec)}</div><div class="badges">${l ? `<span class="pill ${seen ? 'ok' : 'ac'}">📘 ${seen ? '図解 読んだ' : '図解'}</span>` : ''}${lecStatus(n, lec)}</div></span><span class="chev">${IC.chev}</span></button>`;
  }).join('')}</div>`;
}

// レクチャーの中身：タイトル → ここを覚える → 図解 → もっと詳しく
function lessonBody(n, lec) {
  const l = lessonOf(n, lec), k = G.keys[n + ':' + lec], more = G.more[n + ':' + lec] || [];
  return `<h2>${esc(l ? l.title : lec)}</h2>
    ${k ? `<div class="keys"><div class="keys-h">ここを覚える</div><ol>${k.map(p => `<li>${p}</li>`).join('')}</ol></div>` : ''}
    ${l ? l.html : more.length ? '' : `<p class="muted">このレクチャーは問題と用語カードで確認しましょう。</p>`}
    ${more.map(m => `<div class="more"><div class="more-h">もっと詳しく</div><h3>${esc(m.title)}</h3>${m.html}</div>`).join('')}`;
}

function pNotes(n) {
  const chs = n ? [chap(n)] : G.chapters;
  const total = chs.reduce((s, c) => s + c.lecs.filter(lec => G.keys[c.n + ':' + lec]).length, 0);
  return `<button class="back" data-a="pop">${IC.back}${n ? esc(chap(n).title) : '講座'}</button>
  <div class="page-h" style="margin-top:2px"><h1 style="font-size:26px">📝 まとめノート</h1></div>
  <p class="small muted" style="margin:-6px 4px 12px">${n ? `${chLabel(n)}の` : '全章の'}要点だけを集めたページです（${total}レクチャー分）。試験前の見直しに。タイトルをタップするとそのレクチャーが開きます。</p>
  ${chs.map(c => `${n ? '' : `<div class="sec-h">${c.emo} ${chLabel(c.n)} ${esc(c.title)}</div>`}
    <div class="card list notes">${c.lecs.filter(lec => G.keys[c.n + ':' + lec]).map(lec => `<div class="li"><div class="grow">
      <button class="link tap" data-a="lec" data-ch="${c.n}" data-lec="${esc(lec)}">${esc(lec)}</button>
      <ul>${G.keys[c.n + ':' + lec].map(p => `<li>${p}</li>`).join('')}</ul></div></div>`).join('')}</div>`).join('')}`;
}

function pLecture(n, lec) {
  const c = chap(n), l = lessonOf(n, lec), qs = qsOf(n, lec), cs = cardsOf(n, lec);
  if (l && !S.seen[l.id]) { S.seen[l.id] = today(); save(); }
  const i = c.lecs.indexOf(lec), nextLec = c.lecs[i + 1];
  const nextCh = !nextLec && chap(n + 1);
  return `<button class="back" data-a="pop">${IC.back}${esc(c.title)}</button>
  <div class="card lesson">
    <div class="tiny muted">${chLabel(n)} ・ レクチャー${i + 1}</div>
    ${lessonBody(n, lec)}
  </div>
  ${qs.length ? `<button class="btn primary block mt12" data-a="lecQuiz" data-ch="${n}" data-lec="${esc(lec)}">このレクチャーの問題を解く（${qs.length}問）</button>` : ''}
  ${cs.length ? `<div class="sec-h">このレクチャーの用語</div><div class="card list termlist">${cs.map(t => `<div class="li"><div class="grow"><div class="f">${esc(t.f)}</div><div class="b">${esc(t.b)}</div></div></div>`).join('')}</div>` : ''}
  ${nextLec ? `<button class="btn gray block mt16" data-a="lec" data-ch="${n}" data-lec="${esc(nextLec)}" data-replace="1">次のレクチャー：${esc(nextLec)} →</button>`
    : nextCh ? `<button class="btn gray block mt16" data-a="ch" data-ch="${n + 1}" data-replace="2">次の章：${esc(nextCh.title)} →</button>` : ''}`;
}

// ---------- 復習 ----------
function pReview() {
  const due = dueList(), wr = wrongList();
  const unk = G.cards.filter(c => S.cards[c.id] && !S.cards[c.id].k);
  const later = wr.filter(q => S.q[q.id].due > today());
  const byCh = G.chapters.map(c => ({ c, n: wr.filter(q => q.ch === c.n).length })).filter(x => x.n);
  return `<div class="page-h"><h1>復習</h1></div>
  <div class="card pad" style="text-align:center">
    <div class="muted small">今日やる復習</div>
    <div style="font-size:44px;font-weight:800" class="num">${due.length}<small style="font-size:18px">問</small></div>
    <button class="btn primary block mt8" data-a="startDue" ${due.length ? '' : 'disabled'}>${due.length ? '復習をはじめる' : '今日の復習は完了！'}</button>
    ${later.length ? `<div class="small muted mt8">ほかに ${later.length}問 が後日の復習待ち（1日後→3日後→7日後に出てきます）</div>` : ''}
  </div>
  <p class="small muted" style="margin:10px 4px">間違えた問題は、間隔をあけて3回続けて正解すると「習得」になって復習リストから外れます。</p>
  <div class="sec-h">間違えたことがある問題（${wr.length}問）</div>
  ${byCh.length ? `<div class="card list">${byCh.map(({ c, n }) => `<button class="li tap" data-a="chWrong" data-ch="${c.n}"><span class="emo">${c.emo}</span><span class="grow"><div class="ttl">${esc(c.title)}</div><div class="small muted">${n}問</div></span><span class="chev">${IC.chev}</span></button>`).join('')}</div>
     <button class="btn soft block mt8" data-a="allWrong">ぜんぶまとめて解く</button>`
    : `<div class="card empty"><div class="ic">✨</div>まだありません</div>`}
  <div class="sec-h">用語カード</div>
  <div class="card list">
    <button class="li tap" data-a="cardsUnknown" ${unk.length ? '' : 'disabled'}><span class="emo">📇</span><span class="grow"><div class="ttl">「まだ」にした用語</div><div class="small muted">${unk.length}枚</div></span><span class="chev">${IC.chev}</span></button>
    <button class="li tap" data-a="cardsAll"><span class="emo">🃏</span><span class="grow"><div class="ttl">はじめて見る用語から20枚</div><div class="small muted">全${G.cards.length}枚中 ${G.cards.filter(c => S.cards[c.id] && S.cards[c.id].k).length}枚 覚えた</div></span><span class="chev">${IC.chev}</span></button>
  </div>`;
}

// ---------- 模試 ----------
function pMock() {
  return `<div class="page-h"><h1>模試</h1></div>
  <p class="small muted" style="margin:-6px 4px 12px">本番（オンライン）は100分・145問ほど。1問あたり約40秒です。全章からバランスよく出題し、終わるまで正解は表示しません。</p>
  <div class="card list">${MOCKS.map(m => `<button class="li tap" data-a="mock" data-id="${m.id}"><span class="emo">${m.id === 'full' ? '🏁' : m.id === 'half' ? '⏱️' : '⚡'}</span><span class="grow"><div class="ttl">${m.ttl}</div><div class="small muted">${m.sub}</div></span><span class="chev">${IC.chev}</span></button>`).join('')}</div>
  <div class="sec-h">これまでの結果</div>
  ${S.mocks.length ? `<div class="card list">${S.mocks.slice().reverse().slice(0, 20).map(m => {
    const p = pct(m.c, m.n);
    return `<div class="li"><span class="grow"><div class="ttl">${esc(m.ttl)} <span class="pill ${p >= 70 ? 'ok' : 'ng'}">${p}%</span></div><div class="small muted">${m.d.replace(/-/g, '/')} ・ ${m.c}/${m.n}問 ・ ${Math.floor(m.sec / 60)}分${m.sec % 60}秒</div></span></div>`;
  }).join('')}</div>` : `<div class="card empty"><div class="ic">📝</div>まだ受けていません。まずはミニ模試から！</div>`}
  <p class="small muted" style="margin:10px 4px">合格ラインは公表されていませんが、目安として7割以上を安定して取れるようにしておくと安心です。</p>`;
}

// ---------- 記録・設定 ----------
function pStats() {
  const all = summary(G.qs);
  const t = today(), days = [...Array(14)].map((_, i) => addDays(t, i - 13));
  const mx = Math.max(10, ...days.map(d => S.days[d] || 0));
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${(S[k] || '') === v ? 'on' : ''}" data-a="set" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<div class="page-h"><h1>記録</h1></div>
  <div class="card kpis"><div><b class="num">${all.done}<small class="muted" style="font-size:13px">/${all.total}</small></b><span>挑戦した問題</span></div><div><b class="num">${all.n ? all.acc + '%' : '—'}</b><span>正答率</span></div><div><b class="num">${streak()}日</b><span>連続学習</span></div></div>
  <div class="sec-h">章ごとの正答率（薄い色 = 挑戦した割合）</div>
  <div class="card">${G.chapters.map(c => {
    const s = summary(qsOf(c.n)), col = !s.n ? 'var(--field)' : s.acc >= 70 ? 'var(--green)' : s.acc >= 50 ? 'var(--gold)' : 'var(--red)';
    return `<button class="hbar tap" style="width:100%" data-a="ch" data-ch="${c.n}" data-go="1"><span class="lb">${c.emo} ${esc(c.title)}</span><span class="tr"><i style="width:${pct(s.done, s.total)}%;background:var(--accent-soft)"></i><i style="width:${pct(s.done, s.total) * s.acc / 100}%;background:${col}"></i></span><span class="v">${s.n ? s.acc + '%' : '—'}</span></button>`;
  }).join('')}</div>
  <div class="sec-h">この2週間に解いた問題数</div>
  <div class="card"><div class="days">${days.map(d => { const v = S.days[d] || 0; return `<div class="d" title="${d} ${v}問"><span class="tiny muted num">${v || ''}</span><i class="${v ? '' : 'z'}" style="height:${v / mx * 64}px"></i></div>`; }).join('')}</div>
    <div class="dlab">${days.map((d, i) => `<span>${i % 2 ? '' : Number(d.slice(8))}</span>`).join('')}</div></div>
  <div class="sec-h">設定</div>
  <div class="card">
    <div class="set-row"><span>受験日</span><input type="date" value="${S.exam}" data-k="exam" class="setin"></div>
    <div class="set-row"><span>1日の目標</span><select data-k="goal" class="setin">${[10, 15, 20, 30, 40, 50, 70].map(v => `<option value="${v}" ${S.goal === v ? 'selected' : ''}>${v}問</option>`).join('')}</select></div>
    <div class="set-row"><span>表示</span>${seg('theme', [['', '自動'], ['light', 'ライト'], ['dark', 'ダーク']])}</div>
  </div>
  <div class="sec-h">データ</div>
  <div class="card">
    <button class="set-row tap" style="width:100%" data-a="export"><span>バックアップを書き出す</span><span class="chev muted">${IC.chev}</span></button>
    <label class="set-row tap" style="cursor:pointer"><span>バックアップから読み込む</span><input type="file" accept="application/json" id="importFile" hidden><span class="chev muted">${IC.chev}</span></label>
    <button class="set-row tap" style="width:100%;color:var(--red)" data-a="reset"><span>学習記録をすべて消す</span></button>
  </div>
  <p class="tiny muted" style="margin:12px 4px">記録はこの端末のブラウザに保存されます。問題 ${G.qs.length}問 ・ 用語 ${G.cards.length}枚 ・ 図解 ${G.lessons.length}本。問題はUdemy講座の章立てに合わせたオリジナルです。</p>`;
}

// ---------- 問題セッション ----------
function startQuiz(qs, opt = {}) {
  if (!qs.length) return toast('解ける問題がありません');
  const list = opt.keep ? qs : shuffle(qs);
  Z = {
    kind: 'quiz', mode: opt.mode || 'practice', title: opt.title || '問題', ttl: opt.ttl,
    items: list.slice(0, opt.n || list.length).map(q => ({ q, perm: shuffle([0, 1, 2, 3]), a: null, was: !!(S.q[q.id] && S.q[q.id].w) })),
    i: 0, t0: Date.now(), limit: (opt.min || 0) * 60, flags: {}, done: false, showPal: false,
  };
  openOv();
}
function mockQs(n) {
  // 章ごとの問題数に比例して配分
  const out = [];
  G.chapters.forEach(c => { const qs = shuffle(qsOf(c.n)); out.push(...qs.slice(0, Math.round(n * qs.length / G.qs.length))); });
  const rest = shuffle(G.qs.filter(q => !out.includes(q)));
  while (out.length < n && rest.length) out.push(rest.pop());
  return shuffle(out).slice(0, n);
}
function startCards(cards, title) {
  if (!cards.length) return toast('カードがありません');
  Z = { kind: 'cards', title, items: cards, i: 0, flip: false, known: 0 };
  openOv();
}

function openOv() { $('#ov').hidden = false; document.body.classList.add('lock'); drawOv(); $('#ov').scrollTop = 0; tick(); }
function closeOv() { Z = null; $('#ov').hidden = true; document.body.classList.remove('lock'); clearInterval(timerId); render(); }
let timerId = 0;
function tick() {
  clearInterval(timerId);
  if (!Z || Z.mode !== 'mock' || Z.done) return;
  timerId = setInterval(() => {
    const left = Z.limit - Math.floor((Date.now() - Z.t0) / 1000);
    const el = $('#timer');
    if (el) { el.textContent = fmtSec(Math.max(0, left)); el.classList.toggle('low', left < 300); }
    if (left <= 0) { toast('時間切れ！採点します'); finishMock(); }
  }, 1000);
}
const fmtSec = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function drawOv() {
  if (!Z) return;
  $('#ov').innerHTML = `<div class="ov-in">${Z.kind === 'cards' ? ovCards() : Z.done ? ovResult() : ovQuiz()}</div>`;
}

function ovQuiz() {
  const it = Z.items[Z.i], q = it.q, mock = Z.mode === 'mock', answered = it.a !== null;
  const N = Z.items.length, c = chap(q.ch);
  const top = `<div class="ov-top"><button class="x" data-a="quit" aria-label="やめる">${IC.x}</button>
    <div class="grow"><div class="small bold num">${Z.i + 1} / ${N}　<span class="muted">${esc(Z.title)}</span></div><div class="prog mt8" style="margin-top:4px"><i style="width:${(Z.i + (answered && !mock ? 1 : 0)) / N * 100}%"></i></div></div>
    ${mock ? `<span id="timer" class="timer">${fmtSec(Math.max(0, Z.limit - Math.floor((Date.now() - Z.t0) / 1000)))}</span>` : ''}</div>`;
  const meta = `<div class="qmeta"><span>${c.emo} ${chLabel(q.ch)}</span>${mock ? '' : `<span>・ ${esc(q.lec)}</span>`}${!mock && it.was ? '<span class="pill ng">前に間違えた</span>' : ''}</div>`;
  const choices = it.perm.map((k, j) => {
    let cls = '';
    if (mock) cls = it.a === j ? 'sel' : '';
    else if (answered) cls = k === 0 ? 'right' : it.a === j ? 'wrong' : 'dim';
    return `<button class="choice ${cls}" data-a="pick" data-j="${j}"><span class="lt">${'ABCD'[j]}</span><span>${esc(q.o[k])}</span></button>`;
  }).join('');
  let below = '';
  if (mock) {
    const na = Z.items.filter(x => x.a !== null).length;
    below = `<div class="qnav"><button class="btn gray" data-a="prev" ${Z.i ? '' : 'disabled'}>← 前へ</button><button class="btn gray flag${Z.flags[Z.i] ? ' on' : ''}" data-a="flag">${IC.flag} 見直し</button>${Z.i < N - 1 ? `<button class="btn primary" data-a="next">次へ →</button>` : `<button class="btn green" data-a="submit">採点する</button>`}</div>
      <button class="btn soft block mt12" data-a="pal">${Z.showPal ? '問題一覧を閉じる' : `問題一覧（回答済み ${na}/${N}）`}</button>
      ${Z.showPal ? `<div class="palette">${Z.items.map((x, k) => `<button class="${x.a !== null ? 'a' : ''}${k === Z.i ? ' cur' : ''}${Z.flags[k] ? ' f' : ''}" data-a="jump" data-k="${k}">${k + 1}</button>`).join('')}</div><button class="btn green block mt12" data-a="submit">採点する</button>` : ''}`;
  } else if (answered) {
    const ok = it.perm[it.a] === 0, l = lessonOf(q.ch, q.lec) || G.keys[q.ch + ':' + q.lec];
    below = `<div class="fb"><div class="h ${ok ? 'ok' : 'ng'}">${ok ? '⭕ 正解！' : '❌ 不正解'}</div>
      ${ok ? '' : `<div class="small mt8"><b>正解：</b>${esc(q.o[0])}</div>`}
      <div class="exp">${esc(q.e)}</div>
      ${l ? `<button class="btn soft sm mt12" data-a="peek" data-ch="${q.ch}" data-lec="${esc(q.lec)}">📘 図解で確認する</button>` : ''}</div>
      <button class="btn primary block mt12" data-a="next">${Z.i < N - 1 ? '次の問題へ →' : '結果を見る'}</button>`;
  }
  return top + meta + `<div class="qtext">${esc(q.q)}</div><div class="choices">${choices}</div>` + below;
}

function finishMock() {
  if (!Z || Z.done) return;
  const by = {};
  let c = 0;
  for (const it of Z.items) {
    const ok = it.a !== null && it.perm[it.a] === 0;
    record(it.q, ok); if (ok) c++;
    const b = by[it.q.ch] || (by[it.q.ch] = [0, 0]); b[1]++; if (ok) b[0]++;
  }
  const sec = Math.min(Z.limit, Math.floor((Date.now() - Z.t0) / 1000));
  S.mocks.push({ d: today(), ttl: Z.ttl, n: Z.items.length, c, sec, by });
  save();
  Z.done = true; Z.by = by; Z.sec = sec;
  clearInterval(timerId); drawOv(); $('#ov').scrollTop = 0;
}

function ovResult() {
  const N = Z.items.length, okItems = Z.items.filter(it => it.a !== null && it.perm[it.a] === 0), c = okItems.length, p = pct(c, N);
  const wrong = Z.items.filter(it => !okItems.includes(it));
  const msg = p >= 85 ? 'すばらしい！この調子 🎉' : p >= 70 ? '合格ラインの目安クリア！' : p >= 50 ? 'あと少し！間違えた所を復習しよう' : '図解を読み直してから再挑戦しよう';
  return `<div class="ov-top"><button class="x" data-a="quit">${IC.x}</button><div class="grow bold">${esc(Z.title)} の結果</div></div>
  <div class="card result-top mt12"><div class="score num" style="color:${p >= 70 ? 'var(--green)' : 'var(--red)'}">${p}<small>%</small></div><div class="bold">${c} / ${N}問 正解</div><div class="small muted mt8">${msg}${Z.mode === 'mock' ? ` ・ ${Math.floor(Z.sec / 60)}分${Z.sec % 60}秒` : ''}</div></div>
  ${Z.by ? `<div class="sec-h">章ごとの結果</div><div class="card">${Object.keys(Z.by).map(Number).sort((a, b) => a - b).map(n => { const [k, m] = Z.by[n], q = pct(k, m); return `<div class="hbar"><span class="lb">${chap(n).emo} ${esc(chap(n).title)}</span><span class="tr"><i style="width:${q}%;background:${q >= 70 ? 'var(--green)' : q >= 50 ? 'var(--gold)' : 'var(--red)'}"></i></span><span class="v">${k}/${m}</span></div>`; }).join('')}</div>` : ''}
  ${wrong.length ? `<button class="btn primary block mt16" data-a="retryWrong">間違えた ${wrong.length}問 をもう一度</button>
    <div class="sec-h">間違えた問題（タップで解説）</div>
    <div class="card">${wrong.map(it => `<details class="rv"><summary>${esc(it.q.q)}</summary><div class="ans"><div><b style="color:var(--green)">正解：</b>${esc(it.q.o[0])}</div>${it.a !== null ? `<div class="muted">あなたの答え：${esc(it.q.o[it.perm[it.a]])}</div>` : '<div class="muted">未回答</div>'}<div class="mt8">${esc(it.q.e)}</div><div class="tiny muted mt8">${chLabel(it.q.ch)} ・ ${esc(it.q.lec)}</div></div></details>`).join('')}</div>`
    : '<div class="card empty mt16"><div class="ic">💯</div>全問正解！</div>'}
  <button class="btn gray block mt16" data-a="quit">閉じる</button>`;
}

function ovCards() {
  const N = Z.items.length;
  if (Z.i >= N) return `<div class="ov-top"><button class="x" data-a="quit">${IC.x}</button><div class="grow bold">${esc(Z.title)}</div></div>
    <div class="card result-top mt12"><div class="score num">${Z.known}<small>/${N}</small></div><div class="bold">枚 覚えた</div><div class="small muted mt8">「まだ」のカードは復習タブからもう一度めくれます</div></div>
    <button class="btn gray block mt16" data-a="quit">閉じる</button>`;
  const cd = Z.items[Z.i], c = chap(cd.ch);
  return `<div class="ov-top"><button class="x" data-a="quit">${IC.x}</button><div class="grow"><div class="small bold num">${Z.i + 1} / ${N}　<span class="muted">${esc(Z.title)}</span></div><div class="prog" style="margin-top:4px"><i style="width:${Z.i / N * 100}%"></i></div></div></div>
  <div class="qmeta"><span>${c.emo} ${chLabel(cd.ch)}</span>${cd.lec ? `<span>・ ${esc(cd.lec)}</span>` : ''}</div>
  <div class="flash${Z.flip ? ' flip' : ''}" data-a="flip"><div class="in">
    <div class="face"><div class="term">${esc(cd.f)}</div><div class="hint">タップでめくる</div></div>
    <div class="face back"><div class="small bold" style="color:var(--accent);margin-bottom:8px">${esc(cd.f)}</div><div class="desc">${esc(cd.b)}</div></div>
  </div></div>
  <div class="row2 mt16"><button class="btn danger" data-a="cardNo">まだ</button><button class="btn green" data-a="cardYes">覚えた</button></div>
  <p class="tiny muted" style="text-align:center">PCなら スペース=めくる ・ ←=まだ ・ →=覚えた</p>`;
}

function cardMark(k) {
  const cd = Z.items[Z.i];
  const s = S.cards[cd.id] || (S.cards[cd.id] = { k: false, n: 0 });
  s.k = k; s.n++;
  if (k) Z.known++;
  save();
  Z.i++; Z.flip = false; drawOv();
}

// ---------- シート（クイズ中に図解を見る） ----------
function openSheet(html) {
  $('#sheet').innerHTML = `<div class="grab"></div><div class="sh-top"><button class="btn gray sm" data-a="closeSheet">閉じる</button></div><div class="in">${html}</div>`;
  $('#sheet').hidden = false; $('#sheetBack').hidden = false; $('#sheet').scrollTop = 0;
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetBack').hidden = true; }

// ---------- 操作 ----------
const ACT = {
  tab: d => { V.tab = d.id; V.stack = []; render(); scrollTo(0, 0); },
  ch: d => { V.tab = 'course'; V.stack = [{ p: 'ch', ch: +d.ch }]; render(); scrollTo(0, 0); },
  lec: d => {
    V.tab = 'course';
    const ch = +d.ch;
    if (d.replace) V.stack.pop();
    const top = V.stack[V.stack.length - 1];
    if (!top || (top.p !== 'notes' && top.ch !== ch)) V.stack = [{ p: 'ch', ch }];
    V.stack.push({ p: 'lec', ch, lec: d.lec });
    render(); scrollTo(0, 0);
  },
  pop: () => { V.stack.pop(); render(); scrollTo(0, 0); },
  lecQuiz: d => startQuiz(qsOf(+d.ch, d.lec), { keep: true, title: d.lec }),
  chQuiz: d => startQuiz(qsOf(+d.ch), { title: chap(+d.ch).title }),
  chWrong: d => startQuiz(wrongList().filter(q => q.ch === +d.ch), { title: '間違えた問題' }),
  allWrong: () => startQuiz(wrongList(), { title: '間違えた問題' }),
  startDue: () => startQuiz(dueList(), { title: '今日の復習' }),
  random: () => startQuiz(G.qs, { n: 10, title: 'ランダム10問' }),
  weak: () => {
    // 正答率が低い章（未挑戦は50%扱い）から、まだ習得していない問題を優先
    const rank = G.chapters.map(c => { const s = summary(qsOf(c.n)); return { n: c.n, acc: s.n ? s.acc : 50 }; }).sort((a, b) => a.acc - b.acc);
    let pool = [];
    for (const r of rank) { pool.push(...shuffle(qsOf(r.n).filter(q => !S.q[q.id] || S.q[q.id].box < 4))); if (pool.length >= 10) break; }
    startQuiz(pool.slice(0, 10), { keep: true, title: '苦手つぶし' });
  },
  cardsAll: () => {
    const fresh = shuffle(G.cards.filter(c => !S.cards[c.id])), unk = shuffle(G.cards.filter(c => S.cards[c.id] && !S.cards[c.id].k));
    startCards([...unk, ...fresh].slice(0, 20), '用語カード');
  },
  cardsUnknown: () => startCards(shuffle(G.cards.filter(c => S.cards[c.id] && !S.cards[c.id].k)), 'まだの用語'),
  chCards: d => startCards(cardsOf(+d.ch), chap(+d.ch).title + 'の用語'),
  mock: d => {
    const m = MOCKS.find(x => x.id === d.id);
    if (!confirm(`${m.ttl}（${m.sub}）をはじめますか？\n途中でやめると記録されません。`)) return;
    startQuiz(mockQs(m.n), { mode: 'mock', title: m.ttl, ttl: m.ttl, min: m.min, keep: true });
  },
  pick: d => {
    const it = Z.items[Z.i], j = +d.j;
    if (Z.mode === 'mock') { it.a = j; drawOv(); return; }
    if (it.a !== null) return;
    it.a = j; record(it.q, it.perm[j] === 0); save(); drawOv();
  },
  next: () => {
    if (Z.mode !== 'mock' && Z.i >= Z.items.length - 1) { Z.done = true; drawOv(); $('#ov').scrollTop = 0; return; }
    Z.i = Math.min(Z.items.length - 1, Z.i + 1); drawOv(); $('#ov').scrollTop = 0;
  },
  prev: () => { Z.i = Math.max(0, Z.i - 1); drawOv(); $('#ov').scrollTop = 0; },
  jump: d => { Z.i = +d.k; drawOv(); $('#ov').scrollTop = 0; },
  pal: () => { Z.showPal = !Z.showPal; drawOv(); },
  flag: () => { Z.flags[Z.i] = !Z.flags[Z.i]; drawOv(); },
  submit: () => {
    const na = Z.items.filter(x => x.a === null).length;
    if (na && !confirm(`未回答が ${na}問 あります。採点しますか？`)) return;
    finishMock();
  },
  retryWrong: () => startQuiz(Z.items.filter(it => !(it.a !== null && it.perm[it.a] === 0)).map(it => it.q), { title: 'もう一度' }),
  quit: () => {
    if (Z && Z.kind === 'quiz' && Z.mode === 'mock' && !Z.done && !confirm('模試をやめますか？（記録されません）')) return;
    closeOv();
  },
  peek: d => openSheet(`<div class="card lesson">${lessonBody(+d.ch, d.lec)}</div>`),
  notes: d => { V.tab = 'course'; V.stack.push({ p: 'notes', ch: +d.ch || 0 }); render(); scrollTo(0, 0); },
  closeSheet,
  flip: () => { Z.flip = !Z.flip; document.querySelector('.flash').classList.toggle('flip', Z.flip); },
  cardYes: () => cardMark(true),
  cardNo: () => cardMark(false),
  set: d => { S[d.k] = d.v; save(); applyTheme(); render(); },
  export: () => {
    const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gtore-backup-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  reset: () => {
    if (!confirm('解いた記録・カード・模試の結果をすべて消します。よろしいですか？')) return;
    const keep = { exam: S.exam, goal: S.goal, theme: S.theme };
    S = Object.assign(blank(), keep); save(); render(); toast('記録を消しました');
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const f = ACT[el.dataset.a];
  if (f) { e.preventDefault(); f(el.dataset, el); }
});
$('#sheetBack').addEventListener('click', closeSheet);
document.addEventListener('change', e => {
  const el = e.target;
  if (el.classList.contains('setin')) { S[el.dataset.k] = el.dataset.k === 'goal' ? +el.value : el.value; save(); render(); toast('保存しました'); }
  if (el.id === 'importFile' && el.files[0]) {
    el.files[0].text().then(t => {
      const s = JSON.parse(t);
      if (!s || s.v !== 1) throw new Error('bad');
      S = Object.assign(blank(), s); save(); applyTheme(); render(); toast('読み込みました');
    }).catch(() => toast('このファイルは読み込めません'));
  }
});
document.addEventListener('keydown', e => {
  if (!Z || e.target.matches('input,select,textarea')) return;
  if (!$('#sheet').hidden) { if (e.key === 'Escape') closeSheet(); return; }
  if (Z.kind === 'cards' && Z.i < Z.items.length) {
    if (e.key === ' ') { e.preventDefault(); ACT.flip(); }
    else if (e.key === 'ArrowRight') cardMark(true);
    else if (e.key === 'ArrowLeft') cardMark(false);
    return;
  }
  if (Z.kind !== 'quiz' || Z.done) return;
  const n = '1234'.indexOf(e.key) + 1 || 'abcd'.indexOf(e.key.toLowerCase()) + 1;
  if (n) ACT.pick({ j: n - 1 });
  else if (e.key === 'Enter' && (Z.mode === 'mock' || Z.items[Z.i].a !== null)) ACT.next();
  else if (e.key === 'ArrowRight' && Z.mode === 'mock') ACT.next();
  else if (e.key === 'ArrowLeft' && Z.mode === 'mock') ACT.prev();
});

let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2000); }
function applyTheme() { if (S.theme) document.documentElement.dataset.theme = S.theme; else delete document.documentElement.dataset.theme; }

applyTheme();
render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
