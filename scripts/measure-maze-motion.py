"""Measure visible ball motion in a recorded Color Maze MP4."""
import json
import sys

import cv2
import numpy as np

capture = cv2.VideoCapture(sys.argv[1])
fps = capture.get(cv2.CAP_PROP_FPS)
step = max(1, round(fps / 5))
samples = []
frame = 0
while True:
    ok, image = capture.read()
    if not ok:
        break
    if frame % step == 0:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, (0, 80, 60), (12, 255, 255)) | cv2.inRange(hsv, (170, 80, 60), (179, 255, 255))
        count, labels, stats, centers = cv2.connectedComponentsWithStats(mask)
        choices = []
        for i in range(1, count):
            x, y, w, h, area = stats[i]
            if 8 <= w <= 100 and 8 <= h <= 100 and 60 <= area <= 5000 and image.shape[0] * .2 < y < image.shape[0] * .85:
                choices.append((area, centers[i]))
        if choices:
            center = max(choices, key=lambda value: value[0])[1]
            samples.append((frame / fps, center[0], center[1]))
    frame += 1
capture.release()
moves = []
for a, b in zip(samples, samples[1:]):
    distance = float(np.hypot(b[1] - a[1], b[2] - a[2]))
    moves.append((b[0], distance))
moving = [t for t, distance in moves if distance >= 5]
print(json.dumps({
    'videoSeconds': round(frame / fps, 2),
    'trackedSamples': len(samples),
    'movingSeconds': round(len(moving) * step / fps, 2),
    'firstMovementAt': round(min(moving), 2) if moving else None,
    'lastMovementAt': round(max(moving), 2) if moving else None,
    'maxStepPixels': round(max((distance for _, distance in moves), default=0), 1),
}))
