const state = {
  currentScene: 1,
  highlightedCause: null,
  selectedCarrier: "WN",
  selectedYear: 2025,
};

const causes = [
  {
    key: "carrier_delay",
    id: "carrier",
    label: "Air Carrier",
    fullLabel: "Air Carrier Delay",
    color: "#b23a48",
  },
  {
    key: "weather_delay",
    id: "weather",
    label: "Weather",
    fullLabel: "Weather Delay",
    color: "#3b82b7",
  },
  {
    key: "nas_delay",
    id: "nas",
    label: "NAS",
    fullLabel: "National Aviation System Delay",
    color: "#6f5aa7",
  },
  {
    key: "security_delay",
    id: "security",
    label: "Security",
    fullLabel: "Security Delay",
    color: "#7d8790",
  },
  {
    key: "late_aircraft_delay",
    id: "late_aircraft",
    label: "Late Aircraft",
    fullLabel: "Late Aircraft Delay",
    color: "#d97732",
  },
];

const causeByKey = new Map(causes.map((cause) => [cause.key, cause]));
const causeById = new Map(causes.map((cause) => [cause.id, cause]));
const causeKeys = causes.map((cause) => cause.key);

const formatPercent = d3.format(".1%");
const formatMinutes = d3.format(",.0f");
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

let scene1Data = [];
let scene2Data = [];
let scene3Data = [];
let resizeTimer;


function parseScene1Row(row) {
  return {
    ...row,
    delay_minutes: +row.delay_minutes,
    share: +row.share,
  };
}

function parseAggregateRow(row) {
  const parsed = { ...row };
  parsed.year = row.year === undefined ? undefined : +row.year;
  parsed.month = row.month === undefined ? undefined : +row.month;
  parsed.arr_flights = +row.arr_flights;
  parsed.cause_total = +row.cause_total;

  causeKeys.forEach((key) => {
    parsed[key] = +row[key];
  });

  return parsed;
}

async function initialize() {
  [scene1Data, scene2Data, scene3Data] = await Promise.all([
    d3.csv("data/scene1_causes_2025.csv", parseScene1Row),
    d3.csv("data/scene2_airlines_2025.csv", parseAggregateRow),
    d3.csv("data/scene3_airline_monthly_2019_2025.csv", parseAggregateRow),
  ]);

  scene1Data.sort((a, b) => d3.descending(a.delay_minutes, b.delay_minutes));
  scene2Data.sort((a, b) => d3.descending(a.arr_flights, b.arr_flights));

  populateScene3Controls();
  createLegend("#scene-2-legend", 2);
  createLegend("#scene-3-legend", 3);
  attachTriggers();
  showScene(1);
}


function attachTriggers() {
  document.querySelectorAll("[data-scene-target]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.reset === "true") {
        resetNarrative();
      }
      showScene(+button.dataset.sceneTarget);
    });
  });

  document.querySelector("#carrier-select").addEventListener("change", (event) => {
    state.selectedCarrier = event.target.value;
    renderScene3();
  });

  document.querySelector("#year-select").addEventListener("change", (event) => {
    state.selectedYear = +event.target.value;
    renderScene3();
  });

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderCurrentScene, 140);
  });
}

function showScene(sceneNumber) {
  state.currentScene = sceneNumber;
  state.highlightedCause = null;

  document.querySelectorAll(".scene-panel").forEach((panel) => {
    panel.hidden = panel.id !== `scene-${sceneNumber}`;
  });

  renderCurrentScene();
  window.scrollTo(0, 0);
}

function renderCurrentScene() {
  if (state.currentScene === 1) renderScene1();
  if (state.currentScene === 2) renderScene2();
  if (state.currentScene === 3) renderScene3();
}

function resetNarrative() {
  state.highlightedCause = null;
  state.selectedCarrier = "WN";
  state.selectedYear = 2025;

  document.querySelector("#carrier-select").value = state.selectedCarrier;
  document.querySelector("#year-select").value = state.selectedYear;
}



