import { useState, useMemo, useCallback } from 'react'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'
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
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500', hex: '#6366F1' },
  { id: 'emerald', label: 'Green', bg: 'bg-emerald-500', hex: '#10B981' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500', hex: '#F59E0B' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500', hex: '#EF4444' },
  { id: 'violet', label: 'Violet', bg: 'bg-violet-500', hex: '#8B5CF6' },
  { id: 'sky', label: 'Sky', bg: 'bg-sky-500', hex: '#0EA5E9' },
]

/* ── Compact sortable card ── */
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
      className={`group rounded-md border px-2 py-1.5 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-sm
        ${dark ? 'bg-[#20232E] border-[#2E3450]' : 'bg-white border-slate-200'}`}
      {...attributes} {...listeners}
    >
      {colorObj && (
        <div className={`w-6 h-0.5 rounded-full mb-1 ${colorObj.bg}`} />
      )}
      <p className={`text-[10px] font-medium leading-snug ${dark ? 'text-white' : 'text-slate-800'}`}>
        {card.title}
      </p>
      {card.desc && (
        <p className={`text-[9px] mt-0.5 leading-snug line-clamp-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          {card.desc}
        </p>
      )}
      <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onEdit(card) }}
          className={`p-0.5 rounded ${dark ? 'hover:bg-[#252836] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
          <Pencil size={8} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(card.id) }}
          className={`p-0.5 rounded ${dark ? 'hover:bg-red-500/20 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}>
          <Trash2 size={8} />
        </button>
      </div>
    </div>
  )
}

/* ── Compact card modal ── */
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
        className={`rounded-xl border w-full max-w-[260px] p-4
        ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-3">
          <p className={`text-[11px] font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
            {initial ? 'Edit Card' : 'Add Card'}
          </p>
          <button onClick={onClose}
            className={`p-1 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#252836]' : 'text-slate-600 hover:bg-slate-100'}`}>
            <X size={12} />
          </button>
        </div>

        <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Card title"
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className={`w-full text-[10px] px-2 py-1.5 rounded-lg border outline-none mb-2
          ${dark ? 'bg-transparent border-[#252836] text-white placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
        />
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className={`w-full text-[10px] px-2 py-1.5 rounded-lg border outline-none mb-2 resize-none
          ${dark ? 'bg-transparent border-[#252836] text-white placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
        />

        <div className="flex items-center gap-1 mb-3">
          {CARD_COLORS.map(c => (
            <button key={c.id} onClick={() => setColor(c.id)}
              className={`w-4 h-4 rounded-full ${c.bg} transition-all
              ${color === c.id ? 'ring-2 ring-offset-1 ring-indigo-400 scale-110' : 'opacity-50 hover:opacity-100'}`}
              style={dark ? { ringOffsetColor: '#1A1D27' } : {}}
            />
          ))}
        </div>

        <button onClick={handleSave}
          className="w-full text-[10px] py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
          {initial ? 'Save' : 'Add'}
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
    <div className={`rounded-xl border h-full min-h-[280px] flex flex-col overflow-hidden relative
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
      {/* Title */}
      <p className={`text-xs font-semibold px-4 pt-3 pb-2 shrink-0 ${dark ? 'text-white' : 'text-slate-700'}`}>
        {title}
      </p>

      {/* Kanban board with its own DndContext */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-2 pb-2">
        <div className="flex gap-2 h-full min-w-min">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {columns.map(col => (
              <div key={col.id}
                className={`shrink-0 min-w-[160px] flex-1 rounded-lg border flex flex-col max-h-full
                ${dark ? 'bg-[#1A1D27]/60 border-[#252836]' : 'bg-slate-50 border-slate-100'}`}>

                {/* Column header */}
                <div className={`flex items-center justify-between px-2 py-1.5 border-b
                  ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                  {editingColId === col.id ? (
                    <input autoFocus value={editingColTitle}
                      onChange={e => setEditingColTitle(e.target.value)}
                      onBlur={() => renameColumn(col.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameColumn(col.id)
                        if (e.key === 'Escape') setEditingColId(null)
                      }}
                      className={`flex-1 text-[10px] font-semibold px-1 py-0.5 rounded outline-none
                      ${dark ? 'bg-transparent text-white' : 'bg-transparent text-slate-800'}`}
                    />
                  ) : (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className={`text-[10px] font-semibold truncate ${dark ? 'text-white' : 'text-slate-700'}`}>
                        {col.title}
                      </span>
                      <span className={`text-[8px] px-1 py-0.5 rounded-full shrink-0
                        ${dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-200 text-slate-500'}`}>
                        {col.cards.length}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center shrink-0 ml-1">
                    <button onClick={() => { setEditingColId(col.id); setEditingColTitle(col.title) }}
                      className={`p-0.5 rounded ${dark ? 'text-slate-600 hover:text-slate-300 hover:bg-[#252836]' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'}`}>
                      <Pencil size={8} />
                    </button>
                    {columns.length > 1 && (
                      <button onClick={() => deleteColumn(col.id)}
                        className={`p-0.5 rounded ${dark ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}>
                        <Trash2 size={8} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card list */}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-[36px]">
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
                    <div className={`text-center py-3 text-[8px] ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
                      Drop cards here
                    </div>
                  )}
                </div>

                {/* Add card */}
                <div className="px-1.5 pb-1.5">
                  <button onClick={() => setEditingCard({ columnId: col.id })}
                    className={`w-full flex items-center justify-center gap-1 text-[9px] py-1 rounded-md
                    border border-dashed transition-colors
                    ${dark
                      ? 'border-[#2E3450] text-slate-600 hover:text-slate-400 hover:border-slate-500'
                      : 'border-slate-200 text-slate-400 hover:text-slate-500 hover:border-slate-300'}`}>
                    <Plus size={8} /> Add
                  </button>
                </div>
              </div>
            ))}

            <DragOverlay>
              {activeCard ? (
                <div className={`rounded-md border px-2 py-1.5 w-40 shadow-xl rotate-2
                  ${dark ? 'bg-[#20232E] border-[#2E3450]' : 'bg-white border-slate-200'}`}>
                  <p className={`text-[10px] font-medium ${dark ? 'text-white' : 'text-slate-800'}`}>
                    {activeCard.title}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Add column */}
          {addingCol ? (
            <div className={`shrink-0 min-w-[160px] flex-1 rounded-lg border p-2
              ${dark ? 'bg-[#1A1D27]/60 border-[#252836]' : 'bg-slate-50 border-slate-100'}`}>
              <input autoFocus value={newColTitle}
                onChange={e => setNewColTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addColumn()
                  if (e.key === 'Escape') { setAddingCol(false); setNewColTitle('') }
                }}
                placeholder="Column name"
                className={`w-full text-[10px] px-2 py-1 rounded-md border outline-none mb-1.5
                ${dark ? 'bg-transparent border-[#252836] text-white placeholder:text-slate-600'
                      : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
              />
              <div className="flex gap-1">
                <button onClick={addColumn}
                  className="flex-1 text-[9px] py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  Add
                </button>
                <button onClick={() => { setAddingCol(false); setNewColTitle('') }}
                  className={`text-[9px] px-2 py-1 rounded-md ${dark ? 'text-slate-500 hover:text-white' : 'text-slate-400'}`}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingCol(true)}
              className={`shrink-0 min-w-[160px] h-fit rounded-lg border border-dashed p-3
              flex items-center justify-center gap-1 text-[9px] transition-colors
              ${dark
                ? 'border-[#2E3450] text-slate-600 hover:text-slate-400 hover:border-slate-500'
                : 'border-slate-200 text-slate-400 hover:text-slate-500 hover:border-slate-300'}`}>
              <Plus size={10} /> Column
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
