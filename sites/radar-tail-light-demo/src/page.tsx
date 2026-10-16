"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoryPack } from "../categories/category-pack";
import { Filters } from "./components/Filters";
import type { FocusTransferMessage } from "./components/FocusTransferControls";
import { ProductDrawer } from "./components/ProductDrawer";
import { Roadmap } from "./components/Roadmap";
import {
  getBrowserFocusStorage,
  loadFocusedAsins,
  saveFocusedAsins,
} from "./lib/focus-storage";
import {
  createFocusExport,
  MAX_FOCUS_IMPORT_BYTES,
  parseFocusImport,
  serializeFocusExport,
} from "./lib/focus-transfer";
import { layoutProducts } from "./lib/layout";
import { rankTopProductsByTier } from "./lib/price-tiers";
import {
  filterProducts,
  orderBrands,
  seriesForBrands,
  type FilterState,
  type Product,
} from "./lib/products";

interface HomePageProps {
  pack: CategoryPack;
}

export default function HomePage({ pack }: HomePageProps) {
  const categoryConfig = pack.config;
  const catalog = useMemo(() => [...pack.products], [pack.products]);
  const catalogBrands = useMemo(() => orderBrands(catalog), [catalog]);
  const catalogMaxPrice = useMemo(
    () => Math.max(0, ...catalog.map((product) => product.price)),
    [catalog],
  );
  const validCatalogAsins = useMemo(
    () => new Set(catalog.map((product) => product.asin)),
    [catalog],
  );
  const initialFilters = useMemo<FilterState>(
    () => ({
      brands: catalogBrands,
      series: [],
      focus: "all",
      maxPrice: catalogMaxPrice,
      minPrice: 0,
      tiers: [],
      query: "",
    }),
    [catalogBrands, catalogMaxPrice],
  );
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [focusedAsins, setFocusedAsins] = useState<Set<string>>(new Set());
  const [focusedAsinsLoaded, setFocusedAsinsLoaded] = useState(false);
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);
  const [focusSelectionMode, setFocusSelectionMode] = useState(false);
  const [focusTransferMessage, setFocusTransferMessage] =
    useState<FocusTransferMessage>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const priceTiers = useMemo(
    () => categoryConfig.priceTiers ?? [],
    [categoryConfig.priceTiers],
  );
  const filteredProducts = useMemo(
    () =>
      filters.brands.length === 0
        ? []
        : filterProducts(catalog, filters, focusedAsins, priceTiers),
    [catalog, filters, focusedAsins, priceTiers],
  );
  const seriesOptions = useMemo(
    () => seriesForBrands(catalog, filters.brands),
    [catalog, filters.brands],
  );
  const roadmap = useMemo(
    () => layoutProducts(filteredProducts),
    [filteredProducts],
  );
  // 段内销量 TOP3（按全部目录产品计算，不随筛选变化，保证排名稳定）
  const tierRanks = useMemo(
    () => rankTopProductsByTier(catalog, priceTiers),
    [catalog, priceTiers],
  );

  useEffect(() => {
    setFilters(initialFilters);
    setSelectedProduct(null);
  }, [initialFilters]);

  useEffect(() => {
    document.title = categoryConfig.siteTitle;
  }, [categoryConfig.siteTitle]);

  useEffect(() => {
    setFocusedCategory(categoryConfig.category);
    setFocusedAsinsLoaded(false);
    const restoreHandle = window.setTimeout(() => {
      setFocusedAsins(
        loadFocusedAsins(
          getBrowserFocusStorage(),
          validCatalogAsins,
          categoryConfig.category,
        ),
      );
      setFocusedAsinsLoaded(true);
    }, 0);

    return () => window.clearTimeout(restoreHandle);
  }, [categoryConfig.category, validCatalogAsins]);

  useEffect(() => {
    if (!focusedAsinsLoaded || focusedCategory !== categoryConfig.category) {
      return;
    }
    saveFocusedAsins(
      getBrowserFocusStorage(),
      focusedAsins,
      categoryConfig.category,
    );
  }, [categoryConfig.category, focusedAsins, focusedAsinsLoaded, focusedCategory]);

  const updateFilters = (nextFilters: FilterState) => {
    const validSeries = new Set(seriesForBrands(catalog, nextFilters.brands));
    setFilters({
      ...nextFilters,
      series: nextFilters.series.filter((series) => validSeries.has(series)),
    });
  };

  const toggleFocusedAsin = (asin: string) => {
    setFocusTransferMessage(null);
    setFocusedAsins((current) => {
      const next = new Set(current);
      if (next.has(asin)) next.delete(asin);
      else next.add(asin);
      return next;
    });
  };

  const exportFocusedProducts = () => {
    const payload = createFocusExport(catalog, focusedAsins);
    const blob = new Blob([serializeFocusExport(payload)], {
      type: "application/json;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${categoryConfig.category}-focused-products.json`;
    link.click();
    URL.revokeObjectURL(objectUrl);
    setFocusTransferMessage({
      type: "success",
      text: `已导出 ${payload.products.length} 个重点关注产品`,
    });
  };

  const importFocusedProducts = async (file: File) => {
    try {
      if (file.size > MAX_FOCUS_IMPORT_BYTES) {
        throw new Error("文件过大，最大支持 256 KB");
      }
      const result = parseFocusImport(await file.text(), catalog);
      setFocusedAsins(result.focusedAsins);
      const skipped = result.unknownProductIds.length;
      setFocusTransferMessage({
        type: "success",
        text: `已导入 ${result.importedCount} 个重点关注产品${skipped > 0 ? `，跳过 ${skipped} 个当前目录中不存在的产品` : ""}`,
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "文件读取失败";
      setFocusTransferMessage({
        type: "error",
        text: `关注列表导入失败：${reason}`,
      });
    }
  };

  return (
    <main className="roadmap-page">
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">{categoryConfig.eyebrow}</p>
          <h1>{categoryConfig.siteTitle}</h1>
          <p className="hero__lede">{categoryConfig.siteLede}</p>
        </div>
        <div className="snapshot" aria-label="数据快照日期">
          <span className="snapshot__dot" />
          数据快照 · {categoryConfig.snapshotDate}
        </div>
      </header>

      <Filters
        brands={catalogBrands}
        currencySymbol={categoryConfig.currencySymbol}
        filters={filters}
        focusSelectionMode={focusSelectionMode}
        focusedCount={focusedAsins.size}
        focusTransferMessage={focusTransferMessage}
        maxCatalogPrice={catalogMaxPrice}
        onChange={updateFilters}
        onExportFocus={exportFocusedProducts}
        onImportFocus={importFocusedProducts}
        onReset={() => setFilters(initialFilters)}
        onToggleFocusMode={() => setFocusSelectionMode((current) => !current)}
        priceTierOptions={priceTiers.map((tier) => ({ key: tier.key, label: tier.label }))}
        seriesOptions={seriesOptions}
        totalCount={catalog.length}
        visibleCount={filteredProducts.length}
      />

      <section className="roadmap-section" aria-labelledby="roadmap-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BRAND × PRICE</p>
            <h2 id="roadmap-heading">品牌价格路标</h2>
          </div>
          <p>价格越高位置越靠上 · 底色区分入门/中端/旗舰价格段 · ⌘/Ctrl + 滚轮缩放路标</p>
        </div>
        {filteredProducts.length === 0 ? (
          <div className="roadmap-empty" role="status">
            <strong>没有符合筛选条件的产品</strong>
            <p>请放宽品牌、价格或评分条件，或重置筛选。</p>
          </div>
        ) : (
          <Roadmap
            categoryConfig={categoryConfig}
            focusedAsins={focusedAsins}
            focusSelectionMode={focusSelectionMode}
            layout={roadmap}
            onProductAction={(product) =>
              focusSelectionMode
                ? toggleFocusedAsin(product.asin)
                : setSelectedProduct(product)
            }
            priceTiers={priceTiers}
            products={filteredProducts}
            tierRanks={tierRanks}
          />
        )}
      </section>

      {selectedProduct ? (
        <ProductDrawer
          categoryConfig={categoryConfig}
          focused={focusedAsins.has(selectedProduct.asin)}
          onClose={() => setSelectedProduct(null)}
          onToggleFocused={(product) => toggleFocusedAsin(product.asin)}
          product={selectedProduct}
        />
      ) : null}
    </main>
  );
}
