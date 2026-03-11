// backend/services/gradingService.js

/**
 * Grades a student's submission against an exam.
 * 
 * @param {Object} examDocument - The exam document from MongoDB
 * @param {Array} submission - The student's submitted answers array
 * @returns {Object} { totalScore, maxScore, gradedQuestions }
 */
const gradeExam = (examDocument, submission) => {
    let totalScore = 0;
    let maxScore = 0;
    const gradedQuestions = [];

    const scoringDefaults = examDocument.examData.scoringDefaults || { correct: 1, incorrect: -0.5, unanswered: 0 };
    const questions = examDocument.examData.questions || [];

    questions.forEach(question => {
        // Find student's answer for this question
        const studentAnswerObj = submission.find(sub => sub.questionId === question.id);
        const studentAnswer = studentAnswerObj ? studentAnswerObj.answer : null;

        // Determine the scoring weights for this question
        let weights = scoringDefaults;
        if (question.scoringOverride && question.scoringOverride.active) {
            weights = {
                correct: question.scoringOverride.correct !== undefined ? question.scoringOverride.correct : scoringDefaults.correct,
                incorrect: question.scoringOverride.incorrect !== undefined ? question.scoringOverride.incorrect : scoringDefaults.incorrect,
                unanswered: question.scoringOverride.unanswered !== undefined ? question.scoringOverride.unanswered : scoringDefaults.unanswered,
            };
        }

        // Add to the maximum possible score (assuming 100% correct)
        maxScore += weights.correct;

        let questionScore = 0;
        let isCorrect = false;

        // If no answer provided
        if (studentAnswer === null || studentAnswer === undefined || (Array.isArray(studentAnswer) && studentAnswer.length === 0) || studentAnswer === '') {
            questionScore = weights.unanswered;
        } else {
            // Evaluate based on question type
            switch (question.type) {
                case 'single_choice':
                case 'negative_qcm':
                    // Expects a single string representing the selected option
                    if (studentAnswer === question.correctAnswers[0]) {
                        isCorrect = true;
                        questionScore = weights.correct;
                    } else {
                        questionScore = weights.incorrect;
                    }
                    break;
                    
                case 'multiple_choice':
                    // Expects an array of selected option strings
                    // For multiple choice, we need exact match of the arrays (ignoring order)
                    if (Array.isArray(studentAnswer) && Array.isArray(question.correctAnswers)) {
                        const sortedStudent = [...studentAnswer].sort();
                        const sortedCorrect = [...question.correctAnswers].sort();
                        if (sortedStudent.length === sortedCorrect.length && sortedStudent.every((val, index) => val === sortedCorrect[index])) {
                            isCorrect = true;
                            questionScore = weights.correct;
                        } else {
                            questionScore = weights.incorrect;
                        }
                    } else {
                        questionScore = weights.incorrect;
                    }
                    break;

                case 'true_false':
                    // Expects a boolean
                    if (studentAnswer === question.trueFalseAnswer) {
                        isCorrect = true;
                        questionScore = weights.correct;
                    } else {
                        questionScore = weights.incorrect;
                    }
                    break;

                case 'matching':
                    // Expects an array of objects: [{ left: 'A', right: '1' }, ...]
                    if (Array.isArray(studentAnswer) && Array.isArray(question.matchingPairs)) {
                        // Check if all pairs match exactly
                        let allMatch = true;
                        if (studentAnswer.length !== question.matchingPairs.length) {
                            allMatch = false;
                        } else {
                            for (const pair of studentAnswer) {
                                const correctPair = question.matchingPairs.find(p => p.left === pair.left);
                                if (!correctPair || correctPair.right !== pair.right) {
                                    allMatch = false;
                                    break;
                                }
                            }
                        }
                        
                        if (allMatch) {
                            isCorrect = true;
                            questionScore = weights.correct;
                        } else {
                            questionScore = weights.incorrect;
                        }
                    } else {
                        questionScore = weights.incorrect;
                    }
                    break;

                case 'ordering':
                    // Expects an ordered array of strings
                    if (Array.isArray(studentAnswer) && Array.isArray(question.orderedItems)) {
                        if (studentAnswer.length === question.orderedItems.length && studentAnswer.every((val, index) => val === question.orderedItems[index])) {
                            isCorrect = true;
                            questionScore = weights.correct;
                        } else {
                            questionScore = weights.incorrect;
                        }
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
            studentAnswer
        });
    });

    return {
        totalScore,
        maxScore,
        gradedQuestions
    };
};

module.exports = {
    gradeExam
};
