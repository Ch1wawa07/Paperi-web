/** 灵感的抽象轨迹，仅作装饰，不表示统计或研究关系。 */
export function GlassBloom({ compact = false }: { compact?: boolean }) {
  return <div className={`glass-bloom ${compact ? 'compact' : ''}`} aria-hidden="true">
    <div className="bloom-aura"/>
    <svg className="bloom-orbit" viewBox="0 0 240 180">
      <ellipse cx="120" cy="90" rx="102" ry="41" transform="rotate(-28 120 90)"/>
      <ellipse className="orbit-secondary" cx="120" cy="90" rx="83" ry="54" transform="rotate(32 120 90)"/>
      <circle className="orbit-halo" cx="172" cy="45" r="15"/>
      <circle className="orbit-point" cx="172" cy="45" r="2.5"/>
    </svg>
  </div>;
}
