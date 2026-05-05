import { db, pool } from "@workspace/db";
import {
  sites,
  areas,
  users,
  assets,
  inspectionTemplates,
  templateSections,
  templateQuestions,
  ppmSchedules,
  appSettings,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding database...");

  // ── Sites ────────────────────────────────────────────────────────────
  const [algSite] = await db
    .insert(sites)
    .values({
      name: "Alltgoch Quarry",
      code: "ALG",
      address: "Alltgoch, Carmarthenshire, SA44 5RQ",
      isActive: true,
    })
    .onConflictDoUpdate({ target: sites.code, set: {} })
    .returning();

  const [cygSite] = await db
    .insert(sites)
    .values({
      name: "Coygen Quarry",
      code: "CYG",
      address: "Coygen, Carmarthenshire, SA33 6PF",
      isActive: true,
    })
    .onConflictDoUpdate({ target: sites.code, set: {} })
    .returning();

  const [blhSite] = await db
    .insert(sites)
    .values({
      name: "Bolton Hill Quarry",
      code: "BLH",
      address: "Bolton Hill, Pembrokeshire, SA62 3AT",
      isActive: true,
    })
    .onConflictDoUpdate({ target: sites.code, set: {} })
    .returning();

  const allSites = [algSite, cygSite, blhSite];

  // ── Areas per site ───────────────────────────────────────────────────
  const areaNames = [
    { name: "Primary Crusher", description: "Primary crushing circuit" },
    {
      name: "Secondary Crusher",
      description: "Secondary crushing and screening",
    },
    {
      name: "Mobile Plant Yard",
      description: "Mobile equipment parking and maintenance area",
    },
  ];

  const siteAreas: Record<string, string[]> = {};

  for (const site of allSites) {
    const areaIds: string[] = [];
    for (const areaData of areaNames) {
      const existing = await db
        .select()
        .from(areas)
        .where(and(eq(areas.siteId, site.id), eq(areas.name, areaData.name)))
        .limit(1);

      let area;
      if (existing.length > 0) {
        area = existing[0];
      } else {
        const [inserted] = await db
          .insert(areas)
          .values({
            siteId: site.id,
            name: areaData.name,
            description: areaData.description,
          })
          .returning();
        area = inserted;
      }
      areaIds.push(area.id);
    }
    siteAreas[site.id] = areaIds;
  }

  // ── Assets per site (5 per site: mix mobile/static) ──────────────────
  const assetTemplates = [
    {
      name: "Primary Jaw Crusher",
      plantId: "PJC-001",
      manufacturer: "Sandvik",
      model: "CJ211",
      criticality: "HIGH" as const,
      isMobile: false,
      areaIdx: 0,
    },
    {
      name: "Secondary Cone Crusher",
      plantId: "SCC-001",
      manufacturer: "Metso",
      model: "HP200",
      criticality: "HIGH" as const,
      isMobile: false,
      areaIdx: 1,
    },
    {
      name: "Screening Plant",
      plantId: "SCR-001",
      manufacturer: "Terex",
      model: "Chieftain 2100",
      criticality: "MEDIUM" as const,
      isMobile: true,
      areaIdx: 1,
    },
    {
      name: "JCB 3CX Backhoe",
      plantId: "JCB-001",
      manufacturer: "JCB",
      model: "3CX",
      criticality: "MEDIUM" as const,
      isMobile: true,
      areaIdx: 2,
    },
    {
      name: "Volvo FH16 Tipper",
      plantId: "TIP-001",
      manufacturer: "Volvo",
      model: "FH16",
      criticality: "LOW" as const,
      isMobile: true,
      areaIdx: 2,
    },
  ];

  const siteAssets: Record<string, string[]> = {};

  for (const site of allSites) {
    const assetIds: string[] = [];
    for (const tmpl of assetTemplates) {
      const plantId = `${tmpl.plantId.split("-")[0]}-${site.code}`;
      const existing = await db
        .select()
        .from(assets)
        .where(and(eq(assets.siteId, site.id), eq(assets.plantId, plantId)))
        .limit(1);

      let asset;
      if (existing.length > 0) {
        asset = existing[0];
      } else {
        const [inserted] = await db
          .insert(assets)
          .values({
            siteId: site.id,
            areaId: siteAreas[site.id][tmpl.areaIdx],
            name: `${site.code} ${tmpl.name}`,
            plantId,
            manufacturer: tmpl.manufacturer,
            model: tmpl.model,
            criticality: tmpl.criticality,
            isMobile: tmpl.isMobile,
            isActive: true,
          })
          .returning();
        asset = inserted;
      }
      assetIds.push(asset.id);
    }
    siteAssets[site.id] = assetIds;
  }

  // ── Inspection Templates (group-wide, siteId null) ───────────────────
  const [prestartTemplate] = await db
    .insert(inspectionTemplates)
    .values({
      id: "template-prestart-group",
      name: "Pre-Start Inspection",
      type: "PRESTART",
      siteId: null,
      isActive: true,
    })
    .onConflictDoUpdate({ target: inspectionTemplates.id, set: {} })
    .returning();

  const [dailyTemplate] = await db
    .insert(inspectionTemplates)
    .values({
      id: "template-daily-group",
      name: "Daily Plant Inspection",
      type: "DAILY",
      siteId: null,
      isActive: true,
    })
    .onConflictDoUpdate({ target: inspectionTemplates.id, set: {} })
    .returning();

  // ── Prestart sections + questions ────────────────────────────────────
  const prestartSections = [
    {
      id: "sec-prestart-safety",
      title: "Safety & Documentation",
      order: 1,
      questions: [
        {
          id: "q-ps-1",
          text: "Daily pre-start paperwork completed and signed?",
          order: 1,
          requiresEvidenceOnFail: false,
        },
        {
          id: "q-ps-2",
          text: "All guards and safety covers in place?",
          order: 2,
          requiresEvidenceOnFail: true,
        },
        {
          id: "q-ps-3",
          text: "Emergency stop buttons tested and operational?",
          order: 3,
          requiresEvidenceOnFail: true,
        },
      ],
    },
    {
      id: "sec-prestart-fluids",
      title: "Fluids & Levels",
      order: 2,
      questions: [
        {
          id: "q-ps-4",
          text: "Engine oil level checked and within limits?",
          order: 1,
          requiresEvidenceOnFail: false,
        },
        {
          id: "q-ps-5",
          text: "Hydraulic oil level checked and within limits?",
          order: 2,
          requiresEvidenceOnFail: false,
        },
        {
          id: "q-ps-6",
          text: "Coolant level checked and within limits?",
          order: 3,
          requiresEvidenceOnFail: false,
        },
        {
          id: "q-ps-7",
          text: "Fuel level adequate for planned operations?",
          order: 4,
          requiresEvidenceOnFail: false,
        },
      ],
    },
    {
      id: "sec-prestart-mechanical",
      title: "Mechanical Checks",
      order: 3,
      questions: [
        {
          id: "q-ps-8",
          text: "Belts and conveyors free from damage or wear?",
          order: 1,
          requiresEvidenceOnFail: true,
        },
        {
          id: "q-ps-9",
          text: "No visible leaks (oil, hydraulic, coolant)?",
          order: 2,
          requiresEvidenceOnFail: true,
        },
        {
          id: "q-ps-10",
          text: "Wear plates and liners within acceptable limits?",
          order: 3,
          requiresEvidenceOnFail: false,
        },
      ],
    },
  ];

  for (const sec of prestartSections) {
    await db
      .insert(templateSections)
      .values({
        id: sec.id,
        templateId: prestartTemplate.id,
        title: sec.title,
        order: sec.order,
      })
      .onConflictDoUpdate({ target: templateSections.id, set: {} });

    for (const q of sec.questions) {
      await db
        .insert(templateQuestions)
        .values({
          id: q.id,
          sectionId: sec.id,
          text: q.text,
          order: q.order,
          requiresEvidenceOnFail: q.requiresEvidenceOnFail,
          allowMonitor: true,
        })
        .onConflictDoUpdate({ target: templateQuestions.id, set: {} });
    }
  }

  // ── Daily template sections + questions ──────────────────────────────
  const dailySections = [
    {
      id: "sec-daily-general",
      title: "General Condition",
      order: 1,
      questions: [
        {
          id: "q-d-1",
          text: "Plant area clear of debris and material build-up?",
          order: 1,
          requiresEvidenceOnFail: false,
        },
        {
          id: "q-d-2",
          text: "Access walkways clear and safe?",
          order: 2,
          requiresEvidenceOnFail: true,
        },
        {
          id: "q-d-3",
          text: "All signage visible and legible?",
          order: 3,
          requiresEvidenceOnFail: false,
        },
      ],
    },
    {
      id: "sec-daily-electrical",
      title: "Electrical & Controls",
      order: 2,
      questions: [
        {
          id: "q-d-4",
          text: "Control panel clean, dry and undamaged?",
          order: 1,
          requiresEvidenceOnFail: true,
        },
        {
          id: "q-d-5",
          text: "Cables and wiring free from damage?",
          order: 2,
          requiresEvidenceOnFail: true,
        },
        {
          id: "q-d-6",
          text: "Dust extraction system operating correctly?",
          order: 3,
          requiresEvidenceOnFail: false,
        },
        {
          id: "q-d-7",
          text: "Instrumentation readings within normal range?",
          order: 4,
          requiresEvidenceOnFail: false,
        },
      ],
    },
    {
      id: "sec-daily-lubrication",
      title: "Lubrication",
      order: 3,
      questions: [
        {
          id: "q-d-8",
          text: "All grease points lubricated as per schedule?",
          order: 1,
          requiresEvidenceOnFail: false,
        },
        {
          id: "q-d-9",
          text: "Auto-lube system functioning (where fitted)?",
          order: 2,
          requiresEvidenceOnFail: false,
        },
      ],
    },
  ];

  for (const sec of dailySections) {
    await db
      .insert(templateSections)
      .values({
        id: sec.id,
        templateId: dailyTemplate.id,
        title: sec.title,
        order: sec.order,
      })
      .onConflictDoUpdate({ target: templateSections.id, set: {} });

    for (const q of sec.questions) {
      await db
        .insert(templateQuestions)
        .values({
          id: q.id,
          sectionId: sec.id,
          text: q.text,
          order: q.order,
          requiresEvidenceOnFail: q.requiresEvidenceOnFail,
          allowMonitor: true,
        })
        .onConflictDoUpdate({ target: templateQuestions.id, set: {} });
    }
  }

  // ── Users ────────────────────────────────────────────────────────────
  const hashPassword = async (pw: string) => bcrypt.hash(pw, 10);

  await db
    .insert(users)
    .values({
      name: "CQG Administrator",
      email: "admin@cqg.co.uk",
      passwordHash: await hashPassword("Admin1234!"),
      role: "ADMIN",
      siteId: null,
      isActive: true,
    })
    .onConflictDoUpdate({ target: users.email, set: {} });

  await db
    .insert(users)
    .values({
      name: "Maintenance Planner",
      email: "maintenance@cqg.co.uk",
      passwordHash: await hashPassword("Maintenance1234!"),
      role: "MAINTENANCE",
      siteId: null,
      isActive: true,
    })
    .onConflictDoUpdate({ target: users.email, set: {} });

  const siteUserData = [
    {
      site: algSite,
      manager: { name: "Alun Davies", email: "manager.alg@cqg.co.uk" },
      operators: [
        { name: "Rhys Evans", email: "operator.alg@cqg.co.uk" },
        { name: "Gwyn Thomas", email: "operator2.alg@cqg.co.uk" },
      ],
    },
    {
      site: cygSite,
      manager: { name: "Sian Williams", email: "manager.cyg@cqg.co.uk" },
      operators: [
        { name: "Dai Jones", email: "operator.cyg@cqg.co.uk" },
        { name: "Huw Roberts", email: "operator2.cyg@cqg.co.uk" },
      ],
    },
    {
      site: blhSite,
      manager: { name: "Mark Hughes", email: "manager.blh@cqg.co.uk" },
      operators: [
        { name: "Tom Price", email: "operator.blh@cqg.co.uk" },
        { name: "Nia Morgan", email: "operator2.blh@cqg.co.uk" },
      ],
    },
  ];

  for (const { site, manager, operators } of siteUserData) {
    await db
      .insert(users)
      .values({
        name: manager.name,
        email: manager.email,
        passwordHash: await hashPassword("Manager1234!"),
        role: "SITE_MANAGER",
        siteId: site.id,
        isActive: true,
      })
      .onConflictDoUpdate({ target: users.email, set: {} });

    for (const op of operators) {
      await db
        .insert(users)
        .values({
          name: op.name,
          email: op.email,
          passwordHash: await hashPassword("Operator1234!"),
          role: "OPERATOR",
          siteId: site.id,
          isActive: true,
        })
        .onConflictDoUpdate({ target: users.email, set: {} });
    }
  }

  // ── PPM Schedules (2 per site, on assets 0 and 1) ───────────────────
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const site of allSites) {
    const assetIds = siteAssets[site.id];

    const ppm1Key = `ppm-weekly-grease-${site.code}`;
    const existing1 = await db
      .select()
      .from(ppmSchedules)
      .where(eq(ppmSchedules.notes, ppm1Key))
      .limit(1);

    if (existing1.length === 0) {
      await db.insert(ppmSchedules).values({
        assetId: assetIds[0],
        taskName: "Weekly Greasing — Jaw Crusher Bearings",
        frequency: "WEEKLY",
        nextDueAt: nextWeek,
        notes: ppm1Key,
      });
    }

    const ppm2Key = `ppm-monthly-oil-${site.code}`;
    const existing2 = await db
      .select()
      .from(ppmSchedules)
      .where(eq(ppmSchedules.notes, ppm2Key))
      .limit(1);

    if (existing2.length === 0) {
      await db.insert(ppmSchedules).values({
        assetId: assetIds[1],
        taskName: "Monthly Oil Check — Cone Crusher",
        frequency: "MONTHLY",
        nextDueAt: nextMonth,
        notes: ppm2Key,
      });
    }
  }

  // ── App Settings ─────────────────────────────────────────────────────
  const defaultSettings = [
    {
      key: "breakdown_causes",
      value: [
        "Mechanical failure",
        "Electrical fault",
        "Operator error",
        "Wear and tear",
        "Foreign material ingestion",
        "Hydraulic failure",
        "Unknown",
      ],
    },
    {
      key: "work_order_priorities",
      value: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    },
    {
      key: "inspection_frequencies",
      value: ["DAILY", "WEEKLY", "MONTHLY", "PRE_SHIFT", "POST_SHIFT"],
    },
    {
      key: "asset_types",
      value: [
        "Crusher",
        "Screen",
        "Conveyor",
        "Loader",
        "Excavator",
        "Tipper",
        "Dozer",
        "Generator",
        "Pump",
        "Other",
      ],
    },
  ];

  for (const setting of defaultSettings) {
    await db
      .insert(appSettings)
      .values({ key: setting.key, value: setting.value })
      .onConflictDoUpdate({ target: appSettings.key, set: {} });
  }

  console.log("Seed complete.");
  console.log("Demo credentials:");
  console.log("  admin@cqg.co.uk / Admin1234!");
  console.log("  manager.alg@cqg.co.uk / Manager1234!");
  console.log("  operator.alg@cqg.co.uk / Operator1234!");
  console.log("  maintenance@cqg.co.uk / Maintenance1234!");
}

main()
  .catch(console.error)
  .finally(() => pool.end());
