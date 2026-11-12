require("dotenv").config();
const { pool, initializeDatabase } = require("./src/db");

async function test() {
  try {
    await initializeDatabase();

    const result = await pool.query("SELECT NOW()");
    console.log("PostgreSQL connected successfully!");
    console.log(result.rows[0]);

  } catch (error) {
    console.error("Database error:", error.message);
  } finally {
    await pool.end();
  }
}

test();