require('dotenv').config({ path: __dirname + '/../.env' });
const qcmGeneratorService = require('./qcmGeneratorService');

async function test() {
  try {
    const text = "Le protocole HTTP décrit les règles de communication entre le client et le serveur. L'URI permet d'identifier une ressource sur le web.";
    const questions = await qcmGeneratorService.generateFromText(text, 2, 'gemini');
    console.log("Success:", JSON.stringify(questions, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
