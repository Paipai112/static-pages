import type { CategoryConfig } from "../category.config";

export interface FocusStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getBrowserFocusStorage(): FocusStorage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// 存储键带品类标识（category.config.ts 提供），不同品类的站点互不串数据。
const storageKey = (category: CategoryConfig["category"]) =>
  `product-roadmap:${category}:focused-asins:v1`;

export function loadFocusedAsins(
  storage: FocusStorage | null,
  validAsins: ReadonlySet<string>,
  category: CategoryConfig["category"],
): Set<string> {
  try {
    if (storage === null) return new Set();
    const rawValue = storage.getItem(storageKey(category));
    if (rawValue === null) return new Set();

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return new Set();

    return new Set(
      parsedValue.filter(
        (asin): asin is string =>
          typeof asin === "string" && validAsins.has(asin),
      ),
    );
  } catch {
    return new Set();
  }
}

export function saveFocusedAsins(
  storage: FocusStorage | null,
  focused: ReadonlySet<string>,
  category: CategoryConfig["category"],
): void {
  try {
    if (storage === null) return;
    storage.setItem(
      storageKey(category),
      JSON.stringify([...focused].sort()),
    );
  } catch {
    // 浏览器可能禁用存储或达到配额；关注操作仍应在当前会话中可用。
  }
}
