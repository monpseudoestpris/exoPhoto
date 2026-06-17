var App = window.App || {};
App.Views = App.Views || {};

App.Views.Library = (function () {
    var ACTIVE_KEY = 'exophoto-library-active-exercise';
    var activeExerciseId = null;

    function render(container) {
        App.DB.getExercises().then(function (exercises) {
            activeExerciseId = localStorage.getItem(ACTIVE_KEY) || activeExerciseId;
            var subjects = ['Toutes'].concat(App.ExerciseStore.subjectOptions().filter(function (subject) {
                return exercises.some(function (exercise) { return exercise.subject === subject; });
            }));
            var active = exercises.find(function (exercise) { return exercise.id === activeExerciseId; }) || exercises[0] || null;
            activeExerciseId = active ? active.id : null;
            if (activeExerciseId) localStorage.setItem(ACTIVE_KEY, activeExerciseId);

            container.innerHTML =
                '<div class="page-stack">' +
                    '<section class="hero">' +
                        '<h1>Bibliotheque d\'exercices</h1>' +
                        '<p>Cette base locale sert a rejouer, modifier et plus tard regenerer des exercices equivalentes par matiere.</p>' +
                    '</section>' +
                    '<section class="two-col">' +
                        '<div class="list-card">' +
                            '<div class="inline-actions">' +
                                '<label>Matiere' +
                                    '<select id="library-subject-filter">' + subjects.map(function (subject) {
                                        return '<option value="' + App.UI.escapeHtml(subject) + '">' + App.UI.escapeHtml(subject) + '</option>';
                                    }).join('') + '</select>' +
                                '</label>' +
                                '<label>Recherche rapide' +
                                    '<input id="library-search" type="search" placeholder="Titre, matiere, tag...">' +
                                '</label>' +
                                '<button id="create-empty-exercise" class="secondary">Preparer un exo vierge</button>' +
                            '</div>' +
                            '<div id="exercise-list" class="exercise-list">' + renderExerciseList(exercises) + '</div>' +
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
            return '<div class="exercise-item ' + (exercise.id === activeExerciseId ? 'active' : '') + '" data-exercise-id="' + exercise.id + '">' +
                '<h3>' + App.UI.escapeHtml(exercise.title || 'Exercice') + '</h3>' +
                '<div class="exercise-meta">' +
                    '<div>' + App.UI.escapeHtml(exercise.subject || 'Sans matiere') + '</div>' +
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
                '<label>Niveau<select id="exercise-grade">' + options(App.ExerciseStore.gradeOptions(), exercise.gradeLevel) + '</select></label>' +
                '<label>Difficulte<select id="exercise-difficulty">' + options(App.ExerciseStore.difficultyOptions(), exercise.difficulty) + '</select></label>' +
            '</div>' +
            '<label>Consignes<textarea id="exercise-instructions">' + App.UI.escapeHtml(exercise.instructions || '') + '</textarea></label>' +
            '<label>Enonce<textarea id="exercise-statement">' + App.UI.escapeHtml(exercise.statement || '') + '</textarea></label>' +
            '<div><small class="muted">Aperçu LaTeX</small><div id="exercise-statement-preview" class="latex-preview math-content">' + App.UI.escapeHtml(exercise.statement || '') + '</div></div>' +
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

        var statementInput = document.getElementById('exercise-statement');
        var statementPreview = document.getElementById('exercise-statement-preview');
        if (statementInput && statementPreview) {
            statementInput.addEventListener('input', function () {
                statementPreview.textContent = statementInput.value;
                App.UI.renderMath(statementPreview);
            });
        }

        bindExerciseSelection();

        var createBtn = document.getElementById('create-empty-exercise');
        if (createBtn) {
            createBtn.addEventListener('click', function () {
                var now = new Date().toISOString();
                var exercise = {
                    id: App.DB.nextId('exercise'),
                    subject: App.Settings.get('defaultSubject'),
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
                        gradeLevel: App.Settings.get('defaultGradeLevel'),
                        tags: []
                    },
                    notes: '',
                    status: 'draft',
                    createdAt: now,
                    updatedAt: now,
                    assistantContext: null
                };
                App.DB.saveExercise(exercise).then(function () {
                    activeExerciseId = exercise.id;
                    localStorage.setItem(ACTIVE_KEY, activeExerciseId);
                    App.UI.showToast('Fiche vide creee', 'success');
                    App.Router.render();
                });
            });
        }

        var filter = document.getElementById('library-subject-filter');
        var search = document.getElementById('library-search');
        if (filter || search) {
            var applyFilters = function () {
                var subjectValue = filter ? filter.value : 'Toutes';
                var query = search ? search.value.trim().toLowerCase() : '';
                var filtered = exercises.filter(function (exercise) {
                    var matchSubject = subjectValue === 'Toutes' || exercise.subject === subjectValue;
                    if (!matchSubject) return false;
                    if (!query) return true;
                    var haystack = [
                        exercise.title,
                        exercise.subject,
                        exercise.gradeLevel,
                        exercise.difficulty,
                        (exercise.tags || []).join(' '),
                        exercise.statement
                    ].join(' ').toLowerCase();
                    return haystack.indexOf(query) !== -1;
                });
                document.getElementById('exercise-list').innerHTML = renderExerciseList(filtered);
                bindExerciseSelection();
            };

            if (filter) filter.addEventListener('change', applyFilters);
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
                        gradeLevel: document.getElementById('exercise-grade').value,
                        difficulty: document.getElementById('exercise-difficulty').value,
                        instructions: document.getElementById('exercise-instructions').value.trim(),
                        statement: document.getElementById('exercise-statement').value.trim(),
                        tags: App.ExerciseStore.normalizeTags(document.getElementById('exercise-tags').value),
                        variants: App.ExerciseStore.normalizeVariants(document.getElementById('exercise-variants').value),
                        notes: document.getElementById('exercise-notes').value.trim(),
                        updatedAt: new Date().toISOString()
                    });
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
                        title: exercise.title + ' (copie)',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        variants: (exercise.variants || []).map(function (variant) {
                            return { id: App.DB.nextId('variant'), text: variant.text };
                        })
                    });
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