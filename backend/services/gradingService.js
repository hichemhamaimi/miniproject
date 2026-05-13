// backend/services/gradingService.js

/**
 * Grades a student's submission against an exam.
 * 
 * @param {Object} examDocument - The exam document from MongoDB
 * @param {Array} submission - The student's submitted answers array
 * @returns {Object} { totalScore, maxScore, gradedQuestions }
 */
const normalizeAnswer = (value) => {
    if (value === undefined) return null;
    return value;
};

const isAnswerProvided = (question, studentAnswer) => {
    if (studentAnswer === null || studentAnswer === undefined || studentAnswer === '') {
        return false;
    }

    if (question.type === 'multiple_choice') {
        return Array.isArray(studentAnswer) && studentAnswer.length > 0;
    }

    if (question.type === 'matching') {
        return Array.isArray(studentAnswer) && studentAnswer.some((pair) => String(pair?.right || '').trim() !== '');
    }

    if (question.type === 'ordering') {
        return Array.isArray(studentAnswer) && studentAnswer.length > 0;
    }

    return true;
};

const getQuestionWeights = (question, scoringDefaults) => {
    if (question.scoringOverride && question.scoringOverride.active) {
        return {
            correct: question.scoringOverride.correct !== undefined ? question.scoringOverride.correct : scoringDefaults.correct,
            incorrect: question.scoringOverride.incorrect !== undefined ? question.scoringOverride.incorrect : scoringDefaults.incorrect,
            unanswered: question.scoringOverride.unanswered !== undefined ? question.scoringOverride.unanswered : scoringDefaults.unanswered,
        };
    }

    return scoringDefaults;
};

const getCanonicalCorrectAnswer = (question) => {
    switch (question.type) {
        case 'single_choice':
        case 'negative_qcm':
            return question.correctAnswers?.[0] ?? null;
        case 'multiple_choice':
            return question.correctAnswers || [];
        case 'true_false':
            return question.trueFalseAnswer;
        case 'matching':
            return question.matchingPairs || [];
        case 'ordering':
            return question.orderedItems || [];
        default:
            return null;
    }
};

const calculateExamMaxScore = (examDocument) => {
    const scoringDefaults = examDocument.examData.scoringDefaults || { correct: 1, incorrect: -0.5, unanswered: 0 };
    const questions = examDocument.examData.questions || [];
    return questions.reduce((sum, question) => {
        const weights = getQuestionWeights(question, scoringDefaults);
        return sum + Number(weights.correct || 0);
    }, 0);
};

const calcPartialRatio = (numerator, denominator) => {
    if (!denominator) return 0;
    return Math.max(0, Math.min(1, numerator / denominator));
};

const computeQuestionScore = (weights, ratio, wasAnswered) => {
    if (!wasAnswered) return weights.unanswered;
    if (ratio >= 1) return weights.correct;
    if (ratio <= 0) return weights.incorrect;
    const spread = weights.correct - weights.incorrect;
    return Number((weights.incorrect + (spread * ratio)).toFixed(2));
};

