import { useState } from 'react'
import NaverTrend from './NaverTrend'
import GoogleAds from './GoogleAds'

export default function SearchAdsAI({ dark }) {
  const [activeTab, setActiveTab] = useState('naver')

  return (
    <div className={`min-h-screen ${dark ? 'bg-[#1D2125]' : 'bg-[#F7F8F9]'}`}>
      {/* ── 상단 헤더 ── */}
      <div className={`sticky top-0 z-20 backdrop-blur-md border-b
        ${dark ? 'bg-[#1D2125]/90 border-[#A1BDD914]' : 'bg-[#F7F8F9]/90 border-slate-200'}`}>
        <div className="px-6 pt-4 pb-1">
          <h1 className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-800'}`}>
            검색 광고 AI
          </h1>
          <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
            네이버·구글 검색광고 키워드 트렌드 분석
          </p>
        </div>

        {/* ── 탭 버튼 ── */}
        <div className="px-6 pb-3 flex items-center gap-2">
          {[
            { id: 'naver', label: '네이버 (Naver)' },
            { id: 'google', label: '구글 (Google)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${activeTab === tab.id
                  ? 'bg-[#0C66E4] text-white shadow-sm'
                  : dark
                    ? 'bg-[#22272B] text-slate-400 hover:text-white border border-[#A1BDD914]'
                    : 'bg-white text-slate-700 hover:text-slate-700 border border-slate-200 shadow-sm'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="p-6">
        {activeTab === 'naver' && <NaverTrend dark={dark} />}
        {activeTab === 'google' && <GoogleAds dark={dark} />}
      </div>
    </div>
  )
}
