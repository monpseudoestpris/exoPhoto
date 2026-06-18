var App = window.App || {};

App.MistralOCR = (function () {
    var API_BASE = 'https://api.mistral.ai/v1';
    var MODEL = 'mistral-ocr-latest';
    var IMAGE_BBOX_SCHEMA = {
        type: 'object',
        required: ['short_description', 'summary'],
        properties: {
            short_description: {
                type: 'string',
                description: 'Une phrase courte en francais (max 140 caracteres) qui decrit le visuel.'
            },
            summary: {
                type: 'string',
                description: 'Description detaillee en francais en 4 a 5 lignes (4 a 5 phrases completes), avec les elements visibles, leur organisation et leur sens.'
            }
        },
        additionalProperties: true
    };
    var IMAGE_BBOX_RESPONSE_FORMAT = {
        type: 'json_schema',
        json_schema: {
            name: 'image_bbox_annotation',
            schema: IMAGE_BBOX_SCHEMA
        }
    };

    function _sendOcrRequest(key, payload) {
        return fetch(API_BASE + '/ocr', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + key,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(payload)
        }).then(function (response) {
            if (response.ok) return response.json();
            return response.text().then(function (text) {
                throw mapError(response, text);
            });
        });
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

    function _extractImages(pages) {
        var assets = [];
        (pages || []).forEach(function (page, pageIdx) {
            var images = Array.isArray(page.images) ? page.images : [];
            images.forEach(function (image, imageIdx) {
                var mimeType = image.mime_type || image.mimetype || image.media_type || 'image/png';
                var dataUrl = _toDataUrl(image.image_base64 || image.imageBase64 || image.base64 || image.data, mimeType);
                var imgId = String(image.id || image.name || image.file_name || ('img-' + pageIdx + '-' + imageIdx));
                assets.push({
                    id: imgId,
                    label: image.name || image.file_name || ('Image ' + (imageIdx + 1)),
                    description: _extractAnnotationDescription(image),
                    pageIndex: typeof page.index === 'number' ? page.index : pageIdx,
                    mimeType: mimeType,
                    dataUrl: dataUrl,
                    bbox: image.bbox || image.bounding_box || null
                });
            });
        });
        return assets;
    }

    function mapError(response, bodyText) {
        // Log the raw response for debugging
        console.error('[MistralOCR] HTTP ' + response.status, bodyText ? bodyText.slice(0, 400) : '');
        // Try to extract the API message from JSON body
        var apiMsg = '';
        try {
            var parsed = JSON.parse(bodyText);
            if (typeof parsed.message === 'string') apiMsg = parsed.message;
            else if (typeof parsed.detail === 'string') apiMsg = parsed.detail;
            else if (Array.isArray(parsed.detail)) {
                apiMsg = parsed.detail.map(function (item) {
                    return typeof item === 'string' ? item : JSON.stringify(item);
                }).join(' | ');
            } else if (parsed.detail && typeof parsed.detail === 'object') {
                apiMsg = JSON.stringify(parsed.detail);
            }
        } catch (e) {}
        var suffix = apiMsg ? ' — ' + apiMsg : (bodyText ? ' — ' + bodyText.slice(0, 120) : '');
        if (response.status === 401 || response.status === 403) return new Error('Clé Mistral refusée (401/403)' + suffix);
        if (response.status === 422) return new Error('Requête invalide (422)' + suffix);
        if (response.status === 429) return new Error('Quota Mistral dépassé (429)' + suffix);
        if (response.status >= 500) return new Error('Erreur serveur Mistral (' + response.status + ')' + suffix);
        return new Error('Mistral OCR HTTP ' + response.status + suffix);
    }

    function validateKey(key) {
        return fetch(API_BASE + '/models', {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + key }
        }).then(function (response) {
            if (response.ok) return true;
            return response.text().then(function (text) {
                throw mapError(response, text);
            });
        });
    }

    function processImageDataUrl(dataUrl, options) {
        options = options || {};
        var key = App.ProviderKeys.getKey('mistral');
        if (!key) return Promise.reject(new Error('Cle Mistral verrouillee ou absente'));

        var basePayload = {
            model: MODEL,
            document: {
                type: 'image_url',
                image_url: dataUrl          // REST API expects snake_case
            },
            include_image_base64: true,
            table_format: options.tableFormat || 'markdown'
        };

        console.log('[MistralOCR] Sending request, image size ~' + Math.round(dataUrl.length / 1024) + ' KB');

        var firstPayload = Object.assign({}, basePayload, {
            bbox_annotation_format: IMAGE_BBOX_RESPONSE_FORMAT
        });
        var secondPayload = Object.assign({}, basePayload, {
            bbox_annotation_format: IMAGE_BBOX_SCHEMA
        });

        return _sendOcrRequest(key, firstPayload).catch(function (err) {
            // Some OCR API versions accept raw JSON schema directly instead of ResponseFormat wrapper.
            if (!/\b422\b/.test(String(err && err.message || ''))) throw err;
            return _sendOcrRequest(key, secondPayload);
        }).then(function (json) {
            var pages = Array.isArray(json.pages) ? json.pages : [];
            return {
                model: json.model || MODEL,
                text: pages.map(function (page) { return page.markdown || ''; }).join('\n\n---\n\n').trim(),
                images: _extractImages(pages),
                raw: json,
                pageCount: pages.length,
                usage: json.usage_info || null
            };
        });
    }

    function processImageDataUrls(dataUrls, options) {
        options = options || {};
        var list = (dataUrls || []).filter(Boolean);
        if (!list.length) return Promise.reject(new Error('Aucune image a analyser'));

        var allPages = [];
        var allImages = [];
        var usageList = [];
        var texts = [];

        return list.reduce(function (chain, dataUrl, index) {
            return chain.then(function () {
                if (typeof options.onProgress === 'function') {
                    options.onProgress(index, list.length);
                }
                return processImageDataUrl(dataUrl, options).then(function (result) {
                    var rawPages = result.raw && Array.isArray(result.raw.pages) ? result.raw.pages : [];
                    rawPages.forEach(function (page, pageIndex) {
                        allPages.push(Object.assign({}, page, {
                            index: allPages.length,
                            sourcePageIndex: pageIndex,
                            sourceDocumentIndex: index
                        }));
                    });
                    Array.prototype.push.apply(allImages, result.images || []);
                    if (result.usage) usageList.push(result.usage);
                    if (result.text) texts.push(result.text);
                });
            });
        }, Promise.resolve()).then(function () {
            return {
                model: MODEL,
                text: texts.join('\n\n---\n\n').trim(),
                images: allImages,
                raw: {
                    model: MODEL,
                    pages: allPages,
                    usage_info: usageList.length === 1 ? usageList[0] : usageList
                },
                pageCount: allPages.length,
                usage: usageList.length === 1 ? usageList[0] : usageList
            };
        });
    }

    return {
        validateKey: validateKey,
        processImageDataUrl: processImageDataUrl,
        processImageDataUrls: processImageDataUrls
    };
})();