/**
 * Contrato de dados do editor Gráficos de Titulação.
 * Versão técnica preliminar 0.7 — sem dependência de DOM ou IndexedDB.
 */

export const TITRATION_PROJECT_FORMAT = "graficos-titulacao-project" as const;
export const TITRATION_PROJECT_SCHEMA_VERSION = 1 as const;

export type ProjectStage = "dados" | "grafico" | "exportacao";
export type CurveRepresentation = "pontos" | "segmentos" | "catmull-rom";
export type SeriesComparisonMode = "sobreposicao" | "separados";
export type UncertaintyInterpretation = "maximum-tolerance" | "standard-uncertainty";
export type UncertaintySource =
  | "manufacturer-specification"
  | "calibration"
  | "user-estimate"
  | "other";

/** A ausência é null; zero só existe quando foi informado expressamente. */
export interface InstrumentUncertainty {
  interpretation: UncertaintyInterpretation;
  value: number;
  source: UncertaintySource;
  note?: string;
}

/** Valores uniformes por projeto na v1; não há sobreposição por série/ponto ainda. */
export interface InstrumentUncertaintySettings {
  volume: InstrumentUncertainty | null;
  ph: InstrumentUncertainty | null;
  /** Hipótese explícita necessária para propagar incerteza-padrão. */
  standardPropagationAssumption: "not-configured" | "independent-first-order";
}

/** Texto de entrada original; não reordenar nem sobrescrever durante a geração. */
export interface MeasurementRecord {
  /** UUID estável, inclusive após inserir/remover outras linhas. */
  id: string;
  /** Identidade literal da série: comparação exata, sensível a caixa e espaços. */
  seriesName: string;
  /** Volume em mL como digitado; aceita vírgula ou ponto decimal. */
  volumeInput: string;
  /** pH como digitado. */
  phInput: string;
}

export interface ValidatedMeasurement {
  id: string;
  seriesName: string;
  volumeMl: number;
  ph: number;
  /** Posição no vetor original, começando em zero. */
  originalOrder: number;
}

export type RepeatedVolumeConnectionPolicy =
  | "connect-in-original-order"
  | "do-not-connect-equal-volume-pair";

export interface RepeatedVolumeDecision {
  /** A chave é o nome literal e case-sensitive da série. */
  seriesName: string;
  policy: RepeatedVolumeConnectionPolicy;
}

export interface ScientificSettings {
  validPhRange: { min: number; max: number };
  curveRepresentation: CurveRepresentation;
  comparisonMode: SeriesComparisonMode;
  instrumentUncertainty: InstrumentUncertaintySettings;
  repeatedVolumeDecisions: RepeatedVolumeDecision[];
}

export interface VisualSettings {
  showGrid: boolean;
  showUncertaintyBars: boolean;
  showGuideLines: boolean;
  displayDecimals: 3 | 4 | 5 | 6;
  seriesColors: Record<string, string>;
  hiddenSeries: string[];
  chartTitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
}

export interface AccessibilityPreferences {
  theme: "system" | "light" | "dark";
  highContrast: boolean;
  fontScale: number;
  extraTextSpacing: boolean;
  reducedMotion: boolean;
  colorVisionSimulation: "none" | "protanopia" | "deuteranopia" | "tritanopia" | "grayscale";
  vlibrasEnabled: boolean;
}

export interface ProjectPreferences {
  lastStage: ProjectStage;
  advancedPanelOpen: boolean;
  seriesPanelOpen: boolean;
  /** Exportada para portabilidade; não sobrescreve preferências globais sem consentimento. */
  accessibility: AccessibilityPreferences;
}

export interface ProjectRevisions {
  data: number;
  scientific: number;
}

