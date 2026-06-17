var App = window.App || {};
App.Views = App.Views || {};

App.Views.Coach = (function () {
    var ACTIVE_KEY = 'exophoto-coach-active-exercise';
    var CHAT_PREFIX = 'exophoto-coach-chat:';
    var ATTEMPT_PREFIX = 'exophoto-coach-attempt:';
    var MOBILE_LIST_KEY = 'exophoto-coach-mobile-list-open';

    function _isMobile() {
        return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
    }

    function _isMobileListOpen() {
        return localStorage.getItem(MOBILE_LIST_KEY) === '1';
    }

    function _setMobileListOpen(value) {
        localStorage.setItem(MOBILE_LIST_KEY, value ? '1' : '0');
    }

    function _loadChat(exId) {
        try {
            var raw = localStorage.getItem(CHAT_PREFIX + exId);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function _saveChat(exId, chat) {
        localStorage.setItem(CHAT_PREFIX + exId, JSON.stringify(chat));
    }

    function _loadAttempt(exId) {
        return localStorage.getItem(ATTEMPT_PREFIX + exId) || '';
    }

    function _saveAttempt(exId, value) {
        localStorage.setItem(ATTEMPT_PREFIX + exId, value || '');
    }

    function _setActive(exId) {
        if (exId) localStorage.setItem(ACTIVE_KEY, exId);
        else localStorage.removeItem(ACTIVE_KEY);
    }

    function _getActive() {
        return localStorage.getItem(ACTIVE_KEY);
    }

    function render(container) {
        App.DB.getExercises().then(function (exercises) {
            if (!exercises.length) {
                container.innerHTML = '<div class="page-stack"><section class="hero"><h1>Prof IA</h1><p>Commence par enregistrer au moins un exercice dans la bibliotheque.</p><div class="hero-actions"><a class="button-link" href="#/capture">Scanner un exercice</a><a class="button-link secondary" href="#/library">Ouvrir la bibliotheque</a></div></section></div>';
                return;
            }

            var activeId = _getActive();
            var active = exercises.find(function (ex) { return ex.id === activeId; }) || exercises[0];
            _setActive(active.id);

            var attempt = _loadAttempt(active.id);
            var chat = _loadChat(active.id);
            var mobileListOpen = _isMobile() && _isMobileListOpen();

            container.innerHTML =
                '<div class="page-stack">' +
                    '<section class="hero">' +
                        '<h1>Prof IA</h1>' +
                        '<p>Travaille ta resolution ici. L\'agent explique l\'enonce, donne des indices progressifs et corrige ta tentative.</p>' +
                    '</section>' +
                    '<section class="coach-grid ' + (mobileListOpen ? 'show-mobile-list' : 'hide-mobile-list') + '">' +
                        '<aside class="list-card coach-list">' +
                            '<div class="coach-list-head">' +
                                '<h2>Exercices</h2>' +
                                '<button id="coach-close-list" class="ghost mobile-only">Continuer</button>' +
                            '</div>' +
                            '<div class="exercise-list">' + exercises.map(function (ex) {
                                return '<div class="exercise-item ' + (ex.id === active.id ? 'active' : '') + '" data-coach-ex="' + ex.id + '">' +
                                    '<h3>' + App.UI.escapeHtml(ex.title || 'Exercice') + '</h3>' +
                                    '<div class="exercise-meta"><div>' + App.UI.escapeHtml(ex.subject || 'Autre') + '</div><div>' + App.UI.formatDate(ex.updatedAt || ex.createdAt) + '</div></div>' +
                                '</div>';
                            }).join('') + '</div>' +
                        '</aside>' +
                        '<section class="editor-card coach-workspace">' +
                            '<button id="coach-open-list" class="ghost mobile-only">Changer d\'exercice</button>' +
                            '<h2>' + App.UI.escapeHtml(active.title || 'Exercice') + '</h2>' +
                            '<div class="chip-row">' +
                                App.UI.badge(active.subject || 'Autre') +
                                App.UI.badge(active.gradeLevel || 'Niveau libre') +
                                App.UI.badge(active.difficulty || 'Moyen') +
                            '</div>' +
                            '<h3>Enonce</h3>' +
                            '<div class="ocr-output math-content" id="coach-statement">' + App.UI.escapeHtml(active.statement || '') + '</div>' +
                            '<label>Ma tentative' +
                                '<textarea id="coach-attempt" rows="7" placeholder="Ecris ici ton raisonnement, calculs, et ou tu bloques...">' + App.UI.escapeHtml(attempt) + '</textarea>' +
                            '</label>' +
                            '<div class="coach-actions">' +
                                '<button data-coach-action="explain" class="secondary">Expliquer l\'enonce</button>' +
                                '<button data-coach-action="hint" class="secondary">Donner un indice</button>' +
                                '<button data-coach-action="method" class="secondary">Donner la methode</button>' +
                                '<button data-coach-action="review">Corriger ma tentative</button>' +
                            '</div>' +
                            '<label>Question libre (optionnel)' +
                                '<textarea id="coach-question" rows="3" placeholder="Ex: pourquoi je dois factoriser avant de developper ?"></textarea>' +
                            '</label>' +
                            '<div class="coach-question-actions">' +
                                '<button data-coach-action="custom" class="secondary">Envoyer la question</button>' +
                                '<small class="muted">Raccourci: Ctrl+Entrée</small>' +
                            '</div>' +
                            '<div id="coach-chat" class="coach-chat">' + renderChat(chat) + '</div>' +
                        '</section>' +
                    '</section>' +
                    '<div id="coach-modal-root" class="coach-modal-backdrop" aria-hidden="true">' +
                        '<article class="coach-modal" role="dialog" aria-modal="true" aria-labelledby="coach-modal-title">' +
                            '<header class="coach-modal-head">' +
                                '<h3 id="coach-modal-title">Reponse du Prof IA</h3>' +
                                '<button id="coach-modal-close-x" class="ghost" aria-label="Fermer">Fermer</button>' +
                            '</header>' +
                            '<div id="coach-modal-content" class="coach-modal-content math-content"></div>' +
                            '<footer class="coach-modal-actions">' +
                                '<button id="coach-modal-copy" class="secondary">Copier</button>' +
                                '<button id="coach-modal-close">Fermer</button>' +
                            '</footer>' +
                        '</article>' +
                    '</div>' +
                '</div>';

            bindEvents(container, exercises, active, chat);
            App.UI.renderMath(container);
        });
    }

    function renderChat(chat) {
        if (!chat.length) {
            return '<div class="empty-state">Aucune reponse IA pour l\'instant. Lance une action ci-dessus.</div>';
        }
        return chat.map(function (m) {
            return '<article class="coach-msg ' + (m.role === 'assistant' ? 'assistant' : 'user') + '">' +
                '<header>' + (m.role === 'assistant' ? 'Prof IA' : 'Moi') + '</header>' +
                '<div class="math-content">' + App.UI.escapeHtml(m.content || '') + '</div>' +
            '</article>';
        }).join('');
    }

    function bindEvents(container, exercises, active, chat) {
        container.querySelectorAll('[data-coach-ex]').forEach(function (el) {
            el.addEventListener('click', function () {
                _setActive(el.getAttribute('data-coach-ex'));
                _setMobileListOpen(false);
                App.Router.render();
            });
        });

        var openListBtn = container.querySelector('#coach-open-list');
        if (openListBtn) {
            openListBtn.addEventListener('click', function () {
                _setMobileListOpen(true);
                App.Router.render();
            });
        }

        var closeListBtn = container.querySelector('#coach-close-list');
        if (closeListBtn) {
            closeListBtn.addEventListener('click', function () {
                _setMobileListOpen(false);
                App.Router.render();
            });
        }

        var attemptEl = container.querySelector('#coach-attempt');
        if (attemptEl) {
            attemptEl.addEventListener('input', function () {
                _saveAttempt(active.id, attemptEl.value);
            });
        }

        var modalRoot = container.querySelector('#coach-modal-root');
        var modalContent = container.querySelector('#coach-modal-content');
        var modalTitle = container.querySelector('#coach-modal-title');
        var closeBtn = container.querySelector('#coach-modal-close');
        var closeXBtn = container.querySelector('#coach-modal-close-x');
        var copyBtn = container.querySelector('#coach-modal-copy');

        function closeModal() {
            if (!modalRoot) return;
            modalRoot.classList.remove('active');
            modalRoot.setAttribute('aria-hidden', 'true');
        }

        function openModal(text) {
            if (!modalRoot || !modalContent) return;
            if (modalTitle) modalTitle.textContent = 'Reponse du Prof IA';
            modalContent.textContent = text || '';
            modalRoot.classList.add('active');
            modalRoot.setAttribute('aria-hidden', 'false');
            if (copyBtn) copyBtn.disabled = false;
            App.UI.renderMath(modalContent);
        }

        function openThinkingModal(provider, modelName) {
            if (!modalRoot || !modalContent) return;
            if (modalTitle) modalTitle.textContent = 'Reflexion en cours';
            modalContent.innerHTML =
                '<div class="coach-thinking">' +
                    '<span class="coach-spinner" aria-hidden="true"></span>' +
                    '<div class="coach-thinking-text">' +
                        '<strong>Le Prof IA reflechit...</strong>' +
                        '<small class="muted">Provider: ' + App.UI.escapeHtml(provider) + ' · Modele: ' + App.UI.escapeHtml(modelName) + '</small>' +
                    '</div>' +
                '</div>';
            modalRoot.classList.add('active');
            modalRoot.setAttribute('aria-hidden', 'false');
            if (copyBtn) copyBtn.disabled = true;
        }

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (closeXBtn) closeXBtn.addEventListener('click', closeModal);
        if (modalRoot) {
            modalRoot.addEventListener('click', function (event) {
                if (event.target === modalRoot) closeModal();
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                navigator.clipboard.writeText((modalContent && modalContent.textContent) || '').then(function () {
                    App.UI.showToast('Reponse copitee', 'success');
                }).catch(function () {
                    App.UI.showToast('Copie impossible', 'error');
                });
            });
        }

        if (window.__exophotoCoachEscHandler) {
            document.removeEventListener('keydown', window.__exophotoCoachEscHandler);
        }
        window.__exophotoCoachEscHandler = function (event) {
            if (event.key === 'Escape') closeModal();
        };
        document.addEventListener('keydown', window.__exophotoCoachEscHandler);

        function push(role, content) {
            chat.push({ role: role, content: content, ts: new Date().toISOString() });
            _saveChat(active.id, chat);
            var chatEl = container.querySelector('#coach-chat');
            if (chatEl) {
                chatEl.innerHTML = renderChat(chat);
                App.UI.renderMath(chatEl);
                chatEl.scrollTop = chatEl.scrollHeight;
            }
        }

        function runAction(action) {
            var attempt = (container.querySelector('#coach-attempt').value || '').trim();
            var userQuestion = (container.querySelector('#coach-question').value || '').trim();

            var actionLabelMap = {
                explain: 'Explique l\'enonce',
                hint: 'Donne un indice',
                method: 'Donne la methode',
                review: 'Corrige ma tentative',
                custom: userQuestion || 'Question libre'
            };

            if (action === 'custom' && !userQuestion) {
                App.UI.showToast('Ecris une question avant de valider', 'warning');
                return;
            }

            push('user', actionLabelMap[action] + (userQuestion ? '\n\nQuestion: ' + userQuestion : ''));

            var buttons = container.querySelectorAll('[data-coach-action]');
            buttons.forEach(function (b) { b.disabled = true; });

            var provider = App.Settings.get('preferredProvider') || 'deepseek';
            var modelName = typeof App.AICoach.resolveModelName === 'function'
                ? App.AICoach.resolveModelName(provider)
                : provider;
            openThinkingModal(provider, modelName);

            App.AICoach.ask({
                action: action,
                exerciseTitle: active.title,
                subject: active.subject,
                statement: active.statement,
                attempt: attempt,
                userQuestion: userQuestion,
                provider: provider
            }).then(function (txt) {
                var answer = txt || 'Je n\'ai pas pu produire une reponse exploitable.';
                push('assistant', answer);
                openModal(answer);
            }).catch(function (err) {
                var errorText = 'Erreur IA: ' + (err.message || String(err));
                push('assistant', errorText);
                openModal(errorText);
            }).finally(function () {
                buttons.forEach(function (b) { b.disabled = false; });
            });
        }

        container.querySelectorAll('[data-coach-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                runAction(btn.getAttribute('data-coach-action'));
            });
        });

        var questionEl = container.querySelector('#coach-question');
        if (questionEl) {
            questionEl.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' && event.ctrlKey) {
                    event.preventDefault();
                    runAction('custom');
                }
            });
        }
    }

    return { render: render };
})();
