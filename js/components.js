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

    function renderNav() {
        var nav = document.getElementById('main-nav');
        if (!nav) return;

        nav.innerHTML =
            '<div class="nav-shell">' +
                '<div class="brand-card">' +
                    '<div class="brand-title">ExoPhoto</div>' +
                    '<div class="brand-subtitle">OCR, base d\'exos et preparation de variantes</div>' +
                '</div>' +
                '<div class="nav-links">' +
                    navLink('#/home', 'Accueil', '🏠') +
                    navLink('#/capture', 'Capture', '📷') +
                    navLink('#/library', 'Bibliotheque', '📚') +
                    navLink('#/coach', 'Prof IA', '🧑‍🏫') +
                    navLink('#/settings', 'Parametres', '⚙️') +
                '</div>' +
                '<div class="nav-actions">' +
                    '<a href="#" class="nav-action" id="nav-theme-toggle"><span class="nav-icon">🌓</span><span class="nav-label">Theme</span></a>' +
                    '<a href="#" class="nav-action" id="nav-toggle-collapse"><span class="nav-icon">↔️</span><span class="nav-label">Compacter</span></a>' +
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

    function navLink(hash, label, icon) {
        return '<a class="nav-link" data-nav="' + hash + '" href="' + hash + '"><span class="nav-icon">' + icon + '</span><span class="nav-label">' + label + '</span></a>';
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
        renderMath: renderMath
    };
})();