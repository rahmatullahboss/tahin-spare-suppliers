export const HOMEPAGE_SECTION_ORDER = [
  "hero",
  "who-we-are",
  "stock",
  "brands",
  "services",
  "export-logistics",
  "shipments",
  "equipment-cta",
  "why-choose-us"
] as const;

export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_ORDER)[number];

export type CmsImage = {
  url: string;
  key?: string;
  alt?: string;
};

export type CmsServiceItem = {
  title: string;
  body: string;
  icon: string;
};

export type CmsFeatureItem = {
  title: string;
  body: string;
  icon: string;
};

export type HomepageContent = {
  hero: {
    headlineAccent: string;
    headlineMain: string;
    description: string;
    ctaText: string;
    ctaUrl: string;
    slides: CmsImage[];
  };
  "who-we-are": {
    title: string;
    body: string;
  };
  stock: {
    title: string;
    subtitle: string;
  };
  brands: {
    title: string;
    directoryTitle: string;
    directorySubtitle: string;
    logos: Array<{ brand: string; image: CmsImage }>;
  };
  services: {
    title: string;
    subtitle: string;
    items: CmsServiceItem[];
  };
  "export-logistics": {
    kicker: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaUrl: string;
    items: Array<{
      title: string;
      image: CmsImage;
    }>;
  };
  shipments: {
    title: string;
    images: CmsImage[];
  };
  "equipment-cta": {
    title: string;
    contactPrefix: string;
    backgroundImage: CmsImage;
    images: CmsImage[];
  };
  "why-choose-us": {
    title: string;
    items: CmsFeatureItem[];
  };
};

