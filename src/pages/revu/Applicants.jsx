/**
 * 체험단 > 신청자 리스트 + 선정 UI
 * ──────────────────────────────────
 * 캠페인별 분리 — 좌측 캠페인 목록 + 우측 신청자 테이블
 * - AI 추천 선정 탭: AI점수 순 + 자동 추천
 * - 조건 선정 탭: 칼럼별 필터 + 수동 선택
 * - 플랫폼별(네이버/인스타) 칼럼 & 필터 분기
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft, Search, Check, X, ChevronDown, ChevronUp,
  Instagram, BookOpen, ExternalLink, Filter, ArrowUpDown,
  Save, Loader2, Bot, SlidersHorizontal, Star, TrendingUp,
  Eye, Users as UsersIcon, MessageCircle, FileText, Award,
  List, ChevronRight
} from 'lucide-react'

/* ── 유틸 ── */
const num = (v) => v == null ? '-' : Number(v).toLocaleString()
const pct = (v) => v == null ? '-' : `${Number(v).toFixed(2)}%`
const fmt = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

/* ── 네이버 정렬 키 ── */
const SORT_NAVER = [
  { key: 'ai_score', label: 'AI점수' },
  { key: 'avg_visitors', label: '방문자' },
  { key: 'top_keyword_count', label: '상위키워드' },
  { key: 'avg_likes', label: '평균좋아요' },
  { key: 'blog_score', label: '블로그스코어' },
  { key: 'neighbors', label: '이웃수' },
  { key: 'post_freq_7d', label: '주간포스팅' },
]
/* ── 인스타 정렬 키 ── */
const SORT_INSTA = [
  { key: 'ai_score', label: 'AI점수' },
  { key: 'exact_followers', label: '팔로워' },
  { key: 'engagement_rate', label: '피드참여율' },
]

/* ── AI 점수 바 색상 ── */
const scoreColor = (v) => {
  if (v == null) return 'bg-gray-500/30'
  if (v >= 80) return 'bg-green-500'
  if (v >= 60) return 'bg-emerald-400'
  if (v >= 40) return 'bg-amber-400'
  if (v >= 20) return 'bg-orange-400'
  return 'bg-red-400'
}
const scoreText = (v) => {
  if (v == null) return 'text-gray-400'
  if (v >= 70) return 'text-green-400'
  if (v >= 40) return 'text-amber-400'
  return 'text-red-400'
}

