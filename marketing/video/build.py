"""Build the salon-first promo.
   python3 build.py out.mp4                    -> preview, no voice (default timings)
   python3 build.py out.mp4 speech.mp3         -> one recording holding all 10 lines: split on pauses, then sync
   python3 build.py out.mp4 dir_with_01..10    -> one file per line
"""
import json, os, re, subprocess, sys, glob
V3 = os.path.dirname(os.path.abspath(__file__)); W = f'{V3}/work'; os.makedirs(W, exist_ok=True)
ROOT = os.path.abspath(f'{V3}/../..')
if not os.path.exists(f'{V3}/sfx/music.wav'):
    os.makedirs(f'{V3}/sfx', exist_ok=True); subprocess.check_call(['python3', f'{V3}/sfx.py', f'{V3}/sfx', '30'])
KEYS = ['miss','cats','brand','discover','book','control','extra','remind','offer','cta']
LINES = ["التليفون يدقّ وانت تخدم… والكليون يمشي لغيرك.",
 "عندك صالون؟ كوافيرة، ظّوافِر، ماكياج ولّا حجّام؟",
 "مع زينتنا… ساهلة!",
 "كليوناتك يلقاو صالونك، ويريزرفيو وحدهم م التليفون، ليل ونهار.",
 "يختارو الخدمة والوقت… وفي ثلاثة كليكات، الموعد محجوز.",
 "وانتي تتحكّم في كلّ شي: الأجندة، الخدمات والأسوام، أوقات الخدمة، والفريق متاعك.",
 "تزيد ريزرفاسيونات التليفون، تحطّ تصاور صالونك، وتشوف قدّاش دخّلت في الشهر.",
 "وقبل كلّ موعد، يوصلو تذكير… ما عادش ينسى.",
 "شهرين بلاش! ومبعد ثلاثين دينار برك في الشهر.",
 "سجّل صالونك توّا، على زينتنا پوان تي إن!"]
LEAD, TAIL = 0.15, 0.30
LEADS = {'miss': 0.9}  # let the phone ring before the voice comes in
sh = lambda *a, **k: subprocess.check_call(list(a), **k)
dur_of = lambda f: float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]).decode())

