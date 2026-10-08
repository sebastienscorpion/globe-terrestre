// Étoiles (CSS : rotation + scintillement)
const sky = document.getElementById('sky');
for (let i = 0; i < 700; i++) {
  const s = document.createElement('div'), z = Math.random() * 2 + .6;
  s.className = 'star';
  s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;width:${z}px;height:${z}px;` +
    `--o:${.4+Math.random()*.6};--d:${2+Math.random()*5}s;animation-delay:-${Math.random()*6}s;` +
    (Math.random() < .12 ? 'background:#cfe0ff;box-shadow:0 0 6px #9bbcff;' : '');
  sky.appendChild(s);
}

const countries = window.countryBoundaries;
if (!Array.isArray(countries)) throw new Error('Les frontières des pays sont introuvables.');
const countryTooltip = document.getElementById('country-tooltip');
const countryFlag = document.getElementById('country-flag');
const countryFlagFallback = document.getElementById('country-flag-fallback');
const countryName = document.getElementById('country-name');
const zoomLevel = document.getElementById('zoom-level');
let pointerPosition = null;
let zoom = 1;
let displayedCountry = null;
const minZoom = 0.7, maxZoom = 3;

function setZoom(value) {
  zoom = Math.max(minZoom, Math.min(maxZoom, value));
  zoomLevel.textContent = `${Math.round(zoom * 100)} %`;
}

document.querySelectorAll('[data-zoom]').forEach(button => {
  button.addEventListener('click', () => {
    const action = button.dataset.zoom;
    setZoom(action === 'reset' ? 1 : zoom + (action === 'in' ? 0.25 : -0.25));
  });
});

document.getElementById('globe').addEventListener('wheel', event => {
  event.preventDefault();
  setZoom(zoom + (event.deltaY < 0 ? 0.12 : -0.12));
}, { passive: false });

function flagEmoji(code) {
  if (!code || code.length !== 2) return '🌐';
  return Array.from(code.toUpperCase(), letter =>
    String.fromCodePoint(127397 + letter.charCodeAt(0))
  ).join('');
}

function pointInRing(longitude, latitude, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > latitude) !== (yj > latitude) &&
        longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isInCountry(longitude, latitude, country) {
  const polygons = country.type === 'Polygon' ? [country.coordinates] : country.coordinates;
  return polygons.some(rings =>
    pointInRing(longitude, latitude, rings[0]) &&
    !rings.slice(1).some(hole => pointInRing(longitude, latitude, hole))
  );
}

function showCountryAt(longitude, latitude, clientX, clientY) {
  longitude = ((longitude + 180) % 360 + 360) % 360 - 180;
  const country = countries.find(item => isInCountry(longitude, latitude, item));
  if (!country) {
    countryTooltip.hidden = true;
    displayedCountry = null;
    return;
  }

  if (displayedCountry !== country.name) {
    countryName.textContent = country.name;
    countryFlagFallback.textContent = flagEmoji(country.flag);
    countryFlagFallback.hidden = false;
    countryFlag.hidden = true;
    if (country.flag) {
      countryFlag.onload = () => {
        countryFlag.hidden = false;
        countryFlagFallback.hidden = true;
      };
      countryFlag.onerror = () => {
        countryFlag.hidden = true;
        countryFlagFallback.hidden = false;
      };
      countryFlag.src = `https://flagcdn.com/w640/${country.flag.toLowerCase()}.png`;
    }
    displayedCountry = country.name;
  }
  countryTooltip.hidden = false;
  const left = Math.min(clientX + 16, innerWidth - countryTooltip.offsetWidth - 12);
  const top = Math.max(12, Math.min(clientY - countryTooltip.offsetHeight - 12,
    innerHeight - countryTooltip.offsetHeight - 12));
  countryTooltip.style.left = `${Math.max(12, left)}px`;
  countryTooltip.style.top = `${top}px`;
}

function hideCountry() {
  pointerPosition = null;
  countryTooltip.hidden = true;
}

