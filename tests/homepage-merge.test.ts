import assert from "node:assert/strict";
import test from "node:test";
import { HOMEPAGE_DEFAULTS, HOMEPAGE_SECTION_ORDER } from "../src/lib/page-content.ts";
import { deepMerge, mapHomepageContentRows, mapHomepageSection } from "../src/lib/server/homepage-merge.ts";

test("section projection is identical to full homepage for all sections", () => {
  const stored = [
    {section_key:"hero", content_json:JSON.stringify({headlineAccent:"QA",ctaUrl:"https://enquiry",slides:[{url:"/images/example.webp"}]})},
    {section_key:"export-logistics",content_json:{ctaUrl:"/enquiry",title:"QA logistics"}},
    {section_key:"equipment-cta",content_json:{backgroundImage:{alt:"QA image"}}},
    {section_key:"brands",content_json:"invalid JSON"}
  ];
  const full = mapHomepageContentRows(stored);
  for (const section of HOMEPAGE_SECTION_ORDER) {
    assert.deepEqual(mapHomepageSection(section,stored.find(row=>row.section_key===section)?.content_json),full[section]);
  }
  assert.equal(full.hero.ctaUrl,"/enquiry");
  assert.equal(full.hero.headlineAccent,"QA");
  assert.equal(full["equipment-cta"].backgroundImage.url,HOMEPAGE_DEFAULTS["equipment-cta"].backgroundImage.url);
});
test("merge preserves defaults, array replacement, explicit null and undefined behavior", () => {
  const base = {nested:{a:1,b:2},items:[1,2],text:"original",nullable:"original"};
  const result = deepMerge(base,{nested:{b:3},items:[9],text:undefined,nullable:null});
  assert.deepEqual(result,{nested:{a:1,b:3},items:[9],text:"original",nullable:null});
  assert.deepEqual(base,{nested:{a:1,b:2},items:[1,2],text:"original",nullable:"original"});
  const first = mapHomepageContentRows([]);
  first.hero.slides[0].url="/changed";
  assert.notEqual(mapHomepageContentRows([]).hero.slides[0].url,"/changed");
});
