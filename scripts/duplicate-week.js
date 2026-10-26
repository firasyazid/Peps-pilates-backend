/**
 * Copy one week of scheduled sessions to the following week.
 *
 * Dry run by default — it prints what it would create and writes nothing.
 * Add `--commit` to actually insert the sessions.
 *
 *   node scripts/duplicate-week.js                  # plan only (this week -> next week)
 *   node scripts/duplicate-week.js --commit         # insert them
 *   node scripts/duplicate-week.js --week 2026-10-19 --commit
 *
 * Copies the schedule only: name, cours, coach, startTime, endTime, maxCapacity
 * with the date shifted by 7 days. `currentCapacity` is left at its default 0
 * and no bookings are touched, so the new week starts empty.
 *
 * Sessions that already exist next week with the same date + startTime + cours
 * are skipped, so running this twice cannot create duplicates.
 */

const mongoose = require("mongoose");
const moment = require("moment");
require("dotenv/config");

const { ScheduledSession } = require("../models/scheduledSession");
// Registers the models the populate() calls below resolve.
require("../models/cours");
require("../models/coach");

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const weekArgIndex = args.indexOf("--week");
const weekArg = weekArgIndex === -1 ? null : args[weekArgIndex + 1];

if (weekArgIndex !== -1 && !moment(weekArg, "YYYY-MM-DD", true).isValid()) {
  console.error("--week needs a date like 2026-10-19 (any day inside the source week).");
  process.exit(1);
}

// Monday 00:00 to Sunday 23:59:59.999, matching the isoWeek ranges the API uses.
const sourceStart = (weekArg ? moment(weekArg, "YYYY-MM-DD") : moment()).startOf("isoWeek");
const sourceEnd = sourceStart.clone().endOf("isoWeek");
const targetStart = sourceStart.clone().add(1, "week");
const targetEnd = targetStart.clone().endOf("isoWeek");

const day = (date) => moment(date).format("ddd DD MMM YYYY");

async function main() {
  if (!process.env.CONNECTION_STRING) {
    console.error("CONNECTION_STRING is not set — run this from PilatesBackend with its .env in place.");
    process.exit(1);
  }

  // Same dbName as app.js — the connection string itself carries no database,
  // so without this we would talk to the empty default `test` database.
  await mongoose.connect(process.env.CONNECTION_STRING, { dbName: "PepsApp" });

  const source = await ScheduledSession.find({
    date: { $gte: sourceStart.toDate(), $lte: sourceEnd.toDate() },
  })
    .populate("cours", "name")
    .populate("coach", "name")
    .sort({ date: 1, startTime: 1 });

  const existing = await ScheduledSession.find({
    date: { $gte: targetStart.toDate(), $lte: targetEnd.toDate() },
  });

  const keyOf = (date, startTime, cours) =>
    [moment(date).format("YYYY-MM-DD"), startTime, String(cours)].join("|");
  const taken = new Set(existing.map((s) => keyOf(s.date, s.startTime, s.cours)));

  console.log(`\nSource week : ${day(sourceStart)} -> ${day(sourceEnd)}  (${source.length} sessions)`);
  console.log(`Target week : ${day(targetStart)} -> ${day(targetEnd)}  (${existing.length} already there)`);
  console.log(commit ? "\nMode        : COMMIT — sessions will be inserted\n" : "\nMode        : DRY RUN — nothing will be written\n");

  const toCreate = [];
  const skipped = [];

  for (const session of source) {
    const newDate = moment(session.date).add(1, "week").toDate();
    const coursId = session.cours?._id ?? session.cours;
    const line =
      `${day(newDate)}  ${session.startTime}-${session.endTime}  ` +
      `${session.name}  [${session.cours?.name ?? "?"} / ${session.coach?.name ?? "?"}]  ` +
      `max ${session.maxCapacity}`;

    if (taken.has(keyOf(newDate, session.startTime, coursId))) {
      skipped.push(`${line}   <- already exists, skipped`);
      continue;
    }

    taken.add(keyOf(newDate, session.startTime, coursId));
    toCreate.push({
      doc: {
        name: session.name,
        cours: coursId,
        coach: session.coach?._id ?? session.coach,
        date: newDate,
        startTime: session.startTime,
        endTime: session.endTime,
        maxCapacity: session.maxCapacity,
        // currentCapacity intentionally omitted -> defaults to 0, no bookings copied
      },
      line,
    });
  }

  if (toCreate.length) {
    console.log(`Would create ${toCreate.length} session(s):`);
    toCreate.forEach((item) => console.log(`  + ${item.line}`));
  } else {
    console.log("Nothing to create.");
  }

  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} session(s):`);
    skipped.forEach((line) => console.log(`  . ${line}`));
  }

  if (commit && toCreate.length) {
    const inserted = await ScheduledSession.insertMany(toCreate.map((item) => item.doc));
    console.log(`\nInserted ${inserted.length} session(s) into ${day(targetStart)} -> ${day(targetEnd)}.`);
  } else if (toCreate.length) {
    console.log("\nDry run finished. Re-run with --commit to insert these sessions.");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
