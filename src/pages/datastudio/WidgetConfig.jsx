import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useColumnConfig } from '../../store/useColumnConfig'
import {
  buildTableMetrics, buildTableGroupBy,
  buildWidgetMetrics, buildWidgetGroupBy,
  getTableDisplayName,
} from '../../store/columnUtils'
import { TABLES } from './Tables'
import { Pencil, X, Plus, Check, Save, RotateCcw } from 'lucide-react'

/* ── 그룹 라벨/색상 (MetricPicker와 동일) ── */
const GROUP_LABELS = { metric: '지표', computed: '🧮 계산 컬럼', rate: '단가' }
const GROUP_COLORS = {
  metric:   { dark: 'text-slate-400', light: 'text-slate-500' },
  computed: { dark: 'text-violet-400', light: 'text-violet-500' },
  rate:     { dark: 'text-amber-400',  light: 'text-amber-500' },
}

/** 메트릭을 그룹별로 분류 (MetricPicker와 동일 로직) */
function groupItems(items) {
  const groups = {}
  items.forEach(m => {
    const g = m._computed ? 'computed' : (m.group || 'metric')
    if (!groups[g]) groups[g] = []
    groups[g].push(m)
  })
  return groups
}

/* ═══════════ 인라인 라벨 편집 ═══════════ */
function InlineEdit({ value, dark, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else setDraft(value)
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)}
        className={`flex items-center gap-1 text-xs text-left truncate group/edit
          ${dark ? 'text-slate-300' : 'text-slate-700'}`}
        title="클릭하여 라벨 수정">
        <span className="truncate">{value}</span>
        <Pencil size={10} className={`shrink-0 opacity-0 group-hover/edit:opacity-60 transition-opacity
          ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
      </button>
    )
  }

  return (
    <input ref={ref} value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      className={`text-xs px-1 py-0.5 rounded border outline-none w-full
        ${dark ? 'bg-[#0F1117] border-indigo-500 text-white' : 'bg-white border-indigo-400 text-slate-800'}`}
    />
  )
}

/* ═══════════ 메트릭/그룹바이 카드 (MetricPicker 스타일) ═══════════ */
function ItemCard({ id, label, customLabel, group, dark, onLabelChange, onDelete }) {
  const isComputed = group === 'computed'
  return (
    <div className={`relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left transition-colors group/card
      ${isComputed ? 'border-l-2 !border-l-violet-500' : ''}
      ${dark ? 'border-[#252836] bg-[#13151F] hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      {/* 라벨 (인라인 편집) */}
      <div className="flex-1 min-w-0">
        <InlineEdit value={customLabel || label} dark={dark} onSave={onLabelChange} />
        {customLabel && customLabel !== label && (
          <span className={`text-[9px] truncate block ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
            원본: {label}
          </span>
        )}
      </div>
      {/* 삭제 버튼 */}
      <button onClick={onDelete}
        className={`shrink-0 p-0.5 rounded opacity-0 group-hover/card:opacity-100 transition-opacity
          ${dark ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}>
        <X size={12} />
      </button>
    </div>
  )
}

/* ═══════════ 삭제된 항목 복원 버튼 ═══════════ */
function DeletedItem({ id, label, dark, onRestore }) {
  return (
    <button onClick={onRestore}
      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors
        ${dark ? 'border-[#252836] text-slate-600 hover:border-emerald-500/40 hover:text-emerald-400'
          : 'border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600'}`}>
      <Plus size={10} />
      <span className="truncate">{label}</span>
    </button>
  )
}

/* ═══════════════════════════════════════════
   ConfigSection — 지표 또는 그룹바이 설정 (MetricPicker 스타일)
   ═══════════════════════════════════════════ */
function ConfigSection({ title, allItems, items, dark, onChange, isGroupBy }) {
  /* items: [{ id, visible, label? }] — 현재 설정 상태 */

  const itemMap = useMemo(() => {
    const m = new Map()
    ;(items || []).forEach(it => m.set(it.id, it))
    return m
  }, [items])

  /* 표시 중인 항목 (items 순서 유지, items에 없으면 allItems 순서대로 끝에) */
  const visibleItems = useMemo(() => {
    if (!items || items.length === 0) {
      return allItems.map(m => ({ ...m, _customLabel: null }))
    }
    const result = []
    const allMap = new Map(allItems.map(m => [m.id, m]))
    // items 순서대로 visible인 것
    items.forEach(it => {
      if (it.visible === false) return
      const base = allMap.get(it.id)
      if (base) result.push({ ...base, _customLabel: it.label || null })
    })
    // items에 없는 새 항목 추가
    allItems.forEach(m => {
      if (!itemMap.has(m.id)) result.push({ ...m, _customLabel: null })
    })
    return result
  }, [allItems, items, itemMap])

  /* 삭제된(숨겨진) 항목 */
  const deletedItems = useMemo(() => {
    if (!items || items.length === 0) return []
    const allMap = new Map(allItems.map(m => [m.id, m]))
    return items.filter(it => it.visible === false && allMap.has(it.id))
      .map(it => ({ ...it, label: it.label || allMap.get(it.id)?.label || it.id }))
  }, [allItems, items])

  /* 그룹별 분류 (지표 섹션만) */
  const grouped = useMemo(() => {
    if (isGroupBy) return null
    return groupItems(visibleItems)
  }, [visibleItems, isGroupBy])

  /* 핸들러: 라벨 변경 */
  const handleLabelChange = (id, newLabel) => {
    const baseItem = allItems.find(m => m.id === id)
    const isOriginal = baseItem && newLabel === baseItem.label
    const next = [...(items || allItems.map(m => ({ id: m.id, visible: true })))]
    const idx = next.findIndex(it => it.id === id)
    if (idx >= 0) {
      next[idx] = { ...next[idx], label: isOriginal ? undefined : newLabel }
    }
    onChange(next)
  }

  /* 핸들러: 삭제 (숨김) */
  const handleDelete = (id) => {
    const next = [...(items || allItems.map(m => ({ id: m.id, visible: true })))]
    const idx = next.findIndex(it => it.id === id)
    if (idx >= 0) {
      next[idx] = { ...next[idx], visible: false }
    } else {
      next.push({ id, visible: false })
    }
    onChange(next)
  }

  /* 핸들러: 복원 */
  const handleRestore = (id) => {
    const next = [...(items || [])]
    const idx = next.findIndex(it => it.id === id)
    if (idx >= 0) {
      next[idx] = { ...next[idx], visible: true }
    }
    onChange(next)
  }

  const sub = dark ? 'text-slate-500' : 'text-slate-400'
  const visCount = visibleItems.length
  const totalCount = allItems.length

  return (
    <div className={`rounded-xl border ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
      {/* 섹션 헤더 */}
      <div className={`flex items-center justify-between px-4 py-3 border-b
        ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
        <div>
          <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{title}</p>
          <p className={`text-[10px] mt-0.5 ${sub}`}>
            {visCount}/{totalCount}개 표시 · 클릭하여 라벨 수정, ✕ 삭제
          </p>
        </div>
      </div>

      {/* 카드 그리드 */}
      <div className="p-4 flex flex-col gap-4">
        {isGroupBy ? (
          /* 그룹바이: 단일 그리드 */
          <div className="grid grid-cols-3 gap-2">
            {visibleItems.map(m => (
              <ItemCard key={m.id} id={m.id}
                label={m.label} customLabel={m._customLabel}
                group="metric" dark={dark}
                onLabelChange={(v) => handleLabelChange(m.id, v)}
                onDelete={() => handleDelete(m.id)} />
            ))}
          </div>
        ) : (
          /* 지표: 그룹별 분류 (MetricPicker와 동일) */
          Object.entries(grouped || {}).map(([group, list]) => {
            const gc = GROUP_COLORS[group] || GROUP_COLORS.metric
            return (
              <div key={group}>
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2
                  ${dark ? gc.dark : gc.light}`}>
                  {GROUP_LABELS[group] || group}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {list.map(m => (
                    <ItemCard key={m.id} id={m.id}
                      label={m.label} customLabel={m._customLabel}
                      group={m._computed ? 'computed' : (m.group || 'metric')}
                      dark={dark}
                      onLabelChange={(v) => handleLabelChange(m.id, v)}
                      onDelete={() => handleDelete(m.id)} />
                  ))}
                </div>
              </div>
            )
          })
        )}

        {/* 삭제된 항목 복원 */}
        {deletedItems.length > 0 && (
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${sub}`}>
              삭제된 항목 ({deletedItems.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {deletedItems.map(it => (
                <DeletedItem key={it.id} id={it.id} label={it.label} dark={dark}
                  onRestore={() => handleRestore(it.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   PickerPreview — 위젯 편집기에서 보이는 모습 미리보기
   ═══════════════════════════════════════════ */
function PickerPreview({ items, type, dark }) {
  if (!items.length) return (
    <p className={`text-[10px] italic ${dark ? 'text-slate-600' : 'text-slate-400'}`}>표시할 항목 없음</p>
  )

  if (type === 'metrics') {
    const groups = groupItems(items)
    return (
      <div className="flex flex-col gap-2">
        {Object.entries(groups).map(([g, list]) => (
          <div key={g}>
            <p className={`text-[9px] font-semibold uppercase tracking-wider mb-1
              ${g === 'computed' ? 'text-violet-400' : dark ? 'text-slate-500' : 'text-slate-400'}`}>
              {GROUP_LABELS[g] || g}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {list.map(m => (
                <span key={m.id} className={`text-[10px] px-2 py-1.5 rounded-lg border text-left truncate
                  ${m._computed ? 'border-l-2 !border-l-violet-500' : ''}
                  ${dark ? 'border-[#252836] text-slate-400 bg-[#13151F]' : 'border-slate-200 text-slate-600 bg-white'}`}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map(g => (
        <span key={g.id} className={`text-[10px] px-2 py-1.5 rounded-lg border text-left truncate
          ${dark ? 'border-[#252836] text-slate-400 bg-[#13151F]' : 'border-slate-200 text-slate-600 bg-white'}`}>
          {g.label}
        </span>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════
   WidgetConfig — 메인 페이지
   ═══════════════════════════════════════════ */
export default function WidgetConfig({ dark }) {
  const { columnConfig, setColumnConfig } = useColumnConfig()
  const [selTable, setSelTable] = useState(TABLES[0])

  /* 로컬 draft 상태 (저장 전까지 변경사항 유지) */
  const getInitial = useCallback((table) => {
    const wmc = columnConfig?.[table]?.widgetMetricConfig || {}
    return {
      metrics: wmc.metrics?.items ? [...wmc.metrics.items] : null,
      groupBy: wmc.groupBy?.items ? [...wmc.groupBy.items] : null,
    }
  }, [columnConfig])

  const [draft, setDraft] = useState(() => getInitial(selTable))
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  /* 테이블 변경 시 draft 리셋 */
  useEffect(() => {
    setDraft(getInitial(selTable))
    setDirty(false)
    setSaved(false)
  }, [selTable, getInitial])

  /* 현재 테이블의 전체 지표/그룹바이 (필터 전) */
  const allMetrics = useMemo(
    () => buildTableMetrics(selTable, columnConfig),
    [selTable, columnConfig]
  )
  const allGroupBy = useMemo(
    () => buildTableGroupBy(selTable, columnConfig),
    [selTable, columnConfig]
  )

  /* 위젯 필터 적용 후 (미리보기용 — draft 기반 시뮬레이션) */
  const previewMetrics = useMemo(() => {
    if (!draft.metrics) return allMetrics
    const wmCfg = { enabled: true, items: draft.metrics }
    // inline apply
    const orderMap = new Map()
    wmCfg.items.forEach((item, idx) => orderMap.set(item.id, { order: idx, visible: item.visible !== false, label: item.label }))
    const configured = []
    const unconfigured = []
    allMetrics.forEach(m => {
      const entry = orderMap.get(m.id)
      if (entry) {
        if (entry.visible) {
          const item = entry.label ? { ...m, label: entry.label } : m
          configured.push({ item, order: entry.order })
        }
      } else {
        unconfigured.push(m)
      }
    })
    configured.sort((a, b) => a.order - b.order)
    return [...configured.map(c => c.item), ...unconfigured]
  }, [allMetrics, draft.metrics])

  const previewGroupBy = useMemo(() => {
    if (!draft.groupBy) return allGroupBy
    const wmCfg = { enabled: true, items: draft.groupBy }
    const orderMap = new Map()
    wmCfg.items.forEach((item, idx) => orderMap.set(item.id, { order: idx, visible: item.visible !== false, label: item.label }))
    const configured = []
    const unconfigured = []
    allGroupBy.forEach(m => {
      const entry = orderMap.get(m.id)
      if (entry) {
        if (entry.visible) {
          const item = entry.label ? { ...m, label: entry.label } : m
          configured.push({ item, order: entry.order })
        }
      } else {
        unconfigured.push(m)
      }
    })
    configured.sort((a, b) => a.order - b.order)
    return [...configured.map(c => c.item), ...unconfigured]
  }, [allGroupBy, draft.groupBy])

  /* draft 변경 핸들러 */
  const handleMetricsChange = useCallback((newItems) => {
    setDraft(prev => ({ ...prev, metrics: newItems }))
    setDirty(true)
    setSaved(false)
  }, [])

  const handleGroupByChange = useCallback((newItems) => {
    setDraft(prev => ({ ...prev, groupBy: newItems }))
    setDirty(true)
    setSaved(false)
  }, [])

  /* 저장 */
  const handleSave = useCallback(() => {
    const tCfg = columnConfig?.[selTable] || {}
    const wmCfg = tCfg.widgetMetricConfig || {}
    setColumnConfig(selTable, {
      ...tCfg,
      widgetMetricConfig: {
        ...wmCfg,
        metrics: draft.metrics ? { enabled: true, items: draft.metrics } : wmCfg.metrics,
        groupBy: draft.groupBy ? { enabled: true, items: draft.groupBy } : wmCfg.groupBy,
      },
    })
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }, [columnConfig, selTable, draft, setColumnConfig])

  /* 초기화 (원래 상태 복원) */
  const handleReset = useCallback(() => {
    setDraft(getInitial(selTable))
    setDirty(false)
  }, [selTable, getInitial])

  const sub = dark ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className="p-6 flex flex-col gap-5 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>위젯 관리</h2>
          <p className={`text-xs mt-0.5 ${sub}`}>
            테이블별 위젯 피커에 표시할 지표 · 그룹바이 설정
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button onClick={handleReset}
              className={`flex items-center gap-1 text-xs px-3 py-2 rounded-lg border transition-colors
                ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}>
              <RotateCcw size={12} /> 되돌리기
            </button>
          )}
          <button onClick={handleSave}
            disabled={!dirty}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors
              ${dirty
                ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20'
                : saved
                  ? dark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : dark ? 'bg-[#252836] text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}>
            {saved ? <><Check size={13} /> 저장됨</> : <><Save size={13} /> 저장</>}
          </button>
        </div>
      </div>

      {/* 테이블 탭 */}
      <div className="flex gap-2">
        {TABLES.map(t => {
          const on = selTable === t
          return (
            <button key={t} onClick={() => setSelTable(t)}
              className={`text-xs px-4 py-2 rounded-lg border font-semibold transition-colors
                ${on
                  ? dark ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-indigo-400 bg-indigo-50 text-indigo-600'
                  : dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:text-slate-700'
                }`}>
              {getTableDisplayName(t, columnConfig)}
            </button>
          )
        })}
      </div>

      {/* 지표 설정 */}
      <ConfigSection
        title="지표 설정"
        allItems={allMetrics}
        items={draft.metrics}
        dark={dark}
        onChange={handleMetricsChange}
      />

      {/* 그룹바이 설정 */}
      <ConfigSection
        title="그룹바이 설정"
        allItems={allGroupBy}
        items={draft.groupBy}
        dark={dark}
        onChange={handleGroupByChange}
        isGroupBy
      />

      {/* 미리보기 */}
      <div className={`rounded-xl border p-4 ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
        <p className={`text-xs font-bold mb-3 ${dark ? 'text-white' : 'text-slate-800'}`}>
          미리보기 — 위젯 편집기에서 보이는 모습
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${sub}`}>지표 Picker</p>
            <PickerPreview items={previewMetrics} type="metrics" dark={dark} />
          </div>
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${sub}`}>그룹바이 Picker</p>
            <PickerPreview items={previewGroupBy} type="groupBy" dark={dark} />
          </div>
        </div>
      </div>
    </div>
  )
}
