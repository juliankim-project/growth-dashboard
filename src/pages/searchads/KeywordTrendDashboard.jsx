import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  PieChart, Pie,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Search, Filter, RefreshCw,
  Monitor, Smartphone, Globe, MapPin, Building2, ChevronDown,
  Calendar, Download, BarChart2, Layers, Target, ArrowUpRight,
} from 'lucide-react'
import Spinner from '../../components/UI/Spinner'
import { supabase } from '../../lib/supabase'

/* ── 색상 ── */
const PALETTE = ['#579DFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']
const REGION_COLORS = {
  '수도권': '#579DFF', '제주권': '#10B981', '동남권': '#F59E0B',
  '호남권': '#EF4444', '강원권': '#8B5CF6', '대경권': '#EC4899',
  '충청권': '#06B6D4', '기타': '#94A3B8',
}

/* ── 권역 매핑 (프론트 폴백) ── */
const REGION_MAP = {
  '서울': '수도권', '경기': '수도권', '인천': '수도권',
  '부산': '동남권', '울산': '동남권', '경남': '동남권', '창원': '동남권', '통영': '동남권', '거제': '동남권',
  '대구': '대경권', '경북': '대경권', '경주': '대경권', '포항': '대경권',
  '광주': '호남권', '전남': '호남권', '전북': '호남권', '여수': '호남권', '목포': '호남권',
  '대전': '충청권', '충남': '충청권', '충북': '충청권', '세종': '충청권',
  '강원': '강원권', '속초': '강원권', '춘천': '강원권', '강릉': '강원권', '평창': '강원권',
  '제주': '제주권',
}

/* ── 숫자 포맷 ── */
const fmt = n => {
  if (n == null || n === 0) return '0'
  return n.toLocaleString()
}
const fmtK = n => {
  if (n == null) return '0'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`
  return fmt(n)
}

/* ── 트렌드 아이콘 ── */
function TrendIcon({ val, size = 14 }) {
  if (!val || val === 0) return <Minus size={size} className="text-slate-400" />
  return val > 0
    ? <TrendingUp size={size} className="text-emerald-500" />
    : <TrendingDown size={size} className="text-red-500" />
}

/* ── KPI 카드 ── */
function KpiCard({ label, value, sub, icon, color, dark, trend }) {
  return (
    <div className={`rounded-xl border p-4 ${dark ? 'bg-[#1D2125] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1">
            <TrendIcon val={trend} />
            <span className={`text-xs font-semibold ${
              trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-red-500' : 'text-slate-400'
            }`}>{trend > 0 ? '+' : ''}{trend?.toFixed(1)}%</span>
          </div>
        )}
      </div>
      <p className={`text-2xl font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      {sub && <p className={`text-[11px] mt-1 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>{sub}</p>}
    </div>
  )
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

