// ── Constants ────────────────────────────────────────────────────────────────

const MAP_CENTER = [35.98, -78.9]; // Durham, NC
const MAP_ZOOM = 11;

const REGION_COLORS = {
  'Central': '#e6b422',
  'East': '#4ecdc4',
  'North': '#ff6b6b',
  'Southeast': '#a78bfa',
  'Southwest': '#f97316'
};

const SCHOOL_COLORS = {
  es: '#5a9a58',
  ms: '#4a90d9',
  hs: '#d95a5a'
};

const PROGRAM_COLORS = {
  'Neighborhood': '#6b7280',
  'Dual Language Instruction': '#4ecdc4',
  'Dual Language Immersion (DLI)': '#4ecdc4',
  'Montessori': '#a78bfa',
  'International Baccalaureate (IB)': '#f97316',
  'Year-Round': '#e6b422',
  'Arts': '#ec4899',
  'Early College': '#06b6d4',
  'STEM': '#10b981',
};

const SCHOOL_RADIUS = { es: 7, ms: 8, hs: 9 };

const BASEMAPS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd'
  },
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd'
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics',
    subdomains: null
  }
};

// ── State ────────────────────────────────────────────────────────────────────

const state = {
  viewMode: 'default',
  regionOpacity: 0.3,
  data: {},
  regionLayer: null,
  boundaryLayers: { es: null, ms: null, hs: null },
  esMarkers: [],
  msMarkers: [],
  hsMarkers: [],
  allMarkers: {},
  pins: [],
  map: null,
  tileLayer: null
};

// ── Color helpers ────────────────────────────────────────────────────────────

function ispColor(ispStr) {
  if (!ispStr) return '#6b7280';
  const val = parseInt(ispStr);
  if (isNaN(val)) return '#6b7280';
  const t = Math.min(val / 55, 1);
  if (t < 0.5) {
    const r = Math.round(90 + (230 - 90) * (t * 2));
    const g = Math.round(154 + (180 - 154) * (t * 2));
    const b = Math.round(88 + (34 - 88) * (t * 2));
    return `rgb(${r},${g},${b})`;
  } else {
    const t2 = (t - 0.5) * 2;
    const r = Math.round(230 + (255 - 230) * t2);
    const g = Math.round(180 - 180 * t2);
    const b = Math.round(34 - 34 * t2);
    return `rgb(${r},${g},${b})`;
  }
}

function capacityColor(utilization) {
  if (utilization > 1.0) return '#ff6b6b';
  if (utilization > 0.8) return '#e6b422';
  return '#5a9a58';
}

function programColor(program) {
  if (!program) return '#6b7280';
  for (const [key, color] of Object.entries(PROGRAM_COLORS)) {
    if (program.includes(key) || key.includes(program)) return color;
  }
  return '#6b7280';
}

// ── Popup builder ────────────────────────────────────────────────────────────

function buildPopup(school, type) {
  const p = school.properties;
  let html = `<div class="popup-title">${p.name}</div>`;
  html += `<div class="popup-row"><span class="popup-label">Address</span></div>`;
  html += `<div style="margin-bottom:6px;font-size:0.75rem">${p.address}</div>`;

  if (p.region) html += `<div class="popup-row"><span class="popup-label">Region</span><span class="popup-value">${p.region}</span></div>`;
  if (p.program) html += `<div class="popup-row"><span class="popup-label">Program</span><span class="popup-badge">${p.program}</span></div>`;
  if (p.calendar) html += `<div class="popup-row"><span class="popup-label">Calendar</span><span class="popup-value">${p.calendar}</span></div>`;

  if (type === 'es') {
    html += '<div class="popup-section">';
    if (p.isp) html += `<div class="popup-row"><span class="popup-label">ISP</span><span class="popup-highlight">${p.isp}%</span></div>`;
    if (p.capacity) html += `<div class="popup-row"><span class="popup-label">Capacity</span><span class="popup-value">${p.capacity}</span></div>`;
    if (p.enrollment) html += `<div class="popup-row"><span class="popup-label">Enrollment</span><span class="popup-value">${p.enrollment}</span></div>`;
    if (p.capacity && p.enrollment) {
      const pct = Math.round((p.enrollment / p.capacity) * 100);
      const color = pct > 100 ? '#ff6b6b' : pct > 90 ? '#e6b422' : '#5a9a58';
      html += `<div class="popup-row"><span class="popup-label">Utilization</span><span style="color:${color};font-weight:600">${pct}%</span></div>`;
    }
    html += '</div>';
  }

  if (type === 'hs') {
    if (p.cte) html += `<div class="popup-row"><span class="popup-label">CTE</span><span class="popup-value">${p.cte}</span></div>`;
  }

  if (p.grades) html += `<div class="popup-row"><span class="popup-label">Grades</span><span class="popup-value">${p.grades}</span></div>`;

  return html;
}

