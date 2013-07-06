window.onload = function() {
  var w = 800;
  var h = 400;

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

      // Add a bit of padding to each node to prevent them from  hitting the
      // edge of the SVG container and randomized to make it look more natural
      var randBuffer = d3.random.normal(20, 8);
      for (var i = graph.nodes.length - 1; i >= 0; i--) {
        var node = graph.nodes[i];
        node.padding = nodeSize(node.betweenness) + randBuffer();
      };

      // Add neighbor and edges arrays to each of the nodes
      for (var i = graph.links.length - 1; i >= 0; i--) {
        var link = graph.links[i];
        var source = graph.nodes[link.source]
            target = graph.nodes[link.target];
        source.neighbors = source.neighbors || [];
        source.neighbors.push(target);
        target.neighbors = target.neighbors || [];
        target.neighbors.push(source);
        source.edges = source.edges || [];
        source.edges.push(link);
        target.edges = target.edges || [];
        target.edges.push(link);
      };

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
                        // Hiding some of the weaker links to make the
                        // visualization more responsive and less cluttered
                        if (d.weight > 10) {
                          return "rgba(32, 32, 32, " + linkStrength(d.weight) + ")";
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
                     .call(force.drag);

      // Add mouseout and mouseover event listeners to highlight a
      // a neighborhood of nodes whenever the user hovers over one.
      nodes.on("mouseover", function(source) {
        tip.show(source);

        d3.selectAll("circle")
          .data(source.neighbors.concat([source]), function(d) { return d.name; })
            .style("fill-opacity", 1.0)
            .style("stroke-opacity", 1.0)
          .exit()
            .style("fill-opacity", 0.3)
            .style("stroke-opacity", 0.3);

        d3.selectAll("line")
          .data(source.edges, function(d) { return d.source.name + " - " + d.target.name; })
            .style("stroke", function(d) { return "rgba(32, 32, 32, " + linkStrength(d.weight) + ")"; })
          .exit()
            .style("stroke-opacity", 0);
      }).on("mouseout", function(d) {
        tip.hide(d);

        d3.selectAll('circle')
          .style("fill-opacity", 1.0)
          .style("stroke-opacity", 1.0);

        d3.selectAll("line")
          .style("stroke-opacity", 1.0)
          .style("stroke", function(d) {
              if (d.weight > 10) {
                return "rgba(32, 32, 32, " + linkStrength(d.weight) + ")";
              }
          });
      });

      force.on("tick", function() {
          // The code below was taken from Mike Bostock's Bounding Box example
          // which was shown in his talk on data visualization.
          // Example: http://mbostock.github.io/d3/talk/20110921/bounding.html
          // Talk Video: http://vimeo.com/29458354
          nodes.attr("cx", function(d) {
                 return d.x = Math.max(d.padding, Math.min(w - d.padding, d.x));
               })
               .attr("cy", function(d) {
                 return d.y = Math.max(d.padding, Math.min(h - d.padding, d.y));
               });

          links.attr("x1", function(d) { return d.source.x; })
               .attr("y1", function(d) { return d.source.y; })
               .attr("x2", function(d) { return d.target.x; })
               .attr("y2", function(d) { return d.target.y; });
      })

  });
}