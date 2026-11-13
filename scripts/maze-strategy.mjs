const directions = [
  { key: 'ArrowUp', dx: 0, dy: -1 },
  { key: 'ArrowRight', dx: 1, dy: 0 },
  { key: 'ArrowDown', dx: 0, dy: 1 },
  { key: 'ArrowLeft', dx: -1, dy: 0 }
];

class Heap {
  items = [];
  push(item) {
    const a = this.items;
    let i = a.length;
    a.push(item);
    while (i) {
      const p = (i - 1) >> 1;
      if (a[p].score <= item.score) break;
      a[i] = a[p]; i = p;
    }
    a[i] = item;
  }
  pop() {
    const a = this.items, result = a[0], tail = a.pop();
    if (!a.length) return result;
    let i = 0;
    while (true) {
      let c = i * 2 + 1;
      if (c >= a.length) break;
      if (c + 1 < a.length && a[c + 1].score < a[c].score) c++;
      if (a[c].score >= tail.score) break;
      a[i] = a[c]; i = c;
    }
    a[i] = tail;
    return result;
  }
  get length() { return this.items.length; }
}

export function plan(board) {
  // Some Construct layouts stack more than one paint cube on the same cell.
  // Movement uses cell coordinates; the native painted counter still counts both.
  const groups = new Map();
  for (const cube of board.cubes) {
    const key = `${cube.x},${cube.y}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cube);
  }
  const cubes = [...groups.values()].map(group => ({ ...group[0], painted: group.every(c => c.frame === 1) }));
  const xs = [...new Set(cubes.map(c => c.x))].sort((a, b) => a - b);
  const ys = [...new Set(cubes.map(c => c.y))].sort((a, b) => a - b);
  const dx = Math.min(...xs.slice(1).map((x, i) => x - xs[i]));
  const dy = Math.min(...ys.slice(1).map((y, i) => y - ys[i]));
  const coords = cubes.map(c => [Math.round((c.x - xs[0]) / dx), Math.round((c.y - ys[0]) / dy)]);
  const byCoord = new Map(coords.map(([x, y], i) => [`${x},${y}`, i]));
  const start = cubes.findIndex(c => Math.abs(c.x - board.ball.x) < 1 && Math.abs(c.y - board.ball.y) < 1);
  if (start < 0) throw new Error(`Ball is not on a cube: ${JSON.stringify(board.ball)}`);
  const paths = coords.map(([x, y]) => directions.map(({ dx, dy }) => {
    const cells = [];
    for (let nx = x + dx, ny = y + dy; byCoord.has(`${nx},${ny}`); nx += dx, ny += dy) cells.push(byCoord.get(`${nx},${ny}`));
    return cells;
  }));
  // Check the slide-to-wall graph before allocating the much larger coverage
  // search. A cube outside every reachable slide needs geometry inspection:
  // Construct's Solid objects can also change where the native ball stops.
  const reachable = new Set([start]), stack = [start], covered = new Set([start]);
  while (stack.length) {
    const pos = stack.pop();
    for (const cells of paths[pos]) if (cells.length) {
      cells.forEach(i => covered.add(i));
      const end = cells.at(-1);
      if (!reachable.has(end)) { reachable.add(end); stack.push(end); }
    }
  }
  const outsideSlideGraph = coords.filter((_, i) => !covered.has(i));
  if (outsideSlideGraph.length) {
    throw new Error(`Slide-to-wall model cannot cover ${JSON.stringify(outsideSlideGraph)}; inspect native Solid geometry and level layout`);
  }
  const all = (1n << BigInt(coords.length)) - 1n;
  const initial = cubes.reduce((mask, cube, i) => cube.painted ? mask | (1n << BigInt(i)) : mask, 1n << BigInt(start));
  const initialPainted = cubes.filter((c, i) => c.painted || i === start).length;
  const queue = new Heap();
  const root = { pos: start, mask: initial, painted: initialPainted, steps: 0, score: (coords.length - initialPainted) * 3, parent: null, dir: -1 };
  queue.push(root);
  const seen = new Set([`${start}:${initial}`]);
  let explored = 0;
  while (queue.length && explored++ < 600_000) {
    const node = queue.pop();
    if (node.mask === all) {
      const moves = [];
      for (let n = node; n.parent; n = n.parent) moves.push({ key: directions[n.dir].key, end: cubes[n.pos] });
      return { moves: moves.reverse(), explored, cubes: coords.length };
    }
    for (let d = 0; d < 4; d++) {
      const cells = paths[node.pos][d];
      if (!cells.length) continue;
      let mask = node.mask, painted = node.painted;
      for (const i of cells) {
        const bit = 1n << BigInt(i);
        if (!(mask & bit)) { mask |= bit; painted++; }
      }
      const pos = cells.at(-1), signature = `${pos}:${mask}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      const steps = node.steps + 1;
      queue.push({ pos, mask, painted, steps, score: (coords.length - painted) * 3 + steps, parent: node, dir: d });
    }
  }
  throw new Error(`No route found after ${explored} states (${coords.length} cubes); all cubes appear in the slide graph but no complete route was found`);
}


