/** 
 * Poor man's PRNG.
 */
var rand = new function () {
    var x = 13041984, mask = Math.pow(2, 31) - 1;
    return function () {
        x = ((1103515245 * x + 12345) >>> 0) & mask;
        return x;
    }
};  


/**
 * Init charts.
 */
$(document).ready(function () {
    
    $("#demo-chart-synced-a").zig({
        unit: "kbps"
      , width: 390
      , height: 300
      , msieNoneCursorUrl: "../gh-pages-assets/none.cur"
      , graphs: [
            {
                id: "red"
              , lineColor: "#ca1e36" // = 79%
              , fillColor: "none"
              , statRangeColor: "#fcebed" // 99% brightness of lineColor
              , statBoundingColor: "#e55064" // 90%
              , statMeanColor: "#e55064" // 90%
              , statDeviationColor: "#f2a8b3" // 95%
            }
          , {
                id: "orange"
              , lineColor: "#daa520" // = 85%
              , fillColor: "none"
              , statRangeColor: "#fbf5e4" // 99% brightness of lineColor
              , statBoundingColor: "#e4b849" // 90%
              , statMeanColor: "#e4b849" // 90%
              , statDeviationColor: "#f1dba2" // 95%
            }
          , {
                id: "green"
              , lineColor: "#4cbd1c" // = 74%
              , fillColor: "none"
              , statRangeColor: "#f7fdf4" // 99% brightness of lineColor
              , statBoundingColor: "#83e659" // 90%
              , statMeanColor: "#83e659" // 90%
              , statDeviationColor: "#c5f4b1" // 95%
            }
          , {
                id: "blue"
              , lineColor: "#1b71b5" // = 71%
              , fillColor: "none"
              , statRangeColor: "#ecf5fc" // 99% brightness of lineColor
              , statBoundingColor: "#51a4e5" // 90%
              , statMeanColor: "#51a4e5" // 90%
              , statDeviationColor: "#aad2f2" // 95%
            }
          , {
                id: "violet"
              , lineColor: "#6d1eca" // = 79%
              , fillColor: "none"
              , statRangeColor: "#f3ebfc" // 99% brightness of lineColor
              , statBoundingColor: "#9450e5" // 90%
              , statMeanColor: "#9450e5" // 90%
              , statDeviationColor: "#caa9f2" // 95%
            }
        ]
    });          
    
    $("#demo-chart-synced-b").zig({
        unit: "ms"
      // , defaultRenderPath: "html"
      , width: 390
      , height: 300
      , graphs: [
            {
                id: "red"
              , lineColor: "#ca1e36" // = 79%
              , fillColor: "none"
              , statRangeColor: "#fcebed" // 99% brightness of lineColor
              , statBoundingColor: "#e55064" // 90%
              , statMeanColor: "#e55064" // 90%
              , statDeviationColor: "#f2a8b3" // 95%
            }
          , {
                id: "orange"
              , lineColor: "#daa520" // = 85%
              , fillColor: "none"
              , statRangeColor: "#fbf5e4" // 99% brightness of lineColor
              , statBoundingColor: "#e4b849" // 90%
              , statMeanColor: "#e4b849" // 90%
              , statDeviationColor: "#f1dba2" // 95%
            }
          , {
                id: "green"
              , lineColor: "#4cbd1c" // = 74%
              , fillColor: "none"
              , statRangeColor: "#f7fdf4" // 99% brightness of lineColor
              , statBoundingColor: "#83e659" // 90%
              , statMeanColor: "#83e659" // 90%
              , statDeviationColor: "#c5f4b1" // 95%
            }
          , {
                id: "blue"
              , lineColor: "#1b71b5" // = 71%
              , fillColor: "none"
              , statRangeColor: "#ecf5fc" // 99% brightness of lineColor
              , statBoundingColor: "#51a4e5" // 90%
              , statMeanColor: "#51a4e5" // 90%
              , statDeviationColor: "#aad2f2" // 95%
            }
          , {
                id: "violet"
              , lineColor: "#6d1eca" // = 79%
              , fillColor: "none"
              , statRangeColor: "#f3ebfc" // 99% brightness of lineColor
              , statBoundingColor: "#9450e5" // 90%
              , statMeanColor: "#9450e5" // 90%
              , statDeviationColor: "#caa9f2" // 95%
            }
        ]
    });
    
    /*
    var buffer = [170], labels = [];
    for (var c = 0; c < 159; c++) {
        buffer.push((rand() % 25) - 12 + buffer[buffer.length - 1]);
        var date = new Date(c * 3600 * 1000 * 24);
        labels.push((date.getUTCMonth() + 1) + "/" + date.getUTCDate() + "/" + date.getUTCFullYear());
    }
    $("#demo-chart-moon").zig("addSamples", "test1", buffer, labels);

    var buffer = [330];
    for (var c = 0; c < 159; c++) {
        buffer.push((rand() % 30) - 15 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-moon").zig("addSamples", "test2", buffer);
    */
    
    for (var c= 0; c < 480; c++) rand();
    
    var buffer = [1500];
    for (var c = 0; c < 299; c++) {
        buffer.push((rand() % 500) - 240 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-synced-a").zig("addSamples", "red", buffer);
    
    var buffer = [3500];
    for (var c = 0; c < 299; c++) {
        buffer.push((rand() % 500) - 230 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-synced-a").zig("addSamples", "orange", buffer);
    
    var buffer = [2500];
    for (var c = 0; c < 299; c++) {
        buffer.push((rand() % 500) - 240 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-synced-a").zig("addSamples", "green", buffer);
    
    var buffer = [3000];
    for (var c = 0; c < 299; c++) {
        buffer.push((rand() % 500) - 250 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-synced-a").zig("addSamples", "blue", buffer);
    
    var buffer = [4000];
    for (var c = 0; c < 299; c++) {
        buffer.push((rand() % 500) - 250 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-synced-a").zig("addSamples", "violet", buffer);
    
    
    var buffer = [450];
    for (var c = 0; c < 299; c++) {
        buffer.push((rand() % 50) - 24 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-synced-b").zig("addSamples", "red", buffer);
    
    var buffer = [350];
    for (var c = 0; c < 299; c++) {
        buffer.push((rand() % 50) - 24 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-synced-b").zig("addSamples", "orange", buffer);
    
    var buffer = [450];
    for (var c = 0; c < 299; c++) {
        buffer.push((rand() % 50) - 25 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-synced-b").zig("addSamples", "green", buffer);
    
    var buffer = [350];
    for (var c = 0; c < 299; c++) {
        buffer.push((rand() % 50) - 24 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-synced-b").zig("addSamples", "blue", buffer);
    
    var buffer = [350];
    for (var c = 0; c < 299; c++) {
        buffer.push((rand() % 50) - 24 + buffer[buffer.length - 1]);
    }
    $("#demo-chart-synced-b").zig("addSamples", "violet", buffer);
    
    
    $("#demo-chart-synced-a").zig("synchronize", "#demo-chart-synced-b");
    
    /* ... */
    // setTimeout(updateCompetitorsChart, 5000);
});    