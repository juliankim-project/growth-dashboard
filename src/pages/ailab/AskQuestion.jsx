import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Database, MessageSquare, AlertCircle } from 'lucide-react'
import { mcpAsk, mcpQuery } from '../../lib/mcpClient'
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

export default function AskQuestion({ dark }) {
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState('ask') // 'ask' | 'query'
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const q = question.trim()
    if (!q || loading) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = mode === 'ask' ? await mcpAsk(q) : await mcpQuery(q)

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
        await supabase.from('ai_queries').insert({
          question: q,
          mode,
          result: JSON.stringify(parsed ?? res),
        }).then(() => {})
      }
    } catch (err) {
      setError(err.message)
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
      <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
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

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder={mode === 'ask' ? '예: 이번 달 채널별 매출을 알려줘' : 'SELECT * FROM fact_reservation_event LIMIT 10'}
          className={`flex-1 px-4 py-2.5 rounded-lg border text-sm outline-none transition-all ${
            dark
              ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500'
              : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
          }`}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          실행
        </button>
      </form>

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
