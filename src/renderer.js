/*
 * Copyright 2016(c) The Ontario Institute for Cancer Research. All rights reserved.
 *
 * This program and the accompanying materials are made available under the terms of the GNU Public
 * License v3.0. You should have received a copy of the GNU General Public License along with this
 * program. If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY
 * WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


import d3 from 'd3';
import _ from 'lodash';

export class Renderer {
  constructor(svg, config) {
    var defaultConfig = {
      onClick: _.noop,
      colors: { 
        stroke: '#696969',
        mutationHighlight: '#9b315b',
        drugHighlight: 'navy',
        overlap : '#000000',
        subPathway: 'blue',
      },
      urlPath: '',
    };

    this.svg = svg;
    this.config = _.defaultsDeep({}, config, defaultConfig);
    this.colors = this.config.colors;
    this.urlPath = this.config.urlPath;
    
    this.modelObjectToSVG = new WeakMap();
    this.defineDefs(this.svg, this.colors);
  }

  defineDefs(svg, colors){
    var strokeColor =  colors.stroke;
    var markers = [
      'Output','Activator','ProcessNode','RenderableInteraction','GeneArrow','Catalyst',
      'Catalyst-legend','Activator-legend','Output-legend','Inhibitor','Inhibitor-legend'
    ];
    
    var isBaseMarker = function(type){
      return _.contains(['Output','Activator','Catalyst','Inhibitor'], type); // Part of subpathway reactions
    };
    
    var filled = function(type){
      return _.contains(['Output','RenderableInteraction','Output-legend','GeneArrow'], type);
    };
    
    var isCircular = function(type){return _.contains(['Catalyst','Catalyst-legend'], type);};
    var shifted = function(type){return _.contains(['Catalyst','Activator'], type);};
    var isLinear = function(type){return _.contains(['Inhibitor','Inhibitor-legend'], type);};

    var circle = {
      'element':'circle',
      'attr': {
        'cx':10,
        'cy':0,
        'r':10,
        'stroke-width':'2px',
        'markerWidth':'8',
        'markerHeight':'8'
      },
      'viewBox':'0 -14 26 28',
      'refX':'20'
    };

    var arrow = {
      'element':'path',
      'attr': {
        d:'M0,-5L10,0L0,5L0,-5',
        'stroke-width':'1px',
        markerWidth:'8',
        markerHeight:'8'
      },
      refX: '10',
      viewBox:'0 -6 12 11'
    };

    var line = {
      'element':'path',
      'attr':{
        d:'M0,-6L0,6',
        'stroke-width':'2px',
        markerWidth:'8',
        markerHeight:'8'
      },
      refX: '0',
      viewBox:'0 -6 2 11'
    };

    var defs = svg.append('svg:defs');

    // Provides the grayscale filter in case of disease pathways
    defs.append('svg:filter').attr({
      id: 'grayscale'
    }).append('feColorMatrix').attr({
      type: 'matrix',
      values: '0.5066 0.3333 0.3333 0 0 0.3333 0.5066 0.3333 0 0 0.3333 0.3333 0.5066 0 0 0 0 0 1 0'
    });

    var blurFilter = defs.append('svg:filter').attr({
      id: 'glow'
    });

    blurFilter.append('feGaussianBlur').attr({
      stdDeviation: '2',
      result: 'coloredBlur'
    });

    var blurFilterMerge = blurFilter.append('feMerge');

    blurFilterMerge
      .append('feMergeNode')
      .attr({'in': 'coloredBlur'});

    blurFilterMerge
      .append('feMergeNode')
      .attr({'in': 'SourceGraphic'});

    var blurFilter2 = defs.append('svg:filter').attr({
      id: 'blur',
      x: '-30',
      y: '-30',
      height: '65',
      width: '65'
    });

    blurFilter2.append('feGaussianBlur').attr({
      stdDeviation: '1.5',
      result: 'newBlur',
      in: 'SourceGraphic'
    });

    markers.forEach(function (elem) {
      var def;
      if(isCircular(elem)) {
        def = circle;
      } else if(isLinear(elem)) {
        def = line;
      } else {
        def = arrow;
      }

      var color = strokeColor;

      // Special arrow for genes (see react_11118 for an example)
      if(elem === 'GeneArrow'){
        def.attr.markerWidth = 5;
        def.attr.markerHeight = 5;
        color = 'black';
      }

      defs.append('svg:marker').attr({
        'id': elem,
        'viewBox': def.viewBox,
        'refX': (+def.refX)*(shifted(elem)?1.5:1),
        'markerHeight':def.attr.markerHeight,
        'markerWidth':def.attr.markerWidth,
        'orient':'auto'
      }).append(def.element)
        .attr(def.attr)
        .attr('stroke',color)
        .style('fill',filled(elem)?color:'white');

      if(isBaseMarker(elem)){
        color = colors.subPathwayColor;

        defs.append('svg:marker')
          .attr({
            'id': elem+'-subpathway',
            'viewBox': def.viewBox,
            'refX': (+def.refX)*(shifted(elem)?1.5:1),
            'markerHeight':def.attr.markerHeight,
            'markerWidth':def.attr.markerWidth,
            'orient':'auto'
        }).append(def.element)
          .attr(def.attr)
          .attr('stroke',color)
          .style('fill',filled(elem)?color:'white');
      }
    });
  }

  getSVGForModelObject(modelObject) {
    this.modelObjectToSVG.get(modelObject);
  }

  /*
  * Constants used to specify the highlight treatment of a gene.
  * */
  //Renderer.prototype.HIGH_LIGHT_TYPE = {MUTATION: 1, GENE_OVERLAP: 2};

  /*
  * Renders the background compartments along with its specially position text
  */
  renderCompartments(compartments) {
    this.svg.selectAll('.RenderableCompartment').data(compartments).enter().append('rect').attr({
      'class': function(d) {
        return 'node ' + d.type + ' compartment'+d.reactomeId;
      },
      'x': function(d) {return d.position.x;},
      'y': function(d) {return d.position.y;},
      'width': function(d) {return d.size.width;},
      'height': function(d) {return d.size.height;},
      rx: 3,
      ry: 3
    });

    this.svg.selectAll('.RenderableCompartmentText').data(compartments).enter().append('foreignObject').attr({
      'class': function(d) {return 'node ' + d.type+'Text RenderableCompartmentText';},
      'x': function(d) {return d.text.position.x;},
      'y': function(d) {return d.text.position.y;},
      'width': function(d) {return d.size.width;},
      'height': function(d) {return d.size.height;},
      'pointer-events':'none',
      'fill':'none'
    }).append('xhtml:body')
      .attr('class','RenderableCompartmentText')
      .html(function(d) {
        return '<table class="RenderableNodeTextCell"><tr><td valign="middle">'+
        d.text.content+'</td></tr></table>';
      });
  }

  /*
  * Render all the nodes and their text
  */
  renderNodes(nodes) {
    var svg = this.svg;
    // Split into normal rectangles and octagons based on node type
    var octs = _.filter(nodes,function(n) {return n.type === 'RenderableComplex';});
    var rects = _.filter(nodes,function(n) {return n.type !== 'RenderableComplex';});
    var crossed = _.filter(nodes, function(n) {return n.crossed === true;});

    var pointMapToString = function(map) {
      var val = '';
      map.forEach(function (elem) {
        val= val + elem.x + ',' + elem.y + ' ';
      });
      return val;
    };

    // Create a point map for the octagons
    var getPointsMap = function(x,y,w,h,a){
      var points = [
        {x:x+a,   y:y},
        {x:x+w-a, y:y},
        {x:x+w,   y:y+a},
        {x:x+w,   y:y+h-a},
        {x:x+w-a, y:y+h},
        {x:x+a,   y:y+h},
        {x:x,     y:y+h-a},
        {x:x,     y:y+a}
      ];
      return pointMapToString(points);
    };

    var getCrossMap = function(x,y,w,h){
      var points = [
        {x:x, y:y},
        {x:x+w, y:y+h}
      ];
      return pointMapToString(points);
    };

    var getReverseCrossMap = function(x,y,w,h){
      var points = [
        {x:x, y:y+h},
        {x:x+w, y:y}
      ];
      return pointMapToString(points);
    };

    // Render all complexes as octagons
    svg.selectAll('.RenderableOct').data(octs).enter().append('polygon')
      .attr({
        'class': function(d) {return 'node pathway-node RenderableOct RenderableComplex entity'+d.id;},
        'filter': function(d) {
          if (d.grayed) {
            return (typeof this.urlPath==='undefined') ? '' : 'url(\''+ this.urlPath+'#grayscale\')';
          } else {
            return '';
          }
        },
        'points': function (d) {
          return getPointsMap(+d.position.x, +d.position.y, +d.size.width, +d.size.height, 4);
        },
        'stroke': 'Red',
        'stroke-width': 1,
        'entity-id': d => d.id,
      }).on('mouseover', function (d) {
        var rect  = d3.select(this);
        var oldFill = d3.rgb(rect.style('fill'));
        
        rect.attr('oldFill', oldFill);
        rect.style('fill', oldFill.brighter(0.25));
      }).on('mouseout', function (d) {
        var rect = d3.select(this);
        
        rect.style('fill', rect.attr('oldFill'));
        rect.attr('oldFill', null)
      }).on('click', this.config.onClick);

    // Render all other normal rectangular nodes after octagons
    svg.selectAll('.RenderableRect').data(rects).enter().append('rect')
      .attr({
        'class': function (d) {return 'node pathway-node RenderableRect ' + d.type + ' entity'+d.id;},
        'filter': function (d) {
          if (d.grayed) {
            return (typeof this.urlPath==='undefined') ? '' : 'url(\''+this.urlPath+'#grayscale\')';
          } else {
            return '';
          }
        },
        'x': function (d) {return d.position.x;},
        'y': function (d) {return d.position.y;},
        'width': function (d) {return d.size.width;},
        'height': function (d) {return d.size.height;},
        'rx': function (d) {
          switch (d.type) {
            case 'RenderableGene':
            case 'RenderableEntitySet':
            case 'RenderableEntity':
              return 0;
            case 'RenderableChemical':
              return d.size.width / 2;
            case 'RenderableFailed':
              return d.size.width / 2;
            default:
              return 3;
          }
        },
        'ry': function (d) {
          switch (d.type) {
            case 'RenderableGene':
            case 'RenderableEntitySet':
            case 'RenderableEntity':
              return 0;
            case 'RenderableChemical':
              return d.size.width / 2;
            case 'RenderableFailed':
              return d.size.width / 2;
            default:
              return 3;
          }
        },
        'stroke-dasharray': function (d) { //Gene has border on bottom and right side
          if (d.type === 'RenderableGene'){
            return 0 + ' ' + ((+d.size.width) + 1) + ' ' + ((+d.size.height) + (+d.size.width)) + ' 0';
          } else{
            return '';
          }
        },
        'pointer-events':function(d) {return d.type==='RenderableGene'?'none':'';}
      }).on('mouseover', function (d) {
        var rect  = d3.select(this);
        var oldFill = d3.rgb(rect.style('fill'));
        
        rect.attr('oldFill', oldFill);
        rect.style('fill', oldFill.brighter(0.25));
      }).on('mouseout', function (d) {
        var rect = d3.select(this);
        
        rect.style('fill', rect.attr('oldFill'));
        rect.attr('oldFill', null)
      }).on('click',this.config.onClick);

      svg.selectAll('.crossed').data(crossed).enter()
      .append('polyline').attr({
        'class': 'node CrossedNode',
        'fill': 'none',
        'stroke': 'red',
        'stroke-width': '2',
        'points': function(d) {return getCrossMap(+d.position.x, +d.position.y, +d.size.width, +d.size.height);}
      });

      svg.selectAll('.crossed').data(crossed).enter()
      .append('polyline').attr({
        'class': 'node CrossedNode',
        'fill': 'none',
        'stroke': 'red',
        'stroke-width': '2',
        'points': function(d) {
          return getReverseCrossMap(+d.position.x, +d.position.y, +d.size.width, +d.size.height);
        }
      });

      // Add a foreignObject to contain all text so that wrapping is done for us
      svg.selectAll('.RenderableText').data(nodes).enter().append('foreignObject').attr({
        'class':function(d){return d.type+'Text RenderableText';},
        'x':function(d){return d.position.x;},
        'y':function(d){return d.position.y;},
        'width':function(d){return d.size.width;},
        'height':function(d){return d.size.height;},
        'pointer-events':'none',
        'fill':'none'
      }).append('xhtml:body')
        .attr('class','node-text-body RenderableNodeText')
        .html(function(d){
          if (d.lof) {
            var lofClass = 'lof-'+ d.type;
            return '<table class="RenderableNodeTextCell ' + lofClass +'">' +
                   '<tr><td style="max-width:'+d.size.width+'px;" class="RenderableNodeTextCell lof-cell" ' +
                   ' valign="middle">' + d.text.content+'</td></tr></table>';
          } else if (d.overlaid && !d.crossed) {
            return '<table class="RenderableNodeTextCell">' +
                   '<tr><td style="max-width:'+d.size.width+'px;" valign="middle">' +
                   '<span class="span__'+ d.type +'">'+
                   d.text.content+'</span></td></tr></table>';
          } else {
            return '<table class="RenderableNodeTextCell">' +
                   '<tr><td style="max-width:'+d.size.width+'px;" valign="middle">'+
                   d.text.content+'</td></tr></table>';
          }
        }
      );

      // if it's a gene, we have to add a special array in the top right corner
      var genes =  _.where(nodes,{type : 'RenderableGene'});

      svg.selectAll('.RenderableGeneArrow').data(genes).enter().append('line').attr({
        'class':'node RenderableGeneArrow',
        'x1':function(d){return (+d.position.x)+(+d.size.width) - 0.5;},
        'y1':function(d){return (+d.position.y) +1;},
        'x2':function(d){return (+d.position.x)+(+d.size.width)  + 5.5;},
        'y2':function(d){return (+d.position.y) + 1;},
      }).attr('stroke','black')
        .attr('marker-end','url("' + this.urlPath + '#GeneArrow")');

      var modelObjectToSVG = this.modelObjectToSVG;
      svg.selectAll('.node').each(
        function(d) {
          modelObjectToSVG.set(d, this);
        }
      );
      console.log(this.modelObjectToSVG);
  }

  /*
  * Renders all connecting edges and their arrow heads where appropriate
  */
  renderEdges(edges) {
    var svg = this.svg;  
    var colors = this.colors;

    // In the odd case that there are layers of the same node/reaction, order things so that the
    // edges with markers (arrow heads, etc.) are on top.
    edges = _.sortBy(edges, function(n) {return n.marked?1:0;});

    var isStartMarker = function(type) {return _.contains(['FlowLine','RenderableInteraction'],type);};
    var isLink = function(type) { return _.contains(['EntitySetAndMemberLink', 'EntitySetAndEntitySetLink'],type);};

    svg.selectAll('line').data(edges).enter().append('line').attr({
      'class':function(d) {
        var classes = 'RenderableStroke reaction'+d.id+' '+d.type;
        if (d.failedReaction) {
          classes += ' ' + 'failed-reaction';
        }
        return classes;
      },
      'filter': function(d) {
        if (d.grayed || d.overlapping) {
          return (typeof this.urlPath==='undefined') ? '' : 'url(\''+ this.urlPath+'#grayscale\')';
        } else {
          return '';
        }
      },
      'x1':function(d) {return d.x1;},
      'y1':function(d) {return d.y1;},
      'x2':function(d) {return d.x2;},
      'y2':function(d) {return d.y2;},
      'stroke': colors.stroke
    }).attr({
        'marker-start':function(d) {
          return d.marked && isStartMarker(d.marker) && !isLink(d.type)?
          'url("' + this.urlPath + '#' + d.marker + '")' : '';
        },
        'marker-end':function(d) {
          return d.marked && !isStartMarker(d.marker) && !isLink(d.type)?
          'url("' + this.urlPath + '#' + d.marker + '")' : '';
        }
    });
  }

  /*
  * Render a label in the middle of the line to indicate the type
  */
  renderReactionLabels(labels, legend) {
    var size = 7, svg = this.svg, colors = this.colors;
    var circular = ['Association','Dissociation','Binding'];
    var filled = ['Association','Binding'];

    // Add lines behind labels for legend to make it looks more realistic
    if (legend){
      svg.selectAll('.pathway-legend-line').data(labels).enter().append('line').attr({
        'class':'pathway-legend-line',
        'x1':function(d) {return (+d.x)-30;},
        'y1':function(d) {return d.y;},
        'x2':function(d) {return (+d.x)+30;},
        'y2':function(d) {return d.y;},
        'stroke':colors.stroke
      });
    }

    svg.selectAll('.RenderableReactionLabel').data(labels).enter().append('rect')
      .attr({
        'class':function(d) {return 'RenderableReactionLabel reaction'+d.id;},
        'x':function(d) {return +d.x - (size/2);},
        'y':function(d) {return +d.y - (size/2);},
        'rx':function(d) {return _.contains(circular,d.reactionType)?(size/2):'';},
        'ry':function(d) {return _.contains(circular,d.reactionType)?(size/2):'';},
        'width':size,
        'height':size,
        'stroke':colors.stroke
      }).style('fill',function(d) {return _.contains(filled,d.reactionType)?colors.stroke:'white';})
      .on('mouseover',function(d) {
        console.log(d.description);
      });

    svg.selectAll('.ReactionLabelText').data(labels).enter().append('text')
      .attr({
        'class':'ReactionLabelText',
        'x':function(d) {return +d.x - (size/4);},
        'y':function(d) {return +d.y + (size/4);},
        'font-weight':'bold',
        'font-size':'8px',
        'fill':colors.stroke
      }).text(function(d) {
        if (d.reactionType === 'Omitted Process') {
          return '\\\\';
        } else if (d.reactionType === 'Uncertain') {
          return '?';
        } else {
          return '';
        }
      });
  }

  /*
  * Highlights the given list of nodes with a red border and puts
  *   the 'value' of the node in a badge in the top right corner
  *
  * Takes an array of Highlight and the model
  * Highlight: { id, value }
  *
  */
  highlightEntity(mutationHighlights, drugHighlights, overlaps, model) {
    var svg = this.svg;
    var config = this.config;

    // Remove old highlights if there are any
    svg.selectAll('.banner-text').remove();
    svg.selectAll('.value-banner').remove();
    svg.selectAll('.pathway-node').style('stroke','').style('stroke-width','');

    _drawAnnotations({
      type: 'mutation',
      nodeValues: _getNodeValues(mutationHighlights), 
      location: 'right', 
      color: config.colors.mutationHighlightColor
    });
    _drawAnnotations({
      type: 'drug', 
      nodeValues: _getNodeValues(drugHighlights),
      location: 'left', 
      color: config.colors.drugHighlightColor
    });

    var link = (typeof config.urlPath === 'undefined') ? '' : 'url(\'' + config.urlPath + '#blur\')';
    _.keys(overlaps).forEach(function (id) {
      var nodes = model.getNodesByReactomeId(id);

      nodes.forEach(function (node) {
        //console.warn('Overlap found for node: ', node);

        var svgNode = svg.selectAll('.entity'+node.id);
        svgNode.style({
          'stroke': config.overlap,
          'stroke-width': '5px'
        })
        .attr('filter', link ?  link : '')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round');
      });
    });

    function _getNodeValues(highlights) {
      var nodeValues = {};
      var highlighted = [];

      // Compute final highlight text value first
      highlights.forEach(function (highlight) {
        var nodes = model.getNodesByReactomeId(highlight.id);

        if (nodes.length === 0) {
          return;
        }

        nodes.forEach(function (node) {
          var renderedValue = highlight.value;

          if (highlighted.indexOf(node.id) >= 0){
            nodeValues[node.id] =  '*';
          } else {
            nodeValues[node.id] =  renderedValue;
            highlighted.push(node.id);
          }
        });
      });

      return nodeValues;
    }

    function _drawAnnotations(annotations) {
      var nodeValues = annotations.nodeValues;
      var location = annotations.location;
      var color = annotations.color;

      // Add SVG elements to nodes with highlight values
      for (var nodeId in nodeValues) {
        if (!(nodeValues.hasOwnProperty(nodeId))) {
          continue;
        }

        var svgNode = svg.selectAll('.entity'+model.getNodeById(nodeId).id);
        svgNode.style('stroke-width','3px');

        var renderedValue = nodeValues[nodeId];

        // Draw rectangular container for annotation
        svg.append('rect').attr({
          class:'value-banner value-banner'+nodeId,
          x: _coordinates(nodeId, location),
          y: _coordinates(nodeId, 'top'),
          width:(renderedValue.toString().length*5)+10,
          height:15,
          rx: 7,
          ry: 7,
        }).style({
          fill:color
        });

        // Draw annotation value inside container
        svg.append('text').attr({
          'class':'banner-text banner-text'+nodeId,
          'x': _coordinates(nodeId, location, true),
          'y': _coordinates(nodeId, 'top', true),
          'pointer-events':'none',
          'font-size':'9px',
          'font-weight':'bold',
          'fill':'white'
        }).text(renderedValue);
      }

      function _coordinates(nodeId, location, forText) {
        var node = model.getNodeById(nodeId);
        var renderedValue = nodeValues[nodeId];

        var coordinateFunctionMap = {
          left : function(forText) {
            var leftX = (+node.position.x) - ((renderedValue.toString().length * 5) + 10) + 10;
            if (forText) {
              leftX += 5;
            }

            return leftX;
          },
          right : function(forText) {
            var rightX = (+node.position.x) + (+node.size.width) - 10;
            if (forText) {
              rightX += 5;
            }

            return rightX;
          },
          top : function(forText) {
            var topY = (+node.position.y) - 7;
            if (forText) {
              topY += 11;
            }

            return topY;
          }
        };

        return coordinateFunctionMap[location](forText);
      }
    }
  }

  outlineSubPathway(svg, reactomeId) {
    svg.selectAll('.reaction'+reactomeId)
      .attr('stroke',this.config.subPathwayColor)
      .classed('pathway-sub-reaction-line',true);
  }
}