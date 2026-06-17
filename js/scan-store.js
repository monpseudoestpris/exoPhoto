var App = window.App || {};

App.ScanStore = (function () {
    var ACTIVE_KEY = 'exophoto-active-scan';

    function setActiveScanId(scanId) {
        if (scanId) localStorage.setItem(ACTIVE_KEY, scanId);
        else localStorage.removeItem(ACTIVE_KEY);
    }

    function getActiveScanId() {
        return localStorage.getItem(ACTIVE_KEY);
    }

    function createPendingScan(payload) {
        var now = new Date().toISOString();
        var scan = {
            id: App.DB.nextId('scan'),
            title: payload.title || 'Nouveau scan',
            createdAt: now,
            updatedAt: now,
            sourceType: payload.sourceType || 'upload',
            subjectGuess: payload.subjectGuess || '',
            imageDataUrl: payload.imageDataUrl,
            ocrProvider: 'mistral',
            ocrStatus: 'pending',
            ocrText: '',
            ocrRaw: null,
            metadata: payload.metadata || {},
            tabState: 'open'
        };
        return App.DB.saveScan(scan).then(function () {
            setActiveScanId(scan.id);
            return scan;
        });
    }

    function updateScan(scan, patch) {
        var next = Object.assign({}, scan, patch, { updatedAt: new Date().toISOString() });
        return App.DB.saveScan(next);
    }

    return {
        setActiveScanId: setActiveScanId,
        getActiveScanId: getActiveScanId,
        createPendingScan: createPendingScan,
        updateScan: updateScan
    };
})();