import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Database, MessageSquare, AlertCircle, KeyRound, Clock } from 'lucide-react'
import { mcpAsk, mcpQuery, mcpCheckAuth, mcpLogin, MCPAuthRequiredError } from '../../lib/mcpClient'
import { supabase } from '../../lib/supabase'

function ResultTable({ rows }) {
  if (!rows || rows.length === 0) return null
  const cols = Object.keys(rows[0])
  return (
    <div className="overflow-auto max-h-96 rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
          <tr>
            {cols.map(c => (
              <th key={c} className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              {cols.map(c => (
                <td key={c} className="px-3 py-1.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                  {r[c] != null ? String(r[c]) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ElapsedTimer() {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSec(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return <span>{sec}초</span>
}

export default function AskQuestion({ dark }) {
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState('ask') // 'ask' | 'query'
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // 인증 상태 확인
  useEffect(() => {
    mcpCheckAuth().then(res => {
      setNeedsAuth(!res.authenticated)
    }).catch(() => setNeedsAuth(true))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const q = question.trim()
    if (!q || loading) return

    // 이전 요청 취소
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setResult(null)

    // 120초 타임아웃
    const timeout = setTimeout(() => {
      controller.abort()
      setError('요청 시간이 초과되었습니다 (120초). 자연어 질문은 시간이 오래 걸릴 수 있어요. SQL 쿼리 모드를 사용해 보세요.')
      setLoading(false)
    }, 120000)

    try {
      const res = mode === 'ask'
        ? await mcpAsk(q, controller.signal)
        : await mcpQuery(q, controller.signal)

      clearTimeout(timeout)

      // MCP JSON-RPC 결과 파싱
      let parsed = null
      if (res?.result?.content) {
        for (const block of res.result.content) {
          if (block.type === 'text') {
            try { parsed = JSON.parse(block.text) } catch { parsed = block.text }
          }
        }
      }
      setResult(parsed ?? res)

      // 질문 내역 저장
      if (supabase) {
        supabase.from('ai_queries').insert({
          question: q,
          mode,
          result: JSON.stringify(parsed ?? res),
        }).then(() => {})
      }
    } catch (err) {
      clearTimeout(timeout)
      if (err.name === 'AbortError') return
      if (err instanceof MCPAuthRequiredError) {
        setNeedsAuth(true)
        setError(null)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const rows = Array.isArray(result) ? result
    : result?.rows ? result.rows
    : result?.data ? result.data
    : null

  return (
    <div className={`h-full flex flex-col gap-4 p-6 ${dark ? 'text-white' : 'text-slate-800'}`}>
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold">AI 연구소</h1>
        <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          Plott 데이터에 자연어로 질문하거나 SQL을 직접 실행하세요
        </p>
      </div>

      {/* 모드 토글 */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          <button
            onClick={() => setMode('ask')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'ask'
                ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <MessageSquare size={14} /> 자연어 질문
          </button>
          <button
            onClick={() => setMode('query')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'query'
                ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Database size={14} /> SQL 쿼리
          </button>
        </div>
        {mode === 'ask' && (
          <span className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            AI 처리로 10~60초 소요될 수 있습니다
          </span>
        )}
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        {mode === 'query' ? (
          <textarea
            ref={inputRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="SELECT c_name, SUM(pk_rv) AS revenue FROM fact_reservation_event WHERE event = '픽업' AND date = CURRENT_DATE GROUP BY c_name ORDER BY revenue DESC"
            rows={3}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e) }}
            className={`flex-1 px-4 py-2.5 rounded-lg border text-sm outline-none transition-all font-mono resize-none ${
              dark
                ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500'
                : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
            }`}
          />
        ) : (
          <input
            ref={inputRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="예: 이번 달 채널별 매출을 알려줘"
            className={`flex-1 px-4 py-2.5 rounded-lg border text-sm outline-none transition-all ${
              dark
                ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500'
                : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
            }`}
          />
        )}
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors self-end"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          실행
        </button>
      </form>

      {/* 로딩 상태 */}
      {loading && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${
          dark ? 'bg-blue-900/20 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
        }`}>
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span>
            {mode === 'ask' ? 'AI가 데이터를 분석하고 있습니다' : '쿼리 실행 중'}...
          </span>
          <span className="flex items-center gap-1 ml-auto text-xs opacity-70">
            <Clock size={12} /> <ElapsedTimer />
          </span>
        </div>
      )}

      {/* 인증 필요 안내 */}
      {needsAuth && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${
          dark ? 'bg-amber-900/20 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <KeyRound size={18} className="shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium">Plott Duck 인증이 필요합니다</p>
            <p className="mt-0.5 opacity-80">Keycloak SSO 로그인 후 자동으로 연결됩니다</p>
          </div>
          <button
            onClick={async () => {
              try { await mcpLogin() } catch { /* redirect happens */ }
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors shrink-0"
          >
            로그인
          </button>
        </div>
      )}

      {/* 결과 영역 */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {rows && <ResultTable rows={rows} />}

        {result && !rows && typeof result === 'string' && (
          <div className={`p-4 rounded-lg border text-sm whitespace-pre-wrap ${
            dark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            {result}
          </div>
        )}

        {result && !rows && typeof result === 'object' && (
          <pre className={`p-4 rounded-lg border text-xs overflow-auto ${
            dark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
