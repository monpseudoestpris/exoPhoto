var App = window.App || {};

App.ExerciseStore = (function () {
    var DEFAULT_TOPIC = 'A classer';
    var GENERIC_TOPICS = {
        'general': true,
        'generale': true,
        'generaux': true,
        'autre': true,
        'divers': true,
        'misc': true,
        'unknown': true,
        'na': true,
        'n/a': true,
        'a classer': true,
        'non classe': true,
        'non classee': true
    };

    var TOPIC_RULES = {
        Mathematiques: [
            { topic: 'Calcul litteral', re: /(calcul\s*litt|developp|factoris|identit[ée] remarqu|polyn[oô]m|mon[oô]me)/i },
            { topic: 'Equations et inequations', re: /(equation|in[eé]quation|systeme|inconnue|r[eé]soudre\s*x)/i },
            { topic: 'Fonctions', re: /(fonction|courbe|image\s*de|ant[eé]c[eé]dent|variation|d[eé]riv)/i },
            { topic: 'Fractions et proportions', re: /(fraction|proportion|pourcentage|ratio|produit\s*en\s*croix)/i },
            { topic: 'Geometrie', re: /(triangle|cercle|p[eé]rim[eè]tre|aire|volume|thal[eè]s|pythagore|angle)/i },
            { topic: 'Probabilites et statistiques', re: /(probabilit|statistique|moyenne|m[eé]diane|ecart|fr[eé]quence)/i }
        ],
        'Physique-Chimie': [
            { topic: 'Mecanique', re: /(vitesse|acc[eé]l[eé]ration|force|mouvement|trajectoire|newton)/i },
            { topic: 'Electricite', re: /(circuit|tension|intensit[eé]|r[eé]sistance|ohm|courant)/i },
            { topic: 'Chimie', re: /(atome|mol[eé]cule|r[eé]action|solution|ph\b|ions?)/i },
            { topic: 'Ondes et optique', re: /(onde|lumi[eè]re|lentille|miroir|fr[eé]quence|longueur d'onde)/i }
        ],
        Francais: [
            { topic: 'Grammaire', re: /(grammaire|nature|fonction|compl[eé]ment|proposition)/i },
            { topic: 'Conjugaison', re: /(conjugaison|temps|verbe|indicatif|subjonctif|participe)/i },
            { topic: 'Orthographe', re: /(orthographe|accord|dict[eé]e|homophone)/i },
            { topic: 'Redaction et expression', re: /(r[eé]daction|argumentation|dissertation|expression [ée]crite)/i }
        ],
        'Histoire-Geographie': [
            { topic: 'Histoire', re: /(r[eé]volution|guerre|si[eè]cle|empire|r[eé]publique|chronologie)/i },
            { topic: 'Geographie', re: /(carte|territoire|climat|population|urbanisation|continent)/i }
        ],
        SVT: [
            { topic: 'Biologie', re: /(cellule|organisme|g[eé]n[eé]tique|adn|respiration|photosynth[eè]se)/i },
            { topic: 'Geologie', re: /(roche|tectonique|volcan|s[eé]isme|strat)/i }
        ],
        Anglais: [
            { topic: 'Grammar', re: /(grammar|tense|verb|present|past|conditional)/i },
            { topic: 'Vocabulary', re: /(vocabulary|word|translate|synonym|antonym)/i },
            { topic: 'Reading comprehension', re: /(comprehension|read the text|answer the questions)/i }
        ],
        NSI: [
            { topic: 'Algorithmique', re: /(algorithme|complexit[eé]|boucle|condition|tri)/i },
            { topic: 'Programmation', re: /(python|javascript|fonction|variable|tableau|liste|dictionnaire)/i },
            { topic: 'Reseaux et web', re: /(r[eé]seau|http|ip|serveur|client|paquet)/i }
        ],
        Philosophie: [
            { topic: 'Dissertation', re: /(dissertation|probl[eé]matique|th[eè]se|antith[eè]se|synth[eè]se)/i },
            { topic: 'Explication de texte', re: /(texte|auteur|notion|concept|argument)/i }
        ]
    };

    function subjectOptions() {
        return ['Mathematiques', 'Francais', 'Histoire-Geographie', 'SVT', 'Physique-Chimie', 'Anglais', 'NSI', 'Philosophie', 'Autre'];
    }

    function normalizeTopic(raw) {
        var value = String(raw || '').trim();
        if (!value) return DEFAULT_TOPIC;

        var folded = value.toLowerCase();
        try {
            folded = folded.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (e) {}

        if (GENERIC_TOPICS[folded]) return DEFAULT_TOPIC;
        return value;
    }

    function isUnclassifiedTopic(topic) {
        return normalizeTopic(topic) === DEFAULT_TOPIC;
    }

    function cleanStatementText(raw) {
        var text = String(raw || '');
        if (!text) return '';

        // Decode escaped new lines and trim markdown/math wrappers for plain text storage.
        text = text.replace(/\\n/g, '\n');
        text = text.replace(/\\\(([^]*?)\\\)/g, '$1');
        text = text.replace(/\\\[([^]*?)\\\]/g, '$1');
        text = text.replace(/\$\$([^]*?)\$\$/g, '$1');
        text = text.replace(/\$([^$\n]+)\$/g, '$1');
        text = text.replace(/^\s*\$\$\s*$/gm, '');
        text = text.replace(/\n{3,}/g, '\n\n');
        return text.trim();
    }

    function inferTopic(subject, title, statement) {
        var normalizedSubject = String(subject || 'Autre');
        var text = [title || '', statement || ''].join(' ').trim();
        if (!text) return DEFAULT_TOPIC;

        var rules = TOPIC_RULES[normalizedSubject] || [];
        for (var i = 0; i < rules.length; i += 1) {
            if (rules[i].re.test(text)) return rules[i].topic;
        }
        return DEFAULT_TOPIC;
    }

    function buildTaxonomy(exercises) {
        var map = {};
        (exercises || []).forEach(function (exercise) {
            var subject = String(exercise.subject || 'Autre');
            var topic = normalizeTopic(exercise.topic);
            if (!map[subject]) map[subject] = {};
            map[subject][topic] = true;
        });
        return map;
    }

    function topicOptionsForSubject(exercises, subject) {
        var target = String(subject || 'Autre');
        var seen = {};
        (exercises || []).forEach(function (exercise) {
            if (String(exercise.subject || 'Autre') !== target) return;
            seen[normalizeTopic(exercise.topic)] = true;
        });
        var values = Object.keys(seen).sort();
        if (!values.length) return [DEFAULT_TOPIC];
        return values;
    }

    function checkPlacement(exercises, subject, topic) {
        var taxonomy = buildTaxonomy(exercises || []);
        var s = String(subject || 'Autre');
        var t = normalizeTopic(topic);
        return {
            existsSubject: !!taxonomy[s],
            existsTopicInSubject: !!(taxonomy[s] && taxonomy[s][t])
        };
    }

    function sortBySubjectTopic(exercises) {
        return (exercises || []).slice().sort(function (a, b) {
            var as = String(a.subject || 'Autre');
            var bs = String(b.subject || 'Autre');
            if (as !== bs) return as.localeCompare(bs, 'fr');

            var at = normalizeTopic(a.topic);
            var bt = normalizeTopic(b.topic);
            if (at !== bt) return at.localeCompare(bt, 'fr');

            var ad = String(a.updatedAt || a.createdAt || '');
            var bd = String(b.updatedAt || b.createdAt || '');
            return bd.localeCompare(ad);
        });
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
        var subject = fields.subject || scan.subjectGuess || App.Settings.get('defaultSubject');
        var title = fields.title || scan.title || 'Exercice importe';
        var statement = cleanStatementText(fields.statement || scan.ocrText || '');
        var topic = isUnclassifiedTopic(fields.topic)
            ? inferTopic(subject, title, statement)
            : normalizeTopic(fields.topic || inferTopic(subject, title, statement));
        return {
            id: App.DB.nextId('exercise'),
            subject: subject,
            topic: topic,
            title: title,
            promptSourceScanId: scan.id,
            statement: statement,
            instructions: fields.instructions || '',
            gradeLevel: fields.gradeLevel || App.Settings.get('defaultGradeLevel'),
            difficulty: fields.difficulty || App.Settings.get('defaultDifficulty'),
            tags: fields.tags || [],
            variants: fields.variants || [],
            generationSeed: fields.generationSeed || {
                subject: subject,
                topic: topic,
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
        defaultTopic: function () { return DEFAULT_TOPIC; },
        subjectOptions: subjectOptions,
        normalizeTopic: normalizeTopic,
        isUnclassifiedTopic: isUnclassifiedTopic,
        cleanStatementText: cleanStatementText,
        inferTopic: inferTopic,
        buildTaxonomy: buildTaxonomy,
        topicOptionsForSubject: topicOptionsForSubject,
        checkPlacement: checkPlacement,
        sortBySubjectTopic: sortBySubjectTopic,
        gradeOptions: gradeOptions,
        difficultyOptions: difficultyOptions,
        fromScan: fromScan,
        normalizeTags: normalizeTags,
        normalizeVariants: normalizeVariants
    };
})();