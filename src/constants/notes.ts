import type { MidiNote } from '../types/karaoke';

/** 12 音の名前（インデックス = MIDI ノート番号 % 12）。 */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** サポートする MIDI ノート範囲（lowC 〜 hihiB）。 */
export const KARAOKE_NOTE_MIN = 36;
export const KARAOKE_NOTE_MAX = 95;

/** カラオケ表記のオクターブ接頭辞。キーは科学音高表記のオクターブ番号。 */
const OCTAVE_PREFIXES: Record<number, string> = {
  2: 'low',
  3: 'mid1',
  4: 'mid2',
  5: 'hi',
  6: 'hihi',
};

/** 接頭辞ごとの起点 MIDI ノート番号。 */
const PREFIX_START: Record<string, number> = {
  low: 36,
  mid1: 48,
  mid2: 60,
  hi: 72,
  hihi: 84,
};

/** 表記解決で使う長い接頭辞から順に並べたもの。 */
const PREFIX_PATTERN = '(hihi|mid1|mid2|low|hi)';
const NAME_PATTERN = '(c#|d#|f#|g#|a#|c|d|e|f|g|a|b)';

/** MIDI ノート番号を C4 のような科学音高表記へ変換する。 */
export function midiToScientificNote(midi: MidiNote): string {
  if (!Number.isFinite(midi)) return '';
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}

/** MIDI ノート番号を lowG / mid1A / mid2C / hiA / hiC / hihiA 形式へ変換する。 */
export function midiToKaraokeNote(midi: MidiNote): string {
  if (!Number.isFinite(midi)) return '';
  const rounded = Math.round(midi);
  if (rounded < KARAOKE_NOTE_MIN || rounded > KARAOKE_NOTE_MAX) {
    return midiToScientificNote(rounded);
  }
  const octave = Math.floor(rounded / 12) - 1;
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const prefix = OCTAVE_PREFIXES[octave] ?? 'hihi';
  return `${prefix}${name}`;
}

/** カラオケ表記（または C4 形式）を MIDI ノート番号へ変換する。不正な値は null。 */
export function karaokeNoteToMidi(label: string): MidiNote | null {
  if (typeof label !== 'string') return null;
  const normalized = label.trim().toLowerCase().replace(/[\s−–—]/g, '');

  const karaokeMatch = new RegExp(`^${PREFIX_PATTERN}${NAME_PATTERN}$`).exec(normalized);
  if (karaokeMatch) {
    const [, prefix, name] = karaokeMatch;
    const nameIndex = NOTE_NAMES.findIndex((note) => note.toLowerCase() === name);
    if (nameIndex < 0) return null;
    return PREFIX_START[prefix] + nameIndex;
  }

  const scientificMatch = /^([a-g])(#|b)?(-?\d+)$/.exec(normalized);
  if (scientificMatch) {
    const [, name, accidental, octaveText] = scientificMatch;
    let nameIndex = NOTE_NAMES.findIndex((note) => note.toLowerCase() === name);
    if (nameIndex < 0) return null;
    if (accidental === '#') nameIndex += 1;
    if (accidental === 'b') nameIndex -= 1;
    const octave = Number.parseInt(octaveText, 10);
    if (!Number.isFinite(octave)) return null;
    return (octave + 1) * 12 + ((nameIndex % 12) + 12) % 12;
  }

  return null;
}

/** 指定範囲のカラオケ表記一覧を返す（昇順・両端含む）。 */
export function getKaraokeNoteRange(from: MidiNote, to: MidiNote): string[] {
  const start = Math.max(KARAOKE_NOTE_MIN, Math.min(KARAOKE_NOTE_MAX, Math.round(Math.min(from, to))));
  const end = Math.max(KARAOKE_NOTE_MIN, Math.min(KARAOKE_NOTE_MAX, Math.round(Math.max(from, to))));
  const labels: string[] = [];
  for (let midi = start; midi <= end; midi += 1) {
    labels.push(midiToKaraokeNote(midi));
  }
  return labels;
}

/** サポート範囲のカラオケ表記一覧。 */
export function getAllKaraokeNotes(): string[] {
  return getKaraokeNoteRange(KARAOKE_NOTE_MIN, KARAOKE_NOTE_MAX);
}

/** 音域を「lowG〜hiC」のような文字列に整形する。 */
export function formatNoteRange(lowest: MidiNote, highest: MidiNote, separator = '〜'): string {
  return `${midiToKaraokeNote(lowest)}${separator}${midiToKaraokeNote(highest)}`;
}

/** キーシフトを適用した MIDI ノート番号を返す。 */
export function shiftMidiNote(midi: MidiNote, semitones: number): MidiNote {
  return midi + semitones;
}

/** MIDI ノート番号をサポート範囲に収める。 */
export function clampMidiNote(midi: MidiNote): MidiNote {
  if (!Number.isFinite(midi)) return KARAOKE_NOTE_MIN;
  return Math.max(KARAOKE_NOTE_MIN, Math.min(KARAOKE_NOTE_MAX, Math.round(midi)));
}

/** カラオケ表記として有効かどうか。 */
export function isValidKaraokeNote(label: string): boolean {
  return karaokeNoteToMidi(label) !== null;
}

/** サポート範囲の全ラベル（読み取り専用の配列コピー）。 */
export const KARAOKE_NOTE_LABELS: readonly string[] = getAllKaraokeNotes();
