var App = window.App || {};
App.Views = App.Views || {};

App.Views.Library = (function () {
    var ACTIVE_KEY = 'exophoto-library-active-exercise';
    var activeExerciseId = null;
    var subjectFilterValue = 'Toutes';
    var topicFilterValue = 'Tous';
    var searchValue = '';

    function uniqueSubjects(exercises) {
        var map = {};
        (exercises || []).forEach(function (exercise) {
            map[String(exercise.subject || 'Autre')] = true;
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
            var subject = String(exercise.subject || 'Autre');
            var topic = App.ExerciseStore.normalizeTopic(exercise.topic);

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

        var subject = String(exercise.subject || 'Autre');
        var topic = App.ExerciseStore.normalizeTopic(exercise.topic);
        var message =
            'Nouveau classement detecte pour ' + contextLabel + '.\n\n' +
            'Matiere: ' + subject + '\n' +
            'Sujet: ' + topic + '\n\n' +
            'Aucun exercice existant ne correspond a cette combinaison.\n' +
            'Voulez-vous la creer quand meme ?';
        return window.confirm(message);
    }

    function render(container) {
        App.DB.getExercises().then(function (exercises) {
            exercises = (exercises || []).map(function (exercise) {
                var subject = exercise.subject || 'Autre';
                var title = exercise.title || 'Exercice';
                var statement = App.ExerciseStore.cleanStatementText(exercise.statement || '');
                var normalizedTopic = App.ExerciseStore.normalizeTopic(exercise.topic);
                var topic = App.ExerciseStore.isUnclassifiedTopic(normalizedTopic)
                    ? App.ExerciseStore.inferTopic(subject, title, statement)
                    : normalizedTopic;
                return Object.assign({}, exercise, {
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
            activeExerciseId = active ? active.id : null;
            if (activeExerciseId) localStorage.setItem(ACTIVE_KEY, activeExerciseId);

            var filtered = filterExercises(exercises);

            container.innerHTML =
                '<div class="page-stack">' +
                    '<section class="hero">' +
                        '<h1>Bibliotheque d\'exercices</h1>' +
                        '<p>Classement a deux niveaux: matiere puis sujet. Chaque ajout verifie si la combinaison existe deja.</p>' +
                    '</section>' +
                    '<section class="two-col">' +
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
                            '</div>' +
                            '<div id="exercise-list" class="exercise-list">' + renderExerciseList(filtered) + '</div>' +
                        '</div>' +
                        '<div class="editor-card">' + renderEditor(active) + '</div>' +
                    '</section>' +
                '</div>';

            bindEvents(exercises);
            App.UI.renderMath(container);
        });
    }

    function renderExerciseList(exercises) {
        if (!exercises.length) {
            return '<div class="empty-state">Aucun exercice enregistre. Convertis un scan OCR ou cree une fiche vierge.</div>';
        }

        return exercises.map(function (exercise) {
            var topic = App.ExerciseStore.normalizeTopic(exercise.topic);
            return '<div class="exercise-item ' + (exercise.id === activeExerciseId ? 'active' : '') + '" data-exercise-id="' + exercise.id + '">' +
                '<h3>' + App.UI.escapeHtml(exercise.title || 'Exercice') + '</h3>' +
                '<div class="exercise-meta">' +
                    '<div>' + App.UI.escapeHtml(exercise.subject || 'Sans matiere') + ' · ' + App.UI.escapeHtml(topic) + '</div>' +
                    '<div>' + App.UI.escapeHtml(exercise.gradeLevel || 'Niveau libre') + ' · ' + App.UI.escapeHtml(exercise.difficulty || 'Moyen') + '</div>' +
                    '<div>Maj ' + App.UI.formatDate(exercise.updatedAt || exercise.createdAt) + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    function renderEditor(exercise) {
        if (!exercise) {
            return '<div class="empty-state">Selectionne un exercice ou cree une fiche vide.</div>';
        }

        return '' +
            '<h2>Edition</h2>' +
            '<div class="field-grid two">' +
                '<label>Titre<input id="exercise-title" value="' + App.UI.escapeHtml(exercise.title || '') + '"></label>' +
                '<label>Matiere<select id="exercise-subject">' + options(App.ExerciseStore.subjectOptions(), exercise.subject) + '</select></label>' +
                '<label>Sujet<input id="exercise-topic" list="topic-options" value="' + App.UI.escapeHtml(App.ExerciseStore.normalizeTopic(exercise.topic)) + '" placeholder="Ex: Calcul litteral"></label>' +
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
                '<button id="save-exercise-btn">Enregistrer</button>' +
                '<button id="duplicate-exercise-btn" class="secondary">Dupliquer</button>' +
                '<button id="delete-exercise-btn" class="danger">Supprimer</button>' +
            '</div>' +
            '<p class="muted">Preparation deja prevue pour la generation future: matiere, niveau, tags, variantes et contexte assistant sont stockes.</p>';
    }

    function options(values, selected) {
        return values.map(function (value) {
            return '<option value="' + App.UI.escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + App.UI.escapeHtml(value) + '</option>';
        }).join('');
    }

    function bindEvents(exercises) {
        function bindExerciseSelection() {
            document.querySelectorAll('[data-exercise-id]').forEach(function (item) {
                item.addEventListener('click', function () {
                    activeExerciseId = item.getAttribute('data-exercise-id');
                    localStorage.setItem(ACTIVE_KEY, activeExerciseId);
                    App.Router.render();
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
                var now = new Date().toISOString();
                var exercise = {
                    id: App.DB.nextId('exercise'),
                    subject: App.Settings.get('defaultSubject'),
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
                        subject: App.Settings.get('defaultSubject'),
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
                App.DB.getExercise(activeExerciseId).then(function (exercise) {
                    if (!exercise) return;
                    var next = Object.assign({}, exercise, {
                        title: document.getElementById('exercise-title').value.trim(),
                        subject: document.getElementById('exercise-subject').value,
                        topic: App.ExerciseStore.normalizeTopic(document.getElementById('exercise-topic').value),
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

        var duplicateBtn = document.getElementById('duplicate-exercise-btn');
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', function () {
                App.DB.getExercise(activeExerciseId).then(function (exercise) {
                    if (!exercise) return;
                    var copy = Object.assign({}, exercise, {
                        id: App.DB.nextId('exercise'),
                        topic: App.ExerciseStore.normalizeTopic(exercise.topic),
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