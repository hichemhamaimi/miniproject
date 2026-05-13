const pool = require('../config/dbConnect');
const CorrectionDocument = require('../models/CorrectionDocument');

const formatDate = (value) => new Date(value).toISOString();

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeJsonParse = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return null;
    }
};

const renderAnswer = (answer) => {
    if (answer === null || answer === undefined || answer === '') {
        return '<em>Not answered</em>';
    }
    if (typeof answer === 'boolean') {
        return answer ? 'True' : 'False';
    }
    if (Array.isArray(answer)) {
        return `<pre>${escapeHtml(JSON.stringify(answer, null, 2))}</pre>`;
    }
    if (typeof answer === 'object') {
        return `<pre>${escapeHtml(JSON.stringify(answer, null, 2))}</pre>`;
    }
    return escapeHtml(answer);
};

const buildCorrectionHtml = (document) => {
    const payload = document?.payload || document || {};
    const exam = payload.exam || {};
    const student = payload.student || {};
    const moduleInfo = payload.moduleInfo || {};
    const result = payload.result || {};
    const questions = Array.isArray(payload.questions) ? payload.questions : [];

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Corrected Exam - ${escapeHtml(exam.title || 'Exam')}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #1f2937; }
    h1, h2, h3 { margin-bottom: 8px; }
    .summary { border: 1px solid #bae6fd; border-radius: 18px; padding: 22px; margin: 18px 0 24px; background: linear-gradient(135deg, #ecfeff 0%, #ffffff 55%, #eff6ff 100%); }
    .meta { display: grid; grid-template-columns: repeat(2, minmax(200px, 1fr)); gap: 12px; }
    .meta div { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: rgba(255, 255, 255, 0.78); }
    .card { border: 1px solid #dbeafe; border-radius: 16px; padding: 18px; margin-bottom: 16px; background: #f8fbff; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: bold; }
    .correct { background: #dcfce7; color: #166534; }
    .partial { background: #fef3c7; color: #92400e; }
    .incorrect { background: #fee2e2; color: #991b1b; }
    pre { white-space: pre-wrap; word-break: break-word; background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <h1>Corrected Exam Document</h1>
  <div class="summary">
    <h2>${escapeHtml(exam.title || 'Exam')}</h2>
    <div class="meta">
      <div><strong>Student name:</strong> ${escapeHtml(student.fullName || 'Unknown student')}</div>
      <div><strong>Username:</strong> ${escapeHtml(student.username || 'N/A')}</div>
      <div><strong>Group:</strong> ${escapeHtml(student.groupLabel || 'N/A')}</div>
      <div><strong>Date of birth:</strong> ${escapeHtml(student.dateOfBirth || 'N/A')}</div>
      <div><strong>Module:</strong> ${escapeHtml(moduleInfo.label || 'N/A')}</div>
      <div><strong>Submission date:</strong> ${escapeHtml(result.submittedAt ? formatDate(result.submittedAt) : '')}</div>
      <div><strong>Final grade:</strong> ${escapeHtml(result.score)} / ${escapeHtml(result.maxScore)}</div>
      <div><strong>Pass status:</strong> ${escapeHtml(result.passStatus || 'N/A')}</div>
    </div>
  </div>
  ${questions.map((question, index) => `
    <section class="card">
      <h3>Question ${index + 1}</h3>
      <p><strong>Prompt:</strong> ${escapeHtml(question.text)}</p>
      <p><strong>Status:</strong> <span class="badge ${escapeHtml(question.statusClass)}">${escapeHtml(question.statusLabel)}</span></p>
      <p><strong>Score:</strong> ${escapeHtml(question.awarded_score)} / ${escapeHtml(question.max_score)}</p>
      <p><strong>Student answer:</strong></p>
      ${renderAnswer(question.student_answer)}
      <p><strong>Correct answer:</strong></p>
      ${renderAnswer(question.correct_answer)}
      ${question.explanation ? `<p><strong>Explanation:</strong> ${escapeHtml(question.explanation)}</p>` : ''}
    </section>
  `).join('')}
</body>
</html>`;
};

const getCorrectionContext = async (examId, studentId, connection) => {
    const [rows] = await connection.query(
        `SELECT
            u.name,
            u.lastname,
            u.username,
            u.date_of_birth,
            sg.name AS group_name,
            sg.year AS group_year,
            m.name AS module_name,
            m.abbreviation AS module_abbreviation
         FROM exams e
         JOIN modules m ON m.id = e.module_id
         JOIN users u ON u.id = ?
         LEFT JOIN students st ON st.id = u.id
         LEFT JOIN student_groups sg ON sg.id = st.group_id
         WHERE e.id = ?
         LIMIT 1`,
        [studentId, examId]
    );

    if (rows.length === 0) {
        return {
            student: {
                fullName: '',
                username: '',
                dateOfBirth: '',
                groupLabel: '',
            },
            moduleInfo: {
                label: '',
            },
        };
    }

    const row = rows[0];
    return {
        student: {
            fullName: `${row.name || ''} ${row.lastname || ''}`.trim(),
            username: row.username || '',
            dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().slice(0, 10) : '',
            groupLabel: row.group_name ? `${row.group_name}${row.group_year ? ` (${row.group_year})` : ''}` : '',
        },
        moduleInfo: {
            label: row.module_name ? `${row.module_name}${row.module_abbreviation ? ` (${row.module_abbreviation})` : ''}` : '',
        },
    };
};

const normalizeQuestions = (questions = []) => questions.map((question, index) => {
    const status = question.status || question.grading_status || 'incorrect';
    return {
        ...question,
        index: Number.isInteger(question.index) ? question.index : index + 1,
        questionId: question.questionId || question.question_id || null,
        status,
        statusLabel: question.statusLabel || (status === 'correct' ? 'Correct' : status === 'partial' ? 'Partial' : 'Incorrect'),
        statusClass: question.statusClass || (status === 'correct' ? 'correct' : status === 'partial' ? 'partial' : 'incorrect'),
    };
});

const normalizeCorrectionPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    const exam = payload.exam || {
        id: payload.examId || null,
        title: payload.examTitle || '',
    };
    const student = payload.student || {
        id: payload.studentId || null,
        fullName: '',
        username: '',
        dateOfBirth: '',
        groupLabel: '',
    };
    const result = payload.result || {
        score: payload.score ?? 0,
        maxScore: payload.maxScore ?? 0,
        passStatus: payload.passStatus || null,
        submittedAt: payload.submittedAt || null,
    };

    return {
        ...payload,
        exam: {
            id: exam.id ?? payload.examId ?? null,
            title: exam.title || '',
        },
        student: {
            id: student.id ?? payload.studentId ?? null,
            fullName: student.fullName || '',
            username: student.username || '',
            dateOfBirth: student.dateOfBirth || '',
            groupLabel: student.groupLabel || '',
        },
        moduleInfo: payload.moduleInfo || { label: '' },
        result: {
            score: result.score ?? payload.score ?? 0,
            maxScore: result.maxScore ?? payload.maxScore ?? 0,
            passStatus: result.passStatus || payload.passStatus || null,
            submittedAt: result.submittedAt || payload.submittedAt || null,
        },
        questions: normalizeQuestions(payload.questions || []),
    };
};

const getLegacyCorrectionDocument = async (metadata) => {
    const legacyPayload = normalizeCorrectionPayload(safeJsonParse(metadata.document_payload));
    if (!legacyPayload) return null;

    const html = buildCorrectionHtml(legacyPayload);
    return {
        metadata: {
            id: metadata.id,
            examResultId: metadata.exam_result_id,
            examId: metadata.exam_id,
            studentId: metadata.student_id,
            fileName: metadata.file_name,
            fileType: metadata.file_type || 'application/json',
            createdAt: metadata.created_at,
        },
        payload: legacyPayload,
        html,
        source: 'legacy-sql',
    };
};

const getCorrectionDocumentBundleByResultId = async ({
    examResultId,
    studentId = null,
    examId = null,
    connection = pool,
}) => {
    const filters = ['er.id = ?'];
    const params = [examResultId];
    if (studentId !== null) {
        filters.push('er.student_id = ?');
        params.push(studentId);
    }
    if (examId !== null) {
        filters.push('er.exam_id = ?');
        params.push(examId);
    }

    const [rows] = await connection.query(
        `SELECT
            er.id AS exam_result_id,
            er.exam_id,
            er.student_id,
            cd.id,
            cd.mongo_document_id,
            cd.file_name,
            cd.file_type,
            cd.created_at,
            cd.document_payload
         FROM exam_results er
         LEFT JOIN correction_documents cd ON cd.id = er.correction_document_id
         WHERE ${filters.join(' AND ')}
         LIMIT 1`,
        params
    );

    if (rows.length === 0 || !rows[0].id) {
        return null;
    }

    const metadata = rows[0];
    let mongoDocument = null;
    if (metadata.mongo_document_id) {
        mongoDocument = await CorrectionDocument.findById(metadata.mongo_document_id).lean();
    }
    if (!mongoDocument) {
        mongoDocument = await CorrectionDocument.findOne({ examResultId }).lean();
    }

    if (mongoDocument) {
        const payload = normalizeCorrectionPayload(mongoDocument.payload);
        return {
            metadata: {
                id: metadata.id,
                examResultId: metadata.exam_result_id,
                examId: metadata.exam_id,
                studentId: metadata.student_id,
                fileName: mongoDocument.fileName || metadata.file_name,
                fileType: mongoDocument.fileType || metadata.file_type || 'application/json',
                createdAt: mongoDocument.createdAt || metadata.created_at,
            },
            payload,
            html: buildCorrectionHtml(payload),
            source: 'mongodb',
        };
    }

    return getLegacyCorrectionDocument(metadata);
};

const createCorrectionDocument = async ({
    examResultId,
    exam,
    studentId,
    examId,
    submittedAt,
    score,
    maxScore,
    passStatus = null,
    questions,
    connection = pool,
}) => {
    const { student, moduleInfo } = await getCorrectionContext(examId, studentId, connection);
    const payload = normalizeCorrectionPayload({
        examResultId,
        exam: {
            id: examId,
            title: exam?.title || '',
        },
        student: {
            id: studentId,
            ...student,
        },
        moduleInfo,
        result: {
            score,
            maxScore,
            passStatus: passStatus || (score >= (maxScore / 2) ? 'PASS' : 'FAIL'),
            submittedAt,
        },
        questions,
        generatedAt: new Date().toISOString(),
    });
    const html = buildCorrectionHtml(payload);
    const fileName = `exam-result-${examResultId}.json`;

    const mongoDocument = await CorrectionDocument.findOneAndUpdate(
        { examResultId },
        {
            examId,
            studentId,
            fileName,
            fileType: 'application/json',
            payload,
            html,
        },
        {
            upsert: true,
            returnDocument: 'after',
            setDefaultsOnInsert: true,
        }
    );

    const [existingRows] = await connection.query(
        'SELECT id FROM correction_documents WHERE exam_result_id = ? LIMIT 1',
        [examResultId]
    );

    let correctionDocumentId = existingRows[0]?.id || null;
    if (correctionDocumentId) {
        await connection.query(
            `UPDATE correction_documents
             SET exam_id = ?, student_id = ?, mongo_document_id = ?, file_name = ?, file_type = ?
             WHERE id = ?`,
            [examId, studentId, String(mongoDocument._id), fileName, 'application/json', correctionDocumentId]
        );
    } else {
        const [insertResult] = await connection.query(
            `INSERT INTO correction_documents
             (exam_result_id, exam_id, student_id, mongo_document_id, file_name, file_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [examResultId, examId, studentId, String(mongoDocument._id), fileName, 'application/json']
        );
        correctionDocumentId = insertResult.insertId;
    }

    await connection.query(
        'UPDATE exam_results SET correction_document_id = ? WHERE id = ?',
        [correctionDocumentId, examResultId]
    );

    return {
        id: correctionDocumentId,
        mongoDocumentId: String(mongoDocument._id),
        fileName,
        fileType: 'application/json',
        payload,
        html,
    };
};

module.exports = {
    buildCorrectionHtml,
    createCorrectionDocument,
    getCorrectionDocumentBundleByResultId,
};
