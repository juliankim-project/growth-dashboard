import { useState, useMemo, useCallback } from 'react'
import { Plus, X, Pencil, Trash2, GripVertical } from 'lucide-react'
import {
  DndContext, closestCorners,
  PointerSensor, useSensor, useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const CARD_COLORS = [
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500', border: 'border-l-indigo-500', hex: '#6366F1' },
  { id: 'emerald', label: 'Green', bg: 'bg-emerald-500', border: 'border-l-emerald-500', hex: '#10B981' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500', border: 'border-l-amber-500', hex: '#F59E0B' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500', border: 'border-l-rose-500', hex: '#EF4444' },
  { id: 'violet', label: 'Violet', bg: 'bg-violet-500', border: 'border-l-violet-500', hex: '#8B5CF6' },
  { id: 'sky', label: 'Sky', bg: 'bg-sky-500', border: 'border-l-sky-500', hex: '#0EA5E9' },
]

/* 컬럼 헤더 색상 순환 */
const COL_HEADER_COLORS = [
  { dark: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', light: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { dark: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { dark: 'bg-amber-500/15 text-amber-400 border-amber-500/30', light: 'bg-amber-50 text-amber-700 border-amber-200' },
  { dark: 'bg-violet-500/15 text-violet-400 border-violet-500/30', light: 'bg-violet-50 text-violet-700 border-violet-200' },
  { dark: 'bg-rose-500/15 text-rose-400 border-rose-500/30', light: 'bg-rose-50 text-rose-700 border-rose-200' },
  { dark: 'bg-sky-500/15 text-sky-400 border-sky-500/30', light: 'bg-sky-50 text-sky-700 border-sky-200' },
]

/* ── Sortable card ── */
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
      className={`group rounded-lg border-l-[3px] border px-3 py-2.5 cursor-grab active:cursor-grabbing
        transition-shadow hover:shadow-md
        ${colorObj ? colorObj.border : 'border-l-slate-300'}
        ${dark ? 'bg-[#20232E] border-[#2E3450] hover:bg-[#252836]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
      {...attributes} {...listeners}
    >
      <p className={`text-xs font-semibold leading-snug ${dark ? 'text-white' : 'text-slate-800'}`}>
        {card.title}
      </p>
      {card.desc && (
        <p className={`text-[11px] mt-1 leading-snug line-clamp-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          {card.desc}
        </p>
      )}
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onEdit(card) }}
          className={`p-1 rounded-md text-[10px] flex items-center gap-0.5
            ${dark ? 'hover:bg-[#252836] text-slate-500 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
          <Pencil size={10} /> 편집
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(card.id) }}
          className={`p-1 rounded-md text-[10px] flex items-center gap-0.5
            ${dark ? 'hover:bg-red-500/20 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}>
          <Trash2 size={10} /> 삭제
        </button>
      </div>
    </div>
  )
}

