const board = document.getElementById("board");
const zoomLayer = document.getElementById("zoom-layer");
const edgesSvg = document.getElementById("edges");
const nodeTemplate = document.getElementById("node-template");
const nodeTooltip = document.getElementById("node-tooltip");

const selectionStatus = document.getElementById("selection-status");
const activeChartLabel = document.getElementById("active-chart");
const inspectorEmpty = document.getElementById("inspector-empty");
const inspectorForm = document.getElementById("inspector-form");
const nodeLabelInput = document.getElementById("node-label");
const nodeTypeInput = document.getElementById("node-type");
const nodeNotesInput = document.getElementById("node-notes");
const pathOutput = document.getElementById("path-output");
const transcriptStatus = document.getElementById("transcript-status");
const positionSelect = document.getElementById("position-select");
const chartTypeSelect = document.getElementById("chart-type-select");
const referenceForm = document.getElementById("reference-form");
const referenceTitleInput = document.getElementById("reference-title");
const referenceUrlInput = document.getElementById("reference-url");
const referencesList = document.getElementById("references-list");
const userReferencesList = document.getElementById("user-references-list");
const themeToggleButton = document.getElementById("theme-toggle");
const modeToggleButton = document.getElementById("mode-toggle");
const loadBundledButton = document.getElementById("load-bundled");
const modeIndicator = document.getElementById("mode-indicator");
const buildFromTranscriptsButton = document.getElementById("build-from-transcripts");
const zoomOutButton = document.getElementById("zoom-out");
const zoomInButton = document.getElementById("zoom-in");
const zoomResetButton = document.getElementById("zoom-reset");
const zoomLevel = document.getElementById("zoom-level");

const POSITIONS = [
  "Mount",
  "Side Control",
  "Closed Guard",
  "Half Guard",
  "Open Guard",
  "Back Control",
  "Standing",
];

const FLOW_TYPES = ["Attacks", "Escapes"];
const STORAGE_KEY = "bjj-flowchart-workspace-v1";
const APP_SCRIPT_URL =
  [...document.scripts].map((script) => script.src).find((src) => /\/app\.js(\?|$)/.test(src)) || window.location.href;
const BUNDLED_WORKSPACE_URL = new URL("data/workspace.json", new URL(".", APP_SCRIPT_URL)).toString();
const NODE_WIDTH = 210;
const NODE_HEIGHT = 88;
const BASE_CANVAS_HEIGHT = 1400;
const CANVAS_PADDING = 140;
const MAX_CANVAS_WIDTH = 6000;
const MAX_CANVAS_HEIGHT = 6000;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const ANCHOR_POINTS = [
  { x: 0.5, y: 0.0 },
  { x: 0.75, y: 0.15 },
  { x: 1.0, y: 0.5 },
  { x: 0.75, y: 0.85 },
  { x: 0.5, y: 1.0 },
  { x: 0.25, y: 0.85 },
  { x: 0.0, y: 0.5 },
  { x: 0.25, y: 0.15 },
];

const state = {
  nodes: [],
  edges: [],
  references: [],
  selectedNodeIds: new Set(),
  selectedEdgeId: null,
  drag: null,
  charts: {},
  currentPosition: "Mount",
  currentChartType: "Attacks",
  mode: "builder",
  theme: "dark",
  titleFetchInFlight: new Set(),
  zoom: 1,
  canvasWidth: 0,
  canvasHeight: 0,
};

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cloneChart(chart) {
  return {
    nodes: chart.nodes.map((node) => ({ ...node })),
    edges: chart.edges.map((edge) => ({ ...edge })),
    references: Array.isArray(chart.references)
      ? chart.references.map((reference) => ({ ...reference }))
      : [],
  };
}

function chartKey(position, chartType) {
  return `${position}::${chartType}`;
}

function currentChartKey() {
  return chartKey(state.currentPosition, state.currentChartType);
}

function ensureCurrentChart() {
  const key = currentChartKey();
  if (!state.charts[key]) {
    state.charts[key] = { nodes: [], edges: [], references: [] };
  }
  return state.charts[key];
}

function persistCurrentChart() {
  state.charts[currentChartKey()] = cloneChart({
    nodes: state.nodes,
    edges: state.edges,
    references: state.references,
  });
}

function loadCurrentChart() {
  const chart = ensureCurrentChart();
  state.nodes = chart.nodes.map((node) => ({ ...node }));
  state.edges = chart.edges.map((edge) => ({ ...edge }));
  state.references = Array.isArray(chart.references) ? chart.references.map((ref) => ({ ...ref })) : [];
  state.selectedNodeIds.clear();
  state.selectedEdgeId = null;
  state.canvasWidth = 0;
  state.canvasHeight = 0;
  ensureCanvasSize();
  setActiveChartLabel();
  renderReferences();
  render();
}

function setActiveChartLabel() {
  activeChartLabel.textContent = `${state.currentPosition} - ${state.currentChartType}`;
}

function applyZoom() {
  zoomLayer.style.transform = `scale(${state.zoom})`;
  zoomLevel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function setZoom(nextZoom) {
  state.zoom = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
  ensureCanvasSize();
  applyZoom();
  syncEdgesToLayout();
}

function applyCanvasSize() {
  zoomLayer.style.width = `${Math.max(400, state.canvasWidth)}px`;
  zoomLayer.style.height = `${Math.max(320, state.canvasHeight)}px`;
}

function ensureCanvasSize(extraX = 0, extraY = 0) {
  const minWidth = Math.max(400, board.clientWidth);
  const minHeight = Math.max(BASE_CANVAS_HEIGHT, board.clientHeight);
  const contentWidth = state.nodes.reduce(
    (max, node) => Math.max(max, node.x + NODE_WIDTH + CANVAS_PADDING),
    0,
  );
  const contentHeight = state.nodes.reduce(
    (max, node) => Math.max(max, node.y + NODE_HEIGHT + CANVAS_PADDING),
    0,
  );

  // Expand internal workspace width; board frame stays fixed and scrolls internally.
  state.canvasWidth = clamp(Math.max(minWidth, contentWidth, extraX), minWidth, MAX_CANVAS_WIDTH);
  state.canvasHeight = clamp(Math.max(minHeight, contentHeight, extraY), minHeight, MAX_CANVAS_HEIGHT);
  applyCanvasSize();
}

function syncEdgesToLayout() {
  // Recompute edges after layout-affecting UI changes (mode switch, panel visibility).
  requestAnimationFrame(() => {
    ensureCanvasSize();
    renderEdges();
    requestAnimationFrame(() => {
      ensureCanvasSize();
      renderEdges();
    });
  });
}

function setMode(mode) {
  state.mode = mode === "user" ? "user" : "builder";
  const isUserMode = state.mode === "user";
  document.body.classList.toggle("user-mode", isUserMode);
  modeToggleButton.textContent = isUserMode ? "Switch to Builder Mode" : "Switch to User Mode";
  modeIndicator.textContent = `Mode: ${isUserMode ? "User" : "Builder"}`;

  if (isUserMode) {
    state.selectedNodeIds.clear();
    state.selectedEdgeId = null;
  }

  renderSelection();
  renderInspector();
  hideNodeTooltip();
  syncEdgesToLayout();
}

function setTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  const isDark = state.theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  themeToggleButton.textContent = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
}

