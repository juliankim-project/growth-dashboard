/**
 * 고정 키워드 셋 — 여행/숙박 수요 측정 기준
 *
 * [구조]
 * 1. 숙소 유형별 (ACCOM_TYPE_KEYWORDS): 전체 여행 수요를 구성하는 7개 유형
 * 2. 권역별 (REGION_MAP): 우리 지점이 있는 지역 → 권역 매핑
 * 3. 지역별 (AREA_KEYWORDS): 각 지역에 대한 검색 키워드 셋
 *
 * ⚠️ 이 파일은 프론트 + Edge Function 양쪽에서 참조하는 Single Source of Truth
 *    Edge Function에서는 이 구조를 TypeScript로 복제해서 사용
 */

/* ═══════════════════════════════════════════
   1. 숙소 유형별 키워드 (전체 여행 수요)
   ═══════════════════════════════════════════ */
export const ACCOM_TYPE_KEYWORDS = [
  { id: 'accommodation', label: '숙소',      keywords: ['숙소', '숙소 추천', '숙소 예약'] },
  { id: 'travel',        label: '여행',      keywords: ['여행', '국내 여행', '국내여행'] },
  { id: 'pension',       label: '펜션',      keywords: ['펜션', '펜션 예약', '펜션 추천'] },
  { id: 'hotel',         label: '호텔',      keywords: ['호텔', '호텔 예약', '호텔 추천'] },
  { id: 'lodging',       label: '숙박',      keywords: ['숙박', '숙박 예약', '숙박 추천'] },
  { id: 'residence',     label: '레지던스',  keywords: ['레지던스', '서비스 레지던스'] },
  { id: 'airbnb',        label: '에어비앤비', keywords: ['에어비앤비', '에어비엔비'] },
]

/* 전체 여행 수요 = 위 7개 유형의 대표 키워드 합산 */
export const DEMAND_KEYWORDS = ACCOM_TYPE_KEYWORDS.map(t => t.keywords[0])
// → ['숙소', '여행', '펜션', '호텔', '숙박', '레지던스', '에어비앤비']

/* ═══════════════════════════════════════════
   2. 권역 매핑
   ═══════════════════════════════════════════ */
export const REGION_MAP = {
  '서울': '수도권', '경기': '수도권', '인천': '수도권',
  '부산': '동남권', '울산': '동남권', '경남': '동남권', '창원': '동남권', '통영': '동남권', '거제': '동남권',
  '대구': '대경권', '경북': '대경권', '경주': '대경권', '포항': '대경권',
  '광주': '호남권', '전남': '호남권', '전북': '호남권', '여수': '호남권', '목포': '호남권',
  '대전': '충청권', '충남': '충청권', '충북': '충청권', '세종': '충청권',
  '강원': '강원권', '속초': '강원권', '춘천': '강원권', '강릉': '강원권', '평창': '강원권',
  '제주': '제주권',
}

export const REGION_COLORS = {
  '수도권': '#579DFF', '제주권': '#10B981', '동남권': '#F59E0B',
  '호남권': '#EF4444', '강원권': '#8B5CF6', '대경권': '#EC4899',
  '충청권': '#06B6D4', '기타': '#94A3B8',
}

/* ═══════════════════════════════════════════
   3. 지역별 키워드 셋 (우리 지점이 있는 지역 기준)
   - 각 지역의 수요 = 해당 키워드들의 검색량 합산
   - suffix: 지역명 + 숙소유형 조합
   ═══════════════════════════════════════════ */
const AREA_SUFFIXES = ['숙소', '호텔', '펜션', '숙박', '여행', '리조트']

export function buildAreaKeywords(area) {
  return [
    area,
    ...AREA_SUFFIXES.map(s => `${area} ${s}`),
    ...AREA_SUFFIXES.map(s => `${area}${s}`),  // 붙여쓰기도 수집
  ]
}

/* 프로덕 데이터에서 나온 지역 목록에 대해 키워드 셋 생성 */
export function buildAllAreaKeywords(areas) {
  const result = {}
  areas.forEach(area => {
    result[area] = {
      area,
      region: getRegion(area),
      keywords: buildAreaKeywords(area),
    }
  })
  return result
}

/* ═══════════════════════════════════════════
   4. 브랜드(지점) 키워드
   ═══════════════════════════════════════════ */
export function buildBrandKeywords(branchName) {
  if (!branchName) return []
  return [
    branchName,
    `${branchName} 예약`,
    `${branchName} 가격`,
  ]
}

/* ═══════════════════════════════════════════
   유틸
   ═══════════════════════════════════════════ */
export function getRegion(area) {
  if (!area) return '기타'
  for (const [key, region] of Object.entries(REGION_MAP)) {
    if (area.includes(key)) return region
  }
  return '기타'
}

/**
 * 전체 수집 대상 키워드 목록 생성
 * @param {string[]} areas - DB에서 가져온 지역 목록
 * @param {string[]} brands - DB에서 가져온 지점명 목록
 * @returns {{ keyword, group, area?, region? }[]}
 */
export function buildCollectorKeywordList(areas, brands) {
  const list = []
  const seen = new Set()

  const add = (keyword, group, area = null) => {
    if (seen.has(keyword)) return
    seen.add(keyword)
    list.push({ keyword, group, area, region: area ? getRegion(area) : null })
  }

  // 1. 숙소 유형별 (전체 수요)
  ACCOM_TYPE_KEYWORDS.forEach(type => {
    type.keywords.forEach(kw => add(kw, 'accom_type'))
  })

  // 2. 지역별
  areas.forEach(area => {
    buildAreaKeywords(area).forEach(kw => add(kw, 'area', area))
  })

  // 3. 브랜드별
  brands.forEach(brand => {
    buildBrandKeywords(brand).forEach(kw => add(kw, 'brand'))
  })

  return list
}
