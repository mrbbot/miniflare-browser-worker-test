import assert from "node:assert";
import crypto from "node:crypto";
import { Miniflare, Response, Log, fetch } from "miniflare";
import puppeteer from "puppeteer";

/**
 * @type {Map<string, import("puppeteer").Browser>}
 */
const sessions = new Map();

const mf = new Miniflare({
  log: new Log(),
  port: 8787,
  modules: [
    {
      type: "ESModule",
      path: "dist/index.js",
    }
  ],
  compatibilityDate: "2023-10-01",
  compatibilityFlags: ["nodejs_compat", "no_web_socket_compression"],
  bindings: {
    PATCH_BROWSER: true
  },
  serviceBindings: {
    async BROWSER(request) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/acquire") {
        const session = await puppeteer.launch({headless: false, args: ["--no-sandbox"]});
        const sessionId = crypto.randomUUID();
        sessions.set(sessionId, session);
        return Response.json({ sessionId });
      } else if (url.pathname === "/v1/connectDevtools") {
        assert.strictEqual(request.headers.get("Upgrade"), "websocket");
        const sessionId = url.searchParams.get("browser_session");
        assert(sessionId !== null);
        const session = sessions.get(sessionId);
        assert(session !== undefined);
        const wsEndpoint = session.wsEndpoint();
        const wsUrl = new URL(wsEndpoint);
        wsUrl.protocol = "http:";
        return fetch(wsUrl, {headers: { Upgrade: "websocket" }});
      }
      // TODO: session cleanup

      return new Response(null, { status: 404 });
    }
  }
});

await mf.ready;
