'use client'

export function ProgressBar({
  value,
  max = 100,
  label,
  color = '#e39f3c',
}: {
  value: number
  max?: number
  label?: string
  color?: string
}) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">{label}</span>
          <span className="text-sm font-medium" style={{ color }}>{percentage}%</span>
        </div>
      )}
      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
