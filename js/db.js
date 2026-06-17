var App = window.App || {};

App.DB = (function () {
    var DB_NAME = 'ExoPhotoDB';
    var DB_VERSION = 1;
    var db = null;

    function withStore(storeName, mode, action) {
        return open().then(function (database) {
            return new Promise(function (resolve, reject) {
                var tx = database.transaction(storeName, mode);
                var store = tx.objectStore(storeName);
                action(store, resolve, reject);
            });
        });
    }

    function open() {
        if (db) return Promise.resolve(db);

        return new Promise(function (resolve, reject) {
            var request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function (event) {
                var database = event.target.result;

                if (!database.objectStoreNames.contains('scans')) {
                    var scans = database.createObjectStore('scans', { keyPath: 'id' });
                    scans.createIndex('createdAt', 'createdAt', { unique: false });
                    scans.createIndex('subjectGuess', 'subjectGuess', { unique: false });
                    scans.createIndex('ocrStatus', 'ocrStatus', { unique: false });
                }

                if (!database.objectStoreNames.contains('exercises')) {
                    var exercises = database.createObjectStore('exercises', { keyPath: 'id' });
                    exercises.createIndex('subject', 'subject', { unique: false });
                    exercises.createIndex('updatedAt', 'updatedAt', { unique: false });
                    exercises.createIndex('gradeLevel', 'gradeLevel', { unique: false });
                    exercises.createIndex('status', 'status', { unique: false });
                }
            };

            request.onsuccess = function (event) {
                db = event.target.result;
                resolve(db);
            };

            request.onerror = function () {
                reject(request.error);
            };
        });
    }

    function getAll(storeName) {
        return withStore(storeName, 'readonly', function (store, resolve, reject) {
            var request = store.getAll();
            request.onsuccess = function () { resolve(request.result || []); };
            request.onerror = function () { reject(request.error); };
        });
    }

    function get(storeName, id) {
        return withStore(storeName, 'readonly', function (store, resolve, reject) {
            var request = store.get(id);
            request.onsuccess = function () { resolve(request.result || null); };
            request.onerror = function () { reject(request.error); };
        });
    }

    function put(storeName, value) {
        return withStore(storeName, 'readwrite', function (store, resolve, reject) {
            var request = store.put(value);
            request.onsuccess = function () { resolve(value); };
            request.onerror = function () { reject(request.error); };
        });
    }

    function remove(storeName, id) {
        return withStore(storeName, 'readwrite', function (store, resolve, reject) {
            var request = store.delete(id);
            request.onsuccess = function () { resolve(); };
            request.onerror = function () { reject(request.error); };
        });
    }

    function getAllByIndex(storeName, indexName, value) {
        return withStore(storeName, 'readonly', function (store, resolve, reject) {
            var request = store.index(indexName).getAll(value);
            request.onsuccess = function () { resolve(request.result || []); };
            request.onerror = function () { reject(request.error); };
        });
    }

    function nextId(prefix) {
        return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }

    function saveScan(scan) {
        return put('scans', scan);
    }

    function getScan(id) {
        return get('scans', id);
    }

    function getScans() {
        return getAll('scans').then(function (items) {
            return items.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
        });
    }

    function deleteScan(id) {
        return remove('scans', id);
    }

    function saveExercise(exercise) {
        return put('exercises', exercise);
    }

    function getExercise(id) {
        return get('exercises', id);
    }

    function getExercises() {
        return getAll('exercises').then(function (items) {
            return items.sort(function (a, b) { return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)); });
        });
    }

    function getExercisesBySubject(subject) {
        return getAllByIndex('exercises', 'subject', subject);
    }

    function deleteExercise(id) {
        return remove('exercises', id);
    }

    return {
        open: open,
        nextId: nextId,
        saveScan: saveScan,
        getScan: getScan,
        getScans: getScans,
        deleteScan: deleteScan,
        saveExercise: saveExercise,
        getExercise: getExercise,
        getExercises: getExercises,
        getExercisesBySubject: getExercisesBySubject,
        deleteExercise: deleteExercise
    };
})();