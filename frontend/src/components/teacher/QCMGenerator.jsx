import React, { useState } from 'react';
import { FiUploadCloud, FiFileText, FiCheck, FiTrash2, FiEdit2, FiCpu, FiSave, FiAlertCircle } from 'react-icons/fi';

/**
 * Composant de génération de QCM via l'IA.
 * Interface moderne avec glassmorphism, animations et Tailwind CSS.
 */
export default function QCMGenerator() {
  const [activeTab, setActiveTab] = useState('text'); // 'text' ou 'pdf'
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [nbQuestions, setNbQuestions] = useState(5);
  const [examId, setExamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // État pour l'édition d'une question
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const getAuthHeader = () => {
    // Récupérer le token depuis le localStorage (à adapter selon votre logique)
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`
    };
  };

  const handleGenerate = async () => {
    if (!examId) {
      setError("Veuillez saisir un ID d'examen");
      return;
    }

    if (activeTab === 'text' && !text.trim()) {
      setError("Veuillez saisir le contenu texte.");
      return;
    }

    if (activeTab === 'pdf' && !file) {
      setError("Veuillez sélectionner un fichier PDF.");
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    setQuestions([]); // Réinitialiser l'affichage

    try {
      let response;
      if (activeTab === 'text') {
        response = await fetch('http://localhost:3500/teacher/qcm/generate-from-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            text,
            exam_id: parseInt(examId),
            nb_questions: nbQuestions
          })
        });
      } else {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('exam_id', examId);
        formData.append('nb_questions', nbQuestions);

        response = await fetch('http://localhost:3500/teacher/qcm/generate-from-pdf', {
          method: 'POST',
          headers: {
            ...getAuthHeader() // Ne pas set le Content-Type, le navigateur gère le multipart/form-data
          },
          body: formData
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la génération');
      }

      setQuestions(data.data);
      setSuccessMsg(`Succès ! ${data.data.length} questions générées et sauvegardées dans l'examen.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette question ?")) return;

    try {
      const response = await fetch(`http://localhost:3500/teacher/qcm/question/${questionId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (response.ok) {
        setQuestions(questions.filter(q => q.id !== questionId));
      } else {
        const data = await response.json();
        setError(data.message || "Erreur de suppression.");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (q) => {
    setEditingId(q.id);
    setEditForm({
      question_text: q.question_text || q.question,
      option_a: q.option_a || q.options?.A || "",
      option_b: q.option_b || q.options?.B || "",
      option_c: q.option_c || q.options?.C || "",
      option_d: q.option_d || q.options?.D || "",
      correct_option: q.correct_option || q.correct || "A",
      points: q.points || 1
    });
  };

  const saveEdit = async (questionId) => {
    try {
      const response = await fetch(`http://localhost:3500/teacher/qcm/question/${questionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        // Mettre à jour l'affichage local
        setQuestions(questions.map(q => 
          q.id === questionId ? { ...q, ...editForm } : q
        ));
        setEditingId(null);
      } else {
        const data = await response.json();
        setError(data.message || "Erreur lors de la modification.");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 font-sans">
      <div className="bg-white/80 backdrop-blur-lg border border-indigo-100 rounded-3xl shadow-xl overflow-hidden">
        
        {/* Header Premium */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-10 text-white flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-10 w-32 h-32 bg-purple-400/20 rounded-full blur-xl"></div>
          
          <div className="p-4 bg-white/20 rounded-2xl mb-4 backdrop-blur-md">
            <FiCpu className="text-4xl" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Générateur de QCM par IA</h1>
          <p className="text-indigo-100 max-w-lg">
            Créez automatiquement des questions à choix multiples pertinentes depuis vos cours.
          </p>
        </div>

        {/* Configurations générales */}
        <div className="p-6 md:p-8 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <label className="block text-sm font-semibold text-gray-700 mb-2">ID de l'Examen Cible</label>
              <input 
                type="number" 
                value={examId} 
                onChange={(e) => setExamId(e.target.value)}
                placeholder="Ex: 42"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de Questions</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="5" 
                  max="30" 
                  value={nbQuestions} 
                  onChange={(e) => setNbQuestions(parseInt(e.target.value))}
                  className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="font-bold text-xl text-indigo-600 w-12 text-center">{nbQuestions}</span>
              </div>
            </div>
          </div>

          {/* Système d'onglets pour source */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 flex mb-6">
            <button 
              onClick={() => setActiveTab('text')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${activeTab === 'text' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <FiFileText /> Coller un texte
            </button>
            <button 
              onClick={() => setActiveTab('pdf')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${activeTab === 'pdf' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <FiUploadCloud /> Uploader un PDF
            </button>
          </div>

          {/* Zones de saisie dynamiques */}
          <div className="mb-8">
            {activeTab === 'text' ? (
              <textarea 
                rows="8"
                className="w-full p-4 rounded-2xl border border-gray-200 shadow-inner focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none text-gray-700"
                placeholder="Collez ici le contenu de votre cours, notes ou transcription..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            ) : (
              <div className="border-2 border-dashed border-purple-200 rounded-2xl p-10 flex flex-col items-center justify-center bg-purple-50/50 hover:bg-purple-50 transition-colors">
                <div className="bg-white p-4 rounded-full shadow-sm text-purple-600 mb-4">
                  <FiUploadCloud className="text-3xl" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">Sélectionnez un document PDF</h3>
                <p className="text-sm text-gray-500 mb-6">Taille maximale : 10 MB</p>
                
                <input 
                  type="file" 
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="block w-full max-w-sm text-sm text-slate-500
                    file:mr-4 file:py-3 file:px-6
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-purple-100 file:text-purple-700
                    hover:file:bg-purple-200 transition-all cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Alertes d'état */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
              <FiAlertCircle className="shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}
          
          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-3 border border-green-100">
              <FiCheck className="shrink-0" />
              <p className="font-medium">{successMsg}</p>
            </div>
          )}

          {/* Bouton d'action principal */}
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex justify-center items-center gap-3 text-lg
              ${loading 
                ? 'bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed opacity-80' 
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:-translate-y-1'
              }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Génération en cours (environ 10-15s)...
              </>
            ) : (
              <>
                <FiCpu className="text-xl" />
                Générer les Questions
              </>
            )}
          </button>
        </div>
      </div>

      {/* Rendu des résultats générés */}
      {questions.length > 0 && (
        <div className="mt-10 mb-20 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-lg">💡</span> 
              Questions Générées
            </h2>
          </div>
          
          <div className="grid gap-6">
            {questions.map((q, idx) => (
              <div key={q.id || idx} className="bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow overflow-hidden group">
                
                {/* Mode Édition vs Mode Vue */}
                {editingId === q.id ? (
                  <div className="p-6 bg-indigo-50/30">
                    <div className="mb-4">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Question</label>
                      <input 
                        type="text" 
                        value={editForm.question_text} 
                        onChange={e => setEditForm({...editForm, question_text: e.target.value})}
                        className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      {['a', 'b', 'c', 'd'].map(opt => (
                        <div key={opt} className="flex flex-col">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Option {opt.toUpperCase()}</label>
                          <input 
                            type="text" 
                            value={editForm[`option_${opt}`]} 
                            onChange={e => setEditForm({...editForm, [`option_${opt}`]: e.target.value})}
                            className="p-3 rounded-lg border border-gray-300"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-4 items-end">
                      <div className="flex-1 border p-2 rounded-lg bg-white">
                        <label className="text-xs font-bold text-gray-500 block mb-2 px-1">Bonne réponse</label>
                        <div className="flex gap-4 px-1">
                          {['A','B','C','D'].map(char => (
                            <label key={char} className="flex gap-1 items-center cursor-pointer">
                              <input 
                                type="radio" 
                                name={`correct-${q.id}`} 
                                checked={editForm.correct_option === char} 
                                onChange={() => setEditForm({...editForm, correct_option: char})}
                                className="accent-green-600 w-4 h-4"
                              /> 
                              <span className="font-semibold">{char}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={() => saveEdit(q.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
                      >
                        <FiSave /> Sauvegarder
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-3 rounded-xl font-bold transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Header Question */}
                    <div className="bg-gray-50/80 p-4 border-b border-gray-100 flex justify-between items-start">
                      <h3 className="text-lg font-semibold text-gray-800 pr-20">
                        <span className="text-indigo-400 mr-2">Q{idx + 1}.</span>
                        {q.question_text || q.question}
                      </h3>
                      <div className="flex bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(q)} className="p-2 text-blue-600 hover:bg-blue-50" title="Modifier">
                          <FiEdit2 />
                        </button>
                        <div className="w-px bg-gray-200"></div>
                        <button onClick={() => handleDelete(q.id)} className="p-2 text-red-600 hover:bg-red-50" title="Supprimer">
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>

                    {/* Options */}
                    <div className="p-6 grid md:grid-cols-2 gap-4">
                      {['A','B','C','D'].map((opt) => {
                        const letter = opt.toUpperCase();
                        const isCorrect = (q.correct_option === letter) || (q.correct === letter);
                        const text = q[`option_${opt}`] || (q.options && q.options[letter]);

                        return (
                          <div 
                            key={opt}
                            className={`p-4 rounded-xl border-2 flex items-start gap-3 transition-colors
                              ${isCorrect 
                                ? 'border-green-400 bg-green-50' 
                                : 'border-gray-100 bg-white'}`}
                          >
                            <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm
                               ${isCorrect ? 'bg-green-400 text-white' : 'bg-gray-100 text-gray-500'}`}>
                              {letter}
                            </span>
                            <span className={`text-gray-700 pt-1 ${isCorrect && 'font-medium'}`}>
                              {text}
                            </span>
                            {isCorrect && <FiCheck className="ml-auto text-green-500 text-xl mt-1" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Style local pour les animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
      `}} />
    </div>
  );
}
