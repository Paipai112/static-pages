import { FocusTransferControls, type FocusTransferMessage } from "./FocusTransferControls";
import type { FilterState } from "../lib/products";

interface FiltersProps {
  brands: string[];
  currencySymbol: string;
  seriesOptions: string[];
  filters: FilterState;
  focusSelectionMode: boolean;
  focusedCount: number;
  focusTransferMessage: FocusTransferMessage;
  maxCatalogPrice: number;
  onChange: (filters: FilterState) => void;
  onExportFocus: () => void;
  onImportFocus: (file: File) => Promise<void>;
  onReset: () => void;
  totalCount: number;
  visibleCount: number;
  onToggleFocusMode: () => void;
  priceTierOptions: ReadonlyArray<{ key: string; label: string }>;
}

export function Filters({
  brands,
  currencySymbol,
  seriesOptions,
  filters,
  focusSelectionMode,
  focusedCount,
  focusTransferMessage,
  maxCatalogPrice,
  onChange,
  onExportFocus,
  onImportFocus,
  onReset,
  totalCount,
  visibleCount,
  onToggleFocusMode,
  priceTierOptions,
}: FiltersProps) {
  const toggleBrand = (brand: string, checked: boolean) => {
    const nextBrands = checked
      ? [...filters.brands, brand]
      : filters.brands.filter((candidate) => candidate !== brand);

    onChange({ ...filters, brands: nextBrands });
  };

  const toggleSeries = (series: string, checked: boolean) => {
    const nextSeries = checked
      ? [...filters.series, series]
      : filters.series.filter((candidate) => candidate !== series);

    onChange({ ...filters, series: nextSeries });
  };

  return (
    <section className="filters" aria-label="产品筛选">
      <div className="filters__controls">
        <label className="filter-field filter-field--search">
          <span>搜索产品</span>
          <input
            onChange={(event) =>
              onChange({ ...filters, query: event.currentTarget.value })
            }
            placeholder="型号或标题"
            type="search"
            value={filters.query}
          />
        </label>

        <label className="filter-field">
          <span>最低价格</span>
          <span className="filter-field__input-prefix">
            <span aria-hidden="true">{currencySymbol}</span>
            <input
              max={maxCatalogPrice}
              min="0"
              onChange={(event) =>
                onChange({
                  ...filters,
                  minPrice: Number(event.currentTarget.value),
                })
              }
              step="0.01"
              type="number"
              value={filters.minPrice}
            />
          </span>
        </label>

        <label className="filter-field">
          <span>最高价格</span>
          <span className="filter-field__input-prefix">
            <span aria-hidden="true">{currencySymbol}</span>
            <input
              max={maxCatalogPrice}
              min="0"
              onChange={(event) =>
                onChange({
                  ...filters,
                  maxPrice: Number(event.currentTarget.value),
                })
              }
              step="0.01"
              type="number"
              value={filters.maxPrice}
            />
          </span>
        </label>

        <label className="filter-field">
          <span>价格段</span>
          <select
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange({
                ...filters,
                tiers: value === "all" ? [] : [value],
              });
            }}
            value={filters.tiers.length === 1 ? filters.tiers[0] : "all"}
          >
            <option value="all">全部</option>
            {priceTierOptions.map((tier) => (
              <option key={tier.key} value={tier.key}>
                {tier.label}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>关注状态</span>
          <select
            onChange={(event) =>
              onChange({
                ...filters,
                focus: event.currentTarget.value as FilterState["focus"],
              })
            }
            value={filters.focus}
          >
            <option value="all">全部</option>
            <option value="focused">仅关注</option>
            <option value="unfocused">仅未关注</option>
          </select>
        </label>

        <button className="filters__reset" onClick={onReset} type="button">
          重置筛选
        </button>
        <button
          aria-pressed={focusSelectionMode}
          className="filters__reset"
          onClick={onToggleFocusMode}
          type="button"
        >
          {focusSelectionMode ? "完成设置" : "设置重点关注"}
        </button>
        <FocusTransferControls
          focusedCount={focusedCount}
          message={focusTransferMessage}
          onExport={onExportFocus}
          onImport={onImportFocus}
        />
      </div>

      <div className="filters__brand-row">
        <div className="filters__label">品牌筛选</div>
        <div className="filters__brands">
          {brands.map((brand) => (
            <label className="brand-filter" key={brand}>
              <input
                checked={filters.brands.includes(brand)}
                onChange={(event) =>
                  toggleBrand(brand, event.currentTarget.checked)
                }
                type="checkbox"
                value={brand}
              />
              <span>{brand}</span>
            </label>
          ))}
        </div>
        <p className="filters__count" aria-live="polite">
          当前 {visibleCount} / {totalCount} 款
        </p>
      </div>

      <div className="filters__brand-row">
        <div className="filters__label">系列筛选</div>
        <div className="filters__brands">
          {seriesOptions.map((series) => (
            <label className="brand-filter" key={series}>
              <input
                checked={filters.series.includes(series)}
                onChange={(event) =>
                  toggleSeries(series, event.currentTarget.checked)
                }
                type="checkbox"
                value={series}
              />
              <span>{series}</span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
