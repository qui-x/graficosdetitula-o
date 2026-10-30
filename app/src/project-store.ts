import {
  TITRATION_PROJECT_FORMAT,
  TITRATION_PROJECT_SCHEMA_VERSION,
  type AccessibilityPreferences,
  type GenerationSnapshot,
  type InstrumentUncertainty,
  type ProjectDocument,
  type ProjectRepository,
  type ScientificSettings
} from "./titration-contract";

export const PROJECT_FALLBACK_STORAGE_KEY = "graficos_investigacao_projects_fallback_v1";
export const PROJECT_DATABASE_NAME = "graficos-investigacao-projects";
export const PROJECT_DATABASE_VERSION = 1;
const PROJECT_STORE_NAME = "projects";
const MAX_PROJECTS = 500;
const MAX_MEASUREMENTS = 20_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export type ProjectStorageMode = "indexeddb" | "localStorage";

export interface OpenProjectRepositoryResult {
  repository: ProjectRepository;
  mode: ProjectStorageMode;
  warning: string | null;
}

export interface ProjectValidationResult {
  valid: boolean;
  issues: string[];
  project: ProjectDocument | null;
}

export interface ProjectImportResult {
  project: ProjectDocument;
  warnings: string[];
}

export interface ProjectListItem {
  projectId: string;
  name: string;
  updatedAt: string;
  measurementCount: number;
  seriesCount: number;
}

