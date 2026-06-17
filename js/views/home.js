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
                '<div class="page-stack home-stack">' +
                    '<header class="home-head">' +
                        '<div class="home-head-text">' +
                            '<h1>Tes exos, en un geste</h1>' +
                            '<p class="muted">Scanne une feuille, bosse avec le Prof IA, génère des variantes.</p>' +
                        '</div>' +
                        '<div class="home-stats-inline">' +
                            statChip('book', String(exercises.length), 'exos') +
                            statChip('camera', String(scans.length), 'scans') +
                            statChip('sparkles', String(uniqueSubjects(exercises).length), 'matieres') +
                        '</div>' +
                    '</header>' +

                    '<a class="primary-action" href="#/capture">' +
                        '<span class="primary-action-icons">' + App.UI.icon('camera') + App.UI.icon('upload') + '</span>' +
                        '<span class="primary-action-text">' +
                            '<span class="primary-action-title">Scanner ou importer</span>' +
                            '<span class="primary-action-sub">Prends une photo ou importe une image pour creer un exo.</span>' +
                        '</span>' +
                        '<span class="primary-action-arrow">' + App.UI.icon('arrow') + '</span>' +
                    '</a>' +

                    '<section class="home-section">' +
                        '<div class="home-section-head">' +
                            '<span class="section-icon">' + App.UI.icon('teacher') + '</span>' +
                            '<h2>Bosser sur un exo</h2>' +
                            '<a class="text-link" href="#/library">Tout voir' + App.UI.icon('arrow') + '</a>' +
                        '</div>' +
                        '<div class="exo-quick-grid">' + renderExoTiles(recentExercises) + '</div>' +
                    '</section>' +

                    '<section class="home-section">' +
                        '<div class="home-section-head">' +
                            '<span class="section-icon">' + App.UI.icon('sparkles') + '</span>' +
                            '<h2>Generer des variantes</h2>' +
                        '</div>' +
                        '<div class="variant-cta-card">' +
                            '<p class="muted">Choisis un exercice et cree des variantes pour t\'entrainer a l\'infini.</p>' +
                            '<a class="button-link cta-prominent" href="#/library">' + App.UI.icon('sparkles') + 'Choisir un exo</a>' +
                        '</div>' +
                    '</section>' +

                    (scans.length ?
                        '<section class="home-section home-section-muted">' +
                            '<div class="home-section-head">' +
                                '<span class="section-icon">' + App.UI.icon('camera') + '</span>' +
                                '<h2>Derniers scans</h2>' +
                                '<button class="text-link danger-link" id="clear-scans-btn">' + App.UI.icon('trash') + 'Tout effacer</button>' +
                            '</div>' +
                            '<div class="two-col">' +
                                '<div class="panel">' + renderTabs(scans, activeScan) + '</div>' +
                                '<div class="scan-detail">' + renderScanDetail(activeScan) + '</div>' +
                            '</div>' +
                        '</section>'
                    : '') +
                '</div>';

            bindEvents(scans, activeScan);
            App.UI.renderMath(container);
        }).catch(function (err) {
            container.innerHTML = '<div class="empty-state">Erreur au chargement: ' + App.UI.escapeHtml(err.message || String(err)) + '</div>';
        });
    }

    function statChip(iconName, value, label) {
        return '<span class="stat-chip">' + App.UI.icon(iconName) +
            '<strong>' + App.UI.escapeHtml(value) + '</strong>' +
            '<span>' + App.UI.escapeHtml(label) + '</span></span>';
    }

    function uniqueSubjects(exercises) {
        var seen = {};
        exercises.forEach(function (exercise) { if (exercise.subject) seen[exercise.subject] = true; });
        return Object.keys(seen);
    }

    function renderExoTiles(exercises) {
        if (!exercises.length) {
            return '<div class="empty-state">Aucun exo pour l\'instant. Scanne une feuille pour commencer.</div>';
        }

        return exercises.map(function (exercise) {
            var subject = exercise.subject ? App.ExerciseStore.normalizeSubject(exercise.subject) : '';
            var topic = exercise.topic ? App.ExerciseStore.normalizeTopic(exercise.topic, subject) : '';
            var meta = [subject, topic].filter(Boolean).join(' · ');
            return '<button class="exo-quick-tile" data-coach-open="' + App.UI.escapeHtml(exercise.id) + '">' +
                '<span class="exo-quick-title">' + App.UI.escapeHtml(exercise.title || 'Exercice') + '</span>' +
                (meta ? '<span class="exo-quick-meta">' + App.UI.escapeHtml(meta) + '</span>' : '') +
                '<span class="exo-quick-go">' + App.UI.icon('play') + '</span>' +
            '</button>';
        }).join('');
    }

    function renderTabs(scans, activeScan) {
        if (!scans.length) {
            return '<div class="empty-state">Aucun scan pour l\'instant. Lance une capture pour ouvrir le premier onglet.</div>';
        }

        return '<div class="tab-strip">' + scans.map(function (scan) {
            var statusClass = scan.ocrStatus === 'error' ? 'error' : (scan.ocrStatus === 'pending' ? 'pending' : '');
            return '<div class="scan-tab-item ' + (activeScan && activeScan.id === scan.id ? 'active' : '') + '">' +
                '<button class="tab-button" data-scan-tab="' + scan.id + '">' +
                    App.UI.escapeHtml(scan.title || 'Scan') + ' ' + App.UI.badge(scan.ocrStatus, statusClass) +
                '</button>' +
                '<button class="scan-tab-delete" data-scan-delete="' + scan.id + '" title="Supprimer ce scan" aria-label="Supprimer ce scan">' + App.UI.icon('trash') + '</button>' +
            '</div>';
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

        document.querySelectorAll('[data-scan-delete]').forEach(function (button) {
            button.addEventListener('click', function (event) {
                event.stopPropagation();
                var scanId = button.getAttribute('data-scan-delete');
                var target = scans.find(function (s) { return String(s.id) === String(scanId); });
                if (!window.confirm('Supprimer le scan "' + ((target && target.title) || 'Scan') + '" ?')) return;
                App.DB.deleteScan(scanId).then(function () {
                    if (String(App.ScanStore.getActiveScanId()) === String(scanId)) {
                        var remaining = scans.filter(function (s) { return String(s.id) !== String(scanId); });
                        App.ScanStore.setActiveScanId(remaining[0] ? remaining[0].id : null);
                    }
                    App.UI.showToast('Scan supprime', 'success');
                    App.Router.render();
                });
            });
        });

        var clearScansBtn = document.getElementById('clear-scans-btn');
        if (clearScansBtn) {
            clearScansBtn.addEventListener('click', function () {
                if (!scans.length) return;
                if (!window.confirm('Effacer les ' + scans.length + ' scans ? Cette action est irreversible.')) return;
                Promise.all(scans.map(function (s) { return App.DB.deleteScan(s.id); })).then(function () {
                    App.ScanStore.setActiveScanId(null);
                    App.UI.showToast('Scans effaces', 'success');
                    App.Router.render();
                });
            });
        }

        document.querySelectorAll('[data-coach-open]').forEach(function (tile) {
            tile.addEventListener('click', function () {
                localStorage.setItem('exophoto-coach-active-exercise', tile.getAttribute('data-coach-open'));
                App.Router.navigate('#/coach');
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
                var topic = window.prompt('Sujet (ex: Calcul litteral)', App.ExerciseStore.defaultTopic());
                if (topic == null) return;
                var title = window.prompt('Titre de l\'exercice', activeScan.title || 'Exercice OCR');
                if (!title) return;
                var exercise = App.ExerciseStore.fromScan(activeScan, {
                    subject: subject,
                    topic: topic,
                    title: title
                });

                App.DB.getExercises().then(function (existing) {
                    var check = App.ExerciseStore.checkPlacement(existing, exercise.subject, exercise.topic);
                    if (!check.existsTopicInSubject) {
                        var ok = window.confirm(
                            'Nouveau classement detecte.\n\n' +
                            'Matiere: ' + exercise.subject + '\n' +
                            'Sujet: ' + App.ExerciseStore.normalizeTopic(exercise.topic) + '\n\n' +
                            'Aucun exercice existant ne correspond a cette combinaison.\n' +
                            'Voulez-vous la creer ?'
                        );
                        if (!ok) return;
                    }
                    return App.DB.saveExercise(exercise).then(function () {
                        App.UI.showToast('Exercice ajoute a la bibliotheque', 'success');
                        App.Router.navigate('#/library');
                    });
                });
            });
        }
    }

    return { render: render };
})();