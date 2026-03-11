const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const examSchema = new Schema({
    _id: {
        type: Number,
        required: true,
        description: 'The ID that corresponds to the MySQL exam table ID'
    },
    examData: {
        scoringDefaults: {
            correct: { type: Number, default: 1 },
            incorrect: { type: Number, default: -0.5 },
            unanswered: { type: Number, default: 0 }
        },
        questions: [{
            id: { type: String, required: true },
            type: { 
                type: String, 
                enum: ['single_choice', 'multiple_choice', 'true_false', 'matching', 'ordering', 'negative_qcm'],
                required: true
            },
            text: { type: String, required: true },
            explanation: { type: String, default: '' },
            scoringOverride: {
                active: { type: Boolean, default: false },
                correct: { type: Number },
                incorrect: { type: Number },
                unanswered: { type: Number }
            },
            // Type-specific fields (sparse)
            options: [String], // for single, multiple, negative
            correctAnswers: [String], // array of correct option strings
            trueFalseAnswer: { type: Boolean }, // for true_false
            matchingPairs: [{ left: String, right: String }], // for matching
            orderedItems: [String] // for ordering
        }]
    }
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);
