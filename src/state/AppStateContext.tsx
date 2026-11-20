import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { RECOMMENDATION_CONFIG } from '../constants/config';
import { clampMidiNote } from '../constants/notes';
import type {
  AppStorageData,
  ComfortLevel,
  MidiNote,
  Song,
  UserSettings,
  UserSongRecord,
} from '../types/karaoke';
import {
  normalizeSelectedGenres,
} from '../utils/recommender';
import {
  downloadJsonBackup,
  importStorageData,
  loadStorageData,
  mergeSongsWithCustom,
  saveStorageData,
  type ImportResult,
} from '../utils/storage';

/** メインビューの識別子。 */
export type ViewId = 'recommend' | 'songs' | 'vocal' | 'records';

/** 「曲を追加」モーダルから渡される入力値。 */
export interface NewSongInput {
  title: string;
  artist: string;
  genre: string;
  lowestNote: MidiNote;
  highestNote: MidiNote;
  dam: boolean;
  joysound: boolean;
  listenUrl?: string;
  lyricsUrl?: string;
  memo?: string;
}

interface AppStateContextValue {
  data: AppStorageData;
  songs: Song[];
  genres: string[];
  loadingSongs: boolean;
  songLoadError: string | null;
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  resolvedTheme: 'light' | 'dark';
  updateSettings: (patch: Partial<UserSettings>) => void;
  setTheme: (theme: UserSettings['theme']) => void;
  setSelectedGenres: (genres: readonly string[]) => void;
  setVocalRange: (lowest: MidiNote, highest: MidiNote) => void;
  setComfort: (songId: string, comfort: ComfortLevel) => void;
  setSongKeyShift: (songId: string, shift: number) => void;
  setSongOctaveShift: (songId: string, shift: number) => void;
  setGlobalOctaveShift: (shift: number) => void;
  addSong: (input: NewSongInput) => void;
  exportBackup: () => void;
  importBackup: (json: string) => ImportResult;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 静的 JSON の楽曲マスターを検証して取り込む。 */
function parseSongMaster(value: unknown): Song[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Song => {
    if (!isObject(item)) return false;
    const availability = item.availability;
    return (
      typeof item.id === 'string' &&
      item.id.length > 0 &&
      typeof item.title === 'string' &&
      typeof item.artist === 'string' &&
      typeof item.genre === 'string' &&
      typeof item.lowestNote === 'number' &&
      Number.isFinite(item.lowestNote) &&
      typeof item.highestNote === 'number' &&
      Number.isFinite(item.highestNote) &&
      isObject(availability) &&
      typeof availability.dam === 'boolean' &&
      typeof availability.joysound === 'boolean' &&
      typeof item.createdAt === 'string'
    );
  });
}

function createRecord(songId: string, settings: UserSettings): UserSongRecord {
  return {
    songId,
    comfort: 'unrated',
    keyShift: settings.defaultKeyShift,
    octaveShift: settings.defaultOctaveShift,
    updatedAt: new Date().toISOString(),
  };
}

