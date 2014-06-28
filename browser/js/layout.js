window.onload = function() {
  var w = 700;
  var h = 400;
  var noAttributeSelected = '---'
  var defaultNodeSizeAttribute = noAttributeSelected;
  var defaultNodeSize = 10;

  d3.json("js/network.json", function(error, g) {

      // If any errors occur reading the network file, log them and exit
      if (error) return console.warn(error);

      // Add neighbor and edges arrays to each of the nodes
      for (var i = g.links.length - 1; i >= 0; i--) {
        var link = g.links[i];
        var source = g.nodes[link.source]
            target = g.nodes[link.target];
        source.neighbors = source.neighbors || [];
        source.neighbors.push(target);
        target.neighbors = target.neighbors || [];
        target.neighbors.push(source);
        source.edges = source.edges || [];
        source.edges.push(link);
        target.edges = target.edges || [];
        target.edges.push(link);
      };

      initializeNodeSizeAttributeDropdown(g);

      /* Scale functions */

      function nodeSize(node) {
        var nodeSizeAttribute = d3.select("#node-size-attribute").node().value;

        if (nodeSizeAttribute === noAttributeSelected) {
          return defaultNodeSize;
        }

        var nodeSizeDomain = [
          d3.min(g["nodes"], function(n) { return n[nodeSizeAttribute]; }),
          d3.max(g["nodes"], function(n) { return n[nodeSizeAttribute]; })
        ];

        var nodeSizeScale = d3.scale.linear()
                              .domain(nodeSizeDomain)
                              .range([3, 30]);

        return nodeSizeScale(node[nodeSizeAttribute]);
      }

      var weightDomain = [
        d3.min(g['links'], function(d) { return d['weight']; }),
        d3.max(g['links'], function(d) { return d['weight']; })
      ];

      var linkStrength = d3.scale.linear()
                        .domain(weightDomain)
                        .range([0, 0.75])
                        .clamp(true);

      var linkDistance = d3.scale.linear()
                        .domain(weightDomain)
                        .range([50, 400])
                        .clamp(true);

      /**
       * Determines the stroke of each line based on its weight.
       */
      function linkStroke(d) {
          // Hiding some of the weaker links to make the
          // visualization more responsive and less cluttered
          if (d.weight > 10) {
            return "rgba(32, 32, 32, " + linkStrength(d.weight * 0.7) + ")";
          }
       }

      /* Create the network */

      var tip = d3.tip()
                  .attr('class', 'd3-tip')
                  .html(function(d) {
                    return "<span>" + d['name'] + "</span>";
                  });

      var svg = d3.select("svg#network")
                  .attr("width", w)
                  .attr("height", h)
                  .call(tip);

      var force = d3.layout.force()
                    .charge(-225)
                    .linkDistance(function(d) { return linkDistance(d.weight); })
                    .linkStrength(function(d) { return linkStrength(d.weight); })
                    .gravity(.1)
                    .nodes(g.nodes)
                    .links(g.links)
                    .size([w, h])
                    .on("tick", tick)
                    .start();

      var links = svg.selectAll(".link")
                     .data(g.links)
                     .enter()
                     .append("line")
                     .attr("class", "link")
                     .style("stroke", linkStroke);


      var nodes = svg.selectAll(".node")
                     .data(g.nodes)
                     .enter()
                     .append("circle")
                     .attr("class", "node")
                     .attr("r", function(d) { return nodeSize(d); })
                     .style("fill", function(d) {
                        if (d.party_affiliation === "democrat") {
                            return "#c5d7ea";
                        } else if (d.party_affiliation === "republican") {
                            return "#fbdedf";
                        } else {
                            return "#aaa";
                        }
                      })
                     .style("stroke", function(d) {
                        if (d.party_affiliation === "democrat") {
                            return "#4a5783";
                        } else if (d.party_affiliation === "republican") {
                            return "#734143";
                        } else {
                            return "#606060";
                        }
                     })
                     .on("mouseover.tip-show", tip.show)
                     .on("mouseout.tip-hide", tip.hide)
                     .on("mouseover.highlight-neighborhoods", highlightNeighborhood)
                     .on("mouseout.restore-neighborhoods", restoreNeighborhoods)
                     .call(force.drag);


      /* Event handlers */

      function highlightNeighborhood(source) {
        // Highlight the current node's neighbors
        d3.selectAll("circle")
          .data(source.neighbors.concat([source]), function(d) { return d.name; })
            .style("fill-opacity", 1.0)
            .style("stroke-opacity", 1.0)
          .exit()
            .style("fill-opacity", 0.3)
            .style("stroke-opacity", 0.3);

        // Highlight the current node's edges
        d3.selectAll("line")
          .data(source.edges, function(d) { return d.source.name + " - " + d.target.name; })
            .style("stroke", function(d) { return "rgba(32, 32, 32, " + linkStrength(d.weight) + ")"; })
          .exit()
            .style("stroke-opacity", 0);
      }

      function restoreNeighborhoods(source) {
        // Return all nodes to their normal opacity
        d3.selectAll('circle')
          .style("fill-opacity", 1.0)
          .style("stroke-opacity", 1.0);

        // Return all links to their normal opacity and stroke
        d3.selectAll("line")
          .style("stroke-opacity", 1.0)
          .style("stroke", linkStroke);
      }

      function tick() {
          nodes.transition().duration(150)
               .attr("r", function(d) { return nodeSize(d); });

          // The code below was taken from Mike Bostock's Bounding Box example
          // which was shown in his talk on data visualization.
          // Example: http://mbostock.github.io/d3/talk/20110921/bounding.html
          // Talk Video: http://vimeo.com/29458354
          var padding = 2;
          nodes.attr("cx", function(d) {
                 return d.x = Math.max(nodeSize(d) + padding, Math.min(w - (nodeSize(d) + padding), d.x));
               })
               .attr("cy", function(d) {
                 return d.y = Math.max(nodeSize(d) + padding, Math.min(h - (nodeSize(d) + padding), d.y));
               });

          links.attr("x1", function(d) { return d.source.x; })
               .attr("y1", function(d) { return d.source.y; })
               .attr("x2", function(d) { return d.target.x; })
               .attr("y2", function(d) { return d.target.y; });
      }

      /* Initialization methods */

      function getNodeSizeAttribute(g) {
        var graphAttrs = g.graph;
        for (var i = graphAttrs.length - 1; i >= 0; i--) {
          var attrs = graphAttrs[i];
          if (attrs[0] === 'resize') {
            return attrs[1];
          }
        };
        return defaultNodeSizeAttribute;
      }

      function initializeNodeSizeAttributeDropdown(g) {
        var nodeSizeAttribute = getNodeSizeAttribute(g);
        var dropdown = d3.select("#node-size-attribute");
        dropdown.node().value = nodeSizeAttribute;
        dropdown.on("change", function() { force.resume(); });
      }

    });
}