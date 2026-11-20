import { COMFORT_LEVELS, COMFORT_SHORT_LABELS } from '../constants/config';
import type { ComfortLevel } from '../types/karaoke';

/** 曲の感触を記録するコンパクトなボタン群。 */
export function ComfortPicker({
  value,
  onChange,
  label = '感触を記録',
}: {
  value: ComfortLevel;
  onChange: (comfort: ComfortLevel) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {COMFORT_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          className="comfort-btn"
          data-level={level}
          aria-label={COMFORT_SHORT_LABELS[level]}
          aria-pressed={value === level}
          onClick={() => onChange(level)}
        >
          {COMFORT_SHORT_LABELS[level]}
        </button>
      ))}
    </div>
  );
}
