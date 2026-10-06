// FullRep „Studie erklärt" — Renderer.  node tools/social/studie-erklaert/engine.mjs <reel> [--stand]
// Stimme (ElevenLabs Turbo v2.5 „George" über fal) → Wortzeiten → Frames (Chromium, setFrame(t))
// → Musik + Mix → fertig/fullrep-studie-<reel>.mp4. Drehbücher in reels.mjs, Hintergrund README.md.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HIER = dirname(fileURLToPath(import.meta.url));
const kenn = (txt) => createHash('sha1').update(txt).digest('hex').slice(0, 8);
import { REELS } from './reels.mjs';

const NAME = process.argv[2]; const R = REELS[NAME];
if (!R) { console.error('Reel unbekannt. Bekannt:', Object.keys(REELS).join(', ')); process.exit(1); }
const STAND = process.argv.includes('--stand');
const F = join(HIER, '../../../node_modules/ffmpeg-static/ffmpeg');
// Marken: Pfade, Schriften, Farben. FullRep ist die Vorlage, deren Farbcodes im HTML stehen;
// andere Marken tauschen sie per `farben` aus (alt → neu).
const MARKEN = {
  fullrep: () => { const p = process.env.FULLREP_PFAD || '/home/user/mypeak'; const fi = (w) => `${p}/node_modules/@fontsource/inter/files/inter-latin-${w}-normal.woff2`;
    return { name: 'FullRep', icon: `${p}/public/icon-512.png`, badges: `${p}/scripts/badges`, musik: join(HIER, '../musik/fullrep-bett.mp3'),
      schrift: { 400: fi(400), 700: fi(700), 900: fi(900), A: `${p}/scripts/schriften/anton.woff2` }, farben: {} }; },
  swaply: () => { const p = process.env.SWAPLY_PFAD || '/home/user/swaply'; const f = (n) => `${p}/src/fonts/${n}.woff2`;
    return { name: 'Swaply', icon: `${p}/assets/icon-only.png`, badges: `${p}/scripts/badges`, musik: join(HIER, '../musik/swaply-bett.mp3'),
      schrift: { 400: f('plex-sans-latin-400'), 700: f('plex-sans-latin-600'), 900: f('space-grotesk-latin'), A: f('space-grotesk-latin') },
      // Swaply-Dunkelmodus aus src/index.css: --accent #9be3b4, --bg #0b0c0e, --bg-elev #14161a, --line #23262b
      farben: { '#fbbf24': '#9be3b4', '#fff8e7': '#f2f2ee', '#fde68a': '#c9f2d6', '#5c4a1c': '#2d5a40', '#1d1a14': '#0f1a14', '#141311': '#14161a',
        '#2a2722': '#23262b', '#1f1a0c': '#12261b', '#2c2924': '#262a2e', '#6b645a': '#56605a', '#4a4640': '#40464a', '#a8a29e': '#9aa39d', '#e7e5e4': '#e2e6e3' } }; },
};
const MK = (MARKEN[R.marke || 'fullrep'])();
const MUSIK = MK.musik;
const FPS = 30, LUECKE = 0.45, VOR = 0.35;
const D = join(HIER, 'out', NAME); mkdirSync(D, { recursive: true });
mkdirSync(join(HIER, 'fertig'), { recursive: true });
const ZIEL = join(HIER, "fertig", `${R.marke || "fullrep"}-studie-${NAME}.mp4`);
if (!process.env.FAL_KEY) { console.error('FAL_KEY fehlt (Stimme läuft über fal).'); process.exit(1); }
const b64 = (p) => readFileSync(p).toString('base64');
const sh = (c) => execFileSync('sh', ['-c', c], { encoding: 'utf8' });

