var App = window.App || {};

App.ImageUtils = (function () {
    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(reader.error); };
            reader.readAsDataURL(file);
        });
    }

    function loadImage(dataUrl) {
        return new Promise(function (resolve, reject) {
            var image = new Image();
            image.onload = function () { resolve(image); };
            image.onerror = function () { reject(new Error('Image invalide')); };
            image.src = dataUrl;
        });
    }

    function resizeDataUrl(dataUrl, options) {
        options = options || {};
        var maxWidth = options.maxWidth || 1800;
        var quality = options.quality || 0.88;

        return loadImage(dataUrl).then(function (image) {
            var ratio = image.width > maxWidth ? maxWidth / image.width : 1;
            var width = Math.round(image.width * ratio);
            var height = Math.round(image.height * ratio);
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            var ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, width, height);

            return {
                dataUrl: canvas.toDataURL('image/jpeg', quality),
                width: width,
                height: height
            };
        });
    }

    return {
        readFileAsDataUrl: readFileAsDataUrl,
        resizeDataUrl: resizeDataUrl
    };
})();