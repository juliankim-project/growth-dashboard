/**
 * columnUtils.js — 테이블별 동적 메트릭/그룹바이 + 계산 컬럼 평가
 *
 * marketing_data → 기존 METRICS/GROUP_BY 그대로 (하위호환)
 * 기타 테이블   → columnConfig 기반 동적 생성
 */
import { METRICS, GROUP_BY } from './useConfig'

/* ═══════════════════════════════════════════
   buildTableMetrics — METRICS 호환 배열 생성
   ═══════════════════════════════════════════ */
export function buildTableMetrics(tableName, columnConfig) {
  if (tableName === 'marketing_data' || !tableName) return METRICS

  const tCfg = columnConfig?.[tableName]
  if (!tCfg || !tCfg.columns || Object.keys(tCfg.columns).length === 0) return METRICS

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
  if (!tCfg) return GROUP_BY

  const dims = tCfg.dimensionColumns || []
  if (dims.length === 0) return GROUP_BY

  return dims.map(col => {
    const cfg = tCfg.columns?.[col]
    return { id: col, label: cfg?.alias || col }
  })
}

/* ═══════════════════════════════════════════
   applyComputedColumns — 계산 컬럼 값을 각 row에 추가
   terms 방식: [{ col, sign }] → 순차 합산
   ═══════════════════════════════════════════ */
export function applyComputedColumns(rows, tableName, columnConfig) {
  const tCfg = columnConfig?.[tableName]
  const computed = tCfg?.computed
  if (!computed || computed.length === 0) return rows

  return rows.map(row => {
    const newRow = { ...row }

    computed.forEach(cc => {
      if (!cc.terms || cc.terms.length === 0) { newRow[cc.id] = 0; return }
      let val = 0
      cc.terms.forEach(term => {
        const v = parseFloat(newRow[term.col]) || 0
        val = term.sign === '-' ? val - v : val + v
      })
      newRow[cc.id] = val
    })

    return newRow
  })
}
