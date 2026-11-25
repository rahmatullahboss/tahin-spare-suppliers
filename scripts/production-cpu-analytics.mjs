// Read-only account analytics. Never print credentials, request headers, or email payloads.
import assert from "node:assert/strict";
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
assert.ok(account && token, "Cloudflare analytics credentials required");
const hours = Number(process.argv[2] ?? 24);
assert.ok(Number.isFinite(hours) && hours >= 1 && hours <= 168);
const end = Date.now();
const start = end - hours * 3600000;
const script = "tahin-spare-suppliers";
const version = process.argv[3];
assert.ok(!version || /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(version), "Optional Worker version must be a UUID");
async function call(path, body) {
  const response = await fetch("https://api.cloudflare.com/client/v4/" + path, {
    method: "POST",
    headers: {Authorization: "Bearer " + token, "Content-Type": "application/json"},
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000)
  });
  const data = await response.json();
  if (!response.ok || data.errors?.length) throw new Error("Cloudflare analytics failed: HTTP " + response.status + " " + (data.errors ?? []).map(e=>e.message).join("; "));
  return data;
}
const variables = {accountTag:account,start:new Date(start).toISOString(),end:new Date(end).toISOString(),script,...(version ? {version} : {})};
const query = `query Metrics($accountTag:string,$start:string,$end:string,$script:string${version ? ',$version:string' : ''}){
  viewer{accounts(filter:{accountTag:$accountTag}){
    workersInvocationsAdaptive(limit:10,filter:{scriptName:$script,datetime_geq:$start,datetime_leq:$end,isPreview:0${version ? ',scriptVersion:$version' : ''}}){
      sum{requests errors subrequests} quantiles{cpuTimeP50 cpuTimeP95 cpuTimeP99}
    }
  }}
}`;
const graphql = await call("graphql",{query,variables});
const groups = graphql.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
console.log(JSON.stringify({window:{start:variables.start,end:variables.end},worker:script,version:version ?? "all-production",aggregate:groups},null,2));
const path = `accounts/${encodeURIComponent(account)}/workers/observability/telemetry/query`;
const cpuKey = "$workers.cpuTimeMs";
const telemetry = await call(path,{
  queryId:"tahin-cpu-route-audit",timeframe:{from:start,to:end},dry:true,
  view:"calculations",chartType:"aggregate",limit:10,
  parameters:{
    filters:[
      {key:"$workers.scriptName",operation:"eq",type:"string",value:script},
      ...(version ? [{key:"$workers.scriptVersion.id",operation:"eq",type:"string",value:version}] : []),
      {key:"$workers.eventType",operation:"eq",type:"string",value:"fetch"},
      {key:cpuKey,operation:"gte",type:"number",value:0}
    ],
    groupBys:[{type:"string",value:"$workers.event.path"}],
    calculations:[{operator:"count",alias:"requests"},...[
      ["sum","totalCpuMs"],["median","p50Ms"],["p95","p95Ms"]
    ].map(([operator,alias])=>({operator,alias,key:cpuKey,keyType:"number"}))],
    orderBy:{value:"totalCpuMs",order:"desc"}
  }
});
const byRoute = new Map();
for(const calculation of telemetry.result?.calculations ?? []) {
  for(const row of calculation.aggregates ?? []) {
    // API returns pathname only, never query strings or request bodies.
    const pathname = String(row.groupKey ?? "").split("?")[0];
    const record = byRoute.get(pathname) ?? {path:pathname};
    record[calculation.alias] = row.value;
    byRoute.set(pathname,record);
  }
}
console.log(JSON.stringify({retainedLogRoutes:[...byRoute.values()].sort((a,b)=>(b.totalCpuMs??0)-(a.totalCpuMs??0))},null,2));
