// Salon-first cut. One scene per voice line; durations are retimed from the voice-over.
const D = window.DUR || {miss:4.0, cats:3.6, brand:2.2, discover:4.6, book:5.0, control:6.0, extra:5.6, remind:3.6, offer:4.2, cta:4.4};
const ORDER = ['miss','cats','brand','discover','book','control','extra','remind','offer','cta'];
const T = {}; let acc = 0; for (const k of ORDER) { T[k] = [acc, acc + D[k]]; acc += D[k]; } window.TOTAL = acc; window.T = T;
const $ = id => document.getElementById(id);
const clamp = (x,a=0,b=1) => Math.max(a, Math.min(b, x));
const out = x => 1 - Math.pow(1 - clamp(x), 3);
const win = (t,a,b,f=.3) => clamp(Math.min((t-a)/f, (b-t)/f));
const prog = (t,a,d) => out((t-a)/d);
const set = (el,o,ty=0,sc=1) => { el.style.opacity = o; el.style.transform = `translateY(${ty}px) scale(${sc})`; };
const K = 664/390; // shot css px → screen px
const at = (k,f) => T[k][0] + f*(T[k][1]-T[k][0]);
// [image, scene, from, to]
const SEQ = [
  ['c01-home','discover',0,.3],['c02-categories','discover',.3,.55],['c07-nails','discover',.55,1.001],
  ['c08-service','book',0,.25],['c09-slot','book',.25,.5],['c10-summary','book',.5,.72],['c11-confirmed','book',.72,1.001],
  ['p02-calendar','control',0,.42],['p03-services','control',.42,.62],['p04-hours','control',.62,.78],['p05-team','control',.78,1.001],
  ['p06-newres','extra',0,.36],['c07-nails','extra',.36,.62],['p08-analytics','extra',.62,1.001],
];
const segs = SEQ.map(([id,k,a,b]) => [id, at(k,a), at(k,b)]);
const TAPS = [[at('discover',.86),137,555],[at('book',.12),195,419],[at('book',.37),73,388],[at('book',.6),195,422]];
const FEAT = {
  control: [['الأجندة',0,.42],['الخدمات والأسوام',.42,.62],['أوقات الخدمة',.62,.78],['الفريق',.78,1.01]],
  extra: [['ريزرفاسيونات التليفون',0,.36],['صفحة صالونك',.36,.62],['مداخيل الشهر',.62,1.01]],
};
const CHIP = i => at('cats',0) + .27*D.cats + (i-1)*.125*D.cats;
// sound effects, read by the audio builder: [time, file, gain dB]
window.CUES = [
  [T.miss[0]+.05,'ring',-11], [at('miss',.7),'missed',-9],
  ...[1,2,3,4,5].map(i => [CHIP(i),'pop',-14]),
  [T.brand[0]-.3,'whoosh',-10], [T.brand[0]+.05,'shimmer',-12],
  [T.discover[0]-.1,'whoosh',-14],
  ...segs.slice(1).filter(s => s[1] > T.discover[0]+.1).map(s => [s[1]-.12,'swipe',-18]),
  ...TAPS.map(([tt]) => [tt,'tap',-10]),
  [at('book',.72),'success',-10],
  [at('extra',.62)+.35,'cash',-11],
  [T.remind[0]+.3,'ding',-8],
  [T.offer[0]-.2,'whoosh',-13], [T.offer[0]+1.2,'pop',-12],
  [T.cta[0]-.1,'shimmer',-12],
];
function render(t) {
  $('pat').style.transform = `translate(${-t*6}px,${-t*10}px)`;
  // 01 missed calls
  const [m0,m1] = T.miss; $('miss').style.opacity = win(t,m0,m1);
  $('ring').style.transform = `rotate(${t<at('miss',.7) ? Math.sin(t*40)*6 : 0}deg)`;
  $('missed').textContent = String(clamp(1+Math.floor(Math.max(0,t-m0)/.45),1,7));
  set($('m1'), prog(t,m0+.1,.4), (1-prog(t,m0+.1,.4))*40); const m2s = m0+.68*(m1-m0); set($('m2'), prog(t,m2s,.4), 0, .9+.1*prog(t,m2s,.4));
  // 02 salon question + categories
  $('hook').style.opacity = win(t, ...T.cats);
  set($('h1a'), prog(t, T.cats[0]+.05, .45), (1-prog(t,T.cats[0]+.05,.45))*40);
  for (let i=1;i<=5;i++) { const s = CHIP(i); set($('k'+i), prog(t,s,.3), (1-prog(t,s,.3))*30, .9+.1*prog(t,s,.3)); }
  // 03 brand
  $('brand').style.opacity = win(t, ...T.brand); $('brand').style.transform = `scale(${.93+.07*prog(t,T.brand[0],.7)})`;
  // 04–07 phone
  const inP = t >= T.discover[0] && t < T.extra[1];
  $('sp').style.opacity = inP ? win(t, T.discover[0], T.extra[1], .35) : 0;
  document.querySelector('#sp .phone').style.transform = `translateY(${(1-prog(t,T.discover[0],.6))*120}px)`;
  for (const img of document.querySelectorAll('#screen img')) { img.style.opacity = 0; img.style.zIndex = 1; }
  for (const [id,a,b] of segs) { const el = $(id); if (t>=a && t<b) { el.style.opacity = 1; el.style.zIndex = 2; } else if (t>=b && t<b+.2 && el.style.zIndex != 2) { el.style.opacity = 1-(t-b)/.2; } }
  const tap = $('tap'); tap.style.opacity = 0;
  for (const [tt,x,y] of TAPS) { const d = t-tt; if (d>=0 && d<.55) { tap.style.left = x*K+'px'; tap.style.top = y*K+'px'; tap.style.opacity = 1-d/.55; tap.style.transform = `scale(${.5+d*1.5})`; } }
  const hl = $('hl'); hl.style.opacity = 0; const pulse = s => .55 + .45*Math.abs(Math.sin((t-s)*3.2));
  const box = (s,[x,y,w,h]) => Object.assign(hl.style, {left:x*K+'px', top:y*K+'px', width:w*K+'px', height:h*K+'px', opacity: pulse(s)});
  if (t >= at('control',0)+.35 && t < at('control',.42)) box(at('control',0), [14,500,362,56]);
  if (t >= at('extra',.62)+.3 && t < at('extra',1)) box(at('extra',.62), [199,305,179,104]);
  // captions
  const caps = {
    discover: 'كليوناتك يلقاو صالونك<br><span class="gold">ويريزرفيو وحدهم، ليل ونهار</span>',
    book: t < at('book',.72) ? 'يختارو الخدمة والوقت…<br><span class="gold">في ثلاثة كليكات</span>' : '<span class="gold">تمّ!</span> الموعد محجوز',
    control: 'وإنتي <span class="gold">تتحكّم في كلّ شي</span>',
    extra: 'والكلّ <span class="gold">من تليفونك</span>',
  };
  const cap = $('cap'); let html = '', co = 0;
  for (const k in caps) { const [a,b] = T[k]; if (t>=a && t<b) { html = caps[k]; co = win(t,a,b,.25); } }
  if (cap.dataset.h !== html) { cap.innerHTML = html; cap.dataset.h = html; } cap.style.opacity = co;
  const feat = $('feat'); let fh = '', fo = 0;
  for (const k in FEAT) { const [a,b] = T[k]; if (t>=a && t<b) { fo = win(t,a,b,.25); fh = FEAT[k].map(([w,f0,f1]) => `<span class="${t>=at(k,f0)&&t<at(k,f1)?'on':''}">${w}</span>`).join(''); } }
  if (feat.dataset.h !== fh) { feat.innerHTML = fh; feat.dataset.h = fh; } feat.style.opacity = fo;
  // 08 reminder
  $('remind').style.opacity = win(t, ...T.remind); $('notif').style.transform = `translateY(${(1-prog(t,T.remind[0]+.15,.6))*-260}px)`;
  // 09 offer
  $('offer').style.opacity = win(t, ...T.offer);
  set($('o1'), prog(t,T.offer[0]+.1,.5), 0, .85+.15*prog(t,T.offer[0]+.1,.5)); set($('o2'), prog(t,T.offer[0]+1.2,.5), (1-prog(t,T.offer[0]+1.2,.5))*40);
  // 10 CTA
  $('cta').style.opacity = win(t, T.cta[0], T.cta[1]+5, .35);
  $('url').style.transform = `scale(${1+.04*Math.sin(Math.max(0,t-T.cta[0])*4)})`;
}
window.render = render; render(0);
