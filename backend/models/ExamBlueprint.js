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
    evaluation: { type: Number, default: 0 },
    create: { type: Number, default: 0 }
}, { _id: false });

const academicDifficultyDistributionSchema = new Schema({
    easy: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    hard: { type: Number, default: 0 },
}, { _id: false });

const questionProfileSchema = new Schema({
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        required: true,
    },
    cognitiveLevel: {
        type: String,
        enum: config.examGeneration.validDifficultyLevels,
        required: true,
    },
    count: { type: Number, default: 0 },
}, { _id: false });

const scoringRuleSchema = new Schema({
    reward: { type: Number, default: 1 },
    penalty: { type: Number, default: -0.5 },
    unanswered: { type: Number, default: 0 }
}, { _id: false });

const scoringConfigSchema = new Schema({
    mode: {
        type: String,
        enum: ['question', 'section'],
        default: 'question',
    },
    defaultRule: {
        type: scoringRuleSchema,
        default: () => ({}),
    },
    perType: {
        single_choice: { type: scoringRuleSchema, default: undefined },
        multiple_choice: { type: scoringRuleSchema, default: undefined },
        true_false: { type: scoringRuleSchema, default: undefined },
        matching: { type: scoringRuleSchema, default: undefined },
        ordering: { type: scoringRuleSchema, default: undefined },
        negative_qcm: { type: scoringRuleSchema, default: undefined },
    },
}, { _id: false });

const blueprintSchema = new Schema({
    teacherId: { type: Number, required: true, index: true },
    moduleId: { type: Number, required: true, index: true },
    title: { type: String, required: true },
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
    scoringConfig: {
        type: scoringConfigSchema,
        default: () => ({}),
    },
    instructions: { type: String, default: '' },
    totalQuestions: { type: Number, default: 0 },
    generationContext: {
        selectedMaterialTitles: { type: [String], default: [] },
        selectedTopicCount: { type: Number, default: 0 },
        examProviderConfigId: { type: Number, default: null },
        academicDifficultyDistribution: { type: academicDifficultyDistributionSchema, default: {} },
        cognitiveDistribution: { type: difficultyDistributionSchema, default: {} },
        questionProfiles: { type: [questionProfileSchema], default: [] },
    }
}, { timestamps: true });

module.exports = mongoose.model('ExamBlueprint', blueprintSchema);
