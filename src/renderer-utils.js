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

'use strict';

import _ from 'lodash';

export default class RendererUtils {
  /*
  * Create an array of reaction labels for every reaction based on its type
  */
  generateReactionLabels(reactions) {
    var labels = [];

    reactions.forEach(function (reaction) {
      var hasBase = _.some(reaction.nodes, function(node) {
        return (node.base && node.base.length > 0);
      });

      if (hasBase){
        labels.push({
          x:reaction.center.x,
          y:reaction.center.y,
          reactionType:reaction.type,
          description:reaction.description,
          id:reaction.reactomeId
        });
      }
    });
    
    return labels;
  }

  /*
  * Goes through the model's reactions and creates a large arrays of all lines
  *  based on the human-curated list of points.
  */
  generateLines(model) {
    var lines = [];
    var reactions = model.getReactions();

    // Make sure arrow heads aren't added to special dashed lines
    var isArrowHeadLine = function(type) {
      return !_.includes(['entitysetandmemberlink','entitysetandentitysetlink','missing'],type);
    };

    // Adds a line to the lines array gives an array of points and description of the line
    var generateLine = function (points, color, type, id, lineType, failed) {
      for (var j = 0; j < points.length - 1; j++) {
        lines.push({
          x1: points[j].x,
          y1: points[j].y,
          x2: points[j+1].x,
          y2: points[j+1].y,
          marked: j === points.length-2 && isArrowHeadLine(lineType) && type!=='missing',
          marker: type,
          color: color, // For debugging, every line type has a color
          id:id,
          type: lineType,
          failedReaction: failed
        });
      }
    };

    // Gets the center of node with its position and size
    var getNodeCenter = function (nodeId) {
      var node = model.getNodeById(nodeId);
      
      // Genes are special because they are not boxes.. just an arrow
      if (node.type === 'RenderableGene'){
        return {x: (+node.position.x) + (+node.size.width) + 5,y:node.position.y};
      }

      return {
        x: ((+node.position.x) + (+node.size.width/2)),
        y: ((+node.position.y) + (+node.size.height/2))
      };
    };

    // Gets the first input node in a reaction (used when the reaction
    //  has no human-curated node lines)
    var getFirstInputNode =  function(nodes){
      return _.find(nodes, {type:'Input'});
    };

    // Generate a line based on the type of reaction & node using human-curated points
    var getNodeLines = function (reaction, node, reactionId, reactionClass, failed) {
      var count = {inputs:0,outputs:0};
      if (!node.base || node.base.length === 0) {
        return 'missing';
      }
      var base =  node.base.slice();

      // eslint-disable-next-line default-case
      switch (node.type) {
        case 'Input':
          base.push(reaction.base[0]);
          base[0] = getNodeCenter(node.id);
          generateLine(base, 'red', 'Input', reactionId, reactionClass, failed);
          count.inputs = count.inputs + 1;
          break;
        case 'Output':
          base.push(reaction.center);
          base.reverse(); // Make sure output points at the output
          generateLine(base, 'green', 'Output', reactionId,reactionClass, failed);
          count.outputs = count.outputs + 1;
          break;
        case 'Activator':
          base.push(reaction.center);
          base[0] = getNodeCenter(node.id);
          generateLine(base, 'blue', 'Activator', reactionId, reactionClass, failed);
          break;
        case 'Catalyst':
          base.push(reaction.center);
          base[0] = getNodeCenter(node.id);
          generateLine(base, 'purple', 'Catalyst', reactionId, reactionClass, failed);
          break;
        case 'Inhibitor':
          base.push(reaction.center);
          base[0] = getNodeCenter(node.id);
          generateLine(base, 'orange', 'Inhibitor', reactionId, reactionClass, failed);
          break;
      }

      return node.type;
    };

    reactions.forEach(function (reaction) {
      var id = reaction.reactomeId;
      var addedTypes = [];

      reaction.nodes.forEach(function (node) {
        addedTypes.push(getNodeLines(reaction, node, id, reaction.class, reaction.failedReaction));
      });

      var hasInputs = _.includes(addedTypes,'Input');
      var hasOutputs =  _.includes(addedTypes,'Output');

      // If it doesn't have human-curated input lines, "snap" line to first input node, if it has one
      if (!hasInputs && getFirstInputNode(reaction.nodes)) {
        reaction.base[0] = getNodeCenter(getFirstInputNode(reaction.nodes).id);
      }
      var baseLine = reaction.base.slice();
      if (hasOutputs) {
        baseLine.pop(); // It's duplicated
      }

      // This creates a base reaction line
      generateLine(baseLine,
        hasOutputs ? 'black':'navy',
        hasOutputs ? reaction.type:'Output', id, reaction.class, reaction.failedReaction
      );
    });

    return lines;
  }

