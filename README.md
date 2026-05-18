```
 ███╗   ███╗██╗   ██╗██╗     ███████╗███╗   ██╗███████╗████████╗██╗  ██╗
 ████╗ ████║██║   ██║██║     ██╔════╝████╗  ██║██╔════╝╚══██╔══╝╚██╗██╔╝
 ██╔████╔██║██║   ██║██║     █████╗  ██╔██╗ ██║█████╗     ██║    ╚███╔╝
 ██║╚██╔╝██║██║   ██║██║     ██╔══╝  ██║╚██╗██║██╔══╝     ██║    ██╔██╗
 ██║ ╚═╝ ██║╚██████╔╝███████╗███████╗██║ ╚████║███████╗   ██║   ██╔╝ ██╗
 ╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝
```

*Transaction topology. Risk propagation. Suspicious-looking lines connecting to other suspicious-looking lines.*

## What This Actually Is

MuleNetX is a graph-powered financial crime visualization dashboard built to explore:
- How transaction networks form topology patterns you can actually see
- How anomaly detection logic can be threaded through a live graph
- How forensic-style UI design communicates complexity without requiring a manual


## Features

- **Live transaction graph** rendered with D3.js over a React canvas layer — force-directed, zoomable, edge-weighted
- **Risk propagation** visualization that traces how suspicion moves through a network in real time
- **Anomaly detection feed** surfacing outlier transactions through a Python scoring layer
- **Event feed panel** streaming synthetic transaction events in chronological order
- **System status panel** displaying infrastructure health metrics with the appropriate level of gravitas
- **Three fraud topology templates** — fan-out, layering ring, and smurfing
- **Centrality analysis** identifying which nodes are doing the most suspicious connecting

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND LAYER                              │
│                                                                      │
│   BootSequence → App Shell → GraphCanvas + SystemPanel + EventFeed  │
│                              TerminalFeed                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP / REST
┌──────────────────────────────▼──────────────────────────────────────┐
│                           API LAYER                                  │
│                                                                      │
│             server.js  ←→  fetchGraph.js                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                          DATA LAYER                                  │
│                                                                      │
│        graph.json          transactions.json                        │
│              ↑                     ↑                                │
│        export_graph.py      anomaly_scan.py + risk_score.py        │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                       GRAPH ENGINE LAYER                             │
│                                                                      │
│       topology.js    centrality.js    propagation.js                │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      FRAUD TEMPLATE LAYER                            │
│                                                                      │
│       fan_out.yaml    layering_ring.yaml    smurfing.yaml           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Graph Theory

Financial crime networks have structure. Money doesn't move randomly — it moves in patterns. Layering schemes create long chains. Smurfing creates clusters of small-value nodes funneling upward. Fan-out attacks radiate from a single source to dozens of destinations.

Graph theory gives you the language to describe these patterns: **nodes** are entities (accounts, wallets, institutions), **edges** are transactions (directional, weighted by value), and **topology** is the shape of the whole thing — how it's connected, where the density clusters, what the structure implies.

**Centrality** measures which nodes matter most. High betweenness centrality means a node is sitting between a lot of other nodes — structurally important, possibly suspicious. High degree centrality means a node is connected to a lot of other nodes — also potentially suspicious.

**Propagation** is what happens when you ask: if this node is compromised, how far does that travel through the network? 

MuleNetX renders all of this visually, in real time, so you can watch a synthetic laundering ring slowly become more obviously a laundering ring.

---

## File-by-File Breakdown

### `dashboard/src/components/`

**`GraphCanvas.jsx`**
The visual center of everything. Takes the transaction graph data and renders it as a live, force-directed topology visualization using D3.js inside a React component. Nodes pulse. Edges carry weight. Suspicious clusters look suspicious. 

**`EventFeed.jsx`**
A scrolling panel of synthetic transaction events with timestamps, entity IDs, amounts, and risk flags. Looks like a live intelligence feed. Is, technically, a very well-formatted JSON array rendered with some CSS transitions.

**`SystemPanel.jsx`**
Displays system-level status metrics: node count, edge count, active alerts, analysis throughput. The kind of panel that makes a dashboard feel like infrastructure.

**`TerminalFeed.jsx`**
A scrolling terminal window providing live commentary on what the system is ostensibly doing — graph computations, anomaly checks, topology updates. Adds significant atmospheric weight to the interface. 

**`App.jsx`**
The root orchestration layer. Assembles the components, manages state, coordinates data flow from the API layer to the visual components. The thing that makes the other things work together.

**`main.jsx`**
Vite entry point. Mounts the React tree. 

---

### `api/`

**`server.js`**
A lightweight Express server that exposes graph data and transaction events as REST endpoints. Reads from the data layer, responds to the frontend. Nothing exotic. 

**`fetchGraph.js`**
Client-side data fetching utility. Handles requests from the frontend to the API layer. Abstracts the HTTP calls so the components don't have to think about it.

---

### `analysis/`

**`anomaly_scan.py`**
Python script that scans transaction data for statistical outliers — unusual amounts, high-velocity sequences, structuring patterns. Outputs a list of flagged transactions with confidence values. The 40% actual graph theory part of the fraud detection.

**`risk_score.py`**
Assigns risk scores to individual nodes based on their transaction behavior and network position. Feeds into the graph visualization layer so high-risk nodes render differently. The output is consumed by the frontend to color-code suspicion.

