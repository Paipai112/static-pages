"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {PointSummaryTooltip, type PointSummary} from "./PointSummaryTooltip";
import { brandColor } from "../lib/brand-colors";
import {
  ROADMAP_CARD_HEIGHT,
  priceToY,
  type RoadmapLayout,
} from "../lib/layout";
import { tierRanges } from "../lib/price-tiers";
import { buildPriceAxisTicks } from "../lib/price-axis";
import type { CategoryConfigContract, PriceTier } from "../lib/category-types";
import type { Product } from "../lib/products";

interface RoadmapProps {
  active?: boolean;
  categoryConfig: Pick<CategoryConfigContract, "currencySymbol" | "keyMetric" | "cardMetrics"> & Partial<Pick<CategoryConfigContract, "dataNote">>;
  products: Product[];
  layout: RoadmapLayout;
  focusedAsins: ReadonlySet<string>;
  focusSelectionMode: boolean;
  onProductAction: (product: Product) => void;
  priceTiers: readonly PriceTier[];
  tierRanks: ReadonlyMap<string, { tierKey: string; rank: number }>;
}

// 品牌栏内容（色标 + h3 + p + 上下 padding）约 66px，高度须留出余量，
// 否则浏览器页面放大时分数像素取整会把文字顶部/底部裁掉。
const BRAND_HEADER_HEIGHT = 72;
const LANE_LABEL_HEIGHT = 20;
const HEADER_HEIGHT = BRAND_HEADER_HEIGHT + LANE_LABEL_HEIGHT;
const CANVAS_BOTTOM_PADDING = 32;
// 顶部留出几像素，避免价格轴最高刻度值被裁切
const PLOT_TOP_PAD = 12;
const AXIS_LINE_BOTTOM_PADDING = 28;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.2;
const ZOOM_WHEEL_SENSITIVITY = 0.0016;

