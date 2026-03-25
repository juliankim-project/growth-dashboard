"""
REVU Influencer Selector v5 — React JSX 1:1 Streamlit 포팅
Flow: platform → crawl → data(전체보기) → select(AI탭/조건탭)
JSON 파일 업로드 제거 — Streamlit 크롤링 직행
"""
import streamlit as st, pandas as pd, json, re, time, random
from datetime import datetime

# ═══════════════════════════════════════
# ⚙️ CONFIG
# ═══════════════════════════════════════
LOGIN_URL="https://report.revu.net/auth/login"
DEFAULT_UID="ian.kim@handys.co.kr"
DEFAULT_UPW="Djqks00#%*"
MORE_BTN_WAIT=2.0; MORE_BTN_MAX_RETRY=3; MORE_BTN_MAX_CLICKS=200
MODAL_LOAD_WAIT=3.0; MODAL_CLOSE_WAIT=0.5; MODAL_RETRY=2; BETWEEN_MODAL_DELAY=1.0

# ═══════════════════════════════════════
# 📌 AI 가중치 (숙소 캠페인 전용)
# ═══════════════════════════════════════
AI_WEIGHTS={"blogScore":10,"visitors":20,"keywords":10,"likes":10,"adActivity":5,"postFreq":5,"accomFit":40}
WL={"blogScore":{"s":"스코어","e":"⭐"},"visitors":{"s":"방문자","e":"👥"},"keywords":{"s":"키워드","e":"🔍"},
    "likes":{"s":"좋아요","e":"❤️"},"adActivity":{"s":"광고","e":"📢"},"postFreq":{"s":"빈도","e":"📝"},
    "accomFit":{"s":"숙소적합","e":"🏨"}}
SORT_KEYS_NAVER={"AI점수":"aiScore","숙소적합도":"accomFit","방문자":"avgVisitors","상위키워드":"topKeywords","평균좋아요":"avgLikes","블로그스코어":"blogScore","이웃수":"neighbors","주간포스팅":"postFreq7d"}
SORT_KEYS_INSTA={"AI점수":"aiScore","팔로워":"followers","피드참여율":"feedER","릴스참여율":"reelER","릴스평균":"avgReelViews","릴스최고":"maxReelViews","팔로워비율":"ffRatio"}

# ═══════════════════════════════════════
# 📸 AI 가중치 (인스타그램 캠페인 전용)
# ═══════════════════════════════════════
AI_WEIGHTS_INSTA={"feedER":15,"reelER":15,"followers":15,"ffRatio":10,"feedAvgLikes":10,"reelAvgLikes":5,"avgReelViews":20,"maxReelViews":10}
WL_INSTA={"feedER":{"s":"피드참여율","e":"📊"},"reelER":{"s":"릴스참여율","e":"🎬"},
          "followers":{"s":"팔로워","e":"👥"},"ffRatio":{"s":"팔로워비율","e":"📈"},
          "feedAvgLikes":{"s":"피드좋아요","e":"❤️"},"reelAvgLikes":{"s":"릴스좋아요","e":"💜"},
          "avgReelViews":{"s":"릴스평균","e":"👁️"},"maxReelViews":{"s":"릴스최고","e":"🔥"}}
NR_INSTA={"feedER":(0,10),"reelER":(0,10),"followers":(0,200000),"ffRatio":(0,50),"feedAvgLikes":(0,5000),"reelAvgLikes":(0,5000),"avgReelViews":(0,100000),"maxReelViews":(0,500000)}

INSTA_CAT_MAP={
    "뷰티":["뷰티","메이크업","스킨케어","화장품","beauty","makeup","skincare"],
    "맛집":["맛집","먹스타그램","푸드","food","맛스타","카페","cafe"],
    "여행":["여행","travel","trip","투어","tour","호텔","펜션"],
    "패션":["패션","fashion","style","옷","코디","ootd"],
    "육아":["육아","아기","맘","mom","baby","kid","키즈"],
    "운동/건강":["운동","헬스","fitness","gym","다이어트","health","필라테스","yoga"],
    "일상":["일상","daily","라이프","vlog"],
    "인테리어":["인테리어","interior","홈","home","집꾸미기"],
    "반려동물":["반려","강아지","고양이","pet","dog","cat"],
}
def infer_category(bio):
    if not bio: return ""
    bl=bio.lower()
    for cat,kws in INSTA_CAT_MAP.items():
        if any(kw in bl for kw in kws): return cat
    return ""

# ═══════════════════════════════════════
# 🎨 테마 시스템 (다크/라이트)
# ═══════════════════════════════════════
THEMES={
 "dark":{
  "bg_app":"#0F0F18","bg_card":"#171724","bg_surface":"#1C1C2E","bg_input":"#232338",
  "bg_hover":"#252538","bg_table_header":"#1A1A2C","bg_bar":"#2A2A3D","bg_modal":"#171724",
  "border":"#2E2E42","border_focus":"#8B5CF6","border_divider":"#3A3A50",
  "text_heading":"#F2F2FA","text_primary":"#E0E0F0","text_secondary":"#A0A0B8",
  "text_caption":"#8888A0","text_placeholder":"#606080",
  "accent":"#8B5CF6","accent_hover":"#7C3AED","accent_light":"#C4B5FD",
  "accent_subtle":"#A78BFA","accent_bg":"rgba(139,92,246,0.12)","accent_border":"rgba(139,92,246,0.25)",
  "success":"#34D399","success_bg":"#0D2818","success_border":"#065F46",
  "warning":"#FBBF24","warning_bg":"#2D2508","warning_border":"#78350F",
  "danger":"#F87171","danger_bg":"#2D1010","danger_border":"#7F1D1D",
  "info":"#C4B5FD","info_bg":"#1E1535","info_border":"#4C1D95",
  "naver_bg":"#0D2818","naver_border":"#065F46","naver_text":"#34D399",
  "insta_bg":"#1E1535","insta_border":"#4C1D95","insta_text":"#A78BFA",
  "row_even":"#1A1A2C","row_odd":"#1E1E30","row_selected":"#2A1F50",
  "shadow":"0 4px 20px rgba(0,0,0,0.3)",
  "btn_sec_bg":"#1E1E2E","btn_sec_text":"#C8C8D8","btn_sec_border":"#2E2E42",
  "metric_value":"#C4B5FD","metric_delta":"#6EE7B7","metric_label":"#A0A0B8",
  "select_text":"#E0E0F0",
 },
 "light":{
  "bg_app":"#F5F5FA","bg_card":"#FFFFFF","bg_surface":"#F8F8FC","bg_input":"#F0F0F8",
  "bg_hover":"#EDEDF5","bg_table_header":"#F0F0F8","bg_bar":"#E0E0EC","bg_modal":"#FFFFFF",
  "border":"#D8D8E8","border_focus":"#7C3AED","border_divider":"#E0E0EC",
  "text_heading":"#1A1A2E","text_primary":"#2D2D44","text_secondary":"#6B6B88",
  "text_caption":"#707088","text_placeholder":"#8080A0",
  "accent":"#7C3AED","accent_hover":"#6D28D9","accent_light":"#8B5CF6",
  "accent_subtle":"#A78BFA","accent_bg":"rgba(124,58,237,0.06)","accent_border":"rgba(124,58,237,0.18)",
  "success":"#059669","success_bg":"#ECFDF5","success_border":"#A7F3D0",
  "warning":"#D97706","warning_bg":"#FFFBEB","warning_border":"#FDE68A",
  "danger":"#DC2626","danger_bg":"#FEF2F2","danger_border":"#FECACA",
  "info":"#7C3AED","info_bg":"#F5F3FF","info_border":"#DDD6FE",
  "naver_bg":"#ECFDF5","naver_border":"#A7F3D0","naver_text":"#059669",
  "insta_bg":"#F5F3FF","insta_border":"#DDD6FE","insta_text":"#7C3AED",
  "row_even":"#FFFFFF","row_odd":"#F8F8FC","row_selected":"#F0EDFF",
  "shadow":"0 2px 12px rgba(0,0,0,0.06)",
  "btn_sec_bg":"#F0F0F8","btn_sec_text":"#3D3D55","btn_sec_border":"#D8D8E8",
  "metric_value":"#7C3AED","metric_delta":"#059669","metric_label":"#6B6B88",
  "select_text":"#2D2D44",
 }
}

# ═══════════════════════════════════════
# 🏨 숙소 적합도 분석 엔진
# ═══════════════════════════════════════
ACCOM_KW=["호텔","펜션","리조트","숙소","에어비앤비","airbnb","풀빌라","글램핑","스테이",
          "게스트하우스","모텔","한옥스테이","오션뷰","독채","레지던스","빌라","민박",
          "캠핑","루프탑","객실","체크인","조식","투숙","1박","2박","숙박"]
ACCOM_KW_PAT=re.compile("|".join(ACCOM_KW),re.IGNORECASE)

def calc_accom(inf):
    """숙소 적합도 분석 — 포스팅 매칭 + 키워드 매칭 + 반응도"""
    # 1) 포스팅 제목에서 숙소 관련 매칭
    posts=inf.get("recentPosts",[])
    matched_posts=[p for p in posts if ACCOM_KW_PAT.search(p.get("title",""))]
    post_count=len(matched_posts)
    post_total=len(posts) or 1
    post_ratio=post_count/post_total  # 0~1

    # 매칭된 포스팅 평균 좋아요+댓글 (반응도)
    if matched_posts:
        avg_react=sum(p.get("likes",0)+p.get("comments",0) for p in matched_posts)/len(matched_posts)
    else:
        avg_react=0

    # 2) 상위노출 키워드에서 숙소 관련 매칭
    kws=inf.get("topKeywordList",[])
    matched_kws=[kw for kw in kws if ACCOM_KW_PAT.search(kw.get("keyword",""))]
    kw_count=len(matched_kws)
    kw_top5=sum(1 for kw in matched_kws if kw.get("rank",99)<=5)  # 5위 이내
    kw_volume=sum(kw.get("volume",0) for kw in matched_kws)

    # 3) 카테고리 보너스
    cat=inf.get("category","")
    cat_bonus=10 if any(k in cat for k in ["여행","숙박","호텔","펜션","캠핑"]) else 0

    return {
        "accomPostCount":post_count,
        "accomPostTotal":post_total,
        "accomPostRatio":round(post_ratio*100,1),
        "accomAvgReact":round(avg_react),
        "accomMatchedPosts":matched_posts,
        "accomKwCount":kw_count,
        "accomKwTop5":kw_top5,
        "accomKwVolume":kw_volume,
        "accomMatchedKws":matched_kws,
        "catBonus":cat_bonus,
    }

def calc_accom_score(ac):
    """숙소 적합도 → 0~100 점수 산출"""
    # 포스팅 비율 점수 (40%): 50%+ → 100, 0% → 0
    ratio_score=min(ac["accomPostRatio"]*2, 100)
    # 키워드 점수 (30%): 상위노출 3개+ → 100
    kw_score=min(ac["accomKwTop5"]*33, 100)
    # 반응도 점수 (30%): 평균 반응 200+ → 100
    react_score=min(ac["accomAvgReact"]/2, 100)
    # 카테고리 보너스
    raw=ratio_score*0.4 + kw_score*0.3 + react_score*0.3 + ac["catBonus"]
    return min(round(raw), 100)

def calc_accom_percentile(score, all_scores):
    """전체 중 상위 백분위 계산"""
    if not all_scores: return 0
    rank=sum(1 for s in all_scores if s>score)+1
    return round(rank/len(all_scores)*100)

# ═══════════════════════════════════════
# 🧮 AI SCORE ENGINE v2 — 상대평가 기반
# ═══════════════════════════════════════
# 핵심 원칙:
# 1) 전체 신청자 풀에서 percentile로 환산 → 1등=100점
# 2) 핵심 데이터(방문자, 좋아요, 포스팅)가 0이면 패널티
# 3) 광고활동성은 '낮음'이 좋음 (역방향)
AM={"낮음":90,"보통":50,"활발":15}  # 광고 낮을수록 좋음 (광고성 적은 블로그 선호)

# ── 데이터 부재 패널티 ──
# 방문자=0, 좋아요=0, 포스팅=0 → 실질 콘텐츠 없음 → 점수 큰폭 감점
NAVER_REQUIRED_FIELDS=["avgVisitors","avgLikes","postFreq7d"]
NAVER_PENALTY_PER_MISSING=15  # 핵심필드 하나당 -15점
NAVER_MIN_FLOOR=5  # 최소 점수 바닥

def _percentile_map(data_list, key, reverse=False):
    """전체 모수 대비 percentile 환산 (0~100). reverse=True면 낮을수록 좋음"""
    vals=[(i,d.get(key,0) or 0) for i,d in enumerate(data_list)]
    vals.sort(key=lambda x:x[1], reverse=(not reverse))
    n=len(vals)
    pct_map={}
    for rank,(idx,v) in enumerate(vals):
        pct_map[idx]=(rank/(n-1))*100 if n>1 else 50
    return pct_map

def calc_all_naver(data_list, w):
    """전체 네이버 신청자 대상 상대평가 AI 점수 일괄 계산"""
    if not data_list: return
    # 1) 각 지표별 percentile 맵 생성
    pct_maps={}
    pct_maps["blogScore"]=_percentile_map(data_list,"blogScore")
    pct_maps["visitors"]=_percentile_map(data_list,"avgVisitors")
    pct_maps["keywords"]=_percentile_map(data_list,"topKeywords")
    pct_maps["likes"]=_percentile_map(data_list,"avgLikes")
    pct_maps["postFreq"]=_percentile_map(data_list,"postFreq7d")
    # 광고활동성: 낮음이 좋으므로 직접 변환
    for i,d in enumerate(data_list):
        d["_adScore"]=AM.get(d.get("adActivity","보통"),50)
    pct_maps["adActivity"]=_percentile_map(data_list,"_adScore")
    # 숙소적합도
    if "accomFit" in w:
        pct_maps["accomFit"]=_percentile_map(data_list,"accomFit")

    tw=sum(w.values())
    for i,d in enumerate(data_list):
        raw={}
        for k in w:
            if k in pct_maps:
                raw[k]=pct_maps[k].get(i,0)
            else:
                raw[k]=50  # fallback
        # 가중합
        score=sum(raw.get(k,0)*w[k]/tw for k in w)
        # 2) 데이터 부재 패널티
        penalty=0
        for fk in NAVER_REQUIRED_FIELDS:
            val=d.get(fk,0)
            if val is None or val==0:
                penalty+=NAVER_PENALTY_PER_MISSING
        score=max(NAVER_MIN_FLOOR, score-penalty)
        d["aiScore"]=round(score)
        d["_bd"]=raw

    # 3) 최종 정규화: 1등=100점, 상대 스케일링
    scores=[d["aiScore"] for d in data_list]
    mx=max(scores) if scores else 1
    mn=min(scores) if scores else 0
    rng=mx-mn if mx!=mn else 1
    for d in data_list:
        # 선형 스케일: 최고점 → 100, 최저점 → (최저점/최고점)*100 비율 유지
        d["aiScore"]=round((d["aiScore"]-mn)/rng*95+5)  # 5~100 범위
    # 재정렬 후 breakdown 보정
    for d in data_list:
        d["aiReason"]=gen_comment(d,d["aiScore"],d["_bd"],w)

# ── 하위호환: 단건 calc (기존 UI에서 참조할 수 있음) ──
NR={"blogScore":(1,5),"visitors":(0,3000),"keywords":(0,40),"likes":(0,800),"adActivity":(0,100),"postFreq":(0,10),"accomFit":(0,100)}
def nv(v,k): mn,mx=NR[k]; return((max(mn,min(mx,v))-mn)/(mx-mn))*100
def ads(r,pk="accom"):
    return 100-abs(r-50)*2
def calc(inf,w,pk="accom"):
    ad=AM.get(inf.get("adActivity","보통"),50)
    raw={"blogScore":nv(inf.get("blogScore",0),"blogScore"),"visitors":nv(inf.get("avgVisitors",0),"visitors"),
         "keywords":nv(inf.get("topKeywords",0),"keywords"),"likes":nv(inf.get("avgLikes",0),"likes"),
         "adActivity":ads(ad,pk),"postFreq":nv(inf.get("postFreq7d",0),"postFreq")}
    if "accomFit" in w:
        raw["accomFit"]=nv(inf.get("accomFit",0),"accomFit")
    tw=sum(w.values()); s=sum(raw.get(k,0)*w[k]/tw for k in w)
    return round(s),raw
def gen_comment(inf,score,bd,w,pk="accom"):
    parts=[]
    desc=inf.get("blogScoreDesc","")
    if desc:
        m=re.findall(r"[가-힣\s]+\d+\.?\d*점",desc)
        if m: parts.append(f"레뷰 분석: {', '.join(m[:2])}")
    # 숙소 적합도
    ac=inf.get("_accom")
    if ac:
        if ac["accomPostCount"]>0:
            parts.append(f'숙소 콘텐츠 {ac["accomPostCount"]}건(전체의 {ac["accomPostRatio"]}%) — 평균 반응 {ac["accomAvgReact"]}')
        if ac["accomKwCount"]>0:
            parts.append(f'숙소 키워드 {ac["accomKwCount"]}개(상위노출 {ac["accomKwTop5"]}개, 검색량 {ac["accomKwVolume"]:,})')
        if ac["accomPostCount"]==0 and ac["accomKwCount"]==0:
            parts.append("숙소 관련 콘텐츠/키워드 없음 — 적합도 낮음")
    top2=[k for k,_ in sorted(w.items(),key=lambda x:-x[1])[:2]]
    if "visitors" in top2: parts.append(f'일평균 방문자 {inf.get("avgVisitors",0):,}명')
    if "keywords" in top2: parts.append(f'상위노출 키워드 {inf.get("topKeywords",0)}개')
    if "likes" in top2: parts.append(f'평균 좋아요 {inf.get("avgLikes",0):,}개')
    g="강력 추천" if score>=85 else "추천" if score>=70 else "조건부 추천" if score>=55 else "참고"
    parts.append(f"[숙소] 종합 {score}점 — {g}")
    return ". ".join(parts)+"."

# ═══════════════════════════════════════
# 📸 INSTAGRAM AI SCORE ENGINE
# ═══════════════════════════════════════
def nv_insta(v,k):
    mn,mx=NR_INSTA[k]; return((max(mn,min(mx,v))-mn)/(mx-mn))*100

# ── 인스타 데이터 부재 패널티 ──
INSTA_REQUIRED_FIELDS=["followers","feedER","avgReelViews"]
INSTA_PENALTY_PER_MISSING=20  # enriched 안 된 사람은 큰 감점
INSTA_MIN_FLOOR=3

def calc_all_insta(data_list, w=None):
    """전체 인스타 신청자 대상 상대평가 AI 점수 일괄 계산"""
    if w is None: w=AI_WEIGHTS_INSTA
    if not data_list: return
    # 1) 각 지표별 percentile 맵
    pct_maps={}
    for k in w:
        pct_maps[k]=_percentile_map(data_list,k)
    tw=sum(w.values())
    for i,d in enumerate(data_list):
        raw={}
        for k in w:
            raw[k]=pct_maps[k].get(i,0)
        score=sum(raw.get(k,0)*w[k]/tw for k in w)
        # 2) 데이터 부재 패널티: enriched 안 됐으면 핵심지표 전부 0
        penalty=0
        for fk in INSTA_REQUIRED_FIELDS:
            val=d.get(fk,0)
            if val is None or val==0:
                penalty+=INSTA_PENALTY_PER_MISSING
        score=max(INSTA_MIN_FLOOR, score-penalty)
        d["aiScore"]=round(score)
        d["_bd"]=raw

    # 3) 정규화: 1등=100점
    scores=[d["aiScore"] for d in data_list]
    mx=max(scores) if scores else 1
    mn=min(scores) if scores else 0
    rng=mx-mn if mx!=mn else 1
    for d in data_list:
        d["aiScore"]=round((d["aiScore"]-mn)/rng*95+5)  # 5~100 범위
    for d in data_list:
        d["aiReason"]=gen_comment_insta(d,d["aiScore"],d["_bd"])

# ── 하위호환: 단건 calc_insta ──
def calc_insta(inf,w=None):
    if w is None: w=AI_WEIGHTS_INSTA
    raw={}
    for k in w:
        raw[k]=nv_insta(inf.get(k,0),k)
    tw=sum(w.values()); s=sum(raw.get(k,0)*w[k]/tw for k in w)
    return round(s),raw
