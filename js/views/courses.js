var App = window.App || {};
App.Views = App.Views || {};

App.Views.Courses = (function () {
    var ACTIVE_KEY = 'exophoto-courses-active-mini-course';

    function render(container) {
        App.DB.getMiniCourses().then(function (courses) {
            var activeId = localStorage.getItem(ACTIVE_KEY) || (courses[0] && courses[0].id) || null;
            var active = courses.find(function (course) { return course.id === activeId; }) || courses[0] || null;

            if (active) {
                localStorage.setItem(ACTIVE_KEY, active.id);
            } else {
                localStorage.removeItem(ACTIVE_KEY);
            }

            container.innerHTML =
                '<div class="page-stack">' +
                    '<section class="hero">' +
                        '<h1>Petits cours</h1>' +
                        '<p>Ton coin de syntheses sauvegardees par matiere et sujet.</p>' +
                    '</section>' +
                    '<section class="editor-card course-reader-card">' + renderCourseDetail(active) + '</section>' +
                    '<section class="list-card course-library-card">' +
                        '<div class="coach-list-head">' +
                            '<h2>Bibliotheque de cours</h2>' +
                            '<small class="muted">' + courses.length + ' cours</small>' +
                        '</div>' +
                        '<div class="exercise-list course-library-list">' + renderCourseList(courses, activeId) + '</div>' +
                    '</section>' +
                '</div>';

            bindEvents(container, courses, active);
            App.UI.renderMath(container);
        });
    }

    function renderCourseList(courses, activeId) {
        if (!courses.length) {
            return '<div class="empty-state">Aucun petit cours sauvegarde pour l\'instant. Utilise "L\'essentiel" depuis un exercice.</div>';
        }

        return courses.map(function (course) {
            return '<article class="exercise-item ' + (course.id === activeId ? 'active' : '') + '" data-course-id="' + App.UI.escapeHtml(course.id) + '">' +
                '<div class="exercise-item-head">' +
                    '<h3>' + App.UI.escapeHtml(course.title || 'Petit cours') + '</h3>' +
                    '<button class="danger" data-course-delete="' + App.UI.escapeHtml(course.id) + '">Supprimer</button>' +
                '</div>' +
                '<div class="exercise-meta">' +
                    '<div>' + App.UI.escapeHtml(course.subject || 'Autre') + ' · ' + App.UI.escapeHtml(course.topic || App.ExerciseStore.defaultTopic()) + '</div>' +
                    '<div>Maj ' + App.UI.formatDate(course.updatedAt || course.createdAt) + '</div>' +
                '</div>' +
            '</article>';
        }).join('');
    }

    function renderCourseDetail(course) {
        if (!course) {
            return '<div class="empty-state">Selectionne un petit cours pour voir le detail.</div>';
        }

        return '' +
            '<h2>' + App.UI.escapeHtml(course.title || 'Petit cours') + '</h2>' +
            '<div class="chip-row">' +
                App.UI.badge(course.subject || 'Autre') +
                App.UI.badge(course.topic || App.ExerciseStore.defaultTopic()) +
            '</div>' +
            '<div class="scan-meta">' +
                '<div>Cree le ' + App.UI.formatDate(course.createdAt) + '</div>' +
                '<div>Maj le ' + App.UI.formatDate(course.updatedAt || course.createdAt) + '</div>' +
            '</div>' +
            '<h3>Synthese</h3>' +
            '<div class="ocr-output math-content course-reader-body">' + App.UI.escapeHtml(course.base || '') + '</div>';
    }

    function bindEvents(container, courses, active) {
        container.querySelectorAll('[data-course-id]').forEach(function (item) {
            item.addEventListener('click', function () {
                var id = item.getAttribute('data-course-id');
                localStorage.setItem(ACTIVE_KEY, id);
                App.Router.render();
            });
        });

        container.querySelectorAll('[data-course-delete]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                var id = button.getAttribute('data-course-delete');
                if (!id) return;
                if (!window.confirm('Supprimer ce petit cours ?')) return;

                App.DB.deleteMiniCourse(id).then(function () {
                    if (active && active.id === id) {
                        var remaining = courses.filter(function (course) { return course.id !== id; });
                        if (remaining.length) localStorage.setItem(ACTIVE_KEY, remaining[0].id);
                        else localStorage.removeItem(ACTIVE_KEY);
                    }
                    App.UI.showToast('Petit cours supprime', 'success');
                    App.Router.render();
                });
            });
        });
    }

    return { render: render };
})();
