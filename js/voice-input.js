var App = window.App || {};

// ===== Voice Input Module =====
// Records audio from microphone and transcribes using Mistral Voxtral.
App.VoiceInput = (function () {
    var mediaRecorder = null;
    var mediaStream = null;
    var audioChunks = [];
    var isRecording = false;
    var activeButton = null;
    var observer = null;
    var SUPPORTED_INPUT_TYPES = {
        text: true,
        search: true,
        email: true,
        url: true,
        tel: true,
        password: true
    };
    var VOXTRAL_MODELS = [
        'voxtral-mini-latest',
        'mistral-voxtral-mini-latest',
        'voxtral-mini-2507'
    ];

    function _parseApiError(status, text) {
        var msg = text || '';
        try {
            var parsed = JSON.parse(text || '{}');
            if (parsed && parsed.message) msg = parsed.message;
            if (parsed && parsed.error && parsed.error.message) msg = parsed.error.message;
        } catch (e) {}
        return new Error('HTTP ' + status + (msg ? ': ' + String(msg).slice(0, 220) : ''));
    }

    function _isTextEntryField(field) {
        if (!field || field.disabled || field.readOnly) return false;
        if (field.tagName === 'TEXTAREA') return true;
        if (field.tagName !== 'INPUT') return false;
        var t = String(field.type || 'text').toLowerCase();
        return !!SUPPORTED_INPUT_TYPES[t];
    }

    function _findAttachmentContainer(field) {
        if (!field) return null;
        var label = field.closest('label');
        if (label) return label;
        return field.parentElement;
    }

    function _resetRecordingButtonState() {
        if (activeButton) activeButton.classList.remove('recording');
        activeButton = null;
    }

    function startRecording() {
        audioChunks = [];
        return navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function (stream) {
                mediaStream = stream;
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                mediaRecorder.ondataavailable = function (e) {
                    if (e.data && e.data.size > 0) audioChunks.push(e.data);
                };
                mediaRecorder.start();
                isRecording = true;
                return true;
            })
            .catch(function (err) {
                App.UI.showToast('Erreur acces au micro: ' + err.message, 'error');
                return false;
            });
    }

    function stopRecording() {
        if (!mediaRecorder || !isRecording) return Promise.resolve(null);
        return new Promise(function (resolve) {
            mediaRecorder.onstop = function () {
                isRecording = false;
                var mime = mediaRecorder.mimeType || 'audio/webm';
                var audioBlob = new Blob(audioChunks, { type: mime });
                if (mediaStream) {
                    mediaStream.getTracks().forEach(function (track) { track.stop(); });
                    mediaStream = null;
                }
                mediaRecorder = null;
                resolve(audioBlob);
            };
            mediaRecorder.stop();
        });
    }

    function _transcribeWithModel(audioBlob, model) {
        var mistralKey = App.ProviderKeys.getKey('mistral');
        var fileName = audioBlob.type === 'audio/webm' ? 'audio.webm' : 'audio.wav';
        var formData = new FormData();
        formData.append('file', audioBlob, fileName);
        formData.append('model', model);

        return fetch('https://api.mistral.ai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + mistralKey
            },
            body: formData
        }).then(function (res) {
            if (!res.ok) {
                return res.text().then(function (text) {
                    throw _parseApiError(res.status, text);
                });
            }
            return res.json();
        }).then(function (data) {
            return String(data && data.text || '').trim();
        });
    }

    function transcribe(audioBlob) {
        var mistralKey = App.ProviderKeys.getKey('mistral');
        if (!mistralKey) {
            return Promise.reject(new Error('Cle Mistral absente. Configure-la dans Parametres.'));
        }

        var p = Promise.reject(new Error('Aucun modele Voxtral disponible'));
        VOXTRAL_MODELS.forEach(function (model) {
            p = p.catch(function () {
                return _transcribeWithModel(audioBlob, model);
            });
        });
        return p;
    }

    function recordAndTranscribe() {
        return new Promise(function (resolve, reject) {
            startRecording();
            var timeoutId = null;

            // Auto-stop after 30 seconds
            timeoutId = setTimeout(function () {
                stopRecording().then(function (blob) {
                    if (blob) {
                        transcribe(blob)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        reject(new Error('Aucun audio enregistre'));
                    }
                });
            }, 30000);

            // Listen for space key to stop early
            var handleKeyUp = function (e) {
                if (e.code === 'Space' && isRecording) {
                    clearTimeout(timeoutId);
                    document.removeEventListener('keyup', handleKeyUp);
                    stopRecording().then(function (blob) {
                        if (blob) {
                            transcribe(blob)
                                .then(resolve)
                                .catch(reject);
                        } else {
                            reject(new Error('Aucun audio enregistre'));
                        }
                    });
                }
            };
            document.addEventListener('keyup', handleKeyUp);
        });
    }

    function attachMicButton(targetFieldId, containerClass) {
        var field = document.getElementById(targetFieldId);
        if (!field || !_isTextEntryField(field)) return;

        if (field.dataset.voiceAttached === '1') return;

        var micBtn = document.createElement('button');
        micBtn.type = 'button';
        micBtn.className = 'voice-input-btn ' + (containerClass || '');
        micBtn.setAttribute('aria-label', 'Enregistrer via micro');
        micBtn.setAttribute('title', 'Clique pour enregistrer ta voix (appuie sur Espace pour arreter)');
        micBtn.innerHTML = '🎙️';

        var container = _findAttachmentContainer(field);
        if (!container) return;

        // Check if button already exists
        if (container.querySelector('.voice-input-btn[data-for-field-id="' + field.id + '"]')) {
            field.dataset.voiceAttached = '1';
            return;
        }

        if (!field.id) {
            field.id = 'voice-field-' + Math.random().toString(36).slice(2, 10);
        }
        micBtn.setAttribute('data-for-field-id', field.id);

        container.style.position = 'relative';
        micBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (isRecording) {
                _resetRecordingButtonState();
                App.UI.showToast('Traitement audio...', 'info');
                stopRecording().then(function (blob) {
                    if (blob) {
                        transcribe(blob)
                            .then(function (text) {
                                if (text) {
                                    field.value = (field.value || '') + (field.value ? ' ' : '') + text;
                                    field.dispatchEvent(new Event('input', { bubbles: true }));
                                    field.dispatchEvent(new Event('change', { bubbles: true }));
                                    field.focus();
                                    App.UI.showToast('Texte insere !', 'success');
                                } else {
                                    App.UI.showToast('Aucun texte detecte dans l audio.', 'warning');
                                }
                            })
                            .catch(function (err) {
                                App.UI.showToast('Erreur transcription: ' + err.message, 'error');
                            });
                    }
                });
            } else {
                startRecording().then(function (ok) {
                    if (!ok) return;
                    activeButton = micBtn;
                    micBtn.classList.add('recording');
                    App.UI.showToast('Enregistrement... (clique encore pour arreter)', 'info');
                });
            }
        });
        container.appendChild(micBtn);
        field.dataset.voiceAttached = '1';
    }

    function attachToAllTextFields(root) {
        var scope = root || document;
        if (!scope || !scope.querySelectorAll) return;
        var selector = 'textarea, input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input:not([type])';
        scope.querySelectorAll(selector).forEach(function (field) {
            if (!field || !_isTextEntryField(field)) return;
            if (!field.id) field.id = 'voice-field-' + Math.random().toString(36).slice(2, 10);
            attachMicButton(field.id);
        });
    }

    function initAutoAttach() {
        if (observer) return;
        attachToAllTextFields(document);

        observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (!node || node.nodeType !== 1) return;
                    if (node.matches && node.matches('textarea, input')) {
                        attachToAllTextFields(node.parentElement || document);
                    } else {
                        attachToAllTextFields(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    return {
        recordAndTranscribe: recordAndTranscribe,
        attachMicButton: attachMicButton,
        attachToAllTextFields: attachToAllTextFields,
        initAutoAttach: initAutoAttach,
        isRecording: function () { return isRecording; }
    };
})();
