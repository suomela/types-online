"use strict";

importScripts("https://d3js.org/d3.v4.min.js");

var LWORDCOUNT = "running words";
var LTYPECOUNT = "types";
var LHAPAXCOUNT = "hapaxes";
var LTOKENCOUNT = "tokens";
var LYULEK = "Yule's K";
var LENTROPY2 = "2nd order entropy";
var LENTROPY = "entropy";

var X = 2000;
var Y = 1000;
var XPAD = 1;
var YPAD = 1.1;
var MEDPAD = 1.5;
var LEVELS = [0.0001, 0.001, 0.01, 0.1];
var ITERLIMIT = 100000;
var TIMETARGET = 200;

var LEVELS2 = (function() {
    var l = [0.5];
    for (var i = 0; i < LEVELS.length; ++i) {
        l.push(LEVELS[i]);
        l.push(1 - LEVELS[i]);
    }
    l.sort();
    return l;
}());

var makekey = function(l) {
    return l.join("@");
};

var entropy = function(l) {
    var n = l.length;
    var s = 0;
    for (var i = 0; i < n; ++i) {
        s += l[i];
    }
    var r = 0;
    for (var i = 0; i < n; ++i) {
        if (l[i] != 0) {
            var p = l[i]/s;
            r -= p * Math.log2(p);
        }
    }
    return r;
};

var entropy2 = function(l) {
    var n = l.length;
    var s = 0;
    for (var i = 0; i < n; ++i) {
        s += l[i];
    }
    var r = 0;
    for (var i = 0; i < n; ++i) {
        if (l[i] != 0) {
            var p = l[i]/s;
            r += p * p;
        }
    }
    if (r == 0) {
        return 0;
    } else {
        return -Math.log2(r);
    }
};

var yulek = function(l) {
    var n = l.length;
    var s1 = 0;
    var s2 = 0;
    for (var i = 0; i < n; ++i) {
        var x = l[i];
        s1 += x;
        s2 += x * x;
    }
    if (s1 == 0) {
        return 0;
    } else {
        return 1e4 * (s2-s1)/(s1*s1);
    }
};


var Curve = function() {
    this.b = new Float32Array(X*Y);
    this.levels = new Float32Array(LEVELS2.length*X);
    this.maxx = 0;
    this.maxy = 0;
    this.strictmaxx = 0;
    this.strictmaxy = 0;
    this.resize(1, 1);
};

Curve.prototype.resize = function(maxx, maxy) {
    this.strictmaxx = Math.max(maxx, this.strictmaxx);
    this.strictmaxy = Math.max(maxy, this.strictmaxy);
    if (maxx <= this.maxx && maxy <= this.maxy) {
        return;
    }
    this.maxx = Math.max(XPAD * maxx, this.maxx);
    this.maxy = Math.max(YPAD * maxy, this.maxy);
    this.x_to_slot = (X - 1) / this.maxx;
    this.y_to_slot = (Y - 1) / this.maxy;
    this.x_from_slot = this.maxx / (X - 1);
    this.y_from_slot = this.maxy / (Y - 1);
    this.n = 0;
    for (var i = 0; i < Y*X; ++i) {
        this.b[i] = 0;
    }
};

Curve.prototype.feed = function(c) {
    var maxx = 0;
    var maxy = 0;
    for (var i = 0; i < c.length; ++i) {
        var x = c[i][0];
        var y = c[i][1];
        maxx = Math.max(x, maxx);
        maxy = Math.max(y, maxy);
    }
    this.resize(maxx, maxy);
    var i = 0;
    var y = 0;
    for (var xs = 0; xs < X; ++xs) {
        var y0 = y;
        var y1 = y;
        while (i < c.length && c[i][0] * this.x_to_slot < xs + 0.5) {
            y = c[i][1];
            ++i;
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
        }
        var y0s = Math.round(y0 * this.y_to_slot);
        var y1s = Math.round(y0 * this.y_to_slot);
        var f = 1 / (y1s - y0s + 1);
        for (var ys = y0s; ys <= y1s; ++ys) {
            this.b[ys + Y*xs] += f;
        }
    }
    ++this.n;
};

Curve.prototype.calc_level_1 = function(x) {
    var l = 0;
    var t = LEVELS2[l] * this.n;
    var s0 = 0;
    for (var y = 0; y < Y; ++y) {
        var s1 = s0 + this.b[y + Y*x];
        while (s1 >= t) {
            var f = (t - s0) / (s1 - s0);
            this.levels[x + l*X] = y + f - 1;
            ++l;
            if (l == LEVELS2.length) {
                return;
            }
            t = LEVELS2[l] * this.n;
        }
        s0 = s1;
    }
    for (; l < LEVELS2.length; ++l) {
        this.levels[x + l*X] = Y - 1;
    }
}

Curve.prototype.calc_levels = function() {
    for (var x = 0; x < X; ++x) {
        this.calc_level_1(x);
    }
    var maxmed = 0;
    var l = LEVELS.length;
    for (var x = 0; x < X; ++x) {
        maxmed = Math.max(this.levels[x + l*X], maxmed);
    }
    maxmed *= this.y_from_slot;
    this.recommendedy = Math.min(MEDPAD * maxmed, this.strictmaxy);
};

