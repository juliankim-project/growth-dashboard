import { useState, useEffect, useCallback } from 'react'
import { mcpCheckAuth, mcpQuery, MCPAuthRequiredError } from '../../lib/mcpClient'
import { supabase } from '../../lib/supabase'
import { CheckCircle2, AlertCircle, Download, RefreshCw, Wifi, WifiOff, Trash2, Database } from 'lucide-react'

/* ─── MCP → Supabase 컬럼 매핑 ─── */
function mapRow(r) {
  return {
    date: r.date,
    event: r.event,
    branch_name: r.b_name,
    branch_brand: r.b_brand,
    branch_category1: r.b_category1,
    branch_category2: r.b_category2,
    branch_location: r.b_location,
    channel_name: r.c_name,
    channel_category1: r.c_category1,
    channel_category2: r.c_category2,
    channel_category3: r.c_category3,
    roomtype_name: r.rt_name,
    roomtype_type: r.rt_type,
    rn: r.rn, rv: r.rv, lt: r.lt,
    pk_rn: r.pk_rn, pk_rv: r.pk_rv, pk_lt: r.pk_lt, pk_cnt: r.pk_cnt,
    ci_rn: r.ci_rn, ci_rv: r.ci_rv, ci_lt: r.ci_lt, ci_cnt: r.ci_cnt,
    oc_rn: r.oc_rn, oc_rv: r.oc_rv, oc_lt: r.oc_lt, oc_cnt: r.oc_cnt,
    co_rn: r.co_rn, co_rv: r.co_rv, co_lt: r.co_lt, co_cnt: r.co_cnt,
    reservation_no: r.no,
    branch_id: r.branchId,
    channel_id: r.channelId,
    roomtype_id: r.roomtypeId,
    reserved_at: r.reservedAt,
    canceled_at: r.canceledAt,
    check_in: r.checkIn ? r.checkIn.split(' ')[0] : null,
    check_out: r.checkOut ? r.checkOut.split(' ')[0] : null,
    is_sales: r.isSales,
  }
}