interface ZoomAnchor {
  contentX: number;
  contentY: number;
  originX: number;
  originY: number;
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
const roundZoomPercent = (zoom: number) => Math.round(zoom * 100);

const brandClassName = (brand: string) => brand.toLowerCase();
const formatInteger = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function Roadmap({
  active = true,
  categoryConfig,
  products,
  layout,
  focusedAsins,
  focusSelectionMode,
  onProductAction,
  priceTiers,
  tierRanks,
}: RoadmapProps) {
  const [hovered,setHovered]=useState<(PointSummary & {id:string})|null>(null);
  useEffect(() => { if (!active) setHovered(null); }, [active]);
  // Preserve the supplied sales window without printing the complete data policy on cards.
  const hasSixMonthWindow = /(?:最近|近)\s*[6六]\s*个?\s*(?:完整)?\s*月|半年/.test(categoryConfig.dataNote ?? "");
  const salesMetricLabel = hasSixMonthWindow ? "近6月平均销量" : "月销量";
  const salesStatus = categoryConfig.dataNote?.includes("估算") ? "数据状态：估算" : null;
  const formatBandPrice = (price: number) => `${categoryConfig.currencySymbol}${new Intl.NumberFormat("en-US", {maximumFractionDigits: 2}).format(price)}`;
  const formatRevenue = (value: number) =>
    `${categoryConfig.currencySymbol}${formatInteger.format(value)}`;
  const formatAxisPrice = (price: number) =>
    `${categoryConfig.currencySymbol}${price.toFixed(2)}`;
  const keyMetricText = (product: Product) => {
    if (product.keyMetricValue === null) {
      return `${categoryConfig.keyMetric.label}：暂无数据`;
    }
    const suffix = categoryConfig.keyMetric.unit
      ? ` ${categoryConfig.keyMetric.unit}`
      : "";
    return `${categoryConfig.keyMetric.label}：${product.keyMetricValue}${suffix}`;
  };
  const cardChips = (product: Product) => {
    const chips = (categoryConfig.cardMetrics ?? []).map((metric) => {
      const raw = product.attributes?.[metric.key];
      if (raw === null || raw === undefined || raw === "") return null;
      const suffix = metric.unit ? ` ${metric.unit}` : "";
      return `${metric.label} ${raw}${suffix}`;
    });
    return chips.filter((chip): chip is string => chip !== null);
  };
  const productDetails = new Map(products.map((product) => [product.asin, product]));
  const plotWidth = layout.width;
  const plotHeight = layout.height + ROADMAP_CARD_HEIGHT + CANVAS_BOTTOM_PADDING;
  const axisLineHeight = Math.max(0, plotHeight - AXIS_LINE_BOTTOM_PADDING);
  // 价格段背景分区：覆盖整个画布（含底部卡片区与内边距，避免底部无底色）
  const tierBands = (() => {
    if (priceTiers.length === 0 || layout.priceScale.segments.length === 0) {
      return [];
    }
    const plotTop = 0;
    const plotBottom = plotHeight;
    return tierRanges(priceTiers)
      .map(({ tier, min, max }) => {
        const yMax = max === null ? plotTop : priceToY(max, layout.priceScale);
        const yMin = min === null ? plotBottom : priceToY(min, layout.priceScale);
        const bandTop = Math.max(plotTop, Math.min(yMax, yMin));
        const bandBottom = Math.min(plotBottom, Math.max(yMax, yMin));
        return {
          tier,
          min,
          max,
          top: bandTop,
          height: Math.max(0, bandBottom - bandTop),
        };
      })
      .filter((band) => band.height > 0);
  })();

  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const topbarRef = useRef<HTMLDivElement | null>(null);
  const leftAxisRef = useRef<HTMLDivElement | null>(null);
  const rightAxisRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // 固定轴面板与滚动视口同步：顶栏跟随横向滚动，左右价格轴跟随纵向滚动。
  const syncPanes = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (topbarRef.current) topbarRef.current.scrollLeft = viewport.scrollLeft;
    if (leftAxisRef.current) leftAxisRef.current.scrollTop = viewport.scrollTop;
    if (rightAxisRef.current) rightAxisRef.current.scrollTop = viewport.scrollTop;
  }, []);

  // 以视口内锚点（光标或中心）为基准缩放，保持内容点不漂移。
  const zoomAtPoint = useCallback(
    (nextZoom: number, originX?: number, originY?: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const currentZoom = zoomRef.current;
      const clampedZoom = clampZoom(nextZoom);
      if (clampedZoom === currentZoom) return;

      const rect = viewport.getBoundingClientRect();
      const anchorX = originX ?? rect.width / 2;
      const anchorY = originY ?? rect.height / 2;

      zoomAnchorRef.current = {
        contentX: (anchorX + viewport.scrollLeft) / currentZoom,
        contentY: (anchorY + viewport.scrollTop) / currentZoom,
        originX: anchorX,
        originY: anchorY,
      };
      zoomRef.current = clampedZoom;
      setZoom(clampedZoom);
    },
    [],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * ZOOM_WHEEL_SENSITIVITY);
      zoomAtPoint(
        zoomRef.current * factor,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [zoomAtPoint]);

  useIsomorphicLayoutEffect(() => {
    const viewport = viewportRef.current;
    const anchor = zoomAnchorRef.current;

    if (viewport && anchor) {
      viewport.scrollLeft = Math.max(
        0,
        anchor.contentX * zoom - anchor.originX,
      );
      viewport.scrollTop = Math.max(
        0,
        anchor.contentY * zoom - anchor.originY,
      );
      zoomAnchorRef.current = null;
    }

    syncPanes();
  }, [zoom, layout, syncPanes]);

  const axisTicks = buildPriceAxisTicks(products.map(product => product.price), layout.priceScale, {
    tiers: priceTiers,
    zoom,
  }).map(tick => ({...tick, key: `tick-${tick.kind}-${tick.price}`, label: formatAxisPrice(tick.price)}));
  const axisBreaks = layout.priceScale.segments.filter(
    (segment) => segment.compressedGapAfter,
  );
  const zoomPercent = roundZoomPercent(zoom);
  const scaledPlotWidth = Math.ceil(plotWidth * zoom);
  const scaledPlotHeight = Math.ceil((plotHeight + PLOT_TOP_PAD) * zoom);

  return (
    <div className="roadmap-scroll" role="region" aria-label="品牌与价格产品路标">
      <div className="roadmap-frame">
        <div aria-hidden="true" className="roadmap-corner" />
        <div
          aria-hidden="true"
          className="roadmap-topbar"
          data-testid="roadmap-topbar"
          ref={topbarRef}
        >
          {/* 外层按缩放后尺寸占位（驱动横向滚动同步），内层整体 transform 缩放，
              使字号与栏高同步缩放——避免"栏高随缩放变、字号不变"导致的裁切。 */}
          <div
            className="roadmap-topbar__content"
            style={{ width: scaledPlotWidth, height: HEADER_HEIGHT * zoom }}
          >
            <div
              className="roadmap-topbar__scaler"
              style={{
                width: plotWidth,
                height: HEADER_HEIGHT,
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {layout.brandRegions.map((region) => (
                <div
                  className="topbar-brand-boundary"
                  key={`boundary-${region.brand}`}
                  style={{ left: region.x, height: HEADER_HEIGHT }}
                />
              ))}
              {layout.brandRegions.map((region) => {
                const brandProducts = products.filter(
                  (product) => product.brand === region.brand,
                );
                const brandPrices = brandProducts.map((product) => product.price);
                return (
                  <div
                    className="topbar-brand"
                    data-testid={`brand-region-${region.brand}`}
                    key={region.brand}
                    style={{
                      left: region.x,
                      width: region.width,
                      height: BRAND_HEADER_HEIGHT,
                      "--brand-color": brandColor(region.brand),
                    } as React.CSSProperties}
                  >
                    <span className="brand-column__mark" aria-hidden="true" />
                    <div>
                      <h3>{region.brand}</h3>
                      <p>
                        {brandProducts.length} 款 · {region.laneCount} 条泳道 · {categoryConfig.currencySymbol}{Math.min(...brandPrices).toFixed(0)}–{categoryConfig.currencySymbol}{Math.max(...brandPrices).toFixed(0)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {layout.laneLabels.map((lane) => (
                <div
                  className="series-lane-label"
                  data-brand={lane.brand}
                  data-testid="series-lane-label"
                  key={`${lane.brand}-${lane.laneIndex}`}
                  style={{
                    left: lane.x,
                    width: lane.width,
                    top: BRAND_HEADER_HEIGHT,
                    height: LANE_LABEL_HEIGHT,
                  }}
                >
                  {lane.series.join(" · ")}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="roadmap-corner roadmap-corner--right" />

        <div
          className="roadmap-axis roadmap-axis--left"
          data-testid="price-axis-left"
          ref={leftAxisRef}
          role="presentation"
        >
          <div
            className="roadmap-axis__content"
            style={{ height: scaledPlotHeight }}
          >
            <div
              className="roadmap-axis__line"
              style={{ height: Math.ceil(axisLineHeight * zoom), top: PLOT_TOP_PAD * zoom }}
            />
            {axisTicks.map((tick) => (
              <div
                className="roadmap-axis__tick"
                data-price={tick.price}
                data-tick-kind={tick.kind}
                key={tick.key}
                style={{ top: (tick.top + PLOT_TOP_PAD) * zoom }}
              >
                <span aria-hidden="true" className="roadmap-axis__label">
                  {tick.label}
                </span>
              </div>
            ))}
            {axisBreaks.map((segment) => (
              <span
                aria-label="价格轴断点：空白价格区间已压缩"
                className="price-axis-break"
                data-axis-break
                key={`break-${segment.maxPrice}-${segment.minPrice}`}
                role="img"
                style={{ top: ((segment.top + segment.bottom) / 2 + PLOT_TOP_PAD) * zoom }}
              >
                <span aria-hidden="true">∕∕</span>
              </span>
            ))}
          </div>
        </div>

        <div
          className="roadmap-viewport"
          data-testid="roadmap-viewport"
          onScroll={syncPanes}
          ref={viewportRef}
        >
          <div
            className="roadmap-viewport__sizer"
            style={{ width: scaledPlotWidth, height: scaledPlotHeight }}
          >
            <div
              className="roadmap-canvas"
              style={{
                width: plotWidth,
                height: plotHeight + PLOT_TOP_PAD,
                paddingTop: PLOT_TOP_PAD,
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {tierBands.map((band) => (
                <div
                  aria-hidden="true"
                  className={`price-band price-band--${band.tier.key}`}
                  data-tier={band.tier.key}
                  key={`band-${band.tier.key}`}
                  style={{ top: band.top + PLOT_TOP_PAD, height: band.height }}
                >
                  <span className="price-band__label">
                    {band.tier.label}
                    <small>{band.max === null ? `>${formatBandPrice(band.min ?? 0)}` : `${formatBandPrice(band.min ?? 0)}–${formatBandPrice(band.max)}`}</small>
                  </span>
                </div>
              ))}
              {layout.priceScale.segments.map((segment, index) => (
                <div
                  className={`price-segment ${segment.compressedGapAfter ? "price-segment--compressed" : ""}`}
                  data-max-price={segment.maxPrice}
                  data-min-price={segment.minPrice}
                  key={`${segment.maxPrice}-${segment.minPrice}-${index}`}
                  style={{
                    top: segment.top + PLOT_TOP_PAD,
                    height: Math.max(1, segment.bottom - segment.top),
                  }}
                />
              ))}

              {axisTicks.map(tick => (
                <div
                  className="price-gridline"
                  data-price={tick.price}
                  data-tick-kind={tick.kind}
                  key={`gridline-${tick.key}`}
                  style={{ top: tick.top + PLOT_TOP_PAD }}
                />
              ))}

              {layout.brandRegions.map((region) => (
                <div
                  className="brand-column"
                  data-testid={`brand-divider-${region.brand}`}
                  key={`divider-${region.brand}`}
                  style={{ left: region.x, width: region.width }}
                />
              ))}

              {layout.cards.map((card) => {
                const product = productDetails.get(card.product.asin);
                if (!product) return null;
                const tooltipId = `product-tooltip-${product.asin}`;
                const isFocused = focusedAsins.has(product.asin);
                const tierRank = tierRanks.get(product.asin) ?? null;
                const tooltipSide = card.x + card.width / 2 > layout.width / 2 ? "left" : "right";
                const tooltipUp = card.y + card.height / 2 > layout.height / 2;

                const summaryLines = [
                  `${product.brand} · 系列 ${product.series}`,
                  `当前价 ${categoryConfig.currencySymbol}${product.price.toFixed(2)} · 平均价 ${categoryConfig.currencySymbol}${product.averagePrice.toFixed(2)}`,
                  keyMetricText(product),
                  `${salesMetricLabel} ${formatInteger.format(product.monthlyUnits)} 件/月 · ${formatRevenue(product.monthlyRevenue)}/月`,
                  ...(salesStatus ? [salesStatus] : []),
                ];
                return (
                  <button
                    aria-describedby={hovered?.id===tooltipId?tooltipId:undefined}
                    aria-label={focusSelectionMode
                      ? `${isFocused ? "取消" : "设置"} ${product.brand} ${product.model} ${isFocused ? "重点关注" : "为重点关注"}`
                      : `查看 ${product.brand} ${product.model} 详情`}
                    aria-haspopup={focusSelectionMode ? undefined : "dialog"}
                    aria-pressed={focusSelectionMode ? isFocused : undefined}
                    className={`product-card product-card--tooltip-${tooltipSide} ${tooltipUp ? "product-card--tooltip-up" : ""} ${isFocused ? "product-card--focused" : ""}`}
                    data-testid="product-card"
                    data-tooltip-side={tooltipSide}
                    key={product.asin}
                    onMouseEnter={event=>{if(document.activeElement!==event.currentTarget)setHovered({title:product.title,lines:summaryLines,id:tooltipId,x:event.clientX,y:event.clientY});}}
                    onMouseMove={event=>{if(document.activeElement!==event.currentTarget)setHovered({title:product.title,lines:summaryLines,id:tooltipId,x:event.clientX,y:event.clientY});}}
                    onMouseLeave={event=>{if(document.activeElement!==event.currentTarget)setHovered(null);}} onBlur={()=>setHovered(null)}
                    onFocus={event=>{const rect=event.currentTarget.getBoundingClientRect();setHovered({title:product.title,lines:summaryLines,id:tooltipId,anchor:event.currentTarget,x:rect.left+rect.width/2,y:rect.top+rect.height/2});}}
                    onKeyDown={event=>{if(event.key==='Escape')setHovered(null);}}
                    onClick={() => {setHovered(null);onProductAction(product);}}
                    style={{
                      left: card.x,
                      top: card.y + PLOT_TOP_PAD,
                      width: card.width,
                      height: card.height,
                      "--card-accent": brandColor(product.brand),
                    } as React.CSSProperties}
                    type="button"
                  >
                    {isFocused ? <span className="product-card__focus">重点关注</span> : null}
                    <span className="product-card__image">
                      <span className="product-card__fallback">{product.brand}<small>{product.model}</small></span>
                      {product.imageUrl ? (
                        <img alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} src={product.imageUrl} />
                      ) : null}
                    </span>
                    <span className="product-card__content">
                      <strong>{product.model}</strong>
                      <span className="product-card__price">{categoryConfig.currencySymbol}{product.price.toFixed(2)}</span>
                      <span className="product-card__key-metric">{keyMetricText(product)}</span>
                      {cardChips(product).length > 0 ? (
                        <span className="product-card__chips">
                          {cardChips(product).map((chip, index) => (
                            <span className="product-card__chip" key={index}>{chip}</span>
                          ))}
                        </span>
                      ) : null}
                      <span className="product-card__sales">
                        <small>{salesMetricLabel}</small> {formatInteger.format(product.monthlyUnits)} 件/月
                      </span>
                      <span className="product-card__meta">
                        <span>{product.rating === null ? "暂无评分" : `★ ${product.rating.toFixed(1)}`}</span>
                        <span>{product.ratingCount === null ? "" : `${formatInteger.format(product.ratingCount)} 条评论`}</span>
                      </span>
                    </span>
                    {tierRank ? (
                      <span
                        className={`product-card__rank product-card__rank--${tierRank.rank}`}
                        data-testid="product-card-rank"
                      >
                        段内 TOP {tierRank.rank}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="roadmap-axis roadmap-axis--right"
          data-testid="price-axis-right"
          ref={rightAxisRef}
        >
          <div
            className="roadmap-axis__content"
            style={{ height: scaledPlotHeight }}
          >
            <div
              className="roadmap-axis__line"
              style={{ height: Math.ceil(axisLineHeight * zoom), top: PLOT_TOP_PAD * zoom }}
            />
            {axisTicks.map((tick) => (
              <div
                className="roadmap-axis__tick"
                data-price={tick.price}
                data-tick-kind={tick.kind}
                key={tick.key}
                style={{ top: (tick.top + PLOT_TOP_PAD) * zoom }}
              >
                <span className="roadmap-axis__label">{tick.label}</span>
              </div>
            ))}
            {axisBreaks.map((segment) => (
              <span
                className="price-axis-break"
                data-axis-break
                key={`break-${segment.maxPrice}-${segment.minPrice}`}
                style={{ top: ((segment.top + segment.bottom) / 2 + PLOT_TOP_PAD) * zoom }}
              >
                <span aria-hidden="true">∕∕</span>
              </span>
            ))}
          </div>
        </div>

        <div aria-label="路标缩放控制" className="roadmap-zoom" role="group">
          <button
            aria-label="缩小路标"
            data-testid="roadmap-zoom-out"
            disabled={zoomPercent <= roundZoomPercent(MIN_ZOOM)}
            onClick={() => zoomAtPoint(zoomRef.current / ZOOM_STEP)}
            type="button"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="roadmap-zoom__level"
            data-testid="roadmap-zoom-level"
          >
            {zoomPercent}%
          </span>
          <button
            aria-label="放大路标"
            data-testid="roadmap-zoom-in"
            disabled={zoomPercent >= roundZoomPercent(MAX_ZOOM)}
            onClick={() => zoomAtPoint(zoomRef.current * ZOOM_STEP)}
            type="button"
          >
            ＋
          </button>
          <button
            aria-label="重置缩放"
            className="roadmap-zoom__reset"
            data-testid="roadmap-zoom-reset"
            onClick={() => zoomAtPoint(1)}
            type="button"
          >
            重置
          </button>
        </div>
      </div>
      <PointSummaryTooltip point={hovered} id={hovered?.id} />
    </div>
  );
}
