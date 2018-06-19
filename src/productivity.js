var types = (function() {
"use strict";

var LWORDCOUNT = "running words";
var LTYPECOUNT = "types";
var LHAPAXCOUNT = "hapaxes";
var LTOKENCOUNT = "tokens";
var LYULEK = "Yule's K";
var LENTROPY2 = "2nd order entropy";
var LENTROPY = "entropy";

var FILL1 = ["hsl(220,90%,90%)", "hsl(220,90%,80%)", "hsl(220,90%,70%)", "hsl(220,90%,60%)"]
var FILL2 = ["hsl(20,90%,90%)", "hsl(20,90%,80%)", "hsl(20,90%,70%)", "hsl(20,90%,60%)"]
var STROKE1 = [null, "hsl(0,0%,100%)", "hsl(0,0%,100%)", "hsl(0,0%,100%)"]
var STROKE2 = [null, "hsl(0,0%,100%)", "hsl(0,0%,100%)", "hsl(0,0%,100%)"]
var STROKE1B = ["hsl(0,0%,50%)", null, null, null]
var STROKE2B = ["hsl(0,0%,50%)", null, null, null]
var STROKE1M = "hsl(0,0%,100%)"
var STROKE2M = "hsl(0,0%,100%)"

var makekey = function(l) {
    return l.join("@");
};

var menu = function(e, data) {
    var s = d3.select(e);
    s.selectAll("option")
        .data(data)
            .text(function(d) { return d; })
            .attr("value", function(d) { return d; })
        .enter().append("option")
            .text(function(d) { return d; })
            .attr("value", function(d) { return d; })
        .exit().remove();
    var v = s.node().value;
    if (v === "") {
        v = null;
    }
    return v;
};

var Work = function(ctrl) {
    this.ctrl = ctrl;
    this.results = {};
    this.current = null;
    this.waiting = false;
    this.worker = new Worker("worker.js");
    this.worker.onmessage = this.got_result.bind(this);
};

Work.prototype.got_result = function(e) {
    var d = e.data;
    this.results[makekey(d[0])] = d[1];
    this.waiting = false;
    this.ctrl.update();
};

Work.prototype.data = function(db) {
    this.worker.postMessage(["data", db]);
};

Work.prototype.get_result = function() {
    if (!this.current) {
        return null;
    }
    var key = makekey(this.current);
    if (key in this.results) {
        return this.results[key];
    } else {
        return null;
    }
};

Work.prototype.request = function(data) {
    if (!this.waiting) {
        this.worker.postMessage(["request", this.current]);
        this.waiting = true;
    }
};

Work.prototype.request_if_need = function() {
    if (!this.current) {
        return;
    }
    var key = makekey(this.current);
    if (key in this.results && this.results[key].done) {
        return;
    }
    this.request();
};


var Controller = function() {
    this.w1 = new Work(this);
    this.w2 = new Work(this);
    var margin = {top: 10, right: 10, bottom: 20, left: 40};
    var width = 960 - margin.left - margin.right;
    var height = 600 - margin.top - margin.bottom;
    var svg = d3.select("#plot")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    this.xscale = d3.scaleLinear().rangeRound([0, width]);
    this.yscale = d3.scaleLinear().rangeRound([height, 0]);
    this.gxaxis = g.append("g").attr("transform", "translate(0," + height + ")");
    this.gyaxis = g.append("g");
    this.gplot = g.append("g");
    d3.selectAll("select").on("input", this.update.bind(this));
};

Controller.prototype.update = function() {
    var corpuscodes = Object.keys(this.db.corpus);
    corpuscodes.sort();
    var corpuscode = menu("#corpus", corpuscodes);

    var datasetcodes = [];
    if (corpuscode) {
        datasetcodes = Object.keys(this.db.dataset[corpuscode]);
        datasetcodes.sort();
    }
    var datasetcode = menu("#dataset", datasetcodes);

    var collectioncodes = [];
    if (corpuscode) {
        collectioncodes = Object.keys(this.db.collection[corpuscode]);
        collectioncodes.sort();
        collectioncodes.unshift("");
    }
    var collectioncode = menu("#collection", collectioncodes);

    var ycode = menu("#yaxis", [LTYPECOUNT, LHAPAXCOUNT, LTOKENCOUNT, LYULEK, LENTROPY2, LENTROPY]);
    var xcode = menu("#xaxis", [LWORDCOUNT, LTOKENCOUNT]);

    this.w1.current = null;
    this.w2.current = null;
    if (corpuscode && datasetcode && xcode && ycode) {
        this.w1.current = [corpuscode, datasetcode, xcode, ycode, null];
        if (collectioncode) {
            this.w2.current = [corpuscode, datasetcode, xcode, ycode, collectioncode];
        }
    }

    this.gplot.selectAll("*").remove();
    d3.select("#count").text("");

    this.draw(this.w1.get_result(), this.w2.get_result());
    this.w1.request_if_need();
    this.w2.request_if_need();
};

Controller.prototype.draw = function(result1, result2) {
    if (!result1) {
        return;
    }

    this.xscale.domain([0, result1.strictmaxx]);
    this.yscale.domain([0, result1.recommendedy]);
    this.gxaxis.call(d3.axisBottom(this.xscale));
    this.gyaxis.call(d3.axisLeft(this.yscale));

    var xindexes = [];
    for (var x = 0; x < result1.X; ++x) {
        xindexes.push(x);
    }

    var ctrl = this;

    var plot_area = function(result, l) {
        var l2 = 2 * result.levels.length - l;
        return d3.area()
            .x(function(d) { return ctrl.xscale(d * result.x_from_slot); })
            .y0(function(d) { return ctrl.yscale(result.curves[d + l*result.X] * result.y_from_slot); })
            .y1(function(d) { return ctrl.yscale(result.curves[d + l2*result.X] * result.y_from_slot); });
    }

    var plot_line = function(result) {
        return d3.line()
            .x(function(d) { return ctrl.xscale(d * result.x_from_slot); })
            .y(function(d) { return ctrl.yscale(result.curves[d + result.levels.length*result.X] * result.y_from_slot); });
    }

    for (var l = 0; l < result1.levels.length; ++l) {
        this.gplot.append("path")
            .datum(xindexes)
            .attr("fill", FILL1[l])
            .attr("stroke", STROKE1[l])
            .attr("stroke-width", 1)
            .attr("d", plot_area(result1, l));
    }
    this.gplot.append("path")
        .datum(xindexes)
        .attr("fill", "none")
        .attr("stroke", STROKE1M)
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round")
        .attr("stroke-join", "round")
        .attr("d", plot_line(result1));
    for (var l = 0; l < result1.levels.length; ++l) {
        if (STROKE1B[l]) {
            this.gplot.append("path")
                .datum(xindexes)
                .attr("fill", "none")
                .attr("stroke", STROKE1B[l])
                .attr("stroke-width", 1)
                .attr("d", plot_area(result1, l));
        }
    }

    var count = result1.n;

    if (result2) {
        for (var l = 0; l < result2.levels.length; ++l) {
            this.gplot.append("path")
                .datum(xindexes)
                .attr("fill", FILL2[l])
                .attr("stroke", STROKE2[l])
                .attr("stroke-width", 1)
                .attr("d", plot_area(result2, l));
        }
        this.gplot.append("path")
            .datum(xindexes)
            .attr("fill", "none")
            .attr("stroke", STROKE2M)
            .attr("stroke-width", 2)
            .attr("d", plot_line(result2));
        for (var l = 0; l < result1.levels.length; ++l) {
            if (STROKE2B[l]) {
                this.gplot.append("path")
                    .datum(xindexes)
                    .attr("fill", "none")
                    .attr("stroke", STROKE2B[l])
                    .attr("stroke-width", 1)
                    .attr("d", plot_area(result2, l));
            }
        }

        count += " + " + result2.n;
    }

    d3.select("#count").text(count);
};

Controller.prototype.data = function(db) {
    this.db = db;
    this.w1.data(this.db);
    this.w2.data(this.db);
    this.update();
};

return new Controller();
}());
