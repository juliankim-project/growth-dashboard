import { useState, useMemo, useEffect } from 'react'
import { Settings2, Check, X, Plus, Database } from 'lucide-react'
import {
  TEMPLATES, WIDGET_TYPES, METRICS, GROUP_BY,
  makeDashboard, DEFAULT_WIDGET_CONFIG,
} from '../store/useConfig'
import { useTableData } from '../hooks/useTableData'

/* ── fieldMap 적용: 커스텀 컬럼명 → 표준 필드명으로 복사 ── */
function applyFieldMap(rows, fieldMap) {
  if (!fieldMap || Object.keys(fieldMap).length === 0) return rows
  return rows.map(row => {
    const mapped = { ...row }
    Object.entries(fieldMap).forEach(([metricId, customCol]) => {
      const m = METRICS.find(x => x.id === metricId)
      if (m && m.field && customCol && customCol !== m.field) {
        mapped[m.field] = row[customCol] ?? row[m.field]
      }
    })
    return mapped
  })
}
import Spinner             from '../components/UI/Spinner'
import KPIWidget           from '../components/widgets/KPIWidget'
import TimeSeriesWidget    from '../components/widgets/TimeSeriesWidget'
import BarWidget           from '../components/widgets/BarWidget'
import DonutWidget         from '../components/widgets/DonutWidget'
import TableWidget         from '../components/widgets/TableWidget'

const WIDGET_MAP = {
  kpi: KPIWidget, timeseries: TimeSeriesWidget,
  bar: BarWidget, donut: DonutWidget, table: TableWidget,
}
const renderWidget = (type, data, cfg, dark) => {
  const C = WIDGET_MAP[type]
  return C ? <C data={data} config={cfg} dark={dark}/> : null
}

