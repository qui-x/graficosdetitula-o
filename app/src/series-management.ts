export interface SeriesMeasurement {
  series?: string | null;
}

export interface SeriesEditorState<T extends SeriesMeasurement> {
  points: T[];
  seriesCatalog: string[];
  seriesColors: Record<string, string>;
  hiddenSeries: Record<string, boolean>;
}

export interface RemoveSeriesResult<T extends SeriesMeasurement> extends SeriesEditorState<T> {
  removedCount: number;
}

/**
 * Remove uma série pelo nome literal, sem alterar outras séries que diferem
 * por caixa ou espaços. Nomes ausentes nos registros usam o padrão "Série A",
 * em correspondência com a regra do editor.
 */
export function removeSeriesFromState<T extends SeriesMeasurement>(
  state: SeriesEditorState<T>,
  seriesName: string
): RemoveSeriesResult<T> {
  const points = state.points.filter(point => {
    const name = String(point.series ?? "") === "" ? "Série A" : String(point.series);
    return name !== seriesName;
  });
  const seriesCatalog = state.seriesCatalog.filter(name => name !== seriesName);
  const seriesColors = { ...state.seriesColors };
  const hiddenSeries = { ...state.hiddenSeries };

  delete seriesColors[seriesName];
  delete hiddenSeries[seriesName];

  return {
    points,
    seriesCatalog,
    seriesColors,
    hiddenSeries,
    removedCount: state.points.length - points.length
  };
}
