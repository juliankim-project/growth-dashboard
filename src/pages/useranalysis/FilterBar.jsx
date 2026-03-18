import { useMemo } from 'react'
import { Filter, X } from 'lucide-react'

/**
 * 공통 필터 바 (유저분석 전 탭 공유)
 */
export default function FilterBar({
  dark,
  data = [],
  selectedAreas = [],
  setSelectedAreas,
  selectedBranch = '',
  setSelectedBranch,
  selectedChannel = '',
  setSelectedChannel,
  totalCount = 0,
  showChannel = false,
  children,
}) {
  const t = dark
    ? { border: 'border-[#A1BDD914]', sub: 'text-slate-400', muted: 'text-slate-500',
        input: 'bg-[#2C333A] border-[#A1BDD914] text-white', chip: 'bg-[#2C333A] text-slate-300 hover:bg-[#3a424d]', chipActive: 'bg-blue-600 text-white shadow-sm' }
    : { border: 'border-slate-200', sub: 'text-slate-600', muted: 'text-slate-400',
        input: 'bg-white border-slate-200 text-slate-800', chip: 'bg-slate-100 text-slate-600 hover:bg-slate-200', chipActive: 'bg-blue-600 text-white shadow-sm' }

  const areaList = useMemo(() =>
    [...new Set(data.map(r => r.area).filter(Boolean))].sort()
  , [data])

  const branchList = useMemo(() => {
    const filtered = selectedAreas.length > 0
      ? data.filter(r => selectedAreas.includes(r.area))
      : data
    return [...new Set(filtered.map(r => r.branch_name).filter(Boolean))].sort()
  }, [data, selectedAreas])

  const channelList = useMemo(() =>
    [...new Set(data.map(r => r.channel_group).filter(Boolean))].sort()
  , [data])

  const toggleArea = (area) => {
    if (selectedAreas.includes(area)) {
      setSelectedAreas(selectedAreas.filter(a => a !== area))
    } else {
      setSelectedAreas([...selectedAreas, area])
    }
    setSelectedBranch('')
  }

  const hasFilter = selectedAreas.length > 0 || selectedBranch || selectedChannel

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Filter size={13} className={t.muted} />

      {/* 권역 칩 */}
      {areaList.map(area => (
        <button key={area} onClick={() => toggleArea(area)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all
            ${selectedAreas.includes(area) ? t.chipActive : t.chip}`}>
          {area}
        </button>
      ))}

      {/* 구분선 */}
      <div className={`w-px h-5 mx-0.5 ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />

      {/* 지점 */}
      <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
        className={`text-xs rounded-lg px-2.5 py-1.5 border outline-none ${t.input}`}>
        <option value="">전체 지점</option>
        {branchList.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      {/* 채널 (선택적) */}
      {showChannel && (
        <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)}
          className={`text-xs rounded-lg px-2.5 py-1.5 border outline-none ${t.input}`}>
          <option value="">전체 채널</option>
          {channelList.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* 초기화 */}
      {hasFilter && (
        <button onClick={() => { setSelectedAreas([]); setSelectedBranch(''); setSelectedChannel?.('') }}
          className={`flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-lg ${dark ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
          <X size={11} /> 초기화
        </button>
      )}

      {/* 추가 요소 */}
      {children}

      {/* 건수 */}
      <span className={`text-xs font-medium ml-auto ${t.muted}`}>
        {Math.round(totalCount).toLocaleString()}건
      </span>
    </div>
  )
}

/** 필터 적용 유틸 */
export function applyFilters(data, { selectedAreas = [], selectedBranch = '', selectedChannel = '' }) {
  let d = data
  if (selectedAreas.length > 0) d = d.filter(r => selectedAreas.includes(r.area))
  if (selectedBranch) d = d.filter(r => r.branch_name === selectedBranch)
  if (selectedChannel) d = d.filter(r => r.channel_group === selectedChannel)
  return d
}
