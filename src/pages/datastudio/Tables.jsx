import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useConfig, MARKETING_SEED_CONFIG } from '../../store/useConfig'
import { Table2, RefreshCw, ChevronDown, ChevronRight, Eye, EyeOff, Layers, Plus, Trash2, Save, Calculator, Check } from 'lucide-react'
import Spinner from '../../components/UI/Spinner'

export const TABLES = ['marketing_data', 'product_revenue_raw']

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
  const [saved, setSaved]     = useState({}) // { tableName: true } — 저장 피드백
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
          // 자동 초기화: 시드 config 또는 DB 컬럼 auto-detect
          const seed = t === 'marketing_data' ? MARKETING_SEED_CONFIG : null
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
          setColumnConfig(t, init) // 즉시 저장
        } else {
          // 기존 config 로드 + DB에만 있는 새 컬럼 자동 머지
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
          if (dirty) setColumnConfig(t, merged) // 새 컬럼 발견 시 자동 저장
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

  /* 괄호 그룹 추가 */
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

  /* 그룹 내부 term 추가 */
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

  /* 그룹 내부 term 삭제 */
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

  /* 그룹 내부 term 수정 */
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
                      /* 미리보기 수식 생성 (괄호 재귀) */
                      const signSymbol = { '+': '+ ', '-': '- ', '*': '× ', '/': '÷ ' }
                      const buildPv = (terms) => terms
                        .filter(t => t.type === 'group' ? (t.children || []).some(c => c.col) : t.col)
                        .map(t => {
                          if (t.type === 'group') return `${signSymbol[t.sign] || '+ '}(${buildPv(t.children || [])})`
                          const label = t.col === '__const__'
                            ? String(t.value ?? '')
                            : (columns[t.col]?.alias || t.col)
                          return `${signSymbol[t.sign] || '+ '}${label}`
                        })
                        .join(' ')
                        .replace(/^\+ /, '')
                      const preview = buildPv(cc.terms)

                      /* 드롭다운용 헬퍼 */
                      const visCols = (info?.columns || []).filter(c =>
                        columns[c]?.visible !== false && !LIKELY_DATE.has(c) && !LIKELY_DIMENSION.has(c))
                      const ccRefs = computed.filter(o => o.id !== cc.id && o.name)

                      /* 단일 항목 컨트롤 렌더 */
                      const ctrl = (trm, onUpdate, onRemove, canRemove) => (
                        <>
                          <select className={`${sel} w-10 text-center`} value={trm.sign}
                            onChange={e => onUpdate({ sign: e.target.value })}>
                            <option value="+">+</option><option value="-">−</option>
                            <option value="*">×</option><option value="/">÷</option>
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

                          {/* Terms (그룹 지원) */}
                          <div className="flex flex-col gap-1.5 ml-6">
                            {cc.terms.map((term, idx) => {
                              /* ── 괄호 그룹 ── */
                              if (term.type === 'group') return (
                                <div key={idx} className="flex items-start gap-2">
                                  <select className={`${sel} w-10 text-center mt-2`} value={term.sign}
                                    onChange={e => updateTerm(t, cc.id, idx, { sign: e.target.value })}>
                                    <option value="+">+</option><option value="-">−</option>
                                    <option value="*">×</option><option value="/">÷</option>
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

                              /* ── 일반 항목 ── */
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

                {/* ─── 샘플 데이터 ─── */}
                {info.sample.length > 0 && (
                  <div className={`overflow-x-auto border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={dark ? 'bg-[#0F1117]' : 'bg-slate-50'}>
                          {info.columns.map(c => (
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
                            {info.columns.map(c => (
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
