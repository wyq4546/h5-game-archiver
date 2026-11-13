#!/bin/sh
export PATH=/home/ubuntu/.local/bin:$PATH
export LD_LIBRARY_PATH=/home/ubuntu/.local/extra-libs/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH
cd /home/ubuntu/GoGy-Rocking-Sky-Trip-20261104-162647/scripts || exit 1
node probe-fps.mjs "$@" > /tmp/probe.log 2>&1
