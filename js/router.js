var App = window.App || {};

App.Router = (function () {
    var routes = {};
    var currentRoute = null;

    function parseHash() {
        var raw = window.location.hash || '#/home';
        var queryIndex = raw.indexOf('?');
        var base = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
        var query = queryIndex >= 0 ? raw.slice(queryIndex + 1) : '';
        var highlight = base === '#/exercise' ? '#/library' : base;
        return {
            raw: raw,
            base: base,
            query: query,
            highlight: highlight
        };
    }

    function register(hash, renderFn) {
        routes[hash] = renderFn;
    }

    function getHash() {
        return window.location.hash || '#/home';
    }

    function resolve() {
        var hash = parseHash();
        return routes[hash.base] || routes['#/home'];
    }

    function render() {
        var hash = parseHash();
        currentRoute = hash.highlight;
        var container = document.getElementById('app');
        var view = resolve();
        if (App.UI && App.UI.highlightNav) App.UI.highlightNav(currentRoute);
        if (typeof view === 'function') view(container);
    }

    function navigate(hash) {
        window.location.hash = hash;
    }

    function start() {
        window.addEventListener('hashchange', render);
        if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
            window.location.hash = '#/home';
            return;
        }
        render();
    }

    function current() {
        return currentRoute || getHash();
    }

    return {
        register: register,
        render: render,
        start: start,
        navigate: navigate,
        current: current
    };
})();