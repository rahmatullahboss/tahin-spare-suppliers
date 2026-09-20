import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  loadClientCredentials,
  parseOAuthCallback,
  writeOAuthTokenFile,
} from "../scripts/search-console-auth.mjs";
import { createGoogleTokenProvider, SEARCH_CONSOLE_READONLY_SCOPE } from "../scripts/search-console-client.mjs";

test("loads an installed Google OAuth client without exposing credentials", () => {
  const credentials = loadClientCredentials({
    installed: {
      client_id: "client-id",
      client_secret: "client-secret",
      auth_uri: "https://accounts.google.com/o/oauth2/v2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
    },
  });

  assert.deepEqual(credentials, {
    clientId: "client-id",
    clientSecret: "client-secret",
    authUri: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUri: "https://oauth2.googleapis.com/token",
  });
});

test("builds a read-only offline OAuth authorization URL and validates its callback state", () => {
  const authorizationUrl = buildAuthorizationUrl({
    clientId: "client-id",
    redirectUri: "http://127.0.0.1:53682/oauth2callback",
    state: "state-value",
  });
  const parsed = new URL(authorizationUrl);

  assert.equal(parsed.searchParams.get("client_id"), "client-id");
  assert.equal(parsed.searchParams.get("access_type"), "offline");
  assert.equal(parsed.searchParams.get("prompt"), "consent");
  assert.equal(parsed.searchParams.get("scope"), SEARCH_CONSOLE_READONLY_SCOPE);
  assert.deepEqual(
    parseOAuthCallback("/oauth2callback?code=auth-code&state=state-value", "state-value"),
    { code: "auth-code" },
  );
});

test("exchanges the authorization code and keeps only the refresh-token configuration", async () => {
  let requestBody = "";
  const token = await exchangeAuthorizationCode({
    code: "auth-code",
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "http://127.0.0.1:53682/oauth2callback",
    fetchImpl: async (_input, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ access_token: "short-lived", refresh_token: "long-lived", expires_in: 3600 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(token.refreshToken, "long-lived");
  assert.match(requestBody, /grant_type=authorization_code/);
  assert.match(requestBody, /code=auth-code/);
  assert.equal("accessToken" in token, false);
});

test("writes a mode-600 token file that the Search Console provider can refresh", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tahin-gsc-auth-"));
  const tokenFile = join(directory, "token.json");
  await writeOAuthTokenFile(tokenFile, {
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "long-lived",
    tokenUri: "https://oauth2.googleapis.com/token",
  });

  const fileMode = (await stat(tokenFile)).mode & 0o777;
  assert.equal(fileMode, 0o600);
  assert.deepEqual(Object.keys(JSON.parse(await readFile(tokenFile, "utf8"))).sort(), [
    "client_id",
    "client_secret",
    "refresh_token",
    "token_uri",
  ]);

  const provider = createGoogleTokenProvider(
    { GSC_TOKEN_FILE: tokenFile },
    async (_input, init) => {
      const body = String(init?.body ?? "");
      assert.match(body, /refresh_token=long-lived/);
      return new Response(JSON.stringify({ access_token: "refreshed-token", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );
  assert.equal(await provider(), "refreshed-token");
});
