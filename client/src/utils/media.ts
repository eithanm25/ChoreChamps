/** True for a stored file URL/filename ending in .pdf — the only non-image type this app stores. */
export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}
