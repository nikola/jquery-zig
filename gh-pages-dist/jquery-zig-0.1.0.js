/*!
 * jquery-zig Plugin Version 0.1.0-20110505
 * Copyright 2011, Nikola Klaric.
 * 
 * https://github.com/nikola/jquery-zig
 *
 * Licensed under the GNU General Public License (GPL) Version 2.
 *
 * For the full license text see the enclosed GPL-LICENSE.TXT, or go to:
 * https://github.com/nikola/jquery-zig/GPL-LICENSE.txt
 * 
 * If you are using this plugin for commercial purposes, please consider
 * purchasing a commercial license. Visit the project homepage for more
 * details.
 */
(function ($) {
    
    /**
     * A jQuery plugin that draws interactive line chart diagrams. 
     * All modern browsers supported.
     */
    $.zig = function (node, options) {

        var base = this;
        base.$node = $(node);
        
        /* Prevent repeated initialization. */
        if (!!base.$node.data("plugin.zig")) {
            return;
        } else {
            /* Add self-reference for method access. */
            base.$node.data("plugin.zig", base);    
        }
        
        /* Determine this early. */
        base.id = base.$node.attr("id");
                
        /*
         * Only handle block-style elements.
         */
        if (base.$node.css("display") != "block" && base.$node.css("display") != "inline-block") {
            throw "Only block-style elements are supported at this time.";
        }

        /*
         * Functor of the render path for ... rendering paths.
         */
        var _functorRenderPath = null;

        /*
         * Persistent instance data.
         */
        $.extend(base, {
          
            /* Basic configuration options. */
            config: {}

            /* Options for each graph in the chart. */
          , graphs: {}

            /* Keep track of graph IDs for faster iteration. */
          , graphIds: []
          , graphCount: 0

            /* Sample data. */
          , rawSamples: {}
          , scaledSamples: {}
          , sampleLabels: []
          
            /* Set of jquery-zig instances this instance synchronizes to. */
          , synchronizedTo: []
        
            /* Queued inline samples and labels. */
          , queuedSamples: null
          , queuedLabels: null
        
            /* Container element for each graph. */
          , graphContainer: {}
          
            /* Global clip offset. */
          , graphClipOffset: 0
        
            /* Relative z-index of each graph. */
          , planeIndex: {}
        
            /* Indicates whether the mouse currently traces a graph. */
          , isOnPath: false
        
            /* Counter for used default color sets. */
          , defaultColorCounter: 0
            
            /* Maximum number of samples added across all graphs. */
          , sampleCountMax: 0
          
            /* Maximum number of samples added across all graphs. */
          , maxCeiling: 0
          
            /* Maximum number of samples that fit the visible canvas. */
          , maxSamples: null
          
            /* Ceiling text element. */
          , ceilingText: null            
            
            /* State of custom scrollbar. */
          , hasScrollbar: false
          , scrollbarTrack: null
          , scrollbarScroller: null
          , scrollbarBorderTransparent: false
          , scrollerWidth: null
          , maxScrollerWidth: null
          , isScrolling: false
          , scrollPosition: null
          , scrollMax: null
          , scrollRatio: null
          , scrollStartX: null
          , lastScrollDiff: null
          , lastPageX: null
          , lastPageY: null
            
            /* State of custom cursor. */
          , cursors: null
          , horizontalCrosshairCursor: null
          , verticalCrosshairCursor: null
          
            /* State of coordinate readings. */
          , coordinates: null  
          , horizontalCoordinate: null
          , horizontalOrientation: null
          , verticalCoordinate: null
          , horizontalReadingMode: false
          , sampleReadings: {}
          , lastHorizontalX: null
            
        });        
                                
        
        /**
         * Initialize this instance and render chrome and inline sample data.
         */
        base.__init__ = function () {
            /*
             * Expose public interface.
             */
            if (!($.zig.constants.MAGIC in $.prototype.zig)) {
                $.prototype.zig[$.zig.constants.MAGIC] = true;
                for (var symbol in base) {
                    if (base.hasOwnProperty(symbol) && /^[a-z][a-zA-Z]+$/.test(symbol) 
                            && $.type(base[symbol]) == "function") {
                        $.zig[symbol] = symbol;
                    }
                }
                
                /* For missing ID assignment. */
                $.prototype.zig.counter = 0;
                
                /* Determine supported <canvas> features. */
                $.prototype.zig.supportsCanvas = !!document.createElement("canvas").getContext;
                $.prototype.zig.supportsPixelRetrieval = $.prototype.zig.supportsCanvas && 
                        !!document.createElement("canvas").getContext("2d").getImageData;
                
                /* True if mouse down/up events have been bound. */
                $.prototype.zig.hasMouseEventsBound = false;
            }
            
            /*
             * Set explicit id on this node.
             */
            if (!base.id) {
                base.id = "zig-id-" + $.prototype.zig.counter;
                $.prototype.zig.counter += 1; 
                base.$node.attr("id", base.id);
            }
            
            /* Overload with default options. */
            base.options = $.extend({}, $.zig.defaultOptions, options);

            /*
             * Determine the actual render path.
             */
            if ($.prototype.zig.supportsCanvas && base.options.defaultRenderPath == "auto") {
                _functorRenderPath = _renderPathCanvas;
                
                /* Additional state for this render path. */
                base.canvasSegmentContexts = {};
                base.canvasSegmentWidths = {}; 
            } else {
                _functorRenderPath = _renderPathHtml;
                
                /* Additional state for this render path. */
                base.lastElementAdded = {};
                base.lastElementWidth = {};
                base.lastElementZIndex = {};
            }

            /* Diagram width must be a multiple of DIAGRAM_COLUMN_WIDTH. */
            var columnWidth = $.zig.constants.DIAGRAM_COLUMN_WIDTH;
            base.options.width = Math.floor(base.options.width / columnWidth) * columnWidth;
                        
            /* Maximum number of samples that fit within the visible canvas. */
            base.maxSamples = base.options.width / columnWidth;
               
            /* Extract samples that were initially declared in the node's HTML. */   
            _extractSamples();
            
            /* Render basic chrome. */
            base.$node.css({
                position: "relative"
              , width: base.options.width + "px"
              , height: base.options.height + "px"
              , border: "1px solid " + ((base.options.borderColor == "transparent") ?
                    base.options.backgroundColor : base.options.borderColor) 
              , overflow: "hidden"
            });  

            /* Initialize and render graph containers as defined in init parameters. */
            _createGraphs();
            
            /* True if any graph has a fill color set. */
            base.hasFilledPaths = base.config[base.defaultGraph].fillColor != "none";

            /*
             * Render more chrome.
             */
            _renderBackground();
            _renderCeilingText();
            base.options.showVerticalGrid && _renderVerticalGrid();
            
            /* Set up cursor controls. */  
            if (!base.options.debug) {
                _renderCursorControls(true);
                _wireMouseControls();
            }   
                        
            /* Add samples that were initially declared in the node's HTML. */
            if ($.isArray(base.queuedSamples) && base.queuedSamples.length
                    || $.isPlainObject(base.queuedSamples) && !$.isEmptyObject(base.queuedSamples)) {
                setTimeout(base.addSamples, 0);
            }
        };


        /**
         * Initialize and render graph containers as defined in init parameters..
         */
        function _createGraphs() {
            if (!(base.options.graphs && base.options.graphs.length)) {
                base.graphIds.push("default");
                
                base.planeIndex["default"] = 0;
                base.rawSamples["default"] = [];
                base.scaledSamples["default"] = [];
                
                if (!$.prototype.zig.supportsCanvas) {
                    base.lastElementAdded["default"] = null;
                    base.lastElementWidth["default"] = null;
                    base.lastElementZIndex["default"] = null;
                }
                
                var colors = $.zig.constants.DEFAULT_COLORS[0];
                base.config["default"] = {
                    lineColor: colors.lineColor
                  , fillColor: colors.fillColor
                };
                base.defaultColorCounter += 1;
                
                _addGraphContainer("default");
                
                base.graphCount = 1;
                base.defaultGraph = "default";
            } else {
                var count = 0;
                $.each(base.options.graphs, function (index, value) {
                    var id = value.id;
                    base.graphIds.push(id);
                    
                    base.planeIndex[id] = count;
                    base.rawSamples[id] = [];
                    base.scaledSamples[id] = [];
                    
                    base.config[id] = $.extend({}, value);
                    
                    if (!("lineColor" in base.config[id]) && !("fillColor" in base.config[id])) {
                        $.extend(base.config[id], $.zig.constants.DEFAULT_COLORS[base.defaultColorCounter]);
                        base.defaultColorCounter += 1;
                    } else if ("lineColor" in value && !("fillColor" in base.config[id])) {
                        base.config[id].lineColor = value.lineColor;
                        base.config[id].fillColor = "none";
                    } else if (!("lineColor" in value) && "fillColor" in base.config[id]) {
                        base.config[id].lineColor = $.zig.constants.DEFAULT_COLORS[base.defaultColorCounter].lineColor;
                        base.config[id].fillColor = value.fillColor;
                        base.defaultColorCounter += 1;
                    }
                    
                    if (!$.prototype.zig.supportsCanvas) {
                        base.lastElementAdded[id] = null;
                        base.lastElementWidth[id] = null;
                        base.lastElementZIndex[id] = null;
                    }
                   
                    count++;
                    
                    _addGraphContainer(id);
                });
                base.graphCount = count;
                base.defaultGraph = base.graphIds[0];
            }            
        }
        
        
        /**
         * Extract samples that were initially declared in the node's HTML.
         */
        function _extractSamples() {
            var queuedSamples, queuedLabels;
            if (base.$node.is("ol") && base.$node.find("li").size()) {
                if (base.$node.find("ol").size()) {
                    queuedSamples = {}, queuedLabels = {}; 
                    base.$node.find("ol").each(function () {
                        var id = $(this).attr("id");
                        if (!!id) {
                            queuedSamples[id] = [], queuedLabels[id] = [];
                            $(this).find("li").each(function () {
                                queuedSamples[id].push(parseInt($(this).text()));
                                queuedLabels[id].push($(this).attr("title"));
                            });
                        }
                    }); 
                } else {
                    queuedSamples = [], queuedLabels = [];
                    base.$node.find("li").each(function () {
                        queuedSamples.push(parseInt($(this).text()));
                        queuedLabels.push($(this).attr("title"));
                    });    
                }
                
                var currentElement = base.$node, currentClass = currentElement.attr("class");
                base.$node = base.$node.wrap($("<div>")).closest("div");
                base.$node.attr("class", currentClass);
                currentElement.css("display", "none");
            }     
            base.queuedSamples = queuedSamples;
            base.queuedLabels = queuedLabels;       
        }
        
        
        /**
         * Set up cursor controls.
         */
        function _wireMouseControls() {
            var cursor = $.browser.opera ? "crosshair" : "none";
            base.$node
                .css("cursor", cursor)                
                .bind({
                    "mousemove.zig": _handleMouseMove 
                  , "mouseover.zig": _handleMouseOver
                  , "mouseout.zig":  _handleMouseOut                        
                });
            
            var handle;
            if ($.browser.mozilla && parseFloat($.browser.version.substr(0, 3)) * 10 >= 19) {
                handle = "DOMMouseScroll";
            }
            base.$node.get(0).addEventListener(handle || "mousewheel", _handleMousePan, false);
        }
        

        /**
         * Add a single graph container using either render path.
         */
        function _addGraphContainer(id) {
            base.graphContainer[id] = $("<ul>", {
                css: {
                    listStyle: "none"
                  , position: "absolute"
                  , zIndex: 1000 + base.planeIndex[id] 
                }
            }).appendTo(base.$node); 
        }


        /**
         * Append a <canvas> path segment to the given graph.
         */
        function _appendCanvasSegment(id, width, height) {
            var canvasSegment = $("<li>", {
                css: {
                    display: "inline-block"
                }
            }).appendTo(base.graphContainer[id]);
                
            var canvasElement = $("<canvas>").appendTo(canvasSegment)
                .attr({
                    width: width
                  , height: height
                });
                
            /* Anti-alias paths for odd line-widths. */
            // canvasElement.get(0).getContext("2d").translate(0.5, 0.5);
                
            if ($.prototype.zig.supportsPixelRetrieval) {
                var context = canvasElement.get(0).getContext("2d");                
                base.canvasSegmentContexts[id] 
                    && base.canvasSegmentContexts[id].push(context) 
                    || (base.canvasSegmentContexts[id] = [context]);
                 
                base.canvasSegmentWidths[id] 
                    && base.canvasSegmentWidths[id].push(width) 
                    || (base.canvasSegmentWidths[id] = [width]);
            }
                
            return canvasElement;                  
        }
        

        /**
         * Render a <canvas> path to the given graph segment.
         */
        function _renderPathCanvas(id, samples, continueFrom) {
            /* Basic parameters. */
            var count = samples.length,
                height = _getInnerHeight(),
                lineColor = base.config[id].lineColor,
                fillColor = base.config[id].fillColor; 
            
            /* Create new segment. */
            var canvasElement = _appendCanvasSegment(id, count * $.zig.constants.DIAGRAM_COLUMN_WIDTH, height),                                
                context = canvasElement.get(0).getContext("2d");
                
            /* Define styles. */    
            context.strokeStyle = lineColor;
            context.lineCap = "round";
            context.lineWidth = 2;

            _tracePathCanvas(context, samples, height, 0, continueFrom);

            context.stroke();
            
            /*
             * Fill the path shape if necessary.
             */
            if (fillColor != "none") {
                var offset =  (fillColor != lineColor) | 0;
                
                context.fillStyle = fillColor;
                
                /* Modify opacity only for foreground planes. */
                if (base.planeIndex[id]) {
                    context.globalAlpha = 0.8;    
                }

                context.beginPath();   
                
                _tracePathCanvas(context, samples, height, offset, continueFrom);
                                
                context.lineTo(count * $.zig.constants.DIAGRAM_COLUMN_WIDTH, height);
                context.lineTo(0, height);
                context.lineTo(0, height - samples[0] + offset);
                
                context.fill();
            }
        }
        
        
        /**
         * Trace a <canvas> path.
         */
        function _tracePathCanvas(context, samples, height, offset, continueFrom) {
            context.moveTo(0, height - continueFrom);    
                
            var columnWidth = $.zig.constants.DIAGRAM_COLUMN_WIDTH,
                s = 0, length = samples.length;
            do {
                /* Might trigger https://bugzilla.mozilla.org/show_bug.cgi?id=564332 */
                context.lineTo(s * columnWidth + columnWidth, height - samples[s] + offset);
            } while (++s < length);
        }
        
        
        /**
         * Render an HTML path to the given graph.
         */
        function _renderPathHtml(id, samples, continueFrom, startIndex) {
            if (base.config[id].fillColor != "none") {
                _traceFilledPathHtml(id, samples, continueFrom, startIndex);
            } else {
                _traceOutlinedPathHtml(id, samples, continueFrom, startIndex);
            }
        }
        
        
        /**
         * Trace an HTML path when a fill color has been specified.
         */
        function _traceFilledPathHtml(id, samples, continueFrom, startIndex) {
            var height = _getInnerHeight(),
                borderCss = "1px solid " + base.config[id].lineColor,
                backgroundColor = base.config[id].fillColor,
                widthBase = $.zig.constants.DIAGRAM_COLUMN_WIDTH, widthCurrent, 
                widthPreceding = base.lastElementWidth[id],
                currentValue, precedingValue,
                zIndexCurrent, zIndexPreceding = base.lastElementZIndex[id], 
                marginLeft, borderLeft, styles,
                s = 0, length = samples.length;
            do {
                currentValue = samples[s];
                widthCurrent = widthBase, marginLeft = false, borderLeft = false;
                
                if (s || startIndex) {
                    precedingValue = (!s && startIndex) ? continueFrom : samples[s - 1];
                                
                    zIndexCurrent = zIndexPreceding, marginLeft = (startIndex + s) * widthBase;
                
                    if (precedingValue < currentValue) {
                        base.lastElementAdded[id].css({
                            width: (widthPreceding + 2) + "px"
                          , borderRight: "none"
                        });
                            
                        widthCurrent -= 2;
                        zIndexCurrent--;
                        borderLeft = true;
                    } else if (precedingValue > currentValue) {
                        marginLeft--;
                        zIndexCurrent++;
                    } else {
                        base.lastElementAdded[id].css({
                            width: (widthPreceding + 1) + "px"
                          , borderRight: "none"
                        });
                        
                        widthCurrent--;
                    }           
                } else {
                    widthCurrent--;
                    zIndexCurrent = 1111;
                }
    
                styles = {
                         display: "inline-block"
                       , position: "absolute"
                       , height: currentValue + "px"
                       , marginTop: (height - currentValue - 1) + "px"
                       , backgroundColor: backgroundColor
                       , borderTop: borderCss
                       , borderRight: borderCss
                       , zIndex: zIndexCurrent
                       , width: widthCurrent + "px"
                    };
                marginLeft && (styles.marginLeft = marginLeft + "px");
                borderLeft && (styles.borderLeft = borderCss);
                base.lastElementAdded[id] = $("<li>", {
                    css: styles
                }).appendTo(base.graphContainer[id]);
                
                widthPreceding = widthCurrent;
                zIndexPreceding = zIndexCurrent;
            } while (++s < length);
            
            base.lastElementWidth[id] = widthPreceding;
            base.lastElementZIndex[id] = zIndexPreceding;
        }
        
        
        /**
         * Trace an HTML path when no fill color has been specified.
         */
        function _traceOutlinedPathHtml(id, samples, continueFrom, startIndex) {
            var height = _getInnerHeight() - 1,
                borderCss = "2px solid " + base.config[id].lineColor,
                widthBase = $.zig.constants.DIAGRAM_COLUMN_WIDTH, widthCurrent, widthPreceding,
                currentValue, precedingValue,
                borderTop, borderBottom, marginTopPreceding,
                s = 0, length = samples.length;
            do {
                currentValue = samples[s], precedingValue = (!s && startIndex) ? continueFrom : samples[s - 1];
                
                widthCurrent = widthBase; 
                            
                if (!(s || startIndex) || precedingValue == currentValue) {
                    widthCurrent++;
                } else {
                    if (precedingValue < currentValue) {
                        borderTop = "none";
                        borderBottom = borderCss;
                        widthPreceding = base.lastElementWidth[id] - 1;
                        marginTopPreceding = currentValue;
                    } else {
                        borderTop = borderCss;
                        borderBottom = "none";
                        widthPreceding = widthBase - 1;
                        marginTopPreceding = precedingValue;
                    }
                    
                    base.lastElementAdded[id].css({
                        borderTop: borderTop
                      , borderRight: borderCss
                      , borderBottom: borderBottom
                      , width: widthPreceding + "px"
                      , height: Math.abs(currentValue - precedingValue) + "px"
                      , marginTop: (height - marginTopPreceding) + "px"
                    });
                }  
                
                base.lastElementAdded[id] = $("<li>", {
                    css: {
                         display: "inline-block"
                       , position: "absolute"
                       , marginLeft: ((startIndex + s) * widthBase) + "px"
                       , marginTop: (height - currentValue) + "px"
                       , borderTop: borderCss
                       , width: widthCurrent + "px"
                    }
                }).appendTo(base.graphContainer[id]);
                
                base.lastElementWidth[id] = widthCurrent;
            } while (++s < length);
        }
        
                        
        /**
         * Apply background gradient if specified and supported, otherwise render a solid background fill.
         */
        function _renderBackground() {
            var needsBackground = true;
            if (base.options.canvasFillStyle == "gradient") {
                var template = null, property;
                
                if ($.browser.mozilla && $.browser.version.substr(0, 5).replace(/\./g, "") >= 192) {
                    property = "background";
                    template = "-moz-linear-gradient(top,{start},{stop})";
                } else if ($.browser.webkit) {
                    property = "background";
                    template = "-webkit-gradient(linear,left top,left bottom,from({start}),to({stop}))";
                } else if ($.browser.msie) {
                    property = "-ms-filter";
                    template = "progid:DXImageTransform.Microsoft.gradient(startColorstr='{start}',endColorstr='{stop}')";
                } else if ($.browser.opera && $.browser.version.replace(/\./g, "") >= 1110) {
                    property = "background";
                    template = "-o-linear-gradient(top,{start},{stop})";
                }
                
                if (template != null) {   
                    needsBackground = false;             
                    base.$node.css(property, _replaceTags(template, {
                            start: base.options.canvasGradientStart, stop: base.options.canvasGradientStop 
                        }));
                }
            } 
            needsBackground && base.$node.css("background-color", base.options.canvasColor);
        }
        
        
        /**
         * Render the ceiling text element.
         */
        function _renderCeilingText() {
            base.ceilingText = $("<span>", {
                css: {
                    position: "absolute"
                  , left: "2px"
                  , top: "2px"
                  , font: $.zig.constants.FONT
                  , color: base.options.scaleColor
                  , zIndex: 1900
                  , "-moz-user-select": "-moz-none"
                  , "-webkit-user-select": "none"
                  , "-o-user-select": "none"
                  , "user-select": "none"
                },
                unselectable: "on"
            }).appendTo(base.$node);
        }
        
        
        /**
         * Render the cursor elements (and coordinate readings if specified).
         */
        function _renderCursorControls(invisible) {
            _renderCrosshairCursor(invisible);    
            
            base.options.showCoordinates && _renderCoordinates(invisible);   
        }
                
        
        /**
         * Render the vertical grid pattern.
         */
        function _renderVerticalGrid() {
            /* Correct invalid grid count. */
            if ((base.options.verticalGridSegments | 0) < 2) {
                base.options.verticalGridSegments = 2;
            }
            
            base.$node.find(".zig-vertical-grid").remove(); 
            
            var height = _getInnerHeight(),
                style = base.options.verticalGridLineStyle,
                opacity = base.options.verticalGridOpacity,
                segments = base.options.verticalGridSegments,
                even = segments % 2 == 0;

            if (even) {
                $("<div>", {
                    "class": "zig-vertical-grid"
                  , css: {
                        position: "absolute"
                      , width: base.options.width + "px"
                      , height: Math.round(height / 2) + "px"
                      , borderBottom: style
                      , opacity: opacity
                      , zIndex: 1500
                    }
                }).appendTo(base.$node);
            }
                            
            var tiles = even ? segments / 2 - 1 : Math.floor(segments / 2),
                g = -1;  
            while (++g < tiles) {
                $("<div>", {
                    "class": "zig-vertical-grid"
                  , css: {
                        position: "absolute"
                      , width: base.options.width + "px"
                      , height: (Math.floor(height * (even ? segments - (g + 1) * 2 : g * 2 + 1) / segments) - 1) + "px"
                      , marginTop: Math.round(height * (even ? g + 1 : tiles - g) / segments) + "px"
                      , borderTop: style
                      , borderBottom: style
                      , opacity: opacity
                      , zIndex: 1500
                    }
                }).appendTo(base.$node);            
            }
        }
        
        
        /**
         * Render a crosshair cursor.
         */
        function _renderCrosshairCursor(invisible) {
            if (base.cursors != null) {
                base.cursors.remove();
            }
            
            var commonStyles = {
                position: "absolute"
              , zIndex: 2000
            };            
            if (!!invisible) {
                commonStyles["display"] = "none";
            }
            
            base.horizontalCrosshairCursor = $("<div>", {
                css: $.extend({
                    width: 0
                  , height: _getInnerHeight() + "px"
                  , borderRight: "1px solid " + base.options.crosshairColor
                }, commonStyles)
            }).appendTo(base.$node);
            
            base.verticalCrosshairCursor = $("<div>", {
                css: $.extend({
                    width: base.options.width + "px"
                  , height: 0
                  , borderBottom: "1px solid " + base.options.crosshairColor
                }, commonStyles)
            }).appendTo(base.$node);
            
            base.cursors = base.horizontalCrosshairCursor.add(
                base.verticalCrosshairCursor
            );
        }
        
        
        /**
         * Render coordinate readings.
         */
        function _renderCoordinates(invisible) {
            if (base.coordinates != null) {
                base.coordinates.remove();
            }
            
            var commonStyles = {
                position: "absolute"
              , zIndex: 2000
              , font: $.zig.constants.FONT
              , color: base.options.coordinatesColor
              , lineHeight: $.zig.constants.TEXT_LINE_HEIGHT + "px"
              , "-moz-user-select": "-moz-none"
              , "-webkit-user-select": "none"
              , "-o-user-select": "none"
              , "user-select": "none"
            };            
            if (!!invisible) {
                commonStyles.display = "none";
            }
            
            base.horizontalCoordinate = $("<div>", {
                css: $.extend({
                    marginTop: (_getInnerHeight() - $.zig.constants.TEXT_LINE_HEIGHT - 2) + "px"
                }, commonStyles)
              , unselectable: "on"
            }).appendTo(base.$node);

            base.verticalCoordinate = $("<div>", {
                css: $.extend({
                    textAlign: "right"
                  , width: base.options.width + "px"
                }, commonStyles)
              , unselectable: "on"
            }).appendTo(base.$node);
            
            base.coordinates = base.horizontalCoordinate.add(base.verticalCoordinate);
        }
        
        
        /**
         * Update coordinate readings.
         */
        function _updateCoordinate(value, axis) {
            var lineHeight = $.zig.constants.TEXT_LINE_HEIGHT;
            
            if (axis == "vertical") {
                if (base.horizontalReadingMode) {
                    return;
                }
                
                var height = _getInnerHeight(),
                    top = value,
                    displayValue = Math.round((height - value) / height * base.maxCeiling);

                if (base.maxCeiling / base.options.height > 2) {
                    displayValue = Math.round(displayValue / 10) * 10;
                }
                
                if (value > Math.ceil(height * 0.5)) {
                    top -= lineHeight;
                }

                base.verticalCoordinate
                    .css({
                        display: "block"
                      , marginTop: top + "px"
                    })
                    .text(displayValue + " " + base.options.unit);
            } else {
                /* Needed for mouse pans. */
                base.lastHorizontalX = value;
                
                var element = base.horizontalCoordinate,
                    currentOrientation = value < Math.ceil(base.options.width * 0.5),
                    styles = {};
                                    
                if (currentOrientation != base.horizontalOrientation) {
                    base.horizontalOrientation = currentOrientation;
                    
                    styles.textAlign = currentOrientation ? "left" : "right";
                    if (!currentOrientation) {
                        styles.marginLeft = 0;
                    }
                }
                if (currentOrientation) {
                    styles.marginLeft = (value + 4) + "px";
                    styles.width = (base.options.width - value - 4) + "px";
                } else {
                    styles.width = (value - 2) + "px";
                }
                
                if (base.horizontalReadingMode && !base.isOnPath) {
                    base.horizontalReadingMode = false;
                    
                    styles.marginTop = (_getInnerHeight() - lineHeight - 2) + "px";
                    styles.lineHeight = lineHeight + "px";        
                } 
                
                /* Update horizontal coordinate. */
                element.css(styles);

                /*
                 * Render label if set, otherwise render the sample's index.
                 */ 
                if (!base.isOnPath) {
                    var sample = Math.floor((value + base.scrollPosition) / $.zig.constants.DIAGRAM_COLUMN_WIDTH);
                    element.text(
                        !!base.sampleLabels[sample] ? base.sampleLabels[sample] : sample + 1
                    );
                }
            }
        }
        
        
        /**
         * Update sample readings.
         */
        function _showSampleReadings(x, ids) {
            var element = base.horizontalCoordinate,
                sample = Math.floor(x / $.zig.constants.DIAGRAM_COLUMN_WIDTH),
                sorted;
             
            if (ids.length == 1) {
                sorted = ids;
            } else if (ids.length == 2) {
                if (base.rawSamples[ids[0]][sample] > base.rawSamples[ids[1]][sample]) {
                    sorted = [ids[1], ids[0]];
                } else {
                    sorted = ids;
                }
            } else {
                var samples = [], i = 0, id;
                do {
                    id = ids[i];
                    samples.push(base.rawSamples[id][sample]);
                } while (++i < ids.length);
                
                samples.sort();
                
                var s = 0, sorted = [];
                do {
                    var value = samples[s];
                    for (var t = 0; t < ids.length; t++) {
                        if (base.rawSamples[ids[t]][sample] == value) {
                            sorted.push(ids[t]);
                        }
                    }
                } while (++s < samples.length);
            }
            
            base.horizontalReadingMode = true;
            base.verticalCoordinate.css("display", "none");
           
            element.empty();
           
            var d = ids.length - 1, buffer = [], id;
            do {
                id = sorted[d];
                if (!(id in base.sampleReadings)) {
                    base.sampleReadings[id] = $("<span>", {
                        css: {
                            border: "1px solid " + (base.config[id].highlightBorderColor || base.config[id].lineColor) 
                          , borderTopWidth: "3px"
                          , padding: "2px"
                          , color: base.config[id].highlightTextColor || base.options.coordinatesColor
                          , backgroundColor: base.config[id].highlightBackgroundColor || base.options.canvasColor
                          , "-moz-user-select": "-moz-none"
                          , "-webkit-user-select": "none"
                          , "-o-user-select": "none"
                          , "user-select": "none"
                        } 
                      , unselectable: "on"
                    });
                }                
                base.sampleReadings[id].text(
                    base.rawSamples[id][sample] + " " + base.options.unit
                ).appendTo(element);
                
               $("<br>").appendTo(element); 
            } while (d--);
            
            var height = $.zig.constants.TEXT_LINE_HEIGHT + 1 + 2 + 2 + 3 + 4;
            element.css({
                marginTop: (_getInnerHeight() - height * ids.length) + "px"
              , lineHeight: height + "px"
            });
        }
        
        
        /**
         * Render the scrollbar track and scroller elements.
         */
        function _renderScrollbar() {
            var trackStyle = {
                position: "absolute"
              , height: base.options.scrollbarHeight + "px"
              , backgroundColor: "#fff"                    
              , padding: "1px"
              , cursor: "pointer"
            };
            
            if (base.options.borderColor == "transparent") {
                base.scrollbarBorderTransparent = true;
                base.maxScrollerWidth = base.options.width;

                $.extend(trackStyle, {
                    width: base.options.width + "px"
                  , paddingLeft: "0"
                  , marginTop: (base.options.height - base.options.scrollbarHeight + 2 
                                    - $.zig.constants.SCROLLBAR_HEIGHT_BASE) + "px"
                  , padding: "1px 1px 0 1px"
                });
            } else {
                base.scrollbarBorderTransparent = false;
                base.maxScrollerWidth = base.options.width - 2;
                
                $.extend(trackStyle, {
                    width: (base.options.width - 2) + "px"
                  , marginTop: (base.options.height - base.options.scrollbarHeight 
                                    - $.zig.constants.SCROLLBAR_HEIGHT_BASE) + "px"
                  , borderTop: "1px solid " + base.options.borderColor
                  , borderRight: "1px solid " + base.options.borderColor
                });                
            }
            
            base.scrollbarTrack = $("<div>", {
                css: trackStyle
            }).appendTo(base.$node);
            
            base.scrollbarScroller = $("<span>", {
                "class": "zig-scrollbar-scroller"
              , css: {
                    display: "inline-block"
                  , position: "absolute"
                  , height: base.options.scrollbarHeight + "px"
                  , backgroundColor: base.options.scrollbarColor
                  , cursor: "pointer"
                }
              , data: {
                  "backref.zig": base 
              }
            }).appendTo(base.scrollbarTrack);
            
            /* 
             * Bind mouse down/up events only once for all instances.
             */
            if (!$.prototype.zig.hasMouseEventsBound) {
                $.prototype.zig.hasMouseEventsBound = true;
                
                $(document).bind({
                    "mousedown.zig": function (event) {
                        if (event.which != 1) {
                            return;
                        } else if (event.target.nodeType == 1 && event.target.getAttribute("class") == "zig-scrollbar-scroller") {
                            var handle = $(event.target).data("backref.zig");
                            
                            handle.isScrolling = true;
                            handle.scrollStartX = event.pageX;
                            
                            /* Prevent the default drag operation. */
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    }
        
                  , "mouseup.zig": function (event) {
                        if (event.which != 1) {
                            return;
                        } else if (event.target.nodeType == 1 && event.target.getAttribute("class") == "zig-scrollbar-scroller") {
                            var handle = $(event.target).data("backref.zig");
                            
                            handle.isScrolling = false;        

                            /* Constrain and save scroller position. */
                            handle.scrollPosition = Math.min(handle.scrollMax,
                                Math.max(0, handle.scrollPosition - handle.lastScrollDiff)
                            );
                        }
                    }
                });    
            }        
        }
        
        
        /**
         * Scroll all graphs to the given relative position.
         */
        function _scrollChartTo(percentage, needsRedraw) {
            /* Update edges of chart to indicate excess content. */
            if (!base.scrollbarBorderTransparent && base.hasScrollbar) {            
                base.$node.css({
                    borderLeftStyle: (percentage == 0) ? "solid" : "dashed"
                  , borderRightStyle: (percentage == 100) ? "solid" : "dashed"
                });            
            }

            /*
             * Update clipping.
             */
            var chartWidth = base.sampleCountMax * $.zig.constants.DIAGRAM_COLUMN_WIDTH,
                scrollableExcess = chartWidth - base.options.width,
                scrollPosition = Math.round(scrollableExcess / 100 * percentage),
                left = base.graphClipOffset + scrollPosition,
                styles = {
                    clip: "rect("
                        + "0px" 
                        + " " + (base.options.width + left) + "px" 
                        + " " + _getInnerHeight() + "px" 
                        + " " + left + "px"
                    + ")"
                  , marginLeft: "-" + left + "px"
                },
                containers = base.graphContainer, ids = base.graphIds,
                counter = base.graphCount;
            while (counter--) {
                containers[ids[counter]].css(styles);
            }
            
            /*
             * Redraw track and scroller.
             */
            if (needsRedraw) {
                base.scrollerWidth = base.options.width / chartWidth * base.maxScrollerWidth;
                base.scrollRatio = chartWidth / base.options.width;
                
                /* Update scroller position and dimensions. */
                base.scrollbarScroller.css({
                    width: Math.round(base.scrollerWidth) + "px"
                  , marginLeft: _getScrollerPosition(percentage) + "px"
                });

                /* Indicate max scroll position. */                                
                base.scrollMax = scrollableExcess;
                
                /* Default scroll position is at the right edge of the chart. */
                base.scrollPosition = scrollableExcess;
            }
        }


        /**
         * Update cursor and scrolling via mouse moves.
         */
        function _handleMouseMove(event) {
            /* Needed for on-the-fly switching of cursor type. */
            base.lastPageX = event.pageX;
            base.lastPageY = event.pageY;
            
            if (base.isScrolling) {                
                var scrollDiff = base.scrollStartX - event.pageX;
                
                if (scrollDiff == 0) {
                    return;
                } else {
                    base.lastScrollDiff = scrollDiff * base.scrollRatio;
                    
                    var targetPosition = base.scrollPosition - base.lastScrollDiff;
                                               
                    /* Constrain scroller position. */
                    targetPosition = Math.min(Math.max(0, targetPosition), base.scrollMax);
                    
                    /* Determine scroll offset. */
                    var percentage = targetPosition / base.scrollMax * 100;
                   
                    /* Update scroller position. */
                    base.scrollbarScroller.css("margin-left", _getScrollerPosition(percentage) + "px");
            
                    /* Update canvas scroll position. */
                    _scrollChartTo(percentage, false);   
                    
                    /*
                     * Update scroll position in synchronized charts.
                     */
                    var counter = base.synchronizedTo.length;
                    while (counter--) { 
                        base.synchronizedTo[counter].scrollTo(percentage);
                    }
                }                
            } else {   
                var offset = base.$node.offset(),
                    height = _getInnerHeight(),
                    x = Math.floor(event.pageX - offset.left),
                    y = Math.floor(event.pageY - offset.top);

                /* Compensate for Opera's hotspot offsets. */    
                if ($.browser.opera) {
                    x--, y--;
                }
                    
                if (x >= base.options.width || y >= height) {
                    /*
                     * Hide coordinate readings.
                     */
                    base.cursors.css("display", "none");
                    base.options.showCoordinates && base.coordinates.css("display", "none");
                    
                    /* 
                     * Reset graph opacity.
                     */                         
                    var containers = base.graphContainer, ids = base.graphIds,  
                        counter = base.graphCount;
                    while (counter--) {
                        containers[ids[counter]].css("opacity", 1);
                    }
                    
                    /*
                     * Hide shadow cursor in synchronized charts.
                     */
                    var counter = base.synchronizedTo.length;
                    while (counter--) { 
                        base.synchronizedTo[counter].hideCursor();
                    }
                } else {
                    _doGraphHighlight(x + base.scrollPosition, y);
                    
                    base.horizontalCrosshairCursor.css({
                        display: "block"
                      , paddingLeft: x + "px"
                    });
                    base.verticalCrosshairCursor.css({
                        display: "block"
                      , paddingTop: y + "px"
                    });
                    
                    if (base.options.showCoordinates) {
                        _updateCoordinate(x, "horizontal");
                        _updateCoordinate(y, "vertical");
                    }
                    
                    /*
                     * Update shadow cursor in synchronized charts.
                     */
                    var counter = base.synchronizedTo.length, handle;
                    while (counter--) { 
                        handle = base.synchronizedTo[counter];

                        handle.enableShadowCrosshair();
                        handle.moveCrosshairTo(x, y);    
                    }
                }                  
            }
        } 
        
        
        /**
         * Update cursor and scrolling via mouse-wheel or trackpad movement.
         */
        function _handleMousePan(event) {
            if (!base.hasScrollbar) {
                return;
            }
            
            event = event || window.event;

            /*
             * Use heuristic to normalize pan distance.
             */
            if ($.browser.mozilla && "HORIZONTAL_AXIS" in event) {
                var delta = event.detail / 3 * 12;
            } else if ($.browser.webkit && "wheelDeltaX" in event) {
                var deltaX = event.wheelDeltaX / -120,
                    deltaY = event.wheelDeltaY / -120,
                    delta = deltaX || deltaY;
                if (/chrome/i.test(navigator.userAgent)) {
                    delta *= 40;
                }
            } else if ($.browser.opera && "wheelDelta" in event) {
                var delta = event.wheelDelta / -12;
            } else {
                return;
            }
            
            if (delta) {
                var columnWidth = $.zig.constants.DIAGRAM_COLUMN_WIDTH,
                    targetPosition = base.scrollPosition + Math.ceil(delta);
                            
                /* Constrain scroller position. */
                targetPosition = Math.min(Math.max(0, targetPosition), base.scrollMax);
                
                base.scrollPosition = targetPosition;
                
                var x = base.lastHorizontalX,
                    sample = Math.floor((x - x % columnWidth + base.scrollPosition) / columnWidth);

                base.options.showCoordinates && base.horizontalCoordinate.text(
                    !!base.sampleLabels[sample] ? base.sampleLabels[sample] : sample + 1
                );
                                
                /* Determine scroll offset. */
                var percentage = targetPosition / base.scrollMax * 100;
               
                /* Update scroller position. */
                base.scrollbarScroller.css("margin-left", _getScrollerPosition(percentage) + "px");
        
                /* Update canvas scroll position. */
                _scrollChartTo(percentage, false);
                
                /*
                 * Synchronize scroll position and sample index reading.
                 */
                var counter = base.synchronizedTo.length, handle;
                while (counter--) { 
                    handle = base.synchronizedTo[counter];
                    
                    handle.scrollTo(percentage); 
                    handle.options.showCoordinates && handle.horizontalCoordinate.text(
                        Math.floor((handle.lastHorizontalX + handle.scrollPosition) / columnWidth) + 1
                    );                        
                }
                
                /* Prevent the default scroll operation. */
                event.preventDefault();
                event.stopPropagation();
            }            
        }
        
        
        /**
         * Handle the mouse entering the chart.
         */
        function _handleMouseOver(event) {
            if (!base.isScrolling) {
                base.cursors && base.cursors.css("display", "block");
                base.options.showCoordinates && base.coordinates.css("display", "block");
            }
        }
        
        
        /**
         * Handle the mouse leaving the chart.
         */
        function _handleMouseOut(event) {
            if (base.isScrolling) {
                return;
            }
            
            /* Check that mouse cursor actually left the canvas. */
            if (!!event && $(event.relatedTarget).closest("#" + base.id).size()) {
                return;
            }

            /* Reset cursor and coordinates state. */
            base.cursors && base.cursors.css("display", "none");
            if (base.options.showCoordinates) {
                base.isOnPath = false;
                base.horizontalReadingMode = false;
                base.coordinates.css("display", "none");
            }
                         
            /* Reset graph opacity. */                         
            var containers = base.graphContainer, ids = base.graphIds,  
                counter = base.graphCount;
            while (counter--) {
                containers[ids[counter]].css("opacity", 1);
            }
        
            /*
             * Hide cursor in synchronized charts.
             */
            var counter = base.synchronizedTo.length, handle;
            while (counter--) { 
                handle = base.synchronizedTo[counter];
                
                handle.hideCursor();
                handle.disableShadowCrosshair();
            }
        }    
        
        
        /**
         * Update sample readings.
         */
        function _doGraphHighlight(x, y) {
            var innerHeight = _getInnerHeight();
            
            /* Check if cursor left the canvas. */
            if (x >= base.options.width + base.scrollPosition || y >= innerHeight) {
                base.isOnPath = false;
                return;
            }
            
            var absY = innerHeight - y,
                scaleFactor = base.maxCeiling / innerHeight,
                value = absY * scaleFactor,
                lowerBoundary = (absY - 6) * scaleFactor,
                upperBoundary = (absY + 6) * scaleFactor,
                index = Math.floor(x / $.zig.constants.DIAGRAM_COLUMN_WIDTH),
                rawSamples = base.rawSamples, sample, current,
                idSet = base.graphIds, containers = base.graphContainer,
                targetOpacity = {}, highlightSet = [], isTracking = false,
                length = base.graphCount,
                supportsPixelRetrieval = base.options.defaultRenderPath == "auto" && $.prototype.zig.supportsPixelRetrieval,
                highestPlane = -1,
                id, hit, reading, d = 0; 
                
            do {   
                id = idSet[d], sample = rawSamples[id];
                
                /* In case this graph does not exist on chart. */
                if (!sample || containers[id].css("visibility") == "hidden") continue;
                
                current = sample[index]; 
                if (base.hasFilledPaths) {
                    hit = current >= value;
                } else {
                    hit = (current >= lowerBoundary && current <= upperBoundary
                            || current <= value && sample[index + 1] >= value);
                }
                
                if (!hit && supportsPixelRetrieval && id in base.canvasSegmentWidths) {
                    var segmentWidths = base.canvasSegmentWidths[id], segments = segmentWidths.length, segmentWidth,
                        contexts = base.canvasSegmentContexts[id],
                        position = 0, s = -1;
                    while (++s < segments) {
                        segmentWidth = segmentWidths[s];
                        if (x + base.graphClipOffset < position + segmentWidth) {
                            /* Correct x-position relative to segment offset and canvas clip-offset. */
                            reading = contexts[s].getImageData(x + base.graphClipOffset - (s ? position : 0), y, 1, 1).data;
                            hit = reading[0] || reading[1] || reading[2];
                            break;
                        } else {
                            position += segmentWidth;
                        }
                    }
                }
                
                if (hit) {
                    isTracking = true;
                    
                    targetOpacity[id] = 1;
                    highlightSet.push(id);
                
                    highestPlane = Math.max(base.planeIndex[id], highestPlane);
                } else if (!(id in targetOpacity)) {
                    targetOpacity[id] = 0.2;
                }
            } while (++d < length);
            
            if (isTracking || base.isOnPath) {
                var restore = !isTracking && base.isOnPath, 
                    counter = base.graphCount, graph;
                while (counter--) {
                    graph = base.graphIds[counter];
                
                    containers[graph].css("opacity", restore ? 1 : base.hasFilledPaths && base.planeIndex[graph] < highestPlane ? 0.2 : targetOpacity[graph]);
                 }
                 
                 (base.options.showCoordinates && highlightSet.length) && _showSampleReadings(x, highlightSet);
            }
            
            base.isOnPath = isTracking;    
        }
        
        
        /**
         * Redraw all graphs in the chart and reset scroll state.
         */
        function _redrawChart(rescale) {
            base.graphClipOffset = 0;
            
            var isCanvas = $.prototype.zig.supportsCanvas && base.options.defaultRenderPath == "auto"; 
            
            /* Re-init ... */
            if (isCanvas) {
                base.canvasSegmentContexts = {};
                base.canvasSegmentWidths = {};
            }
            
            if (rescale) {
                var scaleFactor = _getInnerHeight() / base.maxCeiling;
            }
            
            var counter = base.graphCount, id;
            while (counter--) {
                id = base.graphIds[counter];
                
                if (base.rawSamples[id].length) {
                    if (isCanvas) {
                        base.graphContainer[id].css({
                            clip: "auto"
                          , marginLeft: 0
                        });
                    }
                    base.graphContainer[id].find("li").remove();

                    if (rescale) {
                        base.scaledSamples[id] = [];
                        var rawSamples = base.rawSamples[id], 
                            sampleCount = rawSamples.length, s = 0; 
                        do {
                            base.scaledSamples[id].push(Math.floor(rawSamples[s] * scaleFactor));
                        } while (++s < sampleCount);
                    }
                    
                    _functorRenderPath(id, base.scaledSamples[id], base.scaledSamples[id][0], 0);
                }                    
            }
        }
        

        /**
         * Return the usable inner height of the chart.
         */
        function _getInnerHeight() {
            var height = base.options.height;
            if (base.hasScrollbar) {
                height -= base.options.scrollbarHeight + $.zig.constants.SCROLLBAR_HEIGHT_BASE;
                if (base.scrollbarBorderTransparent) {
                    height += 2;
                }
            }
            return height;
        }
        
        
        /**
         * Return the scroller position within the scrollbar track.
         */
        function _getScrollerPosition(percentage) {
            return Math.round((base.maxScrollerWidth - base.scrollerWidth) * percentage / 100);
        }
                                

        /**
         * Return the safe ceiling for a given value.
         */
        function _getCeiling(value) {
            if (value < Math.pow(10, 2)) {
                return 10 * (Math.round(value * 1.05 / 10) + 1);
            } else {
                var factor = Math.pow(10, String(value).length - 1);
                return factor * Math.ceil(value * 1.05 / factor);
            }
        }
        
        
        /**
         * Return the maximum number of added samples across all graphs.
         */
        function _getMaxSampleCount() {
            var samples = [], rawSamples = base.rawSamples, ids = base.graphIds,
                counter = base.graphCount;
            while (counter--) {
                samples.push(rawSamples[ids[counter]].length);
            };
            return Math.max.apply(Math, samples);
        }
        
                        
        /**
         * Poor man's template engine.
         */                        
        function _replaceTags(template, tags) {
            for (var tag in tags) {
                template = template.replace(new RegExp("{" + tag + "}", "g"), tags[tag]);
            }
            return template;
        }   
                  

        /**
         * Remove scrollbar chrome.
         */                  
        function _removeScrollbar() {
            base.hasScrollbar = false;
            base.scrollbarTrack.remove();
            if (!base.scrollbarBorderTransparent) {            
                base.$node.css({
                    borderLeftStyle: "solid"
                  , borderRightStyle: "solid"
                });            
            }
            
            base.options.showVerticalGrid && _renderVerticalGrid();

            _renderCursorControls(true);
        }                             
        
        
        /**
         * Add, rescale and render sample data to the given graph.
         */   
        function _addSamples(id, samples, labels) {
            if (!$.isArray(samples)) {
                samples = [samples];
            }
            if ($.grep(samples, function (element) { return $.type(element) != "number"; }).length) {
                throw "Must only add numbers as sample values."
            }
            
            var sampleCount = base.rawSamples[id].length,
                addCount = samples.length,
                continueIndex = sampleCount - 1,
                needsRedraw = false, hasOverflow = false;

            /*
             * ...
             */
            if (sampleCount + addCount > base.maxSamples) {
                if (base.options.overflow == "clip") {
                    if (addCount > base.maxSamples) {
                        samples = samples.slice(addCount - base.maxSamples);
                        addCount = samples.length;                  
                    }
                    
                    if (sampleCount) {
                        var skip = sampleCount + addCount - base.maxSamples;
                        
                        base.graphClipOffset += skip * $.zig.constants.DIAGRAM_COLUMN_WIDTH;

                        /* 
                         * Shave off leading elements across all paths.
                         */
                        var counter = base.graphCount, graph;            
                        while (counter--) {
                            graph = base.graphIds[counter];
                            base.rawSamples[graph] = base.rawSamples[graph].slice(skip);
                            base.scaledSamples[graph] = base.scaledSamples[graph].slice(skip);
                        }          
                        
                        sampleCount = base.rawSamples[id].length;
                        
                        hasOverflow = true;
                                                
                        continueIndex -= addCount;
                    }
                } else if (base.options.overflow == "scroll" && !base.hasScrollbar) {
                    base.hasScrollbar = true;
                    base.options.showVerticalGrid && _renderVerticalGrid();
                    _renderScrollbar();
                    _renderCursorControls(true);
                }
            }            

            /*
             * Adjust max ceiling.
             */
            var ceiling = _getCeiling(Math.max.apply(Math, samples));     
            if (ceiling > base.maxCeiling) {
                base.maxCeiling = ceiling;

                if (base.options.overflow == "scroll" && (sampleCount + addCount <= base.maxSamples || base.hasScrollbar)) {
                    /* Only rescale now when no overflow occurs. */
                    _redrawChart(true);
                } else if (base.options.overflow == "clip" && hasOverflow) {
                    needsRedraw = true;
                }
            }
            
            /* Update ceiling text in any case. */
            base.ceilingText.text(base.maxCeiling + " " + base.options.unit);
            
            /* Append raw sample value(s). */
            base.rawSamples[id].push.apply(base.rawSamples[id], samples);
                
            /* 
             * Scale samples if necessary, and render graph.
             */                             
            if (needsRedraw) {
                _redrawChart(true);
            } else {
                var scaledSamples = base.scaledSamples[id],                
                    scaleFactor = _getInnerHeight() / base.maxCeiling,
                    buffer = [], s = 0;
                do {
                    buffer.push(Math.floor(samples[s] * scaleFactor));
                } while (++s < addCount);            
                base.scaledSamples[id] = scaledSamples.concat(buffer);               

                _functorRenderPath(id, buffer, base.scaledSamples[id][Math.max(continueIndex, 0)], sampleCount);    
            }  
            
            /*
             * Assign labels to samples.
             */
            if ($.isArray(labels) && labels.length) {
                var s = 0;
                do {
                    base.sampleLabels[sampleCount + s] = labels[s];    
                } while (++s < labels.length);
            }
            
            /* Determine sample count over all graphs, and scroll to the right edge. */
            base.sampleCountMax = _getMaxSampleCount();
            if (base.hasScrollbar) {
                _scrollChartTo(100, true);
            } else if (base.graphClipOffset) {
                var styles = {
                        clip: "rect("
                                + "0px" 
                                + " " + (base.options.width + base.graphClipOffset) + "px" 
                                + " " + _getInnerHeight() + "px" 
                                + " " + base.graphClipOffset + "px"
                            + ")"
                      , marginLeft: "-" + base.graphClipOffset + "px"
                    },
                    counter = base.graphCount;
                while (counter--) {
                    base.graphContainer[base.graphIds[counter]].css(styles);
                }
            }           
        }   
        
        
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //                                                                                                            //
        // PUBLIC API                                                                                                 //
        //                                                                                                            //
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
             
                     
        /**
         * Add, rescale and render sample data to the given graph.
         */
        base.addSamples = function (id, samples, labels) {
            if (base.queuedSamples != null) {
                samples = base.queuedSamples;
                labels = base.queuedLabels;  
                base.queuedSamples = base.queuedLabels = null;
            } else if ($.type(id) == "number" || $.isArray(id)) {
                if (base.defaultGraph != null) {
                    labels = samples;
                    samples = id;
                    id = base.defaultGraph;
                } else {
                    throw "Must specify a valid diagram ID as first parameter.";
                }
            } else if ($.type(id) == "object") {
                labels = samples;
                samples = id;
            } else if (!(id in base.rawSamples)) {
                throw "Unknown diagram with this ID: " + id;
            }
            
            if ($.type(samples) == "object") {
                for (var set in samples) {
                    if (samples.hasOwnProperty(set)) {
                        _addSamples(set, samples[set], labels[set]);
                    }
                }    
            } else {
                _addSamples(id, samples, labels);
            }
        };
        
        
        /**
         * Force redraw of all graphs in this chart.
         */
        base.redraw = function () {
            _redrawChart(false);
            
            base.hasScrollbar && _scrollChartTo(100, true);
        };

        
        /**
         * Purge the specified graph, and reset sample data for that graph.
         */
        base.purge = function (id) {
            if (!(id in base.config)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                base.graphContainer[id].find("li").remove();
                
                /* Re-init <canvas> segments. */
                if ($.prototype.zig.supportsCanvas && base.options.defaultRenderPath == "auto") {
                    delete base.canvasSegmentContexts[id];
                    delete base.canvasSegmentWidths[id];
                }
                
                base.rawSamples[id] = [];
                base.scaledSamples[id] = [];
          
                base.sampleCountMax = _getMaxSampleCount();
                
                if (base.graphCount == 1 || !base.sampleCountMax) {
                    base.graphClipOffset = 0;
                    base.sampleLabels = [];
                    
                    if (base.options.overflow == "scroll" && base.hasScrollbar) {
                        _removeScrollbar();
                    }
                    
                    base.ceilingText.text("");
                }
            }
        };


        /**
         * Purge all graphs in this chart.
         */
        base.purgeAll = function () {
            var containers = base.graphContainer, ids = base.graphIds,
                counter = base.graphCount;
            while (counter--) {
                containers[ids[counter]].find("li").remove();
            }
            
            /* Re-init <canvas> segments. */
            if ($.prototype.zig.supportsCanvas && base.options.defaultRenderPath == "auto") {
                base.canvasSegmentContexts = {};
                base.canvasSegmentWidths = {};
            }
            
            base.rawSamples = {};
            base.scaledSamples = {};
      
            base.sampleCountMax = 0;
            
            base.graphClipOffset = 0;
            base.sampleLabels = [];
            
            if (base.options.overflow == "scroll" && base.hasScrollbar) {
                _removeScrollbar();
            }
            
            base.ceilingText.text("");
        };
        
        
        /**
         * Hide a given graph.
         */
        base.hideGraph = function (id) {
            if (!(id in base.config)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                base.graphContainer[id].css("visibility", "hidden");
            }
        };
        
        
        /**
         * Unhide a given graph.
         */
        base.unhideGraph = base.showGraph = function (id) {
            if (!(id in base.config)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                base.graphContainer[id].css("visibility", "visible");
            }
        };


        /**
         * Hide the vertical grid.
         */
        base.hideVerticalGrid = function () {
            base.$node.find(".zig-vertical-grid").css("visibility", "hidden");
        };
        
        
        /**
         * Unhide the vertical grid.
         */
        base.unhideVerticalGrid = base.showVerticalGrid = function () {
            base.$node.find(".zig-vertical-grid").css("visibility", "visible");
        };
        
        
        /**
         * Synchronize this chart to all jquery-zig charts specified by the given selector.
         */
        base.synchronize = function (selector) {
            $(selector).each(function (index, element) {
                var handle = $(this).data("plugin.zig");
                if (!!handle) {
                    base.synchronizedTo.push(handle);
                    handle.synchronizedTo.push(base);
                }
            });
        };
        
        
        /**
         * Scroll all graphs to the given relative position.
         */
        base.scrollTo = function (percentage) {
            if (!$.type(percentage) == "number") {
                throw "Must specify a percentage as first parameter.";
            }
            
            /* Update canvas scroll position. */
            _scrollChartTo(percentage, false);    
            
            /* Update scroller position. */
            base.hasScrollbar && base.scrollbarScroller.css("margin-left", _getScrollerPosition(percentage) + "px");
            
            /* Update internal scroll position marker. */
            base.scrollPosition = Math.round(base.scrollMax * percentage / 100);
        };


        /**
         * Programmatically move the cursor (not the mouse pointer) to the given coordinates within the chart.
         * Coordinates are relative to the top-left corner, in pixels.
         */
        base.moveCrosshairTo = function (x, y) {
            if ($.type(x) != "number" || $.type(y) != "number") {
                throw "Must specify valid x and y coordinates.";
            }
            
            /* Update cursor position. */
            base.cursors.css("display", "block");
            base.horizontalCrosshairCursor.css("padding-left", x + "px");
            base.verticalCrosshairCursor.css("padding-top", y + "px");
            
            /* Update coordinates. */
            if (base.options.showCoordinates) {
                base.coordinates.css("display", "block");
                _updateCoordinate(x, "horizontal");
                _updateCoordinate(y, "vertical");
            }            
        };    
        
        
        /**
         * Hide the cursor.
         */
        base.hideCursor = function () {
            base.cursors.css("display", "none");
            base.options.showCoordinates && base.coordinates.css("display", "none");
        };
        
        
        /**
         * Turn on the shadow cursor in a synchronized chart. 
         */
        base.enableShadowCrosshair = function () {
            base.cursors.css("border-style", "dashed");
        };
        

        /**
         *  Turn off the shadow cursor in a synchronized chart.
         */
        base.disableShadowCrosshair = function () {
            base.cursors.css("border-style", "solid");
        };
        
        
        /**
         * Make snapshot of current chart as an <img>.
         */
        base.snapshot = function () {
            throw "Not implemented yet.";
        };
        
        
        /* Run initializer. */
        base.__init__();
    };


    /*
     * ...
     */
    $.zig.defaultOptions = {
        
        /* Trigger debug behavior. */
        debug: false
        
        /* Determine the render path. */
      , defaultRenderPath: "auto"
                
        /* Outer width of chart (excluding border but including scrollbars). */
      , width: 400
        
        /* Outer height of chart (excluding border but including scrollbars). */
      , height: 200                
                
        /* CSS color code for the background fill color of the chart. */
      , canvasColor: "#fff"        
                
        /* CSS color code for chart box border ("transparent" is also supported). */
      , borderColor: "#444"
                
        /* CSS color code of the crosshair cursor. */
      , crosshairColor: "#000"
        
        /* CSS color code of the coordinate readings. */
      , coordinatesColor: "#000"    
      
        /* CSS color code of the ceiling text. */
      , scaleColor: "#000"
      
        /* CSS color for background elements, i.e. the chart will blend with this color. */
      , backgroundColor: "#fff"
        
        /* Render coordinate readings if true. */
      , showCoordinates: true
        
        /* Render a vertical grid if true. */
      , showVerticalGrid: true 
        
        /* Number of vertical grid segments (not lines). */
      , verticalGridSegments: 4
      
        /* CSS border-style definition for vertical grid lines (not segments). */
      , verticalGridLineStyle: "1px dotted #444"
      
        /* CSS opacity for vertical grid segments/lines. */
      , verticalGridOpacity: 0.5
      
        /* Not implemented yet. */
      , scaleTo: "auto"
        
        /* Height of scrollbar scroller in pixels. */
      , scrollbarHeight: 8
      
        /* CSS color code of scrollbar scroller. */
      , scrollbarColor: "#aaa"
        
        /* Overflow behavior when number of samples exceeds the maximum as specified by the chart dimensions. */
      , overflow: "scroll"
        
        /* The unit of samples added to the chart. */
      , unit: ""
      
        /* Background fill color style of the chart, either "solid" or "gradient". */
      , canvasFillStyle: "solid"
      
        /* CSS color code for the start position in the background gradient of the chart. */
      , canvasGradientStart: "#000000"
      
        /* CSS color code for the stop position in the background gradient of the chart. */
      , canvasGradientStop: "#666277"
      
    };    
    
    
    /**
     * Internally used constants. Change at your own risk.
     */
    $.zig.constants = {
        MAGIC: "74E90B05-2A51-46A6-A179-84CDCA6A75BE"
      , SCROLLBAR_HEIGHT_BASE: 3
      , FONT: '10px "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Geneva, Verdana, sans-serif'
      , TEXT_LINE_HEIGHT: 12
      , DIAGRAM_COLUMN_WIDTH: 5
      , DEFAULT_COLORS: [
            {   /* red */
                lineColor: "#993300"
              , fillColor: "#ff6600"
            }
          , {   /* blue */
                lineColor: "#003366"
              , fillColor: "#008080"
            }
          , {   /* green */
                lineColor: "#006411"
              , fillColor: "#1fb714"
            }
          , {   /* yellow */
                lineColor: "#ffcc00"
              , fillColor: "#fcf305"
            }
        ]
    };
    
    
    /**
     * Implement parsing of jquery-zig method invocations on a given selector.
     */
    $.prototype.zig = function (options) {
        if ($.type(options) == "string" && options in $.zig) {
            if (!this.data("plugin.zig")) {
                throw "Selected element(s) must be initialized first before calling methods through jQuery.zig";
            } else {
                this.data("plugin.zig")[options].apply(this, Array.prototype.slice.call(arguments, 1));
                return this.data("plugin.zig").$node;
            } 
        } else if ($.type(options) == "object" || !options) {
            return this.each(function () {
                (new $.zig(this, options));           
            });
        } else {
            throw "Method " + options.valueOf() + "() does not exist on jQuery.zig";
        }    
    };

})(jQuery);
