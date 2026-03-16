import { useState, useMemo } from 'react'
import { Check, X, Plus, GripVertical } from 'lucide-react'
import {
  WIDGET_TYPES, DEFAULT_WIDGET_CONFIG,
} from '../../store/useConfig'
import {
  buildWidgetMetrics, buildWidgetGroupBy,
  sanitizeWidgetConfig,
} from '../../store/columnUtils'
import {
  DndContext, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import WidgetTypeSelector from './WidgetTypeSelector'
import MetricPicker from './MetricPicker'
import GroupByPicker from './GroupByPicker'
import FilterSection from './FilterSection'

/* ═══════════ 드래그 가능한 지표 아이템 ═══════════ */
function SortableMetricItem({ id, label, isComputed, dark, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors
        ${isDragging ? 'z-50 shadow-lg ring-2 ring-[#579DFF]/30' : ''}
        ${dark ? 'border-[#A1BDD914] bg-[#1D2125] hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <button {...attributes} {...listeners}
        className={`cursor-grab active:cursor-grabbing shrink-0 touch-none
          ${dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}>
        <GripVertical size={12} />
      </button>
      <span className={`flex-1 text-xs font-medium truncate
        ${isComputed
          ? (dark ? 'text-violet-400' : 'text-violet-600')
          : (dark ? 'text-slate-300' : 'text-slate-700')}`}>
        {label}
      </span>
      <button onClick={(e) => { e.stopPropagation(); onRemove() }}
        className={`shrink-0 p-0.5 rounded opacity-0 group-hover/sortitem:opacity-100 transition-opacity
          ${dark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-500'}`}
        style={{ opacity: 1 }}>
        <X size={10} />
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════
   WidgetEditor — 단일 패널 (추가/수정 겸용)
   - 위젯 유형: SVG 카드 그리드
   - 지표/그룹바이: 팝오버 피커
   - 필터: 접이식 디멘전 필터
══════════════════════════════════════════ */
export default function WidgetEditor({ slotId, widget, dark, data = [], dataMap, onSave, onClose, columnConfig, availableTables }) {
  const isNew = !slotId
  const [selTable, setSelTable] = useState(widget.table || widget.config?._table || 'marketing_data')
  const [type, setType] = useState(widget.type || 'kpi')
  const [config, setConfig] = useState(() =>
    sanitizeWidgetConfig(widget.type, { ...widget.config }, widget.table || widget.config?._table || 'marketing_data', columnConfig)
  )
  const [filters, setFilters] = useState(widget.config?.filters || {})

  /* 테이블 변경 시 해당 테이블 데이터로 전환 (생성 모드에서도 필터 동작) */
  const effectiveData = useMemo(() => dataMap?.[selTable] || data, [dataMap, selTable, data])

  const dynMetrics = useMemo(() => buildWidgetMetrics(selTable, columnConfig), [selTable, columnConfig])
  const dynGroupBy = useMemo(() => buildWidgetGroupBy(selTable, columnConfig), [selTable, columnConfig])
  const wtMeta = WIDGET_TYPES.find(w => w.id === type)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }))

  const handleTableChange = (newTable) => {
    setSelTable(newTable)
    setConfig(prev => sanitizeWidgetConfig(type, prev, newTable, columnConfig))
    setFilters({})
  }

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  const changeType = t => {
    setType(t)
    const base = { ...DEFAULT_WIDGET_CONFIG[t] }
    const first = dynMetrics[0]?.id
    const firstGb = dynGroupBy[0]?.id
    if (first) {
      if ('metric' in base) base.metric = first
      if (Array.isArray(base.metrics)) base.metrics = [first]
    }
    if (firstGb && 'groupBy' in base) base.groupBy = firstGb
    setConfig(base)
  }

  const handleSave = () => {
    if (isNew) {
      onSave(null, { id: `w_${Date.now()}`, widthPct: type === 'kpi' ? 25 : 50, type, table: selTable, config: { ...config, filters } })
    } else {
      onSave(slotId, { type, table: selTable, config: { ...config, filters } })
    }
  }

  const S = {
    sel: `px-3 py-2 rounded-lg border text-sm outline-none w-full
      ${dark ? 'bg-[#1D2125] border-[#A1BDD914] text-white' : 'bg-white border-slate-200 text-slate-700'}`,
    inp: `px-3 py-2 rounded-lg border text-sm outline-none w-full
      ${dark ? 'bg-[#1D2125] border-[#A1BDD914] text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-xs font-bold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-slate-700'}`,
  }

  /* ── 선택된 메트릭 칩 렌더러 ── */
  const renderMetricChips = (ids) => {
    const arr = Array.isArray(ids) ? ids : [ids].filter(Boolean)
    if (arr.length === 0) return null
    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {arr.map(id => {
          const m = dynMetrics.find(x => x.id === id)
          return (
            <span key={id} className={`text-xs px-2 py-0.5 rounded-md
              ${m?._computed
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                : 'bg-[#579DFF]/10 text-[#579DFF] border border-[#579DFF]/20'}`}>
              {m?.label || id}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-t-2xl sm:rounded-2xl border w-full sm:max-w-xl flex flex-col max-h-[90vh]
        ${dark ? 'bg-[#1D2125] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-2xl'}`}>

        {/* 헤더 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0
          ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`}>
          <p className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
            {isNew ? '카드 추가' : '위젯 편집'}
          </p>
          <button onClick={onClose} className={`p-2 rounded-xl ${dark ? 'text-slate-400 hover:bg-[#2C333A] hover:text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 min-h-0">

          {/* ─── 위젯 유형: SVG 카드 그리드 ─── */}
          <div>
            <p className={`${S.lab} mb-2`}>위젯 유형</p>
            <WidgetTypeSelector value={type} onChange={changeType} dark={dark} />
          </div>

          {/* 데이터 소스 */}
          {availableTables && availableTables.length > 1 && (
            <div>
              <p className={`${S.lab} mb-1.5`}>데이터 소스</p>
              <select className={S.sel} value={selTable} onChange={e => handleTableChange(e.target.value)}>
                {availableTables.map(t => (
                  <option key={t.id} value={t.id}>{t.displayName || t.id}</option>
                ))}
              </select>
            </div>
          )}

          {/* 제목 (KPI 제외) */}
          {type !== 'kpi' && (
            <div>
              <p className={`${S.lab} mb-1.5`}>제목</p>
              <input className={S.inp} value={config.title || ''} onChange={e => upd('title', e.target.value)} placeholder="위젯 제목" />
            </div>
          )}

          {/* === 타입별 설정 === */}

          {/* KPI */}
          {type === 'kpi' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>지표</p>
                <MetricPicker metrics={dynMetrics} selected={config.metric} onSelect={mid => upd('metric', mid)} dark={dark} />
                {renderMetricChips(config.metric)}
              </div>
              <div>
                <p className={`${S.lab} mb-1.5`}>커스텀 라벨 (선택)</p>
                <input className={S.inp} value={config.label || ''} onChange={e => upd('label', e.target.value)} placeholder="기본: 지표명 사용" />
              </div>
            </>
          )}

          {/* Line — multi metric + dual axis */}
          {type === 'line' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>지표 (복수 선택)</p>
                <MetricPicker metrics={dynMetrics} selected={config.metrics || []} onSelect={v => upd('metrics', v)} multi dark={dark} />
                {renderMetricChips(config.metrics)}
              </div>
              <div>
                <p className={`${S.lab} mb-1.5`}>Y축 모드</p>
                <select className={S.sel} value={config.axisMode || 'single'} onChange={e => upd('axisMode', e.target.value)}>
                  <option value="single">단일 축</option>
                  <option value="dual">이중 축 (좌/우)</option>
                </select>
              </div>
              {config.axisMode === 'dual' && (config.metrics || []).length > 0 && (
                <div>
                  <p className={`${S.lab} mb-1.5`}>축 배정 <span className="font-normal normal-case">(클릭해서 좌↔우 전환)</span></p>
                  <div className="flex flex-wrap gap-1">
                    {(config.metrics || []).map(mid => {
                      const m = dynMetrics.find(x => x.id === mid)
                      const isRight = (config.rightMetrics || []).includes(mid)
                      return (
                        <button key={mid} type="button"
                          onClick={() => {
                            const cur = config.rightMetrics || []
                            const next = isRight ? cur.filter(x => x !== mid) : [...cur, mid]
                            upd('rightMetrics', next)
                          }}
                          className={`text-xs px-2 py-0.5 rounded-md border transition-colors cursor-pointer
                            ${isRight
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                              : 'bg-[#579DFF]/10 text-[#579DFF] border-[#579DFF]/20 hover:bg-[#579DFF]/20'}`}>
                          {isRight ? '우' : '좌'} {m?.label || mid}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Bar / Pie — single metric + groupBy */}
          {(type === 'bar' || type === 'pie') && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>지표</p>
                <MetricPicker metrics={dynMetrics} selected={config.metric} onSelect={mid => upd('metric', mid)} dark={dark} />
                {renderMetricChips(config.metric)}
              </div>
              <div>
                <p className={`${S.lab} mb-2`}>그룹 기준</p>
                <GroupByPicker options={dynGroupBy} selected={config.groupBy || dynGroupBy[0]?.id} onSelect={v => upd('groupBy', v)} dark={dark} />
              </div>
            </>
          )}

          {/* Table — multi metric + groupBy */}
          {type === 'table' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>표시 지표 (복수 선택)</p>
                <MetricPicker metrics={dynMetrics} selected={config.metrics || []} onSelect={v => upd('metrics', v)} multi dark={dark} />
                {renderMetricChips(config.metrics)}
              </div>
              <div>
                <p className={`${S.lab} mb-2`}>그룹 기준</p>
                <GroupByPicker options={dynGroupBy} selected={config.groupBy || dynGroupBy[0]?.id} onSelect={v => upd('groupBy', v)} dark={dark} />
              </div>
            </>
          )}

          {/* Funnel */}
          {type === 'funnel' && (
            <div>
              <p className={`${S.lab} mb-2`}>퍼널 단계</p>
              {(config.stages || []).map((stage, si) => (
                <div key={stage.id} className="flex gap-1.5 mb-1.5">
                  <input className={`${S.inp} flex-1`} value={stage.label}
                    onChange={e => { const next = [...config.stages]; next[si] = {...stage, label: e.target.value}; upd('stages', next) }}
                    placeholder={`단계 ${si+1}`} />
                  <select className={`${S.sel} w-32`} value={stage.metric}
                    onChange={e => { const next = [...config.stages]; next[si] = {...stage, metric: e.target.value}; upd('stages', next) }}>
                    {dynMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  {(config.stages || []).length > 2 && (
                    <button onClick={() => upd('stages', config.stages.filter((_,j) => j !== si))} className="text-red-400 hover:text-red-300 text-xs px-1">×</button>
                  )}
                </div>
              ))}
              <button onClick={() => upd('stages', [...(config.stages||[]), {id:`s${Date.now()}`, label:'', metric: dynMetrics[0]?.id || ''}])}
                className={`text-xs px-2 py-1 rounded-lg border border-dashed mt-1
                  ${dark ? 'border-[#A1BDD914] text-slate-400 hover:text-[#579DFF]' : 'border-slate-200 text-slate-500'}`}>
                + 단계 추가
              </button>
            </div>
          )}

          {/* Comparison — multi metric + sortable + compareMode */}
          {type === 'comparison' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>비교 지표 (복수 선택)</p>
                <MetricPicker metrics={dynMetrics} selected={config.metrics || []} onSelect={v => upd('metrics', v)} multi dark={dark} />
              </div>
              {(config.metrics || []).length > 0 && (
                <div>
                  <p className={`${S.lab} mb-1.5`}>지표 순서 <span className="font-normal normal-case">(드래그로 변경)</span></p>
                  <DndContext sensors={sensors} collisionDetection={closestCenter}
                    onDragEnd={(event) => {
                      const { active, over } = event
                      if (!over || active.id === over.id) return
                      const ids = config.metrics || []
                      const oldIdx = ids.indexOf(active.id)
                      const newIdx = ids.indexOf(over.id)
                      if (oldIdx === -1 || newIdx === -1) return
                      upd('metrics', arrayMove(ids, oldIdx, newIdx))
                    }}>
                    <SortableContext items={config.metrics} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1">
                        {(config.metrics || []).map(mid => {
                          const m = dynMetrics.find(x => x.id === mid)
                          return (
                            <SortableMetricItem key={mid} id={mid}
                              label={m?.label || mid}
                              isComputed={m?._computed}
                              dark={dark}
                              onRemove={() => upd('metrics', (config.metrics || []).filter(x => x !== mid))} />
                          )
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
              <div>
                <p className={`${S.lab} mb-1.5`}>비교 모드</p>
                <select className={S.sel} value={config.compareMode || 'period'} onChange={e => upd('compareMode', e.target.value)}>
                  <option value="period">기간 비교 (선택 기간 vs 직전 동일 기간)</option>
                  <option value="segment">세그먼트 비교</option>
                </select>
              </div>
            </>
          )}

          {/* Ranking — single metric + groupBy + topN */}
          {type === 'ranking' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>지표</p>
                <MetricPicker metrics={dynMetrics} selected={config.metric} onSelect={mid => upd('metric', mid)} dark={dark} />
                {renderMetricChips(config.metric)}
              </div>
              <div>
                <p className={`${S.lab} mb-2`}>그룹 기준</p>
                <GroupByPicker options={dynGroupBy} selected={config.groupBy || dynGroupBy[0]?.id} onSelect={v => upd('groupBy', v)} dark={dark} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className={`${S.lab} mb-1.5`}>Top N</p>
                  <input type="number" className={S.inp} value={config.topN || 10} min={3} max={50}
                    onChange={e => upd('topN', Number(e.target.value))} />
                </div>
                <div className="flex-1">
                  <p className={`${S.lab} mb-1.5`}>정렬</p>
                  <select className={S.sel} value={config.sortDir || 'desc'} onChange={e => upd('sortDir', e.target.value)}>
                    <option value="desc">내림차순 (높은 순)</option>
                    <option value="asc">오름차순 (낮은 순)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Alert — multi metric + threshold */}
          {type === 'alert' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>모니터링 지표 (복수 선택)</p>
                <MetricPicker metrics={dynMetrics} selected={config.metrics || []} onSelect={v => upd('metrics', v)} multi dark={dark} />
                {renderMetricChips(config.metrics)}
              </div>

              {(config.metrics || []).length > 0 && (
                <div>
                  <p className={`${S.lab} mb-2`}>임계값 설정</p>
                  {(config.metrics || []).map(mid => {
                    const m = dynMetrics.find(x => x.id === mid)
                    const th = config.thresholds?.[mid] || {}
                    const updTh = (field, val) => {
                      const next = { ...config.thresholds, [mid]: { ...(config.thresholds?.[mid] || {}), [field]: val } }
                      upd('thresholds', next)
                    }
                    return (
                      <div key={mid}
                        className={`rounded-lg border p-3 mb-2 ${dark ? 'border-[#A1BDD914] bg-[#1D2125]' : 'border-slate-200 bg-slate-50'}`}>
                        <p className={`text-xs font-semibold mb-2 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {m?.label || mid}
                        </p>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <p className={`text-[10px] mb-1 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>양호 기준</p>
                            <input type="number" className={S.inp}
                              value={th.good ?? ''} placeholder="예: 1000000"
                              onChange={e => updTh('good', e.target.value === '' ? undefined : Number(e.target.value))} />
                          </div>
                          <div className="flex-1">
                            <p className={`text-[10px] mb-1 ${dark ? 'text-amber-400' : 'text-amber-600'}`}>주의 기준</p>
                            <input type="number" className={S.inp}
                              value={th.warning ?? ''} placeholder="예: 500000"
                              onChange={e => updTh('warning', e.target.value === '' ? undefined : Number(e.target.value))} />
                          </div>
                        </div>
                        <label className={`flex items-center gap-1.5 mt-2 cursor-pointer select-none
                          ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                          <input type="checkbox" className="accent-[#579DFF] rounded"
                            checked={!!th.inverse}
                            onChange={e => updTh('inverse', e.target.checked)} />
                          <span className="text-xs">낮을수록 양호 (비용, CPC 등)</span>
                        </label>
                      </div>
                    )
                  })}
                  <p className={`text-[10px] mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    기본: 값 ≥ 양호 → 양호, ≥ 주의 → 주의, 미만 → 위험 · inverse 시 반대
                  </p>
                </div>
              )}
            </>
          )}

          {/* Timeline — multi metric */}
          {type === 'timeline' && (
            <div>
              <p className={`${S.lab} mb-2`}>지표 (복수 선택)</p>
              <MetricPicker metrics={dynMetrics} selected={config.metrics || []} onSelect={v => upd('metrics', v)} multi dark={dark} />
              {renderMetricChips(config.metrics)}
            </div>
          )}

          {/* 데이터 필터 */}
          <FilterSection
            filters={filters}
            groupBy={config.groupBy}
            data={effectiveData}
            dark={dark}
            onChange={setFilters}
            columnConfig={columnConfig}
            tableName={selTable}
            onGroupByChange={wtMeta?.needsGroup
              ? (dim) => upd('groupBy', dim ?? (dynGroupBy[0]?.id || ''))
              : undefined}
          />
        </div>

        {/* 푸터 */}
        <div className={`flex items-center justify-between px-5 py-4 border-t shrink-0
          ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`}>
          <button onClick={onClose}
            className={`text-sm px-4 py-2.5 rounded-xl border transition-colors
              ${dark ? 'border-[#A1BDD914] text-slate-400 hover:text-white hover:border-slate-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            취소
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-1.5 text-sm px-5 py-2.5 bg-[#0C66E4] text-white rounded-xl hover:bg-[#0055CC] font-semibold">
            {isNew ? <><Plus size={14} /> 카드 추가</> : <><Check size={14} /> 저장</>}
          </button>
        </div>
      </div>
    </div>
  )
}
