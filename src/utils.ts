export async function timeoutFetch(
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
