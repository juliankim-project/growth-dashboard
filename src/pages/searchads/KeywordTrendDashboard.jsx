import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, MapPin, Building2, AlertCircle,
  ArrowUpRight, ArrowDownRight, Target,
} from 'lucide-react'
import Spinner from '../../components/UI/Spinner'
import { supabase } from '../../lib/supabase'
import { ACCOM_TYPE_KEYWORDS, REGION_MAP, REGION_COLORS } from '../../config/keywordSets'

/* ── 색상 ── */
const PALETTE = ['#579DFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

/* ── 숫자 포맷 ── */
const fmt = n => {
  if (n == null || n === 0) return '0'
  return n.toLocaleString()
}

/* ── 요일 포맷 ── */
const getKoreanDayOfWeek = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['월', '화', '수', '목', '금', '토', '일']
  return days[d.getDay()]
}

/* ── 트렌드 아이콘 ── */
function TrendIcon({ val, size = 14 }) {
  if (!val || val === 0) return <Minus size={size} className="text-slate-400" />
  return val > 0
    ? <TrendingUp size={size} className="text-emerald-500" />
    : <TrendingDown size={size} className="text-red-500" />
}

/* ── 커스텀 Tooltip ── */
function ChartTooltip({ active, payload, label, dark }) {
  if (!active || !payload?.length) return null
  return (
    <div className={`rounded-xl px-4 py-3 shadow-xl text-xs border
      ${dark ? 'bg-[#22272B] border-[#A1BDD914] text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-0.5">
          <span style={{ color: p.color }}>●</span>
          <span className={dark ? 'text-slate-400' : 'text-slate-600'}>{p.name}</span>
          <span className="font-bold ml-auto">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════
   메인 컴포넌트: 숙박 키워드 일일 트렌드 리포트
══════════════════════════════════════════════ */
export default function KeywordTrendDashboard({ dark }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateRange, setDateRange] = useState('30')
  const [collecting, setCollecting] = useState(false)

  /* ── 데이터 로드 ── */
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange))
      const since = daysAgo.toISOString().split('T')[0]

      const { data: rows, error: err } = await supabase
        .from('keyword_trends')
        .select('*')
        .gte('collected_at', since)
        .order('collected_at', { ascending: true })

      if (err) throw new Error(err.message)
      setData(rows || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => { loadData() }, [loadData])

  /* ── 수동 수집 트리거 ── */
  const triggerCollect = async () => {
    setCollecting(true)
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(`${SUPABASE_URL}/functions/v1/keyword-collector`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({}),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      alert(`수집 완료! ${result.inserted}개 키워드 저장됨 (${result.elapsed_sec}초)`)
      loadData()
    } catch (e) {
      alert(`수집 실패: ${e.message}`)
    } finally {
      setCollecting(false)
    }
  }

  /* ── 날짜 및 데이터 분리 ── */
  const dates = useMemo(() => [...new Set(data.map(r => r.collected_at))].sort(), [data])
  const latestDate = dates[dates.length - 1]
  const prevDate = dates.length >= 2 ? dates[dates.length - 2] : null

  // 최신 및 전일 데이터
  const latestData = useMemo(() => data.filter(r => r.collected_at === latestDate), [data, latestDate])
  const prevData = useMemo(() => prevDate ? data.filter(r => r.collected_at === prevDate) : [], [data, prevDate])

  /* ── 숙소 유형별 트렌드 (accom_type 필터) ── */
  const accomTypeStats = useMemo(() => {
    // ACCOM_TYPE_KEYWORDS의 키워드로 매칭
    const typeMap = {}

    ACCOM_TYPE_KEYWORDS.forEach(type => {
      typeMap[type.id] = {
        id: type.id,
        label: type.label,
        keywords: type.keywords,
        latest: 0,
        prev: 0,
      }
    })

    // 최신 데이터 집계
    latestData.forEach(r => {
      ACCOM_TYPE_KEYWORDS.forEach(type => {
        if (type.keywords.includes(r.keyword)) {
          typeMap[type.id].latest += r.monthly_total || 0
        }
      })
    })

    // 전일 데이터 집계
    prevData.forEach(r => {
      ACCOM_TYPE_KEYWORDS.forEach(type => {
        if (type.keywords.includes(r.keyword)) {
          typeMap[type.id].prev += r.monthly_total || 0
        }
      })
    })

    // 변화율 계산 및 정렬
    return Object.values(typeMap)
      .map(t => ({
        ...t,
        change: t.prev > 0 ? ((t.latest - t.prev) / t.prev * 100) : 0,
      }))
      .sort((a, b) => b.latest - a.latest)
  }, [latestData, prevData])

  /* ── 전체 여행 수요 (accom_type만 합산) ── */
  const totalDemand = useMemo(() => {
    const latest = accomTypeStats.reduce((s, t) => s + t.latest, 0)
    const prev = accomTypeStats.reduce((s, t) => s + t.prev, 0)
    const change = prev > 0 ? ((latest - prev) / prev * 100) : 0
    const changeTotals = prev > 0 ? (latest - prev) : 0

    return { latest, prev, change, changeTotals }
  }, [accomTypeStats])

  /* ── 권역별 데이터 (accom_type 키워드만) ── */
  const regionStats = useMemo(() => {
    const map = {}

    latestData.forEach(r => {
      // accom_type 그룹의 키워드인지 확인
      const isAccomType = ACCOM_TYPE_KEYWORDS.some(type =>
        type.keywords.includes(r.keyword)
      )
      if (!isAccomType) return

      const reg = r.region || '기타'
      if (!map[reg]) map[reg] = { region: reg, latest: 0, prev: 0 }
      map[reg].latest += r.monthly_total || 0
    })

    prevData.forEach(r => {
      const isAccomType = ACCOM_TYPE_KEYWORDS.some(type =>
        type.keywords.includes(r.keyword)
      )
      if (!isAccomType) return

      const reg = r.region || '기타'
      if (!map[reg]) map[reg] = { region: reg, latest: 0, prev: 0 }
      map[reg].prev += r.monthly_total || 0
    })

    return Object.values(map)
      .map(r => ({
        ...r,
        change: r.prev > 0 ? ((r.latest - r.prev) / r.prev * 100) : 0,
      }))
      .sort((a, b) => b.latest - a.latest)
  }, [latestData, prevData])

  /* ── 지역별 데이터 ── */
  const areaStats = useMemo(() => {
    const map = {}

    latestData.forEach(r => {
      if (!r.area) return
      if (!map[r.area]) map[r.area] = { area: r.area, region: r.region, latest: 0, prev: 0 }
      map[r.area].latest += r.monthly_total || 0
    })

    prevData.forEach(r => {
      if (!r.area) return
      if (!map[r.area]) map[r.area] = { area: r.area, region: r.region, latest: 0, prev: 0 }
      map[r.area].prev += r.monthly_total || 0
    })

    return Object.values(map)
      .map(a => ({
        ...a,
        change: a.prev > 0 ? ((a.latest - a.prev) / a.prev * 100) : 0,
      }))
      .sort((a, b) => b.latest - a.latest)
  }, [latestData, prevData])

  /* ── 일별 트렌드 (accom_type 키워드만) ── */
  const dailyTrend = useMemo(() => {
    const map = {}

    data.forEach(r => {
      const isAccomType = ACCOM_TYPE_KEYWORDS.some(type =>
        type.keywords.includes(r.keyword)
      )
      if (!isAccomType) return

      const d = r.collected_at
      if (!map[d]) map[d] = { date: d, total: 0 }
      map[d].total += r.monthly_total || 0
    })

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  /* ── 권역별 일별 트렌드 (accom_type 키워드만) ── */
  const regionDailyTrend = useMemo(() => {
    const map = {}

    data.forEach(r => {
      const isAccomType = ACCOM_TYPE_KEYWORDS.some(type =>
        type.keywords.includes(r.keyword)
      )
      if (!isAccomType) return

      const d = r.collected_at
      const reg = r.region || '기타'
      if (!map[d]) map[d] = { date: d }
      if (!map[d][reg]) map[d][reg] = 0
      map[d][reg] += r.monthly_total || 0
    })

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  /* ── 주요 변동 사항 생성 ── */
  const insights = useMemo(() => {
    const result = []

    // 숙소 유형별 최고 증가율
    const maxAccomChange = accomTypeStats.reduce((max, t) =>
      t.change > max.change ? t : max, accomTypeStats[0] || {}
    )
    if (maxAccomChange.change > 0) {
      result.push(`${maxAccomChange.label} 키워드 전 유형 중 최고 증가율 (+${maxAccomChange.change.toFixed(1)}%)`)
    }

    // 권역별 최고 증가율 (Top 3)
    const regionGainers = [...regionStats]
      .filter(r => r.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 3)

    regionGainers.forEach(r => {
      result.push(`${r.region} 권역 +${r.change.toFixed(1)}% 상승`)
    })

    // 지역별 상위
    const topArea = areaStats[0]
    if (topArea) {
      const areaRegion = topArea.region || '기타'
      result.push(`${topArea.area} ${areaRegion} 내 1위 (${fmt(topArea.latest)}건)`)
    }

    return result
  }, [accomTypeStats, regionStats, areaStats])

  /* ── 빈 데이터 안내 ── */
  if (!loading && data.length === 0 && !error) {
    return (
      <div className={`min-h-screen p-8 ${dark ? 'bg-[#1D2125]' : 'bg-[#F7F8F9]'}`}>
        <div className={`rounded-2xl border p-8 text-center ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <Target size={48} className={`mx-auto mb-4 ${dark ? 'text-slate-600' : 'text-slate-300'}`} />
          <h2 className={`text-lg font-bold mb-2 ${dark ? 'text-white' : 'text-slate-800'}`}>
            숙박 트렌드 리포트 데이터 없음
          </h2>
          <p className={`text-sm mb-6 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            먼저 키워드 수집을 실행해야 일일 트렌드 리포트를 볼 수 있습니다.<br />
            아래 버튼을 클릭하면 숙박 키워드 데이터를 자동 수집합니다.
          </p>
          <button
            onClick={triggerCollect}
            disabled={collecting}
            className="px-6 py-3 bg-[#0C66E4] text-white rounded-xl font-semibold hover:bg-[#0055CC] disabled:opacity-50 transition-all"
          >
            {collecting ? (
              <span className="flex items-center gap-2"><RefreshCw size={16} className="animate-spin" /> 수집 중...</span>
            ) : (
              <span className="flex items-center gap-2"><RefreshCw size={16} /> 수집 실행</span>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-[#1D2125]' : 'bg-[#F7F8F9]'}`}>
      {/* ── 상단 헤더 (보고서 제목) ── */}
      <div className={`sticky top-0 z-20 backdrop-blur-md border-b
        ${dark ? 'bg-[#1D2125]/90 border-[#A1BDD914]' : 'bg-[#F7F8F9]/90 border-slate-200'}`}>
        <div className="px-6 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-800'}`}>
                숙박 키워드 일일 트렌드 리포트
              </h1>
              {latestDate && (
                <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {latestDate} ({getKoreanDayOfWeek(latestDate)}) 기준
                </p>
              )}
            </div>
            <button
              onClick={triggerCollect}
              disabled={collecting}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all
                ${collecting ? 'opacity-50' : ''}
                ${dark ? 'bg-[#0C66E4] text-white hover:bg-[#0055CC]' : 'bg-[#0C66E4] text-white hover:bg-[#0055CC]'}`}
            >
              <RefreshCw size={14} className={collecting ? 'animate-spin' : ''} />
              {collecting ? '수집 중' : '수집 실행'}
            </button>
          </div>

          {/* ── 기간 필터 ── */}
          <div className="mt-3 flex items-center gap-2">
            <span className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>조회 기간:</span>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${
                dark ? 'bg-[#22272B] border-[#A1BDD914] text-white' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <option value="7">최근 7일</option>
              <option value="14">최근 14일</option>
              <option value="30">최근 30일</option>
              <option value="60">최근 60일</option>
              <option value="90">최근 90일</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : error ? (
          <div className={`rounded-xl border p-6 text-center ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-red-200'}`}>
            <p className="text-red-500 text-sm">{error}</p>
            <button onClick={loadData} className="mt-3 px-4 py-2 bg-[#0C66E4] text-white rounded-lg text-xs">다시 시도</button>
          </div>
        ) : (
          <>
            {/* ━━ 전체 여행 수요 */}
            <div className={`rounded-2xl border p-6 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="mb-5">
                <h2 className={`text-sm font-bold tracking-wide mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  ━━ 전체 여행 수요
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* 큰 숫자 */}
                <div>
                  <p className={`text-xs mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>전체 검색량</p>
                  <p className={`text-4xl font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                    {fmt(totalDemand.latest)}건
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {totalDemand.change > 0 ? (
                      <>
                        <ArrowUpRight size={16} className="text-emerald-500" />
                        <span className="text-emerald-500 text-sm font-semibold">
                          +{fmt(totalDemand.changeTotals)}건 (+{totalDemand.change.toFixed(1)}%)
                        </span>
                      </>
                    ) : totalDemand.change < 0 ? (
                      <>
                        <ArrowDownRight size={16} className="text-red-500" />
                        <span className="text-red-500 text-sm font-semibold">
                          {fmt(totalDemand.changeTotals)}건 ({totalDemand.change.toFixed(1)}%)
                        </span>
                      </>
                    ) : (
                      <>
                        <Minus size={16} className="text-slate-400" />
                        <span className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>변화 없음</span>
                      </>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    전일 대비
                  </p>
                </div>

                {/* 차트 */}
                {dailyTrend.length > 1 && (
                  <div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={dailyTrend}>
                        <defs>
                          <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#579DFF" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#579DFF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eee'} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: dark ? '#888' : '#999' }}
                          tickFormatter={v => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: dark ? '#888' : '#999' }} />
                        <Tooltip content={<ChartTooltip dark={dark} />} />
                        <Area type="monotone" dataKey="total" name="일 검색량"
                          stroke="#579DFF" fill="url(#gradTrend)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* ━━ 숙소 유형별 트렌드 */}
            <div className={`rounded-2xl border p-6 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="mb-5">
                <h2 className={`text-sm font-bold tracking-wide mb-4 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  ━━ 숙소 유형별 트렌드
                </h2>
              </div>

              <div className="space-y-4">
                {accomTypeStats.map((type, idx) => {
                  const pct = totalDemand.latest > 0 ? (type.latest / totalDemand.latest * 100) : 0
                  return (
                    <div key={type.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold min-w-[2rem] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {idx + 1}.
                          </span>
                          <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>
                            {type.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-sm font-semibold tabular-nums ${dark ? 'text-white' : 'text-slate-800'}`}>
                            {fmt(type.latest)}건
                          </span>
                          <span className={`text-sm tabular-nums min-w-[4rem] text-right ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                            ({pct.toFixed(1)}%)
                          </span>
                          <div className="flex items-center gap-1 min-w-[5rem]">
                            {type.change > 0 ? (
                              <>
                                <TrendingUp size={14} className="text-emerald-500" />
                                <span className="text-emerald-500 text-sm font-semibold">+{type.change.toFixed(1)}%</span>
                              </>
                            ) : type.change < 0 ? (
                              <>
                                <TrendingDown size={14} className="text-red-500" />
                                <span className="text-red-500 text-sm font-semibold">{type.change.toFixed(1)}%</span>
                              </>
                            ) : (
                              <>
                                <Minus size={14} className="text-slate-400" />
                                <span className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>-0.0%</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* 가로 바 */}
                      <div className={`h-1 rounded-full overflow-hidden ${dark ? 'bg-[#1D2125]' : 'bg-slate-100'}`}>
                        <div
                          className="h-full bg-gradient-to-r from-[#579DFF] to-[#10B981]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ━━ 권역 트렌드 (일별) */}
            {regionDailyTrend.length > 1 && (
              <div className={`rounded-2xl border p-6 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="mb-5">
                  <h2 className={`text-sm font-bold tracking-wide mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    ━━ 광역권 트렌드
                  </h2>
                  <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    일별 검색량 추이 (스택)
                  </p>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={regionDailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eee'} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: dark ? '#888' : '#999' }}
                      tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: dark ? '#888' : '#999' }} />
                    <Tooltip content={<ChartTooltip dark={dark} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {Object.keys(REGION_COLORS).map((reg, i) => (
                      <Area key={reg} type="monotone" dataKey={reg} name={reg}
                        stackId="1" stroke={REGION_COLORS[reg] || PALETTE[i]}
                        fill={REGION_COLORS[reg] || PALETTE[i]} fillOpacity={0.6} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>

                {/* 급상승 권역 Top 3 */}
                <div className="mt-6 pt-6 border-t border-[#A1BDD914]">
                  <p className={`text-xs font-bold mb-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    급상승 권역 Top 3
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {regionStats.filter(r => r.change > 0)
                      .sort((a, b) => b.change - a.change)
                      .slice(0, 3)
                      .map((region, idx) => (
                        <div key={region.region} className={`rounded-lg p-3 ${dark ? 'bg-[#1D2125]' : 'bg-slate-50'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ background: REGION_COLORS[region.region] || '#94A3B8' }}>
                              {idx + 1}
                            </span>
                            <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>
                              {region.region}
                            </span>
                          </div>
                          <div className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                            <p className="mb-1">{fmt(region.latest)}건</p>
                            <p className="text-emerald-500 font-semibold">+{region.change.toFixed(1)}%</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* ━━ 지역 상세 트렌드 */}
            {areaStats.length > 0 && (
              <div className={`rounded-2xl border p-6 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="mb-5">
                  <h2 className={`text-sm font-bold tracking-wide mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    ━━ 지역 상세 트렌드
                  </h2>
                  <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Top 15 지역 (검색량 기준)
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className={`w-full text-xs ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <thead>
                      <tr className={dark ? 'text-slate-500' : 'text-slate-400'}>
                        <th className="text-left pb-3 pr-3 font-semibold">#</th>
                        <th className="text-left pb-3 pr-3 font-semibold">지역</th>
                        <th className="text-left pb-3 pr-3 font-semibold">권역</th>
                        <th className="text-right pb-3 pr-3 font-semibold">검색량</th>
                        <th className="text-right pb-3 font-semibold">변화</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaStats.slice(0, 15).map((area, idx) => (
                        <tr key={area.area} className={`border-t ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`}>
                          <td className={`py-3 pr-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {idx + 1}
                          </td>
                          <td className={`py-3 pr-3 font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>
                            {area.area}
                          </td>
                          <td className="py-3 pr-3">
                            {area.region && (
                              <span className="px-2 py-1 rounded text-[10px] font-semibold" style={{
                                background: (REGION_COLORS[area.region] || '#94A3B8') + '20',
                                color: REGION_COLORS[area.region] || '#94A3B8',
                              }}>
                                {area.region}
                              </span>
                            )}
                          </td>
                          <td className={`py-3 pr-3 text-right tabular-nums font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>
                            {fmt(area.latest)}
                          </td>
                          <td className="py-3 text-right">
                            {area.change > 0 ? (
                              <span className="text-emerald-500 font-semibold">+{area.change.toFixed(1)}%</span>
                            ) : area.change < 0 ? (
                              <span className="text-red-500 font-semibold">{area.change.toFixed(1)}%</span>
                            ) : (
                              <span className={dark ? 'text-slate-500' : 'text-slate-400'}>-0.0%</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ━━ 주요 변동 사항 */}
            {insights.length > 0 && (
              <div className={`rounded-2xl border p-6 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="mb-4">
                  <h2 className={`text-sm font-bold tracking-wide mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    ━━ 주요 변동 사항
                  </h2>
                </div>

                <div className="space-y-2">
                  {insights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <AlertCircle size={14} className="mt-1.5 text-[#579DFF] flex-shrink-0" />
                      <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {insight}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  )
}