def gen_comment_insta(inf,score,bd):
    parts=[]
    enriched=inf.get("enriched",False)
    if not enriched:
        parts.append(f'⚠️ REVU 기본 데이터만 사용 (팔로워: {inf.get("followerRangeText","N/A")})')
    fol=inf.get("followers",0)
    if fol>=100000: parts.append(f"팔로워 {fol:,}명 — 도달력 우수")
    elif fol>=30000: parts.append(f"팔로워 {fol:,}명 — 중간 규모")
    elif fol>0: parts.append(f"팔로워 {fol:,}명 — 마이크로")
    fer=inf.get("feedER",0)
    if fer>=5: parts.append(f"피드 참여율 {fer}%로 매우 높음")
    elif fer>=3: parts.append(f"피드 참여율 {fer}%로 양호")
    elif fer>0: parts.append(f"피드 참여율 {fer}%")
    rer=inf.get("reelER",0)
    if rer>=5: parts.append(f"릴스 참여율 {rer}%로 매우 높음")
    elif rer>=3: parts.append(f"릴스 참여율 {rer}%로 양호")
    elif rer>0: parts.append(f"릴스 참여율 {rer}%")
    rv=inf.get("avgReelViews",0); mrv=inf.get("maxReelViews",0)
    if mrv>=50000: parts.append(f"릴스 최고 {mrv:,}회 · 평균 {rv:,}회 — 확산력 우수")
    elif rv>0: parts.append(f"릴스 평균 {rv:,}회 조회")
    ffr=inf.get("ffRatio",0)
    if ffr>=10: parts.append(f"팔로워비율 {ffr}:1 — 영향력 높음")
    if inf.get("isRecommended"): parts.append("REVU 추천")
    if inf.get("isDuplicate"): parts.append("⚠️ 중복참여")
    g="강력 추천" if score>=85 else "추천" if score>=70 else "조건부 추천" if score>=55 else "참고"
    parts.append(f"종합 {score}점 — {g}")
    return ". ".join(parts)+"."

# ═══════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════
def make_chrome_driver():
    """Chrome 드라이버 생성 (headless, 안정적 옵션)"""
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    opts=webdriver.ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches",["enable-automation"])
    try:
        from webdriver_manager.chrome import ChromeDriverManager
        svc=Service(ChromeDriverManager().install())
        return webdriver.Chrome(service=svc,options=opts)
    except ImportError:
        return webdriver.Chrome(options=opts)

def safe_text(el): return el.text.strip() if el else ""
def pnum(t):
    if not t: return 0
    n=re.sub(r"[^\d]","",str(t)); return int(n) if n else 0
def sc(s): return "#A78BFA" if s>=85 else "#8B5CF6" if s>=70 else "#FBBF24" if s>=55 else "#F87171"
def bdg_html(score,t=None):
    c={5:("#8B5CF6","#fff"),4:("#7C3AED","#E8E8F0"),3:("#3B2E6E","#C4B5FD"),2:("#2A2040","#A78BFA")}
    _bar=t["bg_bar"] if t else "#252530"; _cap=t["text_caption"] if t else "#555"
    bg,fg=c.get(round(score) if score else 0,(_bar,t["text_placeholder"] if t else "#9898B0"))
    return f'<span style="background:{bg};color:{fg};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">★ {round(score)}</span>' if score else f'<span style="color:{_cap};">-</span>'
def ad_html(a,t=None):
    if t:
        m={"낮음":(t["success_bg"],t["success"]),"활발":(t["danger_bg"],t["danger"])}
        bg,fg=m.get(a,(t["info_bg"],t["accent_subtle"]))
    else:
        m={"낮음":("#0D2818","#34D399"),"활발":("#2D1010","#F87171")}
        bg,fg=m.get(a,("#1E1535","#A78BFA"))
    return f'<span style="background:{bg};color:{fg};padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">{a}</span>'
def ai_bar_html(score,color=None,t=None):
    c=color or sc(score); _bar=t["bg_bar"] if t else "#252530"
    return f'<div style="display:flex;align-items:center;gap:6px;min-width:80px;"><span style="font-weight:800;font-size:15px;color:{c};min-width:28px;text-align:right;">{score}</span><div style="flex:1;height:6px;background:{_bar};border-radius:3px;overflow:hidden;min-width:36px;"><div style="width:{score}%;height:100%;background:{c};border-radius:3px;"></div></div></div>'

# ═══════════════════════════════════════
# 🕷️ CRAWLER
# ═══════════════════════════════════════
def crawl_revu(cid,uid,upw,mmax=0,cmax=0,cb=None,driver=None):
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import NoSuchElementException,ElementClickInterceptedException,StaleElementReferenceException,TimeoutException
    from bs4 import BeautifulSoup
    def log(m):
        if cb: cb(m)
        print(m)
    _own_driver = driver is None  # 외부에서 받은 driver면 quit 하지 않음
    try:
        if _own_driver:
            log("🔧 ChromeDriver 준비 중...")
            driver=make_chrome_driver()
            wait=WebDriverWait(driver,15)
            log("🔐 로그인 중..."); driver.get(LOGIN_URL)
            wait.until(EC.presence_of_element_located((By.XPATH,"//input[@placeholder='이메일']")))
            driver.find_element(By.XPATH,"//input[@placeholder='이메일']").send_keys(uid)
            driver.find_element(By.XPATH,"//input[@placeholder='비밀번호']").send_keys(upw)
            driver.find_element(By.XPATH,"//button[contains(text(),'로그인')]").click()
            time.sleep(4); log("✅ 로그인 완료")
        else:
            wait=WebDriverWait(driver,15)
        url=f"https://report.revu.net/service/campaigns/{cid}"
        log(f"📄 캠페인 {cid} 접속 중..."); driver.get(url); time.sleep(3)
        try:
            log("🎯 '인플루언서 선정' 탭 클릭")
            # 여러 셀렉터 시도 (past/active/current 상태에 따라 다를 수 있음)
            tab_found=False
            for sel in ["div.step.client-pick.past","div.step.client-pick.active","div.step.client-pick"]:
                try:
                    se=driver.find_element(By.CSS_SELECTOR,sel)
                    driver.execute_script("arguments[0].click();",se); tab_found=True
                    log(f"  ✅ 탭 클릭 성공 ({sel})")
                    break
                except: continue
            if not tab_found:
                # XPath로 텍스트 기반 탐색
                try:
                    se=driver.find_element(By.XPATH,"//*[contains(text(),'인플루언서 선정')]")
                    driver.execute_script("arguments[0].click();",se)
                    log("  ✅ 탭 클릭 성공 (XPath)")
                except:
                    log("  ⚠️ 인플루언서 선정 탭 찾지 못함 — 현재 페이지에서 진행")
            time.sleep(3)
        except: pass

        # ── 서비스 가이드 팝업 닫기 ──
        log("  🔍 팝업 확인 중...")
        time.sleep(2)
        popup_closed=False
        # 방법 1: 서비스 가이드 팝업의 X 버튼 (스크린샷에서 확인된 구조)
        for popup_sel in [
            # X 아이콘/버튼 (서비스 가이드 전용)
            "[class*='guide'] [class*='close']",
            "[class*='guide'] img[src*='close']",
            "[class*='modal'] [class*='close']",
            ".modal-close","button.close",
            "img[src*='ic-close']","img[src*='close']",
            "button[class*='close']",".close-btn",
            "[class*='popup'] [class*='close']",
            "svg[class*='close']","[aria-label='close']","[aria-label='닫기']",
        ]:
            try:
                els=driver.find_elements(By.CSS_SELECTOR,popup_sel)
                for el in els:
                    if el.is_displayed():
                        try: el.click()
                        except: driver.execute_script("arguments[0].click();",el)
                        popup_closed=True
                        log(f"  ✅ 팝업 닫기 ({popup_sel})"); time.sleep(1); break
                if popup_closed: break
            except: continue
        # 방법 2: 모든 visible 닫기 아이콘 (X 문자 포함)
        if not popup_closed:
            for xp in ["//*[text()='×']","//*[text()='X']","//*[text()='✕']","//*[contains(@class,'close')]"]:
                try:
                    for el in driver.find_elements(By.XPATH,xp):
                        if el.is_displayed():
                            try: el.click()
                            except: driver.execute_script("arguments[0].click();",el)
                            log(f"  ✅ 팝업 닫기 (XPath: {xp[:30]})"); popup_closed=True; time.sleep(1); break
                    if popup_closed: break
                except: continue
        # 방법 3: ESC 키
        if not popup_closed:
            try:
                from selenium.webdriver.common.keys import Keys
                driver.find_element(By.TAG_NAME,"body").send_keys(Keys.ESCAPE)
                time.sleep(1); log("  ✅ ESC로 팝업 닫기 시도")
            except: pass
        # 방법 4: 오버레이 클릭
        if not popup_closed:
            try:
                for ov_sel in [".modal-overlay",".modal-mask",".popup-overlay","[class*='overlay']","[class*='backdrop']"]:
                    try:
                        ov=driver.find_element(By.CSS_SELECTOR,ov_sel)
                        if ov.is_displayed():
                            driver.execute_script("arguments[0].click();",ov)
                            log(f"  ✅ 팝업 닫기 (overlay {ov_sel})"); time.sleep(1); break
                    except: continue
            except: pass
        # 방법 5: JavaScript로 모든 모달/팝업 강제 숨기기
        driver.execute_script("""
            // 서비스 가이드 등 팝업 강제 제거
            var modals = document.querySelectorAll('[class*="modal"],[class*="popup"],[class*="guide"],[class*="overlay"],[class*="backdrop"],.v-modal');
            modals.forEach(function(m) {
                if (m.offsetHeight > 300 || m.classList.contains('v-modal')) {
                    m.style.display = 'none';
                }
            });
        """)
        log("  🧹 JavaScript로 팝업 강제 제거 완료")
        time.sleep(1)

        # 캠페인명 추출
        ctitle=""
        try:
            ct_el=driver.find_element(By.CSS_SELECTOR,"li.campaign-title")
            ctitle=ct_el.text.strip()
            ctitle=re.sub(r"^\d+\s*/\s*\d+차\s*-\s*","",ctitle).strip()  # "1 / 1차 - " 접두사 제거
            log(f"📛 캠페인명: {ctitle}")
        except: pass
        # ══════════════════════════════════════════
        # PHASE 1: 더보기 클릭 → 전체 신청자 DOM 로드
        # ══════════════════════════════════════════
        # 신청 인플루언서 총 수 파싱
        expected_total=0
        try:
            tt_el=driver.find_element(By.CSS_SELECTOR,".table-title")
            tt_txt=tt_el.text.strip()
            tm=re.search(r"(\d+)",tt_txt)
            if tm: expected_total=int(tm.group(1))
            log(f"📊 신청 인플루언서: {expected_total}명")
        except:
            log("⚠️ 신청 인플루언서 수 파싱 실패 — 더보기 끝까지 클릭합니다")

        # 신청자 카운트: .btn-open-blog-modal (신청자 행마다 1개)
        from selenium.webdriver.common.action_chains import ActionChains
        USER_COUNT_JS="return document.querySelectorAll('.btn-open-blog-modal').length"

        pv=driver.execute_script(USER_COUNT_JS)
        target=expected_total if cmax==0 else min(cmax,expected_total) if expected_total>0 else cmax
        log(f"📥 Phase 1: 더보기 클릭으로 전체 로드...")
        log(f"  현재 신청자 로드: {pv}명" + (f" / 목표: {target}명" if target else ""))

        def click_vue(el):
            """Vue.js 호환 클릭"""
            try: el.click(); return "native"
            except: pass
            try: ActionChains(driver).move_to_element(el).pause(0.3).click().perform(); return "actions"
            except: pass
            try:
                driver.execute_script("var e=new MouseEvent('click',{bubbles:true,cancelable:true,view:window});arguments[0].dispatchEvent(e);",el)
                return "dispatch"
            except: pass
            try: el.find_element(By.XPATH,"..").click(); return "parent"
            except: pass
            return None

        ck=0; stale_count=0

        while ck<MORE_BTN_MAX_CLICKS:
            # 목표 달성 확인
            if target>0 and pv>=target:
                log(f"  ✅ {pv}명 로드 완료 (목표 {target}명)")
                break

            # 더보기 버튼 찾기
            btn=None
            candidates=driver.find_elements(By.XPATH,"//span[contains(text(),'더보기')]")
            for cel in candidates:
                try:
                    if cel.is_displayed(): btn=cel; break
                except: continue
            if not btn:
                # 페이지 끝까지 스크롤 후 재시도
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
                candidates=driver.find_elements(By.XPATH,"//span[contains(text(),'더보기')]")
                for cel in candidates:
                    try:
                        if cel.is_displayed(): btn=cel; break
                    except: continue
                if not btn:
                    log(f"  ✅ 더보기 버튼 소멸 — 로드 완료 ({pv}명)")
                    break

            try:
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});",btn)
                time.sleep(0.5)
                method=click_vue(btn)
                ck+=1
                time.sleep(MORE_BTN_WAIT)

                # 로드 대기 (최대 8초)
                loaded=False
                for _ in range(8):
                    cu=driver.execute_script(USER_COUNT_JS)
                    if cu>pv:
                        if ck<=5 or ck%10==0:
                            log(f"  📥 더보기 {ck}회 → {cu}명" + (f" / 목표 {target}명" if target else ""))
                        pv=cu; stale_count=0; loaded=True; break
                    time.sleep(1.0)

                if not loaded:
                    stale_count+=1
                    if ck<=3 or ck%10==0:
                        log(f"  ⏳ 더보기 {ck}회 — {pv}명 (변화없음 {stale_count}회)")
                    if stale_count>=10:
                        log(f"  ⚠️ {stale_count}회 연속 변화 없음 — 로딩 중단 ({pv}명)")
                        break
            except Exception as ex:
                stale_count+=1
                log(f"  ⚠️ 오류: {str(ex)[:80]}")
                if stale_count>=10: break
                time.sleep(1.5)

        final_count=driver.execute_script(USER_COUNT_JS)
        log(f"📦 Phase 1 완료: 신청자 {final_count}명 로드" + (f" (신청 총 {expected_total}명)" if expected_total else ""))

        # ══════════════════════════════════════════
        # PHASE 2: 신청자 기본 데이터 파싱
        # ══════════════════════════════════════════
        # dl 요소 중 .btn-open-blog-modal을 가진 것 = 신청자 행
        containers=driver.execute_script("""
            var dls = document.querySelectorAll('dl');
            var result = [];
            for (var i = 0; i < dls.length; i++) {
                if (dls[i].querySelector('.btn-open-blog-modal')) result.push(dls[i]);
            }
            return result;
        """)
        total=len(containers)
        log(f"📋 Phase 2: 기본 데이터 파싱 시작 ({total}명)...")
        if total==0:
            log("⚠️ 신청자 데이터가 없습니다 (0명)")
            return {"meta":{"error":"신청자 데이터가 없습니다 (0명). 캠페인 ID와 탭 상태를 확인하세요."},"influencers":[]}
        data=[]
        for idx,c in enumerate(containers,1):
            soup=BeautifulSoup(c.get_attribute("outerHTML"),"html.parser")
            # 블로그 점수 먼저 추출 (decompose 전)
            bsp=soup.select_one(".blog-grade-point .point")
            basic_score=0
            if bsp:
                try: basic_score=float(safe_text(bsp))
                except: pass
            # 닉네임 추출 (점수 표시 제거)
            ne=soup.select_one(".nick")
            if ne:
                for bb in ne.select(".user-blog-grad,.blog-grad,[class*='grad'],.blog-grade-point"): bb.decompose()
                nick=safe_text(ne); nick=re.sub(r"\s+[\d.]+\s*$","",nick).strip()
            else: nick=""
            me=soup.select_one(".media-title a"); mn=safe_text(me); mu=me["href"] if me and me.has_attr("href") else ""
            mi=soup.select_one(".media-title"); g=a=""
            if mi:
                pp=mi.text.strip().split("|")
                if len(pp)>1: g=pp[1].strip()
                if len(pp)>2: a=pp[2].strip()
            vc_el=soup.select_one(".visit-count")
            vn=pnum(safe_text(vc_el))
            # 카테고리 (방문자 수 뒤 | 다음)
            cat=""
            if vc_el:
                vt=vc_el.get_text("|",strip=True)
                vparts=[p.strip() for p in vt.split("|") if p.strip()]
                for vp in vparts:
                    if not re.search(r"\d",vp) and vp not in["평균","방문자","수"]:
                        cat=vp; break
            kf="O" if soup.select_one(".keyword-top") else "X"
            # 중복참여 감지 (여러 방법)
            is_dup=False
            dup_el=soup.select_one(".user-request-status.requested")
            if dup_el and "중복" in safe_text(dup_el):
                is_dup=True
            else:
                # 전체 텍스트에서 "중복참여" 검색
                full_txt=soup.get_text()
                if "중복참여" in full_txt or "중복 참여" in full_txt:
                    is_dup=True
                # id에 "requested" 포함된 div 확인
                for div in soup.select("div[id*='requested']"):
                    if "중복" in safe_text(div): is_dup=True; break
            data.append({"nickname":nick,"media_name":mn,"media_url":mu,"gender":g,"age":a,
                         "avg_visitors":vn,"top_exposure_flag":kf,"is_duplicate":is_dup,
                         "basic_blog_score":basic_score,"basic_category":cat,
                         "is_picked":bool(soup.select_one(".mask")),"blog_modal":{}})
            if idx%50==0 or idx==total: log(f"  📋 기본 파싱 {idx}/{total}")
        mt=total if mmax==0 else min(mmax,total)
        log(f"🔍 Phase 3: 모달 스크래핑 시작 ({mt}/{total}명)")
        mok=0;mf=0
        for idx in range(mt):
            log(f"  🔍 모달 {idx+1}/{mt}")
            for att in range(MODAL_RETRY+1):
                try:
                    btns=driver.find_elements(By.CSS_SELECTOR,".btn-open-blog-modal")
                    if idx>=len(btns): break
                    bb=btns[idx]
                    driver.execute_script("arguments[0].scrollIntoView({block:'center'});",bb); time.sleep(0.3)
                    driver.execute_script("arguments[0].click();",bb)
                    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR,".modal-content.blog-data-content")))
                    time.sleep(MODAL_LOAD_WAIT)
                    mel=driver.find_element(By.CSS_SELECTOR,".modal-content.blog-data-content")
                    msoup=BeautifulSoup(mel.get_attribute("outerHTML"),"html.parser")
                    result=parse_modal(msoup)
                    data[idx]["blog_modal"]=result
                    for key in["blog_score","yesterday_visitors","total_visitors","neighbors","open_date",
                               "avg_chars","avg_images","avg_videos","avg_likes","avg_comments",
                               "ad_activity","post_freq_7d","top_keyword_count","scraps","category","blog_score_description"]:
                        data[idx][key]=result.get(key,"")
                    mok+=1; log(f"    ✅ 스코어:{result.get('blog_score')}")
                    close_modal(driver); time.sleep(MODAL_CLOSE_WAIT); break
                except TimeoutException: close_modal(driver); time.sleep(1.0)
                except: close_modal(driver); time.sleep(1.0)
            else: mf+=1
            time.sleep(BETWEEN_MODAL_DELAY)
        log(f"📊 모달: 성공 {mok} / 실패 {mf}")
        out={"meta":{"campaign_id":cid,"campaign_title":ctitle,"crawled_at":datetime.now().isoformat(),"total_count":len(data),"modal_success":mok,"version":"v5","crawl_max":cmax,"modal_max":mmax},"influencers":data}
        fn=f"revu_{cid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(fn,"w",encoding="utf-8") as f: json.dump(out,f,ensure_ascii=False,indent=2)
        log(f"💾 JSON: {fn}"); log(f"✅ 완료! {len(data)}명")
        return out
    except Exception as e:
        import traceback; traceback.print_exc()
        if cb: cb(f"❌ 오류: {e}")
        return {"meta":{"error":str(e)},"influencers":[]}
    finally:
        if _own_driver and driver: driver.quit()

