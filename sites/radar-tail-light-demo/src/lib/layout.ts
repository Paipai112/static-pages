import { orderBrands, type Product } from "./products";
import {
  buildDistributionPriceScale,
  priceToY,
  type DistributionPriceScale,
  type PriceStackConstraint,
} from "./price-scale";
import {
  packSeriesLanes,
  type SeriesGroup,
  type VerticalInterval,
} from "./series-lanes";

export { priceToY } from "./price-scale";
export type {
  DistributionPriceScale,
  PriceSegment,
  PriceStackConstraint,
} from "./price-scale";

export const ROADMAP_CARD_WIDTH = 360;
export const ROADMAP_CARD_HEIGHT = 168;
export const ROADMAP_PRICE_LEVEL_GAP = 44;
// 同系列相邻卡片垂直堆叠时的最小纵向间隙；价格相同的卡片无法在价格轴上
// 分出高低，仍退回内部子列。
export const ROADMAP_STACK_GAP = 20;
const LANE_GAP = 24;
const BRAND_PADDING = 18;

export interface RoadmapCard {
  product: Product;
  brand: string;
  series: string;
  laneIndex: number;
  subLaneIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoadmapBrandRegion {
  brand: string;
  x: number;
  width: number;
  laneCount: number;
}

export interface RoadmapLaneLabel {
  brand: string;
  series: string[];
  laneIndex: number;
  x: number;
  width: number;
}

export interface RoadmapLayout {
  brands: string[];
  brandRegions: RoadmapBrandRegion[];
  laneLabels: RoadmapLaneLabel[];
  cards: RoadmapCard[];
  priceScale: DistributionPriceScale;
  width: number;
  height: number;
}

interface PositionedProduct {
  product: Product;
  subLaneIndex: number;
  y: number;
}

function compareText(first: string, second: string): number {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function rectanglesOverlap(first: RoadmapCard, second: RoadmapCard): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

function intervalsOverlap(
  first: VerticalInterval,
  second: VerticalInterval,
): boolean {
  return first.start < second.end && second.start < first.end;
}

// 同系列产品按价格降序两两相邻（价格不等）时，要求价格轴在这两价之间
// 至少留出“卡片高度 + 堆叠间隙”的纵向像素，使近价产品在单列内垂直堆叠。
function buildStackConstraints(products: Product[]): PriceStackConstraint[] {
  const productsBySeries = new Map<string, Product[]>();

  for (const product of products) {
    const key = `${product.brand} ${product.series}`;
    const seriesProducts = productsBySeries.get(key) ?? [];
    seriesProducts.push(product);
    productsBySeries.set(key, seriesProducts);
  }

  const constraints: PriceStackConstraint[] = [];
  const minSpan = ROADMAP_CARD_HEIGHT + ROADMAP_STACK_GAP;

  for (const seriesProducts of productsBySeries.values()) {
    const sorted = [...seriesProducts].sort(
      (first, second) =>
        second.price - first.price || compareText(first.asin, second.asin),
    );

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const higher = sorted[index];
      const lower = sorted[index + 1];
      if (higher.price > lower.price) {
        constraints.push({
          highPrice: higher.price,
          lowPrice: lower.price,
          minSpan,
        });
      }
    }
  }

  return constraints;
}

function positionSeriesProducts(
  products: Product[],
  priceScale: DistributionPriceScale,
): PositionedProduct[] {
  const sortedProducts = [...products].sort(
    (first, second) =>
      second.price - first.price || compareText(first.asin, second.asin),
  );
  const subLaneIntervals: VerticalInterval[][] = [];

  return sortedProducts.map((product) => {
    const y = priceToY(product.price, priceScale);
    const interval = { start: y, end: y + ROADMAP_CARD_HEIGHT };
    let subLaneIndex = subLaneIntervals.findIndex((intervals) =>
      intervals.every((candidate) => !intervalsOverlap(interval, candidate)),
    );

    if (subLaneIndex === -1) {
      subLaneIndex = subLaneIntervals.length;
      subLaneIntervals.push([]);
    }

    subLaneIntervals[subLaneIndex].push(interval);

    return { product, subLaneIndex, y };
  });
}

function logicalLaneWidth(
  series: string[],
  positionedBySeries: Map<string, PositionedProduct[]>,
): number {
  const subLaneCount = Math.max(
    1,
    ...series.map((seriesName) => {
      const products = positionedBySeries.get(seriesName) ?? [];
      return Math.max(0, ...products.map((product) => product.subLaneIndex + 1));
    }),
  );

  return (
    subLaneCount * ROADMAP_CARD_WIDTH +
    Math.max(0, subLaneCount - 1) * LANE_GAP
  );
}

function validateLayout(products: Product[], cards: RoadmapCard[]): void {
  const inputAsins = products.map((product) => product.asin);
  const cardAsins = cards.map((card) => card.product.asin);

  if (new Set(inputAsins).size !== inputAsins.length) {
    throw new Error("Product ASINs must be unique before layout");
  }

  if (
    cards.length !== products.length ||
    new Set(cardAsins).size !== cardAsins.length
  ) {
    throw new Error("Roadmap layout must contain every ASIN exactly once");
  }

  for (let firstIndex = 0; firstIndex < cards.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < cards.length;
      secondIndex += 1
    ) {
      if (rectanglesOverlap(cards[firstIndex], cards[secondIndex])) {
        throw new Error(
          `Roadmap cards overlap: ${cards[firstIndex].product.asin} and ${cards[secondIndex].product.asin}`,
        );
      }
    }
  }
}

