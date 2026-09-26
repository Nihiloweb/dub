import { prisma } from "@/lib/prisma";
import { DubApiError } from "../errors";
import { isValidDomain } from "./is-valid-domain";
import { validateDubLinkSubdomain } from "./validate-dub-link-subdomain";

export const validateDomain = async (
  domain: string,
): Promise<{ error: string | null; code?: DubApiError["code"] }> => {
  if (!domain || typeof domain !== "string") {
    return { error: "Missing domain", code: "unprocessable_entity" };
  }
  if (!isValidDomain(domain)) {
    return { error: "Invalid domain", code: "unprocessable_entity" };
  }
  if (domain.startsWith("www.")) {
    return {
      error: "Custom domain cannot start with www.",
      code: "unprocessable_entity",
    };
  }
  const dubLinkError = validateDubLinkSubdomain(domain);
  if (dubLinkError) {
    return dubLinkError;
  }
  const exists = await domainExists(domain);
  if (exists) {
    return { error: "Domain is already in use.", code: "conflict" };
  }
  return { error: null };
};

export const domainExists = async (domain: string) => {
  const response = await prisma.domain.findFirst({
    where: {
      slug: domain,
    },
    select: {
      slug: true,
    },
  });
  return !!response;
};

export interface CustomResponse extends Response {
  json: () => Promise<any>;
  error?: { code: string; projectId: string; message: string };
}

// Domains behind a reverse proxy (Coolify/self-host or special Vercel cases).
// On non-Vercel runtimes there is no VERCEL_API_KEY — treat all domains as
// proxied so verify/config skip the Vercel API and avoid "Not authorized".
export const isProxiedDomain = (domain: string) => {
  if (process.env.VERCEL !== "1") {
    return true;
  }
  return ["go.zillow.com"].includes(domain);
};
