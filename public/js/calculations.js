function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clampWeightFactor(value) {
  return Math.min(1, Math.max(0, toNumber(value)));
}

export function calculateRows(stations) {
  return stations.map((station) => {
    const weight = toNumber(station.weight);
    const arm = toNumber(station.arm);
    const weightFactor = clampWeightFactor(station.weightFactor ?? 1);
    const effectiveWeight = weight * weightFactor;

    return {
      ...station,
      weight,
      arm,
      weightFactor,
      effectiveWeight,
      moment: effectiveWeight * arm
    };
  });
}

export function calculateTotals(aircraft, stations) {
  const emptyWeight = toNumber(aircraft.emptyWeight);
  const emptyArm = toNumber(aircraft.emptyArm);
  const emptyMoment = emptyWeight * emptyArm;

  const rows = calculateRows(stations);
  const stationWeight = rows.reduce((total, row) => total + row.effectiveWeight, 0);
  const stationMoment = rows.reduce((total, row) => total + row.moment, 0);

  const totalWeight = emptyWeight + stationWeight;
  const totalMoment = emptyMoment + stationMoment;
  const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;

  return {
    rows,
    totalWeight,
    totalMoment,
    cg
  };
}

export function evaluateBalance(aircraft, totals) {
  const maxWeight = toNumber(aircraft.maxWeight);
  const minCg = toNumber(aircraft.minCg);
  const maxCg = toNumber(aircraft.maxCg);

  const weightInRange = maxWeight <= 0 || totals.totalWeight <= maxWeight;

  const cgInRange =
    (minCg <= 0 || totals.cg >= minCg) &&
    (maxCg <= 0 || totals.cg <= maxCg);

  if (weightInRange && cgInRange) {
    return { label: "IN LIMITS", className: "ok" };
  }

  if (!weightInRange && !cgInRange) {
    return { label: "WEIGHT + CG OUT", className: "bad" };
  }

  if (!weightInRange) {
    return { label: "WEIGHT OUT", className: "warn" };
  }

  return { label: "CG OUT", className: "warn" };
}

export function envelopePolygon(aircraft) {
  const minWeight = toNumber(aircraft.emptyWeight);
  const maxWeight = toNumber(aircraft.maxWeight);
  const minCg = toNumber(aircraft.minCg);
  const maxCg = toNumber(aircraft.maxCg);

  if (maxWeight <= minWeight || maxCg <= minCg) {
    return null;
  }

  return [
    { cg: minCg, weight: minWeight },
    { cg: maxCg, weight: minWeight },
    { cg: maxCg, weight: maxWeight },
    { cg: minCg, weight: maxWeight }
  ];
}
