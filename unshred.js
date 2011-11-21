(function (window, document, undefined) {
    var samplingInterval = 1;

    var getPixel = function (canvas, data, x, y) {
        var pixelIndex = y * canvas.width * 4 + x * 4;
        var r = data[pixelIndex + 0];
        var g = data[pixelIndex + 1];
        var b = data[pixelIndex + 2];
        var a = data[pixelIndex + 3];
        return {red: r, green: g, blue: b, alpha: a};
    };

    /* Thiadmer Reimersma, http://www.compuphase.com/cmetric.htm */
    var colorDistanceRGB = function (p1, p2) {
        var rmean = (p1.red + p2.red) / 2;
        var r = p1.red - p2.red;
        var g = p1.green - p2.green;
        var b = p1.blue - p2.blue;
        return Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));
    };

    var colorDistanceRGBSimplistic = function (p1, p2) {
        var r = p1.red - p2.red;
        var g = p1.green - p2.green;
        var b = p1.blue - p2.blue;
        return Math.sqrt(((r * r) + (g * g) + (b * b)) / 3);
    };

    var colorDistanceYUV = function (p1, p2) {
        var y1 = p1.red *  .299000 + p1.green *  .587000 + p1.blue *  .114000;
        var u1 = p1.red * -.168736 + p1.green * -.331264 + p1.blue *  .500000 + 128;
        var v1 = p1.red *  .500000 + p1.green * -.418688 + p1.blue * -.081312 + 128;
        
        var y2 = p2.red *  .299000 + p2.green *  .587000 + p2.blue *  .114000;
        var u2 = p2.red * -.168736 + p2.green * -.331264 + p2.blue *  .500000 + 128;
        var v2 = p2.red *  .500000 + p2.green * -.418688 + p2.blue * -.081312 + 128;

        return Math.sqrt(Math.pow((u1 - u2), 2) + Math.pow((v1 - v2), 2));
    };

    var colorDistance = colorDistanceYUV;

    var columnDifference = function (canvas, data, column1, column2) {
        var differenceTotal = 0;
        for (var i = 0; i < canvas.height; i += samplingInterval) {
            differenceTotal += colorDistance(getPixel(canvas, data, column1, i), getPixel(canvas, data, column2, i));
        }
        return differenceTotal / (i - samplingInterval);
    };

    var rootMeanSquare = function (canvas, data) {
        var sumOfSquares = 0;
        for (var i = 1; i < canvas.width; i++) sumOfSquares += Math.pow(columnDifference(canvas, data, i - 1, i), 2);
        return Math.sqrt(sumOfSquares / (i - 1));
    };

    var findStripeWidth = function (canvas, data) {
        var possibleColumns = [];
        var threshold = rootMeanSquare(canvas, data) * 1.5;
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
        if (widths[0][0] == 1) return widths[1][0];
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

    var unshred = function () {
        var shreddedImage = document.getElementsByTagName('img')[0];
        var shreddedCanvas = document.createElement('canvas');
        shreddedCanvas.width = shreddedImage.width;
        shreddedCanvas.height = shreddedImage.height;

        var shreddedContext = shreddedCanvas.getContext('2d');
        shreddedContext.drawImage(shreddedImage, 0, 0);

        var shreddedData = shreddedContext.getImageData(0, 0, shreddedCanvas.width, shreddedCanvas.height);
        var path = findStripeOrder(shreddedCanvas, shreddedData.data);
        console.log(path);

        var unshredCanvas = document.createElement('canvas');
        unshredCanvas.width = shreddedImage.width;
        unshredCanvas.height = shreddedImage.height;
        var unshredContext = unshredCanvas.getContext('2d');
        var stripeWidth = findStripeWidth(shreddedCanvas, shreddedData.data);
        for (var stripe = 0; stripe < path.length; stripe++) {
            var stripeData = shreddedContext.getImageData(path[stripe] * stripeWidth, 0, stripeWidth, unshredCanvas.height);
            unshredContext.putImageData(stripeData, stripe * stripeWidth, 0);
        }
        document.body.appendChild(unshredCanvas);
    }

    window.unshred = unshred;
})(window, document);
document.getElementsByTagName('img')[0].onload = window.unshred;
