const Ajv = require('ajv');
const config = require('../config/system.config');

const ajv = new Ajv({ allErrors: true });

const { validQuestionTypes, validDifficultyLevels } = config.examGeneration;

const questionSchema = {
    type: 'object',
    required: ['type', 'difficulty', 'question'],
    properties: {
        type: { type: 'string', enum: validQuestionTypes },
        difficulty: { type: 'string', enum: validDifficultyLevels },
        question: { type: 'string', minLength: 1 },
        options: { type: 'array', items: { type: 'string' } },
        correctAnswerIndexes: { type: 'array', items: { type: 'integer', minimum: 0 } },
        correctAnswers: { type: 'array', items: { type: 'string' } },
        trueFalseAnswer: { type: 'boolean' },
        matchingPairs: {
            type: 'array',
            items: {
                type: 'object',
                required: ['left', 'right'],
                properties: {
                    left: { type: 'string' },
                    right: { type: 'string' }
                }
            }
        },
        orderedItems: { type: 'array', items: { type: 'string' } },
        explanation: { type: 'string' }
    },
    additionalProperties: true
};

const examResponseSchema = {
    type: 'object',
    required: ['examTitle', 'questions'],
    properties: {
        examTitle: { type: 'string', minLength: 1 },
        questions: {
            type: 'array',
            minItems: 1,
            items: questionSchema
        }
    }
};

const validateExamJson = ajv.compile(examResponseSchema);

/**
 * Validate a raw LLM-produced exam JSON object.
 * Returns { valid: true } or { valid: false, errors: [...] }
 */
const validateExam = (examData) => {
    const valid = validateExamJson(examData);

    if (!valid) {
        return { valid: false, errors: validateExamJson.errors };
    }

    // Extra semantic checks
    const semanticErrors = [];

    for (const [i, q] of examData.questions.entries()) {
        const prefix = `Question ${i + 1}`;

        if (q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'negative_qcm') {
            if (!q.options || q.options.length !== 4) {
                semanticErrors.push(`${prefix}: options array must have exactly 4 items for type "${q.type}"`);
            }
            if (!q.correctAnswerIndexes || q.correctAnswerIndexes.length === 0) {
                semanticErrors.push(`${prefix}: correctAnswerIndexes is required for type "${q.type}"`);
            }
            if (q.correctAnswerIndexes) {
                const uniqueIndexes = new Set(q.correctAnswerIndexes);
                if (uniqueIndexes.size !== q.correctAnswerIndexes.length) {
                    semanticErrors.push(`${prefix}: correctAnswerIndexes must not contain duplicates`);
                }
                const outOfRange = q.correctAnswerIndexes.filter((index) => !Number.isInteger(index) || index < 0 || index >= (q.options?.length || 0));
                if (outOfRange.length > 0) {
                    semanticErrors.push(`${prefix}: correctAnswerIndexes contains invalid option indexes: ${outOfRange.join(', ')}`);
                }
            }
            if ((q.type === 'single_choice' || q.type === 'negative_qcm') && q.correctAnswerIndexes && q.correctAnswerIndexes.length !== 1) {
                semanticErrors.push(`${prefix}: ${q.type} must have exactly 1 correctAnswerIndexes entry`);
            }
            if (q.correctAnswers && q.correctAnswers.length > 0) {
                const invalid = q.correctAnswers.filter((answer) => !q.options.includes(answer));
                if (invalid.length > 0) {
                    semanticErrors.push(`${prefix}: correctAnswers contains values not in options: ${invalid.join(', ')}`);
                }
            }
        }

        if (q.type === 'multiple_choice' && q.correctAnswerIndexes && q.correctAnswerIndexes.length === 0) {
            semanticErrors.push(`${prefix}: multiple_choice must have at least 1 correct answer index`);
        }

        if (q.type === 'true_false' && q.trueFalseAnswer === undefined) {
            semanticErrors.push(`${prefix}: trueFalseAnswer (boolean) is required for type "true_false"`);
        }

        if (q.type === 'matching' && (!q.matchingPairs || q.matchingPairs.length < 2)) {
            semanticErrors.push(`${prefix}: matchingPairs must have at least 2 entries for type "matching"`);
        }

        if (q.type === 'ordering' && (!q.orderedItems || q.orderedItems.length < 2)) {
            semanticErrors.push(`${prefix}: orderedItems must have at least 2 items for type "ordering"`);
        }
    }

    if (semanticErrors.length > 0) {
        return { valid: false, errors: semanticErrors };
    }

    return { valid: true };
};

module.exports = { validateExam };
