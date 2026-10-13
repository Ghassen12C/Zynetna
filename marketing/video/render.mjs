// Renders stage.html frame by frame (deterministic render(t)). Modes: frames [from] [to|auto], stills t1 t2…, cues.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const S = dirname(fileURLToPath(import.meta.url));
const [mode = 'frames', from = '0', to = 'auto'] = process.argv.slice(2);
const FPS = 30;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
if (process.env.DUR) await p.addInitScript(d => { window.DUR = JSON.parse(d); }, process.env.DUR);
await p.goto('file://' + S + '/stage.html', { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
if (mode === 'cues') console.log(JSON.stringify(await p.evaluate(() => ({ total: window.TOTAL, T: window.T, cues: window.CUES }))));
else if (mode === 'stills') { for (const t of process.argv.slice(3).map(Number)) { await p.evaluate(t => render(t), t); await p.screenshot({ path: `${S}/work/still-${t}.jpg`, type: 'jpeg', quality: 85 }); } }
else {
  const FR = process.env.FRAMES || `${S}/work/frames`; mkdirSync(FR, { recursive: true });
  const total = await p.evaluate(() => window.TOTAL); const n0 = Math.round(+from * FPS), n1 = Math.round((to === 'auto' ? total + 0.6 : +to) * FPS);
  for (let i = n0; i < n1; i++) { await p.evaluate(t => render(t), i / FPS); await p.screenshot({ path: `${FR}/f${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 }); }
  console.log('frames', n0, n1);
}
await b.close();
