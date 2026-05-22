import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, transaction } from './db.js';
import { computeWeightedGrade, round, validateScore } from './grades.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logo = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Uluslararas%C4%B1_K%C4%B1br%C4%B1s_%C3%9Cniversitesi_Resmi_Logo.png/500px-Uluslararas%C4%B1_K%C4%B1br%C4%B1s_%C3%9Cniversitesi_Resmi_Logo.png';

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(root, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ciu-project-secret',
  resave: false,
  saveUninitialized: false
}));

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const run = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function e(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fmt(value, suffix = '') {
  const number = Number(value);
  return `${Number.isFinite(number) ? round(number) : 0}${suffix}`;
}

function date(value) {
  if (!value) return '-';
  return new Date(value).toISOString().slice(0, 10);
}

function msg(req) {
  if (!req.query.msg) return '';
  return `<div class="alert alert-${req.query.type === 'err' ? 'danger' : 'success'}">${e(req.query.msg)}</div>`;
}

function go(res, url, text, type = 'ok') {
  res.redirect(`${url}${url.includes('?') ? '&' : '?'}msg=${encodeURIComponent(text)}&type=${type}`);
}

function dashboardFor(role) {
  if (role === 'instructor') return '/instructor/courses';
  if (role === 'student') return '/student/courses';
  return '/admin/users';
}

function nav(req) {
  if (!req.user) return '';
  const links = req.user.role === 'instructor'
    ? '<a class="nav-link" href="/instructor/courses">Courses</a>'
    : req.user.role === 'student'
      ? '<a class="nav-link" href="/student/courses">My Grades</a>'
      : '<a class="nav-link" href="/admin/users">Users</a><a class="nav-link" href="/admin/reports">Reports</a>';

  return `
    <nav class="navbar navbar-expand-lg ciu-navbar">
      <div class="container">
        <a class="navbar-brand" href="/dashboard"><span class="logo-box"><img class="brand-logo" src="${logo}" alt="CIU logo"></span>CIU Grade System</a>
        <div class="ms-auto d-flex align-items-center gap-3 nav-right">
          <div class="navbar-nav">${links}</div>
          <span class="user-pill">${e(req.user.full_name)}</span>
          <form method="post" action="/logout" class="m-0"><button class="btn btn-outline-secondary btn-sm">Logout</button></form>
        </div>
      </div>
    </nav>`;
}

function page(req, title, body, scripts = '') {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${e(title)} | CIU Grade System</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="/styles.css" rel="stylesheet">
    </head>
    <body>
      ${nav(req)}
      <main class="container py-4">${msg(req)}${body}</main>
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
      <script src="/app.js"></script>
      ${scripts}
    </body>
  </html>`;
}

function heading(title, sub = '') {
  return `<div class="page-header"><h1 class="h3 mb-1">${e(title)}</h1>${sub ? `<p class="text-muted mb-0">${e(sub)}</p>` : ''}</div>`;
}

function auth(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (roles.length && !roles.includes(req.user.role)) return go(res, dashboardFor(req.user.role), 'Access denied.', 'err');
    next();
  };
}

app.use(run(async (req, res, next) => {
  req.user = null;
  if (!req.session.userId) return next();

  const rows = await query(`
    SELECT u.id, u.role, u.full_name, u.email, s.id student_id, i.id instructor_id
    FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN instructors i ON i.user_id = u.id
    WHERE u.id = :id AND u.is_active = 1
  `, { id: req.session.userId });
  req.user = rows[0] || null;
  next();
}));

app.get('/', (req, res) => res.redirect(req.user ? '/dashboard' : '/login'));
app.get('/dashboard', auth(), (req, res) => {
  res.redirect(dashboardFor(req.user.role));
});

app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.send(`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Login | CIU Grade System</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="/styles.css" rel="stylesheet">
    </head>
    <body>
      <main class="min-vh-100 d-flex align-items-center justify-content-center p-3">
        <section class="card login-panel">
          <div class="card-body p-4">
            <div class="d-flex align-items-center mb-3">
              <img class="login-logo" src="${logo}" alt="CIU logo">
              <div><h1 class="h4 mb-0">CIU Grade System</h1><div class="text-muted text-small">Course grades</div></div>
            </div>
            ${msg(req)}
            <form method="post" action="/login">
              <label class="form-label" for="email">Email</label>
              <input class="form-control mb-3" id="email" name="email" type="text" required>
              <label class="form-label" for="password">Password</label>
              <input class="form-control mb-3" id="password" name="password" type="password" required>
              <button class="btn btn-primary w-100">Login</button>
            </form>
            <a class="btn btn-outline-light w-100 mt-3" href="/register">Register</a>
          </div>
        </section>
      </main>
    </body>
  </html>`);
});

app.post('/login', run(async (req, res) => {
  const rows = await query('SELECT * FROM users WHERE email = :email AND is_active = 1 LIMIT 1', {
    email: String(req.body.email || '').trim().toLowerCase()
  });
  const user = rows[0];
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password_hash))) {
    return go(res, '/login', 'Wrong email or password.', 'err');
  }
  req.session.userId = user.id;
  res.redirect('/dashboard');
}));

app.get('/register', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.send(`<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Register | CIU Grade System</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="/styles.css" rel="stylesheet">
    </head>
    <body>
      <main class="min-vh-100 d-flex align-items-center justify-content-center p-3">
        <section class="card login-panel">
          <div class="card-body p-4">
            <div class="d-flex align-items-center mb-3">
              <img class="login-logo" src="${logo}" alt="CIU logo">
              <div><h1 class="h4 mb-0">Register</h1><div class="text-muted text-small">Student account</div></div>
            </div>
            ${msg(req)}
            <form method="post" action="/register">
              <input class="form-control mb-2" name="full_name" placeholder="Full name" required>
              <input class="form-control mb-2" name="email" type="text" placeholder="name@student.ciu.edu.tr" required>
              <input class="form-control mb-2" name="student_number" placeholder="Student number" required>
              <input class="form-control mb-3" name="password" type="password" placeholder="Password" required>
              <button class="btn btn-primary w-100">Create account</button>
            </form>
            <a class="btn btn-outline-light w-100 mt-3" href="/login">Back to login</a>
          </div>
        </section>
      </main>
    </body>
  </html>`);
});

app.post('/register', run(async (req, res) => {
  const fullName = String(req.body.full_name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const studentNumber = String(req.body.student_number || '').trim();
  const password = String(req.body.password || '');

  if (!email.endsWith('@student.ciu.edu.tr')) return go(res, '/register', 'Use a student.ciu.edu.tr email.', 'err');
  if (password.length < 4) return go(res, '/register', 'Password is too short.', 'err');

  try {
    await transaction(async (db) => {
      const hash = await bcrypt.hash(password, 10);
      const [user] = await db.execute(
        'INSERT INTO users (role, full_name, email, password_hash) VALUES ("student", ?, ?, ?)',
        [fullName, email, hash]
      );
      await db.execute(
        'INSERT INTO students (user_id, student_number, department, year_level) VALUES (?, ?, "Computer Engineering", 1)',
        [user.insertId, studentNumber]
      );
    });
  } catch (error) {
    return go(res, '/register', 'Email or student number already exists.', 'err');
  }

  go(res, '/login', 'Account created. You can login now.');
}));

app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

async function instructorCourse(req, id) {
  const rows = await query(`
    SELECT c.*
    FROM courses c
    JOIN instructors i ON i.id = c.instructor_id
    WHERE c.id = :id AND i.user_id = :userId
  `, { id, userId: req.user.id });
  return rows[0];
}

async function gradebook(courseId) {
  const assessments = await query('SELECT * FROM assessments WHERE course_id = :courseId ORDER BY due_date IS NULL, due_date, id', { courseId });
  const enrollments = await query(`
    SELECT e.*, u.full_name, u.email, s.student_number
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN users u ON u.id = s.user_id
    WHERE e.course_id = :courseId
    ORDER BY u.full_name
  `, { courseId });
  const grades = await query(`
    SELECT g.*
    FROM grades g
    JOIN assessments a ON a.id = g.assessment_id
    WHERE a.course_id = :courseId
  `, { courseId });

  const map = new Map(grades.map((g) => [`${g.enrollment_id}:${g.assessment_id}`, g]));
  const students = enrollments.map((enrollment) => {
    const items = assessments.map((a) => ({ ...a, score: map.get(`${enrollment.id}:${a.id}`)?.score ?? null }));
    return { ...enrollment, items, summary: computeWeightedGrade(items) };
  });
  const averages = assessments.map((a) => {
    const scores = students
      .map((s) => map.get(`${s.id}:${a.id}`)?.score)
      .filter((score) => score !== undefined)
      .map((score) => (Number(score) / Number(a.max_score)) * 100);
    return scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  });

  return { assessments, students, map, averages };
}

app.get('/instructor/courses', auth('instructor'), run(async (req, res) => {
  const courses = await query(`
    SELECT c.*, COUNT(e.id) student_count
    FROM courses c
    JOIN instructors i ON i.id = c.instructor_id
    LEFT JOIN enrollments e ON e.course_id = c.id
    WHERE i.user_id = :userId
    GROUP BY c.id
    ORDER BY c.code
  `, { userId: req.user.id });

  const list = courses.map((c) => `
    <tr>
      <td><b>${e(c.code)}</b><br><span class="text-muted">${e(c.title)}</span></td>
      <td>${e(c.term)}</td>
      <td>${c.student_count}</td>
      <td><a class="btn btn-sm btn-outline-primary" href="/instructor/courses/${c.id}">Open</a></td>
    </tr>`).join('');

  res.send(page(req, 'Courses', `
    ${heading('Courses', 'Simple course and grade page.')}
    <div class="row g-4">
      <div class="col-lg-4">
        <div class="card"><div class="card-body">
          <h2 class="h5">New Course</h2>
          <form method="post" action="/instructor/courses">
            <input class="form-control mb-2" name="code" placeholder="CMPE314" required>
            <input class="form-control mb-2" name="title" placeholder="Software Engineering" required>
            <input class="form-control mb-2" name="term" placeholder="Spring 2026" required>
            <button class="btn btn-primary">Add</button>
          </form>
        </div></div>
      </div>
      <div class="col-lg-8">
        <div class="card"><div class="card-body">
          <table class="table align-middle mb-0">
            <thead><tr><th>Course</th><th>Term</th><th>Students</th><th></th></tr></thead>
            <tbody>${list || '<tr><td colspan="4" class="text-muted">No course.</td></tr>'}</tbody>
          </table>
        </div></div>
      </div>
    </div>`));
}));

app.post('/instructor/courses', auth('instructor'), run(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const title = String(req.body.title || '').trim();
  const term = String(req.body.term || '').trim();
  if (!code || !title || !term) return go(res, '/instructor/courses', 'Fill all course fields.', 'err');

  await query(`
    INSERT INTO courses (instructor_id, code, title, term, credits, description)
    VALUES (:instructorId, :code, :title, :term, 3, '')
  `, {
    instructorId: req.user.instructor_id,
    code,
    title,
    term
  });
  go(res, '/instructor/courses', 'Course added.');
}));

app.get('/instructor/courses/:id', auth('instructor'), run(async (req, res) => {
  const course = await instructorCourse(req, req.params.id);
  if (!course) return res.status(404).send(page(req, 'Not found', '<div class="alert alert-warning">Course not found.</div>'));

  const book = await gradebook(course.id);
  const heads = book.assessments.map((a) => `<th>${e(a.title)}<br><span class="text-muted fw-normal">${fmt(a.weight, '%')}</span></th>`).join('');
  const rows = book.students.map((s) => `
    <tr>
      <td><b>${e(s.full_name)}</b><br><span class="text-muted">${e(s.student_number)}</span></td>
      ${book.assessments.map((a) => `<td><input class="form-control form-control-sm grade-input" name="score_${s.id}_${a.id}" type="number" min="0" max="${a.max_score}" step="0.01" value="${e(book.map.get(`${s.id}:${a.id}`)?.score ?? '')}"></td>`).join('')}
      <td>${fmt(s.summary.currentAverage, '%')}<br><span class="text-muted">${e(s.summary.letterGrade)}</span></td>
      <td><input class="form-control form-control-sm" name="feedback_${s.id}" value="${e(s.instructor_feedback || '')}"></td>
    </tr>`).join('');

  const assessmentRows = book.assessments.map((a) => `
    <tr><td>${e(a.title)}</td><td>${e(a.category)}</td><td>${fmt(a.weight, '%')}</td><td>${date(a.due_date)}</td></tr>`).join('');

  res.send(page(req, course.code, `
    ${heading(`${course.code} - ${course.title}`, course.term)}
    <div class="row g-4 mb-4">
      <div class="col-lg-4">
        <div class="card action-card action-blue mb-3">
          <div class="card-body">
          <div class="card-title-row"><span>Student</span><h2 class="h5 mb-0">Add Student</h2></div>
          <form method="post" action="/instructor/courses/${course.id}/students">
            <input class="form-control mb-2" name="full_name" placeholder="Student name" required>
            <input class="form-control mb-2" name="email" type="email" placeholder="name@student.ciu.edu.tr" required>
            <input class="form-control mb-2" name="student_number" placeholder="Student number" required>
            <button class="btn btn-primary w-100">Add student</button>
          </form>
        </div></div>
        <div class="card action-card action-red">
          <div class="card-body">
          <div class="card-title-row"><span>Course Work</span><h2 class="h5 mb-0">Add Assessment</h2></div>
          <form method="post" action="/instructor/courses/${course.id}/assessments">
            <input class="form-control mb-2" name="title" placeholder="Assignment 1" required>
            <select class="form-select mb-2" name="category">
              <option value="assignment">Assignment</option><option value="quiz">Quiz</option>
              <option value="midterm">Midterm</option><option value="final">Final</option>
              <option value="project">Project</option>
            </select>
            <input class="form-control mb-2" name="weight" type="number" step="0.01" placeholder="Weight" required>
            <input class="form-control mb-2" name="due_date" type="date">
            <button class="btn btn-primary w-100">Add assessment</button>
          </form>
        </div></div>
      </div>
      <div class="col-lg-8">
        <div class="card data-card chart-card mb-3">
          <div class="card-body">
          <div class="section-head">
            <div><span>Overview</span><h2 class="h5 mb-0">Class Chart</h2></div>
          </div>
          <div class="chart-box"><canvas id="classChart"></canvas></div>
        </div></div>
        <div class="card data-card">
          <div class="card-body">
          <div class="section-head">
            <div><span>Course Work</span><h2 class="h5 mb-0">Assessments</h2></div>
          </div>
          <table class="table clean-table mb-0"><thead><tr><th>Name</th><th>Type</th><th>Weight</th><th>Date</th></tr></thead><tbody>${assessmentRows || '<tr><td colspan="4" class="text-muted">No assessment.</td></tr>'}</tbody></table>
        </div></div>
      </div>
    </div>
    <div class="card grade-card">
      <div class="card-body">
      <div class="section-head">
        <div><span>Gradebook</span><h2 class="h5 mb-0">Grades</h2></div>
        <button class="btn btn-success" form="gradeForm">Save</button>
      </div>
      <form id="gradeForm" method="post" action="/instructor/courses/${course.id}/grades">
        <div class="table-responsive">
          <table class="table grade-table align-middle">
            <thead><tr><th>Student</th>${heads}<th>Average</th><th>Feedback</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="${book.assessments.length + 3}" class="text-muted">No student.</td></tr>`}</tbody>
          </table>
        </div>
      </form>
    </div></div>`,
    `<script>SGM.chart('classChart', ${JSON.stringify(book.assessments.map((a) => a.title))}, ${JSON.stringify(book.averages)}, 'Average (%)', '#183b73');</script>`
  ));
}));

