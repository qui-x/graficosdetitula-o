import type {
  AxisScale,
  CurveRepresentation,
  GenerationResult,
  GenerationSnapshot,
  GenerationWarning,
  GraphCoordinate,
  InstrumentUncertainty,
  MeasurementRecord,
  ProjectDocument,
  ProjectValidationResult,
  RepeatedVolumeConnectionPolicy,
  ScientificSettings,
  SeriesGeometry,
  SlopeMeasurement,
  SlopeUncertaintyStatus,
  ValidatedMeasurement,
  ValidationIssue
} from "./titration-contract";

export const TITRATION_ENGINE_VERSION = "0.7.0" as const;
const DEFAULT_TARGET_TICKS = 6;
const MAX_AXIS_TICKS = 121;
const CATMULL_ROM_ALPHA = 0.5;
const CATMULL_ROM_SAMPLES_PER_SEGMENT = 64;
const NUMERIC_EPSILON_FACTOR = 1e-9;

/** Aceita vírgula ou ponto decimal, sem alterar o texto original armazenado. */
export function parseLocaleNumber(value: unknown): number | null {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (raw === "") return null;
  if (raw.includes(",") && raw.includes(".")) return Number.NaN;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function validUncertainty(value: InstrumentUncertainty | null, field: string): ValidationIssue[] {
  if (value === null) return [];
  if (!Number.isFinite(value.value) || value.value < 0) {
    return [{
      code: "invalid-uncertainty",
      message: `A incerteza de ${field} deve ser um número finito e não negativo.`,
      field: "uncertainty",
      blocking: true
    }];
  }
  return [];
}

/** Valida todas as linhas preenchidas. Linhas parciais são erros impeditivos. */
export function validateMeasurements(
  rows: readonly MeasurementRecord[],
  settings: ScientificSettings
): ProjectValidationResult {
  const issues: ValidationIssue[] = [];
  const measurements: ValidatedMeasurement[] = [];
  const ids = new Set<string>();
  let incompleteMeasurementCount = 0;
  let invalidMeasurementCount = 0;

  const { min, max } = settings.validPhRange;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    issues.push({
      code: "invalid-ph-range",
      message: "A faixa válida de pH precisa ter limites finitos e mínimo menor que máximo.",
      field: "validPhRange",
      blocking: true
    });
  }
  issues.push(...validUncertainty(settings.instrumentUncertainty.volume, "volume"));
  issues.push(...validUncertainty(settings.instrumentUncertainty.ph, "pH"));
  const repeatedDecisionNames = new Set<string>();
  for (const decision of settings.repeatedVolumeDecisions) {
    if (isBlank(decision.seriesName)) {
      issues.push({ code: "empty-repeated-volume-series", message: "A decisão de volume repetido precisa identificar a série.", field: "seriesName", blocking: true });
    } else if (repeatedDecisionNames.has(decision.seriesName)) {
      issues.push({ code: "duplicate-repeated-volume-decision", message: `Há mais de uma política configurada para a série "${decision.seriesName}".`, field: "seriesName", blocking: true });
    } else {
      repeatedDecisionNames.add(decision.seriesName);
    }
  }

  rows.forEach((row, originalOrder) => {
    const volumeBlank = isBlank(row.volumeInput);
    const phBlank = isBlank(row.phInput);
    const rowIssues: ValidationIssue[] = [];
    if (!row.id || isBlank(row.id)) {
      rowIssues.push({ code: "missing-measurement-id", message: "A medição não possui identificador estável.", measurementId: row.id, field: "id", blocking: true });
    } else if (ids.has(row.id)) {
      rowIssues.push({ code: "duplicate-measurement-id", message: "O identificador da medição está duplicado.", measurementId: row.id, field: "id", blocking: true });
    } else {
      ids.add(row.id);
    }
    if (volumeBlank && phBlank) {
      if (rowIssues.length) {
        invalidMeasurementCount += 1;
        issues.push(...rowIssues);
      }
      return;
    }
    if (isBlank(row.seriesName)) {
      rowIssues.push({ code: "missing-series-name", message: "Informe o nome da série.", measurementId: row.id, field: "seriesName", blocking: true });
    }
    if (volumeBlank || phBlank) {
      rowIssues.push({
        code: "incomplete-measurement",
        message: `Medição ${originalOrder + 1}: volume e pH são obrigatórios.`,
        measurementId: row.id,
        field: volumeBlank ? "volumeInput" : "phInput",
        blocking: true
      });
      incompleteMeasurementCount += 1;
      issues.push(...rowIssues);
      return;
    }

    const volume = parseLocaleNumber(row.volumeInput);
    const ph = parseLocaleNumber(row.phInput);
    if (volume === null || Number.isNaN(volume)) {
      rowIssues.push({ code: "invalid-volume", message: `Medição ${originalOrder + 1}: informe um volume numérico válido.`, measurementId: row.id, field: "volumeInput", blocking: true });
    } else if (volume < 0) {
      rowIssues.push({ code: "negative-volume", message: `Medição ${originalOrder + 1}: o volume não pode ser negativo.`, measurementId: row.id, field: "volumeInput", blocking: true });
    }
    if (ph === null || Number.isNaN(ph)) {
      rowIssues.push({ code: "invalid-ph", message: `Medição ${originalOrder + 1}: informe um pH numérico válido.`, measurementId: row.id, field: "phInput", blocking: true });
    } else if (Number.isFinite(min) && Number.isFinite(max) && (ph < min || ph > max)) {
      rowIssues.push({ code: "ph-out-of-range", message: `Medição ${originalOrder + 1}: pH fora da faixa configurada (${min} a ${max}).`, measurementId: row.id, field: "phInput", blocking: true });
    }

    if (rowIssues.length) {
      invalidMeasurementCount += 1;
      issues.push(...rowIssues);
      return;
    }
    measurements.push({ id: row.id, seriesName: row.seriesName, volumeMl: volume as number, ph: ph as number, originalOrder });
  });

  if (measurements.length === 0 && incompleteMeasurementCount === 0 && invalidMeasurementCount === 0) {
    issues.push({ code: "no-measurements", message: "Informe ao menos uma medição completa para gerar o gráfico.", blocking: true });
  }

  return {
    valid: issues.every(issue => !issue.blocking),
    issues,
    validMeasurementCount: measurements.length,
    incompleteMeasurementCount,
    invalidMeasurementCount,
    measurements
  };
}

