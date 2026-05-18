import express from "express";
import cors from "cors";
import fs from "fs";
const app = express();
app.use(cors());
app.use(express.json());
const graph = JSON.parse(
  fs.readFileSync("./data/graph.json", "utf-8")
);
app.get("/api/graph", (req, res) => {
  res.json(graph);
});
app.get("/api/status", (req, res) => {
  res.json({
    status: "ACTIVE",
    topologyEngine: "ONLINE",
    anomalyScanner: "RUNNING",
    riskPropagation: "ACTIVE"
  });
});
app.listen(5000, () => {
  console.log("MuleNetX API running on port 5000");
});
