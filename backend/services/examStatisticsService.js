const pool = require('../config/dbConnect');
const Exam = require('../models/Exam');
const ExamStatisticsSnapshot = require('../models/ExamStatisticsSnapshot');
const gradingService = require('./gradingService');
const { createCorrectionDocument } = require('./correctionDocumentService');

const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

const computeMedian = (values) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
};

const computeStdDev = (values, mean) => {
    if (values.length === 0) return 0;
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
    return Math.sqrt(variance);
};

const computeQuantile = (values, quantile) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (sorted.length - 1) * quantile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] + ((sorted[upper] - sorted[lower]) * weight);
};

const pearson = (x, y) => {
    if (x.length !== y.length || x.length < 2) return 0;
    const meanX = x.reduce((a, b) => a + b, 0) / x.length;
    const meanY = y.reduce((a, b) => a + b, 0) / y.length;
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < x.length; i += 1) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        numerator += dx * dy;
        denomX += dx * dx;
        denomY += dy * dy;
    }

    if (denomX === 0 || denomY === 0) return 0;
    return numerator / Math.sqrt(denomX * denomY);
};

const buildScoreDistribution = (scores, maxScore) => {
    if (scores.length === 0) return [];
    const bucketSize = maxScore > 0 ? Math.max(1, Math.ceil(maxScore / 5)) : 5;
    const buckets = new Map();
    scores.forEach((score) => {
        const start = Math.floor(score / bucketSize) * bucketSize;
        const end = start + bucketSize;
        const key = `${start}-${end}`;
        buckets.set(key, (buckets.get(key) || 0) + 1);
    });

    return [...buckets.entries()].map(([range, count]) => ({ range, count }));
};

const buildSubmissionTimeline = (rows) => rows.reduce((timeline, row) => {
    const stamp = row.submitted_at ? new Date(row.submitted_at) : null;
    if (!stamp || Number.isNaN(stamp.getTime())) return timeline;
    const bucket = stamp.toISOString().slice(0, 13) + ':00';
    const existing = timeline.find((entry) => entry.bucket === bucket);
    if (existing) {
        existing.count += 1;
    } else {
        timeline.push({ bucket, count: 1 });
    }
    return timeline;
}, []);

const getPerformanceBand = (percentage) => {
    if (percentage >= 85) return 'excellent';
    if (percentage >= 70) return 'strong';
    if (percentage >= 50) return 'developing';
    return 'at_risk';
};

const getDifficultyLabel = (successRate) => {
    if (successRate >= 80) return 'very_easy';
    if (successRate >= 65) return 'easy';
    if (successRate >= 45) return 'balanced';
    if (successRate >= 25) return 'hard';
    return 'very_hard';
};

const parseStoredJsonValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value !== 'string') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
};

const synchronizeExamLifecycleStatus = async (exam, { allSubmitted }) => {
    const currentStatus = String(exam.status || '').toUpperCase();
    if (currentStatus !== 'LIVE') {
        return currentStatus;
    }

    if (!allSubmitted) {
        return currentStatus;
    }

    await pool.query(
        `UPDATE exams
         SET status = 'ENDED'
         WHERE id = ? AND status = 'LIVE'`,
        [exam.id]
    );

    return 'ENDED';
};

