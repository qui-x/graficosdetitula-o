import { describe, expect, it } from "vitest";
import {
  calculateSlopes,
  createAxisTicks,
  groupConsecutiveSegments,
  parseLocaleNumber,
  validateMeasurementRows,
  type ValidMeasurement
} from "../app/src/graph-model";

describe("parseLocaleNumber", () => {
  it("accepts decimal comma and decimal point", () => {
    expect(parseLocaleNumber("7,125")).toBe(7.125);
    expect(parseLocaleNumber("7.125")).toBe(7.125);
  });

  it("distinguishes blank input from an invalid number", () => {
    expect(parseLocaleNumber("  ")).toBeNull();
    expect(Number.isNaN(parseLocaleNumber("não é número"))).toBe(true);
  });
});

describe("validateMeasurementRows", () => {
  it("ignores blank rows and returns only valid measurements", () => {
    const result = validateMeasurementRows([
      { series: "A", volume: "", ph: "" },
      { series: "A", volume: "0,000", ph: "6,5" },
      { series: "A", volume: "1", ph: "" },
      { series: "A", volume: "-1", ph: "7" },
      { series: "B", volume: "2", ph: "14,2" }
    ]);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({ series: "A", volume: 0, ph: 6.5, index: 1 });
    expect(result.incomplete).toBe(1);
    expect(result.invalid).toBe(2);
  });

  it("uses Série A when a point has no series name", () => {
    const result = validateMeasurementRows([{ series: "", volume: "1", ph: "7" }]);
    expect(result.valid[0]?.series).toBe("Série A");
  });

  it("preserves series names exactly, including case and surrounding spaces", () => {
    const names = ["Amostra", "amostra", "Amostra ", " Amostra"];
    const result = validateMeasurementRows(names.map((series, index) => ({
      series,
      volume: String(index),
      ph: "7"
    })));
    expect(result.valid.map(point => point.series)).toEqual(names);
    expect(new Set(result.valid.map(point => point.series)).size).toBe(4);
  });
});

describe("groupConsecutiveSegments and calculateSlopes", () => {
  const measurements: ValidMeasurement[] = [
    { series: "A", volume: 0, ph: 6, index: 0 },
    { series: "A", volume: 1, ph: 7, index: 1 },
    { series: "A", volume: 1, ph: 7.5, index: 2 },
    { series: "A", volume: 2, ph: 6.5, index: 3 },
    { series: "A", volume: 0.5, ph: 6.2, index: 4 },
    { series: "B", volume: 1, ph: 8, index: 5 }
  ];

  it("starts a new segment when volume decreases or the series changes", () => {
    const segments = groupConsecutiveSegments(measurements);
    expect(segments.map(segment => segment.points.length)).toEqual([4, 1, 1]);
  });

  it("calculates consecutive slopes and skips zero-width intervals", () => {
    const segments = groupConsecutiveSegments(measurements);
    const slopes = calculateSlopes(segments);
    expect(slopes).toHaveLength(2);
    expect(slopes[0]).toMatchObject({ series: "A", fromVolume: 0, toVolume: 1, slope: 1 });
    expect(slopes[1]).toMatchObject({ series: "A", fromVolume: 1, toVolume: 2, slope: -1 });
  });
});

describe("createAxisTicks", () => {
  it("generates precise thousandth intervals without floating-point noise", () => {
    expect(createAxisTicks(0, 0.005, 0.001)).toEqual([0, 0.001, 0.002, 0.003, 0.004, 0.005]);
  });

  it("caps the number of tick marks to preserve readability", () => {
    expect(createAxisTicks(0, 1000, 0.001)).toHaveLength(121);
  });
});
