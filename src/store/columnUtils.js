/**
 * columnUtils.js — 테이블별 동적 메트릭/그룹바이 + 계산 컬럼 평가
 *
 * 모든 테이블 → columnConfig 기반 동적 생성 (Single Source of Truth)
 */

export const TABLES = ['marketing_data', 'product_revenue_raw']

/* ── 컬럼명 → 표시명 변환 (snake_case → Readable) ── */
function prettifyColumnName(col) {
  if (!col) return col
  return col
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** 컬럼 표시명: alias > prettify */
export function getColumnLabel(col, cfg) {
  if (cfg?.alias) return cfg.alias
  return prettifyColumnName(col)
}

/* ── 테이블 표시명 매핑 ── */
const TABLE_DISPLAY_NAMES = {
  marketing_data: '마케팅 데이터',
  product_revenue_raw: '상품 매출',
}

/** 테이블 표시명 반환 — displayName → 매핑 → columnConfig 기반 → 원본 */
export function getTableDisplayName(tableName, columnConfig) {
  // 1) columnConfig에 displayName이 있으면 사용
  const tCfg = columnConfig?.[tableName]
  if (tCfg?.displayName) return tCfg.displayName
  // 2) 알려진 테이블명 매핑
  if (TABLE_DISPLAY_NAMES[tableName]) return TABLE_DISPLAY_NAMES[tableName]
  // 3) 언더스코어 → 공백 치환
  return tableName.replace(/_/g, ' ')
}

/* ═══════════════════════════════════════════
   buildTableMetrics — METRICS 호환 배열 생성
   ═══════════════════════════════════════════ */

/* 마케팅 파생지표 — buildTableMetrics 전용 (순환 import 방지) */
const MARKETING_DERIVED = [
  { id: 'roas',     label: 'ROAS',       field: null, fmt: 'roas',     derived: true, group: 'rate' },
  { id: 'ctr',      label: 'CTR',        field: null, fmt: 'pct',      derived: true, group: 'rate' },
  { id: 'cpm',      label: 'CPM',        field: null, fmt: 'currency', derived: true, group: 'rate' },
  { id: 'cpa_view', label: 'CPA(조회)',  field: null, fmt: 'currency', derived: true, group: 'rate' },
  { id: 'cac',      label: 'CAC',        field: null, fmt: 'currency', derived: true, group: 'rate' },
  { id: 'cps',      label: 'CPS',        field: null, fmt: 'currency', derived: true, group: 'rate' },
  { id: 'cvr_c',    label: 'CVR-C',      field: null, fmt: 'pct',      derived: true, group: 'rate' },
  { id: 'cvr_s',    label: 'CVR-S',      field: null, fmt: 'pct',      derived: true, group: 'rate' },
]

export function buildTableMetrics(tableName, columnConfig) {
  if (!tableName) return []

  const tCfg = columnConfig?.[tableName]
  if (!tCfg || !tCfg.columns || Object.keys(tCfg.columns).length === 0) return []

  const dims = new Set(tCfg.dimensionColumns || [])
  const metrics = []

  /* 1) 실제 컬럼 → 메트릭 (visible + non-dimension) */
  Object.entries(tCfg.columns).forEach(([col, cfg]) => {
    if (cfg.visible === false) return
    if (dims.has(col)) return
    metrics.push({
      id: col,
      label: getColumnLabel(col, cfg),
      field: col,
      fmt: cfg.fmt || 'number',
      agg: cfg.agg || 'sum',
      group: 'metric',
    })
  })

  /* 2) 계산 컬럼 → 메트릭 */
  ;(tCfg.computed || []).forEach(cc => {
    const isCount = cc.aggType === 'count'

    /* 비율 지표 감지: terms에 '/' 연산이 있으면 분자/분모 분리
       예: LOS = [{ col:'nights', sign:'+' }, { col:'cc_order_count', sign:'/' }]
       → _ratioTerms: { num: 'nights', den: 'cc_order_count' }
       집계 시 SUM(분자) / SUM(분모) 로 정확히 계산 */
    let _ratioTerms = null
    if (!isCount && cc.terms?.length >= 2) {
      const divIdx = cc.terms.findIndex(t => t.sign === '/')
      if (divIdx > 0) {
        const numCols = cc.terms.slice(0, divIdx).map(t => t.col).filter(Boolean)
        const denTerm = cc.terms[divIdx]
        if (numCols.length === 1 && denTerm?.col) {
          _ratioTerms = { num: numCols[0], den: denTerm.col }
        }
      }
    }

    metrics.push({
      id: cc.id,
      label: cc.name,
      field: cc.id,
      fmt: cc.fmt || 'number',
      agg: _ratioTerms ? 'ratio' : (cc.aggType || 'sum'),
      _countType: isCount,
      _ratioTerms,
      group: 'computed',
      _computed: true,
    })
  })

  /* 3) 마케팅 테이블 → 파생지표 (ROAS, CTR 등) 자동 포함 */
  if (tableName === 'marketing_data') {
    MARKETING_DERIVED.forEach(dm => {
      if (!metrics.find(x => x.id === dm.id)) {
        metrics.push({ ...dm })
      }
    })
  }

  return metrics
}

/* ═══════════════════════════════════════════
   buildTableGroupBy — GROUP_BY 호환 배열 생성
   ═══════════════════════════════════════════ */
export function buildTableGroupBy(tableName, columnConfig) {
  if (!tableName) return []

  const tCfg = columnConfig?.[tableName]
  if (!tCfg) return []

  const dims = tCfg.dimensionColumns || []

  // dimensionColumns 설정됨 → 그대로 사용
  if (dims.length > 0) {
    return dims.map(col => {
      const cfg = tCfg.columns?.[col]
      return { id: col, label: getColumnLabel(col, cfg) }
    })
  }

  // dimensionColumns 미설정 → visible 컬럼 전체를 그룹바이 후보로
  if (tCfg.columns) {
    const result = []
    Object.entries(tCfg.columns).forEach(([col, cfg]) => {
      if (cfg.visible === false) return
      result.push({ id: col, label: getColumnLabel(col, cfg) })
    })
    if (result.length > 0) return result
  }

  return []
}

/* ═══════════════════════════════════════════
   buildWidgetMetrics / buildWidgetGroupBy
   — widgetMetricConfig 적용 (표시순서 · 표시/숨김 필터)
   — config 없으면 buildTableMetrics 그대로 반환 (하위 호환)
   ═══════════════════════════════════════════ */
function applyWidgetFilter(all, wmCfg) {
  if (!wmCfg?.enabled || !wmCfg.items?.length) return all
  const orderMap = new Map()
  wmCfg.items.forEach((item, idx) => orderMap.set(item.id, { order: idx, visible: item.visible !== false, label: item.label }))
  const configured = []
  const unconfigured = []
  all.forEach(m => {
    const entry = orderMap.get(m.id)
    if (entry) {
      if (entry.visible) {
        const item = entry.label ? { ...m, label: entry.label } : m
        configured.push({ item, order: entry.order })
      }
    } else {
      unconfigured.push(m)
    }
  })
  configured.sort((a, b) => a.order - b.order)
  return [...configured.map(c => c.item), ...unconfigured]
}

export function buildWidgetMetrics(tableName, columnConfig) {
  const all = buildTableMetrics(tableName, columnConfig)
  return applyWidgetFilter(all, columnConfig?.[tableName]?.widgetMetricConfig?.metrics)
}

export function buildWidgetGroupBy(tableName, columnConfig) {
  const all = buildTableGroupBy(tableName, columnConfig)
  return applyWidgetFilter(all, columnConfig?.[tableName]?.widgetMetricConfig?.groupBy)
}

/* ═══════════════════════════════════════════
   applyComputedColumns — 계산 컬럼 값을 각 row에 추가
   terms: [{ col, sign, value?, type?, children? }]
   type === 'group' → 괄호 그룹 (재귀 평가)
   col === '__const__' → 상수 (value 사용)
   ═══════════════════════════════════════════ */
function evalTerms(terms, row) {
  let val = 0
  ;(terms || []).forEach(term => {
    let v
    if (term.type === 'group') {
      v = evalTerms(term.children, row)
    } else if (term.col === '__const__') {
      v = parseFloat(term.value) || 0
    } else {
      v = parseFloat(row[term.col]) || 0
    }
    switch (term.sign) {
      case '-': val -= v; break
      case '*': val *= v; break
      case '/': val = v !== 0 ? val / v : 0; break
      default:  val += v; break
    }
  })
  return val
}

/* ═══════════════════════════════════════════
   sanitizeWidgetConfig — 위젯 config의 메트릭을 테이블 columnConfig 기준으로 정리
   테이블에 존재하지 않는 메트릭 → 자동 제거, 빈 경우 첫 메트릭으로 폴백
   ═══════════════════════════════════════════ */
export function sanitizeWidgetConfig(widgetType, config, tableName, columnConfig) {
  if (!config || !tableName || !columnConfig) return config

  const validMetrics = buildTableMetrics(tableName, columnConfig)
  if (validMetrics.length === 0) return config

  const validIds = new Set(validMetrics.map(m => m.id))
  const first = validMetrics[0].id
  const validGroupBy = buildTableGroupBy(tableName, columnConfig)
  const validGbIds = new Set(validGroupBy.map(g => g.id))
  const firstGb = validGroupBy[0]?.id

  const next = { ...config }
  let changed = false

  /* 단일 메트릭 (kpi, bar, pie, ranking) */
  if ('metric' in next) {
    if (next.metric && !validIds.has(next.metric)) {
      next.metric = first
      changed = true
    }
  }

  /* 복수 메트릭 (line, table, comparison, alert, timeline) */
  if (Array.isArray(next.metrics)) {
    const filtered = next.metrics.filter(mid => validIds.has(mid))
    if (filtered.length !== next.metrics.length) {
      next.metrics = filtered.length > 0 ? filtered : [first]
      changed = true
    }
  }

  /* 그룹바이 */
  if (next.groupBy && validGbIds.size > 0 && !validGbIds.has(next.groupBy)) {
    next.groupBy = firstGb
    changed = true
  }

  /* 퍼널 stages 내 metric */
  if (Array.isArray(next.stages)) {
    const newStages = next.stages.map(s => {
      if (s.metric && !validIds.has(s.metric)) return { ...s, metric: first }
      return s
    })
    if (JSON.stringify(newStages) !== JSON.stringify(next.stages)) {
      next.stages = newStages
      changed = true
    }
  }

  /* alert thresholds — 존재하지 않는 메트릭 키 제거 */
  if (next.thresholds && typeof next.thresholds === 'object') {
    const newTh = {}
    let thChanged = false
    for (const [k, v] of Object.entries(next.thresholds)) {
      if (validIds.has(k)) { newTh[k] = v } else { thChanged = true }
    }
    if (thChanged) { next.thresholds = newTh; changed = true }
  }

  return changed ? next : config
}

export function applyComputedColumns(rows, tableName, columnConfig) {
  const tCfg = columnConfig?.[tableName]
  const computed = tCfg?.computed
  if (!computed || computed.length === 0) return rows

  return rows.map(row => {
    const newRow = { ...row }
    computed.forEach(cc => {
      if (cc.aggType === 'count') {
        newRow[cc.id] = 1  // COUNT: 각 행 = 1 → SUM으로 자연스럽게 카운트
      } else {
        newRow[cc.id] = (!cc.terms || cc.terms.length === 0) ? 0 : evalTerms(cc.terms, newRow)
      }
    })
    return newRow
  })
}