// ── Layer creation ───────────────────────────────────────────────────────────

function createRegionLayer(data) {
  const layer = L.geoJSON(data, {
    style: function (feature) {
      const color = REGION_COLORS[feature.properties.Region] || '#888';
      return {
        fillColor: color,
        fillOpacity: state.regionOpacity,
        weight: 2,
        color: color,
        opacity: 0.7
      };
    },
    onEachFeature: function (feature, layer) {
      const center = layer.getBounds().getCenter();
      const name = feature.properties.Region || '';
      L.tooltip({
        permanent: true,
        direction: 'center',
        className: 'region-label'
      })
        .setContent(name)
        .setLatLng(center)
        .addTo(state.map);
    }
  });
  return layer;
}

function createSchoolMarkers(data, type) {
  const markers = [];
  const color = SCHOOL_COLORS[type];
  const radius = SCHOOL_RADIUS[type];

  L.geoJSON(data, {
    pointToLayer: function (feature, latlng) {
      const marker = L.circleMarker(latlng, {
        radius: radius,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.85
      });
      marker.schoolType = type;
      marker.schoolProps = feature.properties;
      marker.defaultRadius = radius;
      marker.bindPopup(buildPopup(feature, type), { maxWidth: 280 });
      markers.push(marker);
      state.allMarkers[feature.properties.name] = marker;
      marker.addTo(state.map);
      return marker;
    }
  });

  return markers;
}

function createBoundaryLayer(data, color) {
  return L.geoJSON(data, {
    style: function () {
      return {
        fillOpacity: 0.08,
        fillColor: color,
        weight: 1.5,
        color: color,
        dashArray: '5,5'
      };
    },
    onEachFeature: function (feature, layer) {
      const name = feature.properties.school_nam || feature.properties.sch_name || feature.properties.name || '';
      if (name) {
        layer.bindTooltip(name, { sticky: true });
      }
    }
  });
}

// ── View mode logic ──────────────────────────────────────────────────────────

function applyViewMode() {
  const mode = state.viewMode;

  // Remove feeder click handlers from previous mode
  const all = [...state.esMarkers, ...state.msMarkers, ...state.hsMarkers];
  all.forEach(m => {
    if (m._feederHandler) {
      m.off('click', m._feederHandler);
      m._feederHandler = null;
    }
  });

  switch (mode) {
    case 'default':
      applyDefaultMode();
      break;
    case 'isp':
      applyIspMode();
      break;
    case 'capacity':
      applyCapacityMode();
      break;
    case 'programs':
      applyProgramsMode();
      break;
    case 'feeder':
      applyFeederMode();
      break;
    default:
      applyDefaultMode();
  }

  updateLegend(mode);
}

function applyDefaultMode() {
  state.esMarkers.forEach(m => {
    m.setStyle({ fillColor: SCHOOL_COLORS.es, fillOpacity: 0.85, color: '#fff', weight: 2 });
    m.setRadius(SCHOOL_RADIUS.es);
  });
  state.msMarkers.forEach(m => {
    m.setStyle({ fillColor: SCHOOL_COLORS.ms, fillOpacity: 0.85, color: '#fff', weight: 2 });
    m.setRadius(SCHOOL_RADIUS.ms);
  });
  state.hsMarkers.forEach(m => {
    m.setStyle({ fillColor: SCHOOL_COLORS.hs, fillOpacity: 0.85, color: '#fff', weight: 2 });
    m.setRadius(SCHOOL_RADIUS.hs);
  });
}

