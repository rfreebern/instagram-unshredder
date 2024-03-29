(function (window, document, undefined) {
    var getPixel = function (canvas, data, x, y) {
        var pixelIndex = y * canvas.width * 4 + x * 4;
        var r = data[pixelIndex + 0];
        var g = data[pixelIndex + 1];
        var b = data[pixelIndex + 2];
        return {red: r, green: g, blue: b};
    };

    var pixelRGBtoYUV = function (pixel) {
        var y = pixel.red * 0.299 + pixel.green * 0.587 + pixel.blue * 0.114;
        var u = pixel.red * -0.168736 + pixel.green * -0.331264 + pixel.blue * 0.5 + 128;
        var v = pixel.red * 0.5 + pixel.green * -0.418688 + pixel.blue * -0.081312 + 128;
        return {y: y, u: u, v: v};
    }

    var colorDistance = function (p1, p2) {
        var yuv1 = pixelRGBtoYUV(p1);
        var yuv2 = pixelRGBtoYUV(p2);
        return Math.sqrt(Math.pow((yuv1.u - yuv2.u), 2) + Math.pow((yuv1.v - yuv2.v), 2));
    };

    var columnDifference = function (canvas, data, column1, column2) {
        var differenceTotal = 0;
        for (var i = 0; i < canvas.height; i++) {
            differenceTotal += colorDistance(getPixel(canvas, data, column1, i), getPixel(canvas, data, column2, i));
        }
        return differenceTotal / --i;
    };

    var rootMeanSquare = function (canvas, data) {
        var sumOfSquares = 0;
        for (var i = 1; i < canvas.width; i++) sumOfSquares += Math.pow(columnDifference(canvas, data, i - 1, i), 2);
        return Math.sqrt(sumOfSquares / (i - 1));
    };

    var findStripeWidth = function (canvas, data) {
        var possibleColumns = [];
        var threshold = rootMeanSquare(canvas, data) * 1.5; // Within 1.5 standard deviations from the mean.
        for (var i = 1; i < canvas.width; i++) {
            if (columnDifference(canvas, data, i - 1, i) > threshold) possibleColumns.push(i);
        }
        var widths = [];
        for (i = 1; i < possibleColumns.length; i++) {
            var thisWidth = possibleColumns[i] - possibleColumns[i - 1];
            if (!widths[thisWidth]) widths[thisWidth] = [thisWidth, 0];
            widths[thisWidth][1]++;
        }
        widths.sort(function (a, b) { return b[1] - a[1]; });
        if (widths[0][0] == 1) return widths[1][0]; // Ignore bunches of dissimilar individual columns.
        else return widths[0][0];
    };

    var stripeMatchMatrix = function (canvas, data) {
        var stripeWidth = findStripeWidth(canvas, data);
        var numberOfStripes = Math.ceil(canvas.width / stripeWidth);
        var stripeMatchMatrix = [];
        for (var i = 0; i < numberOfStripes; i++) {
            stripeMatchMatrix[i] = {left: [], right: []};
            for (var j = 0; j < numberOfStripes; j++) {
                if (j == i) {
                    stripeMatchMatrix[i].left[j] = Infinity;
                    stripeMatchMatrix[i].right[j] = Infinity;
                } else {
                    stripeMatchMatrix[i].left[j] = columnDifference(canvas, data, i * stripeWidth, (j + 1) * stripeWidth - 1);
                    stripeMatchMatrix[i].right[j] = columnDifference(canvas, data, (i + 1) * stripeWidth - 1, j * stripeWidth);
                }
            }
        }
        return stripeMatchMatrix;
    };

    var findStripeOrder = function (canvas, data) {
        var matrix = stripeMatchMatrix(canvas, data);
        var bestPath = {stripes: [], totalCost: Infinity};
        for (var i = 0; i < matrix.length; i++) {
            var currentStripe = i;
            var currentPath = {stripes: [currentStripe], totalCost: 0};
            while (currentPath.stripes.length < matrix.length) {
                var next = {stripe: NaN, cost: Infinity};
                for (var j = 0; j < matrix.length; j++) {
                    if (j == i) continue;
                    if (matrix[currentStripe].right[j] < next.cost) next = {stripe: j, cost: matrix[currentStripe].right[j]};
                }
                currentPath.stripes.push(next.stripe);
                currentPath.totalCost += next.cost;
                if (currentPath.totalCost > bestPath.totalCost) break;
                currentStripe = next.stripe;
            }
            if (currentPath.totalCost < bestPath.totalCost) bestPath = currentPath;
        }
        return bestPath.stripes;
    };

    var unshred = function (image) {
        var shreddedCanvas = document.createElement('canvas');
        shreddedCanvas.width = image.width;
        shreddedCanvas.height = image.height;
        var shreddedContext = shreddedCanvas.getContext('2d');
        shreddedContext.drawImage(image, 0, 0);
        var shreddedData = shreddedContext.getImageData(0, 0, shreddedCanvas.width, shreddedCanvas.height).data;
        var path = findStripeOrder(shreddedCanvas, shreddedData);

        var unshredCanvas = document.createElement('canvas');
        unshredCanvas.width = image.width;
        unshredCanvas.height = image.height;
        var unshredContext = unshredCanvas.getContext('2d');
        var stripeWidth = findStripeWidth(shreddedCanvas, shreddedData);
        for (var stripe = 0; stripe < path.length; stripe++) {
            var stripeData = shreddedContext.getImageData(path[stripe] * stripeWidth, 0, stripeWidth, unshredCanvas.height);
            unshredContext.putImageData(stripeData, stripe * stripeWidth, 0);
        }
        var div = image.parentNode;
        div.removeChild(image);
        div.appendChild(unshredCanvas);
    }

    window.unshred = unshred;
})(window, document);
var images = document.getElementsByTagName('img');
for (var i = 0; i < images.length; i++) images[i].onclick = function () { window.unshred(this); };
