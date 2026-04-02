export type RuntimeEnv = App.Locals["runtime"]["env"];

export function getRuntimeEnv(locals: App.Locals): RuntimeEnv {
  if (!locals?.runtime?.env) {
    throw new Error("Cloudflare runtime environment is not available.");
  }

  return locals.runtime.env;
}
