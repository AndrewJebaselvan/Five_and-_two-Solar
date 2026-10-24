# Five and Two Energy Solutions — Solar Company Website Starter

A full-stack website project for **Five and Two Energy Solutions** using **React + JavaScript + Vite**, **Python + Flask**, **MySQL + SQLAlchemy**, and REST APIs. The project includes a working FAQ-fallback chatbot and does not require an AI API key to run.

> **Project status:** functional starter/MVP scaffold, not production-ready software. The company name is **Five and Two Energy Solutions**. The company logo is in `frontend/public/logo.png`. The panel catalogue starts empty; add verified product specifications and quotations before using the panel calculator. Government scheme information must be checked against current official rules.

## Features included

- White, gold, navy blue and silver customer-facing UI.
- Solar calculator for 1 kW, 2 kW and 3 kW planning sizes with daily/monthly/annual generation estimates.
- Customer-facing panel guidance section with reserved photo spaces; product data is managed separately in the admin area.
- Solar information sections and links to official PM Surya Ghar and Tamil Nadu Solar Homes portals.
- In-page solar chatbot with grounded knowledge retrieval, optional AI answers, linked sources, an FAQ fallback, and callback form.
- Customer enquiry form with consent, validation, database storage and website/chatbot source tracking.
- Admin entry shortcut: **Ctrl + Shift + A**. It only opens the login modal; all admin API endpoints require authentication.
- Admin dashboard for customer leads, lead status updates, panel prices and an activity log.
- Backend validation, password hashing, environment-based secrets and CORS allow-list.
- Lead statuses: New, Contacted, Site Visit Scheduled, Quoted, Converted, Not Interested.


## Chatbot: grounded AI with FAQ fallback

The Flask chatbot retrieves relevant passages from `backend/knowledge_base/solar_faq.json`, can add active panel catalogue data from the database, and can ask the OpenAI Responses API to draft a concise answer from that context. The React client displays returned source links. A lightweight local keyword retriever is used, so no vector database or embedding service is required for this first version.

To enable AI, set `AI_API_KEY` and `AI_MODEL` in `backend/.env`. `AI_API_URL` defaults to the OpenAI Responses API endpoint and can be changed for a compatible endpoint. The key stays on the Flask server. If AI is not configured, retrieval is weak, or the API is unavailable, the existing deterministic FAQ fallback remains available. No chat history is persisted by the app, and AI requests set `store` to `false`.

The model is instructed to use supplied context, avoid making subsidy or eligibility promises, treat catalogue prices as panel equipment values rather than full quotes, and offer a callback when it cannot verify an answer. Scheme rules and amounts still require review against official current sources. Keep the knowledge base reviewed and update its content and sources before using it for customer-facing claims.

## Company logo

The current company logo is `frontend/public/logo.png`. Keep accessible alt text and sensible sizing when changing its use in the header or footer.

## Project structure

```text
five-and-two-energy-solutions/
├── frontend/
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       └── styles.css
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   └── .env.example
├── .gitignore
└── README.md
```

## Requirements

- Python 3.10+ recommended
- Node.js 20+ recommended
- MySQL Community Server (or use the local SQLite fallback for a quick UI/API test)
- VS Code
- Codex extension for VS Code, if you want Codex to inspect and edit the project in your editor

## 1. Open the project in VS Code

1. Extract the ZIP file to a normal working folder, for example `D:\Projects\five-and-two-energy-solutions`.
2. Open VS Code → **File → Open Folder** → choose the `five-and-two-energy-solutions` folder.
3. Open the Codex panel/extension in VS Code and ask it to inspect `README.md`, `frontend/src/App.jsx`, and `backend/app.py` before making changes.
4. Keep the project folder open as the Codex workspace. Codex can work on the files in that workspace when its extension is installed and enabled; this ZIP itself does not install the extension or move files automatically into VS Code.

## 2. Configure MySQL

In MySQL, create a database and a dedicated local user. Example (choose your own password):

```sql
CREATE DATABASE five_two_energy_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'solar_user'@'localhost' IDENTIFIED BY 'replace_with_a_strong_password';
GRANT ALL PRIVILEGES ON five_two_energy_db.* TO 'solar_user'@'localhost';
FLUSH PRIVILEGES;
```

Then:

1. Copy `backend/.env.example` to `backend/.env`.
2. Update `DATABASE_URL` to match your MySQL username/password/database. URL-encode special characters in the password if needed.
3. Set a long random `SECRET_KEY` and a strong `ADMIN_PASSWORD`.
4. Do **not** commit `.env` to GitHub.

Example URL format:

```text
DATABASE_URL=mysql+pymysql://solar_user:your_password@localhost:3306/five_two_energy_db
```

If `DATABASE_URL` is omitted, Flask uses a local SQLite database so you can smoke-test the project. For your intended stack, configure MySQL.

## 3. Start the Flask backend

Open a VS Code terminal:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` before starting. Then run:

```powershell
python app.py
```

The API runs at `http://127.0.0.1:5000`. Test `http://127.0.0.1:5000/api/health` in your browser. On first startup, the database tables are created. The panel catalogue is left empty until verified panel records are added. An admin account is created only if `ADMIN_USERNAME` and a non-placeholder `ADMIN_PASSWORD` are configured before the first startup.

If PowerShell blocks activation, you can run the virtual environment's Python directly instead: `.venv\Scripts\python.exe -m pip install -r requirements.txt` and `.venv\Scripts\python.exe app.py`.

## 4. Start the React frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

If your backend is hosted somewhere else, create `frontend/.env` with:

```text
VITE_API_URL=http://127.0.0.1:5000/api
```

