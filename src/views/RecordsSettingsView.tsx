import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { DownloadIcon, MoonIcon, SunIcon, UploadIcon } from '../components/icons';
import { EmptyState, SectionHeader, Segmented, SwitchRow, type SegmentOption } from '../components/ui';
import { formatDate } from '../utils/format';
import { useAppState } from '../state/AppStateContext';
import type { KaraokeSystem, UserSettings } from '../types/karaoke';

const THEME_OPTIONS: readonly SegmentOption<UserSettings['theme']>[] = [
  { value: 'light', label: 'ライト' },
  { value: 'system', label: 'システム' },
  { value: 'dark', label: 'ダーク' },
];

function SummaryCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="app-card-flat px-3 py-4 text-center">
      <p className="text-2xl font-extrabold tracking-tight text-accent">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

export function RecordsSettingsView() {
  const { songs, data, resolvedTheme, setTheme, exportBackup, importBackup } = useAppState();
  const { customSongs, userSongRecords, scoreHistory } = data;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const sungCount = useMemo(() => {
    const ids = new Set<string>();
    for (const [songId, record] of Object.entries(userSongRecords)) {
      if (record.comfort !== 'unrated') ids.add(songId);
    }
    for (const record of scoreHistory) ids.add(record.songId);
    return ids.size;
  }, [userSongRecords, scoreHistory]);

  const bestBySystem = useMemo(() => {
    const build = (system: KaraokeSystem) =>
      scoreHistory
        .filter((record) => record.system === system)
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((record) => ({
          record,
          song: songs.find((song) => song.id === record.songId),
        }));
    return { DAM: build('DAM'), JOYSOUND: build('JOYSOUND') };
  }, [scoreHistory, songs]);

  const handleImport = (json: string) => {
    const result = importBackup(json);
    if (result.success) {
      setMessage({ tone: 'ok', text: 'バックアップを復元しました。' });
      setImportText('');
    } else {
      setMessage({ tone: 'error', text: result.error });
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      handleImport(await file.text());
    } catch {
      setMessage({ tone: 'error', text: 'ファイルを読み込めませんでした。' });
    }
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      <section className="app-card p-4">
        <SectionHeader title="記録のサマリー" hint="この端末のブラウザに保存されているデータ" />
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard value={songs.length} label="登録曲数" />
          <SummaryCard value={sungCount} label="歌唱済み曲数" />
          <SummaryCard value={customSongs.length} label="追加曲" />
        </div>
      </section>

      <section>
        <SectionHeader title="自己ベスト" hint="採点履歴から機種別に最高得点を表示します" />
        <div className="grid gap-3 md:grid-cols-2">
          {(['DAM', 'JOYSOUND'] as const).map((system) => {
            const entries = bestBySystem[system];
            return (
              <div key={system} className="app-card p-4">
                <h3 className="mb-3 text-sm font-bold">
                  <span className={system === 'DAM' ? 'text-accent' : 'text-[var(--cyan)]'}>{system}</span>
                  <span className="text-muted"> の自己ベスト</span>
                </h3>
                {entries.length === 0 ? (
                  <EmptyState title="記録がありません" description="この機種の採点履歴はまだありません。" />
                ) : (
                  <ol className="space-y-2">
                    {entries.map(({ record, song }, index) => (
                      <li
                        key={record.id}
                        className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2"
                      >
                        <span className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-surface text-xs font-extrabold text-muted">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {song?.title ?? '削除された曲'}
                          </span>
                          <span className="block text-xs text-muted">
                            {formatDate(record.recordedAt)}
                            {record.keyShift !== undefined && ` / キー ${record.keyShift >= 0 ? '+' : ''}${record.keyShift}`}
                          </span>
                        </span>
                        <span className="text-lg font-extrabold text-accent">{record.score}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="app-card p-4">
        <SectionHeader title="表示テーマ" hint="端末に合わせた配色を選べます" />
        <div className="space-y-4">
          <SwitchRow
            label="ダークモード"
            hint={resolvedTheme === 'dark' ? '現在: ダーク' : '現在: ライト'}
            checked={resolvedTheme === 'dark'}
            onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          />
          <div>
            <p className="field-label">テーマ設定</p>
            <div className="flex items-center gap-3">
              {resolvedTheme === 'dark' ? (
                <MoonIcon className="h-5 w-5 text-accent" />
              ) : (
                <SunIcon className="h-5 w-5 text-accent" />
              )}
              <Segmented
                options={THEME_OPTIONS}
                value={data.settings.theme}
                onChange={setTheme}
                label="テーマを選択"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="app-card p-4">
        <SectionHeader title="データのバックアップ" hint="ブラウザのデータ消失に備えて JSON で保存・復元します" />
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold">エクスポート（ダウンロード）</p>
            <p className="mt-1 text-xs text-muted">追加曲・感触・採点履歴・設定をまとめて保存します。</p>
            <button type="button" className="btn btn-secondary mt-2" onClick={exportBackup}>
              <DownloadIcon className="h-4 w-4" />
              JSONをダウンロード
            </button>
          </div>

          <div className="divider pt-5">
            <p className="text-sm font-semibold">インポート（復元）</p>
            <p className="mt-1 text-xs text-muted">ファイルを選ぶか、JSON テキストを貼り付けて復元します。</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="btn btn-secondary mt-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="h-4 w-4" />
              ファイルを選択
            </button>
            <textarea
              className="textarea mt-3 font-mono text-xs"
              aria-label="復元するJSONテキスト"
              placeholder='{"schemaVersion": 1, ...} を貼り付け'
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary mt-2"
              disabled={!importText.trim()}
              onClick={() => handleImport(importText)}
            >
              貼り付けたJSONを復元
            </button>
            {message && (
              <p
                className={`mt-3 text-sm font-semibold ${
                  message.tone === 'ok' ? 'text-[var(--good)]' : 'text-[var(--bad)]'
                }`}
                role="status"
              >
                {message.text}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