function getNodeNotesText(node) {
  return typeof node?.notes === "string" ? node.notes.trim() : "";
}

function hideNodeTooltip() {
  if (!nodeTooltip) {
    return;
  }
  nodeTooltip.hidden = true;
  nodeTooltip.textContent = "";
  delete nodeTooltip.dataset.nodeId;
}

function positionNodeTooltip(event, nodeEl) {
  if (!nodeTooltip || nodeTooltip.hidden) {
    return;
  }

  let x = Number.isFinite(event?.clientX) ? event.clientX : null;
  let y = Number.isFinite(event?.clientY) ? event.clientY : null;

  if (x === null || y === null) {
    const rect = nodeEl?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    x = rect.left + rect.width * 0.5;
    y = rect.top + 8;
  }

  const tooltipRect = nodeTooltip.getBoundingClientRect();
  const padding = 10;
  let left = x + 14;
  let top = y - tooltipRect.height - 14;

  if (left + tooltipRect.width > window.innerWidth - padding) {
    left = window.innerWidth - tooltipRect.width - padding;
  }
  if (left < padding) {
    left = padding;
  }
  if (top < padding) {
    top = y + 14;
  }
  if (top + tooltipRect.height > window.innerHeight - padding) {
    top = window.innerHeight - tooltipRect.height - padding;
  }

  nodeTooltip.style.left = `${left}px`;
  nodeTooltip.style.top = `${top}px`;
}

function showNodeTooltip(node, event, nodeEl) {
  if (!nodeTooltip) {
    return;
  }
  const notes = getNodeNotesText(node);
  if (!notes) {
    hideNodeTooltip();
    return;
  }

  nodeTooltip.textContent = notes;
  nodeTooltip.hidden = false;
  nodeTooltip.dataset.nodeId = node.id;
  positionNodeTooltip(event, nodeEl);
}

function addNode(node = {}) {
  const newNode = {
    id: node.id || uid("node"),
    label: node.label || "New Node",
    type: node.type || "position",
    notes: node.notes || "",
    x: Number.isFinite(node.x) ? node.x : 80,
    y: Number.isFinite(node.y) ? node.y : 80,
  };

  state.nodes.push(newNode);
  render();
  return newNode.id;
}

function connectNodes(fromId, toId) {
  if (!fromId || !toId || fromId === toId) {
    return;
  }

  const exists = state.edges.some((edge) => edge.from === fromId && edge.to === toId);
  if (exists) {
    return;
  }

  state.edges.push({
    id: uid("edge"),
    from: fromId,
    to: toId,
    curved: false,
    fromAnchor: 2,
    toAnchor: 6,
  });

  renderEdges();
}

function deleteSelected() {
  if (!state.selectedNodeIds.size) {
    return;
  }

  state.nodes = state.nodes.filter((node) => !state.selectedNodeIds.has(node.id));
  state.edges = state.edges.filter(
    (edge) => !state.selectedNodeIds.has(edge.from) && !state.selectedNodeIds.has(edge.to),
  );
  if (state.selectedEdgeId && !state.edges.some((edge) => edge.id === state.selectedEdgeId)) {
    state.selectedEdgeId = null;
  }
  state.selectedNodeIds.clear();
  render();
}

function setSelection(nodeId, additive = false) {
  state.selectedEdgeId = null;
  if (!additive) {
    state.selectedNodeIds.clear();
  }

  if (nodeId) {
    if (additive && state.selectedNodeIds.has(nodeId)) {
      state.selectedNodeIds.delete(nodeId);
    } else {
      state.selectedNodeIds.add(nodeId);
    }
  }

  renderSelection();
  renderInspector();
  renderEdges();
}

function setEdgeSelection(edgeId) {
  state.selectedNodeIds.clear();
  state.selectedEdgeId = edgeId || null;
  renderSelection();
  renderInspector();
  renderEdges();
}

function deleteSelectedConnection() {
  if (!state.selectedEdgeId) {
    return;
  }
  state.edges = state.edges.filter((edge) => edge.id !== state.selectedEdgeId);
  state.selectedEdgeId = null;
  render();
}

function toggleSelectedConnectionCurve() {
  if (!state.selectedEdgeId) {
    return;
  }

  const edge = state.edges.find((item) => item.id === state.selectedEdgeId);
  if (!edge) {
    return;
  }

  edge.curved = !edge.curved;
  renderEdges();
}

function render() {
  ensureCanvasSize();
  hideNodeTooltip();
  zoomLayer.querySelectorAll(".node").forEach((el) => el.remove());

  for (const node of state.nodes) {
    const fragment = nodeTemplate.content.cloneNode(true);
    const el = fragment.querySelector(".node");
    const titleEl = fragment.querySelector(".node-title");
    const hasNotes = Boolean(getNodeNotesText(node));

    el.dataset.id = node.id;
    el.dataset.type = node.type;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    if (hasNotes) {
      el.dataset.hasNotes = "true";
      el.setAttribute("aria-label", `${node.label}. Coaching note available.`);
    } else {
      delete el.dataset.hasNotes;
      el.setAttribute("aria-label", node.label);
    }

    titleEl.textContent = node.label;

    el.addEventListener("pointerdown", (event) => {
      if (state.mode !== "builder") {
        return;
      }
      startDrag(event, node.id);
    });
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.mode !== "builder") {
        return;
      }
      setSelection(node.id, event.shiftKey);
    });
    el.addEventListener("mouseenter", (event) => {
      showNodeTooltip(node, event, el);
    });
    el.addEventListener("mousemove", (event) => {
      if (nodeTooltip?.dataset.nodeId === node.id) {
        positionNodeTooltip(event, el);
      }
    });
    el.addEventListener("mouseleave", () => {
      if (nodeTooltip?.dataset.nodeId === node.id) {
        hideNodeTooltip();
      }
    });
    el.addEventListener("focus", () => {
      showNodeTooltip(node, null, el);
    });
    el.addEventListener("blur", () => {
      if (nodeTooltip?.dataset.nodeId === node.id) {
        hideNodeTooltip();
      }
    });

    zoomLayer.appendChild(fragment);
  }

  renderSelection();
  renderInspector();
  renderEdges();
}

function renderSelection() {
  for (const el of zoomLayer.querySelectorAll(".node")) {
    const id = el.dataset.id;
    el.classList.toggle("selected", state.selectedNodeIds.has(id));
  }

  const count = state.selectedNodeIds.size;
  if (state.selectedEdgeId) {
    const edge = state.edges.find((item) => item.id === state.selectedEdgeId);
    if (edge) {
      const from = state.nodes.find((node) => node.id === edge.from);
      const to = state.nodes.find((node) => node.id === edge.to);
      const fromLabel = from ? from.label : edge.from;
      const toLabel = to ? to.label : edge.to;
      selectionStatus.textContent = `Selection: connection ${fromLabel} -> ${toLabel}`;
      return;
    }
  }

  if (!count) {
    selectionStatus.textContent = "Selection: none";
  } else if (count === 1) {
    const selectedNode = getSelectedSingleNode();
    selectionStatus.textContent = `Selection: ${selectedNode.label}`;
  } else {
    selectionStatus.textContent = `Selection: ${count} nodes`;
  }
}

