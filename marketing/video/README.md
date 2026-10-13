# Promo video (salon-first)

Vertical 1080×1920 promo built from real app screenshots (`shots/`, demo data only).
`stage.html` + `timeline.js` draw each frame from a time `t`; `render.mjs` screenshots
the frames; `build.py` adds the voice-over, the sound effects and the music bed.

    python3 marketing/video/build.py out.mp4                      # preview, no voice
    python3 marketing/video/build.py out.mp4 path/to/speech.mp3   # one recording, all 10 lines
    python3 marketing/video/build.py out.mp4 path/to/folder       # 01.mp3 … 10.mp3, one per line

With a single recording, the script finds the 9 pauses between the lines on its own
(it matches long pauses to where each line should end, by text length), so leave a
short pause between lines when you record. Scenes are then retimed to the voice.

Sound effects and music are synthesised by `sfx.py` (no third-party audio, no licence
to worry about); they are generated into `sfx/` on the first build.

Needs ffmpeg, Python 3 with numpy, and Chromium (`CHROMIUM=/path/to/chrome`).