function applyIspMode() {
  state.esMarkers.forEach(m => {
    const color = ispColor(m.schoolProps.isp);
    m.setStyle({ fillColor: color, fillOpacity: 0.9, color: '#fff', weight: 2 });
    m.setRadius(SCHOOL_RADIUS.es);
  });
  // Dim MS and HS
  state.msMarkers.forEach(m => {
    m.setStyle({ fillColor: '#444', fillOpacity: 0.2, color: '#333', weight: 1 });
    m.setRadius(SCHOOL_RADIUS.ms);
  });
  state.hsMarkers.forEach(m => {
    m.setStyle({ fillColor: '#444', fillOpacity: 0.2, color: '#333', weight: 1 });
    m.setRadius(SCHOOL_RADIUS.hs);
  });
}

function applyCapacityMode() {
  state.esMarkers.forEach(m => {
    const p = m.schoolProps;
    if (p.capacity && p.enrollment) {
      const util = p.enrollment / p.capacity;
      const color = capacityColor(util);
      const radius = Math.min(5 + (p.enrollment / 100), 14);
      m.setStyle({ fillColor: color, fillOpacity: 0.9, color: '#fff', weight: 2 });
      m.setRadius(radius);
    } else {
      m.setStyle({ fillColor: '#6b7280', fillOpacity: 0.4, color: '#555', weight: 1 });
      m.setRadius(SCHOOL_RADIUS.es);
    }
  });
  // Dim MS and HS
  state.msMarkers.forEach(m => {
    m.setStyle({ fillColor: '#444', fillOpacity: 0.2, color: '#333', weight: 1 });
    m.setRadius(SCHOOL_RADIUS.ms);
  });
  state.hsMarkers.forEach(m => {
    m.setStyle({ fillColor: '#444', fillOpacity: 0.2, color: '#333', weight: 1 });
    m.setRadius(SCHOOL_RADIUS.hs);
  });
}

function applyProgramsMode() {
  const allMarkers = [...state.esMarkers, ...state.msMarkers, ...state.hsMarkers];
  allMarkers.forEach(m => {
    const color = programColor(m.schoolProps.program);
    m.setStyle({ fillColor: color, fillOpacity: 0.85, color: '#fff', weight: 2 });
    m.setRadius(m.defaultRadius);
  });
}

function applyFeederMode() {
  const allMarkers = [...state.esMarkers, ...state.msMarkers, ...state.hsMarkers];

  // Dim everything initially
  allMarkers.forEach(m => {
    m.setStyle({ fillColor: '#555', fillOpacity: 0.15, color: '#333', weight: 1 });
    m.setRadius(m.defaultRadius);
  });

  // Attach click handlers for feeder highlighting
  allMarkers.forEach(m => {
    m._feederHandler = function () {
      const region = m.schoolProps.region;
      if (!region || region === 'District-wide') return;

      allMarkers.forEach(other => {
        const otherRegion = other.schoolProps.region;
        if (otherRegion === region && otherRegion !== 'District-wide') {
          const color = REGION_COLORS[region] || '#fff';
          other.setStyle({ fillColor: color, fillOpacity: 0.9, color: '#fff', weight: 2 });
          other.setRadius(other.defaultRadius + 3);
        } else {
          other.setStyle({ fillColor: '#555', fillOpacity: 0.15, color: '#333', weight: 1 });
          other.setRadius(other.defaultRadius);
        }
      });

      updateLegend('feeder', region);
    };
    m.on('click', m._feederHandler);
  });
}

// ── Legend ────────────────────────────────────────────────────────────────────