/** Agrupa por nome literal (case-sensitive) e ordena apenas as cópias para plotagem. */
export function sortMeasurementsForPlot(
  measurements: readonly ValidatedMeasurement[]
): { bySeries: Map<string, ValidatedMeasurement[]>; sorted: boolean } {
  const source = new Map<string, ValidatedMeasurement[]>();
  for (const measurement of measurements) {
    const series = source.get(measurement.seriesName) ?? [];
    series.push(measurement);
    source.set(measurement.seriesName, series);
  }

  let changedOrder = false;
  const bySeries = new Map<string, ValidatedMeasurement[]>();
  for (const [name, series] of source) {
    for (let i = 1; i < series.length; i += 1) {
      if (series[i]!.volumeMl < series[i - 1]!.volumeMl) changedOrder = true;
    }
    bySeries.set(name, [...series].sort((a, b) => a.volumeMl - b.volumeMl || a.originalOrder - b.originalOrder));
  }
  return { bySeries, sorted: changedOrder };
}

export function findRepeatedVolumes(points: readonly ValidatedMeasurement[]): number[] {
  const seen = new Set<number>();
  const repeated = new Set<number>();
  for (const point of points) {
    if (seen.has(point.volumeMl)) repeated.add(point.volumeMl);
    else seen.add(point.volumeMl);
  }
  return [...repeated].sort((a, b) => a - b);
}

function policyForSeries(settings: ScientificSettings, seriesName: string): RepeatedVolumeConnectionPolicy | undefined {
  return settings.repeatedVolumeDecisions.find(decision => decision.seriesName === seriesName)?.policy;
}