function chartSize(frameSelector, desktopHeight, mobileHeight = desktopHeight) {
  const frame = document.querySelector(frameSelector);
  const width = Math.max(frame.clientWidth, 300);
  const mobile = width < 680;

  return {
    frame,
    width,
    height: mobile ? mobileHeight : desktopHeight,
    mobile,
  };
}

function createLegend(selector, sceneNumber) {
  const legend = d3.select(selector);

  legend
    .selectAll("button")
    .data(causes)
    .join("button")
    .attr("type", "button")
    .attr("class", "legend-item")
    .attr("aria-label", (cause) => `Highlight ${cause.fullLabel}`)
    .html(
      (cause) =>
        `<span class="legend-swatch" style="background:${cause.color}"></span>${cause.label}`,
    )
    .on("mouseenter focus", (_, cause) => highlightStackCause(sceneNumber, cause.key))
    .on("mouseleave blur", () => highlightStackCause(sceneNumber, null));
}

function highlightStackCause(sceneNumber, causeKey) {
  state.highlightedCause = causeKey;
  const chartSelector = sceneNumber === 2 ? "#scene-2-chart" : "#scene-3-chart";
  const legendSelector = sceneNumber === 2 ? "#scene-2-legend" : "#scene-3-legend";

  d3.select(chartSelector)
    .selectAll(".stack-segment")
    .classed("is-muted", (datum) => causeKey !== null && datum.causeKey !== causeKey);

  d3.select(legendSelector)
    .selectAll(".legend-item")
    .classed("is-muted", (cause) => causeKey !== null && cause.key !== causeKey);
}

function showTooltip(tooltip, frame, event, html) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;

  if (event.type === "focus") {
    tooltip.style.left = "12px";
    tooltip.style.top = "12px";
    return;
  }

  moveTooltip(tooltip, frame, event);
}

