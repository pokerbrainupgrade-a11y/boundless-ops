import type { ChartData } from '@/lib/charts';

const W = 340, H = 180, PL = 34, PR = 10, PT = 14, PB = 30;

/** Hand-rolled SVG bar/line chart. */
export function Chart({ data }: { data: ChartData }) {
  const series = data.series.filter((s) => s.points.length);
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))];
  const ys = series.flatMap((s) => s.points.map((p) => p.y)).filter((y): y is number => y !== null);
  const empty = ys.length === 0;
  const max = empty ? 1 : Math.max(...ys) * 1.1;
  const min = empty || data.kind === 'bar' ? 0 : Math.min(...ys) * 0.9;
  const iw = W - PL - PR, ih = H - PT - PB;
  const xi = (x: string) => xs.indexOf(x);
  const yPix = (y: number) => PT + ih - ((y - min) / (max - min || 1)) * ih;
  const slot = iw / Math.max(1, xs.length);
  const bw = Math.max(3, (slot * 0.7) / Math.max(1, series.length));
  const ticks = [0, 0.5, 1].map((t) => min + (max - min) * t);
  return (
    <figure class="card stack" data-testid={`chart-${data.id}`} data-empty={empty} style="margin:0;gap:6px">
      <figcaption class="row between"><h3>{data.title}</h3>{data.unit && <span class="muted small">{data.unit}</span>}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${data.title}: ${empty ? 'no data yet' : series.map((s) => `${s.name} ${s.points.map((p) => `${p.x} ${p.y ?? '—'}`).join(', ')}`).join('; ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={yPix(t)} y2={yPix(t)} stroke="var(--surface-2)" />
            <text x={PL - 4} y={yPix(t) + 4} text-anchor="end" font-size="9" font-family="var(--font-timer)" fill="var(--muted)">{Math.round(t)}</text>
          </g>
        ))}
        {xs.map((x, i) => <text key={x} x={PL + slot * i + slot / 2} y={H - PB + 14} text-anchor="middle" font-size="9" font-family="var(--font-timer)" fill="var(--muted)">{x}</text>)}
        {empty && <text x={W / 2} y={H / 2} text-anchor="middle" font-size="11" fill="var(--muted)">No data yet</text>}
        {data.kind === 'bar' && series.map((s, si) => s.points.map((p) => {
          if (p.y === null) return null;
          const x = PL + slot * xi(p.x) + slot * 0.15 + bw * si;
          const y = yPix(p.y);
          return <rect key={s.name + p.x} x={x} y={y} width={bw} height={PT + ih - y} fill={s.color} opacity="0.9" />;
        }))}
        {data.kind === 'line' && series.map((s) => {
          const pts = s.points.filter((p) => p.y !== null).map((p) => [PL + slot * xi(p.x) + slot / 2, yPix(p.y!)] as const);
          if (!pts.length) return null;
          return (
            <g key={s.name}>
              <polyline points={pts.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" />
              {pts.map((p, i) => <rect key={i} x={p[0] - 3} y={p[1] - 3} width="6" height="6" fill={s.color} />)}
            </g>
          );
        })}
      </svg>
      <div class="row wrap" style="gap:6px">
        {series.slice(0, 8).map((s) => <span key={s.name} class="small muted"><span style={`display:inline-block;width:10px;height:10px;background:${s.color};margin-right:4px;vertical-align:middle`} />{s.name}</span>)}
      </div>
    </figure>
  );
}
