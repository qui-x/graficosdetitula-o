/**
 * Núcleo tipado de leitura, validação e cálculo dos gráficos.
 * Mantém a convenção do editor: linhas vazias são ignoradas; linhas parcialmente
 * preenchidas são revisáveis; pontos fora do domínio são descartados.
 */
export interface RawMeasurement {
  series: string;
  volume: string;
  ph: string;
}

export interface ValidMeasurement {
  series: string;
  volume: number;
  ph: number;
  index: number;
}

export interface MeasurementSegment {
  series: string;
  points: ValidMeasurement[];
}

export interface SlopeMeasurement {
  series: string;
  volume: number;
  ph: number;
  slope: number;
  fromVolume: number;
  toVolume: number;
}

export interface MeasurementState {
  valid: ValidMeasurement[];
  incomplete: number;
  invalid: number;
}

/** Aceita ponto ou vírgula decimal; retorna null para vazio e NaN para inválido. */
export function parseLocaleNumber(value: unknown): number | null {
  const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : Number.NaN;
}

/** Valida leituras manualmente informadas, sem criar pontos nem curvas teóricas. */
export function validateMeasurementRows(rows: readonly RawMeasurement[]): MeasurementState {
  const valid: ValidMeasurement[] = [];
  let incomplete = 0;
  let invalid = 0;

  rows.forEach((row, index) => {
    const hasVolume = String(row.volume ?? "").trim() !== "";
    const hasPh = String(row.ph ?? "").trim() !== "";
    if (!hasVolume && !hasPh) return;

    const volume = parseLocaleNumber(row.volume);
    const ph = parseLocaleNumber(row.ph);
    if (volume === null || ph === null || Number.isNaN(volume) || Number.isNaN(ph)) {
      incomplete += 1;
      return;
    }
    if (volume < 0 || ph < 0 || ph > 14) {
      invalid += 1;
      return;
    }

    valid.push({
      series: String(row.series ?? "").trim() || "Série A",
      volume,
      ph,
      index
    });
  });

  return { valid, incomplete, invalid };
}

/** Divide séries quando muda o nome ou a sequência de volume volta para trás. */
export function groupConsecutiveSegments(
  validPoints: readonly ValidMeasurement[]
): MeasurementSegment[] {
  const segments: MeasurementSegment[] = [];
  for (const point of validPoints) {
    const last = segments.at(-1);
    const lastPoint = last?.points.at(-1);
    if (!last || last.series !== point.series || (lastPoint && point.volume < lastPoint.volume)) {
      segments.push({ series: point.series, points: [point] });
    } else {
      last.points.push(point);
    }
  }
  return segments;
}

/** Calcula ΔpH/ΔV somente entre leituras consecutivas com volumes distintos. */
export function calculateSlopes(segments: readonly MeasurementSegment[]): SlopeMeasurement[] {
  const slopes: SlopeMeasurement[] = [];
  for (const segment of segments) {
    for (let index = 1; index < segment.points.length; index += 1) {
      const previous = segment.points[index - 1]!;
      const current = segment.points[index]!;
      const deltaVolume = current.volume - previous.volume;
      if (deltaVolume <= 0) continue;
      slopes.push({
        series: segment.series,
        volume: current.volume,
        ph: current.ph,
        slope: (current.ph - previous.ph) / deltaVolume,
        fromVolume: previous.volume,
        toVolume: current.volume
      });
    }
  }
  return slopes;
}

/** Escolhe uma escala de marcações legível, baseada em 1, 2, 5 ou 10 × 10ⁿ. */
export function niceAxisStep(range: number, target = 5): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / (target || 5);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const scaled = raw / power;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * power;
}

/** Gera no máximo 121 marcações e arredonda ruído de ponto flutuante. */
export function createAxisTicks(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(step) || step <= 0) step = niceAxisStep(max - min, 6);
  const first = Math.ceil((min - 1e-10) / step) * step;
  const result: number[] = [];
  for (let value = first, guard = 0; value <= max + step * 1e-7 && guard < 121; value += step, guard += 1) {
    result.push(Number(value.toFixed(9)));
  }
  return result;
}