/* ══════════════════════════════════════════
   데이터 소스 셀렉터 (편집모드에서 테이블 선택)
══════════════════════════════════════════ */
function DataSourceSelector({ tableName, onChange, dark }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(tableName)

  // 일반적으로 사용되는 테이블 예시 (초기값)
  const KNOWN_TABLES = ['marketing_perf']

  const commit = () => {
    const t = draft.trim()
    if (t) onChange(t)
    setEditing(false)
  }

  if (!editing) return (
    <button
      onClick={() => { setDraft(tableName); setEditing(true) }}
      title="데이터 소스 테이블 변경"
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors
        ${dark
          ? 'border-[#252836] text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40'
          : 'border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300'}`}
    >
      <Database size={11}/>
      <span className="font-mono">{tableName}</span>
    </button>
  )

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5
      ${dark ? 'border-indigo-500 bg-[#0F1117]' : 'border-indigo-400 bg-white shadow'}`}>
      <Database size={11} className="text-indigo-400 shrink-0"/>
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        list="known-tables"
        placeholder="테이블명 입력"
        className={`text-xs outline-none w-36 font-mono bg-transparent
          ${dark ? 'text-white placeholder:text-slate-600' : 'text-slate-800 placeholder:text-slate-300'}`}
      />
      <datalist id="known-tables">
        {KNOWN_TABLES.map(t => <option key={t} value={t}/>)}
      </datalist>
      <button onClick={commit}
        className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700">
        확인
      </button>
      <button onClick={() => setEditing(false)}
        className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'text-slate-400 hover:text-white' : 'text-slate-500'}`}>
        취소
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════
   위젯 에디터
══════════════════════════════════════════ */
function WidgetEditor({ slotId, widget, dark, onSave, onClose }) {
  const [type,   setType]   = useState(widget.type)
  const [config, setConfig] = useState({ ...widget.config })

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }))
  const toggleMetric = mid => {
    const cur = config.metrics || []
    setConfig(c => ({ ...c, metrics: cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid] }))
  }
  const changeType = t => { setType(t); setConfig({ ...DEFAULT_WIDGET_CONFIG[t] }) }

  const cls = {
    sel: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`,
    inp: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-slate-400'}`,
    btn: (on) => `text-xs px-2 py-1.5 rounded-lg border text-left transition-colors
      ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
           : dark ? 'border-[#252836] text-slate-400' : 'border-slate-200 text-slate-500'}`,
  }

  return (
    <div className={`absolute inset-0 z-20 rounded-xl border overflow-auto
      ${dark ? 'bg-[#1A1D27] border-indigo-500' : 'bg-white border-indigo-400 shadow-xl'}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b
        ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
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
          <p className={`${cls.lab} mb-2`}>위젯 타입</p>
          <div className="grid grid-cols-2 gap-1.5">
            {WIDGET_TYPES.map(wt => (
              <button key={wt.id} onClick={() => changeType(wt.id)}
                className={cls.btn(type === wt.id) + ' flex items-center gap-2'}>
                <span>{wt.icon}</span><span className="font-medium">{wt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {type !== 'kpi' && (
          <div>
            <p className={`${cls.lab} mb-1.5`}>제목</p>
            <input className={cls.inp} value={config.title || ''}
              onChange={e => upd('title', e.target.value)} placeholder="위젯 제목"/>
          </div>
        )}

        {type === 'kpi' && (
          <>
            <div>
              <p className={`${cls.lab} mb-2`}>지표</p>
              <div className="grid grid-cols-2 gap-1">
                {METRICS.map(m => (
                  <button key={m.id} onClick={() => upd('metric', m.id)} className={cls.btn(config.metric === m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={`${cls.lab} mb-1.5`}>커스텀 라벨</p>
              <input className={cls.inp} value={config.label || ''}
                onChange={e => upd('label', e.target.value)} placeholder="기본: 지표명 사용"/>
            </div>
          </>
        )}

        {type === 'timeseries' && (
          <div>
            <p className={`${cls.lab} mb-2`}>지표 (복수 선택)</p>
            <div className="grid grid-cols-2 gap-1">
              {METRICS.map(m => {
                const on = (config.metrics || []).includes(m.id)
                return (
                  <button key={m.id} onClick={() => toggleMetric(m.id)} className={cls.btn(on)}>
                    {on && '✓ '}{m.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {(type === 'bar' || type === 'donut') && (
          <>
            <div>
              <p className={`${cls.lab} mb-2`}>지표</p>
              <div className="grid grid-cols-2 gap-1">
                {METRICS.map(m => (
                  <button key={m.id} onClick={() => upd('metric', m.id)} className={cls.btn(config.metric === m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className={`${cls.lab} mb-1.5`}>그룹 기준</p>
              <select className={cls.sel} value={config.groupBy || 'channel'}
                onChange={e => upd('groupBy', e.target.value)}>
                {GROUP_BY.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
          </>
        )}

        {type === 'table' && (
          <>
            <div>
              <p className={`${cls.lab} mb-2`}>표시 지표 (복수 선택)</p>
              <div className="grid grid-cols-2 gap-1">
                {METRICS.map(m => {
                  const on = (config.metrics || []).includes(m.id)
                  return (
                    <button key={m.id} onClick={() => {
                      const cur = config.metrics || []
                      upd('metrics', on ? cur.filter(x => x !== m.id) : [...cur, m.id])
                    }} className={cls.btn(on)}>
                      {on && '✓ '}{m.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className={`${cls.lab} mb-1.5`}>그룹 기준</p>
              <select className={cls.sel} value={config.groupBy || 'channel'}
                onChange={e => upd('groupBy', e.target.value)}>
                {GROUP_BY.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   템플릿 셀렉터
══════════════════════════════════════════ */
function TemplateSelector({ current, onSelect, dark, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`rounded-2xl border w-full max-w-lg p-6
        ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-5">
          <p className={`font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>템플릿 선택</p>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#252836]' : 'text-slate-400 hover:bg-slate-100'}`}>
            <X size={16}/>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(TEMPLATES).map(tpl => (
            <button key={tpl.id} onClick={() => { onSelect(tpl.id); onClose() }}
              className={`p-4 rounded-xl border text-left transition-all
                ${current === tpl.id
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : dark ? 'border-[#252836] hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-300'}`}>
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

/* ══════════════════════════════════════════
   L3 탭 바
   - 클릭: 탭 전환
   - 더블클릭: 이름 변경 (인라인 입력)
   - 호버 ×: 탭 삭제
   - + 탭 추가 버튼 (추가 후 자동 이동 없음)
══════════════════════════════════════════ */
function L3TabBar({ tabs, activeId, onSelect, onAdd, onRemove, onRename, dark }) {
  const [addingTab, setAddingTab] = useState(false)
  const [newLabel,  setNewLabel]  = useState('')
  const [renaming,  setRenaming]  = useState(null) // { id, value }

  const commitAdd = () => {
    if (!newLabel.trim()) { setAddingTab(false); return }
    onAdd(newLabel.trim())
    setAddingTab(false)
    setNewLabel('')
  }

  const commitRename = () => {
    if (!renaming) return
    onRename(renaming.id, renaming.value.trim() || '탭')
    setRenaming(null)
  }

  return (
    <div className={`flex items-center gap-0.5 px-5 pt-3 border-b overflow-x-auto shrink-0
      ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>

      {tabs.map(tab => (
        <div key={tab.id} className="relative group shrink-0">
          {renaming?.id === tab.id ? (
            <input
              autoFocus
              value={renaming.value}
              onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter')  commitRename()
                if (e.key === 'Escape') setRenaming(null)
              }}
              className={`text-xs px-3 py-2 rounded-t-lg outline-none w-24
                border-b-2 border-indigo-500
                ${dark ? 'bg-transparent text-white' : 'bg-transparent text-slate-800'}`}
            />
          ) : (
            <button
              onClick={() => onSelect(tab.id)}
              onDoubleClick={() => setRenaming({ id: tab.id, value: tab.label })}
              title="더블클릭으로 이름 변경"
              className={`text-xs px-4 py-2.5 rounded-t-lg border-b-2 font-medium
                transition-colors whitespace-nowrap
                ${activeId === tab.id
                  ? dark
                    ? 'border-indigo-500 text-white bg-[#1A1D27]'
                    : 'border-indigo-500 text-indigo-600 bg-white'
                  : dark
                    ? 'border-transparent text-slate-400 hover:text-white hover:bg-[#1A1D27]/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab.label}
            </button>
          )}

          {tabs.length > 1 && (
            <button
              onClick={() => onRemove(tab.id)}
              title="탭 삭제"
              className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full
                bg-red-500/80 hover:bg-red-600 text-white
                opacity-0 group-hover:opacity-100 transition-opacity
                flex items-center justify-center text-[8px] leading-none"
            >×</button>
          )}
        </div>
      ))}

      {addingTab ? (
        <div className="flex items-center gap-1 pb-px ml-1 shrink-0">
          <input
            autoFocus
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitAdd()
              if (e.key === 'Escape') { setAddingTab(false); setNewLabel('') }
            }}
            placeholder="탭 이름"
            className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none w-24
              ${dark
                ? 'border-indigo-500 bg-transparent text-white placeholder:text-slate-600'
                : 'border-indigo-400 bg-transparent text-slate-800 placeholder:text-slate-300'}`}
          />
          <button onClick={commitAdd}
            className="text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            확인
          </button>
          <button onClick={() => { setAddingTab(false); setNewLabel('') }}
            className={`text-xs px-2 py-1.5 rounded-lg
              ${dark ? 'text-slate-400 hover:text-white' : 'text-slate-500'}`}>
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingTab(true)}
          className={`shrink-0 flex items-center gap-1 text-xs px-3 py-2 ml-1
            rounded-t-lg border border-dashed mb-px transition-colors
            ${dark
              ? 'border-[#2E3450] text-slate-500 hover:text-slate-300 hover:border-slate-500'
              : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}
        >
          <Plus size={10}/> 탭 추가
        </button>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   위젯 그리드 (탭별 분리 렌더)
══════════════════════════════════════════ */
function DashboardGrid({ tabId, dashboard, setDashboard, data, dark, onSave, saved }) {
  const [editMode, setEditMode] = useState(false)
  const [editSlot, setEditSlot] = useState(null)
  const [showTpl,  setShowTpl]  = useState(false)

  // 탭 전환 시 editMode 초기화
  useEffect(() => {
    setEditMode(false)
    setEditSlot(null)
  }, [tabId])

  const template = TEMPLATES[dashboard.template] || TEMPLATES.A

  const rows = useMemo(() => {
    const map = {}
    template.slots.forEach(s => {
      if (!map[s.row]) map[s.row] = []
      map[s.row].push(s)
    })
    return Object.values(map)
  }, [template])

  const handleWidgetSave = (slotId, widget) => {
    setDashboard(prev => ({ ...prev, widgets: { ...prev.widgets, [slotId]: widget } }))
    setEditSlot(null)
  }

  const handleTemplateChange = tplId => {
    const next = makeDashboard(tplId)
    TEMPLATES[tplId].slots.forEach(slot => {
      if (dashboard.widgets[slot.id]) next.widgets[slot.id] = dashboard.widgets[slot.id]
    })
    // 기존 dataSource 유지
    next.dataSource = dashboard.dataSource
    setDashboard(next)
  }

  const handleTableChange = (tableName) => {
    setDashboard(prev => ({
      ...prev,
      dataSource: { ...(prev.dataSource || {}), table: tableName },
    }))
  }

  const currentTable = dashboard.dataSource?.table || 'marketing_perf'

  const renderSlot = slot => {
    const w = dashboard.widgets[slot.id] || {
      type: slot.defaultType,
      config: { ...DEFAULT_WIDGET_CONFIG[slot.defaultType] },
    }
    const isEditing = editSlot === slot.id
    const wType = WIDGET_TYPES.find(t => t.id === w.type)

    return (
      <div key={slot.id} className={`${slot.span} relative`}
        style={{ minHeight: w.type === 'kpi' ? 120 : 220 }}>
        {editMode && !isEditing && (
          <button onClick={() => setEditSlot(slot.id)}
            className="absolute top-2 right-2 z-10 flex items-center gap-1
              px-2 py-1 bg-indigo-600 text-white text-[10px] rounded-lg shadow-md hover:bg-indigo-700">
            <Settings2 size={10}/> {wType?.icon} 편집
          </button>
        )}
        {isEditing
          ? <WidgetEditor slotId={slot.id} widget={w} dark={dark}
              onSave={handleWidgetSave} onClose={() => setEditSlot(null)}/>
          : renderWidget(w.type, data, w.config, dark)
        }
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 툴바 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
            ${dark ? 'border-[#252836] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
            {template.name}
          </span>
          {editMode && (
            <>
              <button onClick={() => setShowTpl(true)}
                className="text-xs px-2.5 py-1 rounded-lg border border-indigo-500/50 text-indigo-500 hover:bg-indigo-500/10">
                템플릿 변경
              </button>
              {/* 데이터 소스 변경 */}
              <DataSourceSelector
                tableName={currentTable}
                onChange={handleTableChange}
                dark={dark}
              />
            </>
          )}
          {!editMode && (
            <span className={`flex items-center gap-1 text-[10px]
              ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
              <Database size={10}/>
              <span className="font-mono">{currentTable}</span>
              <span className={`text-[9px] ${dark ? 'text-slate-700' : 'text-slate-300'}`}>
                (탭설정에서 변경)
              </span>
            </span>
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
              <button onClick={() => { onSave(); setEditMode(false); setEditSlot(null) }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors
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

      {/* 위젯 그리드 */}
      {rows.map((rowSlots, ri) => (
        <div key={ri} className="grid grid-cols-4 gap-4">
          {rowSlots.map(renderSlot)}
        </div>
      ))}

      {showTpl && (
        <TemplateSelector current={dashboard.template} dark={dark}
          onSelect={handleTemplateChange} onClose={() => setShowTpl(false)}/>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   메인 컴포넌트

   tabsConfig: {
     tabs:         [{id, label}],
     addTab:       (label) => id,
     removeTab:    (tabId) => void,
     renameTab:    (tabId, label) => void,
     getDashboard: (tabId) => dashboard | null,
     saveDashboard:(dashboard, tabId) => void,
   }
══════════════════════════════════════════ */
export default function CustomDashboard({ dark, filterByDate, tabsConfig, subDataSource }) {
  const tabs = tabsConfig?.tabs || []

  /* 활성 탭 */
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? null)
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0] ?? null

  /* 활성 탭의 대시보드 (로컬 편집 상태) */
  const [dashboard, setDashboard] = useState(() => {
    if (!activeTab) return makeDashboard('A')
    return tabsConfig?.getDashboard(activeTab.id) ?? makeDashboard('A')
  })
  const [saved, setSaved] = useState(false)

  /* 탭 전환 → 대시보드 로드 */
  useEffect(() => {
    if (!activeTab) return
    const d = tabsConfig?.getDashboard(activeTab.id) ?? makeDashboard('A')
    setDashboard(d)
    setSaved(false)
  }, [activeTab?.id])

  /* 데이터 소스: L2 subDataSource.table 우선, 없으면 dashboard.dataSource, 기본값 marketing_perf */
  const tableName = subDataSource?.table
    || dashboard.dataSource?.table
    || 'marketing_perf'
  const fieldMap  = subDataSource?.fieldMap || {}

  const { data: rawData, loading, error } = useTableData(tableName)
  const data = useMemo(() => {
    const filtered  = filterByDate ? filterByDate(rawData) : rawData
    return applyFieldMap(filtered, fieldMap)
  }, [rawData, filterByDate, fieldMap])

  /* 탭 추가 — 자동 이동 없음 */
  const handleAddTab = (label) => {
    tabsConfig?.addTab(label)
    // setActiveTabId 호출하지 않음 — 탭설정 페이지에서 확인
  }

  /* 탭 삭제 */
  const handleRemoveTab = (tabId) => {
    tabsConfig?.removeTab(tabId)
    if (activeTabId === tabId) {
      const remaining = tabs.filter(t => t.id !== tabId)
      setActiveTabId(remaining[0]?.id ?? null)
    }
  }

  /* 저장 */
  const handleSave = () => {
    if (activeTab) tabsConfig?.saveDashboard(dashboard, activeTab.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <Spinner dark={dark}/>

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── L3 탭 바 ── */}
      <L3TabBar
        tabs={tabs}
        activeId={activeTab?.id}
        onSelect={setActiveTabId}
        onAdd={handleAddTab}
        onRemove={handleRemoveTab}
        onRename={(tabId, label) => tabsConfig?.renameTab(tabId, label)}
        dark={dark}
      />

      {/* ── 컨텐츠 ── */}
      {activeTab ? (
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className={`mb-4 px-4 py-2.5 rounded-lg text-xs border
              ${dark ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
              ⚠️ 데이터 조회 오류 ({tableName}): {error}
            </div>
          )}
          <DashboardGrid
            key={activeTab.id}
            tabId={activeTab.id}
            dashboard={dashboard}
            setDashboard={setDashboard}
            data={data}
            dark={dark}
            onSave={handleSave}
            saved={saved}
          />
        </div>
      ) : (
        /* 빈 상태 */
        <div className={`flex flex-col items-center justify-center flex-1 gap-5
          ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center
            ${dark ? 'bg-[#1A1D27]' : 'bg-slate-50'}`}>
            <Plus size={32} className="text-indigo-400"/>
          </div>
          <div className="text-center">
            <p className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              탭이 없습니다
            </p>
            <p className="text-xs mt-1.5">
              위의 <span className="text-indigo-400 font-semibold">+ 탭 추가</span> 버튼으로 첫 번째 탭을 만들어보세요
            </p>
            <p className={`text-xs mt-1 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
              각 탭에 원하는 위젯과 지표를 자유롭게 배치할 수 있습니다
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
