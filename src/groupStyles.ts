export function groupClass(group: string): string {
  const g = group.trim().toUpperCase();
  if (g === 'M') return 'group-m';
  if (g === 'K') return 'group-k';
  if (g === 'X') return 'group-x';
  return 'group-other';
}
