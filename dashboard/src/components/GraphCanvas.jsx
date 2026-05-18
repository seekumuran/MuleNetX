import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function GraphCanvas({ data }) {

  const ref = useRef();

  useEffect(() => {

    const width = window.innerWidth;
    const height = window.innerHeight;

    d3.select(ref.current)
      .selectAll("*")
      .remove();

    const svg = d3
      .select(ref.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const simulation = d3
      .forceSimulation(data.nodes)

      .force(
        "link",
        d3.forceLink(data.edges)
          .id(d => d.id)
          .distance(180)
      )

      .force(
        "charge",
        d3.forceManyBody()
          .strength(-500)
      )

      .force(
        "center",
        d3.forceCenter(width / 2, height / 2)
      );

    const links = svg
      .append("g")
      .selectAll("line")
      .data(data.edges)
      .enter()
      .append("line")
      .style("stroke", "#1d1d1d")
      .style("stroke-width", 1);

    const nodes = svg
      .append("g")
      .selectAll("circle")
      .data(data.nodes)
      .enter()
      .append("circle")

      .attr("r", d => 5 + d.risk / 14)

      .style("fill", d => {

        if (d.risk > 85) {
          return "#d13c3c";
        }

        if (d.risk > 60) {
          return "#c08920";
        }

        return "#2e8b4e";
      });

    const labels = svg
      .append("g")
      .selectAll("text")
      .data(data.nodes)
      .enter()
      .append("text")

      .text(d => d.id)

      .style("fill", "#555")
      .style("font-size", "10px")
      .style("font-family", "JetBrains Mono");

    simulation.on("tick", () => {

      links
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      nodes
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      labels
        .attr("x", d => d.x + 10)
        .attr("y", d => d.y + 5);
    });

  }, []);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: "100%"
      }}
    />
  );
}
