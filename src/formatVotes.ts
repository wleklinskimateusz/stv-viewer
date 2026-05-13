const nf = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

export function formatVotes(n: number): string {
  return nf.format(n);
}
