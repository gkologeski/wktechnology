type Line = { hours: number };

/** Decimal input values as integers: same half-up rounding as PostgreSQL numeric. */
function decimal(value: number): { coefficient: bigint; scale: number } {
  if (!Number.isFinite(value) || value < 0) throw new Error("Valor da compra inválido.");
  const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
  const [integer, fraction = ""] = mantissa.split(".");
  const scale = fraction.length - Number(exponent);
  return scale < 0
    ? { coefficient: BigInt(integer + fraction) * 10n ** BigInt(-scale), scale: 0 }
    : { coefficient: BigInt(integer + fraction), scale };
}

export function purchaseProposalAmounts(input: {
  hours: number;
  hourlyRate: number;
  milestones: Line[];
}) {
  const hours = decimal(input.hours),
    rate = decimal(input.hourlyRate);
  const divisor = 10n ** BigInt(hours.scale + rate.scale);
  const totalCents = (hours.coefficient * rate.coefficient * 100n + divisor / 2n) / divisor;
  if (totalCents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("O valor da compra excede o limite de precisão monetária.");
  const quantities = input.milestones.map((line) => decimal(line.hours));
  const scale = Math.max(0, ...quantities.map((line) => line.scale));
  const weights = quantities.map((line) => line.coefficient * 10n ** BigInt(scale - line.scale));
  const sum = weights.reduce((a, b) => a + b, 0n);
  if (sum === 0n)
    return {
      total: Number(totalCents) / 100,
      totalCents: Number(totalCents),
      milestones: [] as number[],
    };
  const cents = weights.map((weight) => (totalCents * weight) / sum);
  let remaining = totalCents - cents.reduce((a, b) => a + b, 0n);
  const order = weights
    .map((weight, index) => ({ index, remainder: (totalCents * weight) % sum }))
    .sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
    );
  for (const row of order) {
    if (remaining === 0n) break;
    cents[row.index] += 1n;
    remaining -= 1n;
  }
  return {
    total: Number(totalCents) / 100,
    totalCents: Number(totalCents),
    milestones: cents.map((value) => Number(value) / 100),
  };
}
