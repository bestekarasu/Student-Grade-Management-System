SET @demo_hash = '$2a$10$jiBA99jHkW4lrXfBaIxtbeE5w8mgb34jbxYBvt02qcEybWbMPTpSy';

DELETE FROM users
WHERE email IN (
  'admin@university.edu',
  'felix@university.edu',
  'beste@university.edu',
  'ahmet@university.edu',
  'nenette@university.edu',
  'onur@university.edu',
  'admin@ciu.edu.tr',
  'felix@ciu.edu.tr',
  'beste@student.ciu.edu.tr',
  'ahmet@student.ciu.edu.tr',
  'nenette@student.ciu.edu.tr',
  'onur@student.ciu.edu.tr'
);

INSERT INTO users (role, full_name, email, password_hash, is_active)
VALUES
  ('admin', 'CIU Admin', 'admin@ciu.edu.tr', @demo_hash, 1),
  ('instructor', 'Asst. Prof. Dr. Felix Babalola', 'felix@ciu.edu.tr', @demo_hash, 1),
  ('student', 'Beste Karasu', 'beste@student.ciu.edu.tr', @demo_hash, 1),
  ('student', 'Ahmet Turk', 'ahmet@student.ciu.edu.tr', @demo_hash, 1),
  ('student', 'Nenette Kanahu Karumb', 'nenette@student.ciu.edu.tr', @demo_hash, 1),
  ('student', 'Onur Furkan Nar', 'onur@student.ciu.edu.tr', @demo_hash, 1);

INSERT INTO instructors (user_id, employee_number, department)
VALUES ((SELECT id FROM users WHERE email = 'felix@ciu.edu.tr'), 'CIU-314', 'Computer Engineering');

INSERT INTO students (user_id, student_number, department, year_level)
VALUES
  ((SELECT id FROM users WHERE email = 'beste@student.ciu.edu.tr'), '22211498', 'Computer Engineering', 3),
  ((SELECT id FROM users WHERE email = 'ahmet@student.ciu.edu.tr'), '20166543', 'Computer Engineering', 4),
  ((SELECT id FROM users WHERE email = 'nenette@student.ciu.edu.tr'), '22121068', 'Computer Engineering', 3),
  ((SELECT id FROM users WHERE email = 'onur@student.ciu.edu.tr'), '22319232', 'Computer Engineering', 2);

SET @instructor_id = (SELECT id FROM instructors WHERE employee_number = 'CIU-314');

INSERT INTO courses (instructor_id, code, title, term, credits, description)
VALUES (@instructor_id, 'CMPE314', 'Software Engineering', 'Spring 2026', 3, 'Student grade management project.');

SET @course_id = (SELECT id FROM courses WHERE code = 'CMPE314' AND term = 'Spring 2026');

INSERT INTO assessments (course_id, title, category, max_score, weight, due_date)
VALUES
  (@course_id, 'Assignment 1', 'assignment', 100, 20, '2026-03-28'),
  (@course_id, 'Quiz 1', 'quiz', 100, 15, '2026-04-10'),
  (@course_id, 'Midterm', 'midterm', 100, 30, '2026-04-25'),
  (@course_id, 'Final', 'final', 100, 35, '2026-05-30');

INSERT INTO enrollments (course_id, student_id, status, instructor_feedback)
SELECT @course_id, s.id, 'active', 'Good work, keep following the course.'
FROM students s;

INSERT INTO grades (enrollment_id, assessment_id, score, comment)
SELECT e.id, a.id,
  CASE
    WHEN s.student_number = '20166543' AND a.title = 'Assignment 1' THEN 92
    WHEN s.student_number = '20166543' AND a.title = 'Quiz 1' THEN 85
    WHEN s.student_number = '22211498' AND a.title = 'Assignment 1' THEN 88
    WHEN s.student_number = '22211498' AND a.title = 'Quiz 1' THEN 90
    ELSE 78
  END,
  'Demo grade'
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN assessments a ON a.course_id = e.course_id
WHERE e.course_id = @course_id AND a.title IN ('Assignment 1', 'Quiz 1');
