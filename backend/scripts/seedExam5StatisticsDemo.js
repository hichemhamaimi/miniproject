require('dotenv').config();

const mongoose = require('mongoose');
const pool = require('../config/dbConnect');
const Exam = require('../models/Exam');
const CorrectionDocument = require('../models/CorrectionDocument');
const ExamStatisticsSnapshot = require('../models/ExamStatisticsSnapshot');
const gradingService = require('../services/gradingService');
const { createCorrectionDocument } = require('../services/correctionDocumentService');
const { getStoredOrGenerateStatisticsSnapshot } = require('../services/examStatisticsService');

const EXAM_ID = 5;
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

const getWrongOption = (question, rand) => {
    const correct = gradingService.getCanonicalCorrectAnswer(question);
    const correctSet = new Set(Array.isArray(correct) ? correct : [correct]);
    const wrongOptions = (question.options || []).filter((option) => !correctSet.has(option));
    if (wrongOptions.length > 0) {
        return wrongOptions[Math.floor(rand() * wrongOptions.length)];
    }
    return null;
};

const buildAnswerForQuestion = (question, rand, shouldBeCorrect, partialChance) => {
    const correct = gradingService.getCanonicalCorrectAnswer(question);

    if (!shouldBeCorrect && rand() < 0.08) {
        return null;
    }

    switch (question.type) {
        case 'single_choice':
        case 'negative_qcm':
            return shouldBeCorrect ? correct : getWrongOption(question, rand);

        case 'multiple_choice': {
            const correctAnswers = Array.isArray(correct) ? correct : [];
            const wrongOptions = (question.options || []).filter((option) => !correctAnswers.includes(option));
            if (shouldBeCorrect) return correctAnswers;
            if (rand() < partialChance && correctAnswers.length > 0) {
                const answer = [correctAnswers[0]];
                if (wrongOptions.length && rand() < 0.45) answer.push(wrongOptions[0]);
                return answer;
            }
            return wrongOptions.length ? [wrongOptions[Math.floor(rand() * wrongOptions.length)]] : [];
        }

        case 'true_false':
            return shouldBeCorrect ? Boolean(correct) : !Boolean(correct);

        case 'matching': {
            const pairs = Array.isArray(correct) ? correct : [];
            if (shouldBeCorrect) return pairs;
            const rights = rotate(pairs.map((pair) => pair.right), Math.max(1, Math.floor(rand() * pairs.length)));
            return pairs.map((pair, index) => ({
                left: pair.left,
                right: rand() < partialChance ? pair.right : rights[index],
            }));
        }

        case 'ordering': {
            const ordered = Array.isArray(correct) ? correct : [];
            if (shouldBeCorrect) return ordered;
            if (rand() < partialChance && ordered.length > 2) {
                const almost = [...ordered];
                [almost[almost.length - 1], almost[almost.length - 2]] = [almost[almost.length - 2], almost[almost.length - 1]];
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
    const baseAbility = 0.32 + ((studentIndex % 17) / 16) * 0.55;
    const groupAdjustment = ((student.group_id || 0) % 3) * 0.035;
    const ability = Math.max(0.18, Math.min(0.92, baseAbility + groupAdjustment + ((rand() - 0.5) * 0.12)));

    return questions.map((question, questionIndex) => {
        const difficulty = 0.12 + ((questionIndex % 7) * 0.045);
        const correctProbability = Math.max(0.12, Math.min(0.96, ability - difficulty + (rand() * 0.16)));
        const shouldBeCorrect = rand() < correctProbability;
        const partialChance = Math.max(0.12, Math.min(0.55, ability - 0.25));
        return {
            questionId: question.id,
            answer: buildAnswerForQuestion(question, rand, shouldBeCorrect, partialChance),
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
            `SELECT id, title, teacher_id, pass_score
             FROM exams
             WHERE id = ?
             LIMIT 1`,
            [EXAM_ID]
        );
        if (examRows.length === 0) {
            throw new Error(`MySQL exam ${EXAM_ID} was not found.`);
        }
        const exam = examRows[0];

        const [students] = await connection.query(
            `SELECT u.id, u.username, u.name, u.lastname, st.group_id
             FROM users u
             JOIN students st ON st.id = u.id
             JOIN exam_groups eg ON eg.group_id = st.group_id
             WHERE eg.exam_id = ?
               AND CAST(u.username AS UNSIGNED) BETWEEN ? AND ?
             GROUP BY u.id, u.username, u.name, u.lastname, st.group_id
             ORDER BY CAST(u.username AS UNSIGNED) ASC`,
            [EXAM_ID, USERNAME_START, USERNAME_END]
        );
        if (students.length === 0) {
            throw new Error(`No eligible students found for usernames ${USERNAME_START}-${USERNAME_END}.`);
        }

        const studentIds = students.map((student) => student.id);
        await connection.beginTransaction();

        const [oldResults] = await connection.query(
            `SELECT id, correction_document_id
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
        const examStart = new Date(examEnd.getTime() - (3 * 60 * 60 * 1000));
        await connection.query(
            `UPDATE exams
             SET status = 'ENDED',
                 start_time = ?,
                 end_time = ?
             WHERE id = ?`,
            [toMysqlDate(examStart), toMysqlDate(examEnd), EXAM_ID]
        );

        for (const [studentIndex, student] of students.entries()) {
            const rand = seededRandom(Number(student.username) + 77);
            const submittedAt = new Date(examStart.getTime() + ((studentIndex + 1) * Math.floor((examEnd - examStart) / (students.length + 2))) + Math.floor(rand() * 8 * 60 * 1000));
            const startedAt = new Date(submittedAt.getTime() - ((35 + Math.floor(rand() * 45)) * 60 * 1000));
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
            usernameRange: `${USERNAME_START}-${USERNAME_END}`,
            seededStudents: students.length,
            createdResults,
            statisticsReady: Boolean(statistics?.ready),
            averageGrade: statistics?.payload?.global?.average_grade,
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
    console.error('[seedExam5StatisticsDemo] Failed:', error);
    process.exit(1);
});
