const qcmGeneratorService = require('../../services/qcmGeneratorService');

const qcmController = {
  /**
   * Génère un QCM à partir d'un texte et renvoie le JSON (ne sauvegarde pas en BD directement).
   */
  generateFromText: async (req, res, next) => {
    try {
      const { text, nb_questions, llm_provider } = req.body;

      if (!text || !nb_questions) {
        return res.status(400).json({ success: false, message: "Texte et nb_questions sont requis." });
      }

      // Appeler le service IA dynamiquement
      const questionsData = await qcmGeneratorService.generateFromText(text, nb_questions, llm_provider);

      // Assigner un ID temporaire généré aléatoirement pour que React puisse les modifier (s'il n'y en a pas déjà)
      const mappedQuestions = questionsData.map(q => ({
        id: Math.random().toString(36).substr(2, 9),
        ...q
      }));

      res.status(200).json({ success: true, data: mappedQuestions, message: `${mappedQuestions.length} questions générées avec succès.` });
    } catch (error) {
      console.error("Erreur gFT:", error);
      if (error.message === "OVERLOAD_ERROR") {
        return res.status(503).json({ success: false, error: "Le modèle est surchargé, veuillez réessayer dans quelques instants." });
      }
      next(error);
    }
  },

  /**
   * Génère un QCM à partir d'un PDF et renvoie le JSON.
   */
  generateFromPdf: async (req, res, next) => {
    try {
      const nb_questions = req.body.nb_questions || 5;
      const llm_provider = req.body.llm_provider || 'gemini';

      if (!req.file) {
        return res.status(400).json({ success: false, message: "Veuillez fournir un document." });
      }

      // Appeler le service IA avec le buffer
      const questionsData = await qcmGeneratorService.generateFromPdfBuffer(req.file.buffer, nb_questions, llm_provider);

      const mappedQuestions = questionsData.map(q => ({
        id: Math.random().toString(36).substr(2, 9),
        ...q
      }));

      res.status(200).json({ success: true, data: mappedQuestions, message: `${mappedQuestions.length} questions générées depuis le PDF.` });
    } catch (error) {
      console.error("Erreur gFPDF:", error);
      if (error.message === "OVERLOAD_ERROR") {
        return res.status(503).json({ success: false, error: "Le modèle est surchargé, veuillez réessayer dans quelques instants." });
      }
      next(error);
    }
  },

  /**
   * Fonctionnalités devenues obsolètes (celles-ci assumaient que les questions existaient isolément en DB).
   * Elles peuvent rester ici si vous en avez l'utilité, mais elles ne seront pas appelées par la nouvelle interface CreateExam.
   */
  getExamQuestions: async (req, res, next) => {
    res.status(501).json({ success: false, message: "Not Implemented" });
  },

  deleteQuestion: async (req, res, next) => {
    res.status(501).json({ success: false, message: "Not Implemented" });
  },

  updateQuestion: async (req, res, next) => {
    res.status(501).json({ success: false, message: "Not Implemented" });
  }
};

module.exports = qcmController;
