import type { APIRoute } from "astro";
import { getIndexNowKey } from "../lib/server/indexnow";
import { getRuntimeEnv } from "../lib/server/env";

export const GET: APIRoute = ({ locals }) => {
  const key = getIndexNowKey(getRuntimeEnv(locals));

  if (!key) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
