window.onload = function () {
    var i = document.getElementsByTagName('img')[0];
    var c = document.createElement('canvas');
    c.width = i.width;
    c.height = i.height;
    var x = c.getContext('2d');
    x.drawImage(i, 0, 0);
    var d = x.getImageData(0, 0, i.width, i.height);
    var n = i.width / 32;

    var stripes = [];
    for (var s = 0; s < n; s++) {
        stripes[s] = [[], []];
        var c1 = s * (32 * 4);
        var c2 = c1 + (31 * 4);
        for (var y = 0; y < i.height; y++) {
            stripes[s][0][y] = d.data[y * i.width * 4 + c1 + 0] * 0x01000000
                             + d.data[y * i.width * 4 + c1 + 1] * 0x00010000
                             + d.data[y * i.width * 4 + c1 + 2] * 0x00000100
                             + d.data[y * i.width * 4 + c1 + 3];
        }
        for (var y = 0; y < i.height; y++) {
            stripes[s][1][y] = d.data[y * i.width * 4 + c2 + 0] * 0x01000000
                             + d.data[y * i.width * 4 + c2 + 1] * 0x00010000
                             + d.data[y * i.width * 4 + c2 + 2] * 0x00000100
                             + d.data[y * i.width * 4 + c2 + 3];
        }
    }
    var stripeDiff = [];
    var compareStripes = [];
    var worst = -1;
    var avgLeftScore = [];
    var bestLeftScore = [];
    var matchThreshold = -1;
    for (var s = 0; s < n; s++) {
        stripeDiff[s] = [];
        best = -1;
        avgLeftScore[s] = 0;
        bestLeftScore[s] = -1;
        for (var sd = 0; sd < n; sd++) {
            if (sd == s) continue;
            var ld = [];
            var rd = [];
            for (var y = 0; y < i.height; y++) {
                ld[y] = Math.abs(stripes[s][0][y] - stripes[sd][1][y]);
                rd[y] = Math.abs(stripes[s][1][y] - stripes[sd][0][y]);
            }
            ld = ld.sort(function (a, b) { return a - b; }).map(function (a) { return a - ld[0]; });
            rd = rd.sort(function (a, b) { return a - b; }).map(function (a) { return a - rd[0]; });
            stripeDiff[s][sd] = [ld[Math.round(y / 2)], rd[Math.round(y / 2)]];
            if (best == -1 || stripeDiff[s][sd][1] < stripeDiff[s][best][1]) best = sd;
            avgLeftScore[s] += stripeDiff[s][sd][0];
            if (bestLeftScore[s] == -1 || bestLeftScore[s] > stripeDiff[s][sd][0]) bestLeftScore[s] = stripeDiff[s][sd][0];
        }
        var sdlmin = -1;
        var sdrmin = -1;
        for (var sdi = 1; sdi < n; sdi++) {
            if (sdi == s) continue;
            if (sdlmin == -1 || stripeDiff[s][sdi][0] < sdlmin) sdlmin = stripeDiff[s][sdi][0];
            if (sdrmin == -1 || stripeDiff[s][sdi][1] < sdrmin) sdrmin = stripeDiff[s][sdi][1];
        }
        stripeDiff[s] = stripeDiff[s].map(function (sd) { sd[0] -= sdlmin; sd[1] -= sdrmin; return sd; });
        compareStripes[s] = best;
        avgLeftScore[s] = avgLeftScore[s] / (n - 1);
        if (worst == -1 || (avgLeftScore[s] > avgLeftScore[worst] && bestLeftScore[s] > bestLeftScore[worst])) worst = s;
    }
    finalStripes = [worst]; appendStripe = worst;
    for (var s = 0; s < n - 1; s++) {
        finalStripes.push(compareStripes[appendStripe]);
        appendStripe = compareStripes[appendStripe];
    }
    var c2 = document.createElement('canvas');
    c2.width = i.width; c2.height = i.height;
    var x2 = c2.getContext('2d');
    for (var s = 0; s < n; s++) {
        var stripeData = x.getImageData(finalStripes[s] * 32, 0, 32, i.height);
        x2.putImageData(stripeData, s * 32, 0);
    }
    document.body.appendChild(c2);
};