function lineRunsForSegments(
  points: readonly ValidatedMeasurement[],
  policy: RepeatedVolumeConnectionPolicy | undefined
): GraphCoordinate[][] {
  if (points.length === 0) return [];
  if (policy === "connect-in-original-order") {
    return [points.map(point => ({ volumeMl: point.volumeMl, ph: point.ph }))];
  }
  if (policy === "do-not-connect-equal-volume-pair") {
    const runs: GraphCoordinate[][] = [];
    let current: GraphCoordinate[] = [{ volumeMl: points[0]!.volumeMl, ph: points[0]!.ph }];
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]!;
      const point = points[index]!;
      if (point.volumeMl === previous.volumeMl) {
        if (current.length > 0) runs.push(current);
        current = [{ volumeMl: point.volumeMl, ph: point.ph }];
      } else {
        current.push({ volumeMl: point.volumeMl, ph: point.ph });
      }
    }
    if (current.length > 0) runs.push(current);
    return runs;
  }
  return [points.map(point => ({ volumeMl: point.volumeMl, ph: point.ph }))];
}

type XY = { x: number; y: number };

function add(a: XY, b: XY): XY { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a: XY, b: XY): XY { return { x: a.x - b.x, y: a.y - b.y }; }
function mul(a: XY, k: number): XY { return { x: a.x * k, y: a.y * k }; }
function distance(a: XY, b: XY): number { return Math.hypot(b.x - a.x, b.y - a.y); }
function lerp(a: XY, b: XY, t: number): XY { return add(mul(a, 1 - t), mul(b, t)); }

function catmullRomPoint(p0: XY, p1: XY, p2: XY, p3: XY, u: number): XY {
  const t0 = 0;
  const t1 = t0 + Math.pow(distance(p0, p1), CATMULL_ROM_ALPHA);
  const t2 = t1 + Math.pow(distance(p1, p2), CATMULL_ROM_ALPHA);
  const t3 = t2 + Math.pow(distance(p2, p3), CATMULL_ROM_ALPHA);
  const span = t2 - t1;
  if (span <= Number.EPSILON || t1 <= t0 || t3 <= t2) return lerp(p1, p2, u);

  const m1 = add(
    sub(mul(sub(p1, p0), 1 / (t1 - t0)), mul(sub(p2, p0), 1 / (t2 - t0))),
    mul(sub(p2, p1), 1 / span)
  );
  const tangent1 = mul(m1, span);
  const m2 = add(
    sub(mul(sub(p2, p1), 1 / span), mul(sub(p3, p1), 1 / (t3 - t1))),
    mul(sub(p3, p2), 1 / (t3 - t2))
  );
  const tangent2 = mul(m2, span);

  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return add(add(mul(p1, h00), mul(tangent1, h10)), add(mul(p2, h01), mul(tangent2, h11)));
}

function sampleCentripetalCatmullRom(
  points: readonly ValidatedMeasurement[],
  samplesPerSegment = CATMULL_ROM_SAMPLES_PER_SEGMENT
): XY[][] {
  if (points.length < 3) return [];
  const xy = points.map(point => ({ x: point.volumeMl, y: point.ph }));
  const paths: XY[][] = [];
  for (let index = 0; index < xy.length - 1; index += 1) {
    const p1 = xy[index]!;
    const p2 = xy[index + 1]!;
    const p0 = index > 0
      ? xy[index - 1]!
      : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
    const p3 = index + 2 < xy.length
      ? xy[index + 2]!
      : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
    const segment: XY[] = [];
    for (let sample = index === 0 ? 0 : 1; sample <= samplesPerSegment; sample += 1) {
      segment.push(catmullRomPoint(p0, p1, p2, p3, sample / samplesPerSegment));
    }
    paths.push(segment);
  }
  return paths;
}

function isWithinPairRange(value: number, a: number, b: number): boolean {
  const tolerance = NUMERIC_EPSILON_FACTOR * Math.max(1, Math.abs(value), Math.abs(a), Math.abs(b));
  return value >= Math.min(a, b) - tolerance && value <= Math.max(a, b) + tolerance;
}

/**
 * Catmull–Rom centripetal (alpha=0.5). Cada amostra deve permanecer no intervalo
 * dos dois pontos que delimitam o segmento, sem excursões em X ou Y.
 */
export function validateCatmullRomShape(points: readonly ValidatedMeasurement[], samples?: XY[][]): boolean {
  if (points.length < 3 || points.some((point, index) => index > 0 && point.volumeMl <= points[index - 1]!.volumeMl)) return false;
  const sampled = samples ?? sampleCentripetalCatmullRom(points);
  if (sampled.length !== points.length - 1) return false;
  for (let index = 0; index < sampled.length; index += 1) {
    const previous = points[index]!;
    const current = points[index + 1]!;
    for (const sample of sampled[index]!) {
      if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y)) return false;
      if (!isWithinPairRange(sample.x, previous.volumeMl, current.volumeMl)) return false;
      if (!isWithinPairRange(sample.y, previous.ph, current.ph)) return false;
    }
  }
  return true;
}

