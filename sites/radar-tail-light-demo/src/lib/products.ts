export interface Product {
  /** 公开导入导出的稳定身份；不得使用或派生自 ASIN */
  productId: string;
  brand: string;
  model: string;
  /** 系列归属在数据准备阶段确定并写入数据，站点不做运行时推导 */
  series: string;
  asin: string;
  title: string;
  price: number;
  averagePrice: number;
  monthlyUnits: number;
  monthlyRevenue: number;
  rating: number | null;
  ratingCount: number | null;
  bsr: number;
  listingDate: string;
  fulfillment: string;
  sellerName: string;
  variationCount: number;
  qualityScore: number | null;
  weight: string | null;
  dimensions: string | null;
  badges: string[];
  amazonUrl: string;
  imageUrl: string | null;
  /** 品类关键字段的显示值（数据准备阶段已格式化，如 "1,300"）；缺失必须为 null，不得编造 */
  keyMetricValue: string | null;
  /** 关键字段数据来源说明（如 "商品标题"、"官网规格"），缺省 null */
  keyMetricSource: string | null;
  /** 品类专属属性表，键与 category.config.ts 的 drawerFields 对齐 */
  attributes: Record<string, string | null>;
}

import { tierForPrice } from "./price-tiers";
import type { PriceTier } from "./category-types";

export interface FilterState {
  brands: string[];
  series: string[];
  focus: FocusFilter;
  query: string;
  minPrice: number;
  maxPrice: number;
  /** 已选价格段 key（空 = 全部价格段） */
  tiers: string[];
}

export type FocusFilter = "all" | "focused" | "unfocused";

export interface Summary {
  count: number;
  priceRange: { min: number; max: number } | null;
  averagePrice: number;
  averageRating: number;
}

export function filterProducts(
  products: Product[],
  filters: FilterState,
  focusedAsins: ReadonlySet<string> = new Set(),
  priceTiers: readonly PriceTier[] = [],
): Product[] {
  const query = filters.query.trim().toLowerCase();

  return products.filter((product) => {
    const matchesBrand =
      filters.brands.length === 0 || filters.brands.includes(product.brand);
    const matchesQuery =
      query.length === 0 ||
      [product.model, product.asin, product.title].some((field) =>
        field.toLowerCase().includes(query),
      );
    const matchesSeries =
      filters.series.length === 0 || filters.series.includes(product.series);
    const isFocused = focusedAsins.has(product.asin);
    const matchesFocus =
      filters.focus === "all" ||
      (filters.focus === "focused" ? isFocused : !isFocused);
    const matchesPrice =
      product.price >= filters.minPrice && product.price <= filters.maxPrice;
    const tierKey = tierForPrice(product.price, priceTiers)?.key ?? "";
    const matchesTier =
      filters.tiers.length === 0 ||
      !priceTiers.length ||
      filters.tiers.includes(tierKey);

    return (
      matchesBrand &&
      matchesSeries &&
      matchesFocus &&
      matchesQuery &&
      matchesPrice &&
      matchesTier
    );
  });
}

export function seriesForBrands(
  products: Product[],
  brands: readonly string[],
): string[] {
  if (brands.length === 0) return [];

  return [
    ...new Set(
      products
        .filter((product) => brands.includes(product.brand))
        .map((product) => product.series),
    ),
  ].sort((first, second) => first.localeCompare(second));
}

export function summarizeProducts(products: Product[]): Summary {
  if (products.length === 0) {
    return {
      count: 0,
      priceRange: null,
      averagePrice: 0,
      averageRating: 0,
    };
  }

  const prices = products.map((product) => product.price);
  const ratings = products
    .map((product) => product.rating)
    .filter((rating): rating is number => rating !== null);

  return {
    count: products.length,
    priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
    averagePrice: prices.reduce((total, price) => total + price, 0) / prices.length,
    averageRating:
      ratings.length === 0
        ? 0
        : ratings.reduce((total, rating) => total + rating, 0) / ratings.length,
  };
}

export function orderBrands(products: Product[]): string[] {
  const highestPriceByBrand = new Map<string, number>();

  for (const product of products) {
    const currentHighest = highestPriceByBrand.get(product.brand);
    if (currentHighest === undefined || product.price > currentHighest) {
      highestPriceByBrand.set(product.brand, product.price);
    }
  }

  return [...highestPriceByBrand.entries()]
    .sort(([firstBrand, firstPrice], [secondBrand, secondPrice]) => {
      return firstPrice - secondPrice || firstBrand.localeCompare(secondBrand);
    })
    .map(([brand]) => brand);
}
