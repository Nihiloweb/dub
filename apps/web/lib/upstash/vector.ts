import { Index } from "@upstash/vector";

// Placeholders so module import does not throw during `next build` when Vector is unused (self-hosted MVP).
export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL || "https://example-vector.upstash.io",
  token: process.env.UPSTASH_VECTOR_REST_TOKEN || "unset",
});
