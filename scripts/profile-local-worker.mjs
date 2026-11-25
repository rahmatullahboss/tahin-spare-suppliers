// CPU samples from the local workerd DevTools inspector; never connect remotely.
import assert from "node:assert/strict";
import WebSocket from "ws";

export async function profileLocalWorker(inspectorPort, base, paths) {
  assert.equal(new URL(base).hostname, "127.0.0.1");
  const targets = await (await fetch(`http://127.0.0.1:${inspectorPort}/json/list`)).json();
  const target = targets.find(item => item.webSocketDebuggerUrl);
  assert.ok(target, "No local workerd inspector target");
  const wsUrl = new URL(target.webSocketDebuggerUrl);
  assert.ok(["127.0.0.1", "localhost"].includes(wsUrl.hostname));
  const ws = new WebSocket(wsUrl, { handshakeTimeout: 5000, perMessageDeflate: false });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + " timeout")); }, 10000);
    pending.set(id, {resolve, reject, timer});
    ws.send(JSON.stringify({id, method, params}));
  });
  try {
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, {once: true});
      ws.once("error", reject);
    });
    await send("Profiler.enable");
    await send("Profiler.setSamplingInterval", {interval: 100});
    for (const path of paths) {
      await send("Profiler.start");
      for (let i = 0; i < 4; i++) {
        const response = await fetch(base + path, {headers: {"Cache-Control": "no-cache"}, signal: AbortSignal.timeout(10000)});
        assert.equal(response.status, 200, path);
        await response.arrayBuffer();
      }
      const {profile} = await send("Profiler.stop");
      const nodes = new Map(profile.nodes.map(node => [node.id, node.callFrame]));
      const totals = new Map();
      for (const [i, id] of (profile.samples ?? []).entries()) {
        const frame = nodes.get(id);
        if (!frame || ["(idle)", "(program)", "(root)"].includes(frame.functionName)) continue;
        const key = `${frame.functionName || "(anonymous)"} @ ${frame.url}:${frame.lineNumber + 1}`;
        totals.set(key, (totals.get(key) ?? 0) + (profile.timeDeltas?.[i] ?? 100));
      }
      console.log("LOCAL CPU PROFILE", JSON.stringify({path, samples: profile.samples?.length ?? 0, topSelfMs: [...totals].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([frame,us])=>({frame,ms:Math.round(us/10)/100}))}));
    }
    await send("Profiler.disable");
  } finally {
    ws.close();
  }
}