function renderInspector() {
  const selectedNode = getSelectedSingleNode();

  if (!selectedNode) {
    inspectorEmpty.classList.remove("hidden");
    inspectorForm.classList.add("hidden");
    return;
  }

  inspectorEmpty.classList.add("hidden");
  inspectorForm.classList.remove("hidden");

  nodeLabelInput.value = selectedNode.label;
  nodeTypeInput.value = selectedNode.type;
  nodeNotesInput.value = selectedNode.notes;
}

function renderEdges() {
  const width = Math.max(400, state.canvasWidth || board.clientWidth);
  const height = Math.max(BASE_CANVAS_HEIGHT, state.canvasHeight || board.clientHeight);
  edgesSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  edgesSvg.innerHTML = "";
  const baseColor = "#a5a5a5";
  const selectedColor = "#6f6f6f";
  const lineThickness = 1.6;
  const selectedWidth = 2.3;
  const arrowSize = 7;

  for (const edge of state.edges) {
    const from = state.nodes.find((node) => node.id === edge.from);
    const to = state.nodes.find((node) => node.id === edge.to);

    if (!from || !to) {
      continue;
    }

    const fromAnchor = getNodeAnchorPoint(from, edge.fromAnchor, 2);
    const toAnchor = getNodeAnchorPoint(to, edge.toAnchor, 6);
    const x1 = fromAnchor.x;
    const y1 = fromAnchor.y;
    const x2 = toAnchor.x;
    const y2 = toAnchor.y;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const isSelected = edge.id === state.selectedEdgeId;
    const isCurved = Boolean(edge.curved);

    if (isCurved) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / len;
      const ny = dx / len;
      const bow = Math.max(36, Math.min(120, len * 0.22));
      const mx = (x1 + x2) / 2 + nx * bow;
      const my = (y1 + y2) / 2 + ny * bow;
      const c1x = x1 + dx * 0.25 + nx * bow * 0.85;
      const c1y = y1 + dy * 0.25 + ny * bow * 0.85;
      const c2x = x1 + dx * 0.75 + nx * bow * 0.85;
      const c2y = y1 + dy * 0.75 + ny * bow * 0.85;
      path.setAttribute("d", `M ${x1} ${y1} Q ${c1x} ${c1y}, ${mx} ${my} Q ${c2x} ${c2y}, ${x2} ${y2}`);
      path.setAttribute("marker-mid", "url(#arrow-mid)");
      path.setAttribute("stroke-dasharray", "6 5");
    } else {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      path.setAttribute("d", `M ${x1} ${y1} L ${midX} ${midY} L ${x2} ${y2}`);
      path.setAttribute("marker-mid", "url(#arrow-mid)");
      path.removeAttribute("stroke-dasharray");
    }

    path.dataset.edgeId = edge.id;
    path.classList.add("edge-path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", isSelected ? selectedColor : baseColor);
    path.setAttribute("stroke-width", String(isSelected ? selectedWidth : lineThickness));
    path.setAttribute("stroke-linecap", "round");
    path.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.mode !== "builder") {
        return;
      }
      setEdgeSelection(edge.id);
    });

    edgesSvg.appendChild(path);
  }

  renderSelectedEdgeAnchorHandles();

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="arrow-mid" markerWidth="${arrowSize}" markerHeight="${arrowSize}" refX="${arrowSize / 2}" refY="${arrowSize / 2}" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L${arrowSize},${arrowSize / 2} L0,${arrowSize} z" fill="${baseColor}"></path>
    </marker>
  `;
  edgesSvg.appendChild(defs);
}

function getNodeAnchorPoint(node, anchorIndex, fallbackIndex) {
  const idx = Number.isInteger(anchorIndex) && anchorIndex >= 0 && anchorIndex < ANCHOR_POINTS.length
    ? anchorIndex
    : fallbackIndex;
  const anchor = ANCHOR_POINTS[idx] || ANCHOR_POINTS[fallbackIndex];
  return {
    x: node.x + NODE_WIDTH * anchor.x,
    y: node.y + NODE_HEIGHT * anchor.y,
  };
}

function renderSelectedEdgeAnchorHandles() {
  if (state.mode !== "builder" || !state.selectedEdgeId) {
    return;
  }

  const edge = state.edges.find((item) => item.id === state.selectedEdgeId);
  if (!edge) {
    return;
  }

  const fromNode = state.nodes.find((node) => node.id === edge.from);
  const toNode = state.nodes.find((node) => node.id === edge.to);
  if (!fromNode || !toNode) {
    return;
  }

  addAnchorHandlesForNode(fromNode, "from", edge.fromAnchor, 2);
  addAnchorHandlesForNode(toNode, "to", edge.toAnchor, 6);
}

function addAnchorHandlesForNode(node, end, selectedAnchorIndex, fallbackIndex) {
  for (let i = 0; i < ANCHOR_POINTS.length; i += 1) {
    const point = getNodeAnchorPoint(node, i, fallbackIndex);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(point.x));
    dot.setAttribute("cy", String(point.y));
    dot.setAttribute("r", i === selectedAnchorIndex ? "6.5" : "5.2");
    dot.classList.add("anchor-handle");
    if (i === selectedAnchorIndex) {
      dot.classList.add("selected");
    }
    dot.dataset.anchorEnd = end;
    dot.dataset.anchorIndex = String(i);
    dot.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.mode !== "builder") {
        return;
      }
      setSelectedEdgeAnchor(end, i);
    });
    edgesSvg.appendChild(dot);
  }
}

function setSelectedEdgeAnchor(end, anchorIndex) {
  if (!state.selectedEdgeId) {
    return;
  }
  const edge = state.edges.find((item) => item.id === state.selectedEdgeId);
  if (!edge) {
    return;
  }
  if (end === "from") {
    edge.fromAnchor = anchorIndex;
  } else if (end === "to") {
    edge.toAnchor = anchorIndex;
  } else {
    return;
  }
  renderEdges();
}

function getYouTubeVideoId(urlObj) {
  const host = urlObj.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    return urlObj.pathname.split("/").filter(Boolean)[0] || null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const byQuery = urlObj.searchParams.get("v");
    if (byQuery) {
      return byQuery;
    }

    const parts = urlObj.pathname.split("/").filter(Boolean);
    const key = parts[0];
    if ((key === "shorts" || key === "embed" || key === "live") && parts[1]) {
      return parts[1];
    }
  }

  return null;
}

function getVimeoVideoId(urlObj) {
  const host = urlObj.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") {
    return null;
  }

  const parts = urlObj.pathname.split("/").filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (/^\d+$/.test(parts[i])) {
      return parts[i];
    }
  }

  return null;
}

function getReferencePreview(reference) {
  try {
    const urlObj = new URL(reference.url);
    const displayTitle = reference.title?.trim() || "Loading title...";
    const youtubeId = getYouTubeVideoId(urlObj);
    if (youtubeId) {
      return {
        displayTitle,
        subtitle: "YouTube",
        thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      };
    }

    const vimeoId = getVimeoVideoId(urlObj);
    if (vimeoId) {
      return {
        displayTitle,
        subtitle: "Vimeo",
        thumbnailUrl: `https://vumbnail.com/${vimeoId}.jpg`,
      };
    }

    return {
      displayTitle,
      subtitle: urlObj.hostname.replace(/^www\./, ""),
      thumbnailUrl: null,
    };
  } catch {
    return {
      displayTitle: reference.title || reference.url,
      subtitle: "Video",
      thumbnailUrl: null,
    };
  }
}

