import { useState, useRef, useCallback } from 'react'
import { Plus, X, GripVertical, Pencil, Check, Trash2 } from 'lucide-react'
import {
  DndContext, closestCorners,
  PointerSensor, useSensor, useSensors,
  DragOverlay, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const CARD_COLORS = [
  { id: 'indigo', label: '인디고', bg: 'bg-[#579DFF]', hex: '#579DFF' },
  { id: 'emerald', label: '그린', bg: 'bg-emerald-500', hex: '#10B981' },
  { id: 'amber', label: '앰버', bg: 'bg-amber-500', hex: '#F59E0B' },
  { id: 'rose', label: '로즈', bg: 'bg-rose-500', hex: '#EF4444' },
  { id: 'violet', label: '바이올렛', bg: 'bg-violet-500', hex: '#8B5CF6' },
  { id: 'sky', label: '스카이', bg: 'bg-sky-500', hex: '#0EA5E9' },
]

const LABEL_COLORS = [
  { id: 'green',  label: '그린',   hex: '#34D399' },
  { id: 'yellow', label: '옐로',   hex: '#FBBF24' },
  { id: 'orange', label: '오렌지', hex: '#FB923C' },
  { id: 'red',    label: '레드',   hex: '#FB7185' },
  { id: 'purple', label: '퍼플',   hex: '#A78BFA' },
  { id: 'blue',   label: '블루',   hex: '#38BDF8' },
]

/* ── 드래그 가능한 카드 ── */
function SortableCard({ card, dark, onEdit, onDelete, columnId }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: card.id, data: { type: 'card', columnId } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const colorObj = CARD_COLORS.find(c => c.id === card.color)

  return (
    <div ref={setNodeRef} style={style}
      className={`group rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md
        ${dark ? 'bg-[#20232E] border-[#2E3450]' : 'bg-white border-slate-200'}`}
      {...attributes} {...listeners}
    >
      {colorObj && (
        <div className={`w-8 h-1 rounded-full mb-2 ${colorObj.bg}`} />
      )}
      {card.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {card.labels.map(lbl => {
            const lc = LABEL_COLORS.find(c => c.id === lbl.colorId)
            return (
              <span key={lbl.id} className="inline-block rounded-sm"
                style={{ backgroundColor: lc?.hex || '#94A3B8', height: lbl.text ? 'auto' : 6, width: lbl.text ? 'auto' : 32 }}>
                {lbl.text && (
                  <span className="text-[8px] font-bold text-white leading-none px-1.5 py-0.5 inline-block">{lbl.text}</span>
                )}
              </span>
            )
          })}
        </div>
      )}
      <p className={`text-xs font-medium leading-relaxed ${dark ? 'text-white' : 'text-slate-800'}`}>
        {card.title}
      </p>
      {card.desc && (
        <p className={`text-[10px] mt-1.5 leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
          {card.desc}
        </p>
      )}
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onEdit(card) }}
          className={`p-1 rounded ${dark ? 'hover:bg-[#2C333A] text-slate-400' : 'hover:bg-slate-100 text-slate-700'}`}>
          <Pencil size={10} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(card.id) }}
          className={`p-1 rounded ${dark ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-700 hover:text-red-500'}`}>
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

/* ── 카드 추가/편집 모달 ── */
function CardModal({ dark, onClose, onSave, initial = null }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [desc, setDesc] = useState(initial?.desc || '')
  const [color, setColor] = useState(initial?.color || 'indigo')
  const [labels, setLabels] = useState(initial?.labels || [])
  const [editingLabelId, setEditingLabelId] = useState(null)

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ title: title.trim(), desc: desc.trim(), color, labels })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`rounded-2xl border w-full max-w-sm p-5
        ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-4">
          <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
            {initial ? '카드 편집' : '카드 추가'}
          </p>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#2C333A]' : 'text-slate-600 hover:bg-slate-100'}`}>
            <X size={14} />
          </button>
        </div>

        <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
          placeholder="카드 제목"
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={`w-full text-xs px-3 py-2 rounded-lg border outline-none mb-3
          ${dark ? 'bg-transparent border-[#A1BDD914] text-white placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-700'}`}
        />
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="설명 (선택)"
          rows={2}
          className={`w-full text-xs px-3 py-2 rounded-lg border outline-none mb-3 resize-none
          ${dark ? 'bg-transparent border-[#A1BDD914] text-white placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-700'}`}
        />

        <div className="flex items-center gap-1.5 mb-4">
          {CARD_COLORS.map(c => (
            <button key={c.id} onClick={() => setColor(c.id)}
              className={`w-5 h-5 rounded-full ${c.bg} transition-all
              ${color === c.id ? 'ring-2 ring-offset-1 ring-[#0C66E4] scale-110' : 'opacity-60 hover:opacity-100'}`}
              style={dark ? { ringOffsetColor: '#22272B' } : {}}
            />
          ))}
        </div>

        {/* 라벨 */}
        <div className="mb-4">
          <p className={`text-[10px] font-semibold mb-2 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            라벨
          </p>
          {/* 선택된 라벨 목록 */}
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {labels.map(lbl => {
                const lc = LABEL_COLORS.find(c => c.id === lbl.colorId)
                return (
                  <span key={lbl.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] text-white font-medium cursor-pointer"
                    style={{ backgroundColor: lc?.hex || '#94A3B8' }}
                    onClick={() => setEditingLabelId(editingLabelId === lbl.id ? null : lbl.id)}>
                    {lbl.text || lc?.label}
                    <button onClick={(e) => { e.stopPropagation(); setLabels(ls => ls.filter(l => l.id !== lbl.id)) }}
                      className="hover:text-white/60 ml-0.5">
                      <X size={8} />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
          {/* 라벨 텍스트 편집 */}
          {editingLabelId && labels.find(l => l.id === editingLabelId) && (
            <input
              autoFocus
              value={labels.find(l => l.id === editingLabelId)?.text || ''}
              onChange={e => setLabels(ls => ls.map(l => l.id === editingLabelId ? { ...l, text: e.target.value } : l))}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingLabelId(null) }}
              onBlur={() => setEditingLabelId(null)}
              placeholder="라벨 텍스트 (선택)"
              className={`w-full text-[10px] px-2 py-1 rounded border outline-none mb-2
                ${dark ? 'bg-transparent border-[#A1BDD914] text-white placeholder:text-slate-500'
                      : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
            />
          )}
          {/* 색상 토글 */}
          <div className="flex items-center gap-1.5">
            {LABEL_COLORS.map(c => {
              const active = labels.some(l => l.colorId === c.id)
              return (
                <button key={c.id} onClick={() => {
                  if (active) {
                    setLabels(ls => ls.filter(l => l.colorId !== c.id))
                  } else {
                    const newLbl = { id: `l_${Date.now()}_${c.id}`, text: '', colorId: c.id }
                    setLabels(ls => [...ls, newLbl])
                  }
                }}
                  className={`w-5 h-5 rounded-full transition-all
                    ${active ? 'ring-2 ring-offset-1 ring-[#0C66E4] scale-110' : 'opacity-50 hover:opacity-100'}`}
                  style={{ backgroundColor: c.hex, ...(dark ? { ringOffsetColor: '#22272B' } : {}) }}
                />
              )
            })}
          </div>
        </div>

        <button onClick={handleSave}
          className="w-full text-xs py-2 rounded-lg bg-[#0C66E4] hover:bg-[#0055CC] text-white font-semibold">
          {initial ? '수정' : '추가'}
        </button>
      </div>
    </div>
  )
}

/* ── 컬럼 리사이즈 핸들 ── */
function ColResizeHandle({ dark, baseWidth, onResizeEnd }) {
  const startX = useRef(0)
  const baseW = useRef(256)
  const colEl = useRef(null)

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    startX.current = e.clientX
    baseW.current = baseWidth || 256
    colEl.current = e.currentTarget.parentElement

    const onMove = (ev) => {
      const delta = ev.clientX - startX.current
      const newW = Math.max(160, Math.min(600, baseW.current + delta))
      if (colEl.current) colEl.current.style.width = newW + 'px'
    }
    const onUp = (ev) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      const delta = ev.clientX - startX.current
      const finalW = Math.max(160, Math.min(600, baseW.current + delta))
      onResizeEnd(finalW)
      colEl.current = null
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [baseWidth, onResizeEnd])

  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10
        group/handle flex items-center justify-center
        hover:bg-[#579DFF]/20 active:bg-[#579DFF]/30 transition-colors`}
      style={{ touchAction: 'none' }}
    >
      <div className={`w-0.5 h-6 rounded-full opacity-0 group-hover/handle:opacity-100 transition-opacity
        ${dark ? 'bg-slate-500' : 'bg-slate-300'}`} />
    </div>
  )
}

/* ── 드롭 가능한 컬럼 영역 ── */
function DroppableColumn({ columnId, dark, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { type: 'column' },
  })

  return (
    <div ref={setNodeRef}
      className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px] transition-colors rounded-lg
        ${isOver ? (dark ? 'bg-[#579DFF]/10' : 'bg-[#E9F2FF]') : ''}`}>
      {children}
    </div>
  )
}

/* ── 메인 칸반 보드 ── */
export default function KanbanBoard({ dashboard, setDashboard, dark }) {
  const columns = dashboard?.columns || []
  const [editingCard, setEditingCard] = useState(null) // { columnId, card? }
  const [editingColId, setEditingColId] = useState(null)
  const [editingColTitle, setEditingColTitle] = useState('')
  const [addingCol, setAddingCol] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')
  const [activeCardId, setActiveCardId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  /* ── 컬럼 CRUD ── */
  const addColumn = () => {
    if (!newColTitle.trim()) { setAddingCol(false); return }
    const newCol = { id: `c_${Date.now()}`, title: newColTitle.trim(), cards: [], width: 256 }
    setDashboard({ ...dashboard, columns: [...columns, newCol] })
    setAddingCol(false)
    setNewColTitle('')
  }

  const renameColumn = (colId) => {
    if (!editingColTitle.trim()) { setEditingColId(null); return }
    setDashboard({
      ...dashboard,
      columns: columns.map(c => c.id === colId ? { ...c, title: editingColTitle.trim() } : c),
    })
    setEditingColId(null)
  }

  const deleteColumn = (colId) => {
    setDashboard({ ...dashboard, columns: columns.filter(c => c.id !== colId) })
  }

  /* ── 컬럼 리사이즈 (드래그 종료 시 한 번만 커밋) ── */
  const commitColWidth = useCallback((colId, width) => {
    setDashboard({
      ...dashboard,
      columns: columns.map(c =>
        c.id === colId ? { ...c, width } : c
      ),
    })
  }, [setDashboard, dashboard, columns])

  /* ── 카드 CRUD ── */
  const addCard = (columnId, cardData) => {
    const card = { id: `k_${Date.now()}`, ...cardData, createdAt: new Date().toISOString() }
    setDashboard({
      ...dashboard,
      columns: columns.map(c => c.id === columnId
        ? { ...c, cards: [...c.cards, card] }
        : c
      ),
    })
  }

  const updateCard = (columnId, cardId, cardData) => {
    setDashboard({
      ...dashboard,
      columns: columns.map(c => c.id === columnId
        ? { ...c, cards: c.cards.map(k => k.id === cardId ? { ...k, ...cardData } : k) }
        : c
      ),
    })
  }

  const deleteCard = (columnId, cardId) => {
    setDashboard({
      ...dashboard,
      columns: columns.map(c => c.id === columnId
        ? { ...c, cards: c.cards.filter(k => k.id !== cardId) }
        : c
      ),
    })
  }

  /* ── 드래그 앤 드롭 ── */
  const findCardColumn = (cardId) => {
    for (const col of columns) {
      if (col.cards.some(c => c.id === cardId)) return col.id
    }
    return null
  }

  const handleDragStart = (event) => {
    setActiveCardId(event.active.id)
  }

  const handleDragOver = (event) => {
    const { active, over } = event
    if (!over) return

    const activeColId = findCardColumn(active.id)
    // over가 카드면 그 카드의 컬럼, 아니면 over.id가 컬럼 자체
    let overColId = findCardColumn(over.id)
    if (!overColId) {
      // over.id가 컬럼 ID일 수 있음
      if (columns.some(c => c.id === over.id)) overColId = over.id
    }

    if (!activeColId || !overColId || activeColId === overColId) return

    // 다른 컬럼으로 이동
    const activeCol = columns.find(c => c.id === activeColId)
    const overCol = columns.find(c => c.id === overColId)
    const activeCard = activeCol.cards.find(c => c.id === active.id)
    if (!activeCard) return  // 중복 이벤트 방지
    const overCardIdx = overCol.cards.findIndex(c => c.id === over.id)

    const newColumns = columns.map(col => {
      if (col.id === activeColId) {
        return { ...col, cards: col.cards.filter(c => c.id !== active.id) }
      }
      if (col.id === overColId) {
        const idx = overCardIdx >= 0 ? overCardIdx : col.cards.length
        const newCards = [...col.cards.filter(c => c.id !== active.id)]  // 중복 삽입 방지
        newCards.splice(idx, 0, activeCard)
        return { ...col, cards: newCards }
      }
      return col
    })
    setDashboard({ ...dashboard, columns: newColumns })
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveCardId(null)
    if (!over || active.id === over.id) return

    const colId = findCardColumn(active.id)
    if (!colId) return

    const col = columns.find(c => c.id === colId)
    const oldIdx = col.cards.findIndex(c => c.id === active.id)
    const newIdx = col.cards.findIndex(c => c.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return

    setDashboard({
      ...dashboard,
      columns: columns.map(c =>
        c.id === colId ? { ...c, cards: arrayMove(c.cards, oldIdx, newIdx) } : c
      ),
    })
  }

  const allCardIds = columns.flatMap(c => c.cards.map(k => k.id))
  const activeCard = activeCardId
    ? columns.flatMap(c => c.cards).find(c => c.id === activeCardId)
    : null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
    <div className="flex gap-4 h-full overflow-x-auto overflow-y-hidden pb-2">

        {columns.map(col => (
          <div key={col.id}
            className={`shrink-0 rounded-xl border flex flex-col h-full relative
            ${dark ? 'bg-[#22272B]/60 border-[#A1BDD914]' : 'bg-slate-50 border-slate-200'}`}
            style={{ width: col.width || 256 }}>

            {/* 컬럼 헤더 */}
            <div className={`flex items-center justify-between px-3 py-2.5 border-b
              ${dark ? 'border-[#A1BDD914]' : 'border-slate-200'}`}>
              {editingColId === col.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <input autoFocus value={editingColTitle}
                    onChange={e => setEditingColTitle(e.target.value)}
                    onBlur={() => renameColumn(col.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameColumn(col.id)
                      if (e.key === 'Escape') setEditingColId(null)
                    }}
                    className={`flex-1 text-xs font-semibold px-1.5 py-0.5 rounded outline-none
                    ${dark ? 'bg-transparent text-white' : 'bg-transparent text-slate-800'}`}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-xs font-semibold truncate ${dark ? 'text-white' : 'text-slate-700'}`}>
                    {col.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0
                    ${dark ? 'bg-[#2C333A] text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                    {col.cards.length}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => { setEditingColId(col.id); setEditingColTitle(col.title) }}
                  className={`p-1 rounded ${dark ? 'text-slate-500 hover:text-slate-200 hover:bg-[#2C333A]' : 'text-slate-700 hover:text-slate-700 hover:bg-slate-100'}`}>
                  <Pencil size={10} />
                </button>
                {columns.length > 1 && (
                  <button onClick={() => deleteColumn(col.id)}
                    className={`p-1 rounded ${dark ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-700 hover:text-red-500 hover:bg-red-50'}`}>
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </div>

            {/* 카드 목록 (드롭 가능) */}
            <DroppableColumn columnId={col.id} dark={dark}>
              <SortableContext items={col.cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {col.cards.map(card => (
                  <SortableCard key={card.id} card={card} dark={dark} columnId={col.id}
                    onEdit={(c) => setEditingCard({ columnId: col.id, card: c })}
                    onDelete={(cardId) => deleteCard(col.id, cardId)}
                  />
                ))}
              </SortableContext>
              {col.cards.length === 0 && (
                <div className={`text-center py-6 text-[10px] ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                  카드를 드래그하거나 추가하세요
                </div>
              )}
            </DroppableColumn>

            {/* 카드 추가 버튼 */}
            <div className={`px-2 pb-2`}>
              <button onClick={() => setEditingCard({ columnId: col.id })}
                className={`w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg
                border border-dashed transition-colors
                ${dark
                  ? 'border-[#2E3450] text-slate-500 hover:text-slate-300 hover:border-slate-500'
                  : 'border-slate-200 text-slate-600 hover:text-slate-600 hover:border-slate-300'}`}>
                <Plus size={10} /> 카드 추가
              </button>
            </div>

            {/* 컬럼 리사이즈 핸들 */}
            <ColResizeHandle dark={dark}
              baseWidth={col.width || 256}
              onResizeEnd={(w) => commitColWidth(col.id, w)}
            />
          </div>
        ))}

      {/* 컬럼 추가 */}
      {addingCol ? (
        <div className={`shrink-0 rounded-xl border p-3
          ${dark ? 'bg-[#22272B]/60 border-[#A1BDD914]' : 'bg-slate-50 border-slate-200'}`}
          style={{ width: 256 }}>
          <input autoFocus value={newColTitle}
            onChange={e => setNewColTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addColumn()
              if (e.key === 'Escape') { setAddingCol(false); setNewColTitle('') }
            }}
            placeholder="컬럼 이름"
            className={`w-full text-xs px-3 py-2 rounded-lg border outline-none mb-2
            ${dark ? 'bg-transparent border-[#A1BDD914] text-white placeholder:text-slate-500'
                  : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-700'}`}
          />
          <div className="flex gap-1.5">
            <button onClick={addColumn}
              className="flex-1 text-xs py-1.5 rounded-lg bg-[#0C66E4] hover:bg-[#0055CC] text-white font-semibold">
              추가
            </button>
            <button onClick={() => { setAddingCol(false); setNewColTitle('') }}
              className={`text-xs px-3 py-1.5 rounded-lg ${dark ? 'text-slate-400 hover:text-white' : 'text-slate-700'}`}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingCol(true)}
          style={{ width: 160 }}
          className={`shrink-0 h-fit rounded-xl border border-dashed p-4
          flex items-center justify-center gap-2 text-xs transition-colors
          ${dark
            ? 'border-[#2E3450] text-slate-500 hover:text-slate-300 hover:border-slate-500'
            : 'border-slate-200 text-slate-600 hover:text-slate-600 hover:border-slate-300'}`}>
          <Plus size={14} /> 컬럼 추가
        </button>
      )}

      {/* 카드 추가/편집 모달 */}
      {editingCard && (
        <CardModal dark={dark}
          initial={editingCard.card || null}
          onClose={() => setEditingCard(null)}
          onSave={(data) => {
            if (editingCard.card) {
              updateCard(editingCard.columnId, editingCard.card.id, data)
            } else {
              addCard(editingCard.columnId, data)
            }
          }}
        />
      )}
    </div>

    {/* 드래그 오버레이 (scroll 컨테이너 밖에서 렌더) */}
    <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
      {activeCard ? (
        <div className={`rounded-lg border p-3 shadow-xl rotate-2 pointer-events-none
          ${dark ? 'bg-[#20232E] border-[#2E3450]' : 'bg-white border-slate-200'}`}
          style={{ width: 240 }}>
          {activeCard.labels?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {activeCard.labels.map(lbl => {
                const lc = LABEL_COLORS.find(c => c.id === lbl.colorId)
                return <span key={lbl.id} className="inline-block rounded-sm"
                  style={{ backgroundColor: lc?.hex || '#94A3B8', height: 6, width: lbl.text ? 'auto' : 24, ...(lbl.text ? { padding: '1px 6px' } : {}) }}>
                  {lbl.text && <span className="text-[7px] font-bold text-white leading-none">{lbl.text}</span>}
                </span>
              })}
            </div>
          )}
          <p className={`text-xs font-medium ${dark ? 'text-white' : 'text-slate-800'}`}>
            {activeCard.title}
          </p>
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}
