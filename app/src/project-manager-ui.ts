import type { ProjectDocument, ProjectRepository } from "./titration-contract";
import {
  buildProjectListItems,
  createEmptyProjectDocument,
  createUuid,
  duplicateProjectDocument,
  exportProjectDocument,
  importProjectDocument,
  projectWithName,
  uniqueImportedProjectName
} from "./project-store";

export interface ProjectManagerCallbacks {
  getActiveProject(): ProjectDocument | null;
  saveActiveProject(): Promise<void>;
  openProject(project: ProjectDocument): Promise<void>;
  onActiveProjectDeleted(): Promise<void>;
}

export interface ProjectManagerElements {
  dialog: HTMLDialogElement;
  closeButton: HTMLButtonElement;
  createForm: HTMLFormElement;
  newNameInput: HTMLInputElement;
  feedback: HTMLElement;
  storageNote: HTMLElement;
  list: HTMLElement;
  count: HTMLElement;
  emptyState: HTMLElement;
  importButton: HTMLButtonElement;
  importInput: HTMLInputElement;
  openButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
}

function byId<T extends HTMLElement>(id: string, constructor: { new (...args: never[]): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) throw new Error("Elemento obrigatório não encontrado: " + id);
  return element;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data desconhecida";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function downloadJson(name: string, serialized: string): void {
  const blob = new Blob([serialized], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(name: string): string {
  const normalized = name.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  return (normalized || "projeto").slice(0, 70);
}

export class ProjectManagerUI {
  private busy = false;
  private readonly elements: ProjectManagerElements;

  constructor(
    private readonly repository: ProjectRepository,
    private readonly storageMode: "indexeddb" | "localStorage",
    private readonly callbacks: ProjectManagerCallbacks
  ) {
    this.elements = {
      dialog: byId("project-manager-dialog", HTMLDialogElement),
      closeButton: byId("project-manager-close", HTMLButtonElement),
      createForm: byId("project-create-form", HTMLFormElement),
      newNameInput: byId("new-project-name", HTMLInputElement),
      feedback: byId("project-manager-feedback", HTMLElement),
      storageNote: byId("project-storage-note", HTMLElement),
      list: byId("project-list", HTMLElement),
      count: byId("project-count", HTMLElement),
      emptyState: byId("project-empty-state", HTMLElement),
      importButton: byId("import-project-button", HTMLButtonElement),
      importInput: byId("project-import-file", HTMLInputElement),
      openButton: byId("open-project-manager", HTMLButtonElement),
      exportButton: byId("export-project-json", HTMLButtonElement)
    };
    this.bindEvents();
    this.elements.storageNote.textContent = storageMode === "indexeddb"
      ? "Armazenamento principal: IndexedDB. Os projetos permanecem neste navegador e funcionam offline."
      : "IndexedDB não está disponível. Os projetos usam armazenamento local alternativo; exporte cópias JSON regularmente.";
    this.elements.closeButton.disabled = !this.callbacks.getActiveProject();
  }

  private bindEvents(): void {
    this.elements.createForm.addEventListener("submit", event => {
      void this.createProject(event);
    });
    this.elements.list.addEventListener("click", event => {
      void this.handleProjectAction(event);
    });
    this.elements.importButton.addEventListener("click", () => this.elements.importInput.click());
    this.elements.importInput.addEventListener("change", event => {
      void this.importProject(event);
    });
    this.elements.openButton.addEventListener("click", () => {
      void this.show();
    });
    this.elements.exportButton.addEventListener("click", () => {
      void this.exportActiveProject();
    });
    this.elements.closeButton.addEventListener("click", () => this.close());
    this.elements.dialog.addEventListener("cancel", event => {
      if (!this.callbacks.getActiveProject()) {
        event.preventDefault();
        this.feedback("Crie ou abra um projeto para entrar no editor.", "error");
      }
    });
    this.elements.dialog.addEventListener("close", () => {
      this.elements.openButton.focus();
    });
  }

  async initialize(): Promise<void> {
    await this.refresh();
    this.openDialog();
  }

  async show(): Promise<void> {
    if (this.busy) return;
    try {
      await this.callbacks.saveActiveProject();
      await this.refresh();
      this.openDialog();
    } catch (error) {
      this.feedback(error instanceof Error ? error.message : "Não foi possível abrir o gerenciador.", "error");
    }
  }

  private openDialog(): void {
    this.elements.closeButton.disabled = !this.callbacks.getActiveProject();
    if (this.elements.dialog.open) return;
    if (typeof this.elements.dialog.showModal === "function") this.elements.dialog.showModal();
    else this.elements.dialog.setAttribute("open", "");
  }

  close(): void {
    if (!this.callbacks.getActiveProject()) {
      this.feedback("Abra um projeto antes de fechar o gerenciador.", "error");
      return;
    }
    this.elements.dialog.close();
  }

  private feedback(message: string, state: "success" | "error" | "info" = "info"): void {
    this.elements.feedback.textContent = message;
    this.elements.feedback.dataset.state = state;
  }

  private async getAllProjects(): Promise<ProjectDocument[]> {
    const metadata = await this.repository.list();
    const projects = await Promise.all(metadata.map(item => this.repository.get(item.projectId)));
    return projects.filter((project): project is ProjectDocument => project !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async refresh(): Promise<void> {
    const projects = await this.getAllProjects();
    const cards = buildProjectListItems(projects);
    this.elements.count.textContent = cards.length + (cards.length === 1 ? " projeto" : " projetos");
    this.elements.emptyState.hidden = cards.length > 0;
    this.elements.list.replaceChildren();

    projects.forEach(project => {
      const summary = cards.find(item => item.projectId === project.projectId);
      if (!summary) return;
      const card = document.createElement("article");
      card.className = "project-card";
      card.dataset.projectId = project.projectId;

      const main = document.createElement("div");
      main.className = "project-card-main";
      const title = document.createElement("strong");
      title.className = "project-card-title";
      title.textContent = project.name;
      const meta = document.createElement("div");
      meta.className = "project-card-meta";
      const updated = document.createElement("span");
      updated.textContent = "Atualizado em " + formatDate(project.updatedAt);
      const readings = document.createElement("span");
      readings.textContent = summary.measurementCount + (summary.measurementCount === 1 ? " leitura" : " leituras");
      const series = document.createElement("span");
      series.textContent = summary.seriesCount + (summary.seriesCount === 1 ? " série" : " séries");
      meta.append(updated, readings, series);
      main.append(title, meta);

      const actions = document.createElement("div");
      actions.className = "project-card-actions";
      [
        ["open", "Abrir"],
        ["duplicate", "Duplicar"],
        ["export", "Exportar JSON"],
        ["rename", "Renomear"],
        ["delete", "Excluir"]
      ].forEach(([action, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.projectAction = action;
        button.dataset.projectId = project.projectId;
        button.textContent = label;
        button.setAttribute("aria-label", label + " projeto " + project.name);
        actions.appendChild(button);
      });
      card.append(main, actions);
      this.elements.list.appendChild(card);
    });
    this.elements.closeButton.disabled = !this.callbacks.getActiveProject();
  }

  private async createProject(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy) return;
    const name = this.elements.newNameInput.value;
    if (!name.trim()) {
      this.feedback("Digite um nome para a nova investigação.", "error");
      this.elements.newNameInput.focus();
      return;
    }
    this.busy = true;
    try {
      const project = createEmptyProjectDocument(name);
      await this.repository.save(project);
      this.elements.newNameInput.value = "";
      await this.refresh();
      this.feedback("Projeto criado e salvo.", "success");
      await this.callbacks.openProject(project);
      this.elements.dialog.close();
    } catch (error) {
      this.feedback(error instanceof Error ? error.message : "Não foi possível criar o projeto.", "error");
    } finally {
      this.busy = false;
    }
  }

  private async handleProjectAction(event: Event): Promise<void> {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>("button[data-project-action]");
    if (!button || this.busy) return;
    const projectId = button.dataset.projectId;
    const action = button.dataset.projectAction;
    if (!projectId || !action) return;

    this.busy = true;
    try {
      const project = await this.repository.get(projectId);
      if (!project) throw new Error("O projeto selecionado não foi encontrado.");
      if (action === "open") {
        await this.callbacks.saveActiveProject();
        await this.callbacks.openProject(project);
        this.elements.dialog.close();
        return;
      }
      if (action === "duplicate") {
        const projects = await this.getAllProjects();
        const names = projects.map(item => item.name);
        let copyName = uniqueImportedProjectName(project.name, names).replace(" (importado)", " (cópia)");
        if (names.includes(copyName)) copyName = uniqueImportedProjectName(project.name + " (cópia)", names);
        const copy = duplicateProjectDocument(project, copyName);
        await this.repository.save(copy);
        await this.refresh();
        this.feedback("Cópia criada sem alterar o projeto original.", "success");
        return;
      }
      if (action === "export") {
        downloadJson(safeFilename(project.name) + ".graficos-titulacao.json", exportProjectDocument(project));
        this.feedback("Arquivo JSON do projeto preparado para exportação.", "success");
        return;
      }
      if (action === "rename") {
        const proposed = window.prompt("Novo nome do projeto:", project.name);
        if (proposed === null) return;
        const renamed = projectWithName(project, proposed);
        await this.repository.save(renamed);
        await this.refresh();
        this.feedback("Nome do projeto atualizado.", "success");
        return;
      }
      if (action === "delete") {
        const accepted = window.confirm("Excluir o projeto “" + project.name + "”? Esta ação remove os dados guardados neste dispositivo.");
        if (!accepted) return;
        if (this.callbacks.getActiveProject()?.projectId === projectId) await this.callbacks.onActiveProjectDeleted();
        await this.repository.delete(projectId);
        await this.refresh();
        this.feedback("Projeto excluído deste dispositivo.", "success");
      }
    } catch (error) {
      this.feedback(error instanceof Error ? error.message : "Não foi possível concluir esta ação.", "error");
      await this.refresh();
    } finally {
      this.busy = false;
    }
  }

  private async importProject(event: Event): Promise<void> {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0];
    if (!file || this.busy) return;
    this.busy = true;
    try {
      const serialized = await file.text();
      const imported = importProjectDocument(serialized).project;
      const projects = await this.getAllProjects();
      const names = projects.map(project => project.name);
      const idConflict = projects.some(project => project.projectId === imported.projectId);
      if (idConflict) imported.projectId = createUuid();
      if (idConflict || names.includes(imported.name)) {
        imported.name = uniqueImportedProjectName(imported.name, names);
        imported.updatedAt = new Date().toISOString();
      }
      await this.repository.save(imported);
      await this.refresh();
      this.feedback(
        idConflict
          ? "Projeto importado como uma nova cópia; o projeto existente não foi sobrescrito."
          : "Projeto importado e adicionado à lista.",
        "success"
      );
    } catch (error) {
      this.feedback(error instanceof Error ? error.message : "Não foi possível importar esse projeto.", "error");
    } finally {
      if (input) input.value = "";
      this.busy = false;
    }
  }

  private async exportActiveProject(): Promise<void> {
    const active = this.callbacks.getActiveProject();
    if (!active) {
      this.feedback("Abra um projeto antes de exportá-lo.", "error");
      return;
    }
    try {
      await this.callbacks.saveActiveProject();
      const refreshed = await this.repository.get(active.projectId);
      if (!refreshed) throw new Error("O projeto ativo não foi encontrado no armazenamento.");
      downloadJson(safeFilename(refreshed.name) + ".graficos-titulacao.json", exportProjectDocument(refreshed));
      this.feedback("Projeto completo exportado em JSON.", "success");
    } catch (error) {
      this.feedback(error instanceof Error ? error.message : "Não foi possível exportar o projeto.", "error");
    }
  }
}
