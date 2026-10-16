import { categoryConfig } from "../../src/category.config";
import products from "../../src/data/products.json";
import type { Product } from "../../src/lib/products";
import type { CategoryPack } from "../category-pack";

export const radarTailLightPack = {
  category: "radar-tail-light",
  config: categoryConfig,
  products: products as Product[],
} satisfies CategoryPack;