export type GenerationWarningCode =
  | "volume-sorted-for-plot"
  | "repeated-volume-connection-selected"
  | "repeated-volume-needs-choice"
  | "interpolation-disabled-for-repeated-volume"
  | "interpolation-overshoot-fallback"
  | "interpolation-insufficient-points"
  | "uncertainty-not-available"
  | "uncertainty-types-mixed"
  | "uncertainty-denominator-includes-zero"
  | "uncertainty-propagation-not-configured"
  | "uncertainty-zero-width-domain"
  | "degenerate-axis-domain";

export interface GenerationWarning {
  code: GenerationWarningCode;
  message: string;
  seriesName?: string;
  measurementIds?: string[];
}

/** Snapshot contém somente dados validados e parâmetros científicos da geração. */
export interface GenerationSnapshot {
  id: string;
  /** Identifica a implementação matemática utilizada para gerar este resultado. */
  engineVersion: string;
  algorithmVersions: {
    catmullRom: "centripetal-alpha-0.5-local-range-guard-v1";
    axisTicks: "nice-1-2-5-v1";
    uncertainty: "interval-bounds-or-independent-first-order-v1";
  };
  generatedAt: string;
  sourceDataRevision: number;
  sourceScientificRevision: number;
  measurements: ValidatedMeasurement[];
  scientificSettings: ScientificSettings;
  warnings: GenerationWarning[];
}

export interface ProjectDocument {
  format: typeof TITRATION_PROJECT_FORMAT;
  schemaVersion: typeof TITRATION_PROJECT_SCHEMA_VERSION;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: { measurements: MeasurementRecord[] };
  scientificSettings: ScientificSettings;
  visualSettings: VisualSettings;
  preferences: ProjectPreferences;
  revisions: ProjectRevisions;
  latestGeneration: GenerationSnapshot | null;
}

export interface ValidationIssue {
  code: string;
  message: string;
  measurementId?: string;
  field?: "id" | "seriesName" | "volumeInput" | "phInput" | "validPhRange" | "uncertainty";
  blocking: boolean;
}

export interface ProjectValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  validMeasurementCount: number;
  incompleteMeasurementCount: number;
  invalidMeasurementCount: number;
  measurements: ValidatedMeasurement[];
}

export interface AxisScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
  degenerateFallback: boolean;
  extendedForUncertainty: boolean;
}

export interface GraphCoordinate {
  volumeMl: number;
  ph: number;
}

export interface SeriesGeometry {
  seriesName: string;
  measurements: ValidatedMeasurement[];
  representationUsed: CurveRepresentation;
  /** Cada item é uma polilinha independente, necessária para lacunas intencionais. */
  lineRuns: GraphCoordinate[][];
  repeatedVolumes: number[];
}

export type SlopeUncertaintyStatus =
  | "available-standard"
  | "available-interval"
  | "not-provided"
  | "incomplete"
  | "mixed-types"
  | "denominator-includes-zero"
  | "propagation-not-configured";

export interface SlopeMeasurement {
  seriesName: string;
  fromMeasurementId: string;
  toMeasurementId: string;
  fromVolumeMl: number;
  toVolumeMl: number;
  volumeMl: number;
  deltaPh: number;
  slopePhPerMl: number;
  uncertaintyStatus: SlopeUncertaintyStatus;
  standardUncertainty?: number;
  toleranceInterval?: { min: number; max: number };
  warning?: string;
}

export interface GenerationResult {
  snapshot: GenerationSnapshot | null;
  validation: ProjectValidationResult;
  warnings: GenerationWarning[];
  requiresRepeatedVolumeDecision: string[];
  series: SeriesGeometry[];
}

export interface ProjectRepository {
  list(): Promise<Array<Pick<ProjectDocument, "projectId" | "name" | "updatedAt">>>;
  get(projectId: string): Promise<ProjectDocument | null>;
  save(project: ProjectDocument): Promise<void>;
  delete(projectId: string): Promise<void>;
}

export interface ProjectCodec {
  export(project: ProjectDocument): string;
  import(serialized: string): Promise<{ project: ProjectDocument; warnings: string[] }>;
}
