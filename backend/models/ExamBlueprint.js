const mongoose = require('mongoose');
const { Schema } = mongoose;
const config = require('../config/system.config');

const questionTypeConfigSchema = new Schema({
    count: { type: Number, default: 0 },
    options: { type: Number },
    correctAnswers: { type: Number }
}, { _id: false });

const difficultyDistributionSchema = new Schema({
    recall: { type: Number, default: 0 },
    understanding: { type: Number, default: 0 },
    application: { type: Number, default: 0 },
    analysis: { type: Number, default: 0 },
    evaluation: { type: Number, default: 0 }
}, { _id: false });

const scoringRuleSchema = new Schema({
    reward: { type: Number, default: 1 },
    penalty: { type: Number, default: -0.5 }
}, { _id: false });

const blueprintSchema = new Schema({
    teacherId: { type: Number, required: true, index: true },
    materials: [{ type: Schema.Types.ObjectId, ref: 'Material' }],
    selectedConcepts: { type: [String], default: [] },
    questionTypes: {
        single_choice: { type: questionTypeConfigSchema, default: {} },
        multiple_choice: { type: questionTypeConfigSchema, default: {} },
        true_false: { type: questionTypeConfigSchema, default: {} },
        matching: { type: questionTypeConfigSchema, default: {} },
        ordering: { type: questionTypeConfigSchema, default: {} },
        negative_qcm: { type: questionTypeConfigSchema, default: {} },
    },
    difficultyDistribution: { type: difficultyDistributionSchema, default: {} },
    scoringRules: {
        type: Map,
        of: scoringRuleSchema,
        default: {}
    },
    instructions: { type: String, default: '' },
    totalQuestions: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('ExamBlueprint', blueprintSchema);
