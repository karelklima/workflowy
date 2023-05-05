import { DateTime, getSetCookies, log, setCookie } from "../deps.ts";

import { timeoutFetch } from "./utils.ts";

import {
  InitializationData,
  InitializationDataSchema,
  Operation,
  OperationResultSchema,
  TreeDataSchema,
} from "./schema.ts";

const WORKFLOWY_URL = "https://workflowy.com";
const LOGIN_URL = `${WORKFLOWY_URL}/ajax_login`;
const INITIALIZATION_URL =
  `${WORKFLOWY_URL}/get_initialization_data?client_version=21&client_version_v2=28&no_root_children=1`;
const TREE_URL = `${WORKFLOWY_URL}/get_tree_data/`;
const UPDATE_URL = `${WORKFLOWY_URL}/push_and_poll`;
const CLIENT_VERSION = "21";

const SESSION_COOKIE_NAME = `sessionid`;

export class Client {
  private sessionHeaders = new Headers();
  private clientId = DateTime.utc().toFormat("yyyy-MM-dd HH:mm:ss.SSS");
  private lastTransactionId: string | undefined;

  constructor(private username: string, private password: string) {}

  public async login(): Promise<void> {
    log.info("WorkFlowy Client: logging in");
    const formData = new FormData();
    formData.append("username", this.username);
    formData.append("password", this.password);

    const response = await timeoutFetch(LOGIN_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw Error(
        `Error with WorkFlowy login: ${response.status} ${response.statusText}`,
      );
    }

    const cookies = getSetCookies(response.headers);

    for (const cookie of cookies) {
      if (cookie.name === SESSION_COOKIE_NAME) {
        const dummyHeaders = new Headers();
        setCookie(dummyHeaders, cookie);
        this.sessionHeaders.set("Cookie", dummyHeaders.get("Set-Cookie")!);
      }
    }

    await response.text();
  }

  public async getWebSocketStream(): Promise<WebSocketStream> {
    await this.login();
    return new WebSocketStream(
      `wss://workflowy.com/ws/signal/${this.clientId}/`,
      {
        headers: this.sessionHeaders,
      },
    );
  }

  protected async authenticatedFetch(
    url: string | URL,
    init: RequestInit = {},
  ): Promise<any> {
    let response = await timeoutFetch(url, {
      ...init,
      headers: this.sessionHeaders,
    });

    if (!response.ok) {
      await response.body?.cancel();
      await this.login();
      response = await timeoutFetch(url, {
        ...init,
        headers: this.sessionHeaders,
      });
    }

    if (!response.ok) {
      throw Error(
        `Error with WorkFlowy request: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  public async getLastTransactionId() {
    if (this.lastTransactionId === undefined) {
      const initializationData = await this.getInitializationData();
      this.lastTransactionId =
        initializationData.initialMostRecentOperationTransactionId;
    }
    return this.lastTransactionId;
  }

  private initializationData: InitializationData | undefined;

  public async getInitializationData(reload = false) {
    if (this.initializationData === undefined || reload) {
      const json = await this.authenticatedFetch(INITIALIZATION_URL);
      this.initializationData = InitializationDataSchema.parse(json);
    }
    return this.initializationData;
  }

  public async getTreeData() {
    const json = await this.authenticatedFetch(TREE_URL);
    const data = TreeDataSchema.parse(json);
    this.lastTransactionId = data.most_recent_operation_transaction_id;
    return data;
  }

  public async update(operations: Operation[]) {
    const initializationData = await this.getInitializationData();
    const time = DateTime.utc();
    const timestamp = time.toSeconds() -
      initializationData.dateJoinedTimestampInSeconds;
    const lastTransactionId = await this.getLastTransactionId();
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
    formData.append("client_id", this.clientId);
    formData.append("client_version", CLIENT_VERSION);
    formData.append("push_poll_id", push_poll_id);
    formData.append("push_poll_data", push_poll_data);
    // formData.append("timezone", TIMEZONE);
    formData.append(
      "crosscheck_user_id",
      initializationData.ownerId.toString(),
    );

    const json = await this.authenticatedFetch(UPDATE_URL, {
      method: "POST",
      body: formData,
    });

    log.debug("WorkFlowy Client: Update operation result");
    log.debug(json);

    const result = OperationResultSchema.parse(json);

    if (result.error_encountered_in_remote_operations) {
      throw new Error("Error encountered in remote WorkFlowy operations");
    }

    this.lastTransactionId = result.new_most_recent_operation_transaction_id;
  }
}
