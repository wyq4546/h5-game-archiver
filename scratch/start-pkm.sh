#!/bin/bash
cd /home/ubuntu/Feed-Pocket-Monsters-In-Palworld-20261102-095146 || exit 1
exec node scripts/internal/run-auto.mjs \
  --record \
  --batch recording-2026-11-10T17-01-38-330Z \
  --start-level 11 \
  --end 60 \
  --attempts 3