def parse_modal(ms):
    r={}
    se=ms.select_one(".blog-grade-point .score")
    try: r["blog_score"]=float(safe_text(se)) if se else 0
    except: r["blog_score"]=0
    r["blog_score_description"]=safe_text(ms.select_one("p.blog-grade-my-description"))
    r["blog_name"]=safe_text(ms.select_one(".blog-name .title")).replace("","").strip()
    od=safe_text(ms.select_one(".blog-name .desc")); dm=re.search(r"\d{4}-\d{2}-\d{2}",od)
    r["open_date"]=dm.group() if dm else ""
    for ri in ms.select(".info-bottom .row-info"):
        t,v=safe_text(ri.select_one(".title")),safe_text(ri.select_one(".value"))
        if "카테고리" in t: r["category"]=v
        elif "이웃수" in t: r["neighbors"]=pnum(v)
        elif "스크랩" in t: r["scraps"]=pnum(v)
    im={"광고 활동성":"ad_activity","평균 좋아요":"avg_likes","평균 댓글":"avg_comments","평균 글자수":"avg_chars","평균 이미지수":"avg_images","평균 동영상수":"avg_videos"}
    for item in ms.select(".insight-item"):
        le=item.select_one(".title span"); ve=item.find("p",recursive=False)
        if not ve: ve=item.select_one("p:not(.title)")
        if not ve: ap=item.find_all("p"); ve=ap[-1] if ap else None
        lb,vl=safe_text(le),safe_text(ve)
        for kk,ek in im.items():
            if kk in lb: r[ek]=vl if ek=="ad_activity" else pnum(vl); break
    r["post_freq_7d"]=pnum(safe_text(ms.select_one(".gauge-tooltip")))
    for ci in ms.select(".chart-top .item"):
        t,v=safe_text(ci.select_one(".title")),safe_text(ci.select_one(".value"))
        if "어제" in t: r["yesterday_visitors"]=pnum(v)
        elif "월" in t or "평균" in t: r["avg_visitors_monthly"]=pnum(v)
        elif "총" in t: r["total_visitors"]=pnum(v)
    kwm=re.search(r"(\d+)\s*개",safe_text(ms.select_one(".post-keyword .revu-color")))
    r["top_keyword_count"]=int(kwm.group(1)) if kwm else 0
    kws=[]
    for tb in ms.select(".keyword-list-tooltip"):
        for li in tb.select(".tooltip-list-item"):
            n=safe_text(li.select_one(".tooltip-keyword"))
            if n: kws.append({"keyword":n,"search_volume":pnum(safe_text(li.select_one(".tooltip-search-count"))),"rank":pnum(safe_text(li.select_one(".tooltip-rank-badge")))})
    r["top_keywords"]=kws
    posts=[]
    for tr in ms.select(".post-list-table .table-row"):
        p={"title":safe_text(tr.select_one(".post-title")),"date":safe_text(tr.select_one(".tb-date"))}
        cells=tr.select(".table-cell"); p["category"]=safe_text(cells[2]) if len(cells)>2 else ""
        pi=tr.select(".post-info .row")
        for i,k in enumerate(["chars","links","videos","images","likes","comments"]): p[k]=pnum(safe_text(pi[i])) if i<len(pi) else 0
        bt=safe_text(tr.select_one(".post-bottom-area"))
        p["is_top_exposed"]="상위 노출" in bt; p["is_smart_block"]="스마트 블록" in bt
        if p["title"]: posts.append(p)
    r["recent_posts"]=posts
    return r

def close_modal(driver):
    from selenium.webdriver.common.by import By
    try:
        ov=driver.find_elements(By.CSS_SELECTOR,".modal-overlay,.modal-mask,.modal-backdrop")
        if ov: driver.execute_script("arguments[0].click();",ov[0]); return
        for cb2 in driver.find_elements(By.CSS_SELECTOR,".modal-close,.btn-close,.close-btn,[class*='close']"):
            try: driver.execute_script("arguments[0].click();",cb2); return
            except: continue
        from selenium.webdriver.common.keys import Keys
        driver.find_element(By.TAG_NAME,"body").send_keys(Keys.ESCAPE)
    except:
        try:
            from selenium.webdriver.common.keys import Keys; driver.find_element(By.TAG_NAME,"body").send_keys(Keys.ESCAPE)
        except: pass

# ═══════════════════════════════════════
# 📸 INSTAGRAM REVU CRAWLER (A안 기본)
# ═══════════════════════════════════════
def crawl_revu_insta(cid,uid,upw,cmax=0,cb=None,driver=None):
    """REVU 인스타 캠페인 크롤러 — 모달 없음, 리스트만 파싱"""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import NoSuchElementException,ElementClickInterceptedException,StaleElementReferenceException,TimeoutException
    from bs4 import BeautifulSoup
    def log(m):
        if cb: cb(m)
        print(m)
    _own_driver = driver is None  # 외부에서 받은 driver면 quit 하지 않음
    try:
        if _own_driver:
            log("🔧 ChromeDriver 준비 중...")
            driver=make_chrome_driver()
            wait=WebDriverWait(driver,15)
            # ── 로그인 (네이버와 동일) ──
            log("🔐 로그인 중..."); driver.get(LOGIN_URL)
            wait.until(EC.presence_of_element_located((By.XPATH,"//input[@placeholder='이메일']")))
            driver.find_element(By.XPATH,"//input[@placeholder='이메일']").send_keys(uid)
            driver.find_element(By.XPATH,"//input[@placeholder='비밀번호']").send_keys(upw)
            driver.find_element(By.XPATH,"//button[contains(text(),'로그인')]").click()
            time.sleep(4); log("✅ 로그인 완료")
        else:
            wait=WebDriverWait(driver,15)
        url=f"https://report.revu.net/service/campaigns/{cid}"
        log(f"📄 캠페인 {cid} 접속 중..."); driver.get(url); time.sleep(3)
        # ── 인플루언서 선정 탭 클릭 ──
        try:
            log("🎯 '인플루언서 선정' 탭 클릭")
            tab_found=False
            for sel in ["div.step.client-pick.past","div.step.client-pick.active","div.step.client-pick"]:
                try:
                    se=driver.find_element(By.CSS_SELECTOR,sel)
                    driver.execute_script("arguments[0].click();",se); tab_found=True
                    log(f"  ✅ 탭 클릭 성공 ({sel})"); break
                except: continue
            if not tab_found:
                try:
                    se=driver.find_element(By.XPATH,"//*[contains(text(),'인플루언서 선정')]")
                    driver.execute_script("arguments[0].click();",se); log("  ✅ 탭 클릭 성공 (XPath)")
                except: log("  ⚠️ 인플루언서 선정 탭 찾지 못함 — 현재 페이지에서 진행")
            time.sleep(3)
        except: pass
        # ── 팝업 닫기 ──
        log("  🔍 팝업 확인 중..."); time.sleep(2)
        for popup_sel in [
            "[class*='guide'] [class*='close']","[class*='modal'] [class*='close']",
            ".modal-close","button.close","img[src*='ic-close']",
            "button[class*='close']",".close-btn","[aria-label='close']","[aria-label='닫기']"]:
            try:
                pe=driver.find_element(By.CSS_SELECTOR,popup_sel)
                driver.execute_script("arguments[0].click();",pe); log(f"  ✅ 팝업 닫기 ({popup_sel})"); time.sleep(1); break
            except: continue
        # ── 캠페인 제목 추출 ──
        ctitle=""
        try:
            te=driver.find_element(By.CSS_SELECTOR,".campaign-title")
            if not te: te=driver.find_element(By.CSS_SELECTOR,"li.campaign-title")
            ctitle=te.text.strip()
            log(f"📋 캠페인: {ctitle}")
        except: pass
        # ── 더보기 버튼 클릭 (인스타도 동일) ──
        USER_COUNT_JS="return document.querySelectorAll('dl dd .user-info').length"
        log("📋 더보기 클릭 시작...")
        prev_count=0; stall=0
        for click_i in range(MORE_BTN_MAX_CLICKS):
            cur=driver.execute_script(USER_COUNT_JS) or 0
            if cmax>0 and cur>=cmax:
                log(f"  ✅ 최대 {cmax}명 도달 → 중단"); break
            if cur==prev_count: stall+=1
            else: stall=0
            if stall>=10:
                log(f"  ⏹ 변화 없음 {stall}회 → 중단"); break
            prev_count=cur
            try:
                btn=driver.find_element(By.XPATH,"//button[contains(text(),'더보기')]")
                driver.execute_script("arguments[0].click();",btn); time.sleep(MORE_BTN_WAIT)
                if (click_i+1)%10==0: log(f"  📋 더보기 {click_i+1}회 ({cur}명)")
            except:
                log(f"  ⏹ 더보기 버튼 없음 → 완료 ({cur}명)"); break
        # ── Phase 2: 인스타 리스트 파싱 ──
        log("🔍 인플루언서 리스트 파싱 중...")
        html=driver.page_source
        soup=BeautifulSoup(html,"html.parser")
        containers=soup.select("dl")
        data=[]
        for dl in containers:
            dd=dl.select_one("dd")
            if not dd: continue
            ui=dd.select_one(".user-info")
            if not ui: continue
            # 닉네임
            ne=ui.select_one(".nick")
            if not ne: continue
            # grade 뱃지 등 제거
            for badge in ne.select("span"): badge.decompose()
            nick=ne.get_text(strip=True)
            if not nick: continue
            # 인스타 핸들 + URL
            me=ui.select_one(".media-title a")
            handle=safe_text(me).strip() if me else ""
            insta_url=me["href"] if me and me.has_attr("href") else ""
            # 성별, 연령대
            mt=ui.select_one(".media-title")
            mt_text=safe_text(mt) if mt else ""
            parts=re.split(r"\|",mt_text)
            parts=[p.strip() for p in parts]
            gender=parts[1] if len(parts)>=2 else ""
            age=parts[2] if len(parts)>=3 else ""
            # 팔로워 범위 (텍스트 그대로)
            vc=dd.select_one(".visit-count")
            follower_text=safe_text(vc) if vc else ""
            # 추천 여부
            is_rec=bool(dd.select_one(".recommend-ic"))
            # 중복참여 (참여 배지)
            is_dup=False
            dup_el=dd.select_one(".user-request-status")
            if dup_el:
                dup_text=safe_text(dup_el)
                if "참여" in dup_text or "중복" in dup_text or "requested" in (dup_el.get("class","") or []):
                    is_dup=True
            # 이미 선정 여부
            is_picked=bool(dd.select_one(".mask"))
            data.append({
                "nickname":nick,"instagram_handle":handle,"instagram_url":insta_url,
                "gender":gender,"age":age,"follower_range_text":follower_text,
                "is_recommended":is_rec,"is_duplicate":is_dup,"is_picked":is_picked,
                "enriched":False,"exact_followers":None,"following":None,"post_count":None,
                "avg_likes":None,"avg_comments":None,"engagement_rate":None,
                "feed_avg_likes":None,"feed_avg_comments":None,"feed_engagement_rate":None,
                "reel_avg_likes":None,"reel_avg_comments":None,"reel_engagement_rate":None,
                "bio":None,"recent_post_count":None,
                "avg_reel_views":None,"max_reel_views":None,"reel_count":None,"latest_post_date":None,
                "is_verified":False,"is_private":False,"recent_posts_detail":None
            })
        if cmax>0: data=data[:cmax]
        log(f"✅ 인스타 리스트 파싱 완료: {len(data)}명")
        out={"meta":{"campaign_id":cid,"campaign_title":ctitle,"crawled_at":datetime.now().isoformat(),
                      "total_count":len(data),"platform":"instagram","version":"v5-insta","crawl_max":cmax},"influencers":data}
        fn=f"revu_insta_{cid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(fn,"w",encoding="utf-8") as f: json.dump(out,f,ensure_ascii=False,indent=2)
        log(f"💾 JSON: {fn}"); log(f"✅ 완료! {len(data)}명")
        return out
    except Exception as e:
        import traceback; traceback.print_exc()
        if cb: cb(f"❌ 오류: {e}")
        return {"meta":{"error":str(e)},"influencers":[]}
    finally:
        if _own_driver and driver: driver.quit()

# ═══════════════════════════════════════
# 📸 릴스 조회수 파싱 (Selenium — /reels/ 탭 직접)
# ═══════════════════════════════════════
def fetch_reels_views(handle,max_reels=12):
    """Selenium으로 instagram.com/{handle}/reels/ 의 조회수를 파싱"""
    from selenium.webdriver.common.by import By
    import time as _t
    views=[]
    try:
        driver=make_chrome_driver()
        url=f"https://www.instagram.com/{handle}/reels/"
        driver.get(url)
        _t.sleep(3)
        # 스크롤해서 릴스 더 로드
        for _ in range(2):
            driver.execute_script("window.scrollTo(0,document.body.scrollHeight)")
            _t.sleep(1.5)
        # 조회수 아이콘 옆 span에서 숫자 추출
        # 인스타 릴스 조회수: SVG(조회수 아이콘) + span 안의 숫자
        els=driver.find_elements(By.XPATH,'//span[contains(@class,"x1lliihq")]//span[contains(@class,"xdj266r")]')
        for el in els:
            txt=el.text.strip().replace(",","")
            if txt.isdigit():
                views.append(int(txt))
            elif txt:
                # 1.2만 → 12000 등 변환
                txt_l=txt.lower()
                mult=1
                if "만" in txt_l: mult=10000; txt_l=txt_l.replace("만","")
                elif "천" in txt_l: mult=1000; txt_l=txt_l.replace("천","")
                elif "k" in txt_l: mult=1000; txt_l=txt_l.replace("k","")
                elif "m" in txt_l: mult=1000000; txt_l=txt_l.replace("m","")
                try:
                    views.append(int(float(txt_l)*mult))
                except: pass
            if len(views)>=max_reels: break
        driver.quit()
    except Exception:
        try: driver.quit()
        except: pass
    return views

# ═══════════════════════════════════════
# 📸 INSTAGRAM ENRICHMENT (C안 — instaloader)
# ═══════════════════════════════════════
def enrich_instagram(influencers,enrich_max=10,insta_id="",insta_pw="",cb=None):
    """instaloader로 인스타 프로필 상세 데이터 보강. 세션파일+배치+랜덤딜레이+재시도."""
    import os, glob as globmod
    BATCH_SIZE=12; BATCH_PAUSE=(6,12); REQ_DELAY=(1.2,3)
    MAX_RETRY=2; RETRY_WAIT=(20,35)
    SESSION_DIR=os.path.expanduser("~/.config/instaloader")

    def log(m):
        if cb: cb(m)
        print(m)
    try:
        import instaloader
    except ImportError:
        log("⚠️ instaloader 미설치 — A안(REVU 기본 데이터)으로 진행")
        return influencers

    loader=instaloader.Instaloader()
    logged_in=False

    # 1) 기존 세션 파일 로드 시도
    if insta_id:
        session_file=os.path.join(SESSION_DIR,f"session-{insta_id}")
        if os.path.exists(session_file):
            try:
                loader.load_session_from_file(insta_id,session_file)
                # 세션 유효성 테스트
                loader.test_login()
                logged_in=True
                log(f"🔐 저장된 세션 로드 성공: {insta_id}")
            except Exception:
                log(f"⚠️ 저장된 세션 만료 — 재로그인 시도")

    # 2) 세션 없으면 ID/PW 로그인
    if not logged_in and insta_id and insta_pw:
        try:
            loader.login(insta_id,insta_pw)
            logged_in=True
            log(f"🔐 인스타 로그인 성공: {insta_id}")
            # 세션 저장
            try:
                os.makedirs(SESSION_DIR,exist_ok=True)
                loader.save_session_to_file(os.path.join(SESSION_DIR,f"session-{insta_id}"))
                log(f"💾 세션 파일 저장 완료")
            except Exception:
                pass
        except Exception as e:
            log(f"⚠️ 인스타 로그인 실패: {str(e)[:80]}")
            log(f"   → 2FA/보안인증이 필요할 수 있습니다")

    if not logged_in:
        log("📸 비로그인 모드 — 401 에러가 발생할 수 있습니다")

    target=influencers if enrich_max==0 else influencers[:enrich_max]
    enriched_count=0; failed_count=0; consec_401=0; stopped=False
    log(f"📋 보강 대상: {len(target)}명 (배치 {BATCH_SIZE}명씩, 요청간 {REQ_DELAY[0]}~{REQ_DELAY[1]}초)")

    for idx,inf in enumerate(target):
        if stopped: break
        # 배치 간 긴 휴식
        if idx>0 and idx%BATCH_SIZE==0:
            pause=random.uniform(*BATCH_PAUSE)
            log(f"  ⏸️ 배치 {idx//BATCH_SIZE} 완료 — {pause:.0f}초 대기...")
            time.sleep(pause)
            consec_401=0  # 배치 넘어가면 연속 카운트 리셋
        handle=inf.get("instagram_handle","").lstrip("@").strip()
        if not handle:
            failed_count+=1; continue

        success=False
        for attempt in range(MAX_RETRY+1):
            try:
                profile=instaloader.Profile.from_username(loader.context,handle)
                inf["exact_followers"]=profile.followers
                inf["following"]=profile.followees
                inf["post_count"]=profile.mediacount
                inf["bio"]=profile.biography
                inf["is_verified"]=profile.is_verified
                inf["is_private"]=profile.is_private
                all_posts=[]; feed_posts=[]; reel_posts_api=[]
                latest_date=None
                for post in profile.get_posts():
                    p_data={"likes":post.likes,"comments":post.comments,"is_video":post.is_video,"date":post.date_utc.isoformat() if post.date_utc else ""}
                    if post.is_video and hasattr(post,"video_view_count") and post.video_view_count:
                        p_data["views"]=post.video_view_count
                        reel_posts_api.append(p_data)
                    else:
                        feed_posts.append(p_data)
                    all_posts.append(p_data)
                    if latest_date is None and post.date_utc: latest_date=post.date_utc
                    if len(all_posts)>=20: break
                # ── 피드(이미지) 참여율 ──
                fp=feed_posts[:12]
                if fp:
                    inf["feed_avg_likes"]=round(sum(p["likes"] for p in fp)/len(fp))
                    inf["feed_avg_comments"]=round(sum(p["comments"] for p in fp)/len(fp))
                    fol=inf["exact_followers"] or 1
                    inf["feed_engagement_rate"]=round((inf["feed_avg_likes"]+inf["feed_avg_comments"])/fol*100,2)
                else:
                    inf["feed_avg_likes"]=0; inf["feed_avg_comments"]=0; inf["feed_engagement_rate"]=0
                # ── 릴스 참여율 (instaloader API에서 좋아요/댓글) ──
                rp_api=reel_posts_api[:12]
                if rp_api:
                    inf["reel_avg_likes"]=round(sum(p["likes"] for p in rp_api)/len(rp_api))
                    inf["reel_avg_comments"]=round(sum(p["comments"] for p in rp_api)/len(rp_api))
                    fol=inf["exact_followers"] or 1
                    inf["reel_engagement_rate"]=round((inf["reel_avg_likes"]+inf["reel_avg_comments"])/fol*100,2)
                else:
                    inf["reel_avg_likes"]=0; inf["reel_avg_comments"]=0; inf["reel_engagement_rate"]=0
                # ── 전체 참여율 (하위 호환) ──
                ap=all_posts[:12]
                if ap:
                    inf["avg_likes"]=round(sum(p["likes"] for p in ap)/len(ap))
                    inf["avg_comments"]=round(sum(p["comments"] for p in ap)/len(ap))
                    fol=inf["exact_followers"] or 1
                    inf["engagement_rate"]=round((inf["avg_likes"]+inf["avg_comments"])/fol*100,1)
                # ── 릴스 조회수: /reels/ 페이지에서 직접 파싱 (Selenium) ──
                reel_views=[]
                try:
                    reel_views=fetch_reels_views(handle,max_reels=12)
                    if reel_views:
                        log(f"    🎬 /reels/ 파싱: {len(reel_views)}개 · 최고 {max(reel_views):,} · 평균 {round(sum(reel_views)/len(reel_views)):,}")
                except Exception as rv_e:
                    log(f"    ⚠️ /reels/ 파싱 실패: {str(rv_e)[:60]}")
                # fallback: Selenium 실패 시 API 값 사용
                if not reel_views and reel_posts_api:
                    reel_views=[p.get("views",0) for p in reel_posts_api if p.get("views")]
                    if reel_views: log(f"    🔄 릴스 fallback(API): {len(reel_views)}개")
                inf["recent_post_count"]=len(all_posts)
                inf["latest_post_date"]=latest_date.isoformat() if latest_date else ""
                inf["avg_reel_views"]=round(sum(reel_views)/len(reel_views)) if reel_views else 0
                inf["max_reel_views"]=max(reel_views) if reel_views else 0
                inf["reel_count"]=len(reel_views)
                inf["recent_posts_detail"]=all_posts
                inf["enriched"]=True; enriched_count+=1; success=True; consec_401=0
                log(f"  📸 [{idx+1}/{len(target)}] @{handle} ✅ 팔로워 {inf['exact_followers']:,} · 팔로잉 {inf.get('following',0):,} · 참여율 {inf.get('engagement_rate',0)}% · 릴스 {inf.get('avg_reel_views',0):,}회")
                break
            except Exception as e:
                err_msg=str(e)[:100]
                el=err_msg.lower()
                is_auth="401" in err_msg or "unauthorized" in el
                is_rate=any(kw in el for kw in ["rate","429","please wait","too many"])

                if is_auth:
                    consec_401+=1
                    if consec_401>=3 and attempt==0:
                        # 3연속 401 → 긴 대기 후 재시도
                        wait=random.uniform(30,50)
                        log(f"  🔒 [{idx+1}] 연속 401 감지 ({consec_401}회) — {wait:.0f}초 대기 후 재시도...")
                        time.sleep(wait)
                        continue
                    elif consec_401>=5:
                        log(f"  🛑 연속 401 {consec_401}회 — 인증 문제로 보강 중단")
                        log(f"     → 인스타 계정에서 '의심스러운 로그인' 확인 후 승인하세요")
                        log(f"     → 또는 터미널에서: instaloader --login {insta_id} 실행 후 재시도")
                        inf["enriched"]=False; failed_count+=1; stopped=True
                        break
                    else:
                        inf["enriched"]=False; failed_count+=1
                        delay=random.uniform(3,6)
                        time.sleep(delay)
                        break
                elif is_rate and attempt<MAX_RETRY:
                    wait=random.uniform(*RETRY_WAIT)
                    log(f"  🚫 [{idx+1}] @{handle} Rate Limit — {wait:.0f}초 대기 후 재시도 ({attempt+1}/{MAX_RETRY})...")
                    time.sleep(wait)
                    continue
                elif is_rate:
                    log(f"  🚫 [{idx+1}] Rate Limit 재시도 소진 — 나머지 건너뜀")
                    inf["enriched"]=False; failed_count+=1; stopped=True
                    break
                else:
                    log(f"  ⚠️ [{idx+1}] @{handle} 실패: {err_msg}")
                    inf["enriched"]=False; failed_count+=1
                    break
        if success and not stopped:
            delay=random.uniform(*REQ_DELAY)
            time.sleep(delay)

    log(f"📊 보강 결과: 성공 {enriched_count} / 실패 {failed_count} / 전체 {len(influencers)}")
    if failed_count>0 and not logged_in:
        log(f"💡 팁: 터미널에서 아래 명령어로 수동 로그인 후 재시도하면 성공률이 높아집니다")
        log(f"   instaloader --login {insta_id or 'YOUR_ID'}")
    return influencers