function updateLegend(mode, extra) {
  const legend = document.getElementById('legend');
  if (!legend) return;

  let html = '';

  switch (mode) {
    case 'default':
      html = legendItem(SCHOOL_COLORS.es, 'Elementary') +
        legendItem(SCHOOL_COLORS.ms, 'Middle') +
        legendItem(SCHOOL_COLORS.hs, 'High');
      break;

    case 'isp':
      html = '<div class="legend-title">ISP (Free/Reduced Lunch Proxy)</div>';
      html += `<div style="height:14px;border-radius:3px;background:linear-gradient(to right, #5a9a58, #e6b422, #ff6b6b);margin-bottom:6px"></div>`;
      html += '<div style="display:flex;justify-content:space-between;font-size:0.65rem;color:#aaa"><span>Low</span><span>High</span></div>';
      html += '<div style="margin-top:6px;font-size:0.65rem;color:#666">Elementary schools only</div>';
      break;

    case 'capacity':
      html = '<div class="legend-title">Utilization</div>';
      html += legendItem('#5a9a58', 'Under 80%');
      html += legendItem('#e6b422', '80–100%');
      html += legendItem('#ff6b6b', 'Over 100%');
      html += '<div style="margin-top:6px;font-size:0.65rem;color:#666">Elementary schools only. Marker size = enrollment.</div>';
      break;

    case 'programs': {
      html = '<div class="legend-title">Programs</div>';
      const seen = new Set();
      for (const [name, color] of Object.entries(PROGRAM_COLORS)) {
        // Deduplicate DLI variants
        const label = name.includes('Dual Language Immersion') ? null : name;
        if (!label) continue;
        if (seen.has(color + label)) continue;
        seen.add(color + label);
        html += legendItem(color, label);
      }
      break;
    }

    case 'feeder':
      if (extra) {
        const color = REGION_COLORS[extra] || '#fff';
        html = `<div class="legend-title" style="color:${color}">Showing ${extra} region schools</div>`;
        html += '<div style="font-size:0.65rem;color:#888;margin-top:4px">Click another school to change region</div>';
      } else {
        html = '<div class="legend-title">Feeder Regions</div>';
        html += '<div style="font-size:0.7rem;color:#aaa;margin-bottom:4px">Click any school to highlight its region</div>';
        for (const [name, color] of Object.entries(REGION_COLORS)) {
          html += legendItem(color, name);
        }
      }
      break;
  }

  legend.innerHTML = html;
}

function legendItem(color, label) {
  return `<div class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${label}</div>`;
}

// ── Geocoding ────────────────────────────────────────────────────────────────

async function geocodeAddress(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'us',
    viewbox: '-79.1,35.85,-78.7,36.15',
    bounded: '0'
  });
  const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'SchoolPantryNetwork/1.0 (schoolpantry.network)' }
  });
  if (!resp.ok) return null;
  const results = await resp.json();
  if (!results.length) return null;
  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
    display: results[0].display_name
  };
}

// ── Pins ─────────────────────────────────────────────────────────────────────

function buildPinPopup(pin) {
  const div = document.createElement('div');

  const addr = document.createElement('div');
  addr.className = 'pin-popup-address';
  addr.textContent = pin.address;
  div.appendChild(addr);

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'pin-popup-label-input';
  labelInput.placeholder = 'Add a label…';
  labelInput.value = pin.label || '';
  labelInput.addEventListener('input', function () {
    pin.label = this.value;
  });
  div.appendChild(labelInput);

  const remove = document.createElement('button');
  remove.className = 'pin-popup-remove';
  remove.textContent = 'Remove pin';
  remove.addEventListener('click', function () {
    removePin(pin);
  });
  div.appendChild(remove);

  return div;
}

function addPin(latlng, address) {
  const pin = {
    marker: null,
    label: '',
    latlng: latlng,
    address: address
  };

  pin.marker = L.marker(latlng).addTo(state.map);
  pin.marker.bindPopup(buildPinPopup(pin), { maxWidth: 280 });
  pin.marker.openPopup();

  state.pins.push(pin);
  updatePinsUI();
}

function removePin(pin) {
  state.map.removeLayer(pin.marker);
  state.pins = state.pins.filter(p => p !== pin);
  updatePinsUI();
}

function clearAllPins() {
  state.pins.forEach(p => state.map.removeLayer(p.marker));
  state.pins = [];
  updatePinsUI();
}

