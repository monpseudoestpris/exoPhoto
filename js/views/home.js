var App = window.App || {};
App.Views = App.Views || {};

App.Views.Home = (function () {
    function render(container) {
        Promise.all([App.DB.getScans(), App.DB.getExercises()]).then(function (results) {
            var scans = results[0];
            var exercises = results[1];
            var activeId = App.ScanStore.getActiveScanId();
            var activeScan = scans.find(function (scan) { return scan.id === activeId; }) || scans[0] || null;
            var recentExercises = exercises.slice().sort(function (a, b) {
                var aa = new Date(a.updatedAt || a.createdAt || 0).getTime();
                var bb = new Date(b.updatedAt || b.createdAt || 0).getTime();
                return bb - aa;
            }).slice(0, 5);
            if (activeScan) App.ScanStore.setActiveScanId(activeScan.id);

            container.innerHTML =
                '<div class="page-stack">' +
                    '<section class="hero">' +
                        '<h1>Photo, OCR, exos. Simple et rapide.</h1>' +
                        '<p>Commence ici: prends une photo ou importe une image. Ensuite, retrouve tes exos en un geste.</p>' +
                        '<div class="hero-actions">' +
                            '<a class="button-link cta-prominent" href="#/capture">Prendre une photo / Upload</a>' +
                            '<a class="button-link secondary" href="#/library">Aller aux exercices</a>' +
                        '</div>' +
                        '<div class="quick-exercise-grid">' +
                            '<article class="quick-card">' +
                                '<h3>Reprendre vite</h3>' +
                                '<div class="quick-chip-row">' + renderRecentExercises(recentExercises) + '</div>' +
                            '</article>' +
                            '<article class="quick-card">' +
                                '<h3>Parcours express</h3>' +
                                '<div class="quick-stack">' +
                                    '<a class="button-link ghost" href="#/library">Bibliotheque complete</a>' +
                                    '<a class="button-link ghost" href="#/coach">Prof IA</a>' +
                                '</div>' +
                            '</article>' +
                        '</div>' +
                        '<div class="summary-grid">' +
                            summaryCard('Scans', String(scans.length)) +
                            summaryCard('Exercices', String(exercises.length)) +
                            summaryCard('Matieres', String(uniqueSubjects(exercises).length)) +
                        '</div>' +
                    '</section>' +
                    '<section class="two-col">' +
                        '<div class="panel">' +
                            '<h2>Scans recents</h2>' +
                            renderTabs(scans, activeScan) +
                        '</div>' +
                        '<div class="scan-detail">' + renderScanDetail(activeScan) + '</div>' +
                    '</section>' +
                '</div>';

            bindEvents(scans, activeScan);
            App.UI.renderMath(container);
        }).catch(function (err) {
            container.innerHTML = '<div class="empty-state">Erreur au chargement: ' + App.UI.escapeHtml(err.message || String(err)) + '</div>';
        });
    }

    function summaryCard(label, value) {
        return '<div class="summary-card"><span class="summary-label">' + label + '</span><span class="summary-value">' + value + '</span></div>';
    }

    function uniqueSubjects(exercises) {
        var seen = {};
        exercises.forEach(function (exercise) { if (exercise.subject) seen[exercise.subject] = true; });
        return Object.keys(seen);
    }

    function renderRecentExercises(exercises) {
        if (!exercises.length) {
            return '<span class="muted">Aucun exo recent. Scanne d\'abord une feuille.</span>';
        }

        return exercises.map(function (exercise) {
            return '<a class="quick-chip" href="#/library" data-open-exercise="' + App.UI.escapeHtml(exercise.id) + '">' +
                App.UI.escapeHtml(exercise.title || 'Exercice') +
            '</a>';
        }).join('');
    }

    function renderTabs(scans, activeScan) {
        if (!scans.length) {
            return '<div class="empty-state">Aucun scan pour l\'instant. Lance une capture pour ouvrir le premier onglet.</div>';
        }

        return '<div class="tab-strip">' + scans.map(function (scan) {
            var statusClass = scan.ocrStatus === 'error' ? 'error' : (scan.ocrStatus === 'pending' ? 'pending' : '');
            return '<button class="tab-button ' + (activeScan && activeScan.id === scan.id ? 'active' : '') + '" data-scan-tab="' + scan.id + '">' +
                App.UI.escapeHtml(scan.title || 'Scan') + ' ' + App.UI.badge(scan.ocrStatus, statusClass) +
            '</button>';
        }).join('') + '</div>';
    }

    function renderScanDetail(scan) {
        if (!scan) {
            return '<div class="empty-state">Choisis un scan pour voir son detail.</div>';
        }

        var text = scan.ocrText ? App.UI.escapeHtml(scan.ocrText) : 'Pas encore de texte OCR.';
        return '' +
            '<div class="status-row">' +
                App.UI.badge(scan.ocrStatus, scan.ocrStatus === 'error' ? 'error' : (scan.ocrStatus === 'pending' ? 'pending' : '')) +
                App.UI.badge(scan.subjectGuess || 'Matiere a confirmer') +
            '</div>' +
            '<h2>' + App.UI.escapeHtml(scan.title || 'Scan') + '</h2>' +
            '<div class="scan-meta">' +
                '<div>Cree le ' + App.UI.formatDate(scan.createdAt) + '</div>' +
                '<div>Source: ' + App.UI.escapeHtml(scan.sourceType || 'upload') + '</div>' +
                '<div>Provider OCR: ' + App.UI.escapeHtml(scan.ocrProvider || 'mistral') + '</div>' +
            '</div>' +
            (scan.imageDataUrl ? '<img class="image-preview" src="' + scan.imageDataUrl + '" alt="Apercu du scan">' : '') +
            '<div class="section-actions">' +
                '<button class="secondary" id="rename-scan-btn">Renommer</button>' +
                '<button class="ghost" id="copy-ocr-btn">Copier le texte</button>' +
                '<button id="convert-scan-btn" ' + (scan.ocrText ? '' : 'disabled') + '>Transformer en exercice</button>' +
                '<button class="danger" id="delete-scan-btn">Supprimer</button>' +
            '</div>' +
            '<h3>Texte OCR</h3>' +
                '<div class="ocr-output math-content">' + text + '</div>';
    }

    function bindEvents(scans, activeScan) {
        document.querySelectorAll('[data-scan-tab]').forEach(function (button) {
            button.addEventListener('click', function () {
                App.ScanStore.setActiveScanId(button.getAttribute('data-scan-tab'));
                App.Router.render();
            });
        });

        document.querySelectorAll('[data-open-exercise]').forEach(function (link) {
            link.addEventListener('click', function () {
                localStorage.setItem('exophoto-library-active-exercise', link.getAttribute('data-open-exercise'));
            });
        });

        var renameBtn = document.getElementById('rename-scan-btn');
        if (renameBtn && activeScan) {
            renameBtn.addEventListener('click', function () {
                var title = window.prompt('Nouveau titre du scan', activeScan.title || '');
                if (!title) return;
                App.ScanStore.updateScan(activeScan, { title: title }).then(function () {
                    App.UI.showToast('Scan renomme', 'success');
                    App.Router.render();
                });
            });
        }

        var deleteBtn = document.getElementById('delete-scan-btn');
        if (deleteBtn && activeScan) {
            deleteBtn.addEventListener('click', function () {
                if (!window.confirm('Supprimer ce scan ?')) return;
                App.DB.deleteScan(activeScan.id).then(function () {
                    App.ScanStore.setActiveScanId(scans[1] ? scans[1].id : null);
                    App.UI.showToast('Scan supprime', 'success');
                    App.Router.render();
                });
            });
        }

        var copyBtn = document.getElementById('copy-ocr-btn');
        if (copyBtn && activeScan) {
            copyBtn.addEventListener('click', function () {
                navigator.clipboard.writeText(activeScan.ocrText || '').then(function () {
                    App.UI.showToast('Texte OCR copie', 'success');
                }).catch(function () {
                    App.UI.showToast('Impossible de copier', 'error');
                });
            });
        }

        var convertBtn = document.getElementById('convert-scan-btn');
        if (convertBtn && activeScan) {
            convertBtn.addEventListener('click', function () {
                var subject = window.prompt('Matiere', activeScan.subjectGuess || App.Settings.get('defaultSubject'));
                if (!subject) return;
                var title = window.prompt('Titre de l\'exercice', activeScan.title || 'Exercice OCR');
                if (!title) return;
                var exercise = App.ExerciseStore.fromScan(activeScan, { subject: subject, title: title });
                App.DB.saveExercise(exercise).then(function () {
                    App.UI.showToast('Exercice ajoute a la bibliotheque', 'success');
                    App.Router.navigate('#/library');
                });
            });
        }
    }

    return { render: render };
})();