function oEmbedEndpointFor(urlObj) {
  const host = urlObj.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    return `https://www.youtube.com/oembed?url=${encodeURIComponent(urlObj.toString())}&format=json`;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(urlObj.toString())}`;
  }
  return null;
}

async function hydrateReferenceTitle(referenceId) {
  if (state.titleFetchInFlight.has(referenceId)) {
    return;
  }

  const reference = state.references.find((ref) => ref.id === referenceId);
  if (!reference || reference.title?.trim()) {
    return;
  }

  let urlObj;
  try {
    urlObj = new URL(reference.url);
  } catch {
    return;
  }

  const endpoint = oEmbedEndpointFor(urlObj);
  if (!endpoint) {
    reference.title = urlObj.hostname.replace(/^www\./, "");
    persistCurrentChart();
    renderReferences();
    return;
  }

  try {
    state.titleFetchInFlight.add(referenceId);
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error("oEmbed lookup failed");
    }
    const data = await response.json();
    const title = typeof data.title === "string" ? data.title.trim() : "";
    if (!title) {
      throw new Error("missing title");
    }

    const current = state.references.find((ref) => ref.id === referenceId);
    if (!current) {
      return;
    }

    current.title = title.slice(0, 120);
    persistCurrentChart();
    renderReferences();
  } catch {
    const current = state.references.find((ref) => ref.id === referenceId);
    if (!current || current.title?.trim()) {
      return;
    }
    current.title = urlObj.hostname.replace(/^www\./, "");
    persistCurrentChart();
    renderReferences();
  } finally {
    state.titleFetchInFlight.delete(referenceId);
  }
}

function renderReferenceList(targetList, includeRemoveButtons) {
  targetList.innerHTML = "";

  if (!state.references.length) {
    const empty = document.createElement("li");
    empty.className = "references-empty";
    empty.textContent = "No references added for this chart yet.";
    targetList.appendChild(empty);
    return;
  }

  for (const reference of state.references) {
    const item = document.createElement("li");
    const preview = getReferencePreview(reference);
    const thumbLink = document.createElement("a");
    const content = document.createElement("div");
    const titleLink = document.createElement("a");
    const subtitle = document.createElement("p");
    const removeButton = document.createElement("button");

    thumbLink.href = reference.url;
    thumbLink.target = "_blank";
    thumbLink.rel = "noopener noreferrer";
    thumbLink.className = "reference-thumb-link";

    if (preview.thumbnailUrl) {
      const thumb = document.createElement("img");
      thumb.src = preview.thumbnailUrl;
      thumb.alt = `${preview.displayTitle} thumbnail`;
      thumb.loading = "lazy";
      thumb.className = "reference-thumb";
      thumbLink.appendChild(thumb);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "reference-thumb-fallback";
      fallback.textContent = preview.subtitle;
      thumbLink.appendChild(fallback);
    }

    content.className = "reference-content";

    titleLink.href = reference.url;
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";
    titleLink.className = "reference-title-link";
    titleLink.textContent = preview.displayTitle;

    subtitle.className = "reference-subtitle";
    subtitle.textContent = preview.subtitle;

    removeButton.type = "button";
    removeButton.className = "remove-reference";
    removeButton.dataset.referenceId = reference.id;
    removeButton.textContent = "Remove";

    content.appendChild(titleLink);
    content.appendChild(subtitle);
    item.appendChild(thumbLink);
    item.appendChild(content);

    if (includeRemoveButtons) {
      item.appendChild(removeButton);
    }

    targetList.appendChild(item);

    if (!reference.title?.trim()) {
      hydrateReferenceTitle(reference.id);
    }
  }
}

function renderReferences() {
  renderReferenceList(referencesList, true);
  renderReferenceList(userReferencesList, false);
}

function addReference(title, url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    alert("Please enter a valid URL.");
    return false;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    alert("Reference URL must start with http:// or https://");
    return false;
  }

  state.references.push({
    id: uid("ref"),
    title: title.trim(),
    url: parsedUrl.toString(),
  });
  persistCurrentChart();
  renderReferences();
  if (!title.trim()) {
    const newest = state.references[state.references.length - 1];
    hydrateReferenceTitle(newest.id);
  }
  return true;
}

function removeReference(referenceId) {
  state.references = state.references.filter((reference) => reference.id !== referenceId);
  persistCurrentChart();
  renderReferences();
}

function getSelectedSingleNode() {
  if (state.selectedNodeIds.size !== 1) {
    return null;
  }

  const selectedId = [...state.selectedNodeIds][0];
  return state.nodes.find((node) => node.id === selectedId) || null;
}

function startDrag(event, nodeId) {
  if (state.mode !== "builder") {
    return;
  }

  const node = state.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return;
  }
  hideNodeTooltip();

  const rect = board.getBoundingClientRect();
  const canvasX = (event.clientX - rect.left + board.scrollLeft) / state.zoom;
  const canvasY = (event.clientY - rect.top + board.scrollTop) / state.zoom;
  const draggingSelectedGroup = state.selectedNodeIds.size > 1 && state.selectedNodeIds.has(nodeId);
  const draggedIds = draggingSelectedGroup ? [...state.selectedNodeIds] : [nodeId];
  const originById = {};
  draggedIds.forEach((id) => {
    const draggedNode = state.nodes.find((item) => item.id === id);
    if (draggedNode) {
      originById[id] = { x: draggedNode.x, y: draggedNode.y };
    }
  });

  state.drag = {
    nodeId,
    startCanvasX: canvasX,
    startCanvasY: canvasY,
    draggedIds,
    originById,
  };

  event.target.setPointerCapture(event.pointerId);
}

function handleMove(event) {
  if (!state.drag || state.mode !== "builder") {
    return;
  }

  const rect = board.getBoundingClientRect();
  const canvasX = (event.clientX - rect.left + board.scrollLeft) / state.zoom;
  const canvasY = (event.clientY - rect.top + board.scrollTop) / state.zoom;
  const deltaX = canvasX - state.drag.startCanvasX;
  const deltaY = canvasY - state.drag.startCanvasY;

  let requiredX = 0;
  let requiredY = 0;
  state.drag.draggedIds.forEach((id) => {
    const origin = state.drag.originById[id];
    if (!origin) {
      return;
    }
    requiredX = Math.max(requiredX, origin.x + deltaX + NODE_WIDTH + CANVAS_PADDING);
    requiredY = Math.max(requiredY, origin.y + deltaY + NODE_HEIGHT + CANVAS_PADDING);
  });
  ensureCanvasSize(requiredX, requiredY);

  state.drag.draggedIds.forEach((id) => {
    const node = state.nodes.find((item) => item.id === id);
    const origin = state.drag.originById[id];
    if (!node || !origin) {
      return;
    }
    node.x = clamp(origin.x + deltaX, 6, state.canvasWidth - (NODE_WIDTH + 10));
    node.y = clamp(origin.y + deltaY, 6, state.canvasHeight - (NODE_HEIGHT + 10));

    const nodeEl = zoomLayer.querySelector(`.node[data-id="${node.id}"]`);
    if (nodeEl) {
      nodeEl.style.left = `${node.x}px`;
      nodeEl.style.top = `${node.y}px`;
    }
  });

  renderEdges();
}

function stopDrag() {
  state.drag = null;
}

function autoLayout() {
  if (!state.nodes.length) {
    return;
  }

  const map = new Map();
  const incoming = new Map();
  for (const node of state.nodes) {
    map.set(node.id, []);
    incoming.set(node.id, 0);
  }

  for (const edge of state.edges) {
    if (map.has(edge.from) && incoming.has(edge.to)) {
      map.get(edge.from).push(edge.to);
      incoming.set(edge.to, incoming.get(edge.to) + 1);
    }
  }

  const roots = state.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  const orderedRoots = roots.length ? roots : [state.nodes[0].id];

  const depth = new Map();
  const queue = [...orderedRoots];
  for (const rootId of orderedRoots) {
    depth.set(rootId, 0);
  }

  while (queue.length) {
    const current = queue.shift();
    const nextDepth = (depth.get(current) || 0) + 1;

    for (const child of map.get(current) || []) {
      if (!depth.has(child) || depth.get(child) < nextDepth) {
        depth.set(child, nextDepth);
      }
      queue.push(child);
    }
  }

  const levels = new Map();
  for (const node of state.nodes) {
    const d = depth.get(node.id) || 0;
    if (!levels.has(d)) {
      levels.set(d, []);
    }
    levels.get(d).push(node);
  }

  const sortedDepths = [...levels.keys()].sort((a, b) => a - b);
  const rowHeight = 125;
  const colWidth = 240;
  const maxRows = Math.max(...[...levels.values()].map((arr) => arr.length), 1);

  ensureCanvasSize(
    80 + sortedDepths.length * colWidth + NODE_WIDTH + CANVAS_PADDING,
    80 + maxRows * rowHeight + NODE_HEIGHT + CANVAS_PADDING,
  );

  sortedDepths.forEach((d, col) => {
    const levelNodes = levels.get(d);
    levelNodes.forEach((node, row) => {
      node.x = clamp(40 + col * colWidth, 6, state.canvasWidth - (NODE_WIDTH + 10));
      node.y = clamp(30 + row * rowHeight, 6, state.canvasHeight - (NODE_HEIGHT + 10));
    });
  });

  render();
}

function serializeCurrentChart() {
  return JSON.stringify(
    {
      position: state.currentPosition,
      chartType: state.currentChartType,
      nodes: state.nodes,
      edges: state.edges,
      references: state.references,
    },
    null,
    2,
  );
}

function loadDataIntoCurrentChart(data) {
  state.nodes = Array.isArray(data.nodes) ? data.nodes : [];
  state.edges = Array.isArray(data.edges) ? data.edges : [];
  state.references = Array.isArray(data.references) ? data.references : [];
  state.selectedNodeIds.clear();
  state.selectedEdgeId = null;
  state.canvasWidth = 0;
  state.canvasHeight = 0;
  ensureCanvasSize();
  persistCurrentChart();
  renderReferences();
  render();
}

function saveLocal() {
  persistCurrentChart();
  const workspace = {
    currentPosition: state.currentPosition,
    currentChartType: state.currentChartType,
    mode: state.mode,
    theme: state.theme,
    charts: state.charts,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

function applyWorkspacePayload(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return false;
  }

  state.charts = parsed.charts && typeof parsed.charts === "object" ? parsed.charts : {};

  if (POSITIONS.includes(parsed.currentPosition)) {
    state.currentPosition = parsed.currentPosition;
  }

  if (FLOW_TYPES.includes(parsed.currentChartType)) {
    state.currentChartType = parsed.currentChartType;
  }

  if (parsed.mode === "user" || parsed.mode === "builder") {
    setMode(parsed.mode);
  } else {
    setMode("builder");
  }

  if (parsed.theme === "dark" || parsed.theme === "light") {
    setTheme(parsed.theme);
  } else {
    setTheme("dark");
  }

  positionSelect.value = state.currentPosition;
  chartTypeSelect.value = state.currentChartType;
  loadCurrentChart();
  return true;
}

function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw);
    return applyWorkspacePayload(parsed);
  } catch {
    alert("Stored workspace could not be loaded.");
    return false;
  }
}

async function loadBundledWorkspace() {
  try {
    const response = await fetch(BUNDLED_WORKSPACE_URL, { cache: "no-store" });
    if (!response.ok) {
      console.warn("Bundled workspace fetch failed", response.status, BUNDLED_WORKSPACE_URL);
      return false;
    }
    const parsed = await response.json();
    return applyWorkspacePayload(parsed);
  } catch (error) {
    console.warn("Bundled workspace fetch error", BUNDLED_WORKSPACE_URL, error);
    return false;
  }
}

function exportJson() {
  const blob = new Blob([serializeCurrentChart()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.currentPosition.toLowerCase().replace(/\s+/g, "-")}-${state.currentChartType
    .toLowerCase()
    .replace(/\s+/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportWorkspaceJson() {
  persistCurrentChart();
  const payload = JSON.stringify(
    {
      currentPosition: state.currentPosition,
      currentChartType: state.currentChartType,
      mode: state.mode,
      theme: state.theme,
      charts: state.charts,
    },
    null,
    2,
  );
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bjj-flowchart-workspace.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
        loadDataIntoCurrentChart(data);
        return;
      }

      if (data && data.charts && typeof data.charts === "object") {
        applyWorkspacePayload(data);
        return;
      }

      throw new Error("Unsupported JSON format");
    } catch {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
}

function randomPath() {
  if (!state.nodes.length) {
    pathOutput.textContent = "Create or load nodes first.";
    return;
  }

  const incomingCount = new Map(state.nodes.map((node) => [node.id, 0]));
  for (const edge of state.edges) {
    if (incomingCount.has(edge.to)) {
      incomingCount.set(edge.to, incomingCount.get(edge.to) + 1);
    }
  }

  let current = state.nodes.find((node) => incomingCount.get(node.id) === 0) || state.nodes[0];
  const visited = new Set();
  const labels = [];

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    labels.push(current.label);
    const options = state.edges
      .filter((edge) => edge.from === current.id)
      .map((edge) => state.nodes.find((node) => node.id === edge.to))
      .filter(Boolean);

    if (!options.length) {
      break;
    }

    current = options[Math.floor(Math.random() * options.length)];
  }

  pathOutput.textContent = labels.join(" -> ");
}

async function fetchYouTubeTranscript(videoId) {
  const endpoints = [
    `https://www.youtube.com/api/timedtext?lang=en&fmt=json3&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?lang=en&kind=asr&fmt=json3&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        continue;
      }

      const body = await response.text();
      const transcript = parseTimedText(body);
      if (transcript) {
        return transcript;
      }
    } catch {
      // Try the next endpoint.
    }
  }

  const captionTrackUrls = await fetchYouTubeCaptionTrackUrls(videoId);
  for (const trackUrl of captionTrackUrls) {
    try {
      const response = await fetch(trackUrl);
      if (!response.ok) {
        continue;
      }

      const body = await response.text();
      const transcript = parseTimedText(body);
      if (transcript) {
        return transcript;
      }
    } catch {
      // Try the next caption track URL.
    }
  }

  return "";
}

