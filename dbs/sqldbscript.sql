-- =====================================================
-- DATABASE
-- =====================================================
CREATE DATABASE IF NOT EXISTS university_exam_system;
USE university_exam_system;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hashes fit here
    role ENUM('superadmin','department_admin','teacher','student') NOT NULL,
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_users_role (role)
);

-- =====================================================
-- DEPARTMENTS
-- =====================================================
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    abbreviation VARCHAR(20) NOT NULL UNIQUE,

    department_admin_id INT NOT NULL,

    INDEX idx_department_admin (department_admin_id),

    CONSTRAINT fk_department_admin
        FOREIGN KEY (department_admin_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- =====================================================
-- STUDENT GROUPS
-- =====================================================
CREATE TABLE student_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(20) NOT NULL,

    year ENUM('1st','2nd','3rd') NOT NULL,

    department_id INT NOT NULL,

    INDEX idx_group_department (department_id),

    CONSTRAINT fk_group_department
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- =====================================================
-- STUDENTS (inherits from users)
-- =====================================================
CREATE TABLE students (
    id INT PRIMARY KEY,

    group_id INT NOT NULL,
    attribution_date DATE NOT NULL,

    INDEX idx_student_group (group_id),

    CONSTRAINT fk_student_user
        FOREIGN KEY (id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_student_group
        FOREIGN KEY (group_id)
        REFERENCES student_groups(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

-- =====================================================
-- MODULES
-- =====================================================
CREATE TABLE modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    abbreviation VARCHAR(20) NOT NULL UNIQUE,

    responsable_teacher_id INT NOT NULL,

    INDEX idx_module_teacher (responsable_teacher_id),

    CONSTRAINT fk_module_teacher
        FOREIGN KEY (responsable_teacher_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- =====================================================
-- GROUP_MODULES
-- =====================================================
CREATE TABLE group_modules (
    group_id INT NOT NULL,
    module_id INT NOT NULL,

    PRIMARY KEY (group_id, module_id),

    INDEX idx_gm_group (group_id),
    INDEX idx_gm_module (module_id),

    CONSTRAINT fk_gm_group
        FOREIGN KEY (group_id)
        REFERENCES student_groups(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_gm_module
        FOREIGN KEY (module_id)
        REFERENCES modules(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- =====================================================
-- EXAMS
-- =====================================================
CREATE TABLE exams (
    id INT AUTO_INCREMENT PRIMARY KEY,

    module_id INT NOT NULL,
    teacher_id INT NOT NULL,

    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_exam_module (module_id),
    INDEX idx_exam_teacher (teacher_id),

    CONSTRAINT fk_exam_module
        FOREIGN KEY (module_id)
        REFERENCES modules(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_exam_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);