function geometryForSeries(
  seriesName: string,
  points: ValidatedMeasurement[],
  representation: CurveRepresentation,
  policy: RepeatedVolumeConnectionPolicy | undefined,
  warnings: GenerationWarning[]
): SeriesGeometry {
  const repeatedVolumes = findRepeatedVolumes(points);
  if (representation === "pontos") {
    return { seriesName, measurements: points, representationUsed: "pontos", lineRuns: [], repeatedVolumes };
  }

  if (representation === "segmentos") {
    return {
      seriesName,
      measurements: points,
      representationUsed: "segmentos",
      lineRuns: lineRunsForSegments(points, policy),
      repeatedVolumes
    };
  }

  if (repeatedVolumes.length > 0) {
    warnings.push({
      code: "interpolation-disabled-for-repeated-volume",
      message: `A interpolação foi desabilitada para a série "${seriesName}" porque há volumes repetidos; segmentos retos serão usados.`,
      seriesName,
      measurementIds: points.filter(point => repeatedVolumes.includes(point.volumeMl)).map(point => point.id)
    });
    return {
      seriesName,
      measurements: points,
      representationUsed: "segmentos",
      lineRuns: lineRunsForSegments(points, policy),
      repeatedVolumes
    };
  }

  if (points.length < 3) {
    warnings.push({
      code: "interpolation-insufficient-points",
      message: `A série "${seriesName}" precisa de pelo menos três pontos para interpolação; segmentos retos serão usados.`,
      seriesName
    });
    return { seriesName, measurements: points, representationUsed: "segmentos", lineRuns: lineRunsForSegments(points, undefined), repeatedVolumes };
  }

  const sampled = sampleCentripetalCatmullRom(points);
  if (!validateCatmullRomShape(points, sampled)) {
    warnings.push({
      code: "interpolation-overshoot-fallback",
      message: `A curva Catmull–Rom da série "${seriesName}" ultrapassou os limites locais entre pontos; segmentos retos foram usados.`,
      seriesName
    });
    return { seriesName, measurements: points, representationUsed: "segmentos", lineRuns: lineRunsForSegments(points, undefined), repeatedVolumes };
  }

  return {
    seriesName,
    measurements: points,
    representationUsed: "catmull-rom",
    lineRuns: sampled.map(path => path.map(point => ({ volumeMl: point.x, ph: point.y }))),
    repeatedVolumes
  };
}

export function niceAxisStep(range: number, target = DEFAULT_TARGET_TICKS): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const raw = range / Math.max(1, target);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const scaled = raw / power;
  const factor = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return factor * power;
}

export function createAxisTicks(min: number, max: number, step: number): number[] {
  if (![min, max, step].every(Number.isFinite) || min > max || step <= 0) return [];
  const first = Math.ceil((min - Math.abs(step) * 1e-10) / step) * step;
  const ticks: number[] = [];
  for (let value = first, guard = 0; value <= max + step * 1e-8 && guard < MAX_AXIS_TICKS; value += step, guard += 1) {
    const precision = Math.min(12, Math.max(0, -Math.floor(Math.log10(step)) + 2));
    ticks.push(Number(value.toFixed(precision)));
  }
  return ticks;
}