/* ── Card modal ── */
function CardModal({ dark, onClose, onSave, initial = null }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [desc, setDesc] = useState(initial?.desc || '')
  const [color, setColor] = useState(initial?.color || 'indigo')

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ title: title.trim(), desc: desc.trim(), color })
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-xl"
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`rounded-xl border w-full max-w-xs p-5
        ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-4">
          <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
            {initial ? '카드 편집' : '카드 추가'}
          </p>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#252836]' : 'text-slate-600 hover:bg-slate-100'}`}>
            <X size={14} />
          </button>
        </div>

        <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
          placeholder="카드 제목"
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={`w-full text-xs px-3 py-2 rounded-lg border outline-none mb-3
          ${dark ? 'bg-transparent border-[#252836] text-white placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
        />
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="설명 (선택)"
          rows={3}
          className={`w-full text-xs px-3 py-2 rounded-lg border outline-none mb-3 resize-none
          ${dark ? 'bg-transparent border-[#252836] text-white placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
        />

        <p className={`text-[10px] font-semibold mb-2 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>색상</p>
        <div className="flex items-center gap-2 mb-4">
          {CARD_COLORS.map(c => (
            <button key={c.id} onClick={() => setColor(c.id)}
              className={`w-6 h-6 rounded-full ${c.bg} transition-all
              ${color === c.id ? 'ring-2 ring-offset-2 ring-indigo-400 scale-110' : 'opacity-50 hover:opacity-100'}`}
              style={dark ? { '--tw-ring-offset-color': '#1A1D27' } : {}}
            />
          ))}
        </div>

        <button onClick={handleSave}
          className="w-full text-xs py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
          {initial ? '저장' : '추가'}
        </button>
      </div>
    </div>
  )
}

/* ── KanbanWidget ── */
export default function KanbanWidget({ data, config, dark, onConfigUpdate }) {
  const columns = useMemo(() => config?.columns || [], [config?.columns])
  const title = config?.title || 'Kanban'

  const [editingCard, setEditingCard] = useState(null)
  const [editingColId, setEditingColId] = useState(null)
  const [editingColTitle, setEditingColTitle] = useState('')
  const [addingCol, setAddingCol] = useState(false)
  const [newColTitle, setNewColTitle] = useState('')
  const [activeCardId, setActiveCardId] = useState(null)

  /* Own DndContext sensors -- separate from any parent DndContext */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  /* ── Persist helper ── */
  const updateColumns = useCallback((newCols) => {
    onConfigUpdate?.({ ...config, columns: newCols })
  }, [config, onConfigUpdate])

  /* ── Column CRUD ── */
  const addColumn = () => {
    if (!newColTitle.trim()) { setAddingCol(false); return }
    const newCol = { id: `c_${Date.now()}`, title: newColTitle.trim(), cards: [] }
    updateColumns([...columns, newCol])
    setAddingCol(false)
    setNewColTitle('')
  }

  const renameColumn = (colId) => {
    if (!editingColTitle.trim()) { setEditingColId(null); return }
    updateColumns(columns.map(c => c.id === colId ? { ...c, title: editingColTitle.trim() } : c))
    setEditingColId(null)
  }

  const deleteColumn = (colId) => {
    updateColumns(columns.filter(c => c.id !== colId))
  }

  /* ── Card CRUD ── */
  const addCard = (columnId, cardData) => {
    const card = { id: `k_${Date.now()}`, ...cardData }
    updateColumns(columns.map(c => c.id === columnId
      ? { ...c, cards: [...c.cards, card] }
      : c
    ))
  }

  const updateCard = (columnId, cardId, cardData) => {
    updateColumns(columns.map(c => c.id === columnId
      ? { ...c, cards: c.cards.map(k => k.id === cardId ? { ...k, ...cardData } : k) }
      : c
    ))
  }

  const deleteCard = (columnId, cardId) => {
    updateColumns(columns.map(c => c.id === columnId
      ? { ...c, cards: c.cards.filter(k => k.id !== cardId) }
      : c
    ))
  }

  /* ── Drag and drop ── */
  const findCardColumn = useCallback((cardId) => {
    for (const col of columns) {
      if (col.cards.some(c => c.id === cardId)) return col.id
    }
    return null
  }, [columns])

  const handleDragStart = (event) => {
    setActiveCardId(event.active.id)
  }

  const handleDragOver = (event) => {
    const { active, over } = event
    if (!over) return

    const activeColId = findCardColumn(active.id)
    let overColId = findCardColumn(over.id)
    if (!overColId) {
      if (columns.some(c => c.id === over.id)) overColId = over.id
    }

    if (!activeColId || !overColId || activeColId === overColId) return

    const activeCol = columns.find(c => c.id === activeColId)
    const overCol = columns.find(c => c.id === overColId)
    const activeCard = activeCol.cards.find(c => c.id === active.id)
    const overCardIdx = overCol.cards.findIndex(c => c.id === over.id)

    const newColumns = columns.map(col => {
      if (col.id === activeColId) {
        return { ...col, cards: col.cards.filter(c => c.id !== active.id) }
      }
      if (col.id === overColId) {
        const idx = overCardIdx >= 0 ? overCardIdx : col.cards.length
        const newCards = [...col.cards]
        newCards.splice(idx, 0, activeCard)
        return { ...col, cards: newCards }
      }
      return col
    })
    updateColumns(newColumns)
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

    updateColumns(columns.map(c =>
      c.id === colId ? { ...c, cards: arrayMove(c.cards, oldIdx, newIdx) } : c
    ))
  }

  const activeCard = useMemo(() => {
    if (!activeCardId) return null
    return columns.flatMap(c => c.cards).find(c => c.id === activeCardId) || null
  }, [activeCardId, columns])

  return (
    <div className={`rounded-xl border h-full min-h-[320px] flex flex-col overflow-hidden relative
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
      {/* Title */}
      <div className={`flex items-center justify-between px-4 pt-3 pb-2 shrink-0`}>
        <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-700'}`}>
          {title}
        </p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
          ${dark ? 'bg-[#252836] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
          {columns.reduce((sum, c) => sum + c.cards.length, 0)}개 카드
        </span>
      </div>

      {/* Kanban board with its own DndContext */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 pb-3">
        <div className="flex gap-3 h-full min-w-min">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {columns.map((col, colIdx) => {
              const hc = COL_HEADER_COLORS[colIdx % COL_HEADER_COLORS.length]
              return (
                <div key={col.id}
                  className={`shrink-0 min-w-[200px] flex-1 rounded-xl border flex flex-col max-h-full overflow-hidden
                  ${dark ? 'bg-[#13151C] border-[#252836]' : 'bg-slate-50/80 border-slate-200'}`}>

                  {/* Column header — 색깔 배경 */}
                  <div className={`flex items-center justify-between px-3 py-2.5 border-b
                    ${dark ? hc.dark + ' border-b-[#252836]' : hc.light}`}>
                    {editingColId === col.id ? (
                      <input autoFocus value={editingColTitle}
                        onChange={e => setEditingColTitle(e.target.value)}
                        onBlur={() => renameColumn(col.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') renameColumn(col.id)
                          if (e.key === 'Escape') setEditingColId(null)
                        }}
                        className={`flex-1 text-xs font-bold px-1.5 py-0.5 rounded outline-none
                        ${dark ? 'bg-transparent text-white' : 'bg-transparent text-slate-800'}`}
                      />
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold truncate">
                          {col.title}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0
                          ${dark ? 'bg-white/10' : 'bg-black/10'}`}>
                          {col.cards.length}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center shrink-0 ml-1 gap-0.5">
                      <button onClick={() => { setEditingColId(col.id); setEditingColTitle(col.title) }}
                        className={`p-1 rounded-md transition-colors
                          ${dark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                        <Pencil size={11} />
                      </button>
                      {columns.length > 1 && (
                        <button onClick={() => deleteColumn(col.id)}
                          className={`p-1 rounded-md transition-colors
                            ${dark ? 'hover:bg-red-500/20 hover:text-red-400' : 'hover:bg-red-50 hover:text-red-500'}`}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card list */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px]">
                    <SortableContext items={col.cards.map(c => c.id)} strategy={verticalListSortingStrategy}
                      id={col.id}>
                      {col.cards.map(card => (
                        <SortableCard key={card.id} card={card} dark={dark} columnId={col.id}
                          onEdit={(c) => setEditingCard({ columnId: col.id, card: c })}
                          onDelete={(cardId) => deleteCard(col.id, cardId)}
                        />
                      ))}
                    </SortableContext>
                    {col.cards.length === 0 && (
                      <div className={`text-center py-6 text-[11px] rounded-lg border border-dashed
                        ${dark ? 'text-slate-600 border-[#2E3450]' : 'text-slate-300 border-slate-200'}`}>
                        카드를 드래그하거나 추가하세요
                      </div>
                    )}
                  </div>

                  {/* Add card */}
                  <div className="px-2 pb-2 shrink-0">
                    <button onClick={() => setEditingCard({ columnId: col.id })}
                      className={`w-full flex items-center justify-center gap-1.5 text-[11px] font-medium py-2 rounded-lg
                      border border-dashed transition-colors
                      ${dark
                        ? 'border-[#2E3450] text-slate-500 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/5'
                        : 'border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50'}`}>
                      <Plus size={12} /> 카드 추가
                    </button>
                  </div>
                </div>
              )
            })}

            <DragOverlay>
              {activeCard ? (
                <div className={`rounded-lg border-l-[3px] border px-3 py-2.5 w-48 shadow-2xl rotate-2
                  ${dark ? 'bg-[#20232E] border-[#2E3450] border-l-indigo-500' : 'bg-white border-slate-200 border-l-indigo-500'}`}>
                  <p className={`text-xs font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>
                    {activeCard.title}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Add column */}
          {addingCol ? (
            <div className={`shrink-0 min-w-[200px] flex-1 rounded-xl border p-3
              ${dark ? 'bg-[#13151C] border-[#252836]' : 'bg-slate-50/80 border-slate-200'}`}>
              <input autoFocus value={newColTitle}
                onChange={e => setNewColTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addColumn()
                  if (e.key === 'Escape') { setAddingCol(false); setNewColTitle('') }
                }}
                placeholder="칼럼 이름"
                className={`w-full text-xs px-3 py-2 rounded-lg border outline-none mb-2
                ${dark ? 'bg-transparent border-[#252836] text-white placeholder:text-slate-600'
                      : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
              />
              <div className="flex gap-2">
                <button onClick={addColumn}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  추가
                </button>
                <button onClick={() => { setAddingCol(false); setNewColTitle('') }}
                  className={`text-xs px-3 py-1.5 rounded-lg ${dark ? 'text-slate-500 hover:text-white' : 'text-slate-400'}`}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingCol(true)}
              className={`shrink-0 min-w-[200px] h-fit rounded-xl border border-dashed p-4
              flex items-center justify-center gap-1.5 text-xs font-medium transition-colors
              ${dark
                ? 'border-[#2E3450] text-slate-600 hover:text-indigo-400 hover:border-indigo-500/40'
                : 'border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-300'}`}>
              <Plus size={14} /> 칼럼 추가
            </button>
          )}
        </div>
      </div>

      {/* Card add/edit modal (positioned inside the widget) */}
      {editingCard && (
        <CardModal dark={dark}
          initial={editingCard.card || null}
          onClose={() => setEditingCard(null)}
          onSave={(cardData) => {
            if (editingCard.card) {
              updateCard(editingCard.columnId, editingCard.card.id, cardData)
            } else {
              addCard(editingCard.columnId, cardData)
            }
          }}
        />
      )}
    </div>
  )
}
