USE university_exam_system;

INSERT INTO users (name, lastname, date_of_birth, username, password_hash, role)
VALUES (
    'Super',
    'Admin',
    '1990-01-01',
    'superadmin',
    '$2b$12$3RnYvljHpCzb7KMjreNIOOhretWE2wrRWRUJ6J8z0TpoGxYY.yPBu',
    'superadmin'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    lastname = VALUES(lastname),
    date_of_birth = VALUES(date_of_birth),
    role = VALUES(role);
