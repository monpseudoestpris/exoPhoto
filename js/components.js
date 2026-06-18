var App = window.App || {};

App.UI = (function () {
    var DOCUMENT_VIEWER_ID = 'global-document-viewer';
    var _documentPayloads = {};

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function _toDataUrl(base64Value, mimeType) {
        var raw = String(base64Value || '').trim();
        if (!raw) return '';
        if (raw.indexOf('data:') === 0) return raw;
        return 'data:' + (mimeType || 'image/png') + ';base64,' + raw;
    }

    function _tryParseJson(value) {
        if (typeof value !== 'string') return value;
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    }

    function _pickText(value) {
        var text = String(value || '').trim();
        return text || '';
    }

    function _readDescriptionDeep(node) {
        node = _tryParseJson(node);
        if (!node) return '';
        if (typeof node === 'string') return '';
        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i += 1) {
                var fromItem = _readDescriptionDeep(node[i]);
                if (fromItem) return fromItem;
            }
            return '';
        }
        if (typeof node !== 'object') return '';

        var direct = _pickText(node.summary) || _pickText(node.description) || _pickText(node.short_description);
        if (direct) return direct;

        var keys = Object.keys(node);
        for (var j = 0; j < keys.length; j += 1) {
            var fromChild = _readDescriptionDeep(node[keys[j]]);
            if (fromChild) return fromChild;
        }
        return '';
    }

    function _extractAnnotationDescription(image) {
        if (!image) return '';
        var sources = [
            image.bbox_annotation,
            image.bbox_annotations,
            image.annotation,
            image.annotations,
            image.image_annotation
        ];
        for (var i = 0; i < sources.length; i += 1) {
            var description = _readDescriptionDeep(sources[i]);
            if (description) return description;
        }
        return '';
    }

    function _scanExtractedImages(scan) {
        var metadataImages = scan && scan.metadata && Array.isArray(scan.metadata.extractedImages)
            ? scan.metadata.extractedImages
            : [];
        if (metadataImages.length) {
            return metadataImages.map(function (image, index) {
                var mimeType = image.mimeType || image.mime_type || image.mimetype || image.media_type || 'image/png';
                var imageId = String(image.id || image.label || image.name || image.file_name || ('img-meta-' + index));
                return {
                    id: imageId,
                    label: String(image.label || image.name || image.file_name || ('Image ' + (index + 1))),
                    description: _pickText(image.description),
                    pageIndex: typeof image.pageIndex === 'number' ? image.pageIndex : 0,
                    mimeType: mimeType,
                    dataUrl: _toDataUrl(image.dataUrl || image.image_base64 || image.imageBase64 || image.base64 || image.data, mimeType)
                };
            }).filter(function (asset) {
                return !!asset.dataUrl;
            });
        }

        var pages = scan && scan.ocrRaw && Array.isArray(scan.ocrRaw.pages) ? scan.ocrRaw.pages : [];
        var assets = [];
        pages.forEach(function (page, pageIdx) {
            var images = Array.isArray(page.images) ? page.images : [];
            images.forEach(function (image, imageIdx) {
                var mimeType = image.mime_type || image.mimetype || image.media_type || 'image/png';
                var label = image.name || image.file_name || ('Image ' + (imageIdx + 1));
                var imgId = String(image.id || image.name || image.file_name || ('img-' + pageIdx + '-' + imageIdx));
                assets.push({
                    id: imgId,
                    label: String(label),
                    description: _extractAnnotationDescription(image),
                    pageIndex: typeof page.index === 'number' ? page.index : pageIdx,
                    mimeType: mimeType,
                    dataUrl: _toDataUrl(image.image_base64 || image.imageBase64 || image.base64 || image.data, mimeType)
                });
            });
        });
        return assets;
    }

    function _scanImageMap(scan) {
        var map = {};
        _scanExtractedImages(scan).forEach(function (asset) {
            [asset.id, asset.label].forEach(function (key) {
                if (!key) return;
                map[String(key)] = asset;
                map[String(key).split('/').pop()] = asset;
            });
        });
        return map;
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

    function statementHtml(statement, scan) {
        var text = String(statement || '');
        var imageMap = _scanImageMap(scan);
        var imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
        var tablePattern = /\[([^\]]+\.html)\]\(([^)]+)\)/g;
        var html = '';
        var lastIndex = 0;
        var match;

        while ((match = imagePattern.exec(text))) {
            html += escapeHtml(text.slice(lastIndex, match.index));
            var alt = String(match[1] || '').trim();
            var path = String(match[2] || '').trim();
            var asset = imageMap[path] || imageMap[alt] || null;
            var label = alt || path || 'Image OCR';
            if (asset && asset.dataUrl) {
                var hoverDescription = String(asset.description || '').trim();
                var hoverTitle = hoverDescription ? hoverDescription.replace(/\n/g, '&#10;') : '';
                html += '<button type="button" class="statement-inline-asset" data-doc-viewer-src="' + escapeHtml(asset.dataUrl) + '" data-doc-viewer-title="' + escapeHtml(label) + '" data-doc-viewer-caption="' + escapeHtml(hoverDescription) + '" data-inline-description="' + escapeHtml(hoverDescription) + '" title="' + escapeHtml(hoverTitle) + '">' +
                    icon('image') + '<span>' + escapeHtml(label) + '</span></button>';
            } else {
                html += '<span class="statement-inline-asset missing" title="' + escapeHtml(alt) + '">' + icon('image') + '<span>' + escapeHtml(label) + '</span></span>';
            }
            lastIndex = imagePattern.lastIndex;
        }

        html += escapeHtml(text.slice(lastIndex));
        return html.replace(tablePattern, '<span class="statement-inline-asset missing"><span>$1</span></span>');
    }

    function _sourcePages(scan, label) {
        var metadataPages = scan && scan.metadata && Array.isArray(scan.metadata.sourceImages)
            ? scan.metadata.sourceImages
            : [];
        var pages = metadataPages.map(function (item, index) {
            return {
                src: item.dataUrl,
                title: item.fileName || ('Page ' + (index + 1))
            };
        }).filter(function (item) {
            return !!item.src;
        });
        if (pages.length) return pages;
        if (scan && scan.imageDataUrl) {
            return [{ src: scan.imageDataUrl, title: label || 'Document fourni' }];
        }
        return [];
    }

    function sourceDocumentButton(scan, label) {
        var pages = _sourcePages(scan, label);
        if (!pages.length) return '';
        var key = 'doc-' + (scan && scan.id ? scan.id : ('inline-' + Math.random().toString(36).slice(2, 8)));
        _documentPayloads[key] = {
            title: label || 'Document fourni',
            pages: pages
        };
        return '<button type="button" class="secondary source-document-btn" data-doc-viewer-key="' + escapeHtml(key) + '">' +
            icon('image') + '<span>' + escapeHtml(label || 'Document fourni') + '</span></button>';
    }

    function _ensureDocumentViewer() {
        var existing = document.getElementById(DOCUMENT_VIEWER_ID);
        if (existing) return existing;

        var root = document.createElement('div');
        root.id = DOCUMENT_VIEWER_ID;
        root.className = 'coach-modal-backdrop document-viewer-backdrop';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = '' +
            '<article class="coach-modal document-viewer-modal" role="dialog" aria-modal="true" aria-labelledby="document-viewer-title">' +
                '<header class="coach-modal-head">' +
                    '<h3 id="document-viewer-title">Document fourni</h3>' +
                    '<button type="button" class="ghost" data-doc-viewer-close="1" aria-label="Fermer">Fermer</button>' +
                '</header>' +
                '<div class="coach-modal-content document-viewer-content">' +
                    '<div class="document-viewer-frame">' +
                        '<img id="document-viewer-image" class="document-viewer-image" alt="Document fourni">' +
                    '</div>' +
                    '<p id="document-viewer-caption" class="document-viewer-caption"></p>' +
                '</div>' +
                '<footer class="coach-modal-actions">' +
                    '<button type="button" class="ghost" id="document-viewer-prev">Page precedente</button>' +
                    '<span id="document-viewer-counter" class="muted"></span>' +
                    '<button type="button" class="ghost" id="document-viewer-next">Page suivante</button>' +
                    '<button type="button" class="secondary" id="document-viewer-fullscreen">Plein ecran</button>' +
                    '<button type="button" id="document-viewer-close-main">Fermer</button>' +
                '</footer>' +
            '</article>';
        document.body.appendChild(root);

        root.__viewerState = { pages: [], index: 0, title: 'Document fourni' };

        function renderViewerPage() {
            var image = root.querySelector('#document-viewer-image');
            var heading = root.querySelector('#document-viewer-title');
            var counter = root.querySelector('#document-viewer-counter');
            var caption = root.querySelector('#document-viewer-caption');
            var prevBtn = root.querySelector('#document-viewer-prev');
            var nextBtn = root.querySelector('#document-viewer-next');
            var state = root.__viewerState || { pages: [], index: 0 };
            var page = state.pages[state.index] || null;
            if (image) {
                image.src = page ? page.src : '';
                image.alt = page ? (page.title || state.title || 'Document fourni') : 'Document fourni';
            }
            if (heading) heading.textContent = page ? (page.title || state.title || 'Document fourni') : (state.title || 'Document fourni');
            if (counter) counter.textContent = state.pages.length > 1 ? ('Page ' + (state.index + 1) + ' / ' + state.pages.length) : '';
            if (caption) {
                var desc = page && page.caption ? String(page.caption) : '';
                caption.textContent = desc;
                caption.style.display = desc ? '' : 'none';
            }
            if (prevBtn) prevBtn.disabled = state.index <= 0;
            if (nextBtn) nextBtn.disabled = state.index >= state.pages.length - 1;
        }

        root.addEventListener('docviewer:render', renderViewerPage);

        function closeViewer() {
            root.classList.remove('active');
            root.setAttribute('aria-hidden', 'true');
        }

        root.addEventListener('click', function (event) {
            if (event.target === root || event.target.hasAttribute('data-doc-viewer-close')) closeViewer();
        });

        var closeMain = root.querySelector('#document-viewer-close-main');
        if (closeMain) closeMain.addEventListener('click', closeViewer);

        var prevBtn = root.querySelector('#document-viewer-prev');
        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                if (!root.__viewerState || root.__viewerState.index <= 0) return;
                root.__viewerState.index -= 1;
                renderViewerPage();
            });
        }

        var nextBtn = root.querySelector('#document-viewer-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                if (!root.__viewerState || root.__viewerState.index >= root.__viewerState.pages.length - 1) return;
                root.__viewerState.index += 1;
                renderViewerPage();
            });
        }

        var fullscreenBtn = root.querySelector('#document-viewer-fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', function () {
                var frame = root.querySelector('.document-viewer-frame');
                if (!frame || typeof frame.requestFullscreen !== 'function') return;
                frame.requestFullscreen().catch(function () {});
            });
        }

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && root.classList.contains('active')) closeViewer();
        });

        return root;
    }

    function openDocumentViewer(src, title, pages, caption) {
        if (!src && !(pages && pages.length)) return;
        var root = _ensureDocumentViewer();
        root.__viewerState = {
            title: title || 'Document fourni',
            pages: (pages && pages.length ? pages : [{ src: src, title: title || 'Document fourni', caption: caption || '' }]).filter(function (page) {
                return !!(page && page.src);
            }),
            index: 0
        };
        var image = root.querySelector('#document-viewer-image');
        if (image) image.src = '';
        var render = root.querySelector('#document-viewer-counter');
        if (render) render.textContent = '';
        var evt = document.createEvent('Event');
        evt.initEvent('docviewer:render', true, true);
        root.dispatchEvent(evt);
        root.classList.add('active');
        root.setAttribute('aria-hidden', 'false');
    }

    function bindDocumentViewer(root) {
        if (!root || root.__docViewerBound) return;
        root.__docViewerBound = true;
        root.addEventListener('click', function (event) {
            var keyTrigger = event.target.closest('[data-doc-viewer-key]');
            if (keyTrigger) {
                event.preventDefault();
                var payload = _documentPayloads[keyTrigger.getAttribute('data-doc-viewer-key')];
                if (payload && payload.pages && payload.pages.length) {
                    openDocumentViewer(payload.pages[0].src, payload.title, payload.pages);
                }
                return;
            }
            var trigger = event.target.closest('[data-doc-viewer-src]');
            if (!trigger) return;
            event.preventDefault();
            openDocumentViewer(
                trigger.getAttribute('data-doc-viewer-src'),
                trigger.getAttribute('data-doc-viewer-title'),
                null,
                trigger.getAttribute('data-doc-viewer-caption') || ''
            );
        });
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
        renderMath: renderMath,
        statementHtml: statementHtml,
        sourceDocumentButton: sourceDocumentButton,
        bindDocumentViewer: bindDocumentViewer,
        openDocumentViewer: openDocumentViewer
    };
})();