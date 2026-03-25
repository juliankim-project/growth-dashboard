"""
revu_app.py 크롤링 결과 → Supabase 저장 모듈
──────────────────────────────────────────────
사용법:
  from supabase_sync import save_crawl_to_supabase
  result = save_crawl_to_supabase(crawl_json, ai_scores=None)

환경변수:
  SUPABASE_URL          (= VITE_SUPABASE_URL)
  SUPABASE_SERVICE_KEY   (= SUPABASE_SERVICE_ROLE_KEY)
  → .env 또는 streamlit secrets 에서 읽음
"""
import os, json, logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── Supabase 클라이언트 (service_role — RLS 무시) ───
_client = None

def _get_client():
    global _client
    if _client:
        return _client
    try:
        from supabase import create_client
    except ImportError:
        raise ImportError("supabase-py 패키지가 필요합니다: pip install supabase")

    # .env 파일에서 읽기 (프로젝트 루트 기준)
    env_path = Path(__file__).resolve().parent.parent / ".env"
    env_vars = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip()

    url = os.getenv("SUPABASE_URL") or env_vars.get("VITE_SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY") or env_vars.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not url or not key:
        raise ValueError("SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 필요합니다 (.env 확인)")

    _client = create_client(url, key)
    return _client


# ─── 메인: 크롤링 JSON → Supabase 저장 ───
def save_crawl_to_supabase(crawl_json: dict, ai_scores: dict | None = None) -> dict:
    """
    crawl_json : crawl_revu() / crawl_revu_insta() 리턴값
                 {"meta": {...}, "influencers": [...]}
    ai_scores  : {nickname_or_handle: float} — AI 점수 매핑 (선택)

    Returns:
      {"ok": True, "campaign_pk": int, "applicant_count": int}
      {"ok": False, "error": str}
    """
    sb = _get_client()
    meta = crawl_json.get("meta", {})
    influencers = crawl_json.get("influencers", [])

    if not meta.get("campaign_id"):
        return {"ok": False, "error": "meta.campaign_id 없음"}

    # platform이 None/빈값이면 기본값 "naver" 적용
    platform = meta.get("platform") or "naver"
    campaign_id = str(meta["campaign_id"])

    # 1) 기존 캠페인 존재 여부 확인 ─────────────────
    campaign_pk = None
    try:
        existing = (
            sb.table("revu_campaigns")
            .select("id")
            .eq("campaign_id", campaign_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            campaign_pk = existing.data[0]["id"]
            logger.info(f"기존 캠페인 발견: campaign_id={campaign_id}, pk={campaign_pk}")
    except Exception as e:
        logger.warning(f"기존 캠페인 조회 실패: {e}")

    campaign_row = {
        "campaign_id":    campaign_id,
        "campaign_title": meta.get("campaign_title", ""),
        "platform":       platform,
        "crawled_at":     meta.get("crawled_at", datetime.now().isoformat()),
        "total_count":    meta.get("total_count", len(influencers)),
        "modal_success":  meta.get("modal_success"),
        "version":        meta.get("version"),
        "raw_meta":       json.dumps(meta, ensure_ascii=False),
    }

    try:
        if campaign_pk:
            # 2a) 기존 캠페인 업데이트 ─────────────────
            sb.table("revu_campaigns").update(campaign_row).eq("id", campaign_pk).execute()
            logger.info(f"캠페인 업데이트: campaign_id={campaign_id}, pk={campaign_pk}")
        else:
            # 2b) 신규 캠페인 삽입 ─────────────────
            res = sb.table("revu_campaigns").insert(campaign_row).execute()
            campaign_pk = res.data[0]["id"]
            logger.info(f"캠페인 신규 삽입: campaign_id={campaign_id}, pk={campaign_pk}")
    except Exception as e:
        logger.error(f"캠페인 저장 실패: {e}")
        return {"ok": False, "error": f"캠페인 저장 실패: {e}"}

    # 3) 기존 신청자 삭제 (재크롤링 시 중복 방지) ──
    try:
        sb.table("revu_applicants").delete().eq("campaign_pk", campaign_pk).execute()
    except Exception as e:
        logger.warning(f"기존 신청자 삭제 실패 (신규일 수 있음): {e}")

    # 4) revu_applicants 일괄 삽입 ─────────────────
    rows = []
    for inf in influencers:
        # 신청자 식별키 (AI 점수 매핑용)
        ident = inf.get("nickname") or inf.get("instagram_handle") or ""
        ai = (ai_scores or {}).get(ident)

        row = {
            "campaign_pk":    campaign_pk,
            "campaign_id":    campaign_id,
            "platform":       platform,
            "nickname":       inf.get("nickname"),
            "gender":         inf.get("gender"),
            "age":            inf.get("age"),
            "is_picked":      inf.get("is_picked", False),
            "is_duplicate":   inf.get("is_duplicate", False),
            "ai_score":       ai,
            "raw_data":       json.dumps(inf, ensure_ascii=False),
        }

        if platform == "naver":
            modal = inf.get("blog_modal") or {}
            row.update({
                "media_name":        inf.get("media_name"),
                "media_url":         inf.get("media_url"),
                "avg_visitors":      inf.get("avg_visitors"),
                "top_exposure":      inf.get("top_exposure_flag") == "O",
                "blog_score":        inf.get("blog_score") or modal.get("blog_score"),
                "category":          inf.get("category") or modal.get("category"),
                "neighbors":         modal.get("neighbors"),
                "ad_activity":       modal.get("ad_activity"),
                "avg_likes":         modal.get("avg_likes"),
                "avg_comments":      modal.get("avg_comments"),
                "post_freq_7d":      modal.get("post_freq_7d"),
                "top_keyword_count": inf.get("top_keyword_count") or modal.get("top_keyword_count"),
            })
        else:  # instagram
            row.update({
                "instagram_handle":  inf.get("instagram_handle"),
                "instagram_url":     inf.get("instagram_url"),
                "follower_range":    inf.get("follower_range_text"),
                "exact_followers":   inf.get("exact_followers"),
                "post_count":        inf.get("post_count"),
                "engagement_rate":   inf.get("engagement_rate"),
                "avg_insta_likes":   inf.get("avg_likes"),
                "avg_insta_comments": inf.get("avg_comments"),
            })

        rows.append(row)

    # 배치 삽입 (Supabase 1회 최대 ~1000행, 안전하게 500씩)
    BATCH = 500
    inserted = 0
    try:
        for i in range(0, len(rows), BATCH):
            chunk = rows[i:i + BATCH]
            sb.table("revu_applicants").insert(chunk).execute()
            inserted += len(chunk)
    except Exception as e:
        logger.error(f"신청자 저장 실패 (삽입 {inserted}/{len(rows)}): {e}")
        return {"ok": False, "error": f"신청자 INSERT 실패 ({inserted}/{len(rows)}행 완료): {e}"}

    logger.info(f"✅ Supabase 저장 완료: campaign_pk={campaign_pk}, applicants={inserted}")
    return {"ok": True, "campaign_pk": campaign_pk, "applicant_count": inserted}


# ─── AI 점수 업데이트 (map_json 후 호출) ───
def update_ai_scores(campaign_pk: int, scores: dict):
    """
    scores: {nickname_or_handle: float}
    campaign_pk 기준으로 applicants의 ai_score 컬럼 업데이트
    """
    sb = _get_client()
    # 해당 캠페인의 전체 applicants 조회
    res = sb.table("revu_applicants").select("id,nickname,instagram_handle").eq("campaign_pk", campaign_pk).execute()
    for row in res.data:
        ident = row.get("nickname") or row.get("instagram_handle") or ""
        if ident in scores:
            sb.table("revu_applicants").update({"ai_score": scores[ident]}).eq("id", row["id"]).execute()
