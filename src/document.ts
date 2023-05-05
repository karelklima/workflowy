import { DateTime } from "../deps.ts";

import type { Client } from "./client.ts";
import type {
  InitializationData,
  Operation,
  TreeData,
  TreeItem,
} from "./schema.ts";

export class Document {
  private operations: Operation[] = [];
  itemMap: Map<string, TreeItem>;
  public readonly home: Project;

  constructor(
    private readonly client: Client,
    private readonly tree: TreeData,
    private readonly initializationData: InitializationData,
  ) {
    this.itemMap = this.buildItemMap(tree.items);
    this.home = this.getProject("home");
  }

  private buildItemMap = (items: TreeData["items"]) => {
    const map = new Map<string, TreeItem>();

    const getItem = (id: string) => {
      if (map.has(id)) {
        return map.get(id)!;
      }
      const newItem = { id, children: [] } as unknown as TreeItem;
      map.set(id, newItem);
      return newItem;
    };

    items.sort((a, b) => Math.sign(a.priority - b.priority));

    for (const item of items) {
      const p = getItem(item.parentId);
      p.children.push(item.id);
      const t = getItem(item.id);
      map.set(item.id, { ...t, ...item });
    }

    return map;
  };

  public getHome() {
    return new Project("home", this);
  }

  public getProject(id: string) {
    return new Project(id, this);
  }

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
    await this.client.update(ops);
  }

  public getRealTimestamp(timestamp: number): DateTime {
    const u = timestamp + this.initializationData.dateJoinedTimestampInSeconds;
    return DateTime.fromSeconds(u);
  }

  public getNow(): number {
    return DateTime.now().toSeconds() -
      this.initializationData.dateJoinedTimestampInSeconds;
  }
}

export class Project {
  constructor(public readonly id: string, private readonly document: Document) {
  }

  public get lastModified(): DateTime {
    return this.document.getRealTimestamp(this.data.lastModified);
  }

  private get source(): TreeItem {
    return this.document.itemMap.get(this.id)!;
  }

  private get data(): TreeItem {
    const source = this.source;
    if (source.isMirrorRoot) {
      return this.document.itemMap.get(source.originalId!)!;
    }
    return source;
  }

  public isMirrorRoot(): boolean {
    return this.source.isMirrorRoot;
  }

  public getOriginalId(): string | undefined {
    return this.source.originalId;
  }

  public get name(): string {
    return this.data.name;
  }

  public get description(): string {
    return this.data.description || "";
  }

  public get completed(): DateTime | undefined {
    if (this.data.completed !== undefined) {
      return this.document.getRealTimestamp(this.data.completed);
    }
    return undefined;
  }

  public isComplete(): boolean {
    return this.completed !== undefined;
  }

  public get parent(): Project {
    return new Project(this.source.parentId, this.document);
  }

  public get priority(): number {
    return this.parent.projectIds.indexOf(this.id);
  }

  public get projects(): Project[] {
    return this.data.children.map((cId) => new Project(cId, this.document));
  }

  public get projectIds(): string[] {
    return this.data.children;
  }

  public find(namePattern: RegExp, descriptionPattern = /.*/) {
    const results = this.findAll(namePattern, descriptionPattern);
    return results.length > 0 ? results[0] : undefined;
  }

  public findAll(
    namePattern: RegExp,
    descriptionPattern = /.*/,
  ) {
    const results: Project[] = [];
    for (const candidate of this.projects) {
      const nameMatch = candidate.name.match(namePattern);
      const descriptionMatch = candidate.description.match(
        descriptionPattern,
      );
      if (nameMatch && descriptionMatch) {
        results.push(candidate);
      }
    }
    return results;
  }

  public save(): Promise<void> {
    return this.document.save();
  }

  public createProject(priority = -1) {
    if (priority === -1) {
      priority = this.projectIds.length;
    }
    priority = Math.max(0, Math.min(priority, this.projectIds.length));

    const newId = crypto.randomUUID();

    this.document.itemMap.set(newId, {
      id: newId,
      name: "",
      description: undefined,
      parentId: this.id,
      priority: 0, // there is some special algo in WF
      completed: undefined,
      lastModified: this.document.getNow(),
      originalId: undefined,
      isMirrorRoot: false,
      children: [],
    });

    this.projectIds.splice(priority, 0, newId);

    const parentid = this.id === "home" ? "None" : this.id;

    this.document.addOperation({
      type: "create",
      data: {
        projectid: newId,
        parentid,
        priority,
      },
      undo_data: {},
    });

    return new Project(newId, this.document);
  }

  public setName(name: string) {
    this.document.addOperation({
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

  public setDescription(description: string) {
    this.document.addOperation({
      type: "edit",
      data: {
        projectid: this.data.id,
        description,
      },
      undo_data: {
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
        previous_description: this.data.description,
      },
    });
    this.data.description = description;
    return this;
  }

  public move(target: Project, priority = -1) {
    if (priority === -1) {
      priority = target.projectIds.length;
    }
    priority = Math.max(0, Math.min(priority, target.projectIds.length));

    const parentid = target.id === "home" ? "None" : target.id;
    const previous_parentid = this.parent.id === "home"
      ? "None"
      : this.parent.id;

    this.document.addOperation({
      type: "move",
      data: {
        projectid: this.id,
        parentid,
        priority,
      },
      undo_data: {
        previous_parentid,
        previous_priority: this.priority,
        previous_last_modified: this.data.lastModified,
        previous_last_modified_by: null,
      },
    });

    this.parent.projectIds.splice(this.priority, 1);
    this.data.parentId = target.id;
    target.projectIds.splice(priority, 0, this.id);
  }

  public delete() {
    this.document.addOperation({
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
    this.parent.projectIds.splice(this.priority, 1);
  }

  public duplicate(projects: Project[]) {
    for (const project of projects) {
      const newProject = this.createProject();
      newProject.setName(project.name);
      newProject.setDescription(project.description);
      newProject.duplicate(project.projects);
    }
  }

  public isParentOf(child: Project) {
    return this.projectIds.includes(child.id);
  }

  public toString(onlyChildren = false, indent = ""): string {
    const text: string[] = [];
    if (!onlyChildren) {
      text.push(indent + "- " + this.name);
      if (this.description) {
        text.push(indent + "  " + this.description);
      }
    }
    const nextIndent = `${indent}${onlyChildren ? "" : "    "}`;
    const childrenTextChunks = this.projects.map((p) =>
      p.toString(false, nextIndent)
    );

    if (childrenTextChunks.length > 0) {
      text.push(childrenTextChunks.join("\n"));
    }
    return text.join("\n");
  }

  public toJson(): any {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      complete: this.isComplete() ? 1 : 0,
      projects: this.projects.map((p) => p.toJson()),
    };
  }
}
