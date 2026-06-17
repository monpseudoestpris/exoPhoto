var App = window.App || {};

App.MistralOCR = (function () {
    var API_BASE = 'https://api.mistral.ai/v1';
    var MODEL = 'mistral-ocr-latest';

    function mapError(response, bodyText) {
        // Log the raw response for debugging
        console.error('[MistralOCR] HTTP ' + response.status, bodyText ? bodyText.slice(0, 400) : '');
        // Try to extract the API message from JSON body
        var apiMsg = '';
        try { apiMsg = JSON.parse(bodyText).message || JSON.parse(bodyText).detail || ''; } catch (e) {}
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

        var payload = {
            model: MODEL,
            document: {
                type: 'image_url',
                image_url: dataUrl          // REST API expects snake_case
            },
            include_image_base64: false,
            table_format: options.tableFormat || 'markdown'
        };

        console.log('[MistralOCR] Sending request, image size ~' + Math.round(dataUrl.length / 1024) + ' KB');

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
        }).then(function (json) {
            var pages = Array.isArray(json.pages) ? json.pages : [];
            return {
                model: json.model || MODEL,
                text: pages.map(function (page) { return page.markdown || ''; }).join('\n\n---\n\n').trim(),
                raw: json,
                pageCount: pages.length,
                usage: json.usage_info || null
            };
        });
    }

    return {
        validateKey: validateKey,
        processImageDataUrl: processImageDataUrl
    };
})();