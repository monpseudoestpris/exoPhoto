var App = window.App || {};
App.Views = App.Views || {};

App.Views.Library = (function () {
    var ACTIVE_KEY = 'exophoto-library-active-exercise';
    var VARIANT_DRAFT_KEY = 'exophoto-library-variant-draft';
    var VARIANT_DRAFT_ACTIVE_ID = '__variant-draft__';
    var DRAFT_AUTO_OPEN_KEY = 'exophoto-library-draft-auto-open';
    var MOBILE_EDITOR_KEY = 'exophoto-library-mobile-editor-open';
    var COACH_PENDING_ACTION_KEY = 'exophoto-coach-pending-action';
    var COACH_PENDING_EXERCISE_KEY = 'exophoto-coach-pending-exercise';
    var activeExerciseId = null;
    var workingVariantDraft = null;
    var mobileEditorOpen = false;
    var subjectFilterValue = 'Toutes';
    var topicFilterValue = 'Tous';
    var searchValue = '';

    function uniqueSubjects(exercises) {
        var map = {};
        (exercises || []).forEach(function (exercise) {
            map[App.ExerciseStore.normalizeSubject(exercise.subject || 'Autre')] = true;
        });
        return Object.keys(map).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    }

    function topicOptions(exercises, subject) {
        if (!subject || subject === 'Toutes') return ['Tous'];
        return ['Tous'].concat(App.ExerciseStore.topicOptionsForSubject(exercises, subject));
    }

    function filterExercises(exercises) {
        var query = String(searchValue || '').toLowerCase();
        return (exercises || []).filter(function (exercise) {
            var subject = App.ExerciseStore.normalizeSubject(exercise.subject || 'Autre');
            var topic = App.ExerciseStore.normalizeTopic(exercise.topic, subject);

            if (subjectFilterValue !== 'Toutes' && subject !== subjectFilterValue) return false;
            if (topicFilterValue !== 'Tous' && topic !== topicFilterValue) return false;

            if (!query) return true;
            var haystack = [
                exercise.title,
                subject,
                topic,
                exercise.gradeLevel,
                exercise.difficulty,
                (exercise.tags || []).join(' '),
                exercise.statement
            ].join(' ').toLowerCase();
            return haystack.indexOf(query) !== -1;
        });
    }

    function confirmPlacementIfNeeded(existingExercises, exercise, contextLabel) {
        var withoutSelf = (existingExercises || []).filter(function (item) {
            return item.id !== exercise.id;
        });
        var check = App.ExerciseStore.checkPlacement(withoutSelf, exercise.subject, exercise.topic);
        if (check.existsTopicInSubject) return true;

        var subject = App.ExerciseStore.normalizeSubject(exercise.subject || 'Autre');
        var topic = App.ExerciseStore.normalizeTopic(exercise.topic, subject);
        var message =
            'Nouveau classement detecte pour ' + contextLabel + '.\n\n' +
            'Matiere: ' + subject + '\n' +
            'Sujet: ' + topic + '\n\n' +
            'Aucun exercice existant ne correspond a cette combinaison.\n' +
            'Voulez-vous la creer quand meme ?';
        return window.confirm(message);
    }

    function _saveDraftToStorage(draft) {
        if (!draft) {
            localStorage.removeItem(VARIANT_DRAFT_KEY);
            return;
        }
        try {
            localStorage.setItem(VARIANT_DRAFT_KEY, JSON.stringify(draft));
        } catch (e) {}
    }

    function _loadDraftFromStorage() {
        if (workingVariantDraft) return;
        var raw = localStorage.getItem(VARIANT_DRAFT_KEY);
        if (!raw) return;
        try {
            var parsed = JSON.parse(raw);
            if (parsed && parsed.isVariantDraft) {
                workingVariantDraft = parsed;
            }
        } catch (e) {
            localStorage.removeItem(VARIANT_DRAFT_KEY);
        }
    }

    function _setWorkingVariantDraft(draft) {
        workingVariantDraft = draft || null;
        _saveDraftToStorage(workingVariantDraft);
    }

    function _setMobileEditorOpen(value) {
        mobileEditorOpen = !!value;
        try {
            localStorage.setItem(MOBILE_EDITOR_KEY, mobileEditorOpen ? 'true' : 'false');
        } catch (e) {}
    }

    function _requestDraftAutoOpen() {
        try {
            localStorage.setItem(DRAFT_AUTO_OPEN_KEY, '1');
        } catch (e) {}
    }

    function _consumeDraftAutoOpen() {
        try {
            var shouldOpen = localStorage.getItem(DRAFT_AUTO_OPEN_KEY) === '1';
            if (shouldOpen) localStorage.removeItem(DRAFT_AUTO_OPEN_KEY);
            return shouldOpen;
        } catch (e) {
            return false;
        }
    }

    function _buildVariantTitle(sourceTitle, candidateTitle) {
        var baseSource = String(sourceTitle || 'Exercice').trim() || 'Exercice';
        var prefix = 'Variante de l\'exo: ' + baseSource;
        var candidate = String(candidateTitle || '').trim();
        if (!candidate) return prefix;

        var lowerCandidate = candidate.toLowerCase();
        var lowerPrefix = prefix.toLowerCase();
        if (lowerCandidate.indexOf('variante de l\'exo:') === 0 || lowerCandidate === lowerPrefix) {
            return candidate;
        }
        return prefix + ' - ' + candidate;
    }

    function _statementExcerpt(exercise) {
        var statement = App.ExerciseStore.cleanStatementText(String(exercise && exercise.statement || ''));
        if (!statement) return 'Apercu de l\'enonce indisponible.';

        var lines = statement
            .split(/\n+/)
            .map(function (line) { return line.trim(); })
            .filter(Boolean);

        var excerpt = lines.slice(0, 3).join(' ');
        excerpt = excerpt.replace(/\s+/g, ' ').trim();

        if (excerpt.length > 180) {
            excerpt = excerpt.slice(0, 177).replace(/\s+\S*$/, '').trim() + '...';
        }
        return excerpt || 'Apercu de l\'enonce indisponible.';
    }

    function render(container) {
        _loadDraftFromStorage();
        mobileEditorOpen = localStorage.getItem(MOBILE_EDITOR_KEY) === 'true';
        App.DB.getExercises().then(function (exercises) {
            exercises = (exercises || []).map(function (exercise) {
                var subject = App.ExerciseStore.normalizeSubject(exercise.subject || 'Autre');
                var title = exercise.title || 'Exercice';
                var statement = App.ExerciseStore.cleanStatementText(exercise.statement || '');
                var normalizedTopic = App.ExerciseStore.normalizeTopic(exercise.topic, subject);
                var topic = App.ExerciseStore.isUnclassifiedTopic(normalizedTopic)
                    ? App.ExerciseStore.inferTopic(subject, title, statement)
                    : normalizedTopic;
                return Object.assign({}, exercise, {
                    subject: subject,
                    statement: statement,
                    topic: topic
                });
            });
            exercises = App.ExerciseStore.sortBySubjectTopic(exercises);

            activeExerciseId = localStorage.getItem(ACTIVE_KEY) || activeExerciseId;
            var subjects = ['Toutes'].concat(uniqueSubjects(exercises));
            if (subjects.indexOf(subjectFilterValue) === -1) subjectFilterValue = 'Toutes';
            var topics = topicOptions(exercises, subjectFilterValue);
            if (topics.indexOf(topicFilterValue) === -1) topicFilterValue = 'Tous';

            var active = exercises.find(function (exercise) { return exercise.id === activeExerciseId; }) || exercises[0] || null;
            if (workingVariantDraft) {
                active = workingVariantDraft;
                activeExerciseId = VARIANT_DRAFT_ACTIVE_ID;
            } else {
                activeExerciseId = active ? active.id : null;
            }
            if (activeExerciseId && activeExerciseId !== VARIANT_DRAFT_ACTIVE_ID) {
                localStorage.setItem(ACTIVE_KEY, activeExerciseId);
            }

            var filtered = filterExercises(exercises);
            var isMobileLayout = !!(window.matchMedia && window.matchMedia('(max-width: 640px)').matches);
            var mobileEditorClass = isMobileLayout && mobileEditorOpen && active ? ' library-mobile-editor-open' : '';

            container.innerHTML =
                '<div class="page-stack">' +
                    '<section class="hero">' +
                        '<h1>Bibliotheque d\'exercices</h1>' +
                        '<p>Classement a deux niveaux: matiere puis sujet. Chaque ajout verifie si la combinaison existe deja.</p>' +
                    '</section>' +
                    '<section class="two-col library-stack' + mobileEditorClass + '">' +
                        '<div class="list-card">' +
                            '<div class="inline-actions">' +
                                '<label>Matiere' +
                                    '<select id="library-subject-filter">' + subjects.map(function (subject) {
                                        return '<option value="' + App.UI.escapeHtml(subject) + '"' + (subject === subjectFilterValue ? ' selected' : '') + '>' + App.UI.escapeHtml(subject) + '</option>';
                                    }).join('') + '</select>' +
                                '</label>' +
                                '<label>Sujet' +
                                    '<select id="library-topic-filter">' + topics.map(function (topic) {
                                        return '<option value="' + App.UI.escapeHtml(topic) + '"' + (topic === topicFilterValue ? ' selected' : '') + '>' + App.UI.escapeHtml(topic) + '</option>';
                                    }).join('') + '</select>' +
                                '</label>' +
                                '<label>Recherche rapide' +
                                    '<input id="library-search" type="search" value="' + App.UI.escapeHtml(searchValue) + '" placeholder="Titre, matiere, sujet, tag...">' +
                                '</label>' +
                                '<button id="create-empty-exercise" class="secondary">Preparer un exo vierge</button>' +
                                '<button id="generate-exercise" class="secondary">Generer un exo</button>' +
                            '</div>' +
                            '<div id="exercise-list" class="exercise-list">' + renderExerciseList(filtered) + '</div>' +
                        '</div>' +
                        '<div class="editor-card">' + renderEditor(active, { isMobileLayout: isMobileLayout, mobileEditorOpen: mobileEditorOpen }) + '</div>' +
                    '</section>' +
                    '<div id="library-generation-overlay" class="coach-modal-backdrop" aria-hidden="true">' +
                        '<article class="coach-modal" role="dialog" aria-modal="true" aria-labelledby="library-generation-title">' +
                            '<header class="coach-modal-head">' +
                                '<h3 id="library-generation-title">Generation de variante</h3>' +
                            '</header>' +
                            '<div class="coach-modal-content">' +
                                '<div class="coach-thinking">' +
                                    '<span class="coach-spinner" aria-hidden="true"></span>' +
                                    '<div class="coach-thinking-text">' +
                                        '<strong>Generation en cours...</strong>' +
                                        '<small id="library-generation-meta" class="muted"></small>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</article>' +
                    '</div>' +
                    '<div id="library-generate-exercise-input-modal" class="coach-modal-backdrop" aria-hidden="true">' +
                        '<article class="coach-modal" role="dialog" aria-modal="true" aria-labelledby="library-generate-exercise-title">' +
                            '<header class="coach-modal-head">' +
                                '<h3 id="library-generate-exercise-title">Generer un exercice</h3>' +
                            '</header>' +
                            '<div class="coach-modal-content">' +
                                '<label>Qu\'est-ce que tu veux bosser ?<br><small class="muted">Sois descriptif: matiere, sujet, concept, niveau...</small>' +
                                    '<textarea id="library-generate-exercise-description" rows="4" placeholder="Ex: Des exercices de derivees en maths pour le lycee, niveau difficile"></textarea>' +
                                '</label>' +
                            '</div>' +
                            '<footer class="coach-modal-actions">' +
                                '<button id="library-generate-exercise-cancel" class="secondary">Annuler</button>' +
                                '<button id="library-generate-exercise-submit">Generer</button>' +
                            '</footer>' +
                        '</article>' +
                    '</div>' +
                    '<div id="library-generate-exercise-overlay" class="coach-modal-backdrop" aria-hidden="true">' +
                        '<article class="coach-modal" role="dialog" aria-modal="true" aria-labelledby="library-generate-exercise-working-title">' +
                            '<header class="coach-modal-head">' +
                                '<h3 id="library-generate-exercise-working-title">Generation en cours</h3>' +
                            '</header>' +
                            '<div class="coach-modal-content">' +
                                '<div class="coach-thinking">' +
                                    '<span class="coach-spinner" aria-hidden="true"></span>' +
                                    '<div class="coach-thinking-text">' +
                                        '<strong>Creation de ton exercice...</strong>' +
                                        '<small id="library-generate-exercise-meta" class="muted"></small>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</article>' +
                    '</div>' +
                '</div>';

            bindEvents(exercises);
            App.UI.renderMath(container);

            if (workingVariantDraft && _consumeDraftAutoOpen()) {
                var editorCard = container.querySelector('.editor-card');
                if (editorCard && editorCard.scrollIntoView) {
                    editorCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                var titleInput = container.querySelector('#exercise-title');
                if (titleInput && titleInput.focus) titleInput.focus();
            }
        });
    }

    function renderExerciseList(exercises) {
        var items = exercises.slice();
        if (workingVariantDraft) {
            items.unshift({
                id: VARIANT_DRAFT_ACTIVE_ID,
                title: workingVariantDraft.title || 'Variante en brouillon',
                subject: workingVariantDraft.subject,
                topic: workingVariantDraft.topic,
                gradeLevel: workingVariantDraft.gradeLevel,
                difficulty: workingVariantDraft.difficulty,
                updatedAt: workingVariantDraft.updatedAt,
                isVariantDraftListItem: !!workingVariantDraft.isVariantDraft,
                isGeneratedDraftListItem: !!workingVariantDraft.isGeneratedDraft
            });
        }

        if (!items.length) {
            return '<div class="empty-state">Aucun exercice enregistre. Convertis un scan OCR ou cree une fiche vierge.</div>';
        }

        return items.map(function (exercise) {
            var subject = App.ExerciseStore.normalizeSubject(exercise.subject || 'Autre');
            var topic = App.ExerciseStore.normalizeTopic(exercise.topic, subject);
            var draftTag = '';
            if (exercise.isVariantDraftListItem) draftTag = '<div class="status-pill">Brouillon variante</div>';
            if (exercise.isGeneratedDraftListItem) draftTag = '<div class="status-pill">Brouillon IA</div>';
            var excerpt = _statementExcerpt(exercise);
            var openLabel = (exercise.isVariantDraftListItem || exercise.isGeneratedDraftListItem) ? 'Continuer' : 'Ouvrir';
            var listActions = '<button type="button" class="open-exercise-btn" data-open-exercise-id="' + exercise.id + '">' + App.UI.escapeHtml(openLabel) + '</button>';
            if (!exercise.isVariantDraftListItem && !exercise.isGeneratedDraftListItem) {
                listActions += '<button type="button" class="secondary list-essential-btn" data-list-essential-id="' + exercise.id + '">L\'essentiel</button>';
                listActions += '<button type="button" class="secondary list-generate-variant-btn" data-list-generate-variant-id="' + exercise.id + '">Variante</button>';
                listActions += '<button type="button" class="danger list-delete-btn" data-list-delete-id="' + exercise.id + '">Supprimer</button>';
            }
            return '<div class="exercise-item ' + (exercise.id === activeExerciseId ? 'active' : '') + '" data-exercise-id="' + exercise.id + '">' +
                '<div class="exercise-item-head">' +
                    '<h3>' + App.UI.escapeHtml(exercise.title || 'Exercice') + '</h3>' +
                    '<div class="exercise-item-actions">' + listActions + '</div>' +
                '</div>' +
                '<div class="exercise-preview">' + App.UI.escapeHtml(excerpt) + '</div>' +
                '<div class="exercise-meta">' +
                    '<div>' + App.UI.escapeHtml(subject || 'Sans matiere') + ' · ' + App.UI.escapeHtml(topic) + '</div>' +
                    '<div>' + App.UI.escapeHtml(exercise.gradeLevel || 'Niveau libre') + ' · ' + App.UI.escapeHtml(exercise.difficulty || 'Moyen') + '</div>' +
                    '<div>Maj ' + App.UI.formatDate(exercise.updatedAt || exercise.createdAt) + '</div>' +
                    draftTag +
                '</div>' +
            '</div>';
        }).join('');
    }

    function renderEditor(exercise, opts) {
        opts = opts || {};
        if (!exercise) {
            return '<div class="empty-state">Selectionne un exercice ou cree une fiche vide.</div>';
        }

        var isVariantDraft = !!exercise.isVariantDraft;
        var isGeneratedDraft = !!exercise.isGeneratedDraft;
        var actionsHtml = isVariantDraft
            ? '' +
                '<button id="save-variant-draft-btn">Sauvegarder la variante</button>' +
                '<button id="discard-variant-draft-btn" class="secondary">Annuler la variante</button>'
            : isGeneratedDraft
            ? '' +
                '<button id="save-generated-draft-btn">Sauvegarder cet exercice</button>' +
                '<button id="discard-generated-draft-btn" class="secondary">Annuler</button>'
            : '' +
                '<button id="save-exercise-btn">Enregistrer</button>' +
                '<button id="generate-variant-btn" class="secondary">Generer une variante a bosser</button>' +
                '<button id="duplicate-exercise-btn" class="secondary">Dupliquer</button>' +
                '<button id="delete-exercise-btn" class="danger">Supprimer</button>';

        var helperText = isVariantDraft
            ? 'Variante prete a travailler: non sauvegardee. Tu peux la modifier, puis choisir de la sauvegarder ou l\'annuler.'
            : isGeneratedDraft
            ? 'Exercice genere par IA: non sauvegarde. Verifie, modifie si besoin, puis sauvegarde ou annule.'
            : 'Preparation deja prevue pour la generation future: matiere, niveau, tags, variantes et contexte assistant sont stockes.';

        var draftBanner = isVariantDraft
            ? '<p class="muted">Mode variante brouillon (meme matiere et meme sujet que l\'exo source).</p>'
            : isGeneratedDraft
            ? '<p class="muted">Mode brouillon IA (exercice genere depuis une description).</p>'
            : '';

        var excerptBanner = '<div class="exercise-body-teaser"><span>Apercu</span><p>' + App.UI.escapeHtml(_statementExcerpt(exercise)) + '</p></div>';
        var mobileReturnButton = opts.isMobileLayout && opts.mobileEditorOpen
            ? '<button id="library-back-to-list-btn" class="secondary library-back-to-list-btn">Retour a la liste</button>'
            : '';

        return '' +
            '<h2>Edition</h2>' +
            mobileReturnButton +
            draftBanner +
            excerptBanner +
            '<div class="field-grid two">' +
                '<label>Titre<input id="exercise-title" value="' + App.UI.escapeHtml(exercise.title || '') + '"></label>' +
                '<label>Matiere<select id="exercise-subject">' + options(App.ExerciseStore.subjectOptions(), App.ExerciseStore.normalizeSubject(exercise.subject)) + '</select></label>' +
                '<label>Sujet<input id="exercise-topic" list="topic-options" value="' + App.UI.escapeHtml(App.ExerciseStore.normalizeTopic(exercise.topic, App.ExerciseStore.normalizeSubject(exercise.subject))) + '" placeholder="Ex: Calcul litteral"></label>' +
                '<label>Niveau<select id="exercise-grade">' + options(App.ExerciseStore.gradeOptions(), exercise.gradeLevel) + '</select></label>' +
                '<label>Difficulte<select id="exercise-difficulty">' + options(App.ExerciseStore.difficultyOptions(), exercise.difficulty) + '</select></label>' +
            '</div>' +
            '<datalist id="topic-options"></datalist>' +
            '<label>Consignes<textarea id="exercise-instructions">' + App.UI.escapeHtml(exercise.instructions || '') + '</textarea></label>' +
            '<label>Enonce<textarea id="exercise-statement">' + App.UI.escapeHtml(exercise.statement || '') + '</textarea></label>' +
            '<label>Tags (separes par des virgules)<input id="exercise-tags" value="' + App.UI.escapeHtml((exercise.tags || []).join(', ')) + '"></label>' +
            '<label>Variantes (une ligne par variante)<textarea id="exercise-variants">' + App.UI.escapeHtml((exercise.variants || []).map(function (variant) { return variant.text; }).join('\n')) + '</textarea></label>' +
            '<label>Notes<textarea id="exercise-notes">' + App.UI.escapeHtml(exercise.notes || '') + '</textarea></label>' +
            '<div class="editor-actions">' +
                actionsHtml +
            '</div>' +
            '<p class="muted">' + helperText + '</p>';
    }

    function options(values, selected) {
        return values.map(function (value) {
            return '<option value="' + App.UI.escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + App.UI.escapeHtml(value) + '</option>';
        }).join('');
    }

    function bindEvents(exercises) {
        var generationOverlay = document.getElementById('library-generation-overlay');
        var generationMeta = document.getElementById('library-generation-meta');

        function openGenerationOverlay(provider, modelName) {
            if (!generationOverlay) return;
            if (generationMeta) {
                generationMeta.textContent = 'Provider: ' + provider + ' · Modele: ' + modelName;
            }
            generationOverlay.classList.add('active');
            generationOverlay.setAttribute('aria-hidden', 'false');
        }

        function closeGenerationOverlay() {
            if (!generationOverlay) return;
            generationOverlay.classList.remove('active');
            generationOverlay.setAttribute('aria-hidden', 'true');
        }

        function sourceExerciseForDraft() {
            if (!workingVariantDraft) return null;
            return exercises.find(function (exercise) {
                return exercise.id === workingVariantDraft.sourceExerciseId;
            }) || null;
        }

        function generateVariantFromExercise(exerciseId, triggerButton, resetLabel) {
            App.DB.getExercise(exerciseId).then(function (exercise) {
                if (!exercise) return;

                if (triggerButton) {
                    triggerButton.disabled = true;
                    triggerButton.textContent = 'Generation...';
                }

                var provider = App.Settings.get('preferredProvider') || 'deepseek';
                var modelName = typeof App.AICoach.resolveModelName === 'function'
                    ? App.AICoach.resolveModelName(provider)
                    : provider;
                openGenerationOverlay(provider, modelName);

                return App.AICoach.generateVariant({
                    provider: provider,
                    exerciseTitle: exercise.title,
                    subject: exercise.subject,
                    topic: exercise.topic,
                    gradeLevel: exercise.gradeLevel,
                    difficulty: exercise.difficulty,
                    instructions: exercise.instructions,
                    statement: exercise.statement
                }).then(function (variant) {
                    var cleanStatement = App.ExerciseStore.cleanStatementText(variant.statement || '');
                    var fixedSubject = App.ExerciseStore.normalizeSubject(exercise.subject || 'Autre');
                    var fixedTopic = App.ExerciseStore.normalizeTopic(exercise.topic, fixedSubject);
                    var now = new Date().toISOString();

                    var newExercise = {
                        id: App.DB.nextId('exercise'),
                        isVariant: true,
                        sourceExerciseId: exercise.id,
                        title: _buildVariantTitle(exercise.title, variant.title),
                        subject: fixedSubject,
                        topic: fixedTopic,
                        promptSourceScanId: exercise.promptSourceScanId || null,
                        statement: cleanStatement || exercise.statement,
                        instructions: (variant.instructions || exercise.instructions || '').trim(),
                        gradeLevel: exercise.gradeLevel,
                        difficulty: variant.difficulty || exercise.difficulty,
                        tags: (exercise.tags || []).concat(['variante']).filter(function (v, i, arr) {
                            return arr.indexOf(v) === i;
                        }),
                        variants: [],
                        generationSeed: {
                            subject: fixedSubject,
                            topic: fixedTopic,
                            gradeLevel: exercise.gradeLevel,
                            tags: (exercise.tags || []).concat(['variante']).filter(function (v, i, arr) {
                                return arr.indexOf(v) === i;
                            })
                        },
                        notes: '',
                        status: 'draft',
                        createdAt: now,
                        updatedAt: now,
                        assistantContext: null
                    };

                    if (!confirmPlacementIfNeeded(exercises, newExercise, 'la generation')) return;

                    return App.DB.saveExercise(newExercise).then(function () {
                        var sourceUpdate = Object.assign({}, exercise, {
                            variants: (exercise.variants || []).concat([
                                { id: App.DB.nextId('variant'), text: newExercise.statement }
                            ]),
                            updatedAt: new Date().toISOString()
                        });

                        return App.DB.saveExercise(sourceUpdate).then(function () {
                            _setWorkingVariantDraft(null);
                            activeExerciseId = newExercise.id;
                            localStorage.setItem(ACTIVE_KEY, activeExerciseId);
                            localStorage.setItem('exophoto-coach-active-exercise', newExercise.id);
                            _setMobileEditorOpen(false);
                            App.UI.showToast('Variante generee. On passe direct au travail avec le Prof IA.', 'success');
                            App.Router.navigate('#/coach');
                        });
                    });
                }).catch(function (err) {
                    App.UI.showToast(err.message || 'Generation de variante impossible', 'error');
                }).finally(function () {
                    closeGenerationOverlay();
                    if (triggerButton) {
                        triggerButton.disabled = false;
                        triggerButton.textContent = resetLabel || 'Generer une variante a bosser';
                    }
                });
            });
        }

        function sendExerciseToCoach(exerciseId, action) {
            if (!exerciseId) return;
            localStorage.setItem('exophoto-coach-active-exercise', exerciseId);
            localStorage.setItem(COACH_PENDING_EXERCISE_KEY, exerciseId);
            localStorage.setItem(COACH_PENDING_ACTION_KEY, action || 'essential');
            App.Router.navigate('#/coach');
        }

        function bindExerciseSelection() {
            document.querySelectorAll('[data-exercise-id]').forEach(function (item) {
                item.addEventListener('click', function () {
                    var selectedId = item.getAttribute('data-exercise-id');
                    if (selectedId !== VARIANT_DRAFT_ACTIVE_ID) {
                        _setWorkingVariantDraft(null);
                        activeExerciseId = selectedId;
                        localStorage.setItem(ACTIVE_KEY, activeExerciseId);
                    } else {
                        activeExerciseId = VARIANT_DRAFT_ACTIVE_ID;
                        _requestDraftAutoOpen();
                    }
                    if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) {
                        _setMobileEditorOpen(true);
                    }
                    App.Router.render();
                });
            });

            document.querySelectorAll('[data-open-exercise-id]').forEach(function (button) {
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var selectedId = button.getAttribute('data-open-exercise-id');
                    if (selectedId === VARIANT_DRAFT_ACTIVE_ID) {
                        activeExerciseId = VARIANT_DRAFT_ACTIVE_ID;
                        _requestDraftAutoOpen();
                        _setMobileEditorOpen(true);
                        App.Router.render();
                    } else {
                        _setWorkingVariantDraft(null);
                        activeExerciseId = selectedId;
                        localStorage.setItem(ACTIVE_KEY, activeExerciseId);
                        _setMobileEditorOpen(false);
                        // Go directly to coach
                        localStorage.setItem('exophoto-coach-active-exercise', selectedId);
                        App.Router.navigate('#/coach');
                    }
                });
            });

            document.querySelectorAll('[data-list-delete-id]').forEach(function (button) {
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var selectedId = button.getAttribute('data-list-delete-id');
                    if (!selectedId) return;
                    if (!window.confirm('Supprimer cet exercice ?')) return;

                    App.DB.deleteExercise(selectedId).then(function () {
                        if (activeExerciseId === selectedId) {
                            activeExerciseId = null;
                            localStorage.removeItem(ACTIVE_KEY);
                        }
                        App.UI.showToast('Exercice supprime', 'success');
                        App.Router.render();
                    });
                });
            });

            document.querySelectorAll('[data-list-generate-variant-id]').forEach(function (button) {
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var selectedId = button.getAttribute('data-list-generate-variant-id');
                    if (!selectedId) return;
                    activeExerciseId = selectedId;
                    localStorage.setItem(ACTIVE_KEY, activeExerciseId);
                    _setWorkingVariantDraft(null);
                    generateVariantFromExercise(selectedId, button, 'Variante');
                });
            });

            document.querySelectorAll('[data-list-essential-id]').forEach(function (button) {
                button.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var selectedId = button.getAttribute('data-list-essential-id');
                    if (!selectedId) return;
                    sendExerciseToCoach(selectedId, 'essential');
                });
            });
        }

        var subjectSelect = document.getElementById('exercise-subject');
        var topicInput = document.getElementById('exercise-topic');
        var topicDatalist = document.getElementById('topic-options');

        function refreshTopicSuggestions() {
            if (!subjectSelect || !topicDatalist) return;
            var topicValues = App.ExerciseStore.topicOptionsForSubject(exercises, subjectSelect.value);
            topicDatalist.innerHTML = topicValues.map(function (value) {
                return '<option value="' + App.UI.escapeHtml(value) + '"></option>';
            }).join('');
        }

        if (subjectSelect) {
            subjectSelect.addEventListener('change', refreshTopicSuggestions);
            refreshTopicSuggestions();
        }
        if (topicInput && !topicInput.value.trim()) {
            topicInput.value = App.ExerciseStore.defaultTopic();
        }

        bindExerciseSelection();

        var createBtn = document.getElementById('create-empty-exercise');
        if (createBtn) {
            createBtn.addEventListener('click', function () {
                _setWorkingVariantDraft(null);
                _setMobileEditorOpen(false);
                var now = new Date().toISOString();
                var exercise = {
                    id: App.DB.nextId('exercise'),
                    subject: App.ExerciseStore.normalizeSubject(App.Settings.get('defaultSubject')),
                    topic: App.ExerciseStore.defaultTopic(),
                    title: 'Exercice a creer',
                    promptSourceScanId: null,
                    statement: '',
                    instructions: '',
                    gradeLevel: App.Settings.get('defaultGradeLevel'),
                    difficulty: App.Settings.get('defaultDifficulty'),
                    tags: [],
                    variants: [],
                    generationSeed: {
                        subject: App.ExerciseStore.normalizeSubject(App.Settings.get('defaultSubject')),
                        topic: App.ExerciseStore.defaultTopic(),
                        gradeLevel: App.Settings.get('defaultGradeLevel'),
                        tags: []
                    },
                    notes: '',
                    status: 'draft',
                    createdAt: now,
                    updatedAt: now,
                    assistantContext: null
                };
                if (!confirmPlacementIfNeeded(exercises, exercise, 'la creation')) return;
                App.DB.saveExercise(exercise).then(function () {
                    activeExerciseId = exercise.id;
                    localStorage.setItem(ACTIVE_KEY, activeExerciseId);
                    App.UI.showToast('Fiche vide creee', 'success');
                    App.Router.render();
                });
            });
        }

        var generateExerciseBtn = document.getElementById('generate-exercise');
        if (generateExerciseBtn) {
            generateExerciseBtn.addEventListener('click', function () {
                var inputModal = document.getElementById('library-generate-exercise-input-modal');
                if (inputModal) {
                    inputModal.classList.add('active');
                    inputModal.setAttribute('aria-hidden', 'false');
                    var textarea = document.getElementById('library-generate-exercise-description');
                    if (textarea) textarea.focus();
                }
            });
        }

        var generateExerciseCancelBtn = document.getElementById('library-generate-exercise-cancel');
        if (generateExerciseCancelBtn) {
            generateExerciseCancelBtn.addEventListener('click', function () {
                var inputModal = document.getElementById('library-generate-exercise-input-modal');
                if (inputModal) {
                    inputModal.classList.remove('active');
                    inputModal.setAttribute('aria-hidden', 'true');
                }
                document.getElementById('library-generate-exercise-description').value = '';
            });
        }

        var generateExerciseSubmitBtn = document.getElementById('library-generate-exercise-submit');
        if (generateExerciseSubmitBtn) {
            generateExerciseSubmitBtn.addEventListener('click', function () {
                var textarea = document.getElementById('library-generate-exercise-description');
                var description = textarea ? textarea.value.trim() : '';
                if (!description) {
                    App.UI.showToast('Decris ce que tu veux bosser', 'error');
                    return;
                }

                var inputModal = document.getElementById('library-generate-exercise-input-modal');
                if (inputModal) {
                    inputModal.classList.remove('active');
                    inputModal.setAttribute('aria-hidden', 'true');
                }

                generateExerciseSubmitBtn.disabled = true;
                var provider = App.Settings.get('preferredProvider') || 'deepseek';
                var modelName = typeof App.AICoach.resolveModelName === 'function'
                    ? App.AICoach.resolveModelName(provider) : provider;

                var workingOverlay = document.getElementById('library-generate-exercise-overlay');
                if (workingOverlay) {
                    workingOverlay.classList.add('active');
                    workingOverlay.setAttribute('aria-hidden', 'false');
                    var meta = document.getElementById('library-generate-exercise-meta');
                    if (meta) meta.textContent = 'Provider: ' + App.UI.escapeHtml(provider) + ' · Modele: ' + App.UI.escapeHtml(modelName);
                }

                App.AICoach.generateExercise({
                    provider: provider,
                    description: description,
                    gradeLevel: App.Settings.get('defaultGradeLevel'),
                    difficulty: App.Settings.get('defaultDifficulty')
                }).then(function (generated) {
                    var cleanStatement = App.ExerciseStore.cleanStatementText(generated.statement || '');
                    var normalizedSubject = App.ExerciseStore.normalizeSubject(generated.subject);
                    var normalizedTopic = App.ExerciseStore.normalizeTopic(generated.topic, normalizedSubject);
                    var now = new Date().toISOString();
                    var exercise = {
                        id: null,
                        isGeneratedDraft: true,
                        subject: normalizedSubject,
                        topic: normalizedTopic,
                        title: generated.title,
                        promptSourceScanId: null,
                        statement: cleanStatement || '',
                        instructions: generated.instructions || '',
                        gradeLevel: App.Settings.get('defaultGradeLevel'),
                        difficulty: generated.difficulty,
                        tags: ['genere'],
                        variants: [],
                        generationSeed: {
                            subject: normalizedSubject,
                            topic: normalizedTopic,
                            gradeLevel: App.Settings.get('defaultGradeLevel'),
                            tags: ['genere']
                        },
                        notes: '',
                        status: 'draft',
                        createdAt: now,
                        updatedAt: now,
                        assistantContext: null
                    };

                    if (workingOverlay) {
                        workingOverlay.classList.remove('active');
                        workingOverlay.setAttribute('aria-hidden', 'true');
                    }
                    generateExerciseSubmitBtn.disabled = false;
                    _setWorkingVariantDraft(exercise);
                    activeExerciseId = VARIANT_DRAFT_ACTIVE_ID;
                    if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) {
                        _setMobileEditorOpen(true);
                    }
                    App.UI.showToast('Exercice genere (brouillon non sauvegarde)', 'success');
                    App.Router.render();
                }).catch(function (err) {
                    if (workingOverlay) {
                        workingOverlay.classList.remove('active');
                        workingOverlay.setAttribute('aria-hidden', 'true');
                    }
                    generateExerciseSubmitBtn.disabled = false;
                    App.UI.showToast('Erreur lors de la generation: ' + (err.message || err), 'error');
                });
            });
        }

        var filter = document.getElementById('library-subject-filter');
        var topicFilter = document.getElementById('library-topic-filter');
        var search = document.getElementById('library-search');
        if (filter || topicFilter || search) {
            var applyFilters = function () {
                subjectFilterValue = filter ? filter.value : 'Toutes';
                var topics = topicOptions(exercises, subjectFilterValue);
                if (topics.indexOf(topicFilterValue) === -1) topicFilterValue = 'Tous';

                if (topicFilter) {
                    topicFilter.innerHTML = topics.map(function (topic) {
                        return '<option value="' + App.UI.escapeHtml(topic) + '"' + (topic === topicFilterValue ? ' selected' : '') + '>' + App.UI.escapeHtml(topic) + '</option>';
                    }).join('');
                    topicFilterValue = topicFilter.value;
                }

                searchValue = search ? search.value.trim() : '';
                var filtered = filterExercises(exercises);
                document.getElementById('exercise-list').innerHTML = renderExerciseList(filtered);
                bindExerciseSelection();
            };

            if (filter) filter.addEventListener('change', applyFilters);
            if (topicFilter) topicFilter.addEventListener('change', function () {
                topicFilterValue = topicFilter.value;
                applyFilters();
            });
            if (search) search.addEventListener('input', applyFilters);
        }

        var saveBtn = document.getElementById('save-exercise-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                if (workingVariantDraft) return;
                App.DB.getExercise(activeExerciseId).then(function (exercise) {
                    if (!exercise) return;
                    var next = Object.assign({}, exercise, {
                        title: document.getElementById('exercise-title').value.trim(),
                        subject: App.ExerciseStore.normalizeSubject(document.getElementById('exercise-subject').value),
                        topic: App.ExerciseStore.normalizeTopic(document.getElementById('exercise-topic').value, document.getElementById('exercise-subject').value),
                        gradeLevel: document.getElementById('exercise-grade').value,
                        difficulty: document.getElementById('exercise-difficulty').value,
                        instructions: document.getElementById('exercise-instructions').value.trim(),
                        statement: document.getElementById('exercise-statement').value.trim(),
                        tags: App.ExerciseStore.normalizeTags(document.getElementById('exercise-tags').value),
                        variants: App.ExerciseStore.normalizeVariants(document.getElementById('exercise-variants').value),
                        notes: document.getElementById('exercise-notes').value.trim(),
                        updatedAt: new Date().toISOString()
                    });
                    if (!confirmPlacementIfNeeded(exercises, next, 'la sauvegarde')) return;
                    return App.DB.saveExercise(next).then(function () {
                        App.UI.showToast('Exercice enregistre', 'success');
                        App.Router.render();
                    });
                });
            });
        }

        var generateVariantBtn = document.getElementById('generate-variant-btn');
        if (generateVariantBtn) {
            generateVariantBtn.addEventListener('click', function () {
                generateVariantFromExercise(activeExerciseId, generateVariantBtn, 'Generer une variante a bosser');
            });
        }

        var saveVariantDraftBtn = document.getElementById('save-variant-draft-btn');
        if (saveVariantDraftBtn) {
            saveVariantDraftBtn.addEventListener('click', function () {
                if (!workingVariantDraft) return;
                var source = sourceExerciseForDraft();
                if (!source) {
                    App.UI.showToast('Exercice source introuvable', 'error');
                    return;
                }

                var now = new Date().toISOString();
                var fixedSubject = App.ExerciseStore.normalizeSubject(source.subject || 'Autre');
                var fixedTopic = App.ExerciseStore.normalizeTopic(source.topic, fixedSubject);
                var newExercise = Object.assign({}, source, {
                    id: App.DB.nextId('exercise'),
                    title: _buildVariantTitle(source.title, document.getElementById('exercise-title').value),
                    subject: fixedSubject,
                    topic: fixedTopic,
                    gradeLevel: document.getElementById('exercise-grade').value,
                    difficulty: document.getElementById('exercise-difficulty').value,
                    instructions: document.getElementById('exercise-instructions').value.trim(),
                    statement: document.getElementById('exercise-statement').value.trim(),
                    tags: App.ExerciseStore.normalizeTags(document.getElementById('exercise-tags').value),
                    variants: App.ExerciseStore.normalizeVariants(document.getElementById('exercise-variants').value),
                    notes: document.getElementById('exercise-notes').value.trim(),
                    status: 'draft',
                    createdAt: now,
                    updatedAt: now
                });

                App.DB.saveExercise(newExercise).then(function () {
                    var sourceUpdate = Object.assign({}, source, {
                        variants: (source.variants || []).concat([
                            { id: App.DB.nextId('variant'), text: newExercise.statement }
                        ]),
                        updatedAt: new Date().toISOString()
                    });

                    return App.DB.saveExercise(sourceUpdate).then(function () {
                        _setWorkingVariantDraft(null);
                        activeExerciseId = newExercise.id;
                        localStorage.setItem(ACTIVE_KEY, activeExerciseId);
                        App.UI.showToast('Variante sauvegardee', 'success');
                        App.Router.render();
                    });
                }).catch(function (err) {
                    App.UI.showToast(err.message || 'Sauvegarde de la variante impossible', 'error');
                });
            });
        }

        var saveGeneratedDraftBtn = document.getElementById('save-generated-draft-btn');
        if (saveGeneratedDraftBtn) {
            saveGeneratedDraftBtn.addEventListener('click', function () {
                if (!workingVariantDraft || !workingVariantDraft.isGeneratedDraft) return;

                var now = new Date().toISOString();
                var subject = App.ExerciseStore.normalizeSubject(document.getElementById('exercise-subject').value);
                var topic = App.ExerciseStore.normalizeTopic(document.getElementById('exercise-topic').value, subject);
                var exercise = {
                    id: App.DB.nextId('exercise'),
                    subject: subject,
                    topic: topic,
                    title: document.getElementById('exercise-title').value.trim() || 'Exercice genere',
                    promptSourceScanId: null,
                    statement: App.ExerciseStore.cleanStatementText(document.getElementById('exercise-statement').value.trim()),
                    instructions: document.getElementById('exercise-instructions').value.trim(),
                    gradeLevel: document.getElementById('exercise-grade').value,
                    difficulty: document.getElementById('exercise-difficulty').value,
                    tags: App.ExerciseStore.normalizeTags(document.getElementById('exercise-tags').value),
                    variants: App.ExerciseStore.normalizeVariants(document.getElementById('exercise-variants').value),
                    generationSeed: {
                        subject: subject,
                        topic: topic,
                        gradeLevel: document.getElementById('exercise-grade').value,
                        tags: App.ExerciseStore.normalizeTags(document.getElementById('exercise-tags').value)
                    },
                    notes: document.getElementById('exercise-notes').value.trim(),
                    status: 'draft',
                    createdAt: now,
                    updatedAt: now,
                    assistantContext: null
                };

                if (!confirmPlacementIfNeeded(exercises, exercise, 'la sauvegarde')) return;
                App.DB.saveExercise(exercise).then(function () {
                    _setWorkingVariantDraft(null);
                    activeExerciseId = exercise.id;
                    localStorage.setItem(ACTIVE_KEY, activeExerciseId);
                    _setMobileEditorOpen(false);
                    App.UI.showToast('Exercice sauvegarde', 'success');
                    App.Router.render();
                }).catch(function (err) {
                    App.UI.showToast(err.message || 'Sauvegarde impossible', 'error');
                });
            });
        }

        var discardGeneratedDraftBtn = document.getElementById('discard-generated-draft-btn');
        if (discardGeneratedDraftBtn) {
            discardGeneratedDraftBtn.addEventListener('click', function () {
                if (!workingVariantDraft || !workingVariantDraft.isGeneratedDraft) return;
                _setWorkingVariantDraft(null);
                activeExerciseId = localStorage.getItem(ACTIVE_KEY) || null;
                _setMobileEditorOpen(false);
                App.UI.showToast('Brouillon IA annule', 'success');
                App.Router.render();
            });
        }

        var discardVariantDraftBtn = document.getElementById('discard-variant-draft-btn');
        if (discardVariantDraftBtn) {
            discardVariantDraftBtn.addEventListener('click', function () {
                _setWorkingVariantDraft(null);
                activeExerciseId = localStorage.getItem(ACTIVE_KEY) || null;
                _setMobileEditorOpen(false);
                App.UI.showToast('Variante brouillon annulee', 'success');
                App.Router.render();
            });
        }

        var backToListBtn = document.getElementById('library-back-to-list-btn');
        if (backToListBtn) {
            backToListBtn.addEventListener('click', function () {
                _setMobileEditorOpen(false);
                App.Router.render();
            });
        }

        // Attach voice input buttons to text fields
        if (typeof App.VoiceInput !== 'undefined') {
            App.VoiceInput.attachMicButton('library-generate-exercise-description');
            App.VoiceInput.attachMicButton('exercise-statement');
            App.VoiceInput.attachMicButton('exercise-instructions');
            App.VoiceInput.attachMicButton('exercise-notes');
        }

        var duplicateBtn = document.getElementById('duplicate-exercise-btn');
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', function () {
                _setWorkingVariantDraft(null);
                App.DB.getExercise(activeExerciseId).then(function (exercise) {
                    if (!exercise) return;
                    var copy = Object.assign({}, exercise, {
                        id: App.DB.nextId('exercise'),
                        subject: App.ExerciseStore.normalizeSubject(exercise.subject || 'Autre'),
                        topic: App.ExerciseStore.normalizeTopic(exercise.topic, exercise.subject || 'Autre'),
                        title: exercise.title + ' (copie)',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        variants: (exercise.variants || []).map(function (variant) {
                            return { id: App.DB.nextId('variant'), text: variant.text };
                        })
                    });
                    if (!confirmPlacementIfNeeded(exercises, copy, 'la duplication')) return;
                    return App.DB.saveExercise(copy).then(function () {
                        activeExerciseId = copy.id;
                        localStorage.setItem(ACTIVE_KEY, activeExerciseId);
                        App.UI.showToast('Exercice duplique', 'success');
                        App.Router.render();
                    });
                });
            });
        }

        var deleteBtn = document.getElementById('delete-exercise-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function () {
                _setWorkingVariantDraft(null);
                if (!window.confirm('Supprimer cet exercice ?')) return;
                App.DB.deleteExercise(activeExerciseId).then(function () {
                    activeExerciseId = null;
                    localStorage.removeItem(ACTIVE_KEY);
                    App.UI.showToast('Exercice supprime', 'success');
                    App.Router.render();
                });
            });
        }
    }

    return { render: render };
})();