function moveTooltip(tooltip, frame, event) {
  if (tooltip.hidden || !Number.isFinite(event.clientX)) return;

  const frameBounds = frame.getBoundingClientRect();
  const tooltipWidth = tooltip.offsetWidth;
  const x = Math.min(
    event.clientX - frameBounds.left + 12,
    frameBounds.width - tooltipWidth - 8,
  );
  const y = Math.max(8, event.clientY - frameBounds.top - 45);

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip(tooltip) {
  tooltip.hidden = true;
}

function addD3Annotation(root, annotation, type = d3.annotationCallout) {
  const makeAnnotation = d3.annotation().type(type).annotations([annotation]);
  root.append("g").attr("class", "annotation-group").call(makeAnnotation);
}



function renderScene1() {
  const { frame, width, height, mobile } = chartSize(
    "#scene-1-chart-frame",
    500,
    560,
  );
  const margin = {
    top: 62,
    right: mobile ? 76 : 160,
    bottom: 55,
    left: mobile ? 110 : 155,
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const svg = d3.select("#scene-1-chart");
  const tooltip = document.querySelector("#scene-1-tooltip");

  svg.attr("viewBox", `0 0 ${width} ${height}`).selectAll("*").remove();

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(scene1Data, (row) => row.delay_minutes)])
    .nice()
    .range([0, innerWidth]);

  const y = d3
    .scaleBand()
    .domain(scene1Data.map((row) => row.cause_key))
    .range([0, innerHeight])
    .padding(0.34);

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  root
    .append("g")
    .attr("class", "axis")
    .call(
      d3
        .axisTop(x)
        .ticks(mobile ? 3 : 5)
        .tickSize(-innerHeight)
        .tickFormat((value) => (value === 0 ? "0" : `${value / 1_000_000}M`)),
    );

  const groups = root
    .selectAll(".bar-group")
    .data(scene1Data, (row) => row.cause_key)
    .join("g")
    .attr("class", "bar-group")
    .attr("transform", (row) => `translate(0,${y(row.cause_key)})`);

  groups
    .append("text")
    .attr("class", "cause-label")
    .attr("x", -12)
    .attr("y", y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .text((row) => causeById.get(row.cause_key).label);

  groups
    .append("rect")
    .attr("height", y.bandwidth())
    .attr("width", (row) => x(row.delay_minutes))
    .attr("fill", (row) => causeById.get(row.cause_key).color);

  const labels = groups
    .append("text")
    .attr("class", "value-label")
    .attr("y", y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .text(
      (row) =>
        `${formatPercent(row.share)} · ${(row.delay_minutes / 1_000_000).toFixed(1)}M min`,
    );

  positionScene1Labels(labels, x, innerWidth);

  groups
    .append("rect")
    .attr("class", "bar-hit-area")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("x", -margin.left + 2)
    .attr("width", width - 4)
    .attr("height", y.bandwidth())
    .attr(
      "aria-label",
      (row) =>
        `${row.cause}: ${formatPercent(row.share)}, ${formatMinutes(
          row.delay_minutes,
        )} minutes`,
    )
    .on("mouseenter focus", function (event, row) {
      state.highlightedCause = row.cause_key;
      groups.classed("is-muted", (item) => item.cause_key !== row.cause_key);
      showTooltip(
        tooltip,
        frame,
        event,
        `<strong>${row.cause}</strong><span>${formatMinutes(
          row.delay_minutes,
        )} minutes · ${formatPercent(row.share)}</span>`,
      );
    })
    .on("mousemove", (event) => moveTooltip(tooltip, frame, event))
    .on("mouseleave blur", () => {
      state.highlightedCause = null;
      groups.classed("is-muted", false);
      hideTooltip(tooltip);
    });

  addScene1Annotation(root, x, y, innerWidth, mobile);
}

function positionScene1Labels(selection, x, innerWidth) {
  selection
    .attr("x", (row) => {
      const end = x(row.delay_minutes);
      return end > innerWidth - 112 ? end - 9 : end + 9;
    })
    .attr("text-anchor", (row) =>
      x(row.delay_minutes) > innerWidth - 112 ? "end" : "start",
    )
    .attr("fill", (row) =>
      x(row.delay_minutes) > innerWidth - 112 ? "#fff" : "#111",
    );
}

function addScene1Annotation(root, x, y, innerWidth, mobile) {
  const weather = scene1Data.find((row) => row.cause_key === "weather");
  const weatherX = x(weather.delay_minutes);
  const availableRight = innerWidth - weatherX;

  addD3Annotation(
    root,
    {
      note: {
        title: "Weather: 6.5%",
        label: "Late aircraft caused 6.2× as many delay minutes.",
        wrap: mobile ? 125 : 170,
      },
      x: weatherX,
      y: y(weather.cause_key) + y.bandwidth() / 2,
      dx: Math.min(mobile ? 40 : 90, Math.max(28, availableRight - 90)),
      dy: 55,
      color: causeById.get("weather").color,
    },
    d3.annotationCallout,
  );
}



function renderScene2() {
  const { frame, width, height, mobile } = chartSize(
    "#scene-2-chart-frame",
    570,
    620,
  );
  const margin = {
    top: 72,
    right: mobile ? 15 : 30,
    bottom: 45,
    left: mobile ? 70 : 110,
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const svg = d3.select("#scene-2-chart");
  const tooltip = document.querySelector("#scene-2-tooltip");

  svg.attr("viewBox", `0 0 ${width} ${height}`).selectAll("*").remove();

  const x = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);
  const y = d3
    .scaleBand()
    .domain(scene2Data.map((row) => row.carrier))
    .range([0, innerHeight])
    .padding(0.28);

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  root
    .append("g")
    .attr("class", "axis")
    .call(
      d3
        .axisTop(x)
        .ticks(5)
        .tickSize(-innerHeight)
        .tickFormat(d3.format(".0%")),
    );

  root
    .append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0));

  const stack = d3.stack().keys(causeKeys).offset(d3.stackOffsetExpand);
  const series = stack(scene2Data);

  const layers = root
    .selectAll(".stack-layer")
    .data(series)
    .join("g")
    .attr("class", "stack-layer")
    .attr("fill", (layer) => causeByKey.get(layer.key).color);

  layers
    .selectAll("rect")
    .data((layer) =>
      layer.map((segment) => ({
        segment,
        causeKey: layer.key,
      })),
    )
    .join("rect")
    .attr("class", "stack-segment")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("x", (datum) => x(datum.segment[0]))
    .attr("y", (datum) => y(datum.segment.data.carrier))
    .attr("width", (datum) => Math.max(0, x(datum.segment[1]) - x(datum.segment[0])))
    .attr("height", y.bandwidth())
    .attr(
      "aria-label",
      (datum) =>
        `${datum.segment.data.carrier_name}, ${causeByKey.get(datum.causeKey).fullLabel}: ${formatPercent(
          datum.segment[1] - datum.segment[0],
        )}`,
    )
    .on("mouseenter focus", function (event, datum) {
      highlightStackCause(2, datum.causeKey);
      const row = datum.segment.data;
      const share = datum.segment[1] - datum.segment[0];
      showTooltip(
        tooltip,
        frame,
        event,
        `<strong>${row.carrier} · ${row.carrier_name}</strong><span>${
          causeByKey.get(datum.causeKey).fullLabel
        }: ${formatPercent(share)} · ${formatMinutes(row[datum.causeKey])} minutes</span>`,
      );
    })
    .on("mousemove", (event) => moveTooltip(tooltip, frame, event))
    .on("mouseleave blur", () => {
      highlightStackCause(2, null);
      hideTooltip(tooltip);
    });

  addScene2Annotation(root, x, y, series, mobile);
}

