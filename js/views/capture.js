var App = window.App || {};
App.Views = App.Views || {};

App.Views.Capture = (function () {
    // Phase state persists across router re-renders so the user doesn't lose
    // their review session when briefly navigating away.
    var _s = {
        phase: 'idle',       // 'idle' | 'processing' | 'review'
        imageDataUrl: null,
        imageDataUrls: [],
        pageFileNames: [],   // parallel array of original file names
        fileName: '',
        scan: null,
        scanMode: 'multiple',
        setupModalOpen: false,
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
        var hasSelection = !!_s.imageDataUrls.length;

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
                    '<p>Prends une photo ou importe un document, puis choisis le mode d\'analyse.</p>' +
                    keyBanner +
                    '<div class="hero-actions cta-row capture-entry-actions">' +
                        '<button id="scan-camera-btn" class="cta-prominent">Prendre une photo</button>' +
                        '<button id="scan-upload-btn" class="cta-prominent secondary">Importer une image</button>' +
                    '</div>' +
                    '<input id="scan-camera-input" type="file" accept="image/*" capture="environment" multiple hidden>' +
                    '<input id="scan-upload-input" type="file" accept="image/*" multiple hidden>' +
                '</section>' +
                (hasSelection ?
                    '<section class="panel capture-selected-panel">' +
                        '<div class="capture-selected-head">' +
                            '<div>' +
                                '<h2>Document selectionne</h2>' +
                                '<p class="muted">' + App.UI.escapeHtml(_s.fileName || 'Document') + '</p>' +
                            '</div>' +
                            '<div class="inline-actions">' +
                                '<button id="reopen-setup-btn" class="secondary">Configurer l\'analyse</button>' +
                                '<button id="clear-image-btn" class="ghost">Effacer</button>' +
                            '</div>' +
                        '</div>' +
                        '<div id="preview-slot" class="capture-preview-slot"></div>' +
                    '</section>'
                    : '') +
                '<div id="capture-setup-modal" class="coach-modal-backdrop' + (_s.setupModalOpen ? ' active' : '') + '" aria-hidden="' + (_s.setupModalOpen ? 'false' : 'true') + '">' +
                    '<article class="coach-modal capture-setup-modal" role="dialog" aria-modal="true" aria-labelledby="capture-setup-title">' +
                        '<header class="coach-modal-head">' +
                            '<h3 id="capture-setup-title">Configurer l\'analyse</h3>' +
                            '<button id="capture-setup-close-x" class="ghost" aria-label="Fermer">Fermer</button>' +
                        '</header>' +
                        '<div class="coach-modal-content">' +
                            '<div class="capture-setup-summary">' +
                                '<strong>' + App.UI.escapeHtml(_s.fileName || 'Document') + '</strong>' +
                                '<span class="muted">' + (_s.imageDataUrls.length ? (_s.imageDataUrls.length + ' page' + (_s.imageDataUrls.length > 1 ? 's' : '')) : 'Aucune page') + '</span>' +
                            '</div>' +
                            (_s.imageDataUrls.length > 1 ?
                                '<div id="page-order-container"></div>'
                            : '') +
                            '<label>Matière pressentie<input id="scan-subject-input" type="text" value="' + App.UI.escapeHtml(settings.defaultSubject || '') + '" placeholder="Mathematiques, Francais..."></label>' +
                            '<label>Titre (optionnel)<input id="scan-title-input" type="text" placeholder="Ex : Equations feuille 4" value="' + App.UI.escapeHtml(_s.fileName || '') + '"></label>' +
                            '<fieldset class="scan-mode-fieldset">' +
                                '<legend>Le document contient</legend>' +
                                '<label class="scan-mode-option"><input type="radio" name="scan-mode" value="multiple"' + (_s.scanMode === 'multiple' ? ' checked' : '') + '> Plusieurs exercices a separer</label>' +
                                '<label class="scan-mode-option"><input type="radio" name="scan-mode" value="single"' + (_s.scanMode === 'single' ? ' checked' : '') + '> Un seul grand exercice / devoir</label>' +
                            '</fieldset>' +
                        '</div>' +
                        '<footer class="coach-modal-actions">' +
                            '<button id="capture-setup-clear" class="ghost"' + (hasSelection ? '' : ' disabled') + '>Effacer</button>' +
                            '<button id="capture-setup-close" class="secondary">Annuler</button>' +
                            '<button id="launch-ocr-btn"' + (hasSelection ? '' : ' disabled') + '>Analyser</button>' +
                        '</footer>' +
                    '</article>' +
                '</div>' +
            '</div>';

        _bindIdle();
        if (hasSelection) _renderIdlePreview();
    }

    function _paintProcessing() {
        _c.innerHTML =
            '<div class="page-stack">' +
                '<section class="hero">' +
                    '<h1>Analyse en cours…</h1>' +
                    '<p id="capture-step-label" class="step-label">' + App.UI.escapeHtml(_s.step || 'Initialisation…') + '</p>' +
                    '<div class="progress-dots"><span></span><span></span><span></span></div>' +
                '</section>' +
                (_s.imageDataUrl ? '<section><div class="panel"><img class="image-preview" src="' + _s.imageDataUrl + '" alt="Image analysée">' +
                (_s.imageDataUrls.length > 1 ? '<p class="muted" style="margin:.5rem 0 0;font-size:.88rem">' + _s.imageDataUrls.length + ' pages en cours d\'analyse</p>' : '') +
                '</div></section>' : '') +
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
                            return '<option value="' + App.UI.escapeHtml(s) + '"' + (s === App.ExerciseStore.normalizeSubject(ex.subject) ? ' selected' : '') + '>' + App.UI.escapeHtml(s) + '</option>';
                        }).join('') +
                    '</select></label>' +
                '</div>' +
                '<label>Sujet<input class="rv-topic" data-idx="' + i + '" value="' + App.UI.escapeHtml(App.ExerciseStore.normalizeTopic(ex.topic, ex.subject)) + '" placeholder="Ex: Calcul litteral"></label>' +
                '<label>Énoncé' +
                    '<div class="rv-statement-preview math-content" id="rv-preview-' + i + '">' + App.UI.statementHtml(ex.statement, _s.scan) + '</div>' +
                    '<textarea class="rv-statement" data-idx="' + i + '" rows="5">' + App.UI.escapeHtml(ex.statement) + '</textarea>' +
                '</label>' +
                '<div class="review-card-actions">' +
                    App.UI.sourceDocumentButton(_s.scan, 'Document fourni') +
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
                    (_s.imageDataUrls.length > 1 ? '<p class="muted" style="margin:.5rem 0 0;font-size:.88rem">Document source · ' + _s.imageDataUrls.length + ' pages</p>' : '') +
                    '<p class="muted" style="margin:.5rem 0 0;font-size:.88rem">Source OCR · ' + (_s.scan ? App.UI.formatDate(_s.scan.createdAt) : '') + '</p>' +
                    '</div></section>'
                    : '') +
                '<section class="review-grid">' + cards + '</section>' +
            '</div>';

        _bindReview();
        App.UI.bindDocumentViewer(_c);
        App.UI.renderMath(_c);
    }

    // ─── Event binding ────────────────────────────────────────────────────────

    function _bindIdle() {
        var cameraInput = document.getElementById('scan-camera-input');
        var uploadInput = document.getElementById('scan-upload-input');
        var cameraBtn = document.getElementById('scan-camera-btn');
        var uploadBtn = document.getElementById('scan-upload-btn');
        var launchBtn = document.getElementById('launch-ocr-btn');
        var clearBtn = document.getElementById('clear-image-btn');
        var clearSetupBtn = document.getElementById('capture-setup-clear');
        var reopenSetupBtn = document.getElementById('reopen-setup-btn');
        var modal = document.getElementById('capture-setup-modal');
        var closeModalBtn = document.getElementById('capture-setup-close');
        var closeModalXBtn = document.getElementById('capture-setup-close-x');

        function openSetupModal() {
            if (!_s.imageDataUrls.length || !modal) return;
            _s.setupModalOpen = true;
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
        }

        function closeSetupModal() {
            if (!modal) return;
            _s.setupModalOpen = false;
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
        }

        function clearSelection() {
            _s.imageDataUrl = null;
            _s.imageDataUrls = [];
            _s.pageFileNames = [];
            _s.fileName = '';
            _s.setupModalOpen = false;
            cameraInput.value = '';
            uploadInput.value = '';
            _paint();
        }

        _c.querySelectorAll('input[name="scan-mode"]').forEach(function (input) {
            input.addEventListener('change', function () {
                if (input.checked) _s.scanMode = input.value;
            });
        });

        function onFilesChosen(fileList) {
            var files = Array.prototype.slice.call(fileList || []).filter(Boolean);
            if (!files.length) return;
            _s.fileName = files.length === 1 ? files[0].name : (files.length + ' pages');
            Promise.all(files.map(function (file) {
                return App.ImageUtils.readFileAsDataUrl(file).then(function (dataUrl) {
                    return App.ImageUtils.resizeDataUrl(dataUrl, {
                        maxWidth: App.Settings.get('imageMaxWidth'),
                        quality: App.Settings.get('imageQuality')
                    });
                }).then(function (result) {
                    return {
                        fileName: file.name,
                        dataUrl: result.dataUrl
                    };
                });
            })).then(function (pages) {
                _s.imageDataUrls = pages.map(function (page) { return page.dataUrl; });
                _s.pageFileNames = pages.map(function (page) { return page.fileName; });
                _s.imageDataUrl = _s.imageDataUrls[0] || null;
                _s.setupModalOpen = true;
                _paint();
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
            onFilesChosen(cameraInput.files);
        });

        uploadInput.addEventListener('change', function () {
            onFilesChosen(uploadInput.files);
        });

        if (clearBtn) clearBtn.addEventListener('click', clearSelection);
        if (clearSetupBtn) clearSetupBtn.addEventListener('click', clearSelection);
        if (reopenSetupBtn) reopenSetupBtn.addEventListener('click', openSetupModal);
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeSetupModal);
        if (closeModalXBtn) closeModalXBtn.addEventListener('click', closeSetupModal);
        if (modal) {
            modal.addEventListener('click', function (event) {
                if (event.target === modal) closeSetupModal();
                var upBtn = event.target.closest('.page-order-up');
                var downBtn = event.target.closest('.page-order-down');
                if (upBtn && !upBtn.disabled) {
                    _movePage(+upBtn.getAttribute('data-page-idx'), +upBtn.getAttribute('data-page-idx') - 1);
                } else if (downBtn && !downBtn.disabled) {
                    _movePage(+downBtn.getAttribute('data-page-idx'), +downBtn.getAttribute('data-page-idx') + 1);
                }
            });
        }

        launchBtn.addEventListener('click', function () {
            if (!_s.imageDataUrls.length) return;
            if (!App.ProviderKeys.isUnlocked('mistral')) {
                App.UI.showToast('Déverrouillez d\'abord la clé Mistral dans Paramètres', 'warning');
                return;
            }
            var title = document.getElementById('scan-title-input').value.trim() || _s.fileName || 'Nouveau scan';
            var subject = document.getElementById('scan-subject-input').value.trim();
            _s.setupModalOpen = false;
            _launchAnalysis(title, subject, _s.scanMode || 'multiple');
        });
    }

    function _renderPageOrderList() {
        var slot = document.getElementById('page-order-container') || document.getElementById('preview-slot');
        if (!slot) return;
        if (!_s.imageDataUrls.length) { slot.innerHTML = ''; return; }

        var items = _s.imageDataUrls.map(function (dataUrl, i) {
            var name = App.UI.escapeHtml(_s.pageFileNames[i] || ('Page ' + (i + 1)));
            var isFirst = i === 0;
            var isLast = i === _s.imageDataUrls.length - 1;
            return '<div class="page-order-item" data-page-idx="' + i + '">' +
                '<div class="page-order-thumb">' +
                    '<img src="' + dataUrl + '" alt="Page ' + (i + 1) + '">' +
                '</div>' +
                '<div class="page-order-info">' +
                    '<strong>Page ' + (i + 1) + '</strong>' +
                    '<span class="muted">' + name + '</span>' +
                '</div>' +
                '<div class="page-order-btns">' +
                    '<button type="button" class="ghost page-order-up" data-page-idx="' + i + '"' + (isFirst ? ' disabled' : '') + ' aria-label="Remonter">↑</button>' +
                    '<button type="button" class="ghost page-order-down" data-page-idx="' + i + '"' + (isLast ? ' disabled' : '') + ' aria-label="Descendre">↓</button>' +
                '</div>' +
            '</div>';
        }).join('');

        slot.innerHTML = '<div class="page-order-list">' + items + '</div>';
    }

    function _renderIdlePreview() {
        _renderPageOrderList();
    }

    function _movePage(from, to) {
        if (to < 0 || to >= _s.imageDataUrls.length) return;
        var tmpUrl = _s.imageDataUrls.splice(from, 1)[0];
        _s.imageDataUrls.splice(to, 0, tmpUrl);
        var tmpName = _s.pageFileNames.splice(from, 1)[0];
        _s.pageFileNames.splice(to, 0, tmpName);
        _s.imageDataUrl = _s.imageDataUrls[0] || null;
        _renderPageOrderList();
    }

    function _bindReview() {
        function collect() {
            _c.querySelectorAll('.rv-title').forEach(function (el) {
                var i = +el.getAttribute('data-idx');
                if (_s.exercises[i]) _s.exercises[i].title = el.value.trim() || _s.exercises[i].title;
            });
            _c.querySelectorAll('.rv-subject').forEach(function (el) {
                var i = +el.getAttribute('data-idx');
                if (_s.exercises[i]) _s.exercises[i].subject = App.ExerciseStore.normalizeSubject(el.value);
            });
            _c.querySelectorAll('.rv-statement').forEach(function (el) {
                var i = +el.getAttribute('data-idx');
                if (_s.exercises[i]) _s.exercises[i].statement = el.value;
            });
            _c.querySelectorAll('.rv-topic').forEach(function (el) {
                var i = +el.getAttribute('data-idx');
                if (_s.exercises[i]) {
                    var subject = _s.exercises[i].subject || 'Autre';
                    _s.exercises[i].topic = App.ExerciseStore.normalizeTopic(el.value, subject);
                }
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
                        'Sujet: ' + App.ExerciseStore.normalizeTopic(exercise.topic, exercise.subject) + '\n\n' +
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

        // Attach voice input buttons to review textareas and inputs
        if (typeof App.VoiceInput !== 'undefined') {
            _c.querySelectorAll('.rv-title').forEach(function (el, idx) {
                var uniqueId = 'rv-title-' + idx;
                el.id = uniqueId;
                App.VoiceInput.attachMicButton(uniqueId);
            });
            _c.querySelectorAll('.rv-statement').forEach(function (el, idx) {
                var uniqueId = 'rv-statement-' + idx;
                el.id = uniqueId;
                App.VoiceInput.attachMicButton(uniqueId);
            });
        }
    }

    // ─── Analysis pipeline ────────────────────────────────────────────────────

    function _buildExercisesFromOcr(title, subject, ocrText, scanMode) {
        if (scanMode === 'single') {
            return Promise.resolve([{
                title: title || 'Exercice',
                statement: ocrText || '',
                subject: subject || App.Settings.get('defaultSubject') || 'Mathematiques'
            }]);
        }
        return App.ExerciseSplitter.split(ocrText);
    }

    function _launchAnalysis(title, subject, scanMode) {
        _s.phase = 'processing';
        _s.step = 'Création du scan…';
        _paint();

        App.ScanStore.createPendingScan({
            title: title,
            sourceType: 'upload',
            subjectGuess: subject,
            imageDataUrl: _s.imageDataUrl,
            metadata: {
                originalFileName: _s.fileName,
                scanMode: scanMode || 'multiple',
                sourceImages: _s.imageDataUrls.map(function (dataUrl, index) {
                    return {
                        pageNumber: index + 1,
                        fileName: (_s.imageDataUrls.length > 1 ? 'Page ' + (index + 1) : _s.fileName),
                        dataUrl: dataUrl
                    };
                })
            }
        }).then(function (scan) {
            _s.scan = scan;
            _setStep('OCR Mistral en cours…');
            return App.MistralOCR.processImageDataUrls(_s.imageDataUrls, {
                tableFormat: App.Settings.get('ocrTableFormat'),
                onProgress: function (pageIndex, total) {
                    _setStep('OCR Mistral en cours… page ' + (pageIndex + 1) + ' / ' + total);
                }
            });
        }).then(function (ocrResult) {
            _setStep('Mise à jour du scan…');
            return App.ScanStore.updateScan(_s.scan, {
                ocrStatus: 'done',
                ocrText: ocrResult.text,
                ocrRaw: ocrResult.raw,
                metadata: Object.assign({}, _s.scan.metadata, {
                    pageCount: ocrResult.pageCount,
                    sourcePageCount: _s.imageDataUrls.length,
                    usage: ocrResult.usage,
                    scanMode: scanMode || 'multiple',
                    extractedImages: Array.isArray(ocrResult.images) ? ocrResult.images : [],
                    extractedImageCount: (ocrResult.images || []).filter(function (image) {
                        return !!image.dataUrl;
                    }).length
                })
            }).then(function (updatedScan) {
                _s.scan = updatedScan;
                return ocrResult.text;
            });
        }).then(function (ocrText) {
            _setStep(scanMode === 'single' ? 'Préparation de l\'énoncé…' : 'Détection des exercices…');
            return _buildExercisesFromOcr(title, subject, ocrText, scanMode || 'multiple');
        }).then(function (exercises) {
            exercises = exercises.map(function (exercise) {
                var subject = App.ExerciseStore.normalizeSubject(exercise.subject || App.Settings.get('defaultSubject') || 'Mathematiques');
                var title = exercise.title || 'Exercice';
                var statement = App.ExerciseStore.cleanStatementText(exercise.statement || '');
                var normalizedTopic = App.ExerciseStore.normalizeTopic(exercise.topic, subject);
                var topic = App.ExerciseStore.isUnclassifiedTopic(normalizedTopic)
                    ? App.ExerciseStore.inferTopic(subject, title, statement)
                    : normalizedTopic;
                return Object.assign({}, exercise, {
                    subject: subject,
                    topic: topic,
                    sourceScanId: _s.scan ? _s.scan.id : null
                });
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
        _s.imageDataUrls = [];
        _s.pageFileNames = [];
        _s.fileName = '';
        _s.scan = null;
        _s.exercises = [];
        _s.setupModalOpen = false;
        _s.step = '';
    }

    return { render: render };
})();