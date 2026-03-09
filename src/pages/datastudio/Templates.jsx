import { DASHBOARD_TEMPLATES } from '../../store/dashboardTemplates'

/* ── 슬롯 타입별 색상 ── */
const TYPE_COLORS = {
  kpi:        { bg: 'bg-indigo-500', label: 'KPI' },
  timeseries: { bg: 'bg-emerald-500', label: '시계열' },
  bar:        { bg: 'bg-amber-500', label: '바' },
  donut:      { bg: 'bg-rose-500', label: '도넛' },
  table:      { bg: 'bg-sky-500', label: '테이블' },
}

/* ═══════════ 미니 레이아웃 프리뷰 ═══════════ */
function MiniPreview({ slotDefs, dark }) {
  /* 슬롯을 행 단위로 분류 (widthPct 합산 100 기준) */
  const rows = []
  let currentRow = []
  let rowWidth = 0

  slotDefs.forEach(def => {
    if (rowWidth + def.widthPct > 101) {
      rows.push(currentRow)
      currentRow = [def]
      rowWidth = def.widthPct
    } else {
      currentRow.push(def)
      rowWidth += def.widthPct
    }
  })
  if (currentRow.length > 0) rows.push(currentRow)

  return (
    <div className={`rounded-lg p-2 flex flex-col gap-1
      ${dark ? 'bg-[#0D0F18]' : 'bg-slate-50'}`}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((def, ci) => {
            const tc = TYPE_COLORS[def.type] || TYPE_COLORS.kpi
            const isKpi = def.type === 'kpi'
            return (
              <div key={ci}
                style={{ width: `${def.widthPct}%` }}
                className={`${tc.bg} rounded-sm flex items-center justify-center
                  ${isKpi ? 'h-5' : 'h-8'} opacity-80`}>
                <span className="text-white text-[7px] font-bold">{tc.label}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ═══════════ 슬롯 타입 요약 뱃지 ═══════════ */
function SlotSummary({ slotDefs, dark }) {
  const counts = {}
  slotDefs.forEach(d => { counts[d.type] = (counts[d.type] || 0) + 1 })

  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(counts).map(([type, count]) => {
        const tc = TYPE_COLORS[type] || TYPE_COLORS.kpi
        return (
          <span key={type}
            className={`text-[9px] px-1.5 py-0.5 rounded font-semibold
              ${dark ? `${tc.bg}/15 text-white/70` : `${tc.bg}/10 text-slate-600`}`}>
            {tc.label} ×{count}
          </span>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════
   Templates — Data Studio 템플릿 갤러리 페이지
   ═══════════════════════════════════════════ */
export default function Templates({ dark }) {
  const sub = dark ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className="p-6 flex flex-col gap-5 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div>
        <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>위젯 템플릿</h2>
        <p className={`text-xs mt-1 ${sub}`}>
          미리 구성된 대시보드 레이아웃입니다. 각 대시보드 탭에서 "템플릿 불러오기" 버튼으로 적용하세요.
        </p>
      </div>

      {/* 템플릿 그리드 2×2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DASHBOARD_TEMPLATES.map(tpl => (
          <div key={tpl.id}
            className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors
              ${dark ? 'border-[#252836] bg-[#13151F] hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            {/* 타이틀 */}
            <div className="flex items-center gap-2">
              <span className="text-lg">{tpl.icon}</span>
              <div>
                <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{tpl.name}</p>
                <p className={`text-[10px] mt-0.5 ${sub}`}>{tpl.desc}</p>
              </div>
            </div>

            {/* 미니 프리뷰 */}
            <MiniPreview slotDefs={tpl.slotDefs} dark={dark} />

            {/* 슬롯 요약 */}
            <SlotSummary slotDefs={tpl.slotDefs} dark={dark} />
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div className={`rounded-lg border px-4 py-3 text-xs
        ${dark ? 'border-[#252836] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
        💡 템플릿 적용 방법: 대시보드 탭 → 상단 "템플릿 불러오기" 버튼 클릭 → 원하는 템플릿 선택.
        적용 후 각 위젯의 지표와 설정을 자유롭게 수정할 수 있습니다.
      </div>
    </div>
  )
}
