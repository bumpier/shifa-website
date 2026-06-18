import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Shared across the three Retatrutide dose products (10/20/30mg).
const RETATRUTIDE_DESCRIPTION = `Triple-receptor agonist targeting GLP-1, GIP, and glucagon pathways simultaneously, supporting a structured dose-escalation programme across the 10mg, 20mg, and 30mg products.

## What it supports
- Appetite regulation
- Energy expenditure pathways
- Body composition support
- Comprehensive metabolic regulation

## Dosage guide
**10mg:** Entry formulation. Ideal starting dose for system adjustment and early protocol activity.

**20mg:** Intermediate tier. For clients progressing from 10mg with enhanced receptor engagement across all three pathways.

**30mg:** Advanced tier. Final step in the programme, designed for clients who have completed 10mg and 20mg under expert supervision.

## Timeline
**Weeks 1–2:** Initiation phase. System adjustment and early protocol activity.

**Weeks 3–6:** Active support. Pronounced cellular mechanisms, progress toward wellness targets.

**Week 6+:** Sustained wellness with expert-guided personalisation

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`;

const products = [
  // ── Weight Loss Protocols ────────────────────────────────────────────
  {
    slug: "retatrutide-10mg",
    name: "Retatrutide 10mg",
    description: RETATRUTIDE_DESCRIPTION,
    priceGbp: 100, priceEur: 119, priceUsd: 127, priceAed: 470, pricePkr: 35000,
    stock: 50, weightGrams: 50,
    images: JSON.stringify(["/products/rt10.png"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/rt10-v101xa1m",
  },
  {
    slug: "retatrutide-20mg",
    name: "Retatrutide 20mg",
    description: RETATRUTIDE_DESCRIPTION,
    priceGbp: 120, priceEur: 142, priceUsd: 152, priceAed: 565, pricePkr: 42000,
    stock: 50, weightGrams: 50,
    images: JSON.stringify(["/products/rt10.png"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/rt20-te8vglqe",
  },
  {
    slug: "retatrutide-30mg",
    name: "Retatrutide 30mg",
    description: RETATRUTIDE_DESCRIPTION,
    priceGbp: 160, priceEur: 189, priceUsd: 203, priceAed: 752, pricePkr: 56000,
    stock: 50, weightGrams: 50,
    images: JSON.stringify(["/products/rt10.png"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/rt30-rlcf9grv",
  },
  {
    slug: "cutpr-prime-cut-protocol",
    name: "CUTPR: Prime Cut Protocol",
    description: `A comprehensive body composition protocol combining metabolic acceleration and lean tissue support. Designed for those committed to a full transformation programme.

## What it supports
- Metabolic rate optimisation
- Fat utilisation pathways
- Lean body composition support
- Energy and physical performance
- Appetite and hormonal balance

## Timeline
**Weeks 1–4:** Metabolic priming. Early changes in energy and appetite noted.

**Weeks 5–10:** Active transformation phase. Body composition shifts become apparent.

**Week 10+:** Sustained results with ongoing protocol maintenance

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 300, priceEur: 354, priceUsd: 381, priceAed: 1410, pricePkr: 105000,
    stock: 30, weightGrams: 150,
    images: JSON.stringify(["/products/cutpr.png"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/cutpr-g4he0b5c",
  },
  // ── Recovery & Repair ────────────────────────────────────────────────
  {
    slug: "bptb-repair-pen",
    name: "BPTB: Repair Pen",
    description: `Dual-compound repair formula combining BPC-157 and TB-500 to support the body's natural healing processes. Used by athletes and active individuals for injury recovery and tissue maintenance.

## What it supports
- Tissue repair and regeneration
- Joint and connective tissue health
- Inflammation balance
- Post-exertion recovery
- Musculoskeletal integrity

## Timeline
**Weeks 1–2:** Initial repair signals. Reduced discomfort and improved recovery quality reported.

**Weeks 3–6:** Active tissue support. Structural integrity improvements noted.

**Week 6+:** Sustained resilience and long-term repair maintenance

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 140, priceEur: 165, priceUsd: 178, priceAed: 658, pricePkr: 49000,
    stock: 50, weightGrams: 50,
    images: JSON.stringify(["/products/bptb.png"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/bptb-w9p82fcr",
  },
  {
    slug: "wol10-wolverine-protocol",
    name: "WOL10: Wolverine Protocol",
    description: `Elite recovery protocol formulated to support the body's regenerative capacity at a cellular level. Built for demanding training schedules, injury recovery, and long-term physical resilience.

## What it supports
- Tissue repair pathway support
- Musculoskeletal health enhancement
- Inflammation balance
- Connective tissue and collagen support
- Cellular resilience and recovery acceleration

## Timeline
**Weeks 1–2:** Cellular priming. Improved recovery quality and reduced post-exertion discomfort.

**Weeks 3–8:** Regen active. Enhanced recovery between sessions, improved structural integrity.

**Week 8+:** Sustained resilience. Ongoing cellular repair and long-term maintenance.

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 170, priceEur: 201, priceUsd: 216, priceAed: 799, pricePkr: 59500,
    stock: 30, weightGrams: 150,
    images: JSON.stringify(["/products/wol10.jpg"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/wol10-odlw2f6i",
  },
  // ── Skin, Hair & Nails ───────────────────────────────────────────────
  {
    slug: "gku50-ghk-cu-regeneration-pen",
    name: "GKU50: GHK-Cu Regeneration Pen",
    description: `Copper peptide formulation supporting natural collagen synthesis and skin regeneration. Works at a cellular level to improve skin quality, texture, and hair health over time.

## What it supports
- Collagen and elastin production
- Skin texture and tone improvement
- Fine line and wrinkle support
- Hair follicle health and growth
- Nail strength and integrity
- Antioxidant cellular balance

## Timeline
**Weeks 1–2:** Early adjustment. Skin feels more hydrated, hair texture improves.

**Weeks 3–6:** Visible regeneration. Tone, texture, and growth improvements noted.

**Week 6+:** Sustained renewal and long-term skin and hair health maintenance

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 100, priceEur: 119, priceUsd: 127, priceAed: 470, pricePkr: 35000,
    stock: 50, weightGrams: 50,
    images: JSON.stringify(["/products/gku50.png"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/gku50-t83nnerv",
  },
  {
    slug: "glow10-glow-protocol",
    name: "GLOW10: Glow Protocol",
    description: `A cellular skin wellness protocol targeting radiance, texture, and vitality from within. Works on the underlying cellular environment that determines skin health, not a topical treatment.

## What it supports
- Skin cellular regeneration
- Collagen pathway support
- Antioxidant cellular balance
- Elastin support systems
- Hydration pathway support
- Luminosity and tone

## Timeline
**Weeks 1–2:** Protocol adjustment. Skin begins responding at a cellular level.

**Weeks 3–6:** Pronounced support effects. Texture, tone, and glow improvements reported.

**Week 6+:** Sustained cellular wellness and long-term radiance maintenance

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 170, priceEur: 201, priceUsd: 216, priceAed: 799, pricePkr: 59500,
    stock: 30, weightGrams: 150,
    images: JSON.stringify(["/products/glow10.jpg"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/glow10-g4odv29c",
  },
  // ── Growth Hormone ───────────────────────────────────────────────────
  {
    slug: "cjip10-growth-signal-pen",
    name: "CJIP10: Growth Signal Pen",
    description: `Dual GH secretagogue combining CJC-1295 and Ipamorelin. CJC-1295 provides sustained-release hormone support while Ipamorelin delivers selective stimulation; the two work synergistically through complementary mechanisms.

## What it supports
- Growth hormone signalling support
- Lean body composition development
- Muscle protein synthesis pathways
- Enhanced recovery capabilities
- Sleep quality and GH pulse optimisation
- Metabolic body composition support

## Timeline
**Weeks 1–2:** System adjustment. Early protocol activity signs.

**Weeks 3–6:** Cellular mechanisms pronounced. Clients report progress toward goals.

**Week 6+:** Sustained support with expert guidance for personalisation

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 140, priceEur: 165, priceUsd: 178, priceAed: 658, pricePkr: 49000,
    stock: 50, weightGrams: 50,
    images: JSON.stringify(["/products/cjip10.png"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/cjip10-l6uwk38r",
  },
  // ── Cellular Energy ──────────────────────────────────────────────────
  {
    slug: "nd1000-nad-cellular-energy-pen",
    name: "ND1000: NAD+ Cellular Energy Pen",
    description: `NAD+ is a coenzyme central to cellular energy production, one your body produces less of with age. This formulation replenishes it directly, supporting energy, cognitive clarity, and cellular repair.

## What it supports
- Cellular energy production
- Mental clarity and focus
- Metabolic function support
- DNA repair pathway activation
- Healthy ageing and longevity
- Oxidative balance

## Timeline
**Weeks 1–2:** Early adjustment. Improved energy and clearer focus commonly reported.

**Weeks 3–8:** Deepening support. Sustained vitality and sharper cognitive function.

**Week 8+:** Long-term cellular health and ongoing NAD+ maintenance

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 150, priceEur: 177, priceUsd: 190, priceAed: 705, pricePkr: 52500,
    stock: 50, weightGrams: 50,
    images: JSON.stringify(["/products/nd1000.png"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/nd1000-ggto4eet",
  },
  {
    slug: "regen-regenesis-protocol",
    name: "REGEN: Regenesis Protocol",
    description: `A comprehensive cellular renewal protocol targeting autophagy, rejuvenation, and systemic restoration. Designed for those taking a serious, long-term approach to biological ageing and vitality.

## What it supports
- Cellular autophagy support
- Longevity pathway activation
- Cellular rejuvenation
- Systemic restoration
- Mitochondrial support
- Oxidative balance

## Timeline
**Weeks 1–4:** Renewal pathways activated. Clients report improved energy and clarity.

**Weeks 5–12:** Deepened rejuvenation support. Renewed vitality and systemic restoration noted.

**Week 12+:** Sustained longevity support with ongoing protocol maintenance

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 300, priceEur: 354, priceUsd: 381, priceAed: 1410, pricePkr: 105000,
    stock: 30, weightGrams: 150,
    images: JSON.stringify(["/products/regen.jpg"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/regen-kt7h3cf7",
  },
  // ── Mitochondrial Support ────────────────────────────────────────────
  {
    slug: "mt40-motsc-mitochondrial-pen",
    name: "MT40: MOTS-c Mitochondrial Pen",
    description: `MOTS-c is a mitochondrial-encoded peptide, a direct signal from your cells' energy centres. The MT40 activates metabolic pathways to improve fat utilisation, insulin sensitivity, and exercise capacity.

## What it supports
- Mitochondrial signalling
- Metabolic efficiency
- Insulin sensitivity pathways
- Fat utilisation support
- Exercise capacity and stamina
- Cellular energy regulation

## Timeline
**Weeks 1–2:** System adjustment and early protocol activity

**Weeks 3–6:** Pronounced cellular support. Improved metabolic function reported.

**Week 6+:** Sustained cellular wellness with expert-guided personalisation

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 150, priceEur: 177, priceUsd: 190, priceAed: 705, pricePkr: 52500,
    stock: 50, weightGrams: 50,
    images: JSON.stringify(["/products/mt40.png"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/mt40-ejbt9inh",
  },
  // ── Other Protocols ──────────────────────────────────────────────────
  {
    slug: "deepsleep-deep-sleep-protocol",
    name: "DEEPSLEEP: Deep Sleep Protocol",
    description: `A cellular approach to supporting natural sleep quality, not sedation. Designed to foster the hormonal and cellular conditions associated with genuine restorative sleep and overnight repair.

## What it supports
- Sleep onset support
- Deep sleep quality enhancement
- Overnight cellular repair
- Hormonal balance during rest
- Recovery and regeneration
- Morning vitality support

## Timeline
**Weeks 1–2:** System adjustment. Calmer wind-down and early sleep quality improvements noted.

**Weeks 3–6:** Cellular support builds. Deeper sleep and improved morning energy reported.

**Week 6+:** Sustained wellness with ongoing protocol maintenance

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 160, priceEur: 189, priceUsd: 203, priceAed: 752, pricePkr: 56000,
    stock: 50, weightGrams: 50,
    images: JSON.stringify(["/products/deepsleep.jpg"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/deepsleep-x6xhhpxl",
  },
  {
    slug: "libido-libido-protocol",
    name: "LIBIDO: Libido Protocol",
    description: `Dual-compound desire protocol combining Kisspeptin-10 and PT-141. Kisspeptin-10 supports the HPG axis and hormonal drive; PT-141 activates melanocortin receptors through a distinct neurological pathway.

## What it supports
- HPG axis hormonal support
- Melanocortin receptor signalling
- Central desire pathway activation
- Hormonal drive support
- Arousal pathway support
- Intimate wellness for both men and women

## Timeline
**Weeks 1–2:** Protocol initiation. System adjustment and early pathway activity.

**Weeks 3–6:** Enhanced cellular support mechanisms

**Week 6+:** Sustained cellular wellness with expert guidance

## Storage
Refrigerate at 2–8°C once reconstituted. Keep in a cool, dry, light-protected environment. ≥99.9% purity certified, batch certificate of analysis included.`,
    priceGbp: 180, priceEur: 212, priceUsd: 229, priceAed: 846, pricePkr: 63000,
    stock: 50, weightGrams: 50,
    images: JSON.stringify(["/products/libido.jpg"]),
    freshaUrl: "https://www.fresha.com/store/shifa-store-q6pyv9ro/product/libido-hi2esl3q",
  },
];

async function main() {
  // Remove all existing products before seeding
  await prisma.product.deleteMany();

  for (const p of products) {
    await prisma.product.create({
      data: { ...p, active: true },
    });
  }
  console.log(`Seeded ${products.length} products.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
