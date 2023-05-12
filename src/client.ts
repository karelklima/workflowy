import { getSetCookies, setCookie } from "../deps.ts";

import {
  type InitializationData,
  InitializationDataSchema,
  type LoginResult,
  LoginResultSchema,
  type Operation,
  type OperationResult,
  OperationResultSchema,
  TreeDataSchema,
  type TreeItem,
} from "./schema.ts";

const WORKFLOWY_URL = "https://workflowy.com";
const LOGIN_URL = `${WORKFLOWY_URL}/ajax_login`;
const INITIALIZATION_DATA_URL =
  `${WORKFLOWY_URL}/get_initialization_data?client_version=21&client_version_v2=28&no_root_children=1`;
const TREE_DATA_URL = `${WORKFLOWY_URL}/get_tree_data/`;
const PUSH_AND_POLL_URL = `${WORKFLOWY_URL}/push_and_poll`;
const CLIENT_VERSION = "21";
const SESSION_COOKIE_NAME = `sessionid`;

/**
 * A class that facilitates authentication, fetching and updating data from
 * WorkFlowy internal API, using the same methods as WorkFlowy application.
 *
 * ### Basic example
 *
 * ```ts
 * import { Client, type TreeItem, type Operation } from "workflowy"
 *
 * const client = new Client("username", "password");
 * const items: TreeItem[] = await client.getTreeData();
 *
 * const updateOperations: Operation[] = [];
 * const updateResult = await client.pushAndPull(updateOperations);
 * ```
 */
export class Client {
  #sessionHeaders = new Headers();
  #clientId: string;
  #lastTransactionId: string | undefined;

  #username: string;
  #password: string;

  /**
   * Cretes a new Client instance using WorkFlowy username and password
   * @param username WorkFlowy username
   * @param password WorkFlowy password
   */
  constructor(username: string, password: string) {
    this.#username = username;
    this.#password = password;
    this.#clientId = this.createClientId();
  }

  private createClientId() {
    const date = new Date();

    const pad = (number: number, digits = 2) =>
      String(number).padStart(digits, "0");

    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());
    const milliseconds = pad(date.getUTCMilliseconds(), 3);

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  async #timeoutFetch(
    url: string | URL,
    init: RequestInit = {},
    timeout = 20000,
  ) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const result = await fetch(url, init);
    clearTimeout(id);
    return result;
  }

  async #authenticatedFetch(
    url: string | URL,
    init: RequestInit = {},
    // deno-lint-ignore no-explicit-any
  ): Promise<any> {
    let response = await this.#timeoutFetch(url, {
      ...init,
      headers: this.#sessionHeaders,
    });

    if (!response.ok) {
      await response.body?.cancel();
      await this.login();
      response = await this.#timeoutFetch(url, {
        ...init,
        headers: this.#sessionHeaders,
      });
    }

    if (!response.ok) {
      throw Error(
        `WorkFlowy request error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  async #getLastTransactionId() {
    if (this.#lastTransactionId === undefined) {
      const initializationData = await this.getInitializationData();
      this.#lastTransactionId =
        initializationData.initialMostRecentOperationTransactionId;
    }
    return this.#lastTransactionId;
  }

  /**
   * Authenticates the user. Methods like `.getTreeData()` and `.getInicializationData()`
   * call this method if the user is not yet authenticated.
   *
   * Queries `workflowy.com/ajax_login` endpoint
   * @returns `{ success: true }` if the autentication was successful
   * @throws Error if the authentication failed
   */
  public async login(): Promise<LoginResult> {
    const formData = new FormData();
    formData.append("username", this.#username);
    formData.append("password", this.#password);

    const response = await this.#timeoutFetch(LOGIN_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw Error(
        `WorkFlowy login error: ${response.status} ${response.statusText}`,
      );
    }

    const loginResponse = await response.json();
    const loginResult = LoginResultSchema.parse(loginResponse);

    if (!loginResult.success) {
      throw Error(`WorkFlowy login error: ${loginResult.errors.join(", ")}`);
    }

    const cookies = getSetCookies(response.headers);

    for (const cookie of cookies) {
      if (cookie.name === SESSION_COOKIE_NAME) {
        const dummyHeaders = new Headers();
        setCookie(dummyHeaders, cookie);
        this.#sessionHeaders.set("Cookie", dummyHeaders.get("Set-Cookie")!);
      }
    }

    return loginResult;
  }

  #initializationDataPromise: Promise<InitializationData> | undefined;

  /**
   * Fetches initialization data from WorkFlowy, needed to further query
   * WorkFlowy endpoints in order to fetch and update WorkFlowy document
   *
   * Queries `workflowy.com/get_initialization_data` endpoint
   * @returns Some initialization information about the user
   */
  public async getInitializationData(): Promise<InitializationData> {
    if (this.#initializationDataPromise === undefined) {
      this.#initializationDataPromise = (async () => {
        const json = await this.#authenticatedFetch(INITIALIZATION_DATA_URL);
        return InitializationDataSchema.parse(json);
      })();
    }
    return await this.#initializationDataPromise;
  }

  /**
   * Fetches the whole WorkFlowy document
   *
   * Queries `workflowy.com/get_tree_data` endpoint
   * @returns List of all items in WorkFlowy document
   */
  public async getTreeData(): Promise<TreeItem[]> {
    const json = await this.#authenticatedFetch(TREE_DATA_URL);
    const data = TreeDataSchema.parse(json);
    this.#lastTransactionId = data.most_recent_operation_transaction_id;
    return data.items;
  }

  /**
   * Applies a list of operations to WorkFlowy document
   *
   * Queries `workflowy.com/push_and_pull` endpoint
   * @param operations List of operations to perform in WorkFlowy
   * @returns List of operations ran on WorkFlowy since last push and pull
   */
  public async pushAndPull(operations: Operation[]): Promise<OperationResult> {
    const initializationData = await this.getInitializationData();
    const time = Math.floor(Date.now() / 1000);
    const timestamp = time -
      initializationData.dateJoinedTimestampInSeconds;
    const lastTransactionId = await this.#getLastTransactionId();
    const push_poll_id = crypto.randomUUID().substring(0, 8);

    const ops = operations.map((operation) => ({
      ...operation,
      client_timestamp: timestamp,
    }));

    const push_poll_data = JSON.stringify([
      {
        most_recent_operation_transaction_id: lastTransactionId,
        operations: ops,
      },
    ]);

    const formData = new FormData();
    formData.append("client_id", this.#clientId);
    formData.append("client_version", CLIENT_VERSION);
    formData.append("push_poll_id", push_poll_id);
    formData.append("push_poll_data", push_poll_data);
    formData.append(
      "crosscheck_user_id",
      initializationData.ownerId.toString(),
    );

    const json = await this.#authenticatedFetch(PUSH_AND_POLL_URL, {
      method: "POST",
      body: formData,
    });

    const operationResult = OperationResultSchema.parse(json);

    this.#lastTransactionId =
      operationResult.new_most_recent_operation_transaction_id;
    return operationResult;
  }

  /** Returns the client ID that this instance uses to query WorkFlowy */
  public get clientId(): string {
    return this.#clientId;
  }

  /** Returns the session headers with authentication cookie to query WorkFlowy */
  public get sessionHeaders(): Headers {
    return this.#sessionHeaders;
  }
}
