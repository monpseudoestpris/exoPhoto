var App = window.App || {};

App.ExerciseStore = (function () {
    function subjectOptions() {
        return ['Mathematiques', 'Francais', 'Histoire-Geographie', 'SVT', 'Physique-Chimie', 'Anglais', 'NSI', 'Philosophie', 'Autre'];
    }

    function gradeOptions() {
        return ['Primaire', 'College', 'Lycee', 'Post-bac'];
    }

    function difficultyOptions() {
        return ['Facile', 'Moyen', 'Difficile'];
    }

    function fromScan(scan, fields) {
        fields = fields || {};
        var now = new Date().toISOString();
        return {
            id: App.DB.nextId('exercise'),
            subject: fields.subject || scan.subjectGuess || App.Settings.get('defaultSubject'),
            title: fields.title || scan.title || 'Exercice importe',
            promptSourceScanId: scan.id,
            statement: fields.statement || scan.ocrText || '',
            instructions: fields.instructions || '',
            gradeLevel: fields.gradeLevel || App.Settings.get('defaultGradeLevel'),
            difficulty: fields.difficulty || App.Settings.get('defaultDifficulty'),
            tags: fields.tags || [],
            variants: fields.variants || [],
            generationSeed: fields.generationSeed || {
                subject: fields.subject || scan.subjectGuess || App.Settings.get('defaultSubject'),
                gradeLevel: fields.gradeLevel || App.Settings.get('defaultGradeLevel'),
                tags: fields.tags || []
            },
            notes: fields.notes || '',
            status: fields.status || 'draft',
            createdAt: now,
            updatedAt: now,
            assistantContext: null
        };
    }

    function normalizeTags(raw) {
        return String(raw || '').split(',').map(function (value) {
            return value.trim();
        }).filter(Boolean);
    }

    function normalizeVariants(raw) {
        return String(raw || '').split('\n').map(function (value) {
            return value.trim();
        }).filter(Boolean).map(function (value) {
            return { id: App.DB.nextId('variant'), text: value };
        });
    }

    return {
        subjectOptions: subjectOptions,
        gradeOptions: gradeOptions,
        difficultyOptions: difficultyOptions,
        fromScan: fromScan,
        normalizeTags: normalizeTags,
        normalizeVariants: normalizeVariants
    };
})();