function addScene2Annotation(root, x, y, series, mobile) {
  const lateSeries = series.find((layer) => layer.key === "late_aircraft_delay");
  const southwest = lateSeries.find((segment) => segment.data.carrier === "WN");

  const share = southwest[1] - southwest[0];

  addD3Annotation(root, {
    note: {
      title: `Southwest: ${formatPercent(share)}`,
      label: "More than half is late-aircraft delay.",
      wrap: mobile ? 125 : 165,
    },
    x: x((southwest[0] + southwest[1]) / 2),
    y: y("WN") + y.bandwidth() / 2,
    dx: mobile ? -65 : -105,
    dy: -48,
    color: causeByKey.get("late_aircraft_delay").color,
  });
}



function populateScene3Controls() {
  const carrierSelect = d3.select("#carrier-select");
  const yearSelect = d3.select("#year-select");

  carrierSelect
    .selectAll("option")
    .data(scene2Data)
    .join("option")
    .attr("value", (row) => row.carrier)
    .text((row) => `${row.carrier} — ${row.carrier_name}`);

  yearSelect
    .selectAll("option")
    .data(d3.range(2025, 2018, -1))
    .join("option")
    .attr("value", (year) => year)
    .text((year) => year);

  carrierSelect.property("value", state.selectedCarrier);
  yearSelect.property("value", state.selectedYear);
}

