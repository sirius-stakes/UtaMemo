import { useMemo, useState } from 'react';
import { COMFORT_LABELS } from '../constants/config';
import { formatNoteRange } from '../constants/notes';
import { useAppState } from '../state/AppStateContext';
import type { ScoreRecord, Song, UserSettings, UserSongRecord } from '../types/karaoke';
import { formatKeyShift } from '../utils/format';
import { getEffectiveRange } from '../utils/rangeEstimator';
import { scoreSong, type SingabilityResult, type TroubleRange } from '../utils/singabilityScore';
import { ComfortPicker } from './ComfortPicker';
import { ChevronDownIcon, ExternalIcon } from './icons';
import { Badge } from './ui';

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-card-flat px-3 py-2">
      <p className="text-[0.65rem] font-semibold text-faint">{label}</p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}

export function SongCard({
  song,
  record,
  settings,
  scoreHistory,
  troublesomeRanges = [],
  score,
  mode,
}: {
  song: Song;
  record?: UserSongRecord;
  settings: UserSettings;
  scoreHistory: readonly ScoreRecord[];
  troublesomeRanges?: readonly TroubleRange[];
  score?: SingabilityResult;
  mode: 'recommend' | 'list';
}) {
  const { setComfort, setSongKeyShift } = useAppState();
  const [showReasons, setShowReasons] = useState(false);

  const result = useMemo(
    () =>
      score ??
      scoreSong({
        song,
        settings,
        record,
        scoreHistory,
        troublesomeRanges,
      }),
    [score, song, settings, record, scoreHistory, troublesomeRanges],
  );

  const comfort = record?.comfort ?? 'unrated';
  const effective = getEffectiveRange(song, record, settings);
  const fineShift = record?.keyShift ?? settings.defaultKeyShift;
  const octaveDown = (record?.octaveShift ?? settings.defaultOctaveShift) < 0;
  const links = song.links;

  return (
    <article className="app-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.98rem] font-bold leading-snug">{song.title}</h3>
          <p className="mt-0.5 truncate text-xs text-muted">{song.artist}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {song.availability.dam && <Badge tone="dam">DAM</Badge>}
          {song.availability.joysound && <Badge tone="joy">JOYSOUND</Badge>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="genre">{song.genre}</Badge>
        <Badge tone={comfort}>{COMFORT_LABELS[comfort]}</Badge>
        {octaveDown && <Badge tone="unrated">オク下</Badge>}
        {song.isCustom && <Badge tone="unrated">追加曲</Badge>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <InfoCell label="原曲音域" value={formatNoteRange(song.lowestNote, song.highestNote)} />
        <InfoCell label="推奨キー" value={formatKeyShift(effective.shift)} />
        <InfoCell label="歌唱音域" value={result.rangeLabel} />
      </div>

      <div className="mt-3 rounded-xl bg-surface-2 p-3">
        <div className="flex items-center gap-3">
          <span className="rank-badge" data-rank={result.rank}>
            {result.rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold">歌える度 {result.score}</span>
              <span className="text-xs text-muted">{result.label}</span>
            </div>
            <div className="score-track mt-2">
              <div className="score-fill" style={{ width: `${result.score}%` }} />
            </div>
          </div>
        </div>

        {mode === 'recommend' && (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-2"
              aria-expanded={showReasons}
              onClick={() => setShowReasons((prev) => !prev)}
            >
              判定理由
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform ${showReasons ? 'rotate-180' : ''}`}
              />
            </button>
            {showReasons && (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">
                {result.reasons.map((reason, index) => (
                  <li key={`${reason}-${index}`}>{reason}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="divider mt-3 pt-3">
        <p className="field-label">この曲の感触</p>
        <ComfortPicker value={comfort} onChange={(level) => setComfort(song.id, level)} />
        <div className="mt-3 flex items-center gap-2">
          <span className="mr-auto text-xs text-muted">キー調整</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm w-9"
            aria-label="キーを下げる"
            onClick={() => setSongKeyShift(song.id, fineShift - 1)}
          >
            −
          </button>
          <span className="w-12 text-center text-sm font-bold">{formatKeyShift(fineShift)}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm w-9"
            aria-label="キーを上げる"
            onClick={() => setSongKeyShift(song.id, fineShift + 1)}
          >
            ＋
          </button>
        </div>
      </div>

      {(links?.listenUrl || links?.lyricsUrl || song.utattemitaMemo) && (
        <div className="divider mt-3 pt-3">
          <div className="flex flex-wrap gap-4">
            {links?.listenUrl && (
              <a
                className="external-link"
                href={links.listenUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                視聴する
                <ExternalIcon className="h-3.5 w-3.5" />
              </a>
            )}
            {links?.lyricsUrl && (
              <a
                className="external-link"
                href={links.lyricsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                歌詞を確認
                <ExternalIcon className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {song.utattemitaMemo && (
            <p className="mt-2 text-xs italic text-muted">メモ: {song.utattemitaMemo}</p>
          )}
        </div>
      )}
    </article>
  );
}
