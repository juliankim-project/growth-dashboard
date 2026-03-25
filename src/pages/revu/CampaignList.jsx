/**
 * 체험단 > 캠페인 목록
 * ─────────────────────────────
 * 플랫폼 필터 + 테스트 뱃지 + 삭제 기능
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Calendar, Instagram, BookOpen, ChevronRight, RefreshCw, LayoutGrid,
  Trash2, AlertTriangle, FlaskConical
} from 'lucide-react'

/* ── 테스트 여부 판별 ── */
function isTestCrawl(c) {
  // raw_meta 에서 crawl_max 확인 (크롤링 인원 제한 있으면 테스트)
  const raw = typeof c.raw_meta === 'string' ? (() => { try { return JSON.parse(c.raw_meta) } catch { return {} } })() : (c.raw_meta || {})
  const crawlMax = raw.crawl_max || raw.crawlMax || 0
  const modalMax = raw.modal_max || raw.modalMax || 0
  // crawl_max > 0 이면 테스트 (전체=0)
  if (crawlMax > 0) return { test: true, crawlMax, modalMax }
  // total_count가 비정상적으로 적으면 (30명 이하) 테스트 추정
  if (c.total_count > 0 && c.total_count <= 30) return { test: true, crawlMax, modalMax, inferred: true }
  return { test: false, crawlMax, modalMax }
}

export default function CampaignList({ dark, nav, setNav }) {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null) // 삭제 확인용
  const [deleting, setDeleting] = useState(false)

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

  const filtered = useMemo(() => {
    if (platformFilter === 'all') return campaigns
    return campaigns.filter(c => c.platform === platformFilter)
  }, [campaigns, platformFilter])

  const counts = useMemo(() => ({
    all: campaigns.length,
    naver: campaigns.filter(c => c.platform !== 'instagram').length,
    insta: campaigns.filter(c => c.platform === 'instagram').length,
  }), [campaigns])

  const goToApplicants = (c) => {
    sessionStorage.setItem('revu_selected_campaign', JSON.stringify({
      pk: c.id,
      campaign_id: c.campaign_id,
      title: c.campaign_title,
      platform: c.platform,
    }))
    setNav({ section: 'revu', sub: 'applicants', l3sub: null })
  }

  /* ── 삭제 (cascade: applicants + selections 자동 삭제) ── */
  const handleDelete = useCallback(async (c) => {
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('revu_campaigns')
        .delete()
        .eq('id', c.id)
      if (error) throw error
      setCampaigns(prev => prev.filter(x => x.id !== c.id))
      setDeleteTarget(null)
    } catch (e) {
      console.error('삭제 실패:', e)
      alert('삭제 실패: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }, [])

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
            const testInfo = isTestCrawl(c)

            return (
              <div key={c.id} className={`relative border rounded-xl overflow-hidden transition hover:shadow-md ${testInfo.test ? (dark ? 'border-amber-500/30' : 'border-amber-300') : card}`}>
                {/* 메인 클릭 영역 */}
                <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => goToApplicants(c)}>
                  {/* 플랫폼 아이콘 */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isInsta ? 'bg-pink-500/15 text-pink-400' : 'bg-green-500/15 text-green-400'}`}>
                    {isInsta ? <Instagram size={20} /> : <BookOpen size={20} />}
                  </div>

                  {/* 캠페인 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold truncate ${text1}`}>{c.campaign_title || `캠페인 ${c.campaign_id}`}</span>
                      {/* 플랫폼 뱃지 */}
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${isInsta ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30' : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border border-green-500/30'}`}>
                        {isInsta ? 'INSTAGRAM' : 'NAVER'}
                      </span>
                      {/* 테스트 뱃지 */}
                      {testInfo.test && (
                        <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${dark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-amber-100 text-amber-700 border border-amber-300'}`}>
                          <FlaskConical size={10} />
                          TEST
                          {testInfo.crawlMax > 0 && <span className="opacity-70">({testInfo.crawlMax}명)</span>}
                        </span>
                      )}
                    </div>
                    <div className={`flex items-center gap-3 text-xs mt-1 ${text2}`}>
                      <span className="flex items-center gap-1"><Calendar size={12} />{fmt(c.crawled_at)}</span>
                      <span>ID: {c.campaign_id}</span>
                      {testInfo.crawlMax > 0 && (
                        <span className={dark ? 'text-amber-400/70' : 'text-amber-600'}>
                          크롤링 {testInfo.crawlMax}명 제한
                          {testInfo.modalMax > 0 && ` · 모달 ${testInfo.modalMax}명`}
                        </span>
                      )}
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

                    {/* 삭제 버튼 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(c) }}
                      className={`p-1.5 rounded-lg transition opacity-40 hover:opacity-100 ${dark ? 'hover:bg-red-500/20 hover:text-red-400' : 'hover:bg-red-50 hover:text-red-500'}`}
                      title="캠페인 삭제"
                    >
                      <Trash2 size={15} />
                    </button>

                    <ChevronRight size={18} className={text2} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 삭제 확인 모달 ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteTarget(null)}>
          <div className={`p-6 rounded-2xl shadow-2xl border max-w-md w-full mx-4 ${dark ? 'bg-[#1C1C2E] border-[#2D2D44]' : 'bg-white border-gray-200'}`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className={`font-bold ${text1}`}>캠페인 삭제</h3>
                <p className={`text-sm ${text2}`}>이 작업은 되돌릴 수 없습니다</p>
              </div>
            </div>
            <div className={`p-3 rounded-lg mb-4 text-sm ${dark ? 'bg-[#232336]' : 'bg-gray-50'}`}>
              <div className={`font-medium ${text1}`}>{deleteTarget.campaign_title || `캠페인 ${deleteTarget.campaign_id}`}</div>
              <div className={`text-xs mt-1 ${text2}`}>
                ID: {deleteTarget.campaign_id} · 신청자 {deleteTarget.applicant_count?.[0]?.count ?? 0}명 · 선정 {deleteTarget.selection_count?.[0]?.count ?? 0}명
              </div>
              <div className={`text-xs mt-1 text-red-400`}>
                신청자 데이터와 선정 이력이 모두 삭제됩니다
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${btnGhost}`}>
                취소
              </button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50">
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
