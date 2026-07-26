/** Barra de progresso do lote (RF-09). `value` em fração (0..1). */
export default function ProgressBar({
  value,
  label
}: {
  value: number
  label: string
}): React.JSX.Element {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100)

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
    >
      <div
        className="h-full rounded-full bg-sky-600 transition-[width] duration-200 dark:bg-sky-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
