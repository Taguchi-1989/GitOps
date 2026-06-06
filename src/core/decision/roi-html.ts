/**
 * FlowOps - ROI Calculator HTML Generator
 *
 * ROI モデル(YAML) から「取り出せる自己完結HTML」を生成する。
 * - スライダーを動かすと内蔵JS（roi.ts の忠実移植）が即再計算
 * - 計算式は KaTeX でビルド時に MathML 化（CSS/フォント/CDN 不要・オフライン可）
 * - キャッシュフロー図・ワークフロー図はインライン SVG
 *
 * 重要: 決定論（LLM不使用）。最終的な投資判断は人が行う。
 * 注意: 計算ロジックの正本は roi.ts。本ファイルの埋込JSはその移植で、
 *   roi.test.ts の golden 値で一致を担保する。
 */

import katex from 'katex';
import { RoiModel } from './roi-schema';

export interface ResolvedAssumption {
  setId: string;
  setVersion: string;
  id: string;
  statement: string;
  source?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderFormulaMathml(latex: string): string {
  try {
    return katex.renderToString(latex, {
      output: 'mathml',
      displayMode: true,
      throwOnError: false,
    });
  } catch {
    return '<code>' + escapeHtml(latex) + '</code>';
  }
}

/** ワークフロー概念図を横並びのインラインSVGで生成 */
function buildWorkflowSvg(steps: string[]): string {
  if (steps.length === 0) return '';
  const bw = 168;
  const bh = 64;
  const gap = 44;
  const pad = 12;
  const width = pad * 2 + steps.length * bw + (steps.length - 1) * gap;
  const height = pad * 2 + bh;

  const wrap = (label: string): string[] => {
    const max = 11;
    const lines: string[] = [];
    let cur = '';
    for (const ch of label) {
      if (cur.length >= max) {
        lines.push(cur);
        cur = '';
      }
      cur += ch;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 3);
  };

  let svg =
    '<svg viewBox="0 0 ' +
    width +
    ' ' +
    height +
    '" width="' +
    width +
    '" height="' +
    height +
    '" role="img" aria-label="ROI workflow">';
  svg +=
    '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">' +
    '<path d="M0,0 L8,3 L0,6 Z" fill="#64748b"/></marker></defs>';

  steps.forEach((step, i) => {
    const x = pad + i * (bw + gap);
    const y = pad;
    svg +=
      '<rect x="' +
      x +
      '" y="' +
      y +
      '" width="' +
      bw +
      '" height="' +
      bh +
      '" rx="10" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>';
    const lines = wrap(step);
    const lineH = 15;
    const startY = y + bh / 2 - ((lines.length - 1) * lineH) / 2 + 4;
    lines.forEach((ln, li) => {
      svg +=
        '<text x="' +
        (x + bw / 2) +
        '" y="' +
        (startY + li * lineH) +
        '" text-anchor="middle" font-size="12" fill="#1e293b">' +
        escapeHtml(ln) +
        '</text>';
    });
    if (i < steps.length - 1) {
      const ax = x + bw;
      const ay = y + bh / 2;
      svg +=
        '<line x1="' +
        ax +
        '" y1="' +
        ay +
        '" x2="' +
        (ax + gap - 6) +
        '" y2="' +
        ay +
        '" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>';
    }
  });
  svg += '</svg>';
  return svg;
}

/** 自己完結HTMLを生成 */
export function generateRoiHtml(model: RoiModel, assumptions: ResolvedAssumption[]): string {
  const modelJson = JSON.stringify({
    title: model.title,
    version: model.version,
    defaults: model.defaults,
    sliders: model.sliders,
  }).replace(/</g, '\\u003c');

  const formulasHtml = model.formulas
    .map(
      f =>
        '<div class="formula"><div class="formula-label">' +
        escapeHtml(f.label) +
        '</div><div class="formula-math">' +
        renderFormulaMathml(f.latex) +
        '</div>' +
        (f.description ? '<div class="formula-desc">' + escapeHtml(f.description) + '</div>' : '') +
        '</div>'
    )
    .join('\n');

  const assumptionsHtml =
    assumptions.length > 0
      ? assumptions
          .map(
            a =>
              '<li><span class="a-stmt">' +
              escapeHtml(a.statement) +
              '</span>' +
              (a.source
                ? '<span class="a-src">（出典: ' + escapeHtml(a.source) + '）</span>'
                : '') +
              '</li>'
          )
          .join('\n')
      : '<li>（前提の定義なし）</li>';

  const workflowSvg = buildWorkflowSvg(model.workflow.steps);
  const stage = model.lifecycle?.stage ?? 'draft';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(model.title)} (${escapeHtml(model.version)})</title>
<style>
  :root{ --bg:#f8fafc; --card:#fff; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0;
    --pos:#16a34a; --neg:#dc2626; --accent:#4f46e5; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--bg); color:var(--ink);
    font-family:system-ui,-apple-system,"Segoe UI","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;
    line-height:1.6; }
  .wrap{ max-width:1180px; margin:0 auto; padding:24px 20px 80px; }
  header h1{ font-size:20px; margin:0 0 4px; }
  .tags{ color:var(--muted); font-size:12px; }
  .badge{ display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px;
    background:#eef2ff; color:#4338ca; margin-left:6px; }
  .note{ display:flex; gap:8px; align-items:flex-start; background:#eff6ff; border:1px solid #bfdbfe;
    color:#1e40af; padding:10px 14px; border-radius:10px; font-size:13px; margin:14px 0 22px; }
  .layout{ display:grid; grid-template-columns: 360px 1fr; gap:22px; align-items:start; }
  @media(max-width:880px){ .layout{ grid-template-columns:1fr; } }
  .panel{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; }
  .panel h2{ font-size:14px; margin:0 0 12px; }
  .group-title{ font-size:12px; color:var(--muted); margin:14px 0 8px; font-weight:600; }
  .ctrl{ margin-bottom:12px; }
  .ctrl-top{ display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
  .ctrl label{ font-size:13px; }
  .ctrl .val{ font-variant-numeric:tabular-nums; font-weight:600; font-size:13px; }
  .ctrl input[type=range]{ width:100%; accent-color:var(--accent); margin-top:4px; }
  .ctrl .num{ width:100%; margin-top:4px; padding:4px 8px; border:1px solid var(--line);
    border-radius:8px; font-size:13px; font-variant-numeric:tabular-nums; }
  .kpis{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  @media(max-width:560px){ .kpis{ grid-template-columns:repeat(2,1fr);} }
  .kpi{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px; }
  .kpi .k{ font-size:11px; color:var(--muted); }
  .kpi .v{ font-size:20px; font-weight:700; font-variant-numeric:tabular-nums; margin-top:2px; }
  .kpi .v.pos{ color:var(--pos); } .kpi .v.neg{ color:var(--neg); }
  .signal{ margin-top:12px; padding:10px 12px; border-radius:10px; font-size:13px; font-weight:600; }
  .signal.go{ background:#dcfce7; color:#166534; } .signal.mid{ background:#fef9c3; color:#854d0e; }
  .signal.stop{ background:#fee2e2; color:#991b1b; }
  table{ border-collapse:collapse; width:100%; font-size:12px; font-variant-numeric:tabular-nums; }
  th,td{ border-bottom:1px solid var(--line); padding:6px 8px; text-align:right; white-space:nowrap; }
  th:first-child,td:first-child{ text-align:left; }
  thead th{ color:var(--muted); font-weight:600; background:#f8fafc; }
  td.pos{ color:var(--pos); } td.neg{ color:var(--neg); }
  .chart{ overflow-x:auto; }
  .section{ margin-top:22px; }
  .formula{ padding:10px 0; border-bottom:1px dashed var(--line); }
  .formula-label{ font-size:13px; font-weight:600; margin-bottom:2px; }
  .formula-math{ font-size:18px; overflow-x:auto; }
  .formula-desc{ font-size:12px; color:var(--muted); margin-top:2px; }
  .wf{ overflow-x:auto; padding:6px 0; }
  ul.assumptions{ margin:0; padding-left:18px; font-size:13px; }
  ul.assumptions li{ margin-bottom:6px; }
  .a-src{ color:var(--muted); font-size:12px; margin-left:4px; }
  footer{ color:var(--muted); font-size:12px; margin-top:30px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${escapeHtml(model.title)} <span class="badge">v${escapeHtml(model.version)}</span><span class="badge">${escapeHtml(stage)}</span></h1>
    <div class="tags">決定論的試算（LLM不使用）。バーを動かすと即時に再計算します。</div>
  </header>

  <div class="note">
    <strong>注意:</strong> これは前提に基づく機械的な試算です。最終的な投資判断（Go / Hold / Stop）は必ず担当者が行ってください。
  </div>

  <div class="layout">
    <div class="panel" id="controls">
      <h2>入力（バーを動かす）</h2>
    </div>

    <div>
      <div class="kpis" id="kpis"></div>
      <div class="signal" id="signal"></div>

      <div class="panel section">
        <h2>累積キャッシュフロー</h2>
        <div class="chart" id="chart"></div>
      </div>

      <div class="panel section">
        <h2>価値の内訳（改善 − 現状, 年額）</h2>
        <div id="breakdown"></div>
      </div>

      <div class="panel section">
        <h2>年次明細</h2>
        <div style="overflow-x:auto"><table id="yearTable"></table></div>
      </div>
    </div>
  </div>

  <div class="panel section">
    <h2>計算式</h2>
    ${formulasHtml}
  </div>

  ${
    workflowSvg
      ? '<div class="panel section"><h2>' +
        escapeHtml(model.workflow.title || 'ワークフロー') +
        '</h2><div class="wf">' +
        workflowSvg +
        '</div></div>'
      : ''
  }

  <div class="panel section">
    <h2>前提（Assumptions）</h2>
    <ul class="assumptions">
${assumptionsHtml}
    </ul>
  </div>

  <footer>
    Generated from spec/decision-models/${escapeHtml(model.id)}.yaml — 計算ロジック正本: src/core/decision/roi.ts。
    再生成: <code>npm run roi:build</code>
  </footer>
</div>

<script type="application/json" id="roi-model">${modelJson}</script>
<script>
${ROI_CLIENT_JS}
</script>
</body>
</html>`;
}

/**
 * 内蔵クライアントJS（roi.ts の忠実移植）。
 * テンプレートリテラル/`${'$'}{}` を使わず文字列連結で組み立て、TSテンプレート内で安全に埋め込む。
 */
const ROI_CLIENT_JS = `
(function(){
  var MODEL = JSON.parse(document.getElementById('roi-model').textContent);
  var defaults = MODEL.defaults, sliders = MODEL.sliders;

  function straightLineDepreciation(investment, salvageRate, years, t){
    if(years<=0) return 0;
    if(t<1||t>years) return 0;
    return (investment - investment*salvageRate)/years;
  }
  function npv(rate, cfs){ var a=0; for(var t=0;t<cfs.length;t++){ a+=cfs[t]/Math.pow(1+rate,t);} return a; }
  function irr(cfs){
    function f(r){ return npv(r,cfs); }
    var lo=-0.9999, hi=10, flo=f(lo), fhi=f(hi);
    if(!isFinite(flo)||!isFinite(fhi)) return null;
    if(flo===0) return lo; if(fhi===0) return hi;
    if(flo*fhi>0) return null;
    for(var i=0;i<200;i++){ var mid=(lo+hi)/2, fm=f(mid);
      if(Math.abs(fm)<1e-7||(hi-lo)/2<1e-9) return mid;
      if(flo*fm<0){ hi=mid; fhi=fm; } else { lo=mid; flo=fm; } }
    return (lo+hi)/2;
  }
  function paybackYears(cum){
    for(var t=1;t<cum.length;t++){ if(cum[t]>=0){ var p=cum[t-1], c=cum[t];
      if(c===p) return t; var fr=-p/(c-p); return (t-1)+Math.min(Math.max(fr,0),1); } }
    return null;
  }
  function computeRoi(I){
    var salvage=I.investment*I.salvageRate, maintenance=I.investment*I.maintenanceRate;
    var laborSaving=I.laborReduction*I.wagePerPersonYear;
    var revenueGain=(I.improvedUnitPrice-I.baselineUnitPrice)*I.annualVolume;
    var annualBenefit=laborSaving+revenueGain+I.addedValuePerYear-I.negativeImpactPerYear;
    var rows=[], cfs=[], cumulative=-I.investment;
    cfs.push(-I.investment);
    rows.push({year:0,benefit:0,maintenance:0,depreciation:0,taxableIncome:0,tax:0,netCashflow:-I.investment,cumulativeCashflow:cumulative,discountedCashflow:-I.investment});
    var profit1=0;
    for(var t=1;t<=I.horizonYears;t++){
      var dep=straightLineDepreciation(I.investment,I.salvageRate,I.depreciationYears,t);
      var taxable=annualBenefit-maintenance-dep;
      var tax=Math.max(0,taxable)*I.taxRate;
      var netCf=annualBenefit-maintenance-tax;
      if(t===I.horizonYears) netCf+=salvage;
      cumulative+=netCf; cfs.push(netCf);
      rows.push({year:t,benefit:annualBenefit,maintenance:maintenance,depreciation:dep,taxableIncome:taxable,tax:tax,netCashflow:netCf,cumulativeCashflow:cumulative,discountedCashflow:netCf/Math.pow(1+I.discountRate,t)});
      if(t===1) profit1=annualBenefit-maintenance-dep-tax;
    }
    var cum=rows.map(function(r){return r.cumulativeCashflow;});
    var totalNet=0; for(var k=1;k<rows.length;k++) totalNet+=rows[k].netCashflow;
    return { annualBenefit:annualBenefit, maintenance:maintenance,
      annualDepreciation:straightLineDepreciation(I.investment,I.salvageRate,I.depreciationYears,1),
      annualAccountingProfit:profit1, rows:rows,
      roiAnnual: I.investment>0?profit1/I.investment:0,
      roiTotal: I.investment>0?(totalNet-I.investment)/I.investment:0,
      npv:npv(I.discountRate,cfs), irr:irr(cfs), paybackYears:paybackYears(cum) };
  }

  function yen(n){ if(n===null||!isFinite(n)) return '—'; var s=n<0?'-':''; return s+'¥'+Math.round(Math.abs(n)).toLocaleString('ja-JP'); }
  function pct(n){ if(n===null||!isFinite(n)) return '—'; return (n*100).toFixed(1)+'%'; }
  function yrs(n){ if(n===null||!isFinite(n)) return '期間内未達'; return n.toFixed(2)+' 年'; }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  var inputs = {};

  function readInputs(){
    var I = {};
    for(var key in defaults){ I[key] = defaults[key]; }
    for(var i=0;i<sliders.length;i++){ var k=sliders[i].key; if(inputs[k]!==undefined){ var v=parseFloat(inputs[k].value); if(!isNaN(v)) I[k]=v; } }
    return I;
  }

  function buildControls(){
    var host = document.getElementById('controls');
    var groups = {}; var order = [];
    for(var i=0;i<sliders.length;i++){ var g=sliders[i].group||'入力'; if(!groups[g]){ groups[g]=[]; order.push(g);} groups[g].push(sliders[i]); }
    for(var gi=0; gi<order.length; gi++){
      var g=order[gi];
      var gt=document.createElement('div'); gt.className='group-title'; gt.textContent=g; host.appendChild(gt);
      var arr=groups[g];
      for(var j=0;j<arr.length;j++){ (function(s){
        var wrap=document.createElement('div'); wrap.className='ctrl';
        var top=document.createElement('div'); top.className='ctrl-top';
        var lab=document.createElement('label'); lab.textContent=s.label; top.appendChild(lab);
        var val=document.createElement('span'); val.className='val'; top.appendChild(val);
        wrap.appendChild(top);
        var range=document.createElement('input'); range.type='range';
        range.min=s.min; range.max=s.max; range.step=s.step; range.value=defaults[s.key];
        var num=document.createElement('input'); num.type='number'; num.className='num';
        num.min=s.min; num.max=s.max; num.step=s.step; num.value=defaults[s.key];
        function showVal(){ var v=parseFloat(range.value);
          val.textContent = s.percent ? (v*100).toFixed(1)+'%' : (Math.round(v).toLocaleString('ja-JP') + (s.unit?(' '+s.unit):'')); }
        range.addEventListener('input', function(){ num.value=range.value; showVal(); render(); });
        num.addEventListener('input', function(){ range.value=num.value; showVal(); render(); });
        inputs[s.key]=range; showVal();
        wrap.appendChild(range); wrap.appendChild(num); host.appendChild(wrap);
      })(arr[j]); }
    }
  }

  function kpiCard(k, v, cls){ return '<div class="kpi"><div class="k">'+esc(k)+'</div><div class="v '+(cls||'')+'">'+v+'</div></div>'; }

  function renderChart(rows){
    var W=Math.max(420, rows.length*70), H=240, pad=34;
    var vals=rows.map(function(r){return r.cumulativeCashflow;});
    var maxV=Math.max.apply(null, vals.concat([0])), minV=Math.min.apply(null, vals.concat([0]));
    if(maxV===minV){ maxV+=1; minV-=1; }
    var x0=pad, x1=W-12, y0=H-pad, y1=12;
    function sx(i){ return x0 + (x1-x0)*(rows.length<=1?0:(i/(rows.length-1))); }
    function sy(v){ return y1 + (y0-y1)*(1-(v-minV)/(maxV-minV)); }
    var zeroY=sy(0);
    var svg='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">';
    svg+='<line x1="'+x0+'" y1="'+zeroY+'" x2="'+x1+'" y2="'+zeroY+'" stroke="#94a3b8" stroke-dasharray="4 3"/>';
    // bars
    for(var i=0;i<rows.length;i++){ var v=rows[i].cumulativeCashflow; var bx=sx(i)-10; var by=Math.min(sy(v),zeroY); var bh=Math.abs(sy(v)-zeroY);
      svg+='<rect x="'+bx+'" y="'+by+'" width="20" height="'+bh+'" rx="3" fill="'+(v>=0?'#86efac':'#fca5a5')+'"/>'; }
    // cumulative line
    var pts=''; for(var i2=0;i2<rows.length;i2++){ pts+=(i2?' ':'')+sx(i2)+','+sy(rows[i2].cumulativeCashflow); }
    svg+='<polyline points="'+pts+'" fill="none" stroke="#4f46e5" stroke-width="2"/>';
    for(var i3=0;i3<rows.length;i3++){ svg+='<circle cx="'+sx(i3)+'" cy="'+sy(rows[i3].cumulativeCashflow)+'" r="3" fill="#4f46e5"/>';
      svg+='<text x="'+sx(i3)+'" y="'+(y0+14)+'" text-anchor="middle" font-size="10" fill="#64748b">'+rows[i3].year+'年</text>'; }
    svg+='</svg>';
    return svg;
  }

  function render(){
    var I=readInputs();
    var R=computeRoi(I);
    var kp=document.getElementById('kpis');
    kp.innerHTML =
      kpiCard('年間利益(会計)', yen(R.annualAccountingProfit), R.annualAccountingProfit>=0?'pos':'neg')+
      kpiCard('ROI(期間)', pct(R.roiTotal), R.roiTotal>=0?'pos':'neg')+
      kpiCard('IRR', pct(R.irr), (R.irr!==null&&R.irr>=I.discountRate)?'pos':'neg')+
      kpiCard('NPV', yen(R.npv), R.npv>=0?'pos':'neg')+
      kpiCard('回収年数', yrs(R.paybackYears), '')+
      kpiCard('年間便益', yen(R.annualBenefit), R.annualBenefit>=0?'pos':'neg');

    var sig=document.getElementById('signal');
    var withinHorizon = R.paybackYears!==null && R.paybackYears<=I.horizonYears;
    if(R.npv>0 && withinHorizon){ sig.className='signal go'; sig.textContent='参考シグナル: 投資妙味あり（Go寄り） — ただし最終判断は人が行う'; }
    else if(R.npv>0){ sig.className='signal mid'; sig.textContent='参考シグナル: NPVは正だが回収が評価期間内に未達（要検討）'; }
    else { sig.className='signal stop'; sig.textContent='参考シグナル: 現条件では妙味薄い（Hold/Stop寄り）'; }

    document.getElementById('chart').innerHTML = renderChart(R.rows);

    // breakdown
    var laborSaving=I.laborReduction*I.wagePerPersonYear;
    var revenueGain=(I.improvedUnitPrice-I.baselineUnitPrice)*I.annualVolume;
    var items=[
      ['人件費削減 (削減人数 × 人件費)', laborSaving],
      ['売上増 ((改善単価 − 現状単価) × 数量)', revenueGain],
      ['付加価値', I.addedValuePerYear],
      ['負の差分 (悪化・人員減)', -I.negativeImpactPerYear],
      ['メンテ費', -R.maintenance]
    ];
    var bd='<table><thead><tr><th>項目</th><th>年額</th></tr></thead><tbody>';
    for(var bi=0;bi<items.length;bi++){ var nm=items[bi][0], amt=items[bi][1];
      bd+='<tr><td>'+esc(nm)+'</td><td class="'+(amt>=0?'pos':'neg')+'">'+yen(amt)+'</td></tr>'; }
    bd+='<tr><td><strong>= 年間便益(税引前, メンテ後)</strong></td><td class="'+((R.annualBenefit-R.maintenance)>=0?'pos':'neg')+'"><strong>'+yen(R.annualBenefit-R.maintenance)+'</strong></td></tr>';
    bd+='</tbody></table>';
    document.getElementById('breakdown').innerHTML=bd;

    // year table
    var yt='<thead><tr><th>年</th><th>便益</th><th>メンテ</th><th>償却</th><th>税</th><th>純CF</th><th>累積CF</th></tr></thead><tbody>';
    for(var yi=0;yi<R.rows.length;yi++){ var r=R.rows[yi];
      yt+='<tr><td>'+r.year+'</td><td>'+yen(r.benefit)+'</td><td>'+yen(r.maintenance)+'</td><td>'+yen(r.depreciation)+'</td><td>'+yen(r.tax)+'</td><td class="'+(r.netCashflow>=0?'pos':'neg')+'">'+yen(r.netCashflow)+'</td><td class="'+(r.cumulativeCashflow>=0?'pos':'neg')+'">'+yen(r.cumulativeCashflow)+'</td></tr>'; }
    yt+='</tbody>';
    document.getElementById('yearTable').innerHTML=yt;
  }

  buildControls();
  render();
})();
`;
