import { Client } from "./client.ts";
import { Document } from "./document.ts";
export { Document };

export class WorkFlowy {
  public readonly client: Client;

  constructor(username: string, password: string) {
    this.client = new Client(username, password);
  }

  async getDocument() {
    const initializationData = await this.client.getInitializationData();
    const items = await this.client.getTreeData();
    return new Document(this.client, items, initializationData);
  }
}
