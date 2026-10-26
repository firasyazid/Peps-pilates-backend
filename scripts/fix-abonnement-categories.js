/**
 * Fill in `categories` (which course categories a plan pays for) on every
 * subscription plan.
 *
 * Dry run by default — it prints what it would change and writes nothing.
 * Add `--commit` to save.
 *
 *   node scripts/fix-abonnement-categories.js
 *   node scripts/fix-abonnement-categories.js --commit
 *
 * Why: eligibility used to compare the plan's single `category` with the
 * course's category. Combo plans point at a label such as
 * "PILATES REFORMER+PILATES AU SOL" that no course belongs to, so their
 * members' bookings were saved as "non payé" and their credits never used.
 *
 * Each plan is matched by the categories named in its own title, so this stays
 * correct even if plan ids differ between environments. `category` (the label
 * shown in the app and dashboard) is never modified, and no user is touched.
 */

const mongoose = require("mongoose");
require("dotenv/config");

const { Abonnement } = require("../models/abonnements");
const { Category } = require("../models/categories");

const commit = process.argv.includes("--commit");

// Plan name (lowercased, must appear at the start) -> category names it covers.
// An empty list means every category.
const RULES = [
  { match: "peps duo", categories: ["PILATES REFORMER", "PILATES AU SOL"] },
  { match: "peps energy", categories: ["PILATES REFORMER", "PILATES AU SOL"] },
  { match: "energy plus", categories: ["PILATES REFORMER", "Yoga"] },
  { match: "peps liberte", categories: ["PILATES REFORMER"] },
  { match: "peps balance", categories: ["PILATES REFORMER"] },
  { match: "peps zen", categories: ["Yoga"] },
  { match: "peps eveil", categories: ["PILATES AU SOL"] },
  { match: "peps unlimited", categories: [] },
];

async function main() {
  if (!process.env.CONNECTION_STRING) {
    console.error("CONNECTION_STRING is not set — run this from PilatesBackend with its .env in place.");
    process.exit(1);
  }

  // Same dbName as app.js: the connection string carries no database, so
  // without this we would talk to the empty default `test` database.
  await mongoose.connect(process.env.CONNECTION_STRING, { dbName: "PepsApp" });

  const categories = await Category.find().select("name");
  const idByName = new Map(categories.map((c) => [c.name.toLowerCase(), String(c._id)]));
  const nameById = new Map(categories.map((c) => [String(c._id), c.name]));

  // A rule naming a category that does not exist would silently cover nothing.
  const missing = RULES.flatMap((rule) =>
    rule.categories.filter((name) => !idByName.has(name.toLowerCase()))
  );
  if (missing.length) {
    console.error(`These categories do not exist in the database: ${[...new Set(missing)].join(", ")}`);
    console.error("Fix the rules in this script (or the category names) before running it.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const plans = await Abonnement.find().sort({ name: 1 });

  console.log(commit ? "\nMode: COMMIT — plans will be saved\n" : "\nMode: DRY RUN — nothing will be written\n");

  const changes = [];
  const unchanged = [];
  const unmatched = [];

  for (const plan of plans) {
    const rule = RULES.find((r) => plan.name.toLowerCase().startsWith(r.match));
    const shortName = plan.name.slice(0, 40);

    if (!rule) {
      unmatched.push(shortName);
      continue;
    }

    const wanted = rule.categories.map((name) => idByName.get(name.toLowerCase()));
    const current = (plan.categories || []).map(String);
    const same = wanted.length === current.length && wanted.every((id) => current.includes(id));

    const describe = (ids) =>
      ids.length ? ids.map((id) => nameById.get(id) ?? id).join(" + ") : "(all categories)";

    if (same) {
      unchanged.push(`${shortName} -> ${describe(current)}`);
      continue;
    }

    changes.push({
      plan,
      wanted,
      line: `${shortName}\n      from ${describe(current)}\n      to   ${describe(wanted)}`,
    });
  }

  if (changes.length) {
    console.log(`Would set categories on ${changes.length} plan(s):`);
    changes.forEach((c) => console.log(`  ~ ${c.line}`));
  } else {
    console.log("Every plan already has the right categories.");
  }

  if (unchanged.length) {
    console.log(`\nAlready correct (${unchanged.length}):`);
    unchanged.forEach((line) => console.log(`  . ${line}`));
  }

  if (unmatched.length) {
    console.log(`\nNo rule for these plans — left untouched (${unmatched.length}):`);
    unmatched.forEach((name) => console.log(`  ? ${name}`));
    console.log("  Add them to RULES in this script if they need categories.");
  }

  if (commit && changes.length) {
    for (const change of changes) {
      change.plan.categories = change.wanted;
      await change.plan.save();
    }
    console.log(`\nSaved ${changes.length} plan(s).`);
  } else if (changes.length) {
    console.log("\nDry run finished. Re-run with --commit to save these changes.");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
