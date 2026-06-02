/**
 * Seeds random vehicles and closed tickets over the last N days (dashboard timeline demo).
 * Port of Python scripts/seed_timeline_demo.py.
 *
 * Prerequisites: vehicle_types rows and active parking_spot rows for GARAGE_ID.
 * Run: npm run db:seed-timeline
 */
const crypto = require("crypto");
const { Pool } = require("pg");
require("dotenv").config();

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const GARAGE_ID = 1;
const DAYS_BACK = 30;
const MIN_TICKETS_PER_DAY = 10;
const MAX_TICKETS_PER_DAY = 35;
const PLATE_PREFIX = "BZ";

function generateTicketToken(garageId) {
  let randomPart = "";
  for (let i = 0; i < 6; i += 1) {
    randomPart += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return `G${garageId}${randomPart}`;
}

function makePlate(n) {
  return `${PLATE_PREFIX}${String(n).padStart(6, "0")}`.slice(0, 8);
}

function randomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

function pickRandom(arr) {
  return arr[crypto.randomInt(0, arr.length)];
}

if (!process.env.DATABASE_URL) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  let createdVehicles = 0;
  let createdTickets = 0;

  try {
    const vtResult = await client.query(
      `SELECT id FROM vehicle_types ORDER BY id`
    );
    const vehicleTypes = vtResult.rows;
    if (vehicleTypes.length === 0) {
      // eslint-disable-next-line no-console
      console.log("No vehicle types found. Create vehicle types first.");
      return;
    }

    const spotsResult = await client.query(
      `SELECT id FROM parking_spot
       WHERE garage_id = $1 AND is_active = TRUE`,
      [GARAGE_ID]
    );
    const spots = spotsResult.rows;
    if (spots.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`No active spots found for garage_id=${GARAGE_ID}.`);
      return;
    }

    const now = new Date();
    const startDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - (DAYS_BACK - 1),
        0,
        0,
        0,
        0
      )
    );

    let plateCounter = 1;

    for (let dayIndex = 0; dayIndex < DAYS_BACK; dayIndex += 1) {
      const dayStart = new Date(startDay);
      dayStart.setUTCDate(startDay.getUTCDate() + dayIndex);

      const baseCount = randomInt(MIN_TICKETS_PER_DAY, MAX_TICKETS_PER_DAY);

      await client.query("BEGIN");

      try {
        for (let t = 0; t < baseCount; t += 1) {
          const vt = pickRandom(vehicleTypes);
          const plate = makePlate(plateCounter);
          plateCounter += 1;

          const vehicleIns = await client.query(
            `INSERT INTO vehicle (licence_plate, vehicle_type_id, status)
             VALUES ($1, $2, 1)
             RETURNING id`,
            [plate, vt.id]
          );
          const vehicleId = vehicleIns.rows[0].id;
          createdVehicles += 1;

          const entryTime = new Date(dayStart);
          entryTime.setUTCHours(
            randomInt(6, 22),
            randomInt(0, 59),
            randomInt(0, 59),
            0
          );

          const stayMinutes = randomInt(20, 8 * 60);
          const exitTime = new Date(entryTime.getTime() + stayMinutes * 60 * 1000);

          const spot = pickRandom(spots);

          await client.query(
            `INSERT INTO tickets (
               ticket_token, entry_time, exit_time, fee, ticket_state, payment_status,
               operational_status, vehicle_id, garage_id, spot_id, image_url
             ) VALUES ($1, $2, $3, 0, 'CLOSED', 'UNPAID', 'OK', $4, $5, $6, NULL)`,
            [
              generateTicketToken(GARAGE_ID),
              entryTime,
              exitTime,
              vehicleId,
              GARAGE_ID,
              spot.id
            ]
          );
          createdTickets += 1;
        }

        await client.query("COMMIT");
        // eslint-disable-next-line no-console
        console.log(`Day ${dayIndex + 1}/${DAYS_BACK} committed.`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }

    // eslint-disable-next-line no-console
    console.log();
    // eslint-disable-next-line no-console
    console.log(`Created vehicles: ${createdVehicles}`);
    // eslint-disable-next-line no-console
    console.log(`Created tickets:  ${createdTickets}`);
    // eslint-disable-next-line no-console
    console.log("Done.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", error);
  process.exit(1);
});
