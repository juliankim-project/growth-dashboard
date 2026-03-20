/**
 * 상품 데이터에서 검색 키워드 추출 유틸리티
 * 호텔/숙박 비즈니스 기준의 키워드 조합 생성
 */

/**
 * 지역명에서 확장 키워드 생성
 * 예: "제주" -> ["제주", "제주도", "제주 여행"]
 */
function expandAreaKeywords(area) {
  if (!area) return []
  const base = area.trim()
  const variants = [base]

  // 도시명 확장
  const areaKeywords = {
    '제주': ['제주도', '제주 여행', '제주 숙박'],
    '서울': ['서울 숙박', '서울 호텔', '서울 룸'],
    '부산': ['부산 숙박', '부산 호텔'],
    '강원': ['강원도 숙박', '강원 여행'],
    '경주': ['경주 숙박', '경주 호텔'],
    '통영': ['통영 숙박', '통영 여행'],
    '여수': ['여수 숙박', '여수 호텔'],
    '인천': ['인천 숙박', '인천 호텔'],
    '경기': ['경기도 숙박'],
  }

  if (areaKeywords[base]) {
    variants.push(...areaKeywords[base])
  }

  // 공통 서픽스 추가
  variants.push(`${base} 숙박`)
  variants.push(`${base} 리조트`)
  variants.push(`${base} 호텔`)

  return [...new Set(variants)]
}

/**
 * 브랜드명에서 확장 키워드 생성
 * 예: "해비치호텔" -> ["해비치호텔", "해비치", "해비치 예약"]
 */
function expandBrandKeywords(brand) {
  if (!brand) return []
  const base = brand.trim()
  const variants = [base]

  // 공통 서픽스 제거 (호텔, 리조트 등)
  const shorterName = base
    .replace(/호텔|리조트|펜션|풀빌라|에어비앤비/g, '')
    .trim()

  if (shorterName && shorterName !== base) {
    variants.push(shorterName)
    variants.push(`${shorterName} 호텔`)
    variants.push(`${shorterName} 리조트`)
  }

  // 예약, 가격 관련
  variants.push(`${base} 예약`)
  variants.push(`${base} 가격`)
  variants.push(`${base} 후기`)

  return [...new Set(variants)]
}

/**
 * 지역 + 브랜드 조합 키워드 생성
 * 예: ("제주", "해비치호텔") -> ["제주 해비치호텔", "해비치호텔 제주", ...]
 */
function createCombinationKeywords(area, brand) {
  if (!area || !brand) return []
  const variants = []

  const a = area.trim()
  const b = brand.trim()

  // 지역 먼저
  variants.push(`${a} ${b}`)
  variants.push(`${a}의 ${b}`)

  // 브랜드 먼저
  variants.push(`${b} ${a}`)

  // 예약
  variants.push(`${a} ${b} 예약`)

  return [...new Set(variants)]
}

/**
 * 객실 타입 관련 키워드
 * 예: "스탠다드" -> ["스탠다드", "스탠다드 룸", "트윈 룸"]
 */
function expandRoomTypeKeywords(roomType) {
  if (!roomType) return []
  const base = roomType.trim()
  const variants = [base]

  // 공통 확장
  if (!base.includes('룸') && !base.includes('방')) {
    variants.push(`${base} 룸`)
  }

  // 숙박 관련
  variants.push(`${base} 숙박`)
  variants.push(`${base} 가격`)

  return [...new Set(variants)]
}

/**
 * 상품 데이터 배열로부터 모든 추출 가능한 키워드 생성
 * @param {Array} productData - {area, branch_name, room_type_name, brand_name, ...} 형태의 배열
 * @param {Object} options - {limit, deduplicate, minLength}
 * @returns {Array} 추출된 키워드 배열
 */
