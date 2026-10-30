import { describe, expect, it } from "vitest";
import {
  calculateAxisScale,
  calculateProjectAxisScales,
  calculateSlopes,
  calculateUncertaintyBars,
  findRepeatedVolumes,
  generateTitrationGraph,
  isGenerationStale,
  parseLocaleNumber,
  sortMeasurementsForPlot,
  validateCatmullRomShape,
  validateMeasurements
} from "../app/src/titration-engine";
import { TITRATION_PROJECT_SCHEMA_VERSION } from "../app/src/titration-contract";
import type {
  MeasurementRecord,
  ProjectDocument,
  ScientificSettings,
  ValidatedMeasurement
} from "../app/src/titration-contract";

const settings = (overrides: Partial<ScientificSettings> = {}): ScientificSettings => ({
  validPhRange: { min: 0, max: 14 },
  curveRepresentation: "segmentos",
  comparisonMode: "sobreposicao",
  instrumentUncertainty: {
    volume: null,
    ph: null,
    standardPropagationAssumption: "not-configured"
  },
  repeatedVolumeDecisions: [],
  ...overrides
});

const record = (id: string, seriesName: string, volumeInput: string, phInput: string): MeasurementRecord => ({
  id, seriesName, volumeInput, phInput
});

const project = (
  measurements: MeasurementRecord[],
  scientificSettings: ScientificSettings = settings(),
  revisions = { data: 1, scientific: 1 }
): ProjectDocument => ({
  format: "graficos-titulacao-project",
  schemaVersion: TITRATION_PROJECT_SCHEMA_VERSION,
  projectId: "project-1",
  name: "Teste",
  createdAt: "2026-10-29T12:00:00.000Z",
  updatedAt: "2026-10-29T12:00:00.000Z",
  data: { measurements },
  scientificSettings,
  visualSettings: {
    showGrid: true,
    showUncertaintyBars: true,
    showGuideLines: true,
    displayDecimals: 3,
    seriesColors: {},
    hiddenSeries: [],
    chartTitle: "Titulação",
    xAxisLabel: "Volume (mL)",
    yAxisLabel: "pH"
  },
  preferences: {
    lastStage: "dados",
    advancedPanelOpen: false,
    seriesPanelOpen: true,
    accessibility: {
      theme: "system",
      highContrast: false,
      fontScale: 1,
      extraTextSpacing: false,
      reducedMotion: false,
      colorVisionSimulation: "none",
      vlibrasEnabled: false
    }
  },
  revisions,
  latestGeneration: null
});

const validPoint = (id: string, seriesName: string, volumeMl: number, ph: number, originalOrder: number): ValidatedMeasurement => ({
  id, seriesName, volumeMl, ph, originalOrder
});

describe("parseLocaleNumber", () => {
  it("aceita vírgula e ponto decimal", () => {
    expect(parseLocaleNumber("3,25")).toBe(3.25);
    expect(parseLocaleNumber("3.25")).toBe(3.25);
    expect(parseLocaleNumber(" 4 ")).toBe(4);
  });
  it("distingue vazio de número inválido", () => {
    expect(parseLocaleNumber(" ")).toBeNull();
    expect(Number.isNaN(parseLocaleNumber("1,2.3"))).toBe(true);
  });
});

describe("validateMeasurements", () => {
  it("aplica a faixa de pH do projeto, não um limite fixo de 0 a 14", () => {
    const result = validateMeasurements(
      [record("m1", "A", "1", "15,2")],
      settings({ validPhRange: { min: 0, max: 16 } })
    );
    expect(result.valid).toBe(true);
    expect(result.measurements[0]?.ph).toBe(15.2);
  });

  it("bloqueia linhas parcialmente preenchidas e valores fora da faixa", () => {
    const result = validateMeasurements([
      record("m1", "A", "1", ""),
      record("m2", "A", "2", "14.5")
    ], settings());
    expect(result.valid).toBe(false);
    expect(result.incompleteMeasurementCount).toBe(1);
    expect(result.invalidMeasurementCount).toBe(1);
  });

  it("exige IDs estáveis e únicos", () => {
    const result = validateMeasurements([
      record("same", "A", "1", "7"),
      record("same", "B", "2", "8")
    ], settings());
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.code === "duplicate-measurement-id")).toBe(true);
  });

  it("não normaliza os nomes das séries e rejeita apenas nomes vazios", () => {
    const result = validateMeasurements([
      record("m1", "A", "1", "7"),
      record("m2", "a", "2", "8")
    ], settings());
    expect(result.valid).toBe(true);
    expect(new Set(result.measurements.map(point => point.seriesName)).size).toBe(2);
  });

  it("bloqueia políticas duplicadas para a mesma série exata", () => {
    const result = validateMeasurements(
      [record("m1", "A", "1", "7")],
      settings({ repeatedVolumeDecisions: [
        { seriesName: "A", policy: "connect-in-original-order" },
        { seriesName: "A", policy: "do-not-connect-equal-volume-pair" }
      ] })
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.code === "duplicate-repeated-volume-decision")).toBe(true);
  });
});

