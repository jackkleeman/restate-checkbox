import * as restate from "@restatedev/restate-sdk/fetch";

const checkboxRange = restate.object({
  name: "checkboxRange",
  handlers: {
    set: async (
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
      if (request.id < 0 || request.id >= 512) {
        throw new restate.TerminalError(
          `id ${request.id} outside of range 0-512`,
        );
      }

      let bitmap = BigInt((await ctx.get<string>("bitmap")) ?? "0");
      const mask = 1n << BigInt(request.id);
      const isChecked = (bitmap & mask) !== 0n;

      if (request.checked === isChecked) {
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
    },
    get: restate.handlers.object.shared(
      async (ctx: restate.ObjectSharedContext) => {
        return (await ctx.get<string>("bitmap")) ?? "0";
      },
    ),
  },
});

const counter = restate.object({
  name: "counter",
  handlers: {
    increment: async (ctx: restate.ObjectContext) => {
      const n = (await ctx.get<number>("counter")) ?? 0;
      ctx.set("counter", n + 1);
    },
    decrement: async (ctx: restate.ObjectContext) => {
      const n = (await ctx.get<number>("counter")) ?? 1;
      ctx.set("counter", n - 1);
    },
    getCount: restate.handlers.object.shared(
      async (ctx: restate.ObjectSharedContext) => {
        return (await ctx.get<number>("counter")) ?? 0;
      },
    ),
  },
});
const Counter: typeof counter = { name: "counter" };

export default restate.endpoint().bind(checkboxRange).bind(counter).handler();