// --- 1. Stimme (nur was fehlt): ElevenLabs Turbo v2.5 „George" über fal, 0,05 $ je 1000 Zeichen (Josef, 06.10.) ---
const STIMME = 'George';
const voDatei = (s) => `${D}/vo-${STIMME}-turbo-${kenn(s.vo)}.mp3`;
await Promise.all(R.szenen.map(async (s, i) => {
  const ziel = voDatei(s); if (existsSync(ziel)) return;
  const r = await fetch('https://fal.run/fal-ai/elevenlabs/tts/turbo-v2.5', { method: 'POST',
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: s.vo, voice: STIMME, stability: 0.5, similarity_boost: 0.75, language_code: 'de' }) });
  if (!r.ok) throw new Error(`Stimme ${i}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json(); const url = d?.audio?.url ?? d?.url;
  writeFileSync(ziel, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(`  Stimme ${i}: ${s.vo.length} Zeichen`);
}));

// --- 2. Kürzen, beschleunigen, Phrasen/Wörter zeitlich verteilen ---
const szenen = []; let t0 = VOR;
R.szenen.forEach((s, i) => {
  const vs = `${D}/vs-${i}.wav`;
  execFileSync(F, ['-y', '-loglevel', 'error', '-i', voDatei(s), '-af', `silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.3:stop_threshold=-42dB:stop_silence=0.25,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,highpass=f=70,equalizer=f=4000:t=q:w=1.2:g=3`, '-ar', '48000', '-ac', '1', vs]);
  const log = sh(`${F} -i ${vs} -af silencedetect=n=-38dB:d=0.14 -f null - 2>&1`);
  const dauer = log.match(/Duration: (\d+):(\d+):([\d.]+)/).slice(1).reduce((a, x, j) => a + Number(x) * [3600, 60, 1][j], 0);
  const st = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const en = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  const abschn = []; let a = 0;
  st.forEach((x, j) => { if (x - a > 0.08) abschn.push([a, x]); a = en[j] ?? dauer; });
  if (dauer - a > 0.08) abschn.push([a, dauer]);
  const phrasen = s.vo.match(/[^.,?:]+[.,?:]?/g).map((p) => p.trim()).filter(Boolean);
  let ber;
  if (abschn.length === phrasen.length) ber = abschn;
  else { const g = phrasen.reduce((x, p) => x + p.length, 0); let c = 0; const sa = abschn[0][0], se = abschn.at(-1)[1];
    ber = phrasen.map((p) => { const v = sa + (se - sa) * c / g; c += p.length; return [v, sa + (se - sa) * c / g]; }); }
  const woerter = [];
  phrasen.forEach((p, pi) => { const ws = p.split(/\s+/); const g = ws.reduce((x, w) => x + w.length + 1, 0); let c = 0; const [v, b] = ber[pi];
    ws.forEach((w) => { const s0 = v + (b - v) * c / g; c += w.length + 1; woerter.push({ w, s: t0 + s0, e: t0 + v + (b - v) * c / g, p: pi }); }); });
  szenen.push({ ...s, i, start: i === 0 ? 0 : t0 - LUECKE / 2, vo: t0, ende: t0 + dauer + LUECKE / 2, woerter, phrasen: ber.map(([v, b]) => [t0 + v, t0 + b]) });
  console.log(`  Szene ${i}: ${dauer.toFixed(2)} s, ${abschn.length}/${phrasen.length}`);
  t0 += dauer + LUECKE;
});
szenen.at(-1).ende += 1.6;
const G = szenen.at(-1).ende;
console.log(`  Gesamt ${G.toFixed(2)} s`);

// --- 2b. KI-Clip als Einzelbilder (Frame = Funktion der Zeit, kein <video>) ---
let CLIP = [];
if (R.clip) {
  const cd = `${D}/clip`; mkdirSync(cd, { recursive: true });
  for (const f of readdirSync(cd)) unlinkSync(`${cd}/${f}`);
  execFileSync(F, ['-y', '-loglevel', 'error', '-i', resolve(HIER, R.clip), '-vf', 'scale=540:-2', '-q:v', '4', `${cd}/%03d.jpg`]);
  CLIP = readdirSync(cd).sort().map((f) => 'data:image/jpeg;base64,' + b64(`${cd}/${f}`));
  console.log(`  Clip: ${CLIP.length} Bilder`);
}

// --- 3. Seite ---
const fi = (w) => b64(MK.schrift[w]);
const icon = b64(MK.icon);
let html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:I;font-weight:400;src:url(data:font/woff2;base64,${fi(400)})}
@font-face{font-family:I;font-weight:700;src:url(data:font/woff2;base64,${fi(700)})}
@font-face{font-family:I;font-weight:800 900;src:url(data:font/woff2;base64,${fi(900)})}
@font-face{font-family:A;font-weight:300 700;src:url(data:font/woff2;base64,${fi('A')})}
*{box-sizing:border-box}
body{margin:0;width:1080px;height:1920px;overflow:hidden;font-family:I;color:#fff8e7;background:radial-gradient(110% 60% at 15% 0%,#1d1a14 0%,#0b0a09 55%,#070707 100%)}
#k{position:absolute;left:72px;top:150px;font-weight:700;letter-spacing:.32em;font-size:24px;color:#fbbf24}
#marke{position:absolute;right:72px;top:144px;display:flex;align-items:center;gap:12px;font-weight:700;font-size:26px;color:#a8a29e}
#marke img{width:40px;height:40px;border-radius:10px}
#titel{position:absolute;left:72px;top:200px;width:900px;font-weight:900;font-size:78px;line-height:1.04;letter-spacing:-.025em}
#titel em{font-style:normal;color:#fbbf24}
#buehne{position:absolute;left:0;top:520px;width:1080px;height:780px}
#cap{position:absolute;left:72px;top:1340px;width:820px;font-weight:700;font-size:50px;line-height:1.18;letter-spacing:-.01em}
#cap span{color:#4a4640}#cap span.g{color:#fff8e7}#cap span.j{color:#fbbf24}
#fort{position:absolute;left:0;top:0;height:6px;background:#fbbf24}
.stempel{position:absolute;border:7px solid #ef4444;color:#ef4444;font-family:A;font-weight:700;font-size:84px;line-height:1;padding:10px 26px 6px;letter-spacing:.04em;border-radius:12px;text-align:center;background:rgba(11,10,9,.92)}
.zahlen{position:absolute;left:72px;display:flex;gap:70px}
.zahlen div{font-family:A;font-weight:700;font-size:120px;color:#fbbf24;line-height:1}
.zahlen small{display:block;font-family:I;font-weight:700;font-size:26px;color:#a8a29e;letter-spacing:.05em;margin-top:8px}
.karte{position:absolute;left:72px;width:820px;min-height:150px;border-radius:26px;background:#141311;border:2px solid #2a2722;padding:26px 34px}
.karte b{display:block;font-size:26px;letter-spacing:.16em;color:#fbbf24}
.karte span{display:block;font-size:44px;font-weight:700;margin-top:10px;line-height:1.15}
.karte.sieg{border-color:#fbbf24;background:#1f1a0c}
.karte.aus{opacity:.45}
.label{position:absolute;font-weight:700;font-size:30px;color:#a8a29e;letter-spacing:.04em}
.wert{position:absolute;font-family:A;font-weight:700;font-size:96px;color:#fff8e7;line-height:1}
.band{position:absolute;left:72px;width:820px;border-radius:26px;background:#fbbf24;color:#0b0a09;padding:30px 36px;font-weight:900;font-size:52px;line-height:1.1}
.schritt{position:absolute;left:72px;width:840px;display:flex;gap:30px;align-items:center}
.schritt i{font-style:normal;font-family:A;font-weight:700;font-size:88px;color:#fbbf24;width:70px;flex:none}
.schritt span{font-size:50px;font-weight:700;line-height:1.12}
.end{position:absolute;left:0;width:1080px;top:-520px;height:1920px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:260px;text-align:center}
.end img.i{width:260px;height:260px;border-radius:58px;box-shadow:0 0 0 3px rgba(251,191,36,.5),0 30px 90px rgba(0,0,0,.6)}
.end h1{font-weight:900;font-size:96px;margin:46px 0 0;letter-spacing:-.02em}
.end p{font-size:44px;color:#e7e5e4;margin:22px 0 0;font-weight:700;line-height:1.25}
.end .b{display:flex;gap:26px;margin-top:56px}.end .b img{height:112px}
.tag{position:absolute;background:#fbbf24;color:#0b0a09;font-weight:900;font-size:30px;padding:8px 18px;border-radius:12px}
canvas{position:absolute;left:0;top:0}
</style></head><body>
<img id="hg" style="position:absolute;left:0;top:0;width:1080px;height:1920px;object-fit:cover;opacity:0"><div id="hgv" style="position:absolute;inset:0;opacity:0;background:linear-gradient(180deg,rgba(7,7,7,.92) 0%,rgba(7,7,7,.35) 30%,rgba(7,7,7,.15) 55%,rgba(7,7,7,.85) 72%,rgba(7,7,7,.95) 100%)"></div><div id="fort"></div><div id="k"></div><div id="marke"><img src="data:image/png;base64,${icon}">${MK.name}</div>
<div id="titel"></div><div id="buehne"><canvas id="cv" width="1080" height="780"></canvas><div id="ov"></div></div><div id="cap"></div>
<script>
const S=${JSON.stringify(szenen)}, G=${G}, CLIP=${JSON.stringify(CLIP)}, CFPS=24;
const ICON='data:image/png;base64,${icon}', IOS='data:image/png;base64,${b64(`${MK.badges}/appstore-en.png`)}', GP='data:image/png;base64,${b64(`${MK.badges}/googleplay-en.png`)}', MARKE='${MK.name}';
const cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), ease=x=>1-Math.pow(1-cl(x),3);
function dot(c,x,y,r,col){c.beginPath();c.arc(x,y,r,0,7);c.fillStyle=col;c.fill()}
const AMB='#fbbf24', DIM='#2c2924', MID='#6b645a', ROT='#ef4444', HELL='#fde68a';
function setFrame(t){
  const sz=S.find(s=>t>=s.start&&t<s.ende)||S[S.length-1], v=sz.v, end=v.typ==='end';
  const P=i=>{const f=Math.floor(i),r=i-f;const a=sz.phrasen[f]?sz.phrasen[f][0]:99;return a+r*((sz.phrasen[f]||[0,a+1])[1]-a)};
  document.getElementById('fort').style.width=(t/G*1080)+'px';
  const ein=sz.i===0?1:ease((t-sz.start)/.4);
  const k=document.getElementById('k'), ti=document.getElementById('titel');
  k.textContent=sz.k; ti.innerHTML=sz.titel;
  for(const el of [k,ti]){el.style.opacity=ein;el.style.transform='translateY('+(1-ein)*30+'px)'}
  document.getElementById('marke').style.opacity=end?0:1;
  const cap=document.getElementById('cap'); let pi=0;
  sz.phrasen.forEach((p,i)=>{if(t>=p[0]-.05)pi=i});
  cap.innerHTML=end?'':sz.woerter.filter(w=>w.p===pi).map(w=>'<span class="'+(t>=w.e?'g':t>=w.s?'j':'')+'">'+w.w+'</span>').join(' ');
  const c=document.getElementById('cv').getContext('2d'); c.clearRect(0,0,1080,780);
  let h='';
  const auf=(p,d=.4)=>ease((t-P(p))/d);
  {const hg=document.getElementById('hg'),hv=document.getElementById('hgv');
   if(v.typ==='clip'&&CLIP.length){const lt=Math.max(0,t-sz.start)*(v.tempo||1);const i=Math.min(CLIP.length-1,Math.floor(lt*CFPS)+(v.ab||0));if(hg.dataset.i!=i){hg.src=CLIP[i];hg.dataset.i=i}const a=sz.i===0?1:ease((t-sz.start)/.4);hg.style.opacity=a;hv.style.opacity=a}
   else{hg.style.opacity=0;hv.style.opacity=0}}
  if(v.typ==='clip'&&v.tags)v.tags.forEach(([txt,p,x,y])=>{h+='<div class="tag" style="left:'+x+'px;top:'+y+'px;font-size:40px;opacity:'+cl((t-P(p))/.3)+'">'+txt+'</div>'});
  if(v.typ==='uhr'){const cx=540,cy=380,R=270;
    for(let r=60;r<=R;r+=26){const n=Math.round(2*Math.PI*r/26);for(let i=0;i<n;i++){const a=i/n*2*Math.PI;dot(c,cx+Math.cos(a)*r,cy+Math.sin(a)*r,5.5,r>R-30?MID:DIM)}}
    const ang=-Math.PI/2+t*2.2; for(let r=0;r<R-40;r+=22)dot(c,cx+Math.cos(ang)*r,cy+Math.sin(ang)*r,8,AMB);
    for(let i=-2;i<=2;i++)dot(c,cx+i*24,cy-R-40,9,MID);
    if(v.mitte)h+='<div class="wert" style="left:0;width:1080px;text-align:center;top:'+(cy+90)+'px;font-size:110px;color:'+AMB+'">'+v.mitte+'</div>';}
  if(v.typ==='tacho'){const cx=540,cy=560,R=330;
    for(let r=150;r<=R;r+=30){const n=Math.round(Math.PI*r/30);for(let i=0;i<=n;i++){const a=Math.PI+i/n*Math.PI;const rot=i/n>.8;dot(c,cx+Math.cos(a)*r,cy+Math.sin(a)*r,7,r>R-40?(rot?ROT:MID):DIM)}}
    const q=.5+.45*Math.sin(Math.min(t,2.6)*1.6-0.6), ang=Math.PI+cl(q,0,1)*Math.PI*.98;
    for(let r=0;r<R-50;r+=24)dot(c,cx+Math.cos(ang)*r,cy+Math.sin(ang)*r,9,AMB); dot(c,cx,cy,22,AMB);}
  if(v.typ==='zahlen'){
    h+='<div class="zahlen" style="top:0;opacity:'+auf(v.zp)+'">'+v.zahlen.map(([w,l])=>'<div>'+w+'<small>'+l+'</small></div>').join('')+'</div>';
    v.karten.forEach(([b,s,p],i)=>{const a=auf(p);h+='<div class="karte" style="top:'+(250+i*190)+'px;opacity:'+a+';transform:translateX('+(1-a)*-60+'px)"><b>'+b+'</b><span>'+s+'</span></div>'});}
  if(v.typ==='punkte'){
    v.reihen.forEach((r,ri)=>{const y=120+ri*260, f=cl((t-P(r.p))/1.1)*r.n;
      for(let i=0;i<r.n;i++){dot(c,72+(i%14)*58+20,y+Math.floor(i/14)*58,19,i<f?AMB:DIM)}
      h+='<div class="label" style="left:72px;top:'+(y-95)+'px">'+r.label+'</div>';
      const op=cl((t-P(r.p)-1)/.3); if(r.n<=12)h+='<div class="wert" style="left:'+(72+r.n*58+30)+'px;top:'+(y-36)+'px;opacity:'+op+'">'+r.wert+'</div>';
      else h+='<div class="wert" style="left:72px;top:'+(y+Math.ceil(r.n/14)*58+20)+'px;font-size:84px;opacity:'+op+'">'+r.wert+'</div>'});
    if(v.legende)h+='<div class="label" style="right:150px;top:20px;font-size:24px">'+v.legende+'</div>';}
  if(v.typ==='balken'){
    v.reihen.forEach((r,ri)=>{const y=40+ri*190, a=auf(r.p,.9);
      h+='<div class="label" style="left:72px;top:'+y+'px;opacity:'+cl(a*3)+'">'+r.label+'</div>';
      h+='<div style="position:absolute;left:72px;top:'+(y+50)+'px;width:540px;height:56px;border-radius:14px;background:'+DIM+';opacity:'+cl(a*3)+'"><div style="height:100%;border-radius:14px;width:'+(r.anteil*a*100)+'%;background:'+AMB+'"></div></div>';
      h+='<div class="wert" style="left:640px;top:'+(y+(r.wert.length>8?48:38))+'px;font-size:'+(r.wert.length>8?46:80)+'px;opacity:'+cl((a-.6)*3)+';color:'+(r.anteil>0?'#fff8e7':MID)+'">'+r.wert+'</div>'});}
  if(v.typ==='treppe'){const f=cl((t-P(v.p))/1.2)*v.bis;
    for(let i=0;i<10;i++){const x=110+i*82;for(let j=0;j<=i;j++)dot(c,x,560-j*44,16,i<f?(i>=7?ROT:AMB):DIM)}
    h+='<div class="label" style="left:72px;top:620px">ANSTRENGUNG</div><div class="wert" style="left:72px;top:670px;opacity:'+cl((t-P(v.p)-1)/.3)+'">'+v.wert+'</div>';}
  if(v.typ==='schritte'){
    v.schritte.forEach(([txt,p],i)=>{const a=auf(p,.35);h+='<div class="schritt" style="top:'+(30+i*160)+'px;opacity:'+a+';transform:translateX('+(1-a)*-50+'px)"><i>'+(i+1)+'</i><span>'+txt+'</span></div>'});
    if(v.ablauf){const A=v.ablauf,a=cl((t-P(A.p))/1.4),gw=(1080-160)/A.runden-12,wh=gw*A.hart/(A.hart+A.pause);
      for(let r=0;r<A.runden;r++){const x=80+r*(gw+12),sh=cl(a*A.runden-r)>0;c.fillStyle=sh?AMB:DIM;c.fillRect(x,600,wh-3,90);c.fillStyle=sh?'#5c4a1c':DIM;c.fillRect(x+wh,600,gw-wh,90)}}}
  if(v.typ==='verteilung'){
    h+='<div class="label" style="left:72px;top:0">GRUPPE 1</div>';const a=cl((t-P(v.p))/1.2)*10;
    for(let i=0;i<10;i++)dot(c,110+i*86,110,32,i<a?(i<8?HELL:ROT):DIM);
    const op=cl((t-P(v.p)-1)/.3);
    h+='<div class="wert" style="left:72px;top:170px;font-size:80px;opacity:'+op+';color:#fde68a">80 % locker</div><div class="label" style="left:740px;top:190px;opacity:'+op+';color:'+ROT+'">REST HART</div>';
    const [b,s,p]=v.karte,k2=auf(p);h+='<div class="karte" style="top:330px;opacity:'+k2+';transform:translateX('+(1-k2)*-60+'px)"><b>'+b+'</b><span>'+s+'</span></div>';}
  if(v.typ==='sieger'){
    v.karten.forEach(([b,s,sieg],i)=>{const a=auf(v.p+(i?0.5:0));h+='<div class="karte '+(sieg?'sieg':'aus')+'" style="top:'+(20+i*200)+'px;opacity:'+a*(sieg?1:.5)+';transform:translateX('+(1-a)*-60+'px)"><b>'+b+'</b><span>'+(sieg?'✓ ':'')+s+'</span></div>'});}
  if(v.typ==='kalender'){const TG=['MO','DI','MI','DO','FR','SA','SO'];
    v.reihen.forEach((r,ri)=>{const y=v.reihen.length===1?260:80+ri*280, a=auf(r.p);
      if(r.label)h+='<div class="label" style="left:72px;top:'+(y-80)+'px;opacity:'+a+'">'+r.label+'</div>';
      TG.forEach((d,i)=>{const x=125+i*130, an=r.tage.includes(i)&&a>.5; dot(c,x,y,50,an?AMB:DIM);
        h+='<div style="position:absolute;left:'+(x-50)+'px;width:100px;text-align:center;top:'+(y-18)+'px;font-weight:900;font-size:30px;color:'+(an?'#0b0a09':MID)+'">'+d+'</div>'});
      if(r.tag)h+='<div class="tag" style="left:72px;top:'+(y+70)+'px;opacity:'+cl((t-P(r.p)-.6)/.3)+'">'+r.tag+'</div>'});}
  if(v.typ==='saetze'){
    v.reihen.forEach((r,ri)=>{const y=110+ri*230,a=cl((t-P(r.p))/1.2);let x=100,n=0,tot=r.gruppen.reduce((s,g)=>s+g,0);
      h+='<div class="label" style="left:72px;top:'+(y-90)+'px">'+r.label+'</div>';
      r.gruppen.forEach(g=>{for(let i=0;i<g;i++){dot(c,x,y,24,n<a*tot?AMB:DIM);x+=64;n++}x+=60});});
    h+='<div class="label" style="right:150px;top:0;font-size:24px">1 Punkt = 1 Satz</div>';}
  if(v.typ==='zehn'){const a=cl((t-P(v.p))/1.2)*10;
    for(let i=0;i<10;i++)dot(c,150+(i%5)*150,180+Math.floor(i/5)*160,52,i<a?AMB:DIM);
    h+='<div class="wert" style="left:870px;top:160px;font-size:200px;color:'+AMB+';opacity:'+cl(a-9.5)+'">+</div>';
    h+='<div class="label" style="left:72px;top:440px;opacity:'+cl(a-9)+'">1 PUNKT = 1 SATZ PRO MUSKELGRUPPE & WOCHE</div>';}
  if(v.typ==='zigarette'){const cy=400,x0=160,x1=860,fl=x0+170;
    for(let x=x0;x<=x1;x+=20)for(let y=cy-60;y<=cy+60;y+=20){dot(c,x,y,7.5,x<fl?'#c98a4b':MID)}
    const glut=.6+.4*Math.sin(t*6);for(let y=cy-60;y<=cy+60;y+=20){dot(c,x1+20,y,9,'rgba(239,68,68,'+glut+')');dot(c,x1+38,y,6,'rgba(251,191,36,'+(glut*.8)+')')}
    for(let i=0;i<30;i++){const ph=(t*.35+i/30)%1,yy=cy-80-ph*320,xx=x1+20+Math.sin(ph*9+i)*30*ph;dot(c,xx,yy,6*(1-ph)+2,'rgba(154,163,157,'+(.55*(1-ph))+')')}}
  if(v.typ==='schleife'){const M=[490,400],R=240,ang=[-90,30,150].map(a=>a*Math.PI/180),pos=ang.map(a=>[M[0]+Math.cos(a)*R,M[1]+Math.sin(a)*R]);
    v.knoten.forEach((k,i)=>{const a=auf(k.p);if(a<=0)return;const a0=ang[i]+.42,a1=ang[(i+1)%3]-.42;const n=22;
      for(let j=0;j<=n;j++){const q=j/n;if(q>a*1.4)break;const w=a0+(a1+(a1<a0?2*Math.PI:0)-a0)*q;dot(c,M[0]+Math.cos(w)*R,M[1]+Math.sin(w)*R,j===n?9:5,j===n?AMB:MID)}});
    v.knoten.forEach((k,i)=>{const a=auf(k.p);const [x,y]=pos[i];const T=v.tausch&&i===1?v.tausch:null,tw=T?auf(T.p,.5):0;
      let inner='<div style="font-weight:700;font-size:38px;line-height:1.1">'+k.wert+'</div>';
      if(T&&tw>0)inner='<div style="font-weight:700;font-size:30px;line-height:1.1;color:'+ROT+';text-decoration:line-through;opacity:'+(1-tw*.6)+'">'+k.wert+'</div><div style="font-weight:900;font-size:36px;line-height:1.1;color:'+AMB+';margin-top:6px;opacity:'+tw+'">'+T.neu+'</div>';
      h+='<div style="position:absolute;left:'+(x-150)+'px;top:'+(y-150)+'px;width:300px;height:300px;border-radius:50%;background:#141311;border:5px solid '+(T&&tw>0?AMB:(a>.5?AMB:'#2a2722'))+';display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;opacity:'+Math.max(.25,a)+';box-shadow:'+(T&&tw>0?'0 0 60px rgba(251,191,36,.45)':'none')+'"><div style="font-weight:700;font-size:22px;letter-spacing:.2em;color:#a8a29e;margin-bottom:10px">'+k.label+'</div>'+(a>.5?inner:'')+'</div>'});}
  if(v.band){const b=auf(v.band.p,.35);if(b>0)h+='<div class="band" style="top:640px;opacity:'+b+';transform:scale('+(.9+.1*b)+')">'+v.band.text+'</div>';}
  if(v.stempel&&t>=P(v.stempel.p)){const x=cl((t-P(v.stempel.p))/.25);h+='<div class="stempel" style="left:50%;top:'+(v.stempel.top||330)+'px;transform:translate(-50%,-50%) rotate(-9deg) scale('+(2.2-1.2*ease(x))+');opacity:'+cl(x*8)+'">'+v.stempel.text+'</div>';}
  if(end){const a=ease((t-sz.start)/.5);h+='<div class="end" style="opacity:'+a+'"><img class="i" src="'+ICON+'"><h1>'+MARKE+'</h1><p>'+v.zeile+'</p><div class="b"><img src="'+IOS+'"><img src="'+GP+'"></div>'+(v.klein?'<div style="margin-top:44px;font-size:28px;color:#a8a29e">'+v.klein+'</div>':'')+'</div>';}
  document.getElementById('ov').innerHTML=h;
}
window.setFrame=setFrame;
</script></body></html>`;
for (const [alt, neu] of Object.entries(MK.farben)) html = html.split(alt).join(neu);
writeFileSync(`${D}/seite.html`, html);

// --- 4. Frames ---
const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || '/opt/pw-browsers/chromium' });
const pg = await br.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.setContent(html); await pg.evaluate(() => document.fonts.ready);
const n = Math.ceil(G * FPS);
if (STAND) {
  for (const f of readdirSync(D).filter((f) => f.startsWith('stand-'))) unlinkSync(`${D}/${f}`);
  const zeiten = szenen.flatMap((s) => [s.vo + 0.3, ...s.phrasen.map((p) => p[1] - 0.05)]);
  for (const [j, t] of zeiten.entries()) { await pg.evaluate(async (t) => { window.setFrame(t); const hg = document.getElementById("hg"); if (hg.style.opacity !== "0" && hg.src) await hg.decode().catch(() => {}); }, t); await pg.screenshot({ path: `${D}/stand-${String(j).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 80 }); }
  await br.close();
  execFileSync(F, ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', `${D}/stand-*.jpg`, '-vf', 'scale=216:384,tile=10x3', '-frames:v', '1', `${D}/stand.jpg`]);
  console.log(`  Standbogen ${D}/stand.jpg`); process.exit(0);
}
const ff = spawn(F, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', `${D}/bild.mp4`]);
for (let i = 0; i < n; i++) {
  await pg.evaluate(async (t) => { window.setFrame(t); const hg = document.getElementById("hg"); if (hg.style.opacity !== "0" && hg.src) await hg.decode().catch(() => {}); }, i / FPS);
  const buf = await pg.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await br.close();

// --- 5. Ton ---
const args = ['-y', '-loglevel', 'error', '-i', `${D}/bild.mp4`];
szenen.forEach((s) => args.push('-i', `${D}/vs-${s.i}.wav`));
args.push('-stream_loop', '-1', '-i', MUSIK);
const k = szenen.length + 1;
const fl = szenen.map((s, i) => `[${i + 1}:a]adelay=${Math.round(s.vo * 1000)}|${Math.round(s.vo * 1000)},aformat=channel_layouts=stereo[v${i}]`).join(';')
  + ';' + szenen.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${szenen.length}:normalize=0,apad=whole_dur=${G},volume=1.5,asplit[vo][vk]`
  + `;[${k}:a]atrim=0:${G},asetpts=PTS-STARTPTS,aformat=channel_layouts=stereo,volume=0.22,afade=t=in:d=0.5,afade=t=out:st=${(G - 1.2).toFixed(2)}:d=1.2[m]`
  + ';[m][vk]sidechaincompress=threshold=0.015:ratio=10:attack=20:release=500[md];[md][vo]amix=inputs=2:normalize=0[au]';
args.push('-filter_complex', fl, '-map', '0:v', '-map', '[au]', '-c:v', 'copy', '-c:a', 'pcm_s16le', '-t', String(G), `${D}/roh.mov`);
execFileSync(F, args);
const log = sh(`${F} -i ${D}/roh.mov -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1`);
const j = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
execFileSync(F, ['-y', '-loglevel', 'error', '-i', `${D}/roh.mov`, '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', ZIEL]);
console.log(`  fertig: ${ZIEL}`);
