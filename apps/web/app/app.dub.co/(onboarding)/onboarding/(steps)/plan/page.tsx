import { redirect } from "next/navigation";

// Self-hosted: skip Stripe plan selection; go straight to success.
export default async function Plan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      qs.set(key, value);
    } else if (Array.isArray(value) && value[0]) {
      qs.set(key, value[0]);
    }
  }
  const query = qs.toString();
  redirect(`/onboarding/success${query ? `?${query}` : ""}`);
}
