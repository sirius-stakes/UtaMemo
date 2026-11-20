import { RECOMMENDATION_CONFIG, SINGABLE_COMFORTS } from '../constants/config';
import type { ComfortLevel, ScoreRecord, Song, UserSettings, UserSongRecord } from '../types/karaoke';
import { buildTroublesomeRanges, scoreSong, type SingabilityResult, type TroubleRange } from './singabilityScore';

export interface RecommendationInput {
  songs: readonly Song[];
  userRecords: Readonly<Record<string, UserSongRecord>>;
  settings: UserSettings;
  scoreHistory: readonly ScoreRecord[];
  /** 省略時は「微妙／ダメ」の記録から自動生成する。 */
  troublesomeRanges?: readonly TroubleRange[];
  /** 省略時は settings.recommendationLimit。 */
  limit?: number;
}

export interface RecommendedSong extends SingabilityResult {
  song: Song;
  comfort: ComfortLevel;
  /** 選択ジャンルに一致した曲か。 */
  matchedGenre: boolean;
  /** 候補不足で「微妙／ダメ」を例外追加した曲か。 */
  isFallback?: boolean;
}

/**
 * 「歌える以上（great / good / unrated）」を基本対象とし、
 * 歌える度スコアとジャンル比率（選択 1.5 : 非選択 1）で推薦曲を生成する。
 * 候補が足りない場合は残りの曲をスコア順に追加するフォールバック付き。
 */
export function recommendSongs(input: RecommendationInput): RecommendedSong[] {
  const {
    songs,
    userRecords,
    settings,
    scoreHistory,
    troublesomeRanges = buildTroublesomeRanges(songs, userRecords, settings),
  } = input;
  const limit = Math.max(0, input.limit ?? settings.recommendationLimit);
  if (limit === 0) return [];

  const selectedGenres = new Set(settings.selectedGenres.slice(0, RECOMMENDATION_CONFIG.MAX_SELECTED_GENRES));
  const candidateIds = new Set<string>();

  const rank = (song: Song): RecommendedSong => {
    const result = scoreSong({
      song,
      settings,
      record: userRecords[song.id],
      scoreHistory,
      troublesomeRanges,
    });
    const comfort = userRecords[song.id]?.comfort ?? 'unrated';
    return {
      ...result,
      song,
      comfort,
      matchedGenre: selectedGenres.has(song.genre),
    };
  };

  const scoredAll = songs.map(rank).sort((a, b) => b.score - a.score);
  const candidates = scoredAll.filter((item) => SINGABLE_COMFORTS.includes(item.comfort));
  for (const item of candidates) candidateIds.add(item.song.id);
  const selected = candidates.filter((item) => item.matchedGenre);
  const others = candidates.filter((item) => !item.matchedGenre);

  // 比率から各グループの枠を算出（1.5 : 1 → 全体の 60% : 40%）。
  const totalWeight =
    RECOMMENDATION_CONFIG.SELECTED_GENRE_WEIGHT + RECOMMENDATION_CONFIG.NON_SELECTED_GENRE_WEIGHT;
  const selectedQuota = Math.round(
    (limit * RECOMMENDATION_CONFIG.SELECTED_GENRE_WEIGHT) / totalWeight,
  );
  const otherQuota = limit - selectedQuota;

  const picked: RecommendedSong[] = [];
  const takeSelected = Math.min(selectedQuota, selected.length);
  const takeOthers = Math.min(otherQuota, others.length);
  picked.push(...selected.slice(0, takeSelected));
  picked.push(...others.slice(0, takeOthers));

  // 片方のグループが不足したら、もう片方の残りで埋める。
  const remaining = [...selected.slice(takeSelected), ...others.slice(takeOthers)].sort(
    (a, b) => b.score - a.score,
  );
  for (const item of remaining) {
    if (picked.length >= limit) break;
    picked.push(item);
  }

  // フォールバック: まだ足りなければ「微妙／ダメ」も最後尾に追加する。
  if (picked.length < limit) {
    const excluded = scoredAll
      .filter((item) => !candidateIds.has(item.song.id))
      .sort((a, b) => b.score - a.score);
    for (const item of excluded) {
      if (picked.length >= limit) break;
      picked.push({
        ...item,
        isFallback: true,
        reasons: [...item.reasons, '候補不足のため対象外の曲を追加'],
      });
    }
  }

  return picked.sort(
    (a, b) => Number(a.isFallback ?? false) - Number(b.isFallback ?? false) || b.score - a.score,
  );
}

/**
 * 選択ジャンルの数を MAX_SELECTED_GENRES に制限したリストを返す。
 */
export function normalizeSelectedGenres(genres: readonly string[]): string[] {
  return [...new Set(genres)].slice(0, RECOMMENDATION_CONFIG.MAX_SELECTED_GENRES);
}
