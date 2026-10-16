import type { Product } from "./products";

export const FOCUS_EXPORT_SCHEMA_VERSION = "1.0";
export const MAX_FOCUS_IMPORT_BYTES = 256 * 1024;
export const MAX_FOCUS_PRODUCTS = 1_000;

const PRODUCT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;
const PRIVATE_ASIN_PATTERN = /\bB0[A-Z0-9]{8}\b/i;
const AMAZON_URL_PATTERN = /https?:\/\/(?:www\.)?amazon\.[^/]+\/dp\//i;
const MAX_PRODUCT_ID_LENGTH = 128;
const MAX_PRODUCT_NAME_LENGTH = 300;
const ROOT_FIELDS = new Set(["schemaVersion", "exportedAt", "products"]);
const PRODUCT_FIELDS = new Set(["productId", "name"]);

export interface FocusExportProduct {
  productId: string;
  name: string;
}

export interface FocusExport {
  schemaVersion: typeof FOCUS_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  products: FocusExportProduct[];
}

export interface FocusImportResult {
  focusedAsins: Set<string>;
  importedCount: number;
  unknownProductIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyFields(
  value: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((field) => allowedFields.has(field));
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function validateExportProduct(
  value: unknown,
  index: number,
): FocusExportProduct {
  if (!isRecord(value) || !hasOnlyFields(value, PRODUCT_FIELDS)) {
    throw new Error(`第 ${index + 1} 个产品包含不支持的字段`);
  }

  const { name, productId } = value;
  if (
    typeof productId !== "string" ||
    productId.length > MAX_PRODUCT_ID_LENGTH ||
    !PRODUCT_ID_PATTERN.test(productId) ||
    ASIN_PATTERN.test(productId)
  ) {
    throw new Error(`第 ${index + 1} 个产品的 productId 无效`);
  }
  if (
    typeof name !== "string" ||
    name.length > MAX_PRODUCT_NAME_LENGTH ||
    PRIVATE_ASIN_PATTERN.test(name) ||
    AMAZON_URL_PATTERN.test(name)
  ) {
    throw new Error(`第 ${index + 1} 个产品的 name 无效`);
  }

  return { productId, name };
}

export function createFocusExport(
  catalog: readonly Product[],
  focusedAsins: ReadonlySet<string>,
  exportedAt: Date = new Date(),
): FocusExport {
  const products = catalog
    .filter((product) => focusedAsins.has(product.asin))
    .map((product) => ({ productId: product.productId, name: product.model }))
    .sort((first, second) => first.productId.localeCompare(second.productId));

  return {
    schemaVersion: FOCUS_EXPORT_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    products,
  };
}

export function serializeFocusExport(payload: FocusExport): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseFocusImport(
  rawValue: string,
  catalog: readonly Product[],
): FocusImportResult {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error("文件不是有效的 JSON");
  }

  if (!isRecord(parsedValue) || !hasOnlyFields(parsedValue, ROOT_FIELDS)) {
    throw new Error("关注名单结构无效或包含不支持的字段");
  }
  if (parsedValue.schemaVersion !== FOCUS_EXPORT_SCHEMA_VERSION) {
    throw new Error("关注名单版本不受支持");
  }
  if (!isIsoDate(parsedValue.exportedAt)) {
    throw new Error("关注名单导出时间无效");
  }
  if (!Array.isArray(parsedValue.products)) {
    throw new Error("关注名单 products 必须是数组");
  }
  if (parsedValue.products.length > MAX_FOCUS_PRODUCTS) {
    throw new Error(`关注名单最多支持 ${MAX_FOCUS_PRODUCTS} 个产品`);
  }

  const products = parsedValue.products.map(validateExportProduct);
  const seen = new Set<string>();
  for (const product of products) {
    if (seen.has(product.productId)) {
      throw new Error(`关注名单包含重复 productId：${product.productId}`);
    }
    seen.add(product.productId);
  }

  const catalogByProductId = new Map(
    catalog.map((product) => [product.productId, product] as const),
  );
  const knownProducts = products
    .map(({ productId }) => catalogByProductId.get(productId))
    .filter((product): product is Product => product !== undefined);
  const unknownProductIds = products
    .map(({ productId }) => productId)
    .filter((productId) => !catalogByProductId.has(productId));

  return {
    focusedAsins: new Set(knownProducts.map((product) => product.asin)),
    importedCount: knownProducts.length,
    unknownProductIds,
  };
}