function finiteExtents(values: readonly number[]): { min: number; max: number } | null {
  if (values.length === 0 || values.some(value => !Number.isFinite(value))) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Domínio sem margem decorativa. Quando as barras estão ligadas, os extremos
 * das incertezas são incluídos para que não sejam cortadas pelo eixo.
 */
export function calculateAxisScale(
  values: readonly number[],
  uncertainty: InstrumentUncertainty | null,
  showUncertaintyBars: boolean,
  options: { minimum?: number; maximum?: number; targetTicks?: number } = {}
): AxisScale | null {
  const extents = finiteExtents(values);
  if (!extents) return null;

  let min = extents.min;
  let max = extents.max;
  let extendedForUncertainty = false;
  if (showUncertaintyBars && uncertainty && uncertainty.value > 0) {
    const candidateMin = min - uncertainty.value;
    const candidateMax = max + uncertainty.value;
    extendedForUncertainty = candidateMin < min || candidateMax > max;
    min = candidateMin;
    max = candidateMax;
  }
  if (options.minimum !== undefined) min = Math.max(min, options.minimum);
  if (options.maximum !== undefined) max = Math.min(max, options.maximum);

  let degenerateFallback = false;
  if (min === max) {
    degenerateFallback = true;
    const step = niceAxisStep(Math.max(Math.abs(min) * 0.1, 1), options.targetTicks ?? DEFAULT_TARGET_TICKS);
    const half = step / 2;
    let lower = min - half;
    let upper = max + half;
    if (options.minimum !== undefined) lower = Math.max(lower, options.minimum);
    if (options.maximum !== undefined) upper = Math.min(upper, options.maximum);
    if (lower === upper && options.minimum !== undefined && options.maximum !== undefined) {
      lower = options.minimum;
      upper = options.maximum;
    }
    if (lower === upper) {
      lower = min - half;
      upper = max + half;
    }
    min = lower;
    max = upper;
  }

  if (!(min < max)) return null;
  let step = niceAxisStep(max - min, options.targetTicks ?? DEFAULT_TARGET_TICKS);
  if ((max - min) / step > MAX_AXIS_TICKS - 1) step = niceAxisStep(max - min, Math.floor(MAX_AXIS_TICKS / 2));
  return {
    min,
    max,
    step,
    ticks: createAxisTicks(min, max, step),
    degenerateFallback,
    extendedForUncertainty
  };
}

export interface UncertaintyBar {
  measurementId: string;
  volume: { min: number; max: number } | null;
  ph: { min: number; max: number } | null;
  volumeLabel: string | null;
  phLabel: string | null;
}

export function calculateUncertaintyBars(
  measurements: readonly ValidatedMeasurement[],
  settings: ScientificSettings["instrumentUncertainty"]
): UncertaintyBar[] {
  return measurements.map(measurement => {
    const volume = settings.volume;
    const ph = settings.ph;
    return {
      measurementId: measurement.id,
      volume: volume ? { min: measurement.volumeMl - volume.value, max: measurement.volumeMl + volume.value } : null,
      ph: ph ? { min: measurement.ph - ph.value, max: measurement.ph + ph.value } : null,
      volumeLabel: volume ? (volume.interpretation === "standard-uncertainty" ? "±u" : "± tolerância") : null,
      phLabel: ph ? (ph.interpretation === "standard-uncertainty" ? "±u" : "± tolerância") : null
    };
  });
}

function minMax(values: number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function calculateSlopeUncertainty(
  deltaPh: number,
  deltaVolume: number,
  uncertainty: ScientificSettings["instrumentUncertainty"]
): {
  status: SlopeUncertaintyStatus;
  standardUncertainty?: number;
  toleranceInterval?: { min: number; max: number };
  warning?: string;
} {
  const uPh = uncertainty.ph;
  const uVolume = uncertainty.volume;
  if (!uPh && !uVolume) return { status: "not-provided", warning: "Incertezas de pH e volume não informadas." };
  if (!uPh || !uVolume) return { status: "incomplete", warning: "A incerteza combinada da derivada requer valores para pH e volume." };
  if (uPh.interpretation !== uVolume.interpretation) {
    return { status: "mixed-types", warning: "Os tipos de incerteza de pH e volume são diferentes; não foi calculada uma incerteza combinada." };
  }

  if (uPh.interpretation === "standard-uncertainty") {
    if (uncertainty.standardPropagationAssumption !== "independent-first-order") {
      return { status: "propagation-not-configured", warning: "A propagação de incerteza-padrão depende da hipótese explícita de independência de primeira ordem." };
    }
    const uDeltaPh = Math.SQRT2 * uPh.value;
    const uDeltaVolume = Math.SQRT2 * uVolume.value;
    const slope = deltaPh / deltaVolume;
    const standardUncertainty = Math.sqrt(
      Math.pow(uDeltaPh / deltaVolume, 2) +
      Math.pow((deltaPh * uDeltaVolume) / (deltaVolume * deltaVolume), 2)
    );
    return { status: "available-standard", standardUncertainty };
  }

  const deltaPhTolerance = 2 * uPh.value;
  const deltaVolumeTolerance = 2 * uVolume.value;
  const denominatorMin = deltaVolume - deltaVolumeTolerance;
  const denominatorMax = deltaVolume + deltaVolumeTolerance;
  if (denominatorMin <= 0 && denominatorMax >= 0) {
    return {
      status: "denominator-includes-zero",
      warning: "O intervalo possível de ΔV inclui zero; a incerteza da razão não pode ser representada por um intervalo finito."
    };
  }
  const numeratorMin = deltaPh - deltaPhTolerance;
  const numeratorMax = deltaPh + deltaPhTolerance;
  const candidates = [
    numeratorMin / denominatorMin,
    numeratorMin / denominatorMax,
    numeratorMax / denominatorMin,
    numeratorMax / denominatorMax
  ];
  return { status: "available-interval", toleranceInterval: minMax(candidates) };
}

export function calculateSlopes(
  measurements: readonly ValidatedMeasurement[],
  uncertainty: ScientificSettings["instrumentUncertainty"]
): SlopeMeasurement[] {
  const grouped = sortMeasurementsForPlot(measurements).bySeries;
  const slopes: SlopeMeasurement[] = [];
  for (const [seriesName, points] of grouped) {
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]!;
      const current = points[index]!;
      const deltaVolume = current.volumeMl - previous.volumeMl;
      if (deltaVolume <= 0) continue;
      const deltaPh = current.ph - previous.ph;
      const uncertaintyResult = calculateSlopeUncertainty(deltaPh, deltaVolume, uncertainty);
      slopes.push({
        seriesName,
        fromMeasurementId: previous.id,
        toMeasurementId: current.id,
        fromVolumeMl: previous.volumeMl,
        toVolumeMl: current.volumeMl,
        volumeMl: current.volumeMl,
        deltaPh,
        slopePhPerMl: deltaPh / deltaVolume,
        uncertaintyStatus: uncertaintyResult.status,
        standardUncertainty: uncertaintyResult.standardUncertainty,
        toleranceInterval: uncertaintyResult.toleranceInterval,
        warning: uncertaintyResult.warning
      });
    }
  }
  return slopes;
}

