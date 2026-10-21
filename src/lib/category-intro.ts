/**
 * Editorial starter copy for the eight default equipment categories.
 * Describes equipment function only; never implies a particular item is in stock.
 * Per-page copy is editable using the existing authenticated UniversalPageEditor.
 */
export interface CategoryIntroCopy {
  heading: string;
  description: string;
  uses: string;
  guidance: string;
}

const DEFAULT_INTROS: Record<string, Omit<CategoryIntroCopy, "heading">> = {
  "marine-propulsion-engine": {
    description: "Marine propulsion engines provide the mechanical power that moves ships and boats through the water, typically by driving a propeller through a shaft and, where required, a reduction gearbox.",
    uses: "They are used in cargo vessels, fishing boats, tugs and other commercial marine applications. Engine output, speed, fuel type and installation arrangement depend on the vessel and its operating duty.",
    guidance: "When identifying a suitable engine, compare the maker, model, rated output, RPM, dimensions and connection arrangements before requesting availability."
  },
  "marine-gearbox": {
    description: "A marine gearbox transfers power from an engine to a propeller shaft while providing the required gear ratio and, on many installations, ahead and astern operation.",
    uses: "Gearboxes are common in propulsion systems on workboats, fishing vessels, tugs and other powered craft. Ratio, rotation, torque capacity and mounting arrangements are crucial to compatibility.",
    guidance: "For an enquiry, share the gearbox maker, model, ratio, input power, RPM and a nameplate photo when available."
  },
  "auxiliary-engine": {
    description: "A marine auxiliary engine supplies mechanical power for equipment and services on board rather than directly propelling the vessel.",
    uses: "Depending on the installation, auxiliary engines can drive generators, pumps, compressors and other onboard machinery needed for normal vessel operation.",
    guidance: "Check the engine model, rated power and speed, intended driven equipment and installation details when comparing options."
  },
  "diesel-generator-set": {
    description: "A diesel or gas generator set combines an engine with an alternator to produce electrical power for a vessel, facility or industrial installation.",
    uses: "Generator sets are used for primary, backup and auxiliary electrical supply. Capacity, voltage, frequency, duty rating and fuel type vary according to the application.",
    guidance: "Share the required kVA or kW rating, voltage, frequency, RPM, operating duty and preferred engine or alternator make."
  },
  "spare-parts": {
    description: "Marine and industrial spare parts are replacement components used to maintain, repair or overhaul engines, pumps, generators, gearboxes and other machinery.",
    uses: "Items can include filters, bearings, seals, gaskets, valves and other wear or service components. Correct fit depends on the specific equipment and part revision.",
    guidance: "Part numbers, maker and model information, measurements and clear photos help identify compatible replacements."
  },
  "hydraulic-deck-crane-equipment": {
    description: "Hydraulic deck cranes and their associated equipment use fluid power to lift, position and handle loads on vessels and offshore or dockside installations.",
    uses: "Common applications include cargo handling, stores transfer and deck operations. Safe selection depends on the rated load, outreach, hydraulic pressure and mounting arrangement.",
    guidance: "For components or equipment, provide the manufacturer, model, capacity, operating specifications and part identification."
  },
  "anchor-and-chain": {
    description: "Marine anchors and anchor chains form part of a vessel's anchoring arrangement, helping secure the vessel to the seabed when at anchor.",
    uses: "Anchor type, chain grade, link size and overall length are selected to suit vessel requirements and applicable marine standards.",
    guidance: "Confirm anchor weight and type, chain diameter and grade, required length and any class or certification requirements."
  },
  "marine-pump": {
    description: "Marine pumps move water, fuel, oil and other fluids through shipboard piping and machinery systems.",
    uses: "Depending on their design, pumps are used for cooling, bilge and ballast duties, firefighting, fuel transfer and other vessel services.",
    guidance: "For a pump enquiry, share the maker, model, liquid handled, required flow, head or pressure, RPM and material specifications."
  }
};

export function getCategoryIntroCopy(
  slug: string,
  label: string,
  parentName?: string
): CategoryIntroCopy {
  const name = label.trim() || "Marine Equipment";
  if (parentName) {
    return {
      heading: `About ${name}`,
      description: `${name} is a category of equipment or components associated with ${parentName}. Its exact function and operating requirements depend on the make, model and installation.`,
      uses: `These products may be used in maintenance, replacement or new equipment projects where the original technical specification needs to be matched.`,
      guidance: `Browse the listings below and provide a part number, model, dimensions or photos when requesting a compatibility and availability check.`
    };
  }
  const known = DEFAULT_INTROS[slug];
  if (known) return { heading: `Understanding ${name}`, ...known };
  return {
    heading: `About ${name}`,
    description: `${name} includes marine or industrial equipment and associated components that are selected for a specific technical application.`,
    uses: `The suitable specification depends on the machinery, installation, required operating duty and compatibility with existing equipment.`,
    guidance: `Browse available listings below, or send the maker, model, technical requirements and reference photos for an enquiry.`
  };
}

/** Avoid legacy category image paths that are not included in the site's public assets. */
export function getCategoryIntroImage(
  categoryImageUrl: string,
  productImageUrls: readonly (string | null | undefined)[]
): string {
  // Uploaded category images are first choice; the initial legacy category
  // images are not bundled in public/images. Prefer a real catalog image.
  if (categoryImageUrl && !/^\/images\/(marine-propulsion-engine|marine-gearbox|auxiliary-engine|diesel-generator-set|spare-parts-new|hydraulic-crane-equipment|anchor-chain|marine-pump)\.jpg$/.test(categoryImageUrl)) {
    return categoryImageUrl;
  }
  return productImageUrls.find((url): url is string => typeof url === "string" && url.trim().length > 0)
    ?? "/images/warehouse.webp";
}
