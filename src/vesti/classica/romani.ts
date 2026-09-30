// Veste Classica: numeri romani per date e stagioni, come nei programmi di sala.

const SIMBOLI: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

// 2026 → "MMXXVI"
export function romano(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  let resto = Math.floor(n);
  let esito = '';
  for (const [valore, simbolo] of SIMBOLI) {
    while (resto >= valore) {
      esito += simbolo;
      resto -= valore;
    }
  }
  return esito;
}

// Sigla della stagione "26/27" → anni per esteso [2026, 2027]
export function anniStagione(sigla: string): number[] {
  return sigla
    .split('/')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n))
    .map((n) => (n < 100 ? 2000 + n : n));
}
