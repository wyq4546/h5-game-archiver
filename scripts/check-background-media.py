"""Inspect recordings listed in a verify-other-background-recordings results directory."""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

root = Path(sys.argv[1]).resolve()
results = json.loads((root / 'results.json').read_text(encoding='utf-8'))
report = []

def decode(file, start, length):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-threads', '1', '-ss', str(start),
        '-i', str(file), '-t', str(length), '-filter_threads', '1', '-vf', 'scale=180:320',
        '-an', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, 320, 180, 3)

for game in results:
    for name in game['files']:
        file = Path(name)
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams',
            '-show_format', '-of', 'json', str(file)]))
        duration = float(probe['format']['duration'])
        video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        assert (video['codec_name'], video['width'], video['height'], video['avg_frame_rate']) == ('h264', 1080, 1920, '60/1')
        motion = decode(file, 2, min(6, duration - 2))
        changes = np.abs(np.diff(motion.astype(np.int16), axis=0)).mean(axis=(1, 2, 3))
        tail = decode(file, max(0, duration - 2), 2)
        header = tail[:, :55, 20:160]
        green = ((header[..., 0] < 90) & (header[..., 1] > 140) & (header[..., 2] < 180)).mean(axis=(1, 2))
        volume = subprocess.run(['ffmpeg', '-v', 'info', '-threads', '1', '-i', str(file),
            '-vn', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
        sheet = Image.new('RGB', (180 * 6, 340), 'white')
        draw = ImageDraw.Draw(sheet)
        times = [0, .2, duration - 1.5, duration - .8, duration - .3, duration - .08]
        for i, time in enumerate(times):
            frames = decode(file, max(0, time), .08)
            sheet.paste(Image.fromarray(frames[0]), (180 * i, 20))
            draw.text((180 * i + 4, 3), f'{time:.2f}s', fill='black')
        sheet.save(root / f'{game["name"]}-{file.stem}.jpg')
        item = {'game': game['name'], 'file': str(file), 'duration': duration,
            'motion_pairs': len(changes), 'near_duplicates_below_0_15': int((changes < .15).sum()),
            'max_tail_green_header_fraction': float(green.max()),
            'tail_green_header_frames_above_0_25': int((green > .25).sum()),
            'audio': [line for line in volume.splitlines() if 'mean_volume' in line or 'max_volume' in line]}
        report.append(item)
        print(json.dumps(item, ensure_ascii=False))
(root / 'media-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
