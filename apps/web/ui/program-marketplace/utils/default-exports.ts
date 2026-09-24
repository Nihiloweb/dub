export const revalidate = 3600;

// Self-hosted: no database during `next build`, so nothing is prerendered.
// Marketplace pages render on demand (and are cached via `revalidate`).
export async function generateStaticParams() {
  return [];
}