function updatePinsUI() {
  const section = document.getElementById('pins-section');
  const countEl = document.getElementById('pin-count');
  if (!section) return;

  if (state.pins.length === 0) {
    section.hidden = true;
  } else {
    section.hidden = false;
    if (countEl) countEl.textContent = `(${state.pins.length})`;
  }
}

// ── Search ───────────────────────────────────────────────────────────────────

function setupSearch() {
  const input = document.getElementById('school-search');
  const resultsEl = document.getElementById('search-results');
  if (!input || !resultsEl) return;

  let activeIdx = -1;
  let items = []; // { type: 'school'|'address', name, marker?, query? }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showResults(schoolHits, query) {
    items = schoolHits.map(h => ({ type: 'school', name: h.name, marker: h.marker }));

    // Append address geocode option if query is 3+ chars
    if (query.length >= 3) {
      items.push({ type: 'address', name: query });
    }

    activeIdx = -1;
    if (!items.length) {
      resultsEl.hidden = true;
      return;
    }

    resultsEl.innerHTML = items.map((item, i) => {
      if (item.type === 'school') {
        const typeLabel = item.marker.schoolType === 'es' ? 'ES' :
          item.marker.schoolType === 'ms' ? 'MS' : 'HS';
        return `<div class="search-result-item" data-index="${i}">${item.name}<span class="search-result-type">${typeLabel}</span></div>`;
      } else {
        return `<div class="search-result-item search-address-item" data-index="${i}">Search address: ${item.name}</div>`;
      }
    }).join('');
    resultsEl.hidden = false;
  }

  function clearSearch() {
    input.value = '';
    resultsEl.hidden = true;
    items = [];
    activeIdx = -1;
  }

  async function selectResult(idx) {
    if (idx < 0 || idx >= items.length) return;
    const item = items[idx];
    const zoomToggle = document.getElementById('toggle-zoom-search');
    const shouldZoom = zoomToggle ? zoomToggle.checked : true;

    if (item.type === 'school') {
      const latlng = item.marker.getLatLng();
      if (shouldZoom) {
        if (prefersReducedMotion) {
          state.map.setView(latlng, 15);
        } else {
          state.map.flyTo(latlng, 15);
        }
      }
      item.marker.openPopup();
      clearSearch();
      input.blur();
    } else {
      // Address geocode
      const query = item.name;
      clearSearch();
      input.blur();

      const result = await geocodeAddress(query);
      if (!result) {
        input.value = query;
        input.placeholder = 'Address not found — try again';
        setTimeout(() => { input.placeholder = 'Search schools or address…'; }, 2000);
        return;
      }

      const latlng = L.latLng(result.lat, result.lng);
      // Use shorter address: first two parts of display_name
      const shortAddr = result.display.split(',').slice(0, 2).join(',').trim();
      addPin(latlng, shortAddr);

      if (shouldZoom) {
        if (prefersReducedMotion) {
          state.map.setView(latlng, 16);
        } else {
          state.map.flyTo(latlng, 16);
        }
      }
    }
  }

  input.addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    if (q.length < 2) {
      resultsEl.hidden = true;
      return;
    }
    const hits = [];
    for (const [name, marker] of Object.entries(state.allMarkers)) {
      if (name.toLowerCase().includes(q)) {
        hits.push({ name, marker });
      }
    }
    hits.sort((a, b) => a.name.localeCompare(b.name));
    showResults(hits.slice(0, 10), q);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      clearSearch();
      input.blur();
      return;
    }
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0) {
        selectResult(activeIdx);
      } else if (items.length === 1) {
        selectResult(0);
      }
      return;
    }

    resultsEl.querySelectorAll('.search-result-item').forEach((el, i) => {
      el.classList.toggle('active', i === activeIdx);
    });
  });

  resultsEl.addEventListener('click', function (e) {
    const item = e.target.closest('.search-result-item');
    if (!item) return;
    selectResult(parseInt(item.dataset.index));
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-wrap')) {
      resultsEl.hidden = true;
    }
  });

  // Clear all pins button
  const clearBtn = document.getElementById('clear-pins');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllPins);
  }
}

