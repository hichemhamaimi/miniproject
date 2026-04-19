require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const app = express();
const { initWebSockets } = require('./services/websocketService');
const { initQueue } = require('./services/queueService');
const connectMongo = require('./config/mongoConnect');
const errorHandler = require("./middleware/errorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const PORT = process.env.PORT || 3500;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Serve uploaded material files statically
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Connect to MongoDB
connectMongo();

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

// Protected Routes - Teacher (existing)
app.use("/teacher/modules", require("./routes/teacher/modules"));
app.use("/teacher/exams", require("./routes/teacher/exams"));

// Protected Routes - Teacher (AI Exam Generation Workflow)
app.use("/teacher/materials", require("./routes/teacher/materials"));
app.use("/teacher/blueprints", require("./routes/teacher/blueprints"));
app.use("/teacher/ai-exams", require("./routes/teacher/aiExams"));
app.use("/teacher/statistics", require("./routes/teacher/statistics"));

// Protected Routes - Student
app.use("/student/exams", require("./routes/student/exams"));
app.use("/student/results", require("./routes/student/results"));

app.use((req, res) => res.status(404).json({ error: "404 Not Found" }));

app.use(errorHandler);

const server = http.createServer(app);

// Initialize WebSockets
initWebSockets(server);

// Initialize async exam generation queue (Redis-backed, graceful fallback)
initQueue();

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