/* ── 섹션 헤더 ── */
function SectionHeader({ icon, title, sub, dark, children }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
          {sub && <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

/* ══════════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════════ */
export default function KeywordTrendDashboard({ dark }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateRange, setDateRange] = useState('30') // 최근 N일
  const [viewMode, setViewMode] = useState('overview') // overview, region, area
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [selectedArea, setSelectedArea] = useState('all')
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

  /* ── 파생 데이터 ── */
  const dates = useMemo(() => [...new Set(data.map(r => r.collected_at))].sort(), [data])
  const latestDate = dates[dates.length - 1]
  const prevDate = dates.length >= 2 ? dates[dates.length - 2] : null

  // 최신 날짜 데이터
  const latestData = useMemo(() => data.filter(r => r.collected_at === latestDate), [data, latestDate])
  const prevData = useMemo(() => prevDate ? data.filter(r => r.collected_at === prevDate) : [], [data, prevDate])

  // 필터링
  const filteredLatest = useMemo(() => {
    let filtered = latestData
    if (selectedRegion !== 'all') filtered = filtered.filter(r => r.region === selectedRegion)
    if (selectedArea !== 'all') filtered = filtered.filter(r => r.area === selectedArea)
    return filtered
  }, [latestData, selectedRegion, selectedArea])

  // 권역 목록
  const regions = useMemo(() => [...new Set(data.map(r => r.region).filter(Boolean))].sort(), [data])
  const areas = useMemo(() => {
    let filtered = data
    if (selectedRegion !== 'all') filtered = filtered.filter(r => r.region === selectedRegion)
    return [...new Set(filtered.map(r => r.area).filter(Boolean))].sort()
  }, [data, selectedRegion])

  /* ── KPI 계산 ── */
  const kpis = useMemo(() => {
    const total = filteredLatest.reduce((s, r) => s + (r.monthly_total || 0), 0)
    const pc = filteredLatest.reduce((s, r) => s + (r.monthly_pc || 0), 0)
    const mobile = filteredLatest.reduce((s, r) => s + (r.monthly_mobile || 0), 0)
    const mobileShare = total > 0 ? ((mobile / total) * 100) : 0
    const kwCount = filteredLatest.length
    const highComp = filteredLatest.filter(r => r.competition === '높음').length

    // 전일 대비 변화율
    let totalChange = 0
    if (prevData.length > 0) {
      const prevTotal = prevData.reduce((s, r) => s + (r.monthly_total || 0), 0)
      totalChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal * 100) : 0
    }

    return { total, pc, mobile, mobileShare, kwCount, highComp, totalChange }
  }, [filteredLatest, prevData])

  /* ── 권역별 집계 ── */
  const regionStats = useMemo(() => {
    const map = {}
    filteredLatest.forEach(r => {
      const reg = r.region || '기타'
      if (!map[reg]) map[reg] = { region: reg, total: 0, pc: 0, mobile: 0, count: 0 }
      map[reg].total += r.monthly_total || 0
      map[reg].pc += r.monthly_pc || 0
      map[reg].mobile += r.monthly_mobile || 0
      map[reg].count += 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filteredLatest])

  /* ── 지역별 집계 ── */
  const areaStats = useMemo(() => {
    const map = {}
    filteredLatest.forEach(r => {
      const a = r.area || '미분류'
      if (!map[a]) map[a] = { area: a, region: r.region, total: 0, pc: 0, mobile: 0, count: 0 }
      map[a].total += r.monthly_total || 0
      map[a].pc += r.monthly_pc || 0
      map[a].mobile += r.monthly_mobile || 0
      map[a].count += 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filteredLatest])

  /* ── 일별 트렌드 (시계열) ── */
  const dailyTrend = useMemo(() => {
    const map = {}
    data.forEach(r => {
      const d = r.collected_at
      if (!map[d]) map[d] = { date: d, total: 0, pc: 0, mobile: 0 }
      // 필터 적용
      if (selectedRegion !== 'all' && r.region !== selectedRegion) return
      if (selectedArea !== 'all' && r.area !== selectedArea) return
      map[d].total += r.monthly_total || 0
      map[d].pc += r.monthly_pc || 0
      map[d].mobile += r.monthly_mobile || 0
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [data, selectedRegion, selectedArea])

  /* ── 권역별 일별 트렌드 ── */
  const regionDailyTrend = useMemo(() => {
    const map = {}
    data.forEach(r => {
      const d = r.collected_at
      const reg = r.region || '기타'
      if (!map[d]) map[d] = { date: d }
      if (!map[d][reg]) map[d][reg] = 0
      map[d][reg] += r.monthly_total || 0
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [data])

  /* ── TOP 키워드 ── */
  const topKeywords = useMemo(() => {
    return [...filteredLatest]
      .sort((a, b) => (b.monthly_total || 0) - (a.monthly_total || 0))
      .slice(0, 20)
  }, [filteredLatest])

  /* ── 카테고리별 분포 ── */
  const categoryDist = useMemo(() => {
    const map = {}
    filteredLatest.forEach(r => {
      const cat = r.category || 'generic'
      if (!map[cat]) map[cat] = { name: cat, value: 0 }
      map[cat].value += r.monthly_total || 0
    })
    const labels = { branded: '브랜드', regional: '지역', generic: '일반', room: '객실', other: '기타' }
    return Object.values(map).map(d => ({ ...d, label: labels[d.name] || d.name }))
  }, [filteredLatest])

  /* ── 빈 데이터 안내 ── */
  if (!loading && data.length === 0 && !error) {
    return (
      <div className={`min-h-screen p-6 ${dark ? 'bg-[#1D2125]' : 'bg-[#F7F8F9]'}`}>
        <div className={`rounded-2xl border p-8 text-center ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <Globe size={48} className={`mx-auto mb-4 ${dark ? 'text-slate-600' : 'text-slate-300'}`} />
          <h2 className={`text-lg font-bold mb-2 ${dark ? 'text-white' : 'text-slate-800'}`}>
            키워드 트렌드 데이터가 없습니다
          </h2>
          <p className={`text-sm mb-6 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            먼저 키워드 수집을 실행해서 데이터를 쌓아야 합니다.<br />
            아래 버튼을 클릭하면 상품 데이터 기반으로 키워드를 자동 수집합니다.
          </p>
          <button
            onClick={triggerCollect}
            disabled={collecting}
            className="px-6 py-3 bg-[#0C66E4] text-white rounded-xl font-semibold hover:bg-[#0055CC] disabled:opacity-50 transition-all"
          >
            {collecting ? (
              <span className="flex items-center gap-2"><RefreshCw size={16} className="animate-spin" /> 수집 중...</span>
            ) : (
              <span className="flex items-center gap-2"><Download size={16} /> 지금 키워드 수집 시작</span>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-[#1D2125]' : 'bg-[#F7F8F9]'}`}>
      {/* ── 상단 헤더 ── */}
      <div className={`sticky top-0 z-20 backdrop-blur-md border-b
        ${dark ? 'bg-[#1D2125]/90 border-[#A1BDD914]' : 'bg-[#F7F8F9]/90 border-slate-200'}`}>
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-800'}`}>
                키워드 트렌드
              </h1>
              <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                여행·숙박 검색량 트렌드 · 권역별 · 지역별 분석
                {latestDate && <span className="ml-2">최근 수집: {latestDate}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* 수집 버튼 */}
              <button
                onClick={triggerCollect}
                disabled={collecting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all
                  ${collecting ? 'opacity-50' : ''}
                  ${dark ? 'bg-[#0C66E4] text-white hover:bg-[#0055CC]' : 'bg-[#0C66E4] text-white hover:bg-[#0055CC]'}`}
              >
                <RefreshCw size={13} className={collecting ? 'animate-spin' : ''} />
                {collecting ? '수집 중' : '수집 실행'}
              </button>
            </div>
          </div>
        </div>

        {/* ── 필터 바 ── */}
        <div className="px-6 pb-3 flex items-center gap-3 flex-wrap">
          {/* 기간 선택 */}
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

          {/* 뷰 모드 */}
          {['overview', 'region', 'area'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === mode
                  ? 'bg-[#0C66E4] text-white'
                  : dark ? 'bg-[#22272B] text-slate-400 border border-[#A1BDD914]' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {mode === 'overview' ? '전체 개요' : mode === 'region' ? '권역별' : '지역별'}
            </button>
          ))}

          {/* 권역 필터 */}
          <select
            value={selectedRegion}
            onChange={e => { setSelectedRegion(e.target.value); setSelectedArea('all') }}
            className={`text-xs px-3 py-1.5 rounded-lg border ${
              dark ? 'bg-[#22272B] border-[#A1BDD914] text-white' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <option value="all">전체 권역</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* 지역 필터 */}
          <select
            value={selectedArea}
            onChange={e => setSelectedArea(e.target.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border ${
              dark ? 'bg-[#22272B] border-[#A1BDD914] text-white' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <option value="all">전체 지역</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
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
            {/* ── KPI 카드 ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard dark={dark} label="총 검색량 (월간)" value={fmtK(kpis.total)} trend={kpis.totalChange}
                icon={<Search size={16} className="text-white" />} color="bg-[#0C66E4]" />
              <KpiCard dark={dark} label="PC 검색량" value={fmtK(kpis.pc)}
                icon={<Monitor size={16} className="text-white" />} color="bg-[#579DFF]" />
              <KpiCard dark={dark} label="모바일 검색량" value={fmtK(kpis.mobile)}
                icon={<Smartphone size={16} className="text-white" />} color="bg-[#10B981]" />
              <KpiCard dark={dark} label="모바일 비중" value={`${kpis.mobileShare.toFixed(1)}%`}
                icon={<Smartphone size={16} className="text-white" />} color="bg-emerald-600" />
              <KpiCard dark={dark} label="수집 키워드 수" value={fmt(kpis.kwCount)}
                icon={<Target size={16} className="text-white" />} color="bg-[#8B5CF6]" />
              <KpiCard dark={dark} label="경쟁 높음" value={fmt(kpis.highComp)}
                sub={`전체 ${kpis.kwCount}개 중`}
                icon={<TrendingUp size={16} className="text-white" />} color="bg-[#EF4444]" />
            </div>

            {/* ── 전체 트렌드 (시계열) ── */}
            {dailyTrend.length > 1 && (
              <div className={`rounded-2xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
                <SectionHeader dark={dark}
                  icon={<TrendingUp size={16} className="text-[#579DFF]" />}
                  title="검색량 추이"
                  sub={`${selectedRegion !== 'all' ? selectedRegion : '전체'} ${selectedArea !== 'all' ? '> ' + selectedArea : ''} · 일별 합산`}
                />
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#579DFF" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#579DFF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradMobile" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eee'} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: dark ? '#888' : '#999' }}
                      tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11, fill: dark ? '#888' : '#999' }} tickFormatter={fmtK} />
                    <Tooltip content={<ChartTooltip dark={dark} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="total" name="총 검색량" stroke="#579DFF"
                      fill="url(#gradTotal)" strokeWidth={2} />
                    <Area type="monotone" dataKey="mobile" name="모바일" stroke="#10B981"
                      fill="url(#gradMobile)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="pc" name="PC" stroke="#F59E0B"
                      fill="transparent" strokeWidth={1} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── 권역별 뷰 ── */}
            {(viewMode === 'overview' || viewMode === 'region') && regionStats.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 권역별 검색량 바 차트 */}
                <div className={`rounded-2xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <SectionHeader dark={dark}
                    icon={<MapPin size={16} className="text-[#F59E0B]" />}
                    title="권역별 검색량"
                    sub="월간 검색량 합산"
                  />
                  <ResponsiveContainer width="100%" height={Math.max(200, regionStats.length * 44)}>
                    <BarChart data={regionStats} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eee'} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: dark ? '#888' : '#999' }} tickFormatter={fmtK} />
                      <YAxis type="category" dataKey="region" width={60} tick={{ fontSize: 11, fill: dark ? '#ccc' : '#555' }} />
                      <Tooltip content={<ChartTooltip dark={dark} />} />
                      <Bar dataKey="total" name="총 검색량" radius={[0, 6, 6, 0]}>
                        {regionStats.map((entry, i) => (
                          <Cell key={i} fill={REGION_COLORS[entry.region] || PALETTE[i % PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 권역별 일별 트렌드 (스택) */}
                {regionDailyTrend.length > 1 && (
                  <div className={`rounded-2xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <SectionHeader dark={dark}
                      icon={<Layers size={16} className="text-[#8B5CF6]" />}
                      title="권역별 추이"
                      sub="일별 검색량 스택"
                    />
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={regionDailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eee'} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: dark ? '#888' : '#999' }}
                          tickFormatter={v => v.slice(5)} />
                        <YAxis tick={{ fontSize: 11, fill: dark ? '#888' : '#999' }} tickFormatter={fmtK} />
                        <Tooltip content={<ChartTooltip dark={dark} />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {regions.map((reg, i) => (
                          <Area key={reg} type="monotone" dataKey={reg} name={reg}
                            stackId="1" stroke={REGION_COLORS[reg] || PALETTE[i]}
                            fill={REGION_COLORS[reg] || PALETTE[i]} fillOpacity={0.4} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* ── 지역별 뷰 ── */}
            {(viewMode === 'overview' || viewMode === 'area') && areaStats.length > 0 && (
              <div className={`rounded-2xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
                <SectionHeader dark={dark}
                  icon={<Building2 size={16} className="text-[#10B981]" />}
                  title="지역별 검색량"
                  sub={`${selectedRegion !== 'all' ? selectedRegion + ' >' : '전체'} 월간 검색량 합산`}
                />
                <ResponsiveContainer width="100%" height={Math.max(200, Math.min(areaStats.length * 36, 500))}>
                  <BarChart data={areaStats.slice(0, 15)} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#333' : '#eee'} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: dark ? '#888' : '#999' }} tickFormatter={fmtK} />
                    <YAxis type="category" dataKey="area" width={50} tick={{ fontSize: 11, fill: dark ? '#ccc' : '#555' }} />
                    <Tooltip content={<ChartTooltip dark={dark} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="pc" name="PC" stackId="a" fill="#579DFF" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="mobile" name="모바일" stackId="a" fill="#10B981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── TOP 키워드 테이블 ── */}
            <div className={`rounded-2xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
              <SectionHeader dark={dark}
                icon={<BarChart2 size={16} className="text-[#EC4899]" />}
                title="TOP 키워드"
                sub={`검색량 상위 20개 · ${selectedRegion !== 'all' ? selectedRegion : '전체'}`}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={dark ? 'text-slate-500' : 'text-slate-400'}>
                      <th className="text-left pb-2 pr-3">#</th>
                      <th className="text-left pb-2 pr-3">키워드</th>
                      <th className="text-left pb-2 pr-3">지역</th>
                      <th className="text-left pb-2 pr-3">권역</th>
                      <th className="text-right pb-2 pr-3">PC</th>
                      <th className="text-right pb-2 pr-3">모바일</th>
                      <th className="text-right pb-2 pr-3">합계</th>
                      <th className="text-center pb-2">경쟁</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topKeywords.map((kw, i) => (
                      <tr key={i} className={`border-t ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`}>
                        <td className={`py-2 pr-3 font-bold ${dark ? 'text-slate-500' : 'text-slate-300'}`}>{i + 1}</td>
                        <td className={`py-2 pr-3 font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>{kw.keyword}</td>
                        <td className={`py-2 pr-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{kw.area || '-'}</td>
                        <td className="py-2 pr-3">
                          {kw.region && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{
                              background: (REGION_COLORS[kw.region] || '#94A3B8') + '20',
                              color: REGION_COLORS[kw.region] || '#94A3B8',
                            }}>{kw.region}</span>
                          )}
                        </td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmt(kw.monthly_pc)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmt(kw.monthly_mobile)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{fmt(kw.monthly_total)}</td>
                        <td className="py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            kw.competition === '높음' ? 'bg-red-500/10 text-red-500' :
                            kw.competition === '중간' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-emerald-500/10 text-emerald-500'
                          }`}>{kw.competition || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 카테고리 분포 (파이차트) ── */}
            {categoryDist.length > 0 && viewMode === 'overview' && (
              <div className={`rounded-2xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
                <SectionHeader dark={dark}
                  icon={<Filter size={16} className="text-[#06B6D4]" />}
                  title="키워드 카테고리 분포"
                  sub="검색량 기준"
                />
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={categoryDist}
                        dataKey="value"
                        nameKey="label"
                        cx="50%" cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={2}
                        label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                      >
                        {categoryDist.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => fmt(val)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── 데이터 수집 현황 ── */}
            <div className={`rounded-xl border p-4 ${dark ? 'bg-[#1D2125] border-[#A1BDD914]' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                총 {dates.length}일 수집 · {data.length}건 · 최초 {dates[0]} ~ 최근 {latestDate}
                {' · '}매일 자동 수집 설정은 Supabase cron 또는 외부 스케줄러에서 keyword-collector Edge Function을 호출하세요.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
