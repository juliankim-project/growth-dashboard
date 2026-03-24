/**
 * 체험단 > 신청자 리스트 + 선정 UI
 * ──────────────────────────────────
 * sessionStorage 에서 선택된 캠페인 정보 읽음
 * revu_applicants 테이블 조회 → 필터/정렬 → 체크박스 선정 → revu_selections INSERT
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft, Search, Check, CheckCircle, X, ChevronDown, ChevronUp,
  Instagram, BookOpen, Star, Users as UsersIcon, ExternalLink,
  Filter, ArrowUpDown, Save, Loader2
} from 'lucide-react'

/* ── 유틸 ── */
const num = (v) => v == null ? '-' : Number(v).toLocaleString()
const pct = (v) => v == null ? '-' : `${Number(v).toFixed(1)}%`

export default function Applicants({ dark, nav, setNav, user }) {
  /* ── 캠페인 컨텍스트 ── */
  const [campaign, setCampaign] = useState(null)
  const [applicants, setApplicants] = useState([])
  const [selections, setSelections] = useState(new Set())   // applicant id set
  const [existingSelections, setExistingSelections] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  /* ── 필터/정렬 ── */
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('ai_score')
  const [sortDir, setSortDir] = useState('desc')
  const [filterGender, setFilterGender] = useState('전체')
  const [filterAge, setFilterAge] = useState('전체')
  const [showFilters, setShowFilters] = useState(false)
  const [expanded, setExpanded] = useState(null)

  /* ── 초기 로드 ── */
  useEffect(() => {
    const raw = sessionStorage.getItem('revu_selected_campaign')
    if (!raw) return
    const c = JSON.parse(raw)
    setCampaign(c)
    loadData(c.pk)
  }, [])

  const loadData = async (pk) => {
    setLoading(true)
    try {
      // 신청자
      const { data: apps } = await supabase
        .from('revu_applicants')
        .select('*')
        .eq('campaign_pk', pk)
        .order('ai_score', { ascending: false, nullsFirst: false })
      setApplicants(apps || [])

      // 기존 선정
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
    if (filterGender !== '전체') list = list.filter(a => a.gender === filterGender)
    if (filterAge !== '전체') list = list.filter(a => a.age === filterAge)

    list.sort((a, b) => {
      const va = a[sortKey] ?? -Infinity
      const vb = b[sortKey] ?? -Infinity
      return sortDir === 'desc' ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1)
    })
    return list
  }, [applicants, search, filterGender, filterAge, sortKey, sortDir])

  /* ── 유니크 옵션 ── */
  const genderOpts = useMemo(() => ['전체', ...new Set(applicants.map(a => a.gender).filter(Boolean))], [applicants])
  const ageOpts = useMemo(() => ['전체', ...new Set(applicants.map(a => a.age).filter(Boolean))], [applicants])

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
      // 새로 추가할 항목
      const toAdd = [...selections].filter(id => !existingSelections.has(id))
      // 제거할 항목
      const toRemove = [...existingSelections].filter(id => !selections.has(id))

      const email = user?.email || 'unknown'

      // 추가
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

      // 제거
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('revu_selections')
          .delete()
          .eq('campaign_pk', campaign.pk)
          .in('applicant_pk', toRemove)
        if (error) throw error
      }

      setExistingSelections(new Set(selections))
      setSaveMsg(`✅ 저장 완료! +${toAdd.length} / -${toRemove.length}`)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (e) {
      console.error('저장 실패:', e)
      setSaveMsg(`❌ 저장 실패: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = useMemo(() => {
    if (selections.size !== existingSelections.size) return true
    for (const id of selections) if (!existingSelections.has(id)) return true
    return false
  }, [selections, existingSelections])

  /* ── 스타일 ── */
  const card = dark ? 'bg-[#232336] border-[#2D2D44]' : 'bg-white border-gray-200'
  const text1 = dark ? 'text-gray-100' : 'text-gray-900'
  const text2 = dark ? 'text-gray-400' : 'text-gray-500'
  const inputCls = `w-full rounded-lg px-3 py-2 text-sm border outline-none transition ${dark ? 'bg-[#1C1C2E] border-[#2D2D44] text-gray-200 placeholder-gray-500 focus:border-violet-500' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-violet-500'}`
  const btnPrimary = 'bg-violet-600 hover:bg-violet-700 text-white'
  const btnGhost = dark ? 'bg-[#2D2D44] text-gray-300 hover:bg-[#363650]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  const isInsta = campaign?.platform === 'instagram'

  if (!campaign) return <div className={`p-6 text-center ${text2}`}>캠페인을 선택해주세요</div>

  /* ── 확장 상세 (raw_data JSON 파싱) ── */
  const DetailPanel = ({ app }) => {
    const raw = app.raw_data ? (typeof app.raw_data === 'string' ? JSON.parse(app.raw_data) : app.raw_data) : {}
    const modal = raw.blog_modal || {}
    const keywords = modal.top_keywords || raw.top_keywords || []

    return (
      <div className={`p-4 border-t ${dark ? 'border-[#2D2D44] bg-[#1C1C2E]' : 'border-gray-100 bg-gray-50'} text-sm`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isInsta ? (
            <>
              <Stat label="팔로워" value={num(raw.exact_followers || app.exact_followers)} />
              <Stat label="게시물" value={num(raw.post_count || app.post_count)} />
              <Stat label="참여율" value={pct(raw.engagement_rate || app.engagement_rate)} />
              <Stat label="평균좋아요" value={num(raw.avg_likes || app.avg_insta_likes)} />
              <Stat label="릴스평균조회" value={num(raw.avg_reel_views)} />
              <Stat label="릴스최고조회" value={num(raw.max_reel_views)} />
              <Stat label="팔로워비율" value={raw.ff_ratio != null ? `${raw.ff_ratio}:1` : '-'} />
            </>
          ) : (
            <>
              <Stat label="블로그스코어" value={app.blog_score ?? '-'} />
              <Stat label="일평균방문자" value={num(app.avg_visitors)} />
              <Stat label="이웃수" value={num(app.neighbors)} />
              <Stat label="평균좋아요" value={num(app.avg_likes)} />
              <Stat label="광고활동성" value={app.ad_activity || '-'} />
              <Stat label="주간포스팅" value={app.post_freq_7d ?? '-'} />
              <Stat label="상위키워드" value={app.top_keyword_count ?? '-'} />
              <Stat label="카테고리" value={app.category || '-'} />
            </>
          )}
        </div>
        {keywords.length > 0 && (
          <div className="mt-3">
            <span className={`text-xs font-medium ${text2}`}>키워드:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {keywords.slice(0, 10).map((kw, i) => (
                <span key={i} className={`px-2 py-0.5 rounded text-xs ${dark ? 'bg-[#2D2D44] text-gray-300' : 'bg-gray-200 text-gray-700'}`}>
                  {kw.keyword || kw} ({num(kw.search_volume)})
                </span>
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

  const Stat = ({ label, value }) => (
    <div>
      <div className={`text-[10px] ${text2}`}>{label}</div>
      <div className={`font-medium ${text1}`}>{value}</div>
    </div>
  )

  /* ── 정렬 옵션 ── */
  const sortOptions = isInsta
    ? [
        { key: 'ai_score', label: 'AI점수' },
        { key: 'exact_followers', label: '팔로워' },
        { key: 'engagement_rate', label: '참여율' },
      ]
    : [
        { key: 'ai_score', label: 'AI점수' },
        { key: 'avg_visitors', label: '방문자' },
        { key: 'blog_score', label: '블로그스코어' },
        { key: 'avg_likes', label: '좋아요' },
        { key: 'top_keyword_count', label: '키워드수' },
      ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── 헤더 ── */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setNav({ section: 'revu', sub: 'campaigns', l3sub: null })}
          className={`p-1.5 rounded-lg transition ${btnGhost}`}>
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className={`text-lg font-bold truncate ${text1}`}>{campaign.title || `캠페인 ${campaign.campaign_id}`}</h1>
          <div className={`flex items-center gap-2 text-xs ${text2}`}>
            <span className={`px-1.5 py-0.5 rounded font-medium ${isInsta ? 'bg-pink-500/20 text-pink-300' : 'bg-green-500/20 text-green-300'}`}>
              {isInsta ? 'Instagram' : 'Naver'}
            </span>
            <span>전체 {applicants.length}명</span>
            <span>|</span>
            <span className="text-violet-400 font-medium">선정 {selections.size}명</span>
          </div>
        </div>
        {/* 저장 버튼 */}
        <button onClick={handleSave} disabled={!hasChanges || saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${hasChanges ? btnPrimary : btnGhost} disabled:opacity-50`}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          선정 저장
        </button>
      </div>
      {saveMsg && <div className={`mb-3 text-sm px-3 py-2 rounded-lg ${saveMsg.startsWith('✅') ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{saveMsg}</div>}

      {/* ── 검색 & 필터 ── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${text2}`} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임 / 블로그명 / 핸들 검색"
            className={`${inputCls} pl-9`} />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition ${btnGhost}`}>
          <Filter size={14} /> 필터
        </button>
        <button onClick={selectAll} className={`px-3 py-2 rounded-lg text-sm transition ${btnGhost}`}>전체선택</button>
        <button onClick={deselectAll} className={`px-3 py-2 rounded-lg text-sm transition ${btnGhost}`}>전체해제</button>
      </div>

      {showFilters && (
        <div className={`flex items-center gap-3 mb-3 p-3 rounded-lg border ${card}`}>
          <label className={`text-xs ${text2}`}>성별</label>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className={`${inputCls} w-24`}>
            {genderOpts.map(o => <option key={o}>{o}</option>)}
          </select>
          <label className={`text-xs ${text2}`}>연령</label>
          <select value={filterAge} onChange={e => setFilterAge(e.target.value)} className={`${inputCls} w-24`}>
            {ageOpts.map(o => <option key={o}>{o}</option>)}
          </select>
          <label className={`text-xs ${text2}`}>정렬</label>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)} className={`${inputCls} w-32`}>
            {sortOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} className={`p-1.5 rounded transition ${btnGhost}`}>
            <ArrowUpDown size={14} />
          </button>
        </div>
      )}

      {/* ── 리스트 ── */}
      {loading ? (
        <div className={`text-center py-20 ${text2}`}>로딩 중...</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((app, idx) => {
            const selected = selections.has(app.id)
            const wasSelected = existingSelections.has(app.id)
            const isExpanded = expanded === app.id
            return (
              <div key={app.id} className={`border rounded-xl overflow-hidden transition ${selected ? (dark ? 'border-violet-500/50 bg-violet-500/5' : 'border-violet-400 bg-violet-50') : card}`}>
                <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : app.id)}>
                  {/* 체크박스 */}
                  <button onClick={(e) => { e.stopPropagation(); toggle(app.id) }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition ${selected ? 'bg-violet-600 border-violet-600 text-white' : dark ? 'border-[#3D3D55] text-transparent hover:border-violet-400' : 'border-gray-300 text-transparent hover:border-violet-400'}`}>
                    <Check size={14} />
                  </button>

                  {/* 순위 */}
                  <span className={`text-xs font-mono w-6 text-center shrink-0 ${text2}`}>{idx + 1}</span>

                  {/* 아이콘 */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isInsta ? 'bg-pink-500/15 text-pink-400' : 'bg-green-500/15 text-green-400'}`}>
                    {isInsta ? <Instagram size={16} /> : <BookOpen size={16} />}
                  </div>

                  {/* 이름 */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate text-sm ${text1}`}>
                      {app.nickname || app.instagram_handle}
                      {app.is_picked && <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">추천</span>}
                      {wasSelected && <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-400">선정됨</span>}
                    </div>
                    <div className={`text-xs truncate ${text2}`}>
                      {isInsta ? (app.instagram_handle || '') : (app.media_name || '')}
                      {app.gender && ` · ${app.gender}`}{app.age && ` · ${app.age}`}
                    </div>
                  </div>

                  {/* 주요 지표 */}
                  <div className="flex items-center gap-4 shrink-0">
                    {app.ai_score != null && (
                      <div className="text-center">
                        <div className={`text-sm font-bold ${app.ai_score >= 70 ? 'text-green-400' : app.ai_score >= 40 ? 'text-amber-400' : text2}`}>
                          {Number(app.ai_score).toFixed(1)}
                        </div>
                        <div className={`text-[9px] ${text2}`}>AI점수</div>
                      </div>
                    )}
                    {!isInsta && app.avg_visitors != null && (
                      <div className="text-center">
                        <div className={`text-sm font-medium ${text1}`}>{num(app.avg_visitors)}</div>
                        <div className={`text-[9px] ${text2}`}>방문자</div>
                      </div>
                    )}
                    {isInsta && app.exact_followers != null && (
                      <div className="text-center">
                        <div className={`text-sm font-medium ${text1}`}>{num(app.exact_followers)}</div>
                        <div className={`text-[9px] ${text2}`}>팔로워</div>
                      </div>
                    )}
                    <div className={`transition ${text2}`}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {isExpanded && <DetailPanel app={app} />}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 하단 고정 바 ── */}
      {hasChanges && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border ${dark ? 'bg-[#232336] border-violet-500/30' : 'bg-white border-violet-300'}`}>
          <span className={`text-sm ${text1}`}>선정 {selections.size}명 (변경사항 있음)</span>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${btnPrimary} disabled:opacity-50`}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            저장
          </button>
        </div>
      )}
    </div>
  )
}
