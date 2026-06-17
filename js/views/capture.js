var App = window.App || {};
App.Views = App.Views || {};

App.Views.Capture = (function () {
    // Phase state persists across router re-renders so the user doesn't lose
    // their review session when briefly navigating away.
    var _s = {
        phase: 'idle',       // 'idle' | 'processing' | 'review'
        imageDataUrl: null,
        fileName: '',
        scan: null,
        exercises: [],       // [{title, statement, subject, topic}]
        step: ''             // human-readable progress label
    };
    var _c = null;

    function render(container) {
        _c = container;
        _paint();
    }

    // ─── Painting ────────────────────────────────────────────────────────────

    function _paint() {
        if (!_c) return;
        if (_s.phase === 'idle') _paintIdle();
        else if (_s.phase === 'processing') _paintProcessing();
        else _paintReview();
    }

    function _paintIdle() {
        var settings = App.Settings.load();
        var keyReady = App.ProviderKeys.isUnlocked('mistral');
        var keyStored = App.ProviderKeys.hasKey('mistral');

        var keyBanner = '';
        if (!keyStored) {
            keyBanner = '<p class="alert-inline">⚠️ Aucune clé Mistral. <a href="#/settings">Configurer dans Paramètres →</a></p>';
        } else if (!keyReady) {
            keyBanner = '<p class="alert-inline">🔒 Clé Mistral verrouillée. <a href="#/settings">Déverrouiller dans Paramètres →</a></p>';
        }

        _c.innerHTML =
            '<div class="page-stack">' +
                '<section class="hero">' +
                    '<h1>Capture et OCR</h1>' +
                    '<p>Prends une photo ou importe une image, puis lance l\'analyse. Le texte est extrait et les exos sont separés automatiquement.</p>' +
                    keyBanner +
                    '<div class="hero-actions cta-row">' +
                        '<button id="scan-camera-btn" class="cta-prominent">Prendre une photo</button>' +
                        '<button id="scan-upload-btn" class="secondary">Importer une image</button>' +
                    '</div>' +
                    '<input id="scan-camera-input" type="file" accept="image/*" capture="environment" hidden>' +
                    '<input id="scan-upload-input" type="file" accept="image/*" hidden>' +
                '</section>' +
                '<section class="two-col">' +
                    '<div class="upload-card">' +
                        '<h2>Analyse rapide</h2>' +
                        '<div class="field-grid">' +
                            '<label>Image selectionnee<input id="scan-file-name" type="text" readonly placeholder="Aucune image selectionnee"></label>' +
                            '<label>Matière pressentie<input id="scan-subject-input" type="text" value="' + App.UI.escapeHtml(settings.defaultSubject || '') + '" placeholder="Mathematiques, Francais..."></label>' +
                            '<label>Titre (optionnel)<input id="scan-title-input" type="text" placeholder="Ex : Equations feuille 4"></label>' +
                            '<div class="inline-actions">' +
                                '<button id="launch-ocr-btn" class="cta-prominent" disabled>Analyser (OCR + detection)</button>' +
                                '<button id="clear-image-btn" class="ghost" disabled>Effacer</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="panel"><h2>Aperçu</h2><div id="preview-slot" class="empty-state">Aucune image sélectionnée.</div></div>' +
                '</section>' +
            '</div>';

        _bindIdle();
    }

    function _paintProcessing() {
        _c.innerHTML =
            '<div class="page-stack">' +
                '<section class="hero">' +
                    '<h1>Analyse en cours…</h1>' +
                    '<p id="capture-step-label" class="step-label">' + App.UI.escapeHtml(_s.step || 'Initialisation…') + '</p>' +
                    '<div class="progress-dots"><span></span><span></span><span></span></div>' +
                '</section>' +
                (_s.imageDataUrl ? '<section><div class="panel"><img class="image-preview" src="' + _s.imageDataUrl + '" alt="Image analysée"></div></section>' : '') +
            '</div>';
    }

    function _setStep(msg) {
        _s.step = msg;
        var el = document.getElementById('capture-step-label');
        if (el) el.textContent = msg;
    }

    function _paintReview() {
        var exos = _s.exercises;
        var subjectOpts = App.ExerciseStore.subjectOptions();

        var cards = exos.map(function (ex, i) {
            return '<div class="review-card panel">' +
                '<div class="review-card-num">' + (i + 1) + '</div>' +
                '<div class="field-grid two">' +
                    '<label>Titre<input class="rv-title" data-idx="' + i + '" value="' + App.UI.escapeHtml(ex.title) + '"></label>' +
                    '<label>Matière<select class="rv-subject" data-idx="' + i + '">' +
                        subjectOpts.map(function (s) {
                            return '<option value="' + App.UI.escapeHtml(s) + '"' + (s === ex.subject ? ' selected' : '') + '>' + App.UI.escapeHtml(s) + '</option>';
                        }).join('') +
                    '</select></label>' +
                '</div>' +
                '<label>Sujet<input class="rv-topic" data-idx="' + i + '" value="' + App.UI.escapeHtml(App.ExerciseStore.normalizeTopic(ex.topic)) + '" placeholder="Ex: Calcul litteral"></label>' +
                '<label>Énoncé<textarea class="rv-statement" data-idx="' + i + '" rows="6">' + App.UI.escapeHtml(ex.statement) + '</textarea></label>' +
                '<div class="review-card-actions">' +
                    '<button class="rv-save-one secondary" data-idx="' + i + '">💾 Sauvegarder</button>' +
                    '<button class="rv-remove-one ghost" data-idx="' + i + '">Retirer</button>' +
                '</div>' +
            '</div>';
        }).join('');

        _c.innerHTML =
            '<div class="page-stack">' +
                '<section class="hero">' +
                    '<h1>' + exos.length + ' exercice' + (exos.length > 1 ? 's' : '') + ' détecté' + (exos.length > 1 ? 's' : '') + '</h1>' +
                    '<p>Vérifiez et modifiez si besoin, puis sauvegardez dans la bibliothèque.</p>' +
                    '<div class="hero-actions">' +
                        '<button id="rv-save-all">💾 Tout sauvegarder (' + exos.length + ')</button>' +
                        '<button id="rv-back" class="ghost">Nouvelle capture</button>' +
                    '</div>' +
                '</section>' +
                (_s.imageDataUrl ?
                    '<section><div class="panel"><img class="image-preview" src="' + _s.imageDataUrl + '" alt="Image source">' +
                    '<p class="muted" style="margin:.5rem 0 0;font-size:.88rem">Source OCR · ' + (_s.scan ? App.UI.formatDate(_s.scan.createdAt) : '') + '</p>' +
                    '</div></section>'
                    : '') +
                '<section class="review-grid">' + cards + '</section>' +
            '</div>';

        _bindReview();
        App.UI.renderMath(_c);
    }

    // ─── Event binding ────────────────────────────────────────────────────────

    function _bindIdle() {
        var cameraInput = document.getElementById('scan-camera-input');
        var uploadInput = document.getElementById('scan-upload-input');
        var cameraBtn = document.getElementById('scan-camera-btn');
        var uploadBtn = document.getElementById('scan-upload-btn');
        var fileNameInput = document.getElementById('scan-file-name');
        var launchBtn = document.getElementById('launch-ocr-btn');
        var clearBtn = document.getElementById('clear-image-btn');

        function onFileChosen(file) {
            if (!file) return;
            _s.fileName = file.name;
            if (fileNameInput) fileNameInput.value = _s.fileName;
            App.ImageUtils.readFileAsDataUrl(file).then(function (dataUrl) {
                return App.ImageUtils.resizeDataUrl(dataUrl, {
                    maxWidth: App.Settings.get('imageMaxWidth'),
                    quality: App.Settings.get('imageQuality')
                });
            }).then(function (result) {
                _s.imageDataUrl = result.dataUrl;
                document.getElementById('preview-slot').innerHTML =
                    '<img class="image-preview" src="' + _s.imageDataUrl + '" alt="Aperçu">';
                launchBtn.disabled = false;
                clearBtn.disabled = false;
            }).catch(function (err) {
                App.UI.showToast(err.message || 'Image invalide', 'error');
            });
        }

        cameraBtn.addEventListener('click', function () {
            cameraInput.click();
        });

        uploadBtn.addEventListener('click', function () {
            uploadInput.click();
        });

        cameraInput.addEventListener('change', function () {
            onFileChosen(cameraInput.files && cameraInput.files[0]);
        });

        uploadInput.addEventListener('change', function () {
            onFileChosen(uploadInput.files && uploadInput.files[0]);
        });

        clearBtn.addEventListener('click', function () {
            _s.imageDataUrl = null;
            _s.fileName = '';
            if (fileNameInput) fileNameInput.value = '';
            cameraInput.value = '';
            uploadInput.value = '';
            document.getElementById('preview-slot').innerHTML = 'Aucune image sélectionnée.';
            launchBtn.disabled = true;
            clearBtn.disabled = true;
        });

        launchBtn.addEventListener('click', function () {
            if (!_s.imageDataUrl) return;
            if (!App.ProviderKeys.isUnlocked('mistral')) {
                App.UI.showToast('Déverrouillez d\'abord la clé Mistral dans Paramètres', 'warning');
                return;
            }
            var title = document.getElementById('scan-title-input').value.trim() || _s.fileName || 'Nouveau scan';
            var subject = document.getElementById('scan-subject-input').value.trim();
            _launchAnalysis(title, subject);
        });
    }

    function _bindReview() {
        function collect() {
            _c.querySelectorAll('.rv-title').forEach(function (el) {
                var i = +el.getAttribute('data-idx');
                if (_s.exercises[i]) _s.exercises[i].title = el.value.trim() || _s.exercises[i].title;
            });
            _c.querySelectorAll('.rv-subject').forEach(function (el) {
                var i = +el.getAttribute('data-idx');
                if (_s.exercises[i]) _s.exercises[i].subject = el.value;
            });
            _c.querySelectorAll('.rv-statement').forEach(function (el) {
                var i = +el.getAttribute('data-idx');
                if (_s.exercises[i]) _s.exercises[i].statement = el.value;
            });
            _c.querySelectorAll('.rv-topic').forEach(function (el) {
                var i = +el.getAttribute('data-idx');
                if (_s.exercises[i]) _s.exercises[i].topic = App.ExerciseStore.normalizeTopic(el.value);
            });
        }

        function save(idx) {
            var ex = _s.exercises[idx];
            if (!ex) return Promise.resolve();
            var exercise = App.ExerciseStore.fromScan(_s.scan || { id: null, ocrText: '' }, {
                title: ex.title,
                subject: ex.subject,
                topic: ex.topic,
                statement: ex.statement
            });

            return App.DB.getExercises().then(function (existing) {
                var check = App.ExerciseStore.checkPlacement(existing, exercise.subject, exercise.topic);
                if (!check.existsTopicInSubject) {
                    var ok = window.confirm(
                        'Nouveau classement detecte.\n\n' +
                        'Matiere: ' + exercise.subject + '\n' +
                        'Sujet: ' + App.ExerciseStore.normalizeTopic(exercise.topic) + '\n\n' +
                        'Aucun exercice existant ne correspond a cette combinaison.\n' +
                        'Voulez-vous la creer ?'
                    );
                    if (!ok) throw new Error('Sauvegarde annulee');
                }
                return App.DB.saveExercise(exercise);
            });
        }

        var saveAllBtn = document.getElementById('rv-save-all');
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', function () {
                collect();
                saveAllBtn.disabled = true;
                saveAllBtn.textContent = 'Sauvegarde…';
                Promise.all(_s.exercises.map(function (_, i) { return save(i); }))
                    .then(function () {
                        App.UI.showToast(_s.exercises.length + ' exercice(s) sauvegardé(s) ✓', 'success');
                        _reset();
                        App.Router.navigate('#/library');
                    }).catch(function (err) {
                        App.UI.showToast(err.message || 'Erreur sauvegarde', 'error');
                        saveAllBtn.disabled = false;
                        saveAllBtn.textContent = '💾 Tout sauvegarder (' + _s.exercises.length + ')';
                    });
            });
        }

        _c.querySelectorAll('.rv-save-one').forEach(function (btn) {
            btn.addEventListener('click', function () {
                collect();
                var idx = +btn.getAttribute('data-idx');
                btn.disabled = true;
                save(idx).then(function () {
                    App.UI.showToast('Exercice sauvegardé ✓', 'success');
                    _s.exercises.splice(idx, 1);
                    if (!_s.exercises.length) { _reset(); App.Router.navigate('#/library'); }
                    else _paint();
                }).catch(function (err) {
                    App.UI.showToast(err.message || 'Erreur', 'error');
                    btn.disabled = false;
                });
            });
        });

        _c.querySelectorAll('.rv-remove-one').forEach(function (btn) {
            btn.addEventListener('click', function () {
                collect();
                var idx = +btn.getAttribute('data-idx');
                _s.exercises.splice(idx, 1);
                if (!_s.exercises.length) _s.phase = 'idle';
                _paint();
            });
        });

        var backBtn = document.getElementById('rv-back');
        if (backBtn) {
            backBtn.addEventListener('click', function () { _reset(); _paint(); });
        }
    }

    // ─── Analysis pipeline ────────────────────────────────────────────────────

    function _launchAnalysis(title, subject) {
        _s.phase = 'processing';
        _s.step = 'Création du scan…';
        _paint();

        App.ScanStore.createPendingScan({
            title: title,
            sourceType: 'upload',
            subjectGuess: subject,
            imageDataUrl: _s.imageDataUrl,
            metadata: { originalFileName: _s.fileName }
        }).then(function (scan) {
            _s.scan = scan;
            _setStep('OCR Mistral en cours…');
            return App.MistralOCR.processImageDataUrl(_s.imageDataUrl, {
                tableFormat: App.Settings.get('ocrTableFormat')
            });
        }).then(function (ocrResult) {
            _setStep('Mise à jour du scan…');
            return App.ScanStore.updateScan(_s.scan, {
                ocrStatus: 'done',
                ocrText: ocrResult.text,
                ocrRaw: ocrResult.raw,
                metadata: Object.assign({}, _s.scan.metadata, {
                    pageCount: ocrResult.pageCount,
                    usage: ocrResult.usage
                })
            }).then(function (updatedScan) {
                _s.scan = updatedScan;
                return ocrResult.text;
            });
        }).then(function (ocrText) {
            _setStep('Détection des exercices…');
            return App.ExerciseSplitter.split(ocrText);
        }).then(function (exercises) {
            exercises = exercises.map(function (exercise) {
                var subject = exercise.subject || App.Settings.get('defaultSubject') || 'Mathematiques';
                var title = exercise.title || 'Exercice';
                var statement = App.ExerciseStore.cleanStatementText(exercise.statement || '');
                var normalizedTopic = App.ExerciseStore.normalizeTopic(exercise.topic);
                var topic = App.ExerciseStore.isUnclassifiedTopic(normalizedTopic)
                    ? App.ExerciseStore.inferTopic(subject, title, statement)
                    : normalizedTopic;
                return Object.assign({}, exercise, { topic: topic });
            });
            _s.exercises = exercises;
            _s.phase = 'review';
            _paint();
        }).catch(function (err) {
            if (_s.scan) {
                App.ScanStore.updateScan(_s.scan, {
                    ocrStatus: 'error',
                    metadata: Object.assign({}, (_s.scan.metadata || {}), { errorMessage: err.message })
                });
            }
            App.UI.showToast(err.message || 'Analyse impossible', 'error');
            _s.phase = 'idle';
            _paint();
        });
    }

    function _reset() {
        _s.phase = 'idle';
        _s.imageDataUrl = null;
        _s.fileName = '';
        _s.scan = null;
        _s.exercises = [];
        _s.step = '';
    }

    return { render: render };
})();