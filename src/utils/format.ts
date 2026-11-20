/** 表示用の小さなフォーマット関数群。 */

/** キーシフトを「原キー / +2 / -3」形式に整形する。 */
export function formatKeyShift(shift: number): string {
  const rounded = Math.round(shift);
  if (rounded === 0) return '原キー';
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

/** ISO 8601 文字列を「yyyy/MM/dd」に整形する。不正な値は '-'。 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}
