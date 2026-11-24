// Low-volume, read-only cache smoke check. Elapsed time is not Worker CPU time.
const origin = "https://tahinspare.com";
const paths = ["/", "/products", "/category/spare-parts", "/brands", "/blog", "/sitemap.xml", "/api/products?page=1&limit=20"];
for (const path of paths) {
  const samples = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const start = performance.now();
    const response = await fetch(origin + path, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    await response.arrayBuffer();
    samples.push({ status: response.status, cache: response.headers.get("x-tahin-catalogue-cache") ?? "BYPASS/UNREPORTED", elapsedMs: Math.round(performance.now() - start) });
  }
  console.log(JSON.stringify({ path, samples }));
}
