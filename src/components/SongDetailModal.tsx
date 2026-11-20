import { useMemo, useState, type FormEvent } from 'react';
import { COMFORT_LABELS } from '../constants/config';
import { formatNoteRange } from '../constants/notes';
import { useAppState } from '../state/AppStateContext';
import type { KaraokeSystem, ScoreRecord, Song } from '../types/karaoke';
import { formatDate, formatKeyShift } from '../utils/format';
import { buildTroublesomeRanges, scoreSong } from '../utils/singabilityScore';
import { ComfortPicker } from './ComfortPicker';
import { ExternalIcon } from './icons';
import { Badge, EmptyState, Modal, NoteSelect, Segmented, type SegmentOption } from './ui';

const SYSTEM_OPTIONS: readonly SegmentOption<KaraokeSystem>[] = [
  { value: 'DAM', label: 'DAM' },
  { value: 'JOYSOUND', label: 'JOYSOUND' },
];

/** date 入力用の今日の日付（ローカルタイム）を返す。 */
function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** 採点推移の簡易折れ線グラフ（SVG）。 */
function ScoreTrend({ records }: { records: readonly ScoreRecord[] }) {
  const sorted = useMemo(
    () => [...records].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
    [records],
  );

  if (sorted.length === 0) {
    return <EmptyState title="点数推移はまだありません" description="採点を記録すると推移が表示されます。" />;
  }

  const width = 320;
  const height = 96;
  const padX = 12;
  const padY = 8;
  const guideY = (score: number) => padY + ((100 - score) / 100) * (height - padY * 2);
  const points = sorted.map((record, index) => ({
    x:
      sorted.length === 1
        ? width / 2
        : padX + (index * (width - padX * 2)) / (sorted.length - 1),
    y: guideY(record.score),
  }));
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className="rounded-xl bg-surface-2 p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="採点の推移グラフ">
        {[0, 50, 100].map((score) => (
          <g key={score}>
            <line
              x1={padX}
              x2={width - padX}
              y1={guideY(score)}
              y2={guideY(score)}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text x={0} y={guideY(score) + 3} fontSize={8} fill="var(--faint)">
              {score}
            </text>
          </g>
        ))}
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((point, index) => (
          <circle
            key={sorted[index].id}
            cx={point.x}
            cy={point.y}
            r={3.2}
            fill="var(--surface)"
            stroke="var(--accent)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="flex justify-between px-2 text-[0.65rem] text-faint">
        <span>{formatDate(sorted[0].recordedAt)}</span>
        <span>{formatDate(sorted[sorted.length - 1].recordedAt)}</span>
      </div>
    </div>
  );
}

/** 採点記録の追加フォーム。 */
function ScoreForm({
  songId,
  defaultKeyShift,
  defaultSystem,
}: {
  songId: string;
  defaultKeyShift: number;
  defaultSystem: KaraokeSystem;
}) {
  const { addScoreRecord } = useAppState();
  const [system, setSystem] = useState<KaraokeSystem>(defaultSystem);
  const [score, setScore] = useState('');
  const [date, setDate] = useState(todayInputValue);
  const [keyShift, setKeyShift] = useState(String(defaultKeyShift));
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numeric = Number(score);
    if (score.trim() === '' || !Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
      setError('点数は 0〜100 で入力してください。');
      return;
    }
    const recordedAt = date ? new Date(`${date}T12:00:00`) : new Date();
    if (Number.isNaN(recordedAt.getTime())) {
      setError('日付を正しく入力してください。');
      return;
    }
    const shift = Number(keyShift);
    addScoreRecord({
      songId,
      score: numeric,
      recordedAt: recordedAt.toISOString(),
      system,
      keyShift: Number.isFinite(shift) ? shift : 0,
      memo,
    });
    setScore('');
    setMemo('');
    setDate(todayInputValue());
    setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <p className="field-label">機種</p>
        <Segmented
          options={SYSTEM_OPTIONS}
          value={system}
          onChange={setSystem}
          label="採点した機種を選択"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="detail-score">
            点数 <span className="text-accent">*</span>
          </label>
          <input
            id="detail-score"
            className="input"
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            value={score}
            onChange={(event) => setScore(event.target.value)}
            placeholder="例: 88"
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="detail-score-date">
            歌唱日
          </label>
          <input
            id="detail-score-date"
            className="input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="detail-score-key">
          使用キー（半音: -12 〜 +12）
        </label>
        <input
          id="detail-score-key"
          className="input"
          type="number"
          min={-12}
          max={12}
          step={1}
          value={keyShift}
          onChange={(event) => setKeyShift(event.target.value)}
        />
        <p className="mt-1 text-xs text-faint">{formatKeyShift(Number(keyShift))} で歌った記録として保存します。</p>
      </div>
      <div>
        <label className="field-label" htmlFor="detail-score-memo">
          メモ（任意）
        </label>
        <textarea
          id="detail-score-memo"
          className="textarea"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="調子が良かったパートなど"
        />
      </div>
      {error && <p className="text-sm font-semibold text-[var(--bad)]">{error}</p>}
      <button type="submit" className="btn btn-primary btn-sm">
        採点を保存する
      </button>
    </form>
  );
}

