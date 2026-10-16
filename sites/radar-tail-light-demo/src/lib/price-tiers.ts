import type { PriceTier } from "./category-types";

export interface TierRange {
  tier: PriceTier;
  /** 段下限（不含）；第一段为 null 表示从 0 起 */
  min: number | null;
  /** 段上限（含）；最后一段为 null 表示上不封顶 */
  max: number | null;
}

/** 把价格段序列解析为连续区间（前一段的 max 即后一段的 min） */
export function tierRanges(tiers: readonly PriceTier[]): TierRange[] {
  return tiers.map((tier, index) => ({
    tier,
    min: index === 0 ? null : tiers[index - 1].max ?? null,
    max: tier.max ?? null,
  }));
}

/** 价格所属价格段；超出所有上限时归入最后一段 */
export function tierForPrice(
  price: number,
  tiers: readonly PriceTier[],
): PriceTier | null {
  if (tiers.length === 0) return null;
  for (const tier of tiers) {
    if (tier.max !== undefined && price <= tier.max) return tier;
  }
  return tiers[tiers.length - 1];
}

/** 段内销量排名：返回 asin → { tierKey, rank }（仅前三名） */
export function rankTopProductsByTier(
  products: ReadonlyArray<{ asin: string; price: number; monthlyUnits: number }>,
  tiers: readonly PriceTier[],
  topCount = 3,
): Map<string, { tierKey: string; rank: number }> {
  type Rankable = { asin: string; price: number; monthlyUnits: number };
  const result = new Map<string, { tierKey: string; rank: number }>();
  if (tiers.length === 0) return result;

  const byTier = new Map<string, Rankable[]>();
  for (const product of products) {
    const tier = tierForPrice(product.price, tiers);
    if (!tier) continue;
    const bucket = byTier.get(tier.key) ?? [];
    bucket.push(product);
    byTier.set(tier.key, bucket);
  }

  for (const [tierKey, bucket] of byTier) {
    const sorted = [...bucket].sort(
      (first, second) =>
        second.monthlyUnits - first.monthlyUnits ||
        first.price - second.price ||
        first.asin.localeCompare(second.asin),
    );
    sorted.slice(0, topCount).forEach((product, index) => {
      result.set(product.asin, { tierKey, rank: index + 1 });
    });
  }

  return result;
}
