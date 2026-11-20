/**
 * UtaMemo で共通して利用するデータ型定義。
 * 音域は必ず半音単位の MIDI ノート番号（60 = C4）で保持し、
 * 表示時にカラオケ表記へ変換する。
 */

/** 半音単位の MIDI ノート番号（例: 60 = C4）。 */
export type MidiNote = number;

/** カラオケシステム。 */
export type KaraokeSystem = 'DAM' | 'JOYSOUND';

/** 曲に対する感触（4 段階＋未記録）。 */
export type ComfortLevel = 'unrated' | 'great' | 'good' | 'awkward' | 'bad';

/** 楽曲マスター（静的 JSON / ユーザー追加曲の共通形）。 */
export interface Song {
  /** アプリ内で一意な ID。 */
  id: string;
  title: string;
  artist: string;
  genre: string;
  /** 原キーでの歌唱最低音。 */
  lowestNote: MidiNote;
  /** 原キーでの歌唱最高音。 */
  highestNote: MidiNote;
  availability: {
    dam: boolean;
    joysound: boolean;
  };
  /** 外部サービスの視聴・歌詞確認リンク（遷移のみ、API 呼び出しは行わない）。 */
  links?: {
    listenUrl?: string;
    lyricsUrl?: string;
  };
  /** 「歌ってみた」等の自由メモ。 */
  utattemitaMemo?: string;
  /** ユーザーが追加した曲かどうか。 */
  isCustom?: boolean;
  /** 登録日時（ISO 8601 文字列）。 */
  createdAt: string;
}

/** 1 回の採点履歴。 */
export interface ScoreRecord {
  id: string;
  songId: string;
  /** 0〜100 の採点結果。 */
  score: number;
  /** 歌唱日時（ISO 8601 文字列）。 */
  recordedAt: string;
  system?: KaraokeSystem;
  /** 歌唱時のキーシフト（半音単位）。 */
  keyShift?: number;
  memo?: string;
}

/** 曲ごとのユーザー記録（感触・シフト設定）。 */
export interface UserSongRecord {
  songId: string;
  comfort: ComfortLevel;
  /** 半音単位の細かいキー調整（例: -2, +3）。 */
  keyShift: number;
  /** オクターブシフト（半音単位: -12 = オク下, 0 = 原キー）。 */
  octaveShift: number;
  /** ユーザーが実際に歌えた最低音（原キー基準、任意）。 */
  personalLowestNote?: MidiNote;
  /** ユーザーが実際に歌えた最高音（原キー基準、任意）。 */
  personalHighestNote?: MidiNote;
  /** レコード更新日時（ISO 8601 文字列）。 */
  updatedAt: string;
}

/** アプリ全体のユーザー設定。 */
export interface UserSettings {
  /** ユーザーが無理なく歌える最低音（原キー基準）。 */
  comfortableLowestNote: MidiNote;
  /** ユーザーが無理なく歌える最高音（原キー基準）。 */
  comfortableHighestNote: MidiNote;
  /** デフォルトの半音キーシフト。 */
  defaultKeyShift: number;
  /** デフォルトのオクターブシフト（半音単位）。 */
  defaultOctaveShift: number;
  /** 推薦で重み付けするジャンル（最大 3 つ）。 */
  selectedGenres: string[];
  /** 利用するカラオケシステム。 */
  preferredSystem: KaraokeSystem | 'BOTH';
  theme: 'light' | 'dark' | 'system';
  /** 推薦曲の表示件数。 */
  recommendationLimit: number;
}

/** localStorage に永続化するデータ全体。 */
export interface AppStorageData {
  /** スキーマバージョン（将来のマイグレーション用）。 */
  schemaVersion: number;
  /** ユーザーが追加した楽曲。 */
  customSongs: Song[];
  /** songId をキーにした曲ごとの記録。 */
  userSongRecords: Record<string, UserSongRecord>;
  /** 全曲分の採点履歴（songId で絞り込んで利用）。 */
  scoreHistory: ScoreRecord[];
  settings: UserSettings;
  /** エクスポート時に付与される日時（ISO 8601 文字列）。 */
  exportedAt?: string;
}
