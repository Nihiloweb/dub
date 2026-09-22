import { prisma } from "@/lib/prisma";
import { cache } from "react";

// Called from generateStaticParams during `next build` — no database then.
// Return [] so those pages render on demand.
export const getProgramSlugs = cache(async () => {
  try {
    return await prisma.program.findMany({
      select: {
        slug: true,
      },
      orderBy: {
        applications: {
          _count: "desc",
        },
      },
      take: 250,
    });
  } catch {
    return [];
  }
});
