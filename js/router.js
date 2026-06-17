var App = window.App || {};

App.Router = (function () {
    var routes = {};
    var currentRoute = null;

    function register(hash, renderFn) {
        routes[hash] = renderFn;
    }

    function getHash() {
        return window.location.hash || '#/home';
    }

    function resolve() {
        var hash = getHash();
        return routes[hash] || routes['#/home'];
    }

    function render() {
        currentRoute = getHash();
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