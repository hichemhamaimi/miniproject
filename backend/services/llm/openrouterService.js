/**
 * Service pour l'API OpenRouter (Llama 3.1 405B)
 */
class OpenRouterService {
  async generate(prompt) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("La clé API OpenRouter (OPENROUTER_API_KEY) n'est pas configurée.");

    const endpoint = "https://openrouter.ai/api/v1/chat/completions";

    const payload = {
      model: "meta-llama/llama-3.1-405b-instruct:free",
      messages: [{ role: "user", content: prompt }]
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
        throw new Error(`Erreur API OpenRouter: ${response.statusText} - ${err}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content;
    if (!text) throw new Error("Format de réponse inattendu d'OpenRouter.");

    return text;
  }
}

module.exports = new OpenRouterService();
