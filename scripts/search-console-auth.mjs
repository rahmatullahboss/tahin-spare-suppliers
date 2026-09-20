import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { SEARCH_CONSOLE_READONLY_SCOPE } from "./search-console-client.mjs";

export const DEFAULT_AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth";
export const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
export const DEFAULT_REDIRECT_HOST = "127.0.0.1";
export const DEFAULT_REDIRECT_PORT = 53682;
export const DEFAULT_REDIRECT_PATH = "/oauth2callback";

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

export function loadClientCredentials(document) {
  const parsed = typeof document === "string" ? JSON.parse(document) : document;
  const client = parsed?.installed ?? parsed?.web;
  if (!client || typeof client !== "object") {
    throw new Error("OAuth client JSON must contain an installed or web client");
  }
  return {
    clientId: requiredString(client.client_id, "OAuth client_id"),
    clientSecret: requiredString(client.client_secret, "OAuth client_secret"),
    authUri: typeof client.auth_uri === "string" && client.auth_uri.trim() ? client.auth_uri.trim() : DEFAULT_AUTH_URI,
    tokenUri: typeof client.token_uri === "string" && client.token_uri.trim() ? client.token_uri.trim() : DEFAULT_TOKEN_URI,
  };
}

export function buildAuthorizationUrl({ clientId, redirectUri, state, authUri = DEFAULT_AUTH_URI }) {
  const url = new URL(requiredString(authUri, "OAuth auth URI"));
  url.search = new URLSearchParams({
    client_id: requiredString(clientId, "OAuth client ID"),
    redirect_uri: requiredString(redirectUri, "OAuth redirect URI"),
    response_type: "code",
    scope: SEARCH_CONSOLE_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: requiredString(state, "OAuth state"),
  }).toString();
  return url.toString();
}

export function parseOAuthCallback(requestUrl, expectedState) {
  const url = new URL(requestUrl, "http://127.0.0.1");
  const error = url.searchParams.get("error");
  if (error) throw new Error(`Google OAuth denied: ${error}`);
  if (url.searchParams.get("state") !== expectedState) throw new Error("Google OAuth state validation failed");
  return { code: requiredString(url.searchParams.get("code"), "OAuth authorization code") };
}

export async function exchangeAuthorizationCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  tokenUri = DEFAULT_TOKEN_URI,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(requiredString(tokenUri, "OAuth token URI"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: requiredString(code, "OAuth authorization code"),
      client_id: requiredString(clientId, "OAuth client ID"),
      client_secret: requiredString(clientSecret, "OAuth client secret"),
      redirect_uri: requiredString(redirectUri, "OAuth redirect URI"),
      grant_type: "authorization_code",
    }).toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.refresh_token !== "string" || !payload.refresh_token.trim()) {
    const message = typeof payload.error_description === "string" ? payload.error_description : "Google OAuth did not return a refresh token";
    throw new Error(message);
  }
  return { clientId, clientSecret, refreshToken: payload.refresh_token.trim(), tokenUri };
}

export async function writeOAuthTokenFile(filePath, { clientId, clientSecret, refreshToken, tokenUri = DEFAULT_TOKEN_URI }) {
  const targetPath = resolve(requiredString(filePath, "OAuth token file"));
  await mkdir(dirname(targetPath), { recursive: true, mode: 0o700 });
  await writeFile(targetPath, `${JSON.stringify({
    client_id: requiredString(clientId, "OAuth client ID"),
    client_secret: requiredString(clientSecret, "OAuth client secret"),
    refresh_token: requiredString(refreshToken, "OAuth refresh token"),
    token_uri: requiredString(tokenUri, "OAuth token URI"),
  }, null, 2)}\n`, { mode: 0o600 });
  await chmod(targetPath, 0o600);
  return targetPath;
}

export async function runOAuthBootstrap({
  credentialsPath,
  tokenPath,
  host = DEFAULT_REDIRECT_HOST,
  port = DEFAULT_REDIRECT_PORT,
  redirectPath = DEFAULT_REDIRECT_PATH,
  fetchImpl = fetch,
  log = console.log,
}) {
  const credentials = loadClientCredentials(await readFile(resolve(requiredString(credentialsPath, "OAuth credentials file")), "utf8"));
  const redirectUri = `http://${host}:${port}${redirectPath}`;
  const state = randomBytes(24).toString("hex");
  const authorizationUrl = buildAuthorizationUrl({
    clientId: credentials.clientId,
    redirectUri,
    state,
    authUri: credentials.authUri,
  });

  const result = await new Promise((resolveResult, rejectResult) => {
    const server = createServer(async (request, response) => {
      if (!request.url?.startsWith(redirectPath)) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      try {
        const { code } = parseOAuthCallback(request.url, state);
        const token = await exchangeAuthorizationCode({
          code,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          redirectUri,
          tokenUri: credentials.tokenUri,
          fetchImpl,
        });
        await writeOAuthTokenFile(tokenPath, token);
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end("<h1>Search Console authorization complete</h1><p>You may close this window.</p>");
        resolveResult(token);
      } catch (error) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        response.end("Search Console authorization failed. Check the terminal for a safe error message.");
        rejectResult(error);
      } finally {
        server.close();
      }
    });
    server.on("error", rejectResult);
    server.listen(port, host, () => {
      log(`Open this URL in the authorized Google account: ${authorizationUrl}`);
      log(`Waiting for OAuth callback on ${redirectUri}`);
    });
  });

  return { tokenPath: resolve(tokenPath), clientId: result.clientId };
}

function printUsage() {
  console.log("Usage: node scripts/search-console-auth.mjs --credentials /path/client_secret.json --token-file /path/token.json [--port 53682]");
  console.log("The command starts a loopback callback listener and requests only Search Console read-only access.");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") return { help: true };
    if (!argument.startsWith("--")) throw new Error(`Unknown argument: ${argument}`);
    const key = argument.slice(2).replaceAll("-", "_");
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    args[key] = value;
    index += 1;
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) printUsage();
    else {
      const result = await runOAuthBootstrap({
        credentialsPath: args.credentials,
        tokenPath: args.token_file,
        port: args.port ? Number(args.port) : DEFAULT_REDIRECT_PORT,
      });
      console.log(`OAuth token configuration saved to ${result.tokenPath}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
