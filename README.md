# College Event Management System

This project is a simple college event management app for students and admins.
Students can sign in with Google, check events, and save the events they are
interested in. Admins can add events, update details, see student interest, and
mark attendance after an event.

The backend is built with Flask and SQLAlchemy. The frontend is built with
React, TypeScript, Vite, and Tailwind CSS. SQLite is used by default, so the
project can run locally without setting up a separate database.

## Features

- Google login for students and admins
- Separate student and admin screens
- Event list with upcoming, ongoing, and past events
- Student interest tracking
- Admin event create, edit, and delete options
- Attendance marking for interested students
- Optional email notification when a new event is added

## Tech Stack

- Python, Flask, SQLAlchemy
- SQLite for local development
- Google OAuth ID token verification
- JWT based API authentication
- React, TypeScript, Vite
- Tailwind CSS

## Project Structure

```text
.
├── app.py                 # Flask API routes and auth logic
├── db.py                  # Database connection and session setup
├── models.py              # SQLAlchemy models
├── requirements.txt       # Backend dependencies
├── .env.example           # Sample backend environment variables
└── frontend/              # React frontend
    ├── src/
    ├── public/
    └── package.json
```

## Setup

Clone the project and open the root folder.

```bash
git clone https://github.com/saifmodan2006/College-Event-Management.git
cd College-Event-Management
```

Create and activate a Python virtual environment.

```bash
python -m venv .venv
.venv\Scripts\activate
```

Install the backend packages.

```bash
pip install -r requirements.txt
```

Create a `.env` file in the root folder. You can copy `.env.example` and fill
in your own values.

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
ADMIN_EMAIL=admin@example.com
JWT_SECRET=change-this-secret
DATABASE_URL=sqlite:///./app.db
SENDER_EMAIL=your-email@gmail.com
APP_PASSWORD=your-gmail-app-password
```

`SENDER_EMAIL` and `APP_PASSWORD` are only needed if you want the email
notification feature. For Gmail, use an App Password instead of your normal
account password.

Start the backend.

```bash
python app.py
```

The Flask API runs on `http://127.0.0.1:5000` by default.

## Frontend Setup

Open another terminal and install the frontend packages.

```bash
cd frontend
npm install
```

Create `frontend/.env`.

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_API_BASE_URL=http://127.0.0.1:5000
```

Start the frontend.

```bash
npm run dev
```

Open `http://localhost:5173` in the browser.

## Google Login Notes

The same Google OAuth client id must be used in both places:

- Root `.env`: `GOOGLE_CLIENT_ID`
- `frontend/.env`: `VITE_GOOGLE_CLIENT_ID`

In Google Cloud Console, open your OAuth 2.0 Web Client and add these origins
under **Authorized JavaScript origins**:

```text
http://localhost:5173
http://127.0.0.1:5173
```

If Google shows an `origin_mismatch` error, it usually means the current browser
origin is missing from that list.

## Main API Routes

- `GET /health`
- `POST /api/auth/google`
- `GET /api/user/profile`
- `GET /api/events`
- `GET /api/events/my-interests`
- `POST /api/events/<event_id>/interest`
- `GET /api/admin/dashboard`
- `GET /api/admin/events`
- `POST /api/admin/events`
- `PUT /api/admin/events/<event_id>`
- `DELETE /api/admin/events/<event_id>`
- `GET /api/admin/interests`
- `GET /api/admin/events/<event_id>/attendance`
- `POST /api/admin/events/<event_id>/attendance/<user_id>`
- `DELETE /api/admin/events/<event_id>/attendance/<user_id>`

## Useful Commands

Backend:

```bash
python app.py
```

Frontend development:

```bash
cd frontend
npm run dev
```

Frontend build:

```bash
cd frontend
npm run build
```

Frontend lint:

```bash
cd frontend
npm run lint
```

## Important

Do not commit `.env`, `.venv`, `app.db`, `node_modules`, or frontend build
output. They are local files and are already covered by `.gitignore`.