/* ─── 날짜 헬퍼 ─── */
function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function daysBetween(start, end) {
  return Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const fmtNum = v => v == null ? '—' : Math.round(v).toLocaleString()

/* ─── 메인 컴포넌트 ─── */
export default function MCPImportSection({ dark }) {
  const [authStatus, setAuthStatus] = useState(null) // null=loading, 'ok', 'need_auth'
  const [authUrl, setAuthUrl] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ step: '', pct: 0, detail: '' })
  const [result, setResult] = useState(null) // { success, count, error }
  const [tableInfo, setTableInfo] = useState(null) // { count, minDate, maxDate }
  const [lastSync, setLastSync] = useState(null)

  const t = dark
    ? { card: 'bg-[#22272B]', border: 'border-[#A1BDD914]', text: 'text-white', sub: 'text-slate-400', muted: 'text-slate-500',
        input: 'bg-[#2C333A] border-[#A1BDD914] text-white', inputFocus: 'focus:border-blue-500' }
    : { card: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', sub: 'text-slate-600', muted: 'text-slate-400',
        input: 'bg-white border-slate-200 text-slate-800', inputFocus: 'focus:border-blue-500' }

  /* ── 인증 상태 확인 ── */
  const checkAuth = useCallback(async () => {
    try {
      const res = await mcpCheckAuth()
      if (res.authenticated) {
        setAuthStatus('ok')
      } else {
        setAuthStatus('need_auth')
        setAuthUrl(res.authUrl || '')
      }
    } catch (e) {
      if (e instanceof MCPAuthRequiredError) {
        setAuthStatus('need_auth')
        setAuthUrl(e.authUrl)
      } else {
        setAuthStatus('error')
      }
    }
  }, [])

  /* ── 테이블 현황 조회 ── */
  const loadTableInfo = useCallback(async () => {
    if (!supabase) return
    try {
      const { count } = await supabase
        .from('mcp_reservation')
        .select('*', { count: 'exact', head: true })
      const { data: minMax } = await supabase
        .from('mcp_reservation')
        .select('date')
        .order('date', { ascending: true })
        .limit(1)
      const { data: maxRow } = await supabase
        .from('mcp_reservation')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
      setTableInfo({
        count: count || 0,
        minDate: minMax?.[0]?.date || null,
        maxDate: maxRow?.[0]?.date || null,
      })
    } catch {
      setTableInfo({ count: 0, minDate: null, maxDate: null })
    }
  }, [])

  useEffect(() => {
    checkAuth()
    loadTableInfo()
    const saved = localStorage.getItem('mcp_last_sync')
    if (saved) setLastSync(saved)
  }, [])

  /* ── 날짜 기본값: 최근 7일 ── */
  useEffect(() => {
    if (!startDate) {
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(today.getDate() - 7)
      setEndDate(today.toISOString().split('T')[0])
      setStartDate(weekAgo.toISOString().split('T')[0])
    }
  }, [])

  /* ── 데이터 가져오기 실행 ── */
  const handleImport = async () => {
    if (!startDate || !endDate || importing) return
    setImporting(true)
    setResult(null)
    setProgress({ step: 'MCP 데이터 조회 중...', pct: 5, detail: '' })

    try {
      /* Step 1: MCP에서 데이터 가져오기 (날짜별 분할) */
      const totalDays = daysBetween(startDate, endDate)
      const allRows = []
      const CHUNK_DAYS = totalDays > 60 ? 7 : totalDays > 14 ? 3 : totalDays // 대량이면 분할
      let currentStart = startDate

      while (currentStart <= endDate) {
        const currentEnd = currentStart === endDate
          ? endDate
          : (() => {
              const ce = addDays(currentStart, CHUNK_DAYS - 1)
              return ce > endDate ? endDate : ce
            })()

        setProgress({
          step: 'MCP 데이터 조회 중...',
          pct: Math.min(5 + (allRows.length > 0 ? 30 : 10), 40),
          detail: `${currentStart} ~ ${currentEnd}`,
        })

        const sql = `SELECT * FROM fact_reservation_event WHERE date >= '${currentStart}' AND date <= '${currentEnd}'`
        const res = await mcpQuery(sql, undefined, { limit: 100000 })

        if (res?.rows) {
          allRows.push(...res.rows)
        } else if (Array.isArray(res)) {
          allRows.push(...res)
        }

        if (currentEnd >= endDate) break
        currentStart = addDays(currentEnd, 1)
      }

      if (allRows.length === 0) {
        setResult({ success: true, count: 0, error: null })
        setImporting(false)
        return
      }

      setProgress({ step: '데이터 매핑 중...', pct: 45, detail: `${fmtNum(allRows.length)}건` })

      /* Step 2: 매핑 */
      const mapped = allRows.map(mapRow)

      /* Step 3: 기존 데이터 삭제 (날짜 범위) */
      setProgress({ step: '기존 데이터 삭제 중...', pct: 50, detail: `${startDate} ~ ${endDate}` })
      const { error: delErr } = await supabase
        .from('mcp_reservation')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate)
      if (delErr) throw new Error(`삭제 실패: ${delErr.message}`)

      /* Step 4: 배치 삽입 */
      const BATCH = 500
      let inserted = 0
      for (let i = 0; i < mapped.length; i += BATCH) {
        const batch = mapped.slice(i, i + BATCH)
        const { error: insErr } = await supabase
          .from('mcp_reservation')
          .insert(batch)
        if (insErr) throw new Error(`삽입 실패 (${inserted}건 처리 후): ${insErr.message}`)
        inserted += batch.length
        setProgress({
          step: 'Supabase 적재 중...',
          pct: 55 + Math.round((inserted / mapped.length) * 40),
          detail: `${fmtNum(inserted)} / ${fmtNum(mapped.length)}건`,
        })
      }

      setProgress({ step: '완료!', pct: 100, detail: `총 ${fmtNum(inserted)}건 적재` })
      setResult({ success: true, count: inserted, error: null })

      const syncTime = new Date().toISOString()
      setLastSync(syncTime)
      localStorage.setItem('mcp_last_sync', syncTime)
      loadTableInfo()

    } catch (e) {
      if (e instanceof MCPAuthRequiredError) {
        setAuthStatus('need_auth')
        setAuthUrl(e.authUrl)
        setResult({ success: false, count: 0, error: 'MCP 인증이 필요합니다' })
      } else {
        setResult({ success: false, count: 0, error: e.message })
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* ── 인증 상태 ── */}
      <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {authStatus === 'ok' ? (
              <><Wifi size={14} className="text-emerald-500" />
                <span className={`text-xs font-medium text-emerald-500`}>MCP 연결됨</span></>
            ) : authStatus === 'need_auth' ? (
              <><WifiOff size={14} className="text-amber-500" />
                <span className={`text-xs font-medium text-amber-500`}>인증 필요</span></>
            ) : authStatus === 'error' ? (
              <><AlertCircle size={14} className="text-red-500" />
                <span className={`text-xs font-medium text-red-500`}>연결 오류</span></>
            ) : (
              <><RefreshCw size={14} className={`animate-spin ${t.muted}`} />
                <span className={`text-xs ${t.muted}`}>확인 중...</span></>
            )}
          </div>
          <div className="flex items-center gap-2">
            {authStatus === 'need_auth' && authUrl && (
              <a href={authUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-2.5 py-1 rounded bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors">
                인증하기
              </a>
            )}
            <button onClick={checkAuth}
              className={`text-[11px] px-2 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* ── 가져오기 설정 ── */}
      <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
        <h3 className={`text-xs font-semibold mb-2.5 ${t.text}`}>📥 데이터 가져오기</h3>
        <div className="flex items-end gap-2.5 flex-wrap">
          <div>
            <label className={`text-[10px] block mb-0.5 ${t.muted}`}>시작일</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className={`text-xs rounded-lg px-2.5 py-1.5 border outline-none ${t.input} ${t.inputFocus}`} />
          </div>
          <span className={`text-xs pb-1.5 ${t.muted}`}>~</span>
          <div>
            <label className={`text-[10px] block mb-0.5 ${t.muted}`}>종료일</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className={`text-xs rounded-lg px-2.5 py-1.5 border outline-none ${t.input} ${t.inputFocus}`} />
          </div>
          <button
            onClick={handleImport}
            disabled={importing || authStatus !== 'ok' || !startDate || !endDate}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${importing || authStatus !== 'ok'
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
            {importing ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            {importing ? '가져오는 중...' : '가져오기'}
          </button>
        </div>
        {startDate && endDate && (
          <div className={`mt-2 text-[10px] ${t.muted}`}>
            {daysBetween(startDate, endDate)}일간 데이터 조회 · 기존 데이터는 해당 날짜 범위 내 덮어쓰기
          </div>
        )}
      </div>

      {/* ── 진행 상태 ── */}
      {(importing || result) && (
        <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
          {importing && (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium ${t.text}`}>{progress.step}</span>
                <span className={`text-[11px] font-bold ${t.text}`}>{progress.pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200/20 overflow-hidden mb-1">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                  style={{ width: `${progress.pct}%` }} />
              </div>
              {progress.detail && <div className={`text-[10px] ${t.muted}`}>{progress.detail}</div>}
            </>
          )}
          {result && !importing && (
            <div className="flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className={`text-xs font-medium text-emerald-500`}>
                    {result.count > 0 ? `${fmtNum(result.count)}건 적재 완료` : '해당 기간 데이터 없음'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="text-red-500" />
                  <span className="text-xs text-red-500">{result.error}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 현재 데이터 요약 ── */}
      <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
        <div className="flex items-center gap-2 mb-2">
          <Database size={13} className={t.muted} />
          <h3 className={`text-xs font-semibold ${t.text}`}>mcp_reservation 테이블 현황</h3>
          <button onClick={loadTableInfo}
            className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            갱신
          </button>
        </div>
        {tableInfo ? (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className={`text-[10px] ${t.muted}`}>총 레코드</div>
              <div className={`text-sm font-bold ${t.text}`}>{fmtNum(tableInfo.count)}건</div>
            </div>
            <div>
              <div className={`text-[10px] ${t.muted}`}>데이터 기간</div>
              <div className={`text-xs font-medium ${t.text}`}>
                {tableInfo.minDate && tableInfo.maxDate
                  ? `${formatDate(tableInfo.minDate)} ~ ${formatDate(tableInfo.maxDate)}`
                  : '데이터 없음'}
              </div>
            </div>
            <div>
              <div className={`text-[10px] ${t.muted}`}>마지막 동기화</div>
              <div className={`text-xs font-medium ${t.text}`}>
                {lastSync ? new Date(lastSync).toLocaleString('ko-KR') : '—'}
              </div>
            </div>
          </div>
        ) : (
          <div className={`text-xs ${t.muted}`}>조회 중...</div>
        )}
      </div>
    </div>
  )
}
