"use client";
import { useId, useRef, useState } from "react";
export type VisualNode = {
  id: string;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  selected?: boolean;
  secondary?: boolean;
};
function fitBounds(nodes:VisualNode[]){const left=Math.min(...nodes.map(p=>p.x))-25,top=Math.min(...nodes.map(p=>p.y))-25,right=Math.max(...nodes.map(p=>p.x))+245,bottom=Math.max(...nodes.map(p=>p.y))+115;const scale=Math.min(1,850/(right-left),510/(bottom-top));return {scale,x:25-left*scale,y:25-top*scale};}
export function NodeCanvas({
  nodes,
  edges,
  onSelect,
  onMove,
  label,
  dashed = false,
  initialFit = false,
  constellation = false,
}: {
  nodes: VisualNode[];
  edges: { from: string; to: string; label?: string; kind?:string; highlight?:boolean }[];
  onSelect: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  label: string;
  dashed?: boolean;
  initialFit?: boolean;
  constellation?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null),
    marker = useId().replace(/:/g, "");
  const [view, setView] = useState(()=>initialFit&&nodes.length?fitBounds(nodes):{ x: 0, y: 0, scale: 1 });
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const drag = useRef<{
    id?: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const point = (e: { clientX: number; clientY: number }) => {
    const matrix = svg.current!.getScreenCTM();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix!.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  const position = (n: VisualNode) => positions[n.id] ?? n;
  const fit = () => {
    if (!nodes.length) return;
    const ps = nodes.map(position),
      left = Math.min(...ps.map((p) => p.x)) - 25,
      top = Math.min(...ps.map((p) => p.y)) - 25,
      right = Math.max(...ps.map((p) => p.x)) + 245,
      bottom = Math.max(...ps.map((p) => p.y)) + 115;
    const scale = Math.min(1, 850 / (right - left), 510 / (bottom - top));
    setView({ scale, x: 25 - left * scale, y: 25 - top * scale });
  };
  const zoom = (factor: number) =>
    setView((v) => ({
      ...v,
      scale: Math.max(0.15, Math.min(2.5, v.scale * factor)),
    }));
  return (
    <div className={`node-canvas-wrap ${constellation ? "constellation" : ""}`}>
      <div className="canvas-controls">
        <button
          className="small-button"
          aria-label="缩小画布"
          onClick={() => zoom(1 / 1.2)}
        >
          −
        </button>
        <span>{Math.round(view.scale * 100)}%</span>
        <button
          className="small-button"
          aria-label="放大画布"
          onClick={() => zoom(1.2)}
        >
          ＋
        </button>
        <button
          className="small-button"
          onClick={() => {
            setView({ x: 0, y: 0, scale: 1 });
            setPositions({});
          }}
        >
          重置视图
        </button>
        <button className="small-button" onClick={fit}>
          适应全部节点
        </button>
        <button className="small-button" onClick={()=>{if(!svg.current)return;const clone=svg.current.cloneNode(true) as SVGSVGElement;clone.setAttribute('xmlns','http://www.w3.org/2000/svg');const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='.canvas-node rect{fill:#f0f4fa;stroke:#8c9db4}.canvas-node.is-secondary rect{fill:#eee8fa;stroke:#ab91bd}text{fill:#29364b;font:13px sans-serif}.node-subtitle{font-size:11px}';clone.prepend(style);const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=label+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>导出当前视图 SVG</button><span>拖动节点 / 空白处平移 · 滚轮缩放</span>
      </div>
      <svg
        ref={svg}
        className="node-canvas"
        viewBox="0 0 900 560"
        aria-label={label}
        role="group"
        onWheel={(e) => {
          zoom(e.deltaY < 0 ? 1.08 : 1 / 1.08);
        }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          const p = point(e);
          drag.current = {
            startX: p.x,
            startY: p.y,
            x: view.x,
            y: view.y,
            moved: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const p = point(e),
            dx = p.x - d.startX,
            dy = p.y - d.startY;
          if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
          if (d.id)
            setPositions((v) => ({
              ...v,
              [d.id!]: { x: d.x + dx / view.scale, y: d.y + dy / view.scale },
            }));
          else setView((v) => ({ ...v, x: d.x + dx, y: d.y + dy }));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          if (d.id) {
            if (d.moved) {
              const p = point(e);
              onMove?.(
                d.id,
                d.x + (p.x - d.startX) / view.scale,
                d.y + (p.y - d.startY) / view.scale,
              );
            } else onSelect(d.id);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <marker
            id={marker}
            markerWidth="7"
            markerHeight="7"
            refX="7"
            refY="3.5"
            orient="auto"
          >
            <path d="M0 0 L7 3.5 L0 7" fill="#7793a8" />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {edges.map((e, i) => {
            const a = nodes.find((n) => n.id === e.from),
              b = nodes.find((n) => n.id === e.to);
            if (!a || !b) return null;
            const x = position(a),
              y = position(b),
              dx = y.x - x.x,
              dy = y.y - x.y,
              t = Math.min(110 / (Math.abs(dx) || 1), 45 / (Math.abs(dy) || 1));
            return (
              <g key={i} className="canvas-edge">
                <path
                  d={`M${x.x + 110 + dx * t},${x.y + 45 + dy * t} L${y.x + 110 - dx * t},${y.y + 45 - dy * t}`}
                  fill="none"
                  stroke={e.highlight?"#6557a0":"#7793a8"}
                  strokeWidth={e.highlight?3:1.4}
                  strokeDasharray={e.kind==="moderation"?"2 5":e.kind==="mediation"?"10 4":dashed ? "5 6" : undefined}
                  markerEnd={`url(#${marker})`}
                />
                {e.label && (
                  <text
                    x={(x.x + y.x) / 2 + 110}
                    y={(x.y + y.y) / 2 + 30}
                    textAnchor="middle"
                  >
                    {e.label.slice(0, 16)}{e.kind==="mediation"?" · 中介":e.kind==="moderation"?" · 调节":""}
                  </text>
                )}
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = position(n);
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-label={n.title}
                aria-pressed={!!n.selected}
                className={`canvas-node ${n.selected ? "is-selected" : ""} ${n.secondary?"is-secondary":""}`}
                transform={`translate(${p.x} ${p.y})`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(n.id);
                  }
                  if (
                    [
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    const x =
                        p.x +
                        (e.key === "ArrowLeft"
                          ? -15
                          : e.key === "ArrowRight"
                            ? 15
                            : 0),
                      y =
                        p.y +
                        (e.key === "ArrowUp"
                          ? -15
                          : e.key === "ArrowDown"
                            ? 15
                            : 0);
                    setPositions((v) => ({ ...v, [n.id]: { x, y } }));
                    onMove?.(n.id, x, y);
                  }
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const c = point(e);
                  drag.current = {
                    id: n.id,
                    startX: c.x,
                    startY: c.y,
                    x: p.x,
                    y: p.y,
                    moved: false,
                  };
                  svg.current?.setPointerCapture(e.pointerId);
                }}
              >
                <title>{n.title}</title>
                {constellation&&<circle className="star-halo" cx="110" cy="45" r={n.secondary?"36":"48"}/>}
                <rect width="220" height="90" rx="24" />
                <text x="16" y="28" className="node-subtitle">
                  {n.subtitle?.slice(0, 24)}
                </text>
                <text x="16" y="53">
                  {n.title.slice(0, 24)}
                </text>
                {n.title.length > 24 && (
                  <text x="16" y="73">
                    {n.title.slice(24, 47)}
                    {n.title.length > 47 ? "…" : ""}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
