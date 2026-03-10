import { useState, useMemo } from 'react'

/**
 * 공유 검색 필터 훅 — MetricPicker, GroupByPicker에서 사용
 * @param {Array} items - 검색 대상 배열
 * @param {string} labelKey - 검색에 사용할 프로퍼티 키 (기본 'label')
 */
export function usePickerSearch(items, labelKey = 'label') {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(item => {
      const label = item[labelKey] || ''
      const id = item.id || ''
      return label.toLowerCase().includes(q) || id.toLowerCase().includes(q)
    })
  }, [items, query, labelKey])

  return { query, setQuery, filtered }
}
