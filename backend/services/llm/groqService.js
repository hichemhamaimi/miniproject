/**
 * Service pour l'API Groq (Llama 3.3 70B)
 */
class GroqService {
  async generate(prompt) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("La clé API Groq (GROQ_API_KEY) n'est pas configurée.");

    const endpoint = "https://api.groq.com/openai/v1/chat/completions";

    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Erreur API Groq: ${response.statusText} - ${err}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content;
    if (!text) throw new Error("Format de réponse inattendu de Groq.");

    return text;
  }
}

module.exports = new GroqService();
