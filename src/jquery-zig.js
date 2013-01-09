/*!
 * jquery-zig Plugin Version 0.6-20130108
 * Copyright 2013, Nikola Klaric.
 *
 * https://github.com/nikola/jquery-zig
 *
 * Licensed under the GNU Lesser General Public License (LGPL) Version 3.
 *
 * For the full license text see the enclosed LGPL-LICENSE.TXT, or go to:
 * https://github.com/nikola/jquery-zig/LGPL-LICENSE.txt
 */
;~
function ($) {

    /**
     * A jQuery plugin that draws interactive line chart diagrams.
     */
    $.zig = function (node, options) {

        var self = this;
        self.$node = $(node);

        /* Prevent repeated initialization. */
        if (!!self.$node.data("plugin.zig")) {
            return;
        } else {
            /* Add self-reference for method access. */
            self.$node.data("plugin.zig", self);
        }

        /* Determine this early. */
        self.id = self.$node.attr("id");

        /*
         * Only handle block-style elements.
         */
        if (self.$node.css("display") != "block" && self.$node.css("display") != "inline-block") {
            throw "Only block-style elements are supported at this time.";
        }

        /*
         * Functor of the render path for rendering paths.
         */
        var _functorRenderSamples = null;

        /*
         * Persistent instance data.
         */
        $.extend(self, {

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
          
            /* Indicates whether graph statistics are being displayed. */
          , isModeGraphStats: false
          
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
          
            /* ... */
          , overlayRange: null
          , overlayStdDev: null
          , overlayMean: null
          
            /* ... */
          , legend: null

        });


        /**
         * Initialize this instance and render chrome and inline sample data.
         */
        self.__init__ = function () {
            /*
             * Expose public interface.
             */
            if (!($.zig.constants.MAGIC in $.prototype.zig)) {
                $.prototype.zig[$.zig.constants.MAGIC] = true;
                for (var symbol in self) {
                    if (self.hasOwnProperty(symbol) && /^[a-z][a-zA-Z]+$/.test(symbol)
                            && $.type(self[symbol]) == "function") {
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
                
                
                // $.prototype.zig.handleMouseOut = function (event) {
		        // 	var instance = $(event.target).data("backref.zig");
		        	
		        	// if (event.relatedTarget == null)
		        	//      return;

		        //     if (!instance.isScrolling) {

		                /* Check that mouse cursor actually left the canvas. */
		                /* if (!!event && $(event.relatedTarget).closest("#" + self.id).size()) {
		                    return;
		                } */
		    			
		    			// instance.hasFocus = false;
		    			
	                // _clearGraphTrace(true);
		            // } else { // TODO: only if cursor actually left the track
		            //     if (instance) instance.isScrolling = false;
		
		                /* Constrain and save scroller position. */
		            //    instance.scrollPosition = Math.min(instance.scrollMax,
		            //        Math.max(0, instance.scrollPosition - instance.lastScrollDiff)
		            //    );
		            //}
		        // };
		        
                $.prototype.zig.handleMouseDown = function (event) {
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
                };               

                $.prototype.zig.handleMouseUp = function (event) {
                    if (event.which != 1) {
                        return;
                    } else if (event.target.nodeType == 1 && event.target.getAttribute("class") == "zig-scrollbar-scroller") {
                        var instance = $(event.target).data("backref.zig");

                        instance.isScrolling = false;

                        /* Constrain and save scroller position. */
                        instance.scrollPosition = Math.min(instance.scrollMax,
                            Math.max(0, instance.scrollPosition - instance.lastScrollDiff)
                        );
                    } else {
                        var mark = $(event.target).closest("." + $.zig.constants.MAGIC);
                        if (mark.size()) {
                            var instance = mark.data("plugin.zig");
                            if (instance.isModeGraphStats && $(event.target).is("samp")) {
                                var that = $(event.target).closest("span");
                                if (!that.data("selected.zig")) {
                                    var oldId = instance.highlightSet[0],
                                        newId = that.data("id.zig");
                                    
                                    var opacityMap = {};
                                    opacityMap[newId] = 1;
                                    
                                    instance.highlightSet = [newId];
                                    instance.opacityMap = opacityMap;

                                    /* Update legend selection. */                                                                        
                                    that
                                        .data("selected.zig", true).css({opacity: 1, cursor: "default"})
                                        .find("samp:first")
                                            .css("background-color", instance.config[newId].lineColor)
                                    .end().siblings()
                                        .data("selected.zig", false).css({opacity: 0.2, cursor: "pointer"})
                                        .find("samp:even")
                                            .css("background-color", "transparent");
                                    
                                    /* Update graph opacity. */
                                    instance.graphContainer[oldId].css("visibility", "hidden");
                                    instance.graphContainer[newId].css("visibility", "visible");
                                    
                                    /*
                                     * Synchronize.
                                     */
                                    var counter = instance.synchronizedTo.length, context;
                                    while (counter--) {
                                        // TODO: optimize?
                                        context = instance.synchronizedTo[counter];
                                        
                                        context.highlightSet = [newId]; 
                                        
                                        context.renderStatisticsOverlays(newId);
                                   
                                        context.graphContainer[oldId].css("visibility", "hidden");    
                                        context.graphContainer[newId].css({opacity: 1, visibility: "visible"});
                                    }

                                    instance.renderStatisticsOverlays(newId);
                                }
                            } else if (instance.isModeGraphStats && $(event.target).is("abbr")) {
                                instance.legend.remove();
                                instance.$node.find(".zig-vertical-grid").css("display", "block");
                                
                                instance.overlayRange.remove();
                                instance.overlayStdDev.remove();
                                instance.overlayMean.remove();
                                
                                // TODO: optimize this
                                instance.overlayRange = null;
                                instance.overlayStdDev = null;
                                instance.overlayMean = null;
                                
                                instance.isModeGraphStats = false;
                                
                                instance.highlightSet = [];
                                
                                // TODO: refactor into public method
                                var containers = instance.graphContainer, ids = instance.graphIds,
                                    counter = instance.graphCount;
                                while (counter--) {
                                    containers[ids[counter]].css("visibility", "visible");
                                }
                                
                                var counter = instance.synchronizedTo.length, context;
                                while (counter--) {
                                    context = instance.synchronizedTo[counter];
                                    
                                    context.legend.remove();
                                    context.isModeGraphStats = false;
                                    
                                    context.$node.find(".zig-vertical-grid").css("display", "block");
                                    
                                    context.overlayRange.remove();
                                    context.overlayStdDev.remove();
                                    context.overlayMean.remove();
                                    
                                    // TODO: optimize this
                                    context.overlayRange = null;
                                    context.overlayStdDev = null;
                                    context.overlayMean = null;
                                    
                                    context.highlightSet = [];
                                    
                                    // TODO: refactor into public method
                                    var containers = context.graphContainer, ids = context.graphIds,
                                        graphs = context.graphCount;
                                    while (graphs--) {
                                        containers[ids[graphs]].css("visibility", "visible");
                                    }
                                } 
                            } else if (instance.isOnPath) {
                                instance.isModeGraphStats = true;
                                
                                // TODO: refactor into public method
                                instance.$node.find(".zig-vertical-grid").css("display", "none");
                                
                                var id = instance.highlightSet[0]; 
                                
                                instance.renderChartLegend(instance); 
                                instance.renderStatisticsOverlays(id);
                                
                                var counter = instance.synchronizedTo.length, context;
                                while (counter--) {
                                    context = instance.synchronizedTo[counter];
                                
                                    context.isModeGraphStats = true;
                                    
                                    // TODO: refactor into public method
                                    context.$node.find(".zig-vertical-grid").css("display", "none");
                                    
                                    context.highlightSet = [id];
                                    
                                    context.renderChartLegend();
                                    context.renderStatisticsOverlays(id);
                                }
                            }
                        }
                    }
                };
            }


            /*
             * Set explicit id on this node.
             */
            if (!self.id) {
                self.id = "zig-id-" + $.prototype.zig.counter;
                $.prototype.zig.counter += 1;
                self.$node.attr("id", self.id);
            }

            /* Overload with default options. */
            self.options = $.extend({}, $.zig.defaultOptions, options);

            /*
             * Determine the actual render path.
             */
            if ($.prototype.zig.supportsCanvas && self.options.defaultRenderPath == "auto") {
                _functorRenderSamples = _renderSamplesCanvas;

                /* Additional state for this render path. */
                self.canvasSegmentContexts = {};
                self.canvasSegmentWidths = {};
            } else {
                _functorRenderSamples = _renderSamplesHtml;

                /* Additional state for this render path. */
                self.lastElementAdded = {};
                self.lastElementWidth = {};
                self.lastElementZIndex = {};
            }

            /* Diagram width must be a multiple of DEFAULT_COLUMN_WIDTH. */
            if ((self.options.sampleRenderWidth | 0) < $.zig.constants.DEFAULT_COLUMN_WIDTH) {
                self.options.sampleRenderWidth = $.zig.constants.DEFAULT_COLUMN_WIDTH;
            }

            var columnWidth = self.options.sampleRenderWidth;
            self.options.width = Math.floor(self.options.width / columnWidth) * columnWidth;

            /* Maximum number of samples that fit within the visible canvas. */
            self.maxSamples = self.options.width / columnWidth;

            /* Extract samples that were initially declared in the node's HTML. */
            var queue = _extractSamples();

            /* Render basic chrome. */
            var styles = {
                position: "relative"
              , width: self.options.width + "px"
              , height: self.options.height + "px"
              , border: "1px solid " + ((self.options.borderColor == "transparent") ?
                    self.options.backgroundColor : self.options.borderColor)
              , overflow: "hidden"
            };
            if ($.browser.msie) {
                if (self.options.msieNoneCursorUrl) {
                    styles.cursor = "url(" + self.options.msieNoneCursorUrl + ")";
                } else {
                    styles.cursor = "crosshair";
                }
                self.useCustomCursor = false;
            } else if ($.browser.opera) {
                styles.cursor = "crosshair";
                self.useCustomCursor = false;
            } else {
                styles.cursor = "none";
            }
            self.$node.css(styles);
            
            /* Mark this node as being zigged. */
            self.$node.addClass($.zig.constants.MAGIC);

            /* Initialize and render graph containers as defined in init parameters. */
            _createGraphs();

            /* True if any graph has a fill color set. */
            self.hasFilledPaths = self.config[self.defaultGraph].fillColor != "none";

            /*
             * Render more chrome.
             */
            _renderBackground();
            _renderCeilingText();
            self.options.showVerticalGrid && _renderVerticalGrid();

            /* Set up cursor controls. */
            if (!self.options.debug) {
                _renderCursorControls(true);
                _wireMouseControls();
            }

            /* Add samples that were initially declared in the node's HTML. */
            if ($.isArray(queue[0]) && queue[0].length
                    || $.isPlainObject(queue[0]) && !$.isEmptyObject(queue[0])) {
                self.addSamples(queue[0], queue[1]);                
            }
        };


        /**
         * Initialize and render graph containers as defined in init parameters.
         */
        function _createGraphs() {
            if (!(self.options.graphs && self.options.graphs.length)) {
                self.graphIds.push("default");

                self.planeIndex["default"] = 0;
                self.rawSamples["default"] = [];
                self.scaledSamples["default"] = [];

                if (!$.prototype.zig.supportsCanvas) {
                    self.lastElementAdded["default"] = null;
                    self.lastElementWidth["default"] = null;
                    self.lastElementZIndex["default"] = null;
                }

                var colors = $.zig.constants.DEFAULT_COLORS[0];
                self.config["default"] = {
                    lineColor: colors.lineColor
                  , fillColor: colors.fillColor
                };
                self.defaultColorCounter += 1;

                _addGraphContainer("default");

                self.graphCount = 1;
                self.defaultGraph = "default";
            } else {
                var count = 0;
                $.each(self.options.graphs, function (index, value) {
                    var id = value.id;
                    self.graphIds.push(id);

                    self.planeIndex[id] = count;
                    self.rawSamples[id] = [];
                    self.scaledSamples[id] = [];

                    self.config[id] = $.extend({}, value);

                    if (!("lineColor" in self.config[id]) && !("fillColor" in self.config[id])) {
                        $.extend(self.config[id], $.zig.constants.DEFAULT_COLORS[self.defaultColorCounter]);
                        self.defaultColorCounter += 1;
                    } else if ("lineColor" in value && !("fillColor" in self.config[id])) {
                        self.config[id].lineColor = value.lineColor;
                        self.config[id].fillColor = "none";
                    } else if (!("lineColor" in value) && "fillColor" in self.config[id]) {
                        self.config[id].lineColor = $.zig.constants.DEFAULT_COLORS[self.defaultColorCounter].lineColor;
                        self.config[id].fillColor = value.fillColor;
                        self.defaultColorCounter += 1;
                    }

                    if (!$.prototype.zig.supportsCanvas) {
                        self.lastElementAdded[id] = null;
                        self.lastElementWidth[id] = null;
                        self.lastElementZIndex[id] = null;
                    }

                    count++;

                    _addGraphContainer(id);
                });
                self.graphCount = count;
                self.defaultGraph = self.graphIds[0];
            }
        }


        /**
         * Extract samples that were initially declared in the node's HTML.
         */
        function _extractSamples() {
            var queuedSamples, queuedLabels;
            if (self.$node.find("ol li").size()) {
                if (self.$node.find("ol").size()) {
                    queuedSamples = {}, queuedLabels = {};
                    self.$node.find("ol").each(function () {
                        var id = $(this).attr("id");
                        if (!!id) {
                            queuedSamples[id] = [], queuedLabels[id] = [];
                            $(this).find("li").each(function () {
                                queuedSamples[id].push(parseInt($(this).text(), 10));
                                queuedLabels[id].push($(this).attr("title"));
                            });
                        }
                    });
                } else {
                    queuedSamples = [], queuedLabels = [];
                    self.$node.find("li").each(function () {
                        queuedSamples.push(parseInt($(this).text(), 10));
                        queuedLabels.push($(this).attr("title"));
                    });
                }

                var currentElement = self.$node, currentClass = currentElement.attr("class");
                self.$node = self.$node.wrap($("<q>", {
                    css: {
                        display: self.$node.css("display")
                    }
                  , data: {
                        "plugin.zig": self    
                    }
                })).closest("q");
                self.$node.attr("class", currentClass);
                currentElement.css("display", "none").removeData("plugin.zig");
            }
            
            return [queuedSamples, queuedLabels];
        }


        /**
         * Set up cursor controls.
         */
        function _wireMouseControls() {
            self.$node.bind({
                "mousemove.zig": _handleMouseMove
              , "mouseover.zig": _handleMouseOver
              , "mouseleave.zig":  _handleMouseLeave
            });

            var handle, element = self.$node.get(0);
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
            self.graphContainer[id] = $("<ul>", {
                css: {
                    listStyle: "none"
                  , zIndex: 1000 + self.planeIndex[id]
                  , position: "absolute"
                }
            }).appendTo(self.$node);
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
            }).appendTo(self.graphContainer[id]);

            var canvasElement = $("<canvas>").appendTo(canvasSegment)
                .attr({
                    width: width
                  , height: height
                });

            /* Anti-alias paths for odd line-widths. */
            // canvasElement.get(0).getContext("2d").translate(0.5, 0.5);

            if ($.prototype.zig.supportsPixelRetrieval) {
                var context = canvasElement.get(0).getContext("2d");
                self.canvasSegmentContexts[id]
                    && self.canvasSegmentContexts[id].push(context)
                    || (self.canvasSegmentContexts[id] = [context]);

                self.canvasSegmentWidths[id]
                    && self.canvasSegmentWidths[id].push(width)
                    || (self.canvasSegmentWidths[id] = [width]);
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
                lineColor = self.config[id].lineColor,
                fillColor = self.config[id].fillColor;

            /* Create new segment. */
            var canvasElement = _appendCanvasSegment(id, count * self.options.sampleRenderWidth, height),
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
                if (self.planeIndex[id]) {
                    context.globalAlpha = 0.8;
                }

                context.beginPath();

                _drawPathCanvas(context, samples, height, offset, continueFrom);

                context.lineTo(count * self.options.sampleRenderWidth, height);
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

            var columnWidth = self.options.sampleRenderWidth,
                s = 0, length = samples.length;
            do {
                /* Might trigger https://bugzilla.mozilla.org/show_bug.cgi?id=564332 */
               // TODO: convert numbers to integers using [bitwise-or] 0
                context.lineTo(s * columnWidth + columnWidth, height - samples[s] + offset);
            } while (++s < length);
        }


        /**
         * Render samples to the given pure HTML DOM graph.
         */
        function _renderSamplesHtml(id, samples, continueFrom, startIndex) {
            if (self.config[id].fillColor != "none") {
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
                borderCss = "1px solid " + self.config[id].lineColor,
                backgroundColor = self.config[id].fillColor,
                widthBase = self.options.sampleRenderWidth, widthCurrent,
                widthPreceding = self.lastElementWidth[id],
                currentValue, precedingValue,
                zIndexCurrent, zIndexPreceding = self.lastElementZIndex[id],
                marginLeft, borderLeft, styles,
                s = 0, length = samples.length;
            do {
                currentValue = samples[s];
                widthCurrent = widthBase, marginLeft = false, borderLeft = false;

                if (s || startIndex) {
                    precedingValue = (!s && startIndex) ? continueFrom : samples[s - 1];

                    zIndexCurrent = zIndexPreceding, marginLeft = (startIndex + s) * widthBase;

                    if (precedingValue < currentValue) {
                        self.lastElementAdded[id].css({
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
                        self.lastElementAdded[id].css({
                            width: (widthPreceding + 1) + "px"
                          , borderRight: "none"
                        });

                        widthCurrent--;
                    }
                } else {
                    widthCurrent--;
                    zIndexCurrent = 1111 * (self.planeIndex[id] + 1);
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
                self.lastElementAdded[id] = $("<li>", {
                    css: styles
                }).appendTo(self.graphContainer[id]);

                widthPreceding = widthCurrent;
                zIndexPreceding = zIndexCurrent;
            } while (++s < length);

            self.lastElementWidth[id] = widthPreceding;
            self.lastElementZIndex[id] = zIndexPreceding;
        }


        /**
         * Draw a pure HTML path when no fill color has been specified.
         */
        function _drawOutlinedPathHtml(id, samples, continueFrom, startIndex) {
            var height = _getInnerHeight() - 1,
                borderCss = "2px solid " + self.config[id].lineColor,
                widthBase = self.options.sampleRenderWidth, widthCurrent, widthPreceding,
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
                        widthPreceding = self.lastElementWidth[id] - 1;
                        marginTopPreceding = currentValue;
                    } else {
                        borderTop = borderCss;
                        borderBottom = "none";
                        widthPreceding = widthBase - 1;
                        marginTopPreceding = precedingValue;
                    }

                    self.lastElementAdded[id].css({
                        borderTop: borderTop
                      , borderRight: borderCss
                      , borderBottom: borderBottom
                      , width: widthPreceding + "px"
                      , height: Math.abs(currentValue - precedingValue) + "px"
                      , marginTop: (height - marginTopPreceding) + "px"
                    });
                }

                self.lastElementAdded[id] = $("<li>", {
                    css: {
                         display: "inline-block"
                       , position: "absolute"
                       , marginLeft: ((startIndex + s) * widthBase) + "px"
                       , marginTop: (height - currentValue) + "px"
                       , borderTop: borderCss
                       , width: widthCurrent + "px"
                    }
                }).appendTo(self.graphContainer[id]);

                self.lastElementWidth[id] = widthCurrent;
            } while (++s < length);
        }


        /**
         * Apply background gradient if specified and supported, otherwise render a solid background fill.
         */
        function _renderBackground() {
            var needsBackground = true;
            if (self.options.canvasFillStyle == "gradient") {
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
                    self.$node.css(property, _replaceTags(template, {
                            start: self.options.canvasGradientStart, stop: self.options.canvasGradientStop
                        }));
                }
            }
            needsBackground && self.$node.css("background-color", self.options.canvasColor);
        }


        /**
         * Render the ceiling text element.
         */
        function _renderCeilingText() {
            self.ceilingText = $("<span>", {
                css: {
                    position: "absolute"
                  , left: "2px"
                  , top: "2px"
                  , font: $.zig.constants.FONT
                  , color: self.options.scaleColor
                  , zIndex: 19000
                  , "-moz-user-select": "-moz-none"
                  , "-webkit-user-select": "none"
                  , "-o-user-select": "none"
                  , "user-select": "none"
                }
              , unselectable: "on"
            }).appendTo(self.$node);
        }


        /**
         * Render the cursor elements (and coordinate readings if specified).
         */
        function _renderCursorControls(invisible) {
            if (self.useCustomCursor) {
                _renderCrosshairCursor(invisible, false);
            }

            self.options.showCoordinates && _renderCoordinates(invisible);
        }


        /**
         * Render the vertical grid pattern.
         */
        function _renderVerticalGrid() {
            /* Correct invalid grid count. */
            if ((self.options.verticalGridSegments | 0) < $.zig.constants.DEFAULT_GRID_SEGMENTS) {
                self.options.verticalGridSegments = 2;
            }

            self.$node.find(".zig-vertical-grid").remove();

            var height = _getInnerHeight(),
                style = self.options.verticalGridLineStyle,
                opacity = self.options.verticalGridOpacity,
                segments = self.options.verticalGridSegments,
                even = segments % 2 == 0;

            if (even) {
                $("<div>", {
                    "class": "zig-vertical-grid"
                  , css: {
                        position: "absolute"
                      , width: self.options.width + "px"
                      , height: Math.round(height / 2) + "px"
                      , borderBottom: style
                      , opacity: opacity
                      , zIndex: 19000
                    }
                }).appendTo(self.$node);
            }

            var tiles = even ? segments / 2 - 1 : Math.floor(segments / 2),
                g = -1;
            while (++g < tiles) {
                $("<div>", {
                    "class": "zig-vertical-grid"
                  , css: {
                        position: "absolute"
                      , width: self.options.width + "px"
                      , height: (Math.floor(height * (even ? segments - (g + 1) * 2 : g * 2 + 1) / segments) - 1) + "px"
                      , marginTop: Math.round(height * (even ? g + 1 : tiles - g) / segments) + "px"
                      , borderTop: style
                      , borderBottom: style
                      , opacity: opacity
                      , zIndex: 19000
                    }
                }).appendTo(self.$node);
            }
        }


        /**
         * Render a crosshair cursor.
         */
        function _renderCrosshairCursor(invisible, syncOnly) {
            if (self.cursors != null) {
                self.cursors.remove();
            }

            var commonStyles = {
                position: "absolute"
              , zIndex: 20000
            };
            if (!!invisible) {
                commonStyles["display"] = "none";
            }
            
            var borderStyle = !!syncOnly ? "dashed" : "solid";

            self.horizontalCrosshairCursor = $("<div>", {
                css: $.extend({
                    width: 0
                  , height: _getInnerHeight() + "px"
                  , borderRight: "1px " + borderStyle + " " + self.options.crosshairColor
                }, commonStyles)
            }).appendTo(self.$node);

            if (!syncOnly) {
                self.verticalCrosshairCursor = $("<div>", {
                    css: $.extend({
                        width: self.options.width + "px"
                      , height: 0
                      , borderBottom: "1px " + borderStyle + " " + self.options.crosshairColor
                    }, commonStyles)
                }).appendTo(self.$node);
            }

            self.cursors = self.horizontalCrosshairCursor.add(self.verticalCrosshairCursor);
        }


        /**
         * Render coordinate readings.
         */
        function _renderCoordinates(invisible) {
            if (self.coordinates != null) {
                self.coordinates.remove();
            }

            var commonStyles = {
                position: "absolute"
              , zIndex: 20000
              , font: $.zig.constants.FONT
              , color: self.options.coordinatesColor
              , lineHeight: $.zig.constants.TEXT_LINE_HEIGHT + "px"
              , "-moz-user-select": "-moz-none"
              , "-webkit-user-select": "none"
              , "-o-user-select": "none"
              , "user-select": "none"
            };
            if (!!invisible) {
                commonStyles.display = "none";
            }

            self.positionIndex = $("<div>", {
                css: $.extend({
                    marginTop: (_getInnerHeight() - $.zig.constants.TEXT_LINE_HEIGHT - 2) + "px"
                }, commonStyles)
              , unselectable: "on"
            }).appendTo(self.$node);

            self.positionReadings = $("<div>", {
                css: $.extend({
                    marginTop: (_getInnerHeight() - $.zig.constants.TEXT_LINE_HEIGHT - 2) + "px"
                }, commonStyles)
              , unselectable: "on"
            }).appendTo(self.$node);

            self.positionValue = $("<div>", {
                css: $.extend({
                    textAlign: "right"
                  , width: self.options.width + "px"
                }, commonStyles)
              , unselectable: "on"
            }).appendTo(self.$node);

            self.coordinates = self.positionIndex.add(self.positionReadings).add(self.positionValue);
        }


        /**
         * Update coordinate readings.
         */
        function _updateCoordinate(value, axis) {
            if (axis == "vertical") {
                if (self.isOnPath && !self.isModeGraphStats) {
                    return;
                }

                var height = _getInnerHeight(),
                    top = value,
                    displayValue = Math.round((height - value) / height * self.maxCeiling);

                if (self.maxCeiling / self.options.height > 2) {
                    displayValue = Math.round(displayValue / 10) * 10;
                }

                if (value > Math.ceil(height * 0.5)) {
                    top -= $.zig.constants.TEXT_LINE_HEIGHT;
                }

                self.positionValue
                    .css({
                        display: "block"
                      , marginTop: top + "px"
                    })
                    .text(displayValue + " " + self.options.unit);
            } else {
                /* Needed for mouse pans. */
                self.lastHorizontalX = value;

                var currentOrientation = value < Math.ceil(self.options.width * 0.5),
                    styles = {};

                if (currentOrientation != self.horizontalOrientation) {
                    self.horizontalOrientation = currentOrientation;

                    styles.textAlign = currentOrientation ? "left" : "right";
                    if (!currentOrientation) {
                        styles.marginLeft = 0;
                    }
                }
                if (currentOrientation) {
                    styles.marginLeft = (value + 4) + "px";
                    styles.width = (self.options.width - value - 4) + "px";
                } else {
                    styles.width = (value - 2) + "px";
                }

                /*
                 * Render label if set, otherwise render the sample's index.
                 */
                var sample = Math.floor((value + self.scrollPosition) / self.options.sampleRenderWidth);
                self.positionIndex.text(
                    !!self.sampleLabels[sample] ? self.sampleLabels[sample] : sample + 1
                );

                /*
                 * Update sample index and sample readings styles.
                 */
                if (!self.isOnPath) {
                    styles.display = "none";
                    self.positionReadings.css(styles);

                    styles.display = "block";
                    self.positionIndex.css(styles);                    
                } else {
                    self.ceilingText.css("opacity", (value < self.ceilingText.outerWidth()) ? 0.2 : 1);

                    styles.display = "block";
                    self.positionReadings.css(styles);

                    styles.marginTop = "2px";
                    self.positionIndex.css(styles);
                }
            }
        }


        /**
         * Render the scrollbar track and scroller elements.
         */
        function _renderScrollbar() {
            var trackStyle = {
                position: "absolute"
              , height: self.options.scrollbarHeight + "px"
              , backgroundColor: "#fff"
              , padding: "1px"
              , cursor: "pointer"
            };

            if (self.options.borderColor == "transparent") {
                self.scrollbarBorderTransparent = true;
                self.maxScrollerWidth = self.options.width;

                $.extend(trackStyle, {
                    width: self.options.width + "px"
                  , paddingLeft: "0"
                  , marginTop: (self.options.height - self.options.scrollbarHeight + 2
                                    - $.zig.constants.SCROLLBAR_HEIGHT_BASE) + "px"
                  , padding: "1px 1px 0 1px"
                });
            } else {
                self.scrollbarBorderTransparent = false;
                self.maxScrollerWidth = self.options.width - 2;

                $.extend(trackStyle, {
                    width: (self.options.width - 2) + "px"
                  , marginTop: (self.options.height - self.options.scrollbarHeight
                                    - $.zig.constants.SCROLLBAR_HEIGHT_BASE) + "px"
                  , borderTop: "1px solid " + self.options.borderColor
                  , borderRight: "1px solid " + self.options.borderColor
                });
            }

            self.scrollbarTrack = $("<div>", {
                css: trackStyle
            }).appendTo(self.$node);

            self.scrollbarScroller = $("<span>", {
                "class": "zig-scrollbar-scroller"
              , css: {
                    display: "inline-block"
                  , position: "absolute"
                  , height: self.options.scrollbarHeight + "px"
                  , backgroundColor: self.options.scrollbarColor
                  , cursor: "pointer"
                }
              , data: {
                  "backref.zig": self
              }
            }).appendTo(self.scrollbarTrack);

            /*
             * Bind mouse down/up events only once for all instances.
             */
            if (!$.prototype.zig.hasMouseEventsBound) {
                $.prototype.zig.hasMouseEventsBound = true;

                $(document).bind({
                    "mousedown.zig": $.prototype.zig.handleMouseDown 
                  , "mouseup.zig": $.prototype.zig.handleMouseUp
                  , "mouseout.zig": $.prototype.zig.handleMouseOut
                });
            }
        }


        /**
         * Scroll all graphs to the given relative position.
         */
        function _scrollChartTo(percentage, needsRedraw) {
            /* Update edges of chart to indicate excess content. */
            if (!self.scrollbarBorderTransparent && self.hasScrollbar) {
                self.$node.css({
                    borderLeftStyle: (percentage == 0) ? "solid" : "dashed"
                  , borderRightStyle: (percentage == 100) ? "solid" : "dashed"
                });
            }

            /*
             * Update clipping.
             */
            var chartWidth = self.sampleCountMax * self.options.sampleRenderWidth,
                scrollableExcess = chartWidth - self.options.width,
                scrollPosition = Math.round(scrollableExcess / 100 * percentage),
                left = self.graphClipOffset + scrollPosition,
                styles = {
                    clip: "rect("
                        + "0px"
                        + " " + (self.options.width + left) + "px"
                        + " " + _getInnerHeight() + "px"
                        + " " + left + "px"
                    + ")"
                  , marginLeft: "-" + left + "px"
                },
                containers = self.graphContainer, ids = self.graphIds,
                counter = self.graphCount;
            while (counter--) {
                containers[ids[counter]].css(styles);
            }

            /*
             * Redraw track and scroller.
             */
            if (needsRedraw) {
                self.scrollerWidth = self.options.width / chartWidth * self.maxScrollerWidth;
                self.scrollRatio = chartWidth / self.options.width;

                /* Update scroller position and dimensions. */
                self.scrollbarScroller.css({
                    width: Math.round(self.scrollerWidth) + "px"
                  , marginLeft: _getScrollerPosition(percentage) + "px"
                });

                /* Indicate max scroll position. */
                self.scrollMax = scrollableExcess;

                /* Default scroll position is at the right edge of the chart. */
                self.scrollPosition = scrollableExcess;
            }
        }


        /**
         * Update cursor and scrolling via mouse moves.
         */
        function _handleMouseMove(event) {
            /* Needed for on-the-fly switching of cursor type. */
            self.lastPageX = event.pageX;
            self.lastPageY = event.pageY;

            if (self.isScrolling) {
                var scrollDiff = self.scrollStartX - event.pageX;

                if (scrollDiff == 0) {
                    return;
                } else {
                    self.lastScrollDiff = scrollDiff * self.scrollRatio;

                    var targetPosition = self.scrollPosition - self.lastScrollDiff;

                    /* Constrain scroller position. */
                    targetPosition = Math.min(Math.max(0, targetPosition), self.scrollMax);

                    /* Determine scroll offset. */
                    var percentage = targetPosition / self.scrollMax * 100;

                    /* Update scroller position. */
                    self.scrollbarScroller.css("margin-left", _getScrollerPosition(percentage) + "px");

                    /* Update canvas scroll position. */
                    _scrollChartTo(percentage, false);

                    /*
                     * Update scroll position in synchronized charts.
                     */
                    var counter = self.synchronizedTo.length;
                    while (counter--) {
                        self.synchronizedTo[counter].scrollTo(percentage);
                    }
                }
            } else {
                var offset = self.$node.offset(),
                    height = _getInnerHeight(),
                    x = Math.floor(event.pageX - offset.left),
                    y = Math.floor(event.pageY - offset.top);

                if (x >= self.options.width || y >= height || (self.isModeGraphStats && y < 15)) { // TODO: find exact y threshold
                    _clearGraphTrace(false);
                } else {
                    var index = Math.floor((x + self.scrollPosition) / self.options.sampleRenderWidth);
                    
                    // TODO: cleanup
                    if (!self.isModeGraphStats) {
                    
                        /* Determine which graphs the cursor is tracing. */
                        var trace = _traceCursorPosition(x + self.scrollPosition, y);
                        
                        /* ... */
                        self.highlightSet = trace.highlightSet.concat();
                        self.opacityMap = trace.targetOpacity;
                        
                        /* Highlight graphs and render sample readings at the cursor position. */
                        _highlightGraphs(index, trace.highlightSet, trace.targetOpacity);
                    
                    } else {
                        var jgj = self.highlightSet[0];
                         _highlightGraphs(index, self.highlightSet, {jgj: 1});
                    }
                    
                    if (self.useCustomCursor) {
                        self.horizontalCrosshairCursor.css({
                            display: "block"
                          , paddingLeft: x + "px"
                        });

                        self.verticalCrosshairCursor.css({
                            display: "block"
                          , paddingTop: y + "px"
                        });
                    }

                    if (self.options.showCoordinates) {
                        _updateCoordinate(x, "horizontal");
                        _updateCoordinate(y, "vertical");
                    }

                    /*
                     * Update cursor and highlights in synchronized charts.
                     */
                    // if (!self.isModeGraphStats) {
                    var counter = self.synchronizedTo.length, instance;
                    while (counter--) {
                        instance = self.synchronizedTo[counter]; 
                        instance.moveSyncCursorTo(x).highlightGraphs(
                            Math.floor((x + instance.scrollPosition) / instance.options.sampleRenderWidth), 
                            self.highlightSet, self.opacityMap // trace.targetOpacity
                        );
                    }
                    // }
                }
            }
        }


        /**
         * Update cursor and scrolling via mouse-wheel or trackpad movement.
         */
        function _handleMousePan(event) {
            if (!self.hasScrollbar) {
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
                var columnWidth = self.options.sampleRenderWidth,
                    targetPosition = self.scrollPosition + Math.ceil(delta);

                /* Constrain scroller position. */
                targetPosition = Math.min(Math.max(0, targetPosition), self.scrollMax);

                self.scrollPosition = targetPosition;

                var x = self.lastHorizontalX,
                    sample = Math.floor((x - x % columnWidth + self.scrollPosition) / columnWidth);

                self.options.showCoordinates && self.positionIndex.text(
                    !!self.sampleLabels[sample] ? self.sampleLabels[sample] : sample + 1
                );

                /* Determine scroll offset. */
                var percentage = targetPosition / self.scrollMax * 100;

                /* Update scroller position. */
                self.scrollbarScroller.css("margin-left", _getScrollerPosition(percentage) + "px");

                /* Update canvas scroll position. */
                _scrollChartTo(percentage, false);

                /*
                 * Synchronize scroll position and sample index reading.
                 */
                var counter = self.synchronizedTo.length, instance;
                while (counter--) {
                    instance = self.synchronizedTo[counter];

                    instance.scrollTo(percentage);
                    instance.options.showCoordinates && instance.positionIndex.text(
                        Math.floor((instance.lastHorizontalX + instance.scrollPosition) / instance.options.sampleRenderWidth) + 1
                    );
                }

                /*
                 * Revert coordinates to defaults.
                 */
                self.positionValue.css("display", "block");
                self.positionReadings.css("display", "none");
                self.ceilingText.css("opacity", 1);                    
                    
                if (self.isOnPath) {
                    /* Clear highlights in this chart. */
                    _highlightGraphs(false);
        
                    /* Clear cursor and highlights in synchronized charts. */
                    var d = self.synchronizedTo.length;
                    while (d--) {
                        self.synchronizedTo[d].highlightGraphs(false);
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
           	if (!self.hasFocus) {
                self.hasFocus = true;
                
                if (!self.isScrolling) {
                
	                self.useCustomCursor && self.cursors.css("display", "block");
	                self.options.showCoordinates && self.coordinates.css("display", "block");
	                
	                /* ... */
	                var counter = self.synchronizedTo.length;
	                while (counter--) {
	                    self.synchronizedTo[counter].enableSyncCursor().obscureVerticalGrid();
	                }
	            }                
            }
        }


        /**
         * Handle the mouse leaving the chart.
         */
        function _handleMouseLeave(event) {
            if (!self.isScrolling) {
                /* Check that mouse cursor actually left the canvas. */
                /* if (!!event && $(event.relatedTarget).closest("#" + self.id).size()) {
                    return;
                } */
    			
    			self.hasFocus = false;
                _clearGraphTrace(true);
            } else { // TODO: only if cursor actually left the track
                self.isScrolling = false;

                /* Constrain and save scroller position. */
                self.scrollPosition = Math.min(self.scrollMax,
                    Math.max(0, self.scrollPosition - self.lastScrollDiff)
                );
            }
        }


        /**
         * Clear the cursor, highlights and coordinates in this chart and synchronized charts.
         */
        function _clearGraphTrace(fullSync) {
            self.useCustomCursor && self.cursors.css("display", "none");
            self.options.showCoordinates && self.coordinates.css("display", "none");

            /* Clear highlights in this chart. */
            _highlightGraphs(false);

            /* Clear cursor and highlights in synchronized charts. */
            var d = self.synchronizedTo.length, instance;
            while (d--) {
                instance = self.synchronizedTo[d];
                instance.disableSyncCursor().unobscureVerticalGrid();
                instance.options.showCoordinates && instance.coordinates.css("display", "none");
                if (!!fullSync) {
                    instance.highlightGraphs(false);    
                }                
            }            
        }
        
        
        /**
         * Update sample readings.
         */
        function _traceCursorPosition(x, y) {
            var innerHeight = _getInnerHeight();

            /* Check if cursor left the canvas. */
            if (x >= self.options.width + self.scrollPosition || y >= innerHeight) {
                self.isOnPath = false;
                return;
            }

            var absY = innerHeight - y,
                scaleFactor = self.maxCeiling / innerHeight,
                value = absY * scaleFactor,
                lowerBoundary = (absY - 6) * scaleFactor,
                upperBoundary = (absY + 6) * scaleFactor,
                index = Math.floor(x / self.options.sampleRenderWidth),
                rawSamples = self.rawSamples, samples, current,
                idSet = self.graphIds, containers = self.graphContainer,
                highlightSet = [], targetOpacity = {}, 
                length = self.graphCount,
                supportsPixelRetrieval = self.options.defaultRenderPath == "auto" && $.prototype.zig.supportsPixelRetrieval,
                id, hit, d = 0;

            do {
                id = idSet[d], samples = rawSamples[id];

                /* In case this graph does not exist on chart. */
                if (!samples || containers[id].css("visibility") == "hidden") continue;

                current = samples[index];
                if (self.hasFilledPaths) {
                    hit = current >= value;
                } else {
                    hit = (current >= lowerBoundary && current <= upperBoundary
                            || current <= value && samples[index + 1] >= value);
                }

                if (!hit && supportsPixelRetrieval && id in self.canvasSegmentWidths) {
                    var segmentWidths = self.canvasSegmentWidths[id], segments = segmentWidths.length, segmentWidth,
                        contexts = self.canvasSegmentContexts[id],
                        position = 0, s = -1;
                    while (++s < segments) {
                        segmentWidth = segmentWidths[s];
                        if (x + self.graphClipOffset < position + segmentWidth) {
                            /* Correct x-position relative to segment offset and canvas clip-offset. */
                            var reading = contexts[s].getImageData(x + self.graphClipOffset - (s ? position : 0), y, 1, 1).data;
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
            
            if (hasHighlights || self.isOnPath) {
                var restore = !hasHighlights && self.isOnPath;
                
                if (!!targetOpacity && !$.isEmptyObject(targetOpacity) || restore) {
                    /* Determine foremost plane index. */
                    if (!restore) {
                        var foremostPlane = -1, 
                            graph = highlightSet.length, indices = self.planeIndex;
                        while (graph--) {
                            foremostPlane = Math.max(self.planeIndex[highlightSet[graph]], foremostPlane);
                        }   
                    }
                    
                    var containers = self.graphContainer, ids = self.graphIds,
                        counter = self.graphCount, id;    
                    while (counter--) {
                        id = ids[counter];
    
                        if (restore) {
                            containers[id].css("opacity", 1);
                        } else if (self.hasFilledPaths && self.planeIndex[id] < foremostPlane) {
                            containers[id].css("opacity", 0.2);
                        } else {
                            containers[id].css("opacity", targetOpacity[id]);
                        }
                     }
                 }

                 if (self.options.showCoordinates && hasHighlights) {
                    /* Move sample index reading to the top of the chart. */
                    self.positionIndex.css("margin-top", "2px");
                    
                    self.positionValue.css("display", "none");
                    self.positionReadings.empty();
                    if (hasHighlights && !self.isOnPath) {
                        self.positionReadings.css("display", "block");
                    }
                    
                    /* Re-order according to creation time. */                     
                    highlightSet = _getSortedGraphIds(highlightSet, index);
                            
                    /* Render sample readings top to bottom. */        
                    var d = highlightSet.length - 1, id;
                    do {
                        id = highlightSet[d];
                        if (!(id in self.sampleReadings)) {
                            self.sampleReadings[id] = $("<span>", {
                                css: {
                                    border: "1px solid " + (self.config[id].highlightBorderColor || self.config[id].lineColor)
                                  , borderTopWidth: "3px"
                                  , padding: "2px"
                                  , color: self.config[id].highlightTextColor || self.options.coordinatesColor
                                  , backgroundColor: self.config[id].highlightBackgroundColor || self.options.canvasColor
                                  , "-moz-user-select": "-moz-none"
                                  , "-webkit-user-select": "none"
                                  , "-o-user-select": "none"
                                  , "user-select": "none"
                                }
                              , unselectable: "on"
                            });
                        }
                        self.sampleReadings[id].text(
                            self.rawSamples[id][index] + " " + self.options.unit
                        ).appendTo(self.positionReadings);
        
                       $("<br>").appendTo(self.positionReadings);
                    } while (d--);
        
                    var height = $.zig.constants.TEXT_LINE_HEIGHT + 1 + 2 + 2 + 3 + 4;
                    self.positionReadings.css({
                        marginTop: (_getInnerHeight() - height * highlightSet.length) + "px"
                      , lineHeight: height + "px"
                    });                     
                } else if (restore) {
                    /* Move sample index reading to the bottom of the chart. */
                    self.positionIndex.css("margin-top", (_getInnerHeight() - $.zig.constants.TEXT_LINE_HEIGHT - 2) + "px");

                    self.positionReadings.css("display", "none");
                    self.ceilingText.css("opacity", 1);
                }
            }
            self.isOnPath = hasHighlights;            
        }
        
        
        /**
         * Sort graph IDs according to the sample value at the given index.
         */
        function _getSortedGraphIds(graphs, index) {
            var length = graphs.length;
            
            if (length == 1) {
                return graphs;
            } else if (length == 2) {
                if (self.rawSamples[graphs[0]][index] > self.rawSamples[graphs[1]][index]) {
                    return [graphs[1], graphs[0]];
                } else {
                    return graphs;
                }
            } else {
                var rawSamples = self.rawSamples, 
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
            self.graphClipOffset = 0;

            var isCanvas = $.prototype.zig.supportsCanvas && self.options.defaultRenderPath == "auto";

            /* Re-init <canvas> segments. */
            if (isCanvas) {
                self.canvasSegmentContexts = {};
                self.canvasSegmentWidths = {};
            }

            if (rescale) {
                var scaleFactor = _getInnerHeight() / self.maxCeiling;
            }

            var counter = self.graphCount, id;
            while (counter--) {
                id = self.graphIds[counter];

                if (self.rawSamples[id].length) {
                    if (isCanvas) {
                        self.graphContainer[id].css({
                            clip: "auto"
                          , marginLeft: 0
                        });
                    }
                    self.graphContainer[id].find("li").remove();

                    if (rescale) {
                        self.scaledSamples[id] = [];
                        var rawSamples = self.rawSamples[id],
                            sampleCount = rawSamples.length, s = 0;
                        do {
                            self.scaledSamples[id].push(Math.floor(rawSamples[s] * scaleFactor));
                        } while (++s < sampleCount);
                    }

                    _functorRenderSamples(id, self.scaledSamples[id], self.scaledSamples[id][0], 0);
                }
            }
        }


        /**
         * Return the usable inner height of the chart.
         */
        function _getInnerHeight() {
            var height = self.options.height;
            if (self.hasScrollbar) {
                height -= self.options.scrollbarHeight + $.zig.constants.SCROLLBAR_HEIGHT_BASE;
                if (self.scrollbarBorderTransparent) {
                    height += 2;
                }
            }
            return height;
        }


        /**
         * Return the scroller position within the scrollbar track.
         */
        function _getScrollerPosition(percentage) {
            return Math.round((self.maxScrollerWidth - self.scrollerWidth) * percentage / 100);
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
            var samples = [], rawSamples = self.rawSamples, ids = self.graphIds,
                counter = self.graphCount;
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
            self.hasScrollbar = false;
            self.scrollbarTrack.remove();
            if (!self.scrollbarBorderTransparent) {
                self.$node.css({
                    borderLeftStyle: "solid"
                  , borderRightStyle: "solid"
                });
            }

            self.options.showVerticalGrid && _renderVerticalGrid();

            _renderCursorControls(true);
        }


        /**
         * Add, rescale and render sample data to the given graph.
         */
        function _addSamples(id, samples, labels) {
            if (!$.isArray(samples)) {
                samples = [samples];
            }
            // TODO: optimize this
            if ($.grep(samples, function (element) { return $.type(element) != "number" || element < 0 || parseInt(element, 10) !== element; }).length) {
                console.log(samples)
                throw "Must only add positive integer numbers (base 10) as sample values."
            }

            var sampleCount = self.rawSamples[id].length,
                addCount = samples.length,
                continueIndex = sampleCount - 1,
                needsRedraw = false, hasOverflow = false;

            /*
             * Detect clipping.
             */
            if (sampleCount + addCount > self.maxSamples) {
                if (self.options.overflow == "clip") {
                    if (addCount > self.maxSamples) {
                        samples = samples.slice(addCount - self.maxSamples);
                        addCount = samples.length;
                    }

                    if (sampleCount) {
                        var skip = sampleCount + addCount - self.maxSamples;

                        self.graphClipOffset += skip * self.options.sampleRenderWidth;

                        /*
                         * Shave off leading elements across all paths.
                         */
                        var counter = self.graphCount, graph;
                        while (counter--) {
                            graph = self.graphIds[counter];
                            self.rawSamples[graph] = self.rawSamples[graph].slice(skip);
                            self.scaledSamples[graph] = self.scaledSamples[graph].slice(skip);
                        }

                        sampleCount = self.rawSamples[id].length;

                        hasOverflow = true;

                        continueIndex -= addCount;
                    }
                } else if (self.options.overflow == "scroll" && !self.hasScrollbar) {
                    self.hasScrollbar = true;
                    self.options.showVerticalGrid && _renderVerticalGrid();
                    _renderScrollbar();
                    _renderCursorControls(true);
                }
            }

            /*
             * Adjust max ceiling.
             */
            var ceiling = _getCeiling(Math.max.apply(Math, samples));
            if (ceiling > self.maxCeiling) {
                self.maxCeiling = ceiling;

                if (self.options.overflow == "scroll" && (sampleCount + addCount <= self.maxSamples || self.hasScrollbar)) {
                    /* Only rescale now when no overflow occurs. */
                    _redrawChart(true);
                } else if (self.options.overflow == "clip" && hasOverflow) {
                    needsRedraw = true;
                }
            }

            /* Update ceiling text in any case. */
            self.ceilingText.text(self.maxCeiling + " " + self.options.unit);

            /* Append raw sample value(s). */
            self.rawSamples[id].push.apply(self.rawSamples[id], samples);

            /*
             * Scale samples if necessary, and render graph.
             */
            if (needsRedraw) {
                _redrawChart(true);
            } else {
                var scaledSamples = self.scaledSamples[id],
                    scaleFactor = _getInnerHeight() / self.maxCeiling,
                    buffer = [], s = 0;
                do {
                    buffer.push(Math.floor(samples[s] * scaleFactor));
                } while (++s < addCount);
                self.scaledSamples[id] = scaledSamples.concat(buffer);

                _functorRenderSamples(id, buffer, self.scaledSamples[id][Math.max(continueIndex, 0)], sampleCount);
            }

            /*
             * Assign labels to samples.
             */
            if (!$.type(labels) == "number") {
                labels = [labels];
            }
            if ($.isArray(labels) && labels.length) {
                var s = 0, offset = Math.max(continueIndex + 1, 0);
                do {
                    self.sampleLabels[offset + s] = labels[s];
                } while (++s < labels.length);
            }

            /* Determine sample count over all graphs, and scroll to the right edge. */
            self.sampleCountMax = _getMaxSampleCount();
            if (self.hasScrollbar) {
                _scrollChartTo(100, true);
            } else if (self.graphClipOffset) {
                var styles = {
                        clip: "rect("
                                + "0px"
                                + " " + (self.options.width + self.graphClipOffset) + "px"
                                + " " + _getInnerHeight() + "px"
                                + " " + self.graphClipOffset + "px"
                            + ")"
                      , marginLeft: "-" + self.graphClipOffset + "px"
                    },
                    counter = self.graphCount;
                while (counter--) {
                    self.graphContainer[self.graphIds[counter]].css(styles);
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
        self.addSamples = function (id, samples, labels) {
            if ($.type(id) == "number" || $.isArray(id)) {
                if (self.defaultGraph != null) {
                    labels = samples;
                    samples = id;
                    id = self.defaultGraph;
                } else {
                    throw "Must specify a valid diagram ID as first parameter.";
                }
            } else if ($.type(id) == "object") {
                labels = samples;
                samples = id;
            } else if (!(id in self.rawSamples)) {
                throw "Unknown diagram with this ID: " + id;
            }

            if ($.type(samples) == "object") {
                for (var set in samples) {
                    if (samples.hasOwnProperty(set)) {
                        _addSamples(set, samples[set], labels);
                    }
                }
            } else {
                _addSamples(id, samples, labels);
            }
        };


        /**
         * Synchronize this chart to all jquery-zig charts specified by the given selector.
         */
        self.synchronize = function (selector) {
            $(selector).each(function (index, element) {
                var instance = $(this).data("plugin.zig");
                if (!!instance) {
                    self.synchronizedTo.push(instance);
                    instance.synchronizedTo.push(self);
                }
            });
        };
        

        /**
         * Purge the specified graph, and reset sample data for that graph.
         */
        self.purge = function (id) {
            if (!(id in self.config)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                self.graphContainer[id].find("li").remove();

                /* Re-init <canvas> segments. */
                if ($.prototype.zig.supportsCanvas && self.options.defaultRenderPath == "auto") {
                    delete self.canvasSegmentContexts[id];
                    delete self.canvasSegmentWidths[id];
                }

                self.rawSamples[id] = [];
                self.scaledSamples[id] = [];

                self.sampleCountMax = _getMaxSampleCount();

                if (self.graphCount == 1 || !self.sampleCountMax) {
                    self.graphClipOffset = 0;
                    self.sampleLabels = [];

                    if (self.options.overflow == "scroll" && self.hasScrollbar) {
                        _removeScrollbar();
                    }

                    self.ceilingText.text("");
                }
            }
        };


        /**
         * Purge all graphs in this chart.
         */
        self.purgeAll = function () {
            var containers = self.graphContainer, ids = self.graphIds,
                counter = self.graphCount;
            while (counter--) {
                containers[ids[counter]].find("li").remove();
            }

            /* Re-init <canvas> segments. */
            if ($.prototype.zig.supportsCanvas && self.options.defaultRenderPath == "auto") {
                self.canvasSegmentContexts = {};
                self.canvasSegmentWidths = {};
            }

            self.rawSamples = {};
            self.scaledSamples = {};

            self.sampleCountMax = 0;

            self.graphClipOffset = 0;
            self.sampleLabels = [];

            if (self.options.overflow == "scroll" && self.hasScrollbar) {
                _removeScrollbar();
            }

            self.ceilingText.text("");
        };


        /**
         * Return the smallest sample value in the given graph.
         */
        self.getStatMin = function (id) {
            if (!(id in self.rawSamples)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                return Math.min.apply(Math, self.rawSamples[id]);
            }
        };
        
        
        /**
         * Return the largest sample value in the given graph.
         */
        self.getStatMax = function (id) {
            if (!(id in self.rawSamples)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                return Math.max.apply(Math, self.rawSamples[id]);
            }
        };
        
        
        /**
         * Return the arithmetic mean of sample values in the given graph.
         */
        self.getStatMean = self.getStatArithmeticMean = function (id) {
            if (!(id in self.rawSamples)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                var samples = self.rawSamples[id], length = samples.length, counter = length, sum = 0;
                while (counter--) {
                    sum += samples[counter];
                }
                return sum / length;
            }
        };
        
        
        /**
         * Return the geometric mean of sample values in the given graph.
         */
        self.getStatGeometricMean = function (id) {
            if (!(id in self.rawSamples)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                var Mlog = Math.log, samples = self.rawSamples[id], length = samples.length, counter = length, log = 0;
                while (counter--) {
                    log += Mlog(samples[counter]);
                }
                return Math.pow(Math.E, log / length);
            }
        };
        
  
        /**
         * Return the median of sample values in the given graph.
         */
        self.getStatMedian = function (id) {
            if (!(id in self.rawSamples)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                var samples = self.rawSamples[id].concat().sort(function (a, b) { return a - b; }), 
                    length = samples.length;
                if (length % 2) {
                    return samples[length >>> 1];
                } else {
                    return (samples[length / 2 - 1] + samples[length / 2]) / 2;
                }
            }
        }            
        

        /**
         * Return the variance of sample values in the given graph.
         */
        self.getStatVariance = function (id) {
            if (!(id in self.rawSamples)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                var Mpow = Math.pow, samples = self.rawSamples[id], length = samples.length, counter = length, variance = 0,
                    mean = self.getStatArithmeticMean(id);
                while (counter--) {
                    variance += Math.pow(samples[counter] - mean, 2);
                }
                return variance / (length - 1);
            }
        };
        
                
        /**
         * Return the standard deviation of sample values in the given graph.
         */
        self.getStatStdDev = function (id) {
            if (!(id in self.rawSamples)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                return Math.sqrt(self.getStatVariance(id));
            }
        };
        
        
        /**
         * Return a snapshot of the current chart as an <img>.
         */
        self.getSnapshot = function () {
            throw "Not implemented yet.";
        };


        /**
         * Hide a given graph.
         */
        self.hideGraph = function (id) {
            if (!(id in self.graphContainer)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                self.graphContainer[id].css("visibility", "hidden");
            }
        };


        /**
         * Unhide a given graph.
         */
        self.unhideGraph = self.showGraph = function (id) {
            if (!(id in self.graphContainer)) {
                throw "Must specify a valid diagram ID as first parameter.";
            } else {
                self.graphContainer[id].css("visibility", "visible");
            }
        };


        /**
         * Force redraw of all graphs in this chart.
         */
        self.redraw = function () {
            _redrawChart(false);

            self.hasScrollbar && _scrollChartTo(100, true);
        };


        /**
         * Scroll all graphs to the given relative position.
         */
        self.scrollTo = function (percentage) {
            if (!$.type(percentage) == "number") {
                throw "Must specify a percentage as first parameter.";
            }

            /* Update canvas scroll position. */
            _scrollChartTo(percentage, false);

            /* Update scroller position. */
            self.hasScrollbar && self.scrollbarScroller.css("margin-left", _getScrollerPosition(percentage) + "px");

            /* Update internal scroll position marker. */
            self.scrollPosition = Math.round(self.scrollMax * percentage / 100);
        };


        /**
         * Highlight selected graphs and update sample readings for these graphs.
         */
        self.highlightGraphs = function (index, highlightSet, targetOpacity) {
            _highlightGraphs(index, highlightSet, targetOpacity);
            
            return self;
        };
        
                    
        /**
         * Hide the vertical grid.
         */
        self.obscureVerticalGrid = function () {
            self.options.showVerticalGrid && self.$node.find(".zig-vertical-grid").css("opacity", 0.2);
        };


        /**
         * Unhide the vertical grid.
         */
        self.unobscureVerticalGrid = self.showVerticalGrid = function () {
            self.options.showVerticalGrid && self.$node.find(".zig-vertical-grid").css("opacity", self.options.verticalGridOpacity);
        };                    


        /**
         * Turn on the horizontal cursor in a synchronized chart.
         */
        self.enableSyncCursor = function () {
            if (self.cursors == null) {
                _renderCrosshairCursor(false, true);
            } else {
                self.horizontalCrosshairCursor.css({
                    "display": "block"
                  , "border-style": "dashed"
                }); 
            }
            
            return self;
        };


        /**
         * Programmatically move the cursor (not the mouse pointer) to the given x-coordinate.
         */
        self.moveSyncCursorTo = function (x) {
            self.horizontalCrosshairCursor.css("padding-left", x + "px");
            self.options.showCoordinates && _updateCoordinate(x, "horizontal");
            
            return self;
        };


        /**
         *  Turn off the horizontal cursor in a synchronized chart.
         */
        self.disableSyncCursor = function () {
            self.horizontalCrosshairCursor.css("display", "none");
            self.options.showCoordinates && self.positionIndex.css("display", "none");
            
            self.horizontalCrosshairCursor.css("border-style", "solid");
            
            return self;
        };
        
        
        /**
         * ...
         */
        self.getInnerHeight = function () {
            return _getInnerHeight();
        };
        

        /**
         * ...
         */        
		self.renderChartLegend = function () {
            if (self.legend !== null) {
                self.legend.remove();
            }
            
            self.legend = $("<div>", {
                css: {
                    position: "absolute"
                  , zIndex: 20000
                  , width: (self.options.width - 4) + "px"
                  , height: "10px"
                  , top: "4px"
                  , right: "4px"
                  , cursor: "default"
                  , font: $.zig.constants.FONT
                  , lineHeight: "8px"
                  , textAlign: "right"
                }
            }).appendTo(self.$node);
            
            // TODO: really delegate?
            self.legend.delegate("span", {
                mouseenter: function (event) {
                    if (!$(this).data("selected.zig")) {
                        $(this).css("opacity", 1);
                    }   
                }
              , mouseleave: function (event) {
                    if (!$(this).data("selected.zig")) {
                        $(this).css("opacity", 0.2);
                    }   
              }
              // , click: function (event) {}
            });
            
            var counter = -1;
            while (++counter < self.graphCount) {
                var id = self.graphIds[counter],
                    isHighlighted = $.inArray(id, self.highlightSet) != -1;
                
                var item = $("<span>", {
                    css: {
                        marginLeft: "8px"
                      , opacity: isHighlighted ? 1 : 0.2
                      , cursor: isHighlighted ? "default" : "pointer"
                    }
                  , data: {
                      "id.zig": id
                    , "selected.zig": isHighlighted
                  }
                }).appendTo(self.legend);
                
                if (isHighlighted) {
                    $("<samp>", {
                        css: {
                            display: "inline-block"
                          , width: "6px"
                          , height: "3px"
                          , border: "1px solid " + self.config[id].lineColor
                          , borderTopWidth: "4px"
                          , backgroundColor: self.config[id].lineColor
                        }
                    }).appendTo(item);
                } else {
                    self.graphContainer[id].css("visibility", "hidden");
                    
                    $("<samp>", {
                        css: {
                            display: "inline-block"
                          , width: "6px"
                          , height: "3px"
                          , border: "1px solid " + self.config[id].lineColor
                          , borderTopWidth: "4px"
                          , backgroundColor: "transparent"
                        }
                    }).appendTo(item);
                }
                
                $("<samp>", {
                    css: {
                        display: "inline-block"
                      , paddingLeft: "4px"
                      , font: $.zig.constants.FONT
                      , lineHeight: "8px"
                    }
                  , text: id
                }).appendTo(item);
            }
            
            $("<abbr>", {
                css: {
                    marginLeft: "16px"
                  , cursor: "pointer"
                  , opacity: 0.2
                }
              , html: "&times;"
            }).appendTo(self.legend);
        };
        
        
		/**
         * ...
         */
        self.renderStatisticsOverlays = function (id) {
            var mean = self.getStatArithmeticMean(id), stdDev = self.getStatStdDev(id);
            
            var innerHeight = self.getInnerHeight(),
                scaleFactor = innerHeight / self.maxCeiling,
                scaledMin = Math.floor(self.getStatMin(id) * scaleFactor),
                scaledMax = Math.ceil(self.getStatMax(id) * scaleFactor),
                scaledMean = Math.round(mean * scaleFactor),
                scaledStdDevTop = Math.floor((mean + stdDev) * scaleFactor),
                scaledStdDevBottom = Math.floor((mean - stdDev) * scaleFactor);                    
            
            if (self.overlayRange === null) {
                self.overlayRange = $("<div>", {
                    css: {
                        position: "absolute"
                      , zIndex: 500
                      , width: self.options.width + "px"
                      , height: (scaledMax - scaledMin - 1) + "px"
                      , backgroundColor: self.config[id].statRangeColor
                      , marginTop: (innerHeight - scaledMax) + "px"
                      , borderTop: "1px dotted " + self.config[id].statBoundingColor
                      , borderBottom: "1px dotted " + self.config[id].statBoundingColor
                    }
                }).appendTo(self.$node);    
            } else {
                self.overlayRange.css({
                    height: (scaledMax - scaledMin - 1) + "px"
                  , marginTop: (innerHeight - scaledMax) + "px"
                  , backgroundColor: self.config[id].statRangeColor
                  , borderColor: self.config[id].statBoundingColor
                });
            }
            
            if (self.overlayStdDev === null) {
                self.overlayStdDev = $("<div>", {
                    css: {
                        position: "absolute"
                      , zIndex: 501
                      , width: self.options.width + "px"
                      , height: (scaledStdDevTop - scaledStdDevBottom) + "px"
                      , backgroundColor: self.config[id].statDeviationColor
                      , marginTop: (innerHeight - scaledStdDevTop) + "px"
                      
                    }
                }).appendTo(self.$node);
            } else {
                self.overlayStdDev.css({
                    height: (scaledStdDevTop - scaledStdDevBottom) + "px"
                  , marginTop: (innerHeight - scaledStdDevTop) + "px"
                  , backgroundColor: self.config[id].statDeviationColor
                });
            }
            
            if (self.overlayMean === null) {
                self.overlayMean = $("<div>", {
                    css: {
                        position: "absolute"
                      , zIndex: 502
                      , width: self.options.width + "px"
                      , height: 0
                      , marginTop: (innerHeight - scaledMean) + "px"
                      , borderBottom: "1px dashed " + self.config[id].statMeanColor
                    }
                }).appendTo(self.$node);
            } else {
                self.overlayMean.css({
                    marginTop: (innerHeight - scaledMean) + "px"
                  , borderColor: self.config[id].statMeanColor
                });
            }                        
        };        


        /* Run initializer. */
        self.__init__();
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
      
        /* URL of none.cur file (applies only to MSIE) */
      , msieNoneCursorUrl: ""

        /* CSS color code of the coordinate readings. */
      , coordinatesColor: "#000"

        /* CSS color code of the ceiling text. */
      , scaleColor: "#000" // TODO: rename to generic term so we can use this for legend as well

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
        MAGIC: "F2093817-A62B-4C5B-9BA6-E16018BDA86E"
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
            var instance = this.data("plugin.zig") || this.parent().data("plugin.zig");
            if (!instance) {
                throw "Selected element(s) must be initialized first before calling methods through jQuery.zig";
            } else {
                var result = instance[options].apply(this, Array.prototype.slice.call(arguments, 1));
                return (!options.indexOf("getStat")) ? result : instance.$node;
            }
        } else if ($.type(options) == "object" || !options) {
            return this.each(function () {
                (new $.zig(this, options));
            });
        } else {
            throw "Method " + options.valueOf() + "() does not exist on jQuery.zig";
        }
    };

}(jQuery);
