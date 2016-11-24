/*jshint esversion: 6 */

import {ReactomePathway} from '../src/reactome-pathway.js';
import {PathwayModel} from '../src/model.js';
import d3 from 'd3';
import insertCSS from 'insert-css';
import CSS from '../src/style.scss';

insertCSS(CSS);
//console.log(CSS);
//console.log(new ReactomePathway());
//console.log(PathwayModel);

function readTextFile(file)
{
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status === 0)
            {
                var allText = rawFile.responseText;
                var pathwayModel = new PathwayModel();
                
                pathwayModel.parse(allText);

                var div = document.createElement("div");
                div.setAttribute("id", "test");
                document.body.appendChild(div);

                var config = {
                    container: '#test',
                    onNodeClick: (d3Event, node, svg) => {
                        console.log(svg);
                    }
                };
                var reactomePathway = new ReactomePathway(config);
                reactomePathway.render(allText, []);
                //var legendSvg = reactomePathway.getLegend(370, 671);
                //console.log(legendSvg);
                //document.body.appendChild(legendSvg);
            }
        }
    };
    rawFile.send(null);
}
readTextFile("../test/egfr.xml");