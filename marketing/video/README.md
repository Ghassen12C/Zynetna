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

The pauses inside a line (after a comma or «…») can be as long as the ones between
lines, so the automatic split can pick the wrong pause. Give the 9 cut points by hand
then. For the current recording (`marketing/voiceover/speech-rima.mp3`, ElevenLabs):

    CUTS="5.11,9.235,11.205,15.705,19.59,25.84,30.815,34.17,37.565" \
      python3 marketing/video/build.py out.mp4 marketing/voiceover/speech-rima.mp3

To find cut points for a new recording, list its pauses and match them to the script:

    ffmpeg -i speech.mp3 -af silencedetect=noise=-36dB:d=0.07 -f null - 2>&1 | grep silence_
