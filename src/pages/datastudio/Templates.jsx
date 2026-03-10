import { DASHBOARD_TEMPLATES } from '../../store/dashboardTemplates'
import { useConfig } from '../../store/useConfig'
import { Trash2 } from 'lucide-react'

/* ── 슬롯 타입별 색상 ── */
const TYPE_COLORS = {
  kpi:        { bg: 'bg-indigo-500', label: 'KPI' },
  line:       { bg: 'bg-emerald-500', label: '라인' },
  bar:        { bg: 'bg-amber-500', label: '바' },
  pie:        { bg: 'bg-rose-500', label: '파이' },
  table:      { bg: 'bg-sky-500', label: '테이블' },
  funnel:     { bg: 'bg-purple-500', label: '퍼널' },
  comparison: { bg: 'bg-cyan-500', label: '비교' },
  ranking:    { bg: 'bg-orange-500', label: '랭킹' },
  alert:      { bg: 'bg-red-500', label: '알림' },
  timeline:   { bg: 'bg-teal-500', label: '타임라인' },
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

/* ═══════════ 템플릿 카드 ═══════════ */
function TemplateCard({ tpl, dark, sub, onDelete }) {
  return (
    <div className={`relative group rounded-xl border p-4 flex flex-col gap-3 transition-colors
      ${dark ? 'border-[#252836] bg-[#13151F] hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      {onDelete && (
        <button onClick={() => onDelete(tpl.id)}
          className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          title="템플릿 삭제">
          <Trash2 size={11} />
        </button>
      )}
      <div className="flex items-center gap-2">
        <span className="text-lg">{tpl.icon}</span>
        <div>
          <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{tpl.name}</p>
          {tpl.desc && <p className={`text-[10px] mt-0.5 ${sub}`}>{tpl.desc}</p>}
        </div>
      </div>
      <MiniPreview slotDefs={tpl.slotDefs} dark={dark} />
      <SlotSummary slotDefs={tpl.slotDefs} dark={dark} />
    </div>
  )
}

/* ═══════════════════════════════════════════
   Templates — Data Studio 템플릿 갤러리 페이지
   ═══════════════════════════════════════════ */
export default function Templates({ dark }) {
  const sub = dark ? 'text-slate-500' : 'text-slate-400'
  const { getCustomTemplates, deleteCustomTemplate } = useConfig()
  const customTemplates = getCustomTemplates()

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div>
        <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>위젯 템플릿</h2>
        <p className={`text-xs mt-1 ${sub}`}>
          미리 구성된 대시보드 레이아웃입니다. 각 대시보드 탭에서 "템플릿 불러오기" 버튼으로 적용하세요.
        </p>
      </div>

      {/* ── 기본 템플릿 ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className={`text-[11px] font-bold uppercase tracking-wider ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            기본 템플릿
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${dark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
            {DASHBOARD_TEMPLATES.length}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DASHBOARD_TEMPLATES.map(tpl => (
            <TemplateCard key={tpl.id} tpl={tpl} dark={dark} sub={sub} />
          ))}
        </div>
      </div>

      {/* ── 커스텀 템플릿 ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className={`text-[11px] font-bold uppercase tracking-wider ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            커스텀 템플릿
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${dark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
            {customTemplates.length}
          </span>
        </div>
        {customTemplates.length === 0 ? (
          <div className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-12 gap-2
            ${dark ? 'border-[#252836] text-slate-600' : 'border-slate-200 text-slate-400'}`}>
            <span className="text-3xl">📁</span>
            <p className="text-xs">저장된 커스텀 템플릿이 없습니다</p>
            <p className={`text-[10px] ${dark ? 'text-slate-700' : 'text-slate-300'}`}>대시보드에서 "템플릿 저장" 버튼으로 추가해보세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customTemplates.map(tpl => (
              <TemplateCard key={tpl.id} tpl={tpl} dark={dark} sub={sub} onDelete={deleteCustomTemplate} />
            ))}
          </div>
        )}
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