export default function Applicants({ dark, nav, setNav, user }) {
  /* ── 캠페인 목록 ── */
  const [campaigns, setCampaigns] = useState([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('all')

  /* ── 선택된 캠페인 ── */
  const [campaign, setCampaign] = useState(null)
  const [applicants, setApplicants] = useState([])
  const [selections, setSelections] = useState(new Set())
  const [existingSelections, setExistingSelections] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  /* ── 탭 (AI / 조건) ── */
  const [tab, setTab] = useState('ai')

  /* ── 공통 필터 ── */
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('ai_score')
  const [sortDir, setSortDir] = useState('desc')
  const [expanded, setExpanded] = useState(null)

  /* ── 조건 필터 (네이버) ── */
  const [fMinVisitors, setFMinVisitors] = useState('')
  const [fMinBlogScore, setFMinBlogScore] = useState('')
  const [fGender, setFGender] = useState('전체')
  const [fAge, setFAge] = useState('전체')
  const [fCategory, setFCategory] = useState('전체')
  const [fAdActivity, setFAdActivity] = useState('전체')
  const [fMinTopKeyword, setFMinTopKeyword] = useState('')
  const [fMinLikes, setFMinLikes] = useState('')

  /* ── 조건 필터 (인스타) ── */
  const [fMinFollowers, setFMinFollowers] = useState('')
  const [fMinEngagement, setFMinEngagement] = useState('')
  const [fMinInstaLikes, setFMinInstaLikes] = useState('')

  /* ── 캠페인 목록 로드 ── */
  useEffect(() => {
    loadCampaigns()
  }, [])

  /* ── sessionStorage에서 이전 선택 복원 ── */
  useEffect(() => {
    const raw = sessionStorage.getItem('revu_selected_campaign')
    if (raw) {
      try {
        const c = JSON.parse(raw)
        selectCampaign({ id: c.pk, campaign_id: c.campaign_id, campaign_title: c.title, platform: c.platform })
      } catch {}
    }
  }, [])

  const loadCampaigns = async () => {
    setCampaignsLoading(true)
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
      setCampaignsLoading(false)
    }
  }

  const selectCampaign = (c) => {
    setCampaign({ pk: c.id, campaign_id: c.campaign_id, title: c.campaign_title, platform: c.platform })
    sessionStorage.setItem('revu_selected_campaign', JSON.stringify({ pk: c.id, campaign_id: c.campaign_id, title: c.campaign_title, platform: c.platform }))
    loadData(c.id)
    // 필터 초기화
    setSearch(''); setTab('ai'); setSortKey('ai_score'); setSortDir('desc'); setExpanded(null)
    setFMinVisitors(''); setFMinBlogScore(''); setFGender('전체'); setFAge('전체')
    setFCategory('전체'); setFAdActivity('전체'); setFMinTopKeyword(''); setFMinLikes('')
    setFMinFollowers(''); setFMinEngagement(''); setFMinInstaLikes('')
  }

  const loadData = async (pk) => {
    setLoading(true)
    try {
      const { data: apps } = await supabase
        .from('revu_applicants')
        .select('*')
        .eq('campaign_pk', pk)
        .order('ai_score', { ascending: false, nullsFirst: false })
      setApplicants(apps || [])

      const { data: sels } = await supabase
        .from('revu_selections')
        .select('applicant_pk')
        .eq('campaign_pk', pk)
      const selSet = new Set((sels || []).map(s => s.applicant_pk))
      setSelections(new Set(selSet))
      setExistingSelections(new Set(selSet))
    } catch (e) {
      console.error('로드 실패:', e)
    } finally {
      setLoading(false)
    }
  }

  const isInsta = campaign?.platform === 'instagram'

  /* ── raw_data 파싱 헬퍼 ── */
  const getRaw = useCallback((app) => {
    if (!app.raw_data) return {}
    return typeof app.raw_data === 'string' ? JSON.parse(app.raw_data) : app.raw_data
  }, [])

  /* ── 유니크 옵션 ── */
  const genderOpts = useMemo(() => ['전체', ...new Set(applicants.map(a => a.gender).filter(Boolean))], [applicants])
  const ageOpts = useMemo(() => ['전체', ...new Set(applicants.map(a => a.age).filter(Boolean))], [applicants])
  const categoryOpts = useMemo(() => {
    const cats = new Set(applicants.map(a => a.category || getRaw(a).category).filter(Boolean))
    return ['전체', ...cats]
  }, [applicants, getRaw])
  const adOpts = useMemo(() => {
    const ads = new Set(applicants.map(a => a.ad_activity || getRaw(a).ad_activity).filter(Boolean))
    return ['전체', ...ads]
  }, [applicants, getRaw])

  /* ── 필터 & 정렬 ── */
  const filtered = useMemo(() => {
    let list = [...applicants]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        (a.nickname || '').toLowerCase().includes(q) ||
        (a.media_name || '').toLowerCase().includes(q) ||
        (a.instagram_handle || '').toLowerCase().includes(q)
      )
    }

    if (tab === 'ai') {
      list.sort((a, b) => {
        const va = a.ai_score ?? -Infinity
        const vb = b.ai_score ?? -Infinity
        return vb - va
      })
    } else {
      if (isInsta) {
        if (fMinFollowers) list = list.filter(a => (a.exact_followers || 0) >= Number(fMinFollowers))
        if (fMinEngagement) list = list.filter(a => (a.engagement_rate || 0) >= Number(fMinEngagement))
        if (fGender !== '전체') list = list.filter(a => a.gender === fGender)
        if (fAge !== '전체') list = list.filter(a => a.age === fAge)
        if (fMinInstaLikes) list = list.filter(a => (a.avg_insta_likes || 0) >= Number(fMinInstaLikes))
      } else {
        if (fMinVisitors) list = list.filter(a => (a.avg_visitors || 0) >= Number(fMinVisitors))
        if (fMinBlogScore) list = list.filter(a => (a.blog_score || 0) >= Number(fMinBlogScore))
        if (fGender !== '전체') list = list.filter(a => a.gender === fGender)
        if (fAge !== '전체') list = list.filter(a => a.age === fAge)
        if (fCategory !== '전체') list = list.filter(a => (a.category || getRaw(a).category) === fCategory)
        if (fAdActivity !== '전체') list = list.filter(a => (a.ad_activity || getRaw(a).ad_activity) === fAdActivity)
        if (fMinTopKeyword) list = list.filter(a => (a.top_keyword_count || 0) >= Number(fMinTopKeyword))
        if (fMinLikes) list = list.filter(a => (a.avg_likes || 0) >= Number(fMinLikes))
      }

      list.sort((a, b) => {
        let va = a[sortKey] ?? -Infinity
        let vb = b[sortKey] ?? -Infinity
        if (va === -Infinity && sortKey === 'neighbors') va = getRaw(a).neighbors ?? -Infinity
        if (vb === -Infinity && sortKey === 'neighbors') vb = getRaw(b).neighbors ?? -Infinity
        return sortDir === 'desc' ? (vb > va ? 1 : vb < va ? -1 : 0) : (va > vb ? 1 : va < vb ? -1 : 0)
      })
    }

    return list
  }, [applicants, search, tab, sortKey, sortDir, isInsta, getRaw,
    fMinVisitors, fMinBlogScore, fGender, fAge, fCategory, fAdActivity, fMinTopKeyword, fMinLikes,
    fMinFollowers, fMinEngagement, fMinInstaLikes])

  /* ── 선정 토글 ── */
  const toggle = useCallback((id) => {
    setSelections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectAll = () => setSelections(new Set(filtered.map(a => a.id)))
  const deselectAll = () => setSelections(new Set())

  /* ── 선정 저장 ── */
  const handleSave = async () => {
    if (!campaign) return
    setSaving(true)
    setSaveMsg('')
    try {
      const toAdd = [...selections].filter(id => !existingSelections.has(id))
      const toRemove = [...existingSelections].filter(id => !selections.has(id))
      const email = user?.email || 'unknown'

      if (toAdd.length > 0) {
        const rows = toAdd.map(applicant_pk => {
          const app = applicants.find(a => a.id === applicant_pk)
          return {
            campaign_pk: campaign.pk,
            applicant_pk,
            selected_by: email,
            ai_score_at_selection: app?.ai_score || null,
          }
        })
        const { error } = await supabase.from('revu_selections').upsert(rows, { onConflict: 'campaign_pk,applicant_pk' })
        if (error) throw error
      }

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('revu_selections')
          .delete()
          .eq('campaign_pk', campaign.pk)
          .in('applicant_pk', toRemove)
        if (error) throw error
      }

      setExistingSelections(new Set(selections))
      setSaveMsg(`+${toAdd.length} / -${toRemove.length} 저장 완료`)
      setTimeout(() => setSaveMsg(''), 3000)
      // 캠페인 목록의 선정 수 갱신
      loadCampaigns()
    } catch (e) {
      console.error('저장 실패:', e)
      setSaveMsg(`저장 실패: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = useMemo(() => {
    if (selections.size !== existingSelections.size) return true
    for (const id of selections) if (!existingSelections.has(id)) return true
    return false
  }, [selections, existingSelections])

  /* ── 캠페인 필터 ── */
  const filteredCampaigns = useMemo(() => {
    if (platformFilter === 'all') return campaigns
    return campaigns.filter(c => platformFilter === 'instagram' ? c.platform === 'instagram' : c.platform !== 'instagram')
  }, [campaigns, platformFilter])

  const campaignCounts = useMemo(() => ({
    all: campaigns.length,
    naver: campaigns.filter(c => c.platform !== 'instagram').length,
    insta: campaigns.filter(c => c.platform === 'instagram').length,
  }), [campaigns])

  /* ── 스타일 ── */
  const card = dark ? 'bg-[#232336] border-[#2D2D44]' : 'bg-white border-gray-200'
  const text1 = dark ? 'text-gray-100' : 'text-gray-900'
  const text2 = dark ? 'text-gray-400' : 'text-gray-500'
  const text3 = dark ? 'text-gray-500' : 'text-gray-400'
  const inputCls = `rounded-lg px-3 py-1.5 text-sm border outline-none transition ${dark ? 'bg-[#1C1C2E] border-[#2D2D44] text-gray-200 placeholder-gray-500 focus:border-violet-500' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-violet-500'}`
  const btnPrimary = 'bg-violet-600 hover:bg-violet-700 text-white'
  const btnGhost = dark ? 'bg-[#2D2D44] text-gray-300 hover:bg-[#363650]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  const tabActive = dark ? 'bg-violet-600 text-white' : 'bg-violet-600 text-white'
  const tabInactive = dark ? 'bg-[#2D2D44] text-gray-400 hover:text-gray-200' : 'bg-gray-100 text-gray-500 hover:text-gray-800'
  const sidebarBg = dark ? 'bg-[#1A1A2E]' : 'bg-gray-50'
  const sidebarItem = dark ? 'hover:bg-[#232336]' : 'hover:bg-white'
  const sidebarActive = dark ? 'bg-violet-600/10 border-l-2 border-violet-500' : 'bg-violet-50 border-l-2 border-violet-500'

  const sortOptions = isInsta ? SORT_INSTA : SORT_NAVER

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* ══════════════════════════════════════
          좌측: 캠페인 목록 패널
      ══════════════════════════════════════ */}
      <div className={`w-72 shrink-0 border-r ${dark ? 'border-[#2D2D44]' : 'border-gray-200'} ${sidebarBg} flex flex-col`}>
        {/* 헤더 */}
        <div className="p-3 border-b" style={{ borderColor: dark ? '#2D2D44' : '#e5e7eb' }}>
          <div className={`text-sm font-bold mb-2 ${text1}`}>캠페인 선택</div>
          {/* 플랫폼 필터 탭 */}
          <div className="flex gap-1">
            {[
              { key: 'all', label: '전체', count: campaignCounts.all },
              { key: 'naver', label: 'Naver', count: campaignCounts.naver },
              { key: 'instagram', label: 'Insta', count: campaignCounts.insta },
            ].map(f => (
              <button key={f.key}
                onClick={() => setPlatformFilter(f.key)}
                className={`flex-1 px-2 py-1 rounded text-[11px] font-medium transition ${platformFilter === f.key ? 'bg-violet-600 text-white' : (dark ? 'bg-[#2D2D44] text-gray-400' : 'bg-gray-100 text-gray-500')}`}>
                {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* 캠페인 리스트 */}
        <div className="flex-1 overflow-y-auto">
          {campaignsLoading ? (
            <div className={`p-4 text-center text-xs ${text2}`}>로딩 중...</div>
          ) : filteredCampaigns.length === 0 ? (
            <div className={`p-4 text-center text-xs ${text2}`}>캠페인이 없습니다</div>
          ) : (
            filteredCampaigns.map(c => {
              const isActive = campaign?.pk === c.id
              const isInstaCamp = c.platform === 'instagram'
              const appCount = c.applicant_count?.[0]?.count ?? c.total_count ?? 0
              const selCount = c.selection_count?.[0]?.count ?? 0

              return (
                <button key={c.id}
                  onClick={() => selectCampaign(c)}
                  className={`w-full text-left px-3 py-2.5 border-b transition ${dark ? 'border-[#2D2D44]' : 'border-gray-100'} ${isActive ? sidebarActive : sidebarItem}`}>
                  <div className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${isInstaCamp ? 'bg-pink-500/15 text-pink-400' : 'bg-green-500/15 text-green-400'}`}>
                      {isInstaCamp ? <Instagram size={11} /> : <BookOpen size={11} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium truncate ${isActive ? 'text-violet-300' : text1}`}>
                        {c.campaign_title || `캠페인 ${c.campaign_id}`}
                      </div>
                      <div className={`flex items-center gap-2 mt-0.5 text-[10px] ${text3}`}>
                        <span>{appCount}명</span>
                        {selCount > 0 && <span className="text-violet-400">{selCount}명 선정</span>}
                        <span>{fmt(c.crawled_at).split(' ')[0]}</span>
                      </div>
                    </div>
                    {isActive && <ChevronRight size={12} className="text-violet-400 shrink-0 mt-1" />}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          우측: 신청자 테이블 영역
      ══════════════════════════════════════ */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!campaign ? (
          /* ── 캠페인 미선택 상태 ── */
          <div className={`flex flex-col items-center justify-center h-full ${text2}`}>
            <List size={48} className="mb-3 opacity-30" />
            <p className="text-lg mb-1">캠페인을 선택해주세요</p>
            <p className="text-sm opacity-70">좌측에서 캠페인을 클릭하면 신청자 리스트가 표시됩니다</p>
          </div>
        ) : (
          <div className="p-4 md:p-6 max-w-[1200px]">
            {/* ── 캠페인 헤더 ── */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isInsta ? 'bg-pink-500/15 text-pink-400' : 'bg-green-500/15 text-green-400'}`}>
                {isInsta ? <Instagram size={16} /> : <BookOpen size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className={`text-lg font-bold truncate ${text1}`}>{campaign.title || `캠페인 ${campaign.campaign_id}`}</h1>
                <div className={`flex items-center gap-2 text-xs ${text2}`}>
                  <span className={`px-1.5 py-0.5 rounded font-medium ${isInsta ? 'bg-pink-500/20 text-pink-300' : 'bg-green-500/20 text-green-300'}`}>
                    {isInsta ? 'Instagram' : 'Naver'}
                  </span>
                  <span>전체 {applicants.length}명</span>
                  <span className="text-violet-400 font-medium">선정 {selections.size}명</span>
                  {filtered.length !== applicants.length && (
                    <span className="text-amber-400">필터 {filtered.length}명</span>
                  )}
                </div>
              </div>
              <button onClick={handleSave} disabled={!hasChanges || saving}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${hasChanges ? btnPrimary : btnGhost} disabled:opacity-50`}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                선정 저장
              </button>
            </div>

            {saveMsg && (
              <div className={`mb-3 text-sm px-3 py-2 rounded-lg ${saveMsg.includes('완료') ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                {saveMsg}
              </div>
            )}

            {/* ── 탭 전환: AI 추천 / 조건 선정 ── */}
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setTab('ai')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'ai' ? tabActive : tabInactive}`}>
                <Bot size={15} /> AI 추천 선정
              </button>
              <button onClick={() => setTab('condition')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'condition' ? tabActive : tabInactive}`}>
                <SlidersHorizontal size={15} /> 조건 선정
              </button>

              <div className="flex-1" />

              {/* 검색 */}
              <div className="relative w-56">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${text2}`} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="닉네임 / 블로그명 검색"
                  className={`${inputCls} w-full pl-9`} />
              </div>

              <button onClick={selectAll} className={`px-3 py-1.5 rounded-lg text-xs transition ${btnGhost}`}>전체선택</button>
              <button onClick={deselectAll} className={`px-3 py-1.5 rounded-lg text-xs transition ${btnGhost}`}>전체해제</button>
            </div>

            {/* ── 조건 필터 패널 ── */}
            {tab === 'condition' && (
              <ConditionFilters
                dark={dark} isInsta={isInsta} inputCls={inputCls} card={card} text2={text2} btnGhost={btnGhost}
                sortOptions={sortOptions} sortKey={sortKey} setSortKey={setSortKey} sortDir={sortDir} setSortDir={setSortDir}
                genderOpts={genderOpts} ageOpts={ageOpts} categoryOpts={categoryOpts} adOpts={adOpts}
                fGender={fGender} setFGender={setFGender} fAge={fAge} setFAge={setFAge}
                fCategory={fCategory} setFCategory={setFCategory} fAdActivity={fAdActivity} setFAdActivity={setFAdActivity}
                fMinVisitors={fMinVisitors} setFMinVisitors={setFMinVisitors}
                fMinBlogScore={fMinBlogScore} setFMinBlogScore={setFMinBlogScore}
                fMinTopKeyword={fMinTopKeyword} setFMinTopKeyword={setFMinTopKeyword}
                fMinLikes={fMinLikes} setFMinLikes={setFMinLikes}
                fMinFollowers={fMinFollowers} setFMinFollowers={setFMinFollowers}
                fMinEngagement={fMinEngagement} setFMinEngagement={setFMinEngagement}
                fMinInstaLikes={fMinInstaLikes} setFMinInstaLikes={setFMinInstaLikes}
              />
            )}

            {/* ── 테이블 ── */}
            {loading ? (
              <div className={`text-center py-20 ${text2}`}>
                <Loader2 size={24} className="animate-spin mx-auto mb-2 opacity-50" />
                신청자 로딩 중...
              </div>
            ) : filtered.length === 0 ? (
              <div className={`text-center py-20 ${text2}`}>
                <p className="text-lg mb-1">조건에 맞는 신청자가 없습니다</p>
                <p className="text-sm">필터 조건을 조정해보세요</p>
              </div>
            ) : (
              <div className={`border rounded-xl overflow-hidden ${card}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`${dark ? 'bg-[#1C1C2E]' : 'bg-gray-50'} ${text2}`}>
                        <th className="w-10 px-3 py-2.5 text-center">
                          <Check size={14} className="mx-auto opacity-50" />
                        </th>
                        <th className="w-8 px-1 py-2.5 text-center text-xs font-medium">#</th>
                        <th className="w-16 px-2 py-2.5 text-center text-xs font-medium">AI점수</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium min-w-[180px]">인플루언서</th>
                        {isInsta ? (
                          <>
                            <th className="text-right px-3 py-2.5 text-xs font-medium">팔로워</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium">참여율</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium">평균좋아요</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium">평균댓글</th>
                          </>
                        ) : (
                          <>
                            <th className="text-right px-3 py-2.5 text-xs font-medium">방문자</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium">이웃수</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium">키워드</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium">좋아요</th>
                            <th className="text-right px-3 py-2.5 text-xs font-medium">주간글</th>
                            <th className="text-left px-3 py-2.5 text-xs font-medium">광고</th>
                          </>
                        )}
                        <th className="w-8 px-2 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((app, idx) => {
                        const selected = selections.has(app.id)
                        const wasSelected = existingSelections.has(app.id)
                        const isExpanded = expanded === app.id
                        const raw = getRaw(app)
                        const modal = raw.blog_modal || {}

                        return (
                          <ApplicantRow
                            key={app.id}
                            app={app} raw={raw} modal={modal} idx={idx}
                            selected={selected} wasSelected={wasSelected} isExpanded={isExpanded}
                            isInsta={isInsta} dark={dark}
                            text1={text1} text2={text2} text3={text3}
                            onToggle={() => toggle(app.id)}
                            onExpand={() => setExpanded(isExpanded ? null : app.id)}
                            getRaw={getRaw}
                          />
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── 요약 ── */}
            <div className={`mt-3 flex items-center justify-between text-xs ${text2}`}>
              <span>표시 {filtered.length} / 전체 {applicants.length}명</span>
              <span>선정 {selections.size}명</span>
            </div>

            {/* ── 하단 고정 저장 바 ── */}
            {hasChanges && (
              <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border ${dark ? 'bg-[#232336] border-violet-500/30' : 'bg-white border-violet-300'}`}>
                <span className={`text-sm ${text1}`}>선정 {selections.size}명</span>
                <button onClick={handleSave} disabled={saving}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${btnPrimary} disabled:opacity-50`}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  저장
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════
   조건 필터 패널 (네이버 / 인스타 분기)
═══════════════════════════════════════════════ */
function ConditionFilters({
  dark, isInsta, inputCls, card, text2, btnGhost,
  sortOptions, sortKey, setSortKey, sortDir, setSortDir,
  genderOpts, ageOpts, categoryOpts, adOpts,
  fGender, setFGender, fAge, setFAge,
  fCategory, setFCategory, fAdActivity, setFAdActivity,
  fMinVisitors, setFMinVisitors, fMinBlogScore, setFMinBlogScore,
  fMinTopKeyword, setFMinTopKeyword, fMinLikes, setFMinLikes,
  fMinFollowers, setFMinFollowers, fMinEngagement, setFMinEngagement,
  fMinInstaLikes, setFMinInstaLikes,
}) {
  const labelCls = `text-[11px] font-medium ${text2} mb-1 block`

  return (
    <div className={`p-4 rounded-xl border mb-4 ${card}`}>
      <div className={`flex items-center gap-1.5 mb-3 text-xs font-semibold ${text2}`}>
        <Filter size={13} /> 조건 필터
      </div>

      {isInsta ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <div>
            <label className={labelCls}>최소 팔로워</label>
            <input type="number" value={fMinFollowers} onChange={e => setFMinFollowers(e.target.value)}
              placeholder="ex) 1000" className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className={labelCls}>최소 참여율(%)</label>
            <input type="number" step="0.1" value={fMinEngagement} onChange={e => setFMinEngagement(e.target.value)}
              placeholder="ex) 2.0" className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className={labelCls}>성별</label>
            <select value={fGender} onChange={e => setFGender(e.target.value)} className={`${inputCls} w-full`}>
              {genderOpts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>연령대</label>
            <select value={fAge} onChange={e => setFAge(e.target.value)} className={`${inputCls} w-full`}>
              {ageOpts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>최소 평균좋아요</label>
            <input type="number" value={fMinInstaLikes} onChange={e => setFMinInstaLikes(e.target.value)}
              placeholder="ex) 50" className={`${inputCls} w-full`} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>최소 방문자수</label>
            <input type="number" value={fMinVisitors} onChange={e => setFMinVisitors(e.target.value)}
              placeholder="ex) 100" className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className={labelCls}>최소 블로그스코어</label>
            <input type="number" step="0.1" value={fMinBlogScore} onChange={e => setFMinBlogScore(e.target.value)}
              placeholder="ex) 2.0" className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className={labelCls}>성별</label>
            <select value={fGender} onChange={e => setFGender(e.target.value)} className={`${inputCls} w-full`}>
              {genderOpts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>연령대</label>
            <select value={fAge} onChange={e => setFAge(e.target.value)} className={`${inputCls} w-full`}>
              {ageOpts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>카테고리</label>
            <select value={fCategory} onChange={e => setFCategory(e.target.value)} className={`${inputCls} w-full`}>
              {categoryOpts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>광고활동성</label>
            <select value={fAdActivity} onChange={e => setFAdActivity(e.target.value)} className={`${inputCls} w-full`}>
              {adOpts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>최소 상위키워드</label>
            <input type="number" value={fMinTopKeyword} onChange={e => setFMinTopKeyword(e.target.value)}
              placeholder="ex) 3" className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className={labelCls}>최소 평균좋아요</label>
            <input type="number" value={fMinLikes} onChange={e => setFMinLikes(e.target.value)}
              placeholder="ex) 10" className={`${inputCls} w-full`} />
          </div>
        </div>
      )}

      {/* 정렬 */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t" style={{ borderColor: dark ? '#2D2D44' : '#e5e7eb' }}>
        <span className={`text-[11px] font-medium ${text2}`}>정렬:</span>
        <select value={sortKey} onChange={e => setSortKey(e.target.value)} className={`${inputCls}`}>
          {sortOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${btnGhost}`}>
          <ArrowUpDown size={12} /> {sortDir === 'desc' ? '높은순' : '낮은순'}
        </button>
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════
   테이블 행 컴포넌트
═══════════════════════════════════════════════ */
function ApplicantRow({
  app, raw, modal, idx, selected, wasSelected, isExpanded,
  isInsta, dark, text1, text2, text3,
  onToggle, onExpand, getRaw
}) {
  const rowBg = selected
    ? (dark ? 'bg-violet-500/5' : 'bg-violet-50')
    : (idx % 2 === 0 ? '' : (dark ? 'bg-[#1C1C2E]/50' : 'bg-gray-50/50'))

  const adColor = (v) => {
    if (!v) return text2
    if (v === '낮음') return 'text-green-400'
    if (v === '보통') return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <>
      <tr className={`${rowBg} border-t ${dark ? 'border-[#2D2D44]' : 'border-gray-100'} hover:${dark ? 'bg-[#2D2D44]/40' : 'bg-gray-50'} transition-colors cursor-pointer`}
        onClick={onExpand}>
        <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
          <button onClick={onToggle}
            className={`w-6 h-6 rounded flex items-center justify-center border transition ${selected ? 'bg-violet-600 border-violet-600 text-white' : dark ? 'border-[#3D3D55] text-transparent hover:border-violet-400' : 'border-gray-300 text-transparent hover:border-violet-400'}`}>
            <Check size={13} />
          </button>
        </td>
        <td className={`px-1 py-2 text-center text-xs font-mono ${text3}`}>{idx + 1}</td>
        <td className="px-2 py-2">
          <div className="flex flex-col items-center gap-0.5">
            <span className={`text-xs font-bold ${scoreText(app.ai_score)}`}>
              {app.ai_score != null ? Number(app.ai_score).toFixed(1) : '-'}
            </span>
            <div className={`w-12 h-1.5 rounded-full ${dark ? 'bg-[#2D2D44]' : 'bg-gray-200'}`}>
              <div className={`h-full rounded-full transition-all ${scoreColor(app.ai_score)}`}
                style={{ width: `${Math.min(100, app.ai_score || 0)}%` }} />
            </div>
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isInsta ? 'bg-pink-500/15 text-pink-400' : 'bg-green-500/15 text-green-400'}`}>
              {isInsta ? <Instagram size={14} /> : <BookOpen size={14} />}
            </div>
            <div className="min-w-0">
              <div className={`font-medium text-sm truncate ${text1}`}>
                {app.nickname || app.instagram_handle}
                {app.blog_score != null && !isInsta && (
                  <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded ${app.blog_score >= 4 ? 'bg-green-500/20 text-green-400' : app.blog_score >= 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {Number(app.blog_score).toFixed(1)}
                  </span>
                )}
                {app.is_picked && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">추천</span>}
                {app.is_duplicate && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">중복</span>}
                {wasSelected && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-400">선정</span>}
              </div>
              <div className={`text-[11px] truncate ${text3}`}>
                {isInsta ? (app.instagram_handle || '') : (app.media_name || '')}
                {app.gender && ` · ${app.gender}`}
                {app.age && ` · ${app.age}`}
              </div>
            </div>
          </div>
        </td>

        {isInsta ? (
          <>
            <td className={`px-3 py-2 text-right text-sm ${text1}`}>{num(app.exact_followers)}</td>
            <td className="px-3 py-2 text-right">
              <span className={`text-sm font-medium ${(app.engagement_rate || 0) >= 3 ? 'text-green-400' : (app.engagement_rate || 0) >= 1.5 ? 'text-amber-400' : text2}`}>
                {pct(app.engagement_rate)}
              </span>
            </td>
            <td className={`px-3 py-2 text-right text-sm ${text1}`}>{num(app.avg_insta_likes)}</td>
            <td className={`px-3 py-2 text-right text-sm ${text2}`}>{num(app.avg_insta_comments)}</td>
          </>
        ) : (
          <>
            <td className={`px-3 py-2 text-right text-sm ${text1}`}>{num(app.avg_visitors)}</td>
            <td className={`px-3 py-2 text-right text-sm ${text1}`}>{num(app.neighbors || raw.neighbors)}</td>
            <td className={`px-3 py-2 text-right text-sm ${text1}`}>{app.top_keyword_count != null ? app.top_keyword_count : '-'}</td>
            <td className={`px-3 py-2 text-right text-sm ${text1}`}>{num(app.avg_likes)}</td>
            <td className={`px-3 py-2 text-right text-sm ${text2}`}>{app.post_freq_7d ?? '-'}</td>
            <td className={`px-3 py-2 text-sm ${adColor(app.ad_activity || raw.ad_activity)}`}>
              {app.ad_activity || raw.ad_activity || '-'}
            </td>
          </>
        )}

        <td className={`px-2 py-2 ${text3}`}>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={isInsta ? 9 : 11} className="p-0">
            <DetailPanel app={app} raw={raw} modal={modal} isInsta={isInsta} dark={dark} text1={text1} text2={text2} text3={text3} />
          </td>
        </tr>
      )}
    </>
  )
}


/* ═══════════════════════════════════════════════
   확장 상세 패널
═══════════════════════════════════════════════ */
function DetailPanel({ app, raw, modal, isInsta, dark, text1, text2, text3 }) {
  const panelBg = dark ? 'bg-[#1A1A2E]' : 'bg-gray-50'
  const miniCard = dark ? 'bg-[#232336] border-[#2D2D44]' : 'bg-white border-gray-200'
  const keywords = modal.top_keywords || raw.top_keywords || []
  const recentPosts = modal.recent_posts || raw.recent_posts || []
  const desc = raw.blog_score_description || modal.blog_score_description || ''

  return (
    <div className={`p-4 ${panelBg} border-t ${dark ? 'border-[#2D2D44]' : 'border-gray-100'}`}>
      {desc && (
        <div className={`flex items-start gap-2 mb-4 p-3 rounded-lg border ${miniCard}`}>
          <Bot size={16} className="text-violet-400 shrink-0 mt-0.5" />
          <p className={`text-sm leading-relaxed ${text1}`}>{desc}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        {isInsta ? (
          <>
            <MetricCard label="팔로워" value={num(raw.exact_followers || app.exact_followers)} icon={<UsersIcon size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="게시물" value={num(raw.post_count || app.post_count)} icon={<FileText size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="피드참여율" value={pct(raw.engagement_rate || app.engagement_rate)} icon={<TrendingUp size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="평균좋아요" value={num(raw.avg_likes || app.avg_insta_likes)} icon={<Star size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="릴스평균조회" value={num(raw.avg_reel_views)} icon={<Eye size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="릴스최고조회" value={num(raw.max_reel_views)} icon={<Award size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
          </>
        ) : (
          <>
            <MetricCard label="블로그스코어" value={app.blog_score ?? '-'} icon={<Star size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="일평균방문자" value={num(app.avg_visitors)} icon={<Eye size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="이웃수" value={num(app.neighbors || raw.neighbors || modal.neighbors)} icon={<UsersIcon size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="평균좋아요" value={num(app.avg_likes || modal.avg_likes)} icon={<Star size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="평균댓글" value={num(app.avg_comments || modal.avg_comments)} icon={<MessageCircle size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="주간포스팅" value={app.post_freq_7d ?? modal.post_freq_7d ?? '-'} icon={<FileText size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="상위키워드" value={app.top_keyword_count ?? modal.top_keyword_count ?? '-'} icon={<TrendingUp size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="광고활동성" value={app.ad_activity || modal.ad_activity || '-'} icon={<Filter size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard}
              valueColor={
                (app.ad_activity || modal.ad_activity) === '낮음' ? 'text-green-400' :
                (app.ad_activity || modal.ad_activity) === '보통' ? 'text-amber-400' :
                (app.ad_activity || modal.ad_activity) ? 'text-red-400' : undefined
              }
            />
            <MetricCard label="카테고리" value={app.category || modal.category || '-'} icon={<BookOpen size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="개설일" value={raw.open_date || modal.open_date || '-'} icon={<FileText size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="총방문자" value={num(raw.total_visitors || modal.total_visitors)} icon={<UsersIcon size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
            <MetricCard label="스크랩" value={num(raw.scraps || modal.scraps)} icon={<Star size={13} />} dark={dark} text1={text1} text2={text2} miniCard={miniCard} />
          </>
        )}
      </div>

      {keywords.length > 0 && (
        <div className={`p-3 rounded-lg border mb-3 ${miniCard}`}>
          <div className={`text-xs font-semibold mb-2 ${text2}`}>상위 노출 키워드 ({keywords.length}개)</div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.slice(0, 20).map((kw, i) => (
              <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${dark ? 'bg-[#2D2D44] text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                {kw.rank != null && <span className={`font-bold ${kw.rank <= 3 ? 'text-green-400' : kw.rank <= 10 ? 'text-amber-400' : text3}`}>#{kw.rank}</span>}
                <span>{kw.keyword || kw}</span>
                {kw.search_volume != null && <span className={text3}>({num(kw.search_volume)})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {recentPosts.length > 0 && (
        <div className={`p-3 rounded-lg border ${miniCard}`}>
          <div className={`text-xs font-semibold mb-2 ${text2}`}>최근 포스트 ({recentPosts.length}개)</div>
          <div className="space-y-1.5">
            {recentPosts.slice(0, 5).map((post, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs ${text1}`}>
                <span className={text3}>{post.date}</span>
                <span className="truncate flex-1">{post.title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {post.is_top_exposed && <span className="px-1 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">상위</span>}
                  {post.is_smart_block && <span className="px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">스마트</span>}
                  <span className={text3}>{post.likes}좋</span>
                  <span className={text3}>{post.comments}댓</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(app.media_url || app.instagram_url) && (
        <a href={app.media_url || app.instagram_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-xs text-violet-400 hover:underline">
          <ExternalLink size={12} /> 프로필 보기
        </a>
      )}
    </div>
  )
}


/* ── 지표 미니카드 ── */
function MetricCard({ label, value, icon, dark, text1, text2, miniCard, valueColor }) {
  return (
    <div className={`p-2.5 rounded-lg border ${miniCard}`}>
      <div className={`flex items-center gap-1 text-[10px] ${text2} mb-1`}>
        {icon} {label}
      </div>
      <div className={`text-sm font-semibold ${valueColor || text1}`}>{value}</div>
    </div>
  )
}