export function createUuid(): string {
  const cryptoApi = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();

  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join("-");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isDateTime(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function hasNonWhitespace(value: string): boolean {
  return /\S/.test(value);
}

function validText(value: unknown, max: number, allowEmpty = true): value is string {
  return typeof value === "string" && value.length <= max && (allowEmpty || (value.length > 0 && hasNonWhitespace(value)));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isInstrumentUncertainty(value: unknown): value is InstrumentUncertainty | null {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (
    (value.interpretation === "maximum-tolerance" || value.interpretation === "standard-uncertainty") &&
    typeof value.value === "number" &&
    Number.isFinite(value.value) &&
    value.value >= 0 &&
    ["manufacturer-specification", "calibration", "user-estimate", "other"].includes(String(value.source)) &&
    (value.note === undefined || validText(value.note, 500))
  );
}

function isScientificSettings(value: unknown): value is ScientificSettings {
  if (!isRecord(value) || !isRecord(value.validPhRange) || !isRecord(value.instrumentUncertainty)) return false;
  const range = value.validPhRange;
  const uncertainty = value.instrumentUncertainty;
  if (
    typeof range.min !== "number" ||
    typeof range.max !== "number" ||
    !Number.isFinite(range.min) ||
    !Number.isFinite(range.max) ||
    range.min >= range.max
  ) return false;
  if (!isInstrumentUncertainty(uncertainty.volume) || !isInstrumentUncertainty(uncertainty.ph)) return false;
  if (!["not-configured", "independent-first-order"].includes(String(uncertainty.standardPropagationAssumption))) return false;
  if (!["pontos", "segmentos", "catmull-rom"].includes(String(value.curveRepresentation))) return false;
  if (!["sobreposicao", "separados"].includes(String(value.comparisonMode))) return false;
  if (!Array.isArray(value.repeatedVolumeDecisions)) return false;

  const seenSeries = new Set<string>();
  for (const decision of value.repeatedVolumeDecisions) {
    if (!isRecord(decision) || !validText(decision.seriesName, 80, false)) return false;
    if (!["connect-in-original-order", "do-not-connect-equal-volume-pair"].includes(String(decision.policy))) return false;
    if (seenSeries.has(decision.seriesName)) return false;
    seenSeries.add(decision.seriesName);
  }
  return true;
}

function isAccessibilityPreferences(value: unknown): value is AccessibilityPreferences {
  if (!isRecord(value)) return false;
  return (
    ["system", "light", "dark"].includes(String(value.theme)) &&
    typeof value.highContrast === "boolean" &&
    typeof value.fontScale === "number" &&
    Number.isFinite(value.fontScale) &&
    value.fontScale >= 0.8 &&
    value.fontScale <= 2 &&
    typeof value.extraTextSpacing === "boolean" &&
    typeof value.reducedMotion === "boolean" &&
    ["none", "protanopia", "deuteranopia", "tritanopia", "grayscale"].includes(String(value.colorVisionSimulation)) &&
    typeof value.vlibrasEnabled === "boolean"
  );
}

function isSnapshot(value: unknown): value is GenerationSnapshot | null {
  if (value === null) return true;
  if (!isRecord(value) || !isRecord(value.algorithmVersions)) return false;
  if (
    !isUuid(value.id) ||
    !validText(value.engineVersion, 40, false) ||
    !isDateTime(value.generatedAt) ||
    !Number.isInteger(value.sourceDataRevision) ||
    Number(value.sourceDataRevision) < 0 ||
    !Number.isInteger(value.sourceScientificRevision) ||
    Number(value.sourceScientificRevision) < 0 ||
    !Array.isArray(value.measurements) ||
    value.measurements.length === 0 ||
    value.measurements.length > MAX_MEASUREMENTS ||
    !isScientificSettings(value.scientificSettings) ||
    !Array.isArray(value.warnings)
  ) return false;
  const versions = value.algorithmVersions;
  if (
    versions.catmullRom !== "centripetal-alpha-0.5-local-range-guard-v1" ||
    versions.axisTicks !== "nice-1-2-5-v1" ||
    versions.uncertainty !== "interval-bounds-or-independent-first-order-v1"
  ) return false;

  const ids = new Set<string>();
  for (const measurement of value.measurements) {
    if (
      !isRecord(measurement) ||
      !isUuid(measurement.id) ||
      ids.has(measurement.id) ||
      !validText(measurement.seriesName, 80, false) ||
      typeof measurement.volumeMl !== "number" ||
      !Number.isFinite(measurement.volumeMl) ||
      measurement.volumeMl < 0 ||
      typeof measurement.ph !== "number" ||
      !Number.isFinite(measurement.ph) ||
      !Number.isInteger(measurement.originalOrder) ||
      Number(measurement.originalOrder) < 0
    ) return false;
    ids.add(measurement.id);
  }
  for (const warning of value.warnings) {
    if (!isRecord(warning) || !validText(warning.code, 80, false) || !validText(warning.message, 1000, false)) return false;
    if (warning.seriesName !== undefined && !validText(warning.seriesName, 80)) return false;
    if (warning.measurementIds !== undefined && (!Array.isArray(warning.measurementIds) || warning.measurementIds.some(id => !isUuid(id)))) return false;
  }
  return true;
}

export function validateProjectDocument(value: unknown): ProjectValidationResult {
  const issues: string[] = [];
  if (!isRecord(value)) return { valid: false, issues: ["O conteúdo JSON precisa ser um objeto."], project: null };

  if (value.format !== TITRATION_PROJECT_FORMAT) issues.push("O campo format não identifica um projeto deste editor.");
  if (value.schemaVersion !== TITRATION_PROJECT_SCHEMA_VERSION) {
    issues.push("Versão do projeto não suportada. Esta versão do editor aceita schemaVersion 1.");
  }
  if (!isUuid(value.projectId)) issues.push("projectId precisa ser um UUID válido.");
  if (!validText(value.name, 120, false)) issues.push("O nome do projeto deve conter texto e ter até 120 caracteres.");
  if (!isDateTime(value.createdAt)) issues.push("createdAt precisa ser uma data/hora válida.");
  if (!isDateTime(value.updatedAt)) issues.push("updatedAt precisa ser uma data/hora válida.");

  if (!isRecord(value.data) || !Array.isArray(value.data.measurements)) {
    issues.push("data.measurements precisa ser uma lista.");
  } else {
    const measurements = value.data.measurements;
    if (measurements.length > MAX_MEASUREMENTS) issues.push("O projeto ultrapassa o limite de 20.000 medições.");
    const ids = new Set<string>();
    measurements.forEach((measurement, index) => {
      if (!isRecord(measurement)) {
        issues.push("Medição " + (index + 1) + " precisa ser um objeto.");
        return;
      }
      if (!isUuid(measurement.id)) issues.push("Medição " + (index + 1) + " possui ID inválido.");
      else if (ids.has(measurement.id)) issues.push("O ID da medição " + (index + 1) + " está duplicado.");
      else ids.add(measurement.id);
      if (!validText(measurement.seriesName, 80, false)) issues.push("Medição " + (index + 1) + " possui nome de série vazio ou longo demais.");
      if (!validText(measurement.volumeInput, 80)) issues.push("Volume da medição " + (index + 1) + " inválido.");
      if (!validText(measurement.phInput, 80)) issues.push("pH da medição " + (index + 1) + " inválido.");
    });
  }

  if (!isScientificSettings(value.scientificSettings)) issues.push("As configurações científicas do projeto não seguem o contrato.");
  if (!isRecord(value.visualSettings)) {
    issues.push("visualSettings precisa ser um objeto.");
  } else {
    const visual = value.visualSettings;
    if (
      typeof visual.showGrid !== "boolean" ||
      typeof visual.showUncertaintyBars !== "boolean" ||
      typeof visual.showGuideLines !== "boolean" ||
      ![3, 4, 5, 6].includes(Number(visual.displayDecimals)) ||
      !isRecord(visual.seriesColors) ||
      !Array.isArray(visual.hiddenSeries) ||
      !validText(visual.chartTitle, 120) ||
      !validText(visual.xAxisLabel, 80) ||
      !validText(visual.yAxisLabel, 80)
    ) issues.push("Os campos básicos de visualSettings são inválidos.");

    if (isRecord(visual.seriesColors)) {
      Object.entries(visual.seriesColors).forEach(([name, color]) => {
        if (!validText(name, 80, false) || typeof color !== "string" || !COLOR_PATTERN.test(color)) {
          issues.push("Há uma cor de série inválida.");
        }
      });
    }
    if (Array.isArray(visual.hiddenSeries)) {
      const hidden = new Set<string>();
      visual.hiddenSeries.forEach(name => {
        if (!validText(name, 80, false)) issues.push("Há um nome inválido em hiddenSeries.");
        else if (hidden.has(name)) issues.push("hiddenSeries contém um nome duplicado.");
        else hidden.add(name);
      });
    }
    if (visual.seriesCatalog !== undefined) {
      if (!Array.isArray(visual.seriesCatalog) || visual.seriesCatalog.length > 200) {
        issues.push("seriesCatalog precisa ser uma lista com até 200 séries.");
      } else {
        const names = new Set<string>();
        visual.seriesCatalog.forEach(name => {
          if (!validText(name, 80, false)) issues.push("O catálogo contém um nome vazio ou longo demais.");
          else if (names.has(name)) issues.push("O catálogo contém um nome de série repetido.");
          else names.add(name);
        });
      }
    }
    if (visual.chartControls !== undefined) {
      const controls = visual.chartControls;
      if (
        !isRecord(controls) ||
        !["curve", "derivative"].includes(String(controls.currentView)) ||
        !validText(controls.entrySeriesName, 80) ||
        !isRecord(controls.settings) ||
        Object.keys(controls.settings).length > 40 ||
        Object.values(controls.settings).some(setting => typeof setting !== "string" && typeof setting !== "boolean")
      ) issues.push("chartControls não segue o contrato do editor.");
    }
  }

  if (!isRecord(value.preferences)) {
    issues.push("preferences precisa ser um objeto.");
  } else {
    const preferences = value.preferences;
    if (
      !["dados", "grafico", "exportacao"].includes(String(preferences.lastStage)) ||
      typeof preferences.advancedPanelOpen !== "boolean" ||
      typeof preferences.seriesPanelOpen !== "boolean" ||
      !isAccessibilityPreferences(preferences.accessibility)
    ) issues.push("As preferências do projeto são inválidas.");
  }

  if (
    !isRecord(value.revisions) ||
    !Number.isInteger(value.revisions.data) ||
    Number(value.revisions.data) < 0 ||
    !Number.isInteger(value.revisions.scientific) ||
    Number(value.revisions.scientific) < 0
  ) issues.push("As revisões do projeto precisam ser inteiros não negativos.");

  if (value.latestGeneration !== null && !isSnapshot(value.latestGeneration)) {
    issues.push("O snapshot da última geração não segue o contrato.");
  }

  return issues.length === 0
    ? { valid: true, issues: [], project: clone(value) as unknown as ProjectDocument }
    : { valid: false, issues, project: null };
}

export function createEmptyProjectDocument(
  name: string,
  options: { now?: string; projectId?: string; accessibility?: AccessibilityPreferences } = {}
): ProjectDocument {
  const normalizedName = String(name ?? "").trim();
  if (!validText(normalizedName, 120, false)) {
    throw new Error("Informe um nome de projeto com até 120 caracteres.");
  }
  const now = options.now ?? new Date().toISOString();
  const project: ProjectDocument = {
    format: TITRATION_PROJECT_FORMAT,
    schemaVersion: TITRATION_PROJECT_SCHEMA_VERSION,
    projectId: options.projectId ?? createUuid(),
    name: normalizedName,
    createdAt: now,
    updatedAt: now,
    data: { measurements: [] },
    scientificSettings: {
      validPhRange: { min: 0, max: 14 },
      curveRepresentation: "segmentos",
      comparisonMode: "sobreposicao",
      instrumentUncertainty: {
        volume: null,
        ph: null,
        standardPropagationAssumption: "not-configured"
      },
      repeatedVolumeDecisions: []
    },
    visualSettings: {
      seriesCatalog: ["Série A"],
      chartControls: {
        currentView: "curve",
        entrySeriesName: "Série A",
        settings: {}
      },
      showGrid: true,
      showUncertaintyBars: false,
      showGuideLines: false,
      displayDecimals: 3,
      seriesColors: {},
      hiddenSeries: [],
      chartTitle: "pH medido por volume adicionado",
      xAxisLabel: "Volume adicionado (mL)",
      yAxisLabel: "pH medido"
    },
    preferences: {
      lastStage: "dados",
      advancedPanelOpen: false,
      seriesPanelOpen: true,
      accessibility: options.accessibility ?? {
        theme: "dark",
        highContrast: false,
        fontScale: 1,
        extraTextSpacing: false,
        reducedMotion: false,
        colorVisionSimulation: "none",
        vlibrasEnabled: false
      }
    },
    revisions: { data: 0, scientific: 0 },
    latestGeneration: null
  };
  const validation = validateProjectDocument(project);
  if (!validation.valid) throw new Error(validation.issues.join(" "));
  return project;
}

export function duplicateProjectDocument(
  source: ProjectDocument,
  name: string,
  options: { now?: string; projectId?: string } = {}
): ProjectDocument {
  const copy = clone(source);
  const now = options.now ?? new Date().toISOString();
  copy.projectId = options.projectId ?? createUuid();
  copy.name = String(name ?? "").trim();
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.revisions = { ...source.revisions };
  const validation = validateProjectDocument(copy);
  if (!validation.valid) throw new Error(validation.issues.join(" "));
  return validation.project!;
}

export function exportProjectDocument(project: ProjectDocument): string {
  const validation = validateProjectDocument(project);
  if (!validation.valid || !validation.project) {
    throw new Error("O projeto não pode ser exportado: " + validation.issues.join(" "));
  }
  return JSON.stringify(validation.project, null, 2);
}

export function importProjectDocument(serialized: string): ProjectImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("O arquivo não contém JSON válido.");
  }
  if (isRecord(parsed) && parsed.schemaVersion !== undefined && parsed.schemaVersion !== TITRATION_PROJECT_SCHEMA_VERSION) {
    const version = String(parsed.schemaVersion);
    throw new Error("Versão de projeto " + version + " não suportada por esta versão do editor.");
  }
  const validation = validateProjectDocument(parsed);
  if (!validation.valid || !validation.project) {
    throw new Error("O arquivo não é um projeto válido:\n" + validation.issues.map(issue => "• " + issue).join("\n"));
  }
  return { project: validation.project, warnings: [] };
}

function transactionResult<T>(transaction: IDBTransaction, request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let value: T;
    let requestSucceeded = false;
    let transactionCompleted = false;
    let settled = false;

    const finish = () => {
      if (settled || !requestSucceeded || !transactionCompleted) return;
      settled = true;
      resolve(value);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error("A transação do IndexedDB falhou."));
    };

    request.onsuccess = () => {
      value = request.result;
      requestSucceeded = true;
      finish();
    };
    request.onerror = () => fail(request.error ?? new Error("Não foi possível acessar o registro."));
    transaction.oncomplete = () => {
      transactionCompleted = true;
      finish();
    };
    transaction.onerror = () => fail(transaction.error ?? new Error("A transação do IndexedDB falhou."));
    transaction.onabort = () => fail(transaction.error ?? new Error("A transação do IndexedDB foi cancelada."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("A transação do IndexedDB falhou."));
    transaction.onabort = () => reject(transaction.error ?? new Error("A transação do IndexedDB foi cancelada."));
  });
}