export const HOMEPAGE_DEFAULTS: HomepageContent = {
  hero: {
    headlineAccent: "MARINE ENGINE & SPARE PARTS",
    headlineMain: "SUPPLIER & EXPORTER\nFROM BANGLADESH",
    description: "Tahin Spare Suppliers supplies and exports marine engines, generator sets, hydraulic equipment and spare parts from Chattogram, Bangladesh.",
    ctaText: "REQUEST A QUOTE",
    ctaUrl: "/enquiry",
    slides: [
      { url: "/images/slider/hero-slide-1.webp", alt: "Marine Engine" },
      { url: "/images/slider/parts-slide.png", alt: "Marine Spare Parts" },
      { url: "/images/slider/caterpillar-slide.png", alt: "Caterpillar Diesel Generator" }
    ]
  },
  "who-we-are": {
    title: "WHO WE ARE",
    body: "Tahin Spare Suppliers has served the marine industry since 1990, supplying marine engines, spare parts, generator sets, hydraulic components and related equipment. Located near the Chattogram ship-recycling and marine-sourcing area in Bangladesh, we help vessel operators and procurement teams source equipment and request current condition, availability, specifications and export support."
  },
  stock: {
    title: "Marine Equipment & Spare Parts",
    subtitle: "Browse current marine machinery and spare-parts categories, then request model-specific availability and specifications."
  },
  brands: {
    title: "BRANDS IN CURRENT LISTINGS",
    directoryTitle: "Browse Engine Models by Brand",
    directorySubtitle: "Choose a listed maker and model to open the current product record and request availability.",
    logos: [
      { brand: "Yanmar", image: { url: "/images/brands/yanmar-1.svg", alt: "Yanmar" } },
      { brand: "Caterpillar", image: { url: "/images/brands/caterpillar-logo2.svg", alt: "Caterpillar" } },
      { brand: "MAN B&W", image: { url: "/images/brands/man-logo.svg", alt: "MAN B&W" } },
      { brand: "Wartsila", image: { url: "/images/brands/wartsila.svg", alt: "Wartsila" } },
      { brand: "Rolls Royce", image: { url: "/images/brands/rolls-royce.svg", alt: "Rolls Royce" } },
      { brand: "MTU", image: { url: "/images/brands/mtu-friedrichshafen-logo.svg", alt: "MTU" } },
      { brand: "Cummins", image: { url: "/images/brands/cummins.svg", alt: "Cummins" } },
      { brand: "Mitsubishi", image: { url: "/images/brands/mitsubishi-1.svg", alt: "Mitsubishi" } },
      { brand: "Daihatsu", image: { url: "/images/brands/daihatsu-3.svg", alt: "Daihatsu" } },
      { brand: "Detroit Diesel", image: { url: "/images/brands/detroit-diesel-logo.svg", alt: "Detroit Diesel" } }
    ]
  },
  services: {
    title: "OUR SERVICES",
    subtitle: "Supplying quality marine engine parts & equipment worldwide",
    items: [
      {
        title: "Marine Engine Parts Supply",
        body: "Supply and export of marine engine spare parts including pistons, liners, bearings, valves, gaskets, turbochargers, fuel pumps and related components.",
        icon: "layer-group"
      },
      {
        title: "Engine Overhaul & Reconditioning",
        body: "Engine disassembly, inspection, cleaning, reconditioning and testing services for supported marine engine models, with scope confirmed for each job.",
        icon: "tools"
      },
      {
        title: "Worldwide Parts Export",
        body: "Worldwide export support for marine engines, generator sets, hydraulic equipment and engine spare parts from Chattogram, Bangladesh.",
        icon: "globe"
      }
    ]
  },
  "export-logistics": {
    kicker: "Worldwide Marine Supply Chain",
    title: "GLOBAL EXPORT & LOGISTICS",
    subtitle: "Supporting international marine-equipment orders with crating, stock checks and export documentation from Chattogram, Bangladesh.",
    ctaText: "REQUEST A QUOTE",
    ctaUrl: "/enquiry",
    items: [
      {
        title: "Professional Crating & Secure Packaging.",
        image: { url: "/images/export-crating.webp", alt: "Professional crating of marine engine" }
      },
      {
        title: "Current Stock & Availability Checks.",
        image: { url: "/images/export-stock.webp", alt: "Marine equipment stock handling" }
      },
      {
        title: "Secure Wood-Crated Spare Parts Supply.",
        image: { url: "/images/export-spare-parts.webp", alt: "Wood-crated secure spare parts supply" }
      },
      {
        title: "Export Documentation & Shipment Support.",
        image: { url: "/images/export-docs.webp", alt: "Export documentation support" }
      }
    ]
  },
  shipments: {
    title: "Recent Marine Equipment Shipments",
    images: [
      { url: "/images/shipments/shipment-01.webp", alt: "Recent marine shipment 1" },
      { url: "/images/shipments/shipment-02.webp", alt: "Recent marine shipment 2" },
      { url: "/images/shipments/shipment-03.webp", alt: "Recent marine shipment 3" },
      { url: "/images/shipments/shipment-04.webp", alt: "Recent marine shipment 4" },
      { url: "/images/shipments/shipment-05.webp", alt: "Recent marine shipment 5" },
      { url: "/images/shipments/shipment-06.webp", alt: "Recent marine shipment 6" },
      { url: "/images/shipments/shipment-07.webp", alt: "Recent marine shipment 7" },
      { url: "/images/shipments/shipment-08.webp", alt: "Recent marine shipment 8" }
    ]
  },
  "equipment-cta": {
    title: "Looking for Marine Equipment?",
    contactPrefix: "Call us:",
    backgroundImage: { url: "/images/team-workshop.webp", alt: "Marine workshop team" },
    images: [
      { url: "/images/marine-engine.webp", alt: "Marine Engine" },
      { url: "/images/diesel-generator.webp", alt: "Diesel Generator" },
      { url: "/images/turbocharger.webp", alt: "Turbocharger" },
      { url: "/images/hydraulic-crane.webp", alt: "Hydraulic Crane" },
      { url: "/images/spare-parts.webp", alt: "Spare Parts" }
    ]
  },
  "why-choose-us": {
    title: "Why Choose Us",
    items: [
      {
        title: "Established 1990",
        body: "Marine equipment and spare-parts supply experience dating back to 1990.",
        icon: "award"
      },
      {
        title: "Marine Inventory Access",
        body: "Browse listed equipment and spare parts, then confirm current stock for your required model or part number.",
        icon: "layer-group"
      },
      {
        title: "Worldwide Export Support",
        body: "Request packing, documentation and shipping support for international marine-equipment orders.",
        icon: "globe"
      },
      {
        title: "Direct Sales Support",
        body: "Send your brand, model or part number directly to our team for a sourcing and quotation response.",
        icon: "headset"
      }
    ]
  }
};

export function isHomepageSectionKey(value: string): value is HomepageSectionKey {
  return (HOMEPAGE_SECTION_ORDER as readonly string[]).includes(value);
}
