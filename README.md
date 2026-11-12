# 🩸 Sweety – Blood Glucose Tracker

**A Smart and Simple Blood Glucose Monitoring Platform**

Sweety is a web-based blood glucose tracking application designed to help individuals record, monitor, and understand their blood glucose levels. It provides a patient dashboard for managing glucose readings and a doctor dashboard for viewing assigned patients.

The application helps users maintain their glucose history, track trends through visual analytics, and generate reports for better health monitoring.

---

## ✨ Key Features

### 👤 Patient Dashboard
- Patient registration and secure login.
- Record daily blood glucose readings.
- Add, edit, and delete glucose entries.
- View previous glucose readings in a history table.
- Track glucose trends using interactive charts.
- View 7-day and 30-day glucose analytics.
- Generate daily, month-to-date, and previous-month reports.
- Download reports as PDF files.

### 🩺 Doctor Dashboard
- Dedicated doctor login.
- Doctor registration with a secure setup key.
- View assigned patient lists.
- Access individual patient glucose readings.
- View patient reports and glucose history.

### 📊 Data Visualization and Reports
- Interactive glucose trend charts.
- Daily glucose statistics.
- Minimum, maximum, and average glucose values.
- Monthly glucose summaries.
- PDF report generation.

### 🔐 Security
- Password hashing using bcrypt.
- JWT-based authentication.
- Role-based access for patients and doctors.
- Protected API endpoints.
- Environment variables for sensitive configuration.

---

## 🛠️ Technologies Used

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite |
| Styling | CSS |
| Backend | Node.js, Express.js |
| Database | Neon PostgreSQL |
| API Communication | Axios, REST API |
| Authentication | JWT, bcrypt |
| Charts | Recharts |
| PDF Generation | jsPDF |
| Development Tools | VS Code, Thunder Client, Git, GitHub |

---

## 🏗️ Project Architecture

Sweety follows a client-server architecture.

```text
Sweety-Blood-Glucose-Tracker/
│
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── package.json
│   └── index.html
│
├── server/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   └── db.js
│   ├── package.json
│   └── .env
│
├── .gitignore
└── README.md
```

---

## ⚙️ Installation and Setup

### Prerequisites

Make sure you have installed:

- Node.js and npm
- Git
- A Neon PostgreSQL account
- Visual Studio Code (recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/SruthiSriram10/Sweety-Blood-Glucose-Tracker/
```

```bash
cd sweety-blood-glucose-tracker
```

### 2. Setup the Backend

```bash
cd server
npm install
```

Create a `.env` file inside the `server` folder:

```env
PORT=5000

DATABASE_URL=YOUR_NEON_DATABASE_URL

JWT_SECRET=YOUR_PRIVATE_JWT_SECRET

DOCTOR_SETUP_KEY=YOUR_PRIVATE_DOCTOR_SETUP_KEY

ADMIN_SETUP_KEY=YOUR_PRIVATE_ADMIN_SETUP_KEY
```

**Important:** Replace the placeholder values with your own credentials. Never upload your `.env` file or expose database passwords and secret keys on GitHub.

Start the backend:

```bash
npm run dev
```

Backend URL:

```text
http://localhost:5000
```

### 3. Setup the Frontend

Open another terminal:

```bash
cd client
npm install
```

Start the frontend:

```bash
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

---

## 🔗 API Endpoints

The backend provides REST APIs for authentication, glucose readings, reports, and doctor-patient management.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a patient |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register-doctor` | Register a doctor |
| GET | `/api/readings` | Retrieve patient readings |
| POST | `/api/readings` | Add a glucose reading |
| PUT | `/api/readings/:id` | Update a reading |
| DELETE | `/api/readings/:id` | Delete a reading |
| GET | `/api/reports` | Retrieve patient reports |
| GET | `/api/doctor/patients` | View assigned patients |
| GET | `/api/doctor/patients/:patientId/readings` | View patient readings |
| GET | `/api/doctor/patients/:patientId/reports` | View patient reports |
| POST | `/api/admin/assign-patient` | Assign a patient to a doctor |
| GET | `/api/health` | Check backend health |

Protected endpoints require a valid JWT authentication token.

---

## 🗄️ Database

Sweety uses **Neon PostgreSQL**, a cloud-hosted PostgreSQL database.

Main database tables:

- **users** – Stores patient and doctor account information.
- **readings** – Stores blood glucose readings, dates, and time slots.
- **doctor_patient_assignments** – Maintains relationships between doctors and their assigned patients.

---

## 📸 Application Modules

The application includes the following modules:

1. Patient Registration and Login
2. Patient Dashboard
3. Blood Glucose Entry Management
4. Glucose History
5. Analytics and Visualization
6. Daily and Monthly Reports
7. PDF Report Download
8. Doctor Registration and Login
9. Doctor Dashboard
10. Patient Assignment and Monitoring

<img width="1220" height="886" alt="image" src="https://github.com/user-attachments/assets/e62a0ec0-295c-45d5-9b9e-b25e00dd6da8" />
<img width="1231" height="906" alt="image" src="https://github.com/user-attachments/assets/f3aaffad-6452-4913-a779-8d51ae8701d2" />
<img width="1232" height="902" alt="image" src="https://github.com/user-attachments/assets/abdd2deb-b6e6-40c4-88db-a167c97dbfc8" />
<img width="1228" height="916" alt="image" src="https://github.com/user-attachments/assets/e838ad43-4867-4bcf-aab4-7d0b15ed7fce" />
<img width="1230" height="887" alt="image" src="https://github.com/user-attachments/assets/c907cdb0-2cb9-457e-982b-3f095966964d" />
<img width="1217" height="881" alt="image" src="https://github.com/user-attachments/assets/23e2c061-0961-4f1c-8a7b-14d4fe31823b" />


---

## 🎯 Project Objectives

- Simplify daily blood glucose recording.
- Help patients maintain an organized glucose history.
- Provide meaningful visual insights into glucose trends.
- Enable doctors to monitor their assigned patients.
- Make glucose reports easy to access and share.

---

## 🚀 Future Enhancements

- Automated glucose monitoring device integration.
- Email and SMS reminders.
- Personalized health insights.
- AI-powered glucose trend analysis.
- Medication and appointment reminders.
- Secure report sharing between patients and healthcare professionals.

---

## ⚠️ Disclaimer

Sweety is an educational and health-monitoring project. It is not intended to replace professional medical advice, diagnosis, or treatment. Users should consult qualified healthcare professionals for medical decisions.

---

## 👩‍💻 Developed By

**Sruthi S**

M.Sc. Software Systems  
KG College of Arts and Science
sriramsruthi10@gmail.com

**Project:** Sweety – Blood Glucose Tracker

---

⭐ If you find this project interesting, consider giving the repository a star!
