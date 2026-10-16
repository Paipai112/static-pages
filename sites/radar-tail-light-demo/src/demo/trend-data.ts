import catalogue from '../data/products.json';
import type { AnalysisState, CandidateFilters, TrendPoint, TrendSeries } from './types';

/**
 * Interaction-demo fixture, not historical research data.
 * Only the public identity fields are read from the Roadmap catalogue. In
 * particular, monthlyUnits/monthlyRevenue are never used to invent history.
 * The four approved design curves are retained verbatim. Remaining quantities
 * and monthly selling prices are deterministic fictional values based on ID.
 * Revenue is rounded monthly quantity × the demo monthly selling price.
 * Brand and market series aggregate these same product points month by month.
 */
export const demoSource = '设计稿演示数据 · 非实际调研结果';
export const months = Array.from({ length: 12 }, (_, index) => {
  const absoluteMonth = 8 + index;
  return `${2025 + Math.floor(absoluteMonth / 12)}-${String(absoluteMonth % 12 + 1).padStart(2, '0')}`;
});

const designUnits: Record<string, number[]> = {
  'garmin-varia-rtl515': [1500, 1420, 1640, 1680, 1840, 1770, 1930, 2100, 2240, 2470, 2390, 2580],
  'coospo-tr70': [480, 500, 530, 510, 590, 630, 620, 700, 680, 790, 820, 850],
  'bryton-gardia-r300l': [410, 390, 450, 430, 480, 500, 510, 540, 590, 610, 640, 680],
  'magene-l508': [150, 170, 180, 160, 190, 210, 220, 240, 250, 290, 310, 340],
};
const designPrices: Record<string, number> = {
  'garmin-varia-rtl515': 179.99,
  'coospo-tr70': 69.99,
  'bryton-gardia-r300l': 109.99,
  'magene-l508': 99.99,
};
const designColors: Record<string, string> = {
  Garmin: '#218266', CooSpo: '#9367C8', Bryton: '#5A72E8', Magene: '#D79535',
  iGPSPORT: '#3C98AB', RAVEMEN: '#BF6B7D',
};

function hashIdentity(value: string): number {
  return [...value].reduce((hash, character) => ((hash * 31 + character.charCodeAt(0)) >>> 0), 7);
}

function seriesColor(brand: string): string {
  return designColors[brand] ?? `hsl(${hashIdentity(brand) % 360} 48% 42%)`;
}

const cents = (amount: number) => Math.round(amount * 100) / 100;

export const productSeries: TrendSeries[] = catalogue.map(({ productId, brand, model }) => {
  const seed = hashIdentity(productId);
  const known = designUnits[productId];
  const baseQuantity = 70 + seed % 330;
  const basePrice = designPrices[productId] ?? 39.99 + seed % 230;
  const points: TrendPoint[] = months.map((month, index) => {
    const units = known?.[index] ?? Math.round(
      baseQuantity * (0.88 + index * 0.045 + Math.sin(index * 1.1 + seed % 9) * 0.1),
    );
    const demoSellingPrice = cents(basePrice * (1 + ((seed + index) % 5 - 2) * 0.012));
    return { month, units, revenue: cents(units * demoSellingPrice) };
  });
  const color = known ? seriesColor(brand) : `hsl(${seed % 360} ${45 + seed % 15}% ${36 + seed % 15}%)`;
  return { id: productId, label: model, brand, color, points, source: demoSource, productCount: 1 };
});

function aggregatePoints(series: TrendSeries[]): TrendPoint[] {
  return months.map((month, index) => {
    const sum = (metric: 'units' | 'revenue') => {
      const values = series.map((item) => item.points[index][metric]).filter((value): value is number => value !== null);
      return values.length ? cents(values.reduce((total, value) => total + value, 0)) : null;
    };
    return { month, units: sum('units'), revenue: sum('revenue') };
  });
}

export const brandSeries: TrendSeries[] = [...new Set(productSeries.map((product) => product.brand!))].map((brand) => {
  const products = productSeries.filter((product) => product.brand === brand);
  return {
    id: brand, label: brand, brand, color: seriesColor(brand),
    points: aggregatePoints(products), productCount: products.length, source: demoSource,
  };
});

export const marketSeries: TrendSeries = {
  id: 'market:all', label: '本次调研总盘', color: '#218266',
  points: aggregatePoints(productSeries), productCount: productSeries.length, source: demoSource,
};

const emptyFilters = (): CandidateFilters => ({
  query: '', minUnits: '', maxUnits: '', minRevenue: '', maxRevenue: '', sort: 'units',
});

export const initialAnalysisState: AnalysisState = {
  view: 'products', metric: 'units', startMonth: months[0], endMonth: months[months.length - 1],
  productIds: Object.keys(designUnits),
  brandIds: ['Garmin', 'CooSpo', 'Bryton', 'Magene'],
  filters: { products: emptyFilters(), brands: emptyFilters() },
};
