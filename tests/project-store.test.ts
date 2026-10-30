import { describe, expect, it } from "vitest";
import {
  LocalStorageProjectRepository,
  buildProjectListItems,
  createEmptyProjectDocument,
  createUuid,
  duplicateProjectDocument,
  exportProjectDocument,
  importProjectDocument,
  projectWithName,
  uniqueImportedProjectName,
  uniqueProjectCopyName,
  validateProjectDocument
} from "../app/src/project-store";
import type { ProjectDocument } from "../app/src/titration-contract";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }

  get length(): number {
    return this.values.size;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }
}

function sampleProject(name = "Investigação A"): ProjectDocument {
  const project = createEmptyProjectDocument(name, {
    now: "2026-10-30T10:00:00.000Z",
    projectId: "8cde0ed1-6b1b-4bca-8c79-6abfd7385010"
  });
  project.visualSettings.seriesCatalog = ["Amostra", "amostra", "Amostra ", " Amostra", "Série vazia"];
  project.visualSettings.chartControls = {
    currentView: "derivative",
    entrySeriesName: "Série vazia",
    settings: {
      "cfg-curve-grid": true,
      "cfg-curve-x-min": "0,000",
      "cfg-decimals": "4"
    }
  };
  project.data.measurements = [{
    id: "8cde0ed1-6b1b-4bca-8c79-6abfd7385001",
    seriesName: "Amostra ",
    volumeInput: "0,500",
    phInput: "6,850"
  }];
  return project;
}

describe("project document contract and JSON codec", () => {
  it("creates a valid, empty project with independent defaults", () => {
    const project = createEmptyProjectDocument("  Nova investigação  ", {
      now: "2026-10-30T10:00:00.000Z",
      projectId: "8cde0ed1-6b1b-4bca-8c79-6abfd7385010"
    });
    expect(project.name).toBe("Nova investigação");
    expect(project.data.measurements).toHaveLength(0);
    expect(project.latestGeneration).toBeNull();
    expect(validateProjectDocument(project).valid).toBe(true);
  });

  it("round-trips literal series identities and chart controls through versioned JSON", () => {
    const project = sampleProject();
    const parsed = importProjectDocument(exportProjectDocument(project));
    expect(parsed.project.visualSettings.seriesCatalog).toEqual([
      "Amostra", "amostra", "Amostra ", " Amostra", "Série vazia"
    ]);
    expect(parsed.project.data.measurements[0]?.seriesName).toBe("Amostra ");
    expect(parsed.project.visualSettings.chartControls?.currentView).toBe("derivative");
    expect(parsed.project.visualSettings.chartControls?.settings["cfg-curve-x-min"]).toBe("0,000");
  });

  it("rejects duplicate measurement IDs", () => {
    const project = sampleProject();
    project.data.measurements.push({
      ...project.data.measurements[0]!,
      seriesName: "amostra"
    });
    const validation = validateProjectDocument(project);
    expect(validation.valid).toBe(false);
    expect(validation.issues.join(" ")).toContain("duplicado");
  });

  it("rejects a whitespace-only series name without trimming other names", () => {
    const project = sampleProject();
    project.data.measurements[0]!.seriesName = "   ";
    const validation = validateProjectDocument(project);
    expect(validation.valid).toBe(false);
    expect(validation.issues.join(" ")).toContain("nome de série");
    project.data.measurements[0]!.seriesName = "Amostra ";
    expect(validateProjectDocument(project).valid).toBe(true);
  });

  it("rejects unsupported future project versions clearly", () => {
    const project = sampleProject();
    const json = JSON.stringify({ ...project, schemaVersion: 2 });
    expect(() => importProjectDocument(json)).toThrow(/Versão de projeto 2 não suportada/);
  });

  it("generates valid UUIDs", () => {
    expect(createUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("duplicates a project without modifying the original identity", () => {
    const original = sampleProject();
    const copy = duplicateProjectDocument(original, "Cópia", {
      now: "2026-10-30T11:00:00.000Z",
      projectId: "8cde0ed1-6b1b-4bca-8c79-6abfd7385022"
    });
    expect(copy.projectId).not.toBe(original.projectId);
    expect(copy.name).toBe("Cópia");
    expect(copy.data.measurements).toEqual(original.data.measurements);
    expect(copy.updatedAt).toBe("2026-10-30T11:00:00.000Z");
    expect(original.name).toBe("Investigação A");
  });

  it("validates and applies a new project name immutably", () => {
    const original = sampleProject();
    const renamed = projectWithName(original, "  Nova denominação  ", "2026-10-30T12:00:00.000Z");
    expect(renamed.name).toBe("Nova denominação");
    expect(original.name).toBe("Investigação A");
  });

  it("creates an unambiguous name for imported duplicates", () => {
    expect(uniqueImportedProjectName("Curva", ["Curva"])).toBe("Curva (importado)");
    expect(uniqueImportedProjectName("Curva", ["Curva", "Curva (importado)"])).toBe("Curva (importado 2)");
  });

  it("gives a duplicated project a copy suffix even when the original name is unique", () => {
    expect(uniqueProjectCopyName("Titulação A", [])).toBe("Titulação A (cópia)");
    expect(uniqueProjectCopyName("Titulação A", ["Titulação A", "Titulação A (cópia)"])).toBe("Titulação A (cópia 2)");
  });

  it("summarizes saved projects including series without measurements", () => {
    const project = sampleProject();
    const items = buildProjectListItems([project]);
    expect(items[0]).toMatchObject({
      name: "Investigação A",
      measurementCount: 1,
      seriesCount: 5
    });
  });
});

describe("LocalStorageProjectRepository fallback", () => {
  it("lists, reads, updates and deletes projects independently", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageProjectRepository(storage as unknown as Storage);
    const first = sampleProject("Projeto um");
    const second = createEmptyProjectDocument("Projeto dois", {
      now: "2026-10-30T10:30:00.000Z",
      projectId: "8cde0ed1-6b1b-4bca-8c79-6abfd7385022"
    });

    await repository.save(first);
    await repository.save(second);
    expect(await repository.get(first.projectId)).toMatchObject({ name: "Projeto um" });
    expect((await repository.list()).map(item => item.name)).toEqual(["Projeto dois", "Projeto um"]);

    await repository.save(projectWithName(first, "Projeto um renomeado"));
    expect((await repository.get(first.projectId))?.name).toBe("Projeto um renomeado");

    await repository.delete(second.projectId);
    expect(await repository.get(second.projectId)).toBeNull();
    expect((await repository.list()).map(item => item.projectId)).toEqual([first.projectId]);
  });

  it("does not store an invalid project", async () => {
    const repository = new LocalStorageProjectRepository(new MemoryStorage() as unknown as Storage);
    const project = sampleProject();
    project.revisions.data = -1;
    await expect(repository.save(project)).rejects.toThrow(/Projeto inválido/);
    expect(await repository.list()).toHaveLength(0);
  });
});
