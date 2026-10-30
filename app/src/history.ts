/**
 * Histórico tipado para estados serializáveis do editor.
 * Mantém pilhas limitadas e elimina o caminho de refazer após uma nova edição.
 */
export class SnapshotHistory<T extends object> {
  private readonly undoStack: T[] = [];
  private readonly redoStack: T[] = [];
  private readonly limit: number;

  constructor(limit = 100) {
    this.limit = Number.isInteger(limit) && limit > 0 ? limit : 100;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  record(snapshot: T): void {
    this.pushUnique(this.undoStack, snapshot);
    this.redoStack.length = 0;
  }

  undo(current: T): T | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.pushUnique(this.redoStack, current);
    return this.clone(previous);
  }

  redo(current: T): T | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.pushUnique(this.undoStack, current);
    return this.clone(next);
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  private pushUnique(stack: T[], snapshot: T): void {
    const last = stack.at(-1);
    if (last && this.key(last) === this.key(snapshot)) return;
    stack.push(this.clone(snapshot));
    if (stack.length > this.limit) stack.splice(0, stack.length - this.limit);
  }

  private key(snapshot: T): string {
    return JSON.stringify(snapshot);
  }

  private clone(snapshot: T): T {
    return JSON.parse(JSON.stringify(snapshot)) as T;
  }
}
