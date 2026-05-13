CREATE DATABASE IF NOT EXISTS university_exam_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE university_exam_system;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS question_results;
DROP TABLE IF EXISTS correction_documents;
DROP TABLE IF EXISTS exam_results;
DROP TABLE IF EXISTS exam_sessions;
DROP TABLE IF EXISTS exam_groups;
DROP TABLE IF EXISTS ai_provider_configs;
DROP TABLE IF EXISTS llm_provider_configs;
DROP TABLE IF EXISTS exams;
DROP TABLE IF EXISTS group_modules;
DROP TABLE IF EXISTS modules;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS student_groups;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('superadmin', 'department_admin', 'teacher', 'student') NOT NULL,
    creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_role (role)
);

CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    abbreviation VARCHAR(20) NOT NULL UNIQUE,
    department_admin_id INT NOT NULL,
    CONSTRAINT fk_departments_admin FOREIGN KEY (department_admin_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE student_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(20) NOT NULL,
    year ENUM('1st', '2nd', '3rd') NOT NULL,
    department_id INT NOT NULL,
    INDEX idx_group_department (department_id),
    CONSTRAINT fk_groups_department FOREIGN KEY (department_id) REFERENCES departments(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE students (
    id INT PRIMARY KEY,
    group_id INT NULL,
    attribution_date DATE NOT NULL,
    INDEX idx_students_group (group_id),
    CONSTRAINT fk_students_user FOREIGN KEY (id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_students_group FOREIGN KEY (group_id) REFERENCES student_groups(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    abbreviation VARCHAR(20) NOT NULL UNIQUE,
    responsable_teacher_id INT NOT NULL,
    INDEX idx_modules_teacher (responsable_teacher_id),
    CONSTRAINT fk_modules_teacher FOREIGN KEY (responsable_teacher_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE group_modules (
    group_id INT NOT NULL,
    module_id INT NOT NULL,
    PRIMARY KEY (group_id, module_id),
    CONSTRAINT fk_group_modules_group FOREIGN KEY (group_id) REFERENCES student_groups(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_group_modules_module FOREIGN KEY (module_id) REFERENCES modules(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE llm_provider_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    provider_name ENUM('groq', 'openai', 'anthropic', 'gemini', 'mistral', 'ollama') NOT NULL,
    label VARCHAR(100) NOT NULL,
    api_key_encrypted TEXT NULL,
    model_name VARCHAR(120) NOT NULL,
    base_url VARCHAR(255) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_llm_teacher_default (teacher_id, is_default),
    CONSTRAINT fk_llm_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE ai_provider_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_type ENUM('llm', 'embedding') NOT NULL,
    provider_name VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    api_key_encrypted TEXT NULL,
    model_name VARCHAR(160) NOT NULL,
    base_url VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ai_service_default (service_type, is_default, is_active),
    INDEX idx_ai_service_active (service_type, is_active)
);

CREATE TABLE exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INT NOT NULL,
    teacher_id INT NOT NULL,
    llm_provider_config_id INT NULL,
    title VARCHAR(255) NOT NULL,
    status ENUM('DRAFT', 'READY', 'LIVE', 'ENDED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    duration_minutes INT NOT NULL DEFAULT 60,
    pass_score DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    start_time DATETIME NULL,
    end_time DATETIME NULL,
    require_seb BOOLEAN NOT NULL DEFAULT FALSE,
    seb_config_key VARCHAR(255) NULL,
    creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_exam_module (module_id),
    INDEX idx_exam_teacher (teacher_id),
    INDEX idx_exam_status (status),
    CONSTRAINT fk_exams_module FOREIGN KEY (module_id) REFERENCES modules(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_exams_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_exams_llm_provider FOREIGN KEY (llm_provider_config_id) REFERENCES llm_provider_configs(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE exam_groups (
    exam_id INT NOT NULL,
    group_id INT NOT NULL,
    PRIMARY KEY (exam_id, group_id),
    CONSTRAINT fk_exam_groups_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_exam_groups_group FOREIGN KEY (group_id) REFERENCES student_groups(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE exam_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    student_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NULL,
    status ENUM('ONGOING', 'SUBMITTED', 'EXPIRED') NOT NULL DEFAULT 'ONGOING',
    UNIQUE KEY uniq_exam_session (exam_id, student_id),
    INDEX idx_sessions_status (status),
    CONSTRAINT fk_sessions_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_sessions_student FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE exam_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    exam_id INT NOT NULL,
    session_id INT NULL,
    score DECIMAL(10,2) NOT NULL,
    max_score DECIMAL(10,2) NOT NULL,
    percentage_score DECIMAL(6,2) NOT NULL DEFAULT 0,
    pass_status ENUM('PASS', 'FAIL') NOT NULL DEFAULT 'FAIL',
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    correction_document_id INT NULL,
    INDEX idx_results_exam (exam_id),
    INDEX idx_results_student (student_id),
    CONSTRAINT fk_results_student FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_results_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_results_session FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE correction_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_result_id INT NOT NULL,
    exam_id INT NOT NULL,
    student_id INT NOT NULL,
    mongo_document_id CHAR(24) NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    document_payload LONGTEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_result_document (exam_result_id),
    INDEX idx_correction_mongo_document (mongo_document_id),
    CONSTRAINT fk_documents_result FOREIGN KEY (exam_result_id) REFERENCES exam_results(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_documents_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_documents_student FOREIGN KEY (student_id) REFERENCES students(id) ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE exam_results
    ADD CONSTRAINT fk_results_document FOREIGN KEY (correction_document_id) REFERENCES correction_documents(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE question_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_result_id INT NOT NULL,
    question_id VARCHAR(64) NOT NULL,
    selected_choice JSON NULL,
    is_correct TINYINT(1) NOT NULL DEFAULT 0,
    student_answer_json JSON NULL,
    correct_answer_json JSON NULL,
    awarded_score DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_score DECIMAL(10,2) NOT NULL DEFAULT 0,
    grading_status ENUM('correct', 'partial', 'incorrect') NOT NULL DEFAULT 'incorrect',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_question_results_result (exam_result_id),
    INDEX idx_question_results_question (question_id),
    CONSTRAINT fk_question_results_result FOREIGN KEY (exam_result_id) REFERENCES exam_results(id) ON UPDATE CASCADE ON DELETE CASCADE
);
