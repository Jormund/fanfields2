// ==UserScript==
// @id              fanfields@heistergand
// @name            IITC plugin: Fan Fields 2
// @author          Heistergand
// @category        Layer
// @version         2.1.8
// @description     Calculate how to link the portals to create the largest tidy set of nested fields. Enable from the layer chooser.
// @match           https://intel.ingress.com/*
// @grant           none
// @downloadURL     https://github.com/Jormund/fanfields2/raw/master/iitc_plugin_fanfields2.user.js
// @updateURL       https://github.com/Jormund/fanfields2/raw/master/iitc_plugin_fanfields2.meta.js
// ==/UserScript==

/*

I FINISHED PLAYING INGRESS MONTHS AGO. NO MORE CHANGES WILL BE MADE.

THE PROJECT IS NOW ARCHIVED ON GITHUB. IF YOU LIKE TO GET UPDATES TO IT, 
DEVELOPERS CAN FORK THIS PROJECT AND CONTINUE ON THEIR OWN.

*/

/*
Version History:
2.1.8
Bookmark plugin now optional (save as bookmarks button is hidden when plugin is missing)

2.1.7
Fixed L.LatLng extension

2.1.6
Fix intel URL

2.1.5
FIX: Minor syntax issue affecting potentially more strict runtimes

2.1.4
FIX: Make the clockwise button change its label to "Counterclockwise" when toggled

2.1.3
FIX: added id tags to menu button elements, ...just because.

2.1.2
FIX: Minor issues

2.1.1
FIX: changed List export format to display as a table

2.1.0
NEW: Added save to DrawTools functionality
NEW: Added fanfield statistics
FIX: Changed some menu texts
VER: Increased Minor Version due to DrawTools Milestone

2.0.9
NEW: Added the number of outgoing links to the simple list export

2.0.8
NEW: Toggle the direction of the star-links (Inbound/Outbound) and calculate number of SBUL
FIX: Despite crosslinks, respecting the current intel did not handle done links

2.0.7
FIX: Sorting of the portals was not accurate for far distance anchors when the angle was too equal.
NEW: Added option to respect current intel and not crossing lines.

2.0.6
FIX: Plan messed up on multiple polygons.

2.0.5
FIX: fan links abandoned when Marker was outside the polygon
BUG: Issue found where plan messes up when using more than one polygon (fixed in 2.0.6)

2.0.4
NEW: Added Lock/Unlock button to freeze the plan and prevent recalculation on any events.
NEW: Added a simple text export (in a dialog box)
FIX: Several changes to the algorithm
BUG: Issue found where links are closing fields on top of portals that are
     successors in the list once you got around the startportal

2.0.3
FIX: Counterclockwise did not work properly
NEW: Save as Bookmarks (require Bookmarks plugin)

2.0.2
NEW: Added Menu
NEW: Added counterclockwise option
FIX: Minor Bugfixes

2.0.1
NEW: Count keys to farm
NEW: Count total fields
NEW: Added labels to portals
FIX: Links were drawn in random order
FIX: Only fields to the center portal were drawn

Todo:

Add a kind of system to have a cluster of Fanfields
Calculate distance to walk for the plan (crow / streets)
Calculate the most efficient possible plan based on ways to walk and keys to farm
Export to Drawtools
Export to Arcs
Export to Tasks
Bookmarks saving works, but let it also save into a Bookmarks Folder
Calculate amount of possible rebuilds after flippinig the center portal
Click on a link to flip it's direction

*/



