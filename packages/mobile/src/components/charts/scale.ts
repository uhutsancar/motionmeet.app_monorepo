/**
 * Axis arithmetic shared by every chart.
 *
 * Ticks are round steps (1, 2, 2.5 or 5 times a power of ten) that start at
 * zero for bars and counts, and the top tick sits above the largest value so
 * no bar or line touches the plot's edge. Counts never get a fractional tick:
 * the old charts printed "0, 0, 1, 1, 1" for a month of one workout a day.
 */

const niceStep = (rough: number): number => {
  if (!(rough > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
};

/** Ticks from zero to a round value above `max`, about `count` steps. */
export const zeroBasedTicks = (max: number, count = 4, integer = false): number[] => {
  let step = niceStep(Math.max(max, integer ? 1 : 0.0001) / count);
  if (integer) step = Math.max(1, Math.ceil(step));
  let top = Math.ceil(max / step) * step;
  if (top <= max) top += step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
};

/**
 * Ticks around a series that does not start at zero, such as body weight:
 * 78-84 kg drawn from zero would be a flat line at the top of the plot.
 */
export const rangeTicks = (min: number, max: number, count = 4): number[] => {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    return rangeTicks(min - pad, max + pad, count);
  }
  const step = niceStep((max - min) / count);
  const bottom = Math.floor(min / step) * step;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = bottom; value <= top + step / 2; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
};

/**
 * The bar a chart opens on: the latest period that has something in it, so
 * the readout says "13 Ekim, 1 antrenman" rather than "today, 0" on a rest
 * day. Falls back to the last period when nothing was logged at all.
 */
export const latestActiveIndex = (values: number[]): number => {
  for (let index = values.length - 1; index >= 0; index -= 1) if (values[index] > 0) return index;
  return Math.max(0, values.length - 1);
};

/** Which x labels to print so they never crowd: every n-th, the last always. */
export const labelEvery = (count: number, width: number, minGap = 48): number =>
  Math.max(1, Math.ceil(count / Math.max(1, Math.floor(width / minGap))));
