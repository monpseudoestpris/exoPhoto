// ===== Exercise Splitter =====
// Appel Mistral chat/completions pour détecter et séparer les exercices
// contenus dans un texte OCR (une image peut en contenir plusieurs).
// Namespace: App.ExerciseSplitter

var App = window.App || {};

App.ExerciseSplitter = (function () {
    var API_BASE = 'https://api.mistral.ai/v1';

    var SYSTEM_PROMPT = [
        'Tu es un assistant pédagogique qui analyse du texte extrait par OCR d\'une feuille d\'exercices scolaires.',
        'Ta tâche : identifier et séparer chaque exercice distinct présent dans le texte.',
        '',
        'Règles :',
        '- Un exercice est une unité cohérente avec un énoncé/question identifiable.',
        '- S\'il n\'y a qu\'un seul exercice, retourne un tableau à un élément.',
        '- Préserve le texte des énoncés tel quel (markdown, formules, etc.), sans le reformuler.',
        '- Pour "subject", choisis parmi : Mathematiques, Francais, Histoire-Geographie, SVT, Physique-Chimie, Anglais, NSI, Philosophie, Autre.',
        '',
        'Retourne UNIQUEMENT le JSON suivant, sans aucun autre texte :',
        '{',
        '  "exercises": [',
        '    {',
        '      "title": "Titre court (ex: Exercice 1, Problème 3, Question de cours)",',
        '      "statement": "Texte complet de l\'énoncé tel qu\'il apparaît",',
        '      "subject": "Mathematiques"',
        '    }',
        '  ]',
        '}'
    ].join('\n');

    function split(ocrText) {
        if (!ocrText || !ocrText.trim()) {
            return Promise.resolve([{
                title: 'Exercice 1',
                statement: ocrText || '',
                subject: App.Settings.get('defaultSubject') || 'Mathematiques'
            }]);
        }

        var key = App.ProviderKeys.getKey('mistral');
        if (!key) {
            // Pas de clé : on retourne un seul bloc avec tout le texte
            return Promise.resolve([{
                title: 'Exercice 1',
                statement: ocrText.trim(),
                subject: App.Settings.get('defaultSubject') || 'Mathematiques'
            }]);
        }

        var body = {
            model: 'mistral-small-latest',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: 'Texte OCR à analyser :\n\n' + ocrText.slice(0, 14000) }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 4000
        };

        return fetch(API_BASE + '/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + key,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body)
        }).then(function (res) {
            if (!res.ok) {
                return res.text().then(function (txt) {
                    throw new Error('Mistral split: HTTP ' + res.status + (txt ? ' — ' + txt.slice(0, 120) : ''));
                });
            }
            return res.json();
        }).then(function (json) {
            var content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
            if (!content) throw new Error('Réponse Mistral vide');

            var parsed = JSON.parse(content);
            var list = parsed.exercises;
            if (!Array.isArray(list) || !list.length) throw new Error('Aucun exercice détecté');

            return list.map(function (ex) {
                return {
                    title: String(ex.title || 'Exercice').trim(),
                    statement: String(ex.statement || '').trim(),
                    subject: String(ex.subject || App.Settings.get('defaultSubject') || 'Mathematiques')
                };
            });
        }).catch(function (err) {
            // Fallback : tout le texte comme un seul exercice
            console.warn('[ExerciseSplitter] split failed, fallback to single exercise:', err.message);
            return [{
                title: 'Exercice',
                statement: ocrText.trim(),
                subject: App.Settings.get('defaultSubject') || 'Mathematiques'
            }];
        });
    }

    return { split: split };
})();
