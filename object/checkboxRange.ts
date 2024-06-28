import * as restate from "@restatedev/restate-sdk/fetch";

const rangeSize = 512;

const get = async (ctx: restate.ObjectSharedContext) => {
  const bitmap = (await ctx.get<string>("bitmap")) ?? "0";
  return bitmap;
};

const set = async (
  ctx: restate.ObjectContext,
  request?: {
    id: number;
    checked: boolean;
  },
) => {
  if (request?.id === undefined) {
    throw new restate.TerminalError("Missing request id");
  }
  if (request?.checked === undefined) {
    throw new restate.TerminalError("Missing checked");
  }
  if (request.id < 0 || request.id >= rangeSize) {
    throw new restate.TerminalError(
      `id ${request.id} outside of range 0-${rangeSize}`,
    );
  }
  let bitmap: bigint;
  try {
    bitmap = BigInt((await ctx.get<string>("bitmap")) ?? "0");
  } catch (e) {
    bitmap = 0n;
  }
  if (request.checked) {
    bitmap = bitmap | (1n << BigInt(request.id));
  } else {
    bitmap = bitmap & ~(1n << BigInt(request.id));
  }
  const bitmapS = bitmap.toString();
  ctx.set<string>("bitmap", bitmapS);
  return bitmapS;
};

export default restate
  .endpoint()
  .bind(
    restate.object({
      name: "checkboxRange",
      handlers: { set, get },
    }),
  )
  .handler();
