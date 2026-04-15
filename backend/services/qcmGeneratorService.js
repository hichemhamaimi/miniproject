const pdfParse = require('pdf-parse');
const geminiService = require('./llm/geminiService');
const groqService = require('./llm/groqService');
const openrouterService = require('./llm/openrouterService');

class QcmGeneratorService {
  async generateFromText(text, numQuestions, llmProvider = 'gemini') {
    const prompt = `Tu es un expert pédagogique universitaire. Génère exactement ${numQuestions} questions QCM en français à partir du contenu fourni.
Réponds UNIQUEMENT avec ce JSON valide, sans markdown, sans blabla, avec exactement ce format :
{ 
  "questions": [ 
    { 
      "question": "string", 
      "options": { "A": "string", "B": "string", "C": "string", "D": "string" }, 
      "correct": "A" ou "B" ou "C" ou "D", 
      "points": 1 
    } 
  ] 
}

Texte source :
${text}`;

    try {
      let responseText = "";

      if (llmProvider === 'groq') {
        responseText = await groqService.generate(prompt);
      } else if (llmProvider === 'openrouter') {
        responseText = await openrouterService.generate(prompt);
      } else {
        // Défaut : gemini
        responseText = await geminiService.generate(prompt);
      }

      // Nettoyage de la réponse texte si enveloppée dans des markdown blocs
      responseText = responseText.replace(/^```json/g, "").replace(/```$/g, "").trim();

      const parsedJson = JSON.parse(responseText);
      
      if (!parsedJson.questions || !Array.isArray(parsedJson.questions)) {
        throw new Error("Le JSON retourné ne contient pas le tableau 'questions'.");
      }

      return parsedJson.questions;
    } catch (error) {
      console.error("Erreur dans QcmGeneratorService (", llmProvider, "):", error.message);
      throw error;
    }
  }

  async generateFromPdfBuffer(pdfBuffer, numQuestions, llmProvider = 'gemini') {
    try {
      const data = await pdfParse(pdfBuffer);
      const text = data.text;
      
      if (!text || text.trim().length === 0) {
        throw new Error("Impossible d'extraire le texte du document PDF ou document vide.");
      }

      return await this.generateFromText(text, numQuestions, llmProvider);
    } catch (error) {
      console.error("Erreur dans generateFromPdfBuffer:", error.message);
      throw error;
    }
  }
}

module.exports = new QcmGeneratorService();
