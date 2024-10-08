import { Client } from "./client.ts";
import { Document } from "./document.ts";

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
   * @returns {Promise<Document>} WorkFlowy outline
   */
  public async getDocument(): Promise<Document> {
    const initializationData = await this.#client.getInitializationData();
    const treeData = await this.#client.getTreeData();
    return new Document(this.#client, treeData, initializationData);
  }
}