async function fetchYouTubeCaptionTrackUrls(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const response = await fetch(watchUrl);
    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const marker = "ytInitialPlayerResponse = ";
    const start = html.indexOf(marker);
    if (start === -1) {
      return [];
    }

    const jsonStart = start + marker.length;
    const jsonEnd = html.indexOf("};", jsonStart);
    if (jsonEnd === -1) {
      return [];
    }

    const payload = html.slice(jsonStart, jsonEnd + 1);
    const playerResponse = JSON.parse(payload);
    const tracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    const preferred = tracks
      .map((track) => ({
        url: track.baseUrl,
        lang: track.languageCode || "",
        kind: track.kind || "",
      }))
      .filter((track) => typeof track.url === "string" && track.url);

    preferred.sort((a, b) => {
      const aScore = (a.lang.startsWith("en") ? 2 : 0) + (a.kind === "asr" ? 0 : 1);
      const bScore = (b.lang.startsWith("en") ? 2 : 0) + (b.kind === "asr" ? 0 : 1);
      return bScore - aScore;
    });

    return preferred.map((track) => track.url);
  } catch {
    return [];
  }
}

function parseTimedText(payload) {
  const trimmed = payload.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      const chunks = (json.events || [])
        .flatMap((event) => event.segs || [])
        .map((segment) => (typeof segment.utf8 === "string" ? segment.utf8 : ""))
        .filter(Boolean);
      return chunks.join(" ").replace(/\s+/g, " ").trim();
    } catch {
      return "";
    }
  }

  if (trimmed.startsWith("<")) {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(trimmed, "text/xml");
      const texts = [...xml.querySelectorAll("text")]
        .map((node) => node.textContent || "")
        .filter(Boolean);
      return texts.join(" ").replace(/\s+/g, " ").trim();
    } catch {
      return "";
    }
  }

  return "";
}

