
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("./db");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json());

const TIME_SLOTS = [
  "Morning (fasting)",
  "After breakfast",
  "After lunch",
  "After dinner",
];

// ------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------

function getTodayIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

// ------------------------------------------
// AUTHENTICATION MIDDLEWARE
// ------------------------------------------

function auth(req, res, next) {
  const header = req.headers.authorization;

  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      message: "Please log in.",
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired session.",
    });
  }
}

// ------------------------------------------
// ROLE AUTHORIZATION MIDDLEWARE
// ------------------------------------------

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({
        message: "You are not authorized to access this resource.",
      });
    }

    next();
  };
}

// ------------------------------------------
// PATIENT REGISTRATION
// ------------------------------------------

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        message: "Email is already registered.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'patient')
       RETURNING id, name, email, role`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    res.status(201).json({
      message: "Registration successful.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      message: "Registration failed.",
    });
  }
});

// ------------------------------------------
// DOCTOR REGISTRATION
// ------------------------------------------

app.post("/api/auth/register-doctor", async (req, res) => {
  try {
    const { name, email, password, setupKey } = req.body;

    if (
      !process.env.DOCTOR_SETUP_KEY ||
      setupKey !== process.env.DOCTOR_SETUP_KEY
    ) {
      return res.status(403).json({
        message: "Invalid doctor registration key.",
      });
    }

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        message: "Email is already registered.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'doctor')
       RETURNING id, name, email, role`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    res.status(201).json({
      message: "Doctor account created successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Doctor registration error:", error);

    res.status(500).json({
      message: "Doctor registration failed.",
    });
  }
});

// ------------------------------------------
// LOGIN - PATIENT AND DOCTOR
// ------------------------------------------

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const role = user.role || "patient";

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Login failed.",
    });
  }
});

// ------------------------------------------
// PATIENT READING ROUTES
// ------------------------------------------

app.use(
  "/api/readings",
  auth,
  requireRole("patient")
);

// GET ALL READINGS

app.get("/api/readings", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         reading_date,
         time_slot,
         value AS glucose_level
       FROM readings
       WHERE user_id = $1
       ORDER BY reading_date DESC, id DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load readings.",
    });
  }
});

// ADD READING

