import { Star } from 'lucide-react'
import { Button } from './ui/button'
export function Stars({ value, size = 14 }: { value: number | null; size?: number }) {
  return <span className="stars" role="img" aria-label={value === null ? '尚未评分' : `${value} 星，满分 5 星`}>
    {value !== null && Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} aria-hidden="true" className={i < value ? 'star-filled' : 'star-empty'} strokeWidth={1.4} />)}
  </span>
}
export function RatingInput({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return <fieldset className="rating-field"><legend className="field-label">星级评分 <span className="optional">可选</span></legend>
    <div className="rating-options">
      {[1, 2, 3, 4, 5].map(rating => <label className="rating-option" key={rating}>
        <input type="radio" name="rating" value={rating} checked={value === rating} onChange={() => onChange(rating)} aria-label={`${rating} 星`} />
        <Star aria-hidden="true" size={22} strokeWidth={1.5} className={value !== null && rating <= value ? 'star-filled' : 'star-empty'} />
      </label>)}
    </div><div className="rating-caption"><span>{value === null ? '未评分' : `${value} 星 / 5 星`}</span>{value !== null && <Button onClick={() => onChange(null)}>清除评分</Button>}</div>
  </fieldset>
}
