/**
 * Beauty Fight - Autonomous Track Strategy Module
 * Perceives 3D track obstacles, collectibles (heels, gems), rails, and finish line.
 * Computes smooth target X lane with obstacle avoidance and collectible collection.
 */

export class BeautyFightStrategy {
  constructor() {
    this.targetX = 0;
    this.minX = -2.2;
    this.maxX = 2.2;
    this.obstacleSafeUntilZ = 0;
  }

  reset() {
    this.targetX = 0;
    this.obstacleSafeUntilZ = 0;
  }

  plan(state) {
    if (!state || !state.pos) return 0;
    const { x, y, z } = state.pos;
    const heels = state.heels || 0;
    const finishZ = state.finishZ || 110;

    // 1. If currently passing through an active obstacle cluster, stay locked in safe lane
    if (z < this.obstacleSafeUntilZ) {
      return this.targetX;
    }

    // 2. On finish stairs (z >= finishZ - 12): center to x = 0 to collect finish diamonds and climb to podium
    if (z >= finishZ - 12) {
      this.targetX = 0;
      return 0;
    }

    // 3. Scan upcoming obstacles in window [z - 0.5, z + 25.0]
    const nearObstacles = (state.obstacles || []).filter(o => o.z > z - 0.5 && o.z < z + 25.0);
    nearObstacles.sort((a, b) => a.z - b.z);

    let nextCluster = null;
    let clusterFirstZ = 9999;
    if (nearObstacles.length > 0) {
      clusterFirstZ = nearObstacles[0].z;
      nextCluster = nearObstacles.filter(o => Math.abs(o.z - clusterFirstZ) <= 1.8);
    }

    // Evaluate best obstacle lane if cluster exists
    let bestObstacleLane = null;
    if (nextCluster) {
      const laneMaxY = { "-2": -1, "-1": -1, "0": -1, "1": -1, "2": -1 };
      for (const obs of nextCluster) {
        const laneKey = Math.round(obs.x).toString();
        if (laneMaxY[laneKey] !== undefined) {
          if (obs.y > laneMaxY[laneKey]) laneMaxY[laneKey] = obs.y;
        }
      }

      const allLanes = Object.entries(laneMaxY).map(([lStr, maxY]) => {
        const lx = Number(lStr);
        const reqHeels = maxY >= 0 ? Math.round(maxY) + 1 : 0;
        return { x: lx, reqHeels, isFree: maxY < 0, maxY };
      });

      // Filter passable lanes based on current heels
      let candidates = allLanes.filter(l => heels >= l.reqHeels);
      if (candidates.length === 0) {
        // If not enough heels for any lane, choose lane with lowest height
        const minReq = Math.min(...allLanes.map(l => l.reqHeels));
        candidates = allLanes.filter(l => l.reqHeels === minReq);
      }

      // Collectibles near/after cluster (within 5m after clusterFirstZ)
      const postClusterCollectibles = (state.collectibles || []).filter(
        c => c.z >= clusterFirstZ && c.z <= clusterFirstZ + 6.0 && c.name.includes("Heel")
      );

      candidates.sort((a, b) => {
        // Prefer lane that leads directly to a post-cluster heel
        const aHasPost = postClusterCollectibles.some(c => Math.abs(c.x - a.x) < 0.6) ? 1 : 0;
        const bHasPost = postClusterCollectibles.some(c => Math.abs(c.x - b.x) < 0.6) ? 1 : 0;
        if (aHasPost !== bHasPost) return bHasPost - aHasPost;

        const aFree = a.isFree ? 1 : 0;
        const bFree = b.isFree ? 1 : 0;
        if (aFree !== bFree) return bFree - aFree;

        // Otherwise prefer closest lane to current x
        return Math.abs(a.x - x) - Math.abs(b.x - x);
      });

      bestObstacleLane = candidates[0].x;
    }

    // 4. Collectibles: check if there are any reachable collectibles BEFORE the obstacle
    // A collectible is "before the obstacle" if c.z < clusterFirstZ - 1.2
    // That gives enough space to collect it and still transition to bestObstacleLane.
    const preObstacleColls = (state.collectibles || []).filter(
      c => c.z > z + 0.3 && c.z < clusterFirstZ - 1.2
    );

    if (preObstacleColls.length > 0) {
      // Prioritize Heels first, then other collectibles
      const heelsAhead = preObstacleColls.filter(c => c.name.includes("Heel"));
      const targetPool = heelsAhead.length > 0 ? heelsAhead : preObstacleColls;
      targetPool.sort((a, b) => a.z - b.z);
      this.targetX = Math.max(this.minX, Math.min(this.maxX, targetPool[0].x));
      return this.targetX;
    }

    // 5. If no collectibles before the obstacle, and the obstacle is near (within 3.5m):
    // Lock into obstacle safe lane!
    if (nextCluster && (clusterFirstZ - z) <= 3.5) {
      this.obstacleSafeUntilZ = clusterFirstZ + 1.8;
      this.targetX = bestObstacleLane;
      return this.targetX;
    }

    // 6. If obstacle is between 3.5m and 6.0m away (and no pre-obstacle collectibles):
    // Pre-align towards bestObstacleLane
    if (bestObstacleLane !== null && (clusterFirstZ - z) <= 6.0) {
      this.targetX = bestObstacleLane;
      return this.targetX;
    }

    // 7. General collectibles ahead (up to 20m)
    const anyColls = (state.collectibles || []).filter(c => c.z > z + 0.3 && c.z < z + 20.0);
    if (anyColls.length > 0) {
      const heelsAhead = anyColls.filter(c => c.name.includes("Heel"));
      const targetPool = heelsAhead.length > 0 ? heelsAhead : anyColls;
      targetPool.sort((a, b) => a.z - b.z);
      this.targetX = Math.max(this.minX, Math.min(this.maxX, targetPool[0].x));
      return this.targetX;
    }

    if (bestObstacleLane !== null) {
      this.targetX = bestObstacleLane;
      return this.targetX;
    }

    this.targetX = Math.max(this.minX, Math.min(this.maxX, x * 0.9));
    return this.targetX;
  }
}
