export function ReadingProgress({ value }: { value: number | null }) {
  return <div className="reading-progress" aria-label={value === null ? '阅读进度未记录' : `阅读进度 ${value}%`}>
    <span className="progress-track" role="progressbar" aria-label="阅读进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-valuetext={value === null ? '未记录' : `${value}%`}><span style={{ width: `${value ?? 0}%` }} /></span>
    <span className="progress-value" aria-hidden="true">{value === null ? '—' : `${value}%`}</span>
  </div>
}
