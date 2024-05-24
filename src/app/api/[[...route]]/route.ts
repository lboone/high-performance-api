import { Redis } from "@upstash/redis/cloudflare";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";

export const runtime = "edge";

const app = new Hono().basePath("/api");

type EnvConfig = {
  UPSTASH_REDIS_REST_TOKEN: string;
  UPSTASH_REDIS_REST_URL: string;
};

app.use('/*', cors());
app.get("/search", async (ctx) => {
  try {
    // --------------------------
    const start = performance.now();
    // --------------------------
    const { UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL } =
      env<EnvConfig>(ctx);
    const redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });

    const query = ctx.req.query("q")?.toUpperCase();
    if (!query)
      return ctx.json({ message: "Invalid search query" }, { status: 400 });

    const res = [];
    const rank = await redis.zrank("hpa_terms", query);

    if (rank !== null && rank !== undefined) {
      const temp = await redis.zrange<string[]>("hpa_terms", rank, rank + 200);

      for (const el of temp) {
        if (!el.startsWith(query)) {
          break;
        }

        if (el.endsWith("*")) {
          res.push(el.slice(0, el.length - 1));
        }
      }
    }

    // --------------------------
    const end = performance.now();
    // --------------------------

    return ctx.json({ results: res, duration: end - start });
  } catch (error) {
    console.error(error);
    return ctx.json({ results: [], message: "Internal server error" }, { status: 500 });
  }
});

export const GET = handle(app);
export default app as never;