---

### `data/`

**`graph.json`**
The core data structure. A serialized directed graph: nodes with IDs and metadata, edges with direction, weight, and timestamps. This is what the graph engine reads, what the analysis layer writes to, and what the frontend ultimately renders.

**`transactions.json`**
A flat list of synthetic transaction records. Source accounts, destination accounts, amounts, timestamps, transaction types. The raw material from which the graph is constructed and from which the event feed draws.

---

### `database_framework/`

**`export_graph.py`**
Converts the transaction data into graph-structured JSON suitable for the visualization layer. The translation layer between raw records and topology. 

---

### `graph_engine/`

**`topology.js`**
Analyzes the structural properties of the graph — connected components, path lengths, density, clustering coefficients. Gives you the shape of the network. Tells you whether you're looking at a ring, a chain, a hub-and-spoke, or something that doesn't have a clean name.

**`centrality.js`**
Computes centrality metrics across the graph. Betweenness, degree, eigenvector. Identifies the nodes that are structurally important — the ones sitting at intersections, the ones everything flows through. In a money laundering context, these are interesting nodes.

**`propagation.js`**
Simulates how risk or compromise spreads through the network from a given source node. Uses a weighted diffusion model across edges. Lets you visualize contagion — how far a single flagged entity's influence extends through the transaction topology.

---

### `fraud_templates/`

**`fan_out.yaml`**
Describes a fan-out transaction pattern: one source account distributes funds to a large number of destination accounts in a short time window. Classic structuring precursor. The graph renders this as a radial burst from a single hub node.

**`layering_ring.yaml`**
Describes a layering scheme: funds move through a sequence of intermediate accounts in a ring or chain to obscure origin. The graph renders this as a long winding path with minimal cross-connections.

**`smurfing.yaml`**
Describes a smurfing pattern: aggregation of many small-value transactions from distributed sources into a single destination, staying below reporting thresholds. The graph renders this as a dense funnel — many small inputs converging on one node.

---

### `deploy/`

**`docker-compose.yml`**
Defines the multi-container deployment: frontend, API server, and any supporting services. 

---

### Root

**`.env.example`**
Environment variable template. Copy it to `.env`, fill in your values, and the system knows what it's doing.

---

## Frontend Architecture

The dashboard is built in React with Vite as the build layer. The graph visualization uses D3.js, which does not play nicely with React's virtual DOM by default — the `GraphCanvas` component manages this carefully, using D3 for rendering and React for state coordination without letting them fight over the same elements.

The component hierarchy is deliberately flat. Everything renders from `App.jsx`, which manages the data state and passes it down. The panels (`SystemPanel`, `EventFeed`, `TerminalFeed`) are display-only — they receive data, they render it. The `GraphCanvas` is the only component with meaningful interaction logic.

The UI is designed around information density. Nothing is decorative that isn't also functional. The terminal feed is atmospheric but also communicates what the system is computing. The system panel is visual but also reports real graph statistics. 

---

## Backend Architecture

Deliberately lightweight. The API layer is an Express server with a handful of endpoints — it reads from static JSON and returns it. The analysis scripts (Python) run as preprocessing steps, not live services; they process transaction data and write outputs that the server then serves.

This is intentional. The interesting complexity lives in the graph engine and the frontend. The backend's job is to not be the bottleneck.

If you wanted to extend this to a real data source, you'd replace the static JSON reads in `server.js` with database queries and update the Python scripts to run against live data. The architecture accommodates this. It just doesn't require it.

---

## Fraud Template Architecture

The `fraud_templates/` directory contains YAML definitions of canonical money laundering patterns. Each template specifies:

- Node count and type distribution
- Edge structure (direction, density, branching factor)
- Timing characteristics (transaction velocity, sequencing)
- Amount patterns (round numbers, structuring thresholds, aggregation targets)

The graph engine reads these templates to generate synthetic networks that exhibit the described topology. The result is a graph that looks like a real layering ring because it was constructed according to the structural logic of a real layering ring.

This is how the visualization stays honest. The patterns don't look suspicious because we made them look suspicious. They look suspicious because suspicious patterns have recognizable shapes.

---

## Technical Philosophy

Systems that visualize complexity should feel like they understand the complexity they're visualizing.

Most dashboards fail this. They show data without conveying the relationships between data. A table of transactions tells you what happened. A transaction topology graph tells you what's happening structurally — who connects to whom, where the flow concentrates, what the shape of the activity implies.

MuleNetX was built to explore that gap. The graph is the primary interface. The panels exist to support the graph. Every design decision was made in service of making the topology legible — readable at a glance, explorable on interaction, and structurally honest about what the data actually contains.

---


## Contributors

Built by people who probably should've gone outside more:

- **Kumaran** — [@Kumaranshub](https://github.com/Kumaranshub)
- **Sarvesh** — [@Sarvesh-Sarz](https://github.com/Sarvesh-Sarz)
- **Partha** — [@DatGod920](https://github.com/DatGod920)
- **Tawheed** — [@twhdd1201](https://github.com/twhdd1201)

---


## Closing Statement

MuleNetX exists because we wanted to understand what financial crime looks like when you turn it into a graph — and then render that graph with enough care that it communicates something true about the structure beneath it. We built something that looks like an intelligence tool because we were trying to think like one.
