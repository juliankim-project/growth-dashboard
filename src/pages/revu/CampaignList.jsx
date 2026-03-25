/**
 * 체험단 > 캠페인 목록
 * ─────────────────────────────
 * 플랫폼 필터(전체/Naver/Instagram) + 카드 리스트
 * 클릭 시 nav.sub = 'applicants' 로 이동
 */
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, Users, Instagram, BookOpen, ChevronRight, RefreshCw, LayoutGrid } from 'lucide-react'

export default function CampaignList({ dark, nav, setNav }) {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('all') // 'all' | 'naver' | 'instagram'

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('revu_campaigns')
        .select('*, applicant_count:revu_applicants(count), selection_count:revu_selections(count)')
        .order('crawled_at', { ascending: false })
      if (error) throw error
      setCampaigns(data || [])
    } catch (e) {
      console.error('캠페인 로드 실패:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  /* ── 플랫폼 필터 적용 ── */
  const filtered = useMemo(() => {
    if (platformFilter === 'all') return campaigns
    return campaigns.filter(c => c.platform === platformFilter)
  }, [campaigns, platformFilter])

  /* ── 플랫폼별 카운트 ── */
  const counts = useMemo(() => {
    const all = campaigns.length
    const naver = campaigns.filter(c => c.platform !== 'instagram').length
    const insta = campaigns.filter(c => c.platform === 'instagram').length
    return { all, naver, insta }
  }, [campaigns])

  const goToApplicants = (c) => {
    sessionStorage.setItem('revu_selected_campaign', JSON.stringify({
      pk: c.id,
      campaign_id: c.campaign_id,
      title: c.campaign_title,
      platform: c.platform,
    }))
    setNav({ section: 'revu', sub: 'applicants', l3sub: null })
  }

  const fmt = (iso) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const card = dark ? 'bg-[#232336] border-[#2D2D44]' : 'bg-white border-gray-200'
  const text1 = dark ? 'text-gray-100' : 'text-gray-900'
  const text2 = dark ? 'text-gray-400' : 'text-gray-500'
  const btnGhost = dark ? 'bg-[#2D2D44] text-gray-300 hover:bg-[#363650]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  const tabActive = dark ? 'bg-violet-600 text-white' : 'bg-violet-600 text-white'
  const tabInactive = dark ? 'bg-[#2D2D44] text-gray-400 hover:text-gray-200' : 'bg-gray-100 text-gray-500 hover:text-gray-800'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className={`text-xl font-bold ${text1}`}>캠페인 목록</h1>
        <button onClick={load} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${btnGhost} transition`}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {/* ── 플랫폼 필터 탭 ── */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setPlatformFilter('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${platformFilter === 'all' ? tabActive : tabInactive}`}>
          <LayoutGrid size={14} /> 전체 <span className="opacity-70">({counts.all})</span>
        </button>
        <button onClick={() => setPlatformFilter('naver')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${platformFilter === 'naver' ? 'bg-green-600 text-white' : tabInactive}`}>
          <BookOpen size={14} /> 네이버 <span className="opacity-70">({counts.naver})</span>
        </button>
        <button onClick={() => setPlatformFilter('instagram')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${platformFilter === 'instagram' ? 'bg-pink-600 text-white' : tabInactive}`}>
          <Instagram size={14} /> 인스타그램 <span className="opacity-70">({counts.insta})</span>
        </button>
      </div>

      {/* ── 리스트 ── */}
      {loading ? (
        <div className={`text-center py-20 ${text2}`}>로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-20 ${text2}`}>
          <p className="text-lg mb-2">
            {platformFilter === 'all' ? '등록된 캠페인이 없습니다' : `${platformFilter === 'instagram' ? '인스타그램' : '네이버'} 캠페인이 없습니다`}
          </p>
          <p className="text-sm">revu_app.py에서 크롤링을 실행하면 자동으로 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(c => {
            const appCount = c.applicant_count?.[0]?.count ?? 0
            const selCount = c.selection_count?.[0]?.count ?? 0
            const isInsta = c.platform === 'instagram'
            return (
              <button key={c.id} onClick={() => goToApplicants(c)}
                className={`w-full text-left border rounded-xl p-4 flex items-center gap-4 transition hover:scale-[1.005] hover:shadow-md ${card}`}>
                {/* 플랫폼 아이콘 */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isInsta ? 'bg-pink-500/15 text-pink-400' : 'bg-green-500/15 text-green-400'}`}>
                  {isInsta ? <Instagram size={20} /> : <BookOpen size={20} />}
                </div>

                {/* 캠페인 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold truncate ${text1}`}>{c.campaign_title || `캠페인 ${c.campaign_id}`}</span>
                    {/* 플랫폼 라벨 뱃지 */}
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${isInsta ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30' : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border border-green-500/30'}`}>
                      {isInsta ? 'INSTAGRAM' : 'NAVER'}
                    </span>
                  </div>
                  <div className={`flex items-center gap-3 text-xs mt-1 ${text2}`}>
                    <span className="flex items-center gap-1"><Calendar size={12} />{fmt(c.crawled_at)}</span>
                    <span>ID: {c.campaign_id}</span>
                  </div>
                </div>

                {/* 카운트 */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <div className={`text-lg font-bold ${text1}`}>{appCount}</div>
                    <div className={`text-[10px] ${text2}`}>신청자</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-bold ${selCount > 0 ? 'text-violet-400' : text1}`}>{selCount}</div>
                    <div className={`text-[10px] ${text2}`}>선정</div>
                  </div>
                  <ChevronRight size={18} className={text2} />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
