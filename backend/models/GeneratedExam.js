const mongoose = require('mongoose');
const { Schema } = mongoose;
const config = require('../config/system.config');

const generatedQuestionSchema = new Schema({
    id: { type: String, required: true },
    type: {
        type: String,
        enum: config.examGeneration.validQuestionTypes,
        required: true
    },
    difficulty: {
        type: String,
        enum: config.examGeneration.validDifficultyLevels,
        required: true
    },
    text: { type: String, required: true },
    options: { type: [String], default: [] },
    correctAnswers: { type: [String], default: [] },
    trueFalseAnswer: { type: Boolean },
    matchingPairs: { type: [{ left: String, right: String }], default: [] },
    orderedItems: { type: [String], default: [] },
    explanation: { type: String, default: '' },
    scoringOverride: {
        active: { type: Boolean, default: false },
        correct: { type: Number },
        incorrect: { type: Number },
        unanswered: { type: Number }
    }
}, { _id: false });

const generatedExamSchema = new Schema({
    teacherId: { type: Number, required: true, index: true },
    blueprintId: { type: Schema.Types.ObjectId, ref: 'ExamBlueprint' },
    title: { type: String, required: true },
    questions: { type: [generatedQuestionSchema], default: [] },
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft'
    },
    publishedAt: { type: Date },
    scoringDefaults: {
        correct: { type: Number, default: 1 },
        incorrect: { type: Number, default: -0.5 },
        unanswered: { type: Number, default: 0 }
    }
}, { timestamps: true });

module.exports = mongoose.model('GeneratedExam', generatedExamSchema);
