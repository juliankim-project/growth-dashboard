export default function Spinner({ dark }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
        데이터 로딩 중...
      </p>
    </div>
  )
}
