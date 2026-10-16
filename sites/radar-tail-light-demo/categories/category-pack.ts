import type {
  CategoryConfigContract,
  DrawerField,
} from "../src/lib/category-types";
import {
  validateCategoryConfig,
  validateProductAttributes,
} from "../src/lib/category-types";
import type { Product } from "../src/lib/products";

export interface CategoryPack {
  category: string;
  config: CategoryConfigContract;
  products: readonly Product[];
}

export function validateCategoryPack(pack: CategoryPack): string[] {
  const errors = [...validateCategoryConfig(pack.config)];
  const drawerFields: readonly DrawerField[] = pack.config.drawerFields;
  const productIds = new Set<string>();

  if (pack.category !== pack.config.category) {
    errors.push("能力包 category 必须与 config.category 一致");
  }

  for (const [index, product] of pack.products.entries()) {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(product.productId)) {
      errors.push(`第 ${index + 1} 项：productId 格式不合法`);
    }
    if (product.productId.toUpperCase() === product.asin.toUpperCase()) {
      errors.push(`第 ${index + 1} 项：productId 不得使用 ASIN`);
    }
    if (productIds.has(product.productId)) {
      errors.push(`第 ${index + 1} 项：productId 重复`);
    }
    productIds.add(product.productId);
    errors.push(
      ...validateProductAttributes(product.attributes, drawerFields).map(
        (error) => `第 ${index + 1} 项：${error}`,
      ),
    );
  }

  return errors;
}