const finalizeMissingExamResultsIfNeeded = async ({ examId, exam, eligibleRows, submittedIds }) => {
    const missingStudents = eligibleRows.filter((row) => !submittedIds.has(row.student_id));
    if (missingStudents.length === 0) {
        return;
    }

    const examDocument = await Exam.findById(examId).lean();
    if (!examDocument?.examData?.questions?.length) {
        return;
    }

    const maxScore = gradingService.calculateExamMaxScore(examDocument);
    const scoringDefaults = examDocument.examData.scoringDefaults || { correct: 1, incorrect: -0.5, unanswered: 0 };
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        for (const student of missingStudents) {
            const [alreadyCreatedRows] = await connection.query(
                `SELECT id
                 FROM exam_results
                 WHERE exam_id = ? AND student_id = ?
                 LIMIT 1
                 FOR UPDATE`,
                [examId, student.student_id]
            );
            if (alreadyCreatedRows.length > 0) {
                continue;
            }

            const [sessionRows] = await connection.query(
                `SELECT id, status
                 FROM exam_sessions
                 WHERE exam_id = ? AND student_id = ?
                 ORDER BY id DESC
                 LIMIT 1
                 FOR UPDATE`,
                [examId, student.student_id]
            );

            let sessionId = null;
            if (sessionRows.length > 0) {
                sessionId = sessionRows[0].id;
                if (sessionRows[0].status !== 'SUBMITTED') {
                    await connection.query(
                        `UPDATE exam_sessions
                         SET status = 'EXPIRED',
                             end_time = COALESCE(end_time, ?)
                         WHERE id = ?`,
                        [exam.end_time, sessionId]
                    );
                }
            } else {
                const [insertSessionResult] = await connection.query(
                    `INSERT INTO exam_sessions (exam_id, student_id, start_time, end_time, status)
                     VALUES (?, ?, ?, ?, 'EXPIRED')`,
                    [examId, student.student_id, exam.end_time, exam.end_time]
                );
                sessionId = insertSessionResult.insertId;
            }

            const [insertResultRes] = await connection.query(
                `INSERT INTO exam_results
                 (student_id, exam_id, score, max_score, percentage_score, pass_status, session_id, submitted_at)
                 VALUES (?, ?, 0, ?, 0, 'FAIL', ?, ?)`,
                [student.student_id, examId, maxScore, sessionId, exam.end_time]
            );
            const examResultId = insertResultRes.insertId;

            const zeroQuestionRows = examDocument.examData.questions.map((question) => {
                const weights = gradingService.getQuestionWeights(question, scoringDefaults);
                const correctAnswer = gradingService.getCanonicalCorrectAnswer(question);
                return [
                    examResultId,
                    question.id,
                    JSON.stringify(null),
                    0,
                    JSON.stringify(null),
                    JSON.stringify(correctAnswer ?? null),
                    0,
                    weights.correct,
                    'incorrect',
                ];
            });

            await connection.query(
                `INSERT INTO question_results
                 (exam_result_id, question_id, selected_choice, is_correct, student_answer_json, correct_answer_json, awarded_score, max_score, grading_status)
                 VALUES ?`,
                [zeroQuestionRows]
            );

            await createCorrectionDocument({
                examResultId,
                exam: { title: exam.title },
                studentId: student.student_id,
                examId,
                submittedAt: new Date(exam.end_time),
                score: 0,
                maxScore,
                passStatus: 'FAIL',
                questions: examDocument.examData.questions.map((question) => {
                    const weights = gradingService.getQuestionWeights(question, scoringDefaults);
                    return {
                        question_id: question.id,
                        text: question.text,
                        student_answer: null,
                        correct_answer: gradingService.getCanonicalCorrectAnswer(question),
                        awarded_score: 0,
                        max_score: weights.correct,
                        status: 'incorrect',
                        explanation: question.explanation || '',
                    };
                }),
                connection,
            });
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const getExamReadiness = async (examId, teacherId = null) => {
    const examFilter = teacherId ? 'AND e.teacher_id = ?' : '';
    const examParams = teacherId ? [examId, teacherId] : [examId];
    const [examRows] = await pool.query(
        `SELECT e.id, e.title, e.teacher_id, e.end_time, e.start_time, e.pass_score, e.status
         FROM exams e
         WHERE e.id = ? ${examFilter}
         LIMIT 1`,
        examParams
    );

    if (examRows.length === 0) {
        return null;
    }

    const exam = examRows[0];
    const [eligibleRows] = await pool.query(
        `SELECT
             u.id AS student_id,
             u.username,
             u.name AS first_name,
             u.lastname AS last_name,
             CONCAT(u.name, ' ', u.lastname) AS name
         FROM exam_groups eg
         JOIN students st ON st.group_id = eg.group_id
         JOIN users u ON u.id = st.id
         WHERE eg.exam_id = ?
         GROUP BY u.id, u.username, u.name, u.lastname
         ORDER BY u.lastname ASC, u.name ASC`,
        [examId]
    );
    const now = new Date();
    const examEnded = Boolean(exam.end_time) && new Date(exam.end_time) <= now;
    let [submittedRows] = await pool.query(
        `SELECT DISTINCT er.student_id
         FROM exam_results er
         WHERE er.exam_id = ?`,
        [examId]
    );
    let submittedIds = new Set(submittedRows.map((row) => row.student_id));

    if (examEnded) {
        await finalizeMissingExamResultsIfNeeded({ examId, exam, eligibleRows, submittedIds });
        [submittedRows] = await pool.query(
            `SELECT DISTINCT er.student_id
             FROM exam_results er
             WHERE er.exam_id = ?`,
            [examId]
        );
        submittedIds = new Set(submittedRows.map((row) => row.student_id));
    }

    const pendingStudents = eligibleRows
        .filter((row) => !submittedIds.has(row.student_id))
        .map((row) => ({
            student_id: row.student_id,
            username: row.username,
            name: row.name,
        }));

    const eligibleStudents = eligibleRows.length;
    const submittedStudents = submittedRows.length;
    const allSubmitted = eligibleStudents > 0 && submittedStudents >= eligibleStudents;
    const lifecycleStatus = await synchronizeExamLifecycleStatus(exam, { allSubmitted });
    const examCompleted = lifecycleStatus === 'ENDED'
        || (examEnded && (lifecycleStatus === 'CLOSED' || lifecycleStatus === 'LIVE'));
    const ready = examCompleted && allSubmitted;

    return {
        exam: {
            id: exam.id,
            title: exam.title,
            teacher_id: exam.teacher_id,
            start_time: exam.start_time,
            end_time: exam.end_time,
            pass_score: exam.pass_score,
            status: lifecycleStatus,
        },
        examEnded: examCompleted,
        allSubmitted,
        eligibleStudents,
        submittedStudents,
        pendingStudents,
        lifecycleStatus,
        ready,
    };
};

const buildStudentInsightMap = ({ students, global, questions }) => {
    const sorted = [...students].sort((a, b) => b.score - a.score);
    return Object.fromEntries(sorted.map((student, index) => {
        const percentile = sorted.length <= 1
            ? 100
            : round(((sorted.length - (index + 1)) / (sorted.length - 1)) * 100);
        const strongestQuestions = [...student.question_breakdown]
            .sort((a, b) => b.awarded_score - a.awarded_score)
            .slice(0, 3)
            .map((item) => {
                const question = questions.find((questionEntry) => questionEntry.question_id === item.question_id);
                return {
                    ...item,
                    index: question?.index || null,
                    text: question?.text || '',
                    cohort_success_rate: question?.success_rate || 0,
                    difficulty_label: question?.difficulty_label || 'balanced',
                };
            });
        const weakestQuestions = [...student.question_breakdown]
            .sort((a, b) => a.awarded_score - b.awarded_score)
            .slice(0, 3)
            .map((item) => {
                const question = questions.find((questionEntry) => questionEntry.question_id === item.question_id);
                return {
                    ...item,
                    index: question?.index || null,
                    text: question?.text || '',
                    cohort_success_rate: question?.success_rate || 0,
                    difficulty_label: question?.difficulty_label || 'balanced',
                };
            });

        return [String(student.student_id), {
            rank: index + 1,
            percentile,
            cohort_average: global.average_grade,
            cohort_median: global.median_grade,
            score_gap_to_average: round(student.score - global.average_grade),
            strongest_questions: strongestQuestions,
            weakest_questions: weakestQuestions,
        }];
    }));
};

const generateAndStoreStatisticsSnapshot = async (examId, teacherId, { allowPartial = false } = {}) => {
    const readiness = await getExamReadiness(examId);
    if (!readiness) {
        return null;
    }

    if (!readiness.ready && !allowPartial) {
        return {
            ready: false,
            readiness,
        };
    }

    const [resultRows] = await pool.query(
        `SELECT er.id, er.student_id, er.score, er.max_score, er.percentage_score, er.pass_status, er.submitted_at,
                u.name, u.lastname, u.username
         FROM exam_results er
         JOIN users u ON u.id = er.student_id
         WHERE er.exam_id = ?
         ORDER BY er.submitted_at ASC`,
        [examId]
    );

    if (!readiness.ready && resultRows.length === 0) {
        return {
            ready: false,
            readiness,
            payload: null,
        };
    }

    const [questionRows] = await pool.query(
        `SELECT qr.exam_result_id, qr.question_id, qr.is_correct, qr.student_answer_json, qr.correct_answer_json,
                qr.awarded_score, qr.max_score, qr.grading_status
         FROM question_results qr
         JOIN exam_results er ON er.id = qr.exam_result_id
         WHERE er.exam_id = ?`,
        [examId]
    );

    const examDocument = await Exam.findById(examId).lean();
    const examQuestions = examDocument?.examData?.questions || [];
    const scores = resultRows.map((row) => Number(row.score));
    const meanScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const medianScore = computeMedian(scores);
    const stdDev = computeStdDev(scores, meanScore);
    const q1Score = computeQuantile(scores, 0.25);
    const q3Score = computeQuantile(scores, 0.75);
    const passCount = resultRows.filter((row) => row.pass_status === 'PASS').length;
    const failCount = resultRows.length - passCount;
    const maxScore = resultRows[0]?.max_score || examQuestions.length || 0;
    const averagePercentage = resultRows.length
        ? resultRows.reduce((sum, row) => sum + Number(row.percentage_score || 0), 0) / resultRows.length
        : 0;

    const rowsByResult = questionRows.reduce((map, row) => {
        if (!map.has(row.exam_result_id)) map.set(row.exam_result_id, []);
        map.get(row.exam_result_id).push(row);
        return map;
    }, new Map());

    const rowsByQuestion = questionRows.reduce((map, row) => {
        if (!map.has(row.question_id)) map.set(row.question_id, []);
        map.get(row.question_id).push(row);
        return map;
    }, new Map());

    const questionStatsMap = new Map();
    examQuestions.forEach((question, index) => {
        questionStatsMap.set(question.id, {
            question_id: question.id,
            index: index + 1,
            text: question.text,
            type: question.type,
            correct_count: 0,
            incorrect_count: 0,
            partial_count: 0,
            total_attempts: 0,
            awarded_scores: [],
            weighted_scores: [],
            optionSelections: new Map(),
            wrongSelections: new Map(),
        });
    });

    questionRows.forEach((row) => {
        const stats = questionStatsMap.get(row.question_id);
        if (!stats) return;
        stats.total_attempts += 1;
        const awardedScore = Number(row.awarded_score) || 0;
        const questionMaxScore = Number(row.max_score) || 0;
        const weightedScore = questionMaxScore > 0 ? awardedScore / questionMaxScore : 0;
        stats.awarded_scores.push(awardedScore);
        stats.weighted_scores.push(weightedScore);

        if (row.grading_status === 'correct') stats.correct_count += 1;
        else if (row.grading_status === 'partial') stats.partial_count += 1;
        else stats.incorrect_count += 1;

        const studentAnswer = parseStoredJsonValue(row.student_answer_json);
        const collect = (targetMap, value) => {
            const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
            targetMap.set(key, (targetMap.get(key) || 0) + 1);
        };

        if (Array.isArray(studentAnswer)) {
            studentAnswer.forEach((value) => {
                collect(stats.optionSelections, value);
                if (row.grading_status !== 'correct') collect(stats.wrongSelections, value);
            });
        } else if (studentAnswer !== null && studentAnswer !== undefined && studentAnswer !== '') {
            collect(stats.optionSelections, studentAnswer);
            if (row.grading_status !== 'correct') collect(stats.wrongSelections, studentAnswer);
        }
    });

    const sortedResults = [...resultRows].sort((a, b) => b.score - a.score);
    const groupSize = Math.max(1, Math.floor(sortedResults.length * 0.27));
    const topGroup = new Set(sortedResults.slice(0, groupSize).map((row) => row.id));
    const bottomGroup = new Set(sortedResults.slice(-groupSize).map((row) => row.id));

    const students = resultRows.map((row) => {
        const answers = rowsByResult.get(row.id) || [];
        const correct = answers.filter((answer) => answer.grading_status === 'correct').length;
        const partial = answers.filter((answer) => answer.grading_status === 'partial').length;
        const incorrect = answers.filter((answer) => answer.grading_status === 'incorrect').length;
        const completionRate = examQuestions.length > 0 ? ((correct + partial + incorrect) / examQuestions.length) * 100 : 0;
        const accuracyRate = examQuestions.length > 0 ? ((correct + (partial * 0.5)) / examQuestions.length) * 100 : 0;
        const normalizedQuestionScores = answers.map((answer) => (Number(answer.max_score) > 0 ? Number(answer.awarded_score) / Number(answer.max_score) : 0));
        const consistencyScore = normalizedQuestionScores.length
            ? Math.max(0, 100 - (computeStdDev(normalizedQuestionScores, normalizedQuestionScores.reduce((sum, value) => sum + value, 0) / normalizedQuestionScores.length) * 100))
            : 0;

        return {
            student_id: row.student_id,
            username: row.username,
            name: `${row.name} ${row.lastname}`.trim(),
            score: round(row.score),
            max_score: round(row.max_score),
            percentage_score: round(row.percentage_score),
            pass_status: row.pass_status,
            correct_answers: correct,
            partial_answers: partial,
            incorrect_answers: incorrect,
            completion_rate: round(completionRate),
            weighted_accuracy: round(accuracyRate),
            normalized_score: maxScore > 0 ? round((Number(row.score) / maxScore) * 100) : 0,
            performance_band: getPerformanceBand(Number(row.percentage_score || 0)),
            consistency_score: round(consistencyScore),
            question_breakdown: answers.map((answer) => ({
                question_id: answer.question_id,
                grading_status: answer.grading_status,
                awarded_score: round(answer.awarded_score),
                max_score: round(answer.max_score),
            })),
        };
    });

    const questions = [...questionStatsMap.values()].map((stats) => {
        const successRate = stats.total_attempts
            ? ((stats.correct_count + (stats.partial_count * 0.5)) / stats.total_attempts) * 100
            : 0;
        const difficultyIndex = successRate / 100;
        const ambiguityFlag = difficultyIndex > 0.35 && difficultyIndex < 0.65 && stats.partial_count > 0;

        let topWeighted = 0;
        let bottomWeighted = 0;
        let topCount = 0;
        let bottomCount = 0;
        (rowsByQuestion.get(stats.question_id) || []).forEach((row) => {
            const normalizedScore = Number(row.max_score) > 0 ? Number(row.awarded_score) / Number(row.max_score) : 0;
            if (topGroup.has(row.exam_result_id)) {
                topCount += 1;
                topWeighted += normalizedScore;
            }
            if (bottomGroup.has(row.exam_result_id)) {
                bottomCount += 1;
                bottomWeighted += normalizedScore;
            }
        });

        const distractors = [...stats.optionSelections.entries()]
            .map(([choice, count]) => ({
                choice,
                count,
                percentage: stats.total_attempts ? round((count / stats.total_attempts) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count);
        const wrongDistractors = [...stats.wrongSelections.entries()]
            .map(([choice, count]) => ({
                choice,
                count,
                percentage: stats.total_attempts ? round((count / stats.total_attempts) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count);
        const averageAwardedScore = stats.awarded_scores.reduce((sum, value) => sum + value, 0) / (stats.awarded_scores.length || 1);
        const medianAwardedScore = computeMedian(stats.awarded_scores);
        const scoreStdDev = computeStdDev(stats.awarded_scores, averageAwardedScore);
        const partialRate = stats.total_attempts ? (stats.partial_count / stats.total_attempts) * 100 : 0;
        const volatilityIndex = stats.weighted_scores.length ? computeStdDev(stats.weighted_scores, difficultyIndex) : 0;

        return {
            question_id: stats.question_id,
            index: stats.index,
            text: stats.text,
            type: stats.type,
            total_attempts: stats.total_attempts,
            correct_count: stats.correct_count,
            partial_count: stats.partial_count,
            incorrect_count: stats.incorrect_count,
            success_rate: round(successRate),
            partial_rate: round(partialRate),
            difficulty_index: round(difficultyIndex, 3),
            difficulty_label: getDifficultyLabel(successRate),
            discrimination_index: round((topCount ? topWeighted / topCount : 0) - (bottomCount ? bottomWeighted / bottomCount : 0), 3),
            average_awarded_score: round(averageAwardedScore),
            median_awarded_score: round(medianAwardedScore),
            awarded_score_std_dev: round(scoreStdDev),
            most_common_wrong_answer: wrongDistractors[0]?.choice || null,
            distractor_analysis: distractors,
            wrong_answer_distribution: wrongDistractors,
            time_spent_seconds_avg: null,
            ambiguous_flag: ambiguityFlag,
            mastery_gap: round(100 - successRate),
            volatility_index: round(volatilityIndex, 3),
        };
    }).sort((a, b) => a.success_rate - b.success_rate);

    const questionCorrelations = examQuestions.map((questionA) => ({
        question_id: questionA.id,
        correlations: examQuestions
            .filter((questionB) => questionB.id !== questionA.id)
            .map((questionB) => {
                const seriesA = resultRows.map((result) => {
                    const row = (rowsByResult.get(result.id) || []).find((item) => item.question_id === questionA.id);
                    return row && Number(row.max_score) > 0 ? Number(row.awarded_score) / Number(row.max_score) : 0;
                });
                const seriesB = resultRows.map((result) => {
                    const row = (rowsByResult.get(result.id) || []).find((item) => item.question_id === questionB.id);
                    return row && Number(row.max_score) > 0 ? Number(row.awarded_score) / Number(row.max_score) : 0;
                });

                return {
                    with_question_id: questionB.id,
                    correlation: round(pearson(seriesA, seriesB), 3),
                };
            })
            .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
            .slice(0, 5),
    }));

    const global = {
        students_count: resultRows.length,
        eligible_students: readiness.eligibleStudents,
        submitted_students: readiness.submittedStudents,
        average_grade: round(meanScore),
        average_percentage: round(averagePercentage),
        highest_grade: round(Math.max(...scores, 0)),
        lowest_grade: round(scores.length ? Math.min(...scores) : 0),
        median_grade: round(medianScore),
        quartile_1: round(q1Score),
        quartile_3: round(q3Score),
        interquartile_range: round(q3Score - q1Score),
        standard_deviation: round(stdDev),
        pass_rate: resultRows.length ? round((passCount / resultRows.length) * 100) : 0,
        fail_rate: resultRows.length ? round((failCount / resultRows.length) * 100) : 0,
        score_distribution: buildScoreDistribution(scores, maxScore),
        submission_timeline: buildSubmissionTimeline(resultRows),
        completion_rate: readiness.eligibleStudents ? round((readiness.submittedStudents / readiness.eligibleStudents) * 100) : 0,
        pass_threshold: round(readiness.exam.pass_score ?? (maxScore / 2)),
        performance_bands: students.reduce((bands, student) => {
            bands[student.performance_band] = (bands[student.performance_band] || 0) + 1;
            return bands;
        }, {}),
        insights: {
            hardest_question_id: questions[0]?.question_id || null,
            easiest_question_id: questions[questions.length - 1]?.question_id || null,
            most_discriminating_question_id: [...questions].sort((a, b) => b.discrimination_index - a.discrimination_index)[0]?.question_id || null,
            highest_variance_question_id: [...questions].sort((a, b) => b.awarded_score_std_dev - a.awarded_score_std_dev)[0]?.question_id || null,
        },
    };

    const studentInsights = buildStudentInsightMap({ students, global, questions });

    const payload = {
        exam: {
            id: readiness.exam.id,
            title: readiness.exam.title,
            due_date: readiness.exam.end_time,
            generated_at: new Date().toISOString(),
        },
        readiness: {
            examEnded: readiness.examEnded,
            allSubmitted: readiness.allSubmitted,
            eligibleStudents: readiness.eligibleStudents,
            submittedStudents: readiness.submittedStudents,
            pendingStudents: readiness.pendingStudents,
            finalSnapshot: readiness.ready,
        },
        global,
        students: students.map((student) => ({
            ...student,
            ...studentInsights[String(student.student_id)],
        })),
        questions,
        rankings: {
            hardest_to_easiest: questions.map((question) => ({
                question_id: question.question_id,
                index: question.index,
                success_rate: question.success_rate,
            })),
            most_discriminating: [...questions]
                .sort((a, b) => b.discrimination_index - a.discrimination_index)
                .slice(0, 5)
                .map((question) => ({
                    question_id: question.question_id,
                    index: question.index,
                    discrimination_index: question.discrimination_index,
                })),
        },
        correlations: questionCorrelations,
        studentInsights,
    };

    const snapshot = await ExamStatisticsSnapshot.findOneAndUpdate(
        { examId },
        {
            examId,
            teacherId,
            status: readiness.ready ? 'ready' : 'pending',
            generatedAt: new Date(),
            readiness: {
                examEnded: readiness.examEnded,
                allSubmitted: readiness.allSubmitted,
                eligibleStudents: readiness.eligibleStudents,
                submittedStudents: readiness.submittedStudents,
                pendingStudents: readiness.pendingStudents,
            },
            payload,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return {
        ready: true,
        finalSnapshot: readiness.ready,
        readiness,
        snapshot,
        payload,
    };
};

const getStoredOrGenerateStatisticsSnapshot = async (examId, teacherId, { allowPartial = false } = {}) => {
    const readiness = await getExamReadiness(examId);
    if (!readiness) return null;

    const existing = await ExamStatisticsSnapshot.findOne({ examId }).lean();
    if (existing && readiness.ready) {
        return {
            ready: true,
            readiness,
            snapshot: existing,
            payload: existing.payload,
        };
    }

    if (allowPartial) {
        return generateAndStoreStatisticsSnapshot(examId, teacherId, { allowPartial: true });
    }

    if (!readiness.ready) {
        return {
            ready: false,
            readiness,
            snapshot: existing,
            payload: existing?.payload || null,
        };
    }

    return generateAndStoreStatisticsSnapshot(examId, teacherId);
};

module.exports = {
    getExamReadiness,
    getStoredOrGenerateStatisticsSnapshot,
};