const cv = document.getElementById('globe');
const gl = cv.getContext('webgl', { alpha: true, antialias: true });
if (!gl) {
  const fallback = cv.getContext('2d');
  if (!fallback) throw new Error('Aucun contexte graphique compatible n’est disponible.');

  let W, H, R, lon0 = 0, pitch = 0, drag = false, lastX = 0, lastY = 0, vel = .12;
  let lastCountryCheck = 0;
  const image = new Image();
  let textureReady = false;
  image.onload = () => { textureReady = true; };
  image.onerror = () => { throw new Error('Impossible de charger la texture terrestre locale.'); };
  image.src = 'assets/earth-blue-marble.jpg';

  function resizeFallback() {
    const d = devicePixelRatio || 1;
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    fallback.setTransform(d, 0, 0, d, 0, 0);
    R = Math.min(W, H) * .32;
  }
  addEventListener('resize', resizeFallback);
  resizeFallback();

  function drawFallback() {
    const cx = W / 2, cy = H / 2;
    fallback.clearRect(0, 0, W, H);
    fallback.save();
    fallback.translate(cx, cy);
    fallback.scale(zoom, zoom);
    fallback.translate(-cx, -cy);
    let glow = fallback.createRadialGradient(cx, cy, R * .94, cx, cy, R * 1.3);
    glow.addColorStop(0, 'rgba(90,160,255,.45)');
    glow.addColorStop(1, 'rgba(90,160,255,0)');
    fallback.fillStyle = glow;
    fallback.beginPath(); fallback.arc(cx, cy, R * 1.3, 0, Math.PI * 2); fallback.fill();

    fallback.save();
    fallback.beginPath(); fallback.arc(cx, cy, R, 0, Math.PI * 2); fallback.clip();
    fallback.fillStyle = '#06204d'; fallback.fillRect(cx - R, cy - R, R * 2, R * 2);
    if (textureReady) {
      const offset = (lon0 % 360) / 360 * R * 2;
      fallback.globalAlpha = .94;
      fallback.drawImage(image, cx - R + offset, cy - R, R * 2, R * 2);
      fallback.drawImage(image, cx - R + offset - R * 2, cy - R, R * 2, R * 2);
      fallback.globalAlpha = 1;
    }

    const shade = fallback.createRadialGradient(cx - R * .45, cy - R * .4, R * .12,
      cx - R * .08, cy, R * 1.12);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(.57, 'rgba(0,0,10,.24)');
    shade.addColorStop(1, 'rgba(0,0,10,.82)');
    fallback.fillStyle = shade;
    fallback.fillRect(cx - R, cy - R, R * 2, R * 2);
    fallback.restore();
  }

  function updateFallbackCountry(x, y) {
    const radius = Math.min(W, H) * .32 * zoom;
    const px = (x - W / 2) / radius, py = (y - H / 2) / radius;
    if (px * px + py * py > 1) {
      countryTooltip.hidden = true;
      return;
    }
    const longitude = ((px + 1) / 2 - (lon0 % 360) / 360) * 360 - 180;
    const latitude = -py * 90;
    showCountryAt(longitude, latitude, x, y);
  }

  function fallbackLoop(time) {
    if (!drag) { vel += (.12 - vel) * .03; lon0 += vel; }
    if (pointerPosition && time - lastCountryCheck > 100) {
      updateFallbackCountry(pointerPosition.x, pointerPosition.y);
      lastCountryCheck = time;
    }
    drawFallback();
    requestAnimationFrame(fallbackLoop);
  }
  cv.addEventListener('pointerdown', e => {
    drag = true; lastX = e.clientX; lastY = e.clientY;
    pointerPosition = { x: e.clientX, y: e.clientY };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (drag) {
      vel = (lastX - e.clientX) * .3;
      lon0 += vel;
      pitch += (lastY - e.clientY) * .3;
      lastX = e.clientX; lastY = e.clientY;
    }
    pointerPosition = { x: e.clientX, y: e.clientY };
    updateFallbackCountry(e.clientX, e.clientY);
  });
  ['pointerup','pointercancel'].forEach(t => cv.addEventListener(t, e => {
    drag = false;
    pointerPosition = { x: e.clientX, y: e.clientY };
  }));
  cv.addEventListener('pointerleave', hideCountry);
  fallbackLoop();
} else {

const vertexSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentSource = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_radius;
  uniform float u_longitude;
  uniform float u_tilt;
  uniform float u_pitch;
  uniform float u_zoom;
  uniform float u_time;
  uniform sampler2D u_earth;
  uniform float u_texture_ready;

  const float PI = 3.141592653589793;

  void main() {
    vec2 point = (gl_FragCoord.xy - u_resolution * 0.5) / (u_radius * u_zoom);
    float distanceFromCenter = length(point);

    if (distanceFromCenter > 1.0) {
      float glow = 1.0 - smoothstep(1.0, 1.28, distanceFromCenter);
      float rim = exp(-pow((distanceFromCenter - 1.015) * 32.0, 2.0));
      float alpha = glow * 0.22 + rim * 0.34;
      gl_FragColor = vec4(vec3(0.22, 0.55, 1.0) * alpha, alpha);
      return;
    }

    float depth = sqrt(max(0.0, 1.0 - dot(point, point)));
    vec3 normal = vec3(point, depth);
    float verticalAngle = u_tilt + u_pitch;
    float latitude = normal.y * cos(verticalAngle) + normal.z * sin(verticalAngle);
    float longitudeDepth = -normal.y * sin(verticalAngle) + normal.z * cos(verticalAngle);
    float longitude = atan(normal.x, longitudeDepth) + u_longitude;
    vec2 uv = vec2(fract(longitude / (2.0 * PI) + 0.5),
                   asin(clamp(latitude, -1.0, 1.0)) / PI + 0.5);

    vec3 surface = vec3(0.025, 0.10, 0.24);
    if (u_texture_ready > 0.5) {
      surface = texture2D(u_earth, uv).rgb;
    }

    float oceanMask = smoothstep(0.15, 0.035, surface.g) *
                      smoothstep(0.12, 0.32, surface.b) *
                      (1.0 - smoothstep(0.08, 0.22, surface.r));
    float flow = sin(
      uv.x * 75.0 + sin(uv.y * 19.0 + u_time * 0.16) * 2.8 +
      uv.y * 13.0 + u_time * 0.24
    ) * cos(uv.y * 48.0 - uv.x * 9.0 + u_time * 0.13);
    float currentLines = smoothstep(0.68, 0.96, flow) * oceanMask;
    surface += vec3(0.025, 0.11, 0.17) * currentLines;

    vec3 lightDirection = normalize(vec3(-0.48, 0.42, 0.77));
    float diffuse = max(dot(normal, lightDirection), 0.0);
    float daylight = smoothstep(-0.16, 0.30, dot(normal, lightDirection));
    surface *= 0.18 + 0.88 * diffuse;
    surface = mix(surface * 0.48, surface, daylight);

    float atmosphere = pow(1.0 - depth, 2.6);
    surface += vec3(0.06, 0.24, 0.55) * atmosphere * (0.45 + daylight * 0.8);
    gl_FragColor = vec4(surface, 1.0);
  }
`;

function createShader(type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Impossible de créer un nuanceur WebGL.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Erreur de compilation WebGL : ${message}`);
  }
  return shader;
}

