var App = window.App || {};
App.Views = App.Views || {};

App.Views.Settings = (function () {
    var PROVIDERS = [
        { id: 'mistral', label: 'Mistral OCR', hint: 'Utilisee pour l OCR.' },
        { id: 'deepseek', label: 'DeepSeek', hint: 'Preparee pour la generation d exos et l aide future.' },
        { id: 'anthropic', label: 'Anthropic Claude', hint: 'Preparee pour la future aide a l eleve.' }
    ];

    function render(container) {
        var settings = App.Settings.load();
        container.innerHTML =
            '<div class="page-stack">' +
                '<section class="hero">' +
                    '<h1>Parametres</h1>' +
                    '<p>Les cles API sont apportees par l utilisateur et stockees chiffre localement. Le MVP utilise Mistral pour l OCR.</p>' +
                '</section>' +
                '<section class="settings-grid">' +
                    PROVIDERS.map(function (provider) { return providerCard(provider); }).join('') +
                '</section>' +
                '<section class="panel">' +
                    '<h2>Preferences de travail</h2>' +
                    '<div class="field-grid three">' +
                        '<label>Provider Prof IA<select id="preferred-provider">' +
                            '<option value="mistral"' + (settings.preferredProvider === 'mistral' ? ' selected' : '') + '>Mistral</option>' +
                            '<option value="deepseek"' + (settings.preferredProvider === 'deepseek' ? ' selected' : '') + '>DeepSeek</option>' +
                            '<option value="anthropic"' + (settings.preferredProvider === 'anthropic' ? ' selected' : '') + '>Anthropic</option>' +
                        '</select></label>' +
                        '<label>Matiere par defaut<input id="default-subject" value="' + App.UI.escapeHtml(settings.defaultSubject) + '"></label>' +
                        '<label>Niveau par defaut<select id="default-grade">' + App.ExerciseStore.gradeOptions().map(function (value) {
                            return '<option value="' + App.UI.escapeHtml(value) + '"' + (value === settings.defaultGradeLevel ? ' selected' : '') + '>' + App.UI.escapeHtml(value) + '</option>';
                        }).join('') + '</select></label>' +
                        '<label>Difficulte par defaut<select id="default-difficulty">' + App.ExerciseStore.difficultyOptions().map(function (value) {
                            return '<option value="' + App.UI.escapeHtml(value) + '"' + (value === settings.defaultDifficulty ? ' selected' : '') + '>' + App.UI.escapeHtml(value) + '</option>';
                        }).join('') + '</select></label>' +
                        '<label>Largeur max image<input id="image-max-width" type="number" min="600" max="3000" step="100" value="' + Number(settings.imageMaxWidth || 1800) + '"></label>' +
                        '<label>Qualite JPEG<input id="image-quality" type="number" min="0.5" max="1" step="0.01" value="' + Number(settings.imageQuality || 0.88) + '"></label>' +
                        '<label>Format tableaux OCR<select id="ocr-table-format"><option value="markdown"' + (settings.ocrTableFormat === 'markdown' ? ' selected' : '') + '>Markdown</option><option value="html"' + (settings.ocrTableFormat === 'html' ? ' selected' : '') + '>HTML</option></select></label>' +
                    '</div>' +
                    '<div class="editor-actions"><button id="save-settings-btn">Enregistrer les preferences</button></div>' +
                '</section>' +
            '</div>';

        bindEvents();
    }

    function providerCard(provider) {
        var hasKey = App.ProviderKeys.hasKey(provider.id);
        var isUnlocked = App.ProviderKeys.isUnlocked(provider.id);
        var rememberEnabled = App.ProviderKeys.isRememberEnabled(provider.id);
        return '' +
            '<article class="settings-card">' +
                '<h2>' + provider.label + '</h2>' +
                '<p class="muted">' + provider.hint + '</p>' +
                '<p>' + (hasKey ? (isUnlocked ? 'Cle deverrouillee.' : 'Cle enregistree, a deverrouiller.') : 'Aucune cle enregistree.') + '</p>' +
                '<div class="field-grid">' +
                    (!hasKey ?
                        '<label>Cle API<input type="password" id="save-key-' + provider.id + '" autocomplete="off"></label>' +
                        '<label>Passphrase<input type="password" id="save-pass-' + provider.id + '" autocomplete="new-password"></label>' +
                        '<label><input type="checkbox" id="remember-' + provider.id + '"' + (rememberEnabled ? ' checked' : '') + '> Appareil de confiance (rester deverrouille apres redemarrage)</label>' +
                        '<small class="muted">Attention: plus pratique, mais moins securise sur un appareil partage.</small>' +
                        '<button data-provider-save="' + provider.id + '">Enregistrer</button>'
                    :
                        '<label>Passphrase<input type="password" id="unlock-pass-' + provider.id + '" autocomplete="current-password"></label>' +
                        '<label><input type="checkbox" id="remember-' + provider.id + '"' + (rememberEnabled ? ' checked' : '') + '> Appareil de confiance (rester deverrouille apres redemarrage)</label>' +
                        '<small class="muted">Attention: plus pratique, mais moins securise sur un appareil partage.</small>' +
                        '<div class="inline-actions">' +
                            (isUnlocked ? '<button class="secondary" data-provider-lock="' + provider.id + '">Verrouiller</button>' : '<button data-provider-unlock="' + provider.id + '">Deverrouiller</button>') +
                            '<button class="ghost" data-provider-clear="' + provider.id + '">Supprimer</button>' +
                            (provider.id === 'mistral' && isUnlocked ? '<button class="secondary" data-provider-test="mistral">Tester</button>' : '') +
                        '</div>'
                    ) +
                '</div>' +
            '</article>';
    }

    function bindEvents() {
        document.querySelectorAll('[data-provider-save]').forEach(function (button) {
            button.addEventListener('click', function () {
                var provider = button.getAttribute('data-provider-save');
                var key = document.getElementById('save-key-' + provider).value.trim();
                var passphrase = document.getElementById('save-pass-' + provider).value;
                var remember = document.getElementById('remember-' + provider).checked;
                App.ProviderKeys.saveKey(provider, key, passphrase).then(function () {
                    if (remember) App.ProviderKeys.enableRemember(provider, passphrase);
                    else App.ProviderKeys.disableRemember(provider);
                    App.UI.showToast('Cle enregistree', 'success');
                    App.Router.render();
                }).catch(function (err) {
                    App.UI.showToast(err.message || 'Enregistrement impossible', 'error');
                });
            });
        });

        document.querySelectorAll('[data-provider-unlock]').forEach(function (button) {
            button.addEventListener('click', function () {
                var provider = button.getAttribute('data-provider-unlock');
                var passphrase = document.getElementById('unlock-pass-' + provider).value;
                var remember = document.getElementById('remember-' + provider).checked;
                App.ProviderKeys.unlock(provider, passphrase).then(function () {
                    if (remember) App.ProviderKeys.enableRemember(provider, passphrase);
                    else App.ProviderKeys.disableRemember(provider);
                    App.UI.showToast('Cle deverrouillee', 'success');
                    App.Router.render();
                }).catch(function (err) {
                    App.UI.showToast(err.message || 'Deverrouillage impossible', 'error');
                });
            });
        });

        document.querySelectorAll('[data-provider-lock]').forEach(function (button) {
            button.addEventListener('click', function () {
                var provider = button.getAttribute('data-provider-lock');
                App.ProviderKeys.lock(provider);
                App.UI.showToast('Cle verrouillee', 'success');
                App.Router.render();
            });
        });

        document.querySelectorAll('[data-provider-clear]').forEach(function (button) {
            button.addEventListener('click', function () {
                var provider = button.getAttribute('data-provider-clear');
                if (!window.confirm('Supprimer cette cle ?')) return;
                App.ProviderKeys.clear(provider);
                App.UI.showToast('Cle supprimee', 'success');
                App.Router.render();
            });
        });

        document.querySelectorAll('[data-provider-test]').forEach(function (button) {
            button.addEventListener('click', function () {
                App.MistralOCR.validateKey(App.ProviderKeys.getKey('mistral')).then(function () {
                    App.UI.showToast('Cle Mistral valide', 'success');
                }).catch(function (err) {
                    App.UI.showToast(err.message || 'Test impossible', 'error');
                });
            });
        });

        var saveSettingsBtn = document.getElementById('save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', function () {
                var settings = App.Settings.load();
                settings.preferredProvider = document.getElementById('preferred-provider').value;
                settings.defaultSubject = document.getElementById('default-subject').value.trim() || 'Mathematiques';
                settings.defaultGradeLevel = document.getElementById('default-grade').value;
                settings.defaultDifficulty = document.getElementById('default-difficulty').value;
                settings.imageMaxWidth = parseInt(document.getElementById('image-max-width').value, 10) || 1800;
                settings.imageQuality = parseFloat(document.getElementById('image-quality').value) || 0.88;
                settings.ocrTableFormat = document.getElementById('ocr-table-format').value;
                App.Settings.save(settings);
                App.UI.showToast('Preferences enregistrees', 'success');
            });
        }
    }

    return { render: render };
})();