export class IndexedDbProjectRepository implements ProjectRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly factory: IDBFactory,
    private readonly databaseName = PROJECT_DATABASE_NAME
  ) {}

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.factory.open(this.databaseName, PROJECT_DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROJECT_STORE_NAME)) {
          const store = database.createObjectStore(PROJECT_STORE_NAME, { keyPath: "projectId" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          this.databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => {
        this.databasePromise = null;
        reject(request.error ?? new Error("Não foi possível abrir o IndexedDB."));
      };
      request.onblocked = () => {
        this.databasePromise = null;
        reject(new Error("O banco de projetos está bloqueado por outra aba. Feche abas antigas e tente novamente."));
      };
    });
    return this.databasePromise;
  }

  async list(): Promise<Array<Pick<ProjectDocument, "projectId" | "name" | "updatedAt">>> {
    const database = await this.openDatabase();
    const transaction = database.transaction(PROJECT_STORE_NAME, "readonly");
    const request = transaction.objectStore(PROJECT_STORE_NAME).getAll();
    const projects = await transactionResult(transaction, request) as ProjectDocument[];
    return projects
      .map(project => ({ projectId: project.projectId, name: project.name, updatedAt: project.updatedAt }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async get(projectId: string): Promise<ProjectDocument | null> {
    const database = await this.openDatabase();
    const transaction = database.transaction(PROJECT_STORE_NAME, "readonly");
    const request = transaction.objectStore(PROJECT_STORE_NAME).get(projectId);
    const project = await transactionResult(transaction, request) as ProjectDocument | undefined;
    return project ? clone(project) : null;
  }

  async save(project: ProjectDocument): Promise<void> {
    const validation = validateProjectDocument(project);
    if (!validation.valid || !validation.project) throw new Error("Projeto inválido: " + validation.issues.join(" "));
    const database = await this.openDatabase();
    const transaction = database.transaction(PROJECT_STORE_NAME, "readwrite");
    const request = transaction.objectStore(PROJECT_STORE_NAME).put(validation.project);
    await transactionResult(transaction, request);
  }

  async delete(projectId: string): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(PROJECT_STORE_NAME, "readwrite");
    const request = transaction.objectStore(PROJECT_STORE_NAME).delete(projectId);
    await transactionResult(transaction, request);
  }
}

export class LocalStorageProjectRepository implements ProjectRepository {
  constructor(
    private readonly storage: Storage,
    private readonly key = PROJECT_FALLBACK_STORAGE_KEY
  ) {}

  private readAll(): ProjectDocument[] {
    const serialized = this.storage.getItem(this.key);
    if (!serialized) return [];
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) throw new Error("A lista local de projetos está corrompida.");
    const projects: ProjectDocument[] = [];
    for (const item of parsed) {
      const validation = validateProjectDocument(item);
      if (!validation.valid || !validation.project) throw new Error("Há um projeto inválido no armazenamento local.");
      projects.push(validation.project);
    }
    return projects;
  }

  private writeAll(projects: ProjectDocument[]): void {
    this.storage.setItem(this.key, JSON.stringify(projects));
  }

  async list(): Promise<Array<Pick<ProjectDocument, "projectId" | "name" | "updatedAt">>> {
    return this.readAll()
      .map(project => ({ projectId: project.projectId, name: project.name, updatedAt: project.updatedAt }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async get(projectId: string): Promise<ProjectDocument | null> {
    const project = this.readAll().find(item => item.projectId === projectId);
    return project ? clone(project) : null;
  }

  async save(project: ProjectDocument): Promise<void> {
    const validation = validateProjectDocument(project);
    if (!validation.valid || !validation.project) throw new Error("Projeto inválido: " + validation.issues.join(" "));
    const projects = this.readAll();
    const index = projects.findIndex(item => item.projectId === project.projectId);
    if (index >= 0) projects[index] = validation.project;
    else {
      if (projects.length >= MAX_PROJECTS) throw new Error("O armazenamento local atingiu o limite de projetos.");
      projects.push(validation.project);
    }
    this.writeAll(projects);
  }

  async delete(projectId: string): Promise<void> {
    this.writeAll(this.readAll().filter(project => project.projectId !== projectId));
  }
}

export async function openProjectRepository(): Promise<OpenProjectRepositoryResult> {
  if (typeof indexedDB !== "undefined") {
    const repository = new IndexedDbProjectRepository(indexedDB);
    try {
      await repository.list();
      return { repository, mode: "indexeddb", warning: null };
    } catch (error) {
      const fallbackWarning = error instanceof Error ? error.message : "IndexedDB indisponível.";
      try {
        return {
          repository: new LocalStorageProjectRepository(localStorage),
          mode: "localStorage",
          warning: "IndexedDB indisponível; usando armazenamento local alternativo. " + fallbackWarning
        };
      } catch {
        throw new Error("Não foi possível abrir o armazenamento de projetos. Exporte os dados disponíveis antes de fechar esta página.");
      }
    }
  }

  try {
    return {
      repository: new LocalStorageProjectRepository(localStorage),
      mode: "localStorage",
      warning: "Este navegador não oferece IndexedDB; os projetos serão guardados no armazenamento local alternativo."
    };
  } catch {
    throw new Error("Este navegador não oferece um armazenamento local disponível para os projetos.");
  }
}

export function buildProjectListItems(projects: ProjectDocument[]): ProjectListItem[] {
  return projects.map(project => ({
    projectId: project.projectId,
    name: project.name,
    updatedAt: project.updatedAt,
    measurementCount: project.data.measurements.length,
    seriesCount: project.visualSettings.seriesCatalog?.length ??
      new Set(project.data.measurements.map(measurement => measurement.seriesName)).size
  })).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function projectWithName(project: ProjectDocument, name: string, now = new Date().toISOString()): ProjectDocument {
  const normalized = String(name ?? "").trim();
  if (!validText(normalized, 120, false)) throw new Error("O nome do projeto deve conter texto e ter até 120 caracteres.");
  return { ...clone(project), name: normalized, updatedAt: now };
}

export function uniqueImportedProjectName(name: string, existingNames: readonly string[]): string {
  const base = String(name ?? "").trim().slice(0, 108) || "Projeto importado";
  if (!existingNames.includes(base)) return base;
  let suffix = " (importado)";
  let candidate = base.slice(0, 120 - suffix.length) + suffix;
  let index = 2;
  while (existingNames.includes(candidate)) {
    suffix = " (importado " + index + ")";
    candidate = base.slice(0, 120 - suffix.length) + suffix;
    index += 1;
  }
  return candidate;
}
