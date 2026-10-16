import { useMemo, useRef, useState, useEffect } from 'react';
import { radarTailLightPack } from '../../categories/radar-tail-light';
import { Roadmap } from '../components/Roadmap';
import { layoutProducts } from '../lib/layout';
import { rankTopProductsByTier } from '../lib/price-tiers';
import type { Product } from '../lib/products';
import type { RoadmapState } from './types';
import { DemoDialog } from './DemoDialog';

const imageFiles: Record<string, string> = {
  'TR70': 'coospo-tr70', 'SR mini': 'igpsport-sr-mini', 'NT201': 'ravemen-nt201',
  'L508': 'magene-l508', 'GARDIA R300L': 'bryton-gardia-r300l',
  'Varia RearVue 820': 'garmin-varia-rearvue-820', 'Varia RTL515': 'garmin-varia-rtl515',
};
export const catalog = radarTailLightPack.products.map(product => ({ ...product, imageUrl: imageFiles[product.model]
  ? new URL(`../../designs/report-website-20261013/assets/products/${imageFiles[product.model]}.jpg`, import.meta.url).href
  : product.imageUrl }));
export const catalogBrands = [...new Set(catalog.map(product => product.brand))].sort();
export const initialRoadmapState: RoadmapState = {
  brands: catalogBrands, minPrice: '', maxPrice: '', onlyFocused: true,
  focusedIds: catalog.filter(product => Object.prototype.hasOwnProperty.call(imageFiles, product.model)).map(product => product.productId),
};
const number = new Intl.NumberFormat('en-US');