Restart Vite after changing environment variables.

## 5. Free demo deployment (Render + Neon)

GitHub can store the source and trigger deploys, but GitHub Pages only serves static files and cannot run this Flask API. For a free demo, deploy the frontend as a Render Static Site, the Flask API as a Render Web Service, and use Neon PostgreSQL for persistent database storage. The backend requirements include Gunicorn and PostgreSQL support for this setup.

1. Push the project to a GitHub repository. Confirm `.env`, virtual environments, `node_modules` and build output are not committed.
2. Create a PostgreSQL project in Neon and copy its connection string. Keep it private.
3. In Render, create a Web Service from the repository with **Root Directory** `backend`, **Build Command** `pip install -r requirements.txt`, **Start Command** `gunicorn app:app --bind 0.0.0.0:$PORT`, and the **Free** plan. Set `DATABASE_URL` to the Neon connection string, plus `SECRET_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `CORS_ORIGINS` in the service environment.
4. Create a Render Static Site from the same repository with **Root Directory** `frontend`, **Build Command** `npm ci && npm run build`, and **Publish Directory** `dist`. Set the build environment variable `VITE_API_URL` to the backend URL ending in `/api` (for example, `https://your-api.onrender.com/api`).
5. Copy the static site URL into the backend's `CORS_ORIGINS` value, then redeploy the backend. Use the static site URL to open the app and test enquiries.

Render's free web services sleep after 15 minutes without traffic and can take about a minute to wake. Keep the Neon connection string and admin credentials in provider environment settings, never in the repository. Free tiers are suitable for demos and learning; they do not provide production availability guarantees, so confirm current quotas and data-retention terms before collecting real customer leads. [Render free service limits](https://render.com/docs/free), [Neon Free plan](https://neon.com/docs/introduction/free-tier).

## 6. Sign in to the admin dashboard

- On the website press **Ctrl + Shift + A**, or click **Admin** in the footer.
- Use the username/password configured in `backend/.env`.
- Add a test enquiry through the public form, then view it under **Customer leads**.
- Change its status to test the CRUD/update flow.
- The **Panel prices** tab reads catalogue records from the database. Add verified panel records before using panel pricing and calculator features.

## 7. REST API overview

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | API health check | Public |
| GET | `/api/panels` | Active panel catalogue | Public |
| POST | `/api/leads` | Create customer enquiry | Public, validated + consent required |
| POST | `/api/chat` | FAQ chatbot response | Public |
| POST | `/api/admin/login` | Admin login | Public login endpoint |
| GET | `/api/admin/leads` | List customer leads | Admin token |
| PATCH | `/api/admin/leads/:id` | Update lead status | Admin token |
| GET | `/api/admin/panels` | List all panels | Admin token |
| PUT | `/api/admin/panels/:id` | Update panel price/status | Admin token |
| GET | `/api/admin/activity` | Recent admin activity | Admin token |

## 8. Calculation assumptions

- Installed capacity is selected as a 1 kW, 2 kW or 3 kW planning size in the calculator.
- Estimated annual energy (kWh/units) = installed capacity (kWp) × annual yield (kWh/kWp/year).
- Monthly average = annual energy ÷ 12; daily average = annual energy ÷ 365.
- The UI uses district-specific annual-yield assumptions from `frontend/src/App.jsx`; these values have not been independently verified against a sourced dataset. Treat them as provisional planning assumptions, not district-validated production forecasts.
- The calculator provides energy estimates only, not equipment pricing or a full system quotation. Inverter, mounting structure, wiring, installation, transport, approvals, taxes and other costs depend on the site and final design.
- District yield values are provisional planning assumptions. Final generation estimates require verified local data and a site assessment.

## 9. Government scheme links and accuracy

- PM Surya Ghar: `https://pmsuryaghar.gov.in/`
- Tamil Nadu Solar Homes portal: `https://www.tnebltd.gov.in/usrp/`
- MNRE rooftop solar programme: `https://mnre.gov.in/en/grid-connected-solar-rooftop-programme/`

The site deliberately avoids promising a subsidy. The Tamil Nadu portal has advertised a state top-up alongside the central programme, but amounts, eligibility, current Government Orders and release conditions must be re-verified on the official portal. The site is not an official government service.

## 10. Important security and production work still required

This project is designed as a 3-day interview-preparation MVP, not a production launch. Before public deployment:

- Replace the in-memory admin token store with a secure, persistent session strategy; add expiry, revocation and CSRF protections where applicable.
- Add login throttling/rate limiting, CAPTCHA or equivalent spam controls, request-size limits, logging/monitoring and backups.
- Use HTTPS, secure deployment secrets, a least-privilege database user and production WSGI server.
- Write a real privacy policy and retention/deletion process; collect only necessary customer data.
- Add migrations (for example Alembic/Flask-Migrate) rather than relying on `create_all()` for schema changes.
- Add verified, timestamped panel prices and yield values with sources before showing them as customer estimates.
- If adding an AI provider, call it only from Flask, keep keys server-side, restrict answers to verified information where appropriate, and provide a fallback when the provider is unavailable. No hosted AI API is configured in this starter.
- Add automated tests and test the application on the actual deployment environment.

## Interview explanation

"This is a full-stack solar lead-management application. React provides the customer website, generation calculator, panel guidance section, grounded AI chatbot and admin dashboard. The Flask REST API validates requests and applies access checks. SQLAlchemy persists panel catalogue entries, enquiries, administrators and activity logs in MySQL. Admins can update panel prices and track a lead through the sales pipeline. The chatbot retrieves reviewed local knowledge and current panel catalogue data before calling the configured AI provider; it keeps a deterministic FAQ fallback."
