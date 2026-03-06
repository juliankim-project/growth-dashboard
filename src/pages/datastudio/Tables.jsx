import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useConfig, MARKETING_SEED_CONFIG, PRODUCT_SEED_CONFIG } from '../../store/useConfig'
import { getColumnLabel } from '../../store/columnUtils'
import {
  Table2, RefreshCw, ChevronDown, ChevronRight,
  Eye, EyeOff, Plus, Trash2, Save, Calculator, Check, X,
} from 'lucide-react'
import Spinner from '../../components/UI/Spinner'

export const TABLES = ['marketing_data', 'product_revenue_raw']

/* 숫자형으로 추정되는 컬럼 (auto-detect 용) */
const LIKELY_HIDDEN = new Set(['id', 'no', 'guest_type', 'guest_id', 'user_id', 'roomtype_id', 'room_id', 'branch_id', 'channel_id', 'room_type2', 'channel_resv_no1', 'channel_resv_no2', 'vehicle_num', 'has_gift', 'gift_memo', 'operator', 'alim_status', 'is_extend', 'prohibit_move', 'is_long'])
const LIKELY_DIMENSION = new Set(['brand_name', 'branch_name', 'channel_name', 'channel_group', 'room_type_name', 'room_type2', 'status', 'channel', 'campaign', 'ad_group', 'ad_creative', 'content', 'sub_publisher', 'term', 'area'])
const LIKELY_CURRENCY = new Set(['payment_amount', 'original_price', 'staypass_discount', 'promo_discount', 'coupon_discount_amount', 'point_amount', 'spend', 'revenue', 'cpc'])
const LIKELY_DATE = new Set(['date', 'reservation_date', 'check_in_date', 'check_in', 'check_out', 'reserved_at', 'created_at', 'updated_at'])

function autoDetect(col) {
  const isDim = LIKELY_DIMENSION.has(col)
  const isHidden = LIKELY_HIDDEN.has(col) || LIKELY_DATE.has(col)
  return {
    alias: '',
    visible: !isHidden,
    fmt: LIKELY_CURRENCY.has(col) ? 'currency' : LIKELY_DATE.has(col) ? 'date' : isDim ? 'text' : 'number',
    agg: (isDim || isHidden) ? null : 'sum',
  }
}

const FMT_OPTIONS = [
  { value: 'number', label: '#숫자' },
  { value: 'currency', label: '통화' },
  { value: 'pct', label: '%' },
  { value: 'text', label: '텍스트' },
  { value: 'date', label: '날짜' },
]

const AGG_OPTIONS = [
  { value: 'sum', label: 'SUM' },
  { value: 'count', label: 'COUNT' },
  { value: 'avg', label: 'AVG' },
]

const CC_TYPE_OPTIONS = [
  { value: 'formula', label: '수식' },
  { value: 'count', label: 'COUNT(*)' },
  { value: 'avg', label: 'AVG(컬럼)' },
]