# ═══════════════════════════════════════
# 📸 INSTAGRAM DATA MAPPER
# ═══════════════════════════════════════
def map_json_insta(jd):
    """인스타 크롤링 raw → UI 포맷 변환"""
    meta=jd.get("meta",{}); mapped=[]
    for idx,inf in enumerate(jd.get("influencers",[])):
        enriched=inf.get("enriched",False)
        followers=inf.get("exact_followers") or 0
        following=inf.get("following") or 0
        avg_likes=inf.get("avg_likes") or 0
        avg_comments=inf.get("avg_comments") or 0
        engagement_rate=inf.get("engagement_rate") or 0
        # 피드 분리
        feed_avg_likes=inf.get("feed_avg_likes") or 0
        feed_avg_comments=inf.get("feed_avg_comments") or 0
        feed_er=inf.get("feed_engagement_rate") or 0
        # 릴스 분리
        reel_avg_likes=inf.get("reel_avg_likes") or 0
        reel_avg_comments=inf.get("reel_avg_comments") or 0
        reel_er=inf.get("reel_engagement_rate") or 0
        recent_post_count=inf.get("recent_post_count") or 0
        avg_reel_views=inf.get("avg_reel_views") or 0
        max_reel_views=inf.get("max_reel_views") or 0
        reel_count=inf.get("reel_count") or 0
        latest_post_date=inf.get("latest_post_date") or ""
        bio=inf.get("bio") or ""
        category=infer_category(bio)
        ff_ratio=round(followers/following,1) if following and following>0 else 0
        posts_detail=inf.get("recent_posts_detail") or []
        mapped.append({
            "id":idx+1,"nickname":inf.get("nickname",""),
            "gender":inf.get("gender",""),"age":inf.get("age",""),
            "mediaName":inf.get("instagram_handle",""),
            "blogUrl":inf.get("instagram_url",""),
            "followers":followers,"following":following,"ffRatio":ff_ratio,
            "avgLikes":avg_likes,"avgComments":avg_comments,
            "engagementRate":engagement_rate,
            "feedAvgLikes":feed_avg_likes,"feedAvgComments":feed_avg_comments,"feedER":feed_er,
            "reelAvgLikes":reel_avg_likes,"reelAvgComments":reel_avg_comments,"reelER":reel_er,
            "category":category,"recentPostCount":recent_post_count,
            "avgReelViews":avg_reel_views,"maxReelViews":max_reel_views,"reelCount":reel_count,
            "latestPostDate":latest_post_date,
            "isRecommended":inf.get("is_recommended",False),
            "isDuplicate":inf.get("is_duplicate",False),
            "isVerified":inf.get("is_verified",False),
            "isPrivate":inf.get("is_private",False),
            "enriched":enriched,
            "followerRangeText":inf.get("follower_range_text",""),
            "bio":bio,"postsDetail":posts_detail,
        })
    return mapped,meta

# ═══════════════════════════════════════
# 📦 JSON → UI DATA MAPPER  (React mapCrawlerJson 1:1)
# ═══════════════════════════════════════
def map_json(jd):
    meta=jd.get("meta",{}); mapped=[]
    for idx,inf in enumerate(jd.get("influencers",[])):
        m=inf.get("blog_modal") or {}
        gv=lambda k,d=0: inf.get(k) if inf.get(k) else m.get(k,d)
        gs=lambda k,d="": inf.get(k,"") or m.get(k,d)
        kws=[{"keyword":kw.get("keyword",""),"volume":kw.get("search_volume",0),"rank":kw.get("rank",0)} for kw in (m.get("top_keywords") or [])]
        rp=[{"title":p.get("title",""),"date":p.get("date",""),"cat":p.get("category",""),"likes":p.get("likes",0),"comments":p.get("comments",0),"topExposure":p.get("is_top_exposed",False),"smartBlock":p.get("is_smart_block",False)} for p in (m.get("recent_posts") or [])]
        nb=gv("neighbors",0)
        nbr="상위 3%" if nb>=10000 else "상위 10%" if nb>=5000 else "상위 20%" if nb>=2000 else "상위 30%" if nb>=1000 else ""
        mapped.append({"id":idx+1,"nickname":inf.get("nickname",""),"gender":inf.get("gender",""),"age":inf.get("age",""),
            "blogName":m.get("blog_name","") or inf.get("media_name",""),"blogUrl":inf.get("media_url",""),
            "blogScore":gv("blog_score",0) or inf.get("basic_blog_score",0),"blogScoreDesc":gs("blog_score_description"),
            "avgVisitors":inf.get("avg_visitors",0) or m.get("avg_visitors_monthly",0),
            "yesterdayVisitors":gv("yesterday_visitors",0),"totalVisitors":gv("total_visitors",0),
            "neighbors":nb,"neighborRank":nbr,"scraps":gv("scraps",0),"openDate":gs("open_date"),
            "category":gs("category") or inf.get("basic_category",""),"adActivity":gs("ad_activity","보통"),
            "avgLikes":gv("avg_likes",0),"avgComments":gv("avg_comments",0),
            "avgChars":gv("avg_chars",0),"avgImages":gv("avg_images",0),"avgVideos":gv("avg_videos",0),
            "postFreq7d":gv("post_freq_7d",0),
            "topKeywords":m.get("top_keyword_count",0) or len(kws),"topKeywordList":kws,"recentPosts":rp,
            "topExposureFlag":inf.get("top_exposure_flag","X"),"isDuplicate":inf.get("is_duplicate",False)})
    return mapped,meta

# ═══════════════════════════════════════
# 📸 INSTAGRAM DEMO DATA  (React INSTA_DATA 1:1)
# ═══════════════════════════════════════
INSTA_DEMO=[
    {"id":101,"nickname":"daily_jieun","gender":"여자","age":"20대","mediaName":"@daily_jieun","followers":32400,"following":850,"ffRatio":38.1,"avgLikes":1850,"avgComments":95,"engagementRate":5.7,"feedAvgLikes":2100,"feedAvgComments":110,"feedER":6.8,"reelAvgLikes":1500,"reelAvgComments":75,"reelER":4.9,"category":"뷰티","recentPostCount":12,"avgReelViews":28000,"maxReelViews":68000,"reelCount":5,"latestPostDate":"2026-03-14","aiScore":92,"aiReason":"피드 참여율 6.8%, 릴스 참여율 4.9%로 균형. 릴스 최고 6.8만 조회."},
    {"id":102,"nickname":"food_master_kr","gender":"남자","age":"30대","mediaName":"@food_master_kr","followers":85200,"following":1200,"ffRatio":71.0,"avgLikes":3200,"avgComments":180,"engagementRate":3.9,"feedAvgLikes":2800,"feedAvgComments":150,"feedER":3.5,"reelAvgLikes":3800,"reelAvgComments":220,"reelER":4.7,"category":"맛집","recentPostCount":8,"avgReelViews":45000,"maxReelViews":120000,"reelCount":4,"latestPostDate":"2026-03-12","aiScore":88,"aiReason":"릴스 참여율 4.7%가 피드 3.5%보다 높음. 릴스 최고 12만 조회."},
    {"id":103,"nickname":"travel_hana","gender":"여자","age":"30대","mediaName":"@travel_hana","followers":45800,"following":680,"ffRatio":67.4,"avgLikes":2400,"avgComments":120,"engagementRate":5.2,"feedAvgLikes":2000,"feedAvgComments":90,"feedER":4.6,"reelAvgLikes":3200,"reelAvgComments":165,"reelER":7.3,"category":"여행","recentPostCount":6,"avgReelViews":52000,"maxReelViews":185000,"reelCount":3,"latestPostDate":"2026-03-10","aiScore":90,"aiReason":"릴스 참여율 7.3%로 매우 높음. 릴스 최고 18.5만 조회. 확산력 우수."},
    {"id":104,"nickname":"fit_junghoon","gender":"남자","age":"20대","mediaName":"@fit_junghoon","followers":120000,"following":520,"ffRatio":230.8,"avgLikes":4100,"avgComments":210,"engagementRate":3.4,"feedAvgLikes":3500,"feedAvgComments":180,"feedER":3.1,"reelAvgLikes":5200,"reelAvgComments":280,"reelER":4.6,"category":"운동/건강","recentPostCount":15,"avgReelViews":89000,"maxReelViews":340000,"reelCount":8,"latestPostDate":"2026-03-15","aiScore":82,"aiReason":"팔로워 12만. 릴스 최고 34만 조회로 확산력 우수. 피드 참여율 3.1% 다소 낮음."},
    {"id":105,"nickname":"mom_soyeon","gender":"여자","age":"30대","mediaName":"@mom_soyeon","followers":18900,"following":430,"ffRatio":44.0,"avgLikes":1200,"avgComments":85,"engagementRate":6.3,"feedAvgLikes":1400,"feedAvgComments":95,"feedER":7.9,"reelAvgLikes":900,"reelAvgComments":70,"reelER":5.1,"category":"육아","recentPostCount":10,"avgReelViews":15000,"maxReelViews":42000,"reelCount":6,"latestPostDate":"2026-03-13","aiScore":86,"aiReason":"피드 참여율 7.9%로 최상위. 릴스 참여율도 5.1%. 충성 팔로워 강점."},
]


# ══════════════════════════════════════════════════════════
# 🎨 STREAMLIT APP
# ══════════════════════════════════════════════════════════
st.set_page_config(page_title="REVU Selector",page_icon="🎯",layout="wide",initial_sidebar_state="collapsed")

# ── Theme Init (CSS 앞에 필요) ──
if "theme" not in st.session_state: st.session_state.theme="dark"
t=THEMES[st.session_state.theme]

# ── Global CSS ──
st.markdown(f"""<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
html,body,.stApp,[data-testid="stAppViewContainer"],
.stMarkdown,.stMarkdown p,.stMarkdown span,
.stMarkdown h1,.stMarkdown h2,.stMarkdown h3,.stMarkdown h4,.stMarkdown li,
button,input,select,textarea,
div[data-testid="stMetric"] label,
div[data-testid="stMetric"] [data-testid="stMetricValue"],
.stTextInput label,.stNumberInput label,.stSelectbox label,
.stCheckbox label span,
[data-testid="stWidgetLabel"]{{
    font-family:'Pretendard Variable','Pretendard','Apple SD Gothic Neo',sans-serif!important;
}}
[data-testid="stExpander"] [data-testid="stMarkdownContainer"] p,
[data-testid="stExpander"] [data-testid="stMarkdownContainer"] span{{
    font-family:'Pretendard Variable','Pretendard','Apple SD Gothic Neo',sans-serif!important;
}}
/* ── 배경 ── */
.stApp,[data-testid="stAppViewContainer"]{{background:{t["bg_app"]}!important;color:{t["text_primary"]}!important;}}
[data-testid="stSidebar"]{{display:none!important;}}
header[data-testid="stHeader"]{{background:transparent!important;}}
.block-container{{max-width:1320px;padding-top:1.5rem;}}
/* ── 텍스트 ── */
.stMarkdown p,.stMarkdown span,.stMarkdown li,.stMarkdown div,.stMarkdown strong,.stMarkdown b{{color:{t["text_primary"]}!important;}}
.stMarkdown h1,.stMarkdown h2,.stMarkdown h3,.stMarkdown h4{{color:{t["text_heading"]}!important;}}
.stCaption p{{color:{t["text_caption"]}!important;}}
/* ── 메트릭 ── */
div[data-testid="stMetric"] label{{color:{t["metric_label"]}!important;font-size:11px!important;}}
div[data-testid="stMetric"] [data-testid="stMetricValue"]{{color:{t["metric_value"]}!important;font-weight:800!important;}}
div[data-testid="stMetric"] [data-testid="stMetricDelta"]{{color:{t["metric_delta"]}!important;}}
/* ── 프로그레스 ── */
.stProgress>div>div{{background-color:{t["accent"]}!important;}}
/* ── 버튼 ── */
button[data-testid="stBaseButton-primary"]{{font-weight:700!important;border-radius:10px!important;background:{t["accent"]}!important;color:#fff!important;border:none!important;}}
button[data-testid="stBaseButton-primary"]:hover{{background:{t["accent_hover"]}!important;}}
button[data-testid="stBaseButton-secondary"]{{font-weight:600!important;border-radius:10px!important;background:{t["btn_sec_bg"]}!important;color:{t["btn_sec_text"]}!important;border:1px solid {t["btn_sec_border"]}!important;}}
button[data-testid="stBaseButton-secondary"]:hover{{background:{t["bg_hover"]}!important;border-color:{t["accent"]}!important;}}
.stDownloadButton>button{{border-radius:10px!important;background:{t["btn_sec_bg"]}!important;color:{t["btn_sec_text"]}!important;border:1px solid {t["btn_sec_border"]}!important;}}
.stDownloadButton>button:hover{{border-color:{t["accent"]}!important;}}
/* ── Expander ── */
[data-testid="stExpander"]{{border:1px solid {t["border"]}!important;border-radius:12px!important;background:{t["bg_surface"]}!important;}}
[data-testid="stExpander"] summary{{background:{t["bg_surface"]}!important;color:{t["btn_sec_text"]}!important;}}
[data-testid="stExpander"] summary:hover{{background:{t["bg_hover"]}!important;}}
/* ── Input ── */
.stTextInput>label,.stNumberInput>label,.stSelectbox>label,[data-testid="stWidgetLabel"]{{font-size:13px!important;font-weight:700!important;color:{t["text_heading"]}!important;}}
.stTextInput input,.stNumberInput input{{background:{t["bg_input"]}!important;color:{t["text_primary"]}!important;border:1.5px solid {t["border_divider"]}!important;border-radius:10px!important;}}
.stTextInput input:focus,.stNumberInput input:focus{{border-color:{t["border_focus"]}!important;box-shadow:0 0 0 2px rgba(139,92,246,0.25)!important;}}
/* ── Selectbox 전체 오버라이드 ── */
.stSelectbox [data-baseweb="select"]{{background:{t["bg_input"]}!important;border:1.5px solid {t["border_divider"]}!important;border-radius:10px!important;}}
.stSelectbox [data-baseweb="select"]>div{{background:{t["bg_input"]}!important;border:none!important;}}
.stSelectbox [data-baseweb="select"]>div>div{{background:{t["bg_input"]}!important;}}
.stSelectbox [data-baseweb="select"] div{{color:{t["select_text"]}!important;}}
.stSelectbox [data-baseweb="select"] div[value]{{color:{t["select_text"]}!important;font-weight:700!important;font-size:14px!important;}}
.stSelectbox [data-baseweb="select"] input{{color:{t["select_text"]}!important;background:transparent!important;}}
.stSelectbox [data-baseweb="select"] input[role="combobox"]{{color:{t["select_text"]}!important;}}
.stSelectbox [data-baseweb="select"] svg{{fill:{t["select_text"]}!important;color:{t["select_text"]}!important;}}
.stSelectbox [data-baseweb="select"] span{{color:{t["select_text"]}!important;}}
/* Streamlit st-* 클래스 강제 (버전 무관하게) */
.stSelectbox div[class*="st-"]{{background-color:{t["bg_input"]}!important;color:{t["select_text"]}!important;}}
.stSelectbox input[class*="st-"]{{background-color:transparent!important;color:{t["select_text"]}!important;}}
/* 드롭다운 리스트 */
[data-baseweb="popover"]{{background:{t["bg_input"]}!important;border:1px solid {t["border_divider"]}!important;}}
[data-baseweb="popover"] li{{color:{t["select_text"]}!important;background:{t["bg_input"]}!important;}}
[data-baseweb="popover"] li:hover{{background:{t["bg_hover"]}!important;}}
[data-baseweb="popover"] [role="option"]{{color:{t["select_text"]}!important;background:{t["bg_input"]}!important;}}
[data-baseweb="popover"] [role="option"]:hover{{background:{t["bg_hover"]}!important;}}
[data-baseweb="popover"] [aria-selected="true"]{{background:{t["accent_bg"]}!important;}}
/* placeholder */
.stTextInput input::placeholder,.stNumberInput input::placeholder{{color:{t["text_placeholder"]}!important;opacity:1!important;}}
input::placeholder{{color:{t["text_placeholder"]}!important;opacity:1!important;}}
/* ── Container (border=True) ── */
div[data-testid="stVerticalBlock"]>div[data-testid="stVerticalBlockBorderWrapper"]{{background:{t["bg_card"]}!important;border-radius:16px!important;border:1px solid {t["border"]}!important;box-shadow:{t["shadow"]}!important;padding:24px 20px!important;}}
div[data-testid="stVerticalBlockBorderWrapper"]>div{{padding:0!important;}}
/* ── Divider ── */
hr{{border-color:{t["border_divider"]}!important;}}
/* ── Dialog ── */
[data-testid="stModal"] [data-testid="stModalBody"]{{background:{t["bg_card"]}!important;}}
/* ── 텍스트 오버플로 방지 ── */
button p{{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}}
</style>""",unsafe_allow_html=True)

