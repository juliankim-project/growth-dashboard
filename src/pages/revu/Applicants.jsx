/**
 * 체험단 > 신청자 리스트 + 선정 UI
 * ──────────────────────────────────
 * 캠페인별 분리 — 좌측 캠페인 목록 + 우측 신청자 테이블
 * 크롤러앱 UI 미러링:
 * - 네이버: AI점수, 인플루언서, 방문자, 키워드, 좋아요, 🏨적합, 숙소글, 숙소KW, 상위%
 * - 인스타: AI점수, 인플루언서, 팔로워, 참여율, 릴스평균, 릴스최고
 * - 확장: AI분석, 지표별 percentile, 숙소적합도 상세, 키워드, 포스트
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Search, Check, ChevronDown, ChevronUp,
  Instagram, BookOpen, ExternalLink, Filter, ArrowUpDown,
  Save, Loader2, Bot, SlidersHorizontal, Star, TrendingUp,
  Eye, Users as UsersIcon, MessageCircle, FileText, Award,
  List, ChevronRight, Hotel, Trophy, BadgeCheck, AlertTriangle
} from 'lucide-react'

/* ── 유틸 ── */
const num = (v) => v == null ? '-' : Number(v).toLocaleString()
const pct = (v) => v == null ? '-' : `${Number(v).toFixed(2)}%`
const fmt = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const SORT_NAVER = [
  { key: 'ai_score', label: 'AI점수' },
  { key: 'avg_visitors', label: '방문자' },
  { key: 'top_keyword_count', label: '상위키워드' },
  { key: 'avg_likes', label: '평균좋아요' },
  { key: 'blog_score', label: '블로그스코어' },
  { key: 'neighbors', label: '이웃수' },
  { key: 'post_freq_7d', label: '주간포스팅' },
  { key: '_accomFit', label: '숙소적합도' },
]
const SORT_INSTA = [
  { key: 'ai_score', label: 'AI점수' },
  { key: 'exact_followers', label: '팔로워' },
  { key: 'engagement_rate', label: '피드참여율' },
]

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
const gradeLabel = (v) => {
  if (v >= 85) return { text: '강력 추천', color: 'bg-green-500/20 text-green-400', icon: '🏆' }
  if (v >= 70) return { text: '추천', color: 'bg-emerald-500/20 text-emerald-400', icon: '✅' }
  if (v >= 55) return { text: '조건부 추천', color: 'bg-amber-500/20 text-amber-400', icon: '⚡' }
  return { text: '참고', color: 'bg-gray-500/20 text-gray-400', icon: '📌' }
}

/* ── raw_data에서 크롤러 데이터 추출 ── */
function parseRaw(app) {
  if (!app.raw_data) return {}
  return typeof app.raw_data === 'string' ? JSON.parse(app.raw_data) : app.raw_data
}
function getAccom(raw) {
  return raw._accom || raw.blog_modal?._accom || {}
}

