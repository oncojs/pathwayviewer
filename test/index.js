import {ReactomePathway, PathwayModel} from '../src';

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
                var div = document.createElement("div");
                document.body.appendChild(div);

                var config = {
                    containerNode: div,
                    onNodeClick: (d3Event, node, svg) => {
                        console.log(svg);
                        console.log(node);
                    },
                    model: new PathwayModel(rawFile.responseText),
                };
                var reactomePathway = new ReactomePathway(config);
                reactomePathway.render([]);
                
                var legendSvg = reactomePathway.getLegendSVGElement(370, 671);
                document.body.appendChild(legendSvg);
            }
        }
    };
    rawFile.send(null);
}
readTextFile("../test/egfr-disease.xml");