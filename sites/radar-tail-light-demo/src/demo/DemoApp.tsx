import { useEffect, useRef, useState } from 'react';
import { AnalysisPage } from './AnalysisPage';
import { initialAnalysisState, productSeries, brandSeries, marketSeries } from './trend-data';
import { catalog, catalogBrands, DemoRoadmap, initialRoadmapState } from './DemoRoadmap';
import { DemoDialog } from './DemoDialog';
import { downloadJson, loadConfiguration, parseConfiguration, saveConfiguration } from './configuration';
import type { AnalysisView, DemoConfiguration } from './types';
import { radarTailLightPack } from '../../categories/radar-tail-light';

function routeFromHash() {
  const match = /^#analysis\/(products|brands|market)$/.exec(window.location.hash);
  if (match) return { page: 'analysis' as const, view: match[1] as AnalysisView };
  if (window.location.hash === '#analysis') return { page: 'analysis' as const };
  return { page: 'roadmap' as const };
}
function initialConfiguration(): DemoConfiguration {
  const saved = loadConfiguration();
  const defaults: DemoConfiguration = { schema: 'pm-report-demo/v1', name: '雷达尾灯市场研究', page: 'roadmap', roadmap: initialRoadmapState, analysis: initialAnalysisState };
  const current = saved ?? defaults;
  if (!window.location.hash) return current;
  const route = routeFromHash();
  return { ...current, page: route.page, analysis: { ...current.analysis, view: route.view ?? current.analysis.view } };
}

