import {ReactomePathway} from '../src/reactome-pathway.js';
import {PathwayModel} from '../src/model.js';
import insertCSS from 'insert-css';
import CSS from '../src/style.scss';

insertCSS(CSS);
console.log(CSS);
console.log(new ReactomePathway());
console.log(PathwayModel);

var pathwayModel = new PathwayModel();

console.log(pathwayModel);

function readTextFile(file)
{
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                var pathwayModel = new PathwayModel();
                
                pathwayModel.parse(allText);
                
                console.log(pathwayModel.getNodes());

                var div = document.createElement("div");
                div.setAttribute("id", "test");
                document.body.appendChild(div);

                var reactomePathway = new ReactomePathway();
                console.log(reactomePathway);
                reactomePathway.render(allText, []);
            }
        }
    }
    rawFile.send(null);
}
readTextFile("../src/egfr.xml");