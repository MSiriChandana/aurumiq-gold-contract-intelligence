import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, CircleAlert,
  Download, FileSpreadsheet, Filter, Gem, GitFork, Layers3, RefreshCw, ShieldCheck,
  Upload, Zap
} from 'lucide-react';

const API = 'http://127.0.0.1:8000';

function Metric({ label, value, hint, icon: Icon, tone = '' }) {
  return <div className="metric card">
    <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17}/></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-hint">{hint}</div>
  </div>;
}

function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return '₹' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
function num(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backend, setBackend] = useState('checking');
  const [referencePurity, setReferencePurity] = useState(999);
  const [minVolume, setMinVolume] = useState(1);
  const [minOI, setMinOI] = useState(1);
  const [threshold, setThreshold] = useState(0.75);
  const [trainFraction, setTrainFraction] = useState(0.7);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch(`${API}/api/health`).then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setBackend('online')).catch(() => setBackend('offline'));
  }, []);

  const runAnalysis = async (chosenFile) => {
    const activeFile = chosenFile || file;
    if (!activeFile) { setError('Choose a CSV file first.'); return; }
    setLoading(true); setError('');
    const form = new FormData();
    form.append('file', activeFile);
    const params = new URLSearchParams({
      reference_purity_per_mille: referencePurity,
      min_volume: minVolume,
      min_open_interest: minOI,
      deviation_threshold_pct: threshold,
      train_fraction: trainFraction
    });
    try {
      const response = await fetch(`${API}/api/analyze?${params}`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Analysis failed.');
      setResult(data);
      setFile(activeFile);
    } catch (e) {
      setError(`${e.message}. Confirm the FastAPI backend is running on port 8000 and your CSV has the required columns.`);
    } finally { setLoading(false); }
  };

  const visibleRows = useMemo(() => {
    if (!result) return [];
    if (filter === 'deviations') return result.rows.filter(r => r.unusual_deviation);
    if (filter === 'screened') return result.rows.filter(r => r.screened_candidate);
    return result.rows;
  }, [result, filter]);

  const exportCsv = () => {
    if (!result) return;
    const rows = result.rows;
    const cols = Object.keys(rows[0] || {});
    const esc = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'aurumiq-analysis.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = result?.chart || [];
  const symbols = result?.summary?.contracts || [];
  const chartPoints = useMemo(() => {
    if (!chartData.length || !symbols.length) return [];
    const values = chartData.flatMap(d => symbols.map(s => d[s]).filter(v => v !== undefined));
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    return symbols.map((symbol, idx) => ({
      symbol,
      colorClass: `line-${idx % 5}`,
      points: chartData.map((d, i) => {
        const value = d[symbol];
        if (value === undefined) return null;
        const x = chartData.length === 1 ? 50 : 40 + i * (700 / (chartData.length - 1));
        const y = 205 - ((value - min) / range) * 165;
        return `${x},${y}`;
      }).filter(Boolean).join(' ')
    }));
  }, [chartData, symbols]);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Gem size={21}/></div><div><strong>AURUMIQ</strong><small>CONTRACT INTELLIGENCE</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <div className="nav-item active"><BarChart3 size={18}/> Overview</div>
      <div className="nav-item"><Layers3 size={18}/> Relative pricing</div>
      <div className="nav-item"><ShieldCheck size={18}/> Validation & risk</div>
      <div className="nav-item"><FileSpreadsheet size={18}/> Data explorer</div>
      <div className="sidebar-bottom">
        <div className="team-pill"><span className="online-dot"></span><div><b>VELOURA</b><small>Hack in Hills '26</small></div></div>
        <div className="sidebar-note">Normalize. Analyze. Validate.</div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="breadcrumbs">Workspace <span>/</span> <b>Overview</b></div>
        <div className="top-actions"><span className={`status ${backend}`}><i/> API {backend === 'online' ? 'Connected' : backend === 'checking' ? 'Checking' : 'Offline'}</span><div className="avatar">V</div></div>
      </header>

      <section className="page-heading">
        <div><div className="eyebrow"><span className="gold-dot"></span> GOLD FUTURES ANALYTICS</div>
          <h1>Market intelligence, <em>normalized.</em></h1>
          <p>Compare contracts on a common basis. Separate structural price differences from signals worth investigating.</p>
        </div>
        <label className="upload-btn"><Upload size={16}/><span>{file ? 'Replace CSV' : 'Upload Bhavcopy CSV'}</span><input type="file" accept=".csv,text/csv" onChange={e => { const f=e.target.files?.[0]; if(f){setFile(f);runAnalysis(f);} }}/></label>
      </section>

      <div className="notice"><CircleAlert size={17}/><div><b>Prototype data notice</b><span>The bundled demo uses synthetic prices. Upload verified market data before drawing real-market conclusions. This tool is for analytics demonstration, not trading advice.</span></div></div>

      {error && <div className="error-banner"><CircleAlert size={17}/>{error}</div>}

      <section className="metrics-grid">
        <Metric label="ROWS ANALYZED" value={result ? num(result.summary.rows_analyzed) : '—'} hint={result ? `${result.summary.date_start} → ${result.summary.date_end}` : 'Run an analysis to populate'} icon={Activity}/>
        <Metric label="CONTRACTS FOUND" value={result ? result.summary.contracts.length : '—'} hint={result ? result.summary.contracts.join(' · ') : 'Gold contract symbols'} icon={Layers3} tone="violet"/>
        <Metric label="LATEST DEVIATIONS" value={result ? num(result.summary.latest_deviations) : '—'} hint={`Absolute deviation ≥ ${threshold}%`} icon={Zap} tone="amber"/>
        <Metric label="PASSED ALL SCREENS" value={result ? num(result.summary.latest_screened_candidates) : '—'} hint="Cost + liquidity + threshold" icon={ShieldCheck} tone="green"/>
      </section>

      <section className="content-grid">
        <div className="card chart-card">
          <div className="card-heading"><div><h2>Normalized price history</h2><p>Comparable price per gram · reference purity {referencePurity}‰</p></div><span className="live-label"><span/> {result ? 'ANALYSIS READY' : 'AWAITING DATA'}</span></div>
          {chartData.length ? <div className="chart-wrap">
            <div className="y-labels"><span>High</span><span>Mid</span><span>Low</span></div>
            <svg viewBox="0 0 780 245" role="img" aria-label="Normalized price history chart" className="line-chart">
              {[40,95,150,205].map(y=><line key={y} x1="40" x2="740" y1={y} y2={y} className="grid-line"/>)}
              {chartPoints.map(p=><polyline key={p.symbol} points={p.points} className={`chart-line ${p.colorClass}`}/>)}
              {chartData.map((d,i)=> chartData.length < 8 || i % Math.ceil(chartData.length/6)===0 || i===chartData.length-1 ? <text key={d.date} x={chartData.length===1?50:40+i*(700/(chartData.length-1))} y="232" className="axis-text" textAnchor="middle">{d.date.slice(5)}</text>:null)}
            </svg>
            <div className="legend">{chartPoints.map(p=><span key={p.symbol}><i className={p.colorClass}/>{p.symbol}</span>)}</div>
          </div> : <div className="empty-chart"><div className="empty-icon"><BarChart3 size={25}/></div><b>Your market picture starts here</b><span>Run the bundled sample or upload a CSV to view normalized prices across contracts.</span></div>}
        </div>

        <div className="card controls-card">
          <div className="card-heading"><div><h2>Analysis controls</h2><p>Adjust assumptions and rerun</p></div><Filter size={17} className="muted-icon"/></div>
          <label className="control-label">Reference purity <b>{referencePurity}‰</b></label>
          <select value={referencePurity} onChange={e=>setReferencePurity(Number(e.target.value))}><option value="995">995‰</option><option value="999">999‰</option><option value="1000">1000‰</option></select>
          <label className="control-label">Deviation threshold <b>{threshold}%</b></label>
          <input type="range" min="0.1" max="3" step="0.05" value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/>
          <label className="control-label">Minimum daily volume <b>{minVolume}</b></label>
          <input type="number" min="0" value={minVolume} onChange={e=>setMinVolume(Number(e.target.value))}/>
          <label className="control-label">Minimum open interest <b>{minOI}</b></label>
          <input type="number" min="0" value={minOI} onChange={e=>setMinOI(Number(e.target.value))}/>
          <label className="control-label">Training history <b>{Math.round(trainFraction*100)}%</b></label>
          <input type="range" min="0.5" max="0.85" step="0.05" value={trainFraction} onChange={e=>setTrainFraction(Number(e.target.value))}/>
          <button className="primary-btn full" disabled={!file || loading} onClick={()=>runAnalysis()}><RefreshCw size={16} className={loading?'spin':''}/>{loading?'Analyzing…':'Apply & rerun analysis'}</button>
          <div className="control-foot">Filters are configurable demo assumptions. Verify transaction costs and liquidity thresholds for the market and contract.</div>
        </div>
      </section>

      <section className="card table-card">
        <div className="card-heading table-head"><div><h2>Contract-level signals</h2><p>Normalized values and screening flags, row by row</p></div><button className="secondary-btn" onClick={exportCsv} disabled={!result}><Download size={15}/> Export CSV</button></div>
        <div className="table-toolbar"><div className="filter-tabs">
          {[['all','All rows'],['deviations','Deviations'],['screened','Passed screens']].map(([key,label])=><button key={key} className={filter===key?'selected':''} onClick={()=>setFilter(key)}>{label}</button>)}
        </div><span className="row-count">{visibleRows.length} rows</span></div>
        <div className="table-scroll"><table><thead><tr><th>Date</th><th>Contract</th><th>Normalized / g</th><th>Deviation</th><th>Volume</th><th>Open interest</th><th>Period</th><th>Screen</th></tr></thead>
          <tbody>{visibleRows.slice().reverse().slice(0,100).map((r,i)=><tr key={`${r.date}-${r.symbol}-${i}`}>
            <td>{r.date}</td><td><span className="symbol">{r.symbol}</span></td><td className="numeric">{money(r.normalized_price_per_gram)}</td>
            <td className={`numeric ${r.deviation_pct>=0?'positive':'negative'}`}>{Number(r.deviation_pct)>=0?'+':''}{num(r.deviation_pct)}%</td>
            <td className="numeric">{num(r.volume)}</td><td className="numeric">{num(r.open_interest)}</td>
            <td><span className={`period ${r.period==='Holdout'?'holdout':''}`}>{r.period}</span></td>
            <td>{r.screened_candidate?<span className="flag pass"><CheckCircle2 size={13}/> Passed</span>:r.unusual_deviation?<span className="flag warn"><CircleAlert size={13}/> Review</span>:<span className="flag neutral">— Normal</span>}</td>
          </tr>)}</tbody></table>
          {!visibleRows.length && <div className="table-empty">No rows to display. Upload data or change the selected filter.</div>}
        </div>
        {result && <div className="table-footer"><span>Showing up to 100 newest rows</span><span>Holdout rows: <b>{result.summary.holdout_rows}</b> · Holdout screened candidates: <b>{result.summary.holdout_candidates}</b></span></div>}
      </section>

      {result && <section className="card validation-card"><div className="validation-icon"><ShieldCheck size={20}/></div><div><h3>Walk-forward / holdout note</h3><p>{result.summary.holdout_note}</p><small>{result.summary.data_notice}</small></div></section>}

      <footer><div className="footer-brand"><Gem size={16}/> AURUMIQ <span>by VELOURA</span></div><span>Hack in Hills '26 · Prototype v0.1.0</span><span>Not investment advice</span></footer>
    </main>
  </div>;
}
