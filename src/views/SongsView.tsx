import { useMemo, useState } from 'react';
import { AddSongModal } from '../components/AddSongModal';
import { SongCard } from '../components/SongCard';
import { EmptyState, SectionHeader, Segmented, SwitchRow, type SegmentOption } from '../components/ui';
import { COMFORT_LEVELS, COMFORT_LABELS } from '../constants/config';
import { useAppState } from '../state/AppStateContext';
import type { ComfortLevel, KaraokeSystem } from '../types/karaoke';
import { buildTroublesomeRanges } from '../utils/singabilityScore';
import { getEffectiveRange } from '../utils/rangeEstimator';
import { SearchIcon, PlusIcon } from '../components/icons';

type SystemFilter = 'ALL' | KaraokeSystem;
type ComfortFilter = 'ALL' | ComfortLevel;

const SYSTEM_OPTIONS: readonly SegmentOption<SystemFilter>[] = [
  { value: 'ALL', label: 'すべて' },
  { value: 'DAM', label: 'DAM' },
  { value: 'JOYSOUND', label: 'JOYSOUND' },
];

export function SongsView() {
  const { songs, genres, data, loadingSongs, songLoadError } = useAppState();
  const { settings, userSongRecords, scoreHistory } = data;
  const [query, setQuery] = useState('');
  const [systemFilter, setSystemFilter] = useState<SystemFilter>('ALL');
  const [comfortFilter, setComfortFilter] = useState<ComfortFilter>('ALL');
  const [onlyInRange, setOnlyInRange] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const troublesomeRanges = useMemo(
    () => buildTroublesomeRanges(songs, userSongRecords, settings),
    [songs, userSongRecords, settings],
  );

  const filteredSongs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return songs.filter((song) => {
      if (
        keyword &&
        !song.title.toLowerCase().includes(keyword) &&
        !song.artist.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      if (systemFilter === 'DAM' && !song.availability.dam) return false;
      if (systemFilter === 'JOYSOUND' && !song.availability.joysound) return false;
      const comfort = userSongRecords[song.id]?.comfort ?? 'unrated';
      if (comfortFilter !== 'ALL' && comfort !== comfortFilter) return false;
      if (onlyInRange) {
        const { lowestNote, highestNote } = getEffectiveRange(song, userSongRecords[song.id], settings);
        if (
          lowestNote < settings.comfortableLowestNote ||
          highestNote > settings.comfortableHighestNote
        ) {
          return false;
        }
      }
      return true;
    });
  }, [songs, query, systemFilter, comfortFilter, onlyInRange, userSongRecords, settings]);

  return (
    <div className="space-y-6">
      <section className="app-card p-4">
        <SectionHeader
          title="曲をさがす"
          hint={`全 ${songs.length} 曲（うち追加曲 ${songs.filter((song) => song.isCustom).length} 曲）`}
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
              <PlusIcon className="h-4 w-4" />
              曲を追加
            </button>
          }
        />

        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            className="input pl-9"
            type="search"
            aria-label="曲名・アーティストで検索"
            placeholder="曲名・アーティストで検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="field-label">配信機種</p>
            <Segmented
              options={SYSTEM_OPTIONS}
              value={systemFilter}
              onChange={setSystemFilter}
              label="配信機種で絞り込む"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:items-center">
            <div>
              <label className="field-label" htmlFor="comfort-filter">
                感触
              </label>
              <select
                id="comfort-filter"
                className="select"
                value={comfortFilter}
                onChange={(event) => setComfortFilter(event.target.value as ComfortFilter)}
              >
                <option value="ALL">すべて</option>
                {COMFORT_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {COMFORT_LABELS[level]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:pt-5">
              <SwitchRow
                label="音域内の曲のみ表示"
                checked={onlyInRange}
                onChange={setOnlyInRange}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="検索結果" hint={`${filteredSongs.length} 件`} />

        {songLoadError && <p className="mb-3 text-sm text-[var(--bad)]">{songLoadError}</p>}

        {loadingSongs ? (
          <div className="app-card-flat px-4 py-8 text-center text-sm text-muted">読み込み中…</div>
        ) : filteredSongs.length === 0 ? (
          <EmptyState
            title="条件に合う曲がありません"
            description="検索語やフィルタを変更するか、新しい曲を追加してください。"
          />
        ) : (
          <div className="space-y-3">
            {filteredSongs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                record={userSongRecords[song.id]}
                settings={settings}
                scoreHistory={scoreHistory}
                troublesomeRanges={troublesomeRanges}
                mode="list"
              />
            ))}
          </div>
        )}
      </section>

      <AddSongModal open={addOpen} onClose={() => setAddOpen(false)} genres={genres} />
    </div>
  );
}
