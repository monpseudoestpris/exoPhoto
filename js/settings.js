var App = window.App || {};

App.Settings = (function () {
    var STORAGE_KEY = 'exophoto-settings';
    var DEFAULTS = {
        theme: 'dark',
        preferredProvider: 'deepseek',
        defaultSubject: 'Mathematiques',
        defaultGradeLevel: 'College',
        defaultDifficulty: 'Moyen',
        imageMaxWidth: 1800,
        imageQuality: 0.88,
        ocrTableFormat: 'markdown'
    };

    function load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return Object.assign({}, DEFAULTS);
            return Object.assign({}, DEFAULTS, JSON.parse(raw));
        } catch (err) {
            return Object.assign({}, DEFAULTS);
        }
    }

    function save(settings) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function get(key) {
        return load()[key];
    }

    function set(key, value) {
        var settings = load();
        settings[key] = value;
        save(settings);
    }

    return {
        load: load,
        save: save,
        get: get,
        set: set,
        defaults: function () { return Object.assign({}, DEFAULTS); }
    };
})();