export default function Applicants({ dark, nav, setNav, user }) {
  const [campaigns, setCampaigns] = useState([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [campaign, setCampaign] = useState(null)
  const [applicants, setApplicants] = useState([])
  const [selections, setSelections] = useState(new Set())
  const [existingSelections, setExistingSelections] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [tab, setTab] = useState('ai')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('ai_score')
  const [sortDir, setSortDir] = useState('desc')
  const [expanded, setExpanded] = useState(null)
  const [fMinVisitors, setFMinVisitors] = useState('')
  const [fMinBlogScore, setFMinBlogScore] = useState('')
  const [fGender, setFGender] = useState('전체')
  const [fAge, setFAge] = useState('전체')
  const [fCategory, setFCategory] = useState('전체')
  const [fAdActivity, setFAdActivity] = useState('전체')
  const [fMinTopKeyword, setFMinTopKeyword] = useState('')
  const [fMinLikes, setFMinLikes] = useState('')
  const [fMinFollowers, setFMinFollowers] = useState('')
  const [fMinEngagement, setFMinEngagement] = useState('')
  const [fMinInstaLikes, setFMinInstaLikes] = useState('')

  useEffect(() => { loadCampaigns() }, [])
  useEffect(() => {
    const raw = sessionStorage.getItem('revu_selected_campaign')
    if (raw) { try { const c = JSON.parse(raw); selectCampaign({ id: c.pk, campaign_id: c.campaign_id, campaign_title: c.title, platform: c.platform }) } catch {} }
  }, [])

  const loadCampaigns = async () => {
    setCampaignsLoading(true)
    try {
      const { data, error } = await supabase.from('revu_campaigns')
        .select('*, applicant_count:revu_applicants(count), selection_count:revu_selections(count)')
        .order('crawled_at', { ascending: false })
      if (error) throw error
      setCampaigns(data || [])
    } catch (e) { console.error('캠페인 로드 실패:', e) }
    finally { setCampaignsLoading(false) }
  }

  const selectCampaign = (c) => {
    setCampaign({ pk: c.id, campaign_id: c.campaign_id, title: c.campaign_title, platform: c.platform })
    sessionStorage.setItem('revu_selected_campaign', JSON.stringify({ pk: c.id, campaign_id: c.campaign_id, title: c.campaign_title, platform: c.platform }))
    loadData(c.id)
    setSearch(''); setTab('ai'); setSortKey('ai_score'); setSortDir('desc'); setExpanded(null)
    setFMinVisitors(''); setFMinBlogScore(''); setFGender('전체'); setFAge('전체')
    setFCategory('전체'); setFAdActivity('전체'); setFMinTopKeyword(''); setFMinLikes('')
    setFMinFollowers(''); setFMinEngagement(''); setFMinInstaLikes('')
  }

  const loadData = async (pk) => {
    setLoading(true)
    try {
      const { data: apps } = await supabase.from('revu_applicants').select('*').eq('campaign_pk', pk).order('ai_score', { ascending: false, nullsFirst: false })
      setApplicants(apps || [])
      const { data: sels } = await supabase.from('revu_selections').select('applicant_pk').eq('campaign_pk', pk)
      const selSet = new Set((sels || []).map(s => s.applicant_pk))
      setSelections(new Set(selSet)); setExistingSelections(new Set(selSet))
    } catch (e) { console.error('로드 실패:', e) }
    finally { setLoading(false) }
  }

  const isInsta = campaign?.platform === 'instagram'

  /* ── parsed raw data 캐시 ── */
  const parsedMap = useMemo(() => {
    const m = new Map()
    applicants.forEach(a => m.set(a.id, parseRaw(a)))
    return m
  }, [applicants])

  const getRaw = useCallback((app) => parsedMap.get(app.id) || {}, [parsedMap])

  /* ── 숙소 적합도 요약 통계 (네이버 전용) ── */
  const accomStats = useMemo(() => {
    if (isInsta || !applicants.length) return null
    let hasAccom = 0, totalFit = 0, maxFit = 0, totalPosts = 0, totalKws = 0
    applicants.forEach(a => {
      const raw = getRaw(a)
      const ac = getAccom(raw)
      const fit = raw.accomFit || 0
      totalFit += fit
      if (fit > maxFit) maxFit = fit
      if ((ac.accomPostCount || 0) > 0 || (ac.accomKwCount || 0) > 0) hasAccom++
      totalPosts += ac.accomPostCount || 0
      totalKws += ac.accomKwCount || 0
    })
    return { hasAccom, avgFit: Math.round(totalFit / applicants.length), maxFit, totalPosts, totalKws, total: applicants.length }
  }, [applicants, isInsta, getRaw])

  const genderOpts = useMemo(() => ['전체', ...new Set(applicants.map(a => a.gender).filter(Boolean))], [applicants])
  const ageOpts = useMemo(() => ['전체', ...new Set(applicants.map(a => a.age).filter(Boolean))], [applicants])
  const categoryOpts = useMemo(() => ['전체', ...new Set(applicants.map(a => a.category || getRaw(a).category).filter(Boolean))], [applicants, getRaw])
  const adOpts = useMemo(() => ['전체', ...new Set(applicants.map(a => a.ad_activity || getRaw(a).ad_activity || getRaw(a).adActivity).filter(Boolean))], [applicants, getRaw])

  const filtered = useMemo(() => {
    let list = [...applicants]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a => (a.nickname || '').toLowerCase().includes(q) || (a.media_name || '').toLowerCase().includes(q) || (a.instagram_handle || '').toLowerCase().includes(q))
    }
    if (tab === 'ai') {
      list.sort((a, b) => (b.ai_score ?? -Infinity) - (a.ai_score ?? -Infinity))
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
        if (fAdActivity !== '전체') list = list.filter(a => (a.ad_activity || getRaw(a).ad_activity || getRaw(a).adActivity) === fAdActivity)
        if (fMinTopKeyword) list = list.filter(a => (a.top_keyword_count || 0) >= Number(fMinTopKeyword))
        if (fMinLikes) list = list.filter(a => (a.avg_likes || 0) >= Number(fMinLikes))
      }
      list.sort((a, b) => {
        let va, vb
        if (sortKey === '_accomFit') { va = getRaw(a).accomFit ?? -Infinity; vb = getRaw(b).accomFit ?? -Infinity }
        else { va = a[sortKey] ?? getRaw(a)[sortKey] ?? -Infinity; vb = b[sortKey] ?? getRaw(b)[sortKey] ?? -Infinity }
        return sortDir === 'desc' ? (vb > va ? 1 : vb < va ? -1 : 0) : (va > vb ? 1 : va < vb ? -1 : 0)
      })
    }
    return list
  }, [applicants, search, tab, sortKey, sortDir, isInsta, getRaw, fMinVisitors, fMinBlogScore, fGender, fAge, fCategory, fAdActivity, fMinTopKeyword, fMinLikes, fMinFollowers, fMinEngagement, fMinInstaLikes])

  const toggle = useCallback((id) => { setSelections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }, [])
  const selectAll = () => setSelections(new Set(filtered.map(a => a.id)))
  const deselectAll = () => setSelections(new Set())

  const handleSave = async () => {
    if (!campaign) return
    setSaving(true); setSaveMsg('')
    try {
      const toAdd = [...selections].filter(id => !existingSelections.has(id))
      const toRemove = [...existingSelections].filter(id => !selections.has(id))
      const email = user?.email || 'unknown'
      if (toAdd.length > 0) {
        const rows = toAdd.map(pk => { const app = applicants.find(a => a.id === pk); return { campaign_pk: campaign.pk, applicant_pk: pk, selected_by: email, ai_score_at_selection: app?.ai_score || null } })
        const { error } = await supabase.from('revu_selections').upsert(rows, { onConflict: 'campaign_pk,applicant_pk' })
        if (error) throw error
      }
      if (toRemove.length > 0) {
        const { error } = await supabase.from('revu_selections').delete().eq('campaign_pk', campaign.pk).in('applicant_pk', toRemove)
        if (error) throw error
      }
      setExistingSelections(new Set(selections))
      setSaveMsg(`+${toAdd.length} / -${toRemove.length} 저장 완료`)
      setTimeout(() => setSaveMsg(''), 3000)
      loadCampaigns()
    } catch (e) { console.error('저장 실패:', e); setSaveMsg(`저장 실패: ${e.message}`) }
    finally { setSaving(false) }
  }

  const hasChanges = useMemo(() => {
    if (selections.size !== existingSelections.size) return true
    for (const id of selections) if (!existingSelections.has(id)) return true
    return false
  }, [selections, existingSelections])

  const filteredCampaigns = useMemo(() => {
    if (platformFilter === 'all') return campaigns
    return campaigns.filter(c => platformFilter === 'instagram' ? c.platform === 'instagram' : c.platform !== 'instagram')
  }, [campaigns, platformFilter])
  const campaignCounts = useMemo(() => ({ all: campaigns.length, naver: campaigns.filter(c => c.platform !== 'instagram').length, insta: campaigns.filter(c => c.platform === 'instagram').length }), [campaigns])

  /* ── 스타일 ── */
  const card = dark ? 'bg-[#232336] border-[#2D2D44]' : 'bg-white border-gray-200'
  const text1 = dark ? 'text-gray-100' : 'text-gray-900'
  const text2 = dark ? 'text-gray-400' : 'text-gray-500'
  const text3 = dark ? 'text-gray-500' : 'text-gray-400'
  const inputCls = `rounded-lg px-3 py-1.5 text-sm border outline-none transition ${dark ? 'bg-[#1C1C2E] border-[#2D2D44] text-gray-200 placeholder-gray-500 focus:border-violet-500' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-violet-500'}`
  const btnPrimary = 'bg-violet-600 hover:bg-violet-700 text-white'
  const btnGhost = dark ? 'bg-[#2D2D44] text-gray-300 hover:bg-[#363650]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  const tabActive = 'bg-violet-600 text-white'
  const tabInactive = dark ? 'bg-[#2D2D44] text-gray-400 hover:text-gray-200' : 'bg-gray-100 text-gray-500 hover:text-gray-800'
  const sidebarBg = dark ? 'bg-[#1A1A2E]' : 'bg-gray-50'
  const sidebarItem = dark ? 'hover:bg-[#232336]' : 'hover:bg-white'
  const sidebarActive = dark ? 'bg-violet-600/10 border-l-2 border-violet-500' : 'bg-violet-50 border-l-2 border-violet-500'

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* ═══ 좌측: 캠페인 목록 ═══ */}
      <div className={`w-72 shrink-0 border-r ${dark ? 'border-[#2D2D44]' : 'border-gray-200'} ${sidebarBg} flex flex-col`}>
        <div className="p-3 border-b" style={{ borderColor: dark ? '#2D2D44' : '#e5e7eb' }}>
          <div className={`text-sm font-bold mb-2 ${text1}`}>캠페인 선택</div>
          <div className="flex gap-1">
            {[{ key: 'all', label: '전체', count: campaignCounts.all }, { key: 'naver', label: 'Naver', count: campaignCounts.naver }, { key: 'instagram', label: 'Insta', count: campaignCounts.insta }].map(f => (
              <button key={f.key} onClick={() => setPlatformFilter(f.key)}
                className={`flex-1 px-2 py-1 rounded text-[11px] font-medium transition ${platformFilter === f.key ? 'bg-violet-600 text-white' : (dark ? 'bg-[#2D2D44] text-gray-400' : 'bg-gray-100 text-gray-500')}`}>
                {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {campaignsLoading ? <div className={`p-4 text-center text-xs ${text2}`}>로딩 중...</div> :
           filteredCampaigns.length === 0 ? <div className={`p-4 text-center text-xs ${text2}`}>캠페인이 없습니다</div> :
           filteredCampaigns.map(c => {
             const isActive = campaign?.pk === c.id
             const isI = c.platform === 'instagram'
             const appCount = c.applicant_count?.[0]?.count ?? c.total_count ?? 0
             const selCount = c.selection_count?.[0]?.count ?? 0
             return (
               <button key={c.id} onClick={() => selectCampaign(c)}
                 className={`w-full text-left px-3 py-2.5 border-b transition ${dark ? 'border-[#2D2D44]' : 'border-gray-100'} ${isActive ? sidebarActive : sidebarItem}`}>
                 <div className="flex items-start gap-2">
                   <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${isI ? 'bg-pink-500/15 text-pink-400' : 'bg-green-500/15 text-green-400'}`}>
                     {isI ? <Instagram size={11} /> : <BookOpen size={11} />}
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className={`text-xs font-medium truncate ${isActive ? 'text-violet-300' : text1}`}>{c.campaign_title || `캠페인 ${c.campaign_id}`}</div>
                     <div className={`flex items-center gap-2 mt-0.5 text-[10px] ${text3}`}>
                       <span>{appCount}명</span>
                       {selCount > 0 && <span className="text-violet-400">{selCount} 선정</span>}
                       <span>{fmt(c.crawled_at).split(' ')[0]}</span>
                     </div>
                   </div>
                   {isActive && <ChevronRight size={12} className="text-violet-400 shrink-0 mt-1" />}
                 </div>
               </button>
             )
           })}
        </div>
      </div>

      {/* ═══ 우측: 신청자 영역 ═══ */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!campaign ? (
          <div className={`flex flex-col items-center justify-center h-full ${text2}`}>
            <List size={48} className="mb-3 opacity-30" />
            <p className="text-lg mb-1">캠페인을 선택해주세요</p>
            <p className="text-sm opacity-70">좌측에서 캠페인을 클릭하면 신청자 리스트가 표시됩니다</p>
          </div>
        ) : (
          <div className="p-4 md:p-5 max-w-[1400px]">
            {/* 헤더 */}
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
                  {filtered.length !== applicants.length && <span className="text-amber-400">필터 {filtered.length}명</span>}
                </div>
              </div>
              <button onClick={handleSave} disabled={!hasChanges || saving}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${hasChanges ? btnPrimary : btnGhost} disabled:opacity-50`}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                선정 저장
              </button>
            </div>

            {saveMsg && <div className={`mb-3 text-sm px-3 py-2 rounded-lg ${saveMsg.includes('완료') ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{saveMsg}</div>}

            {/* 숙소 적합도 요약 (네이버 전용) */}
            {!isInsta && accomStats && tab === 'ai' && (
              <div className={`grid grid-cols-2 md:grid-cols-5 gap-3 mb-4`}>
                {[
                  { label: '🏨 숙소 콘텐츠 보유', value: `${accomStats.hasAccom}명`, sub: `전체 ${accomStats.total}명 중` },
                  { label: '평균 적합도', value: `${accomStats.avgFit}점`, sub: `최고 ${accomStats.maxFit}점` },
                  { label: '총 숙소 포스팅', value: `${accomStats.totalPosts}건`, sub: null },
                  { label: '총 숙소 키워드', value: `${accomStats.totalKws}개`, sub: null },
                  { label: 'AI 가중치', value: '숙소 40%', sub: '방문자20 키워드10 좋아요10' },
                ].map((s, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${card}`}>
                    <div className={`text-[10px] mb-1 ${text2}`}>{s.label}</div>
                    <div className={`text-base font-bold ${text1}`}>{s.value}</div>
                    {s.sub && <div className={`text-[10px] ${text3}`}>{s.sub}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* 탭 전환 */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button onClick={() => setTab('ai')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'ai' ? tabActive : tabInactive}`}>
                <Bot size={15} /> AI 추천 선정
              </button>
              <button onClick={() => setTab('condition')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'condition' ? tabActive : tabInactive}`}>
                <SlidersHorizontal size={15} /> 조건 선정
              </button>
              <div className="flex-1" />
              <div className="relative w-52">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${text2}`} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임 / 블로그명 검색" className={`${inputCls} w-full pl-9`} />
              </div>
              <button onClick={selectAll} className={`px-3 py-1.5 rounded-lg text-xs transition ${btnGhost}`}>전체선택</button>
              <button onClick={deselectAll} className={`px-3 py-1.5 rounded-lg text-xs transition ${btnGhost}`}>전체해제</button>
            </div>

            {tab === 'condition' && (
              <ConditionFilters {...{ dark, isInsta, inputCls, card, text2, btnGhost, sortOptions: isInsta ? SORT_INSTA : SORT_NAVER, sortKey, setSortKey, sortDir, setSortDir, genderOpts, ageOpts, categoryOpts, adOpts, fGender, setFGender, fAge, setFAge, fCategory, setFCategory, fAdActivity, setFAdActivity, fMinVisitors, setFMinVisitors, fMinBlogScore, setFMinBlogScore, fMinTopKeyword, setFMinTopKeyword, fMinLikes, setFMinLikes, fMinFollowers, setFMinFollowers, fMinEngagement, setFMinEngagement, fMinInstaLikes, setFMinInstaLikes }} />
            )}

            {/* 테이블 */}
            {loading ? (
              <div className={`text-center py-20 ${text2}`}><Loader2 size={24} className="animate-spin mx-auto mb-2 opacity-50" />신청자 로딩 중...</div>
            ) : filtered.length === 0 ? (
              <div className={`text-center py-20 ${text2}`}><p className="text-lg mb-1">조건에 맞는 신청자가 없습니다</p></div>
            ) : (
              <div className={`border rounded-xl overflow-hidden ${card}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`${dark ? 'bg-[#1C1C2E]' : 'bg-gray-50'} ${text2}`}>
                        <th className="w-10 px-2 py-2.5 text-center"><Check size={14} className="mx-auto opacity-50" /></th>
                        <th className="w-8 px-1 py-2.5 text-center text-xs font-medium">#</th>
                        <th className="w-16 px-2 py-2.5 text-center text-xs font-medium">AI점수</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium min-w-[160px]">인플루언서</th>
                        {isInsta ? (
                          <>
                            <th className="text-right px-2 py-2.5 text-xs font-medium">팔로워</th>
                            <th className="text-right px-2 py-2.5 text-xs font-medium">참여율</th>
                            <th className="text-right px-2 py-2.5 text-xs font-medium">릴스평균</th>
                            <th className="text-right px-2 py-2.5 text-xs font-medium">릴스최고</th>
                          </>
                        ) : (
                          <>
                            <th className="text-right px-2 py-2.5 text-xs font-medium">방문자</th>
                            <th className="text-right px-2 py-2.5 text-xs font-medium">키워드</th>
                            <th className="text-right px-2 py-2.5 text-xs font-medium">좋아요</th>
                            <th className="text-center px-2 py-2.5 text-xs font-medium text-emerald-400">🏨적합</th>
                            <th className="text-center px-2 py-2.5 text-xs font-medium text-emerald-400">숙소글</th>
                            <th className="text-center px-2 py-2.5 text-xs font-medium text-emerald-400">숙소KW</th>
                            <th className="text-center px-2 py-2.5 text-xs font-medium">상위%</th>
                          </>
                        )}
                        <th className="w-8 px-2 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((app, idx) => (
                        <ApplicantRow key={app.id} app={app} raw={getRaw(app)} idx={idx}
                          selected={selections.has(app.id)} wasSelected={existingSelections.has(app.id)} isExpanded={expanded === app.id}
                          isInsta={isInsta} dark={dark} text1={text1} text2={text2} text3={text3} card={card}
                          onToggle={() => toggle(app.id)} onExpand={() => setExpanded(expanded === app.id ? null : app.id)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className={`mt-3 flex items-center justify-between text-xs ${text2}`}>
              <span>표시 {filtered.length} / 전체 {applicants.length}명</span>
              <span>선정 {selections.size}명</span>
            </div>

            {hasChanges && (
              <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border ${dark ? 'bg-[#232336] border-violet-500/30' : 'bg-white border-violet-300'}`}>
                <span className={`text-sm ${text1}`}>선정 {selections.size}명</span>
                <button onClick={handleSave} disabled={saving} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${btnPrimary} disabled:opacity-50`}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


/* ═══ 조건 필터 패널 ═══ */
function ConditionFilters({ dark, isInsta, inputCls, card, text2, btnGhost, sortOptions, sortKey, setSortKey, sortDir, setSortDir, genderOpts, ageOpts, categoryOpts, adOpts, fGender, setFGender, fAge, setFAge, fCategory, setFCategory, fAdActivity, setFAdActivity, fMinVisitors, setFMinVisitors, fMinBlogScore, setFMinBlogScore, fMinTopKeyword, setFMinTopKeyword, fMinLikes, setFMinLikes, fMinFollowers, setFMinFollowers, fMinEngagement, setFMinEngagement, fMinInstaLikes, setFMinInstaLikes }) {
  const lbl = `text-[11px] font-medium ${text2} mb-1 block`
  return (
    <div className={`p-4 rounded-xl border mb-4 ${card}`}>
      <div className={`flex items-center gap-1.5 mb-3 text-xs font-semibold ${text2}`}><Filter size={13} /> 조건 필터</div>
      {isInsta ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div><label className={lbl}>최소 팔로워</label><input type="number" value={fMinFollowers} onChange={e => setFMinFollowers(e.target.value)} placeholder="1000" className={`${inputCls} w-full`} /></div>
          <div><label className={lbl}>최소 참여율(%)</label><input type="number" step="0.1" value={fMinEngagement} onChange={e => setFMinEngagement(e.target.value)} placeholder="2.0" className={`${inputCls} w-full`} /></div>
          <div><label className={lbl}>성별</label><select value={fGender} onChange={e => setFGender(e.target.value)} className={`${inputCls} w-full`}>{genderOpts.map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className={lbl}>연령대</label><select value={fAge} onChange={e => setFAge(e.target.value)} className={`${inputCls} w-full`}>{ageOpts.map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className={lbl}>최소 평균좋아요</label><input type="number" value={fMinInstaLikes} onChange={e => setFMinInstaLikes(e.target.value)} placeholder="50" className={`${inputCls} w-full`} /></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className={lbl}>최소 방문자수</label><input type="number" value={fMinVisitors} onChange={e => setFMinVisitors(e.target.value)} placeholder="100" className={`${inputCls} w-full`} /></div>
          <div><label className={lbl}>최소 블로그스코어</label><input type="number" step="0.1" value={fMinBlogScore} onChange={e => setFMinBlogScore(e.target.value)} placeholder="2.0" className={`${inputCls} w-full`} /></div>
          <div><label className={lbl}>성별</label><select value={fGender} onChange={e => setFGender(e.target.value)} className={`${inputCls} w-full`}>{genderOpts.map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className={lbl}>연령대</label><select value={fAge} onChange={e => setFAge(e.target.value)} className={`${inputCls} w-full`}>{ageOpts.map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className={lbl}>카테고리</label><select value={fCategory} onChange={e => setFCategory(e.target.value)} className={`${inputCls} w-full`}>{categoryOpts.map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className={lbl}>광고활동성</label><select value={fAdActivity} onChange={e => setFAdActivity(e.target.value)} className={`${inputCls} w-full`}>{adOpts.map(o => <option key={o}>{o}</option>)}</select></div>
          <div><label className={lbl}>최소 상위키워드</label><input type="number" value={fMinTopKeyword} onChange={e => setFMinTopKeyword(e.target.value)} placeholder="3" className={`${inputCls} w-full`} /></div>
          <div><label className={lbl}>최소 평균좋아요</label><input type="number" value={fMinLikes} onChange={e => setFMinLikes(e.target.value)} placeholder="10" className={`${inputCls} w-full`} /></div>
        </div>
      )}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t" style={{ borderColor: dark ? '#2D2D44' : '#e5e7eb' }}>
        <span className={`text-[11px] font-medium ${text2}`}>정렬:</span>
        <select value={sortKey} onChange={e => setSortKey(e.target.value)} className={inputCls}>{sortOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
        <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${btnGhost}`}>
          <ArrowUpDown size={12} /> {sortDir === 'desc' ? '높은순' : '낮은순'}
        </button>
      </div>
    </div>
  )
}


/* ═══ 테이블 행 ═══ */
function ApplicantRow({ app, raw, idx, selected, wasSelected, isExpanded, isInsta, dark, text1, text2, text3, card, onToggle, onExpand }) {
  const modal = raw.blog_modal || {}
  const ac = getAccom(raw)
  const accomFit = raw.accomFit || 0
  const accomPct = ac.percentile || 0
  const rowBg = selected ? (dark ? 'bg-violet-500/5' : 'bg-violet-50') : (idx % 2 === 0 ? '' : (dark ? 'bg-[#1C1C2E]/50' : 'bg-gray-50/50'))
  const adColor = (v) => { if (!v) return text2; if (v === '낮음') return 'text-green-400'; if (v === '보통') return 'text-amber-400'; return 'text-red-400' }
  const grade = app.ai_score != null ? gradeLabel(app.ai_score) : null

  return (
    <>
      <tr className={`${rowBg} border-t ${dark ? 'border-[#2D2D44]' : 'border-gray-100'} transition-colors cursor-pointer`} onClick={onExpand}>
        <td className="px-2 py-2 text-center" onClick={e => e.stopPropagation()}>
          <button onClick={onToggle} className={`w-6 h-6 rounded flex items-center justify-center border transition ${selected ? 'bg-violet-600 border-violet-600 text-white' : dark ? 'border-[#3D3D55] text-transparent hover:border-violet-400' : 'border-gray-300 text-transparent hover:border-violet-400'}`}>
            <Check size={13} />
          </button>
        </td>
        <td className={`px-1 py-2 text-center text-xs font-mono ${text3}`}>{idx + 1}</td>
        <td className="px-2 py-2">
          <div className="flex flex-col items-center gap-0.5">
            <span className={`text-xs font-bold ${scoreText(app.ai_score)}`}>{app.ai_score != null ? Number(app.ai_score).toFixed(0) : '-'}</span>
            <div className={`w-12 h-1.5 rounded-full ${dark ? 'bg-[#2D2D44]' : 'bg-gray-200'}`}>
              <div className={`h-full rounded-full transition-all ${scoreColor(app.ai_score)}`} style={{ width: `${Math.min(100, app.ai_score || 0)}%` }} />
            </div>
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isInsta ? 'bg-pink-500/15 text-pink-400' : 'bg-green-500/15 text-green-400'}`}>
              {isInsta ? <Instagram size={14} /> : <BookOpen size={14} />}
            </div>
            <div className="min-w-0">
              <div className={`font-medium text-sm truncate flex items-center gap-1 flex-wrap ${text1}`}>
                {app.nickname || app.instagram_handle}
                {app.blog_score != null && !isInsta && (
                  <span className={`text-[10px] px-1 py-0.5 rounded ${app.blog_score >= 4 ? 'bg-green-500/20 text-green-400' : app.blog_score >= 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {Number(app.blog_score).toFixed(1)}
                  </span>
                )}
                {grade && <span className={`text-[9px] px-1 py-0.5 rounded ${grade.color}`}>{grade.icon}{grade.text}</span>}
                {app.is_duplicate && <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">중복</span>}
                {wasSelected && <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-400">선정</span>}
              </div>
              <div className={`text-[11px] truncate ${text3}`}>
                {isInsta ? (app.instagram_handle || '') : (app.media_name || raw.blogName || '')}
                {app.gender && ` · ${app.gender}`}{app.age && ` · ${app.age}`}
                {!isInsta && (app.category || raw.category) && ` · ${app.category || raw.category}`}
              </div>
            </div>
          </div>
        </td>

        {isInsta ? (
          <>
            <td className={`px-2 py-2 text-right text-sm ${text1}`}>{num(app.exact_followers)}</td>
            <td className="px-2 py-2 text-right">
              <span className={`text-sm font-medium ${(app.engagement_rate || 0) >= 3 ? 'text-green-400' : (app.engagement_rate || 0) >= 1.5 ? 'text-amber-400' : text2}`}>{pct(app.engagement_rate)}</span>
            </td>
            <td className={`px-2 py-2 text-right text-sm ${text1}`}>{num(raw.avgReelViews || raw.avg_reel_views)}</td>
            <td className={`px-2 py-2 text-right text-sm ${text1}`}>{num(raw.maxReelViews || raw.max_reel_views)}</td>
          </>
        ) : (
          <>
            <td className={`px-2 py-2 text-right text-sm font-medium ${text1}`}>{num(app.avg_visitors)}</td>
            <td className={`px-2 py-2 text-right text-sm ${text1}`}>
              <span className="font-bold text-violet-400">{app.top_keyword_count ?? raw.topKeywords ?? '-'}</span>
              <span className={`text-[10px] ${text3}`}>개</span>
            </td>
            <td className={`px-2 py-2 text-right text-sm ${text1}`}>{num(app.avg_likes || raw.avgLikes)}</td>
            {/* 숙소 적합도 */}
            <td className="px-2 py-2 text-center">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${accomFit >= 60 ? 'bg-green-500/20 text-green-400' : accomFit >= 30 ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {accomFit || '-'}
              </span>
            </td>
            {/* 숙소글 */}
            <td className={`px-2 py-2 text-center text-sm ${text1}`}>
              <span className="font-medium">{ac.accomPostCount || 0}</span>
              <span className={`text-[10px] ${text3}`}>/{ac.accomPostTotal || 0}</span>
            </td>
            {/* 숙소KW */}
            <td className={`px-2 py-2 text-center text-sm ${text1}`}>
              <span className="font-medium">{ac.accomKwCount || 0}</span>
              {(ac.accomKwTop5 || 0) > 0 && <span className={`text-[10px] text-emerald-400`}>(🔝{ac.accomKwTop5})</span>}
            </td>
            {/* 상위% */}
            <td className={`px-2 py-2 text-center text-xs font-medium ${accomPct <= 20 ? 'text-green-400' : accomPct <= 50 ? 'text-amber-400' : text3}`}>
              {accomPct > 0 ? `상위${accomPct}%` : '-'}
            </td>
          </>
        )}
        <td className={`px-2 py-2 ${text3}`}>{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
      </tr>

      {isExpanded && (
        <tr><td colSpan={isInsta ? 9 : 12} className="p-0">
          <DetailPanel app={app} raw={raw} modal={modal} ac={ac} accomFit={accomFit} isInsta={isInsta} dark={dark} text1={text1} text2={text2} text3={text3} card={card} />
        </td></tr>
      )}
    </>
  )
}


/* ═══ 확장 상세 패널 ═══ */
function DetailPanel({ app, raw, modal, ac, accomFit, isInsta, dark, text1, text2, text3, card }) {
  const panelBg = dark ? 'bg-[#1A1A2E]' : 'bg-gray-50'
  const miniCard = dark ? 'bg-[#232336] border-[#2D2D44]' : 'bg-white border-gray-200'
  const keywords = modal.top_keywords || raw.topKeywordList || raw.top_keywords || []
  const recentPosts = modal.recent_posts || raw.recentPosts || raw.recent_posts || []
  const aiReason = raw.aiReason || raw.blog_score_description || modal.blog_score_description || ''
  const bd = raw._bd || {}
  const WL = { blogScore: { e: '📊', s: '블로그스코어' }, visitors: { e: '👁️', s: '방문자' }, keywords: { e: '🔑', s: '키워드' }, likes: { e: '❤️', s: '좋아요' }, adActivity: { e: '📢', s: '광고' }, postFreq: { e: '📝', s: '빈도' }, accomFit: { e: '🏨', s: '숙소적합' },
    feedER: { e: '📱', s: '피드참여율' }, reelER: { e: '🎬', s: '릴스참여율' }, followers: { e: '👥', s: '팔로워' }, ffRatio: { e: '📊', s: '팔비' }, feedAvgLikes: { e: '❤️', s: '피드좋아요' }, reelAvgLikes: { e: '🎬', s: '릴스좋아요' }, avgReelViews: { e: '👁️', s: '릴스평균' }, maxReelViews: { e: '🏆', s: '릴스최고' } }
  const grade = app.ai_score != null ? gradeLabel(app.ai_score) : null

  // 숙소 키워드 패턴
  const ACCOM_RE = /호텔|펜션|리조트|숙소|에어비앤비|airbnb|풀빌라|글램핑|스테이|모텔|게하|게스트하우스|한옥|독채/i

  return (
    <div className={`p-4 ${panelBg} border-t ${dark ? 'border-[#2D2D44]' : 'border-gray-100'}`}>
      {/* AI 분석 코멘트 */}
      {aiReason && (
        <div className={`flex items-start gap-2 mb-4 p-3 rounded-lg border ${dark ? 'bg-violet-500/5 border-violet-500/20' : 'bg-violet-50 border-violet-200'}`}>
          <Bot size={16} className="text-violet-400 shrink-0 mt-0.5" />
          <div>
            {grade && <span className={`text-xs font-bold px-1.5 py-0.5 rounded mr-2 ${grade.color}`}>{grade.icon} {grade.text}</span>}
            <p className={`text-sm leading-relaxed ${text1} mt-1`}>{aiReason}</p>
          </div>
        </div>
      )}

      {/* 지표별 percentile 바 차트 */}
      {Object.keys(bd).length > 0 && (
        <div className={`grid gap-2 mb-4`} style={{ gridTemplateColumns: `repeat(${Math.min(Object.keys(bd).length, 8)}, 1fr)` }}>
          {Object.entries(bd).map(([k, v]) => {
            const wl = WL[k] || { e: '', s: k }
            return (
              <div key={k} className={`text-center p-2 rounded-lg border ${miniCard}`}>
                <div className={`text-[10px] ${text2} mb-1`}>{wl.e} {wl.s}</div>
                <div className={`w-full h-1.5 rounded-full mb-1 ${dark ? 'bg-[#2D2D44]' : 'bg-gray-200'}`}>
                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, v)}%` }} />
                </div>
                <div className={`text-sm font-bold ${text1}`}>{Math.round(v)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* 🏨 숙소 적합도 상세 (네이버) */}
      {!isInsta && accomFit > 0 && (
        <div className={`p-3 rounded-lg border mb-4 ${dark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className={`text-sm font-bold mb-2 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            🏨 숙소 적합도 — {accomFit}점 · {ac.percentile || 0}%ile
          </div>
          {/* 숙소 포스팅 */}
          {(ac.accomMatchedPosts || []).length > 0 ? (
            <div className="mb-3">
              <div className={`text-xs font-semibold mb-1 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>📝 숙소 콘텐츠 {ac.accomMatchedPosts.length}건 (전체의 {ac.accomPostRatio || 0}%)</div>
              {ac.accomMatchedPosts.slice(0, 5).map((p, i) => (
                <div key={i} className={`flex items-center justify-between py-1 border-b text-xs ${dark ? 'border-emerald-500/10' : 'border-emerald-200'}`}>
                  <span className={text1}>{p.title}</span>
                  <span className={text3}>❤️{p.likes || 0} 💬{p.comments || 0}</span>
                </div>
              ))}
            </div>
          ) : <div className={`text-xs mb-2 ${text3}`}>📝 숙소 관련 포스팅 없음</div>}

          {/* 숙소 키워드 */}
          {(ac.accomMatchedKws || []).length > 0 ? (
            <div>
              <div className={`text-xs font-semibold mb-1 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                🔍 숙소 키워드 {ac.accomMatchedKws.length}개 (상위노출 {ac.accomKwTop5 || 0}개, 검색량 {num(ac.accomKwVolume || 0)})
              </div>
              {ac.accomMatchedKws.map((kw, i) => (
                <div key={i} className={`flex items-center justify-between py-1 text-xs`}>
                  <span className={`font-medium ${text1}`}>{kw.keyword}</span>
                  <div className="flex gap-3">
                    <span className={text3}>검색량 {num(kw.volume || kw.search_volume || 0)}</span>
                    <span className={`font-bold ${(kw.rank || 99) <= 5 ? 'text-green-400' : (kw.rank || 99) <= 10 ? 'text-amber-400' : text3}`}>{kw.rank || '-'}위</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className={`text-xs ${text3}`}>🔍 숙소 관련 상위노출 키워드 없음</div>}
        </div>
      )}

      {/* 지표 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
        {isInsta ? (
          <>
            <MC label="팔로워" value={num(raw.followers || raw.exact_followers || app.exact_followers)} icon={<UsersIcon size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="게시물" value={num(raw.post_count || app.post_count)} icon={<FileText size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="피드참여율" value={pct(raw.feedER || raw.engagement_rate || app.engagement_rate)} icon={<TrendingUp size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="릴스참여율" value={pct(raw.reelER || raw.reel_engagement_rate)} icon={<TrendingUp size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="릴스평균조회" value={num(raw.avgReelViews || raw.avg_reel_views)} icon={<Eye size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="릴스최고조회" value={num(raw.maxReelViews || raw.max_reel_views)} icon={<Award size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="팔로워/팔로잉 비율" value={raw.ffRatio || '-'} icon={<UsersIcon size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="카테고리" value={raw.category || '-'} icon={<BookOpen size={13} />} {...{dark, text1, text2, miniCard}} />
          </>
        ) : (
          <>
            <MC label="블로그스코어" value={app.blog_score ?? '-'} icon={<Star size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="일평균방문자" value={num(app.avg_visitors)} icon={<Eye size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="이웃수" value={`${num(app.neighbors || raw.neighbors || modal.neighbors)} ${raw.neighborRank || ''}`} icon={<UsersIcon size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="평균좋아요" value={num(app.avg_likes || raw.avgLikes || modal.avg_likes)} icon={<Star size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="평균댓글" value={num(app.avg_comments || raw.avgComments || modal.avg_comments)} icon={<MessageCircle size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="주간포스팅" value={`${app.post_freq_7d ?? raw.postFreq7d ?? modal.post_freq_7d ?? '-'}회`} icon={<FileText size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="광고활동성" value={app.ad_activity || raw.adActivity || modal.ad_activity || '-'} icon={<Filter size={13} />} {...{dark, text1, text2, miniCard}}
              valueColor={(app.ad_activity || raw.adActivity || modal.ad_activity) === '낮음' ? 'text-green-400' : (app.ad_activity || raw.adActivity || modal.ad_activity) === '보통' ? 'text-amber-400' : (app.ad_activity || raw.adActivity || modal.ad_activity) ? 'text-red-400' : undefined} />
            <MC label="상위키워드" value={`${app.top_keyword_count ?? raw.topKeywords ?? modal.top_keyword_count ?? '-'}개`} icon={<TrendingUp size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="어제방문자" value={num(raw.yesterdayVisitors)} icon={<Eye size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="총방문자" value={num(raw.totalVisitors || modal.total_visitors)} icon={<UsersIcon size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="스크랩" value={num(raw.scraps || modal.scraps)} icon={<Star size={13} />} {...{dark, text1, text2, miniCard}} />
            <MC label="개설일" value={raw.openDate || modal.open_date || '-'} icon={<FileText size={13} />} {...{dark, text1, text2, miniCard}} />
          </>
        )}
      </div>

      {/* 키워드 리스트 */}
      {keywords.length > 0 && (
        <div className={`p-3 rounded-lg border mb-3 ${miniCard}`}>
          <div className={`text-xs font-semibold mb-2 ${text2}`}>상위 노출 키워드 ({keywords.length}개)</div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.slice(0, 20).map((kw, i) => {
              const kwText = kw.keyword || kw
              const isAccomKw = !isInsta && ACCOM_RE.test(kwText)
              return (
                <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${isAccomKw ? (dark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700') : (dark ? 'bg-[#2D2D44] text-gray-300' : 'bg-gray-100 text-gray-700')}`}>
                  {kw.rank != null && <span className={`font-bold ${kw.rank <= 3 ? 'text-green-400' : kw.rank <= 10 ? 'text-amber-400' : text3}`}>#{kw.rank}</span>}
                  <span>{kwText}</span>
                  {isAccomKw && <span className="text-[9px]">🏨</span>}
                  {(kw.search_volume || kw.volume) != null && <span className={text3}>({num(kw.search_volume || kw.volume)})</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* 최근 포스트 */}
      {recentPosts.length > 0 && (
        <div className={`p-3 rounded-lg border ${miniCard}`}>
          <div className={`text-xs font-semibold mb-2 ${text2}`}>최근 포스트 ({recentPosts.length}개)</div>
          <div className="space-y-1.5">
            {recentPosts.slice(0, 8).map((post, i) => {
              const title = post.title || ''
              const isAccomPost = !isInsta && ACCOM_RE.test(title)
              return (
                <div key={i} className={`flex items-center gap-2 text-xs py-1 ${isAccomPost ? (dark ? 'bg-emerald-500/5 rounded px-1' : 'bg-emerald-50 rounded px-1') : ''} ${text1}`}>
                  <span className={text3}>{post.date}</span>
                  <span className="truncate flex-1">{title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {post.topExposure && <span className="px-1 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">상위</span>}
                    {post.is_top_exposed && <span className="px-1 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">상위</span>}
                    {(post.smartBlock || post.is_smart_block) && <span className="px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">스마트</span>}
                    {isAccomPost && <span className="px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">🏨숙소</span>}
                    <span className={text3}>{post.likes}좋</span>
                    <span className={text3}>{post.comments}댓</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(app.media_url || app.instagram_url || raw.blogUrl) && (
        <a href={app.media_url || app.instagram_url || raw.blogUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-xs text-violet-400 hover:underline">
          <ExternalLink size={12} /> 프로필 보기
        </a>
      )}
    </div>
  )
}

function MC({ label, value, icon, dark, text1, text2, miniCard, valueColor }) {
  return (
    <div className={`p-2.5 rounded-lg border ${miniCard}`}>
      <div className={`flex items-center gap-1 text-[10px] ${text2} mb-1`}>{icon} {label}</div>
      <div className={`text-sm font-semibold ${valueColor || text1}`}>{value}</div>
    </div>
  )
}
