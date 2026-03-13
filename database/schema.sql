DROP DATABASE IF EXISTS library_attendance;
CREATE DATABASE library_attendance;
USE library_attendance;

CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    address TEXT,
    email VARCHAR(100),
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    course VARCHAR(50) NOT NULL,
    year_level INT NOT NULL,
    section VARCHAR(20),
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    purpose VARCHAR(200) NOT NULL,
    check_in DATETIME DEFAULT CURRENT_TIMESTAMP,
    check_out DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Clear existing data
TRUNCATE TABLE attendance_logs;
DELETE FROM students;

-- Insert fresh sample data without program field
INSERT INTO students (
    student_id, first_name, last_name, middle_name, 
    address, email, gender, course, 
    year_level, section
) VALUES 
('2023001', 'John', 'Doe', 'Smith', 
'123 Main St, City', 'john.doe@email.com', 'Male', 
'BPED', 1, 'A'),
('2023002', 'Jane', 'Smith', 'Marie', 
'456 Park Ave, City', 'jane.smith@email.com', 'Female', 
'BECED', 2, 'B');

-- Insert sample attendance (using actual student IDs from the database)
INSERT INTO attendance_logs (student_id, purpose) 
SELECT id, 'Study' FROM students WHERE student_id = '2023001';
SELECT id, 'Study' FROM students WHERE student_id = '2023001';