# ── State Init ──
D={"step":"platform","platform":None,"data":[],"meta":{},"sel":set(),"purpose":"general",
   "tab":"ai","sort_key":"aiScore","sort_dir":"desc","expanded":None,"show_modal":False,"data_source":None,
   "nf_minVis":"","nf_minScore":"전체","nf_gender":"전체","nf_age":"전체","nf_cat":"전체","nf_ad":"전체","nf_minKw":"","nf_minLk":"",
   "if_minFol":"","if_gender":"전체","if_age":"전체","if_cat":"전체","if_minEng":"","if_minLk":"","if_minCmt":"","if_minReel":"","if_minFF":"","if_minReelEng":""}
for k,v in D.items():
    if k not in st.session_state: st.session_state[k]=v

# ── Theme Toggle ──
_tl,_tr=st.columns([12,1])
with _tr:
    _ti="☀️" if st.session_state.theme=="dark" else "🌙"
    if st.button(_ti,key="theme_toggle"):
        st.session_state.theme="light" if st.session_state.theme=="dark" else "dark"
        st.rerun()

# ═══════════════════════════════════════
# STEP: 플랫폼 선택  (React Step 1)
# ═══════════════════════════════════════
if st.session_state.step=="platform":
    st.markdown("<div style='height:80px'></div>",unsafe_allow_html=True)
    _,cc,_=st.columns([1,2,1])
    with cc:
        st.markdown(f"""<div style="text-align:center;margin-bottom:36px;">
            <div style="font-size:40px;margin-bottom:8px;">🎯</div>
            <h1 style="font-size:28px;font-weight:800;color:{t["text_heading"]};margin:0 0 8px;">REVU Influencer Selector</h1>
            <p style="color:{t["text_caption"]};font-size:15px;margin:0;">캠페인 유형을 선택해주세요</p>
        </div>""",unsafe_allow_html=True)
        c1,c2=st.columns(2,gap="large")
        with c1:
            st.markdown(f"""<div style="background:{t["bg_card"]};border:2px solid {t["naver_border"]};border-radius:16px;padding:32px 24px;text-align:center;color:{t["text_primary"]};box-shadow:{t["shadow"]};">
                <div style="font-size:36px;margin-bottom:12px;">📝</div>
                <div style="font-size:18px;font-weight:800;color:{t["text_heading"]};margin-bottom:8px;">네이버 블로그</div>
                <div style="font-size:13px;color:{t["text_secondary"]};line-height:1.5;">블로그 스코어, 방문자수, 상위노출 키워드 등 심층 분석 데이터 제공</div>
            </div>""",unsafe_allow_html=True)
            if st.button("📝 네이버 블로그 선택 →",use_container_width=True,type="primary",key="p_nav"):
                st.session_state.platform="naver"; st.session_state.step="crawl"; st.rerun()
        with c2:
            st.markdown(f"""<div style="background:{t["bg_card"]};border:2px solid {t["insta_border"]};border-radius:16px;padding:32px 24px;text-align:center;color:{t["text_primary"]};box-shadow:{t["shadow"]};">
                <div style="font-size:36px;margin-bottom:12px;">📸</div>
                <div style="font-size:18px;font-weight:800;color:{t["text_heading"]};margin-bottom:8px;">인스타그램</div>
                <div style="font-size:13px;color:{t["text_secondary"]};line-height:1.5;">팔로워, 참여율, 좋아요/댓글 등 기본 지표 기반 선정</div>
            </div>""",unsafe_allow_html=True)
            if st.button("📸 인스타그램 선택 →",use_container_width=True,key="p_ins"):
                st.session_state.platform="instagram"; st.session_state.step="crawl"; st.rerun()
    st.stop()


# ═══════════════════════════════════════
# STEP: 크롤링  (React Step 2 — JSON 업로드 제거)
# ═══════════════════════════════════════
if st.session_state.step=="crawl":
    is_naver=st.session_state.platform=="naver"
    pe="📝" if is_naver else "📸"
    pl="네이버 블로그" if is_naver else "인스타그램"
    pbg,pfg=(t["naver_bg"],t["naver_text"]) if is_naver else (t["insta_bg"],t["insta_text"])

    # Card CSS
    st.markdown(f"""<style>
    div[data-testid="stVerticalBlock"]>div[data-testid="stVerticalBlockBorderWrapper"]{{background:{t["bg_card"]}!important;border-radius:20px!important;border:1px solid {t["border"]}!important;box-shadow:{t["shadow"]}!important;padding:28px 24px!important;}}
    div[data-testid="stVerticalBlockBorderWrapper"]>div{{padding:0!important;}}
    div[data-testid="stVerticalBlockBorderWrapper"] [data-testid="stExpander"]{{background:{t["bg_surface"]}!important;border:1px solid {t["border"]}!important;border-radius:12px!important;box-shadow:none!important;}}
    div[data-testid="stVerticalBlockBorderWrapper"] [data-testid="stExpander"] summary{{background:{t["bg_surface"]}!important;border-radius:12px!important;}}
    div[data-testid="stVerticalBlockBorderWrapper"] input{{background-color:{t["bg_input"]}!important;border:1.5px solid {t["border"]}!important;border-radius:12px!important;padding:12px 16px!important;color:{t["text_primary"]}!important;font-size:15px!important;}}
    div[data-testid="stVerticalBlockBorderWrapper"] input:focus{{border-color:{t["border_focus"]}!important;box-shadow:0 0 0 2px rgba(139,92,246,0.2)!important;}}
    </style>""",unsafe_allow_html=True)

    st.markdown("<div style='height:48px'></div>",unsafe_allow_html=True)
    _,cc,_=st.columns([1,2,1])
    with cc:
        if st.button("← 유형 변경",key="cr_back"):
            st.session_state.step="platform"; st.session_state.platform=None; st.rerun()
        st.markdown(f'<div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;"><span style="font-size:28px;">{pe}</span><div><h2 style="margin:0;font-size:20px;font-weight:800;">데이터 수집</h2><span style="padding:2px 10px;border-radius:6px;font-size:11px;font-weight:700;background:{pbg};color:{pfg};">{pl}</span></div></div>',unsafe_allow_html=True)

        with st.container(border=True):
            cid_raw=st.text_area("📌 캠페인 ID (복수 입력 가능 — 쉼표/줄바꿈 구분)",value="",placeholder="예: 1268816, 1306557\n또는 한 줄에 하나씩",height=80)
            cid_list=[x.strip() for x in re.split(r'[,\s\n]+', cid_raw) if x.strip() and x.strip().isdigit()]
            if cid_list:
                st.caption(f"총 {len(cid_list)}개 캠페인: {', '.join(cid_list)}")
                for _cid in cid_list[:3]:
                    st.caption(f"  → https://report.revu.net/service/campaigns/{_cid}")
                if len(cid_list)>3: st.caption(f"  ... 외 {len(cid_list)-3}개")
            st.divider()
            with st.expander("🔐 REVU 로그인 정보",expanded=False):
                uid=st.text_input("이메일",value=DEFAULT_UID)
                upw=st.text_input("비밀번호",value=DEFAULT_UPW,type="password")
            with st.expander("⚙️ 크롤링 설정",expanded=False):
                cmax=st.number_input("크롤링 최대 인원 (0=전체)",min_value=0,max_value=1000,value=0,step=10,
                                     help="테스트용: 30~50명으로 설정하면 빠르게 확인 가능. 0=전체 크롤링")
                if is_naver:
                    mmax=st.number_input("모달 스크래핑 최대 인원 (0=전체)",min_value=0,max_value=500,value=5,step=5)
                else:
                    enrich_max=st.number_input("📸 인스타 보강 최대 인원 (0=전체)",min_value=0,max_value=200,value=10,step=5,
                                               help="instaloader로 상세 데이터를 가져올 최대 인원. 0=전체. 느릴 수 있습니다.")
            if not is_naver:
                with st.expander("📸 인스타그램 계정",expanded=False):
                    st.caption("인스타 프로필 보강용 계정입니다.")
                    insta_id=st.text_input("인스타 ID",value="urbanstay_official",key="insta_id")
                    insta_pw=st.text_input("인스타 PW",value="djqkstmxpdl7694!",type="password",key="insta_pw")

            dis=len(cid_list)==0
            if st.button("🚀 크롤링 시작",type="primary",use_container_width=True,disabled=dis):
                la=st.empty(); pb=st.progress(0,text="크롤링 준비 중...")
                logs=[]
                def on_p(msg):
                    logs.append(msg)
                    la.code("\n".join(logs[-12:]),language=None)
                    pb.progress(min(len(logs)*2,95),text=msg)

                # ── 복수 캠페인 일괄 크롤링 (driver 1회 생성 → 공유) ──
                all_mapped=[]; all_meta={}; total_ok=0
                shared_driver=None
                with st.spinner("크롤링 진행 중..."):
                  try:
                    # ── 드라이버 1회 생성 + 로그인 ──
                    if len(cid_list)>0:
                        from selenium.webdriver.common.by import By
                        from selenium.webdriver.support.ui import WebDriverWait
                        from selenium.webdriver.support import expected_conditions as EC
                        on_p("🔧 ChromeDriver 준비 중...")
                        shared_driver=make_chrome_driver()
                        _wait=WebDriverWait(shared_driver,15)
                        on_p("🔐 로그인 중...")
                        shared_driver.get(LOGIN_URL)
                        _wait.until(EC.presence_of_element_located((By.XPATH,"//input[@placeholder='이메일']")))
                        shared_driver.find_element(By.XPATH,"//input[@placeholder='이메일']").send_keys(uid)
                        shared_driver.find_element(By.XPATH,"//input[@placeholder='비밀번호']").send_keys(upw)
                        shared_driver.find_element(By.XPATH,"//button[contains(text(),'로그인')]").click()
                        time.sleep(4); on_p("✅ 로그인 완료")

                    for ci,cid in enumerate(cid_list):
                        on_p(f"━━━ [{ci+1}/{len(cid_list)}] 캠페인 {cid} 크롤링 시작 ━━━")
                        if is_naver:
                            res=crawl_revu(cid,uid,upw,mmax,cmax,on_p,driver=shared_driver)
                        else:
                            res=crawl_revu_insta(cid,uid,upw,cmax,on_p,driver=shared_driver)
                            if res.get("influencers"):
                                on_p("📸 인스타 프로필 보강 시작...")
                                _iid=insta_id if 'insta_id' in dir() else ""
                                _ipw=insta_pw if 'insta_pw' in dir() else ""
                                _emax=enrich_max if 'enrich_max' in dir() else 10
                                res["influencers"]=enrich_instagram(res["influencers"],_emax,_iid,_ipw,on_p)

                        if res.get("influencers"):
                            if is_naver:
                                mapped,rmeta=map_json(res)
                            else:
                                mapped,rmeta=map_json_insta(res)
                            # 각 인플루언서에 캠페인 출처 태깅
                            for m in mapped:
                                m["_srcCampaignId"]=cid
                            all_mapped.extend(mapped)
                            if not all_meta: all_meta=rmeta  # 첫 캠페인 메타 기준
                            total_ok+=1
                            # ── AI 점수 계산 (Supabase 저장 전에 반드시 수행) ──
                            if is_naver:
                                for d in mapped:
                                    ac=calc_accom(d); d["_accom"]=ac; d["accomFit"]=calc_accom_score(ac)
                                _all_ac=[d["accomFit"] for d in mapped]
                                for d in mapped:
                                    d["_accom"]["percentile"]=calc_accom_percentile(d["accomFit"],_all_ac)
                                calc_all_naver(mapped, AI_WEIGHTS)
                            else:
                                calc_all_insta(mapped, AI_WEIGHTS_INSTA)
                            on_p(f"✅ 캠페인 {cid}: {len(mapped)}명 수집 + AI점수 계산 완료")

                            # ── Supabase 저장 (AI 점수 포함) ──
                            try:
                                from supabase_sync import save_crawl_to_supabase, update_ai_scores
                                ai_map={}
                                for _m in mapped:
                                    _key=_m.get("nickname") or _m.get("mediaName","")
                                    if _key: ai_map[_key]=_m.get("aiScore",0)
                                sb_res=save_crawl_to_supabase(res, ai_scores=ai_map)
                                if sb_res.get("ok"):
                                    on_p(f"☁️ Supabase 저장 완료 ({sb_res['applicant_count']}명)")
                                else:
                                    on_p(f"⚠️ Supabase 저장 실패: {sb_res.get('error','')}")
                            except Exception as _sbe:
                                on_p(f"⚠️ Supabase 연동 스킵: {_sbe}")
                        else:
                            err_msg=res.get("meta",{}).get("error","알 수 없는 오류")
                            on_p(f"❌ 캠페인 {cid} 실패: {err_msg}")
                  finally:
                    # ── 공유 드라이버 종료 ──
                    if shared_driver:
                        try: shared_driver.quit()
                        except: pass
                        on_p("🔧 ChromeDriver 종료")

                if all_mapped:
                    # 복수 캠페인 메타 업데이트
                    if len(cid_list)>1:
                        all_meta["campaign_id"]=",".join(cid_list)
                        all_meta["campaign_title"]=f"[{total_ok}개 캠페인 통합] {all_meta.get('campaign_title','')}"
                        all_meta["total_count"]=len(all_mapped)
                    # 닉네임 중복 체크 (복수 캠페인 간)
                    seen_nicks={}
                    for m in all_mapped:
                        nk=m.get("nickname","")
                        if nk in seen_nicks:
                            m["isDuplicate"]=True
                            seen_nicks[nk]["isDuplicate"]=True
                        else:
                            seen_nicks[nk]=m
                    st.session_state.data=all_mapped; st.session_state.meta=all_meta
                    st.session_state.data_source="crawl"; st.session_state.step="data"
                    on_p(f"🎉 총 {len(all_mapped)}명 수집 완료 ({total_ok}/{len(cid_list)} 캠페인 성공)")
                    pb.progress(100,text="✅ 완료!"); time.sleep(1); st.rerun()
                else:
                    pb.progress(100,text="❌ 실패"); st.error("모든 캠페인에서 데이터를 가져오지 못했습니다.")
    st.stop()


# ═══════════════════════════════════════
# SHARED: 공통 변수
# ═══════════════════════════════════════
data=st.session_state.data; meta=st.session_state.meta
is_naver=st.session_state.platform=="naver"
w=AI_WEIGHTS
sn=len(st.session_state.sel)
crawled=meta.get("crawled_at","")[:16].replace("T"," ") if meta.get("crawled_at") else ""
ver=meta.get("version","")
src_bdg=f'<span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:{t["success_bg"]};color:{t["success"]};border:1px solid {t["success_border"]};">📄 실데이터{" · "+ver if ver else ""}</span>' if st.session_state.data_source else f'<span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:{t["warning_bg"]};color:{t["warning"]};border:1px solid {t["warning_border"]};">🧪 데모</span>'
plat_bdg=f'<span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:{t["naver_bg"] if is_naver else t["insta_bg"]};color:{t["naver_text"] if is_naver else t["insta_text"]};">{"네이버 블로그" if is_naver else "인스타그램"}</span>'

# 네이버: 숙소 적합도 + AI 스코어 계산 (상대평가 v2)
if is_naver:
    for d in data:
        ac=calc_accom(d)
        d["_accom"]=ac
        d["accomFit"]=calc_accom_score(ac)
    all_accom=[d["accomFit"] for d in data]
    for d in data:
        d["_accom"]["percentile"]=calc_accom_percentile(d["accomFit"],all_accom)
    # ★ 상대평가 일괄 계산 (전체 모수 대비 percentile → 1등=100점)
    calc_all_naver(data, w)
# 인스타: AI 스코어 계산 (상대평가 v2)
else:
    w_insta=AI_WEIGHTS_INSTA
    # ★ 상대평가 일괄 계산
    calc_all_insta(data, w_insta)


