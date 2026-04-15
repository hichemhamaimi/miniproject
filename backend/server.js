require("dotenv").config();
const express = require("express");
const http = require("http");
const app = express();
const { initWebSockets } = require('./services/websocketService');
//const connectMongo = require('./config/mongoConnect');
const errorHandler = require("./middleware/errorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const PORT = process.env.PORT || 3500;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Connect to MongoDB
//connectMongo();

// Authentication endpoint
app.use("/auth", require('./routes/auth'));

// Protected Routes - SuperAdmin
app.use("/superadmin/users", require("./routes/superadmin/users"));
app.use("/superadmin/departments", require("./routes/superadmin/departments"));
app.use("/superadmin/teachers", require("./routes/superadmin/teachers"));
app.use("/superadmin/students", require("./routes/superadmin/students"));

// Protected Routes - DepartmentAdmin
app.use("/departmentadmin/groups", require("./routes/departmentadmin/groups"));
app.use("/departmentadmin/modules", require("./routes/departmentadmin/modules"));
app.use("/departmentadmin/teachers", require("./routes/departmentadmin/teachers"));

// Protected Routes - Teacher
app.use("/teacher/modules", require("./routes/teacher/modules"));
app.use("/teacher/exams", require("./routes/teacher/exams"));
app.use("/teacher/qcm", require("./routes/teacher/qcm"));

// Protected Routes - Student
app.use("/student/exams", require("./routes/student/exams"));

app.use((req, res) => res.status(404).json({ error: "404 Not Found" }));

app.use(errorHandler);

const server = http.createServer(app);

// Initialize WebSockets
initWebSockets(server);

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
