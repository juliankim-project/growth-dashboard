import { useState, useEffect, useCallback } from 'react'
import { Clock, Play, RefreshCw, CheckCircle2, XCircle, Calendar, Settings2, Zap } from 'lucide-react'
import Spinner from '../../components/UI/Spinner'
import { supabase } from '../../lib/supabase'

/* ── cron 표현식 → 사람이 읽을 수 있는 한국어 ── */
const CRON_PRESETS = [
  { label: '매일 오전 7시',  cron: '0 22 * * *', desc: 'UTC 22:00 = KST 07:00' },
  { label: '매일 오전 9시',  cron: '0 0 * * *',  desc: 'UTC 00:00 = KST 09:00' },
  { label: '매일 오전 10시', cron: '0 1 * * *',  desc: 'UTC 01:00 = KST 10:00' },
  { label: '매일 오후 12시', cron: '0 3 * * *',  desc: 'UTC 03:00 = KST 12:00' },
  { label: '매일 오후 6시',  cron: '0 9 * * *',  desc: 'UTC 09:00 = KST 18:00' },
  { label: '평일만 오전 10시', cron: '0 1 * * 1-5', desc: 'UTC 01:00 월~금' },
]

function cronToKorean(cron) {
  const preset = CRON_PRESETS.find(p => p.cron === cron)
  if (preset) return preset.label
  return `커스텀 (${cron})`
}

