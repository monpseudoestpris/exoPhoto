var App = window.App || {};
App.Views = App.Views || {};

App.Views.Exercise = (function () {
    var ACTIVE_KEY = 'exophoto-library-active-exercise';

    function _getExerciseIdFromHash() {
        var hash = window.location.hash || '';
        var queryIndex = hash.indexOf('?');
        if (queryIndex < 0) return localStorage.getItem(ACTIVE_KEY) || '';

        var params = new URLSearchParams(hash.slice(queryIndex + 1));
        return params.get('id') || localStorage.getItem(ACTIVE_KEY) || '';
    }

    function _findExercise(exercises, id) {
        return (exercises || []).find(function (exercise) {
            return exercise.id === id;
        }) || null;
    }

    function _statementPreview(exercise) {
        var text = App.ExerciseStore.cleanStatementText(String(exercise && exercise.statement || ''));
        if (!text) return 'Aucun enonce disponible.';
        return text;
    }

    function _openCoachForExercise(exerciseId) {
        if (!exerciseId) return;
        localStorage.setItem('exophoto-coach-active-exercise', exerciseId);
        localStorage.setItem('exophoto-coach-mobile-list-open', '0');
        App.Router.navigate('#/coach');
    }

    function render(container) {
        App.DB.getExercises().then(function (exercises) {
            var exerciseId = _getExerciseIdFromHash();
            var exercise = _findExercise(exercises, exerciseId) || exercises[0] || null;

            if (!exercise) {
                container.innerHTML = '' +
                    '<div class="page-stack">' +
                        '<section class="hero">' +
                            '<h1>Exercice</h1>' +
                            '<p>Aucun exercice disponible pour cette page.</p>' +
                            '<div class="hero-actions">' +
                                '<a class="button-link" href="#/library">Retour a la bibliotheque</a>' +
                            '</div>' +
                        '</section>' +
                    '</div>';
                return;
            }

            localStorage.setItem(ACTIVE_KEY, exercise.id);
            return (exercise.promptSourceScanId ? App.DB.getScan(exercise.promptSourceScanId) : Promise.resolve(null)).then(function (sourceScan) {
                var preview = _statementPreview(exercise);
                var normalizedSubject = App.ExerciseStore.normalizeSubject(exercise.subject || 'Autre');
                var normalizedTopic = App.ExerciseStore.normalizeTopic(exercise.topic, normalizedSubject);
                var variants = (exercise.variants || []).map(function (variant) {
                    return App.UI.escapeHtml((variant && variant.text) || '');
                }).filter(Boolean);
                var tags = (exercise.tags || []).map(function (tag) {
                    return App.UI.badge(tag);
                }).join(' ');

                container.innerHTML = '' +
                    '<div class="page-stack">' +
                        '<section class="hero exercise-detail-hero">' +
                            '<div class="exercise-detail-nav-top">' +
                                '<a class="button-link ghost" href="#/library">← Retour a la liste</a>' +
                            '</div>' +
                            '<h1>' + App.UI.escapeHtml(exercise.title || 'Exercice') + '</h1>' +
                            '<p>Page dédiée pour travailler l\'exo sans garder le panneau de liste sous les yeux.</p>' +
                            '<button id="exercise-start-coach" class="button-link exercise-start-coach" style="margin-top: 1rem; min-height: 50px; font-size: 1.05rem;">▶ Travailler avec le Prof IA</button>' +
                            '<div class="chip-row">' +
                                App.UI.badge(normalizedSubject) +
                                App.UI.badge(normalizedTopic) +
                                App.UI.badge(exercise.gradeLevel || 'Niveau libre') +
                                App.UI.badge(exercise.difficulty || 'Moyen') +
                            '</div>' +
                        '</section>' +
                        '<section class="editor-card exercise-detail-card">' +
                            '<div class="exercise-detail-grid">' +
                                '<div class="exercise-detail-main">' +
                                    '<div class="statement-tools"><h2>Aperçu de l\'énoncé</h2>' + App.UI.sourceDocumentButton(sourceScan, 'Document fourni') + '</div>' +
                                    '<div class="exercise-detail-statement statement-box math-content">' + App.UI.statementHtml(preview, sourceScan) + '</div>' +
                                '</div>' +
                                '<aside class="exercise-detail-side">' +
                                    '<h2>Infos</h2>' +
                                    '<div class="scan-meta">' +
                                        '<div><strong>Matiere</strong><br>' + App.UI.escapeHtml(normalizedSubject) + '</div>' +
                                        '<div><strong>Sujet</strong><br>' + App.UI.escapeHtml(normalizedTopic) + '</div>' +
                                        '<div><strong>Niveau</strong><br>' + App.UI.escapeHtml(exercise.gradeLevel || 'Niveau libre') + '</div>' +
                                        '<div><strong>Difficulte</strong><br>' + App.UI.escapeHtml(exercise.difficulty || 'Moyen') + '</div>' +
                                    '</div>' +
                                    '<h3>Consignes</h3>' +
                                    '<div class="statement-box">' + App.UI.escapeHtml(exercise.instructions || '—') + '</div>' +
                                    '<h3>Tags</h3>' +
                                    '<div class="chip-row">' + (tags || '<span class="muted">Aucun tag</span>') + '</div>' +
                                    '<h3>Variantes</h3>' +
                                    '<div class="statement-box">' + (variants.length ? variants.map(function (variant) { return '• ' + variant; }).join('\n') : 'Aucune variante enregistree.') + '</div>' +
                                    '<a class="button-link secondary" href="#/library" style="margin-top: 1rem; width: 100%;">Ouvrir dans la Bibliotheque</a>' +
                                '</aside>' +
                            '</div>' +
                        '</section>' +
                    '</div>';

                App.UI.bindDocumentViewer(container);
                App.UI.renderMath(container);

                var coachBtn = container.querySelector('#exercise-start-coach');
                if (coachBtn) {
                    coachBtn.addEventListener('click', function () {
                        _openCoachForExercise(exercise.id);
                    });
                }
            });
        });
    }

    return {
        render: render
    };
})();
