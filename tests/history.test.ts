import { describe, expect, it } from "vitest";
import { SnapshotHistory } from "../app/src/history";

type State = { rows: number; title: string };

describe("SnapshotHistory", () => {
  it("starts empty and tracks availability of undo and redo", () => {
    const history = new SnapshotHistory<State>();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    history.record({ rows: 1, title: "A" });
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it("restores the previous snapshot and then redoes it", () => {
    const history = new SnapshotHistory<State>();
    history.record({ rows: 1, title: "A" });
    history.record({ rows: 2, title: "B" });

    const undone = history.undo({ rows: 3, title: "C" });
    expect(undone).toEqual({ rows: 2, title: "B" });
    expect(history.canRedo).toBe(true);
    expect(history.redo({ rows: 2, title: "B" })).toEqual({ rows: 3, title: "C" });
    expect(history.canRedo).toBe(false);
  });

  it("clears redo history after a new edit", () => {
    const history = new SnapshotHistory<State>();
    history.record({ rows: 1, title: "A" });
    history.record({ rows: 2, title: "B" });
    history.undo({ rows: 3, title: "C" });
    expect(history.canRedo).toBe(true);
    history.record({ rows: 4, title: "D" });
    expect(history.canRedo).toBe(false);
  });

  it("does not store duplicate adjacent snapshots", () => {
    const history = new SnapshotHistory<State>();
    history.record({ rows: 1, title: "A" });
    history.record({ rows: 1, title: "A" });
    expect(history.undo({ rows: 2, title: "B" })).toEqual({ rows: 1, title: "A" });
    expect(history.canUndo).toBe(false);
  });

  it("keeps the history within its configured limit", () => {
    const history = new SnapshotHistory<State>(2);
    history.record({ rows: 1, title: "A" });
    history.record({ rows: 2, title: "B" });
    history.record({ rows: 3, title: "C" });
    history.record({ rows: 4, title: "D" });
    expect(history.undo({ rows: 5, title: "E" })).toEqual({ rows: 3, title: "C" });
    expect(history.undo({ rows: 3, title: "C" })).toEqual({ rows: 2, title: "B" });
    expect(history.canUndo).toBe(false);
  });

  it("isolates stored states from later object mutation", () => {
    const history = new SnapshotHistory<State>();
    const initial: State = { rows: 1, title: "A" };
    history.record(initial);
    initial.title = "changed";
    expect(history.undo({ rows: 2, title: "B" })).toEqual({ rows: 1, title: "A" });
  });
});
