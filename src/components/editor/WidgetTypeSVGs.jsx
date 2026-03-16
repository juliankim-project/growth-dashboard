/* ── 위젯 타입별 미니 SVG 프리뷰 아이콘 ── */

const C = {
  active: '#579DFF',     // indigo-500
  darkLine: '#94a3b8',   // slate-400
  lightLine: '#cbd5e1',  // slate-300
  darkFill: '#334155',   // slate-700
  lightFill: '#e2e8f0',  // slate-200
}

function s(active, dark) {
  return {
    stroke: active ? C.active : dark ? C.darkLine : C.lightLine,
    fill: active ? `${C.active}22` : dark ? C.darkFill : C.lightFill,
  }
}

/* ── KPI: 숫자 카드 ── */
function KpiSvg({ active, dark }) {
  const { stroke, fill } = s(active, dark)
  return (
    <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
      <rect x="4" y="4" width="40" height="24" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5"/>
      <text x="14" y="18" fontSize="9" fontWeight="bold" fill={stroke}>123</text>
      <path d="M36 12l-3 6h6z" fill={active ? C.active : '#10b981'} opacity="0.7"/>
    </svg>
  )
}

/* ── Line: 꺾은선 차트 ── */
function LineSvg({ active, dark }) {
  const { stroke, fill } = s(active, dark)
  return (
    <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
      <rect x="2" y="2" width="44" height="28" rx="3" fill={fill} strokeWidth="0"/>
      <polyline points="6,24 14,18 22,20 30,10 38,14 44,8" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M6,24 14,18 22,20 30,10 38,14 44,8 44,28 6,28Z" fill={stroke} opacity="0.1"/>
    </svg>
  )
}

/* ── Bar: 세로 막대 ── */
function BarSvg({ active, dark }) {
  const { stroke, fill } = s(active, dark)
  return (
    <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
      <rect x="2" y="2" width="44" height="28" rx="3" fill={fill} strokeWidth="0"/>
      <rect x="8"  y="14" width="7" height="14" rx="1.5" fill={stroke} opacity="0.9"/>
      <rect x="20" y="8"  width="7" height="20" rx="1.5" fill={stroke} opacity="0.7"/>
      <rect x="32" y="11" width="7" height="17" rx="1.5" fill={stroke} opacity="0.5"/>
    </svg>
  )
}

/* ── Table: 데이터 테이블 ── */
function TableSvg({ active, dark }) {
  const { stroke, fill } = s(active, dark)
  return (
    <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
      <rect x="2" y="2" width="44" height="28" rx="3" fill={fill} strokeWidth="0"/>
      <rect x="5" y="5" width="38" height="5" rx="1" fill={stroke} opacity="0.6"/>
      <line x1="5" y1="14" x2="43" y2="14" stroke={stroke} strokeWidth="0.8" opacity="0.4"/>
      <line x1="5" y1="19" x2="43" y2="19" stroke={stroke} strokeWidth="0.8" opacity="0.4"/>
      <line x1="5" y1="24" x2="43" y2="24" stroke={stroke} strokeWidth="0.8" opacity="0.4"/>
      <line x1="18" y1="10" x2="18" y2="28" stroke={stroke} strokeWidth="0.5" opacity="0.3"/>
      <line x1="32" y1="10" x2="32" y2="28" stroke={stroke} strokeWidth="0.5" opacity="0.3"/>
    </svg>
  )
}

/* ── Funnel: 전환 퍼널 ── */
function FunnelSvg({ active, dark }) {
  const { stroke, fill } = s(active, dark)
  return (
    <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
      <rect x="2" y="2" width="44" height="28" rx="3" fill={fill} strokeWidth="0"/>
      <rect x="6"  y="6"  width="36" height="5" rx="1.5" fill={stroke} opacity="0.9"/>
      <rect x="10" y="14" width="28" height="5" rx="1.5" fill={stroke} opacity="0.65"/>
      <rect x="16" y="22" width="16" height="5" rx="1.5" fill={stroke} opacity="0.4"/>
    </svg>
  )
}

