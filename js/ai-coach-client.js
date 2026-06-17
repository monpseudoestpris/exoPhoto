var App = window.App || {};

// ===== AI Coach Client =====
// Multi-provider (DeepSeek / Anthropic / Mistral) front-only client.
// Used to act like a teacher: explain statement, hint, guide method, review attempt.
App.AICoach = (function () {
    var ANTHROPIC_FALLBACK_MODELS = [
        'claude-opus-4.8',
        'claude-opus-4.7',
        'claude-opus-4.6'
    ];

    var SYSTEM_PROMPT = [
        'Tu es un professeur patient et exigeant qui accompagne un eleve.',
        'Objectif: aider a comprendre l\'enonce, proposer des indices progressifs, corriger sans donner directement la solution complete sauf demande explicite.',
        'Regles:',
        '- Reponds en francais.',
        '- Structure en sections courtes et claires.',
        '- N\'affiche jamais de raisonnement interne, brouillon, chain-of-thought, ni balises de type <think>.',
        '- Donne uniquement la reponse pedagogique finale.',
        '- N\'utilise pas le markdown decoratif (pas de **, pas de titres ###).',
        '- Si c\'est un exercice de maths, utilise LaTeX avec $...$ ou $$...$$.',
        '- Pour une demande d\'indice, donne d\'abord un petit indice, puis un deuxieme si necessaire.',
        '- Si l\'eleve propose une tentative, explique ce qui est juste/faux et comment corriger.',
        '- Ne pas etre condescendant.'
    ].join('\n');

    function _cleanAssistantText(text) {
        var out = String(text || '');

        // Hide reasoning traces occasionally returned by some models.
        out = out.replace(/<think[\s\S]*?<\/think>/gi, '');
        out = out.replace(/```(?:thinking|reasoning|thoughts?)[\s\S]*?```/gi, '');
        out = out.replace(/^(?:\s*)(?:reflexion|réflexion|reasoning|thinking|raisonnement)\s*:\s*.*$/gim, '');

        // Remove raw markdown markers that render poorly in current UI.
        out = out.replace(/^\s{0,3}#{1,6}\s*/gm, '');
        out = out.replace(/\*\*(.*?)\*\*/g, '$1');

        out = out.replace(/\n{3,}/g, '\n\n').trim();
        return out || 'Je n\'ai pas pu produire une reponse exploitable.';
    }

    function _extractErr(res, text) {
        var msg = text || '';
        try {
            var parsed = JSON.parse(text);
            msg = parsed.error && parsed.error.message ? parsed.error.message : (parsed.message || text);
        } catch (e) {}
        return new Error('HTTP ' + res.status + (msg ? ' — ' + String(msg).slice(0, 220) : ''));
    }

    function _buildUserPrompt(opts) {
        var actionMap = {
            explain: 'Explique l\'enonce simplement et clarifie ce qui est demande.',
            hint: 'Donne un indice progressif sans resoudre entierement.',
            method: 'Donne une methode de resolution et un plan d\'attaque.',
            review: 'Analyse la tentative de l\'eleve: ce qui est correct, ce qui bloque, puis donne le prochain pas utile.',
            custom: 'Reponds a la question de l\'eleve en mode professeur.'
        };

        return [
            'Action: ' + (actionMap[opts.action] || actionMap.custom),
            '',
            'Exercice (titre): ' + (opts.exerciseTitle || 'Exercice'),
            'Matiere: ' + (opts.subject || 'Autre'),
            '',
            'Enonce:',
            opts.statement || '',
            '',
            'Tentative eleve:',
            opts.attempt || '(aucune)',
            '',
            'Question eleve:',
            opts.userQuestion || '(pas de question precise)'
        ].join('\n');
    }

    function _callMistral(key, userPrompt) {
        return fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + key,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                model: 'mistral-large-latest',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.4,
                max_tokens: 1200
            })
        }).then(function (res) {
            if (!res.ok) return res.text().then(function (t) { throw _extractErr(res, t); });
            return res.json();
        }).then(function (json) {
            var text = json.choices && json.choices[0] && json.choices[0].message ? (json.choices[0].message.content || '') : '';
            return _cleanAssistantText(text);
        });
    }

    function _callDeepSeek(key, userPrompt) {
        return fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + key,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-v4-pro',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.4,
                max_tokens: 1200
            })
        }).then(function (res) {
            if (!res.ok) return res.text().then(function (t) { throw _extractErr(res, t); });
            return res.json();
        }).then(function (json) {
            var text = json.choices && json.choices[0] && json.choices[0].message ? (json.choices[0].message.content || '') : '';
            return _cleanAssistantText(text);
        });
    }

    function _callAnthropicModel(key, userPrompt, modelName) {
        return fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelName,
                max_tokens: 1200,
                temperature: 0.4,
                system: SYSTEM_PROMPT,
                messages: [
                    { role: 'user', content: userPrompt }
                ]
            })
        }).then(function (res) {
            if (!res.ok) return res.text().then(function (t) { throw _extractErr(res, t); });
            return res.json();
        }).then(function (json) {
            if (!Array.isArray(json.content)) return '';
            var text = json.content.map(function (part) {
                return part && part.type === 'text' ? part.text : '';
            }).join('\n').trim();
            return _cleanAssistantText(text);
        });
    }

    function _callAnthropic(key, userPrompt) {
        var lastErr = null;

        function tryModel(index) {
            if (index >= ANTHROPIC_FALLBACK_MODELS.length) {
                throw lastErr || new Error('Aucun modele Anthropic fallback disponible');
            }

            return _callAnthropicModel(key, userPrompt, ANTHROPIC_FALLBACK_MODELS[index]).catch(function (err) {
                lastErr = err;
                return tryModel(index + 1);
            });
        }

        return tryModel(0);
    }

    function _preferred() {
        return App.Settings.get('preferredProvider') || 'deepseek';
    }

    function resolveModelName(provider) {
        var p = provider || _preferred();
        if (p === 'deepseek') return 'deepseek-v4-pro';
        if (p === 'anthropic') return ANTHROPIC_FALLBACK_MODELS.join(' -> ');
        return 'mistral-large-latest';
    }

    function ask(opts) {
        var provider = (opts && opts.provider) || _preferred();
        var userPrompt = _buildUserPrompt(opts || {});

        if (provider === 'deepseek') {
            var dk = App.ProviderKeys.getKey('deepseek');
            if (!dk) return Promise.reject(new Error('Cle DeepSeek absente ou verrouillee'));
            return _callDeepSeek(dk, userPrompt).catch(function (deepseekErr) {
                var akFallback = App.ProviderKeys.getKey('anthropic');
                if (!akFallback) throw deepseekErr;
                return _callAnthropic(akFallback, userPrompt);
            });
        }
        if (provider === 'anthropic') {
            var ak = App.ProviderKeys.getKey('anthropic');
            if (!ak) return Promise.reject(new Error('Cle Anthropic absente ou verrouillee'));
            return _callAnthropic(ak, userPrompt);
        }

        var mk = App.ProviderKeys.getKey('mistral');
        if (!mk) return Promise.reject(new Error('Cle Mistral absente ou verrouillee'));
        return _callMistral(mk, userPrompt);
    }

    return {
        ask: ask,
        resolveModelName: resolveModelName
    };
})();
