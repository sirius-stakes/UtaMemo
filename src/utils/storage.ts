import {
  COMFORT_LEVELS,
  RECOMMENDATION_CONFIG,
  STORAGE_KEY,
  STORAGE_SCHEMA_VERSION,
  createDefaultSettings,
} from '../constants/config';
import { KARAOKE_NOTE_MAX, KARAOKE_NOTE_MIN } from '../constants/notes';
import type {
  AppStorageData,
  ComfortLevel,
  MidiNote,
  ScoreRecord,
  Song,
  UserSettings,
  UserSongRecord,
} from '../types/karaoke';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMidiNote(value: unknown): value is MidiNote {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSong(value: unknown): value is Song {
  if (!isObject(value)) return false;
  const availability = value.availability;
  if (
    !isObject(availability) ||
    typeof availability.dam !== 'boolean' ||
    typeof availability.joysound !== 'boolean'
  ) {
    return false;
  }
  if (value.links !== undefined) {
    if (!isObject(value.links)) return false;
    if (value.links.listenUrl !== undefined && typeof value.links.listenUrl !== 'string') return false;
    if (value.links.lyricsUrl !== undefined && typeof value.links.lyricsUrl !== 'string') return false;
  }
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.title === 'string' &&
    typeof value.artist === 'string' &&
    typeof value.genre === 'string' &&
    isMidiNote(value.lowestNote) &&
    isMidiNote(value.highestNote) &&
    typeof value.createdAt === 'string'
  );
}

function isUserSongRecord(value: unknown): value is UserSongRecord {
  if (!isObject(value)) return false;
  return (
    typeof value.songId === 'string' &&
    typeof value.comfort === 'string' &&
    (COMFORT_LEVELS as readonly string[]).includes(value.comfort) &&
    isMidiNote(value.keyShift) &&
    isMidiNote(value.octaveShift) &&
    typeof value.updatedAt === 'string' &&
    (value.personalLowestNote === undefined || isMidiNote(value.personalLowestNote)) &&
    (value.personalHighestNote === undefined || isMidiNote(value.personalHighestNote))
  );
}

function isScoreRecord(value: unknown): value is ScoreRecord {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.songId === 'string' &&
    isMidiNote(value.score) &&
    typeof value.recordedAt === 'string'
  );
}

function normalizeSettings(value: unknown, defaults: UserSettings): UserSettings {
  if (!isObject(value)) return defaults;
  const selectedGenres = Array.isArray(value.selectedGenres)
    ? value.selectedGenres.filter((genre): genre is string => typeof genre === 'string')
    : defaults.selectedGenres;
  const theme =
    value.theme === 'light' || value.theme === 'dark' || value.theme === 'system'
      ? value.theme
      : defaults.theme;
  const preferredSystem =
    value.preferredSystem === 'DAM' || value.preferredSystem === 'JOYSOUND' || value.preferredSystem === 'BOTH'
      ? value.preferredSystem
      : defaults.preferredSystem;
  const recommendationLimit =
    isMidiNote(value.recommendationLimit) && Number.isInteger(value.recommendationLimit)
      ? Math.max(0, Math.min(100, value.recommendationLimit))
      : defaults.recommendationLimit;

  return {
    comfortableLowestNote: isMidiNote(value.comfortableLowestNote)
      ? clampNote(value.comfortableLowestNote)
      : defaults.comfortableLowestNote,
    comfortableHighestNote: isMidiNote(value.comfortableHighestNote)
      ? clampNote(value.comfortableHighestNote)
      : defaults.comfortableHighestNote,
    defaultKeyShift: isMidiNote(value.defaultKeyShift) ? value.defaultKeyShift : defaults.defaultKeyShift,
    defaultOctaveShift: isMidiNote(value.defaultOctaveShift)
      ? value.defaultOctaveShift
      : defaults.defaultOctaveShift,
    selectedGenres: [...new Set(selectedGenres)].slice(0, RECOMMENDATION_CONFIG.MAX_SELECTED_GENRES),
    preferredSystem,
    theme,
    recommendationLimit,
  };
}

function clampNote(note: MidiNote): MidiNote {
  return Math.max(KARAOKE_NOTE_MIN, Math.min(KARAOKE_NOTE_MAX, Math.round(note)));
}

