import { getRequestContext } from "@cloudflare/next-on-pages";
import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function POST(
  request: NextRequest,
  { params }: { params: { lower: string } },
) {
  const { lower } = params;
  const { id, checked } = await request.json<{
    id: number;
    checked: boolean;
  }>();
  const ctx = getRequestContext();
  return fetch(`${ctx.env.RESTATE_INGRESS}/checkboxRange/${lower}/set/send`, {
    method: "POST",
    body: JSON.stringify({
      id,
      checked,
    }),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ctx.env.AUTH_TOKEN}`,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { lower: string } },
) {
  const ctx = getRequestContext();
  const { lower } = params;
  return fetch(`${ctx.env.RESTATE_INGRESS}/checkboxRange/${lower}/get`, {
    headers: {
      authorization: `Bearer ${ctx.env.AUTH_TOKEN}`,
    },
  });
}