CREATE TABLE IF NOT EXISTS students (
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

CREATE TABLE IF NOT EXISTS attendance_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    purpose VARCHAR(200) NOT NULL,
    check_in DATETIME DEFAULT CURRENT_TIMESTAMP,
    check_out DATETIME,
    checked_in_by VARCHAR(60) DEFAULT NULL,
    checked_out_by VARCHAR(60) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    title VARCHAR(120) DEFAULT 'Library employee access',
    email VARCHAR(120),
    phone_number VARCHAR(40),
    profile_note TEXT,
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
    id INT PRIMARY KEY AUTO_INCREMENT,
    catalog_key VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    edition VARCHAR(80) DEFAULT 'N/A',
    volume VARCHAR(80) DEFAULT 'N/A',
    copyright VARCHAR(40) DEFAULT 'N/A',
    copies INT NOT NULL DEFAULT 1,
    subject_1 VARCHAR(255),
    subject_2 VARCHAR(255),
    subject_3 VARCHAR(255),
    call_number VARCHAR(120),
    author_number VARCHAR(120),
    accession_numbers TEXT,
    inventory_years VARCHAR(120),
    publisher VARCHAR(255),
    place_of_publication VARCHAR(255),
    isbn VARCHAR(120),
    remarks VARCHAR(255),
    source_of_funds VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
