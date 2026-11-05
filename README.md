# 🚌 PANDAVAS SQARD - BUS BOOKING MANAGEMENT SYSTEM

A complete, production-ready, mobile-friendly Travel Agency Bus Booking Management Website built with Python Flask, Bootstrap 5, and MongoDB Atlas.

Featuring a theatre-ticket style interactive year/month calendar, strict role-based access control (Owner vs. Driver), duplicate bus protection, and mobile-first responsiveness.

---

## 🌟 Key Highlights

- **Dynamic Multi-Year Calendar Engine**:
  - Dynamically calculates weekdays and leap years for any year.
  - **Full-Year Grid**: 12 mini month cards (Jan to Dec) with instant booked/available status.
  - **Large Month Grid**: Theatre-ticket booking layout with tap-friendly cells (min 44px touch targets).
  - **GREEN Cell**: Date available for booking.
  - **RED Cell**: Date booked with 1 or more scheduled bus trips.
  - **DARK GREEN BORDER**: Today's date with visual highlight.
- **Two Distinct User Roles**:
  - **👑 OWNER (Administrator)**: Full CRUD control. Create, edit, cancel, and delete bookings, manage drivers, change bus numbers, routes, timings, and view real-time statistics.
  - **🚌 DRIVER (Read-Only User)**: Strictly read-only calendar access. Tap any RED date to view trip details (bus number, bus type, source &rarr; destination, departure/arrival times, assigned driver, status); tap any GREEN date to see "DATE AVAILABLE: No booking available." Drivers are strictly blocked from write/delete APIs on the backend.
- **Smart Business Logic**:
  - **Duplicate Prevention**: Prevents duplicate bookings for the *same bus* on the *same date*.
  - **Multi-Bus Support**: Allows *different buses* to be scheduled on the same date.
  - **Automatic Reversion**: When a booking is cancelled or deleted, the date automatically reverts to GREEN (available) if no other active bus is scheduled on that date.
- **Mobile-First & Clean Theme**:
  - Dark Green primary theme (`#064e3b`), clean white background, soft red booked dates, and light green available dates.
  - Zero promotional ads or distracting banners — purely focused on operations and booking management.
- **Deployment-Ready**:
  - Ready for deployment on MongoDB Atlas, Render, Railway, Heroku, or Linux VPS with Gunicorn.

---

## 📁 Project Directory Structure

```
travel_booking/
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration
├── config.py                 # App & MongoDB Atlas configuration
├── requirements.txt          # Python dependencies
├── Procfile                  # Production deployment command for Gunicorn
├── Start_WanderGo.bat        # Windows 1-click startup script
├── app.py                    # Flask application entry point
├── init_db.py                # Database indexing & initial user seeding
├── test_app.py               # Automated 10-scenario test suite
├── models/
│   ├── __init__.py
│   ├── user.py               # User model & authentication methods
│   └── booking.py            # Booking model, queries, & validation
├── routes/
│   ├── __init__.py
│   ├── auth.py               # Login, logout, session & role decorators
│   ├── owner.py              # Owner dashboard & driver management APIs
│   ├── driver.py             # Driver dashboard view
│   └── bookings.py           # Shared calendar data & owner CRUD APIs
├── templates/
│   ├── base.html             # Base responsive layout & navigation
│   ├── login.html            # Mobile-friendly sign-in page
│   ├── owner_dashboard.html  # Full owner calendar & booking management
│   ├── driver_dashboard.html # Read-only driver calendar & trip popup
│   └── 404.html              # Custom 404 error page
└── static/
    ├── css/
    │   └── style.css         # Theatre-ticket calendar & custom theme
    └── js/
        ├── calendar.js       # Dynamic calendar generation & popups
        ├── booking.js        # Owner booking modal, edit & cancel actions
        └── dashboard.js      # Driver management & table views
```

---

## 🛠️ Step-by-Step MongoDB Atlas Setup Guide

1. **Sign in to MongoDB Atlas**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in or create a free account.
2. **Create a Free Cluster**:
   - Choose **M0 (Free Tier)**.
   - Select your preferred cloud provider (AWS/GCP) and region closest to your users.
   - Click **Create Deployment**.
3. **Set Up Database Access (User Credentials)**:
   - In Atlas left sidebar, click **Security &rarr; Database Access**.
   - Click **Add New Database User**.
   - Choose **Password** authentication.
   - Enter a username (e.g. `wandergo_admin`) and a secure password.
   - Under *Database User Privileges*, select **Read and write to any database**.
   - Click **Add User**.