def silences(f, db=-38, d=0.18):
    err = subprocess.run(['ffmpeg','-hide_banner','-i',f,'-af',f'silencedetect=noise={db}dB:d={d}','-f','null','-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    return list(zip(st, en))

def split_one(f):
    """Cut points can be given by hand (CUTS="5.1,9.2,…" — the 9 pauses between lines), otherwise pick the 9 pauses that best separate the 10 lines: long pauses near where each line should end (by text length)."""
    total = dur_of(f)
    if os.environ.get('CUTS'):
        mids = [float(x) for x in os.environ['CUTS'].split(',')]; assert len(mids) == 9, 'CUTS needs 9 values'
        return cut(f, [0.0] + mids + [total])
    gaps = [(a, b) for a, b in silences(f) if a > 0.3 and b < total - 0.3]
    if len(gaps) < 9: sys.exit(f'only {len(gaps)} pauses found — leave a short pause between lines, or upload 10 files')
    w = [len(re.sub(r'\W', '', l)) + 6 for l in LINES]; cum = [sum(w[:i+1]) / sum(w) for i in range(9)]
    first, last = silences(f)[0], silences(f)[-1]
    speech0 = first[1] if first[0] < 0.05 else 0; speech1 = last[0] if last[1] > total - 0.05 else total
    S = speech1 - speech0; INF = 1e18
    # dp[i][j]: best cost using gap j as boundary i
    import math
    cost = lambda i, j: ((((gaps[j][0]+gaps[j][1])/2 - speech0)/S - cum[i]) / 0.06) ** 2 - 4 * math.log(gaps[j][1]-gaps[j][0])
    n = len(gaps); dp = [[INF]*n for _ in range(9)]; bk = [[-1]*n for _ in range(9)]
    for j in range(n): dp[0][j] = cost(0, j)
    for i in range(1, 9):
        best, bj = INF, -1
        for j in range(n):
            if j > 0 and dp[i-1][j-1] < best: best, bj = dp[i-1][j-1], j-1
            if bj >= 0: dp[i][j] = best + cost(i, j); bk[i][j] = bj
    j = min(range(n), key=lambda j: dp[8][j]); pick = []
    for i in range(8, -1, -1): pick.append(j); j = bk[i][j]
    pick = [gaps[j] for j in reversed(pick)]
    cuts = [speech0] + [(a+b)/2 for a, b in pick] + [speech1]
    return cut(f, cuts)

def cut(f, cuts):
    print('cut points (s):', [round(c, 2) for c in cuts])
    for i in range(10):
        sh('ffmpeg','-hide_banner','-loglevel','error','-y','-i',f,'-ss',str(cuts[i]),'-to',str(cuts[i+1]),'-ac','1','-ar','48000',f'{W}/raw{i+1:02d}.wav')
    return [f'{W}/raw{i+1:02d}.wav' for i in range(10)]

def trim(src, dst):
    sh('ffmpeg','-hide_banner','-loglevel','error','-y','-i',src,'-af',
       'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.05,areverse',
       '-ac','1','-ar','48000',dst)

out = sys.argv[1]; src = sys.argv[2] if len(sys.argv) > 2 else None
clips = None; DUR = None
if src:
    raw = split_one(src) if os.path.isfile(src) else sorted(glob.glob(f'{src}/[01][0-9].*'))[:10]
    assert len(raw) == 10, raw
    clips = []
    for i, r in enumerate(raw):
        d = f'{W}/clip{i+1:02d}.wav'; trim(r, d); clips.append(d)
    DUR = {k: round(LEADS.get(k, LEAD) + dur_of(c) + (1.6 if k == 'cta' else TAIL), 3) for k, c in zip(KEYS, clips)}
    print('scene durations', DUR)

env = dict(os.environ, FRAMES=f'{W}/frames')
if DUR: env['DUR'] = json.dumps(DUR)
info = json.loads(subprocess.check_output(['node', f'{V3}/render.mjs', 'cues'], env=env, cwd=ROOT).decode().strip().splitlines()[-1])
T, total = info['T'], info['total'] + 0.6
subprocess.run(['rm','-rf',f'{W}/frames']); sh('node', f'{V3}/render.mjs', 'frames', '0', 'auto', env=env, cwd=ROOT)

# ---- audio ----
ins, fl, n = [], [], 1  # input 0 = frames
def add(path): global n; ins.extend(['-i', path]); n += 1; return n - 1
sfx = []
for t, name, g in info['cues']:
    if t < 0: continue
    k = add(f'{V3}/sfx/{name}.wav'); ms = int(t*1000); sfx.append(f's{k}')
    fl.append(f'[{k}:a]volume={g}dB,adelay={ms}|{ms}[s{k}]')
m0 = max(0, T['brand'][0] - 0.35); km = add(f'{V3}/sfx/music.wav')
fl.append(f'[{km}:a]atrim=0:{total-m0},afade=t=in:d=0.6,afade=t=out:st={max(0,total-m0-1.8)}:d=1.8,volume=-17dB,adelay={int(m0*1000)}|{int(m0*1000)}[mus]')
if clips:
    vo = []
    for c, k in zip(clips, KEYS):
        i = add(c); ms = int((T[k][0] + LEADS.get(k, LEAD)) * 1000); fl.append(f'[{i}:a]adelay={ms},aformat=channel_layouts=mono[v{i}]'); vo.append(f'[v{i}]')
    fl.append(''.join(vo) + f'amix=inputs={len(vo)}:normalize=0,loudnorm=I=-16:TP=-2,aformat=channel_layouts=stereo:sample_rates=48000,asplit=2[vox][key]')
    fl.append('[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck]')
    bed = '[duck][vox]'; nb = 2
else:
    bed = '[mus]'; nb = 1
fl.append(bed + ''.join(f'[{s}]' for s in sfx) + f'amix=inputs={nb+len(sfx)}:normalize=0,apad=whole_dur={total},atrim=0:{total},loudnorm=I=-14:TP=-1.5:LRA=11,aformat=channel_layouts=stereo:sample_rates=48000[aout]')
sh('ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','30','-i',f'{W}/frames/f%05d.jpg',*ins,'-filter_complex',';'.join(fl),
   '-map','0:v','-map','[aout]','-c:v','libx264','-preset','slow','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart','-c:a','aac','-b:a','192k','-shortest',out)
print('done', out, round(total, 1), 's')
