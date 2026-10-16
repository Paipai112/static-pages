"use client";

import { useEffect, useRef } from "react";
import { brandColor } from "../lib/brand-colors";
import type { CategoryConfigContract } from "../lib/category-types";
import { displayOptionalText } from "../lib/display";
import type { Product } from "../lib/products";

interface ProductDrawerProps {
  categoryConfig: Pick<
    CategoryConfigContract,
    "currencySymbol" | "keyMetric" | "drawerFields"
  > & Partial<Pick<CategoryConfigContract, "dataNote">>;
  focused: boolean;
  onClose: () => void;
  onToggleFocused: (product: Product) => void;
  product: Product;
}

const formatInteger = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const formatPrice = (value: number, currencySymbol: string) =>
  `${currencySymbol}${value.toFixed(2)}`;

function safeAmazonUrl(product: Product): string {
  try {
    const url = new URL(product.amazonUrl);
    if (
      url.protocol === "https:" &&
      (url.hostname === "amazon.com" || url.hostname.endsWith(".amazon.com"))
    ) {
      return url.href;
    }
  } catch {
    // 主数据链接异常时，退回 Amazon 标准 ASIN 路径。
  }

  return `https://www.amazon.com/dp/${encodeURIComponent(product.asin)}`;
}

const displayValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === ""
    ? "暂无数据"
    : String(value);

export function ProductDrawer({
  categoryConfig,
  focused,
  onClose,
  onToggleFocused,
  product,
}: ProductDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = `product-drawer-title-${product.asin}`;
  const formattedRating =
    product.rating === null ? "暂无数据" : product.rating.toFixed(1);
  const formattedRatingCount =
    product.ratingCount === null
      ? "暂无数据"
      : formatInteger.format(product.ratingCount);
  const keyMetricDisplay =
    product.keyMetricValue === null
      ? "暂无数据"
      : categoryConfig.keyMetric.unit
        ? `${product.keyMetricValue} ${categoryConfig.keyMetric.unit}`
        : product.keyMetricValue;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <div className="product-drawer__backdrop">
      <button
        aria-label="点击遮罩关闭产品详情"
        className="product-drawer__backdrop-action"
        data-testid="product-drawer-backdrop"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="product-drawer"
        ref={dialogRef}
        role="dialog"
      >
        <button
          aria-label="关闭产品详情"
          className="product-drawer__close"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          ×
        </button>

        <p
          className="product-drawer__brand"
          style={{ color: brandColor(product.brand) }}
        >
          {product.brand}
        </p>
        <h2 id={titleId}>{product.model} 产品详情</h2>

        <div className="product-drawer__image">
          <span>{product.brand}</span>
          {product.imageUrl ? (
            <img
              alt={`${product.brand} ${product.model}`}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
              src={product.imageUrl}
            />
          ) : null}
        </div>

        <p className="product-drawer__title">{product.title}</p>

        {categoryConfig.dataNote && <details className="product-drawer__context"><summary>统计口径</summary><p>{categoryConfig.dataNote}</p></details>}
        <dl className="product-drawer__facts">
          <div>
            <dt>产品系列</dt>
            <dd>{product.series}</dd>
          </div>
          <div>
            <dt>当前价</dt>
            <dd>{formatPrice(product.price, categoryConfig.currencySymbol)}</dd>
          </div>
          <div>
            <dt>平均价</dt>
            <dd>{formatPrice(product.averagePrice, categoryConfig.currencySymbol)}</dd>
          </div>
          <div>
            <dt>{categoryConfig.keyMetric.label}</dt>
            <dd>{keyMetricDisplay}</dd>
          </div>
          {product.keyMetricSource !== null ? (
            <div>
              <dt>数据来源</dt>
              <dd>{product.keyMetricSource}</dd>
            </div>
          ) : null}
          {categoryConfig.drawerFields.map((field) => (
            <div
              className={field.wide ? "product-drawer__fact--wide" : undefined}
              key={field.key}
            >
              <dt>{field.label}</dt>
              <dd>{displayValue(product.attributes[field.key])}</dd>
            </div>
          ))}
          <div>
            <dt>月销量估算</dt>
            <dd>{formatInteger.format(product.monthlyUnits)} 件</dd>
          </div>
          <div>
            <dt>月销售额估算</dt>
            <dd>
              {categoryConfig.currencySymbol}
              {formatInteger.format(product.monthlyRevenue)}
            </dd>
          </div>
          <div>
            <dt>评分 / 评论数</dt>
            <dd>{formattedRating} / {formattedRatingCount}</dd>
          </div>
          <div>
            <dt>BSR</dt>
            <dd>#{formatInteger.format(product.bsr)}</dd>
          </div>
          <div>
            <dt>上架时间</dt>
            <dd>{product.listingDate}</dd>
          </div>
          <div>
            <dt>履约</dt>
            <dd>{displayOptionalText(product.fulfillment)}</dd>
          </div>
          <div>
            <dt>卖家</dt>
            <dd>{displayValue(product.sellerName)}</dd>
          </div>
          <div>
            <dt>变体数</dt>
            <dd>{formatInteger.format(product.variationCount)}</dd>
          </div>
          <div>
            <dt>尺寸</dt>
            <dd>{displayValue(product.dimensions)}</dd>
          </div>
          <div>
            <dt>重量</dt>
            <dd>{displayValue(product.weight)}</dd>
          </div>
          <div>
            <dt>质量分</dt>
            <dd>{displayValue(product.qualityScore)}</dd>
          </div>
          <div>
            <dt>徽章</dt>
            <dd>
              {product.badges.length > 0
                ? product.badges.join(" · ")
                : "暂无数据"}
            </dd>
          </div>
        </dl>

        <button
          aria-pressed={focused}
          className="product-drawer__focus-action"
          onClick={() => onToggleFocused(product)}
          type="button"
        >
          {focused ? "取消关注" : "关注此产品"}
        </button>

        <a
          className="product-drawer__amazon-link"
          href={safeAmazonUrl(product)}
          rel="noreferrer"
          target="_blank"
        >
          查看 Amazon 商品页
        </a>
      </aside>
    </div>
  );
}
