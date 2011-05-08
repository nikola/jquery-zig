/*!
 * jquery-zig Plugin Version 0.2-20110506
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
        var _functorRenderSamples = null;

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

            /* Container element for each graph. */
          , graphContainer: {}

            /* Global clip offset. */
          , graphClipOffset: 0

            /* Relative z-index of each graph. */
          , planeIndex: {}

            /* Indicates whether the mouse currently traces a graph. */
          , isOnPath: false
          
            /* True when the client cursor entered the chart area. */
          , hasFocus: false

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
          , useCustomCursor: true
          , cursors: null
          , horizontalCrosshairCursor: null
          , verticalCrosshairCursor: null

            /* x/y position of cursor. */
          , coordinates: null
          , positionIndex: null
          , positionValue: null
          , positionReadings: null

          /* State of coordinate readings. */
          , horizontalOrientation: null
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
                _functorRenderSamples = _renderSamplesCanvas;

                /* Additional state for this render path. */
                base.canvasSegmentContexts = {};
                base.canvasSegmentWidths = {};
            } else {
                _functorRenderSamples = _renderSamplesHtml;

                /* Additional state for this render path. */
                base.lastElementAdded = {};
                base.lastElementWidth = {};
                base.lastElementZIndex = {};
            }

            /* Diagram width must be a multiple of DEFAULT_COLUMN_WIDTH. */
            if ((base.options.sampleRenderWidth | 0) < $.zig.constants.DEFAULT_COLUMN_WIDTH) {
                base.options.sampleRenderWidth = $.zig.constants.DEFAULT_COLUMN_WIDTH;
            }

            var columnWidth = base.options.sampleRenderWidth;
            base.options.width = Math.floor(base.options.width / columnWidth) * columnWidth;

            /* Maximum number of samples that fit within the visible canvas. */
            base.maxSamples = base.options.width / columnWidth;

            /* Extract samples that were initially declared in the node's HTML. */
            var queue = _extractSamples();

            /* Render basic chrome. */
            var styles = {
                position: "relative"
              , width: base.options.width + "px"
              , height: base.options.height + "px"
              , border: "1px solid " + ((base.options.borderColor == "transparent") ?
                    base.options.backgroundColor : base.options.borderColor)
              , overflow: "hidden"
            };
            if ($.browser.msie || $.browser.opera) {
                styles.cursor = "crosshair";
                base.useCustomCursor = false;
            } else {
                styles.cursor = "none";
            }
            base.$node.css(styles);

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
            if ($.isArray(queue[0]) && queue[0].length
                    || $.isPlainObject(queue[0]) && !$.isEmptyObject(queue[0])) {
                base.addSamples(queue[0], queue[1]);                
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
            if (base.$node.find("ol li").size()) {
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
                base.$node = base.$node.wrap($("<q>", {css: {display: base.$node.css("display")}})).closest("q");
                base.$node.attr("class", currentClass);
                currentElement.css("display", "none");
            }
            
            return [queuedSamples, queuedLabels];
        }


        /**
         * Set up cursor controls.
         */
        function _wireMouseControls() {
            base.$node.bind({
                "mousemove.zig": _handleMouseMove
              , "mouseover.zig": _handleMouseOver
              , "mouseout.zig":  _handleMouseOut
            });

            var handle, element = base.$node.get(0);
            if ($.browser.mozilla && parseFloat($.browser.version.substr(0, 3)) * 10 >= 19) {
                handle = "DOMMouseScroll";
            }
            if (element.addEventListener) {
                element.addEventListener(handle || "mousewheel", _handleMousePan, false);
            } else if ($.browser.msie) {
                element.onmousewheel = function () {
                    return _handleMousePan.call(element, window.event);
                };
            }
        }


        /**
         * Add a single graph container using either render path.
         */
        function _addGraphContainer(id) {
            base.graphContainer[id] = $("<ul>", {
                css: {
                    listStyle: "none"
                  , zIndex: 1000 + base.planeIndex[id]
                  , position: "absolute"
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
                  , position: "relative"
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
         * Render samples to the given <canvas> graph segment.
         */
        function _renderSamplesCanvas(id, samples, continueFrom) {
            /* Basic parameters. */
            var count = samples.length,
                height = _getInnerHeight(),
                lineColor = base.config[id].lineColor,
                fillColor = base.config[id].fillColor;

            /* Create new segment. */
            var canvasElement = _appendCanvasSegment(id, count * base.options.sampleRenderWidth, height),
                context = canvasElement.get(0).getContext("2d");

            /* Define styles. */
            context.strokeStyle = lineColor;
            context.lineCap = "round";
            context.lineWidth = 2;

            _drawPathCanvas(context, samples, height, 0, continueFrom);

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

                _drawPathCanvas(context, samples, height, offset, continueFrom);

                context.lineTo(count * base.options.sampleRenderWidth, height);
                context.lineTo(0, height);
                context.lineTo(0, height - samples[0] + offset);

                context.fill();
            }
        }


        /**
         * Draw a <canvas> path.
         */
        function _drawPathCanvas(context, samples, height, offset, continueFrom) {
            context.moveTo(0, height - continueFrom);

            var columnWidth = base.options.sampleRenderWidth,
                s = 0, length = samples.length;
            do {
                /* Might trigger https://bugzilla.mozilla.org/show_bug.cgi?id=564332 */
                context.lineTo(s * columnWidth + columnWidth, height - samples[s] + offset);
            } while (++s < length);
        }


        /**
         * Render samples to the given pure HTML DOM graph.
         */
        function _renderSamplesHtml(id, samples, continueFrom, startIndex) {
            if (base.config[id].fillColor != "none") {
                _drawFilledPathHtml(id, samples, continueFrom, startIndex);
            } else {
                _drawOutlinedPathHtml(id, samples, continueFrom, startIndex);
            }
        }


        /**
         * Draw a pure HTML path when a fill color has been specified.
         */
        function _drawFilledPathHtml(id, samples, continueFrom, startIndex) {
            var height = _getInnerHeight(),
                borderCss = "1px solid " + base.config[id].lineColor,
                backgroundColor = base.config[id].fillColor,
                widthBase = base.options.sampleRenderWidth, widthCurrent,
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
                    zIndexCurrent = 1111 * (base.planeIndex[id] + 1);
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
         * Draw a pure HTML path when no fill color has been specified.
         */
        function _drawOutlinedPathHtml(id, samples, continueFrom, startIndex) {
            var height = _getInnerHeight() - 1,
                borderCss = "2px solid " + base.config[id].lineColor,
                widthBase = base.options.sampleRenderWidth, widthCurrent, widthPreceding,
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
                  , zIndex: 19000
                  , "-moz-user-select": "-moz-none"
                  , "-webkit-user-select": "none"
                  , "-o-user-select": "none"
                  , "user-select": "none"
                }
              , unselectable: "on"
            }).appendTo(base.$node);
        }


        /**
         * Render the cursor elements (and coordinate readings if specified).
         */
        function _renderCursorControls(invisible) {
            if (base.useCustomCursor) {
                _renderCrosshairCursor(invisible, false);
            }

            base.options.showCoordinates && _renderCoordinates(invisible);
        }


        /**
         * Render the vertical grid pattern.
         */
        function _renderVerticalGrid() {
            /* Correct invalid grid count. */
            if ((base.options.verticalGridSegments | 0) < $.zig.constants.DEFAULT_GRID_SEGMENTS) {
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
                      , zIndex: 19000
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
                      , zIndex: 19000
                    }
                }).appendTo(base.$node);
            }
        }


        /**
         * Render a crosshair cursor.
         */
        function _renderCrosshairCursor(invisible, syncOnly) {
            if (base.cursors != null) {
                base.cursors.remove();
            }

            var commonStyles = {
                position: "absolute"
              , zIndex: 20000
            };
            if (!!invisible) {
                commonStyles["display"] = "none";
            }
            
            var borderStyle = !!syncOnly ? "dashed" : "solid";

            base.horizontalCrosshairCursor = $("<div>", {
                css: $.extend({
                    width: 0
                  , height: _getInnerHeight() + "px"
                  , borderRight: "1px " + borderStyle + " " + base.options.crosshairColor
                }, commonStyles)
            }).appendTo(base.$node);

            if (!syncOnly) {
                base.verticalCrosshairCursor = $("<div>", {
                    css: $.extend({
                        width: base.options.width + "px"
                      , height: 0
                      , borderBottom: "1px " + borderStyle + " " + base.options.crosshairColor
                    }, commonStyles)
                }).appendTo(base.$node);
            }

            base.cursors = base.horizontalCrosshairCursor.add(base.verticalCrosshairCursor);
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
              , zIndex: 20000
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

            base.positionIndex = $("<div>", {
                css: $.extend({
                    marginTop: (_getInnerHeight() - $.zig.constants.TEXT_LINE_HEIGHT - 2) + "px"
                }, commonStyles)
              , unselectable: "on"
            }).appendTo(base.$node);

            base.positionReadings = $("<div>", {
                css: $.extend({
                    marginTop: (_getInnerHeight() - $.zig.constants.TEXT_LINE_HEIGHT - 2) + "px"
                }, commonStyles)
              , unselectable: "on"
            }).appendTo(base.$node);

            base.positionValue = $("<div>", {
                css: $.extend({
                    textAlign: "right"
                  , width: base.options.width + "px"
                }, commonStyles)
              , unselectable: "on"
            }).appendTo(base.$node);

            base.coordinates = base.positionIndex.add(base.positionReadings).add(base.positionValue);
        }


        /**
         * Update coordinate readings.
         */
        function _updateCoordinate(value, axis) {
            if (axis == "vertical") {
                if (base.isOnPath) {
                    return;
                }

                var height = _getInnerHeight(),
                    top = value,
                    displayValue = Math.round((height - value) / height * base.maxCeiling);

                if (base.maxCeiling / base.options.height > 2) {
                    displayValue = Math.round(displayValue / 10) * 10;
                }

                if (value > Math.ceil(height * 0.5)) {
                    top -= $.zig.constants.TEXT_LINE_HEIGHT;
                }

                base.positionValue
                    .css({
                        display: "block"
                      , marginTop: top + "px"
                    })
                    .text(displayValue + " " + base.options.unit);
            } else {
                /* Needed for mouse pans. */
                base.lastHorizontalX = value;

                var currentOrientation = value < Math.ceil(base.options.width * 0.5),
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

                /*
                 * Render label if set, otherwise render the sample's index.
                 */
                var sample = Math.floor((value + base.scrollPosition) / base.options.sampleRenderWidth);
                base.positionIndex.text(
                    !!base.sampleLabels[sample] ? base.sampleLabels[sample] : sample + 1
                );

                /*
                 * Update sample index and sample readings styles.
                 */
                if (!base.isOnPath) {
                    styles.display = "none";
                    base.positionReadings.css(styles);

                    styles.display = "block";
                    base.positionIndex.css(styles);                    
                } else {
                    base.ceilingText.css("opacity", (value < Math.ceil(base.options.width * 0.25)) ? 0.2 : 1);

                    styles.display = "block";
                    base.positionReadings.css(styles);

                    styles.marginTop = "2px";
                    base.positionIndex.css(styles);
                }
            }
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
                            var instance = $(event.target).data("backref.zig");

                            instance.isScrolling = true;
                            instance.scrollStartX = event.pageX;

                            /* Prevent the default drag operation. */
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    }
                  , "mouseup.zig": function (event) {
                        if (event.which != 1) {
                            return;
                        } else if (event.target.nodeType == 1 && event.target.getAttribute("class") == "zig-scrollbar-scroller") {
                            var instance = $(event.target).data("backref.zig");

                            instance.isScrolling = false;

                            /* Constrain and save scroller position. */
                            instance.scrollPosition = Math.min(instance.scrollMax,
                                Math.max(0, instance.scrollPosition - instance.lastScrollDiff)
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
            var chartWidth = base.sampleCountMax * base.options.sampleRenderWidth,
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

                if (x >= base.options.width || y >= height) {
                    _clearGraphTrace();
                } else {
                    /* Determine which graphs the cursor is tracing. */
                    var trace = _traceCursorPosition(x + base.scrollPosition, y);
                    
                    /* Highlight graphs and render sample readings at the cursor position. */
                    var index = Math.floor((x + base.scrollPosition) / base.options.sampleRenderWidth);
                    _highlightGraphs(index, trace.highlightSet, trace.targetOpacity);
                    
                    if (base.useCustomCursor) {
                        base.horizontalCrosshairCursor.css({
                            display: "block"
                          , paddingLeft: x + "px"
                        });

                        base.verticalCrosshairCursor.css({
                            display: "block"
                          , paddingTop: y + "px"
                        });
                    }

                    if (base.options.showCoordinates) {
                        _updateCoordinate(x, "horizontal");
                        _updateCoordinate(y, "vertical");
                    }

                    /*
                     * Update cursor and highlights in synchronized charts.
                     */
                    var counter = base.synchronizedTo.length, instance;
                    while (counter--) {
                        instance = base.synchronizedTo[counter]; 
                        instance.moveSyncCursorTo(x).highlightGraphs(
                            Math.floor((x + instance.scrollPosition) / instance.options.sampleRenderWidth), 
                            trace.highlightSet, trace.targetOpacity
                        );
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
                var delta = event.detail * 12;
            } else if ($.browser.webkit && "wheelDeltaX" in event) {
                var deltaX = event.wheelDeltaX / -3,
                    deltaY = event.wheelDeltaY / -3,
                    delta = deltaX || deltaY;
            } else if (($.browser.msie || $.browser.opera) && "wheelDelta" in event) {
                var delta = event.wheelDelta / -3;
            } else {
                return;
            }

            if (delta) {
                var columnWidth = base.options.sampleRenderWidth,
                    targetPosition = base.scrollPosition + Math.ceil(delta);

                /* Constrain scroller position. */
                targetPosition = Math.min(Math.max(0, targetPosition), base.scrollMax);

                base.scrollPosition = targetPosition;

                var x = base.lastHorizontalX,
                    sample = Math.floor((x - x % columnWidth + base.scrollPosition) / columnWidth);

                base.options.showCoordinates && base.positionIndex.text(
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
                var counter = base.synchronizedTo.length, instance;
                while (counter--) {
                    instance = base.synchronizedTo[counter];

                    instance.scrollTo(percentage);
                    instance.options.showCoordinates && instance.positionIndex.text(
                        Math.floor((instance.lastHorizontalX + instance.scrollPosition) / instance.options.sampleRenderWidth) + 1
                    );
                }

                /*
                 * Revert coordinates to defaults.
                 */
                base.positionValue.css("display", "block");
                base.positionReadings.css("display", "none");
                base.ceilingText.css("opacity", 1);                    
                    
                if (base.isOnPath) {
                    /* Clear highlights in this chart. */
                    _highlightGraphs(false);
        
                    /* Clear cursor and highlights in synchronized charts. */
                    var d = base.synchronizedTo.length;
                    while (d--) {
                        base.synchronizedTo[d].highlightGraphs(false);
                    } 
                }

                /* Prevent the default scroll operation. */
                if ($.browser.msie && $.browser.version != "9.0") {
                    event.cancelBubble = true;
                    return false;
                } else {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        }


        /**
         * Handle the mouse entering the chart. 
         */
        function _handleMouseOver(event) {
            if (!base.hasFocus && !base.isScrolling) {
                base.hasFocus = true;
                
                base.useCustomCursor && base.cursors.css("display", "block");
                base.options.showCoordinates && base.coordinates.css("display", "block");
                
                /* ... */
                var counter = base.synchronizedTo.length;
                while (counter--) {
                    base.synchronizedTo[counter].enableSyncCursor().obscureVerticalGrid();
                }                
            }
        }


        /**
         * Handle the mouse leaving the chart.
         */
        function _handleMouseOut(event) {
            if (!base.isScrolling) {
                base.hasFocus = false;

                /* Check that mouse cursor actually left the canvas. */
                if (!!event && $(event.relatedTarget).closest("#" + base.id).size()) {
                    return;
                }
    
                _clearGraphTrace();
            }
        }


        /**
         * Clear the cursor, highlights and coordinates in this chart and synchronized charts.
         */
        function _clearGraphTrace() {
            base.useCustomCursor && base.cursors.css("display", "none");
            base.options.showCoordinates && base.coordinates.css("display", "none");

            /* Clear highlights in this chart. */
            _highlightGraphs(false);

            /* Clear cursor and highlights in synchronized charts. */
            var d = base.synchronizedTo.length;
            while (d--) {
                base.synchronizedTo[d].highlightGraphs(false).disableSyncCursor().unobscureVerticalGrid();
            }            
        }
        
        
        /**
         * Update sample readings.
         */
        function _traceCursorPosition(x, y) {
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
                index = Math.floor(x / base.options.sampleRenderWidth),
                rawSamples = base.rawSamples, samples, current,
                idSet = base.graphIds, containers = base.graphContainer,
                highlightSet = [], targetOpacity = {}, 
                length = base.graphCount,
                supportsPixelRetrieval = base.options.defaultRenderPath == "auto" && $.prototype.zig.supportsPixelRetrieval,
                id, hit, d = 0;

            do {
                id = idSet[d], samples = rawSamples[id];

                /* In case this graph does not exist on chart. */
                if (!samples || containers[id].css("visibility") == "hidden") continue;

                current = samples[index];
                if (base.hasFilledPaths) {
                    hit = current >= value;
                } else {
                    hit = (current >= lowerBoundary && current <= upperBoundary
                            || current <= value && samples[index + 1] >= value);
                }

                if (!hit && supportsPixelRetrieval && id in base.canvasSegmentWidths) {
                    var segmentWidths = base.canvasSegmentWidths[id], segments = segmentWidths.length, segmentWidth,
                        contexts = base.canvasSegmentContexts[id],
                        position = 0, s = -1;
                    while (++s < segments) {
                        segmentWidth = segmentWidths[s];
                        if (x + base.graphClipOffset < position + segmentWidth) {
                            /* Correct x-position relative to segment offset and canvas clip-offset. */
                            var reading = contexts[s].getImageData(x + base.graphClipOffset - (s ? position : 0), y, 1, 1).data;
                            hit = reading[0] || reading[1] || reading[2];
                            break;
                        } else {
                            position += segmentWidth;
                        }
                    }
                }

                if (hit) {
                    targetOpacity[id] = 1;
                    highlightSet.push(id);
                } else {
                    targetOpacity[id] = 0.2;
                }
            } while (++d < length);
            
            return {
                highlightSet: highlightSet
              , targetOpacity: targetOpacity
            };
        }


        /**
         * Highlight selected graphs and update sample readings for these graphs.
         */
        function _highlightGraphs(index, highlightSet, targetOpacity) {
            var hasHighlights = !!highlightSet && !!highlightSet.length;
            
            if (hasHighlights || base.isOnPath) {
                var restore = !hasHighlights && base.isOnPath,
                    foremostPlane = -1;
                
                /* Determine foremost plane index. */
                if (!restore) {
                    var graph = highlightSet.length, indices = base.planeIndex;
                    while (graph--) {
                        foremostPlane = Math.max(base.planeIndex[highlightSet[graph]], foremostPlane);
                    }   
                }
                
                var containers = base.graphContainer, ids = base.graphIds,
                    counter = base.graphCount, id;    
                while (counter--) {
                    id = ids[counter];

                    if (restore) {
                        containers[id].css("opacity", 1);
                    } else if (base.hasFilledPaths && base.planeIndex[id] < foremostPlane) {
                        containers[id].css("opacity", 0.2);
                    } else {
                        containers[id].css("opacity", targetOpacity[id]);
                    }
                 }

                 if (base.options.showCoordinates && hasHighlights) {
                    /* Move sample index reading to the top of the chart. */
                    base.positionIndex.css("margin-top", "2px");
                    
                    base.positionValue.css("display", "none");
                    base.positionReadings.empty();
                    if (hasHighlights && !base.isOnPath) {
                        base.positionReadings.css("display", "block");
                    }
                    
                    /* Re-order according to creation time. */                     
                    highlightSet = _getSortedGraphIds(highlightSet, index);
                            
                    /* Render sample readings top to bottom. */        
                    var d = highlightSet.length - 1, id;
                    do {
                        id = highlightSet[d];
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
                            base.rawSamples[id][index] + " " + base.options.unit
                        ).appendTo(base.positionReadings);
        
                       $("<br>").appendTo(base.positionReadings);
                    } while (d--);
        
                    var height = $.zig.constants.TEXT_LINE_HEIGHT + 1 + 2 + 2 + 3 + 4;
                    base.positionReadings.css({
                        marginTop: (_getInnerHeight() - height * highlightSet.length) + "px"
                      , lineHeight: height + "px"
                    });                     
                } else if (restore) {
                    /* Move sample index reading to the bottom of the chart. */
                    base.positionIndex.css("margin-top", (_getInnerHeight() - $.zig.constants.TEXT_LINE_HEIGHT - 2) + "px");

                    base.positionReadings.css("display", "none");
                    base.ceilingText.css("opacity", 1);
                }
            }
            base.isOnPath = hasHighlights;            
        }
        
        
        /**
         * Sort graph IDs according to the sample value at the given index.
         */
        function _getSortedGraphIds(graphs, index) {
            var length = graphs.length;
            
            if (length == 1) {
                return graphs;
            } else if (length == 2) {
                if (base.rawSamples[graphs[0]][index] > base.rawSamples[graphs[1]][index]) {
                    return [graphs[1], graphs[0]];
                } else {
                    return graphs;
                }
            } else {
                var rawSamples = base.rawSamples, 
                    usedSamples = [], 
                    c = 0;
                do {
                    usedSamples.push(rawSamples[graphs[c]][index]);
                } while (++c < length);

                usedSamples.sort();

                var sortedSamples = [], sample,
                    d = 0, e;
                do {
                    sample = usedSamples[d];
                    e = 0;
                    do {
                        if (rawSamples[graphs[e]][index] == sample) {
                            sortedSamples.push(graphs[e]);
                        }
                    } while (++e < length);
                } while (++d < length);
                
                return sortedSamples;    
            }      
        }
        
        
        /**
         * Redraw all graphs in the chart and reset scroll state.
         */
        function _redrawChart(rescale) {
            base.graphClipOffset = 0;

            var isCanvas = $.prototype.zig.supportsCanvas && base.options.defaultRenderPath == "auto";

            /* Re-init <canvas> segments. */
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

                    _functorRenderSamples(id, base.scaledSamples[id], base.scaledSamples[id][0], 0);
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
                if (tags.hasOwnProperty(tag)) {
                    template = template.replace(new RegExp("{" + tag + "}", "g"), tags[tag]);
                }
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
             * Detect clipping.
             */
            if (sampleCount + addCount > base.maxSamples) {
                if (base.options.overflow == "clip") {
                    if (addCount > base.maxSamples) {
                        samples = samples.slice(addCount - base.maxSamples);
                        addCount = samples.length;
                    }

                    if (sampleCount) {
                        var skip = sampleCount + addCount - base.maxSamples;

                        base.graphClipOffset += skip * base.options.sampleRenderWidth;

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

                _functorRenderSamples(id, buffer, base.scaledSamples[id][Math.max(continueIndex, 0)], sampleCount);
            }

            /*
             * Assign labels to samples.
             */
            if (!$.type(labels) == "string") {
                labels = [labels];
            }
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
            if ($.type(id) == "number" || $.isArray(id)) {
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
                labels = labels || {};
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
         * Synchronize this chart to all jquery-zig charts specified by the given selector.
         */
        base.synchronize = function (selector) {
            $(selector).each(function (index, element) {
                var instance = $(this).data("plugin.zig");
                if (!!instance) {
                    base.synchronizedTo.push(instance);
                    instance.synchronizedTo.push(base);
                }
            });
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
         * Return a snapshot of the current chart as an <img>.
         */
        base.getSnapshot = function () {
            throw "Not implemented yet.";
        };


        /**
         * Hide a given graph.
         */
        base.hideGraph = function (id) {
            if (!(id in base.graphContainer)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                base.graphContainer[id].css("visibility", "hidden");
            }
        };


        /**
         * Unhide a given graph.
         */
        base.unhideGraph = base.showGraph = function (id) {
            if (!(id in base.graphContainer)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                base.graphContainer[id].css("visibility", "visible");
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
         * Highlight selected graphs and update sample readings for these graphs.
         */
        base.highlightGraphs = function (index, highlightSet, targetOpacity) {
            _highlightGraphs(index, highlightSet, targetOpacity);
            
            return base;
        };
        
                    
        /**
         * Hide the vertical grid.
         */
        base.obscureVerticalGrid = function () {
            base.options.showVerticalGrid && base.$node.find(".zig-vertical-grid").css("opacity", 0.2);
        };


        /**
         * Unhide the vertical grid.
         */
        base.unobscureVerticalGrid = base.showVerticalGrid = function () {
            base.options.showVerticalGrid && base.$node.find(".zig-vertical-grid").css("opacity", base.options.verticalGridOpacity);
        };                    


        /**
         * Turn on the horizontal cursor in a synchronized chart.
         */
        base.enableSyncCursor = function () {
            if (base.cursors == null) {
                _renderCrosshairCursor(false, true);
            } else {
                base.horizontalCrosshairCursor.css({
                    "display": "block"
                  , "border-style": "dashed"
                }); 
            }
            
            return base;
        };


        /**
         * Programmatically move the cursor (not the mouse pointer) to the given x-coordinate.
         */
        base.moveSyncCursorTo = function (x) {
            base.horizontalCrosshairCursor.css("padding-left", x + "px");
            base.options.showCoordinates && _updateCoordinate(x, "horizontal");
            
            return base;
        };


        /**
         *  Turn off the horizontal cursor in a synchronized chart.
         */
        base.disableSyncCursor = function () {
            base.horizontalCrosshairCursor.css("display", "none");
            base.options.showCoordinates && base.positionIndex.css("display", "none");
            
            base.horizontalCrosshairCursor.css("border-style", "solid");
            
            return base;
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

        /* Size of each rendered sample column in pixels. */
      , sampleRenderWidth: 5

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
      , DEFAULT_GRID_SEGMENTS: 2
      , DEFAULT_COLUMN_WIDTH: 5
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
