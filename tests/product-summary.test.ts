import assert from "node:assert/strict";
import test from "node:test";
import { mapProductSummary } from "../src/lib/server/product-summary.ts";
import { cleanProductTitle, canonicalizeBrand } from "../src/lib/inventory-quality.ts";
import { resolveProductSeo } from "../src/lib/seo.ts";

test("summary retains the original visible field and image-alt semantics", () => {
  for (const row of [
    {id:"1",slug:"cat",name:"CAT   engine",brand:"CAT",model_number:" 3406 ",part_number:" P1 ",image_alt:" Custom   alt ",category:"Spare Parts",short_description:"Description",image_url:"/a.webp"},
    {id:"2",slug:"empty",name:"",brand:null,category:"",image_alt:""},
    {id:"3",slug:"fallback",name:"Yanmar engine",brand:"Yanmar",model_number:"6N",part_number:"P2"}
  ]) {
    const actual = mapProductSummary(row);
    const title = cleanProductTitle(row.name);
    const brand = canonicalizeBrand(row.brand);
    const modelNumber = row.model_number ?? "";
    const partNumber = row.part_number ?? "";
    assert.deepEqual(actual, {
      id:row.id,slug:row.slug,title,brand,model_number:modelNumber,partNumber,
      category:row.category || "Uncategorized",subcategory:"",excerpt:row.short_description ?? "",
      imageUrl:row.image_url ?? "",updatedAt:"",
      imageAlt:resolveProductSeo({title,brand,modelNumber,partNumber,imageAlt:row.image_alt}).imageAlt
    });
  }
});

test("summary does not access unselected full-detail fields", () => {
  const row = {name:"Engine",id:"1",slug:"engine"};
  for (const key of ["gallery_images","related_products","seo_title","meta_description","focus_keyword","availability_verified_at","condition_verified_at","additional_categories"]) {
    Object.defineProperty(row,key,{get(){throw new Error("Unexpected full-record read: "+key)}});
  }
  assert.equal(mapProductSummary(row).title,"Engine");
});