# ═══════════════════════════════════════
# STEP: 전체 데이터 보기  (React Step 3)
# ═══════════════════════════════════════
if st.session_state.step=="data":
    # ── Header (React Header 1:1) ──
    ct=meta.get("campaign_title","")
    hl,hr=st.columns([6,2])
    with hl:
        if st.button("← 이전",key="d_back"): st.session_state.step="crawl"; st.rerun()
        sub_parts=[]
        if meta.get("campaign_id"): sub_parts.append(f'캠페인 ID: {meta["campaign_id"]}')
        if ct: sub_parts.append(ct)
        sub_parts.append(f'{len(data)}명')
        if crawled: sub_parts.append(f'수집: {crawled}')
        st.markdown(f'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;"><h1 style="font-size:20px;font-weight:800;margin:0;color:{t["text_heading"]};">{"📝" if is_naver else "📸"} 수집 데이터 전체보기</h1>{plat_bdg} {src_bdg}</div><p style="color:{t["text_secondary"]};font-size:12px;margin:4px 0 0;">{" · ".join(sub_parts)}</p>',unsafe_allow_html=True)
    with hr:
        df_all=pd.DataFrame([{"순위":i+1,"닉네임":d["nickname"],"중복참여":"O" if d.get("isDuplicate") else "","블로그스코어":d.get("blogScore",0),"평균방문자":d.get("avgVisitors",0),"이웃수":d.get("neighbors",0),"상위키워드":d.get("topKeywords",0),"평균좋아요":d.get("avgLikes",0),"카테고리":d.get("category",""),"블로그URL":d.get("blogUrl","")} for i,d in enumerate(data)] if is_naver else [{"순위":i+1,"닉네임":d["nickname"],"계정":d.get("mediaName",""),"팔로워":d.get("followers",0),"참여율":d.get("engagementRate",0),"평균좋아요":d.get("avgLikes",0),"카테고리":d.get("category","")} for i,d in enumerate(data)])
        st.download_button("📥 CSV 내보내기",df_all.to_csv(index=False).encode("utf-8-sig"),f"revu_{meta.get('campaign_id','')}_전체.csv","text/csv",use_container_width=True,key="d_csv")

    # 모달 경고
    if is_naver:
        no_m=sum(1 for d in data if not d.get("blogScore") and not d.get("avgLikes"))
        if no_m>0:
            st.markdown(f'<div style="background:{t["warning_bg"]};border:1px solid {t["warning_border"]};border-radius:10px;padding:10px 16px;margin-bottom:12px;font-size:12px;color:{t["warning"]};">⚠️ {no_m}명의 블로그 분석 모달 데이터가 없습니다. 크롤러에서 모달 최대 인원을 0(전체)으로 설정 후 다시 크롤링하세요.</div>',unsafe_allow_html=True)

    # 안내 배너
    bn1,bn2=st.columns([5,1])
    with bn1:
        st.markdown(f'<div style="background:{t["info_bg"]};border:1px solid {t["info_border"]};border-radius:10px;padding:12px 16px;font-size:13px;color:{t["info"]};">수집된 전체 인플루언서 <strong>{len(data)}명</strong>의 데이터입니다. 확인 후 <strong>선정하기</strong>로 이동하세요.</div>',unsafe_allow_html=True)
    with bn2:
        if st.button("선정하기 →",type="primary",use_container_width=True,key="goto_sel"):
            st.session_state.step="select"; st.session_state.sort_key="aiScore"; st.session_state.sort_dir="desc"; st.rerun()

    # ── 네이버 테이블 ──
    if is_naver:
        # 중복참여 수 표시
        dup_cnt=sum(1 for d in data if d.get("isDuplicate"))
        if dup_cnt>0:
            st.markdown(f'<div style="background:{t["danger_bg"]};border:1px solid {t["danger_border"]};border-radius:10px;padding:10px 16px;margin-bottom:12px;font-size:12px;color:{t["danger"]};">🔁 중복참여 인플루언서 <strong>{dup_cnt}명</strong> 감지됨 — 선정 시 참고하세요.</div>',unsafe_allow_html=True)
        DGTC="36px 1.8fr 0.5fr 0.6fr 0.6fr 0.6fr 0.6fr 0.5fr 0.5fr 0.5fr"
        hdr=f'<div style="display:grid;grid-template-columns:{DGTC};padding:10px 14px;background:{t["bg_table_header"]};border-radius:10px 10px 0 0;font-size:11px;font-weight:700;color:{t["text_secondary"]};border-bottom:2px solid {t["border_divider"]};"><div>#</div><div>인플루언서</div><div>스코어</div><div>방문자</div><div>이웃수</div><div>키워드</div><div>좋아요</div><div>주간글</div><div>광고</div><div>카테고리</div></div>'
        rows_h=f'<div style="background:{t["bg_table_header"]};border-radius:0 0 10px 10px;overflow:hidden;color:{t["text_primary"]};box-shadow:{t["shadow"]};">'
        for i,d in enumerate(data):
            bg=t["row_even"] if i%2==0 else t["row_odd"]
            nb=d.get("neighbors",0); nbr=d.get("neighborRank","")
            dup_bdg=f'<span style="background:{t["danger_bg"]};color:{t["danger"]};padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">중복</span>' if d.get("isDuplicate") else ""
            rows_h+=f'<div style="display:grid;grid-template-columns:{DGTC};padding:11px 14px;align-items:center;border-bottom:1px solid {t["border"]};background:{bg};font-size:13px;color:{t["text_primary"]};"><div style="color:{t["text_secondary"]};font-size:12px;">{i+1}</div><div style="color:{t["text_primary"]};"><span style="font-weight:700;color:{t["text_heading"]};">{d["nickname"]}</span>{dup_bdg}<div style="font-size:11px;color:{t["text_secondary"]};">{d.get("blogName","")}</div></div><div>{bdg_html(d.get("blogScore",0),t)}</div><div style="font-weight:700;color:{t["text_heading"]};">{d.get("avgVisitors",0):,}</div><div style="color:{t["text_primary"]};">{nb:,}<div style="font-size:10px;color:{t["accent_light"]};">{nbr}</div></div><div style="color:{t["text_primary"]};"><span style="font-weight:700;color:{t["accent_light"]};">{d.get("topKeywords",0)}</span>개</div><div style="color:{t["text_primary"]};">{d.get("avgLikes",0):,}</div><div style="color:{t["text_primary"]};">{d.get("postFreq7d",0)}회</div><div>{ad_html(d.get("adActivity","보통"),t)}</div><div style="font-size:12px;color:{t["text_secondary"]};">{d.get("category","")}</div></div>'
        rows_h+='</div>'
        st.markdown(hdr+rows_h,unsafe_allow_html=True)
    # ── 인스타 테이블 ──
    else:
        hdr=f'<div style="display:grid;grid-template-columns:36px 1.8fr 0.7fr 0.7fr 0.7fr 0.7fr 0.6fr;padding:10px 14px;background:{t["bg_table_header"]};border-radius:10px 10px 0 0;font-size:11px;font-weight:700;color:{t["text_secondary"]};border-bottom:2px solid {t["border_divider"]};"><div>#</div><div>인플루언서</div><div>팔로워</div><div>참여율</div><div>평균좋아요</div><div>평균댓글</div><div>최근게시물</div></div>'
        rows_h=f'<div style="background:{t["bg_table_header"]};border-radius:0 0 10px 10px;overflow:hidden;color:{t["text_primary"]};box-shadow:{t["shadow"]};">'
        for i,d in enumerate(data):
            bg=t["row_even"] if i%2==0 else t["row_odd"]
            er=d.get("engagementRate",0); ec=t["success"] if er>=5 else t["accent_subtle"] if er>=3 else t["warning"]; ebg=t["success_bg"] if er>=5 else t["insta_bg"] if er>=3 else t["warning_bg"]
            is_enr=d.get("enriched",False)
            fol_d=f'{d.get("followers",0):,}' if is_enr and d.get("followers",0)>0 else d.get("followerRangeText","") or "-"
            dup_b=f'<span style="background:{t["danger_bg"]};color:{t["danger"]};padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">중복</span>' if d.get("isDuplicate") else ""
            rec_b=f'<span style="background:{t["success_bg"]};color:{t["success"]};padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">추천</span>' if d.get("isRecommended") else ""
            rows_h+=f'<div style="display:grid;grid-template-columns:36px 1.8fr 0.7fr 0.7fr 0.7fr 0.7fr 0.6fr;padding:11px 14px;align-items:center;border-bottom:1px solid {t["border"]};background:{bg};font-size:13px;color:{t["text_primary"]};"><div style="color:{t["text_secondary"]};font-size:12px;">{i+1}</div><div style="color:{t["text_primary"]};"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><span style="font-weight:700;color:{t["text_heading"]};">{d["nickname"]}</span><span style="padding:2px 8px;border-radius:4px;background:{t["danger_bg"]};color:#FB7185;font-size:10px;font-weight:600;">{d.get("category","") or "-"}</span>{rec_b}{dup_b}</div><div style="font-size:11px;color:{t["text_secondary"]};">{d.get("mediaName","")} · {d.get("gender","")} · {d.get("age","")}</div></div><div style="font-weight:700;color:{t["text_heading"]};font-size:12px;">{fol_d}</div><div><span style="padding:2px 8px;border-radius:6px;background:{ebg};color:{ec};font-size:12px;font-weight:700;">{er}%</span></div><div style="color:{t["text_primary"]};">{d.get("avgLikes",0):,}</div><div style="color:{t["text_primary"]};">{d.get("avgComments",0)}</div><div style="color:{t["text_primary"]};">{d.get("recentPostCount",0)}개</div></div>'
        rows_h+='</div>'
        st.markdown(hdr+rows_h,unsafe_allow_html=True)
    st.stop()


# ═══════════════════════════════════════
# STEP: 인플루언서 선정  (React Step 4)
# ═══════════════════════════════════════
tab=st.session_state.tab

# ── 조건탭 필터 ──
# 위젯 키 → session_state 동기화 (1프레임 딜레이 방지)
_filter_sync={"fv":"nf_minVis","fs":"nf_minScore","fg":"nf_gender","fa":"nf_age",
              "fc":"nf_cat","fad":"nf_ad","fk":"nf_minKw","fl":"nf_minLk",
              "ifol":"if_minFol","igen":"if_gender","iage":"if_age",
              "icat":"if_cat","ieng":"if_minEng","ilk":"if_minLk",
              "icmt":"if_minCmt","ireel":"if_minReel","iff":"if_minFF","ireeleng":"if_minReelEng"}
for wk,sk in _filter_sync.items():
    if wk in st.session_state: st.session_state[sk]=st.session_state[wk]

if tab=="condition":
    if is_naver:
        fd=[]
        for d in data:
            nf=st.session_state
            try:
                if nf["nf_minVis"] and d.get("avgVisitors",0)<int(nf["nf_minVis"]): continue
            except ValueError: pass
            if nf["nf_minScore"]!="전체":
                try:
                    if d.get("blogScore",0)<int(nf["nf_minScore"]): continue
                except ValueError: pass
            if nf["nf_gender"]!="전체" and d.get("gender","")!=nf["nf_gender"]: continue
            if nf["nf_age"]!="전체" and d.get("age","")!=nf["nf_age"]: continue
            if nf["nf_cat"]!="전체" and d.get("category","")!=nf["nf_cat"]: continue
            if nf["nf_ad"]!="전체" and d.get("adActivity","")!=nf["nf_ad"]: continue
            try:
                if nf["nf_minKw"] and d.get("topKeywords",0)<int(nf["nf_minKw"]): continue
            except ValueError: pass
            try:
                if nf["nf_minLk"] and d.get("avgLikes",0)<int(nf["nf_minLk"]): continue
            except ValueError: pass
            fd.append(d)
        data_f=fd
    else:
        fd=[]
        for d in data:
            nf=st.session_state
            try:
                if nf["if_minFol"] and d.get("followers",0)<int(nf["if_minFol"]): continue
            except ValueError: pass
            if nf["if_gender"]!="전체" and d.get("gender","")!=nf["if_gender"]: continue
            if nf["if_age"]!="전체" and d.get("age","")!=nf["if_age"]: continue
            if nf["if_cat"]!="전체" and d.get("category","")!=nf["if_cat"]: continue
            try:
                if nf["if_minEng"] and d.get("feedER",0)<float(nf["if_minEng"]): continue
            except ValueError: pass
            try:
                if nf["if_minLk"] and d.get("feedAvgLikes",0)<int(nf["if_minLk"]): continue
            except ValueError: pass
            try:
                if nf.get("if_minReelEng","") and d.get("reelER",0)<float(nf["if_minReelEng"]): continue
            except ValueError: pass
            try:
                if nf["if_minReel"] and d.get("avgReelViews",0)<int(nf["if_minReel"]): continue
            except ValueError: pass
            try:
                if nf["if_minFF"] and d.get("ffRatio",0)<float(nf["if_minFF"]): continue
            except ValueError: pass
            fd.append(d)
        data_f=fd
else:
    data_f=data

# 정렬 (selectbox on_change 콜백으로 즉시 동기화)
sort_keys=SORT_KEYS_NAVER if is_naver else SORT_KEYS_INSTA
# selectbox 위젯값이 이미 session_state에 있으면 sort_key와 동기화
if "sort_sel" in st.session_state:
    _lbl=st.session_state["sort_sel"]
    if _lbl in sort_keys: st.session_state.sort_key=sort_keys[_lbl]
if "sort_dir_sel" in st.session_state:
    st.session_state.sort_dir="desc" if "높은" in st.session_state["sort_dir_sel"] else "asc"

sk=st.session_state.sort_key; sd=st.session_state.sort_dir
data_s=sorted(data_f,key=lambda x:x.get(sk,0) if isinstance(x.get(sk,0),(int,float)) else 0,reverse=(sd=="desc"))

# ── Selection Modal (React SelectionModal 1:1) ──
@st.dialog("📋 선정 인플루언서 리스트",width="large")
def show_selection_modal():
    sel_data=[d for d in data_s if d["id"] in st.session_state.sel]
    st.markdown(f'<p style="font-size:13px;color:{t["text_secondary"]};">총 {len(sel_data)}명 선정{" · 🏨 숙소 기준" if is_naver else ""}</p>',unsafe_allow_html=True)
    if not sel_data:
        st.info("선정된 인플루언서가 없습니다.")
    else:
        for i,d in enumerate(sel_data):
            c1,c2,c3=st.columns([0.3,5,1])
            with c1:
                st.markdown(f'<div style="width:28px;height:28px;border-radius:8px;background:{t["info_bg"]};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:{t["accent_light"]};margin-top:8px;">{i+1}</div>',unsafe_allow_html=True)
            with c2:
                info=f'방문자 {d.get("avgVisitors",0):,} · 상위키워드 {d.get("topKeywords",0)}개 · {d.get("category","")}' if is_naver else f'팔로워 {d.get("followers",0):,} · 참여율 {d.get("engagementRate",0)}% · 릴스 {d.get("avgReelViews",0):,}회 · {d.get("mediaName","")}'
                dup_m=f'<span style="background:{t["danger_bg"]};color:{t["danger"]};padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:6px;">중복참여</span>' if d.get("isDuplicate") else ""
                st.markdown(f'<div style="padding:4px 0;color:{t["text_primary"]};"><span style="font-weight:700;font-size:14px;color:{t["text_heading"]};">{d["nickname"]}</span> {bdg_html(d.get("blogScore",0),t) if is_naver else ""}{dup_m}<div style="font-size:11px;color:{t["text_secondary"]};margin-top:2px;">{info}</div></div>',unsafe_allow_html=True)
            with c3:
                if st.button("제외",key=f"rm_{d['id']}"):
                    st.session_state.sel.discard(d["id"]); st.rerun()
        st.divider()
        if is_naver:
            df_sel=pd.DataFrame([{"순위":i+1,"닉네임":d["nickname"],"중복":"O" if d.get("isDuplicate") else "","AI점수":d.get("aiScore",0),"블로그스코어":d.get("blogScore",0),"평균방문자":d.get("avgVisitors",0),"블로그URL":d.get("blogUrl","")} for i,d in enumerate(sel_data)])
        else:
            df_sel=pd.DataFrame([{"순위":i+1,"닉네임":d["nickname"],"중복":"O" if d.get("isDuplicate") else "","추천":"O" if d.get("isRecommended") else "","AI점수":d.get("aiScore",0),"팔로워":d.get("followers",0) if d.get("enriched") else d.get("followerRangeText",""),"팔로잉":d.get("following",0),"팔로워비율":d.get("ffRatio",0),"참여율":d.get("engagementRate",0),"평균좋아요":d.get("avgLikes",0),"평균댓글":d.get("avgComments",0),"릴스평균조회":d.get("avgReelViews",0),"릴스최고조회":d.get("maxReelViews",0),"계정":d.get("mediaName",""),"URL":d.get("blogUrl","")} for i,d in enumerate(sel_data)])
        st.download_button("📥 선정자 CSV",df_sel.to_csv(index=False).encode("utf-8-sig"),f"revu_{meta.get('campaign_id','')}_선정.csv","text/csv",key="modal_csv")

# ── Header (React Header 1:1) ──
ct=meta.get("campaign_title","")
hl,hr=st.columns([6,2])
with hl:
    if st.button("← 이전",key="s_back"): st.session_state.step="data"; st.rerun()
    sub_parts=[]
    if meta.get("campaign_id"): sub_parts.append(f'캠페인 ID: {meta["campaign_id"]}')
    if ct: sub_parts.append(ct)
    sub_parts.append(f'{len(data)}명')
    if crawled: sub_parts.append(f'수집: {crawled}')
    st.markdown(f'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;"><h1 style="font-size:20px;font-weight:800;margin:0;color:{t["text_heading"]};">{"📝" if is_naver else "📸"} 인플루언서 선정</h1>{plat_bdg} {src_bdg}</div><p style="color:{t["text_secondary"]};font-size:12px;margin:4px 0 0;">{" · ".join(sub_parts)}</p>',unsafe_allow_html=True)
with hr:
    r1,r2=st.columns(2)
    with r1:
        if sn>0:
            if st.button(f"📋 선정 리스트 ({sn}명)",type="primary",use_container_width=True,key="hdr_sel"):
                show_selection_modal()
        else:
            st.button("📋 선정 리스트 (0명)",disabled=True,use_container_width=True,key="hdr_sel0")
    with r2:
        dup_flag=lambda d:"O" if d.get("isDuplicate") else ""
        if is_naver:
            df_exp=pd.DataFrame([{"순위":i+1,"닉네임":d["nickname"],"중복":dup_flag(d),"AI점수":d.get("aiScore",0),"숙소적합도":d.get("accomFit",0),"숙소콘텐츠":d.get("_accom",{}).get("accomPostCount",0),"숙소키워드":d.get("_accom",{}).get("accomKwCount",0),"블로그스코어":d.get("blogScore",0),"평균방문자":d.get("avgVisitors",0),"상위키워드":d.get("topKeywords",0),"평균좋아요":d.get("avgLikes",0),"카테고리":d.get("category",""),"블로그URL":d.get("blogUrl","")} for i,d in enumerate(data_s)])
        else:
            df_exp=pd.DataFrame([{"순위":i+1,"닉네임":d["nickname"],"중복":"O" if d.get("isDuplicate") else "","추천":"O" if d.get("isRecommended") else "","AI점수":d.get("aiScore",0),"팔로워":d.get("followers",0) if d.get("enriched") else d.get("followerRangeText",""),"팔로잉":d.get("following",0),"팔로워비율":d.get("ffRatio",0),"피드참여율":d.get("feedER",0),"피드좋아요":d.get("feedAvgLikes",0),"피드댓글":d.get("feedAvgComments",0),"릴스참여율":d.get("reelER",0),"릴스좋아요":d.get("reelAvgLikes",0),"릴스댓글":d.get("reelAvgComments",0),"릴스평균조회":d.get("avgReelViews",0),"릴스최고조회":d.get("maxReelViews",0),"릴스수":d.get("reelCount",0),"카테고리":d.get("category",""),"보강":"O" if d.get("enriched") else "X","계정":d.get("mediaName",""),"URL":d.get("blogUrl","")} for i,d in enumerate(data_s)])
        st.download_button("📥 CSV 내보내기",df_exp.to_csv(index=False).encode("utf-8-sig"),f"revu_{meta.get('campaign_id','')}_전체.csv","text/csv",use_container_width=True,key="s_csv")

# ── Tab Switcher (React TabSwitcher 1:1) ──
tc1,tc2=st.columns(2)
with tc1:
    if st.button("🤖 AI 추천 선정" + ("  ·  데이터 기반 자동 추천" if tab=="ai" else ""),use_container_width=True,type="primary" if tab=="ai" else "secondary",key="t_ai"):
        st.session_state.tab="ai"; st.rerun()
with tc2:
    if st.button("🎯 조건 선정" + ("  ·  직접 필터 설정" if tab=="condition" else ""),use_container_width=True,type="primary" if tab=="condition" else "secondary",key="t_cond"):
        st.session_state.tab="condition"; st.rerun()

# ── AI Tab: 숙소 적합도 요약 ──
pk="travel" if is_naver else "general"
ps={"color":"#A78BFA","emoji":"🏨","label":"숙소 적합"} if pk=="travel" else {"color":"#34D399","emoji":"📊","label":"일반"}
if tab=="ai" and is_naver:
    with st.container(border=True):
        accom_scores=[d.get("accomFit",0) for d in data]
        has_accom=[d for d in data if d.get("_accom",{}).get("accomPostCount",0)>0 or d.get("_accom",{}).get("accomKwCount",0)>0]
        avg_fit=round(sum(accom_scores)/len(accom_scores)) if accom_scores else 0
        m1,m2,m3,m4=st.columns(4)
        with m1: st.metric("🏨 숙소 콘텐츠 보유",f"{len(has_accom)}명",f"전체 {len(data)}명 중")
        with m2: st.metric("평균 적합도",f"{avg_fit}점",f"최고 {max(accom_scores) if accom_scores else 0}점")
        with m3: st.metric("총 숙소 포스팅",f'{sum(d.get("_accom",{}).get("accomPostCount",0) for d in data)}건')
        with m4: st.metric("총 숙소 키워드",f'{sum(d.get("_accom",{}).get("accomKwCount",0) for d in data)}개')
        st.caption(f"AI 가중치: 숙소적합 {w.get('accomFit',0)}% · 방문자 {w.get('visitors',0)}% · 키워드 {w.get('keywords',0)}% · 좋아요 {w.get('likes',0)}% · 스코어 {w.get('blogScore',0)}% · 광고 {w.get('adActivity',0)}% · 빈도 {w.get('postFreq',0)}%")

if tab=="ai" and not is_naver:
    with st.container(border=True):
        enriched_cnt=sum(1 for d in data if d.get("enriched"))
        not_enriched_cnt=len(data)-enriched_cnt
        er_list=[d.get("engagementRate",0) for d in data if d.get("engagementRate",0)>0]
        avg_er=round(sum(er_list)/len(er_list),1) if er_list else 0
        avg_ai=round(sum(d.get("aiScore",0) for d in data)/len(data)) if data else 0
        m1,m2,m3,m4=st.columns(4)
        with m1: st.metric("📸 총 인플루언서",f"{len(data)}명")
        with m2: st.metric("✅ 상세 보강 (C안)",f"{enriched_cnt}명",f"instaloader")
        with m3: st.metric("⚠️ 기본 데이터 (A안)",f"{not_enriched_cnt}명",f"REVU만")
        with m4: st.metric("📊 평균 참여율",f"{avg_er}%",f"평균 AI {avg_ai}점")
        st.caption(f"AI 가중치: 피드참여율 {AI_WEIGHTS_INSTA['feedER']}% · 릴스참여율 {AI_WEIGHTS_INSTA['reelER']}% · 팔로워 {AI_WEIGHTS_INSTA['followers']}% · 팔비 {AI_WEIGHTS_INSTA['ffRatio']}% · 피드좋아요 {AI_WEIGHTS_INSTA['feedAvgLikes']}% · 릴스좋아요 {AI_WEIGHTS_INSTA['reelAvgLikes']}% · 릴스평균 {AI_WEIGHTS_INSTA['avgReelViews']}% · 릴스최고 {AI_WEIGHTS_INSTA['maxReelViews']}%")
        if not_enriched_cnt>0:
            st.markdown(f'<div style="background:{t["warning_bg"]};border:1px solid {t["warning_border"]};border-radius:8px;padding:8px 14px;margin-top:8px;font-size:12px;color:{t["warning"]};">⚠️ {not_enriched_cnt}명은 REVU 기본 데이터만 사용 — AI 점수가 정확하지 않을 수 있습니다.</div>',unsafe_allow_html=True)

