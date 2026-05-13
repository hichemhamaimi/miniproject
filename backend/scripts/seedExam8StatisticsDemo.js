require('dotenv').config();

const mongoose = require('mongoose');
const pool = require('../config/dbConnect');
const Exam = require('../models/Exam');
const CorrectionDocument = require('../models/CorrectionDocument');
const ExamStatisticsSnapshot = require('../models/ExamStatisticsSnapshot');
const gradingService = require('../services/gradingService');
const { createCorrectionDocument } = require('../services/correctionDocumentService');
const { getStoredOrGenerateStatisticsSnapshot } = require('../services/examStatisticsService');

const EXAM_ID = 8;
const PRESERVED_USERNAME = '2021001';
const USERNAME_START = 2021002;
const USERNAME_END = 2021132;

const seededRandom = (seed) => {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
    };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const shuffle = (items, rand) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(rand() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
};

const rotate = (items, count = 1) => {
    if (!items.length) return [];
    const offset = count % items.length;
    return [...items.slice(offset), ...items.slice(0, offset)];
};

const getWrongOptions = (question) => {
    const correct = gradingService.getCanonicalCorrectAnswer(question);
    const correctSet = new Set(Array.isArray(correct) ? correct : [correct]);
    return (question.options || []).filter((option) => !correctSet.has(option));
};

const getPopularWrongOption = (question, questionIndex, rand) => {
    const wrongOptions = getWrongOptions(question);
    if (wrongOptions.length === 0) return null;

    const roll = rand();
    if (roll < 0.58) return wrongOptions[questionIndex % wrongOptions.length];
    if (roll < 0.82) return wrongOptions[(questionIndex + 1) % wrongOptions.length];
    return wrongOptions[Math.floor(rand() * wrongOptions.length)];
};

const getAbility = (student, studentIndex) => {
    const rand = seededRandom(Number(student.username) + 8100);
    const roll = rand();
    let base;

    if (roll < 0.09) base = 0.23 + (rand() * 0.10);
    else if (roll < 0.31) base = 0.35 + (rand() * 0.13);
    else if (roll < 0.72) base = 0.50 + (rand() * 0.16);
    else if (roll < 0.92) base = 0.67 + (rand() * 0.13);
    else base = 0.81 + (rand() * 0.09);

    const groupAdjustment = (((student.group_id || 0) % 4) - 1.5) * 0.018;
    const localVariation = (Math.sin((studentIndex + 3) * 1.71) * 0.035) + ((rand() - 0.5) * 0.07);
    return clamp(base + groupAdjustment + localVariation, 0.18, 0.96);
};

const getQuestionDifficulty = (questionIndex) => {
    const profile = [0.07, 0.14, 0.22, 0.31, 0.40, 0.19, 0.47, 0.28, 0.35, 0.12];
    const base = profile[questionIndex % profile.length];
    const trend = questionIndex >= 14 ? 0.04 : questionIndex >= 8 ? 0.02 : 0;
    return clamp(base + trend, 0.05, 0.56);
};

const buildAnswerForQuestion = (question, rand, questionIndex, shouldBeCorrect, partialChance) => {
    const correct = gradingService.getCanonicalCorrectAnswer(question);

    if (!shouldBeCorrect && rand() < 0.05) {
        return null;
    }

    switch (question.type) {
        case 'single_choice':
        case 'negative_qcm':
            return shouldBeCorrect ? correct : getPopularWrongOption(question, questionIndex, rand);

        case 'multiple_choice': {
            const correctAnswers = Array.isArray(correct) ? correct : [];
            const wrongOptions = getWrongOptions(question);
            if (shouldBeCorrect) {
                if (rand() < 0.14 && correctAnswers.length > 1) {
                    return correctAnswers.slice(0, correctAnswers.length - 1);
                }
                return correctAnswers;
            }

            if (rand() < partialChance && correctAnswers.length > 0) {
                const answer = shuffle(correctAnswers, rand).slice(0, Math.max(1, Math.ceil(correctAnswers.length / 2)));
                if (wrongOptions.length && rand() < 0.35) {
                    answer.push(wrongOptions[questionIndex % wrongOptions.length]);
                }
                return answer;
            }

            if (wrongOptions.length === 0) return [];
            return [wrongOptions[questionIndex % wrongOptions.length]];
        }

        case 'true_false':
            return shouldBeCorrect ? Boolean(correct) : !Boolean(correct);

        case 'matching': {
            const pairs = Array.isArray(correct) ? correct : [];
            if (shouldBeCorrect) {
                if (rand() < 0.10 && pairs.length > 2) {
                    const almost = pairs.map((pair) => ({ ...pair }));
                    [almost[0].right, almost[1].right] = [almost[1].right, almost[0].right];
                    return almost;
                }
                return pairs;
            }

            const rights = rotate(pairs.map((pair) => pair.right), Math.max(1, (questionIndex % Math.max(1, pairs.length))));
            return pairs.map((pair, index) => ({
                left: pair.left,
                right: rand() < partialChance ? pair.right : rights[index],
            }));
        }

        case 'ordering': {
            const ordered = Array.isArray(correct) ? correct : [];
            if (shouldBeCorrect) {
                if (rand() < 0.08 && ordered.length > 3) {
                    const almost = [...ordered];
                    [almost[almost.length - 1], almost[almost.length - 2]] = [almost[almost.length - 2], almost[almost.length - 1]];
                    return almost;
                }
                return ordered;
            }

            if (rand() < partialChance && ordered.length > 2) {
                const almost = [...ordered];
                const firstSwap = questionIndex % ordered.length;
                const secondSwap = (firstSwap + 1) % ordered.length;
                [almost[firstSwap], almost[secondSwap]] = [almost[secondSwap], almost[firstSwap]];
                return almost;
            }
            return shuffle(ordered, rand);
        }

        default:
            return null;
    }
};

