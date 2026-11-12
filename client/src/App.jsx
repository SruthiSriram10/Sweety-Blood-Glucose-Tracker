
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  AreaChart,
} from "recharts";

import { jsPDF } from "jspdf";

const API = "http://localhost:5000/api";

const slots = [
  "Morning (fasting)",
  "After breakfast",
  "After lunch",
  "After dinner",
];

const today = () => {
  const date = new Date();
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
};

const emptyReading = () => ({
  reading_date: today(),
  time_slot: slots[0],
  glucose_level: "",
});

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token") || ""
  );

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  // AUTHENTICATION STATE
  const [mode, setMode] = useState("login");
  const [authRole, setAuthRole] = useState("patient");
  const [doctorSetupKey, setDoctorSetupKey] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [activePage, setActivePage] = useState("dashboard");
  const [chartRange, setChartRange] = useState(7);

  // PATIENT STATE
  const [reading, setReading] = useState(emptyReading());
  const [readings, setReadings] = useState([]);
  const [reports, setReports] = useState(null);
  const [reportDate, setReportDate] = useState(today());
  const [editingId, setEditingId] = useState(null);

  // DOCTOR STATE
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientReadings, setPatientReadings] = useState([]);
  const [patientReports, setPatientReports] = useState(null);
  const [patientReportDate, setPatientReportDate] = useState(today());

  // COMMON STATE
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const isDoctor = user?.role === "doctor";

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  function notify(text, isError = false) {
    setMessage(isError ? "" : text);
    setError(isError ? text : "");
  }

  // --------------------------------
  // LOGOUT
  // --------------------------------

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setToken("");
    setUser(null);

    setReadings([]);
    setReports(null);
    setEditingId(null);

    setPatients([]);
    setSelectedPatient(null);
    setPatientReadings([]);
    setPatientReports(null);

    setActivePage("dashboard");
    setMessage("");
    setError("");

    setMode("login");
    setAuthRole("patient");
    setDoctorSetupKey("");
    setForm({ name: "", email: "", password: "" });
  }

  // --------------------------------
  // PATIENT AND DOCTOR AUTHENTICATION
  // --------------------------------

  async function submitAuth(e) {
    e.preventDefault();
    setLoading(true);
    notify("");

    try {
      let endpoint;

      if (mode === "login") {
        endpoint = "login";
      } else {
        endpoint =
          authRole === "doctor"
            ? "register-doctor"
            : "register";
      }

      const payload =
        mode === "register" && authRole === "doctor"
          ? { ...form, setupKey: doctorSetupKey }
          : form;

      const result = await axios.post(
        `${API}/auth/${endpoint}`,
        payload
      );

      if (mode === "register") {
        notify(
          `${authRole === "doctor" ? "Doctor" : "Patient"} account created successfully. Please log in.`
        );

        setMode("login");
        setDoctorSetupKey("");

        setForm({
          name: "",
          email: form.email,
          password: "",
        });

        return;
      }

      const loggedInUser = result.data.user;

      if (!loggedInUser?.role) {
        notify(
          "Login response does not contain an account role. Please check your backend login API.",
          true
        );
        return;
      }

      if (loggedInUser.role !== authRole) {
        notify(
          `This account is registered as a ${loggedInUser.role}. Please select the correct login option.`,
          true
        );
        return;
      }

      localStorage.setItem("token", result.data.token);
      localStorage.setItem(
        "user",
        JSON.stringify(loggedInUser)
      );

      setToken(result.data.token);
      setUser(loggedInUser);
      setActivePage("dashboard");

      notify("Welcome to Sweety!");
    } catch (err) {
      notify(
        err.response?.data?.message ||
          "Authentication failed. Please check your details.",
        true
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------
  // PATIENT: LOAD READINGS AND REPORTS
  // --------------------------------

  async function loadData(
    currentToken = token,
    date = reportDate
  ) {
    if (!currentToken) return;

    setDataLoading(true);

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      };

      const [readingResponse, reportResponse] =
        await Promise.all([
          axios.get(`${API}/readings`, config),
          axios.get(`${API}/reports?date=${date}`, config),
        ]);

      setReadings(
        Array.isArray(readingResponse.data)
          ? readingResponse.data
          : readingResponse.data.readings || []
      );

      setReports(reportResponse.data);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
      } else {
        notify(
          err.response?.data?.message ||
            "Unable to load your data. Please try again.",
          true
        );
      }
    } finally {
      setDataLoading(false);
    }
  }

  // --------------------------------
  // DOCTOR: LOAD ASSIGNED PATIENTS
  // --------------------------------

  async function loadPatients() {
    if (!token || !isDoctor) return;

    setDataLoading(true);

    try {
      const result = await axios.get(
        `${API}/doctor/patients`,
        { headers }
      );

      const patientList = Array.isArray(result.data)
        ? result.data
        : result.data.patients || [];

      setPatients(patientList);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
      } else {
        notify(
          err.response?.data?.message ||
            "Unable to load assigned patients.",
          true
        );
      }
    } finally {
      setDataLoading(false);
    }
  }

  // --------------------------------
  // DOCTOR: SELECT PATIENT
  // --------------------------------

  async function selectPatient(patient) {
    setSelectedPatient(patient);
    setPatientReadings([]);
    setPatientReports(null);
    setPatientReportDate(today());
    setActivePage("patient-details");
    notify("");

    setDataLoading(true);

    try {
      const [readingResponse, reportResponse] =
        await Promise.all([
          axios.get(
            `${API}/doctor/patients/${patient.id}/readings`,
            { headers }
          ),

          axios.get(
            `${API}/doctor/patients/${patient.id}/reports?date=${today()}`,
            { headers }
          ),
        ]);

      setPatientReadings(
        Array.isArray(readingResponse.data)
          ? readingResponse.data
          : readingResponse.data.readings || []
      );

      setPatientReports(reportResponse.data);
    } catch (err) {
      notify(
        err.response?.data?.message ||
          "Unable to load patient information.",
        true
      );
    } finally {
      setDataLoading(false);
    }
  }

  // --------------------------------
  // DOCTOR: CHANGE PATIENT REPORT DATE
  // --------------------------------

  async function changePatientReportDate(date) {
    if (!date || !selectedPatient) return;

    if (date > today()) {
      notify("Future report dates are not allowed.", true);
      return;
    }

    setPatientReportDate(date);
    notify("");

    try {
      const result = await axios.get(
        `${API}/doctor/patients/${selectedPatient.id}/reports?date=${date}`,
        { headers }
      );

      setPatientReports(result.data);
    } catch (err) {
      notify(
        err.response?.data?.message ||
          "Unable to load patient report.",
        true
      );
    }
  }

  // --------------------------------
  // LOAD CORRECT DASHBOARD
  // --------------------------------

  useEffect(() => {
    if (!token || !user) return;

    if (user.role === "doctor") {
      loadPatients();
    } else if (user.role === "patient") {
      loadData(token, reportDate);
    } else {
      notify("Invalid account role. Please log in again.", true);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // --------------------------------
  // PATIENT: SAVE OR UPDATE READING
  // --------------------------------

  async function saveReading(e) {
    e.preventDefault();
    notify("");

    const value = Number(reading.glucose_level);

    if (!Number.isInteger(value) || value < 40 || value > 600) {
      notify(
        "Enter a whole glucose value between 40 and 600 mg/dL.",
        true
      );
      return;
    }

    if (!reading.reading_date || reading.reading_date > today()) {
      notify(
        "Please select a valid date that is not in the future.",
        true
      );
      return;
    }

    try {
      if (editingId) {
        await axios.put(
          `${API}/readings/${editingId}`,
          reading,
          { headers }
        );

        notify("Reading updated successfully.");
      } else {
        await axios.post(
          `${API}/readings`,
          reading,
          { headers }
        );

        notify("Reading saved successfully.");
      }

      setEditingId(null);
      setReading(emptyReading());

      await loadData();
    } catch (err) {
      notify(
        err.response?.data?.message || "Could not save reading.",
        true
      );
    }
  }

  function editReading(item) {
    setEditingId(item.id);

    setReading({
      reading_date: String(item.reading_date).slice(0, 10),
      time_slot: item.time_slot,
      glucose_level: item.glucose_level,
    });

    setActivePage("dashboard");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteReading(id) {
    if (
      !window.confirm(
        "Are you sure you want to delete this reading?"
      )
    ) {
      return;
    }

    try {
      await axios.delete(`${API}/readings/${id}`, { headers });

      notify("Reading deleted successfully.");
      await loadData();
    } catch (err) {
      notify(
        err.response?.data?.message || "Delete failed.",
        true
      );
    }
  }

  // --------------------------------
  // PATIENT: CHANGE REPORT DATE
  // --------------------------------

  async function changeReportDate(date) {
    if (!date) return;

    if (date > today()) {
      notify(
        "Please select a date that is not in the future.",
        true
      );
      return;
    }

    setReportDate(date);

    try {
      const result = await axios.get(
        `${API}/reports?date=${date}`,
        { headers }
      );

      setReports(result.data);
      notify("");
    } catch {
      notify("Unable to load the selected report.", true);
    }
  }

  // --------------------------------
  // PATIENT: ANALYTICS
  // --------------------------------

  const chartData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (chartRange - 1));

    const cutoffString = [
      cutoff.getFullYear(),
      String(cutoff.getMonth() + 1).padStart(2, "0"),
      String(cutoff.getDate()).padStart(2, "0"),
    ].join("-");

    return readings
      .filter((item) => {
        const date = String(item.reading_date).slice(0, 10);
        return date >= cutoffString && date <= today();
      })
      .map((item) => ({
        date: String(item.reading_date).slice(0, 10),
        slot: item.time_slot,
        glucose: Number(item.glucose_level),
      }))
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }

        return slots.indexOf(a.slot) - slots.indexOf(b.slot);
      });
  }, [readings, chartRange]);

  const chartAverage = chartData.length
    ? Math.round(
        chartData.reduce((sum, item) => sum + item.glucose, 0) /
          chartData.length
      )
    : null;

  const dailyCount = reports?.daily?.count ?? 0;
  const dailyAverage = reports?.daily?.average;
  const dailyMin = reports?.daily?.min;
  const dailyMax = reports?.daily?.max;

  // --------------------------------
  // PATIENT: PDF DOWNLOAD
  // --------------------------------

  function downloadReport() {
    if (!reports) {
      notify("Report data is not available.", true);
      return;
    }

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;

    const addText = (text, size = 11, x = 20) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(size);
      doc.text(String(text), x, y);
      y += size >= 16 ? 12 : 8;
    };

    doc.setTextColor(23, 105, 170);
    doc.setFontSize(22);
    doc.text("Sweety - Blood Glucose Report", 20, y);

    y += 15;
    doc.setTextColor(35, 59, 83);

    addText(`Patient: ${user?.name || "User"}`, 12);
    addText(`Report date: ${reportDate}`, 12);
    addText(`Generated on: ${today()}`, 12);

    y += 5;

    const sections = [
      ["Daily Report", reports.daily],
      ["Month-to-Date Report", reports.monthToDate],
      ["Previous Month Report", reports.previousMonth],
    ];

    sections.forEach(([title, data]) => {
      addText(title, 16);
      addText(`Readings: ${data?.count ?? 0}`);
      addText(`Minimum: ${data?.min ?? "--"} mg/dL`);
      addText(`Maximum: ${data?.max ?? "--"} mg/dL`);
      addText(`Average: ${data?.average ?? "--"} mg/dL`);
      y += 4;
    });

    if (y > pageHeight - 35) {
      doc.addPage();
      y = 20;
    }

    addText("Individual Reading History", 16);
    addText("Date | Time slot | Glucose (mg/dL)", 10);

    const sortedReadings = [...readings].sort((a, b) =>
      String(b.reading_date).localeCompare(
        String(a.reading_date)
      )
    );

    if (sortedReadings.length === 0) {
      addText("No readings recorded.", 10);
    } else {
      sortedReadings.forEach((item) => {
        addText(
          `${String(item.reading_date).slice(0, 10)} | ${item.time_slot} | ${item.glucose_level} mg/dL`,
          9
        );
      });
    }

    y += 5;

    addText(
      "This report is for personal tracking and is not a medical diagnosis.",
      9
    );

    doc.save(`Sweety-Report-${reportDate}.pdf`);
    notify("Your PDF report has been downloaded.");
  }

  // ================================================
  // AUTHENTICATION SCREEN
  // ================================================

  if (!token) {
    return (
      <main className="auth-page">
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />

        <section className="auth-card glass-card">
          <div className="auth-brand">
            <div className="brand-mark">S</div>
            <span>SWEETY</span>
          </div>

          <div className="auth-icon">♥</div>

          <p className="eyebrow">
            YOUR PERSONAL HEALTH COMPANION
          </p>

          <h1>
            {mode === "login"
              ? `${authRole === "doctor" ? "Doctor" : "Patient"} Login`
              : `${authRole === "doctor" ? "Doctor" : "Patient"} Registration`}
          </h1>

          <p className="auth-description">
            Track glucose readings and understand health trends.
          </p>

          {/* ACCOUNT TYPE SELECTOR */}

          <div className="auth-role-selector">
            <button
              type="button"
              className={authRole === "patient" ? "active" : ""}
              onClick={() => {
                setAuthRole("patient");
                setMode("login");
                setDoctorSetupKey("");
                notify("");
              }}
            >
              Patient
            </button>

            <button
              type="button"
              className={authRole === "doctor" ? "active" : ""}
              onClick={() => {
                setAuthRole("doctor");
                setMode("login");
                setDoctorSetupKey("");
                notify("");
              }}
            >
              Doctor
            </button>
          </div>

          <form className="auth-form" onSubmit={submitAuth}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
                minLength={8}
                required
              />
            </label>

            {/* DOCTOR REGISTRATION SETUP KEY */}

            {mode === "register" && authRole === "doctor" && (
              <label>
                Doctor registration key
                <input
                  type="password"
                  placeholder="Enter doctor setup key"
                  value={doctorSetupKey}
                  onChange={(e) =>
                    setDoctorSetupKey(e.target.value)
                  }
                  required
                />
                <small>
                  Contact your system administrator for this key.
                </small>
              </label>
            )}

            <button
              className="primary-btn auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Sign in to Sweety"
                : "Create account"}
            </button>
          </form>

          {message && (
            <p className="notice success">{message}</p>
          )}

          {error && (
            <p className="notice error">{error}</p>
          )}

          <p className="auth-switch">
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}

            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setMode(
                  mode === "login" ? "register" : "login"
                );
                notify("");
                setForm({
                  name: "",
                  email: form.email,
                  password: "",
                });
                setDoctorSetupKey("");
              }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>

          <p className="auth-footer">
            Secure personal glucose tracking
          </p>
        </section>
      </main>
    );
  }

  // ================================================
  // DOCTOR DASHBOARD
  // ================================================

  if (isDoctor) {
    return (
      <main className="app-shell">
        <aside className="sidebar glass-card">
          <div className="sidebar-brand">
            <div className="brand-mark">S</div>
            <div>
              <strong>SWEETY</strong>
              <span>DOCTOR PORTAL</span>
            </div>
          </div>

          <div className="sidebar-label">WORKSPACE</div>

          <nav className="side-nav">
            <button
              className={
                activePage === "dashboard" ? "selected" : ""
              }
              onClick={() => {
                setActivePage("dashboard");
                setSelectedPatient(null);
                setPatientReadings([]);
                setPatientReports(null);
                notify("");
                loadPatients();
              }}
            >
              <span className="nav-icon">⌂</span>
              My Patients
            </button>
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-help">
              <span className="help-icon">♥</span>
              <strong>Doctor workspace</strong>
              <p>Review patient glucose records securely.</p>
            </div>

            <button className="logout-btn" onClick={logout}>
              <span>↪</span> Log out
            </button>
          </div>
        </aside>

        <section className="main-area">
          <header className="main-header">
            <div>
              <p className="eyebrow">DOCTOR WORKSPACE</p>
              <h1>
                {activePage === "patient-details"
                  ? "Patient Details"
                  : "Doctor Dashboard"}
              </h1>
            </div>

            <div className="header-right">
              <div className="header-date">
                <span className="date-icon">◷</span>
                <span>{today()}</span>
              </div>

              <div className="user-avatar">
                {(user?.name || "D")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="user-details">
                <strong>{user?.name}</strong>
                <span>Doctor</span>
              </div>
            </div>
          </header>

          {message && (
            <div className="notice success">{message}</div>
          )}

          {error && (
            <div className="notice error">{error}</div>
          )}

          {activePage === "dashboard" && (
            <>
              <section className="welcome-banner glass-card">
                <div>
                  <p className="eyebrow">WELCOME, DOCTOR</p>
                  <h2>
                    Hello, {user?.name} <span>✦</span>
                  </h2>
                  <p>
                    Review your assigned patients and their
                    glucose tracking records.
                  </p>
                </div>

                <div className="welcome-decoration">
                  <span>♥</span>
                  <small>DOCTOR PORTAL</small>
                </div>
              </section>

              <section className="stats-grid">
                <Stat
                  icon="♙"
                  title="Assigned patients"
                  value={patients.length}
                  suffix="patients"
                  accent="blue"
                />

                <Stat
                  icon="◷"
                  title="Today's date"
                  value={today()}
                  suffix=""
                  accent="purple"
                />
              </section>

              <section className="panel glass-card">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">PATIENT MANAGEMENT</p>
                    <h2>My assigned patients</h2>
                    <p className="panel-subtitle">
                      Select a patient to view their glucose
                      history and reports.
                    </p>
                  </div>

                  <span className="record-count">
                    {patients.length} assigned
                  </span>
                </div>

                {dataLoading ? (
                  <p className="empty-state">
                    Loading patients...
                  </p>
                ) : patients.length === 0 ? (
                  <div className="empty-state">
                    <span>♙</span>
                    <h3>No patients assigned</h3>
                    <p>
                      Patients assigned to your doctor account
                      will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Email</th>
                          <th>Assigned date</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {patients.map((patient) => (
                          <tr key={patient.id}>
                            <td>
                              <strong>{patient.name}</strong>
                            </td>
                            <td>{patient.email}</td>
                            <td>
                              {patient.assigned_at
                                ? new Date(
                                    patient.assigned_at
                                  ).toLocaleDateString()
                                : "--"}
                            </td>
                            <td>
                              <button
                                className="table-btn edit-btn"
                                onClick={() =>
                                  selectPatient(patient)
                                }
                              >
                                View details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {activePage === "patient-details" &&
            selectedPatient && (
              <>
                <button
                  className="secondary-btn"
                  onClick={() => {
                    setActivePage("dashboard");
                    setSelectedPatient(null);
                    setPatientReadings([]);
                    setPatientReports(null);
                    notify("");
                  }}
                >
                  ← Back to patients
                </button>

                <section className="welcome-banner glass-card">
                  <div>
                    <p className="eyebrow">PATIENT PROFILE</p>
                    <h2>{selectedPatient.name}</h2>
                    <p>{selectedPatient.email}</p>
                  </div>

                  <div className="welcome-decoration">
                    <span>♥</span>
                    <small>READ ONLY ACCESS</small>
                  </div>
                </section>

                <section className="stats-grid">
                  <Stat
                    icon="◷"
                    title="Daily readings"
                    value={patientReports?.daily?.count ?? "--"}
                    suffix="readings"
                    accent="blue"
                  />

                  <Stat
                    icon="⌁"
                    title="Daily average"
                    value={patientReports?.daily?.average ?? "--"}
                    suffix={
                      patientReports?.daily?.average == null
                        ? ""
                        : "mg/dL"
                    }
                    accent="purple"
                  />

                  <Stat
                    icon="↓"
                    title="Minimum reading"
                    value={patientReports?.daily?.min ?? "--"}
                    suffix={
                      patientReports?.daily?.min == null
                        ? ""
                        : "mg/dL"
                    }
                    accent="green"
                  />

                  <Stat
                    icon="↑"
                    title="Maximum reading"
                    value={patientReports?.daily?.max ?? "--"}
                    suffix={
                      patientReports?.daily?.max == null
                        ? ""
                        : "mg/dL"
                    }
                    accent="orange"
                  />
                </section>

                <section className="panel glass-card">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">PATIENT REPORT</p>
                      <h2>Daily and monthly summary</h2>
                    </div>
                  </div>

                  <label className="report-date">
                    <span>Select report date</span>
                    <input
                      type="date"
                      value={patientReportDate}
                      max={today()}
                      onChange={(e) =>
                        changePatientReportDate(e.target.value)
                      }
                    />
                  </label>

                  <div className="report-grid">
                    <Report
                      title="Daily report"
                      data={patientReports?.daily}
                      accent="blue"
                    />

                    <Report
                      title="Month to date"
                      data={patientReports?.monthToDate}
                      accent="purple"
                    />

                    <Report
                      title="Previous month"
                      data={patientReports?.previousMonth}
                      accent="green"
                    />
                  </div>
                </section>

                <section className="panel glass-card">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">PATIENT RECORDS</p>
                      <h2>Glucose reading history</h2>
                    </div>

                    <span className="record-count">
                      {patientReadings.length} readings
                    </span>
                  </div>

                  {dataLoading ? (
                    <p className="empty-state">
                      Loading patient readings...
                    </p>
                  ) : patientReadings.length === 0 ? (
                    <div className="empty-state">
                      <span>⌁</span>
                      <h3>No readings available</h3>
                      <p>
                        This patient has not recorded any readings.
                      </p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Time slot</th>
                            <th>Glucose level</th>
                          </tr>
                        </thead>

                        <tbody>
                          {patientReadings.map((item) => (
                            <tr key={item.id}>
                              <td>
                                {String(
                                  item.reading_date
                                ).slice(0, 10)}
                              </td>

                              <td>{item.time_slot}</td>

                              <td>
                                <strong className="glucose-value">
                                  {item.glucose_level} mg/dL
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="helper-text">
                    Patient information is displayed in read-only
                    mode. This dashboard does not provide a medical
                    diagnosis.
                  </p>
                </section>
              </>
            )}

          <footer className="app-footer">
            <span>♥ SWEETY</span>
            <span>Doctor Portal</span>
            <span>Made with care</span>
          </footer>
        </section>
      </main>
    );
  }

  // ================================================
  // PATIENT DASHBOARD
  // ================================================

  return (
    <main className="app-shell">
      <aside className="sidebar glass-card">
        <div className="sidebar-brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>SWEETY</strong>
            <span>HEALTH TRACKER</span>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="side-nav">
          <button
            className={
              activePage === "dashboard" ? "selected" : ""
            }
            onClick={() => setActivePage("dashboard")}
          >
            <span className="nav-icon">⌂</span>
            Dashboard
          </button>

          <button
            className={
              activePage === "analytics" ? "selected" : ""
            }
            onClick={() => setActivePage("analytics")}
          >
            <span className="nav-icon">⌁</span>
            Analytics
          </button>

          <button
            className={
              activePage === "reports" ? "selected" : ""
            }
            onClick={() => setActivePage("reports")}
          >
            <span className="nav-icon">▤</span>
            Reports
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-icon">♥</span>
            <strong>Your health matters</strong>
            <p>Small steps make a healthier routine.</p>
          </div>

          <button className="logout-btn" onClick={logout}>
            <span>↪</span> Log out
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="main-header">
          <div>
            <p className="eyebrow">PERSONAL HEALTH OVERVIEW</p>
            <h1>
              {activePage === "dashboard" && "Dashboard"}
              {activePage === "analytics" && "Glucose Analytics"}
              {activePage === "reports" && "Health Reports"}
            </h1>
          </div>

          <div className="header-right">
            <div className="header-date">
              <span className="date-icon">◷</span>
              <span>{today()}</span>
            </div>

            <div className="user-avatar">
              {(user?.name || "U")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="user-details">
              <strong>{user?.name || "User"}</strong>
              <span>Patient account</span>
            </div>
          </div>
        </header>

        {message && (
          <div className="notice success">{message}</div>
        )}

        {error && (
          <div className="notice error">{error}</div>
        )}

        {/* PATIENT DASHBOARD PAGE */}

        {activePage === "dashboard" && (
          <>
            <section className="welcome-banner glass-card">
              <div>
                <p className="eyebrow">WELCOME BACK</p>
                <h2>
                  Hello, {user?.name || "there"} <span>✦</span>
                </h2>
                <p>
                  Stay consistent. Keep track of your daily glucose
                  readings.
                </p>
              </div>

              <div className="welcome-decoration">
                <span>♥</span>
                <small>YOUR HEALTH, YOUR JOURNEY</small>
              </div>
            </section>

            <section className="stats-grid">
              <Stat
                icon="◷"
                title="Today's readings"
                value={dailyCount}
                suffix="readings"
                accent="blue"
              />

              <Stat
                icon="⌁"
                title="Daily average"
                value={dailyAverage ?? "--"}
                suffix={
                  dailyAverage == null ? "" : "mg/dL"
                }
                accent="purple"
              />

              <Stat
                icon="↓"
                title="Minimum reading"
                value={dailyMin ?? "--"}
                suffix={dailyMin == null ? "" : "mg/dL"}
                accent="green"
              />

              <Stat
                icon="↑"
                title="Maximum reading"
                value={dailyMax ?? "--"}
                suffix={dailyMax == null ? "" : "mg/dL"}
                accent="orange"
              />
            </section>

            <section className="content-grid">
              <div className="panel glass-card">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">RECORD YOUR HEALTH</p>
                    <h2>
                      {editingId
                        ? "Edit reading"
                        : "Add glucose reading"}
                    </h2>
                  </div>

                  <span className="panel-icon">＋</span>
                </div>

                <form
                  className="reading-form"
                  onSubmit={saveReading}
                >
                  <label>
                    Reading date
                    <input
                      type="date"
                      value={reading.reading_date}
                      max={today()}
                      onChange={(e) =>
                        setReading({
                          ...reading,
                          reading_date: e.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    Time slot
                    <select
                      value={reading.time_slot}
                      onChange={(e) =>
                        setReading({
                          ...reading,
                          time_slot: e.target.value,
                        })
                      }
                    >
                      {slots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Glucose level (mg/dL)
                    <input
                      type="number"
                      min="40"
                      max="600"
                      step="1"
                      placeholder="Example: 110"
                      value={reading.glucose_level}
                      onChange={(e) =>
                        setReading({
                          ...reading,
                          glucose_level: e.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <button
                    className="primary-btn"
                    type="submit"
                  >
                    {editingId
                      ? "Update reading"
                      : "Save reading"}
                  </button>

                  {editingId && (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        setEditingId(null);
                        setReading(emptyReading());
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </form>
              </div>

              <div className="panel glass-card quick-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">QUICK INSIGHT</p>
                    <h2>Today's overview</h2>
                  </div>

                  <span className="panel-icon">✧</span>
                </div>

                <div className="quick-number">
                  {dailyCount}
                  <span>readings recorded</span>
                </div>

                <div className="quick-divider" />

                <div className="quick-row">
                  <span>Average</span>
                  <strong>
                    {dailyAverage == null
                      ? "--"
                      : `${dailyAverage} mg/dL`}
                  </strong>
                </div>

                <div className="quick-row">
                  <span>Minimum</span>
                  <strong>
                    {dailyMin == null
                      ? "--"
                      : `${dailyMin} mg/dL`}
                  </strong>
                </div>

                <div className="quick-row">
                  <span>Maximum</span>
                  <strong>
                    {dailyMax == null
                      ? "--"
                      : `${dailyMax} mg/dL`}
                  </strong>
                </div>

                <p className="helper-text">
                  Your readings are displayed for personal tracking.
                </p>
              </div>
            </section>

            <section className="panel glass-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">YOUR RECORDS</p>
                  <h2>Glucose history</h2>
                </div>

                <span className="record-count">
                  {readings.length} total
                </span>
              </div>

              {dataLoading ? (
                <p className="empty-state">Loading readings...</p>
              ) : readings.length === 0 ? (
                <div className="empty-state">
                  <span>⌁</span>
                  <h3>No readings yet</h3>
                  <p>
                    Add your first glucose reading to see your history.
                  </p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time slot</th>
                        <th>Glucose level</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {readings.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {String(item.reading_date).slice(0, 10)}
                          </td>

                          <td>{item.time_slot}</td>

                          <td>
                            <strong className="glucose-value">
                              {item.glucose_level} mg/dL
                            </strong>
                          </td>

                          <td className="table-actions">
                            <button
                              className="table-btn edit-btn"
                              onClick={() => editReading(item)}
                            >
                              Edit
                            </button>

                            <button
                              className="table-btn delete-btn"
                              onClick={() =>
                                deleteReading(item.id)
                              }
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* PATIENT ANALYTICS PAGE */}

        {activePage === "analytics" && (
          <>
            <section className="stats-grid analytics-stats">
              <Stat
                icon="⌁"
                title={`${chartRange}-day average`}
                value={chartAverage ?? "--"}
                suffix={
                  chartAverage == null ? "" : "mg/dL"
                }
                accent="purple"
              />

              <Stat
                icon="◉"
                title="Readings in period"
                value={chartData.length}
                suffix="readings"
                accent="blue"
              />
            </section>

            <section className="panel glass-card">
              <div className="panel-heading analytics-heading">
                <div>
                  <p className="eyebrow">VISUAL HEALTH INSIGHTS</p>
                  <h2>Glucose trends</h2>
                  <p className="panel-subtitle">
                    Explore your recorded glucose readings over time.
                  </p>
                </div>

                <div className="range-switch">
                  <button
                    className={chartRange === 7 ? "active" : ""}
                    onClick={() => setChartRange(7)}
                  >
                    7 days
                  </button>

                  <button
                    className={chartRange === 30 ? "active" : ""}
                    onClick={() => setChartRange(30)}
                  >
                    30 days
                  </button>
                </div>
              </div>

              {chartData.length === 0 ? (
                <div className="empty-state">
                  <span>⌁</span>
                  <h3>No analytics available</h3>
                  <p>
                    Add glucose readings to see your trends here.
                  </p>
                </div>
              ) : (
                <div className="chart-container">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <AreaChart
                      data={chartData}
                      margin={{
                        top: 15,
                        right: 15,
                        left: 0,
                        bottom: 5,
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="glucoseGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#38A5F5"
                            stopOpacity={0.28}
                          />
                          <stop
                            offset="100%"
                            stopColor="#38A5F5"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke="#E5EDF5"
                        strokeDasharray="4 5"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="date"
                        stroke="#9AAFC3"
                        tick={{
                          fill: "#60758C",
                          fontSize: 11,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />

                      <YAxis
                        stroke="#9AAFC3"
                        tick={{
                          fill: "#60758C",
                          fontSize: 11,
                        }}
                        tickLine={false}
                        axisLine={false}
                        width={55}
                        domain={["auto", "auto"]}
                      />

                      <Tooltip
                        contentStyle={{
                          background: "#FFFFFF",
                          border: "1px solid #DCEAF7",
                          borderRadius: "12px",
                          color: "#183B5B",
                          boxShadow:
                            "0 6px 20px rgba(40, 100, 160, 0.10)",
                        }}
                        labelStyle={{ color: "#52718A" }}
                        formatter={(value) => [
                          `${value} mg/dL`,
                          "Glucose",
                        ]}
                        labelFormatter={(label) =>
                          `Date: ${label}`
                        }
                      />

                      <Area
                        type="monotone"
                        dataKey="glucose"
                        stroke="#2689D8"
                        strokeWidth={3}
                        fill="url(#glucoseGradient)"
                        dot={{
                          r: 4,
                          fill: "#2689D8",
                          stroke: "#FFFFFF",
                          strokeWidth: 2,
                        }}
                        activeDot={{
                          r: 7,
                          fill: "#1674BD",
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="helper-text">
                The graph displays recorded values, not a medical
                assessment.
              </p>
            </section>

            <section className="panel glass-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">RECENT DATA</p>
                  <h2>Readings in selected period</h2>
                </div>
              </div>

              {chartData.length === 0 ? (
                <p className="empty-state">
                  No readings for this period.
                </p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time slot</th>
                        <th>Glucose</th>
                      </tr>
                    </thead>

                    <tbody>
                      {chartData.map((item, index) => (
                        <tr
                          key={`${item.date}-${item.slot}-${index}`}
                        >
                          <td>{item.date}</td>
                          <td>{item.slot}</td>
                          <td>
                            <strong className="glucose-value">
                              {item.glucose} mg/dL
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* PATIENT REPORTS PAGE */}

        {activePage === "reports" && (
          <>
            <section className="panel glass-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">REPORT GENERATION</p>
                  <h2>Your glucose reports</h2>
                  <p className="panel-subtitle">
                    Review your daily and monthly reading summaries.
                  </p>
                </div>
              </div>

              <label className="report-date">
                <span>Select report date</span>
                <input
                  type="date"
                  value={reportDate}
                  max={today()}
                  onChange={(e) =>
                    changeReportDate(e.target.value)
                  }
                />
              </label>

              <div className="report-grid">
                <Report
                  title="Daily report"
                  data={reports?.daily}
                  accent="blue"
                />

                <Report
                  title="Month to date"
                  data={reports?.monthToDate}
                  accent="purple"
                />

                <Report
                  title="Previous month"
                  data={reports?.previousMonth}
                  accent="green"
                />
              </div>

              <button
                className="primary-btn pdf-btn"
                onClick={downloadReport}
                disabled={!reports}
              >
                <span>↓</span> Download PDF report
              </button>
            </section>

            <section className="panel glass-card">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">REPORT DETAILS</p>
                  <h2>Recorded readings</h2>
                </div>
              </div>

              {readings.length === 0 ? (
                <p className="empty-state">
                  No readings recorded yet.
                </p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time slot</th>
                        <th>Glucose</th>
                      </tr>
                    </thead>

                    <tbody>
                      {readings.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {String(item.reading_date).slice(0, 10)}
                          </td>

                          <td>{item.time_slot}</td>

                          <td>
                            <strong className="glucose-value">
                              {item.glucose_level} mg/dL
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="helper-text">
                This report is for personal tracking and is not a
                substitute for professional medical advice.
              </p>
            </section>
          </>
        )}

        <footer className="app-footer">
          <span>♥ SWEETY</span>
          <span>Personal Blood Glucose Tracker</span>
          <span>Made with care</span>
        </footer>
      </section>
    </main>
  );
}

// ================================================
// REUSABLE STATISTICS CARD
// ================================================

function Stat({ icon, title, value, suffix, accent }) {
  return (
    <article className={`stat-card glass-card ${accent}`}>
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>

      <div className="stat-value">
        {value}
        {suffix && <small>{suffix}</small>}
      </div>
    </article>
  );
}

// ================================================
// REUSABLE REPORT CARD
// ================================================

function Report({ title, data, accent }) {
  return (
    <article className={`report-card ${accent}`}>
      <div className="report-card-top">
        <span className="report-dot" />
        <h3>{title}</h3>
      </div>

      <div className="report-metric">
        <span>Total readings</span>
        <strong>{data?.count ?? 0}</strong>
      </div>

      <div className="report-metric">
        <span>Minimum</span>
        <strong>
          {data?.min ?? "--"}
          {data?.min != null ? " mg/dL" : ""}
        </strong>
      </div>

      <div className="report-metric">
        <span>Maximum</span>
        <strong>
          {data?.max ?? "--"}
          {data?.max != null ? " mg/dL" : ""}
        </strong>
      </div>

      <div className="report-metric">
        <span>Average</span>
        <strong>
          {data?.average ?? "--"}
          {data?.average != null ? " mg/dL" : ""}
        </strong>
      </div>
    </article>
  );
}

export default App;
