#!/bin/bash
# ── REVU AI 크롤러 (growth-dashboard/revu 기준) ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/revu"
echo "📂 경로: $SCRIPT_DIR/revu"

# 필수 패키지 확인
python3 -c "import streamlit" 2>/dev/null || { echo "📦 streamlit 설치 중..."; pip3 install streamlit --quiet; }
python3 -c "import supabase" 2>/dev/null || { echo "📦 supabase 설치 중..."; pip3 install supabase --quiet; }
python3 -c "import selenium" 2>/dev/null || { echo "📦 selenium 설치 중..."; pip3 install selenium --quiet; }
python3 -c "import bs4" 2>/dev/null || { echo "📦 beautifulsoup4 설치 중..."; pip3 install beautifulsoup4 --quiet; }

if lsof -i :8501 &>/dev/null; then
    echo "✅ 이미 실행 중"; open http://localhost:8501
else
    echo "🚀 REVU 크롤러 시작 중..."
    python3 -m streamlit run revu_app.py --server.headless=true &
    sleep 2; open http://localhost:8501
    echo "✅ 종료하려면 이 창을 닫으세요"; wait
fi
