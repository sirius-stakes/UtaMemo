import { PREFERRED_COMFORTS } from '../constants/config';
import { KARAOKE_NOTE_MAX, KARAOKE_NOTE_MIN, clampMidiNote } from '../constants/notes';
import type { ComfortLevel, MidiNote, Song, UserSettings, UserSongRecord } from '../types/karaoke';

/** キーシフト適用済みの曲。 */
export interface ShiftedSong {
  song: Song;
  /** オク下 (-12) と半音調整を合算したシフト量。 */
  shift: number;
}

export interface RangeEstimateOptions {
  /** 音域推定に使う感触。デフォルトは ['great', 'good']。 */
  comfortLevels?: readonly ComfortLevel[];
  /** 下側パーセンタイル（0〜1）。デフォルト 0.1。 */
  lowerPercentile?: number;
  /** 上側パーセンタイル（0〜1）。デフォルト 0.9。 */
  upperPercentile?: number;
  /** 外れ値対策のための安全ガード（半音）。デフォルト 1。 */
  safetyMargin?: number;
  /** 候補がない／極端な値のときに使う基準音域。 */
  fallbackRange?: { lowestNote: MidiNote; highestNote: MidiNote };
}

export interface RangeEstimate {
  lowestNote: MidiNote;
  highestNote: MidiNote;
  /** 推定に実際に使った曲の ID。 */
  consideredSongIds: string[];
}

/** ユーザー設定と曲の記録から、その曲の合計シフト量を求める。 */
export function resolveSongShift(record: UserSongRecord | undefined, defaultShift = 0): number {
  if (!record) return defaultShift;
  return record.octaveShift + record.keyShift;
}

/** ユーザー設定のデフォルトシフト量。 */
export function resolveDefaultShift(settings: UserSettings): number {
  return settings.defaultOctaveShift + settings.defaultKeyShift;
}

/** 曲群＋各曲のシフトから、歌唱対象にする曲一覧を組み立てる。 */
export function buildShiftedTargets(
  songs: readonly Song[],
  userRecords: Readonly<Record<string, UserSongRecord>>,
  settings: UserSettings,
): ShiftedSong[] {
  const defaultShift = resolveDefaultShift(settings);
  return songs.map((song) => ({
    song,
    shift: resolveSongShift(userRecords[song.id], defaultShift),
  }));
}

/** ソート済み配列から線形補間でパーセンタイルを求める。 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lowerIndex = Math.floor(position);
  const fraction = position - lowerIndex;
  const upperIndex = Math.min(lowerIndex + 1, sorted.length - 1);
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * fraction;
}

/**
 * 対象曲群と各曲のキーシフトから歌唱音域を推定する。
 * デフォルトでは感触が 'great' / 'good' の曲のみを対象とし、
 * 下位 10% / 上位 90% のパーセンタイル＋安全ガードで外れ値の影響を抑える。
 */
export function estimateVocalRange(
  targets: readonly ShiftedSong[],
  userRecords: Readonly<Record<string, UserSongRecord>> = {},
  options: RangeEstimateOptions = {},
): RangeEstimate {
  const comfortLevels = options.comfortLevels ?? PREFERRED_COMFORTS;
  const lowerPercentile = options.lowerPercentile ?? 0.1;
  const upperPercentile = options.upperPercentile ?? 0.9;
  const safetyMargin = options.safetyMargin ?? 1;
  const fallbackLow = options.fallbackRange?.lowestNote ?? 55;
  const fallbackHigh = options.fallbackRange?.highestNote ?? 72;

  const lows: number[] = [];
  const highs: number[] = [];
  const consideredSongIds: string[] = [];

  for (const { song, shift } of targets) {
    const record = userRecords[song.id];
    if (!record) continue;
    if (!comfortLevels.includes(record.comfort)) continue;

    const low = (record.personalLowestNote ?? song.lowestNote) + shift;
    const high = (record.personalHighestNote ?? song.highestNote) + shift;
    if (!Number.isFinite(low) || !Number.isFinite(high)) continue;

    lows.push(low);
    highs.push(high);
    consideredSongIds.push(song.id);
  }

  if (lows.length === 0 || highs.length === 0) {
    return {
      lowestNote: clampMidiNote(fallbackLow),
      highestNote: clampMidiNote(fallbackHigh),
      consideredSongIds: [],
    };
  }

  // パーセンタイルで中央寄りに寄せ、安全ガードで内側へ少し広げる。
  let lowestNote = Math.round(percentile(lows, lowerPercentile) - safetyMargin);
  let highestNote = Math.round(percentile(highs, upperPercentile) + safetyMargin);

  // 安全ガード: 基準音域から大きく外れすぎないように制限する。
  const guardWidth = 12;
  lowestNote = Math.max(lowestNote, Math.round(fallbackLow) - guardWidth, KARAOKE_NOTE_MIN);
  highestNote = Math.min(highestNote, Math.round(fallbackHigh) + guardWidth, KARAOKE_NOTE_MAX);

  if (lowestNote > highestNote) {
    const middle = Math.round((lowestNote + highestNote) / 2);
    lowestNote = clampMidiNote(middle - 1);
    highestNote = clampMidiNote(middle + 1);
  }

  return { lowestNote, highestNote, consideredSongIds };
}

/**
 * 曲群・記録・設定を受け取って音域を推定する利便関数。
 */
export function estimateRangeFromSongs(
  songs: readonly Song[],
  userRecords: Readonly<Record<string, UserSongRecord>>,
  settings: UserSettings,
  options: RangeEstimateOptions = {},
): RangeEstimate {
  const targets = buildShiftedTargets(songs, userRecords, settings);
  return estimateVocalRange(targets, userRecords, {
    fallbackRange: {
      lowestNote: settings.comfortableLowestNote,
      highestNote: settings.comfortableHighestNote,
    },
    ...options,
  });
}
