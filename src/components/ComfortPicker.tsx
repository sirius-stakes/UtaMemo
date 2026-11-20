import { COMFORT_LABELS, COMFORT_LEVELS, COMFORT_SHORT_LABELS } from '../constants/config';
import type { ComfortLevel } from '../types/karaoke';

/** 曲の感触を記録するコンパクトなボタン群。 */
export function ComfortPicker({
  value,
  onChange,
  label = '感触を記録',
  fullLabels = false,
}: {
  value: ComfortLevel;
  onChange: (comfort: ComfortLevel) => void;
  label?: string;
  /** 詳細画面などで正式なラベル（「上手に歌える」等）を表示する。 */
  fullLabels?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {COMFORT_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          className="comfort-btn"
          data-level={level}
          aria-label={COMFORT_LABELS[level]}
          aria-pressed={value === level}
          onClick={() => onChange(level)}
        >
          {fullLabels ? COMFORT_LABELS[level] : COMFORT_SHORT_LABELS[level]}
        </button>
      ))}
    </div>
  );
}
