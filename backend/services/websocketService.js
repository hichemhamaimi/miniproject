const { Server } = require("socket.io");
const pool = require('../config/dbConnect');

let io; // Hold the socket.io instance globally

// An in-memory store mapping session ids to their NodeJS setTimeout IDs
const activeTimers = {};

/**
 * Initialize WebSockets on the HTTP server
 */
const initWebSockets = (server) => {
    io = new Server(server, {
        cors: {
            origin: "http://localhost:5173", // URL of your frontend
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log(`WebSocket connected: ${socket.id}`);

        // Listen for a student joining an exam room
        socket.on("join_exam", async (data) => {
            const { examId, studentId } = data;
            
            if (!examId || !studentId) return;

            // Fetch the active session from DB
            try {
                const [sessionResults] = await pool.query(
                    `SELECT id, start_time, status FROM exam_sessions WHERE exam_id = ? AND student_id = ?`,
                    [examId, studentId]
                );

                if (sessionResults.length === 0) return;
                const session = sessionResults[0];

                if (session.status !== 'ONGOING') return;

                // Create a channel for this specific student's exam session so we can target them
                const roomName = `exam_${examId}_student_${studentId}`;
                socket.join(roomName);
                
                // Fetch the exam duration
                const [examResults] = await pool.query(`SELECT duration_minutes FROM exams WHERE id = ?`, [examId]);
                if (examResults.length === 0) return;

                const durationMinutes = examResults[0].duration_minutes;
                
                // Calculate remaining time precisely from backend timestamp
                const startTimeMs = new Date(session.start_time).getTime();
                const durationMs = durationMinutes * 60 * 1000;
                let elapsedMs = Date.now() - startTimeMs;
                let remainingMs = durationMs - elapsedMs;

                // If already expired
                if (remainingMs <= 0) {
                    await handleTimeExpired(session.id, roomName);
                    return;
                }

                // Register a NodeJS timeout for when this specific session expires
                // Clear any existing timer for this session id first (in case of page refresh)
                if (activeTimers[session.id]) {
                    clearTimeout(activeTimers[session.id]);
                }

                activeTimers[session.id] = setTimeout(async () => {
                    await handleTimeExpired(session.id, roomName);
                }, remainingMs);

                // Let the frontend know exactly what the server says the remaining time is
                socket.emit("timer_sync", { remainingMs });

            } catch (err) {
                console.error("Error setting up exam WebSocket:", err);
            }
        });

        socket.on("disconnect", () => {
            console.log(`WebSocket disconnected: ${socket.id}`);
        });
    });
};

/**
 * Logic fired exactly when the server timer hits 0.
 */
const handleTimeExpired = async (sessionId, roomName) => {
    try {
        // Mark session as expired in DB so they can't submit via REST later
        await pool.query(
            `UPDATE exam_sessions SET status = 'EXPIRED', end_time = CURRENT_TIMESTAMP WHERE id = ? AND status = 'ONGOING'`,
            [sessionId]
        );

        // Emit an un-ignorable event to the exact socket room directing the frontend to trigger a force-submit
        if (io) {
            io.to(roomName).emit("TIME_EXPIRED", { reason: "Time is up!" });
        }

        // Clean up memory
        if (activeTimers[sessionId]) {
            delete activeTimers[sessionId];
        }

    } catch (err) {
        console.error("Error handling time expired:", err);
    }
};

module.exports = {
    initWebSockets
};