4. **Configure Network Access (IP Whitelist)**:
   - In Atlas left sidebar, click **Security &rarr; Network Access**.
   - Click **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`) for hosting or add your current IP address.
   - Click **Confirm**.
5. **Get Your Connection String**:
   - Go to **Database &rarr; Clusters**, and click **Connect**.
   - Choose **Drivers** (Python / 3.12+).
   - Copy the connection string format:
     ```text
     mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with the credentials you created in step 3.
   - Append `/wandergo_travels` after the host before the query parameters.
   - Example:
     ```text
     mongodb+srv://wandergo_admin:MySecurePass123@cluster0.xxxx.mongodb.net/wandergo_travels?retryWrites=true&w=majority
     ```

---

## ⚙️ Configuring the `.env` File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```ini
# Flask Secret Key
SECRET_KEY=wandergo-super-secret-key-change-in-production-2026

# Server Port
PORT=5000
FLASK_ENV=development

# MongoDB Atlas URI (Paste your connection string here)
MONGO_URI=mongodb+srv://wandergo_admin:MySecurePass123@cluster0.xxxx.mongodb.net/wandergo_travels?retryWrites=true&w=majority

# Database Name
DB_NAME=wandergo_travels

# In-memory mock fallback mode (true allows local testing without remote MongoDB)
USE_MOCK_IF_UNAVAILABLE=true
```

---

## 🚀 Running the Application Locally

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Initialize Database & Seed First Accounts
Run the setup script:
```bash
python init_db.py
```

This creates indexes, creates the default owner account, and sets up sample drivers and trips.

### 3. Launch Flask Server
```bash
python app.py
```
Open your browser or mobile phone on the same Wi-Fi network at:
`http://localhost:5000`

---

## 🔑 Default Credentials

| Role | Username | Password | Permissions |
|---|---|---|---|
| **👑 Owner** | `owner` | `OwnerPassword123!` | Full control: Add, edit, cancel, delete bookings, manage drivers |
| **🚌 Driver** | `driver_kumar` | `DriverPassword123!` | Read-only: View calendar, tap booked dates for trip details |
| **🚌 Driver** | `driver_selvam` | `DriverPassword123!` | Read-only: View calendar, tap booked dates for trip details |

*(You can create additional drivers or change credentials anytime from the Owner dashboard or `init_db.py`)*

---

## 🧪 Testing the 10 Scenarios

An automated test suite is included in `test_app.py`. Run it with:

```bash
python test_app.py
```

### Verification Checklist:
1. **Owner Login**: Successfully logs in with username `owner` and sees Owner Control dashboard.
2. **Driver Login**: Successfully logs in with username `driver_kumar` and sees read-only Driver Calendar.
3. **Owner Creates Booking**: Saves travel date, bus number, route, timing, driver, and passenger details.
4. **Date Turns RED**: Selected date turns RED on both Large Month and 12-Month Year calendars.
5. **Driver Sees RED Date**: Logged-in driver sees the updated RED date immediately.
6. **Driver Taps Date**: Opens popup with:
   - Date, Bus Number, Bus Type, Source, Destination, Departure & Arrival Times, Assigned Driver, and Status.
   - If multiple buses are booked on that date, lists all trips.
   - If tapped on GREEN date, displays "DATE AVAILABLE: No booking available."
7. **Strict Backend Permissions**: Direct API calls from drivers to POST/PUT/DELETE return HTTP `403 Forbidden`.
8. **Owner Edits Booking**: Updates reflect immediately in the database and appear for drivers.
9. **Owner Cancels Booking**: Booking is marked `CANCELLED`; date turns GREEN if no other active booking exists.
10. **Data Persistence**: All bookings, users, and drivers are stored permanently in MongoDB.

---

## 🌐 Deploying Online (Render / Railway / Heroku)

### Option A: Render.com (Recommended)
1. Push your repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New + &rarr; Web Service**.
3. Connect your repository.
4. Settings:
   - **Root Directory**: `travel_booking` (or root if repository contains only the app)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt && python init_db.py`
   - **Start Command**: `gunicorn app:app`
5. In **Environment Variables**, add:
   - `MONGO_URI`: Your MongoDB Atlas connection string.
   - `DB_NAME`: `wandergo_travels`
   - `SECRET_KEY`: A random strong secret string.
   - `FLASK_ENV`: `production`
6. Click **Deploy Web Service**.

### Option B: Railway.app
1. Go to [Railway](https://railway.app), click **New Project &rarr; Deploy from GitHub Repo**.
2. Add variables in the **Variables** tab (`MONGO_URI`, `SECRET_KEY`, `FLASK_ENV`).
3. Railway automatically detects `Procfile` and launches `gunicorn app:app`.
