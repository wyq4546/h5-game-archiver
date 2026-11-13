export function parseLevelLimit(argv) {
  if (argv.includes("--smoke-test")) return 1;
  const raw = argv.find(value => value.startsWith("--levels="));
  const value = raw ? Number(raw.slice("--levels=".length)) : Infinity;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : Infinity;
}

export function chooseBatteryLane({ lanes, currentLane, targetLane, pickups, hazards }) {
  const score = lane => {
    const imminent = hazards.filter(hazard => hazard.ahead >= -0.015 && hazard.ahead <= 0.11);
    const nearestAhead = imminent.length ? Math.min(...imminent.map(hazard => hazard.ahead)) : Infinity;
    const immediateRow = imminent.filter(hazard => hazard.ahead < nearestAhead + 0.035);
    const nearestClearance = immediateRow.length
      ? Math.min(...immediateRow.map(hazard => Math.abs(lane - hazard.lane)))
      : Infinity;
    if (nearestClearance < 2.2) return -1_000_000 + nearestClearance * 1_000;

    let total = -Math.abs(lane - targetLane) * 0.2 - Math.abs(lane - currentLane) * 0.04;
    for (const pickup of pickups) {
      if (pickup.ahead < -0.01 || pickup.ahead > 0.18) continue;
      const alignment = Math.max(0, 1 - Math.abs(lane - pickup.lane) / 1.4);
      const urgency = Math.max(0, 1 - pickup.ahead / 0.18);
      total += alignment * (55 + urgency * 90);
    }
    for (const hazard of hazards) {
      if (hazard.ahead < -0.015 || hazard.ahead > 0.16) continue;
      const clearance = Math.abs(lane - hazard.lane);
      if (clearance >= 1.35) continue;
      const urgency = Math.max(0, 1 - hazard.ahead / 0.16);
      total -= (1.35 - clearance) * (180 + urgency * 520);
    }
    return total;
  };
  return lanes.reduce((best, lane) => score(lane) > score(best) ? lane : best, lanes[0]);
}
