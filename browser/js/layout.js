window.onload = function() {
  var w = 500;
  var h = 400;
  var r = 5;

  var svg = d3.select("body")
              .append("svg")
              .attr("width", w)
              .attr("height", h);

  d3.json('js/network.json', function(error, graph) {
      if (error) return console.warn(error);
      var force = d3.layout.force()
                    .charge(-600)
                    .linkDistance(70)
                    // .gravity(.75)
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
                     .attr("r", r)
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
                     });

      force.on("tick", function() {
          // The code below was taken from Mike Bostock's Bounding Box example
          // which was shown in his talk on data visualization.
          // Example: http://mbostock.github.io/d3/talk/20110921/bounding.html
          // Talk Video: http://vimeo.com/29458354
          nodes.attr("cx", function(d) { return d.x = Math.max(r, Math.min(w - r, d.x)); })
               .attr("cy", function(d) { return d.y = Math.max(r, Math.min(h - r, d.y)); });

          links.attr("x1", function(d) { return d.source.x; })
               .attr("y1", function(d) { return d.source.y; })
               .attr("x2", function(d) { return d.target.x; })
               .attr("y2", function(d) { return d.target.y; });

          // nodes.attr("cx", function(d) { return d.x; })
          //      .attr("cy", function(d) { return d.y; });
      })

  });
}