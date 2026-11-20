import { useMemo } from 'react';
import { SongCard } from '../components/SongCard';
import { EmptyState, SectionHeader, SwitchRow } from '../components/ui';
import { RECOMMENDATION_CONFIG } from '../constants/config';
import { formatNoteRange } from '../constants/notes';
import { useAppState } from '../state/AppStateContext';
import { recommendSongs } from '../utils/recommender';
import { buildTroublesomeRanges } from '../utils/singabilityScore';

export function RecommendView() {
  const { songs, data, genres, loadingSongs, songLoadError, setSelectedGenres, updateSettings, setGlobalOctaveShift } =
    useAppState();
  const { settings, userSongRecords, scoreHistory } = data;
  const selectedGenres = settings.selectedGenres;

  const troublesomeRanges = useMemo(
    () => buildTroublesomeRanges(songs, userSongRecords, settings),
    [songs, userSongRecords, settings],
  );

  const recommendations = useMemo(
    () =>
      recommendSongs({
        songs,
        userRecords: userSongRecords,
        settings,
        scoreHistory,
        troublesomeRanges,
      }),
    [songs, userSongRecords, settings, scoreHistory, troublesomeRanges],
  );

  const selectedSet = useMemo(() => new Set(selectedGenres), [selectedGenres]);
  const totalWeight =
    RECOMMENDATION_CONFIG.SELECTED_GENRE_WEIGHT + RECOMMENDATION_CONFIG.NON_SELECTED_GENRE_WEIGHT;
  const selectedPercent = Math.round(
    (RECOMMENDATION_CONFIG.SELECTED_GENRE_WEIGHT / totalWeight) * 100,
  );
  const octaveDown = settings.defaultOctaveShift <= -12;

  const toggleGenre = (genre: string) => {
    if (selectedSet.has(genre)) {
      setSelectedGenres(selectedGenres.filter((item) => item !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  return (
    <div className="space-y-6">
      <section className="app-card p-4">
        <SectionHeader title="いまの歌声" hint="あなたの基準音域と歌唱設定" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted">あなたの音域</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">
              {formatNoteRange(settings.comfortableLowestNote, settings.comfortableHighestNote)}
            </p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
            歌唱基準: <span className="font-bold text-accent">{octaveDown ? 'オク下 (-12)' : '原キー (0)'}</span>
          </div>
        </div>
        <div className="divider mt-4 pt-4">
          <SwitchRow
            label="オク下（-12）基準で歌う"
            hint="推薦キーと歌唱音域に反映されます（全曲共通）"
            checked={octaveDown}
            onChange={(checked) => setGlobalOctaveShift(checked ? -12 : 0)}
          />
        </div>
      </section>

      <section className="app-card p-4">
        <SectionHeader
          title="優先ジャンル"
          hint={`最大 ${RECOMMENDATION_CONFIG.MAX_SELECTED_GENRES} つまで選択できます`}
          action={
            <span className="text-xs font-semibold text-muted">
              {selectedGenres.length} / {RECOMMENDATION_CONFIG.MAX_SELECTED_GENRES}
            </span>
          }
        />
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <button
              key={genre}
              type="button"
              className="chip"
              aria-pressed={selectedSet.has(genre)}
              onClick={() => toggleGenre(genre)}
            >
              {genre}
            </button>
          ))}
          {genres.length === 0 && <p className="text-xs text-muted">ジャンルを読み込み中です…</p>}
        </div>
        <p className="info-note mt-3">
          推薦比率は <strong>選択ジャンル {RECOMMENDATION_CONFIG.SELECTED_GENRE_WEIGHT} : 非選択 {RECOMMENDATION_CONFIG.NON_SELECTED_GENRE_WEIGHT}</strong>。
          選択ジャンルの曲が全体の約 {selectedPercent}% を目安に選ばれます。
        </p>
      </section>

      <section>
        <SectionHeader
          title="あなたへの推薦"
          hint="歌える度スコアと感触から算出しています"
          action={
            <label className="flex items-center gap-2 text-xs text-muted">
              表示件数
              <select
                className="select w-auto py-1 text-xs"
                aria-label="推薦の表示件数"
                value={settings.recommendationLimit}
                onChange={(event) => updateSettings({ recommendationLimit: Number(event.target.value) })}
              >
                {[5, 10, 15, 20].map((count) => (
                  <option key={count} value={count}>
                    {count} 件
                  </option>
                ))}
              </select>
            </label>
          }
        />

        {songLoadError && <p className="mb-3 text-sm text-[var(--bad)]">{songLoadError}</p>}

        {loadingSongs ? (
          <div className="app-card-flat px-4 py-8 text-center text-sm text-muted">読み込み中…</div>
        ) : recommendations.length === 0 ? (
          <EmptyState title="推薦できる曲がありません" description="曲を追加するか、表示件数を増やしてみてください。" />
        ) : (
          <div className="space-y-3">
            {recommendations.map((item) => (
              <SongCard
                key={item.song.id}
                song={item.song}
                record={userSongRecords[item.song.id]}
                settings={settings}
                scoreHistory={scoreHistory}
                troublesomeRanges={troublesomeRanges}
                score={item}
                mode="recommend"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
