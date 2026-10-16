// 品牌色自动分配：不逐品类配置颜色，按品牌名稳定散列到调色板。
// 调色板按可辨识度排序，前几个色相差异最大，常见 2-4 品牌场景下不会撞色。

const PALETTE = [
  "#ff5b36", // 橙红
  "#15a36d", // 绿
  "#2979ff", // 蓝
  "#9333ea", // 紫
  "#d97706", // 琥珀
  "#0d9488", // 青
  "#db2777", // 品红
  "#65a30d", // 橄榄绿
  "#475569", // 石板灰
  "#7c3aed", // 深紫
] as const;

export function brandColor(brand: string): string {
  let hash = 0;
  for (let index = 0; index < brand.length; index += 1) {
    hash = (hash * 31 + brand.charCodeAt(index)) | 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}