export interface GenerateOptions {
  generationId: string;
  generatedAt: string;
  dataRevision: number;
  scientificRevision: number;
}

export function generateTitrationGraph(
  project: ProjectDocument,
  options: GenerateOptions
): GenerationResult {
  const validation = validateMeasurements(project.data.measurements, project.scientificSettings);
  const warnings: GenerationWarning[] = [];
  if (!validation.valid) {
    return { snapshot: null, validation, warnings, requiresRepeatedVolumeDecision: [], series: [] };
  }

  const sorted = sortMeasurementsForPlot(validation.measurements);
  if (sorted.sorted) {
    warnings.push({
      code: "volume-sorted-for-plot",
      message: "As medições foram ordenadas por volume somente na representação gráfica; a tabela mantém a ordem original."
    });
  }

  const requiresRepeatedVolumeDecision: string[] = [];
  for (const [seriesName, points] of sorted.bySeries) {
    const representationNeedsConnectionChoice =
      project.scientificSettings.curveRepresentation === "segmentos" ||
      project.scientificSettings.curveRepresentation === "catmull-rom";
    if (!representationNeedsConnectionChoice) continue;
    if (findRepeatedVolumes(points).length > 0 && !policyForSeries(project.scientificSettings, seriesName)) {
      requiresRepeatedVolumeDecision.push(seriesName);
      warnings.push({
        code: "repeated-volume-needs-choice",
        message: `Escolha como conectar os pontos de volume repetido na série "${seriesName}".`,
        seriesName,
        measurementIds: points.map(point => point.id)
      });
    }
  }
  if (requiresRepeatedVolumeDecision.length > 0) {
    return { snapshot: null, validation, warnings, requiresRepeatedVolumeDecision, series: [] };
  }

  for (const [seriesName, points] of sorted.bySeries) {
    if (findRepeatedVolumes(points).length > 0 && policyForSeries(project.scientificSettings, seriesName)) {
      warnings.push({
        code: "repeated-volume-connection-selected",
        message: `A política de conexão para volumes repetidos foi aplicada na série "${seriesName}".`,
        seriesName
      });
    }
  }

  const series: SeriesGeometry[] = [];
  for (const [seriesName, points] of sorted.bySeries) {
    series.push(geometryForSeries(
      seriesName,
      points,
      project.scientificSettings.curveRepresentation,
      policyForSeries(project.scientificSettings, seriesName),
      warnings
    ));
  }

  const snapshot: GenerationSnapshot = {
    id: options.generationId,
    engineVersion: TITRATION_ENGINE_VERSION,
    algorithmVersions: {
      catmullRom: "centripetal-alpha-0.5-local-range-guard-v1",
      axisTicks: "nice-1-2-5-v1",
      uncertainty: "interval-bounds-or-independent-first-order-v1"
    },
    generatedAt: options.generatedAt,
    sourceDataRevision: options.dataRevision,
    sourceScientificRevision: options.scientificRevision,
    measurements: validation.measurements.map(measurement => ({ ...measurement })),
    scientificSettings: structuredClone(project.scientificSettings),
    warnings: warnings.map(warning => ({ ...warning }))
  };
  return { snapshot, validation, warnings, requiresRepeatedVolumeDecision, series };
}