/* ── 시간 포맷 ── */
function timeAgo(ts) {
  if (!ts) return '-'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

export default function Scheduler({ dark }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [selectedCron, setSelectedCron] = useState('0 1 * * *')
  const [enabled, setEnabled] = useState(true)

  /* ── 설정 로드 ── */
  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('scheduler_config')
        .select('*')
        .eq('id', 'keyword-collector')
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setConfig(data)
        setSelectedCron(data.cron_expr || '0 1 * * *')
        setEnabled(data.enabled !== false)
      }
    } catch (e) {
      console.error('스케줄 설정 로드 실패:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  /* ── 설정 저장 ── */
  const saveConfig = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('scheduler_config')
        .upsert({
          id: 'keyword-collector',
          enabled,
          cron_expr: selectedCron,
          description: cronToKorean(selectedCron) + ' 키워드 수집',
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      await loadConfig()
      alert('스케줄 설정이 저장되었습니다.\n\n⚠️ 실제 pg_cron 반영은 Supabase SQL Editor에서 아래 쿼리를 실행해주세요:\n\nSELECT cron.unschedule(\'keyword-trend-daily\');\nSELECT cron.schedule(\'keyword-trend-daily\', \'' + selectedCron + '\', ...);')
    } catch (e) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  /* ── 수동 실행 ── */
  const runNow = async () => {
    setRunning(true)
    setRunResult(null)
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
      const startTime = Date.now()

      const res = await fetch(`${SUPABASE_URL}/functions/v1/keyword-collector`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({}),
      })

      const result = await res.json()
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

      if (result.error) throw new Error(result.error)

      setRunResult({ success: true, ...result, elapsed })

      // 실행 결과 DB에 기록
      await supabase
        .from('scheduler_config')
        .update({
          last_run: new Date().toISOString(),
          last_status: 'success',
          last_result: result,
        })
        .eq('id', 'keyword-collector')

      await loadConfig()
    } catch (e) {
      setRunResult({ success: false, error: e.message })

      await supabase
        .from('scheduler_config')
        .update({
          last_run: new Date().toISOString(),
          last_status: 'error',
          last_result: { error: e.message },
        })
        .eq('id', 'keyword-collector')
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner /></div>
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-[#1D2125]' : 'bg-[#F7F8F9]'}`}>
      {/* 헤더 */}
      <div className={`sticky top-0 z-20 backdrop-blur-md border-b px-6 py-4
        ${dark ? 'bg-[#1D2125]/90 border-[#A1BDD914]' : 'bg-[#F7F8F9]/90 border-slate-200'}`}>
        <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
          수집 스케줄러
        </h1>
        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
          키워드 트렌드 자동 수집 관리 · Supabase pg_cron
        </p>
      </div>

      <div className="p-6 space-y-6 max-w-2xl">
        {/* ── 현재 상태 ── */}
        <div className={`rounded-2xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-[#F59E0B]" />
            <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>현재 상태</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={`text-[11px] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>스케줄</p>
              <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>
                {config ? cronToKorean(config.cron_expr) : '미설정'}
              </p>
            </div>
            <div>
              <p className={`text-[11px] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>상태</p>
              <div className="flex items-center gap-1.5">
                {config?.enabled !== false ? (
                  <><CheckCircle2 size={14} className="text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-500">활성</span></>
                ) : (
                  <><XCircle size={14} className="text-red-500" />
                    <span className="text-sm font-semibold text-red-500">비활성</span></>
                )}
              </div>
            </div>
            <div>
              <p className={`text-[11px] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>마지막 실행</p>
              <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                {config?.last_run ? timeAgo(config.last_run) : '아직 없음'}
              </p>
            </div>
            <div>
              <p className={`text-[11px] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>마지막 결과</p>
              <p className={`text-sm ${
                config?.last_status === 'success' ? 'text-emerald-500' :
                config?.last_status === 'error' ? 'text-red-500' :
                dark ? 'text-slate-300' : 'text-slate-600'
              }`}>
                {config?.last_status === 'success' ? '성공' :
                 config?.last_status === 'error' ? '실패' : '-'}
                {config?.last_result?.inserted && ` (${config.last_result.inserted}건)`}
              </p>
            </div>
          </div>
        </div>

        {/* ── 수동 실행 ── */}
        <div className={`rounded-2xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Play size={16} className="text-[#0C66E4]" />
            <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>수동 실행</h3>
          </div>

          <p className={`text-xs mb-4 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            지금 바로 키워드 수집을 실행합니다. 상품 데이터에서 키워드를 추출하고 네이버 검색광고 API로 검색량을 조회합니다.
          </p>

          <button
            onClick={runNow}
            disabled={running}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all
              ${running ? 'opacity-50' : 'hover:shadow-md'}
              bg-[#0C66E4] text-white`}
          >
            {running ? (
              <><RefreshCw size={14} className="animate-spin" /> 수집 중...</>
            ) : (
              <><Play size={14} /> 지금 수집 실행</>
            )}
          </button>

          {/* 실행 결과 */}
          {runResult && (
            <div className={`mt-4 rounded-xl border p-4 text-xs ${
              runResult.success
                ? dark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
                : dark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
            }`}>
              {runResult.success ? (
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-500">✓ 수집 완료</p>
                  <p className={dark ? 'text-slate-300' : 'text-slate-600'}>
                    저장: {runResult.inserted}건 · 소요: {runResult.elapsed}초
                  </p>
                  {runResult.areas?.length > 0 && (
                    <p className={dark ? 'text-slate-400' : 'text-slate-500'}>
                      지역: {runResult.areas.join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-red-500">✗ 실패: {runResult.error}</p>
              )}
            </div>
          )}
        </div>

        {/* ── 스케줄 설정 ── */}
        <div className={`rounded-2xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Settings2 size={16} className="text-[#8B5CF6]" />
            <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>스케줄 설정</h3>
          </div>

          {/* 활성/비활성 */}
          <div className="flex items-center justify-between mb-4">
            <span className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>자동 수집</span>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                enabled ? 'bg-[#0C66E4]' : dark ? 'bg-[#2C333A]' : 'bg-slate-300'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                enabled ? 'left-[22px]' : 'left-0.5'
              }`} />
            </button>
          </div>

          {/* 시간 선택 */}
          <p className={`text-xs mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>실행 시간</p>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {CRON_PRESETS.map(preset => (
              <button
                key={preset.cron}
                onClick={() => setSelectedCron(preset.cron)}
                className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all text-left ${
                  selectedCron === preset.cron
                    ? 'bg-[#0C66E4] text-white border-[#0C66E4]'
                    : dark
                      ? 'bg-[#1D2125] border-[#A1BDD914] text-slate-300 hover:border-[#579DFF]'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-[#579DFF]'
                }`}
              >
                <span className="block">{preset.label}</span>
                <span className={`text-[10px] ${selectedCron === preset.cron ? 'text-blue-200' : dark ? 'text-slate-600' : 'text-slate-400'}`}>
                  {preset.desc}
                </span>
              </button>
            ))}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={saveConfig}
            disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all
              ${saving ? 'opacity-50' : 'hover:shadow-md'}
              ${dark ? 'bg-[#579DFF] text-white' : 'bg-[#0C66E4] text-white'}`}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Calendar size={14} />}
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>

        {/* ── 안내 ── */}
        <div className={`rounded-xl border p-4 text-xs ${dark ? 'bg-[#1D2125] border-[#A1BDD914] text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
          <p className="font-semibold mb-1">pg_cron 자동 실행이란?</p>
          <p>Supabase DB 내부의 스케줄러가 설정된 시간에 자동으로 키워드 수집 Edge Function을 호출합니다. 서버가 항상 켜져 있으므로 컴퓨터를 끄거나 브라우저를 닫아도 실행됩니다.</p>
        </div>
      </div>
    </div>
  )
}