export default function Tables({ dark }) {
  const { getColumnConfig, setColumnConfig } = useConfig()
  const [tables, setTables]   = useState({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState({})
  const [editCfg, setEditCfg] = useState({}) // { tableName: localCopy }
  const [saved, setSaved]     = useState({}) // { tableName: true }
  const [addDimDrop, setAddDimDrop] = useState({}) // { tableName: true } — GroupBy 드롭다운 열림
  const saveTimer = useRef({})
  const savedTimer = useRef({})

  const loadTables = async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const result = {}
    for (const t of TABLES) {
      try {
        const { data, error, count } = await supabase
          .from(t).select('*', { count: 'exact' }).limit(10)
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
          const seed = t === 'marketing_data' ? MARKETING_SEED_CONFIG
                     : t === 'product_revenue_raw' ? PRODUCT_SEED_CONFIG
                     : null
          const columns = {}
          const dimensionColumns = seed ? [...(seed.dimensionColumns || [])] : []
          info.columns.forEach(col => {
            if (seed?.columns?.[col]) {
              columns[col] = { ...seed.columns[col] }
            } else {
              columns[col] = autoDetect(col)
              if (!seed && LIKELY_DIMENSION.has(col)) dimensionColumns.push(col)
            }
          })
          const init = {
            columns,
            dimensionColumns,
            computed: seed?.computed || [],
            ...(seed?.displayName ? { displayName: seed.displayName } : {}),
          }
          setEditCfg(prev => ({ ...prev, [t]: init }))
          setColumnConfig(t, init)
        } else {
          const merged = { ...existing, columns: { ...(existing.columns || {}) } }
          let dirty = false
          if (info) {
            info.columns.forEach(col => {
              if (!merged.columns[col]) {
                merged.columns[col] = autoDetect(col)
                dirty = true
              }
            })
          }
          setEditCfg(prev => ({ ...prev, [t]: merged }))
          if (dirty) setColumnConfig(t, merged)
        }
      }
      return next
    })
  }

  /* 저장 완료 피드백 */
  const flashSaved = useCallback((tableName) => {
    setSaved(prev => ({ ...prev, [tableName]: true }))
    clearTimeout(savedTimer.current[tableName])
    savedTimer.current[tableName] = setTimeout(() => {
      setSaved(prev => ({ ...prev, [tableName]: false }))
    }, 2000)
  }, [])

  /* debounce 저장 */
  const debounceSave = useCallback((tableName, cfg) => {
    clearTimeout(saveTimer.current[tableName])
    saveTimer.current[tableName] = setTimeout(() => {
      setColumnConfig(tableName, cfg)
      flashSaved(tableName)
    }, 800)
  }, [setColumnConfig, flashSaved])

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

  /* 디멘전 추가 (GroupBy 칩) */
  const addDim = (tableName, col) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      const dims = [...(tCfg.dimensionColumns || [])]
      if (!dims.includes(col)) dims.push(col)
      tCfg.dimensionColumns = dims
      // 디멘전 추가 시 agg null로
      tCfg.columns = { ...(tCfg.columns || {}) }
      tCfg.columns[col] = { ...(tCfg.columns[col] || {}), agg: null }
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
    setAddDimDrop(prev => ({ ...prev, [tableName]: false }))
  }

  /* 디멘전 제거 */
  const removeDim = (tableName, col) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.dimensionColumns = (tCfg.dimensionColumns || []).filter(d => d !== col)
      // 디멘전 제거 시 agg sum으로 복원
      tCfg.columns = { ...(tCfg.columns || {}) }
      tCfg.columns[col] = { ...(tCfg.columns[col] || {}), agg: 'sum' }
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* displayName 업데이트 */
  const updateDisplayName = (tableName, value) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}), displayName: value }
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
        aggType: 'formula',
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

  /* 계산 컬럼 타입 변경 */
  const changeComputedType = (tableName, ccId, newType) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc => {
        if (cc.id !== ccId) return cc
        if (newType === 'count') {
          return { ...cc, aggType: 'count', terms: [] }
        } else if (newType === 'avg') {
          return { ...cc, aggType: 'avg', terms: [{ col: '', sign: '+' }] }
        } else {
          return { ...cc, aggType: undefined, terms: cc.terms?.length ? cc.terms : [{ col: '', sign: '+' }] }
        }
      })
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* term 추가/삭제/수정 */
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

  /* 괄호 그룹 관련 */
  const addGroup = (tableName, ccId) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc =>
        cc.id === ccId
          ? { ...cc, terms: [...cc.terms, { type: 'group', sign: '+', children: [{ col: '', sign: '+' }] }] }
          : cc
      )
      return { ...prev, [tableName]: tCfg }
    })
  }

  const addTermToGroup = (tableName, ccId, groupIdx) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc => {
        if (cc.id !== ccId) return cc
        const terms = cc.terms.map((t, i) =>
          i === groupIdx && t.type === 'group'
            ? { ...t, children: [...(t.children || []), { col: '', sign: '+' }] }
            : t
        )
        return { ...cc, terms }
      })
      return { ...prev, [tableName]: tCfg }
    })
  }

  const removeTermFromGroup = (tableName, ccId, groupIdx, childIdx) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc => {
        if (cc.id !== ccId) return cc
        const terms = cc.terms.map((t, i) =>
          i === groupIdx && t.type === 'group'
            ? { ...t, children: t.children.filter((_, ci) => ci !== childIdx) }
            : t
        )
        return { ...cc, terms }
      })
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  const updateTermInGroup = (tableName, ccId, groupIdx, childIdx, updates) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc => {
        if (cc.id !== ccId) return cc
        const terms = cc.terms.map((t, i) =>
          i === groupIdx && t.type === 'group'
            ? { ...t, children: t.children.map((c, ci) => ci === childIdx ? { ...c, ...updates } : c) }
            : t
        )
        return { ...cc, terms }
      })
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* 즉시 저장 */
  const saveNow = tableName => {
    const cfg = editCfg[tableName]
    if (cfg) {
      clearTimeout(saveTimer.current[tableName])
      setColumnConfig(tableName, cfg)
      flashSaved(tableName)
    }
  }

  /* 전체 저장 */
  const [globalSaved, setGlobalSaved] = useState(false)
  const globalSavedTimer = useRef()
  const saveAll = () => {
    Object.entries(editCfg).forEach(([tableName, cfg]) => {
      clearTimeout(saveTimer.current[tableName])
      setColumnConfig(tableName, cfg)
    })
    setGlobalSaved(true)
    clearTimeout(globalSavedTimer.current)
    globalSavedTimer.current = setTimeout(() => setGlobalSaved(false), 2000)
  }
  const hasEdits = Object.keys(editCfg).length > 0

  /* ── 스타일 ── */
  const card = dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'
  const sub = dark ? 'text-slate-400' : 'text-slate-500'
  const inp = `text-xs px-2 py-1.5 rounded-lg border outline-none transition-colors
    ${dark ? 'bg-[#13151C] border-[#252836] text-white placeholder:text-slate-600 focus:border-indigo-500'
           : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500'}`
  const sel = `text-[11px] px-1.5 py-1 rounded border outline-none
    ${dark ? 'bg-[#13151C] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`

  if (loading) return <Spinner dark={dark} />

  return (
    <div className="p-6 flex flex-col gap-4 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>테이블 관리</h2>
          <p className={`text-xs mt-0.5 ${sub}`}>
            컬럼 별칭 · 집계 · GroupBy · 계산 컬럼 설정
          </p>
        </div>
        <div className="flex items-center gap-2">
          {globalSaved && (
            <span className="text-xs text-emerald-500 font-semibold animate-pulse">저장 완료</span>
          )}
          <button onClick={saveAll} disabled={!hasEdits}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300
              ${globalSaved
                ? dark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                : hasEdits
                  ? dark ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                         : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  : dark ? 'bg-[#252836] text-slate-600 cursor-not-allowed'
                         : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}>
            {globalSaved ? <><Check size={13} /> 저장됨</> : <><Save size={13} /> 전체 저장</>}
          </button>
          <button onClick={loadTables}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors
              ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            <RefreshCw size={13} /> 새로고침
          </button>
        </div>
      </div>

      {/* 테이블 목록 */}
      {TABLES.map(t => {
        const info    = tables[t]
        const isOpen  = !!open[t]
        const tCfg    = editCfg[t] || {}
        const columns = tCfg.columns || {}
        const dims    = new Set(tCfg.dimensionColumns || [])
        const computed = tCfg.computed || []
        const displayName = tCfg.displayName || ''

        /* 디멘전 추가 후보: visible이면서 아직 dims에 없는 컬럼 */
        const dimCandidates = (info?.columns || []).filter(c =>
          columns[c]?.visible !== false && !dims.has(c)
        )

        /* 계산 컬럼 드롭다운용 visible metric 컬럼 (디멘전/날짜 제외) */
        const visCols = (info?.columns || []).filter(c =>
          columns[c]?.visible !== false && !LIKELY_DATE.has(c) && !dims.has(c))

        return (
          <div key={t} className={`rounded-xl border overflow-hidden ${card}`}>
            {/* ─── 테이블 헤더 ─── */}
            <button
              onClick={() => toggle(t)}
              className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors
                ${dark ? 'hover:bg-[#13151C]' : 'hover:bg-slate-50'}`}
            >
              <Table2 size={16} className="text-indigo-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>{t}</span>
                  {displayName && (
                    <span className={`text-xs px-2 py-0.5 rounded-full
                      ${dark ? 'bg-[#252836] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {displayName}
                    </span>
                  )}
                </div>
              </div>
              {info && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0
                  ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  {info.count?.toLocaleString() ?? 0}행
                </span>
              )}
              {saved[t] && (
                <span className="text-xs text-emerald-500 font-semibold animate-pulse shrink-0">저장됨</span>
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

                {/* ─── 테이블 표시명 ─── */}
                <div className={`px-5 py-3 border-b flex items-center gap-3
                  ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                  <span className={`text-[11px] font-semibold shrink-0 ${sub}`}>표시명</span>
                  <input
                    className={`${inp} h-7 flex-1 max-w-xs`}
                    placeholder="예: 상품 매출"
                    value={displayName}
                    onChange={e => updateDisplayName(t, e.target.value)}
                  />
                </div>

                {/* ─── GroupBy 칩 섹션 ─── */}
                <div className={`px-5 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-semibold shrink-0 ${sub}`}>GroupBy</span>
                    {[...(tCfg.dimensionColumns || [])].map(dim => (
                      <span key={dim}
                        className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium
                          ${dark ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                                 : 'bg-violet-50 text-violet-600 border border-violet-200'}`}
                      >
                        {getColumnLabel(dim, columns[dim])}
                        <button onClick={() => removeDim(t, dim)}
                          className="hover:text-red-400 transition-colors ml-0.5">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    {/* + 추가 드롭다운 */}
                    <div className="relative">
                      <button
                        onClick={() => setAddDimDrop(prev => ({ ...prev, [t]: !prev[t] }))}
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-medium transition-colors
                          ${dark ? 'bg-[#252836] text-slate-400 hover:text-white hover:bg-[#2A2D3A]'
                                 : 'bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                      >
                        <Plus size={11} /> 추가
                      </button>
                      {addDimDrop[t] && dimCandidates.length > 0 && (
                        <div className={`absolute left-0 top-full mt-1 z-30 rounded-lg border shadow-lg py-1 max-h-48 overflow-y-auto min-w-[160px]
                          ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
                          {dimCandidates.map(c => (
                            <button key={c} onClick={() => addDim(t, c)}
                              className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors
                                ${dark ? 'text-slate-300 hover:bg-[#252836]' : 'text-slate-600 hover:bg-slate-50'}`}>
                              {getColumnLabel(c, columns[c])}
                              <span className={`ml-1.5 font-mono text-[10px] ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
                                {c}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ─── 컬럼 설정 인라인 테이블 ─── */}
                <div className={`px-5 py-4 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                  <p className={`text-xs font-bold mb-3 ${dark ? 'text-white' : 'text-slate-800'}`}>
                    컬럼 설정
                  </p>

                  {/* 테이블 헤더 */}
                  <div className={`grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_80px_50px_70px] gap-2 mb-1 text-[10px] font-bold uppercase tracking-wide px-2
                    ${sub}`}>
                    <span>컬럼명</span>
                    <span>별칭</span>
                    <span>포맷</span>
                    <span className="text-center">표시</span>
                    <span>집계</span>
                  </div>

                  {/* 컬럼 행들 */}
                  <div className="flex flex-col">
                    {info.columns.map(col => {
                      const cfg = columns[col] || autoDetect(col)
                      const isDim = dims.has(col)
                      const hidden = cfg.visible === false

                      return (
                        <div key={col}
                          className={`grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_80px_50px_70px] gap-2 items-center py-1.5 px-2 rounded-lg transition-colors
                            ${hidden ? 'opacity-40' : ''}
                            ${dark ? 'hover:bg-[#13151C]' : 'hover:bg-slate-50'}`}
                        >
                          {/* 컬럼명 */}
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

                          {/* 표시 토글 */}
                          <button
                            onClick={() => updateCol(t, col, { visible: hidden ? true : false })}
                            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors mx-auto
                              ${hidden
                                ? dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'
                                : dark ? 'text-emerald-400' : 'text-emerald-500'
                              }`}
                          >
                            {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>

                          {/* 집계 */}
                          {isDim ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-center
                              ${dark ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                              dim
                            </span>
                          ) : hidden ? (
                            <span className={`text-[10px] text-center ${sub}`}>-</span>
                          ) : (
                            <select
                              className={sel}
                              value={cfg.agg || 'sum'}
                              onChange={e => updateCol(t, col, { agg: e.target.value })}
                            >
                              {AGG_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ─── 계산 컬럼 ─── */}
                <div className={`px-5 py-4 ${dark ? '' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                      계산 컬럼
                      <span className={`font-normal ml-2 ${sub}`}>COUNT / AVG / 수식으로 새 지표 생성</span>
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
                      아직 계산 컬럼이 없습니다.
                    </p>
                  )}

                  <div className="flex flex-col gap-3">
                    {computed.map(cc => {
                      const ccType = cc.aggType === 'count' ? 'count'
                                   : cc.aggType === 'avg' ? 'avg'
                                   : 'formula'

                      /* 수식 미리보기 */
                      const signSymbol = { '+': '+ ', '-': '- ', '*': '× ', '/': '÷ ' }
                      const buildPv = (terms) => (terms || [])
                        .filter(trm => trm.type === 'group' ? (trm.children || []).some(c => c.col) : trm.col)
                        .map(trm => {
                          if (trm.type === 'group') return `${signSymbol[trm.sign] || '+ '}(${buildPv(trm.children || [])})`
                          const label = trm.col === '__const__'
                            ? String(trm.value ?? '')
                            : (columns[trm.col]?.alias || trm.col)
                          return `${signSymbol[trm.sign] || '+ '}${label}`
                        })
                        .join(' ')
                        .replace(/^\+ /, '')

                      const preview = ccType === 'count'
                        ? 'COUNT(*)'
                        : ccType === 'avg' && cc.terms?.[0]?.col
                          ? `AVG(${columns[cc.terms[0].col]?.alias || cc.terms[0].col})`
                          : buildPv(cc.terms)

                      const ccRefs = computed.filter(o => o.id !== cc.id && o.name)

                      /* 단일 항목 컨트롤 렌더 */
                      const ctrl = (trm, onUpdate, onRemove, canRemove) => (
                        <>
                          <select className={`${sel} w-10 text-center`} value={trm.sign}
                            onChange={e => onUpdate({ sign: e.target.value })}>
                            <option value="+">+</option><option value="-">-</option>
                            <option value="*">x</option><option value="/">÷</option>
                          </select>
                          <select className={`${sel} ${trm.col === '__const__' ? 'w-24' : 'flex-1'}`}
                            value={trm.col}
                            onChange={e => onUpdate({ col: e.target.value, ...(e.target.value === '__const__' ? { value: trm.value ?? 1 } : {}) })}>
                            <option value="">컬럼 선택...</option>
                            <option value="__const__">상수 (직접 입력)</option>
                            <optgroup label="컬럼">
                              {visCols.map(c => <option key={c} value={c}>{columns[c]?.alias || c}</option>)}
                            </optgroup>
                            {ccRefs.length > 0 && (
                              <optgroup label="계산 컬럼">
                                {ccRefs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                              </optgroup>
                            )}
                          </select>
                          {trm.col === '__const__' && (
                            <input type="number" className={`${inp} w-20 h-7 text-center`}
                              placeholder="1000" value={trm.value ?? ''}
                              onChange={e => onUpdate({ value: e.target.value })} />
                          )}
                          {canRemove && (
                            <button onClick={onRemove}
                              className={`p-0.5 shrink-0 rounded transition-colors ${dark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-400'}`}>
                              <Trash2 size={11} />
                            </button>
                          )}
                        </>
                      )

                      return (
                        <div key={cc.id}
                          className={`rounded-xl border p-4
                            ${dark ? 'border-[#252836] bg-[#13151C]' : 'border-slate-100 bg-slate-50'}`}
                        >
                          {/* 이름 + 타입 + 포맷 + 삭제 */}
                          <div className="flex items-center gap-2 mb-3">
                            <Calculator size={14} className={dark ? 'text-indigo-400' : 'text-indigo-500'} />
                            <input
                              className={`${inp} flex-1 font-semibold`}
                              placeholder="컬럼명 (예: 결제건수)"
                              value={cc.name}
                              onChange={e => updateComputed(t, cc.id, { name: e.target.value })}
                            />
                            <select
                              className={`${sel} w-[90px]`}
                              value={ccType}
                              onChange={e => changeComputedType(t, cc.id, e.target.value)}
                            >
                              {CC_TYPE_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
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

                          {/* 타입별 내용 */}
                          {ccType === 'count' ? (
                            /* COUNT(*) — 설정 불필요 */
                            <div className={`ml-6 text-[11px] px-3 py-2 rounded-lg font-medium
                              ${dark ? 'bg-[#1A1D27] text-slate-400' : 'bg-white text-slate-500 border border-slate-100'}`}>
                              COUNT(*) — 행 수를 자동 집계합니다
                            </div>
                          ) : ccType === 'avg' ? (
                            /* AVG(컬럼) — 컬럼 하나만 선택 */
                            <div className="ml-6 flex items-center gap-2">
                              <span className={`text-[11px] font-medium ${sub}`}>AVG(</span>
                              <select
                                className={`${sel} flex-1 max-w-xs`}
                                value={cc.terms?.[0]?.col || ''}
                                onChange={e => updateComputed(t, cc.id, { terms: [{ col: e.target.value, sign: '+' }] })}
                              >
                                <option value="">컬럼 선택...</option>
                                {visCols.map(c => <option key={c} value={c}>{columns[c]?.alias || c}</option>)}
                              </select>
                              <span className={`text-[11px] font-medium ${sub}`}>)</span>
                            </div>
                          ) : (
                            /* 수식 — 기존 term builder */
                            <div className="flex flex-col gap-1.5 ml-6">
                              {(cc.terms || []).map((term, idx) => {
                                /* 괄호 그룹 */
                                if (term.type === 'group') return (
                                  <div key={idx} className="flex items-start gap-2">
                                    <select className={`${sel} w-10 text-center mt-2`} value={term.sign}
                                      onChange={e => updateTerm(t, cc.id, idx, { sign: e.target.value })}>
                                      <option value="+">+</option><option value="-">-</option>
                                      <option value="*">x</option><option value="/">÷</option>
                                    </select>
                                    <div className={`flex-1 rounded-lg border pl-3 pr-2 py-2 flex flex-col gap-1.5
                                      ${dark ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-indigo-300/40 bg-indigo-50/50'}`}>
                                      <span className={`text-[10px] font-bold ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>(</span>
                                      {(term.children || []).map((child, cidx) => (
                                        <div key={cidx} className="flex items-center gap-2">
                                          {ctrl(child,
                                            u => updateTermInGroup(t, cc.id, idx, cidx, u),
                                            () => removeTermFromGroup(t, cc.id, idx, cidx),
                                            (term.children || []).length > 1
                                          )}
                                        </div>
                                      ))}
                                      <button onClick={() => addTermToGroup(t, cc.id, idx)}
                                        className={`text-[11px] px-2 py-0.5 rounded self-start transition-colors
                                          ${dark ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-500'}`}>
                                        + 항목 추가
                                      </button>
                                      <span className={`text-[10px] font-bold ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>)</span>
                                    </div>
                                    {cc.terms.length > 1 && (
                                      <button onClick={() => removeTerm(t, cc.id, idx)}
                                        className={`p-0.5 shrink-0 rounded transition-colors mt-2 ${dark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-400'}`}>
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>
                                )

                                /* 일반 항목 */
                                return (
                                  <div key={idx} className="flex items-center gap-2">
                                    {ctrl(term,
                                      u => updateTerm(t, cc.id, idx, u),
                                      () => removeTerm(t, cc.id, idx),
                                      cc.terms.length > 1
                                    )}
                                  </div>
                                )
                              })}

                              {/* term / 그룹 추가 */}
                              <div className="flex items-center gap-3">
                                <button onClick={() => addTerm(t, cc.id)}
                                  className={`text-[11px] px-2 py-1 rounded transition-colors
                                    ${dark ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-500'}`}>
                                  + 항목 추가
                                </button>
                                <button onClick={() => addGroup(t, cc.id)}
                                  className={`text-[11px] px-2 py-1 rounded transition-colors
                                    ${dark ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-500'}`}>
                                  ( ) 그룹 추가
                                </button>
                              </div>
                            </div>
                          )}

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

              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
