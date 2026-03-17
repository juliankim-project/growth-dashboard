import { useMemo, memo } from 'react'
import { calcMetric, fmtMetric } from './widgetUtils'

/* ── 퍼널 바 SVG ── */
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
            <rect x={x} y={y} width={w} height={barH} rx={6}
              fill={gradient} opacity={0.85} />
            <text x={maxW / 2} y={y + barH / 2 + 1} textAnchor="middle"
              fill="white" fontSize="12" fontWeight="600">
              {stage.label}
            </text>
            <text x={maxW / 2 + w / 2 + 12} y={y + barH / 2 + 1} textAnchor="start"
              fill={dark ? '#94A3B8' : '#475569'} fontSize="11">
              {fmtMetric(stage.metric, val)}
            </text>
            {convRate && (
              <text x={x - 8} y={y + barH / 2 + 1} textAnchor="end"
                fill={parseFloat(convRate) >= 50 ? '#10B981' : parseFloat(convRate) >= 20 ? '#F59E0B' : '#EF4444'}
                fontSize="10" fontWeight="600">
                {convRate}%
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function FunnelWidget({ data, config, dark, metrics: metricsProp }) {
  const { stages = [], title = '전환 퍼널' } = config

  const stageValues = useMemo(() => {
    if (!data?.length || stages.length === 0) return stages.map(() => 0)
    return stages.map(s => calcMetric(data, s.metric, metricsProp))
  }, [data, stages, metricsProp])

  const totalConv = useMemo(() => {
    if (stages.length < 2 || stageValues[0] <= 0) return null
    return ((stageValues[stageValues.length - 1] / stageValues[0]) * 100).toFixed(1)
  }, [stages, stageValues])

  const firstStage = stages[0]
  const lastStage = stages[stages.length - 1]

  return (
    <div className={`rounded-xl p-4 border h-full overflow-hidden flex flex-col
      ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-sm font-semibold mb-3 ${dark ? 'text-white' : 'text-slate-700'}`}>
        {title}
      </p>

      {stages.length === 0 ? (
        <div className={`text-center py-10 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          퍼널 단계가 설정되지 않았습니다
        </div>
      ) : (
        <>
          {/* KPI 요약 */}
          <div className="flex gap-3 flex-wrap mb-4">
            {stageValues[0] > 0 && firstStage && (
              <div className={`rounded-lg border px-3 py-2 min-w-[100px]
                ${dark ? 'bg-[#2C333A] border-[#A1BDD914]' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs mb-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {firstStage.label}
                </p>
                <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                  {fmtMetric(firstStage.metric, stageValues[0], metricsProp)}
                </p>
              </div>
            )}
            {stageValues[stageValues.length - 1] > 0 && lastStage && stages.length >= 2 && (
              <div className={`rounded-lg border px-3 py-2 min-w-[100px]
                ${dark ? 'bg-[#2C333A] border-[#A1BDD914]' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs mb-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {lastStage.label}
                </p>
                <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                  {fmtMetric(lastStage.metric, stageValues[stageValues.length - 1], metricsProp)}
                </p>
              </div>
            )}
            {totalConv && (
              <div className={`rounded-lg border px-3 py-2 min-w-[100px]
                ${dark ? 'bg-[#2C333A] border-[#A1BDD914]' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs mb-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  전체 전환율
                </p>
                <p className={`text-sm font-bold ${parseFloat(totalConv) >= 5 ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {totalConv}%
                </p>
              </div>
            )}
          </div>

          {/* 퍼널 시각화 */}
          <div className="flex-1 flex items-center justify-center min-h-[120px]">
            <FunnelChart stages={stages} stageValues={stageValues} dark={dark} />
          </div>
        </>
      )}
    </div>
  )
}

export default memo(FunnelWidget)