/** OS のダークモード設定を購読する。 */
function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return prefersDark;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppStorageData>(() => loadStorageData());
  const [masterSongs, setMasterSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [songLoadError, setSongLoadError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewId>('recommend');
  const prefersDark = usePrefersDark();

  // ユーザーデータを localStorage に永続化。
  useEffect(() => {
    saveStorageData(data);
  }, [data]);

  // 公開ディレクトリの静的 JSON を読み込む（外部 API 呼び出しは行わない）。
  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}data/songs.json`;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((json: unknown) => {
        if (!cancelled) setMasterSongs(parseSongMaster(json));
      })
      .catch(() => {
        if (!cancelled) setSongLoadError('楽曲マスターの読み込みに失敗しました。');
      })
      .finally(() => {
        if (!cancelled) setLoadingSongs(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    data.settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : data.settings.theme;

  // html 要素に dark クラスを適用（CSS 変数と Tailwind の both に効く）。
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const songs = useMemo(() => mergeSongsWithCustom(masterSongs, data), [masterSongs, data]);

  const genres = useMemo(
    () => [...new Set(songs.map((song) => song.genre))].sort((a, b) => a.localeCompare(b, 'ja')),
    [songs],
  );

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const setTheme = useCallback((theme: UserSettings['theme']) => updateSettings({ theme }), [updateSettings]);

  const setSelectedGenres = useCallback(
    (next: readonly string[]) => {
      const limited = normalizeSelectedGenres(next.slice(0, RECOMMENDATION_CONFIG.MAX_SELECTED_GENRES));
      updateSettings({ selectedGenres: limited });
    },
    [updateSettings],
  );

  const setVocalRange = useCallback((lowest: MidiNote, highest: MidiNote) => {
    const low = clampMidiNote(lowest);
    const high = clampMidiNote(highest);
    const [min, max] = low <= high ? [low, high] : [high, low];
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, comfortableLowestNote: min, comfortableHighestNote: max },
    }));
  }, []);

  const patchRecord = useCallback(
    (songId: string, patch: (record: UserSongRecord) => Partial<UserSongRecord>) => {
      setData((prev) => {
        const base = prev.userSongRecords[songId] ?? createRecord(songId, prev.settings);
        const updated: UserSongRecord = { ...base, ...patch(base), updatedAt: new Date().toISOString() };
        return { ...prev, userSongRecords: { ...prev.userSongRecords, [songId]: updated } };
      });
    },
    [],
  );

  const setComfort = useCallback(
    (songId: string, comfort: ComfortLevel) => patchRecord(songId, () => ({ comfort })),
    [patchRecord],
  );

  const setSongKeyShift = useCallback(
    (songId: string, shift: number) => patchRecord(songId, () => ({ keyShift: Math.max(-12, Math.min(12, Math.round(shift))) })),
    [patchRecord],
  );

  const setSongOctaveShift = useCallback(
    (songId: string, shift: number) =>
      patchRecord(songId, () => ({ octaveShift: Math.max(-12, Math.min(0, Math.round(shift))) })),
    [patchRecord],
  );

  /** オク下基準をアプリ全体（設定＋全曲の記録）へ反映する。 */
  const setGlobalOctaveShift = useCallback((shift: number) => {
    const clamped = Math.max(-12, Math.min(0, Math.round(shift)));
    setData((prev) => {
      const userSongRecords: Record<string, UserSongRecord> = {};
      const now = new Date().toISOString();
      for (const [songId, record] of Object.entries(prev.userSongRecords)) {
        userSongRecords[songId] = { ...record, octaveShift: clamped, updatedAt: now };
      }
      return {
        ...prev,
        settings: { ...prev.settings, defaultOctaveShift: clamped },
        userSongRecords,
      };
    });
  }, []);

  const addSong = useCallback((input: NewSongInput) => {
    const links: Song['links'] =
      input.listenUrl || input.lyricsUrl
        ? { listenUrl: input.listenUrl || undefined, lyricsUrl: input.lyricsUrl || undefined }
        : undefined;
    const song: Song = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: input.title.trim(),
      artist: input.artist.trim(),
      genre: input.genre.trim() || 'その他',
      lowestNote: clampMidiNote(input.lowestNote),
      highestNote: clampMidiNote(input.highestNote),
      availability: { dam: input.dam, joysound: input.joysound },
      links,
      utattemitaMemo: input.memo?.trim() || undefined,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, customSongs: [...prev.customSongs, song] }));
  }, []);

  const exportBackup = useCallback(() => downloadJsonBackup(data), [data]);

  const importBackup = useCallback((json: string): ImportResult => {
    const result = importStorageData(json);
    if (result.success) setData(result.data);
    return result;
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({
      data,
      songs,
      genres,
      loadingSongs,
      songLoadError,
      activeView,
      setActiveView,
      resolvedTheme,
      updateSettings,
      setTheme,
      setSelectedGenres,
      setVocalRange,
      setComfort,
      setSongKeyShift,
      setSongOctaveShift,
      setGlobalOctaveShift,
      addSong,
      exportBackup,
      importBackup,
    }),
    [
      data,
      songs,
      genres,
      loadingSongs,
      songLoadError,
      activeView,
      resolvedTheme,
      updateSettings,
      setTheme,
      setSelectedGenres,
      setVocalRange,
      setComfort,
      setSongKeyShift,
      setSongOctaveShift,
      setGlobalOctaveShift,
      addSong,
      exportBackup,
      importBackup,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState は AppStateProvider 内で使用してください');
  return context;
}
