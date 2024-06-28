import * as restate from "@restatedev/restate-sdk/fetch";

const rangeSize = 512;

const get = restate.handlers.object.shared(
  async (ctx: restate.ObjectSharedContext) => {
    const bitmap = (await ctx.get<string>("bitmap")) ?? "0";
    return bitmap;
  },
);

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
  const mask = 1n << BigInt(request.id);
  const isChecked = (bitmap & mask) !== 0n;
  if (request.checked === isChecked) {
    // no change
    return bitmap.toString();
  }
  if (request.checked) {
    ctx.objectSendClient(Counter, "0").increment();
    bitmap = bitmap | mask;
  } else {
    ctx.objectSendClient(Counter, "0").decrement();
    bitmap = bitmap & ~mask;
  }
  const bitmapS = bitmap.toString();
  ctx.set<string>("bitmap", bitmapS);
  return bitmapS;
};

const checkboxRange = restate.object({
  name: "checkboxRange",
  handlers: { set, get },
});

const increment = async (ctx: restate.ObjectContext) => {
  const n = (await ctx.get<number>("counter")) ?? 0;
  ctx.set("counter", n + 1);
};

const decrement = async (ctx: restate.ObjectContext) => {
  const n = (await ctx.get<number>("counter")) ?? 1;
  ctx.set("counter", n - 1);
};

const getCount = restate.handlers.object.shared(
  async (ctx: restate.ObjectSharedContext) => {
    return (await ctx.get<number>("counter")) ?? 0;
  },
);

const counter = restate.object({
  name: "counter",
  handlers: { increment, decrement, getCount },
});
const Counter: typeof counter = { name: "counter" };

export default restate.endpoint().bind(checkboxRange).bind(counter).handler();
