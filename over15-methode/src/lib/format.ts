const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (x: number) => eur.format(x);
export const signedMoney = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '') + eur.format(Math.abs(x));
export const pct = (x: number | null | undefined, digits = 0) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(digits).replace('.', ',')} %`;
export const signedPct = (x: number | null, digits = 1) =>
  x === null || !Number.isFinite(x) ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(digits).replace('.', ',')} %`;
export const odds = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(2).replace('.', ','));
export const num = (x: number, digits = 1) => x.toFixed(digits).replace('.', ',');

export function dateShort(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function timeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Lit un nombre saisi au clavier français (virgule acceptée). */
export function parseNum(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.');
  if (t === '' || t === '-' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function fmtInput(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return String(n).replace('.', ',');
}