function wrapper(plugin_info) {
    // ensure plugin framework is there, even if iitc is not yet loaded
    if(typeof window.plugin !== 'function') window.plugin = function() {};

    // PLUGIN START ////////////////////////////////////////////////////////

    // use own namespace for plugin
    window.plugin.fanfields = function() {};
    var thisplugin = window.plugin.fanfields;

    // const values
    // zoom level used for projecting points between latLng and pixel coordinates. may affect precision of triangulation
    thisplugin.PROJECT_ZOOM = 16;

    thisplugin.LABEL_WIDTH = 100;
    thisplugin.LABEL_HEIGHT = 49;

    thisplugin.labelLayers = {};

    thisplugin.startingpoint = undefined;


    thisplugin.locations = [];
    thisplugin.fanpoints = [];
    thisplugin.sortedFanpoints = [];

    thisplugin.links = [];
    thisplugin.linksLayerGroup = null;
    thisplugin.fieldsLayerGroup = null;
    thisplugin.numbersLayerGroup = null;

    thisplugin.selectPolygon = function() {};
    thisplugin.saveBookmarks = function() {

        // loop thru portals and UN-Select them for bkmrks
        var bkmrkData, list;
        thisplugin.sortedFanpoints.forEach(function(point, index) {
            bkmrkData = window.plugin.bookmarks.findByGuid(point.guid);
            if(bkmrkData) {

                list = window.plugin.bookmarks.bkmrksObj.portals;

                delete list[bkmrkData.id_folder].bkmrk[bkmrkData.id_bookmark];

                $('.bkmrk#'+bkmrkData.id_bookmark + '').remove();

                window.plugin.bookmarks.saveStorage();
                window.plugin.bookmarks.updateStarPortal();


                window.runHooks('pluginBkmrksEdit', {"target": "portal", "action": "remove", "folder": bkmrkData.id_folder, "id": bkmrkData.id_bookmark, "guid":point.guid});

                console.log('BOOKMARKS via FANFIELDS: removed portal ('+bkmrkData.id_bookmark+' situated in '+bkmrkData.id_folder+' folder)');
            }
        });
        // loop again: ordered(!) to add them as bookmarks
        thisplugin.sortedFanpoints.forEach(function(point, index) {
            if (point.guid) {
                var p = window.portals[point.guid];
                var ll = p.getLatLng();

                plugin.bookmarks.addPortalBookmark(point.guid, ll.lat+','+ll.lng, p.options.data.title);
            }
        });




    };
    thisplugin.generateTasks = function() {};
    thisplugin.reset = function() {};
    thisplugin.help = function() {
        dialog({
            html: '<p>Draw a polygon with Drawtools.<br>If you like, place a marker on a portal to enforce it to be the anchor. The marker can be outside the polygon. '+




            'Let Fanfields make the magic.</p>'+
            '<p>Use the Lock function to prevent the script from recalculating anything. This is useful if you have a large area and want to zoom into details.</p>  '+
            '<p>Try to switch your plan to counterclockwise direction. Your route might be easier or harder if you change directions. Also try different anchors to get one more field out of some portal constellations.</p> '+
            '<p>Export your fanfield portals to bookmarks to extend your possibilites to work with the information.</p>'+
            '<p>There are some known issues you should be aware of:<br>This script uses a simple method to check for crosslinks. '+
            'It may suggest links that are not possible in dense areas because <i>that last portal</i> is in the way. It means they have flipped order. '+
            'If you\'re not sure, link to the center for both portals first and see what you can link. You\'ll get the same amount of fields, but need to farm other keys.</p>'+
            '<p>When you choose an anchor in the middle of the fields, the script may try to close fields around the center too early, resulting in covered portals you did'+
            ' not link from yet. Be aware.<br>(It\'s on the todo-list though...) </p>'+
            '',
            id: 'plugin_fanfields_alert_help',
            title: 'Fan Fields - Help',
            width: 650,
            closeOnEscape: true
        });

    };

    thisplugin.showStatistics = function() {
        var text = "";
        if (this.sortedFanpoints.length > 3) {
            text = "<table><tr><td>FanPortals:</td><td>" + (thisplugin.n-1) + "</td><tr>" +
                "<tr><td>CenterKeys:</td><td>" + thisplugin.centerKeys +"</td><tr>" +
                "<tr><td>Total links / keys:</td><td>" + thisplugin.donelinks.length.toString() +"</td><tr>" +
                "<tr><td>Fields:</td><td>" + thisplugin.triangles.length.toString() +"</td><tr>" +
                "<tr><td>Build AP (links and fields):</td><td>" + (thisplugin.donelinks.length*313 + thisplugin.triangles.length*1250).toString() +"</td><tr>" +
                //"<tr><td>Destroy AP (links and fields):</td><td>" + (thisplugin.sortedFanpoints.length*187 + thisplugin.triangles.length*750).toString() + "</td><tr>" +
                "</table>";
            dialog({
                html: text,
                id: 'plugin_fanfields_alert_statistics',
                title: '== Fan Field Statistics == ',
                // width: 500,
                closeOnEscape: true
            });
        }


    }

    thisplugin.exportDrawtools = function() {
        // todo: currently the link plan added to the DrawTools Layer. We need to replace existing
        // drawn links and how about just exporting the json without saving it to the current draw?

        var alatlng, blatlng, layer;
        $.each(thisplugin.sortedFanpoints, function(index, point) {
            $.each(point.outgoing, function(targetIndex, targetPoint) {

                alatlng = map.unproject(point.point, thisplugin.PROJECT_ZOOM);
                blatlng = map.unproject(targetPoint.point, thisplugin.PROJECT_ZOOM);
                layer = L.geodesicPolyline([alatlng, blatlng], window.plugin.drawTools.lineOptions);
                window.plugin.drawTools.drawnItems.addLayer(layer);
                window.plugin.drawTools.save();
            });
        });
    }

    thisplugin.exportArcs = function() {
        //todo...
    }

    thisplugin.exportTasks = function() {
        //todo...
    }


    thisplugin.exportText = function() {
        var text = "<table><thead><tr><th style='text-align:right'>Pos.</th><th style='text-align:left'>Portal Name</th><th>Keys</th><th>Links</th></tr></thead><tbody>";

        thisplugin.sortedFanpoints.forEach(function(point, index) {
            var p, title;

            p = window.portals[point.guid];
            title = "unknown title";
            if (p !== undefined) {
                title = p.options.data.title;
            }
            text+='<tr><td>' + (index) + '</td><td>'+ title + '</td><td>' + point.incoming.length+ '</td><td>' + point.outgoing.length + '</td></tr>';
        });
        text+='</tbody></table>';
        dialog({
            html: text,
            id: 'plugin_fanfields_alert_textExport',
            title: 'Fan Fields',
            width: 500,
            closeOnEscape: true
        });

    };
    thisplugin.respectCurrentLinks = false;
    thisplugin.togglecRespectCurrentLinks = function() {
        thisplugin.respectCurrentLinks = !thisplugin.respectCurrentLinks;
        if (thisplugin.respectCurrentLinks) {
            $('#plugin_fanfields_respectbtn').html('Respect&nbsp;Intel:&nbsp;ON');
        } else {
            $('#plugin_fanfields_respectbtn').html('Respect&nbsp;Intel:&nbsp;OFF');
        }
        thisplugin.delayedUpdateLayer(0.2);
    };
    thisplugin.is_locked = false;
    thisplugin.lock = function() {
        thisplugin.is_locked = !thisplugin.is_locked;
        if (thisplugin.is_locked) {
            $('#plugin_fanfields_lockbtn').html('locked'); // &#128274;
        } else {
            $('#plugin_fanfields_lockbtn').html('unlocked'); // &#128275;
        }
    };

    thisplugin.is_clockwise = true;
    thisplugin.toggleclockwise = function() {
        thisplugin.is_clockwise = !thisplugin.is_clockwise;
        var clockwiseSymbol="", clockwiseWord="";
        if (thisplugin.is_clockwise)
            clockwiseSymbol = "&#8635;", clockwiseWord = "Clockwise";
        else
            clockwiseSymbol = "&#8634;", clockwiseWord = "Counterclockwise";
        $('#plugin_fanfields_clckwsbtn').html(clockwiseWord+':&nbsp;('+clockwiseSymbol+')');
        thisplugin.delayedUpdateLayer(0.2);
    };

    thisplugin.starDirENUM = {CENTRALIZING:-1, RADIATING: 1};
    thisplugin.stardirection = thisplugin.starDirENUM.CENTRALIZING;

    thisplugin.toggleStarDirection = function() {
        thisplugin.stardirection *= -1;
        var html = "outbounding";

        if (thisplugin.stardirection == thisplugin.starDirENUM.CENTRALIZING) {
            html = "inbounding";
        }

        $('#plugin_fanfields_stardirbtn').html(html);
        thisplugin.delayedUpdateLayer(0.2);
    };



    thisplugin.setupCSS = function() {
        $("<style>").prop("type", "text/css").html('.plugin_fanfields_btn {margin-left:2px;margin-right:6px;}' +

                                                   '.plugin_fanfields{' +
                                                   'color: #FFFFBB;' +
                                                   'font-size: 11px;'+
                                                   'line-height: 13px;' +
                                                   'text-align: left;'+
                                                   'vertical-align: bottom;'+
                                                   'padding: 2px;' +
                                                   'padding-top: 15px;' +
                                                   'overflow: hidden;' +
                                                   'text-shadow: 1px 1px #000, 1px -1px #000, -1px 1px #000, -1px -1px #000, 0 0 5px #000;' +
                                                   'pointer-events: none;' +


                                                   'width: ' + thisplugin.LABEL_WIDTH + 'px;'+
                                                   'height: '+ thisplugin.LABEL_HEIGHT + 'px;'+
                                                   'border-left-color:red; border-left-style: dotted; border-left-width: thin;'+
                                                   //                                                   'border-bottom-color:red; border-bottom-style: dashed; border-bottom-width: thin;'+

                                                   '}' +
                                                   '#plugin_fanfields_toolbox a.highlight { background-color:#ffce00; color:black; font-Weight:bold }'
                                                  ).appendTo("head");


    };
    thisplugin.getThirds = function(list, a,b) {
        var i,k;
        var linksOnA = [], linksOnB = [], result = [];
        for (i in list) {
            if ((list[i].a.equals(a) && list[i].b.equals(b)) || (list[i].a.equals(b) && list[i].b.equals(a))) {
                // link in list equals tested link
                continue;
            }
            if (list[i].a.equals(a) || list[i].b.equals(a)) linksOnA.push(list[i]);
            if (list[i].a.equals(b) || list[i].b.equals(b)) linksOnB.push(list[i]);
        }
        for (i in linksOnA) {
            for (k in linksOnB) {
                if (linksOnA[i].a.equals(linksOnB[k].a) || linksOnA[i].a.equals(linksOnB[k].b) )
                    result.push(linksOnA[i].a);
                if (linksOnA[i].b.equals(linksOnB[k].a) || linksOnA[i].b.equals(linksOnB[k].b))
                    result.push(linksOnA[i].b);
            }
        }
        return result;
    };


    thisplugin.linkExists = function(list, link) {
        var i, result = false;
        for (i in list) {
            //if ((list[i].a == link.a && list[i].b == link.b) || (list[i].a == link.b && list[i].b == link.a))
            if (thisplugin.linksEqual(list[i],link)) {
                result =  true;
                break;
            }
        }
        return result;
    };



    thisplugin.linksEqual = function(link1,link2) {
        var Aa, Ab, Ba, Bb;
        Aa =  link1.a.equals(link2.a);
        Ab =  link1.a.equals(link2.b);
        Ba =  link1.b.equals(link2.a);
        Bb =  link1.b.equals(link2.b);
        if ((Aa || Ab) && (Ba || Bb)) {
            return true;
        }
    };




    thisplugin.intersects = function(link1, link2) {
        /* Todo:
        Change vars to meet original links
        dGuid,dLatE6,dLngE6,oGuid,oLatE6,oLngE6
        */
        //console.log("FANPOINTS: DEBUG ");
        x1 = link1.a.x;
        y1 = link1.a.y;
        x2 = link1.b.x;
        y2 = link1.b.y;
        x3 = link2.a.x;
        y3 = link2.a.y;
        x4 = link2.b.x;
        y4 = link2.b.y;

        var Aa, Ab, Ba, Bb;
        Aa =  link1.a.equals(link2.a);
        Ab =  link1.a.equals(link2.b);
        Ba =  link1.b.equals(link2.a);
        Bb =  link1.b.equals(link2.b);


        if ( Aa || Ab || Ba || Bb)  {
            // intersection is at start, that's ok.
            return false;
        }

        function sameSign(n1, n2) {
            if (n1*n2 > 0) {
                return true;
            } else {
                return false;
            }
        }
        // debugger
        var a1, a2, b1, b2, c1, c2;
        var r1, r2 , r3, r4;
        var denom, offset, num;

        // Compute a1, b1, c1, where link joining points 1 and 2
        // is "a1 x + b1 y + c1 = 0".
        a1 = y2 - y1;
        b1 = x1 - x2;
        c1 = (x2 * y1) - (x1 * y2);

        // Compute r3 and r4.
        r3 = ((a1 * x3) + (b1 * y3) + c1);
        r4 = ((a1 * x4) + (b1 * y4) + c1);

        // Check signs of r3 and r4. If both point 3 and point 4 lie on
        // same side of link 1, the link segments do not intersect.
        if ((r3 !== 0) && (r4 !== 0) && (sameSign(r3, r4))){
            return 0; //return that they do not intersect
        }

        // Compute a2, b2, c2
        a2 = y4 - y3;
        b2 = x3 - x4;
        c2 = (x4 * y3) - (x3 * y4);

        // Compute r1 and r2
        r1 = (a2 * x1) + (b2 * y1) + c2;
        r2 = (a2 * x2) + (b2 * y2) + c2;

        // Check signs of r1 and r2. If both point 1 and point 2 lie
        // on same side of second link segment, the link segments do
        // not intersect.
        if ((r1 !== 0) && (r2 !== 0) && (sameSign(r1, r2))){
            return 0; //return that they do not intersect
        }

        //link segments intersect: compute intersection point.
        denom = (a1 * b2) - (a2 * b1);

        if (denom === 0) {
            return 1; //collinear
        }
        // links_intersect
        return 1; //links intersect, return true
    };

    thisplugin.removeLabel = function(guid) {
        var previousLayer = thisplugin.labelLayers[guid];
        if(previousLayer) {
            thisplugin.numbersLayerGroup.removeLayer(previousLayer);
            delete thisplugin.labelLayers[guid];
        }
    };

    thisplugin.addLabel = function(guid, latLng, labelText) {
        if (!window.map.hasLayer(thisplugin.numbersLayerGroup)) return;
        var previousLayer = thisplugin.labelLayers[guid];

        if(previousLayer) {
            //Number of Portal may have changed, so we delete the old value.
            thisplugin.numbersLayerGroup.removeLayer(previousLayer);
            delete thisplugin.labelLayers[guid];
        }

        // var d = window.portals[guid].options.data;
        // var portalName = d.title;

        var label = L.marker(latLng, {
            icon: L.divIcon({
                className: 'plugin_fanfields',
                iconAnchor: [0 ,0],
                iconSize: [thisplugin.LABEL_WIDTH,thisplugin.LABEL_HEIGHT],
                html: labelText
            }),
            guid: guid
        });
        thisplugin.labelLayers[guid] = label;
        label.addTo(thisplugin.numbersLayerGroup);

    };

    thisplugin.clearAllPortalLabels = function() {
        for (var guid in thisplugin.labelLayers) {
            thisplugin.removeLabel(guid);
        }
    };


    thisplugin.getBearing = function (a,b) {
        starting_ll = map.unproject(a, thisplugin.PROJECT_ZOOM);
        other_ll = map.unproject(b, thisplugin.PROJECT_ZOOM);
        return starting_ll.bearingToE6(other_ll);
    };

    thisplugin.bearingWord = function(bearing) {
        var bearingword = '';
        if      (bearing >=  22 && bearing <=  67) bearingword = 'NE';
        else if (bearing >=  67 && bearing <= 112) bearingword =  'E';
        else if (bearing >= 112 && bearing <= 157) bearingword = 'SE';
        else if (bearing >= 157 && bearing <= 202) bearingword =  'S';
        else if (bearing >= 202 && bearing <= 247) bearingword = 'SW';
        else if (bearing >= 247 && bearing <= 292) bearingword =  'W';
        else if (bearing >= 292 && bearing <= 337) bearingword = 'NW';
        else if (bearing >= 337 || bearing <=  22) bearingword =  'N';
        return bearingword;
    };

    thisplugin.filterPolygon = function (points, polygon) {
        var result = [];
        var guid,i,ax,ay,bx,by,la,lb,cos,alpha,det;


        for (guid in points) {
            var asum = 0;
            for (i = 0, j = polygon.length-1; i < polygon.length; j = i, ++i) {
                ax = polygon[i].x-points[guid].x;
                ay = polygon[i].y-points[guid].y;
                bx = polygon[j].x-points[guid].x;
                by = polygon[j].y-points[guid].y;
                la = Math.sqrt(ax*ax+ay*ay);
                lb = Math.sqrt(bx*bx+by*by);
                if (Math.abs(la) < 0.1 || Math.abs(lb) < 0.1 ) // the point is a vertex of the polygon
                    break;
                cos = (ax*bx+ay*by)/la/lb;
                if (cos < -1)
                    cos = -1;
                if (cos > 1)
                    cos = 1;
                alpha = Math.acos(cos);
                det = ax*by-ay*bx;
                if (Math.abs(det) < 0.1 && Math.abs(alpha - Math.PI) < 0.1) // the point is on a rib of the polygon
                    break;
                if (det >= 0)
                    asum += alpha;
                else
                    asum -= alpha;
            }
            if (i == polygon.length && Math.round(asum / Math.PI / 2) % 2 === 0)
                continue;

            result[guid] = points[guid];
        }
        return result;
    };


    thisplugin.n = 0;
    thisplugin.triangles = [];
    thisplugin.donelinks = [];
    thisplugin.updateLayer = function() {
        var a,b,c;
        var fanlinks = [], donelinks = [], maplinks = [];
        var triangles = [];
        var n = 0;
        var directiontest;
        var centerOutgoings = 0;
        var centerSbul = 0;
        var pa,i,pb,k,ll,p;
        var guid;
        var polygon,intersection;
        var starting_ll , fanpoint_ll ;
        var fp_index, fp, bearing, sublinkCount;
        thisplugin.startingpoint = undefined;
        thisplugin.startingpointGUID = "";
        thisplugin.centerKeys = 0;


        thisplugin.locations = [];
        thisplugin.fanpoints = [];



        thisplugin.links = [];
        if (!window.map.hasLayer(thisplugin.linksLayerGroup) &&
            !window.map.hasLayer(thisplugin.fieldsLayerGroup) &&
            !window.map.hasLayer(thisplugin.numbersLayerGroup))
            return;


        thisplugin.linksLayerGroup.clearLayers();
        thisplugin.fieldsLayerGroup.clearLayers();
        thisplugin.numbersLayerGroup.clearLayers();
        //thisplugin.clearAllPortalLabels();
        var ctrl = [$('.leaflet-control-layers-selector + span:contains("Fanfields links")').parent(),
                    $('.leaflet-control-layers-selector + span:contains("Fanfields fields")').parent(),
                    $('.leaflet-control-layers-selector + span:contains("Fanfields numbers")').parent()];






        for (i in plugin.drawTools.drawnItems._layers) {
            var layer = plugin.drawTools.drawnItems._layers[i];
            if (layer instanceof L.Marker) {
                thisplugin.startingpoint = map.project(layer.getLatLng(), thisplugin.PROJECT_ZOOM);
            }
        }
        function drawStartLabel(a) {
            if (n <2) return;
            var alatlng = map.unproject(a.point, thisplugin.PROJECT_ZOOM);
            var labelText = "";
            if (thisplugin.stardirection == thisplugin.starDirENUM.CENTRALIZING) {
                labelText = "START PORTAL<BR>Keys: "+ a.incoming.length +"<br>Total Fields: " + triangles.length.toString();
            }
            else {
                labelText = "START PORTAL<BR>Keys: "+ a.incoming.length +", SBUL: "+(centerSbul)+"<br>out: " + centerOutgoings + "<br>Total Fields: " + triangles.length.toString();
            }
            thisplugin.addLabel(thisplugin.startingpointGUID,alatlng,labelText);
        }

        function drawNumber(a,number) {
            if (n <2) return;
            var alatlng = map.unproject(a.point, thisplugin.PROJECT_ZOOM);
            var labelText = "";
            labelText =number + "<br>Keys: "+ a.incoming.length +"<br>out: " + a.outgoing.length;
            thisplugin.addLabel(a.guid,alatlng,labelText);
        }

        function drawLink(a, b, style) {
            var alatlng = map.unproject(a, thisplugin.PROJECT_ZOOM);
            var blatlng = map.unproject(b, thisplugin.PROJECT_ZOOM);

            var poly = L.polyline([alatlng, blatlng], style);
            poly.addTo(thisplugin.linksLayerGroup);


        }

        function drawField(a, b, c, style) {
            var alatlng = map.unproject(a, thisplugin.PROJECT_ZOOM);
            var blatlng = map.unproject(b, thisplugin.PROJECT_ZOOM);
            var clatlng = map.unproject(c, thisplugin.PROJECT_ZOOM);

            var poly = L.polygon([alatlng, blatlng, clatlng], style);
            poly.addTo(thisplugin.fieldsLayerGroup);

        }

        // var bounds = map.getBounds();
        $.each(window.portals, function(guid, portal) {
            var ll = portal.getLatLng();
            var p = map.project(ll, thisplugin.PROJECT_ZOOM);
            if (thisplugin.startingpoint !== undefined ) {
                if (p.equals(thisplugin.startingpoint))
                    thisplugin.startingpointGUID = guid;
            }

            thisplugin.locations[guid] = p;
        });

        thisplugin.intelLinks = {};
        $.each(window.links, function(guid, link) {
            //console.log('================================================================================');
            var lls = link.getLatLngs();
            var line = {a: {}, b: {} };
            var a = lls[0], b  = lls[1];

            line.a = map.project(a, thisplugin.PROJECT_ZOOM);
            line.b = map.project(b, thisplugin.PROJECT_ZOOM);
            thisplugin.intelLinks[guid] = line;
        });


        function recordLine(index_a, index_b, bearing, bearing_word, guid_a, guid_b ) {
            //console.log("FANPOINTS: " + pa + " to "+pb+" center bearing: "+ bearing + "° " + this.bearingWord(bearing));
        }

        // filter layers into array that only contains GeodesicPolygon
        function findFanpoints(dtLayers,locations,filter) {
            var polygon, dtLayer, result = [];
            var i, filtered;
            for( dtLayer in dtLayers) {
                fanLayer = dtLayers[dtLayer];
                if (!(fanLayer instanceof L.GeodesicPolygon)) {
                    continue;
                }
                ll = fanLayer.getLatLngs();
                polygon = [];
                for ( k = 0; k < ll.length; ++k) {
                    p = map.project(ll[k], thisplugin.PROJECT_ZOOM);
                    polygon.push(p);
                }
                filtered = filter(locations, polygon);
                for (i in filtered) {
                    result[i] = filtered[i];
                }
            }
            return result;
        }


        this.sortedFanpoints = [];

        this.fanpoints = findFanpoints(plugin.drawTools.drawnItems._layers,
                                       this.locations,
                                       this.filterPolygon);

        //if (this.fanpoints === undefined || this.fanpoints
        if (Object.keys(this.fanpoints).length === 0) return;

        if (thisplugin.startingpoint === undefined || thisplugin.startingpoint.length === 0) {
            var firstfanpoint = Object.keys(this.fanpoints)[0];
            thisplugin.startingpoint = this.fanpoints[firstfanpoint]; // didn't use a marker to select a starting point?  use a random point inside the polygon.
            thisplugin.startingpointGUID = firstfanpoint;
        }

        this.fanpoints[thisplugin.startingpointGUID] = thisplugin.startingpoint;

        function abtest(a,b,test) {
            // returns a if test is true, else returns b
            if (test)  return a;
            else return b;
        }

        for (guid in this.fanpoints) {
            n++;
            if (this.fanpoints[guid].equals(thisplugin.startingpoint)) {

                continue;
            } else {

                a = this.fanpoints[guid];
                b = thisplugin.startingpoint;

                fanlinks.push({a: a,
                               b: b,
                               bearing: undefined,
                               isJetLink: undefined,
                               isFanLink: undefined
                              });




            }
        }

        //fanlinks.sort(function(a, b){return a.bearing - b.bearing;});

        //console.log(this.fanpoints);
        //console.log(thisplugin.startingpoint);
        //console.log("sorting...");

        // var startpointindex = -1;
        for ( guid in this.fanpoints) {
            fp = this.fanpoints[guid];
            this.sortedFanpoints.push({point: fp,
                                       bearing: this.getBearing(thisplugin.startingpoint,fp),
                                       guid: guid,
                                       incoming: [] ,

                                       outgoing: [],
                                       is_startpoint: this.fanpoints[guid].equals(thisplugin.startingpoint)
                                      });

        }
        this.sortedFanpoints.sort(function(a, b){
            return a.bearing - b.bearing;
        });

        //console.log("rotating...");
        // rotate the this.sortedFanpoints array until the bearing to the startingpoint has the longest gap to the previous one.
        // if no gap bigger 90° is present, start with the longest link.
        var currentBearing, lastBearing;
        var gaps = [];
        var gap, lastGap, maxGap, maxGapIndex, maxGapBearing;
        for (i in this.sortedFanpoints) {
            if (lastBearing === undefined) {
                lastBearing = this.sortedFanpoints[this.sortedFanpoints.length-1].bearing;
                gap = 0;
                lastGap = 0;
                maxGap = 0;
                maxGapIndex = 0;
                maxGapBearing = 0;
            }
            currentBearing = this.sortedFanpoints[i].bearing;
            gap = lastBearing - currentBearing;
            if (gap < 0) gap *= -1;
            if (gap >= 180) gap = 360 - gap;

            if (gap > maxGap){
                maxGap = gap;
                maxGapIndex = i;
                maxGapBearing = currentBearing;
            }
            lastBearing = currentBearing;
            lastGap = gap;
        }

        this.sortedFanpoints = this.sortedFanpoints.concat(this.sortedFanpoints.splice(1,maxGapIndex-1));
        if (!thisplugin.is_clockwise) {
            // reverse all but the first element
            this.sortedFanpoints = this.sortedFanpoints.concat(this.sortedFanpoints.splice(1,this.sortedFanpoints.length-1).reverse());
            //lines.sort(function(a, b){return b.bearing - a.bearing;});
        }


        donelinks = [];
        var outbound = 0;
        for(pa = 0; pa < this.sortedFanpoints.length; pa++){
            bearing = this.sortedFanpoints[pa].bearing;
            //console.log("FANPOINTS: " + pa + " to 0 bearing: "+ bearing + " " + this.bearingWord(bearing));
            sublinkCount = 0;

            for(pb = 0 ; pb < pa; pb++) {
                outbound = 0;
                a = this.sortedFanpoints[pa].point;
                b = this.sortedFanpoints[pb].point;
                bearing =  this.getBearing(a,b);

                if (pb===0) {
                    if (thisplugin.stardirection == thisplugin.starDirENUM.RADIATING && centerOutgoings < 40 ) {
                        a = this.sortedFanpoints[pb].point;
                        b = this.sortedFanpoints[pa].point;
                        console.log("outbound");
                        centerOutgoings++;
                        if (centerOutgoings > 8) {
                            // count sbul
                            centerSbul = Math.ceil(((centerOutgoings-8) / 8));
                        }
                        outbound = 1;
                    }
                    else thisplugin.centerKeys++;
                }

                possibleline = {a: a,
                                b: b,
                                bearing: bearing,
                                isJetLink: false,
                                isFanLink: (pb===0),
                                counts: true

                               };
                intersection = 0;
                maplinks = [];
                if (thisplugin.respectCurrentLinks) {
                    $.each(thisplugin.intelLinks, function(guid,link){
                        maplinks.push(link);
                    });
                    for (i in maplinks) {
                        if (this.intersects(possibleline,maplinks[i]) ) {
                            intersection++;
                            //console.log("FANPOINTS: " + pa + " - "+pb+" bearing: " + bearing + " " + this.bearingWord(bearing) + "(crosslink)");
                            break;
                        }
                    }
                    if (this.linkExists(maplinks, possibleline)) {
                        possibleline.counts = false;
                    }
                }

                for (i in donelinks) {
                    if (this.intersects(possibleline,donelinks[i])) {
                        intersection++;
                        break;
                    }
                }
                for (i in fanlinks) {
                    if (this.intersects(possibleline,fanlinks[i])) {
                        intersection++;
                        break;
                    }
                }

                if (intersection === 0) {
                    //console.log("FANPOINTS: " + pa + " - "+pb+" bearing: " + bearing + "° " + this.bearingWord(bearing));
                    // Check if Link is a jetlink and add second field
                    var thirds = [];
                    if (thisplugin.respectCurrentLinks) {
                        if (possibleline.counts) {
                            thirds = this.getThirds(donelinks.concat(maplinks),possibleline.a, possibleline.b);
                        }
                    } else {
                        thirds = this.getThirds(donelinks,possibleline.a, possibleline.b);
                    }

                    if (thirds.length == 2) {
                        possibleline.isJetLink = true;
                    }


                    if (possibleline.counts) {
                        donelinks.splice(donelinks.length-(this.sortedFanpoints.length-pa),0,possibleline);
                        if (pb===0 && thisplugin.stardirection == thisplugin.starDirENUM.RADIATING && outbound == 1 ) {
                            this.sortedFanpoints[pb].outgoing.push(this.sortedFanpoints[pa]);
                            this.sortedFanpoints[pa].incoming.push(this.sortedFanpoints[pb]);
                        } else {
                            this.sortedFanpoints[pa].outgoing.push(this.sortedFanpoints[pb]);
                            this.sortedFanpoints[pb].incoming.push(this.sortedFanpoints[pa]);
                        }
                    }
                    for (var t in thirds) {
                        triangles.push({a:thirds[t], b:possibleline.a, c:possibleline.b});
                    }
                }
            }
        }

        $.each(donelinks, function(i,elem) {
            thisplugin.links[i] = elem;
        });

        if (this.sortedFanpoints.length > 3) {
            thisplugin.triangles = triangles;
            thisplugin.donelinks = donelinks;
            thisplugin.n = n;
            var MessageStr =
                console.log("== Fan Fields == " +
                            "\nFanPortals: " + (n-1) +
                            "\nCenterKeys:" + thisplugin.centerKeys +
                            "\nTotal links / keys:    " + donelinks.length.toString() +
                            "\nFields:                " + triangles.length.toString() +
                            "\nBuild AP:              " + (donelinks.length*313 + triangles.length*1250).toString() +
                            "\nDestroy AP:            " + (this.sortedFanpoints.length*187 + triangles.length*750).toString());
        }


        // remove any not wanted
        thisplugin.clearAllPortalLabels();

        // and add those we do
        var startLabelDrawn = false;
        $.each(this.sortedFanpoints, function(idx, fp) {
            if (thisplugin.startingpoint !== undefined && fp.point.equals(thisplugin.startingpoint)) {
                drawStartLabel(fp);
                startLabelDrawn = true;
            }
            else
                drawNumber(fp,idx);

        });
        // if (!startLabelDrawn && thisplugin.startingpoint !== undefined ) {
        //     drawStartLabel(thisplugin.startingpoint, {});
        //     startLabelDrawn = true;
        // }


        $.each(thisplugin.links, function(idx, edge) {
            drawLink(edge.a, edge.b, {
                color: '#FF0000',
                opacity: 1,
                weight: 1.5,
                clickable: false,
                smoothFactor: 10,
                dashArray: [10, 5, 5, 5, 5, 5, 5, 5, "100%" ],
            });
        });


        $.each(triangles, function(idx, triangle) {
            drawField(triangle.a, triangle.b, triangle.c, {
                stroke: false,
                fill: true,
                fillColor: '#FF0000',
                fillOpacity: 0.1,
                clickable: false,
            });
        });
    };

    // as calculating portal marker visibility can take some time when there's lots of portals shown, we'll do it on
    // a short timer. this way it doesn't get repeated so much
    thisplugin.delayedUpdateLayer = function(wait) {
        if (thisplugin.timer === undefined) {
            thisplugin.timer = setTimeout ( function() {


                thisplugin.timer = undefined;
                if (!thisplugin.is_locked) thisplugin.updateLayer();
            }, wait*350);

        }

    };


    thisplugin.setup = function() {
		//Extend LatLng here to ensure it was created before
// https://github.com/gregallensworth/Leaflet/
    /*
 * extend Leaflet's LatLng class
 * giving it the ability to calculate the bearing to another LatLng
 * Usage example:
 *     here  = map.getCenter();   / some latlng
 *     there = L.latlng([37.7833,-122.4167]);
 *     var whichway = here.bearingWordTo(there);
 *     var howfar   = (here.distanceTo(there) / 1609.34).toFixed(2);
 *     alert("San Francisco is " + howfar + " miles, to the " + whichway );
 *
 * Greg Allensworth   <greg.allensworth@gmail.com>
 * No license, use as you will, kudos welcome but not required, etc.
 */

    L.LatLng.prototype.bearingToE6 = function(other) {
        var d2r  = L.LatLng.DEG_TO_RAD;
        var r2d  = L.LatLng.RAD_TO_DEG;
        var lat1 = this.lat * d2r;
        var lat2 = other.lat * d2r;
        var dLon = (other.lng-this.lng) * d2r;
        var y    = Math.sin(dLon) * Math.cos(lat2);
        var x    = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
        var brng = Math.atan2(y, x);
        brng = parseInt( brng * r2d * 1E6 );
        brng = ((brng + 360 * 1E6) % (360 * 1E6) / 1E6);
        return brng;
    };

    L.LatLng.prototype.bearingWord = function(bearing) {
        var bearingword = '';
        if      (bearing >=  22 && bearing <=  67) bearingword = 'NE';
        else if (bearing >=  67 && bearing <= 112) bearingword =  'E';
        else if (bearing >= 112 && bearing <= 157) bearingword = 'SE';
        else if (bearing >= 157 && bearing <= 202) bearingword =  'S';
        else if (bearing >= 202 && bearing <= 247) bearingword = 'SW';
        else if (bearing >= 247 && bearing <= 292) bearingword =  'W';
        else if (bearing >= 292 && bearing <= 337) bearingword = 'NW';
        else if (bearing >= 337 || bearing <=  22) bearingword =  'N';
        return bearingword;
    };

    L.LatLng.prototype.bearingWordTo = function(other) {
        var bearing = this.bearingToE6(other) ;
        return this.bearingWord(bearing);
    };
	
        var button2 = '<a class="plugin_fanfields_selectpolybtn plugin_fanfields_btn" id="plugin_fanfields_selectpolybtn" onclick="window.plugin.fanfields.selectPolygon(\'start\');">Select&nbsp;Polygon</a> ';
		if(typeof window.plugin.bookmarks != 'undefined') {
			var button3 = '<a class="plugin_fanfields_btn" onclick="window.plugin.fanfields.saveBookmarks();">Write&nbsp;Bookmarks</a> ';
		}
        var button4 = '<a class="plugin_fanfields_btn" onclick="window.plugin.fanfields.exportText();">Show&nbsp;as&nbsp;list</a> ';

        var button5 = '<a class="plugin_fanfields_btn" id="plugin_fanfields_resetbtn" onclick="window.plugin.fanfields.reset();">Reset</a> ';
        var button6 = '<a class="plugin_fanfields_btn" id="plugin_fanfields_clckwsbtn" onclick="window.plugin.fanfields.toggleclockwise();">Clockwise:(&#8635;)</a> ';
        var button7 = '<a class="plugin_fanfields_btn" id="plugin_fanfields_lockbtn" onclick="window.plugin.fanfields.lock();">unlocked</a> ';
        var button8 = '<a class="plugin_fanfields_btn" id="plugin_fanfields_stardirbtn" onclick="window.plugin.fanfields.toggleStarDirection();">inbounding</a> ';
        var button9 = '<a class="plugin_fanfields_btn" id="plugin_fanfields_respectbtn" onclick="window.plugin.fanfields.togglecRespectCurrentLinks();">Respect&nbsp;Intel:&nbsp;OFF</a> ';
        var button10 = '<a class="plugin_fanfields_btn" id="plugin_fanfields_statsbtn" onclick="window.plugin.fanfields.showStatistics();">Stats</a> ';
        var button11 = '<a class="plugin_fanfields_btn" id="plugin_fanfields_exportbtn" onclick="window.plugin.fanfields.exportDrawtools();">Write&nbsp;DrawTools</a> ';
        var button1 = '<a class="plugin_fanfields_btn" id="plugin_fanfields_helpbtn" onclick="window.plugin.fanfields.help();" >Help</a> ';
        var fanfields_buttons = '';
		if(typeof window.plugin.bookmarks != 'undefined') {
			fanfields_buttons += button3;
		}
		fanfields_buttons +=
            //  button2 +
            button11 +
            button4 +
            //  button5 +
            button6 +
            button7 +
            button8 +
            button9 +
            button10 +
            button1
        ;
        $('#toolbox').append('<fieldset '+
                             'id="plugin_fanfields_toolbox"'+
                             'style="' +
                             'margin: 5px;' +
                             'padding: 3px;' +
                             'border: 1px solid #ffce00;' +
                             'box-shadow: 3px 3px 5px black;' +
                             'color: #ffce00;' +
                             '"><legend >Fan Fields</legend></fieldset>');
        //$('#plugin_fanfields_toolbox').append('<div id="plugin_fanfields_toolbox_title">Fan Fields 2</div>');

        if (!window.plugin.drawTools) {

            dialog({
                html: '<b>Fan Fields</b><p>Fan Fields requires IITC drawtools plugins</p><a href="https://iitc.me/desktop/">Download here</a>',
                id: 'plugin_fanfields_alert_dependencies',
                title: 'Fan Fields - Missing dependency'
            });
            $('#plugin_fanfields_toolbox').empty();
            $('#plugin_fanfields_toolbox').append("<i>Fan Fields requires IITC drawtools and plugins.</i>");

            return;
        }





        $('#plugin_fanfields_toolbox').append(fanfields_buttons);
        thisplugin.setupCSS();
        thisplugin.linksLayerGroup = new L.LayerGroup();
        thisplugin.fieldsLayerGroup = new L.LayerGroup();
        thisplugin.numbersLayerGroup = new L.LayerGroup();


        window.pluginCreateHook('pluginDrawTools');

        window.addHook('pluginDrawTools',function(e) {
            thisplugin.delayedUpdateLayer(0.5);
        });
        window.addHook('mapDataRefreshEnd', function() {
            thisplugin.delayedUpdateLayer(0.5);
        });
        window.addHook('requestFinished', function() {
            setTimeout(function(){thisplugin.delayedUpdateLayer(3.0);},1);
        });

        window.map.on('moveend', function() {
            thisplugin.delayedUpdateLayer(0.5);
        });
        window.map.on('overlayadd overlayremove', function() {
            setTimeout(function(){
                thisplugin.delayedUpdateLayer(1.0);
            },1);
        });

        window.addLayerGroup('Fanfields links', thisplugin.linksLayerGroup, false);
        window.addLayerGroup('Fanfields fields', thisplugin.fieldsLayerGroup, false);
        window.addLayerGroup('Fanfields numbers', thisplugin.numbersLayerGroup, false);

        //window.map.on('zoomend', thisplugin.clearAllPortalLabels );
    };


    var setup = thisplugin.setup;

    // PLUGIN END //////////////////////////////////////////////////////////


    setup.info = plugin_info; //add the script info data to the function as a property
    if(!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
    // if IITC has already booted, immediately run the 'setup' function
    if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);




// EOF
