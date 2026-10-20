/** 品牌装饰，不代表论文、引用关系或任何实际统计。 */
export function GlassBloom({ compact = false }: { compact?: boolean }) {
  return <div className={`glass-bloom ${compact ? 'compact' : ''}`} aria-hidden="true">
    <div className="bloom-aura"/>
    <div className="bloom-petal petal-one"/>
    <div className="bloom-petal petal-two"/>
    <div className="bloom-petal petal-three"/>
    <div className="bloom-petal petal-four"/>
    <div className="bloom-core"/>
    <span className="bloom-satellite satellite-one"/>
    <span className="bloom-satellite satellite-two"/>
    <svg className="bloom-orbit" viewBox="0 0 320 320"><ellipse cx="160" cy="160" rx="146" ry="79" transform="rotate(-35 160 160)"/><circle cx="40" cy="209" r="3"/><circle cx="276" cy="102" r="2"/></svg>
  </div>;
}
