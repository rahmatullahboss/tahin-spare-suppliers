export type CategoryBuyingGuidance = {
  supplySummary: string;
  requestDetails: string[];
  inspectionNote: string;
};

const GUIDANCE: Record<string, CategoryBuyingGuidance> = {
  "Spare Parts": {
    supplySummary: "Current listings cover marine-engine and machinery components from multiple makers. Exact interchangeability should be confirmed against the maker, engine or equipment model and the required part number before ordering.",
    requestDetails: [
      "Maker / brand and engine or equipment model",
      "OEM or manufacturer part number, if known",
      "Required quantity and a clear photo or nameplate reference when available",
      "Preferred condition if the requirement must be new, unused, used or reconditioned",
    ],
    inspectionNote: "Condition and stock status vary by individual component. Ask for the current listing details and any available photos, measurements or inspection information for the exact part you are considering.",
  },
  "Diesel & Gas Generator Set": {
    supplySummary: "Current generator-set listings include marine and industrial units from makers represented in the live inventory. Match the set to the required electrical output and engine/alternator configuration rather than relying on brand name alone.",
    requestDetails: [
      "Engine maker and model, plus alternator maker/model when known",
      "Required kVA or kW output",
      "Voltage, frequency and RPM requirement",
      "Preferred condition and any dimensional or installation constraints",
    ],
    inspectionNote: "For a listed set, request the currently recorded nameplate/specification information and confirm what inspection or testing evidence is available for that specific unit before shipment.",
  },
  "Marine Gearbox": {
    supplySummary: "Marine gearbox selection depends on the exact maker/model and drivetrain requirement. Current listings should be matched against the vessel or engine installation before a purchase decision.",
    requestDetails: [
      "Gearbox maker and exact model",
      "Required reduction or gear ratio",
      "Engine model / input requirement and vessel application",
      "Nameplate photo, serial information or existing gearbox reference when available",
    ],
    inspectionNote: "Confirm the listed gearbox condition, ratio/nameplate information and any available inspection details for the specific unit. Do not assume two similar model families are interchangeable.",
  },
  "Marine Propulsion Engine": {
    supplySummary: "Current propulsion-engine listings cover complete engines and related marine machinery. Selection should be based on the exact maker/model and the vessel's required operating specification.",
    requestDetails: [
      "Engine maker and exact model",
      "Required power and RPM, if known",
      "Vessel/application details and existing engine reference",
      "Preferred condition plus nameplate or serial information when available",
    ],
    inspectionNote: "Ask for the current unit's recorded condition, specification/nameplate information, photos and the inspection or reconditioning scope that can actually be documented for that engine.",
  },
  "Auxiliary Engine": {
    supplySummary: "Auxiliary-engine requirements should be matched to maker/model, application and operating specification. Current listed units may differ in configuration even within the same maker family.",
    requestDetails: [
      "Engine maker and exact model",
      "Required application, power and RPM where known",
      "Existing unit/nameplate reference or serial information",
      "Preferred condition and any installation constraints",
    ],
    inspectionNote: "Confirm the exact listed unit, configuration and condition, then request any available inspection, reconditioning or test information specific to that engine.",
  },
  "Hydraulic Deck Crane Equipment": {
    supplySummary: "Deck-crane and hydraulic-equipment requirements are highly configuration-specific. Current inventory should be matched to the crane maker/model and the vessel's lifting or hydraulic system requirement.",
    requestDetails: [
      "Crane / hydraulic equipment maker and exact model",
      "Required component or assembly name and part number when known",
      "SWL or other nameplate specification relevant to the requirement",
      "Photos/nameplate information from the existing vessel equipment where available",
    ],
    inspectionNote: "For used hydraulic or deck equipment, confirm the specific item's condition and ask what photos, nameplate details, inspection information or functional evidence are available for that unit.",
  },
  "Turbocharger": {
    supplySummary: "Turbocharger matching requires the exact turbocharger identification and usually the engine application. Similar-looking units should not be treated as interchangeable without model confirmation.",
    requestDetails: [
      "Turbocharger maker, type and exact model",
      "Engine maker/model or application",
      "Serial/nameplate information and part number when available",
      "Whether a complete unit or a specific turbocharger component is required",
    ],
    inspectionNote: "Confirm the exact identity and recorded condition of the listed turbocharger, and request available photos or inspection/reconditioning details for that specific unit or component.",
  },
  "Marine Pump": {
    supplySummary: "Marine pump selection depends on pump type, maker/model and duty requirement. Current inventory should be checked against the vessel system rather than chosen from appearance alone.",
    requestDetails: [
      "Pump maker, exact model and pump type",
      "Required service/application",
      "Flow/head or other duty information when available",
      "Existing nameplate, part number, flange/dimension or photo reference when relevant",
    ],
    inspectionNote: "Confirm the specific pump's configuration and condition and request the available nameplate/specification information before ordering.",
  },
  "Alternator": {
    supplySummary: "Alternator selection should match the prime mover and required electrical output. Maker/model alone may not establish voltage, frequency or RPM compatibility.",
    requestDetails: [
      "Alternator maker and exact model",
      "Required kVA or kW output",
      "Voltage, frequency and RPM",
      "Existing nameplate or coupling/application details when available",
    ],
    inspectionNote: "Ask for the current unit's nameplate details, condition and any available inspection or testing information before confirming suitability.",
  },
  "Navigation Equipment": {
    supplySummary: "Navigation and marine-electronics requirements should be matched by exact maker/model and system compatibility. Older or vessel-specific equipment can have important revision differences.",
    requestDetails: [
      "Maker and exact model",
      "Part number, serial or hardware revision when available",
      "Existing vessel/system application",
      "A clear label/nameplate photo and the specific component or function required",
    ],
    inspectionNote: "Confirm the exact identity, physical condition and any available operational evidence for the listed unit. Compatibility should be checked against the vessel's existing system.",
  },
  "Anchor and Chain": {
    supplySummary: "Anchor and chain requirements depend on vessel and dimensional specifications. This category should only be treated as current inventory when a real listing is published.",
    requestDetails: [
      "Anchor type or chain requirement",
      "Required size, diameter, length or weight where applicable",
      "Vessel/application details",
      "Any class, marking or existing equipment reference that must be matched",
    ],
    inspectionNote: "Confirm actual availability and the specific physical specifications before relying on a quotation. Empty catalogue categories are not presented as current stock.",
  },
};

const FALLBACK: CategoryBuyingGuidance = {
  supplySummary: "Use the current listings to identify a likely item, then confirm the exact maker/model, condition, specifications and availability before ordering.",
  requestDetails: [
    "Maker / brand and exact model",
    "Part number or serial/nameplate information when available",
    "Required quantity, application and key technical specification",
    "Preferred condition and clear reference photos when useful",
  ],
  inspectionNote: "Condition, configuration and available evidence vary by individual listing. Ask for the current photos, specifications and inspection information for the exact item you are considering.",
};

export function getCategoryBuyingGuidance(category: string): CategoryBuyingGuidance {
  return GUIDANCE[category.trim()] ?? FALLBACK;
}
