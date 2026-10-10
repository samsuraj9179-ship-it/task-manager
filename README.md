# ✨ Sleek Glassmorphism Task Manager

A full-stack, modern Task Manager with custom dark glassmorphism styling, exact reminder alarms, live countdowns, priority sorting, habit recurrence, and interactive checklist subtasks.

---

## 🚀 Features

- **Glassmorphism UI**: High-polish dark theme with glowing neon accents and responsive mobile layout.
- **Exact Reminder Alarms**: Web Audio synthesizers (Bell, Digital Beep, Marimba, Siren) + OS notifications.
- **Continuous 1-Min Ringing**: Alarms loop for 60 seconds until you mark the task complete, snooze (5 min), or stop it.
- **12-Hour Custom Date & Time Picker**: Glass dropdowns and inputs for exact scheduling.
- **Live Countdown Timer**: Real-time tick displaying days, hours, minutes, and seconds until completion.
- **Priority & Categorization**: Color-coded priorities (🔴 Urgent, 🟡 Medium, 🟢 Low) and context tags (Work, Personal, Study, Shopping, Health).
- **Subtasks & Checklist**: Break tasks into actionable bullet checkboxes.
- **Recurring Habits**: Automatically reschedule daily, weekly, or weekday tasks when marked done.
- **In-Place Editing**: Quick modal to edit tasks without recreating them.
- **Productivity Progress Bar**: Live completion percentages and status counts.
- **Search & Filter Pills**: Instant real-time search matching titles and descriptions.
- **Backup & Portability**: Export and import your entire task list as JSON.

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite, Pydantic v2, Uvicorn
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 Glassmorphism, Web Audio API

---

## 📦 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/your-username/your-repo-name.git
cd "your-repo-name"
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the backend server
```bash
uvicorn backend.main:app --reload
```
The API will run at `http://127.0.0.1:8000`.

### 4. Open the application
Open `frontend/index.html` in any modern web browser.