app.post("/api/readings", async (req, res) => {
  try {
    const { reading_date, time_slot, glucose_level } = req.body;

    const value = Number(glucose_level);

    if (!validDate(reading_date)) {
      return res.status(400).json({
        message: "Enter a valid date in YYYY-MM-DD format.",
      });
    }

    if (reading_date > getTodayIndia()) {
      return res.status(400).json({
        message: "Future dates are not allowed.",
      });
    }

    if (!TIME_SLOTS.includes(time_slot)) {
      return res.status(400).json({
        message: "Select a valid time slot.",
      });
    }

    if (!Number.isInteger(value) || value < 40 || value > 600) {
      return res.status(400).json({
        message: "Glucose level must be between 40 and 600 mg/dL.",
      });
    }

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM readings
       WHERE user_id = $1 AND reading_date = $2`,
      [req.user.id, reading_date]
    );

    if (count.rows[0].total >= 4) {
      return res.status(400).json({
        message: "You can add a maximum of four readings per day.",
      });
    }

    const result = await pool.query(
      `INSERT INTO readings
         (user_id, reading_date, time_slot, value)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reading_date, time_slot,
                 value AS glucose_level`,
      [req.user.id, reading_date, time_slot, value]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "A reading already exists for this date and time slot.",
      });
    }

    console.error(error);

    res.status(500).json({
      message: "Could not save reading.",
    });
  }
});

// UPDATE READING

app.put("/api/readings/:id", async (req, res) => {
  try {
    const { reading_date, time_slot, glucose_level } = req.body;

    const value = Number(glucose_level);

    if (!validDate(reading_date) || reading_date > getTodayIndia()) {
      return res.status(400).json({
        message: "Enter a valid date that is not in the future.",
      });
    }

    if (!TIME_SLOTS.includes(time_slot)) {
      return res.status(400).json({
        message: "Select a valid time slot.",
      });
    }

    if (!Number.isInteger(value) || value < 40 || value > 600) {
      return res.status(400).json({
        message: "Glucose level must be between 40 and 600 mg/dL.",
      });
    }

    const result = await pool.query(
      `UPDATE readings
       SET reading_date = $1,
           time_slot = $2,
           value = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, reading_date, time_slot,
                 value AS glucose_level`,
      [reading_date, time_slot, value, req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Reading not found.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "A reading already exists for this date and time slot.",
      });
    }

    console.error(error);

    res.status(500).json({
      message: "Could not update reading.",
    });
  }
});

// DELETE READING

app.delete("/api/readings/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM readings
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Reading not found.",
      });
    }

    res.json({
      message: "Reading deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not delete reading.",
    });
  }
});

// ------------------------------------------
// PATIENT REPORTS
// ------------------------------------------

app.get(
  "/api/reports",
  auth,
  requireRole("patient"),
  async (req, res) => {
    try {
      const date = req.query.date || getTodayIndia();

      if (!validDate(date) || date > getTodayIndia()) {
        return res.status(400).json({
          message: "Enter a valid report date.",
        });
      }

      const monthStart = `${date.slice(0, 7)}-01`;

      const previousMonthDate = new Date(
        `${monthStart}T00:00:00Z`
      );

      previousMonthDate.setUTCMonth(
        previousMonthDate.getUTCMonth() - 1
      );

      const previousStart = previousMonthDate
        .toISOString()
        .slice(0, 10);

      const [daily, monthToDate, previousMonth] =
        await Promise.all([
          pool.query(
            `SELECT
               COUNT(*)::int AS count,
               MIN(value)::int AS min,
               MAX(value)::int AS max,
               ROUND(AVG(value), 1) AS average
             FROM readings
             WHERE user_id = $1 AND reading_date = $2`,
            [req.user.id, date]
          ),

          pool.query(
            `SELECT
               COUNT(*)::int AS count,
               MIN(value)::int AS min,
               MAX(value)::int AS max,
               ROUND(AVG(value), 1) AS average
             FROM readings
             WHERE user_id = $1
               AND reading_date >= $2
               AND reading_date <= $3`,
            [req.user.id, monthStart, date]
          ),

          pool.query(
            `SELECT
               COUNT(*)::int AS count,
               MIN(value)::int AS min,
               MAX(value)::int AS max,
               ROUND(AVG(value), 1) AS average
             FROM readings
             WHERE user_id = $1
               AND reading_date >= $2
               AND reading_date < $3`,
            [req.user.id, previousStart, monthStart]
          ),
        ]);

      res.json({
        selectedDate: date,
        daily: daily.rows[0],
        monthToDate: monthToDate.rows[0],
        previousMonth: previousMonth.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Could not generate reports.",
      });
    }
  }
);

// ------------------------------------------
// ADMIN: ASSIGN PATIENT TO DOCTOR
// ------------------------------------------

app.post("/api/admin/assign-patient", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (
      !process.env.ADMIN_SETUP_KEY ||
      adminKey !== process.env.ADMIN_SETUP_KEY
    ) {
      return res.status(403).json({
        message: "Invalid admin key.",
      });
    }

    const doctorId = Number(req.body.doctorId);
    const patientId = Number(req.body.patientId);

    if (
      !Number.isInteger(doctorId) ||
      !Number.isInteger(patientId) ||
      doctorId <= 0 ||
      patientId <= 0 ||
      doctorId === patientId
    ) {
      return res.status(400).json({
        message: "Valid doctor and patient IDs are required.",
      });
    }

    const users = await pool.query(
      `SELECT id, role
       FROM users
       WHERE id = ANY($1::int[])`,
      [[doctorId, patientId]]
    );

    const doctor = users.rows.find(
      (user) => user.id === doctorId && user.role === "doctor"
    );

    const patient = users.rows.find(
      (user) => user.id === patientId && user.role === "patient"
    );

    if (!doctor || !patient) {
      return res.status(404).json({
        message: "Doctor or patient account not found.",
      });
    }

    await pool.query(
      `INSERT INTO doctor_patient_assignments
       (doctor_id, patient_id)
       VALUES ($1, $2)
       ON CONFLICT (doctor_id, patient_id) DO NOTHING`,
      [doctorId, patientId]
    );

    res.status(201).json({
      message: "Patient assigned to doctor successfully.",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not assign patient.",
    });
  }
});

// ------------------------------------------
// DOCTOR: VIEW ASSIGNED PATIENTS
// ------------------------------------------

app.get(
  "/api/doctor/patients",
  auth,
  requireRole("doctor"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           u.id,
           u.name,
           u.email,
           a.assigned_at
         FROM doctor_patient_assignments a
         JOIN users u ON u.id = a.patient_id
         WHERE a.doctor_id = $1
         ORDER BY u.name`,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Could not load assigned patients.",
      });
    }
  }
);

