import { useState, useMemo } from 'react'
import { Settings2, Check, X, ChevronDown } from 'lucide-react'
import {
  TEMPLATES, WIDGET_TYPES, METRICS, GROUP_BY,
  makeDashboard, DEFAULT_WIDGET_CONFIG
} from '../store/useConfig'
import { useMarketingData } from '../hooks/useMarketingData'
import Spinner from '../components/UI/Spinner'
import KPIWidget        from '../components/widgets/KPIWidget'
import TimeSeriesWidget from '../components/widgets/TimeSeriesWidget'
import BarWidget        from '../components/widgets/BarWidget'
import DonutWidget      from '../components/widgets/DonutWidget'
import TableWidget      from '../components/widgets/TableWidget'

/* 위젯 렌더러 */
const WIDGET_MAP = { kpi: KPIWidget, timeseries: TimeSeriesWidget, bar: BarWidget, donut: DonutWidget, table: TableWidget }

function renderWidget(type, data, config, dark) {
  const C = WIDGET_MAP[type]
  return C ? <C data={data} config={config} dark={dark}/> : null
}

/* ─── 위젯 에디터 패널 ─── */
function WidgetEditor({ slotId, widget, dark, onSave, onClose }) {
  const [type,   setType]   = useState(widget.type)
  const [config, setConfig] = useState({ ...widget.config })

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }))
  const toggleMetric = mid => {
    const cur = config.metrics || []
    setConfig(c => ({ ...c, metrics: cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid] }))
  }

  const sel = `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
    ${dark ? 'bg-[#0F1117] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`
  const inp = `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
    ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-700'}`
  const lab = `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-slate-400'}`

  /* 타입 변경 시 config 리셋 */
  const changeType = t => {
    setType(t)
    setConfig({ ...DEFAULT_WIDGET_CONFIG[t] })
  }

  return (
    <div className={`absolute inset-0 z-20 rounded-xl border overflow-auto
      ${dark ? 'bg-[#1A1D27] border-indigo-500' : 'bg-white border-indigo-400 shadow-xl'}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
        <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>위젯 설정</p>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onSave(slotId, { type, config })}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">
            <Check size={11}/> 저장
          </button>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#252836]' : 'text-slate-400 hover:bg-slate-100'}`}>
            <X size={13}/>
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* 위젯 타입 */}
        <div>
          <p className={`${lab} mb-2`}>위젯 타입</p>
          <div className="grid grid-cols-2 gap-1.5">
            {WIDGET_TYPES.map(wt => (
              <button key={wt.id} onClick={() => changeType(wt.id)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs transition-colors text-left
                  ${type === wt.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                    : dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/30' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                <span>{wt.icon}</span>
                <span className="font-medium">{wt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 제목 */}
        {type !== 'kpi' && (
          <div>
            <p className={`${lab} mb-1.5`}>제목</p>
            <input className={inp} value={config.title || ''} onChange={e => upd('title', e.target.value)} placeholder="위젯 제목"/>
          </div>
        )}

        {/* KPI: 지표 선택 */}
        {type === 'kpi' && (
          <>
            <div>
              <p className={`${lab} mb-2`}>지표</p>
              <div className="grid grid-cols-2 gap-1">
                {METRICS.map(m => (
                  <button key={m.id} onClick={() => upd('metric', m.id)}
                    className={`text-xs px-2 py-1.5 rounded-lg border text-left transition-colors
                      ${config.metric === m.id
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                        : dark ? 'border-[#252836] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={`${lab} mb-1.5`}>커스텀 라벨 (선택)</p>
              <input className={inp} value={config.label || ''}
                onChange={e => upd('label', e.target.value)} placeholder="기본: 지표명 사용"/>
            </div>
          </>
        )}

        {/* 시계열: 복수 지표 */}
        {type === 'timeseries' && (
          <div>
            <p className={`${lab} mb-2`}>지표 (복수 선택)</p>
            <div className="grid grid-cols-2 gap-1">
              {METRICS.map(m => {
                const sel2 = (config.metrics || []).includes(m.id)
                return (
                  <button key={m.id} onClick={() => toggleMetric(m.id)}
                    className={`text-xs px-2 py-1.5 rounded-lg border text-left transition-colors
                      ${sel2 ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500' : dark ? 'border-[#252836] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                    {sel2 && <span className="mr-1">✓</span>}{m.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 바/도넛: 지표 + 그룹 */}
        {(type === 'bar' || type === 'donut') && (
          <>
            <div>
              <p className={`${lab} mb-2`}>지표</p>
              <div className="grid grid-cols-2 gap-1">
                {METRICS.map(m => (
                  <button key={m.id} onClick={() => upd('metric', m.id)}
                    className={`text-xs px-2 py-1.5 rounded-lg border text-left
                      ${config.metric === m.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500' : dark ? 'border-[#252836] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={`${lab} mb-1.5`}>그룹 기준</p>
              <select className={sel} value={config.groupBy || 'Channel'} onChange={e => upd('groupBy', e.target.value)}>
                {GROUP_BY.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
          </>
        )}

        {/* 테이블 */}
        {type === 'table' && (
          <>
            <div>
              <p className={`${lab} mb-2`}>표시 지표 (복수 선택)</p>
              <div className="grid grid-cols-2 gap-1">
                {METRICS.map(m => {
                  const on = (config.metrics || []).includes(m.id)
                  return (
                    <button key={m.id} onClick={() => {
                      const cur = config.metrics || []
                      upd('metrics', on ? cur.filter(x => x !== m.id) : [...cur, m.id])
                    }}
                      className={`text-xs px-2 py-1.5 rounded-lg border text-left
                        ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500' : dark ? 'border-[#252836] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                      {on && '✓ '}{m.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className={`${lab} mb-1.5`}>그룹 기준</p>
              <select className={sel} value={config.groupBy || 'Channel'} onChange={e => upd('groupBy', e.target.value)}>
                {GROUP_BY.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── 템플릿 셀렉터 ─── */
function TemplateSelector({ current, onSelect, dark, onClose }) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50`}>
      <div className={`rounded-2xl border w-full max-w-lg p-6 ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-5">
          <p className={`font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>템플릿 선택</p>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#252836]' : 'text-slate-400 hover:bg-slate-100'}`}>
            <X size={16}/>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(TEMPLATES).map(tpl => (
            <button
              key={tpl.id}
              onClick={() => { onSelect(tpl.id); onClose() }}
              className={`p-4 rounded-xl border text-left transition-all
                ${current === tpl.id
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : dark ? 'border-[#252836] hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{tpl.name}</span>
                {current === tpl.id && <span className="text-xs text-indigo-500">현재</span>}
              </div>
              <p className={`text-xs mb-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{tpl.desc}</p>
              <p className={`text-[10px] font-mono ${dark ? 'text-slate-600' : 'text-slate-300'}`}>{tpl.preview}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── 메인 ─── */
export default function CustomDashboard({ dark, dashboardKey, initialDashboard, onSaveDashboard, pageTitle }) {
  const { data, loading } = useMarketingData()
  const [dashboard, setDashboard] = useState(() => initialDashboard || makeDashboard('A'))
  const [editMode,  setEditMode]  = useState(false)
  const [editSlot,  setEditSlot]  = useState(null)  // slotId being edited
  const [showTpl,   setShowTpl]   = useState(false)
  const [saved,     setSaved]     = useState(false)

  const template = TEMPLATES[dashboard.template] || TEMPLATES.A

  /* 슬롯별 row 그룹핑 */
  const rows = useMemo(() => {
    const map = {}
    template.slots.forEach(s => {
      if (!map[s.row]) map[s.row] = []
      map[s.row].push(s)
    })
    return Object.values(map)
  }, [template])

  /* 위젯 저장 */
  const handleWidgetSave = (slotId, widget) => {
    const next = { ...dashboard, widgets: { ...dashboard.widgets, [slotId]: widget } }
    setDashboard(next)
    setEditSlot(null)
  }

  /* 템플릿 변경 */
  const handleTemplateChange = tplId => {
    const next = makeDashboard(tplId)
    // 기존 위젯 설정 최대한 유지
    const tpl = TEMPLATES[tplId]
    tpl.slots.forEach(slot => {
      const existing = Object.values(dashboard.widgets || {})[0]
      if (dashboard.widgets[slot.id]) {
        next.widgets[slot.id] = dashboard.widgets[slot.id]
      }
    })
    setDashboard(next)
  }

  /* 저장 */
  const handleSave = () => {
    onSaveDashboard?.(dashboard)
    setSaved(true)
    setEditMode(false)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <Spinner dark={dark}/>

  /* 슬롯 하나 렌더 */
  const renderSlot = slot => {
    const w = dashboard.widgets[slot.id] || { type: slot.defaultType, config: { ...DEFAULT_WIDGET_CONFIG[slot.defaultType] } }
    const isEditing = editSlot === slot.id
    const wType = WIDGET_TYPES.find(t => t.id === w.type)

    return (
      <div key={slot.id} className={`${slot.span} relative`} style={{ minHeight: w.type === 'kpi' ? 120 : 220 }}>
        {editMode && !isEditing && (
          <button
            onClick={() => setEditSlot(slot.id)}
            className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-[10px] rounded-lg shadow-md hover:bg-indigo-700"
          >
            <Settings2 size={10}/> {wType?.icon} 편집
          </button>
        )}
        {isEditing ? (
          <WidgetEditor
            slotId={slot.id}
            widget={w}
            dark={dark}
            onSave={handleWidgetSave}
            onClose={() => setEditSlot(null)}
          />
        ) : (
          renderWidget(w.type, data, w.config, dark)
        )}
      </div>
    )
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* 툴바 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
            ${dark ? 'border-[#252836] text-slate-400' : 'border-slate-200 text-slate-400'}`}>
            {template.name}
          </span>
          {editMode && (
            <button onClick={() => setShowTpl(true)}
              className="text-xs px-2.5 py-1 rounded-lg border border-indigo-500/50 text-indigo-500 hover:bg-indigo-500/10 transition-colors">
              템플릿 변경
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button onClick={() => { setEditMode(false); setEditSlot(null) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                취소
              </button>
              <button onClick={handleSave}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-semibold
                  ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                <Check size={12}/> {saved ? '저장됨' : '저장'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:bg-[#1A1D27]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              <Settings2 size={12}/> 대시보드 편집
            </button>
          )}
        </div>
      </div>

      {/* 그리드 */}
      {rows.map((rowSlots, ri) => (
        <div key={ri} className="grid grid-cols-4 gap-4">
          {rowSlots.map(renderSlot)}
        </div>
      ))}

      {/* 템플릿 선택 모달 */}
      {showTpl && (
        <TemplateSelector
          current={dashboard.template}
          dark={dark}
          onSelect={handleTemplateChange}
          onClose={() => setShowTpl(false)}
        />
      )}
    </div>
  )
}
