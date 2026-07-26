import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, Shapes, Tag } from 'lucide-react'
import { FIELD_LABEL } from '@shared/field-icons'
import { formatFieldValue } from '@shared/format'
import type { FieldConfig, FieldKey, PhotoMetadata } from '@shared/types'
import { fieldIcon } from '../lib/field-icons'

/**
 * Campos do carimbo: **arrastar reordena** a lista vertical (RF-04) e os botões ligam/desligam
 * o campo, o ícone e o rótulo. A ordem daqui é a ordem do array `section.fields`.
 */
export default function FieldList({
  fields,
  photo,
  onReorder,
  onPatch
}: {
  fields: FieldConfig[]
  photo: PhotoMetadata
  onReorder: (from: number, to: number) => void
  onPatch: (key: FieldKey, patch: Partial<Omit<FieldConfig, 'key'>>) => void
}): React.JSX.Element {
  const sensors = useSensors(
    // 4px de tolerância: clique nos botões não vira arrasto
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const from = fields.findIndex((field) => field.key === active.id)
    const to = fields.findIndex((field) => field.key === over.id)
    if (from !== -1 && to !== -1) onReorder(from, to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1">
          {fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={formatFieldValue(field.key, photo)}
              onPatch={onPatch}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function FieldRow({
  field,
  value,
  onPatch
}: {
  field: FieldConfig
  value: string | null
  onPatch: (key: FieldKey, patch: Partial<Omit<FieldConfig, 'key'>>) => void
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.key })
  const Icon = fieldIcon(field.key)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
        isDragging
          ? 'z-10 border-sky-400 bg-sky-500/10 shadow-lg'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40'
      } ${field.visible ? '' : 'opacity-50'}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Arrastar para reordenar"
        className="cursor-grab text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <Icon className="size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-700 dark:text-slate-200">
          {FIELD_LABEL[field.key]}
        </p>
        <p
          className={`truncate font-mono text-[10px] ${
            value ? 'text-slate-400 dark:text-slate-500' : 'text-amber-600 dark:text-amber-500'
          }`}
        >
          {value ?? 'sem dado nesta foto'}
        </p>
      </div>

      <Toggle
        active={field.showIcon}
        onClick={() => onPatch(field.key, { showIcon: !field.showIcon })}
        title={field.showIcon ? 'Ocultar ícone' : 'Mostrar ícone'}
      >
        <Shapes className="size-3.5" aria-hidden />
      </Toggle>

      <Toggle
        active={field.showLabel}
        onClick={() => onPatch(field.key, { showLabel: !field.showLabel })}
        title={field.showLabel ? 'Ocultar rótulo' : 'Mostrar rótulo'}
      >
        <Tag className="size-3.5" aria-hidden />
      </Toggle>

      <Toggle
        active={field.visible}
        onClick={() => onPatch(field.key, { visible: !field.visible })}
        title={field.visible ? 'Não carimbar este campo' : 'Carimbar este campo'}
      >
        {field.visible ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
      </Toggle>
    </li>
  )
}

function Toggle({
  active,
  title,
  onClick,
  children
}: {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`rounded p-1 ${
        active
          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
      }`}
    >
      {children}
    </button>
  )
}
