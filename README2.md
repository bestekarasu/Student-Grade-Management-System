This sequence diagram represents the operations of a Student Grade Management System involving three main actors: Instructor, Student, and Admin.

**Normal Flow:**
The process begins when the instructor logs into the system. After successful authentication, the instructor enters student grades, 
which are stored in the database. The system then calculates final grades using the grade calculator and updates the database. In parallel, 
the admin logs into the system and manages users by adding or updating user information, which is also stored in the database. 
Finally, the student logs into the system, requests their grades, and the system retrieves and displays the grade information from the database.

**Alternative Flows:**
If the instructor provides invalid login credentials, the system displays an error message and denies access. 
Similarly, any user (instructor, student, or admin) attempting to log in with incorrect credentials will not be granted access to the system. 
The main flow continues only after successful authentication.