// ------------------------------------------
// DOCTOR: VIEW PATIENT READINGS
// ------------------------------------------

app.get(
  "/api/doctor/patients/:patientId/readings",
  auth,
  requireRole("doctor"),
  async (req, res) => {
    try {
      const patientId = Number(req.params.patientId);

      if (!Number.isInteger(patientId) || patientId <= 0) {
        return res.status(400).json({
          message: "Invalid patient ID.",
        });
      }

      const assignment = await pool.query(
        `SELECT id
         FROM doctor_patient_assignments
         WHERE doctor_id = $1 AND patient_id = $2`,
        [req.user.id, patientId]
      );

      if (!assignment.rows.length) {
        return res.status(403).json({
          message: "This patient is not assigned to you.",
        });
      }

      const result = await pool.query(
        `SELECT
           id,
           reading_date,
           time_slot,
           value AS glucose_level
         FROM readings
         WHERE user_id = $1
         ORDER BY reading_date DESC, id DESC`,
        [patientId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Could not load patient readings.",
      });
    }
  }
);

// ------------------------------------------
// DOCTOR: VIEW PATIENT REPORTS
// ------------------------------------------

app.get(
  "/api/doctor/patients/:patientId/reports",
  auth,
  requireRole("doctor"),
  async (req, res) => {
    try {
      const patientId = Number(req.params.patientId);
      const date = req.query.date || getTodayIndia();

      if (!Number.isInteger(patientId) || patientId <= 0) {
        return res.status(400).json({
          message: "Invalid patient ID.",
        });
      }

      if (!validDate(date) || date > getTodayIndia()) {
        return res.status(400).json({
          message: "Enter a valid report date.",
        });
      }

      const assignment = await pool.query(
        `SELECT id
         FROM doctor_patient_assignments
         WHERE doctor_id = $1 AND patient_id = $2`,
        [req.user.id, patientId]
      );

      if (!assignment.rows.length) {
        return res.status(403).json({
          message: "This patient is not assigned to you.",
        });
      }

      const monthStart = `${date.slice(0, 7)}-01`;

      const previousMonthDate = new Date(
        `${monthStart}T00:00:00Z`
      );

      previousMonthDate.setUTCMonth(
        previousMonthDate.getUTCMonth() - 1
      );

      const previousStart = previousMonthDate
        .toISOString()
        .slice(0, 10);

      const [daily, monthToDate, previousMonth] =
        await Promise.all([
          pool.query(
            `SELECT
               COUNT(*)::int AS count,
               MIN(value)::int AS min,
               MAX(value)::int AS max,
               ROUND(AVG(value), 1) AS average
             FROM readings
             WHERE user_id = $1 AND reading_date = $2`,
            [patientId, date]
          ),

          pool.query(
            `SELECT
               COUNT(*)::int AS count,
               MIN(value)::int AS min,
               MAX(value)::int AS max,
               ROUND(AVG(value), 1) AS average
             FROM readings
             WHERE user_id = $1
               AND reading_date >= $2
               AND reading_date <= $3`,
            [patientId, monthStart, date]
          ),

          pool.query(
            `SELECT
               COUNT(*)::int AS count,
               MIN(value)::int AS min,
               MAX(value)::int AS max,
               ROUND(AVG(value), 1) AS average
             FROM readings
             WHERE user_id = $1
               AND reading_date >= $2
               AND reading_date < $3`,
            [patientId, previousStart, monthStart]
          ),
        ]);

      res.json({
        selectedDate: date,
        daily: daily.rows[0],
        monthToDate: monthToDate.rows[0],
        previousMonth: previousMonth.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Could not generate patient report.",
      });
    }
  }
);

// ------------------------------------------
// HEALTH CHECK
// ------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Sweety API is running.",
  });
});

module.exports = app;
