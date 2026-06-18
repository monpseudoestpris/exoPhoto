var App = window.App || {};
App.Views = App.Views || {};

App.Views.Coach = (function () {
    var ACTIVE_KEY = 'exophoto-coach-active-exercise';
    var CHAT_PREFIX = 'exophoto-coach-chat:';
    var ATTEMPT_PREFIX = 'exophoto-coach-attempt:';
    var MOBILE_LIST_KEY = 'exophoto-coach-mobile-list-open';
    var PENDING_ACTION_KEY = 'exophoto-coach-pending-action';
    var PENDING_EXERCISE_KEY = 'exophoto-coach-pending-exercise';

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

    function _fold(value) {
        var out = String(value || '').toLowerCase();
        try {
            out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (e) {}
        return out;
    }

    function _isVariantExercise(ex) {
        if (!ex) return false;
        if (ex.isVariant === true) return true;
        if (ex.sourceExerciseId) return true;

        var title = _fold(ex.title || '');
        if (title.indexOf('variante') >= 0) return true;

        var tags = (ex.tags || []).map(function (t) { return _fold(t); });
        return tags.indexOf('variante') >= 0;
    }

    function _buildEssentialTitle(exercise) {
        var topic = App.ExerciseStore.normalizeTopic(exercise.topic, exercise.subject);
        if (topic && !App.ExerciseStore.isUnclassifiedTopic(topic)) {
            return 'L\'essentiel · ' + topic;
        }
        return 'L\'essentiel · ' + (exercise.title || 'Exercice');
    }

    function _snippet(text, maxLen) {
        var value = String(text || '').replace(/\s+/g, ' ').trim();
        if (!value) return '';
        var limit = maxLen || 160;
        if (value.length <= limit) return value;
        return value.slice(0, limit - 3).replace(/\s+\S*$/, '').trim() + '...';
    }

    function renderMiniCourses(courses) {
        if (!courses || !courses.length) {
            return '<div class="empty-state">Aucun petit cours sauvegarde pour l\'instant.</div>';
        }

        return '<div class="mini-course-list">' + courses.map(function (course) {
            return '<article class="mini-course-item" data-mini-course-id="' + App.UI.escapeHtml(course.id) + '">' +
                '<div class="mini-course-head">' +
                    '<h4>' + App.UI.escapeHtml(course.title || 'Petit cours') + '</h4>' +
                    '<button class="ghost mini-course-delete" data-mini-course-delete="' + App.UI.escapeHtml(course.id) + '">Supprimer</button>' +
                '</div>' +
                '<div class="exercise-meta">' +
                    '<div>' + App.UI.escapeHtml(course.subject || 'Autre') + ' · ' + App.UI.escapeHtml(course.topic || App.ExerciseStore.defaultTopic()) + '</div>' +
                    '<div>Maj ' + App.UI.formatDate(course.updatedAt || course.createdAt) + '</div>' +
                '</div>' +
                '<p class="mini-course-snippet">' + App.UI.escapeHtml(_snippet(course.base, 180)) + '</p>' +
            '</article>';
        }).join('') + '</div>';
    }

    function render(container) {
        Promise.all([App.DB.getExercises(), App.DB.getMiniCourses()]).then(function (results) {
            var exercises = results[0] || [];
            var miniCoursesAll = results[1] || [];
            if (!exercises.length) {
                container.innerHTML = '<div class="page-stack"><section class="hero"><h1>Prof IA</h1><p>Commence par enregistrer au moins un exercice dans la bibliotheque.</p><div class="hero-actions"><a class="button-link" href="#/capture">Scanner un exercice</a><a class="button-link secondary" href="#/library">Ouvrir la bibliotheque</a></div></section></div>';
                return;
            }

            var activeId = _getActive();
            var active = exercises.find(function (ex) { return ex.id === activeId; }) || exercises[0];
            _setActive(active.id);

            exercises = exercises.map(function (ex) {
                var subject = App.ExerciseStore.normalizeSubject(ex.subject || 'Autre');
                return Object.assign({}, ex, {
                    subject: subject,
                    topic: App.ExerciseStore.normalizeTopic(ex.topic, subject)
                });
            });
            active = exercises.find(function (ex) { return ex.id === active.id; }) || exercises[0];
            var isVariant = _isVariantExercise(active);
            var miniCourses = miniCoursesAll.filter(function (course) {
                return course.subject === active.subject && course.topic === active.topic;
            });

            var attempt = _loadAttempt(active.id);
            var chat = _loadChat(active.id);
            var mobileListOpen = _isMobile() && _isMobileListOpen();
            return (active.promptSourceScanId ? App.DB.getScan(active.promptSourceScanId) : Promise.resolve(null)).then(function (sourceScan) {
                container.innerHTML =
                    '<div class="page-stack">' +
                        '<section class="hero">' +
                            '<h1>Prof IA</h1>' +
                            '<p>Travaille ta resolution ici. L\'agent explique l\'enonce, donne des indices progressifs et corrige ta tentative.</p>' +
                            '<div class="hero-actions">' +
                                '<button id="coach-essential-btn" class="secondary">L\'essentiel</button>' +
                                (isVariant ? '<button id="coach-save-variant" class="secondary">Sauver la variante</button>' : '') +
                                '<a class="button-link secondary" href="#/exercise?id=' + encodeURIComponent(active.id) + '">Retour a l\'exo</a>' +
                                '<a class="button-link" href="#/library">Retour a la liste</a>' +
                            '</div>' +
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
                                        '<div class="exercise-meta"><div>' + App.UI.escapeHtml(ex.subject || 'Autre') + ' · ' + App.UI.escapeHtml(ex.topic || App.ExerciseStore.defaultTopic()) + '</div><div>' + App.UI.formatDate(ex.updatedAt || ex.createdAt) + '</div></div>' +
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
                                '<div class="statement-tools"><h3>Enonce</h3>' + App.UI.sourceDocumentButton(sourceScan, 'Document fourni') + '</div>' +
                                '<div class="ocr-output math-content" id="coach-statement">' + App.UI.statementHtml(active.statement || '', sourceScan) + '</div>' +
                                '<label>Ma tentative' +
                                    '<textarea id="coach-attempt" rows="7" placeholder="Ecris ici ton raisonnement, calculs, et ou tu bloques...">' + App.UI.escapeHtml(attempt) + '</textarea>' +
                                '</label>' +
                                '<div class="coach-actions">' +
                                    '<button data-coach-action="explain" class="secondary">Expliquer l\'enonce</button>' +
                                    '<button data-coach-action="hint" class="secondary">Donner un indice</button>' +
                                    '<button data-coach-action="method" class="secondary">Donner la methode</button>' +
                                    '<button data-coach-action="review">Corriger ma tentative</button>' +
                                '</div>' +
                                (isVariant ? '<div class="coach-question-actions"><button id="coach-save-variant-inline" class="secondary">Sauver la variante</button></div>' : '') +
                                '<label>Question libre (optionnel)' +
                                    '<textarea id="coach-question" rows="3" placeholder="Ex: pourquoi je dois factoriser avant de developper ?"></textarea>' +
                                '</label>' +
                                '<div class="coach-question-actions">' +
                                    '<button data-coach-action="custom" class="secondary">Envoyer la question</button>' +
                                    '<button data-coach-preset-question="Explique moi l\'enonce, je comprends pas tout" class="ghost">Explique moi l\'enonce, je comprends pas tout</button>' +
                                    '<small class="muted">Raccourci: Ctrl+Entrée</small>' +
                                '</div>' +
                                '<section class="mini-course-corner">' +
                                    '<div class="coach-list-head">' +
                                        '<h3>Coin petits cours</h3>' +
                                        '<small class="muted">' + miniCourses.length + ' sauvegarde(s)</small>' +
                                    '</div>' +
                                    renderMiniCourses(miniCourses) +
                                '</section>' +
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
                                    '<button id="coach-modal-save-essential" class="secondary" style="display:none;">Sauver dans Petits cours</button>' +
                                    '<button id="coach-modal-copy" class="secondary">Copier</button>' +
                                    '<button id="coach-modal-close">Fermer</button>' +
                                '</footer>' +
                            '</article>' +
                        '</div>' +
                    '</div>';

                App.UI.bindDocumentViewer(container);
                bindEvents(container, exercises, active, chat, miniCourses);
                App.UI.renderMath(container);

                var pendingAction = localStorage.getItem(PENDING_ACTION_KEY);
                var pendingExercise = localStorage.getItem(PENDING_EXERCISE_KEY);
                if (pendingAction === 'essential' && pendingExercise === active.id) {
                    localStorage.removeItem(PENDING_ACTION_KEY);
                    localStorage.removeItem(PENDING_EXERCISE_KEY);
                    window.setTimeout(function () {
                        if (window.__exophotoCoachRunAction) {
                            window.__exophotoCoachRunAction('essential');
                        }
                    }, 0);
                }
            });
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

    function bindEvents(container, exercises, active, chat, miniCourses) {
        var pendingEssentialCourse = null;

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

        function saveVariantNow(button) {
            if (!button) return;
            button.disabled = true;
            var updated = Object.assign({}, active, {
                isVariant: true,
                updatedAt: new Date().toISOString()
            });

            App.DB.saveExercise(updated).then(function () {
                App.UI.showToast('Variante sauvegardee', 'success');
            }).catch(function (err) {
                App.UI.showToast(err.message || 'Sauvegarde impossible', 'error');
            }).finally(function () {
                button.disabled = false;
            });
        }

        var saveVariantBtn = container.querySelector('#coach-save-variant');
        if (saveVariantBtn) {
            saveVariantBtn.addEventListener('click', function () {
                saveVariantNow(saveVariantBtn);
            });
        }

        var saveVariantInlineBtn = container.querySelector('#coach-save-variant-inline');
        if (saveVariantInlineBtn) {
            saveVariantInlineBtn.addEventListener('click', function () {
                saveVariantNow(saveVariantInlineBtn);
            });
        }

        var modalRoot = container.querySelector('#coach-modal-root');
        var modalContent = container.querySelector('#coach-modal-content');
        var modalTitle = container.querySelector('#coach-modal-title');
        var closeBtn = container.querySelector('#coach-modal-close');
        var closeXBtn = container.querySelector('#coach-modal-close-x');
        var copyBtn = container.querySelector('#coach-modal-copy');
        var saveEssentialBtn = container.querySelector('#coach-modal-save-essential');

        function closeModal() {
            if (!modalRoot) return;
            modalRoot.classList.remove('active');
            modalRoot.setAttribute('aria-hidden', 'true');
        }

        function openModal(text, opts) {
            opts = opts || {};
            if (!modalRoot || !modalContent) return;
            if (modalTitle) modalTitle.textContent = opts.title || 'Reponse du Prof IA';
            modalContent.textContent = text || '';
            modalRoot.classList.add('active');
            modalRoot.setAttribute('aria-hidden', 'false');
            if (copyBtn) copyBtn.disabled = false;
            if (saveEssentialBtn) {
                if (opts.allowSaveEssential && pendingEssentialCourse) {
                    saveEssentialBtn.style.display = 'inline-flex';
                    saveEssentialBtn.disabled = false;
                } else {
                    saveEssentialBtn.style.display = 'none';
                }
            }
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
            if (saveEssentialBtn) saveEssentialBtn.style.display = 'none';
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

        if (saveEssentialBtn) {
            saveEssentialBtn.addEventListener('click', function () {
                if (!pendingEssentialCourse) return;
                saveEssentialBtn.disabled = true;
                App.DB.saveMiniCourse(pendingEssentialCourse).then(function () {
                    pendingEssentialCourse = null;
                    saveEssentialBtn.style.display = 'none';
                    App.UI.showToast('Petit cours sauvegarde dans Petits cours', 'success');
                    App.Router.render();
                }).catch(function () {
                    saveEssentialBtn.disabled = false;
                    App.UI.showToast('Sauvegarde impossible', 'error');
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
                essential: 'L\'essentiel',
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
            if (action === 'essential') {
                provider = 'mistral';
            }
            var modelName = typeof App.AICoach.resolveModelName === 'function'
                ? App.AICoach.resolveModelName(provider)
                : provider;
            openThinkingModal(provider, modelName);

            App.AICoach.ask({
                action: action,
                exerciseTitle: active.title,
                subject: App.ExerciseStore.normalizeSubject(active.subject),
                topic: App.ExerciseStore.normalizeTopic(active.topic, active.subject),
                statement: active.statement,
                attempt: attempt,
                userQuestion: userQuestion,
                provider: provider
            }).then(function (txt) {
                var answer = txt || 'Je n\'ai pas pu produire une reponse exploitable.';
                push('assistant', answer);

                if (action === 'essential' && answer.indexOf('Erreur IA:') !== 0) {
                    var now = new Date().toISOString();
                    pendingEssentialCourse = {
                        id: App.DB.nextId('mini-course'),
                        subject: App.ExerciseStore.normalizeSubject(active.subject),
                        topic: App.ExerciseStore.normalizeTopic(active.topic, active.subject),
                        title: _buildEssentialTitle(active),
                        base: answer,
                        sourceExerciseId: active.id,
                        createdAt: now,
                        updatedAt: now
                    };
                    openModal(answer, {
                        title: 'L\'essentiel',
                        allowSaveEssential: true
                    });
                    return;
                }

                pendingEssentialCourse = null;
                openModal(answer);
            }).catch(function (err) {
                var errorText = 'Erreur IA: ' + (err.message || String(err));
                push('assistant', errorText);
                pendingEssentialCourse = null;
                openModal(errorText);
            }).finally(function () {
                buttons.forEach(function (b) { b.disabled = false; });
            });
        }

        window.__exophotoCoachRunAction = runAction;

        container.querySelectorAll('[data-coach-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                runAction(btn.getAttribute('data-coach-action'));
            });
        });

        var essentialBtn = container.querySelector('#coach-essential-btn');
        if (essentialBtn) {
            essentialBtn.addEventListener('click', function () {
                runAction('essential');
            });
        }

        container.querySelectorAll('[data-mini-course-delete]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-mini-course-delete');
                if (!id) return;
                if (!window.confirm('Supprimer ce petit cours ?')) return;
                App.DB.deleteMiniCourse(id).then(function () {
                    App.UI.showToast('Petit cours supprime', 'success');
                    App.Router.render();
                });
            });
        });

        container.querySelectorAll('[data-mini-course-id]').forEach(function (el) {
            el.addEventListener('click', function (event) {
                if (event.target && event.target.getAttribute('data-mini-course-delete')) return;
                var id = el.getAttribute('data-mini-course-id');
                var selected = (miniCourses || []).find(function (course) { return course.id === id; });
                if (!selected) return;
                openModal(selected.base || '');
            });
        });

        container.querySelectorAll('[data-coach-preset-question]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var preset = btn.getAttribute('data-coach-preset-question') || '';
                var q = container.querySelector('#coach-question');
                if (q) q.value = preset;
                runAction('custom');
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

        // Attach voice input button to question textarea
        if (typeof App.VoiceInput !== 'undefined') {
            App.VoiceInput.attachMicButton('coach-question');
        }
    }

    return { render: render };
})();
