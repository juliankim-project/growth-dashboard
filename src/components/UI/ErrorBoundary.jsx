import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * 위젯 / 페이지 단위 Error Boundary
 * — 자식 컴포넌트에서 에러 발생 시 전체 앱 크래시를 방지하고
 *   해당 영역에만 에러 UI를 표시합니다.
 *
 * 사용: <ErrorBoundary dark={dark} label="위젯"><SomeWidget/></ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const dark  = this.props.dark ?? true
    const label = this.props.label || '컴포넌트'

    return (
      <div className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border text-center min-h-[120px]
        ${dark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
        <AlertTriangle size={28} className="text-red-400" />
        <div>
          <p className={`text-sm font-semibold ${dark ? 'text-red-400' : 'text-red-600'}`}>
            {label} 렌더링 오류
          </p>
          <p className={`text-xs mt-1 max-w-xs ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
            {this.state.error?.message || '알 수 없는 오류가 발생했습니다'}
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
            ${dark
              ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
              : 'border-red-200 text-red-500 hover:bg-red-100'}`}
        >
          <RefreshCw size={12} /> 다시 시도
        </button>
      </div>
    )
  }
}