function positionConceptCatalog(position, flowType) {
  const genericAttacks = [
    { label: "Opponent Frames", type: "reaction", keywords: ["frame", "frames"] },
    { label: "Pressure and Isolate", type: "attack", keywords: ["isolate", "control", "pressure"] },
    { label: "Armbar", type: "finish", keywords: ["armbar", "juji"] },
    { label: "Triangle", type: "finish", keywords: ["triangle"] },
    { label: "Kimura", type: "finish", keywords: ["kimura"] },
    { label: "Guillotine", type: "finish", keywords: ["guillotine"] },
    { label: "Back Take", type: "attack", keywords: ["back take", "take the back"] },
    { label: "Choke Finish", type: "finish", keywords: ["choke", "strangle"] },
    { label: "Sweep", type: "finish", keywords: ["sweep"] },
  ];

  const genericEscapes = [
    { label: "Opponent Posts", type: "reaction", keywords: ["post", "posting"] },
    { label: "Opponent Drives Pressure", type: "reaction", keywords: ["drives", "pressure", "heavy"] },
    { label: "Frame and Shrimp", type: "attack", keywords: ["frame", "shrimp", "hip escape"] },
    { label: "Bridge and Turn", type: "attack", keywords: ["bridge", "upa", "trap and roll"] },
    { label: "Reguard", type: "finish", keywords: ["recover guard", "reguard", "guard recovery"] },
    { label: "Come Up to Single", type: "attack", keywords: ["single leg", "wrestle up"] },
    { label: "Stand Up Escape", type: "finish", keywords: ["stand up", "technical stand up"] },
  ];

  const positionSpecific = {
    Mount: {
      Attacks: [
        { label: "High Mount Climb", type: "attack", keywords: ["high mount", "s mount", "s-mount"] },
        { label: "Cross Collar Feed", type: "attack", keywords: ["cross collar", "cross choke", "collar choke"] },
        { label: "Americana", type: "finish", keywords: ["americana", "paintbrush"] },
        { label: "Mounted Triangle", type: "finish", keywords: ["mounted triangle"] },
      ],
      Escapes: [
        { label: "Elbow Knee Escape", type: "attack", keywords: ["elbow knee", "knee elbow"] },
        { label: "Kipping Escape", type: "attack", keywords: ["kipping"] },
        { label: "Recover Half Guard", type: "finish", keywords: ["half guard", "knee shield"] },
      ],
    },
    "Side Control": {
      Attacks: [
        { label: "Near-Side Kimura", type: "finish", keywords: ["kimura"] },
        { label: "Paper Cutter Choke", type: "finish", keywords: ["paper cutter"] },
        { label: "Mount Transition", type: "attack", keywords: ["transition to mount", "go to mount"] },
      ],
      Escapes: [
        { label: "Underhook to Dogfight", type: "attack", keywords: ["underhook", "dogfight"] },
        { label: "Ghost Escape", type: "attack", keywords: ["ghost escape"] },
      ],
    },
    "Closed Guard": {
      Attacks: [
        { label: "Pendulum Sweep", type: "finish", keywords: ["pendulum sweep"] },
        { label: "Flower Sweep", type: "finish", keywords: ["flower sweep"] },
      ],
      Escapes: [
        { label: "Posture and Stand", type: "attack", keywords: ["posture", "stand", "open guard"] },
      ],
    },
    "Half Guard": {
      Attacks: [
        { label: "Knee Shield to Underhook", type: "attack", keywords: ["knee shield", "underhook"] },
        { label: "Old School Sweep", type: "finish", keywords: ["old school"] },
      ],
      Escapes: [
        { label: "Crossface Flatten", type: "attack", keywords: ["crossface", "flatten"] },
        { label: "Knee Slice Pass", type: "finish", keywords: ["knee slice"] },
      ],
    },
    "Open Guard": {
      Attacks: [
        { label: "De La Riva Entry", type: "attack", keywords: ["de la riva"] },
        { label: "X-Guard Sweep", type: "finish", keywords: ["x guard", "x-guard"] },
      ],
      Escapes: [
        { label: "Pummel Legs and Clear Hooks", type: "attack", keywords: ["pummel", "clear hooks"] },
      ],
    },
    "Back Control": {
      Attacks: [
        { label: "Bow and Arrow Setup", type: "attack", keywords: ["bow and arrow"] },
        { label: "Rear Naked Choke", type: "finish", keywords: ["rear naked", "rnc"] },
      ],
      Escapes: [
        { label: "Two-on-One Hand Fight", type: "attack", keywords: ["hand fight", "two on one"] },
        { label: "Turn Into Guard", type: "finish", keywords: ["turn in", "guard"] },
      ],
    },
    Standing: {
      Attacks: [
        { label: "Single Leg Entry", type: "attack", keywords: ["single leg"] },
        { label: "Double Leg Finish", type: "finish", keywords: ["double leg"] },
      ],
      Escapes: [
        { label: "Sprawl", type: "attack", keywords: ["sprawl"] },
        { label: "Front Headlock Control", type: "finish", keywords: ["front headlock"] },
      ],
    },
  };

  const baseline = flowType === "Escapes" ? genericEscapes : genericAttacks;
  const specific = positionSpecific[position]?.[flowType] || [];
  return [...baseline, ...specific];
}