const program = gl.createProgram();
if (!program) throw new Error('Impossible de créer le programme WebGL.');
gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertexSource));
gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragmentSource));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(`Erreur de liaison WebGL : ${gl.getProgramInfoLog(program)}`);
}
gl.useProgram(program);

const vertices = gl.createBuffer();
if (!vertices) throw new Error('Impossible de créer le tampon WebGL.');
gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1, 1, -1, -1, 1,
  -1, 1, 1, -1, 1, 1
]), gl.STATIC_DRAW);
const position = gl.getAttribLocation(program, 'a_position');
gl.enableVertexAttribArray(position);
gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

const uniforms = {
  resolution: gl.getUniformLocation(program, 'u_resolution'),
  radius: gl.getUniformLocation(program, 'u_radius'),
  longitude: gl.getUniformLocation(program, 'u_longitude'),
  tilt: gl.getUniformLocation(program, 'u_tilt'),
  pitch: gl.getUniformLocation(program, 'u_pitch'),
  zoom: gl.getUniformLocation(program, 'u_zoom'),
  time: gl.getUniformLocation(program, 'u_time'),
  textureReady: gl.getUniformLocation(program, 'u_texture_ready')
};
const earthTexture = gl.createTexture();
if (!earthTexture) throw new Error('Impossible de créer la texture du globe.');
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, earthTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.uniform1i(gl.getUniformLocation(program, 'u_earth'), 0);

