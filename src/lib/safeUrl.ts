/** Returns the URL only if it is http(s); bare "www." links get https. Anything else (javascript:, data:) is dropped. */
export function safeUrl(input: string | null | undefined): string | undefined {
  const url = input?.trim();
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^www\./i.test(url)) return `https://${url}`;
  return undefined;
}
