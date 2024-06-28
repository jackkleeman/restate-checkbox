import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "edge";
export const revalidate = 0;

export async function GET(_request: NextRequest) {
  const ctx = getRequestContext();
  return fetch(
    `${ctx.env.RESTATE_INGRESS ?? "http://localhost:8080"}/counter/0/getCount`,
    {
      headers: {
        authorization: `Bearer ${ctx.env.AUTH_TOKEN ?? ""}`,
      },
    },
  );
}
