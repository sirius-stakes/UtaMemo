import type { ComfortLevel, UserSettings } from '../types/karaoke';

/** localStorage のキーとスキーマバージョン。 */
export const STORAGE_KEY = 'utamemo:data';
export const STORAGE_SCHEMA_VERSION = 1;

/** 推薦設定: 選択ジャンル : 非選択ジャンル（合計） = 1.5 : 1。 */
export const RECOMMENDATION_CONFIG = {
  SELECTED_GENRE_WEIGHT: 1.5,
  NON_SELECTED_GENRE_WEIGHT: 1.0,
  MAX_SELECTED_GENRES: 3,
  DEFAULT_LIMIT: 10,
} as const;

/** 「歌える度スコア」算出に使う定数。後から数値調整しやすいよう集約する。 */
export const SINGABILITY_CONFIG = {
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  /** 基準点（ここから加減点する）。 */
  BASE_SCORE: 72,
  /** 基準音域からはみ出したときの 1 半音あたり減点。 */
  LOW_NOTE_PENALTY_PER_SEMITONE: 1.2,
  HIGH_NOTE_PENALTY_PER_SEMITONE: 2.0,
  /** 基準音域内に収まったときの加点。 */
  RANGE_FIT_BONUS: 8,
  /** 感触による補正（指定どおり）。 */
  COMFORT_ADJUSTMENTS: {
    great: 25,
    good: 15,
    awkward: -20,
    bad: -40,
    unrated: 0,
  } as const satisfies Record<ComfortLevel, number>,
  /** 採点履歴（直近 N 件の平均）の反映度合い。 */
  SCORE_HISTORY_RECENT_COUNT: 5,
  SCORE_HISTORY_BONUS_WEIGHT: 0.2,
  SCORE_HISTORY_MAX_BONUS: 15,
  SCORE_HISTORY_MAX_PENALTY: -10,
  /** 「微妙／ダメ」曲の音域との比較ペナルティ。 */
  TROUBLESOME_HIGH_TOLERANCE: 2,
  TROUBLESOME_LOW_TOLERANCE: 2,
  AWKWARD_HIGH_NOTE_PENALTY_PER_SEMITONE: 2,
  BAD_HIGH_NOTE_PENALTY_PER_SEMITONE: 3,
  AWKWARD_LOW_NOTE_PENALTY_PER_SEMITONE: 1.5,
  BAD_LOW_NOTE_PENALTY_PER_SEMITONE: 2.5,
  TROUBLESOME_MAX_PENALTY: 30,
} as const;

/** スコア帯ごとのランクとラベル（高い順）。 */
export const SINGABILITY_RANKS = [
  { minScore: 90, rank: 'S', label: '余裕で歌える' },
  { minScore: 75, rank: 'A', label: '歌える' },
  { minScore: 60, rank: 'B', label: 'なんとか歌える' },
  { minScore: 40, rank: 'C', label: '少し厳しい' },
  { minScore: 0, rank: 'D', label: '難しい' },
] as const;

export type SingabilityRank = (typeof SINGABILITY_RANKS)[number]['rank'];

/** 感触の全種類と、推薦対象として扱う種類。 */
export const COMFORT_LEVELS: readonly ComfortLevel[] = ['unrated', 'great', 'good', 'awkward', 'bad'];
export const SINGABLE_COMFORTS: readonly ComfortLevel[] = ['unrated', 'great', 'good'];
/** 音域推定で優先する感触。 */
export const PREFERRED_COMFORTS: readonly ComfortLevel[] = ['great', 'good'];

/** 感触の表示ラベル。 */
export const COMFORT_LABELS: Record<ComfortLevel, string> = {
  great: '上手に歌える',
  good: '歌える',
  awkward: '微妙',
  bad: 'ダメ',
  unrated: '未記録',
};

/** デフォルト設定（55 = mid1G, 72 = hiC）。 */
export const DEFAULT_SETTINGS: UserSettings = {
  comfortableLowestNote: 55,
  comfortableHighestNote: 72,
  defaultKeyShift: 0,
  defaultOctaveShift: 0,
  selectedGenres: [],
  preferredSystem: 'BOTH',
  theme: 'system',
  recommendationLimit: RECOMMENDATION_CONFIG.DEFAULT_LIMIT,
};

/** 設定の初期値を毎回新しいオブジェクトで返す。 */
export function createDefaultSettings(): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    selectedGenres: [],
  };
}