function extractConceptsFromTranscript(transcript, position, flowType) {
  const normalized = transcript.toLowerCase();
  const catalog = positionConceptCatalog(position, flowType);
  const concepts = [];

  for (const concept of catalog) {
    const firstMatch = concept.keywords.find((keyword) => normalized.includes(keyword));
    if (!firstMatch) {
      continue;
    }

    concepts.push({
      label: concept.label,
      type: concept.type,
      note: `Derived from transcript mention of "${firstMatch}".`,
      score: normalized.indexOf(firstMatch),
    });
  }

  concepts.sort((a, b) => a.score - b.score);
  return concepts;
}

function buildChartFromConcepts(concepts, position, flowType) {
  const startLabel = flowType === "Escapes" ? `${position} Survival` : `${position} Control`;
  const startNote = flowType === "Escapes" ? "Start with defense, frames, and timing." : "Start with control and pressure.";
  const maxNodes = 9;

  const nodes = [
    {
      id: "start",
      label: startLabel,
      type: "position",
      notes: startNote,
      x: 50,
      y: 170,
    },
  ];
  const edges = [];
  let previousId = "start";

  for (const concept of concepts.slice(0, maxNodes - 1)) {
    const id = uid("mt");
    nodes.push({
      id,
      label: concept.label,
      type: concept.type,
      notes: concept.note,
      x: 300,
      y: 170,
    });
    edges.push({ id: uid("edge"), from: previousId, to: id });
    previousId = id;
  }

  if (nodes.length === 1) {
    nodes.push({
      id: "fallback",
      label: flowType === "Escapes" ? "Primary Escape Route" : "Primary Attack Route",
      type: "attack",
      notes: "No clear transcript keywords found; added a default continuation.",
      x: 320,
      y: 170,
    });
    edges.push({ id: uid("edge"), from: "start", to: "fallback" });
  }

  return { nodes, edges };
}

function applyTranscriptTextToCurrentFlow(transcriptText, sourceLabel) {
  const concepts = extractConceptsFromTranscript(
    transcriptText,
    state.currentPosition,
    state.currentChartType,
  );
  const generated = buildChartFromConcepts(concepts, state.currentPosition, state.currentChartType);

  loadDataIntoCurrentChart({
    nodes: generated.nodes,
    edges: generated.edges,
    references: state.references,
  });
  autoLayout();

  const sourceSuffix = sourceLabel ? ` from ${sourceLabel}` : "";
  transcriptStatus.textContent = `Built ${state.currentPosition} ${state.currentChartType} with ${generated.nodes.length} nodes${sourceSuffix}.`;
}