  /*
  * Create a grid of all nodes for legend
  */
  getLegendNodes (marginLeft,marginTop, svg) {
    var nodes = [];
    var mutatedNodeText = 'Mutated Gene(s)';
    var druggableNodeText = 'Targetable Gene(s)';
    var overlappedNodeText = 'Overlapping Gene(s)';
    var failedText = 'Failed Output';
    var lofText = 'LossOfFunction';
    var x = marginLeft, y= marginTop;
    var types = [
      'Complex','Protein',
      'EntitySet','Chemical',
      'Compartment','ProcessNode',
      failedText,lofText,
      mutatedNodeText, null, 
      druggableNodeText, null,
      overlappedNodeText
    ];

    for(var i=0;i<types.length;i++){
      x = i%2 === 0 ? marginLeft : marginLeft+130;
      y = Math.floor(i/2)*40 + marginTop + 5*Math.floor(i/2);
      var type = types[i];

      if (type === null) {
        continue;
      }

      var node = {
        position: {x:x, y:y},
        size: {width:110, height:30},
        type: _getNodeType(type),
        id: _getIDForType(type),
        crossed: type === failedText ? true : false,
        lof: type === lofText ? true : false,
        grayed: false,
        reactomeId: _getIDForType(type),
        text: {content:type, position:{x:x, y:y}}
      };

      nodes.push(node);

      if (type === mutatedNodeText) {
        addMutatedNodeComment();
      }

      if (type === druggableNodeText) {
        addDruggableNodeComment();
      }
    }

    return nodes;

    function _getIDForType(type) {
      var _id = 'fake';

      switch(type) {
        case mutatedNodeText:
          _id = 'mutated';
          break;
        case druggableNodeText:
          _id = 'druggable';
          break;
        case overlappedNodeText:
          _id = 'overlapping';
          break;
        default:
          break;
        }

      return _id;
    }

    function _getNodeType(type) {
      var newType = 'Renderable'+type;

      switch(type) {
        case 'ProcessNode':
          newType = type;
          break;
        case failedText:
          newType ='RenderableFailed';
          break;
        case overlappedNodeText:
          newType = 'RenderableOverlappedEntitySet';
          break;
        case lofText:
          newType ='RenderableEntitySet';
          break;
        default:
          break;
      }

      return newType;
    }

    function addMutatedNodeComment() {
      // Add extra comment for mutated gene node to show what the value in the corner means
      svg.append('foreignObject').attr({
        x: marginLeft+100,
        y: y - 15,
        width:100,
        height:35,
        'fill':'none'
      }).append('xhtml:body')
        .attr('class','RenderableNodeText')
        .html('<table class="RenderableNodeTextCell"><tr><td valign="middle">'+
              '<--- # ICGC Mutations'+'</td></tr></table>');
    }

    function addDruggableNodeComment() {
      // Add extra comment for druggable gene node to show what the value in the corner means
      svg.append('foreignObject').attr({
        x: 5,
        y: y - 22,
        width:275,
        height:35,
        'fill':'none'
      }).append('xhtml:body')
        .attr('class','RenderableNodeText')
        .html('<table class="RenderableNodeTextCell"><tr><td valign="middle">'+
              '<------------------------------ # Targeting Compounds'+'</td></tr></table>');
    }
  }

  /*
  * Create a list of reaction lines for legend
  */
  getLegendLines(marginLeft, marginTop, svg) {
    var lines = [];
    var y=marginTop;
    var markers = ['Output','Catalyst','Activator','Inhibitor','Link','Disease-Associated'];
    markers.forEach(function(elem) {
      lines.push({
        x1: marginLeft,
        y1: y,
        x2: marginLeft+80,
        y2: y,
        marked: true,
        marker: elem + '-legend',
        color: 'black',
        id: (function(elem) {
          if (elem === 'Disease-Associated') {
            return '-failed-example';
          } else {
            return 'fake';
          }
        })(elem),
          type: elem==='Link'?'entitysetandmemberlink':'fake'
        }
      );
      svg.append('foreignObject').attr({
        x: marginLeft + 80,
        y: y - 15,
          width:105,
          height:30,
          'fill':'none'
      }).append('xhtml:body')
        .attr('class','RenderableNodeText')
        .html('<table class="RenderableNodeTextCell"><tr><td valign="middle">' + elem + '</td></tr></table>');
      y+=25;
    });

    return lines;
  }

  /*
  * Create a list of reaction lines for legend
  */
  getLegendLabels(marginLeft,marginTop,svg) {
    var labels = [];
    var y = marginTop;
    var reactions = ['Association','Dissociation','Transition','Omitted Process','Uncertain'];
    reactions.forEach(function (elem) {
      labels.push({
        x: marginLeft+40,
        y: y,
        reactionType: elem
      });
      svg.append('foreignObject').attr({
        x: marginLeft+80,
        y: y - 15,
        width: 110,
        height: 30,
        'fill':'none'
      }).append('xhtml:body')
        .attr('class','RenderableNodeText')
        .html('<table class="RenderableNodeTextCell"><tr><td valign="middle">'+
          (elem === 'Association'?'Association/Binding': elem) + '</td></tr></table>');

      y+=25;
    });

    return labels;
  }
}