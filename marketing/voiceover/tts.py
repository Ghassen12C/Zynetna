"""Synthesise the promo voice-over with Azure Speech (Tunisian Arabic voices).

Reads lines.json, writes one 48 kHz mono WAV per line and voice into OUT_DIR.
Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the environment; the key is a
GitHub Actions secret and never appears in the repository or the logs.
Standard library only, so the workflow needs no install step.
"""
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request
from xml.sax.saxutils import escape

HERE = pathlib.Path(__file__).parent
# An unset GitHub variable arrives as an empty string, not as a missing one.
KEY = os.environ.get("AZURE_SPEECH_KEY", "").strip()
REGION = os.environ.get("AZURE_SPEECH_REGION", "").strip() or "francecentral"
VOICES = [v.strip() for v in (os.environ.get("VOICES") or "ar-TN-ReemNeural,ar-TN-HediNeural").split(",") if v.strip()]
RATE = os.environ.get("RATE", "").strip() or "-3%"
OUT = pathlib.Path(os.environ.get("OUT_DIR") or "out")
URL = f"https://{REGION}.tts.speech.microsoft.com/cognitiveservices/v1"


def synthesise(voice: str, text: str) -> bytes:
    ssml = (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-TN">'
        f'<voice name="{voice}"><prosody rate="{RATE}">{escape(text)}</prosody></voice></speak>'
    )
    req = urllib.request.Request(
        URL,
        data=ssml.encode("utf-8"),
        headers={
            "Ocp-Apim-Subscription-Key": KEY,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm",
            "User-Agent": "zynetna-voiceover",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read()


def main() -> int:
    if not KEY:
        print("AZURE_SPEECH_KEY is empty: add it under Settings → Secrets and variables → Actions → Secrets.", file=sys.stderr)
        return 1
    print(f"Region {REGION}, voices {', '.join(VOICES)}, rate {RATE}")
    lines = json.loads((HERE / "lines.json").read_text(encoding="utf-8"))["lines"]
    for voice in VOICES:
        folder = OUT / voice
        folder.mkdir(parents=True, exist_ok=True)
        for line in lines:
            try:
                audio = synthesise(voice, line["text"])
            except urllib.error.HTTPError as err:
                hint = {401: "the key is wrong, or belongs to another region than " + REGION}.get(err.code, "")
                print(f"{voice} {line['id']}: HTTP {err.code} {err.reason} {hint}".strip(), file=sys.stderr)
                return 1
            (folder / f"{line['id']}.wav").write_bytes(audio)
            print(f"{voice} {line['id']}: {len(audio)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