function ReportIcon() {
  return <svg width="26" height="28" viewBox="0 0 26 28" fill="none" aria-hidden="true"><path d="M3 16 10 9l5 4L24 3M4 21v4m6-9v9m6-5v5m6-12v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function DemoApp() {
  const [configuration, setConfiguration] = useState(initialConfiguration);
  const [dialog, setDialog] = useState<'scope' | 'configuration' | null>(null);
  const [name, setName] = useState(configuration.name);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const { page, analysis, roadmap } = configuration;

  useEffect(() => {
    const onHashChange = () => {
      const route = routeFromHash();
      setConfiguration(current => ({ ...current, page: route.page, analysis: { ...current.analysis, view: route.view ?? current.analysis.view } }));
      setDialog(null);
    };
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) history.replaceState(null, '', page === 'roadmap' ? '#roadmap' : `#analysis/${analysis.view}`);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => { saveConfiguration(configuration); }, [configuration]);
  useEffect(() => { document.title = `${page === 'roadmap' ? 'Roadmap' : '竞品分析'} · 雷达尾灯 Demo`; }, [page]);

  const navigate = (nextPage: 'roadmap' | 'analysis', view = analysis.view) => {
    setConfiguration(current => ({ ...current, page: nextPage, analysis: { ...current.analysis, view } }));
    const nextHash = nextPage === 'roadmap' ? '#roadmap' : `#analysis/${view}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  };
  const openConfiguration = () => { setName(configuration.name); setError(''); setDialog('configuration'); };
  const exportConfiguration = () => {
    try {
      const value = parseConfiguration({ ...configuration, name });
      setConfiguration(value);
      downloadJson(`${value.name.replace(/[\\/:*?"<>|]/g, '-')}.json`, value);
      setMessage(`已导出配置「${value.name}」`);
      setDialog(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : '无法导出配置'); }
  };
  const importConfiguration = async (input: File | undefined) => {
    if (!input) return;
    try {
      if (input.size > 256 * 1024) throw new Error('配置文件不能超过 256 KB');
      const next = parseConfiguration(JSON.parse(await input.text()));
      setConfiguration(next);
      setName(next.name);
      history.replaceState(null, '', next.page === 'roadmap' ? '#roadmap' : `#analysis/${next.analysis.view}`);
      setMessage(`已导入配置「${next.name}」`);
      setDialog(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : '无法读取配置文件'); }
    finally { if (file.current) file.current.value = ''; }
  };
  const downloadMaterials = () => {
    downloadJson('雷达尾灯-Demo资料.json', {
      schema: 'pm-report-demo-data/v1', dataKind: 'demo',
      roadmap: { snapshotDate: radarTailLightPack.config.snapshotDate, source: radarTailLightPack.config.dataNote,
        products: catalog.map(({ productId, brand, model, price, monthlyUnits }) => ({ productId, brand, model, price, sixMonthAverageUnits: monthlyUnits })) },
      analysis: { source: '设计稿演示数据 · 非实际调研结果', products: productSeries, brands: brandSeries, market: marketSeries },
    });
    setMessage('Demo 资料已下载');
  };

  return <div className={`dmo-app${page === 'roadmap' ? ' dmo-app--roadmap' : ''}`}>
    <a className="dmo-skip" href="#dmo-content" onClick={event => { event.preventDefault(); document.getElementById('dmo-content')?.focus(); }}>跳转到报告内容</a>
    <header className="dmo-header"><a className="dmo-brand" href="#roadmap" onClick={event => { event.preventDefault(); navigate('roadmap'); }}><ReportIcon /><strong>雷达尾灯</strong><span className="dmo-badge">DEMO</span></a>
      <nav className="dmo-nav" aria-label="报告菜单">
        <a href="#roadmap" aria-current={page === 'roadmap' ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate('roadmap'); }}>Roadmap</a>
        <a href={`#analysis/${analysis.view}`} aria-current={page === 'analysis' ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate('analysis'); }}>竞品分析</a>
      </nav><button className="dmo-button dmo-config-button" onClick={openConfiguration}><span aria-hidden="true">☷</span> 视图配置</button>
    </header>
    <main id="dmo-content" className={`dmo-content${page === 'roadmap' ? ' dmo-content--roadmap' : ''}`} tabIndex={-1}>
      <div className="dmo-page-heading"><h1>{page === 'roadmap' ? 'Roadmap' : '竞品分析'}</h1><div className="dmo-toolbar"><button className="dmo-button" onClick={() => setDialog('scope')}>☷ 范围详情</button><button className="dmo-button dmo-button--dark" onClick={downloadMaterials}>↓ 下载资料</button></div></div>
      <div className="dmo-meta"><span>▦ {page === 'analysis' ? `${analysis.startMonth.replace('-', '.')} — ${analysis.endMonth.replace('-', '.')}` : '快照 2026.08.31'}</span><span>◇ {catalog.length} 款产品</span><span>▤ {catalogBrands.length} 个品牌</span><span>↻ {page === 'analysis' ? '设计稿演示数据' : '资料更新 2026.08.31'}</span></div>
      <div className="dmo-roadmap-page" hidden={page !== 'roadmap'}><DemoRoadmap state={roadmap} active={page === 'roadmap'} onChange={next => setConfiguration(current => ({ ...current, roadmap: next }))} /></div>
      {page === 'analysis' && <AnalysisPage state={analysis} onChange={next => setConfiguration(current => ({ ...current, analysis: next }))} onViewChange={view => navigate('analysis', view)} />}
    </main>
    {message && <div className="dmo-toast" role="status"><span>{message}</span><button aria-label="关闭提示" onClick={() => setMessage('')}>×</button></div>}
    {dialog === 'scope' && <DemoDialog title="范围详情" onClose={() => setDialog(null)}>
      <dl className="dmo-definition-list"><div><dt>品类</dt><dd>自行车雷达尾灯</dd></div><div><dt>收录目录</dt><dd>{catalog.length} 款产品 / {catalogBrands.length} 个品牌</dd></div><div><dt>Roadmap</dt><dd>原项目多站合并快照 · 2026.08.31</dd></div><div><dt>销量窗口</dt><dd>近 6 月平均销量</dd></div><div><dt>竞品分析</dt><dd>2025.09—2026.08 · 设计稿演示序列</dd></div><div><dt>分析货币</dt><dd>USD</dd></div></dl>
      <p className="dmo-detail-copy">趋势数据用于体验筛选、汇总与图表交互。厂商、大盘由同一套演示产品序列汇总，不作为实际市场调研结论。</p>
      <details className="dmo-source-details"><summary>Roadmap 资料口径</summary><p>{radarTailLightPack.config.dataNote}</p></details>
    </DemoDialog>}
    {dialog === 'configuration' && <DemoDialog title="视图配置" onClose={() => setDialog(null)}>
      <p className="dmo-detail-copy">保存当前菜单、分析视图、时间范围、筛选和勾选；Roadmap 的品牌、价格与关注名单一并保存。</p>
      <label className="dmo-field">配置名称<input maxLength={80} value={name} onChange={event => { setName(event.target.value); setError(''); }} placeholder="为这份配置命名" /></label>
      <div className="dmo-config-summary"><span>Roadmap <strong>{roadmap.focusedIds.length} 款关注产品</strong></span><span>竞品分析 <strong>{analysis.productIds.length} 款产品 / {analysis.brandIds.length} 个厂商</strong></span></div>
      {error && <p role="alert" className="dmo-error">{error}</p>}
      <div className="dmo-dialog-actions"><input ref={file} className="dmo-visually-hidden" type="file" accept=".json,application/json" tabIndex={-1} onChange={event => void importConfiguration(event.target.files?.[0])} /><button className="dmo-button" onClick={() => file.current?.click()}>导入配置文件</button><button className="dmo-button dmo-button--primary" onClick={exportConfiguration}>命名并导出配置</button></div>
    </DemoDialog>}
  </div>;
}
