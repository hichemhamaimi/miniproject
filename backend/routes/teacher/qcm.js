const express = require('express');
const router = express.Router();
const multer = require('multer');
const qcmController = require('../../controllers/teacher/qcmController');
const verifyJWT = require('../../middleware/verifyJWT');

// Configuration de multer (stockage en mémoire temporaire pour pouvoir l'envoyer à pdf-parse)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Sécuriser les routes avec JWT (comme demandé par la règle /teacher/*)
router.use(verifyJWT);

// Routes QCM
router.post('/generate-from-text', qcmController.generateFromText);
router.post('/generate-from-pdf', upload.single('document'), qcmController.generateFromPdf);

router.get('/:exam_id', qcmController.getExamQuestions);
router.delete('/question/:question_id', qcmController.deleteQuestion);
router.put('/question/:question_id', qcmController.updateQuestion);

module.exports = router;