describe("sortMeasurementsForPlot and repeated volumes", () => {
  it("ordena a cópia por volume e mantém a ordem original dos dados", () => {
    const input = [
      validPoint("m1", "A", 2, 8, 0),
      validPoint("m2", "A", 0, 3, 1),
      validPoint("m3", "A", 1, 5, 2)
    ];
    const result = sortMeasurementsForPlot(input);
    expect(result.sorted).toBe(true);
    expect(result.bySeries.get("A")?.map(point => point.id)).toEqual(["m2", "m3", "m1"]);
    expect(input.map(point => point.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("detecta volumes iguais sem eliminar pontos", () => {
    const points = [
      validPoint("m1", "A", 1, 5, 0),
      validPoint("m2", "A", 1, 6, 1),
      validPoint("m3", "A", 2, 7, 2)
    ];
    expect(findRepeatedVolumes(points)).toEqual([1]);
  });

  it("solicita decisão quando há volumes repetidos no modo segmentos", () => {
    const p = project([
      record("m1", "A", "1", "5"),
      record("m2", "A", "1", "6")
    ]);
    const result = generateTitrationGraph(p, {
      generationId: "generation-1",
      generatedAt: "2026-10-29T12:00:00.000Z",
      dataRevision: 1,
      scientificRevision: 1
    });
    expect(result.snapshot).toBeNull();
    expect(result.requiresRepeatedVolumeDecision).toEqual(["A"]);
  });

  it("aplica a escolha de não conectar o par com volume igual", () => {
    const p = project([
      record("m1", "A", "0", "2"),
      record("m2", "A", "1", "5"),
      record("m3", "A", "1", "6"),
      record("m4", "A", "2", "8")
    ], settings({ repeatedVolumeDecisions: [{
      seriesName: "A", policy: "do-not-connect-equal-volume-pair"
    }] }));
    const result = generateTitrationGraph(p, {
      generationId: "generation-2",
      generatedAt: "2026-10-29T12:00:00.000Z",
      dataRevision: 1,
      scientificRevision: 1
    });
    expect(result.snapshot).not.toBeNull();
    expect(result.series[0]?.lineRuns).toHaveLength(2);
    expect(result.series[0]?.measurements).toHaveLength(4);
  });

  it("também solicita uma política quando Catmull–Rom precisa cair para segmentos", () => {
    const p = project([
      record("m1", "A", "0", "2"),
      record("m2", "A", "1", "5"),
      record("m3", "A", "1", "6")
    ], settings({ curveRepresentation: "catmull-rom" }));
    const result = generateTitrationGraph(p, {
      generationId: "generation-3",
      generatedAt: "2026-10-29T12:00:00.000Z",
      dataRevision: 1,
      scientificRevision: 1
    });
    expect(result.snapshot).toBeNull();
    expect(result.requiresRepeatedVolumeDecision).toEqual(["A"]);
  });

  it("desabilita Catmull–Rom na série com volume repetido após a escolha do usuário", () => {
    const p = project([
      record("m1", "A", "0", "2"),
      record("m2", "A", "1", "5"),
      record("m3", "A", "1", "6"),
      record("m4", "A", "2", "8")
    ], settings({
      curveRepresentation: "catmull-rom",
      repeatedVolumeDecisions: [{ seriesName: "A", policy: "do-not-connect-equal-volume-pair" }]
    }));
    const result = generateTitrationGraph(p, {
      generationId: "generation-4",
      generatedAt: "2026-10-29T12:00:00.000Z",
      dataRevision: 1,
      scientificRevision: 1
    });
    expect(result.series[0]?.representationUsed).toBe("segmentos");
    expect(result.series[0]?.lineRuns).toHaveLength(2);
    expect(result.warnings.some(warning => warning.code === "interpolation-disabled-for-repeated-volume")).toBe(true);
  });
});

describe("Catmull–Rom centripetal", () => {
  it("aceita uma série monotônica sem excursões além dos pontos", () => {
    const points = [
      validPoint("m1", "A", 0, 2, 0),
      validPoint("m2", "A", 1, 2.4, 1),
      validPoint("m3", "A", 2, 3.1, 2),
      validPoint("m4", "A", 3, 5, 3)
    ];
    expect(validateCatmullRomShape(points)).toBe(true);
  });

  it("rejeita volumes repetidos para interpolação", () => {
    const points = [
      validPoint("m1", "A", 0, 2, 0),
      validPoint("m2", "A", 1, 3, 1),
      validPoint("m3", "A", 1, 4, 2)
    ];
    expect(validateCatmullRomShape(points)).toBe(false);
  });

  it("faz fallback para segmentos quando a curva excede a faixa local entre medições", () => {
    const p = project([
      record("m1", "A", "0", "-4"),
      record("m2", "A", "1", "4"),
      record("m3", "A", "2", "-10"),
      record("m4", "A", "3", "-8"),
      record("m5", "A", "4", "-2")
    ], settings({ validPhRange: { min: -14, max: 14 }, curveRepresentation: "catmull-rom" }));
    const result = generateTitrationGraph(p, {
      generationId: "generation-cat",
      generatedAt: "2026-10-29T12:00:00.000Z",
      dataRevision: 1,
      scientificRevision: 1
    });
    expect(result.series[0]?.representationUsed).toBe("segmentos");
    expect(result.warnings.some(warning => warning.code === "interpolation-overshoot-fallback")).toBe(true);
  });
});

describe("uncertainty bars and slope propagation", () => {
  it("cria barras separadas de volume e pH sem tratar null como zero", () => {
    const points = [validPoint("m1", "A", 2, 7, 0)];
    const bars = calculateUncertaintyBars(points, {
      volume: { interpretation: "maximum-tolerance", value: 0.05, source: "manufacturer-specification" },
      ph: null,
      standardPropagationAssumption: "not-configured"
    });
    expect(bars[0]?.volume).toEqual({ min: 1.95, max: 2.05 });
    expect(bars[0]?.ph).toBeNull();
  });

  it("propaga incertezas-padrão somente com hipótese explícita", () => {
    const settingsWithU = settings({ instrumentUncertainty: {
      volume: { interpretation: "standard-uncertainty", value: 0.02, source: "calibration" },
      ph: { interpretation: "standard-uncertainty", value: 0.01, source: "calibration" },
      standardPropagationAssumption: "independent-first-order"
    }});
    const points = [
      validPoint("m1", "A", 0, 2, 0),
      validPoint("m2", "A", 1, 4, 1)
    ];
    const slope = calculateSlopes(points, settingsWithU.instrumentUncertainty)[0]!;
    expect(slope.slopePhPerMl).toBe(2);
    expect(slope.uncertaintyStatus).toBe("available-standard");
    expect(slope.standardUncertainty).toBeGreaterThan(0);
  });

  it("propaga tolerâncias máximas por limites intervalares", () => {
    const uncertainty = {
      volume: { interpretation: "maximum-tolerance" as const, value: 0.02, source: "manufacturer-specification" as const },
      ph: { interpretation: "maximum-tolerance" as const, value: 0.1, source: "manufacturer-specification" as const },
      standardPropagationAssumption: "not-configured" as const
    };
    const points = [
      validPoint("m1", "A", 0, 2, 0),
      validPoint("m2", "A", 1, 4, 1)
    ];
    const slope = calculateSlopes(points, uncertainty)[0]!;
    expect(slope.uncertaintyStatus).toBe("available-interval");
    expect(slope.toleranceInterval?.min).toBeCloseTo(1.8 / 1.04);
    expect(slope.toleranceInterval?.max).toBeCloseTo(2.2 / 0.96);
  });

  it("não propaga incerteza-padrão sem hipótese de independência explícita", () => {
    const uncertainty = {
      volume: { interpretation: "standard-uncertainty" as const, value: 0.02, source: "calibration" as const },
      ph: { interpretation: "standard-uncertainty" as const, value: 0.01, source: "calibration" as const },
      standardPropagationAssumption: "not-configured" as const
    };
    const points = [validPoint("m1", "A", 0, 2, 0), validPoint("m2", "A", 1, 4, 1)];
    expect(calculateSlopes(points, uncertainty)[0]?.uncertaintyStatus).toBe("propagation-not-configured");
  });

  it("não combina tipos diferentes nem quando ambos estão preenchidos", () => {
    const uncertainty = {
      volume: { interpretation: "maximum-tolerance" as const, value: 0.02, source: "calibration" as const },
      ph: { interpretation: "standard-uncertainty" as const, value: 0.01, source: "calibration" as const },
      standardPropagationAssumption: "independent-first-order" as const
    };
    const points = [
      validPoint("m1", "A", 0, 2, 0),
      validPoint("m2", "A", 1, 4, 1)
    ];
    expect(calculateSlopes(points, uncertainty)[0]?.uncertaintyStatus).toBe("mixed-types");
  });

  it("não calcula intervalo finito de tolerância se ΔV possível incluir zero", () => {
    const uncertainty = {
      volume: { interpretation: "maximum-tolerance" as const, value: 0.6, source: "manufacturer-specification" as const },
      ph: { interpretation: "maximum-tolerance" as const, value: 0.01, source: "manufacturer-specification" as const },
      standardPropagationAssumption: "not-configured" as const
    };
    const points = [
      validPoint("m1", "A", 0, 2, 0),
      validPoint("m2", "A", 1, 4, 1)
    ];
    expect(calculateSlopes(points, uncertainty)[0]?.uncertaintyStatus).toBe("denominator-includes-zero");
  });
});

describe("automatic axes", () => {
  it("usa exatamente os extremos observados, sem margem decorativa", () => {
    const scale = calculateAxisScale([1, 2, 3], null, false)!;
    expect(scale.min).toBe(1);
    expect(scale.max).toBe(3);
  });

  it("expande o domínio para incluir as barras de incerteza sem adicionar padding", () => {
    const scale = calculateAxisScale([1, 2, 3], {
      interpretation: "maximum-tolerance", value: 0.1, source: "calibration"
    }, true)!;
    expect(scale.min).toBeCloseTo(0.9);
    expect(scale.max).toBeCloseTo(3.1);
    expect(scale.extendedForUncertainty).toBe(true);
  });

  it("não corta incerteza de volume que cruza zero", () => {
    const scale = calculateAxisScale([0, 1], {
      interpretation: "maximum-tolerance", value: 0.05, source: "calibration"
    }, true)!;
    expect(scale.min).toBeCloseTo(-0.05);
  });

  it("cria domínio técnico não degenerado quando todos os valores são iguais", () => {
    const scale = calculateAxisScale([0, 0, 0], null, false, { minimum: 0 })!;
    expect(scale.degenerateFallback).toBe(true);
    expect(scale.min).toBe(0);
    expect(scale.max).toBeGreaterThan(0);
  });

  it("mantém o domínio do eixo independente da faixa válida de pH", () => {
    const points = [validPoint("m1", "A", 1, 7.2, 0)];
    const scales = calculateProjectAxisScales(points, {
      volume: null, ph: { interpretation: "maximum-tolerance", value: 0.4, source: "calibration" },
      standardPropagationAssumption: "not-configured"
    }, true, "sobreposicao");
    expect(scales.get("__all__")?.ph.min).toBeCloseTo(6.8);
    expect(scales.get("__all__")?.ph.max).toBeCloseTo(7.6);
  });

  it("mantém escalas independentes por série no modo separado", () => {
    const points = [
      validPoint("a1", "A", 0, 2, 0), validPoint("a2", "A", 1, 3, 1),
      validPoint("b1", "B", 10, 9, 2), validPoint("b2", "B", 12, 12, 3)
    ];
    const scales = calculateProjectAxisScales(points, {
      volume: null, ph: null, standardPropagationAssumption: "not-configured"
    }, false, "separados");
    expect(scales.has("A")).toBe(true);
    expect(scales.has("B")).toBe(true);
    expect(scales.get("A")?.ph.max).toBeLessThan(scales.get("B")?.ph.max ?? 0);
  });
});

describe("generation snapshots", () => {
  it("stores original-order validated measurements and scientific settings", () => {
    const p = project([
      record("m1", "A", "2", "8"),
      record("m2", "A", "1", "4")
    ]);
    const result = generateTitrationGraph(p, {
      generationId: "generation-1",
      generatedAt: "2026-10-29T12:00:00.000Z",
      dataRevision: 4,
      scientificRevision: 3
    });
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.measurements.map(point => point.id)).toEqual(["m1", "m2"]);
    expect(result.series[0]?.measurements.map(point => point.id)).toEqual(["m2", "m1"]);
    expect(result.warnings.some(warning => warning.code === "volume-sorted-for-plot")).toBe(true);
  });

  it("detects stale snapshots by scientific and data revisions only", () => {
    const p = project([record("m1", "A", "1", "7")]);
    const snapshot: NonNullable<ProjectDocument["latestGeneration"]> = {
      id: "generation-1",
      engineVersion: "0.7.0",
      algorithmVersions: {
        catmullRom: "centripetal-alpha-0.5-local-range-guard-v1",
        axisTicks: "nice-1-2-5-v1",
        uncertainty: "interval-bounds-or-independent-first-order-v1"
      },
      generatedAt: "2026-10-29T12:00:00.000Z",
      sourceDataRevision: 1,
      sourceScientificRevision: 1,
      measurements: [validPoint("m1", "A", 1, 7, 0)],
      scientificSettings: settings(),
      warnings: []
    };
    p.latestGeneration = snapshot;
    expect(isGenerationStale(p)).toBe(false);
    p.revisions.data += 1;
    expect(isGenerationStale(p)).toBe(true);
  });
});
