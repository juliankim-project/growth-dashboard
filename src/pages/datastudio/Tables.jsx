import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useConfig } from '../../store/useConfig'
import { Table2, RefreshCw, ChevronDown, ChevronRight, Eye, EyeOff, Layers, Plus, Trash2, Save, Calculator } from 'lucide-react'
import Spinner from '../../components/UI/Spinner'

const TABLES = ['marketing_data', 'product_revenue_raw']

/* 숫자형으로 추정되는 컬럼 (auto-detect 용) */
const LIKELY_HIDDEN = new Set(['id', 'no', 'guest_type', 'guest_id', 'user_id', 'roomtype_id', 'room_id', 'branch_id', 'channel_id', 'room_type2', 'channel_resv_no1', 'channel_resv_no2', 'vehicle_num', 'has_gift', 'gift_memo', 'operator', 'alim_status', 'is_extend', 'prohibit_move', 'is_long'])
const LIKELY_DIMENSION = new Set(['brand_name', 'branch_name', 'channel_name', 'channel_group', 'room_type_name', 'room_type2', 'status', 'channel', 'campaign', 'ad_group', 'ad_creative', 'content', 'sub_publisher', 'term'])
const LIKELY_CURRENCY = new Set(['payment_amount', 'original_price', 'staypass_discount', 'promo_discount', 'coupon_discount_amount', 'point_amount', 'spend', 'revenue', 'cpc'])
const LIKELY_DATE = new Set(['date', 'reservation_date', 'check_in_date', 'check_in', 'check_out', 'reserved_at', 'created_at', 'updated_at'])

function autoDetect(col) {
  return {
    alias: '',
    visible: !LIKELY_HIDDEN.has(col) && !LIKELY_DATE.has(col),
    fmt: LIKELY_CURRENCY.has(col) ? 'currency' : 'number',
  }
}

const FMT_OPTIONS = [
  { value: 'number', label: '숫자' },
  { value: 'currency', label: '금액' },
  { value: 'pct', label: '%' },
]

