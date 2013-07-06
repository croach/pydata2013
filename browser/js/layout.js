window.onload = function() {
  var w = 800;
  var h = 450;

  d3.json('js/network.json', function(error, graph) {
      if (error) return console.warn(error);

      /* Scale functions */
      var betweenness_domain = [
        d3.min(graph['nodes'], function(n) { return n['betweenness']; }),
        d3.max(graph['nodes'], function(n) { return n['betweenness']; })
      ];

      var weightDomain = [
        d3.min(graph['links'], function(d) { return d['weight']; }),
        d3.max(graph['links'], function(d) { return d['weight']; })
      ];

      var nodeSize = d3.scale.linear()
                       .domain(betweenness_domain)
                       .range([3, 30]);

      var linkStrength = d3.scale.linear()
                        .domain(weightDomain)
                        .range([0, 0.75])
                        .clamp(true);

      var linkDistance = d3.scale.linear()
                        .domain(weightDomain)
                        .range([50, 400])
                        .clamp(true);

      var tip = d3.tip()
                  .attr('class', 'd3-tip')
                  .html(function(d) {
                    return "<span>" + d['name'] + "</span>";
                  });

      var svg = d3.select("body")
                  .append("svg")
                  .attr("width", w)
                  .attr("height", h)
                  .call(tip);

      var force = d3.layout.force()
                    .charge(-225)
                    .linkDistance(function(d) {
                        return linkDistance(d.weight);
                    })
                    .linkStrength(function(d) {
                        return linkStrength(d.weight);
                    })
                    .gravity(.1)
                    .nodes(graph.nodes)
                    .links(graph.links)
                    .size([w, h])
                    .start();

      var links = svg.selectAll(".link")
                     .data(graph.links)
                     .enter()
                     .append("line")
                     .attr("class", "link")
                     .style("stroke", function(d) {
                        if (d.weight > 10) {
                          return "rgba(32,32,32,.15)";
                        }
                     });


      var nodes = svg.selectAll(".node")
                     .data(graph.nodes)
                     .enter()
                     .append("circle")
                     .attr("class", "node")
                     .attr("r", function(d) {
                        return nodeSize(d['betweenness']);
                     })
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
                     .on('mouseover', function(d) { tip.show(d); })
                     .on('mouseout', function(d) { tip.hide(d); })
                     .call(force.drag);

      force.on("tick", function() {
          var padding = 3;
          // The code below was taken from Mike Bostock's Bounding Box example
          // which was shown in his talk on data visualization.
          // Example: http://mbostock.github.io/d3/talk/20110921/bounding.html
          // Talk Video: http://vimeo.com/29458354
          nodes.attr("cx", function(d) {
                  var r = nodeSize(d["betweenness"]) + padding;
                  return d.x = Math.max(r, Math.min(w - r, d.x));
               })
               .attr("cy", function(d) {
                  var r = nodeSize(d["betweenness"]) + padding;
                  return d.y = Math.max(r, Math.min(h - r, d.y));
               });

          links.attr("x1", function(d) { return d.source.x; })
               .attr("y1", function(d) { return d.source.y; })
               .attr("x2", function(d) { return d.target.x; })
               .attr("y2", function(d) { return d.target.y; });
      })

  });
}