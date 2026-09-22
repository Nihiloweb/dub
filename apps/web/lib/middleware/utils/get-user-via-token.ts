import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { UserProps } from "@/lib/types";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

export async function getUserViaToken(req: NextRequest) {
  const session = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: SESSION_COOKIE_NAME,
  })) as {
    email?: string;
    user?: UserProps;
  };

  return session?.user;
}