var Calculate = function(db, request) {
    this.db = db;
    this.request = request;

    this.corpuscode = request[0];
    this.datasetcode = request[1];
    this.xcode = request[2];
    this.ycode = request[3];
    this.collectioncode = request[4];

    if (this.collectioncode) {
        if (this.db.sample_collection[this.corpuscode][this.collectioncode]) {
            this.samplecodes = this.db.sample_collection[this.corpuscode][this.collectioncode].slice();
        } else {
            this.samplecodes = [];
        }
    } else {
        this.samplecodes = Object.keys(this.db.sample[this.corpuscode]);
    }
    this.samplecodes.sort();

    this.wordcounts = [];
    this.tokencodes = [];
    this.packed_samples = [];
    if (this.corpuscode && this.datasetcode) {
        var seen = {};
        for (var i = 0; i < this.samplecodes.length; ++i) {
            var samplecode = this.samplecodes[i];
            var sample = this.db.sample[this.corpuscode][samplecode];
            var tokens = this.db.token[this.corpuscode][this.datasetcode][samplecode];
            this.wordcounts.push(sample.wordcount);
            for (var tokencode in tokens) {
                seen[tokencode] = 1;
            }
        }
        this.tokencodes = Object.keys(seen);
        this.tokencodes.sort();
        var tokencode_to_index = {};
        for (var j = 0; j < this.tokencodes.length; ++j) {
            tokencode_to_index[this.tokencodes[j]] = j;
        }
        for (var i = 0; i < this.samplecodes.length; ++i) {
            var samplecode = this.samplecodes[i];
            var sample = this.db.sample[this.corpuscode][samplecode];
            var tokens = this.db.token[this.corpuscode][this.datasetcode][samplecode] || {};
            var tokenlist = Object.keys(tokens);
            tokenlist.sort();
            var n = tokenlist.length;
            var index = new Int32Array(n);
            var count = new Int32Array(n);
            for (var j = 0; j < n; ++j) {
                var tokencode = tokenlist[j];
                index[j] = tokencode_to_index[tokencode];
                count[j] = tokens[tokencode].tokencount;
            }
            this.packed_samples.push([index, count]);
        }
    }
    this.curve = new Curve();
    this.done = false;
    this.iterguess = 20;
};

Calculate.prototype.steps = function() {
    for (var iter = 0; iter < this.iterguess; ++iter) {
        if (this.curve.n >= ITERLIMIT) {
            this.done = true;
            return;
        }
        var wordcount = 0;
        var tokencount = 0;
        var typecount = 0;
        var hapaxcount = 0;
        var seen = new Int32Array(this.tokencodes.length);
        var shuffled = [];
        for (var i = 0; i < this.samplecodes.length; ++i) {
            shuffled.push(i);
        }
        d3.shuffle(shuffled);
        var points = [];
        for (var i = 0; i < shuffled.length; ++i) {
            var si = shuffled[i];
            var ps = this.packed_samples[si];
            var index = ps[0];
            var count = ps[1];
            for (var j = 0; j < index.length; ++j) {
                var ti = index[j];
                var tc = count[j];
                if (seen[ti] == 0) {
                    ++typecount;
                    if (tc == 1) {
                        ++hapaxcount;
                    }
                } else if (seen[ti] == 1) {
                    --hapaxcount;
                }
                tokencount += tc;
                seen[ti] += tc;
            }
            wordcount += this.wordcounts[si];
            var point = [];
            for (var coord = 0; coord < 2; ++coord) {
                var label = [this.xcode, this.ycode][coord];
                var v;
                if (label === LWORDCOUNT) { v = wordcount; }
                else if (label === LTOKENCOUNT) { v = tokencount; }
                else if (label === LTYPECOUNT ) { v = typecount; }
                else if (label === LHAPAXCOUNT) { v = hapaxcount; }
                else if (label === LYULEK     ) { v = yulek(seen); }
                else if (label === LENTROPY2  ) { v = entropy2(seen); }
                else if (label === LENTROPY   ) { v = entropy(seen); }
                point.push(v);
            }
            points.push(point);
        }
        this.curve.feed(points);
    }
}

Calculate.prototype.more = function() {
    var start = new Date();
    this.steps();
    var now = new Date();
    var f = (now - start) / TIMETARGET;
    if (f < 0.1) {
        this.iterguess *= 5;
    } else {
        var guess = this.iterguess / f;
        this.iterguess = (guess + this.iterguess) / 2;
    }
    this.curve.calc_levels();
    postMessage([this.request, {
        levels: LEVELS,
        X: X,
        n: this.curve.n,
        done: this.done,
        strictmaxx: this.curve.strictmaxx,
        recommendedy: this.curve.recommendedy,
        x_from_slot: this.curve.x_from_slot,
        y_from_slot: this.curve.y_from_slot,
        curves: this.curve.levels,
    }]);
};


var db = null;
var calculations = {};

onmessage = function(e) {
    var d = e.data;
    if (d[0] === "data") {
        db = d[1];
    } else if (d[0] == "request") {
        var request = d[1];
        var key = makekey(request);
        if (!(key in calculations)) {
            calculations[key] = new Calculate(db, request);
        }
        calculations[key].more();
    }
};
