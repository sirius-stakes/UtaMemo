import { COMFORT_LABELS, SINGABILITY_CONFIG, SINGABILITY_RANKS } from '../constants/config';
import { formatNoteRange } from '../constants/notes';
import type {
  ComfortLevel,
  MidiNote,
  ScoreRecord,
  Song,
  UserSettings,
  UserSongRecord,
} from '../types/karaoke';
import { resolveSongShift } from './rangeEstimator';

/** 「微妙／ダメ」だった曲の音域（高音側ペナルティの比較元）。 */
export interface TroubleRange {
  songId?: string;
  comfort: Extract<ComfortLevel, 'awkward' | 'bad'>;
  lowestNote: MidiNote;
  highestNote: MidiNote;
}

export interface SingabilityInput {
  song: Song;
  settings: UserSettings;
  record?: UserSongRecord;
  /** 対象曲の採点履歴（未指定なら絞り込みは行わない）。 */
  scoreHistory?: readonly ScoreRecord[];
  /** 過去に「微妙／ダメ」だった曲の音域一覧。 */
  troublesomeRanges?: readonly TroubleRange[];
  /** シフト量を明示的に上書きしたい場合（デフォルトは記録→設定の順で解決）。 */
  appliedShift?: number;
}

export interface SingabilityResult {
  /** 0〜100 の整数。 */
  score: number;
  rank: (typeof SINGABILITY_RANKS)[number]['rank'];
  label: string;
  /** 判定理由（日本語）。 */
  reasons: string[];
  /** シフト適用後の歌唱音域。 */
  lowestNote: MidiNote;
  highestNote: MidiNote;
  /** カラオケ表記の音域。 */
  rangeLabel: string;
  /** 実際に適用したシフト量（半音）。 */
  shift: number;
}

/**
 * 対象曲の「歌える度スコア」を算出する。
 * 基準音域との差分、感触、採点履歴、「微妙／ダメ」曲との比較を加減点して 0〜100 に丸める。
 */
