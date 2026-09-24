import { prisma } from "@/lib/prisma";
import { Category } from "@prisma/client";

export const revalidate = 3600;

export async function generateStaticParams() {
  // Self-hosted: no database during `next build`; pages render on demand.
  const programs = await prisma.program
    .findMany({
      where: {
        addedToMarketplaceAt: {
          not: null,
        },
      },
      select: {
        slug: true,
      },
    })
    .catch(() => [] as { slug: string }[]);

  const categoryPages = Object.values(Category).map((category) => ({
    segments: ["c", category.toLowerCase()],
  }));

  const programPages = programs.map((program) => ({
    segments: [program.slug],
  }));

  return [
    { segments: [] },
    { segments: ["all"] },
    ...categoryPages,
    ...programPages,
  ];
}