export function extractKeywordsFromProducts(productData, options = {}) {
  const { limit = 50, deduplicate = true, minLength = 2 } = options

  if (!Array.isArray(productData) || productData.length === 0) {
    return []
  }

  const keywordSet = new Set()

  productData.forEach(item => {
    const { area, branch_name, room_type_name, brand_name } = item

    // 지역 키워드
    if (area) {
      expandAreaKeywords(area).forEach(kw => {
        if (kw.length >= minLength) keywordSet.add(kw)
      })
    }

    // 브랜드 키워드
    if (branch_name || brand_name) {
      const brandName = branch_name || brand_name
      expandBrandKeywords(brandName).forEach(kw => {
        if (kw.length >= minLength) keywordSet.add(kw)
      })
    }

    // 객실 타입 키워드
    if (room_type_name) {
      expandRoomTypeKeywords(room_type_name).forEach(kw => {
        if (kw.length >= minLength) keywordSet.add(kw)
      })
    }

    // 지역 + 브랜드 조합
    if (area && (branch_name || brand_name)) {
      const brandName = branch_name || brand_name
      createCombinationKeywords(area, brandName).forEach(kw => {
        if (kw.length >= minLength) keywordSet.add(kw)
      })
    }
  })

  // 지역별 고유 키워드 (핵심)
  const areaSet = new Set(productData.map(r => r.area).filter(Boolean))
  areaSet.forEach(area => {
    keywordSet.add(`${area} 숙박`)
    keywordSet.add(`${area} 호텔`)
    keywordSet.add(`${area} 리조트`)
  })

  // 브랜드별 고유 키워드 (핵심)
  const brandSet = new Set(
    productData.map(r => r.branch_name || r.brand_name).filter(Boolean)
  )
  brandSet.forEach(brand => {
    keywordSet.add(brand)
    keywordSet.add(`${brand} 예약`)
  })

  let keywords = Array.from(keywordSet)

  // 제한 적용
  if (limit && keywords.length > limit) {
    keywords = keywords.slice(0, limit)
  }

  return keywords.sort()
}

/**
 * 키워드를 카테고리별로 분류
 * @param {Array} keywords - 키워드 배열
 * @returns {Object} {branded, generic, regional, ...}
 */
export function classifyKeywords(keywords) {
  const classified = {
    branded: [],      // 특정 브랜드/숙소
    regional: [],     // 지역명 포함
    generic: [],      // 일반 (숙박, 호텔, 리조트 등)
    room: [],         // 객실 타입
    other: [],
  }

  keywords.forEach(kw => {
    if (kw.includes('호텔') || kw.includes('숙소') || kw.includes('숙박')) {
      if (kw.match(/제주|서울|부산|강원|경주|통영|여수|인천|경기/)) {
        classified.regional.push(kw)
      } else {
        classified.generic.push(kw)
      }
    } else if (kw.includes('리조트') || kw.includes('펜션') || kw.includes('풀빌라')) {
      classified.generic.push(kw)
    } else if (kw.includes('룸') || kw.includes('방')) {
      classified.room.push(kw)
    } else if (kw.includes('예약') || kw.includes('가격') || kw.includes('후기')) {
      classified.generic.push(kw)
    } else {
      // 브랜드명으로 보임
      classified.branded.push(kw)
    }
  })

  return classified
}

/**
 * 유사한 키워드 그룹화
 * 예: ["제주 호텔", "제주 숙박", "제주 리조트"] -> "제주"
 */
export function groupSimilarKeywords(keywords) {
  const groups = {}

  keywords.forEach(kw => {
    // 지역 추출
    const areaMatch = kw.match(/제주|서울|부산|강원|경주|통영|여수|인천|경기/)
    if (areaMatch) {
      const area = areaMatch[0]
      if (!groups[area]) groups[area] = []
      groups[area].push(kw)
      return
    }

    // 브랜드 추출 (공백으로 분리된 첫 단어)
    const parts = kw.split(/\s+/)
    const key = parts[0]
    if (!groups[key]) groups[key] = []
    groups[key].push(kw)
  })

  return groups
}

/**
 * 추천 키워드 생성 (상품 데이터 기반 최적화)
 */
export function getRecommendedKeywords(productData, maxCount = 10) {
  const allKeywords = extractKeywordsFromProducts(productData, {
    limit: 100,
    deduplicate: true,
  })

  // 우선순위: 지역 + 호텔/숙박, 브랜드 이름, 지역명만
  const prioritized = [
    ...allKeywords.filter(k =>
      k.match(/제주|서울|부산|강원|경주|통영|여수|인천|경기/) &&
      k.match(/호텔|숙박|리조트/)
    ),
    ...allKeywords.filter(k =>
      k.length > 3 && !k.match(/예약|가격|후기/) &&
      !k.match(/제주|서울|부산|강원|경주|통영|여수|인천|경기/)
    ),
    ...allKeywords.filter(k =>
      k.match(/제주|서울|부산|강원|경주|통영|여수|인천|경기/)
    ),
  ]

  // 중복 제거 + 제한
  return [...new Set(prioritized)].slice(0, maxCount)
}