const buildSubmission = (examDocument, student, studentIndex) => {
    const rand = seededRandom(Number(student.username) + (EXAM_ID * 1000));
    const questions = examDocument.examData.questions || [];
    const ability = getAbility(student, studentIndex);

    return questions.map((question, questionIndex) => {
        const difficulty = getQuestionDifficulty(questionIndex);
        const itemNoise = (rand() - 0.5) * 0.18;
        const correctProbability = clamp(ability - difficulty + 0.20 + itemNoise, 0.06, 0.96);
        const shouldBeCorrect = rand() < correctProbability;
        const partialChance = clamp(0.10 + (ability * 0.46) - (difficulty * 0.25), 0.10, 0.58);
        return {
            questionId: question.id,
            answer: buildAnswerForQuestion(question, rand, questionIndex, shouldBeCorrect, partialChance),
        };
    });
};

const toMysqlDate = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

const main = async () => {
    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: Number.parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
    });

    const connection = await pool.getConnection();
    let createdResults = 0;

    try {
        const examDocument = await Exam.findById(EXAM_ID).lean();
        if (!examDocument?.examData?.questions?.length) {
            throw new Error(`Mongo exam ${EXAM_ID} was not found or has no questions.`);
        }

        const [examRows] = await connection.query(
            `SELECT id, title, teacher_id, pass_score, duration_minutes
             FROM exams
             WHERE id = ?
             LIMIT 1`,
            [EXAM_ID]
        );
        if (examRows.length === 0) {
            throw new Error(`MySQL exam ${EXAM_ID} was not found.`);
        }
        const exam = examRows[0];

        const [preservedRows] = await connection.query(
            `SELECT er.id
             FROM exam_results er
             JOIN users u ON u.id = er.student_id
             WHERE er.exam_id = ? AND u.username = ?
             LIMIT 1`,
            [EXAM_ID, PRESERVED_USERNAME]
        );
        if (preservedRows.length === 0) {
            throw new Error(`Student ${PRESERVED_USERNAME} does not have an existing submission to preserve.`);
        }

        const [students] = await connection.query(
            `SELECT u.id, u.username, u.name, u.lastname, st.group_id
             FROM users u
             JOIN students st ON st.id = u.id
             JOIN exam_groups eg ON eg.group_id = st.group_id
             WHERE eg.exam_id = ?
               AND CAST(u.username AS UNSIGNED) BETWEEN ? AND ?
               AND u.username <> ?
             GROUP BY u.id, u.username, u.name, u.lastname, st.group_id
             ORDER BY CAST(u.username AS UNSIGNED) ASC`,
            [EXAM_ID, USERNAME_START, USERNAME_END, PRESERVED_USERNAME]
        );
        if (students.length === 0) {
            throw new Error(`No eligible students found for usernames ${USERNAME_START}-${USERNAME_END}.`);
        }

        const studentIds = students.map((student) => student.id);
        await connection.beginTransaction();

        const [oldResults] = await connection.query(
            `SELECT id
             FROM exam_results
             WHERE exam_id = ? AND student_id IN (?)`,
            [EXAM_ID, studentIds]
        );
        const oldResultIds = oldResults.map((row) => row.id);

        if (oldResultIds.length > 0) {
            await connection.query('DELETE FROM question_results WHERE exam_result_id IN (?)', [oldResultIds]);
            await connection.query('DELETE FROM correction_documents WHERE exam_result_id IN (?)', [oldResultIds]);
            await connection.query('DELETE FROM exam_results WHERE id IN (?)', [oldResultIds]);
        }
        await connection.query('DELETE FROM exam_sessions WHERE exam_id = ? AND student_id IN (?)', [EXAM_ID, studentIds]);

        await CorrectionDocument.deleteMany({ examId: EXAM_ID, studentId: { $in: studentIds } });
        await ExamStatisticsSnapshot.deleteOne({ examId: EXAM_ID });

        const now = new Date();
        const examEnd = new Date(now.getTime() - (5 * 60 * 1000));
        const durationMinutes = Number(exam.duration_minutes || 90);
        const examStart = new Date(examEnd.getTime() - (durationMinutes * 60 * 1000));
        await connection.query(
            `UPDATE exams
             SET status = 'ENDED',
                 start_time = ?,
                 end_time = ?
             WHERE id = ?`,
            [toMysqlDate(examStart), toMysqlDate(examEnd), EXAM_ID]
        );

        const windowMs = Math.max(1, examEnd - examStart);
        for (const [studentIndex, student] of students.entries()) {
            const rand = seededRandom(Number(student.username) + 808);
            const progress = (studentIndex + 1) / (students.length + 2);
            const spread = ((rand() - 0.5) * 0.12);
            const submittedAt = new Date(examStart.getTime() + clamp(progress + spread, 0.08, 0.96) * windowMs);
            const workMinutes = clamp(38 + Math.floor(rand() * 49) + Math.floor(getAbility(student, studentIndex) * 10), 28, durationMinutes);
            const startedAt = new Date(Math.max(examStart.getTime(), submittedAt.getTime() - (workMinutes * 60 * 1000)));
            const submission = buildSubmission(examDocument, student, studentIndex);
            const graded = gradingService.gradeExam(examDocument, submission);
            const percentageScore = graded.maxScore > 0 ? Math.max(0, (graded.totalScore / graded.maxScore) * 100) : 0;
            const passScore = Number(exam.pass_score || graded.maxScore / 2);
            const passStatus = graded.totalScore >= passScore ? 'PASS' : 'FAIL';

            const [sessionResult] = await connection.query(
                `INSERT INTO exam_sessions (exam_id, student_id, start_time, end_time, status)
                 VALUES (?, ?, ?, ?, 'SUBMITTED')`,
                [EXAM_ID, student.id, toMysqlDate(startedAt), toMysqlDate(submittedAt)]
            );

            const [examResult] = await connection.query(
                `INSERT INTO exam_results
                 (student_id, exam_id, session_id, score, max_score, percentage_score, pass_status, submitted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    student.id,
                    EXAM_ID,
                    sessionResult.insertId,
                    graded.totalScore,
                    graded.maxScore,
                    percentageScore,
                    passStatus,
                    toMysqlDate(submittedAt),
                ]
            );

            const questionRows = graded.gradedQuestions.map((question) => [
                examResult.insertId,
                question.questionId,
                JSON.stringify(question.studentAnswer ?? null),
                question.isCorrect ? 1 : 0,
                JSON.stringify(question.studentAnswer ?? null),
                JSON.stringify(question.correctAnswer ?? null),
                question.score,
                question.maxScore,
                question.status,
            ]);

            await connection.query(
                `INSERT INTO question_results
                 (exam_result_id, question_id, selected_choice, is_correct, student_answer_json, correct_answer_json, awarded_score, max_score, grading_status)
                 VALUES ?`,
                [questionRows]
            );

            await createCorrectionDocument({
                examResultId: examResult.insertId,
                exam: { title: exam.title },
                studentId: student.id,
                examId: EXAM_ID,
                submittedAt,
                score: graded.totalScore,
                maxScore: graded.maxScore,
                passStatus,
                questions: (examDocument.examData.questions || []).map((question) => {
                    const result = graded.gradedQuestions.find((item) => item.questionId === question.id) || {};
                    return {
                        question_id: question.id,
                        text: question.text,
                        student_answer: result.studentAnswer ?? null,
                        correct_answer: result.correctAnswer ?? null,
                        awarded_score: result.score ?? 0,
                        max_score: result.maxScore ?? 0,
                        status: result.status ?? 'incorrect',
                        explanation: question.explanation || '',
                    };
                }),
                connection,
            });

            createdResults += 1;
        }

        await connection.commit();

        const statistics = await getStoredOrGenerateStatisticsSnapshot(EXAM_ID, exam.teacher_id);
        console.log(JSON.stringify({
            examId: EXAM_ID,
            preservedStudent: PRESERVED_USERNAME,
            seededUsernameRange: `${USERNAME_START}-${USERNAME_END}`,
            seededStudents: students.length,
            createdResults,
            statisticsReady: Boolean(statistics?.ready),
            averageGrade: statistics?.payload?.global?.average_grade,
            medianGrade: statistics?.payload?.global?.median_grade,
            standardDeviation: statistics?.payload?.global?.standard_deviation,
            passRate: statistics?.payload?.global?.pass_rate,
            submittedStudents: statistics?.payload?.global?.submitted_students,
            eligibleStudents: statistics?.payload?.global?.eligible_students,
        }, null, 2));
    } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
    } finally {
        connection.release();
        await pool.end();
        await mongoose.disconnect();
    }
};

main().catch((error) => {
    console.error('[seedExam8StatisticsDemo] Failed:', error);
    process.exit(1);
});
