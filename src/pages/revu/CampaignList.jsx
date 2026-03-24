/**
 * 체험단 > 캠페인 목록
 * ─────────────────────────────
 * Supabase revu_campaigns 조회 → 카드 리스트
 * 클릭 시 nav.sub = 'applicants' + l3sub = campaign_pk 로 이동
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, Users, Instagram, BookOpen, ChevronRight, RefreshCw } from 'lucide-react'

export default function CampaignList({ dark, nav, setNav }) {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

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

  const goToApplicants = (c) => {
    // 캠페인 정보를 sessionStorage에 저장 → 신청자 페이지에서 참조
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className={`text-xl font-bold ${text1}`}>캠페인 목록</h1>
        <button onClick={load} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${dark ? 'bg-[#2D2D44] text-gray-300 hover:bg-[#363650]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition`}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {loading ? (
        <div className={`text-center py-20 ${text2}`}>로딩 중...</div>
      ) : campaigns.length === 0 ? (
        <div className={`text-center py-20 ${text2}`}>
          <p className="text-lg mb-2">등록된 캠페인이 없습니다</p>
          <p className="text-sm">revu_app.py에서 크롤링을 실행하면 자동으로 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {campaigns.map(c => {
            const appCount = c.applicant_count?.[0]?.count ?? 0
            const selCount = c.selection_count?.[0]?.count ?? 0
            const isInsta = c.platform === 'instagram'
            return (
              <button key={c.id} onClick={() => goToApplicants(c)}
                className={`w-full text-left border rounded-xl p-4 flex items-center gap-4 transition hover:scale-[1.005] hover:shadow-md ${card}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isInsta ? 'bg-pink-500/15 text-pink-400' : 'bg-green-500/15 text-green-400'}`}>
                  {isInsta ? <Instagram size={20} /> : <BookOpen size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold truncate ${text1}`}>{c.campaign_title || `캠페인 ${c.campaign_id}`}</div>
                  <div className={`flex items-center gap-3 text-xs mt-1 ${text2}`}>
                    <span className="flex items-center gap-1"><Calendar size={12} />{fmt(c.crawled_at)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isInsta ? 'bg-pink-500/20 text-pink-300' : 'bg-green-500/20 text-green-300'}`}>
                      {isInsta ? 'Instagram' : 'Naver'}
                    </span>
                    <span>ID: {c.campaign_id}</span>
                  </div>
                </div>
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
