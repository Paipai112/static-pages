import type { PriceTier } from "./category-types";
import { priceToY, type DistributionPriceScale } from "./price-scale";
import { tierForPrice, tierRanges } from "./price-tiers";

export interface PriceAxisTick {
  /** Actual price, never a rounded label substituted for another position. */
  price: number;
  /** Unscaled plot coordinate; callers apply their existing zoom transform. */
  top: number;
  kind: "domain" | "tier" | "regular";
}

export interface PriceAxisOptions {
  tiers?: readonly PriceTier[];
  zoom?: number;
  minTickGapPx?: number;
  /** Includes both bounds of each planning tier; defaults to five. */
  maxTicksPerTier?: number;
}

const DEFAULT_MIN_TICK_GAP_PX = 48;
const DEFAULT_MAX_TICKS_PER_TIER = 5;
// Without user tiers, the entire domain is one planning range with at most eight ticks.
const MAX_UNTIERED_TICKS = 8;
const NICE_FACTORS = [1, 2, 2.5, 5, 10];

function positiveOption(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function niceCandidates(min: number, max: number, target: number): number[] {
  const rawStep = (max - min) / Math.max(1, target - 1);
  if (!(rawStep > 0) || !Number.isFinite(rawStep)) return [];
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = NICE_FACTORS.map(factor => factor * magnitude).sort(
    (first, second) => Math.abs(Math.log(first / rawStep)) - Math.abs(Math.log(second / rawStep)),
  )[0];
  if (!(step > 0) || !Number.isFinite(step)) return [];

  const result: number[] = [];
  const first = Math.ceil(min / step);
  const last = Math.floor(max / step);
  for (let multiple = first; multiple <= last && result.length < 100; multiple += 1) {
    // Clean arithmetic noise on generated nice values; observed endpoints stay untouched.
    const price = Number((multiple * step).toPrecision(14));
    if (price > min && price < max) result.push(price);
  }
  return result;
}

/**
 * Plan labels independently of the card collision/price scale model.
 * Priority is domain endpoints, then user tier bounds, then regular nice ticks.
 * Ties favor the upper price, so even conflicting bounds have deterministic output.
 * All priorities obey the screen-pixel gap: an unreadable lower-priority bound is omitted.
 */
export function buildPriceAxisTicks(
  prices: readonly number[],
  scale: DistributionPriceScale,
  options: PriceAxisOptions = {},
): PriceAxisTick[] {
  const samples = prices.filter(price => Number.isFinite(price) && price >= scale.min && price <= scale.max);
  if (samples.length === 0 || scale.segments.length === 0) return [];
  const zoom = positiveOption(options.zoom, 1);
  const minGap = positiveOption(options.minTickGapPx, DEFAULT_MIN_TICK_GAP_PX);
  const tiers = options.tiers ?? [];
  const cap = Math.max(2, Math.floor(positiveOption(options.maxTicksPerTier, DEFAULT_MAX_TICKS_PER_TIER)));
  const accepted: PriceAxisTick[] = [];
  const tickFor = (price: number, kind: PriceAxisTick["kind"]): PriceAxisTick => ({ price, top: priceToY(price, scale), kind });
  const fits = (tick: PriceAxisTick) => accepted.every(
    existing => Math.abs(existing.top - tick.top) * zoom >= minGap - 1e-7,
  );
  const add = (tick: PriceAxisTick) => {
    if (!accepted.some(existing => existing.price === tick.price) && fits(tick)) accepted.push(tick);
  };

  add(tickFor(scale.max, "domain"));
  if (scale.min !== scale.max) add(tickFor(scale.min, "domain"));
  if (scale.min === scale.max) return accepted;

  const boundaries = [...new Set(tiers.flatMap(tier => tier.max === undefined ? [] : [tier.max]))]
    .filter(price => Number.isFinite(price) && price > scale.min && price < scale.max)
    .sort((first, second) => second - first);
  boundaries.forEach(price => add(tickFor(price, "tier")));

  const ranges = tiers.length > 0
    ? tierRanges(tiers).map(({tier, min, max}, index) => ({
        min: Math.max(scale.min, min ?? scale.min),
        // tierForPrice assigns prices above every finite bound to the final tier.
        max: index === tiers.length - 1 ? scale.max : Math.min(scale.max, max ?? scale.max),
        count: samples.filter(price => tierForPrice(price, tiers) === tier).length,
        cap,
      }))
    : [{min: scale.min, max: scale.max, count: samples.length, cap: MAX_UNTIERED_TICKS}];

  for (const range of [...ranges].sort((first, second) => second.max - first.max)) {
    if (range.count === 0 || !(range.max > range.min)) continue;
    const target = Math.min(range.cap, Math.max(2, Math.ceil(Math.sqrt(range.count)) + 1));
    // A finite final bound can become an extra internal boundary after extending
    // the final tier; count all retained priority ticks against this tier's budget.
    const priorityCount = accepted.filter(tick => tick.price >= range.min && tick.price <= range.max).length;
    const budget = Math.max(0, target - priorityCount);
    const candidates = niceCandidates(range.min, range.max, target).map(price => tickFor(price, "regular"));
    const top = priceToY(range.max, scale);
    const bottom = priceToY(range.min, scale);
    for (let slot = 1; slot <= budget; slot += 1) {
      const ideal = top + (bottom - top) * slot / (budget + 1);
      const candidate = [...candidates]
        .sort((first, second) => Math.abs(first.top - ideal) - Math.abs(second.top - ideal) || second.price - first.price)
        .find(tick => !accepted.some(existing => existing.price === tick.price) && fits(tick));
      if (candidate) add(candidate);
    }
  }
  return accepted.sort((first, second) => first.top - second.top || second.price - first.price);
}
