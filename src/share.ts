export enum PermissionLevel {
  None = 0,
  View = 1,
  EditAndComment = 2,
  FullAccess = 3,
}

export function fromNativePermissionLevel(level: number): PermissionLevel {
  return level as PermissionLevel;
}

export function toNativePermissionLevel(level: PermissionLevel): number {
  return level;
}

export function createAccessToken(): string {
  const length = 16;
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let l = 0; l < length; l++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function createSharedUrl(accessToken: string): string {
  return `https://workflowy.com/s/${accessToken}`;
}
