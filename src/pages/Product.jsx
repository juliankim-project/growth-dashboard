export default function Product({ dark }) {
  return (
    <div className="p-6 flex items-center justify-center h-full">
      <div className={`rounded-xl border p-12 text-center max-w-sm w-full
        ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="text-4xl mb-4">📦</div>
        <p className={`font-bold text-lg ${dark ? 'text-white' : 'text-slate-800'}`}>
          Product 분석
        </p>
        <p className={`text-sm mt-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          product_rawdata 테이블 연결 후 활성화됩니다
        </p>
      </div>
    </div>
  )
}