/* ── Pie: 파이/도넛 ── */
function PieSvg({ active, dark }) {
  const { stroke, fill } = s(active, dark)
  return (
    <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
      <rect x="2" y="2" width="44" height="28" rx="3" fill={fill} strokeWidth="0"/>
      <circle cx="24" cy="16" r="10" fill="none" stroke={stroke} strokeWidth="2.5" opacity="0.35"/>
      <path d="M24 6 A10 10 0 0 1 33.66 21L24 16Z" fill={stroke} opacity="0.85"/>
      <path d="M24 6 A10 10 0 0 0 14.34 21L24 16Z" fill={stroke} opacity="0.5"/>
    </svg>
  )
}

/* ── Comparison: 비교 분석 ── */
function ComparisonSvg({ active, dark }) {
  const { stroke, fill } = s(active, dark)
  return (
    <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
      <rect x="2" y="2" width="44" height="28" rx="3" fill={fill} strokeWidth="0"/>
      <rect x="6"  y="10" width="7" height="16" rx="1.5" fill={stroke} opacity="0.9"/>
      <rect x="15" y="14" width="7" height="12" rx="1.5" fill={stroke} opacity="0.45"/>
      <rect x="26" y="8"  width="7" height="18" rx="1.5" fill={stroke} opacity="0.9"/>
      <rect x="35" y="12" width="7" height="14" rx="1.5" fill={stroke} opacity="0.45"/>
      <text x="22" y="18" fontSize="7" fontWeight="bold" fill={stroke} opacity="0.6">⇄</text>
    </svg>
  )
}

/* ── Ranking: 수평 랭킹 바 ── */
function RankingSvg({ active, dark }) {
  const { stroke, fill } = s(active, dark)
  return (
    <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
      <rect x="2" y="2" width="44" height="28" rx="3" fill={fill} strokeWidth="0"/>
      <rect x="6" y="6"  width="34" height="4" rx="1" fill={stroke} opacity="0.9"/>
      <rect x="6" y="13" width="26" height="4" rx="1" fill={stroke} opacity="0.65"/>
      <rect x="6" y="20" width="18" height="4" rx="1" fill={stroke} opacity="0.45"/>
      <rect x="6" y="27" width="10" height="2.5" rx="0.8" fill={stroke} opacity="0.25"/>
    </svg>
  )
}

/* ── Alert: 신호등 ── */
function AlertSvg({ active, dark }) {
  const { fill } = s(active, dark)
  return (
    <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
      <rect x="2" y="2" width="44" height="28" rx="3" fill={fill} strokeWidth="0"/>
      <circle cx="14" cy="16" r="5" fill="#10b981" opacity="0.85"/>
      <circle cx="27" cy="16" r="5" fill="#f59e0b" opacity="0.85"/>
      <circle cx="40" cy="16" r="5" fill="#ef4444" opacity="0.85"/>
    </svg>
  )
}

/* ── Timeline: 스파크라인 ── */
function TimelineSvg({ active, dark }) {
  const { stroke, fill } = s(active, dark)
  return (
    <svg viewBox="0 0 48 32" fill="none" className="w-full h-full">
      <rect x="2" y="2" width="44" height="28" rx="3" fill={fill} strokeWidth="0"/>
      {/* 상단 스파크라인 */}
      <polyline points="6,10 12,8 18,12 24,9 30,11 36,7 42,10" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9"/>
      {/* 중간 스파크라인 */}
      <polyline points="6,18 12,20 18,17 24,19 30,16 36,19 42,17" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.55"/>
      {/* 하단 점선 */}
      <line x1="6" y1="26" x2="42" y2="26" stroke={stroke} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.3"/>
    </svg>
  )
}

export const WIDGET_TYPE_SVGS = {
  kpi: KpiSvg,
  line: LineSvg,
  bar: BarSvg,
  table: TableSvg,
  funnel: FunnelSvg,
  pie: PieSvg,
  comparison: ComparisonSvg,
  ranking: RankingSvg,
  alert: AlertSvg,
  timeline: TimelineSvg,
}