async function buildFlowFromReferenceTranscripts() {
  if (state.mode !== "builder") {
    return;
  }

  const refsWithVideoIds = state.references
    .map((reference) => {
      try {
        const urlObj = new URL(reference.url);
        const videoId = getYouTubeVideoId(urlObj);
        return videoId ? { reference, videoId } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (!refsWithVideoIds.length) {
    transcriptStatus.textContent = "No YouTube references found for transcript extraction.";
    return;
  }

  buildFromTranscriptsButton.disabled = true;
  transcriptStatus.textContent = `Fetching transcripts from ${refsWithVideoIds.length} reference(s)...`;

  try {
    const transcriptResults = await Promise.all(
      refsWithVideoIds.map(async ({ videoId, reference }) => ({
        title: reference.title || reference.url,
        transcript: await fetchYouTubeTranscript(videoId),
      })),
    );

    const successful = transcriptResults.filter((result) => result.transcript);
    if (!successful.length) {
      transcriptStatus.textContent = "Unable to fetch transcripts from the current references.";
      return;
    }

    const combinedTranscript = successful.map((result) => result.transcript).join(" ");
    applyTranscriptTextToCurrentFlow(combinedTranscript, `${successful.length} reference transcript(s)`);
  } catch {
    transcriptStatus.textContent = "Transcript build failed. Check references and try again.";
  } finally {
    buildFromTranscriptsButton.disabled = false;
  }
}

function mountAttacksTemplate() {
  return {
    nodes: [
      {
        id: "n1",
        label: "Low Mount Control",
        type: "position",
        notes: "Start heavy with chest pressure and knees pinched.",
        x: 40,
        y: 190,
      },
      {
        id: "n2",
        label: "Cross Collar Feed",
        type: "attack",
        notes: "Slide deep first grip and hide elbow.",
        x: 340,
        y: 80,
      },
      {
        id: "n3",
        label: "High Mount Climb",
        type: "attack",
        notes: "Walk knees high when they defend neck.",
        x: 340,
        y: 190,
      },
      {
        id: "n4",
        label: "Opponent Frames",
        type: "reaction",
        notes: "Elbows come inside to create distance.",
        x: 340,
        y: 300,
      },
      {
        id: "n5",
        label: "Armbar",
        type: "finish",
        notes: "Trap near arm and turn angle.",
        x: 650,
        y: 140,
      },
      {
        id: "n6",
        label: "Mounted Triangle",
        type: "finish",
        notes: "Switch if armbar defense stacks.",
        x: 650,
        y: 250,
      },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2" },
      { id: "e2", from: "n1", to: "n3" },
      { id: "e3", from: "n1", to: "n4" },
      { id: "e4", from: "n2", to: "n5" },
      { id: "e5", from: "n3", to: "n5" },
      { id: "e6", from: "n4", to: "n6" },
    ],
    references: [],
  };
}

function mountEscapesTemplate() {
  return {
    nodes: [
      {
        id: "m1",
        label: "Bottom Mount Survival",
        type: "position",
        notes: "Frame and protect neck while controlling distance.",
        x: 40,
        y: 190,
      },
      {
        id: "m2",
        label: "Opponent Posts Hands",
        type: "reaction",
        notes: "Weight shifts forward and hands open.",
        x: 340,
        y: 90,
      },
      {
        id: "m3",
        label: "Opponent Sits Heavy",
        type: "reaction",
        notes: "Hips low and head centered.",
        x: 340,
        y: 250,
      },
      {
        id: "m4",
        label: "Trap and Bridge",
        type: "attack",
        notes: "Trap arm + foot, bridge over shoulder.",
        x: 650,
        y: 90,
      },
      {
        id: "m5",
        label: "Elbow Knee Escape",
        type: "attack",
        notes: "Shrimp and recover half guard.",
        x: 650,
        y: 250,
      },
      {
        id: "m6",
        label: "Recover Guard",
        type: "finish",
        notes: "Close guard or establish knee shield.",
        x: 940,
        y: 170,
      },
    ],
    edges: [
      { id: "me1", from: "m1", to: "m2" },
      { id: "me2", from: "m1", to: "m3" },
      { id: "me3", from: "m2", to: "m4" },
      { id: "me4", from: "m3", to: "m5" },
      { id: "me5", from: "m4", to: "m6" },
      { id: "me6", from: "m5", to: "m6" },
    ],
    references: [],
  };
}

function starterChart(position, chartType) {
  return {
    nodes: [
      {
        id: uid("node"),
        label: `${position} ${chartType}`,
        type: "position",
        notes: "Start node.",
        x: 50,
        y: 170,
      },
    ],
    edges: [],
    references: [],
  };
}

function templateFor(position, chartType) {
  if (position === "Mount" && chartType === "Attacks") {
    return mountAttacksTemplate();
  }

  if (position === "Mount" && chartType === "Escapes") {
    return mountEscapesTemplate();
  }

  return starterChart(position, chartType);
}

function loadTemplateForCurrentSelection() {
  const template = templateFor(state.currentPosition, state.currentChartType);
  loadDataIntoCurrentChart(template);
}

function switchChart(position, chartType) {
  persistCurrentChart();
  state.currentPosition = position;
  state.currentChartType = chartType;
  loadCurrentChart();

  if (!state.nodes.length) {
    loadTemplateForCurrentSelection();
  }
}

board.addEventListener("click", () => {
  hideNodeTooltip();
  if (state.mode !== "builder") {
    return;
  }
  setSelection(null);
});
board.addEventListener("pointermove", handleMove);
board.addEventListener("pointerup", stopDrag);
board.addEventListener("pointerleave", stopDrag);
window.addEventListener("resize", () => {
  hideNodeTooltip();
  ensureCanvasSize();
  renderEdges();
});

positionSelect.addEventListener("change", () => {
  switchChart(positionSelect.value, chartTypeSelect.value);
});

chartTypeSelect.addEventListener("change", () => {
  switchChart(positionSelect.value, chartTypeSelect.value);
});

document.getElementById("add-node").addEventListener("click", () => {
  if (state.mode !== "builder") {
    return;
  }
  const selected = getSelectedSingleNode();
  const id = addNode({
    type: selected?.type || "attack",
    x: selected ? selected.x + NODE_WIDTH + 30 : 80,
    y: selected ? selected.y : 80,
  });
  setSelection(id);
});

document.getElementById("connect-nodes").addEventListener("click", () => {
  if (state.mode !== "builder") {
    return;
  }
  const ids = [...state.selectedNodeIds];
  if (ids.length !== 2) {
    alert("Select exactly two nodes to connect.");
    return;
  }
  connectNodes(ids[0], ids[1]);
});

document.getElementById("delete-connection").addEventListener("click", () => {
  if (state.mode !== "builder") {
    return;
  }
  deleteSelectedConnection();
});

document.getElementById("toggle-connection-curve").addEventListener("click", () => {
  if (state.mode !== "builder") {
    return;
  }
  toggleSelectedConnectionCurve();
});

document.getElementById("delete-selection").addEventListener("click", () => {
  if (state.mode !== "builder") {
    return;
  }
  deleteSelected();
});
document.getElementById("auto-layout").addEventListener("click", () => {
  if (state.mode !== "builder") {
    return;
  }
  autoLayout();
});
document.getElementById("load-template").addEventListener("click", loadTemplateForCurrentSelection);

document.getElementById("clear-board").addEventListener("click", () => {
  if (state.mode !== "builder") {
    return;
  }
  loadDataIntoCurrentChart({ nodes: [], edges: [] });
});

document.getElementById("save-local").addEventListener("click", saveLocal);
document.getElementById("load-local").addEventListener("click", loadLocal);
document.getElementById("export-workspace").addEventListener("click", exportWorkspaceJson);
loadBundledButton.addEventListener("click", async () => {
  const loaded = await loadBundledWorkspace();
  if (!loaded) {
    alert(`Bundled workspace could not be loaded from ${BUNDLED_WORKSPACE_URL}`);
    return;
  }
  transcriptStatus.textContent = "Loaded bundled workspace data.";
});
document.getElementById("export-json").addEventListener("click", exportJson);
document.getElementById("import-json").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) {
    importJson(file);
  }
  event.target.value = "";
});
document.getElementById("random-path").addEventListener("click", randomPath);
buildFromTranscriptsButton.addEventListener("click", buildFlowFromReferenceTranscripts);
zoomOutButton.addEventListener("click", () => setZoom(state.zoom - 0.1));
zoomInButton.addEventListener("click", () => setZoom(state.zoom + 0.1));
zoomResetButton.addEventListener("click", () => setZoom(1));
themeToggleButton.addEventListener("click", () => {
  setTheme(state.theme === "dark" ? "light" : "dark");
});
modeToggleButton.addEventListener("click", () => {
  const nextMode = state.mode === "builder" ? "user" : "builder";
  setMode(nextMode);
});

referenceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.mode !== "builder") {
    return;
  }
  const saved = addReference(referenceTitleInput.value, referenceUrlInput.value);
  if (saved) {
    referenceForm.reset();
  }
});

referencesList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-reference");
  if (!button) {
    return;
  }
  removeReference(button.dataset.referenceId);
});

nodeLabelInput.addEventListener("input", () => {
  if (state.mode !== "builder") {
    return;
  }
  const node = getSelectedSingleNode();
  if (!node) {
    return;
  }

  node.label = nodeLabelInput.value.slice(0, 60);
  render();
});

nodeTypeInput.addEventListener("change", () => {
  if (state.mode !== "builder") {
    return;
  }
  const node = getSelectedSingleNode();
  if (!node) {
    return;
  }

  node.type = nodeTypeInput.value;
  render();
});

nodeNotesInput.addEventListener("input", () => {
  if (state.mode !== "builder") {
    return;
  }
  const node = getSelectedSingleNode();
  if (!node) {
    return;
  }

  node.notes = nodeNotesInput.value.slice(0, 400);
  render();
});

positionSelect.value = state.currentPosition;
chartTypeSelect.value = state.currentChartType;
setActiveChartLabel();
setMode("builder");
setTheme("dark");
ensureCanvasSize();
applyZoom();
async function initializeApp() {
  const loadedBundled = await loadBundledWorkspace();
  if (!loadedBundled) {
    const loadedLocal = loadLocal();
    if (!loadedLocal) {
      loadTemplateForCurrentSelection();
      transcriptStatus.textContent = "Startup source: built-in template fallback.";
    } else {
      transcriptStatus.textContent = "Startup source: browser storage.";
    }
  } else {
    transcriptStatus.textContent = "Startup source: bundled workspace file.";
  }
  render();
}

initializeApp();
