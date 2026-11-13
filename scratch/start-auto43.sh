#!/bin/bash
# 长期驻留的自动录制进程：目标第 43-60 关
# 关键点：attempts=999，避免 15 次用完后退出、下次又要重新快进 1-42 关（21 分钟）
cd /home/ubuntu/Mad-Medicine-20261102-100432 || exit 1
exec node scripts/internal/run-auto.mjs \
  --batch recording-2026-11-10T06-02-34-390Z \
  --start 1 \
  --end 60 \
  --attempts 999