export function isGenerationStale(project: ProjectDocument): boolean {
  const snapshot = project.latestGeneration;
  if (!snapshot) return false;
  return snapshot.sourceDataRevision !== project.revisions.data ||
    snapshot.sourceScientificRevision !== project.revisions.scientific;
}

export function calculateProjectAxisScales(
  measurements: readonly ValidatedMeasurement[],
  uncertainty: ScientificSettings["instrumentUncertainty"],
  showUncertaintyBars: boolean,
  mode: "sobreposicao" | "separados",
  visibleSeries?: readonly string[]
): Map<string, { volume: AxisScale; ph: AxisScale }> {
  const groups = sortMeasurementsForPlot(measurements).bySeries;
  const filtered = new Map([...groups].filter(([name]) => !visibleSeries || visibleSeries.includes(name)));
  const result = new Map<string, { volume: AxisScale; ph: AxisScale }>();
  if (mode === "sobreposicao") {
    const all = [...filtered.values()].flat();
    const volumeBarsExtendDomain = showUncertaintyBars && Boolean(uncertainty.volume && uncertainty.volume.value > 0);
    const x = calculateAxisScale(
      all.map(point => point.volumeMl), uncertainty.volume, showUncertaintyBars,
      volumeBarsExtendDomain ? {} : { minimum: 0 }
    );
    const y = calculateAxisScale(
      all.map(point => point.ph), uncertainty.ph, showUncertaintyBars
    );
    if (x && y) result.set("__all__", { volume: x, ph: y });
    return result;
  }
  for (const [name, points] of filtered) {
    const volumeBarsExtendDomain = showUncertaintyBars && Boolean(uncertainty.volume && uncertainty.volume.value > 0);
    const x = calculateAxisScale(
      points.map(point => point.volumeMl), uncertainty.volume, showUncertaintyBars,
      volumeBarsExtendDomain ? {} : { minimum: 0 }
    );
    const y = calculateAxisScale(points.map(point => point.ph), uncertainty.ph, showUncertaintyBars);
    if (x && y) result.set(name, { volume: x, ph: y });
  }
  return result;
}

export function getSlopeUncertaintySummary(slopes: readonly SlopeMeasurement[]): {
  availableStandard: number;
  availableIntervals: number;
  unavailable: number;
} {
  return {
    availableStandard: slopes.filter(slope => slope.uncertaintyStatus === "available-standard").length,
    availableIntervals: slopes.filter(slope => slope.uncertaintyStatus === "available-interval").length,
    unavailable: slopes.filter(slope => !["available-standard", "available-interval"].includes(slope.uncertaintyStatus)).length
  };
}

/** Type guard useful to importers before applying a project document. */
export function hasValidScientificSettings(settings: ScientificSettings): boolean {
  const { min, max } = settings.validPhRange;
  const validValue = (value: InstrumentUncertainty | null) => value === null ||
    (Number.isFinite(value.value) && value.value >= 0);
  return Number.isFinite(min) && Number.isFinite(max) && min < max &&
    validValue(settings.instrumentUncertainty.volume) && validValue(settings.instrumentUncertainty.ph);
}
