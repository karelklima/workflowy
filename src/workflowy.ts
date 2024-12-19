import { Client } from "./client.ts";
import { Document } from "./document.ts";
import { TreeData } from "./schema.ts";

/**
 * The entry point of the library
 *
 * ### Basic example
 *
 * ```ts
 * import { WorkFlowy } from "workflowy"
 *
 * const workflowy = new WorkFlowy("username", "password");
 * const document = await workflowy.getDocument();
 *
 * console.log(String(document.root))
 * ```
 */
export class WorkFlowy {
  #client: Client;

  constructor(username: string, password: string) {
    this.#client = new Client(username, password);
  }

  /**
   * Returns the WorkFlowy client instance that is used to fetch and update
   * data in WorkFlowy.
   *
   * @returns {Client}
   */
  public getClient(): Client {
    return this.#client;
  }

  /**
   * Loads data from WorkFlowy and creates an interactive document out of it
   *
   * @param includeSharedLists whether to download dependent shared lists
   * @returns {Promise<Document>} WorkFlowy outline
   */
  public async getDocument(includeSharedLists = true): Promise<Document> {
    const initializationData = await this.#client.getInitializationData();
    const treeData = await this.#client.getTreeData();
    const sharedTrees: Record<string, TreeData> = includeSharedLists
      ? await this.getSharedTrees(treeData)
      : {};

    return new Document(
      this.#client,
      treeData,
      initializationData,
      sharedTrees,
    );
  }

  private async getSharedTrees(
    treeData: TreeData,
  ): Promise<Record<string, TreeData>> {
    const sharedTrees: Record<string, TreeData> = {};
    const queue: string[] = [];
    const memo: Record<string, boolean> = {};

    const extractSharedItems = (data: TreeData) => {
      for (const item of data.items) {
        if (item.shareId !== undefined && memo[item.shareId] !== true) {
          queue.push(item.shareId);
          memo[item.shareId] = true;
        }
      }
    };

    extractSharedItems(treeData);

    while (queue.length > 0) {
      const shareId = queue.pop()!;
      const sharedTree = await this.#client.getSharedTreeData(shareId);

      extractSharedItems(sharedTree);

      sharedTrees[shareId] = sharedTree;
    }

    return sharedTrees;
  }
}
