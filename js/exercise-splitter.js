// ===== Exercise Splitter =====
// Appel Mistral chat/completions pour détecter et séparer les exercices
// contenus dans un texte OCR (une image peut en contenir plusieurs).
// Namespace: App.ExerciseSplitter

var App = window.App || {};

App.ExerciseSplitter = (function () {
    var API_BASE = 'https://api.mistral.ai/v1';
    var SPLIT_MODEL = 'mistral-small-latest';
    var CLASSIFY_MODEL = 'mistral-small-latest';

    var SYSTEM_PROMPT = [
        'Tu es un assistant pédagogique qui analyse du texte extrait par OCR d\'une feuille d\'exercices scolaires.',
        'Ta tâche : identifier et séparer chaque exercice distinct présent dans le texte.',
        '',
        'Règles :',
        '- Un exercice est une unité cohérente avec un énoncé/question identifiable.',
        '- S\'il n\'y a qu\'un seul exercice, retourne un tableau à un élément.',
        '- Préserve le texte des énoncés tel quel (markdown, formules, etc.), sans le reformuler.',
        '- IMPORTANT : conserve intégralement les balises d\'images OCR de la forme ![nom](nom) dans le champ "statement". Ne les supprime jamais, ne les reformule pas.',
        '- Pour "subject", choisis parmi : Mathematiques, Francais, Histoire-Geographie, SVT, Physique-Chimie, Anglais, NSI, Philosophie, Autre.',
        '- Ajoute aussi "topic" (sujet precis) quand c\'est identifiable: ex. Calcul litteral, Equations, Geometrie, Grammaire, Electricite...',
        '',
        'Retourne UNIQUEMENT le JSON suivant, sans aucun autre texte :',
        '{',
        '  "exercises": [',
        '    {',
        '      "title": "Titre court (ex: Exercice 1, Problème 3, Question de cours)",',
        '      "statement": "Texte complet de l\'énoncé tel qu\'il apparaît",',
        '      "subject": "Mathematiques",',
        '      "topic": "Calcul litteral"',
        '    }',
        '  ]',
        '}'
    ].join('\n');

    var CLASSIFY_PROMPT = [
        'Tu classes un exercice scolaire par matiere et sujet precis.',
        'Choisis "subject" parmi: Mathematiques, Francais, Histoire-Geographie, SVT, Physique-Chimie, Anglais, NSI, Philosophie, Autre.',
        'Donne un "topic" court et utile (ex: Calcul litteral, Equations, Geometrie, Grammaire, Electricite).',
        'Retourne UNIQUEMENT un JSON:',
        '{"subject":"Mathematiques","topic":"Calcul litteral"}'
    ].join('\n');

    function _classifyWithMistralSmall(key, title, statement, subjectHint) {
        var body = {
            model: CLASSIFY_MODEL,
            messages: [
                { role: 'system', content: CLASSIFY_PROMPT },
                { role: 'user', content: [
                    'Titre: ' + (title || 'Exercice'),
                    'Subject hint: ' + (subjectHint || ''),
                    '',
                    'Enonce:',
                    String(statement || '').slice(0, 8000)
                ].join('\n') }
            ],
            response_format: { type: 'json_object' },
            temperature: 0,
            max_tokens: 400
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
                    throw new Error('Mistral classify: HTTP ' + res.status + (txt ? ' — ' + txt.slice(0, 120) : ''));
                });
            }
            return res.json();
        }).then(function (json) {
            var content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
            if (!content) throw new Error('Classification vide');
            var parsed = JSON.parse(content);
            var subject = String(parsed.subject || subjectHint || App.Settings.get('defaultSubject') || 'Mathematiques');
            var topic = parsed.topic
                ? App.ExerciseStore.normalizeTopic(parsed.topic)
                : App.ExerciseStore.inferTopic(subject, title, statement);
            return { subject: subject, topic: topic };
        });
    }

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
            model: SPLIT_MODEL,
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

            var mapped = list.map(function (ex) {
                var subject = String(ex.subject || App.Settings.get('defaultSubject') || 'Mathematiques');
                var title = String(ex.title || 'Exercice').trim();
                var statement = App.ExerciseStore.cleanStatementText(String(ex.statement || ''));
                var normalizedModelTopic = App.ExerciseStore.normalizeTopic(ex.topic);
                var topic = App.ExerciseStore.isUnclassifiedTopic(normalizedModelTopic)
                    ? App.ExerciseStore.inferTopic(subject, title, statement)
                    : normalizedModelTopic;
                return {
                    title: title,
                    statement: statement,
                    subject: subject,
                    topic: topic
                };
            });

            var needsClassify = mapped.some(function (ex) {
                return App.ExerciseStore.normalizeTopic(ex.topic) === App.ExerciseStore.defaultTopic();
            });

            if (!needsClassify) return mapped;

            return Promise.all(mapped.map(function (ex) {
                if (App.ExerciseStore.normalizeTopic(ex.topic) !== App.ExerciseStore.defaultTopic()) return ex;
                return _classifyWithMistralSmall(key, ex.title, ex.statement, ex.subject).then(function (cls) {
                    return Object.assign({}, ex, {
                        subject: cls.subject || ex.subject,
                        topic: cls.topic || ex.topic
                    });
                }).catch(function () {
                    return ex;
                });
            }));
        }).catch(function (err) {
            // Fallback : tout le texte comme un seul exercice
            console.warn('[ExerciseSplitter] split failed, fallback to single exercise:', err.message);
            var fallback = {
                title: 'Exercice',
                statement: App.ExerciseStore.cleanStatementText(ocrText.trim()),
                subject: App.Settings.get('defaultSubject') || 'Mathematiques',
                topic: App.ExerciseStore.inferTopic(
                    App.Settings.get('defaultSubject') || 'Mathematiques',
                    'Exercice',
                    App.ExerciseStore.cleanStatementText(ocrText.trim())
                )
            };

            if (!key) return [fallback];

            return _classifyWithMistralSmall(key, fallback.title, fallback.statement, fallback.subject)
                .then(function (cls) {
                    return [Object.assign({}, fallback, {
                        subject: cls.subject || fallback.subject,
                        topic: cls.topic || fallback.topic
                    })];
                })
                .catch(function () {
                    return [fallback];
                });
        });
    }

    return { split: split };
})();
