# Finished Goods Container Loading Dashboard

A full-stack **Handling Unit (HU) & Carton Verification Dashboard** for warehouse container loading operations. Upload a Master Packing List (`.xlsx` / `.xls`), scan handling unit barcodes in real time with audio & error-lock protection, monitor container fill progress, search by Billing Document, export session and monthly Excel reports, and send automated start/completion email summaries.

## Features

- **Master Packing List Import (`.xlsx` / `.xls`)**: Automatically detects `Handling Unit`, `Billing Doc`, `Material`, `Item Description`, `Color`, and `Main Size` columns. Includes a built-in **Sample Excel** generator for quick testing.
- **Live Barcode Scanning with Error Lock**:
  - Instant `Enter`-key barcode scanning with Web Audio API sound feedback (Success, Duplicate, Error).
  - Automatic scanner lock on `NOT IN MASTER LIST` or `DUPLICATE` scans until acknowledged.
- **Accurate Time Tracking**: Tracks total session elapsed time, pause/hold duration, and net active loading process time.
- **Side-View Container Fill Indicator**: Visualizes live container load percentage alongside total, scanned, and remaining box counters.
- **Pause & Pending HU Review**: Pausing displays all not-yet-scanned Handling Units in real time.
- **Billing Document Search**: Look up any Billing Document to inspect all linked Handling Units and their scanned/missing status.
- **Excel Reporting**:
  - **Session Summary Report (`.xlsx`)**: Multi-sheet workbook (`Session Summary`, `Scan Logs`, `Missing Boxes`).
  - **Monthly Shipment Report (`.xlsx`)**: Aggregates completed sessions by year and month.
- **Automated Email Notifications (Optional)**: Sends start and completion summary emails via Gmail SMTP configured safely through `.env`.

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/container-loading-dashboard.git
cd container-loading-dashboard
npm install
```

### 2. Configure Environment Variables (Optional for Brevo Email Alerts)

Copy `.env.example` to `.env` and fill in your Brevo API key, verified sender email, and comma-separated recipient emails:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
BREVO_API_KEY=your-brevo-api-key
SENDER_EMAIL=your-verified-sender@example.com
RECIPIENT_EMAILS=recipient1@example.com,recipient2@example.com
SENDER_NAME=Container Loading System
```

> **Security Note**: Never commit `.env` or hardcode your `BREVO_API_KEY` in source files — GitHub and Brevo automatically revoke exposed API keys. `.env` is already listed in `.gitignore`. When deploying (e.g., Render, Railway, Cloud Run, or AI Studio Secrets), set these values in your platform's Environment Variables / Secrets panel.

### 3. Run Locally

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 4. Production Build & Start

```bash
npm run build
npm start
```

## Expected Excel Packing List Format

The dashboard automatically recognizes common column headers in row 1:

| Handling Unit | Billing Doc | Material | Item Description | Color | Main Size |
| :--- | :--- | :--- | :--- | :--- | :--- |
| HU10004501 | BD-2026-001 | MAT-8841 | Cotton Crew Neck Tee | Navy | M |
| HU10004502 | BD-2026-001 | MAT-8841 | Cotton Crew Neck Tee | Navy | L |

Click **Sample Excel** in the top bar to download a ready-to-use template file.

## Uploading to GitHub

Run these commands in your project folder after creating an empty repository on GitHub:

```bash
git init
git add .
git commit -m "Initial commit: Container Loading Dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, `read-excel-file` & `write-excel-file`, Lucide Icons
- **Backend**: Node.js, Express, Brevo Transactional Email API, Vite
- **Storage**: Browser `localStorage` for monthly report aggregation

## License

MIT License — see [LICENSE](./LICENSE).