export function layoutProducts(products: Product[]): RoadmapLayout {
  const brands = orderBrands(products);
  const brandRegions: RoadmapBrandRegion[] = [];
  const laneLabels: RoadmapLaneLabel[] = [];
  const cards: RoadmapCard[] = [];

  if (products.length === 0) {
    return {
      brands,
      brandRegions,
      laneLabels,
      cards,
      priceScale: buildDistributionPriceScale([]),
      width: 0,
      height: 0,
    };
  }

  const priceScale = buildDistributionPriceScale(
    products.map((product) => product.price),
    {
      cardHeight: ROADMAP_CARD_HEIGHT,
      levelGap: ROADMAP_PRICE_LEVEL_GAP,
      stackConstraints: buildStackConstraints(products),
    },
  );
  let brandX = 0;

  for (const brand of brands) {
    const brandProducts = products.filter((product) => product.brand === brand);
    const productsBySeries = new Map<string, Product[]>();

    for (const product of brandProducts) {
      const seriesProducts = productsBySeries.get(product.series) ?? [];
      seriesProducts.push(product);
      productsBySeries.set(product.series, seriesProducts);
    }

    const positionedBySeries = new Map<string, PositionedProduct[]>();
    const groups: SeriesGroup[] = [...productsBySeries.entries()].map(
      ([series, seriesProducts]) => {
        const positionedProducts = positionSeriesProducts(
          seriesProducts,
          priceScale,
        );
        positionedBySeries.set(series, positionedProducts);

        return {
          series,
          productAsins: positionedProducts.map(
            ({ product }) => product.asin,
          ),
          intervals: positionedProducts.map(({ y }) => ({
            start: y,
            end: y + ROADMAP_CARD_HEIGHT,
          })),
        };
      },
    );
    const packedLanes = packSeriesLanes(groups);
    const laneCards: RoadmapCard[][] = packedLanes.map((lane) =>
      lane.series.flatMap((series) =>
        (positionedBySeries.get(series) ?? []).map(
          ({ product, subLaneIndex, y }) => ({
            product,
            brand,
            series,
            laneIndex: lane.index,
            subLaneIndex,
            x: 0,
            y,
            width: ROADMAP_CARD_WIDTH,
            height: ROADMAP_CARD_HEIGHT,
          }),
        ),
      ),
    );
    const laneWidths = packedLanes.map((lane) =>
      logicalLaneWidth(lane.series, positionedBySeries),
    );

    const laneCount = laneCards.length;
    const brandWidth =
      BRAND_PADDING * 2 +
      laneWidths.reduce((total, width) => total + width, 0) +
      Math.max(0, laneCount - 1) * LANE_GAP;

    brandRegions.push({ brand, x: brandX, width: brandWidth, laneCount });

    let laneX = brandX + BRAND_PADDING;

    laneCards.forEach((cardsInLane, laneIndex) => {
      const laneWidth = laneWidths[laneIndex];
      const series = [...new Set(cardsInLane.map((card) => card.series))].sort(
        compareText,
      );

      laneLabels.push({
        brand,
        series,
        laneIndex,
        x: laneX,
        width: laneWidth,
      });

      for (const card of cardsInLane) {
        card.x =
          laneX + card.subLaneIndex * (ROADMAP_CARD_WIDTH + LANE_GAP);
        cards.push(card);
      }

      laneX += laneWidth + LANE_GAP;
    });

    brandX += brandWidth;
  }

  validateLayout(products, cards);

  return {
    brands,
    brandRegions,
    laneLabels,
    cards,
    priceScale,
    width: brandX,
    height: priceScale.height,
  };
}
