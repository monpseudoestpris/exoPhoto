var App = window.App || {};

(function () {
    App.Views = App.Views || {};

    App.Router.register('#/home', App.Views.Home.render);
    App.Router.register('#/capture', App.Views.Capture.render);
    App.Router.register('#/library', App.Views.Library.render);
    App.Router.register('#/exercise', App.Views.Exercise.render);
    App.Router.register('#/coach', App.Views.Coach.render);
    App.Router.register('#/settings', App.Views.Settings.render);

    document.addEventListener('DOMContentLoaded', function () {
        App.UI.applyTheme();
        App.UI.renderNav();
        if (App.VoiceInput && App.VoiceInput.initAutoAttach) {
            App.VoiceInput.initAutoAttach();
        }

        App.DB.open().then(function () {
            if (App.ProviderKeys && App.ProviderKeys.autoUnlockAllRemembered) {
                return App.ProviderKeys.autoUnlockAllRemembered().then(function () {
                    App.Router.start();
                });
            }
            App.Router.start();
        }).catch(function (err) {
            document.getElementById('app').innerHTML = '<div class="empty-state">Impossible d\'ouvrir IndexedDB: ' + App.UI.escapeHtml(err.message || String(err)) + '</div>';
        });
    });
})();