const mongoose = require('mongoose');
const { Schema } = mongoose;

const generationJobSchema = new Schema({
    blueprintId: { type: Schema.Types.ObjectId, ref: 'ExamBlueprint', required: true },
    teacherId: { type: Number, required: true },
    bullJobId: { type: String },
    status: {
        type: String,
        enum: ['queued', 'processing', 'done', 'failed'],
        default: 'queued'
    },
    resultExamId: { type: Schema.Types.ObjectId, ref: 'GeneratedExam' },
    error: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('GenerationJob', generationJobSchema);
