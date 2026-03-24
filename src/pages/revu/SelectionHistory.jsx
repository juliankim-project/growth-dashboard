/**
 * 체험단 > 선정 이력
 * ─────────────────────────────────
 * 전체 캠페인의 선정 내역을 시간순으로 조회
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Clock, User, Instagram, BookOpen, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

const num = (v) => v == null ? '-' : Number(v).toLocaleString()
const fmt = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function SelectionHistory({ dark }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState('campaign') // campaign | date

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('revu_selections')
        .select(`
          *,
          campaign:revu_campaigns(campaign_id, campaign_title, platform),
          applicant:revu_applicants(nickname, instagram_handle, media_name, ai_score, avg_visitors, exact_followers, media_url, instagram_url, gender, age)
        `)
        .order('selected_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setRows(data || [])
    } catch (e) {
      console.error('이력 로드 실패:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  /* ── 캠페인별 그룹핑 ── */
  const grouped = rows.reduce((acc, r) => {
    const key = groupBy === 'campaign'
      ? `${r.campaign?.campaign_id || r.campaign_pk}`
      : fmt(r.selected_at).split(' ')[0]
    if (!acc[key]) acc[key] = { label: groupBy === 'campaign' ? (r.campaign?.campaign_title || `캠페인 ${r.campaign_pk}`) : key, platform: r.campaign?.platform, items: [] }
    acc[key].items.push(r)
    return acc
  }, {})

  const text1 = dark ? 'text-gray-100' : 'text-gray-900'
  const text2 = dark ? 'text-gray-400' : 'text-gray-500'
  const card = dark ? 'bg-[#232336] border-[#2D2D44]' : 'bg-white border-gray-200'
  const btnGhost = dark ? 'bg-[#2D2D44] text-gray-300 hover:bg-[#363650]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className={`text-xl font-bold ${text1}`}>선정 이력</h1>
        <div className="flex items-center gap-2">
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
            className={`rounded-lg px-3 py-1.5 text-sm border outline-none ${dark ? 'bg-[#1C1C2E] border-[#2D2D44] text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}>
            <option value="campaign">캠페인별</option>
            <option value="date">날짜별</option>
          </select>
          <button onClick={load} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${btnGhost}`}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>
      </div>

      {loading ? (
        <div className={`text-center py-20 ${text2}`}>로딩 중...</div>
      ) : rows.length === 0 ? (
        <div className={`text-center py-20 ${text2}`}>
          <p className="text-lg mb-2">선정 이력이 없습니다</p>
          <p className="text-sm">캠페인에서 인플루언서를 선정하면 여기에 기록됩니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([key, group]) => (
            <GroupCard key={key} group={group} dark={dark} text1={text1} text2={text2} card={card} />
          ))}
        </div>
      )}

      <div className={`mt-6 text-xs ${text2}`}>
        전체 {rows.length}건 (최근 500건)
      </div>
    </div>
  )
}

function GroupCard({ group, dark, text1, text2, card }) {
  const [open, setOpen] = useState(true)
  const isInsta = group.platform === 'instagram'

  return (
    <div className={`border rounded-xl overflow-hidden ${card}`}>
      <button onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between p-4 text-left`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isInsta ? 'bg-pink-500/15 text-pink-400' : 'bg-green-500/15 text-green-400'}`}>
            {isInsta ? <Instagram size={16} /> : <BookOpen size={16} />}
          </div>
          <div>
            <div className={`font-semibold ${text1}`}>{group.label}</div>
            <div className={`text-xs ${text2}`}>{group.items.length}명 선정</div>
          </div>
        </div>
        {open ? <ChevronUp size={16} className={text2} /> : <ChevronDown size={16} className={text2} />}
      </button>

      {open && (
        <div className={`border-t ${dark ? 'border-[#2D2D44]' : 'border-gray-100'}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={text2}>
                <th className="text-left px-4 py-2 font-medium text-xs">닉네임</th>
                <th className="text-left px-4 py-2 font-medium text-xs">성별/연령</th>
                <th className="text-right px-4 py-2 font-medium text-xs">AI점수</th>
                <th className="text-right px-4 py-2 font-medium text-xs">{isInsta ? '팔로워' : '방문자'}</th>
                <th className="text-left px-4 py-2 font-medium text-xs">선정자</th>
                <th className="text-left px-4 py-2 font-medium text-xs">선정일시</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {group.items.map(r => {
                const app = r.applicant || {}
                return (
                  <tr key={r.id} className={`border-t ${dark ? 'border-[#2D2D44]' : 'border-gray-50'}`}>
                    <td className={`px-4 py-2 font-medium ${text1}`}>{app.nickname || app.instagram_handle || '-'}</td>
                    <td className={`px-4 py-2 ${text2}`}>{[app.gender, app.age].filter(Boolean).join(' · ') || '-'}</td>
                    <td className={`px-4 py-2 text-right font-medium ${r.ai_score_at_selection >= 70 ? 'text-green-400' : r.ai_score_at_selection >= 40 ? 'text-amber-400' : text2}`}>
                      {r.ai_score_at_selection != null ? Number(r.ai_score_at_selection).toFixed(1) : '-'}
                    </td>
                    <td className={`px-4 py-2 text-right ${text1}`}>
                      {num(isInsta ? app.exact_followers : app.avg_visitors)}
                    </td>
                    <td className={`px-4 py-2 ${text2}`}>{(r.selected_by || '').split('@')[0]}</td>
                    <td className={`px-4 py-2 ${text2}`}>{fmt(r.selected_at)}</td>
                    <td className="px-4 py-2">
                      {(app.media_url || app.instagram_url) && (
                        <a href={app.media_url || app.instagram_url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