# ── Condition Tab: 필터 패널 (React 4열 그리드 1:1) ──
if tab=="condition":
    with st.container(border=True):
        if is_naver:
            cats=["전체"]+sorted(set(d.get("category","") for d in data if d.get("category")))
            f1,f2,f3,f4=st.columns(4)
            with f1: st.session_state.nf_minVis=st.text_input("최소 방문자수",value=st.session_state.nf_minVis,placeholder="예: 500",key="fv")
            with f2: st.session_state.nf_minScore=st.selectbox("최소 블로그 스코어",["전체","1","2","3","4","5"],index=["전체","1","2","3","4","5"].index(st.session_state.nf_minScore),key="fs")
            with f3: st.session_state.nf_gender=st.selectbox("성별",["전체","여자","남자"],index=["전체","여자","남자"].index(st.session_state.nf_gender),key="fg")
            with f4: st.session_state.nf_age=st.selectbox("연령대",["전체","20대","30대","40대"],index=["전체","20대","30대","40대"].index(st.session_state.nf_age),key="fa")
            f5,f6,f7,f8=st.columns(4)
            with f5:
                ci=cats.index(st.session_state.nf_cat) if st.session_state.nf_cat in cats else 0
                st.session_state.nf_cat=st.selectbox("카테고리",cats,index=ci,key="fc")
            with f6: st.session_state.nf_ad=st.selectbox("광고 활동성",["전체","낮음","보통","활발"],index=["전체","낮음","보통","활발"].index(st.session_state.nf_ad),key="fad")
            with f7: st.session_state.nf_minKw=st.text_input("최소 상위노출 키워드",value=st.session_state.nf_minKw,placeholder="예: 10",key="fk")
            with f8: st.session_state.nf_minLk=st.text_input("최소 평균 좋아요",value=st.session_state.nf_minLk,placeholder="예: 200",key="fl")
        else:
            cats=["전체"]+sorted(set(d.get("category","") for d in data if d.get("category")))
            st.markdown(f'<div style="font-size:11px;font-weight:700;color:{t["text_heading"]};margin-bottom:4px;">👤 계정</div>',unsafe_allow_html=True)
            f1,f2,f3,f4=st.columns(4)
            with f1: st.session_state.if_minFol=st.text_input("최소 팔로워",value=st.session_state.if_minFol,placeholder="예: 10000",key="ifol")
            with f2: st.session_state.if_minFF=st.text_input("최소 팔로워비율",value=st.session_state.if_minFF,placeholder="예: 3",key="iff")
            with f3: st.session_state.if_gender=st.selectbox("성별",["전체","여자","남자"],index=["전체","여자","남자"].index(st.session_state.if_gender),key="igen")
            with f4: st.session_state.if_age=st.selectbox("연령대",["전체","20대","30대","40대"],index=["전체","20대","30대","40대"].index(st.session_state.if_age),key="iage")
            st.markdown(f'<div style="display:flex;gap:16px;margin:8px 0 4px;"><span style="font-size:11px;font-weight:700;color:{t["naver_text"]};">📷 피드</span><span style="font-size:11px;font-weight:700;color:{t["insta_text"]};">🎬 릴스</span></div>',unsafe_allow_html=True)
            f5,f6,f7,f8=st.columns(4)
            with f5: st.session_state.if_minEng=st.text_input("최소 피드 참여율(%)",value=st.session_state.if_minEng,placeholder="예: 3",key="ieng")
            with f6: st.session_state.if_minLk=st.text_input("최소 피드 좋아요",value=st.session_state.if_minLk,placeholder="예: 500",key="ilk")
            with f7: st.session_state.if_minReelEng=st.text_input("최소 릴스 참여율(%)",value=st.session_state.get("if_minReelEng",""),placeholder="예: 3",key="ireeleng")
            with f8: st.session_state.if_minReel=st.text_input("최소 릴스 평균조회",value=st.session_state.if_minReel,placeholder="예: 5000",key="ireel")
            f9,f10,_f11,_f12=st.columns(4)
            with f9:
                ci=cats.index(st.session_state.if_cat) if st.session_state.if_cat in cats else 0
                st.session_state.if_cat=st.selectbox("카테고리",cats,index=ci,key="icat")
            with f10: pass

# ── 정렬 컨트롤 + 결과 라벨 ──
sc1,sc2,sc3=st.columns([1.5,1,5])
with sc1:
    sk_display=next((k for k,v in sort_keys.items() if v==st.session_state.sort_key),"AI점수")
    st.selectbox("정렬",list(sort_keys.keys()),index=list(sort_keys.keys()).index(sk_display),key="sort_sel",label_visibility="collapsed")
with sc2:
    dirs=["높은순 ▼","낮은순 ▲"]
    di=0 if st.session_state.sort_dir=="desc" else 1
    st.selectbox("순서",dirs,index=di,key="sort_dir_sel",label_visibility="collapsed")
with sc3:
    lbl=f'결과 <strong style="color:{t["accent_light"]};">{len(data_s)}명</strong>'
    if sn>0: lbl+=f' · 선정 <strong style="color:{t["success"]};">{sn}명</strong>'
    if tab=="ai" and is_naver: lbl+=f'<span style="margin-left:8px;font-size:12px;color:{ps["color"]};font-weight:600;">{ps["emoji"]} {ps["label"]} 기준</span>'
    st.markdown(f'<div style="font-size:13px;color:{t["text_secondary"]};padding-top:8px;">{lbl}</div>',unsafe_allow_html=True)

# ═══════════════════════════════════════
# 테이블 (행별 렌더링 + 인라인 확장 + 선정 버튼)
# ═══════════════════════════════════════
if is_naver:
    is_travel=(pk=="travel" and tab=="ai")

    # ── 공통 grid-template-columns (헤더·행 동일 사용) ──
    if is_travel:
        GTC="36px 70px 1.6fr 0.6fr 0.5fr 0.5fr 0.5fr 0.55fr 0.55fr 0.5fr"
        hdr_cells=f'<div>#</div><div>AI점수</div><div>인플루언서</div><div>방문자</div><div>키워드</div><div>좋아요</div><div style="color:{t["success"]};">🏨적합</div><div style="color:{t["success"]};">숙소글</div><div style="color:{t["success"]};">숙소KW</div><div>상위%</div>'
    else:
        GTC="36px 72px 1.6fr 0.6fr 0.55fr 0.55fr 0.55fr 0.5fr 0.5fr"
        hdr_cells='<div>#</div><div>AI점수</div><div>인플루언서</div><div>방문자</div><div>이웃수</div><div>키워드</div><div>좋아요</div><div>주간글</div><div>광고</div>'

    # 테이블 헤더 (row와 동일한 columns 구조)
    hdr_r,hdr_e,hdr_s=st.columns([8,0.8,1.2])
    with hdr_r:
        st.markdown(f'<div style="display:grid;grid-template-columns:{GTC};padding:10px 14px;background:{t["bg_table_header"]};border-radius:10px 10px 0 0;font-size:11px;font-weight:700;color:{t["text_secondary"]};border-bottom:2px solid {t["border_divider"]};">{hdr_cells}</div>',unsafe_allow_html=True)
    with hdr_e:
        st.markdown(f'<div style="font-size:10px;color:{t["text_secondary"]};text-align:center;padding-top:10px;">상세</div>',unsafe_allow_html=True)
    with hdr_s:
        st.markdown(f'<div style="font-size:10px;color:{t["text_secondary"]};text-align:center;padding-top:10px;">선정</div>',unsafe_allow_html=True)

    for i,d in enumerate(data_s):
        is_sel=d["id"] in st.session_state.sel
        bg=t["row_selected"] if is_sel else (t["row_even"] if i%2==0 else t["row_odd"])
        nb=d.get("neighbors",0); nbr=d.get("neighborRank","")
        c=ps["color"] if tab=="ai" else sc(d.get("aiScore",0))
        ac=d.get("_accom",{})
        is_dup=d.get("isDuplicate",False)
        dup_bdg=f'<span style="background:{t["danger_bg"]};color:{t["danger"]};padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">중복</span>' if is_dup else ""

        # ── Row: HTML data + 선정 버튼 ──
        row_c,exp_c,sel_c=st.columns([8,0.8,1.2])
        with row_c:
            if is_travel:
                af=d.get("accomFit",0)
                afc=t["success"] if af>=60 else t["warning"] if af>=30 else t["danger"]
                afbg=t["success_bg"] if af>=60 else t["warning_bg"] if af>=30 else t["danger_bg"]
                pct=ac.get("percentile",0)
                pct_txt=f"상위 {pct}%" if pct>0 else "-"
                pct_c=t["success"] if pct<=20 else t["warning"] if pct<=50 else t["text_secondary"]
                st.markdown(f'<div style="display:grid;grid-template-columns:{GTC};padding:12px 14px;align-items:center;border-bottom:1px solid {t["border"]};background:{bg};font-size:13px;color:{t["text_primary"]};"><div style="color:{t["text_secondary"]};font-size:12px;font-weight:700;">{i+1}</div><div>{ai_bar_html(d.get("aiScore",0),c,t)}</div><div style="color:{t["text_primary"]};"><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;"><span style="font-weight:700;color:{t["text_heading"]};">{d["nickname"]}</span>{bdg_html(d.get("blogScore",0),t)}{dup_bdg}</div><div style="font-size:11px;color:{t["text_secondary"]};">{d.get("blogName","")} · {d.get("category","")}</div></div><div style="font-weight:700;color:{t["text_heading"]};">{d.get("avgVisitors",0):,}</div><div style="color:{t["text_primary"]};"><span style="font-weight:700;color:{t["accent_light"]};">{d.get("topKeywords",0)}</span>개</div><div style="color:{t["text_primary"]};">{d.get("avgLikes",0):,}</div><div><span style="padding:2px 8px;border-radius:6px;background:{afbg};color:{afc};font-size:12px;font-weight:700;">{af}</span></div><div style="font-weight:600;color:{t["text_primary"]};">{ac.get("accomPostCount",0)}<span style="font-size:10px;color:{t["text_secondary"]};">/{ac.get("accomPostTotal",0)}</span></div><div style="font-weight:600;color:{t["text_primary"]};">{ac.get("accomKwCount",0)}<span style="font-size:10px;color:{t["text_secondary"]};">(🔝{ac.get("accomKwTop5",0)})</span></div><div style="font-weight:600;color:{pct_c};font-size:12px;">{pct_txt}</div></div>',unsafe_allow_html=True)
            else:
                st.markdown(f'<div style="display:grid;grid-template-columns:{GTC};padding:12px 14px;align-items:center;border-bottom:1px solid {t["border"]};background:{bg};font-size:13px;color:{t["text_primary"]};"><div style="color:{t["text_secondary"]};font-size:12px;font-weight:700;">{i+1}</div><div>{ai_bar_html(d.get("aiScore",0),c,t)}</div><div style="color:{t["text_primary"]};"><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;"><span style="font-weight:700;color:{t["text_heading"]};">{d["nickname"]}</span>{bdg_html(d.get("blogScore",0),t)}{dup_bdg}</div><div style="font-size:11px;color:{t["text_secondary"]};">{d.get("blogName","")} · {d.get("gender","")} · {d.get("age","")}</div></div><div style="font-weight:700;color:{t["text_heading"]};">{d.get("avgVisitors",0):,}</div><div style="color:{t["text_primary"]};">{nb:,}<div style="font-size:10px;color:{t["accent_light"]};">{nbr}</div></div><div style="color:{t["text_primary"]};"><span style="font-weight:700;color:{t["accent_light"]};">{d.get("topKeywords",0)}</span>개</div><div style="color:{t["text_primary"]};">{d.get("avgLikes",0):,}</div><div style="color:{t["text_primary"]};">{d.get("postFreq7d",0)}회</div><div>{ad_html(d.get("adActivity","보통"),t)}</div></div>',unsafe_allow_html=True)
        with exp_c:
            is_exp=st.session_state.expanded==d["id"]
            if st.button("▾" if not is_exp else "▴",key=f"e_{d['id']}",use_container_width=True):
                st.session_state.expanded=None if is_exp else d["id"]; st.rerun()
        with sel_c:
            if st.button("✓ 선정" if is_sel else "선정",key=f"s_{d['id']}",type="primary" if is_sel else "secondary",use_container_width=True):
                    if is_sel: st.session_state.sel.discard(d["id"])
                    else: st.session_state.sel.add(d["id"])
                    st.rerun()

        # ── Inline Expansion (React expanded row 1:1) ──
        if st.session_state.expanded==d["id"]:
            with st.container():
                # AI 분석
                if tab=="ai":
                    grade="🏆 강력 추천" if d.get("aiScore",0)>=85 else "✅ 추천" if d.get("aiScore",0)>=70 else "⚡ 조건부 추천" if d.get("aiScore",0)>=55 else "📌 참고"
                    st.markdown(f'<div style="background:{t["accent_bg"]};border:1px solid {t["accent_border"]};border-radius:10px;padding:14px 16px;margin-bottom:14px;"><div style="font-size:13px;font-weight:800;color:{ps["color"]};margin-bottom:8px;">🤖 AI 분석 · {ps["emoji"]} {ps["label"]} 기준</div><div style="font-size:13px;color:{t["accent_light"]};line-height:1.6;">{d.get("aiReason","")}</div></div>',unsafe_allow_html=True)
                    if d.get("_bd"):
                        ncols=len(d["_bd"])
                        bh2=f'<div style="display:grid;grid-template-columns:repeat({ncols},1fr);gap:6px;margin-bottom:14px;">'
                        for k3,v3 in d["_bd"].items():
                            wl=WL.get(k3,{})
                            bh2+=f'<div style="text-align:center;background:{t["bg_table_header"]};border-radius:8px;padding:8px 4px;border:1px solid {t["border"]};color:{t["text_primary"]};"><div style="font-size:10px;color:{t["text_secondary"]};margin-bottom:3px;">{wl.get("e","")} {wl.get("s","")}</div><div style="background:{t["bg_bar"]};border-radius:3px;overflow:hidden;height:4px;margin-bottom:3px;"><div style="width:{v3}%;height:100%;background:{ps["color"]};border-radius:3px;"></div></div><div style="font-size:12px;font-weight:700;color:{t["text_heading"]};">{round(v3)}</div><div style="font-size:9px;color:{t["accent_light"]};">×{w.get(k3,0)}%</div></div>'
                        bh2+='</div>'
                        st.markdown(bh2,unsafe_allow_html=True)

                    # 🏨 숙소 적합도 상세 (travel 전용)
                    if is_travel and ac:
                        ah=f'<div style="background:{t["success_bg"]};border:1px solid {t["success_border"]};border-radius:10px;padding:14px 16px;margin-bottom:14px;color:{t["text_primary"]};">'
                        ah+=f'<div style="font-size:13px;font-weight:800;color:{t["metric_delta"]};margin-bottom:10px;">🏨 숙소 적합도 상세 — {d.get("accomFit",0)}점 · {ac.get("percentile",0)}%ile</div>'
                        mp=ac.get("accomMatchedPosts",[])
                        if mp:
                            ah+=f'<div style="font-size:12px;font-weight:700;color:{t["success"]};margin-bottom:6px;">📝 숙소 콘텐츠 {len(mp)}건 (전체의 {ac.get("accomPostRatio",0)}%)</div>'
                            for p in mp[:5]:
                                ah+=f'<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid {t["success_border"]};font-size:12px;"><span style="color:{t["metric_delta"]};">{p.get("title","")}</span><span style="color:{t["text_secondary"]};">❤️{p.get("likes",0)} 💬{p.get("comments",0)}</span></div>'
                        else:
                            ah+=f'<div style="font-size:12px;color:{t["text_secondary"]};margin-bottom:6px;">📝 숙소 관련 포스팅 없음</div>'
                        mk=ac.get("accomMatchedKws",[])
                        if mk:
                            ah+=f'<div style="font-size:12px;font-weight:700;color:{t["success"]};margin:10px 0 6px;">🔍 숙소 키워드 {len(mk)}개 (상위노출 {ac.get("accomKwTop5",0)}개, 총 검색량 {ac.get("accomKwVolume",0):,})</div>'
                            for kw in mk:
                                rc=t["success"] if kw.get("rank",99)<=5 else t["warning"] if kw.get("rank",99)<=10 else t["text_secondary"]
                                ah+=f'<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;"><span style="color:{t["metric_delta"]};font-weight:600;">{kw.get("keyword","")}</span><div style="display:flex;gap:12px;"><span style="color:{t["text_secondary"]};">검색량 {kw.get("volume",0):,}</span><span style="color:{rc};font-weight:700;">{kw.get("rank",0)}위</span></div></div>'
                        else:
                            ah+=f'<div style="font-size:12px;color:{t["text_secondary"]};margin-top:8px;">🔍 숙소 관련 상위노출 키워드 없음</div>'
                        ah+='</div>'
                        st.markdown(ah,unsafe_allow_html=True)

                # 블로그 요약 + 키워드 (2열)
                ca,cb=st.columns(2)
                with ca:
                    ih=f'<div style="background:{t["bg_table_header"]};border-radius:10px;padding:16px;border:1px solid {t["border"]};color:{t["text_primary"]};"><h4 style="margin:0 0 12px;font-size:13px;color:{t["accent_light"]};font-weight:700;">📊 블로그 요약</h4>'
                    for l,v in[("어제 방문자",f'{d.get("yesterdayVisitors",0):,}명'),("총 방문자",f'{d.get("totalVisitors",0):,}명'),("이웃수",f'{d.get("neighbors",0):,}명 {d.get("neighborRank","")}'),("스크랩",f'{d.get("scraps",0):,}번'),("개설일",d.get("openDate","") or "-"),("평균 글자수",f'{d.get("avgChars",0):,}자'),("평균 이미지",f'{d.get("avgImages",0)}장'),("평균 동영상",f'{d.get("avgVideos",0)}개')]:
                        ih+=f'<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;"><span style="color:{t["text_secondary"]};">{l}</span><span style="font-weight:600;color:{t["text_heading"]};">{v}</span></div>'
                    ih+='</div>'
                    st.markdown(ih,unsafe_allow_html=True)
                with cb:
                    kws=d.get("topKeywordList",[])
                    kh=f'<div style="background:{t["bg_table_header"]};border-radius:10px;padding:16px;border:1px solid {t["border"]};color:{t["text_primary"]};"><h4 style="margin:0 0 12px;font-size:13px;color:{t["accent_light"]};font-weight:700;">🔍 상위 노출 키워드</h4>'
                    if kws:
                        for kw in kws:
                            rc=t["success"] if kw.get("rank",99)<=5 else t["accent_subtle"] if kw.get("rank",99)<=10 else t["text_secondary"]
                            is_accom_kw=is_travel and ACCOM_KW_PAT.search(kw.get("keyword",""))
                            kw_mark=f'<span style="background:{t["success_bg"]};color:{t["metric_delta"]};padding:1px 5px;border-radius:3px;font-size:9px;margin-left:4px;">🏨</span>' if is_accom_kw else ""
                            kw_bg=f"background:{t['success_bg']};" if is_accom_kw else ""
                            kh+=f'<div style="display:flex;justify-content:space-between;padding:5px 4px;border-bottom:1px solid {t["border"]};font-size:12px;border-radius:4px;{kw_bg}"><span style="font-weight:600;color:{t["text_primary"]};">{kw.get("keyword","")}{kw_mark}</span><div style="display:flex;gap:12px;color:{t["text_secondary"]};"><span>{kw.get("volume",0):,}</span><span style="color:{rc};font-weight:700;">{kw.get("rank",0)}위</span></div></div>'
                    else: kh+=f'<p style="font-size:12px;color:{t["text_secondary"]};">키워드 데이터 없음</p>'
                    kh+='</div>'
                    st.markdown(kh,unsafe_allow_html=True)

                # 최근 포스팅
                rp=d.get("recentPosts",[])
                if rp:
                    ph=f'<div style="background:{t["bg_table_header"]};border-radius:10px;padding:16px;border:1px solid {t["border"]};margin-top:14px;color:{t["text_primary"]};"><h4 style="margin:0 0 10px;font-size:13px;color:{t["accent_light"]};font-weight:700;">📝 최근 포스팅</h4>'
                    for p in rp[:5]:
                        badges=""
                        if p.get("topExposure"): badges+=f'<span style="background:{t["success_bg"]};color:{t["success"]};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;margin-left:6px;">상위노출</span>'
                        if p.get("smartBlock"): badges+=f'<span style="background:{t["info_bg"]};color:#60A5FA;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;margin-left:4px;">스마트블록</span>'
                        is_accom_post=is_travel and ACCOM_KW_PAT.search(p.get("title",""))
                        if is_accom_post: badges+=f'<span style="background:{t["success_bg"]};color:{t["metric_delta"]};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;margin-left:4px;">🏨 숙소</span>'
                        post_bg=f"background:{t['success_bg']};border-radius:4px;" if is_accom_post else ""
                        ph+=f'<div style="display:flex;justify-content:space-between;padding:7px 4px;border-bottom:1px solid {t["border"]};font-size:12px;{post_bg}"><div style="color:{t["text_primary"]};">{p.get("title","")}{badges}</div><div style="display:flex;gap:10px;color:{t["text_secondary"]};flex-shrink:0;font-size:11px;"><span>{p.get("cat","")}</span><span>❤️ {p.get("likes",0)}</span><span>💬 {p.get("comments",0)}</span><span>{p.get("date","")}</span></div></div>'
                    ph+='</div>'
                    st.markdown(ph,unsafe_allow_html=True)
                st.divider()

