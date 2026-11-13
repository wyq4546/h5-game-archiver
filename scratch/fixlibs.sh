#!/bin/sh
# 免 root 补齐 Chromium 完整版 + ANGLE/EGL 所需系统库，解包到 ~/.local/extra-libs
DEST=/home/ubuntu/.local/extra-libs
WORK=/tmp/debs
mkdir -p "$WORK" "$DEST"
cd "$WORK" || exit 1

PKGS="libegl1 libglvnd0 libglx0 libopengl0
libcups2 libcairo2 libpango-1.0-0 libpangocairo-1.0-0
libpixman-1-0 libfontconfig1 libfreetype6 libpng16-16
libxcb-render0 libxcb-shm0 libxrender1 liblzo2-2
libfribidi0 libthai0 libharfbuzz0b libpangoft2-1.0-0
libdatrie1 libgraphite2-3 libbrotli1 libjpeg-turbo8
libavahi-common3 libavahi-client3 libgnutls30 libnettle8 libhogweed6 libgmp10
libx11-6 libxcb1 libxext6 libxau6 libxdmcp6 libbsd0 libmd0
libxcb-glx0 libxcb-dri2-0 libxcb-dri3-0 libxcb-present0 libxcb-sync1 libxshmfence1"

for p in $PKGS; do
  apt-get download "$p" >/dev/null 2>&1 || echo "MISS $p"
done

n=0
for f in *.deb; do
  [ -e "$f" ] || continue
  dpkg -x "$f" "$DEST" && n=$((n+1))
done
echo "extracted=$n debs"