// ── Theme switcher ──────────────────────────────────────────────────────────

function setupThemeSwitcher() {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      const theme = this.dataset.theme;
      const basemap = BASEMAPS[theme];
      if (!basemap) return;

      state.map.removeLayer(state.tileLayer);
      state.tileLayer = L.tileLayer(basemap.url, {
        attribution: basemap.attribution,
        subdomains: basemap.subdomains || '',
        maxZoom: 19
      }).addTo(state.map);

      // Keep tile layer behind everything else
      state.tileLayer.bringToBack();
    });
  });
}

// ── Event listeners ──────────────────────────────────────────────────────────

function setupEventListeners() {
  // View mode buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      state.viewMode = this.dataset.mode;
      applyViewMode();
    });
  });

  // Region opacity slider
  const slider = document.getElementById('region-opacity');
  if (slider) {
    slider.addEventListener('input', function () {
      state.regionOpacity = this.value / 100;
      if (state.regionLayer) {
        state.regionLayer.setStyle({ fillOpacity: state.regionOpacity });
      }
      const display = document.getElementById('opacity-value');
      if (display) display.textContent = this.value + '%';
    });
  }

  // Boundary toggles
  const toggles = { es: '#toggle-es', ms: '#toggle-ms', hs: '#toggle-hs' };
  for (const [type, selector] of Object.entries(toggles)) {
    const el = document.querySelector(selector);
    if (!el) continue;
    el.addEventListener('change', function () {
      const layer = state.boundaryLayers[type];
      if (!layer) return;
      if (this.checked) {
        layer.addTo(state.map);
      } else {
        state.map.removeLayer(layer);
      }
    });
  }
}

// ── Data loading ─────────────────────────────────────────────────────────────

async function loadData() {
  const files = {
    regions: 'data/regions.geojson',
    schoolsEs: 'data/schools-es.geojson',
    schoolsMs: 'data/schools-ms.geojson',
    schoolsHs: 'data/schools-hs.geojson',
    boundariesEs: 'data/boundaries-es.geojson',
    boundariesMs: 'data/boundaries-ms.geojson',
    boundariesHs: 'data/boundaries-hs.geojson'
  };

  const entries = Object.entries(files);
  const results = await Promise.all(
    entries.map(([key, url]) =>
      fetch(url).then(r => {
        if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`);
        return r.json();
      }).then(data => [key, data])
    )
  );

  for (const [key, data] of results) {
    state.data[key] = data;
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  // Create map
  state.map = L.map('map', {
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    zoomControl: true
  });

  const dark = BASEMAPS.dark;
  state.tileLayer = L.tileLayer(dark.url, {
    attribution: dark.attribution,
    subdomains: dark.subdomains || '',
    maxZoom: 19
  }).addTo(state.map);

  // Load all data
  await loadData();

  // Create region layer and add to map
  state.regionLayer = createRegionLayer(state.data.regions);
  state.regionLayer.addTo(state.map);

  // Create boundary layers (not added to map yet)
  state.boundaryLayers.es = createBoundaryLayer(state.data.boundariesEs, SCHOOL_COLORS.es);
  state.boundaryLayers.ms = createBoundaryLayer(state.data.boundariesMs, SCHOOL_COLORS.ms);
  state.boundaryLayers.hs = createBoundaryLayer(state.data.boundariesHs, SCHOOL_COLORS.hs);

  // Create school markers (added to map inside the function)
  state.esMarkers = createSchoolMarkers(state.data.schoolsEs, 'es');
  state.msMarkers = createSchoolMarkers(state.data.schoolsMs, 'ms');
  state.hsMarkers = createSchoolMarkers(state.data.schoolsHs, 'hs');

  // Set up controls
  setupEventListeners();
  setupSearch();
  setupThemeSwitcher();

  // Ctrl+double-click to drop a pin
  state.map.on('dblclick', function (e) {
    if (!e.originalEvent.ctrlKey && !e.originalEvent.metaKey) return;
    e.originalEvent.preventDefault();
    addPin(e.latlng, `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
  });

  // Apply default view
  applyViewMode();
}

init();
