import { NoopTinybird, Tinybird } from "@chronark/zod-bird";

// No Tinybird key → noop client so pipe queries return empty results instead of throwing at build/runtime.
export const tb = process.env.TINYBIRD_API_KEY
  ? new Tinybird({
      token: process.env.TINYBIRD_API_KEY,
      baseUrl: process.env.TINYBIRD_API_URL as string,
    })
  : new NoopTinybird();
