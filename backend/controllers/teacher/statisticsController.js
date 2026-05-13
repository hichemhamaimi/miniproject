const { parsePositiveInt } = require('../../utils/validation');
const { getStoredOrGenerateStatisticsSnapshot } = require('../../services/examStatisticsService');
const { getTeacherExamAccess } = require('../../services/examAccessService');

const getExamStatistics = async (req, res) => {
    try {
        const examId = parsePositiveInt(req.params.id, 'exam id');
        const teacherId = req.userId;
        const examAccess = await getTeacherExamAccess(examId, teacherId);

        if (!examAccess) {
            return res.status(404).json({ message: 'Exam not found or unauthorized.' });
        }

        const statistics = await getStoredOrGenerateStatisticsSnapshot(examId, teacherId, { allowPartial: true });
        if (!statistics) {
            return res.status(404).json({ message: 'Exam not found or unauthorized.' });
        }

        if (!statistics.ready) {
            return res.status(409).json({
                message: 'Statistics are available after at least one student submission.',
                readiness: statistics.readiness,
            });
        }

        res.status(200).json(statistics.payload);
    } catch (error) {
        console.error('Error fetching exam statistics:', error);
        res.status(500).json({ message: 'Server error fetching statistics.' });
    }
};

module.exports = {
    getExamStatistics,
};
