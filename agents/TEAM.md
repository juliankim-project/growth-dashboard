# Growth Dashboard — Agent Team

> 이 디렉토리에는 Growth Dashboard 프로젝트 전용 에이전트 7명의 역할 정의가 들어 있습니다.
> 각 에이전트 파일(.md)을 시스템 프롬프트로 사용하면, 해당 도메인에 특화된 응답을 받을 수 있습니다.

---

## 프로젝트 개요

| 항목 | 값 |
|---|---|
| 스택 | React 19 + Vite 7 + Tailwind 4 + Recharts 3 + Supabase |
| 인증 | Keycloak SSO + Supabase Magic Link |
| DB 테이블 | `marketing_data`, `product_revenue_raw`, `column_definitions`, `table_metadata`, `dashboard_config`, `column_configs`, `excluded_users` |
| 위젯 | KPI · Line · Bar · Table · Funnel · Pie · Comparison · Ranking · Alert · Timeline (10종) |
| 페이지 | Overview · Marketing · Product · UserAnalysis · DataStudio · AI Lab · Settings |

---

## 에이전트 목록

| # | 파일명 | 역할 | 주요 담당 |
|---|---|---|---|
| 1 | `01-data-engineer.md` | Data Engineer | Supabase DB, 컬럼 매핑, 데이터 파이프라인, Migration |
| 2 | `02-frontend-dev.md` | Frontend Dev | React 컴포넌트, 위젯, UI/UX, 성능 최적화 |
| 3 | `03-revenue-analyst.md` | Revenue Analyst | Revenue/OCC/ADR/LOS 지표 분석, 매출 리포트 |
| 4 | `04-reservation-user-analyst.md` | Reservation & User Analyst | 체크인페이스, 유저세그먼트, 코호트, LTV |
| 5 | `05-search-ad-specialist.md` | Search Ad Specialist | 네이버/구글 SA, 키워드 트렌드, 검색광고 최적화 |
| 6 | `06-strategy-manager.md` | Strategy Manager | 크로스 분석, 종합 보고서, 액션 도출 |
| 7 | `07-performance-marketer.md` | Performance Marketer | ROAS/CPC 최적화, 예산 배분, 채널 믹스 전략 |

---

## 사용법

### Claude Code에서
```bash
# 특정 에이전트에게 질문
cat agents/03-revenue-analyst.md | claude -p "이번 달 ADR이 전월 대비 하락한 원인을 분석해줘"
```

### Cowork / 대화에서
> "Revenue Analyst 에이전트로 전환해서, product_revenue_raw 테이블의 ADR 트렌드를 분석해줘"

### 여러 에이전트 협업
> "Data Engineer가 쿼리를 짜고, Revenue Analyst가 결과를 해석해줘"

---

## 공통 컨텍스트 (모든 에이전트 공유)

### DB 스키마 핵심
- **marketing_data**: date, channel, campaign, ad_group, ad_creative, content, term, spend, impressions, clicks, view_content, signups, purchases, revenue, installs, cpc
- **product_revenue_raw**: reservation_date, check_in_date, nights, peoples, payment_amount, original_price, brand_name, branch_name, channel_name, channel_group, area, room_type_name, room_type2, guest_id, user_id, status, lead_time
- **column_definitions**: 컬럼 메타 (category: metric/dimension/derived/computed/hidden, fmt, agg, formula, terms_json)
- **table_metadata**: 테이블별 display_name, date_column

### 파생 지표 (marketing_data)
- ROAS = revenue / spend
- CTR = (clicks / impressions) × 100
- CPM = (spend / impressions) × 1000
- CPA(조회) = spend / view_content
- CAC = spend / signups
- CPS = spend / purchases
- CVR-C = (signups / clicks) × 100
- CVR-S = (purchases / clicks) × 100

### 산출 지표 (product_revenue_raw)
- 결제건수 = COUNT(DISTINCT no)
- 총 결제금액 = payment_amount - (staypass_discount + promo_discount + coupon_discount_amount + point_amount)
- LOS = SUM(nights) / COUNT(*)
- ADR = SUM(payment_amount) / SUM(nights)
- 객단가 = SUM(payment_amount) / COUNT(*)
- 리드타임 = check_in_date - reservation_date (일수)

### 프론트엔드 핵심
- 위젯 시스템: useConfig → TEMPLATES (A/B/C/D) → slots → widget type/config
- 데이터 fetching: fetchAll (페이지네이션) → 30분 메모리캐시 → 클라이언트 날짜 필터
- 컬럼 설정: column_definitions (DB) → useColumnConfig hook → widgetMetricConfig
- Realtime: Supabase Realtime으로 config/column 변경 실시간 동기화
