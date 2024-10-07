import type { Client } from "./client.ts";
import type {
  InitializationData,
  Operation,
  TreeItem,
  TreeItemWithChildren,
} from "./schema.ts";

class Companion {
  private operations: Operation[] = [];
  constructor(
    public readonly client: Client,
    public readonly itemMap: Map<string, TreeItemWithChildren>,
    public readonly initializationData: InitializationData,
  ) {}

  public getPendingOperations() {
    return this.operations;
  }

  public addOperation(operation: Operation): void {
    this.operations.push(operation);
  }

  public isDirty() {
    return this.operations.length > 0;
  }

  public async save(): Promise<void> {
    const ops = this.operations;
    this.operations = []; // purge
    const operationResult = await this.client.pushAndPull(ops);

    if (operationResult.error_encountered_in_remote_operations) {
      throw new Error("Error encountered in remote WorkFlowy operations");
    }
  }

  public getRealTimestamp(timestamp: number): Date {
    const u = timestamp + this.initializationData.dateJoinedTimestampInSeconds;
    return new Date(u * 1000);
  }

  public getNow(): number {
    const timeInSeconds = Math.floor(Date.now() / 1000);
    return timeInSeconds - this.initializationData.dateJoinedTimestampInSeconds;
  }
}

export class Document {
  #companion: Companion;
  /** Pointer to the root of the WorkFlowy */
  public readonly root: List;

  constructor(
    client: Client,
    items: TreeItem[],
    initializationData: InitializationData,
  ) {
    const itemMap = new Map<string, TreeItemWithChildren>();

    const getItem = (id: string) => {
      if (itemMap.has(id)) {
        return itemMap.get(id)!;
      }
      const newItem = { id, children: [] } as unknown as TreeItemWithChildren;
      itemMap.set(id, newItem);
      return newItem;
    };

    items.sort((a, b) => Math.sign(a.priority - b.priority));

    for (const item of items) {
      const p = getItem(item.parentId);
      p.children.push(item.id);
      const t = getItem(item.id);
      itemMap.set(item.id, { ...t, ...item });
    }

    itemMap.get("None")!.name = "Home";

    this.#companion = new Companion(client, itemMap, initializationData);
    this.root = this.getList("None");
  }

  /** Lists in the root of WorkFlowy */
  public get items(): List[] {
    return this.root.items;
  }

  /**
   * Returns a List specified by ID. Make sure that the ID exists.
   * @param id ID of the list to get
   * @returns A list instance with the particular ID
   */
  public getList(id: string) {
    return new List(id, this.#companion);
  }

  /** Returns a list of changes to be made to WorkFlowy when saving */
  public getPendingOperations(): Operation[] {
    return this.#companion.getPendingOperations();
  }

  /** Returns true if there are unsaved changes */
  public isDirty(): boolean {
    return this.#companion.isDirty();
  }

  /** Saves the document */
  public save(): Promise<void> {
    return this.#companion.save();
  }
}

/**
 * A list corresponds to a node in a WorkFlowy document
 */
export class List {
  #companion: Companion;

  constructor(
    public readonly id: string,
    companion: Companion,
  ) {
    this.#companion = companion;
  }

  private get source(): TreeItemWithChildren {
    return this.#companion.itemMap.get(this.id)!;
  }

  private get data(): TreeItemWithChildren {
    const source = this.source;
    if (source.isMirrorRoot) {
      return this.#companion.itemMap.get(source.originalId!)!;
    }
    return source;
  }

  /** List name */
  public get name(): string {
    return this.data.name;
  }

  /** List note */
  public get note(): string {
    return this.data.note || "";
  }

  /** Date of last change */
  public get lastModifiedAt(): Date {
    return this.#companion.getRealTimestamp(this.data.lastModified);
  }

  /** Date of completion, or undefined if not completed */
  public get completedAt(): Date | undefined {
    if (this.data.completed !== undefined) {
      return this.#companion.getRealTimestamp(this.data.completed);
    }
    return undefined;
  }

  /** True if completed, false otherwise */
  public get isCompleted(): boolean {
    return this.completedAt !== undefined;
  }

  /** True if the list is a mirror of another list */
  public get isMirror(): boolean {
    return this.source.isMirrorRoot;
  }

  /** ID of mirrored list, if this list is a mirror; otherwise undefined */
  public get originalId(): string | undefined {
    return this.source.originalId;
  }