export default function Tables({ dark }) {
  const { getColumnConfig, setColumnConfig } = useConfig()
  const [tables, setTables]   = useState({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState({})
  const [editCfg, setEditCfg] = useState({}) // { tableName: localCopy }
  const saveTimer = useRef({})

  const loadTables = async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const result = {}
    for (const t of TABLES) {
      try {
        const { data, error, count } = await supabase
          .from(t).select('*', { count: 'exact' }).limit(3)
        if (!error) {
          result[t] = {
            count,
            columns: data?.[0] ? Object.keys(data[0]) : [],
            sample: data || []
          }
        }
      } catch {}
    }
    setTables(result)
    setLoading(false)
  }

  useEffect(() => { loadTables() }, [])

  /* 테이블 열 때 columnConfig 로드 / 자동 초기화 */
  const toggle = t => {
    setOpen(o => {
      const next = { ...o, [t]: !o[t] }
      if (next[t] && !editCfg[t]) {
        const existing = getColumnConfig(t)
        const info = tables[t]
        if (info && (!existing.columns || Object.keys(existing.columns).length === 0)) {
          // 자동 초기화: DB 컬럼 기반
          const columns = {}
          const dimensionColumns = []
          info.columns.forEach(col => {
            columns[col] = autoDetect(col)
            if (LIKELY_DIMENSION.has(col)) dimensionColumns.push(col)
          })
          const init = { columns, dimensionColumns, computed: [] }
          setEditCfg(prev => ({ ...prev, [t]: init }))
        } else {
          setEditCfg(prev => ({ ...prev, [t]: { ...existing } }))
        }
      }
      return next
    })
  }

  /* debounce 저장 */
  const debounceSave = useCallback((tableName, cfg) => {
    clearTimeout(saveTimer.current[tableName])
    saveTimer.current[tableName] = setTimeout(() => {
      setColumnConfig(tableName, cfg)
    }, 800)
  }, [setColumnConfig])

  /* 컬럼 설정 업데이트 */
  const updateCol = (tableName, col, updates) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.columns = { ...(tCfg.columns || {}) }
      tCfg.columns[col] = { ...(tCfg.columns[col] || {}), ...updates }
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* 디멘전 토글 */
  const toggleDim = (tableName, col) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      const dims = [...(tCfg.dimensionColumns || [])]
      const idx = dims.indexOf(col)
      if (idx >= 0) dims.splice(idx, 1)
      else dims.push(col)
      tCfg.dimensionColumns = dims
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* 계산 컬럼 추가 */
  const addComputed = tableName => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = [...(tCfg.computed || []), {
        id: 'cc_' + Date.now(),
        name: '',
        terms: [{ col: '', sign: '+' }],
        fmt: 'number',
      }]
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* 계산 컬럼 업데이트 */
  const updateComputed = (tableName, ccId, updates) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc =>
        cc.id === ccId ? { ...cc, ...updates } : cc
      )
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* 계산 컬럼 삭제 */
  const removeComputed = (tableName, ccId) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).filter(cc => cc.id !== ccId)
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* 계산 컬럼 term 추가/삭제/수정 */
  const addTerm = (tableName, ccId) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc =>
        cc.id === ccId ? { ...cc, terms: [...cc.terms, { col: '', sign: '+' }] } : cc
      )
      return { ...prev, [tableName]: tCfg }
    })
  }

  const removeTerm = (tableName, ccId, idx) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc =>
        cc.id === ccId ? { ...cc, terms: cc.terms.filter((_, i) => i !== idx) } : cc
      )
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  const updateTerm = (tableName, ccId, idx, updates) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc =>
        cc.id === ccId ? { ...cc, terms: cc.terms.map((t, i) => i === idx ? { ...t, ...updates } : t) } : cc
      )
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* 즉시 저장 */
  const saveNow = tableName => {
    const cfg = editCfg[tableName]
    if (cfg) setColumnConfig(tableName, cfg)
  }

  /* ── 스타일 ── */
  const card = dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'
  const sub = dark ? 'text-slate-400' : 'text-slate-700'
  const inp = `text-xs px-2 py-1.5 rounded-lg border outline-none transition-colors
    ${dark ? 'bg-[#13151C] border-[#252836] text-white placeholder:text-slate-600 focus:border-indigo-500'
           : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500'}`
  const sel = `text-[11px] px-1.5 py-1 rounded border outline-none
    ${dark ? 'bg-[#13151C] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`

  if (loading) return <Spinner dark={dark} />

  return (
    <div className="p-6 flex flex-col gap-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>테이블 관리</h2>
          <p className={`text-xs mt-0.5 ${sub}`}>
            컬럼 별칭 · 가시성 · 계산 컬럼 설정
          </p>
        </div>
        <button onClick={loadTables}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors
            ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
          <RefreshCw size={13} /> 새로고침
        </button>
      </div>

      {TABLES.map(t => {
        const info    = tables[t]
        const isOpen  = !!open[t]
        const tCfg    = editCfg[t] || {}
        const columns = tCfg.columns || {}
        const dims    = new Set(tCfg.dimensionColumns || [])
        const computed = tCfg.computed || []

        /* 드롭다운에서 선택 가능한 컬럼 목록 */
        const selectableCols = [
          ...(info?.columns || []).filter(c => columns[c]?.visible !== false),
          ...computed.filter(cc => cc.name).map(cc => cc.id),
        ]

        return (
          <div key={t} className={`rounded-xl border overflow-hidden ${card}`}>
            {/* 헤더 */}
            <button
              onClick={() => toggle(t)}
              className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors
                ${dark ? 'hover:bg-[#13151C]' : 'hover:bg-slate-50'}`}
            >
              <Table2 size={16} className="text-indigo-500 shrink-0" />
              <span className={`font-semibold text-sm flex-1 ${dark ? 'text-white' : 'text-slate-800'}`}>{t}</span>
              {info && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  {info.count?.toLocaleString() ?? 0}행
                </span>
              )}
              {info ? (
                isOpen ? <ChevronDown size={14} className={dark ? 'text-slate-500' : 'text-slate-700'} />
                       : <ChevronRight size={14} className={dark ? 'text-slate-500' : 'text-slate-700'} />
              ) : (
                <span className="text-xs text-red-400">연결 없음</span>
              )}
            </button>

            {/* ── 확장 영역 ── */}
            {isOpen && info && (
              <div className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>

                {/* ─── 컬럼 별칭 + 가시성 ─── */}
                <div className={`px-5 py-4 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                  <p className={`text-xs font-bold mb-3 ${dark ? 'text-white' : 'text-slate-800'}`}>
                    📋 컬럼 별칭
                    <span className={`font-normal ml-2 ${sub}`}>대시보드에서 표시될 이름을 설정하세요</span>
                  </p>

                  {/* 헤더 */}
                  <div className={`grid grid-cols-[140px_1fr_36px_36px_70px] gap-2 mb-2 text-[10px] font-semibold ${sub}`}>
                    <span>DB 컬럼명</span>
                    <span>표시명</span>
                    <span className="text-center">보임</span>
                    <span className="text-center">차원</span>
                    <span>포맷</span>
                  </div>

                  {/* 컬럼 목록 */}
                  <div className="flex flex-col gap-1">
                    {info.columns.map(col => {
                      const cfg = columns[col] || autoDetect(col)
                      const isDim = dims.has(col)
                      const isDate = LIKELY_DATE.has(col)
                      const hidden = cfg.visible === false || isDate

                      return (
                        <div key={col}
                          className={`grid grid-cols-[140px_1fr_36px_36px_70px] gap-2 items-center py-1.5 px-2 rounded-lg transition-colors
                            ${hidden ? (dark ? 'opacity-40' : 'opacity-50') : ''}
                            ${dark ? 'hover:bg-[#13151C]' : 'hover:bg-slate-50'}`}
                        >
                          {/* DB 컬럼명 */}
                          <span className={`font-mono text-[11px] truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {col}
                          </span>

                          {/* 별칭 */}
                          <input
                            className={`${inp} h-7`}
                            placeholder={col}
                            value={cfg.alias || ''}
                            onChange={e => updateCol(t, col, { alias: e.target.value })}
                          />

                          {/* 보임/숨김 */}
                          <button
                            onClick={() => updateCol(t, col, { visible: hidden ? true : false })}
                            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors
                              ${hidden
                                ? dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'
                                : dark ? 'text-emerald-400' : 'text-emerald-500'
                              }`}
                          >
                            {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>

                          {/* 디멘전 */}
                          <button
                            onClick={() => toggleDim(t, col)}
                            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors
                              ${isDim
                                ? dark ? 'text-violet-400' : 'text-violet-500'
                                : dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'
                              }`}
                          >
                            <Layers size={13} />
                          </button>

                          {/* 포맷 */}
                          <select
                            className={sel}
                            value={cfg.fmt || 'number'}
                            onChange={e => updateCol(t, col, { fmt: e.target.value })}
                          >
                            {FMT_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ─── 계산 컬럼 ─── */}
                <div className={`px-5 py-4 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                      🧮 계산 컬럼
                      <span className={`font-normal ml-2 ${sub}`}>기존 컬럼 조합으로 새 지표 생성</span>
                    </p>
                    <button
                      onClick={() => addComputed(t)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors
                        ${dark ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                               : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                    >
                      <Plus size={12} /> 추가
                    </button>
                  </div>

                  {computed.length === 0 && (
                    <p className={`text-xs ${sub} py-2`}>
                      아직 계산 컬럼이 없습니다. "추가" 버튼을 눌러 생성하세요.
                    </p>
                  )}

                  <div className="flex flex-col gap-3">
                    {computed.map(cc => {
                      /* 미리보기 수식 생성 */
                      const signSymbol = { '+': '+ ', '-': '- ', '*': '× ', '/': '÷ ' }
                      const preview = cc.terms
                        .filter(t => t.col)
                        .map(t => {
                          const alias = columns[t.col]?.alias || t.col
                          return `${signSymbol[t.sign] || '+ '}${alias}`
                        })
                        .join(' ')
                        .replace(/^\+ /, '')

                      return (
                        <div key={cc.id}
                          className={`rounded-xl border p-4
                            ${dark ? 'border-[#252836] bg-[#13151C]' : 'border-slate-100 bg-slate-50'}`}
                        >
                          {/* 이름 + 포맷 + 삭제 */}
                          <div className="flex items-center gap-2 mb-3">
                            <Calculator size={14} className={dark ? 'text-indigo-400' : 'text-indigo-500'} />
                            <input
                              className={`${inp} flex-1 font-semibold`}
                              placeholder="컬럼명 (예: 최종매출액)"
                              value={cc.name}
                              onChange={e => updateComputed(t, cc.id, { name: e.target.value })}
                            />
                            <select
                              className={sel}
                              value={cc.fmt || 'number'}
                              onChange={e => updateComputed(t, cc.id, { fmt: e.target.value })}
                            >
                              {FMT_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => removeComputed(t, cc.id)}
                              className="text-red-400 hover:text-red-300 transition-colors p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {/* Terms */}
                          <div className="flex flex-col gap-1.5 ml-6">
                            {cc.terms.map((term, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                {/* 부호 */}
                                <select
                                  className={`${sel} w-10 text-center`}
                                  value={term.sign}
                                  onChange={e => updateTerm(t, cc.id, idx, { sign: e.target.value })}
                                >
                                  <option value="+">+</option>
                                  <option value="-">−</option>
                                  <option value="*">×</option>
                                  <option value="/">÷</option>
                                </select>

                                {/* 컬럼 드롭다운 */}
                                <select
                                  className={`${sel} flex-1`}
                                  value={term.col}
                                  onChange={e => updateTerm(t, cc.id, idx, { col: e.target.value })}
                                >
                                  <option value="">컬럼 선택...</option>
                                  <optgroup label="컬럼">
                                    {(info?.columns || [])
                                      .filter(c => columns[c]?.visible !== false && !LIKELY_DATE.has(c) && !LIKELY_DIMENSION.has(c))
                                      .map(c => (
                                        <option key={c} value={c}>{columns[c]?.alias || c}</option>
                                      ))
                                    }
                                  </optgroup>
                                  {computed.filter(other => other.id !== cc.id && other.name).length > 0 && (
                                    <optgroup label="계산 컬럼">
                                      {computed
                                        .filter(other => other.id !== cc.id && other.name)
                                        .map(other => (
                                          <option key={other.id} value={other.id}>{other.name}</option>
                                        ))
                                      }
                                    </optgroup>
                                  )}
                                </select>

                                {/* term 삭제 */}
                                {cc.terms.length > 1 && (
                                  <button
                                    onClick={() => removeTerm(t, cc.id, idx)}
                                    className={`p-0.5 rounded transition-colors ${dark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-400'}`}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            ))}

                            {/* term 추가 */}
                            <button
                              onClick={() => addTerm(t, cc.id)}
                              className={`text-[11px] px-2 py-1 rounded self-start transition-colors
                                ${dark ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-500'}`}
                            >
                              + 항목 추가
                            </button>
                          </div>

                          {/* 미리보기 */}
                          {preview && (
                            <div className={`mt-3 ml-6 text-[11px] px-3 py-1.5 rounded-lg
                              ${dark ? 'bg-[#1A1D27] text-slate-400' : 'bg-white text-slate-500 border border-slate-100'}`}>
                              = {preview}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ─── 저장 버튼 ─── */}
                <div className={`px-5 py-3 flex items-center justify-between
                  ${dark ? 'bg-[#13151C]' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] ${sub}`}>
                    변경사항은 자동 저장됩니다 · 다른 유저에게도 실시간 반영
                  </p>
                  <button
                    onClick={() => saveNow(t)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                      ${dark ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                             : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                  >
                    <Save size={12} /> 저장
                  </button>
                </div>

                {/* ─── 샘플 데이터 ─── */}
                {info.sample.length > 0 && (
                  <div className={`overflow-x-auto border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={dark ? 'bg-[#0F1117]' : 'bg-slate-50'}>
                          {info.columns.slice(0, 8).map(c => (
                            <th key={c} className={`px-3 py-2 text-left font-semibold border-r whitespace-nowrap
                              ${dark ? 'border-[#252836] text-slate-500' : 'border-slate-100 text-slate-600'}`}>
                              {columns[c]?.alias || c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {info.sample.map((row, i) => (
                          <tr key={i} className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                            {info.columns.slice(0, 8).map(c => (
                              <td key={c} className={`px-3 py-2 text-xs border-r whitespace-nowrap max-w-[120px] truncate
                                ${dark ? 'border-[#252836] text-slate-300' : 'border-slate-100 text-slate-600'}`}>
                                {String(row[c] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
