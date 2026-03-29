#!/usr/bin/env npx tsx
/**
 * Batch audit runner for XanLens.
 * Usage: npx tsx scripts/run-audit.ts [--targets scripts/audit-targets.json] [--delay 5000]
 */

import fs from "fs";
import path from "path";

const AUDITS_DIR = path.join(process.cwd(), "public", "data", "audits");
const MANIFEST_PATH = path.join(AUDITS_DIR, "index.json");
const BASE_URL = process.env.AUDIT_BASE_URL || "http://localhost:3000";

interface Target {
  brand: string;
  industry: string;
  website?: string;
  slug: string;
}

interface ManifestEntry {
  slug: string;
  brand: string;
  industry: string;
  website: string | null;
  overall_score: number;
  grade: string;
  timestamp: string;
}

function ensureDir() {
  if (!fs.existsSync(AUDITS_DIR)) fs.mkdirSync(AUDITS_DIR, { recursive: true });
}

function loadManifest(): { audits: ManifestEntry[]; updated: string } {
  if (!fs.existsSync(MANIFEST_PATH)) return { audits: [], updated: new Date().toISOString() };
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
}

function saveManifest(manifest: { audits: ManifestEntry[]; updated: string }) {
  manifest.audits.sort((a, b) => b.overall_score - a.overall_score);
  manifest.updated = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function runSingleAudit(target: Target): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: target.brand,
        industry: target.industry,
        website: target.website,
      }),
    });
    if (!res.ok) {
      console.error(`  ✗ HTTP ${res.status} for ${target.brand}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`  ✗ Error for ${target.brand}: ${e}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let targetsFile = path.join(process.cwd(), "scripts", "audit-targets.json");
  let delay = 5000;
  let startFrom = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--targets" && args[i + 1]) targetsFile = args[++i];
    if (args[i] === "--delay" && args[i + 1]) delay = parseInt(args[++i]);
    if (args[i] === "--start" && args[i + 1]) startFrom = parseInt(args[++i]);
  }

  const targets: Target[] = JSON.parse(fs.readFileSync(targetsFile, "utf-8"));
  console.log(`Loaded ${targets.length} targets from ${targetsFile}`);
  console.log(`Delay: ${delay}ms, Starting from index: ${startFrom}`);
  console.log(`API: ${BASE_URL}/api/v1/audit\n`);

  ensureDir();
  const manifest = loadManifest();
  let success = 0;
  let fail = 0;

  for (let i = startFrom; i < targets.length; i++) {
    const target = targets[i];
    const existing = path.join(AUDITS_DIR, `${target.slug}.json`);
    if (fs.existsSync(existing)) {
      console.log(`[${i + 1}/${targets.length}] ${target.brand} — already exists, skipping`);
      continue;
    }

    console.log(`[${i + 1}/${targets.length}] Auditing ${target.brand}...`);
    const result = await runSingleAudit(target);

    if (result && !result.error) {
      fs.writeFileSync(existing, JSON.stringify(result, null, 2));

      const entry: ManifestEntry = {
        slug: target.slug,
        brand: (result.brand as string) || target.brand,
        industry: (result.industry as string) || target.industry,
        website: (result.website as string) || target.website || null,
        overall_score: (result.overall_score as number) || 0,
        grade: (result.grade as string) || "F",
        timestamp: (result.timestamp as string) || new Date().toISOString(),
      };

      const idx = manifest.audits.findIndex((a) => a.slug === target.slug);
      if (idx >= 0) manifest.audits[idx] = entry;
      else manifest.audits.push(entry);

      saveManifest(manifest);
      console.log(`  ✓ Score: ${entry.overall_score}/100 (${entry.grade})`);
      success++;
    } else {
      console.log(`  ✗ Failed`);
      fail++;
    }

    if (i < targets.length - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.log(`\nDone! ${success} succeeded, ${fail} failed out of ${targets.length} targets.`);
}

main().catch(console.error);
