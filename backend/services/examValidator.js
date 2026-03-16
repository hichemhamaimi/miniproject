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
    }
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
            if (!q.options || q.options.length < 2) {
                semanticErrors.push(`${prefix}: options array must have at least 2 items for type "${q.type}"`);
            }
            if (!q.correctAnswers || q.correctAnswers.length === 0) {
                semanticErrors.push(`${prefix}: correctAnswers is required for type "${q.type}"`);
            }
            if (q.options && q.correctAnswers) {
                const invalid = q.correctAnswers.filter(a => !q.options.includes(a));
                if (invalid.length > 0) {
                    semanticErrors.push(`${prefix}: correctAnswers contains values not in options: ${invalid.join(', ')}`);
                }
            }
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
