import { useState, useMemo } from 'react'
import { Plus, X, GripVertical, Trash2 } from 'lucide-react'
import { METRICS } from '../../store/useConfig'
import { calcMetric, fmtMetric, groupData } from '../widgets/widgetUtils'

const NON_DERIVED_METRICS = METRICS.filter(m => !m.derived)

/* ── 퍼널 바 (SVG) ── */
function FunnelChart({ stages, stageValues, dark }) {
  if (stages.length === 0) return null
  const maxVal = Math.max(...stageValues, 1)
  const barH = 44
  const gap = 6
  const totalH = stages.length * (barH + gap)
  const maxW = 500

  return (
    <svg viewBox={`0 0 ${maxW + 200} ${totalH + 20}`} className="w-full max-w-2xl">
      {stages.map((stage, i) => {
        const val = stageValues[i] || 0
        const w = Math.max((val / maxVal) * maxW, 20)
        const x = (maxW - w) / 2
        const y = i * (barH + gap) + 10
        const convRate = i > 0 && stageValues[i - 1] > 0
          ? ((val / stageValues[i - 1]) * 100).toFixed(1)
          : null
        const gradient = `hsl(${220 - i * 25}, 70%, ${55 + i * 5}%)`

        return (
          <g key={stage.id}>
            {/* 바 */}
            <rect x={x} y={y} width={w} height={barH} rx={6}
              fill={gradient} opacity={0.85} />
            {/* 라벨 */}
            <text x={maxW / 2} y={y + barH / 2 + 1} textAnchor="middle"
              fill="white" fontSize="12" fontWeight="600">
              {stage.label}
            </text>
            {/* 값 */}
            <text x={maxW / 2 + w / 2 + 12} y={y + barH / 2 + 1} textAnchor="start"
              fill={dark ? '#94A3B8' : '#64748B'} fontSize="11">
              {fmtMetric(stage.metric, val)}
            </text>
            {/* 전환율 화살표 */}
            {convRate && (
              <>
                <text x={x - 8} y={y + barH / 2 + 1} textAnchor="end"
                  fill={parseFloat(convRate) >= 50 ? '#10B981' : parseFloat(convRate) >= 20 ? '#F59E0B' : '#EF4444'}
                  fontSize="10" fontWeight="600">
                  {convRate}%
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/* ── 스테이지 편집기 ── */
function StageEditor({ stages, onChange, dark }) {
  const addStage = () => {
    const id = `s_${Date.now()}`
    onChange([...stages, { id, label: `단계 ${stages.length + 1}`, metric: 'impr' }])
  }

  const removeStage = (id) => {
    if (stages.length <= 2) return
    onChange(stages.filter(s => s.id !== id))
  }

  const updateStage = (id, field, value) => {
    onChange(stages.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  /* 드래그로 순서 변경 */
  const dragFrom = { current: null }
  const dragTo = { current: null }

  return (
    <div className={`rounded-xl border p-4 mb-4
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
      <p className={`text-xs font-semibold mb-3 ${dark ? 'text-white' : 'text-slate-700'}`}>
        퍼널 단계 설정
      </p>
      <div className="space-y-2">
        {stages.map((stage, idx) => (
          <div key={stage.id}
            className={`flex items-center gap-2 p-2 rounded-lg
            ${dark ? 'bg-[#20232E]' : 'bg-slate-50'}`}>
            <GripVertical size={12} className={`shrink-0 cursor-grab ${dark ? 'text-slate-600' : 'text-slate-300'}`} />
            <span className={`text-[10px] w-5 text-center shrink-0 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              {idx + 1}
            </span>
            <input value={stage.label}
              onChange={e => updateStage(stage.id, 'label', e.target.value)}
              className={`flex-1 text-xs px-2 py-1 rounded border outline-none min-w-0
              ${dark ? 'bg-transparent border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-800'}`}
            />
            <select value={stage.metric}
              onChange={e => updateStage(stage.id, 'metric', e.target.value)}
              className={`text-[10px] px-2 py-1 rounded border outline-none
              ${dark ? 'bg-[#1A1D27] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
              {NON_DERIVED_METRICS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            {stages.length > 2 && (
              <button onClick={() => removeStage(stage.id)}
                className={`p-1 rounded ${dark ? 'text-slate-600 hover:text-red-400' : 'text-slate-400 hover:text-red-500'}`}>
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addStage}
        className={`flex items-center gap-1.5 text-[10px] mt-2 px-3 py-1.5 rounded-lg border border-dashed
        ${dark ? 'border-[#2E3450] text-slate-500 hover:text-slate-300' : 'border-slate-200 text-slate-400 hover:text-slate-600'}`}>
        <Plus size={10} /> 단계 추가
      </button>
    </div>
  )
}

/* ── 브레이크다운 테이블 ── */
function BreakdownTable({ data, stages, dark }) {
  const grouped = useMemo(() => {
    if (!data?.length) return []
    return groupData(data, 'channel', stages.map(s => s.metric))
  }, [data, stages])

  if (grouped.length === 0) return null

  return (
    <div className={`rounded-xl border overflow-hidden
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={dark ? 'bg-[#20232E]' : 'bg-slate-50'}>
              <th className={`text-left px-3 py-2.5 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                채널
              </th>
              {stages.map(s => (
                <th key={s.id} className={`text-right px-3 py-2.5 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {s.label}
                </th>
              ))}
              {stages.slice(1).map((s, i) => (
                <th key={`cr_${s.id}`} className={`text-right px-3 py-2.5 font-semibold ${dark ? 'text-amber-400/70' : 'text-amber-600'}`}>
                  {stages[i].label}→{s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(row => (
              <tr key={row.name}
                className={`border-t ${dark ? 'border-[#252836] hover:bg-[#20232E]' : 'border-slate-100 hover:bg-slate-50'}`}>
                <td className={`px-3 py-2 font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>
                  {row.name}
                </td>
                {stages.map(s => (
                  <td key={s.id} className={`text-right px-3 py-2 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {fmtMetric(s.metric, row[s.metric] || 0)}
                  </td>
                ))}
                {stages.slice(1).map((s, i) => {
                  const prev = row[stages[i].metric] || 0
                  const cur = row[s.metric] || 0
                  const rate = prev > 0 ? ((cur / prev) * 100).toFixed(1) : '—'
                  return (
                    <td key={`cr_${s.id}`} className={`text-right px-3 py-2 font-medium
                      ${typeof rate === 'string' ? (dark ? 'text-slate-500' : 'text-slate-400')
                        : parseFloat(rate) >= 50 ? 'text-emerald-500' : parseFloat(rate) >= 20 ? 'text-amber-500' : 'text-red-500'}`}>
                      {rate === '—' ? rate : rate + '%'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── 메인 퍼널 페이지 ── */
export default function FunnelPage({ dashboard, setDashboard, data, dark, editMode }) {
  const stages = dashboard?.stages || []

  const stageValues = useMemo(() => {
    if (!data?.length) return stages.map(() => 0)
    return stages.map(s => calcMetric(data, s.metric))
  }, [data, stages])

  const handleStagesChange = (newStages) => {
    setDashboard({ ...dashboard, stages: newStages })
  }

  /* 총 전환율 */
  const totalConv = stages.length >= 2 && stageValues[0] > 0
    ? ((stageValues[stageValues.length - 1] / stageValues[0]) * 100).toFixed(1)
    : null

  return (
    <div className="space-y-4">
      {/* 편집 모드: 스테이지 설정 */}
      {editMode && (
        <StageEditor stages={stages} onChange={handleStagesChange} dark={dark} />
      )}

      {stages.length === 0 ? (
        <div className={`text-center py-16 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          편집 버튼을 눌러 퍼널 단계를 설정해주세요
        </div>
      ) : (
        <>
          {/* KPI 요약 */}
          <div className="flex gap-3 flex-wrap">
            <div className={`rounded-xl border px-4 py-3 min-w-[120px]
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
              <p className={`text-[10px] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>단계 수</p>
              <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{stages.length}</p>
            </div>
            {stageValues[0] > 0 && (
              <div className={`rounded-xl border px-4 py-3 min-w-[120px]
                ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
                <p className={`text-[10px] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {stages[0]?.label}
                </p>
                <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                  {fmtMetric(stages[0]?.metric, stageValues[0])}
                </p>
              </div>
            )}
            {totalConv && (
              <div className={`rounded-xl border px-4 py-3 min-w-[120px]
                ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
                <p className={`text-[10px] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>전체 전환율</p>
                <p className={`text-lg font-bold ${parseFloat(totalConv) >= 5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {totalConv}%
                </p>
              </div>
            )}
          </div>

          {/* 퍼널 시각화 */}
          <div className={`rounded-xl border p-6 flex items-center justify-center
            ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
            <FunnelChart stages={stages} stageValues={stageValues} dark={dark} />
          </div>

          {/* 채널별 브레이크다운 */}
          {data?.length > 0 && (
            <div>
              <p className={`text-xs font-semibold mb-2 ${dark ? 'text-white' : 'text-slate-700'}`}>
                채널별 브레이크다운
              </p>
              <BreakdownTable data={data} stages={stages} dark={dark} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
