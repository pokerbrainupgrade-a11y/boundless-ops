import { poses } from '@/data/poses';
import { Pose } from '@/components/Pose';
import { allDrawingIds } from '@/data/program';

export function DevPoses() {
  const required = allDrawingIds();
  const defined = new Set(Object.keys(poses));
  const missing = required.filter((id) => !defined.has(id));
  const ids = [...new Set([...required, ...Object.keys(poses)])];
  return (
    <main class="screen" data-testid="pose-sheet" data-missing={missing.length}>
      <div class="section-h"><h1>Pose sheet</h1></div>
      <p class="muted small">{ids.length} poses · {missing.length} missing{missing.length ? ': ' + missing.join(', ') : ''}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">
        {ids.map((id) => (
          <div key={id} class="card" style="padding:8px;display:flex;flex-direction:column;align-items:center;gap:4px">
            <Pose id={id} size={104} />
            <span class="small muted" style="font-size:0.65rem;text-align:center;word-break:break-all">{id}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