function renderScene3() {
  const selectedRows = scene3Data
    .filter(
      (row) =>
        row.carrier === state.selectedCarrier && row.year === state.selectedYear,
    )
    .sort((a, b) => d3.ascending(a.month, b.month));

  const { frame, width, height, mobile } = chartSize(
    "#scene-3-chart-frame",
    540,
    560,
  );
  const margin = {
    top: 68,
    right: 20,
    bottom: 48,
    left: mobile ? 42 : 58,
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const svg = d3.select("#scene-3-chart");
  const tooltip = document.querySelector("#scene-3-tooltip");

  svg.attr("viewBox", `0 0 ${width} ${height}`).selectAll("*").remove();

  const x = d3
    .scaleBand()
    .domain(d3.range(1, 13))
    .range([0, innerWidth])
    .padding(0.16);

  const y = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);

  const root = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  root
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickFormat((month) => monthNames[month - 1]).tickSize(0));

  root
    .append("g")
    .attr("class", "axis")
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickSize(-innerWidth)
        .tickFormat(d3.format(".0%")),
    );

  const stack = d3.stack().keys(causeKeys).offset(d3.stackOffsetExpand);
  const series = stack(selectedRows);

  const layers = root
    .selectAll(".stack-layer")
    .data(series)
    .join("g")
    .attr("class", "stack-layer")
    .attr("fill", (layer) => causeByKey.get(layer.key).color);

  layers
    .selectAll("rect")
    .data((layer) =>
      layer.map((segment) => ({
        segment,
        causeKey: layer.key,
      })),
    )
    .join("rect")
    .attr("class", "stack-segment")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("x", (datum) => x(datum.segment.data.month))
    .attr("y", (datum) => y(datum.segment[1]))
    .attr("width", x.bandwidth())
    .attr("height", (datum) => Math.max(0, y(datum.segment[0]) - y(datum.segment[1])))
    .attr(
      "aria-label",
      (datum) =>
        `${monthNames[datum.segment.data.month - 1]} ${state.selectedYear}, ${
          causeByKey.get(datum.causeKey).fullLabel
        }: ${formatPercent(datum.segment[1] - datum.segment[0])}`,
    )
    .on("mouseenter focus", function (event, datum) {
      highlightStackCause(3, datum.causeKey);
      const row = datum.segment.data;
      const share = datum.segment[1] - datum.segment[0];
      showTooltip(
        tooltip,
        frame,
        event,
        `<strong>${monthNames[row.month - 1]} ${row.year}</strong><span>${
          causeByKey.get(datum.causeKey).fullLabel
        }: ${formatPercent(share)} · ${formatMinutes(row[datum.causeKey])} minutes</span>`,
      );
    })
    .on("mousemove", (event) => moveTooltip(tooltip, frame, event))
    .on("mouseleave blur", () => {
      highlightStackCause(3, null);
      hideTooltip(tooltip);
    });

  updateScene3Text(selectedRows);
  addScene3Annotation(root, x, y, series, mobile);
}

function updateScene3Text(rows) {
  const carrierName = rows[0].carrier_name;
  document.querySelector("#scene-3-subtitle").textContent =
    `${carrierName} · ${state.selectedYear}`;

  const totals = causes.map((cause) => ({
    cause,
    minutes: d3.sum(rows, (row) => row[cause.key]),
  }));
  const totalMinutes = d3.sum(totals, (item) => item.minutes);
  const largest = d3.greatest(totals, (item) => item.minutes);

  document.querySelector("#scene-3-summary").innerHTML =
    `<strong>Selected view:</strong> ${largest.cause.fullLabel} is the largest ` +
    `annual category at ${formatPercent(largest.minutes / totalMinutes)}.`;

  const periodNote = document.querySelector("#period-note");
  const disruptedPeriod = state.selectedYear === 2020 || state.selectedYear === 2021;
  periodNote.hidden = !disruptedPeriod;
  periodNote.textContent = disruptedPeriod
    ? "Caution: flight schedules and traffic volumes were unusually disrupted during the COVID-19 pandemic."
    : "";
}

function addScene3Annotation(root, x, y, series, mobile) {
  const weatherSeries = series.find((layer) => layer.key === "weather_delay");
  const peak = d3.greatest(weatherSeries, (segment) => segment[1] - segment[0]);
  const share = peak[1] - peak[0];
  const month = peak.data.month;

  addD3Annotation(root, {
    note: {
      title: `Weather peak: ${formatPercent(share)}`,
      label: `${monthNames[month - 1]} ${state.selectedYear}`,
      wrap: mobile ? 110 : 140,
    },
    x: x(month) + x.bandwidth() / 2,
    y: y((peak[0] + peak[1]) / 2),
    dx: month > 7 ? -70 : 70,
    dy: -52,
    color: causeByKey.get("weather_delay").color,
  });
}

initialize();
