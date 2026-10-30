import { describe, expect, it } from "vitest";
import { removeSeriesFromState } from "../app/src/series-management";

describe("removeSeriesFromState", () => {
  it("remove todos os registros da série e suas configurações visuais", () => {
    const state = {
      points: [
        { id: "1", series: "Amostra A", volume: "0", ph: "3.2" },
        { id: "2", series: "Amostra A", volume: "", ph: "" },
        { id: "3", series: "Amostra B", volume: "1", ph: "7" }
      ],
      seriesCatalog: ["Amostra A", "Amostra B"],
      seriesColors: { "Amostra A": "#ff0000", "Amostra B": "#00ff00" },
      hiddenSeries: { "Amostra A": true, "Amostra B": false }
    };

    const result = removeSeriesFromState(state, "Amostra A");

    expect(result.points).toEqual([
      { id: "3", series: "Amostra B", volume: "1", ph: "7" }
    ]);
    expect(result.removedCount).toBe(2);
    expect(result.seriesCatalog).toEqual(["Amostra B"]);
    expect(result.seriesColors).toEqual({ "Amostra B": "#00ff00" });
    expect(result.hiddenSeries).toEqual({ "Amostra B": false });

    // A operação é imutável: o snapshot anterior continua apto a ser restaurado.
    expect(state.points).toHaveLength(3);
    expect(state.seriesCatalog).toContain("Amostra A");
    expect(state.seriesColors["Amostra A"]).toBe("#ff0000");
    expect(state.hiddenSeries["Amostra A"]).toBe(true);
  });

  it("compara nomes literalmente, sem confundir caixa ou espaços", () => {
    const state = {
      points: [
        { series: "Amostra" },
        { series: "amostra" },
        { series: "Amostra " },
        { series: "Amostra A" }
      ],
      seriesCatalog: ["Amostra", "amostra", "Amostra ", "Amostra A"],
      seriesColors: {},
      hiddenSeries: {}
    };

    const result = removeSeriesFromState(state, "Amostra");

    expect(result.points.map(point => point.series)).toEqual([
      "amostra",
      "Amostra ",
      "Amostra A"
    ]);
    expect(result.seriesCatalog).toEqual(["amostra", "Amostra ", "Amostra A"]);
    expect(result.removedCount).toBe(1);
  });

  it("remove a série padrão quando o registro não possui nome explícito", () => {
    const result = removeSeriesFromState({
      points: [{ series: "" }, { series: null }, { series: "Outra" }],
      seriesCatalog: ["Série A", "Outra"],
      seriesColors: { "Série A": "#112233" },
      hiddenSeries: { "Série A": true }
    }, "Série A");

    expect(result.points).toEqual([{ series: "Outra" }]);
    expect(result.removedCount).toBe(2);
    expect(result.seriesCatalog).toEqual(["Outra"]);
    expect(result.seriesColors).toEqual({});
    expect(result.hiddenSeries).toEqual({});
  });

  it("também remove uma série vazia e mantém as demais intactas", () => {
    const result = removeSeriesFromState({
      points: [],
      seriesCatalog: ["Série vazia", "Série utilizada"],
      seriesColors: { "Série vazia": "#112233", "Série utilizada": "#445566" },
      hiddenSeries: { "Série vazia": true }
    }, "Série vazia");

    expect(result.removedCount).toBe(0);
    expect(result.seriesCatalog).toEqual(["Série utilizada"]);
    expect(result.seriesColors).toEqual({ "Série utilizada": "#445566" });
    expect(result.hiddenSeries).toEqual({});
  });
});
