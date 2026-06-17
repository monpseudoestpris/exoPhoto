var App = window.App || {};

App.UI = (function () {
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    var ICONS = {
        home: '<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/>',
        camera: '<path d="M4 8h3l1.4-2h7.2L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/>',
        upload: '<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
        book: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z"/><path d="M9 4v16"/>',
        teacher: '<path d="m12 4 9 4-9 4-9-4 9-4Z"/><path d="M5 10.5V14c0 1.7 3.1 3 7 3s7-1.3 7-3v-3.5"/>',
        note: '<path d="M7 3h10a2 2 0 0 1 2 2v14l-4-3-4 3-4-3-4 3V5a2 2 0 0 1 2-2h2"/><path d="M8 8h8M8 11h8"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M3 12h2.5M18.5 12H21M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
        moon: '<path d="M21 12.8A8 8 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z"/>',
        collapse: '<path d="m9 6-4 6 4 6"/><path d="m15 6 4 6-4 6"/>',
        sparkles: '<path d="m12 4 1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7L12 4Z"/><path d="m5 15 .6 1.6L7.4 17.4l-1.8.6L5 20l-.6-1.8L2.4 18l1.8-.6L5 15Z"/>',
        search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-3.4-3.4"/>',
        trash: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="m6 7 1 13h10l1-13"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        check: '<path d="m5 12 4.5 4.5L19 7"/>',
        save: '<path d="M5 4h11l3 3v13H5V4Z"/><path d="M8 4v5h7"/><path d="M8 20v-5h8v5"/>',
        arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
        play: '<path d="M8 5v14l11-7-11-7Z"/>',
        copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
        edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
        image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5L6 21"/>',
        mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'
    };

    function icon(name, cls) {
        var body = ICONS[name];
        if (!body) return '';
        return '<svg class="ui-icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
    }

    function renderNav() {
        var nav = document.getElementById('main-nav');
        if (!nav) return;

        nav.innerHTML =
            '<div class="nav-shell">' +
                '<div class="brand-card">' +
                    '<div class="brand-title">ExoPhoto</div>' +
                    '<div class="brand-subtitle">Scanne. Bosse. Progresse.</div>' +
                '</div>' +
                '<div class="nav-links">' +
                    navLink('#/home', 'Accueil', 'home') +
                    navLink('#/capture', 'Capture', 'camera') +
                    navLink('#/library', 'Bibliotheque', 'book') +
                    navLink('#/coach', 'Prof IA', 'teacher') +
                    navLink('#/courses', 'Petits cours', 'note') +
                    navLink('#/settings', 'Parametres', 'settings') +
                '</div>' +
                '<div class="nav-actions">' +
                    '<a href="#" class="nav-action" id="nav-theme-toggle"><span class="nav-icon">' + icon('moon') + '</span><span class="nav-label">Theme</span></a>' +
                    '<a href="#" class="nav-action" id="nav-toggle-collapse"><span class="nav-icon">' + icon('collapse') + '</span><span class="nav-label">Compacter</span></a>' +
                '</div>' +
            '</div>';

        document.getElementById('nav-theme-toggle').addEventListener('click', function (event) {
            event.preventDefault();
            toggleTheme();
        });

        document.getElementById('nav-toggle-collapse').addEventListener('click', function (event) {
            event.preventDefault();
            var collapsed = document.body.getAttribute('data-nav-collapsed') === 'true';
            document.body.setAttribute('data-nav-collapsed', collapsed ? 'false' : 'true');
        });
    }

    function navLink(hash, label, iconName) {
        return '<a class="nav-link" data-nav="' + hash + '" href="' + hash + '"><span class="nav-icon">' + icon(iconName) + '</span><span class="nav-label">' + label + '</span></a>';
    }

    function highlightNav(route) {
        document.querySelectorAll('[data-nav]').forEach(function (link) {
            link.classList.toggle('active', link.getAttribute('data-nav') === route);
        });
    }

    function applyTheme() {
        var theme = App.Settings.get('theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
    }

    function toggleTheme() {
        var current = document.documentElement.getAttribute('data-theme') || 'light';
        var next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        App.Settings.set('theme', next);
    }

    function showToast(message, type) {
        var stack = document.querySelector('.toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'toast-stack';
            document.body.appendChild(stack);
        }

        var toast = document.createElement('div');
        toast.className = 'toast ' + (type || 'info');
        toast.textContent = message;
        stack.appendChild(toast);
        setTimeout(function () {
            toast.remove();
        }, 3400);
    }

    function formatDate(value) {
        if (!value) return '—';
        return new Date(value).toLocaleString('fr-FR');
    }

    function badge(label, extraClass) {
        return '<span class="status-pill ' + (extraClass || '') + '">' + escapeHtml(label) + '</span>';
    }

    function renderMath(root) {
        var target = root || document;
        if (!target) return;
        if (typeof window.renderMathInElement !== 'function') return;

        try {
            window.renderMathInElement(target, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false,
                strict: 'ignore',
                ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
            });
        } catch (err) {
            console.warn('[UI.renderMath] KaTeX render failed:', err && err.message ? err.message : err);
        }
    }

    return {
        renderNav: renderNav,
        highlightNav: highlightNav,
        applyTheme: applyTheme,
        toggleTheme: toggleTheme,
        showToast: showToast,
        escapeHtml: escapeHtml,
        formatDate: formatDate,
        badge: badge,
        icon: icon,
        renderMath: renderMath
    };
})();