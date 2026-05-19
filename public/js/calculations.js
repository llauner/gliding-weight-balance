function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clampWeightFactor(value) {
  return Math.min(10, Math.max(0, toNumber(value)));
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

export function calculateWaterBallastAdjustment(aircraft, items, referenceWetCg) {
  if (!referenceWetCg) {
    return null;
  }

  // Find water ballast items
  const ballastItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.waterBallast);

  if (ballastItems.length !== 2) {
    return null;
  }

  const [ballast1, ballast2] = ballastItems;

  // Calculate empty aircraft contribution
  const emptyWeight = toNumber(aircraft.emptyWeight);
  const emptyArm = toNumber(aircraft.emptyArm);
  const emptyMoment = emptyWeight * emptyArm;

  // Calculate non-ballast items contribution
  const nonBallastItems = items.filter(item => !item.waterBallast);
  const nonBallastTotals = calculateTotals(aircraft, nonBallastItems);
  const nonBallastWeight = nonBallastTotals.totalWeight - emptyWeight;
  const nonBallastMoment = nonBallastTotals.totalMoment - emptyMoment;

  // Get current ballast values
  const w1 = toNumber(ballast1.item.weight);
  const arm1 = toNumber(ballast1.item.arm);
  const w2 = toNumber(ballast2.item.weight);
  const arm2 = toNumber(ballast2.item.arm);

  // Calculate what ballast2 should be if we keep ballast1 at w1
  // Formula: w2 = [M_empty + M_other + w1 * (arm1 - refCG) - refCG * (W_empty + W_other)] / (refCG - arm2)
  const denominator2 = referenceWetCg - arm2;
  let suggestedW2 = null;
  if (Math.abs(denominator2) > 0.01) {
    suggestedW2 = 
      (emptyMoment + nonBallastMoment + w1 * (arm1 - referenceWetCg) - referenceWetCg * (emptyWeight + nonBallastWeight)) / 
      denominator2;
    suggestedW2 = Math.max(0, suggestedW2); // Can't have negative weight
  }

  // Calculate what ballast1 should be if we keep ballast2 at w2
  const denominator1 = referenceWetCg - arm1;
  let suggestedW1 = null;
  if (Math.abs(denominator1) > 0.01) {
    suggestedW1 = 
      (emptyMoment + nonBallastMoment + w2 * (arm2 - referenceWetCg) - referenceWetCg * (emptyWeight + nonBallastWeight)) / 
      denominator1;
    suggestedW1 = Math.max(0, suggestedW1); // Can't have negative weight
  }

  return {
    ballast1: {
      name: ballast1.item.name,
      currentWeight: w1,
      suggestedWeight: suggestedW1
    },
    ballast2: {
      name: ballast2.item.name,
      currentWeight: w2,
      suggestedWeight: suggestedW2
    },
    referenceWetCg
  };
}