  /** Returns a parent list */
  public get parent(): List {
    return new List(this.source.parentId, this.#companion);
  }

  /** Returns a position of the list relative to its siblings within the parent */
  public get priority(): number {
    return this.parent.itemIds.indexOf(this.id);
  }

  /** Returns all items in this list */
  public get items(): List[] {
    return this.data.children.map((cId) => new List(cId, this.#companion));
  }

  /** Returns all item IDs in this list */
  public get itemIds(): string[] {
    return this.data.children;
  }

  /** Finds an item in this list and returns it, undefined if it does not find any */
  public findOne(namePattern: RegExp, descriptionPattern = /.*/) {
    const results = this.findAll(namePattern, descriptionPattern);
    return results.length > 0 ? results[0] : undefined;
  }

  /** Finds all items in this list */
  public findAll(
    namePattern: RegExp,
    notePattern = /.*/,
  ) {
    const results: List[] = [];
    for (const candidate of this.items) {
      const nameMatch = candidate.name.match(namePattern);
      const descriptionMatch = candidate.note.match(
        notePattern,
      );
      if (nameMatch && descriptionMatch) {
        results.push(candidate);
      }
    }
    return results;
  }

  /**
   * Creates a new sublist
   * @param priority position of the sublist within other sublists;
   * -1 appends the list to the end
   * @returns the new list
   */
  public createList(priority = -1) {
    if (priority === -1) {
      priority = this.itemIds.length;
    }
    priority = Math.max(0, Math.min(priority, this.itemIds.length));

    const newId = crypto.randomUUID();

    this.#companion.itemMap.set(newId, {
      id: newId,
      name: "",
      note: undefined,
      parentId: this.id,
      priority: 0, // there is some special algo in WF
      completed: undefined,
      lastModified: this.#companion.getNow(),
      originalId: undefined,
      isMirrorRoot: false,
      children: [],
    });

    this.itemIds.splice(priority, 0, newId);

    const parentid = this.id === "home" ? "None" : this.id;

    this.#companion.addOperation({
      type: "create",
      data: {
        projectid: newId,
        parentid,
        priority,
      },
      undo_data: {},
    });

    return new List(newId, this.#companion);
  }

  /**
   * Alias for `.createList` in case if it feels weird to call an item a list :-)
   * @param priority position of the item within other items in the same parent;
   * -1 appends the item to the end
   * @returns the new item
   */
  public createItem(priority = -1) {
    return this.createList(priority);
  }

  /**
   * Sets a new name
   * @returns {List} this
   */
  public setName(name: string): List {
    this.#companion.addOperation({
      type: "edit",
      data: {
        projectid: this.data.id,
        name,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
        previous_name: this.name,
      },
    });
    this.data.name = name;
    return this;
  }

  /**
   * Sets a new note
   * @returns {List} this
   */
  public setNote(note: string): List {
    this.#companion.addOperation({
      type: "edit",
      data: {
        projectid: this.data.id,
        description: note,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
        previous_description: this.data.note,
      },
    });
    this.data.note = note;
    return this;
  }

  /**
   * Moves this list to a different list
   *
   * @param {List} target New parent of the current list
   * @param {number} priority Position of this list in the new parent;
   * -1 appends the list to the end of the target list's children
   */
  public move(target: List, priority = -1) {
    if (priority === -1) {
      priority = target.itemIds.length;
    }
    priority = Math.max(0, Math.min(priority, target.itemIds.length));

    this.#companion.addOperation({
      type: "move",
      data: {
        projectid: this.id,
        parentid: target.id,
        priority,
      },
      undo_data: {
        previous_parentid: this.parent.id,
        previous_priority: this.priority,
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
      },
    });

    this.parent.itemIds.splice(this.priority, 1);
    this.data.parentId = target.id;
    target.itemIds.splice(priority, 0, this.id);
  }

  /**
   * Deletes this list from WorkFlowy. Use with caution!
   */
  public delete() {
    this.#companion.addOperation({
      type: "delete",
      data: {
        projectid: this.id,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
        parentid: this.parent.id,
        priority: this.priority,
      },
    });
    this.parent.itemIds.splice(this.priority, 1);
  }

  /**
   * Prints the list and its content as a nice string
   *
   * @param omitHeader Whether to print only the content the current list
   * @param indent
   * @returns {string} stringified list
   */
  public toString(omitHeader = false, indent = ""): string {
    const text: string[] = [];
    const printHeader = !omitHeader && this.id !== "None";
    if (printHeader) {
      text.push(indent + "- " + this.name);
      if (this.note) {
        text.push(indent + "  " + this.note);
      }
    }
    const nextIndent = `${indent}${printHeader ? "    " : ""}`;
    const childrenTextChunks = this.items.map((p) =>
      p.toString(false, nextIndent)
    );

    if (childrenTextChunks.length > 0) {
      text.push(childrenTextChunks.join("\n"));
    }
    return text.join("\n");
  }

  /**
   * Prints the list and its content in JSON format
   *
   * @returns list in JSON format
   */
  // deno-lint-ignore no-explicit-any
  public toJson(): any {
    return {
      id: this.id,
      name: this.name,
      note: this.note,
      isCompleted: this.isCompleted,
      items: this.items.map((list) => list.toJson()),
    };
  }

  /**
   * Prints the list and its content in OPML format
   *
   * @returns list in OPML format
   */
  public toOpml(top = true): string {
    const escape = (text: string) =>
      text.replace(/&/g, "&amp;")
        .replace(/&amp;amp;/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const children = this.items.map((list) => list.toOpml(false)).join("");
    const attributes = [
      this.isCompleted ? ' _complete="true"' : "",
      ` text="${escape(this.name)}"`,
      this.note ? ` _note="${escape(this.note)}"` : "",
    ].join("");

    const content = this.id === "None"
      ? children
      : children === ""
      ? `<outline${attributes} />`
      : `<outline${attributes}>${children}</outline>`;

    return top
      ? `<?xml version="1.0"?><opml version="2.0"><body>${content}</body></opml>`
      : content;
  }
}