export function DemoRoadmap({ state, onChange, active }: { state: RoadmapState; onChange: (state: RoadmapState) => void; active: boolean }) {
  const config = radarTailLightPack.config;
  const section = useRef<HTMLElement>(null);
  const mapStage = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const mapPosition = useRef({ left: 0, top: 0 });
  const pagePosition = useRef({ left: 0, top: 0 });
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [editingFocus, setEditingFocus] = useState(false);
  const [resetZoom, setResetZoom] = useState(0);
  const focused = useMemo(() => new Set(catalog.filter(product => state.focusedIds.includes(product.productId)).map(product => product.asin)), [state.focusedIds]);
  const invalidPrice = state.minPrice !== '' && state.maxPrice !== '' && Number(state.minPrice) > Number(state.maxPrice);
  const filtered = useMemo(() => catalog.filter(product => !invalidPrice && state.brands.includes(product.brand)
    && (!state.onlyFocused || focused.has(product.asin))
    && (state.minPrice === '' || product.price >= Number(state.minPrice))
    && (state.maxPrice === '' || product.price <= Number(state.maxPrice))), [state, focused, invalidPrice]);
  const layout = useMemo(() => layoutProducts(filtered), [filtered]);
  const ranks = useMemo(() => rankTopProductsByTier(catalog, config.priceTiers ?? []), [config.priceTiers]);
  useEffect(() => { if (!active) { setSelected(null); setExpanded(false); } }, [active]);
  useEffect(() => {
    if (!expanded || !mapStage.current) return;
    const stage = mapStage.current;
    const previousOverflow = document.body.style.overflow;
    const scrollPosition = pagePosition.current;
    // Keep the same Roadmap mounted so canvas zoom and product state survive expansion.
    // Every sibling outside this branch becomes inert while the map owns the viewport.
    const outside: { element: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = stage;
    while (branch.parentElement && branch !== document.body) {
      for (const sibling of branch.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== branch) {
          outside.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') { event.preventDefault(); setExpanded(false); return; }
      if (event.key !== 'Tab') return;
      const targets = [...stage.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"], a[href]')]
        .filter(element => element.getClientRects().length > 0);
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && (document.activeElement === first || !stage.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !stage.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    exitButton.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      outside.forEach(({ element, inert }) => { element.inert = inert; });
      document.body.style.overflow = previousOverflow;
      window.scrollTo(scrollPosition);
      const viewport = stage.querySelector<HTMLElement>('.roadmap-viewport');
      if (viewport) { viewport.scrollLeft = mapPosition.current.left; viewport.scrollTop = mapPosition.current.top; }
      expandButton.current?.focus({ preventScroll: true });
    };
  }, [expanded]);
  const expandMap = () => {
    pagePosition.current = { left: window.scrollX, top: window.scrollY };
    const viewport = mapStage.current?.querySelector<HTMLElement>('.roadmap-viewport');
    if (viewport) mapPosition.current = { left: viewport.scrollLeft, top: viewport.scrollTop };
    setExpanded(true);
  };
  const toggleFocus = (product: Product) => onChange({ ...state, focusedIds: state.focusedIds.includes(product.productId)
    ? state.focusedIds.filter(id => id !== product.productId) : [...state.focusedIds, product.productId] });
  const toggleBrand = (brand: string) => onChange({ ...state, brands: state.brands.includes(brand) ? state.brands.filter(item => item !== brand) : [...state.brands, brand] });
  return <section className="dmo-roadmap" ref={section} aria-labelledby="dmo-map-title">
    <div className="dmo-section-heading"><h2 id="dmo-map-title"><span>MAP</span> 产品定位地图</h2>
      <div className="dmo-toolbar">
        <details className="dmo-popover"><summary className="dmo-button">☷ 品牌 · {state.brands.length}</summary>
          <div className="dmo-popover__panel"><strong>选择品牌</strong><div className="dmo-text-actions">
            <button onClick={() => onChange({ ...state, brands: catalogBrands })}>全选</button>
            <button onClick={() => onChange({ ...state, brands: [] })}>全取消</button>
            <button onClick={() => onChange({ ...state, brands: catalogBrands.filter(brand => !state.brands.includes(brand)) })}>反选</button>
          </div><div className="dmo-brand-list">{catalogBrands.map(brand => <label key={brand}><input type="checkbox" checked={state.brands.includes(brand)} onChange={() => toggleBrand(brand)} />{brand}</label>)}</div></div>
        </details>
        <details className="dmo-popover"><summary className="dmo-button">${state.minPrice || '0'} — ${state.maxPrice || Math.ceil(Math.max(...catalog.map(product => product.price)))}</summary>
          <div className="dmo-popover__panel"><strong>价格范围 · USD</strong><div className="dmo-range">
            <label>最低价格<input type="number" min="0" placeholder="不限" value={state.minPrice} onChange={event => onChange({ ...state, minPrice: event.target.value === '' ? '' : String(Math.max(0, Number(event.target.value))) })} /></label>
            <span>—</span><label>最高价格<input type="number" min="0" placeholder="不限" value={state.maxPrice} onChange={event => onChange({ ...state, maxPrice: event.target.value === '' ? '' : String(Math.max(0, Number(event.target.value))) })} /></label>
          </div>{invalidPrice && <p className="dmo-error" role="alert">最高价格应不小于最低价格</p>}<button className="dmo-link" onClick={() => onChange({ ...state, minPrice: '', maxPrice: '' })}>清除价格条件</button></div>
        </details>
        <button className={`dmo-button ${state.onlyFocused ? 'is-selected' : ''}`} aria-pressed={state.onlyFocused} onClick={() => onChange({ ...state, onlyFocused: !state.onlyFocused })}>☆ 仅关注 · {state.focusedIds.length}</button>
        <button className={`dmo-button ${editingFocus ? 'is-selected' : ''}`} aria-pressed={editingFocus} onClick={() => setEditingFocus(value => !value)}>{editingFocus ? '完成关注选择' : '管理关注'}</button>
        <button className="dmo-button" onClick={() => { setResetZoom(value => value + 1); }}>↺ 重置画布</button>
        <button ref={expandButton} className="dmo-button" aria-expanded={expanded} aria-controls="dmo-map-stage" onClick={expandMap}>⛶ 展开至整页</button>
      </div>
    </div>
    {editingFocus && <div className="dmo-inline-status" role="status">点击产品卡片切换关注状态。<button className="dmo-link" onClick={() => onChange({ ...state, onlyFocused: false, brands: catalogBrands })}>显示全部产品</button></div>}
    <div id="dmo-map-stage" ref={mapStage} className={`dmo-map-stage${expanded ? ' dmo-map-stage--expanded' : ''}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? '整页产品定位地图' : undefined}>
    {expanded && <button ref={exitButton} className="dmo-map-exit dmo-button" onClick={() => setExpanded(false)} aria-label="退出整页地图">收起地图 <kbd>Esc</kbd></button>}
    {filtered.length ? <Roadmap key={resetZoom} active={active} fillViewport categoryConfig={config} products={filtered} layout={layout} focusedAsins={focused} focusSelectionMode={editingFocus}
      onProductAction={product => editingFocus ? toggleFocus(product) : setSelected(product)} priceTiers={config.priceTiers ?? []} tierRanks={ranks} />
      : <div className="dmo-empty"><strong>{invalidPrice ? '请调整价格范围' : '没有符合条件的产品'}</strong><p>调整品牌、价格或关注条件后继续查看。</p><button className="dmo-button" onClick={() => onChange({ ...state, brands: catalogBrands, minPrice: '', maxPrice: '', onlyFocused: false })}>显示全部产品</button></div>}
    </div>
    <div className="dmo-map-footer"><span>{filtered.length} / {catalog.length} 款产品 · {new Set(filtered.map(product => product.brand)).size} 个品牌</span><span>近 6 月平均销量 · USD</span></div>
    {selected && <DemoDialog title={`${selected.brand} · ${selected.model}`} onClose={() => setSelected(null)}>
      <div className="dmo-product-intro">{selected.imageUrl && <img src={selected.imageUrl} alt={`${selected.brand} ${selected.model}`} />}<div><p className="dmo-price">${selected.price.toFixed(2)}</p><p>{config.keyMetric.label} · {selected.keyMetricValue ?? '—'} {config.keyMetric.unit}</p><button className={`dmo-button ${focused.has(selected.asin) ? 'is-selected' : ''}`} aria-pressed={focused.has(selected.asin)} onClick={() => toggleFocus(selected)}>{focused.has(selected.asin) ? '★ 已关注' : '☆ 关注产品'}</button></div></div>
      <dl className="dmo-definition-list"><div><dt>近 6 月平均销量</dt><dd>{number.format(selected.monthlyUnits)} 件</dd></div><div><dt>评分 / 评论数</dt><dd>{selected.rating?.toFixed(1) ?? '—'} / {number.format(selected.ratingCount ?? 0)}</dd></div>{config.drawerFields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{selected.attributes[field.key] ?? '—'}</dd></div>)}</dl>
      <details className="dmo-source-details"><summary>资料来源与范围</summary><p>{config.dataNote}</p></details>
      <a className="dmo-button" href={selected.amazonUrl} target="_blank" rel="noreferrer">查看商品 ↗</a>
    </DemoDialog>}
  </section>;
}
