# CIU Grade System

Simple CMPE314 grade management project. It uses Node.js, Express, MySQL, Bootstrap and Chart.js.

## Setup

```bash
npm install
cp .env.example .env
npm run db:setup
npm start
```

Open `http://localhost:3000`.

Stop the server when you are done:

```bash
npm run stop
```

## Demo Logins

Password for all demo users: `password`

- Instructor: `felix@ciu.edu.tr`
- Students: `beste@student.ciu.edu.tr`, `ahmet@student.ciu.edu.tr`, `nenette@student.ciu.edu.tr`, `onur@student.ciu.edu.tr`
- Admin: `admin@ciu.edu.tr`

## Main Pages

- Login page has a student register button.
- Instructor can see courses, add students, add assessments and enter grades.
- Student can see course history, grades, chart and feedback.
- Admin can see users grouped as instructors, students and admins, and create simple accounts.
- Admin reports show course performance for university administration.