app.post('/instructor/courses/:id/students', auth('instructor'), run(async (req, res) => {
  const course = await instructorCourse(req, req.params.id);
  if (!course) return res.status(404).send('Course not found');

  const name = String(req.body.full_name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const no = String(req.body.student_number || '').trim();
  const hash = await bcrypt.hash('password', 10);
  if (!name || !email || !no) return go(res, `/instructor/courses/${course.id}`, 'Fill all student fields.', 'err');
  if (!email.endsWith('@student.ciu.edu.tr')) return go(res, `/instructor/courses/${course.id}`, 'Use a student.ciu.edu.tr email.', 'err');

  await transaction(async (db) => {
    const [found] = await db.execute(`
      SELECT s.id FROM students s JOIN users u ON u.id = s.user_id
      WHERE s.student_number = ? OR u.email = ?
    `, [no, email]);

    let studentId = found[0]?.id;
    if (!studentId) {
      const [user] = await db.execute('INSERT INTO users (role, full_name, email, password_hash) VALUES ("student", ?, ?, ?)', [name, email, hash]);
      const [student] = await db.execute('INSERT INTO students (user_id, student_number, department, year_level) VALUES (?, ?, "Computer Engineering", 1)', [user.insertId, no]);
      studentId = student.insertId;
    }
    await db.execute('INSERT INTO enrollments (course_id, student_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE status = "active"', [course.id, studentId]);
  });

  go(res, `/instructor/courses/${course.id}`, 'Student added.');
}));

app.post('/instructor/courses/:id/assessments', auth('instructor'), run(async (req, res) => {
  const course = await instructorCourse(req, req.params.id);
  if (!course) return res.status(404).send('Course not found');
  const title = String(req.body.title || '').trim();
  const weight = Number(req.body.weight || 0);
  if (!title || !Number.isFinite(weight) || weight <= 0) return go(res, `/instructor/courses/${course.id}`, 'Enter a valid assessment and weight.', 'err');

  await query(`
    INSERT INTO assessments (course_id, title, category, max_score, weight, due_date)
    VALUES (:courseId, :title, :category, 100, :weight, :dueDate)
  `, {
    courseId: course.id,
    title,
    category: req.body.category || 'assignment',
    weight,
    dueDate: req.body.due_date || null
  });
  go(res, `/instructor/courses/${course.id}`, 'Assessment added.');
}));

app.post('/instructor/courses/:id/grades', auth('instructor'), run(async (req, res) => {
  const course = await instructorCourse(req, req.params.id);
  if (!course) return res.status(404).send('Course not found');
  const book = await gradebook(course.id);

  for (const student of book.students) {
    for (const a of book.assessments) {
      const checked = validateScore(req.body[`score_${student.id}_${a.id}`], a.max_score);
      if (!checked.ok) return go(res, `/instructor/courses/${course.id}`, checked.message, 'err');
    }
  }

  await transaction(async (db) => {
    for (const student of book.students) {
      await db.execute('UPDATE enrollments SET instructor_feedback = ? WHERE id = ?', [req.body[`feedback_${student.id}`] || '', student.id]);
      for (const a of book.assessments) {
        const checked = validateScore(req.body[`score_${student.id}_${a.id}`], a.max_score);
        if (checked.empty) {
          await db.execute('DELETE FROM grades WHERE enrollment_id = ? AND assessment_id = ?', [student.id, a.id]);
        } else {
          await db.execute(`
            INSERT INTO grades (enrollment_id, assessment_id, score)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE score = VALUES(score)
          `, [student.id, a.id, checked.score]);
        }
      }
    }
  });

  go(res, `/instructor/courses/${course.id}`, 'Saved.');
}));

async function studentCourses(studentId) {
  const courses = await query(`
    SELECT e.id enrollment_id, e.status, e.instructor_feedback, c.id course_id, c.code, c.title, c.term, u.full_name instructor
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    JOIN instructors i ON i.id = c.instructor_id
    JOIN users u ON u.id = i.user_id
    WHERE e.student_id = :studentId
    ORDER BY c.term DESC
  `, { studentId });

  for (const course of courses) {
    course.items = await query(`
      SELECT a.*, g.score
      FROM assessments a
      LEFT JOIN grades g ON g.assessment_id = a.id AND g.enrollment_id = :enrollmentId
      WHERE a.course_id = :courseId
      ORDER BY a.due_date IS NULL, a.due_date, a.id
    `, { enrollmentId: course.enrollment_id, courseId: course.course_id });
    course.summary = computeWeightedGrade(course.items);
  }
  return courses;
}

app.get('/student/courses', auth('student'), run(async (req, res) => {
  const courses = await studentCourses(req.user.student_id);
  const rows = courses.map((c) => `
    <tr>
      <td><b>${e(c.code)}</b><br><span class="text-muted">${e(c.title)} · ${e(c.term)}</span></td>
      <td><span class="badge text-bg-${c.status === 'active' ? 'success' : 'secondary'}">${e(c.status)}</span></td>
      <td>${fmt(c.summary.currentAverage, '%')}</td>
      <td>${e(c.summary.letterGrade)}</td>
      <td><a class="btn btn-sm btn-outline-primary" href="/student/courses/${c.course_id}">View</a></td>
    </tr>`).join('');
  res.send(page(req, 'My Grades', `
    ${heading('My Grades', 'Course results and feedback.')}
    <div class="card"><div class="card-body">
      <table class="table align-middle mb-0">
        <thead><tr><th>Course History</th><th>Status</th><th>Average</th><th>Letter</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="text-muted">No course.</td></tr>'}</tbody>
      </table>
    </div></div>`));
}));

app.get('/student/courses/:id', auth('student'), run(async (req, res) => {
  const courses = await studentCourses(req.user.student_id);
  const course = courses.find((c) => String(c.course_id) === String(req.params.id));
  if (!course) return res.status(404).send(page(req, 'Not found', '<div class="alert alert-warning">Course not found.</div>'));

  const rows = course.items.map((a) => {
    const percent = a.score === null || a.score === undefined ? '-' : fmt((Number(a.score) / Number(a.max_score)) * 100, '%');
    return `<tr><td>${e(a.title)}</td><td>${e(a.category)}</td><td>${a.score ?? '-'}</td><td>${percent}</td><td>${fmt(a.weight, '%')}</td></tr>`;
  }).join('');

  res.send(page(req, course.code, `
    ${heading(`${course.code} - ${course.title}`, course.term)}
    <div class="row g-4">
      <div class="col-lg-8">
        <div class="card chart-card mb-3"><div class="card-body">
          <h2 class="h5">Chart</h2>
          <div class="chart-box"><canvas id="studentChart"></canvas></div>
        </div></div>
        <div class="card"><div class="card-body">
          <table class="table mb-0"><thead><tr><th>Name</th><th>Type</th><th>Score</th><th>%</th><th>Weight</th></tr></thead><tbody>${rows}</tbody></table>
        </div></div>
      </div>
      <div class="col-lg-4">
        <div class="card"><div class="card-body">
          <h2 class="h5">Result</h2>
          <p class="mb-1">Average: <b>${fmt(course.summary.currentAverage, '%')}</b></p>
          <p class="mb-1">Letter: <b>${e(course.summary.letterGrade)}</b></p>
          <p class="mb-0 text-muted">${e(course.instructor_feedback || 'No feedback yet.')}</p>
        </div></div>
      </div>
    </div>`,
    `<script>SGM.chart('studentChart', ${JSON.stringify(course.items.map((a) => a.title))}, ${JSON.stringify(course.items.map((a) => a.score == null ? 0 : round((Number(a.score) / Number(a.max_score)) * 100)))}, 'Score (%)', '#183b73');</script>`
  ));
}));

app.get('/admin/users', auth('admin'), run(async (req, res) => {
  const users = await query('SELECT id, full_name, email, role, is_active FROM users ORDER BY role, full_name');
  const tableFor = (title, role) => {
    const rows = users
      .filter((u) => u.role === role)
      .map((u) => {
        const formId = `user_${u.id}`;
        const deleteButton = u.id === req.user.id
          ? '<button class="btn btn-sm btn-outline-secondary" disabled>Delete</button>'
          : `<form method="post" action="/admin/users/${u.id}/delete" class="d-inline"><button class="btn btn-sm btn-outline-danger">Delete</button></form>`;
        return `<tr>
          <td><input class="form-control form-control-sm" form="${formId}" name="full_name" value="${e(u.full_name)}" required></td>
          <td><input class="form-control form-control-sm" form="${formId}" name="email" value="${e(u.email)}" required></td>
          <td>
            <select class="form-select form-select-sm" form="${formId}" name="is_active">
              <option value="1"${u.is_active ? ' selected' : ''}>Active</option>
              <option value="0"${u.is_active ? '' : ' selected'}>Passive</option>
            </select>
          </td>
          <td>
            <form id="${formId}" method="post" action="/admin/users/${u.id}/update" class="d-inline"><button class="btn btn-sm btn-success">Save</button></form>
            ${deleteButton}
          </td>
        </tr>`;
      })
      .join('');
    return `<div class="card data-card mb-3"><div class="card-body">
      <div class="section-head"><div><span>${e(role)}</span><h2 class="h5 mb-0">${e(title)}</h2></div><b>${users.filter((u) => u.role === role).length}</b></div>
      <table class="table clean-table mb-0"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="text-muted">No user.</td></tr>'}</tbody></table>
    </div></div>`;
  };
  res.send(page(req, 'Users', `
    ${heading('Users', 'CIU accounts.')}
    <div class="row g-4">
      <div class="col-lg-4">
        <div class="card action-card"><div class="card-body">
          <div class="card-title-row"><span>Admin</span><h2 class="h5 mb-0">Add User</h2></div>
          <form method="post" action="/admin/users">
            <input class="form-control mb-2" name="full_name" placeholder="Name" required>
            <input class="form-control mb-2" name="email" type="text" placeholder="name@ciu.edu.tr" required>
            <select class="form-select mb-2" name="role"><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select>
            <input class="form-control mb-2" name="number" placeholder="Student/employee no">
            <button class="btn btn-primary w-100">Add</button>
          </form>
        </div></div>
      </div>
      <div class="col-lg-8">
        ${tableFor('Instructors', 'instructor')}
        ${tableFor('Students', 'student')}
        ${tableFor('Admins', 'admin')}
      </div>
    </div>`));
}));

app.get('/admin/reports', auth('admin'), run(async (req, res) => {
  const stats = await query(`
    SELECT
      (SELECT COUNT(*) FROM courses) courses,
      (SELECT COUNT(*) FROM students) students,
      (SELECT COUNT(*) FROM instructors) instructors,
      (SELECT COUNT(*) FROM assessments) assessments
  `);

  const courseRows = await query(`
    SELECT
      c.id,
      c.code,
      c.title,
      c.term,
      u.full_name instructor,
      COUNT(DISTINCT e.student_id) student_count,
      COUNT(DISTINCT a.id) assessment_count,
      ROUND(AVG(CASE WHEN g.score IS NULL THEN NULL ELSE (g.score / a.max_score) * 100 END), 2) average_score
    FROM courses c
    JOIN instructors i ON i.id = c.instructor_id
    JOIN users u ON u.id = i.user_id
    LEFT JOIN enrollments e ON e.course_id = c.id
    LEFT JOIN assessments a ON a.course_id = c.id
    LEFT JOIN grades g ON g.assessment_id = a.id AND g.enrollment_id = e.id
    GROUP BY c.id
    ORDER BY c.code
  `);

  const rows = courseRows.map((c) => `
    <tr>
      <td><b>${e(c.code)}</b><br><span class="text-muted">${e(c.title)} · ${e(c.term)}</span></td>
      <td>${e(c.instructor)}</td>
      <td>${c.student_count}</td>
      <td>${c.assessment_count}</td>
      <td>${c.average_score === null ? '-' : fmt(c.average_score, '%')}</td>
    </tr>`).join('');

  res.send(page(req, 'Reports', `
    ${heading('Academic Reports', 'University administration overview.')}
    <div class="row g-4 mb-4">
      <div class="col-md-3"><div class="card metric"><div class="card-body"><span class="text-muted">Courses</span><h2>${stats[0].courses}</h2></div></div></div>
      <div class="col-md-3"><div class="card metric success"><div class="card-body"><span class="text-muted">Students</span><h2>${stats[0].students}</h2></div></div></div>
      <div class="col-md-3"><div class="card metric"><div class="card-body"><span class="text-muted">Instructors</span><h2>${stats[0].instructors}</h2></div></div></div>
      <div class="col-md-3"><div class="card metric warning"><div class="card-body"><span class="text-muted">Assessments</span><h2>${stats[0].assessments}</h2></div></div></div>
    </div>
    <div class="row g-4">
      <div class="col-lg-8">
        <div class="card data-card">
          <div class="card-body">
            <div class="section-head"><div><span>Courses</span><h2 class="h5 mb-0">Course Performance</h2></div></div>
            <table class="table clean-table mb-0">
              <thead><tr><th>Course</th><th>Instructor</th><th>Students</th><th>Assessments</th><th>Average</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="5" class="text-muted">No report data.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card chart-card">
          <div class="card-body">
            <div class="section-head"><div><span>Chart</span><h2 class="h5 mb-0">Course Averages</h2></div></div>
            <div class="chart-box"><canvas id="reportChart"></canvas></div>
          </div>
        </div>
      </div>
    </div>`,
    `<script>SGM.chart('reportChart', ${JSON.stringify(courseRows.map((c) => c.code))}, ${JSON.stringify(courseRows.map((c) => c.average_score || 0))}, 'Average (%)', '#183b73');</script>`
  ));
}));

app.post('/admin/users', auth('admin'), run(async (req, res) => {
  const role = ['student', 'instructor', 'admin'].includes(req.body.role) ? req.body.role : 'student';
  const hash = await bcrypt.hash('password', 10);
  const email = String(req.body.email || '').trim().toLowerCase();
  const number = String(req.body.number || `${role}-${Date.now()}`).trim();

  await transaction(async (db) => {
    const [user] = await db.execute('INSERT INTO users (role, full_name, email, password_hash) VALUES (?, ?, ?, ?)', [
      role,
      String(req.body.full_name || '').trim(),
      email,
      hash
    ]);
    if (role === 'student') await db.execute('INSERT INTO students (user_id, student_number, department, year_level) VALUES (?, ?, "Computer Engineering", 1)', [user.insertId, number]);
    if (role === 'instructor') await db.execute('INSERT INTO instructors (user_id, employee_number, department) VALUES (?, ?, "Computer Engineering")', [user.insertId, number]);
  });

  go(res, '/admin/users', 'User added.');
}));

app.post('/admin/users/:id/update', auth('admin'), run(async (req, res) => {
  const fullName = String(req.body.full_name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const isActive = req.body.is_active === '0' ? 0 : 1;

  if (!fullName || !email) return go(res, '/admin/users', 'Name and email are required.', 'err');
  await query('UPDATE users SET full_name = :fullName, email = :email, is_active = :isActive WHERE id = :id', {
    fullName,
    email,
    isActive,
    id: req.params.id
  });
  go(res, '/admin/users', 'User updated.');
}));

app.post('/admin/users/:id/delete', auth('admin'), run(async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) return go(res, '/admin/users', 'You cannot delete your own account.', 'err');
  await query('DELETE FROM users WHERE id = :id', { id: req.params.id });
  go(res, '/admin/users', 'User deleted.');
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send(page(req, 'Error', `<div class="alert alert-danger">${e(error.message)}</div>`));
});

const server = app.listen(port, () => console.log(`CIU Grade System running at http://localhost:${port}`));

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`);
    console.error('If the app is already running, open http://localhost:3000 in the browser.');
    console.error('To stop the old server, run: npm run stop');
    process.exit(1);
  }

  throw error;
});
