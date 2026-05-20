from faster_whisper import WhisperModel
import sys

video_path = sys.argv[1]

model = WhisperModel(
    "base",
    compute_type="int8"
)

segments, info = model.transcribe(video_path)

full_text = ""

for segment in segments:
    full_text += segment.text + " "

print(full_text)