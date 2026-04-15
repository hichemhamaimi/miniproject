/**
 * Service pour l'API Google Gemini avec Retry et Fallback
 */
class GeminiService {
  async fetchFromGemini(prompt, model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("La clé API Gemini (GEMINI_API_KEY) n'est pas configurée.");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        const errObj = new Error(`Erreur API Gemini: ${response.statusText} - ${err}`);
        errObj.status = response.status;
        throw errObj;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Format de réponse inattendu de Gemini.");

    return text;
  }

  async generate(prompt) {
    let attempt = 0;
    const maxRetries = 3;
    let fallbackUsed = false;
    let currentModel = 'gemini-2.5-flash';

    while (attempt <= maxRetries) {
      try {
        return await this.fetchFromGemini(prompt, currentModel);
      } catch (error) {
        if (error.status === 503) {
          attempt++;
          if (attempt > maxRetries) {
            if (!fallbackUsed) {
              console.log(`[Gemini] ${currentModel} surchargé après ${maxRetries} tentatives. Bascule vers gemini-1.5-flash...`);
              fallbackUsed = true;
              currentModel = 'gemini-1.5-flash';
              attempt = 0; // Réinitialise les tentatives pour le modèle de secours
              continue;
            } else {
              throw new Error("OVERLOAD_ERROR");
            }
          }
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.warn(`[Gemini] Erreur 503, nouvelle tentative (${attempt}/${maxRetries}) dans ${delay}ms avec le modèle ${currentModel}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Erreur autre que 503 (400, 403, etc.), on ne retry pas
          throw error;
        }
      }
    }
  }
}

module.exports = new GeminiService();
