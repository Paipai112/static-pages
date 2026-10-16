const DEFAULT_CARD_HEIGHT = 48;
const DEFAULT_MIN_GAP = 12;
const MINIMUM_VERTICAL_DISTANCE = 1;
const LARGE_GAP_MULTIPLIER = 8;
const DENSITY_CONTRAST_MULTIPLIER = 1.6;

export interface PriceSegment {
  minPrice: number;
  maxPrice: number;
  top: number;
  bottom: number;
  count: number;
  compressedGapAfter: boolean;
}

// 同系列相邻两张卡片（价格不同）之间的最小纵向像素需求；
// 用于把近价同系列产品在单列内垂直堆叠，而不是横向拆出内部子列。
export interface PriceStackConstraint {
  highPrice: number;
  lowPrice: number;
  minSpan: number;
}

export interface DistributionPriceScale {
  min: number;
  max: number;
  height: number;
  segments: PriceSegment[];
}

interface PriceLevel {
  price: number;
  count: number;
}

interface PriceScaleOptions {
  cardHeight?: number;
  levelGap?: number;
  minGap?: number;
  stackConstraints?: PriceStackConstraint[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function normalizeSize(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(value, MINIMUM_VERTICAL_DISTANCE)
    : fallback;
}

function levelDensity(
  levels: PriceLevel[],
  index: number,
  direction: -1 | 1,
  fallbackGap: number,
): number {
  const neighborIndex = index + direction;
  const level = levels[index];
  const neighbor = levels[neighborIndex];

  if (!neighbor) return level.count / Math.max(fallbackGap, 1);

  return (
    (level.count + neighbor.count) /
    Math.max(Math.abs(level.price - neighbor.price), fallbackGap, 1)
  );
}

function isCompressedGap(
  levels: PriceLevel[],
  gaps: number[],
  gapIndex: number,
  medianGap: number,
): boolean {
  const gap = gaps[gapIndex];
  if (gap < medianGap * LARGE_GAP_MULTIPLIER) return false;

  const gapDensity =
    (levels[gapIndex].count + levels[gapIndex + 1].count) / Math.max(gap, 1);
  const localDensity = Math.min(
    levelDensity(levels, gapIndex, -1, medianGap),
    levelDensity(levels, gapIndex + 1, 1, medianGap),
  );

  return gapDensity * DENSITY_CONTRAST_MULTIPLIER <= localDensity;
}

// 按堆叠约束拉伸价格段：每条约束把 [lowPrice, highPrice] 区间内的纵向像素
// 扩到 minSpan 以上。约束价格均为产品价格（即价格层，正好落在段边界），
// 每段取各约束分摊增量的最大值，可一次性满足全部约束。
function applyStackConstraints(
  segments: PriceSegment[],
  constraints: PriceStackConstraint[],
  levelGap: number,
): PriceSegment[] {
  if (segments.length === 0 || constraints.length === 0) return segments;

  const increments = new Array<number>(segments.length).fill(0);

  for (const constraint of constraints) {
    if (
      !(constraint.highPrice > constraint.lowPrice) ||
      !(constraint.minSpan > 0)
    ) {
      continue;
    }

    const covered: number[] = [];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (
        segment.minPrice >= constraint.lowPrice &&
        segment.maxPrice <= constraint.highPrice
      ) {
        covered.push(index);
      }
    }
    if (covered.length === 0) continue;

    const baseSpan = covered.reduce(
      (total, index) => total + (segments[index].bottom - segments[index].top),
      0,
    );
    const deficit = constraint.minSpan - baseSpan;
    if (deficit <= 0) continue;

    const share = deficit / covered.length;
    for (const index of covered) {
      increments[index] = Math.max(increments[index], share);
    }
  }

  let top = 0;
  return segments.map((segment, index) => {
    const height = segment.bottom - segment.top + increments[index];
    const stretched: PriceSegment = {
      ...segment,
      top,
      bottom: top + height,
      compressedGapAfter:
        segment.compressedGapAfter && height < levelGap,
    };
    top += height;
    return stretched;
  });
}

function buildLevels(prices: number[]): PriceLevel[] {
  const counts = new Map<number, number>();

  for (const price of prices) {
    if (!Number.isFinite(price)) continue;
    counts.set(price, (counts.get(price) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([first], [second]) => first - second)
    .map(([price, count]) => ({ price, count }));
}

export function buildDistributionPriceScale(
  prices: number[],
  options: PriceScaleOptions = {},
): DistributionPriceScale {
  const levels = buildLevels(prices);
  if (levels.length === 0) {
    return { min: 0, max: 0, height: 0, segments: [] };
  }

  const cardHeight = normalizeSize(options.cardHeight, DEFAULT_CARD_HEIGHT);
  const minGap = normalizeSize(options.minGap, DEFAULT_MIN_GAP);
  const levelGap = Math.max(
    normalizeSize(options.levelGap, cardHeight),
    minGap,
  );
  const min = levels[0].price;
  const max = levels[levels.length - 1].price;

  if (levels.length < 4) {
    const gaps = levels
      .slice(1)
      .map((level, index) => level.price - levels[index].price);
    const smallestGap = Math.min(...gaps);
    const height =
      levels.length === 1
        ? 0
        : Math.max(
            (levels.length - 1) * levelGap,
            (levelGap * (max - min)) / smallestGap,
          );

    let segments: PriceSegment[] = [
      {
        minPrice: min,
        maxPrice: max,
        top: 0,
        bottom: height,
        count: levels.reduce((total, level) => total + level.count, 0),
        compressedGapAfter: false,
      },
    ];

    // 带堆叠约束时细分为逐层分段：约束价格均为价格层，必须落在段边界上，
    // 拉伸才能精确生效（单段线性插值无法保证层间像素）。无约束时保持
    // 原单一分段行为不变。
    if ((options.stackConstraints?.length ?? 0) > 0 && levels.length >= 2) {
      segments = [];
      let top = 0;

      for (
        let lowerIndex = levels.length - 2;
        lowerIndex >= 0;
        lowerIndex -= 1
      ) {
        const lowerLevel = levels[lowerIndex];
        const upperLevel = levels[lowerIndex + 1];
        const bottom =
          top + (height * (upperLevel.price - lowerLevel.price)) / (max - min);

        segments.push({
          minPrice: lowerLevel.price,
          maxPrice: upperLevel.price,
          top,
          bottom,
          count: lowerLevel.count + upperLevel.count,
          compressedGapAfter: false,
        });
        top = bottom;
      }
    }

    const stretchedSegments = applyStackConstraints(
      segments,
      options.stackConstraints ?? [],
      levelGap,
    );

    return {
      min,
      max,
      height: stretchedSegments[stretchedSegments.length - 1]?.bottom ?? 0,
      segments: stretchedSegments,
    };
  }

  const gaps = levels.slice(1).map((level, index) => level.price - levels[index].price);
  const medianGap = median(gaps);
  const breakAfter = new Set<number>();

  for (let index = 0; index < gaps.length; index += 1) {
    if (isCompressedGap(levels, gaps, index, medianGap)) {
      breakAfter.add(index);
    }
  }

  const segments: PriceSegment[] = [];
  let top = 0;

  for (let lowerIndex = levels.length - 2; lowerIndex >= 0; lowerIndex -= 1) {
    const lowerLevel = levels[lowerIndex];
    const upperLevel = levels[lowerIndex + 1];
    const compressedGapAfter = breakAfter.has(lowerIndex);
    const bottom = top + (compressedGapAfter ? minGap : levelGap);

    segments.push({
      minPrice: lowerLevel.price,
      maxPrice: upperLevel.price,
      top,
      bottom,
      count: lowerLevel.count + upperLevel.count,
      compressedGapAfter,
    });

    top = bottom;
  }

  const stretchedSegments = applyStackConstraints(
    segments,
    options.stackConstraints ?? [],
    levelGap,
  );

  return {
    min,
    max,
    height: stretchedSegments[stretchedSegments.length - 1]?.bottom ?? 0,
    segments: stretchedSegments,
  };
}

export function priceToY(price: number, scale: DistributionPriceScale): number {
  const { segments } = scale;
  if (segments.length === 0) return 0;
  if (price >= scale.max) return segments[0].top;
  if (price <= scale.min) return segments[segments.length - 1].bottom;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (price >= segment.minPrice && price <= segment.maxPrice) {
      const priceRange = segment.maxPrice - segment.minPrice;
      if (priceRange === 0) return segment.top;

      return (
        segment.top +
        ((segment.maxPrice - price) / priceRange) *
          (segment.bottom - segment.top)
      );
    }

  }

  return segments[segments.length - 1].bottom;
}