let textureReady = false;
const earthImage = new Image();
earthImage.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, earthTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, earthImage);
  textureReady = true;
};
earthImage.onerror = () => {
  throw new Error('Impossible de charger la texture terrestre locale.');
};
earthImage.src = 'assets/earth-blue-marble.jpg';

let W, H, R, lon0 = 0, pitch = 0, drag = false, lastX = 0, lastY = 0, vel = .12;
let lastCountryCheck = 0;
const tilt = 23.5 * Math.PI / 180, rad = Math.PI / 180;

function resize() {
  const d = devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * d); cv.height = Math.round(H * d);
  gl.viewport(0, 0, cv.width, cv.height);
  R = Math.min(W, H) * .32 * d;
}
addEventListener('resize', resize); resize();

function draw(time) {
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uniforms.resolution, cv.width, cv.height);
  gl.uniform1f(uniforms.radius, R);
  gl.uniform1f(uniforms.longitude, lon0 * rad);
  gl.uniform1f(uniforms.tilt, tilt);
  gl.uniform1f(uniforms.pitch, pitch * rad);
  gl.uniform1f(uniforms.zoom, zoom);
  gl.uniform1f(uniforms.time, time * 0.001);
  gl.uniform1f(uniforms.textureReady, textureReady ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function updateGlobeCountry(x, y) {
  const radius = Math.min(W, H) * .32 * zoom;
  const px = (x - W / 2) / radius, py = (H / 2 - y) / radius;
  const distanceSquared = px * px + py * py;
  if (distanceSquared > 1) {
    countryTooltip.hidden = true;
    return;
  }

  const depth = Math.sqrt(1 - distanceSquared);
  const verticalAngle = tilt + pitch * rad;
  const latitude = Math.asin(py * Math.cos(verticalAngle) + depth * Math.sin(verticalAngle)) / rad;
  const longitudeDepth = -py * Math.sin(verticalAngle) + depth * Math.cos(verticalAngle);
  const longitude = Math.atan2(px, longitudeDepth) / rad + lon0;
  showCountryAt(longitude, latitude, x, y);
}

function loop(time) {
  if (!drag) { vel += (.12 - vel) * .03; lon0 += vel; }
  if (pointerPosition && time - lastCountryCheck > 100) {
    updateGlobeCountry(pointerPosition.x, pointerPosition.y);
    lastCountryCheck = time;
  }
  draw(time); requestAnimationFrame(loop);
}
cv.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  throw new Error('Le contexte WebGL du globe a été interrompu.');
});
cv.addEventListener('pointerdown', e => {
  drag = true; lastX = e.clientX; lastY = e.clientY;
  pointerPosition = { x: e.clientX, y: e.clientY };
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (drag) {
    vel = (lastX - e.clientX) * .3;
    lon0 += vel;
    pitch += (lastY - e.clientY) * .3;
    lastX = e.clientX; lastY = e.clientY;
  }
  pointerPosition = { x: e.clientX, y: e.clientY };
  updateGlobeCountry(e.clientX, e.clientY);
});
['pointerup','pointercancel'].forEach(t => cv.addEventListener(t, e => {
  drag = false;
  pointerPosition = { x: e.clientX, y: e.clientY };
}));
cv.addEventListener('pointerleave', hideCountry);
loop();
}
