const mongoose = require('mongoose');
const { Schema } = mongoose;

const examStatisticsSnapshotSchema = new Schema({
    examId: { type: Number, required: true, unique: true, index: true },
    teacherId: { type: Number, required: true, index: true },
    status: {
        type: String,
        enum: ['pending', 'ready'],
        default: 'ready',
    },
    generatedAt: { type: Date, default: Date.now },
    readiness: {
        examEnded: { type: Boolean, default: false },
        allSubmitted: { type: Boolean, default: false },
        eligibleStudents: { type: Number, default: 0 },
        submittedStudents: { type: Number, default: 0 },
        pendingStudents: [{
            student_id: Number,
            username: String,
            name: String,
        }],
    },
    payload: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('ExamStatisticsSnapshot', examStatisticsSnapshotSchema);