const gradeExam = (examDocument, submission = []) => {
    let totalScore = 0;
    let maxScore = 0;
    const gradedQuestions = [];

    const scoringDefaults = examDocument.examData.scoringDefaults || { correct: 1, incorrect: -0.5, unanswered: 0 };
    const questions = examDocument.examData.questions || [];

    questions.forEach(question => {
        // Find student's answer for this question
        const studentAnswerObj = submission.find(sub => sub.questionId === question.id);
        const studentAnswer = normalizeAnswer(studentAnswerObj ? studentAnswerObj.answer : null);

        // Determine the scoring weights for this question
        const weights = getQuestionWeights(question, scoringDefaults);

        // Add to the maximum possible score (assuming 100% correct)
        maxScore += weights.correct;

        let questionScore = 0;
        let isCorrect = false;
        let correctnessRatio = 0;
        const correctAnswer = getCanonicalCorrectAnswer(question);

        // If no answer provided
        const wasAnswered = isAnswerProvided(question, studentAnswer);

        if (!wasAnswered) {
            questionScore = weights.unanswered;
        } else {
            // Evaluate based on question type
            switch (question.type) {
                case 'single_choice':
                case 'negative_qcm':
                    // Expects a single string representing the selected option
                    if (studentAnswer === correctAnswer) {
                        isCorrect = true;
                        correctnessRatio = 1;
                        questionScore = weights.correct;
                    } else {
                        questionScore = weights.incorrect;
                    }
                    break;
                    
                case 'multiple_choice':
                    // Expects an array of selected option strings
                    if (Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
                        const studentSet = new Set(studentAnswer);
                        const correctSet = new Set(correctAnswer);
                        const truePositives = [...studentSet].filter((item) => correctSet.has(item)).length;
                        const falsePositives = [...studentSet].filter((item) => !correctSet.has(item)).length;
                        const incorrectOptionCount = Math.max((question.options?.length || 0) - correctSet.size, 0);
                        const rewardRatio = calcPartialRatio(truePositives, correctSet.size || 1);
                        const penaltyRatio = incorrectOptionCount > 0
                            ? calcPartialRatio(falsePositives, incorrectOptionCount)
                            : 0;
                        correctnessRatio = Number(Math.max(0, rewardRatio - penaltyRatio).toFixed(4));
                        if (falsePositives === 0 && studentSet.size === correctSet.size && truePositives === correctSet.size) {
                            isCorrect = true;
                        }
                        questionScore = computeQuestionScore(weights, correctnessRatio, true);
                    } else {
                        questionScore = weights.incorrect;
                    }
                    break;

                case 'true_false':
                    // Expects a boolean
                    if (studentAnswer === correctAnswer) {
                        isCorrect = true;
                        correctnessRatio = 1;
                        questionScore = weights.correct;
                    } else {
                        questionScore = weights.incorrect;
                    }
                    break;

                case 'matching':
                    // Expects an array of objects: [{ left: 'A', right: '1' }, ...]
                    if (Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
                        const matches = studentAnswer.reduce((count, pair) => {
                            const correctPair = correctAnswer.find((item) => item.left === pair.left);
                            return count + (correctPair && correctPair.right === pair.right ? 1 : 0);
                        }, 0);
                        correctnessRatio = calcPartialRatio(matches, correctAnswer.length);
                        if (correctnessRatio === 1) {
                            isCorrect = true;
                        }
                        questionScore = computeQuestionScore(weights, correctnessRatio, true);
                    } else {
                        questionScore = weights.incorrect;
                    }
                    break;

                case 'ordering':
                    // Expects an ordered array of strings
                    if (Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
                        const correctlyPositioned = studentAnswer.reduce((count, value, index) => count + (value === correctAnswer[index] ? 1 : 0), 0);
                        correctnessRatio = calcPartialRatio(correctlyPositioned, correctAnswer.length);
                        if (studentAnswer.length === correctAnswer.length && correctnessRatio === 1) {
                            isCorrect = true;
                        }
                        questionScore = computeQuestionScore(weights, correctnessRatio, true);
                    } else {
                        questionScore = weights.incorrect;
                    }
                    break;

                default:
                    questionScore = 0; // Unknown type
            }
        }

        totalScore += questionScore;
        gradedQuestions.push({
            questionId: question.id,
            isCorrect,
            score: questionScore,
            maxScore: weights.correct,
            status: isCorrect ? 'correct' : correctnessRatio > 0 ? 'partial' : 'incorrect',
            correctnessRatio,
            studentAnswer,
            correctAnswer,
            explanation: question.explanation || ''
        });
    });

    return {
        totalScore,
        maxScore,
        gradedQuestions
    };
};

module.exports = {
    gradeExam,
    getCanonicalCorrectAnswer,
    getQuestionWeights,
    calculateExamMaxScore,
};
