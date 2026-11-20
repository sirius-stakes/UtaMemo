import { useState, type FormEvent } from 'react';
import { useAppState } from '../state/AppStateContext';
import { Modal, NoteSelect } from './ui';

export function AddSongModal({
  open,
  onClose,
  genres,
}: {
  open: boolean;
  onClose: () => void;
  genres: readonly string[];
}) {
  const { addSong } = useAppState();
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [lowestNote, setLowestNote] = useState(55);
  const [highestNote, setHighestNote] = useState(72);
  const [dam, setDam] = useState(true);
  const [joysound, setJoysound] = useState(true);
  const [listenUrl, setListenUrl] = useState('');
  const [lyricsUrl, setLyricsUrl] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setArtist('');
    setGenre('');
    setLowestNote(55);
    setHighestNote(72);
    setDam(true);
    setJoysound(true);
    setListenUrl('');
    setLyricsUrl('');
    setMemo('');
    setError('');
  };

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
    addSong({
      title,
      artist,
      genre,
      lowestNote,
      highestNote,
      dam,
      joysound,
      listenUrl: listenUrl.trim() || undefined,
      lyricsUrl: lyricsUrl.trim() || undefined,
      memo: memo.trim() || undefined,
    });
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="曲を追加">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="song-title">
              曲名 <span className="text-accent">*</span>
            </label>
            <input
              id="song-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例: 群青"
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="song-artist">
              アーティスト <span className="text-accent">*</span>
            </label>
            <input
              id="song-artist"
              className="input"
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              placeholder="例: YOASOBI"
              required
            />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="song-genre">
            ジャンル
          </label>
          <input
            id="song-genre"
            className="input"
            list="genre-options"
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
            placeholder="例: J-POP（空欄時は「その他」）"
          />
          <datalist id="genre-options">
            {genres.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="field-label">最低音</p>
            <NoteSelect value={lowestNote} onChange={setLowestNote} label="最低音を選択" />
          </div>
          <div>
            <p className="field-label">最高音</p>
            <NoteSelect value={highestNote} onChange={setHighestNote} label="最高音を選択" />
          </div>
        </div>

        <div>
          <p className="field-label">配信機種</p>
          <div className="flex flex-wrap gap-4 rounded-xl bg-surface-2 px-3 py-2.5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={dam} onChange={(event) => setDam(event.target.checked)} />
              DAM
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={joysound}
                onChange={(event) => setJoysound(event.target.checked)}
              />
              JOYSOUND
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="song-listen">
              視聴URL（任意）
            </label>
            <input
              id="song-listen"
              className="input"
              type="url"
              value={listenUrl}
              onChange={(event) => setListenUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="field-label" htmlFor="song-lyrics">
              歌詞URL（任意）
            </label>
            <input
              id="song-lyrics"
              className="input"
              type="url"
              value={lyricsUrl}
              onChange={(event) => setLyricsUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="song-memo">
            歌ってみたメモ（任意）
          </label>
          <textarea
            id="song-memo"
            className="textarea"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="キー調整の目安など"
          />
        </div>

        {error && <p className="text-sm font-semibold text-[var(--bad)]">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary">
            追加する
          </button>
        </div>
      </form>
    </Modal>
  );
}
