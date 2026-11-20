import { useState } from 'react';
import { CheckIcon } from '../components/icons';
import { Badge, EmptyState, NoteSelect, SectionHeader } from '../components/ui';
import { COMFORT_LEVELS, COMFORT_LABELS, PREFERRED_COMFORTS } from '../constants/config';
import { formatNoteRange, midiToScientificNote } from '../constants/notes';
import { useAppState } from '../state/AppStateContext';
import type { ComfortLevel } from '../types/karaoke';
import {
  estimateRangeFromSongs,
  estimateVocalRange,
  resolveDefaultShift,
  resolveSongShift,
  type RangeEstimate,
} from '../utils/rangeEstimator';

function EstimatePreview({
  estimate,
  applied,
  onApply,
}: {
  estimate: RangeEstimate;
  applied: boolean;
  onApply: () => void;
}) {
  return (
    <div className="app-card-flat mt-3 p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">推定結果</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight">
            {formatNoteRange(estimate.lowestNote, estimate.highestNote)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {estimate.consideredSongIds.length} 曲をもとに算出
            {estimate.consideredSongIds.length === 0 && '（対象曲なしのため現在の設定を保持）'}
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onApply}>
          <CheckIcon className="h-4 w-4" />
          推定結果を反映
        </button>
      </div>
      {applied && <p className="mt-2 text-xs font-semibold text-accent">音域を反映しました。</p>}
    </div>
  );
}

export function VocalRangeView() {
  const { songs, data, setVocalRange } = useAppState();
  const { settings, userSongRecords } = data;
  const [quickEstimate, setQuickEstimate] = useState<RangeEstimate | null>(null);
  const [builderEstimate, setBuilderEstimate] = useState<RangeEstimate | null>(null);
  const [applied, setApplied] = useState<'quick' | 'builder' | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [builderError, setBuilderError] = useState('');

  const selectableSongs = songs;

  const toggleSong = (songId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
    setBuilderError('');
  };

  const runQuickEstimate = () => {
    const result = estimateRangeFromSongs(songs, userSongRecords, settings, {
      comfortLevels: PREFERRED_COMFORTS,
    });
    setQuickEstimate(result);
    setApplied(null);
  };

  const runBuilderEstimate = () => {
    const selected = songs.filter((song) => selectedIds.has(song.id));
    if (selected.length === 0) {
      setBuilderError('推定に使う曲を1曲以上選択してください。');
      return;
    }
    const targets = selected.map((song) => ({
      song,
      shift: resolveSongShift(userSongRecords[song.id], resolveDefaultShift(settings)),
    }));
    const mergedRecords = { ...userSongRecords };
    const now = new Date().toISOString();
    for (const { song } of targets) {
      if (mergedRecords[song.id]) continue;
      mergedRecords[song.id] = {
        songId: song.id,
        comfort: 'good' as ComfortLevel,
        keyShift: 0,
        octaveShift: 0,
        updatedAt: now,
      };
    }
    const result = estimateVocalRange(targets, mergedRecords, {
      comfortLevels: COMFORT_LEVELS,
      fallbackRange: {
        lowestNote: settings.comfortableLowestNote,
        highestNote: settings.comfortableHighestNote,
      },
    });
    setBuilderEstimate(result);
    setApplied(null);
    setBuilderError('');
  };

  const applyEstimate = (estimate: RangeEstimate, kind: 'quick' | 'builder') => {
    setVocalRange(estimate.lowestNote, estimate.highestNote);
    setApplied(kind);
  };

  return (
    <div className="space-y-6">
      <section className="app-card p-4">
        <SectionHeader title="音域を手動で設定" hint="カラオケ表記で最低音と最高音を選びます" />
        <div className="rounded-xl bg-surface-2 px-4 py-5 text-center">
          <p className="text-xs font-semibold text-muted">現在の音域</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">
            {formatNoteRange(settings.comfortableLowestNote, settings.comfortableHighestNote)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {midiToScientificNote(settings.comfortableLowestNote)} 〜{' '}
            {midiToScientificNote(settings.comfortableHighestNote)}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="field-label">最低音</p>
            <NoteSelect
              value={settings.comfortableLowestNote}
              onChange={(note) => setVocalRange(note, settings.comfortableHighestNote)}
              label="最低音を選択"
            />
          </div>
          <div>
            <p className="field-label">最高音</p>
            <NoteSelect
              value={settings.comfortableHighestNote}
              onChange={(note) => setVocalRange(settings.comfortableLowestNote, note)}
              label="最高音を選択"
            />
          </div>
        </div>
      </section>

      <section className="app-card p-4">
        <SectionHeader
          title="歌いやすい曲から推定"
          hint="「上手に歌える」「歌える」の記録をもとに自動推定します"
        />
        <button type="button" className="btn btn-secondary" onClick={runQuickEstimate}>
          歌いやすい曲から音域を推定
        </button>
        {quickEstimate && (
          <EstimatePreview
            estimate={quickEstimate}
            applied={applied === 'quick'}
            onApply={() => applyEstimate(quickEstimate, 'quick')}
          />
        )}
      </section>

      <section className="app-card p-4">
        <SectionHeader
          title="曲を選んで推定"
          hint="チェックした曲の音域から推定します（記録のない曲は原曲音域を使用）"
          action={
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSelectedIds(new Set());
                setBuilderEstimate(null);
                setBuilderError('');
              }}
            >
              選択をクリア
            </button>
          }
        />

        {selectableSongs.length === 0 ? (
          <EmptyState title="曲がありません" description="楽曲一覧から曲を追加してください。" />
        ) : (
          <div className="thin-scroll max-h-72 space-y-1 overflow-y-auto rounded-xl border border-app bg-surface-2 p-1">
            {selectableSongs.map((song) => {
              const comfort = userSongRecords[song.id]?.comfort ?? 'unrated';
              return (
                <label
                  key={song.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(song.id)}
                    onChange={() => toggleSong(song.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{song.title}</span>
                    <span className="block truncate text-xs text-muted">{song.artist}</span>
                  </span>
                  <Badge tone={comfort}>{COMFORT_LABELS[comfort]}</Badge>
                </label>
              );
            })}
          </div>
        )}

        <button type="button" className="btn btn-secondary mt-3" onClick={runBuilderEstimate}>
          選択した曲で推定する
        </button>
        {builderError && <p className="mt-2 text-sm font-semibold text-[var(--bad)]">{builderError}</p>}
        {builderEstimate && (
          <EstimatePreview
            estimate={builderEstimate}
            applied={applied === 'builder'}
            onApply={() => applyEstimate(builderEstimate, 'builder')}
          />
        )}
      </section>
    </div>
  );
}
