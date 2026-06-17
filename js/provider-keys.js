var App = window.App || {};

App.ProviderKeys = (function () {
    var STORAGE_PREFIX = 'exophoto-provider-key:';
    var PASS_PREFIX = 'exophoto-provider-passphrase:';
    var ITERATIONS = 250000;
    var SALT_BYTES = 16;
    var IV_BYTES = 12;
    var PROVIDERS = ['mistral', 'deepseek', 'anthropic'];
    var unlocked = {};
    var listeners = [];

    function emit(provider, eventName) {
        listeners.forEach(function (listener) {
            try { listener(provider, eventName); } catch (err) {}
        });
    }

    function cryptoOrThrow() {
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error('WebCrypto indisponible');
        }
        return window.crypto;
    }

    function recordKey(provider) {
        return STORAGE_PREFIX + provider;
    }

    function rememberKey(provider) {
        return PASS_PREFIX + provider;
    }

    function toBase64(bytes) {
        var data = new Uint8Array(bytes);
        var text = '';
        for (var i = 0; i < data.length; i++) text += String.fromCharCode(data[i]);
        return btoa(text);
    }

    function fromBase64(value) {
        var binary = atob(value);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    function read(provider) {
        try {
            var raw = localStorage.getItem(recordKey(provider));
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            return null;
        }
    }

    function derive(passphrase, salt) {
        var crypto = cryptoOrThrow();
        return crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']).then(function (baseKey) {
            return crypto.subtle.deriveKey({
                name: 'PBKDF2',
                salt: salt,
                iterations: ITERATIONS,
                hash: 'SHA-256'
            }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        });
    }

    function saveKey(provider, apiKey, passphrase) {
        if (!apiKey || !String(apiKey).trim()) return Promise.reject(new Error('Cle vide'));
        if (!passphrase || String(passphrase).length < 4) return Promise.reject(new Error('Passphrase trop courte'));

        var crypto = cryptoOrThrow();
        var salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
        var iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

        return derive(passphrase, salt).then(function (key) {
            return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(String(apiKey).trim()));
        }).then(function (cipher) {
            localStorage.setItem(recordKey(provider), JSON.stringify({
                v: 1,
                salt: toBase64(salt),
                iv: toBase64(iv),
                ciphertext: toBase64(cipher)
            }));
            unlocked[provider] = String(apiKey).trim();
            emit(provider, 'saved');
            emit(provider, 'unlocked');
        });
    }

    function unlock(provider, passphrase) {
        var saved = read(provider);
        if (!saved) return Promise.reject(new Error('Aucune cle enregistree'));
        if (!passphrase) return Promise.reject(new Error('Passphrase requise'));

        return derive(passphrase, fromBase64(saved.salt)).then(function (key) {
            return cryptoOrThrow().subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(saved.iv) }, key, fromBase64(saved.ciphertext));
        }).then(function (plain) {
            unlocked[provider] = new TextDecoder().decode(plain);
            emit(provider, 'unlocked');
            return true;
        }).catch(function () {
            throw new Error('Passphrase incorrecte');
        });
    }

    function lock(provider) {
        if (unlocked[provider]) {
            unlocked[provider] = null;
            emit(provider, 'locked');
        }
    }

    function clear(provider) {
        lock(provider);
        localStorage.removeItem(recordKey(provider));
        disableRemember(provider);
        emit(provider, 'cleared');
    }

    function enableRemember(provider, passphrase) {
        if (!passphrase) return;
        localStorage.setItem(rememberKey(provider), passphrase);
        emit(provider, 'remember-enabled');
    }

    function disableRemember(provider) {
        localStorage.removeItem(rememberKey(provider));
        emit(provider, 'remember-disabled');
    }

    function isRememberEnabled(provider) {
        return !!localStorage.getItem(rememberKey(provider));
    }

    function getRememberedPassphrase(provider) {
        return localStorage.getItem(rememberKey(provider));
    }

    function autoUnlockRemembered(provider) {
        var passphrase = getRememberedPassphrase(provider);
        if (!passphrase || !hasKey(provider)) return Promise.resolve(false);
        return unlock(provider, passphrase).then(function () {
            emit(provider, 'auto-unlocked');
            return true;
        }).catch(function () {
            // stale passphrase: disable remember to avoid repeated failures
            disableRemember(provider);
            return false;
        });
    }

    function autoUnlockAllRemembered() {
        return Promise.all(PROVIDERS.map(function (provider) {
            return autoUnlockRemembered(provider);
        }));
    }

    function getKey(provider) {
        return unlocked[provider] || null;
    }

    function hasKey(provider) {
        return !!read(provider);
    }

    function isUnlocked(provider) {
        return !!unlocked[provider];
    }

    function onChange(listener) {
        if (typeof listener !== 'function') return function () {};
        listeners.push(listener);
        return function () {
            var index = listeners.indexOf(listener);
            if (index >= 0) listeners.splice(index, 1);
        };
    }

    return {
        saveKey: saveKey,
        unlock: unlock,
        lock: lock,
        clear: clear,
        enableRemember: enableRemember,
        disableRemember: disableRemember,
        isRememberEnabled: isRememberEnabled,
        autoUnlockRemembered: autoUnlockRemembered,
        autoUnlockAllRemembered: autoUnlockAllRemembered,
        getKey: getKey,
        hasKey: hasKey,
        isUnlocked: isUnlocked,
        onChange: onChange
    };
})();