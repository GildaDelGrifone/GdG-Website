// I file in src/content hanno la data davanti ("2026-10-28-titolo.md") per restare ordinati;
// nell'URL la data non serve: /serate/titolo/.
export const articleSlug = (id: string) => id.replace(/^\d{4}-\d{2}(-\d{2})?-/, '');

export const articlePath = (collection: 'serate' | 'news', entry: { id: string }) =>
  `/${collection}/${articleSlug(entry.id)}`;

// Dopo aver tolto la data due articoli potrebbero avere lo stesso URL: meglio fermare la build.
export function articleStaticPaths<T extends { id: string }>(entries: T[]) {
  const seen = new Map<string, string>();
  return entries.map((entry) => {
    const slug = articleSlug(entry.id);
    const clash = seen.get(slug);
    if (clash) throw new Error(`Due articoli con lo stesso URL "${slug}": ${clash} e ${entry.id}`);
    seen.set(slug, entry.id);
    return { params: { slug }, props: { entry } };
  });
}