# ── 인스타그램 테이블 ──
elif not is_naver:
    with st.expander("📖 칼럼 정의 보기",expanded=False):
        st.markdown(f"""<div style="font-size:12px;color:{t["text_primary"]};">
<div style="margin-bottom:8px;font-weight:700;color:{t["text_heading"]};">👤 계정</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;">
<div style="padding:6px 10px;background:{t["bg_surface"]};border-radius:6px;border:1px solid {t["border"]};"><strong style="color:{t["accent_light"]};">팔로워</strong> — 실제 팔로워 수</div>
<div style="padding:6px 10px;background:{t["bg_surface"]};border-radius:6px;border:1px solid {t["border"]};"><strong style="color:{t["accent_light"]};">팔로잉</strong> — 팔로우 중인 수</div>
<div style="padding:6px 10px;background:{t["bg_surface"]};border-radius:6px;border:1px solid {t["border"]};"><strong style="color:{t["accent_light"]};">팔로워비율</strong> — 팔로워÷팔로잉. 높을수록 영향력↑</div>
</div>
<div style="margin-bottom:8px;font-weight:700;color:{t["naver_text"]};">📷 피드 (이미지 게시물)</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;">
<div style="padding:6px 10px;background:{t["naver_bg"]};border-radius:6px;border:1px solid {t["naver_border"]};"><strong style="color:{t["naver_text"]};">좋아요 평균</strong> — 피드(이미지) 게시물 평균 좋아요 수</div>
<div style="padding:6px 10px;background:{t["naver_bg"]};border-radius:6px;border:1px solid {t["naver_border"]};"><strong style="color:{t["naver_text"]};">댓글 평균</strong> — 피드(이미지) 게시물 평균 댓글 수</div>
<div style="padding:6px 10px;background:{t["naver_bg"]};border-radius:6px;border:1px solid {t["naver_border"]};"><strong style="color:{t["naver_text"]};">피드참여율</strong> — (좋아요+댓글)÷팔로워×100</div>
</div>
<div style="margin-bottom:8px;font-weight:700;color:{t["insta_text"]};">🎬 릴스 (영상 게시물)</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
<div style="padding:6px 10px;background:{t["insta_bg"]};border-radius:6px;border:1px solid {t["insta_border"]};"><strong style="color:{t["insta_text"]};">조회수 평균</strong> — /reels/ 탭 최근 릴스 평균 조회수</div>
<div style="padding:6px 10px;background:{t["insta_bg"]};border-radius:6px;border:1px solid {t["insta_border"]};"><strong style="color:{t["insta_text"]};">최고 조회수</strong> — /reels/ 탭 최고 조회수</div>
<div style="padding:6px 10px;background:{t["insta_bg"]};border-radius:6px;border:1px solid {t["insta_border"]};"><strong style="color:{t["insta_text"]};">릴스참여율</strong> — 릴스의 (좋아요+댓글)÷팔로워×100</div>
</div>
</div>""",unsafe_allow_html=True)
    # 칼럼: # | AI | 인플루언서 | 팔로워 | 팔로잉 | 팔로워비율 | 좋아요 | 댓글 | 피드참여율 | 평균조회 | 최고조회 | 릴스참여율
    IGTC="30px 50px 1.4fr 0.55fr 0.5fr 0.45fr 0.5fr 0.45fr 0.5fr 0.55fr 0.55fr 0.5fr"
    hdr_r,hdr_e,hdr_s=st.columns([8,0.8,1.2])
    with hdr_r:
        # 2단 헤더: 상단(그룹명) + 하단(칼럼명)
        st.markdown(f'''<div style="background:{t["bg_table_header"]};border-radius:10px 10px 0 0;border-bottom:2px solid {t["border_divider"]};">
<div style="display:grid;grid-template-columns:30px 50px 1.4fr 1.5fr 1.45fr 1.6fr;padding:4px 14px 0;font-size:9px;font-weight:600;color:{t["text_caption"]};">
<div></div><div></div><div></div>
<div style="text-align:center;padding:2px 0;border-radius:4px 4px 0 0;background:{t["bg_surface"]};">👤 계정</div>
<div style="text-align:center;padding:2px 0;border-radius:4px 4px 0 0;background:{t["naver_bg"]};color:{t["naver_text"]};">📷 피드</div>
<div style="text-align:center;padding:2px 0;border-radius:4px 4px 0 0;background:{t["insta_bg"]};color:{t["insta_text"]};">🎬 릴스</div>
</div>
<div style="display:grid;grid-template-columns:{IGTC};padding:6px 14px 8px;font-size:10px;font-weight:700;color:{t["text_secondary"]};">
<div title="순위" style="cursor:help;">#</div>
<div title="종합 AI 점수 (0~100)" style="cursor:help;">AI</div>
<div title="계정명·카테고리·핸들" style="cursor:help;">인플루언서</div>
<div title="실제 팔로워 수" style="cursor:help;">팔로워</div>
<div title="팔로잉 수" style="cursor:help;">팔로잉</div>
<div title="팔로워÷팔로잉" style="cursor:help;">팔로워비율</div>
<div title="피드 게시물 평균 좋아요" style="cursor:help;color:{t["naver_text"]};">좋아요</div>
<div title="피드 게시물 평균 댓글" style="cursor:help;color:{t["naver_text"]};">댓글</div>
<div title="피드(이미지) 참여율" style="cursor:help;color:{t["naver_text"]};">참여율</div>
<div title="/reels/ 탭 평균 조회수" style="cursor:help;color:{t["insta_text"]};">평균조회</div>
<div title="/reels/ 탭 최고 조회수" style="cursor:help;color:{t["insta_text"]};">최고조회</div>
<div title="릴스 (좋아요+댓글)÷팔로워" style="cursor:help;color:{t["insta_text"]};">참여율</div>
</div></div>''',unsafe_allow_html=True)
    with hdr_e:
        st.markdown(f'<div style="font-size:10px;color:{t["text_secondary"]};text-align:center;padding-top:10px;">상세</div>',unsafe_allow_html=True)
    with hdr_s:
        st.markdown(f'<div style="font-size:10px;color:{t["text_secondary"]};text-align:center;padding-top:10px;">선정</div>',unsafe_allow_html=True)

    for i,d in enumerate(data_s):
        is_sel=d["id"] in st.session_state.sel
        bg=t["row_selected"] if is_sel else (t["row_even"] if i%2==0 else t["row_odd"])
        is_enriched=d.get("enriched",False)
        dup_bdg=f'<span style="background:{t["danger_bg"]};color:{t["danger"]};padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">중복</span>' if d.get("isDuplicate") else ""
        rec_bdg=f'<span style="background:{t["success_bg"]};color:{t["success"]};padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">추천</span>' if d.get("isRecommended") else ""
        enr_bdg=f'<span style="background:{t["success_bg"]};color:{t["success"]};padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">✅보강</span>' if is_enriched else f'<span style="background:{t["warning_bg"]};color:{t["warning"]};padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;margin-left:4px;">REVU</span>'
        fol_display=f'{d.get("followers",0):,}' if is_enriched and d.get("followers",0)>0 else d.get("followerRangeText","") or "-"
        fol_ing_display=f'{d.get("following",0):,}' if is_enriched and d.get("following",0)>0 else "-"
        ff_display=f'{d.get("ffRatio",0)}' if d.get("ffRatio",0)>0 else "-"
        # 피드 좋아요/댓글
        feed_lk=d.get("feedAvgLikes",0); feed_cmt=d.get("feedAvgComments",0)
        feed_lk_d=f'{feed_lk:,}' if feed_lk>0 else "-"
        feed_cmt_d=f'{feed_cmt:,}' if feed_cmt>0 else "-"
        # 피드 참여율
        fer=d.get("feedER",0)
        fer_c=t["success"] if fer>=5 else t["naver_text"] if fer>=3 else t["warning"]
        fer_bg=t["success_bg"] if fer>=5 else t["naver_bg"] if fer>=3 else t["warning_bg"]
        # 릴스 조회수
        reel_avg=d.get("avgReelViews",0); reel_max=d.get("maxReelViews",0)
        reel_avg_d=f'{reel_avg:,}' if reel_avg>0 else "-"
        reel_max_d=f'{reel_max:,}' if reel_max>0 else "-"
        # 릴스 참여율
        rer=d.get("reelER",0)
        rer_c=t["success"] if rer>=5 else t["insta_text"] if rer>=3 else t["warning"]
        rer_bg=t["success_bg"] if rer>=5 else t["insta_bg"] if rer>=3 else t["warning_bg"]

        row_c,exp_c,sel_c=st.columns([8,0.8,1.2])
        with row_c:
            st.markdown(f'<div style="display:grid;grid-template-columns:{IGTC};padding:12px 14px;align-items:center;border-bottom:1px solid {t["border"]};background:{bg};font-size:12px;color:{t["text_primary"]};"><div style="color:{t["text_secondary"]};font-size:11px;font-weight:700;">{i+1}</div><div>{ai_bar_html(d.get("aiScore",0),t=t)}</div><div style="color:{t["text_primary"]};"><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;"><span style="font-weight:700;color:{t["text_heading"]};">{d["nickname"]}</span><span style="padding:2px 8px;border-radius:4px;background:{t["danger_bg"]};color:#FB7185;font-size:10px;font-weight:600;">{d.get("category","") or "-"}</span>{rec_bdg}{dup_bdg}{enr_bdg}</div><div style="font-size:10px;color:{t["text_secondary"]};">{d.get("mediaName","")} · {d.get("gender","")} · {d.get("age","")}</div></div><div style="font-weight:700;color:{t["text_heading"]};font-size:11px;">{fol_display}</div><div style="color:{t["text_primary"]};font-size:11px;">{fol_ing_display}</div><div style="color:{t["text_primary"]};font-size:11px;">{ff_display}</div><div style="color:{t["naver_text"]};font-size:11px;">{feed_lk_d}</div><div style="color:{t["naver_text"]};font-size:11px;">{feed_cmt_d}</div><div><span style="padding:2px 6px;border-radius:6px;background:{fer_bg};color:{fer_c};font-size:11px;font-weight:700;">{fer}%</span></div><div style="color:{t["text_primary"]};font-size:11px;">{reel_avg_d}</div><div style="font-weight:700;color:{t["accent_light"]};font-size:11px;">{reel_max_d}</div><div><span style="padding:2px 6px;border-radius:6px;background:{rer_bg};color:{rer_c};font-size:11px;font-weight:700;">{rer}%</span></div></div>',unsafe_allow_html=True)
        with exp_c:
            is_exp=st.session_state.expanded==d["id"]
            if st.button("▾" if not is_exp else "▴",key=f"ie_{d['id']}",use_container_width=True):
                st.session_state.expanded=None if is_exp else d["id"]; st.rerun()
        with sel_c:
            if st.button("✓ 선정" if is_sel else "선정",key=f"is_{d['id']}",type="primary" if is_sel else "secondary",use_container_width=True):
                    if is_sel: st.session_state.sel.discard(d["id"])
                    else: st.session_state.sel.add(d["id"])
                    st.rerun()

        # 인스타 확장
        if st.session_state.expanded==d["id"]:
            with st.container():
                # AI 분석 + Breakdown 바
                if tab=="ai":
                    st.markdown(f'<div style="background:{t["info_bg"]};border:1px solid {t["info_border"]};border-radius:10px;padding:12px 16px;margin-bottom:12px;font-size:13px;color:{t["accent_light"]};line-height:1.6;"><strong>🤖 AI 분석:</strong> {d.get("aiReason","")}</div>',unsafe_allow_html=True)
                    if d.get("_bd"):
                        ncols=len(d["_bd"])
                        bh2=f'<div style="display:grid;grid-template-columns:repeat({ncols},1fr);gap:6px;margin-bottom:14px;">'
                        for k3,v3 in d["_bd"].items():
                            wl=WL_INSTA.get(k3,{})
                            bh2+=f'<div style="text-align:center;background:{t["bg_table_header"]};border-radius:8px;padding:8px 4px;border:1px solid {t["border"]};color:{t["text_primary"]};"><div style="font-size:10px;color:{t["text_secondary"]};margin-bottom:3px;">{wl.get("e","")} {wl.get("s","")}</div><div style="background:{t["bg_bar"]};border-radius:3px;overflow:hidden;height:4px;margin-bottom:3px;"><div style="width:{v3}%;height:100%;background:{t["accent_subtle"]};border-radius:3px;"></div></div><div style="font-size:12px;font-weight:700;color:{t["text_heading"]};">{round(v3)}</div><div style="font-size:9px;color:{t["accent_light"]};">×{AI_WEIGHTS_INSTA.get(k3,0)}%</div></div>'
                        bh2+='</div>'
                        st.markdown(bh2,unsafe_allow_html=True)
                # 보강 상태 뱃지
                if is_enriched:
                    st.markdown(f'<div style="padding:6px 14px;border-radius:8px;background:{t["success_bg"]};border:1px solid {t["success_border"]};font-size:12px;color:{t["success"]};margin-bottom:12px;">✅ instaloader 보강 완료 — 정확한 데이터 기반</div>',unsafe_allow_html=True)
                else:
                    st.markdown(f'<div style="padding:6px 14px;border-radius:8px;background:{t["warning_bg"]};border:1px solid {t["warning_border"]};font-size:12px;color:{t["warning"]};margin-bottom:12px;">⚠️ REVU 기본 데이터만 사용 · 팔로워: {d.get("followerRangeText","N/A")}</div>',unsafe_allow_html=True)
                # 상세 그리드 — 피드/릴스 분리
                fol_v=f'{d.get("followers",0):,}' if is_enriched and d.get("followers",0)>0 else d.get("followerRangeText","") or "-"
                fol_ing=f'{d.get("following",0):,}' if is_enriched and d.get("following",0)>0 else "-"
                ffr=d.get("ffRatio",0); ffr_v=f'{ffr}:1' if ffr>0 else "-"
                lpd=d.get("latestPostDate",""); lpd_v=lpd[:10] if lpd else "-"
                rv=d.get("avgReelViews",0); rv_v=f'{rv:,}' if rv>0 else "-"
                mrv=d.get("maxReelViews",0); mrv_v=f'{mrv:,}' if mrv>0 else "-"
                # 계정 기본
                gh=f'<div style="margin-bottom:10px;font-size:12px;font-weight:700;color:{t["text_heading"]};">👤 계정</div>'
                gh+=f'<div style="background:{t["bg_table_header"]};border-radius:10px;padding:14px;border:1px solid {t["border"]};color:{t["text_primary"]};display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">'
                for l,v,ic in[("팔로워",fol_v,"👥"),("팔로잉",fol_ing,"👤"),("팔로워비율",ffr_v,"📈"),("카테고리",d.get("category","") or "-","🏷️")]:
                    gh+=f'<div style="background:{t["bg_surface"]};border-radius:8px;padding:10px 12px;border:1px solid {t["border"]};"><div style="font-size:10px;color:{t["text_secondary"]};margin-bottom:3px;">{ic} {l}</div><div style="font-size:16px;font-weight:800;color:{t["text_heading"]};">{v}</div></div>'
                gh+='</div>'
                # 피드
                gh+=f'<div style="margin-bottom:10px;font-size:12px;font-weight:700;color:{t["naver_text"]};">📷 피드 (이미지)</div>'
                gh+=f'<div style="background:{t["naver_bg"]};border-radius:10px;padding:14px;border:1px solid {t["naver_border"]};display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">'
                for l,v,ic in[("피드 참여율",f'{d.get("feedER",0)}%',"📊"),("피드 평균 좋아요",f'{d.get("feedAvgLikes",0):,}',"❤️"),("피드 평균 댓글",str(d.get("feedAvgComments",0)),"💬")]:
                    gh+=f'<div style="background:{t["bg_surface"]};border-radius:8px;padding:10px 12px;border:1px solid {t["border"]};"><div style="font-size:10px;color:{t["text_secondary"]};margin-bottom:3px;">{ic} {l}</div><div style="font-size:16px;font-weight:800;color:{t["text_heading"]};">{v}</div></div>'
                gh+='</div>'
                # 릴스
                gh+=f'<div style="margin-bottom:10px;font-size:12px;font-weight:700;color:{t["insta_text"]};">🎬 릴스 (영상)</div>'
                gh+=f'<div style="background:{t["insta_bg"]};border-radius:10px;padding:14px;border:1px solid {t["insta_border"]};display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px;">'
                for l,v,ic in[("릴스 참여율",f'{d.get("reelER",0)}%',"📊"),("릴스 평균 좋아요",f'{d.get("reelAvgLikes",0):,}',"💜"),("릴스 평균 댓글",str(d.get("reelAvgComments",0)),"💬"),("릴스 평균 조회",rv_v,"👁️"),("릴스 최고 조회",mrv_v,"🔥")]:
                    gh+=f'<div style="background:{t["bg_surface"]};border-radius:8px;padding:10px 12px;border:1px solid {t["border"]};"><div style="font-size:10px;color:{t["text_secondary"]};margin-bottom:3px;">{ic} {l}</div><div style="font-size:16px;font-weight:800;color:{t["text_heading"]};">{v}</div></div>'
                gh+='</div>'
                st.markdown(gh,unsafe_allow_html=True)
                # 최근 게시물 상세 (릴스 조회수 포함)
                posts_detail=d.get("postsDetail") or []
                if posts_detail:
                    ph=f'<div style="background:{t["bg_table_header"]};border-radius:10px;padding:16px;border:1px solid {t["border"]};margin-top:14px;color:{t["text_primary"]};"><h4 style="margin:0 0 10px;font-size:13px;color:{t["accent_light"]};font-weight:700;">📸 최근 게시물</h4>'
                    for p in posts_detail[:12]:
                        ptype="🎬 릴스" if p.get("is_video") else "📷 이미지"
                        views_txt=f' · 👁️ {p.get("views",0):,}회' if p.get("views") else ""
                        pdate=p.get("date","")[:10] if p.get("date") else ""
                        _views_span=f'<span>👁️ {p["views"]:,}</span>' if p.get("views") else ""
                        ph+=f'<div style="display:flex;justify-content:space-between;padding:7px 4px;border-bottom:1px solid {t["border"]};font-size:12px;"><div style="color:{t["text_primary"]};"><span style="padding:1px 6px;border-radius:4px;background:{t["insta_bg"]};color:{t["insta_text"]};font-size:10px;font-weight:600;margin-right:6px;">{ptype}</span>{pdate}</div><div style="display:flex;gap:10px;color:{t["text_secondary"]};flex-shrink:0;font-size:11px;"><span>❤️ {p.get("likes",0):,}</span><span>💬 {p.get("comments",0):,}</span>{_views_span}</div></div>'
                    ph+='</div>'
                    st.markdown(ph,unsafe_allow_html=True)
                # 바이오 표시 (보강된 경우)
                if is_enriched and d.get("bio"):
                    st.markdown(f'<div style="margin-top:12px;padding:10px 14px;border-radius:8px;background:{t["bg_surface"]};border:1px solid {t["border"]};font-size:12px;color:{t["btn_sec_text"]};"><span style="color:{t["text_secondary"]};">📝 바이오:</span> {d.get("bio","")}</div>',unsafe_allow_html=True)
                st.divider()

# ── 결과 없음 ──
if len(data_s)==0:
    st.markdown(f'<div style="text-align:center;padding:60px 20px;color:{t["text_secondary"]};background:{t["bg_table_header"]};border-radius:0 0 10px 10px;">필터 조건에 맞는 인플루언서가 없습니다.</div>',unsafe_allow_html=True)