/** 採点履歴一覧（新しい順・削除可能）。 */
function ScoreHistory({ records }: { records: readonly ScoreRecord[] }) {
  const { deleteScoreRecord } = useAppState();
  const sorted = useMemo(
    () => [...records].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    [records],
  );

  if (sorted.length === 0) {
    return <EmptyState title="採点履歴はまだありません" description="上のフォームから記録を追加してください。" />;
  }

  return (
    <ol className="space-y-2">
      {sorted.map((record) => (
        <li key={record.id} className="app-card-flat flex items-center gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{formatDate(record.recordedAt)}</span>
              {record.system && <Badge tone={record.system === 'DAM' ? 'dam' : 'joy'}>{record.system}</Badge>}
              <span className="text-xs text-muted">
                キー {record.keyShift === undefined ? '-' : formatKeyShift(record.keyShift)}
              </span>
            </div>
            {record.memo && <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{record.memo}</p>}
          </div>
          <span className="text-lg font-extrabold text-accent">{record.score}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={`${formatDate(record.recordedAt)} の採点記録を削除`}
            onClick={() => deleteScoreRecord(record.id)}
          >
            削除
          </button>
        </li>
      ))}
    </ol>
  );
}

/** 楽曲情報（音域・配信・URL・メモ）の編集フォーム。 */
function SongEditForm({ song, onDone }: { song: Song; onDone: () => void }) {
  const { updateSong, deleteSong, closeSongDetail } = useAppState();
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [genre, setGenre] = useState(song.genre);
  const [lowestNote, setLowestNote] = useState(song.lowestNote);
  const [highestNote, setHighestNote] = useState(song.highestNote);
  const [dam, setDam] = useState(song.availability.dam);
  const [joysound, setJoysound] = useState(song.availability.joysound);
  const [listenUrl, setListenUrl] = useState(song.links?.listenUrl ?? '');
  const [lyricsUrl, setLyricsUrl] = useState(song.links?.lyricsUrl ?? '');
  const [memo, setMemo] = useState(song.utattemitaMemo ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !artist.trim()) {
      setError('曲名とアーティストを入力してください。');
      return;
    }
    if (lowestNote > highestNote) {
      setError('最低音は最高音以下にしてください。');
      return;
    }
    if (!dam && !joysound) {
      setError('配信機種を少なくとも1つ選択してください。');
      return;
    }
    const links =
      listenUrl.trim() || lyricsUrl.trim()
        ? {
            listenUrl: listenUrl.trim() || undefined,
            lyricsUrl: lyricsUrl.trim() || undefined,
          }
        : undefined;
    updateSong(song.id, {
      title: title.trim(),
      artist: artist.trim(),
      genre: genre.trim() || 'その他',
      lowestNote,
      highestNote,
      availability: { dam, joysound },
      links,
      utattemitaMemo: memo.trim() || undefined,
    });
    onDone();
  };

  const handleDelete = () => {
    if (!window.confirm(`「${song.title}」を削除しますか？この曲の記録と採点履歴も削除されます。`)) return;
    deleteSong(song.id);
    closeSongDetail();
  };

  return (
    <form onSubmit={handleSubmit} className="app-card-flat space-y-3 p-3">
      <h4 className="text-sm font-bold">楽曲情報を編集</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="edit-song-title">
            曲名
          </label>
          <input id="edit-song-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-song-artist">
            アーティスト
          </label>
          <input
            id="edit-song-artist"
            className="input"
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="edit-song-genre">
          ジャンル
        </label>
        <input id="edit-song-genre" className="input" value={genre} onChange={(event) => setGenre(event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="field-label">最低音</p>
          <NoteSelect value={lowestNote} onChange={setLowestNote} label="編集する最低音を選択" />
        </div>
        <div>
          <p className="field-label">最高音</p>
          <NoteSelect value={highestNote} onChange={setHighestNote} label="編集する最高音を選択" />
        </div>
      </div>
      <div>
        <p className="field-label">配信機種</p>
        <div className="flex flex-wrap gap-4 rounded-xl bg-surface px-3 py-2.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={dam} onChange={(event) => setDam(event.target.checked)} />
            DAM
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={joysound} onChange={(event) => setJoysound(event.target.checked)} />
            JOYSOUND
          </label>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="edit-song-listen">
            視聴URL
          </label>
          <input
            id="edit-song-listen"
            className="input"
            type="url"
            value={listenUrl}
            onChange={(event) => setListenUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-song-lyrics">
            歌詞確認URL
          </label>
          <input
            id="edit-song-lyrics"
            className="input"
            type="url"
            value={lyricsUrl}
            onChange={(event) => setLyricsUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="edit-song-memo">
          歌ってみた参照メモ
        </label>
        <textarea
          id="edit-song-memo"
          className="textarea"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="キー調整の目安など"
        />
      </div>
      {error && <p className="text-sm font-semibold text-[var(--bad)]">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {song.isCustom ? (
          <button type="button" className="btn btn-ghost btn-sm text-[var(--bad)]" onClick={handleDelete}>
            この追加曲を削除
          </button>
        ) : (
          <span className="text-xs text-faint">静的マスター曲の編集内容はこの端末に保存されます。</span>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onDone}>
            閉じる
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            保存する
          </button>
        </div>
      </div>
    </form>
  );
}

/** モーダル本体の内容（曲切り替え時に状態をリセットするため key で管理）。 */
function SongDetailContent({ song }: { song: Song }) {
  const { songs, data, setComfort, setSongKeyShift, setSongOctaveShift } = useAppState();
  const { settings, userSongRecords, scoreHistory } = data;
  const [editOpen, setEditOpen] = useState(false);

  const record = userSongRecords[song.id];
  const comfort = record?.comfort ?? 'unrated';
  const keyShift = record?.keyShift ?? settings.defaultKeyShift;
  const octaveShift = record?.octaveShift ?? settings.defaultOctaveShift;
  const totalShift = octaveShift + keyShift;

  const troublesomeRanges = useMemo(
    () => buildTroublesomeRanges(songs, userSongRecords, settings),
    [songs, userSongRecords, settings],
  );
  const result = useMemo(
    () =>
      scoreSong({
        song,
        settings,
        record,
        scoreHistory,
        troublesomeRanges,
        appliedShift: totalShift,
      }),
    [song, settings, record, scoreHistory, troublesomeRanges, totalShift],
  );
  const myScores = useMemo(
    () => scoreHistory.filter((item) => item.songId === song.id),
    [scoreHistory, song.id],
  );
  const best = useMemo(
    () => (myScores.length > 0 ? myScores.reduce((a, b) => (b.score > a.score ? b : a)) : null),
    [myScores],
  );
  const average = myScores.length > 0
    ? Math.round(myScores.reduce((sum, item) => sum + item.score, 0) / myScores.length)
    : null;

  const applyPreset = (octave: number) => {
    setSongOctaveShift(song.id, octave);
    setSongKeyShift(song.id, 0);
  };

  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-lg font-bold leading-snug">{song.title}</h3>
        <p className="mt-0.5 text-sm text-muted">{song.artist}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="genre">{song.genre}</Badge>
          <Badge tone={comfort}>{COMFORT_LABELS[comfort]}</Badge>
          {song.availability.dam && <Badge tone="dam">DAM</Badge>}
          {song.availability.joysound && <Badge tone="joy">JOYSOUND</Badge>}
          {song.isCustom && <Badge tone="unrated">追加曲</Badge>}
        </div>
      </section>

      <section className="divider pt-4">
        <h3 className="field-label">この曲の感触（ワンタップで記録）</h3>
        <ComfortPicker
          value={comfort}
          onChange={(level) => setComfort(song.id, level)}
          label="この曲の感触を記録"
          fullLabels
        />
        <p className="mt-2 text-xs text-muted">現在の記録: {COMFORT_LABELS[comfort]}</p>
      </section>

      <section className="divider pt-4">
        <h3 className="field-label">キー変更・オク下シミュレーション</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="chip"
            aria-pressed={octaveShift === 0}
            onClick={() => applyPreset(0)}
          >
            原キー（0）
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={octaveShift <= -12}
            onClick={() => applyPreset(-12)}
          >
            オク下（-12）
          </button>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">細かいキー調整</span>
            <span className="font-bold text-accent">{formatKeyShift(keyShift)}</span>
          </div>
          <input
            className="mt-2 w-full"
            type="range"
            min={-6}
            max={6}
            step={1}
            value={keyShift}
            aria-label="キーシフト（-6 〜 +6）"
            onChange={(event) => setSongKeyShift(song.id, Number(event.target.value))}
          />
          <div className="flex justify-between text-[0.65rem] text-faint">
            <span>-6</span>
            <span>原キー</span>
            <span>+6</span>
          </div>
        </div>
        <div className="app-card-flat mt-3 p-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-muted">歌唱音域（適用後）</p>
              <p className="font-bold">{result.rangeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted">原キーの音域</p>
              <p className="text-muted">{formatNoteRange(song.lowestNote, song.highestNote)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">適用シフト</p>
              <p className="font-bold">{formatKeyShift(totalShift)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
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
        </div>
      </section>

      <section className="divider pt-4">
        <h3 className="field-label">採点記録と推移</h3>
        <div className="grid grid-cols-3 gap-2">
          <div className="app-card-flat px-2 py-3 text-center">
            <p className="text-xl font-extrabold text-accent">{best?.score ?? '-'}</p>
            <p className="mt-0.5 text-[0.65rem] font-semibold text-muted">自己ベスト</p>
          </div>
          <div className="app-card-flat px-2 py-3 text-center">
            <p className="text-xl font-extrabold">{average ?? '-'}</p>
            <p className="mt-0.5 text-[0.65rem] font-semibold text-muted">平均点</p>
          </div>
          <div className="app-card-flat px-2 py-3 text-center">
            <p className="text-xl font-extrabold">{myScores.length}</p>
            <p className="mt-0.5 text-[0.65rem] font-semibold text-muted">記録回数</p>
          </div>
        </div>
        {best && (
          <p className="mt-2 text-xs text-muted">
            自己ベスト: {formatDate(best.recordedAt)} / {best.system ?? '機種未指定'} / キー{' '}
            {best.keyShift === undefined ? '-' : formatKeyShift(best.keyShift)}
          </p>
        )}
        <div className="mt-3">
          <ScoreTrend records={myScores} />
        </div>
        <div className="divider mt-4 pt-4">
          <p className="mb-2 text-sm font-bold">採点を記録</p>
          <ScoreForm
            songId={song.id}
            defaultKeyShift={Math.max(-12, Math.min(12, totalShift))}
            defaultSystem={settings.preferredSystem === 'JOYSOUND' ? 'JOYSOUND' : 'DAM'}
          />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-bold">採点履歴（新しい順）</p>
          <ScoreHistory records={myScores} />
        </div>
      </section>

      <section className="divider pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="field-label mb-0">外部リンク・歌みたメモ</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditOpen((prev) => !prev)}>
            {editOpen ? '編集を閉じる' : '編集する'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-4">
          {song.links?.listenUrl ? (
            <a
              className="external-link"
              href={song.links.listenUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              視聴する
              <ExternalIcon className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="text-xs text-faint">視聴URLは未設定です</span>
          )}
          {song.links?.lyricsUrl ? (
            <a
              className="external-link"
              href={song.links.lyricsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              歌詞を確認
              <ExternalIcon className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="text-xs text-faint">歌詞確認URLは未設定です</span>
          )}
        </div>
        <div className="app-card-flat mt-3 p-3">
          <p className="text-xs font-semibold text-muted">歌ってみた参照メモ</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {song.utattemitaMemo || 'まだメモはありません。「編集する」から登録できます。'}
          </p>
        </div>
        {editOpen && (
          <div className="mt-4">
            <SongEditForm song={song} onDone={() => setEditOpen(false)} />
          </div>
        )}
      </section>
    </div>
  );
}

/** 楽曲カードから開く詳細・記録モーダル。 */
export function SongDetailModal() {
  const { songs, detailSongId, closeSongDetail } = useAppState();
  const song = detailSongId === null ? undefined : songs.find((item) => item.id === detailSongId);

  if (!song) return null;

  return (
    <Modal open onClose={closeSongDetail} title="楽曲の詳細・記録">
      <SongDetailContent key={song.id} song={song} />
    </Modal>
  );
}
