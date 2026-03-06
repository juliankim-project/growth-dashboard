/**
 * columnUtils.js — 테이블별 동적 메트릭/그룹바이 + 계산 컬럼 평가
 *
 * marketing_data → 기존 METRICS/GROUP_BY 그대로 (하위호환)
 * 기타 테이블   → columnConfig 기반 동적 생성
 */
import { METRICS, GROUP_BY } from './useConfig'

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
export function buildTableMetrics(tableName, columnConfig) {
  if (tableName === 'marketing_data' || !tableName) return METRICS

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
      label: cfg.alias || col,
      field: col,
      fmt: cfg.fmt || 'number',
      group: 'metric',
    })
  })

  /* 2) 계산 컬럼 → 메트릭 */
  ;(tCfg.computed || []).forEach(cc => {
    metrics.push({
      id: cc.id,
      label: cc.name,
      field: cc.id,          // applyComputedColumns에서 row[cc.id]로 저장됨
      fmt: cc.fmt || 'number',
      group: 'computed',
      _computed: true,
    })
  })

  return metrics
}

/* ═══════════════════════════════════════════
   buildTableGroupBy — GROUP_BY 호환 배열 생성
   ═══════════════════════════════════════════ */
export function buildTableGroupBy(tableName, columnConfig) {
  if (tableName === 'marketing_data' || !tableName) return GROUP_BY

  const tCfg = columnConfig?.[tableName]
  if (!tCfg) return []

  const dims = tCfg.dimensionColumns || []

  // dimensionColumns 설정됨 → 그대로 사용
  if (dims.length > 0) {
    return dims.map(col => {
      const cfg = tCfg.columns?.[col]
      return { id: col, label: cfg?.alias || col }
    })
  }

  // dimensionColumns 미설정 → visible 컬럼 전체를 그룹바이 후보로
  if (tCfg.columns) {
    const result = []
    Object.entries(tCfg.columns).forEach(([col, cfg]) => {
      if (cfg.visible === false) return
      result.push({ id: col, label: cfg.alias || col })
    })
    if (result.length > 0) return result
  }

  return []
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

export function applyComputedColumns(rows, tableName, columnConfig) {
  const tCfg = columnConfig?.[tableName]
  const computed = tCfg?.computed
  if (!computed || computed.length === 0) return rows

  return rows.map(row => {
    const newRow = { ...row }
    computed.forEach(cc => {
      newRow[cc.id] = (!cc.terms || cc.terms.length === 0) ? 0 : evalTerms(cc.terms, newRow)
    })
    return newRow
  })
}