function normalizeRecord(record: UserSongRecord): UserSongRecord {
  const normalized: UserSongRecord = {
    songId: record.songId,
    comfort: (COMFORT_LEVELS as readonly string[]).includes(record.comfort)
      ? record.comfort
      : ('unrated' as ComfortLevel),
    keyShift: record.keyShift,
    octaveShift: record.octaveShift,
    updatedAt: record.updatedAt,
  };
  if (record.personalLowestNote !== undefined) normalized.personalLowestNote = clampNote(record.personalLowestNote);
  if (record.personalHighestNote !== undefined) normalized.personalHighestNote = clampNote(record.personalHighestNote);
  return normalized;
}

/** 初期データ（空のユーザーデータ＋デフォルト設定）を生成する。 */
export function createDefaultStorageData(): AppStorageData {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    customSongs: [],
    userSongRecords: {},
    scoreHistory: [],
    songOverrides: {},
    settings: createDefaultSettings(),
  };
}

/** 任意の入力を検証し、既知のフィールドだけを残した安全なデータへ正規化する。 */
export function normalizeStorageData(
  value: unknown,
  defaults: AppStorageData = createDefaultStorageData(),
): AppStorageData {
  if (!isObject(value)) {
    throw new Error('データがオブジェクト形式ではありません');
  }
  if (typeof value.schemaVersion === 'number' && value.schemaVersion > STORAGE_SCHEMA_VERSION) {
    throw new Error(`未対応のスキーマバージョンです: ${value.schemaVersion}`);
  }

  const customSongs = Array.isArray(value.customSongs)
    ? value.customSongs.filter(isSong).map((song) => ({ ...song, isCustom: true }))
    : [];

  const userSongRecords: Record<string, UserSongRecord> = {};
  if (isObject(value.userSongRecords)) {
    for (const [songId, record] of Object.entries(value.userSongRecords)) {
      if (!isUserSongRecord(record)) continue;
      const normalized = normalizeRecord(record);
      userSongRecords[songId] = { ...normalized, songId };
    }
  }

  const scoreHistory = Array.isArray(value.scoreHistory) ? value.scoreHistory.filter(isScoreRecord) : [];

  const songOverrides: Record<string, Song> = {};
  if (isObject(value.songOverrides)) {
    for (const [songId, song] of Object.entries(value.songOverrides)) {
      if (isSong(song) && song.id === songId) songOverrides[songId] = song;
    }
  }

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    customSongs,
    userSongRecords,
    scoreHistory,
    songOverrides,
    settings: normalizeSettings(value.settings, defaults.settings),
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : undefined,
  };
}

/** localStorage からデータを読み込む。壊れていた場合は初期データを返す。 */
export function loadStorageData(): AppStorageData {
  const defaults = createDefaultStorageData();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return normalizeStorageData(JSON.parse(raw) as unknown, defaults);
  } catch {
    return defaults;
  }
}

/** データを localStorage に保存する。 */
export function saveStorageData(data: AppStorageData): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeStorageData(data);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

/** localStorage のデータを削除する。 */
export function clearStorageData(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** バックアップ用の JSON 文字列を生成する（ダウンロードは downloadJsonBackup を使用）。 */
export function exportStorageData(data: AppStorageData): string {
  const payload: AppStorageData = {
    ...normalizeStorageData(data),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

/** 生成した JSON をファイルとしてダウンロードする。 */
export function downloadJsonBackup(data: AppStorageData, filename = 'utamemo-backup.json'): void {
  if (typeof document === 'undefined') return;
  const json = exportStorageData(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type ImportResult =
  | { success: true; data: AppStorageData }
  | { success: false; error: string };

/** JSON 文字列を検証して復元する。既定では localStorage にも保存する。 */
export function importStorageData(json: string, persist = true): ImportResult {
  try {
    const parsed: unknown = JSON.parse(json);
    const data = normalizeStorageData(parsed);
    if (persist) saveStorageData(data);
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラー';
    return { success: false, error: `インポートに失敗しました: ${message}` };
  }
}

/**
 * 静的マスター・ユーザー追加曲・編集内容を ID でマージする。
 * 優先順位は「編集内容 ＞ 追加曲 ＞ 静的マスター」。
 */
export function mergeSongsWithCustom(initialSongs: readonly Song[], data: AppStorageData): Song[] {
  const songsById = new Map<string, Song>();
  for (const song of initialSongs) songsById.set(song.id, song);
  for (const song of data.customSongs) songsById.set(song.id, { ...song, isCustom: true });
  for (const song of Object.values(data.songOverrides)) {
    if (!songsById.has(song.id)) continue;
    songsById.set(song.id, { ...song, isCustom: songsById.get(song.id)?.isCustom ?? song.isCustom });
  }
  return [...songsById.values()];
}