export function scoreSong(input: SingabilityInput): SingabilityResult {
  const config = SINGABILITY_CONFIG;
  const { song, settings, record } = input;
  const shift = input.appliedShift ?? resolveSongShift(record, settings.defaultOctaveShift + settings.defaultKeyShift);
  const lowestNote = (record?.personalLowestNote ?? song.lowestNote) + shift;
  const highestNote = (record?.personalHighestNote ?? song.highestNote) + shift;
  const reasons: string[] = [];

  let score = config.BASE_SCORE;
  reasons.push(`基準スコア ${config.BASE_SCORE} 点`);

  // 1. ユーザーの基準音域との差分。
  const lowDeficit = Math.max(0, settings.comfortableLowestNote - lowestNote);
  const highExcess = Math.max(0, highestNote - settings.comfortableHighestNote);
  if (lowDeficit > 0 || highExcess > 0) {
    const penalty =
      lowDeficit * config.LOW_NOTE_PENALTY_PER_SEMITONE +
      highExcess * config.HIGH_NOTE_PENALTY_PER_SEMITONE;
    score -= penalty;
    const details: string[] = [];
    if (lowDeficit > 0) details.push(`低音 ${lowDeficit} 半音不足`);
    if (highExcess > 0) details.push(`高音 ${highExcess} 半音オーバー`);
    reasons.push(`${details.join('・')}（-${Math.round(penalty)} 点）`);
  } else {
    score += config.RANGE_FIT_BONUS;
    reasons.push(`基準音域内に収まる（+${config.RANGE_FIT_BONUS} 点）`);
  }

  // 2. 感触による補正。
  const comfort: ComfortLevel = record?.comfort ?? 'unrated';
  const comfortAdjustment = config.COMFORT_ADJUSTMENTS[comfort];
  score += comfortAdjustment;
  if (comfortAdjustment !== 0) {
    const sign = comfortAdjustment > 0 ? '+' : '';
    reasons.push(`感触「${COMFORT_LABELS[comfort]}」による補正（${sign}${comfortAdjustment} 点）`);
  } else if (comfort === 'unrated') {
    reasons.push('感触は未記録');
  }

  // 3. 採点履歴（直近の平均点を反映）。
  const history = input.scoreHistory ?? [];
  const recent = [...history]
    .filter((item) => item.songId === song.id)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, config.SCORE_HISTORY_RECENT_COUNT);
  if (recent.length > 0) {
    const average = recent.reduce((sum, item) => sum + item.score, 0) / recent.length;
    const rawBonus = (average - 70) * config.SCORE_HISTORY_BONUS_WEIGHT;
    const bonus = Math.max(
      config.SCORE_HISTORY_MAX_PENALTY,
      Math.min(config.SCORE_HISTORY_MAX_BONUS, rawBonus),
    );
    score += bonus;
    const sign = bonus >= 0 ? '+' : '';
    reasons.push(`直近 ${recent.length} 回の採点平均 ${average.toFixed(1)} 点（${sign}${Math.round(bonus)} 点）`);
  }

  // 4. 「微妙／ダメ」だった曲の音域との比較ペナルティ（高音側を重視）。
  let troublePenalty = 0;
  for (const trouble of input.troublesomeRanges ?? []) {
    const highOver = highestNote - trouble.highestNote - config.TROUBLESOME_HIGH_TOLERANCE;
    const lowUnder = trouble.lowestNote - lowestNote - config.TROUBLESOME_LOW_TOLERANCE;
    const isBad = trouble.comfort === 'bad';
    if (highOver > 0) {
      const rate = isBad
        ? config.BAD_HIGH_NOTE_PENALTY_PER_SEMITONE
        : config.AWKWARD_HIGH_NOTE_PENALTY_PER_SEMITONE;
      troublePenalty += highOver * rate;
    }
    if (lowUnder > 0) {
      const rate = isBad
        ? config.BAD_LOW_NOTE_PENALTY_PER_SEMITONE
        : config.AWKWARD_LOW_NOTE_PENALTY_PER_SEMITONE;
      troublePenalty += lowUnder * rate;
    }
  }
  troublePenalty = Math.min(troublePenalty, config.TROUBLESOME_MAX_PENALTY);
  if (troublePenalty > 0) {
    score -= troublePenalty;
    reasons.push(`「微妙／ダメ」だった曲に近い音域（-${Math.round(troublePenalty)} 点）`);
  }

  const finalScore = Math.max(
    config.MIN_SCORE,
    Math.min(config.MAX_SCORE, Math.round(score)),
  );
  const rankInfo =
    SINGABILITY_RANKS.find((rank) => finalScore >= rank.minScore) ??
    SINGABILITY_RANKS[SINGABILITY_RANKS.length - 1];

  return {
    score: finalScore,
    rank: rankInfo.rank,
    label: rankInfo.label,
    reasons,
    lowestNote,
    highestNote,
    rangeLabel: formatNoteRange(lowestNote, highestNote),
    shift,
  };
}

/** 「微妙／ダメ」の記録を持つ曲から比較用音域一覧を組み立てる。 */
export function buildTroublesomeRanges(
  songs: readonly Song[],
  userRecords: Readonly<Record<string, UserSongRecord>>,
  settings: UserSettings,
): TroubleRange[] {
  const defaultShift = settings.defaultOctaveShift + settings.defaultKeyShift;
  const ranges: TroubleRange[] = [];
  for (const song of songs) {
    const record = userRecords[song.id];
    if (!record || (record.comfort !== 'awkward' && record.comfort !== 'bad')) continue;
    const shift = resolveSongShift(record, defaultShift);
    ranges.push({
      songId: song.id,
      comfort: record.comfort,
      lowestNote: (record.personalLowestNote ?? song.lowestNote) + shift,
      highestNote: (record.personalHighestNote ?? song.highestNote) + shift,
    });
  }
  return ranges;
}
