export default function Spinner({ dark }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3">
      <div className="w-10 h-10 border-2 border-[#0C66E4] border-t-transparent rounded-full animate-spin" />
      <p className={`text-base ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
        데이터 로딩 중...
      </p>
    </div>
  )
}
