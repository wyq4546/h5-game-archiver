import { writeFile } from 'node:fs/promises';
import path from 'node:path';

// Runs inside the document owning the canvas/frame. This detects DOM overlays,
// not advertisements rendered by the game itself inside its canvas.
export function isUnobscuredSurface(el) {
  const doc = el.ownerDocument, win = doc.defaultView;
  const style = win.getComputedStyle(el), r = el.getBoundingClientRect();
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < .9 || r.width < 160 || r.height < 160) return false;
  if (r.left < 0 || r.top < 0 || r.left+r.width > win.innerWidth+1 || r.top+r.height > win.innerHeight+1) return false;
  for (const x of [.2,.5,.8]) for (const y of [.2,.5,.8]) {
    const hit = doc.elementFromPoint(r.left+r.width*x,r.top+r.height*y);
    if (hit !== el && !el.contains(hit)) {
      // Construct inserts an empty HTML-layer sibling above its canvas.
      // It participates in hit testing even while it paints no pixels.
      const hs = hit && win.getComputedStyle(hit);
      const transparent = color => color === 'transparent' || /rgba\([^)]*,\s*0\s*\)$/.test(color);
      const emptyConstructLayer = el.tagName === 'CANVAS' && hit?.classList.contains('c3htmlwrap') &&
        hit.parentElement === el.parentElement && !hit.childNodes.length && hs &&
        transparent(hs.backgroundColor) && hs.backgroundImage === 'none' && hs.boxShadow === 'none' &&
        ['Top','Right','Bottom','Left'].every(side => parseFloat(hs['border'+side+'Width']) === 0) &&
        ['::before','::after'].every(pseudo => ['none','normal'].includes(win.getComputedStyle(hit,pseudo).content));
      if (!emptyConstructLayer) return false;
    }
  }
  return true;
}

export async function saveGamePreview(page, captureRoot, filename = 'final.png') {
  const candidates=[];
  for (const frame of page.frames()) {
    if (/doubleclick|googlesyndication|adservice/i.test(frame.url())) continue;
    try {
      let visible=true;
      for (let f=frame;f.parentFrame();f=f.parentFrame()) {
        const element=await f.frameElement();
        try { if (!await element.evaluate(isUnobscuredSurface, null, {timeout: 2000})) { visible=false;break; } }
        finally { await element.dispose(); }
      }
      if (!visible) continue;
      for (const canvas of await frame.locator('canvas').all()) {
        if (!await canvas.evaluate(isUnobscuredSurface, null, {timeout: 2000})) continue;
        const box=await canvas.boundingBox({timeout: 2000});
        if (box) candidates.push({canvas,area:box.width*box.height,frameUrl:frame.url()});
      }
    } catch { /* A navigating/detached frame is not a preview candidate. */ }
  }
  candidates.sort((a,b)=>b.area-a.area);
  const selected=candidates[0];
  if (!selected) return null;
  const clip=await selected.canvas.boundingBox({timeout: 2000});
  if (!clip) return null;
  const buffer=await page.screenshot({clip,timeout:5000});
  if (!await selected.canvas.evaluate(isUnobscuredSurface, null, {timeout: 2000})) return null;
  await writeFile(path.join(captureRoot,'preview',filename),buffer);
  return {path:`preview/${filename}`,source:'visible-game-canvas',frameUrl:selected.frameUrl,capturedAt:new Date().toISOString()};
}
