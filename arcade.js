// OK Manager 27 — Prototip arcade 3D (Three.js) d'hoquei patins.
// Regles revisades amb World Skate 2027; simplificacions a docs/ARCADE_REVISIO.md.
(function () {
  'use strict';

  const container = document.getElementById('webglContainer');
  const hudCanvas = document.getElementById('hudCanvas');
  const hudCtx = hudCanvas.getContext('2d');

  const S = 0.1;
  const METRE = 25; // Una sola escala per a dibuix, física i decisions arbitrals.
  const RINK = {
    w: 40*METRE, h: 20*METRE, cornerRadius: 3*METRE,
    goalLineOffset: 2.7*METRE,
    goalWidth: 1.7*METRE, goalHeight: 1.05*METRE,
    goalDepth: 0.65*METRE, postRadius: 0.075*METRE/2,
    creaseRadius: 0.85*METRE, centreRadius: 3*METRE,
    areaDepth: 5.4*METRE, areaWidth: 9*METRE,
    penaltyDistance: 5.4*METRE, directDistance: 7.4*METRE
  };

  // Equips demo: els atributs són estimacions de joc.
  const TEAMS = {
    home: {
      id: 'fcb',
      name: 'BARÇA',
      short: 'FCB',
      primary: '#1d4ed8',
      secondary: '#b91c1c',
      shorts: '#0f172a',
      socks: '#1e3a8a',
      gkColor: '#f59e0b',
      skin: '#f1c27d',
      players: [
        { num: 1, name: 'C. GRAU', role: 'GK', ovr: 88, speed: 82, shot: 60, pass: 85, def: 90, gkAcrobat: 89, gkReflexes: 92, gkPositioning: 90 },
        { num: 9, name: 'ALABART', role: 'DEF', ovr: 91, speed: 90, shot: 92, pass: 94, def: 88, iq: 93, tackle: 89 },
        { num: 7, name: 'BARROSO', role: 'MID', ovr: 90, speed: 87, shot: 94, pass: 89, def: 87, iq: 88, tackle: 86 },
        { num: 24, name: 'FONT', role: 'FWD', ovr: 87, speed: 88, shot: 91, pass: 86, def: 81, iq: 86, tackle: 80 },
        { num: 55, name: 'ARAGONÈS', role: 'FWD', ovr: 89, speed: 93, shot: 90, pass: 87, def: 82, iq: 87, tackle: 83 }
      ]
    },
    away: {
      id: 'reus',
      name: 'REUS DEPORTIU',
      short: 'REU',
      primary: '#dc2626',
      secondary: '#111827',
      shorts: '#111827',
      socks: '#991b1b',
      gkColor: '#10b981',
      skin: '#e0ac69',
      players: [
        { num: 1, name: 'BALLART', role: 'GK', ovr: 89, speed: 82, shot: 58, pass: 82, def: 91, gkAcrobat: 91, gkReflexes: 90, gkPositioning: 91 },
        { num: 5, name: 'SALVAT', role: 'DEF', ovr: 86, speed: 85, shot: 86, pass: 87, def: 88, iq: 89, tackle: 88 },
        { num: 8, name: 'CASAS', role: 'FWD', ovr: 88, speed: 90, shot: 89, pass: 85, def: 80, iq: 87, tackle: 81 },
        { num: 15, name: 'JULIÀ', role: 'MID', ovr: 88, speed: 88, shot: 88, pass: 89, def: 84, iq: 89, tackle: 84 },
        { num: 99, name: 'ORDEIG', role: 'FWD', ovr: 86, speed: 86, shot: 87, pass: 86, def: 82, iq: 85, tackle: 82 }
      ]
    }
  };

  // Configuració dels 3 nivells de porter rival
  const GK_DIFFICULTY = {
    balanced: {
      label: '🧤 Porter: Equilibrat',
      saveRadius: 10.2,
      lateralSpeed: 2.35,
      closeDelay: 0.11,
      farDelay: 0.03,
      defSpeedMul: 0.92
    },
    hard: {
      label: '🧤 Porter: Muralla (Difícil)',
      saveRadius: 11.4,
      lateralSpeed: 2.85,
      closeDelay: 0.06,
      farDelay: 0.01,
      defSpeedMul: 0.98
    },
    easy: {
      label: '🧤 Porter: Accessible',
      saveRadius: 8.8,
      lateralSpeed: 1.85,
      closeDelay: 0.17,
      farDelay: 0.08,
      defSpeedMul: 0.85
    }
  };

  // Perfils de la IA rival (la dificultat també ajusta el porter).
  const AI_LEVELS = {
    easy: { reaction: 0.42, shootBias: -0.08, aimError: 0.5, foul: 0.18, steal: 0.26, intercept: 0.55, highPress: false },
    balanced: { reaction: 0.28, shootBias: 0, aimError: 0.36, foul: 0.12, steal: 0.34, intercept: 0.85, highPress: false },
    hard: { reaction: 0.17, shootBias: 0.06, aimError: 0.22, foul: 0.09, steal: 0.42, intercept: 1, highPress: true }
  };

  const PACE_MODES = [
    { key: 'realistic', factor: 0.48, label: '⏱ Ritme: Tranquil' },
    { key: 'normal', factor: 0.62, label: '⏱ Ritme: Equilibrat' },
    { key: 'fast', factor: 0.76, label: '⏱ Ritme: Ràpid' }
  ];

  // --- ESTAT DEL PARTIT I REGLAMENT D'HOQUEI PATINS ---
  const state = {
    mode: 'match',
    camera: 'nhl_side',
    courtStyle: 'blue',
    gkDiff: 'balanced',
    paceMode: 'normal',
    paceFactor: PACE_MODES[1].factor,
    zoomAdjust: 1.0,
    paused: false,
    timeRemaining: 25*60,
    halfDuration: 25*60, // Sempre 25 minuts de rellotge de partit (reglament).
    realHalfMinutes: 25, // Minuts reals que dura cada part (com la «Durada de la part» del FIFA).
    period: 1,
    halftimeRemaining: 0,
    endPeriodAfterSetPiece: false,
    penalties: { home: [], away: [] },
    substitutionCount: { home: 0, away: 0 },
    benchWasPaused: false,
    pendingRestart: null,
    freeHit: null,
    booling: null,
    neutralPossession: false,
    setPieceWait: 0,
    setPieceReady: false,
    indirectTaker: null,
    passFlight: null,
    passBlockedPlayer: null,
    setPieceType: 'direct_foul',
    directShooter: null,
    possessionClock: 45,
    halfCourtClock: 10, // 10s per creuar a camp contrari quan inicies possessió al teu camp
    backCourtClock: 5,  // 5s per tornar a camp contrari si tornes al teu camp un cop ja havies creuat
    crossedHalfCourt: false,
    possessionTeam: 'home',
    score: { home: 0, away: 0 },
    shots: { home: 0, away: 0 },
    fouls: { home: 0, away: 0 },
    exclusions: { home: 0, away: 0 }, // Temps útil de sanció: 120 segons per blava.
    controlledIdx: 4,
    switchVisited: [],
    switchWindow: 0,
    excludedPlayers: { home: null, away: null },
    shotCharge: 0,
    chargingShot: false,
    lastPassTime: 0, // Per premiar el "One-Timer" (passada al 2n pal + xut ràpid!)
    aimTargetY: RINK.h / 2,
    bannerText: '',
    bannerSubText: '',
    bannerTimer: 0,
    bannerSeq: 0,
    saves: { home: 0, away: 0 },
    blueCards: { home: 0, away: 0 },
    lastGoal: null,
    goalSeq: 0,
    lastShooter: null,
    aiLevel: 'balanced',
    stoppage: null, // { type: 'foul'|'card'|'goal'|'violation', team, offender, victim, protesters, x, y, t }
    cardEvent: null // { type: 'blue' | 'warning', playerNum, playerName, teamName, teamColor, sanction, timer, offender }
  };

  let torreBulbs = { home: null, away: null };

  const keys = {};
  // Esdeveniments del motor cap a la capa visual/sonora (so, públic, càmera, repeticions).
  const fxEvents = [];
  const replayState = { active: false, frames: [], cursor: 0, speed: 0.6, start: 0, end: 0, goalIndex: -1, pendingAt: 0, goalSide: 0, focus: null };
  const ui = { intro: false, lastResult: '', finishReason: '' };
  const settings = loadSettings();
  const aiMarkCache = { frame: -1, team: null, map: null };
  const touchInput = {
    active: false,
    dx: 0,
    dy: 0,
    originX: 0,
    originY: 0,
    sprint: false
  };

  let players = [];
  let squads = { home: [], away: [] };
  let referees = [];
  const ball = {
    x: RINK.w / 2,
    y: RINK.h / 2,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 0.037*METRE,
    owner: null,
    shotByTeam: null,
    mesh: null
  };

  // ============================================================================
  // 1. INICIALITZACIÓ ESCENA 3D WEBGL (THREE.JS)
  // ============================================================================
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060a);
  scene.fog = new THREE.Fog(0x04060a, 110, 260);

  // Qualitat automàtica: l'ordinador rep més detall; el mòbil prioritza la fluïdesa.
  // Es pot forçar des del menú (es desa al navegador i s'aplica en recarregar).
  const QUALITY = (() => {
    let forced = null;
    try { forced = localStorage.getItem('okm27.arcade.quality'); } catch (e) {}
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const smallScreen = Math.min(window.innerWidth || 0, window.innerHeight || 0) < 720;
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    const tier = forced === 'high' || forced === 'low' ? forced : (coarse || smallScreen || cores <= 4 ? 'low' : 'high');
    return tier === 'high'
      ? { tier, pixelRatio: 2, shadowMap: 2048, crowdRows: 12, crowdDensity: 0.92, courtRes: 4096, crowdEvery: 1 }
      : { tier, pixelRatio: 1.5, shadowMap: 1024, crowdRows: 7, crowdDensity: 0.7, courtRes: 2048, crowdEvery: 2 };
  })();

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 520);
  const camPosCurr = new THREE.Vector3(0, 26, 42);
  const camLookCurr = new THREE.Vector3(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Il·luminació de pavelló: llum zenital forta sobre la pista i grades en penombra (look de retransmissió).
  const ambientLight = new THREE.HemisphereLight(0xeef3ff, 0x1c2029, 0.5);
  scene.add(ambientLight);

  const mainSpot = new THREE.DirectionalLight(0xfff7ee, 1.18);
  mainSpot.position.set(8, 70, 16);
  mainSpot.castShadow = true;
  mainSpot.shadow.mapSize.width = QUALITY.shadowMap;
  mainSpot.shadow.mapSize.height = QUALITY.shadowMap;
  mainSpot.shadow.bias = -0.0004;
  mainSpot.shadow.normalBias = 0.03;
  mainSpot.shadow.radius = 3;
  mainSpot.shadow.camera.near = 20;
  mainSpot.shadow.camera.far = 110;
  mainSpot.shadow.camera.left = -56;
  mainSpot.shadow.camera.right = 56;
  mainSpot.shadow.camera.top = 31;
  mainSpot.shadow.camera.bottom = -31;
  scene.add(mainSpot);

  const fillLight = new THREE.DirectionalLight(0xc7d7ff, 0.32);
  fillLight.position.set(-30, 40, -30);
  scene.add(fillLight);

  // Mapa d'entorn procedural: fileres de focus al sostre i grades fosques. Dona reflexos
  // suaus al terra de resina, a les tanques i als pals sense cap fitxer extern.
  function buildArenaEnvironment() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0a0d12');
    grad.addColorStop(0.38, '#141922');
    grad.addColorStop(0.5, '#262d38');
    grad.addColorStop(0.62, '#11151c');
    grad.addColorStop(1, '#07090c');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#ffffff';
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 18; i++) {
        g.globalAlpha = 0.95 - row * 0.2;
        g.fillRect(i * 57 + 14, 28 + row * 34, 30, 9);
      }
    }
    const fanColors = ['#2d4f9a', '#7c2033', '#cfd3d8', '#a8211f', '#c9a227'];
    for (let i = 0; i < 1600; i++) {
      g.globalAlpha = 0.22;
      g.fillStyle = fanColors[i % fanColors.length];
      g.fillRect((i * 97.13) % 1024, 262 + ((i * 31.7) % 70), 3, 4);
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
    return env;
  }
  scene.environment = buildArenaEnvironment();

  // ============================================================================
  // 2. PISTA D'HOQUEI PATINS 3D, TANQUES, PUBLICITAT, GRADERIES I PAVELLÓ
  // ============================================================================
  let courtFloorMesh = null;
  let courtTextures = {};
  const arenaDynamic = { crowd: null, jumbotron: null, possessionBoards: [], lastJumbo: '', lastPossession: '' };

  function canvasTexture(width, height, draw) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    draw(c.getContext('2d'), width, height);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }

  function generateCourtTexture(style) {
    const W = QUALITY.courtRes, H = W / 2;
    return canvasTexture(W, H, (g) => {
      const sx = W / RINK.w, sy = H / RINK.h;
      if (style === 'blue') {
        // Resina esportiva blava: to uniforme amb una lleugera vinyeta de focus i gra fi.
        g.fillStyle = '#17498d';
        g.fillRect(0, 0, W, H);
        const glow = g.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.62);
        glow.addColorStop(0, 'rgba(255,255,255,0.07)');
        glow.addColorStop(1, 'rgba(0,10,30,0.28)');
        g.fillStyle = glow;
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < W * 3; i++) {
          g.fillStyle = i % 2 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.02)';
          g.fillRect((i * 7919) % W, (i * 104729) % H, 3, 3);
        }
      } else {
        // Parquet: llistons amb variació de to i juntes.
        g.fillStyle = '#c98f4e';
        g.fillRect(0, 0, W, H);
        const plankH = H / 46;
        for (let row = 0; row < 46; row++) {
          let x = -((row * 137) % 260) * (W / 2048);
          while (x < W) {
            const len = (180 + ((row * 31 + Math.floor(x)) % 140)) * (W / 2048);
            const tone = ((row * 17 + Math.floor(x / 7)) % 9) - 4;
            g.fillStyle = `rgb(${201 + tone * 4},${143 + tone * 3},${78 + tone * 2})`;
            g.fillRect(x, row * plankH, len - 2, plankH - 1.5);
            x += len;
          }
        }
        const glow = g.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.62);
        glow.addColorStop(0, 'rgba(255,240,210,0.12)');
        glow.addColorStop(1, 'rgba(40,20,0,0.18)');
        g.fillStyle = glow;
        g.fillRect(0, 0, W, H);
      }

      const line = 0.08 * METRE * sx;
      const leftGoal = RINK.goalLineOffset * sx, rightGoal = (RINK.w - RINK.goalLineOffset) * sx;
      const areaW = RINK.areaDepth * sx, areaH = RINK.areaWidth * sy;

      // Àrees amb un to lleugerament diferent, com a les pistes WSE.
      g.fillStyle = style === 'blue' ? 'rgba(10,30,70,0.18)' : 'rgba(90,40,10,0.10)';
      g.fillRect(leftGoal, (H - areaH) / 2, areaW, areaH);
      g.fillRect(rightGoal - areaW, (H - areaH) / 2, areaW, areaH);

      // Mitja lluna del porter.
      g.fillStyle = style === 'blue' ? 'rgba(245,170,40,0.55)' : 'rgba(29,78,216,0.42)';
      g.beginPath(); g.arc(leftGoal, H / 2, RINK.creaseRadius * sx, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill();
      g.beginPath(); g.arc(rightGoal, H / 2, RINK.creaseRadius * sx, Math.PI / 2, Math.PI * 1.5); g.closePath(); g.fill();

      g.strokeStyle = '#f4f7fb';
      g.lineWidth = line;
      g.lineCap = 'butt';
      g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
      g.beginPath(); g.arc(W / 2, H / 2, RINK.centreRadius * sx, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#f4f7fb';
      g.beginPath(); g.arc(W / 2, H / 2, 0.1 * METRE * sx, 0, Math.PI * 2); g.fill();

      // Logotip discret dins el cercle central.
      g.save();
      g.globalAlpha = style === 'blue' ? 0.16 : 0.2;
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `700 ${Math.round(W * 0.0105)}px "Barlow Condensed", system-ui, sans-serif`;
      g.fillText('OK MANAGER 27', W / 2, H / 2 - RINK.centreRadius * sx * 0.5);
      g.fillText('HOQUEI PATINS', W / 2, H / 2 + RINK.centreRadius * sx * 0.5);
      g.restore();

      g.strokeRect(leftGoal, (H - areaH) / 2, areaW, areaH);
      g.strokeRect(rightGoal - areaW, (H - areaH) / 2, areaW, areaH);
      g.beginPath(); g.arc(leftGoal, H / 2, RINK.creaseRadius * sx, -Math.PI / 2, Math.PI / 2); g.stroke();
      g.beginPath(); g.arc(rightGoal, H / 2, RINK.creaseRadius * sx, Math.PI / 2, Math.PI * 1.5); g.stroke();

      g.strokeStyle = '#e23b3b';
      g.beginPath();
      g.moveTo(leftGoal, (H - areaH) / 2); g.lineTo(leftGoal, (H + areaH) / 2);
      g.moveTo(rightGoal, (H - areaH) / 2); g.lineTo(rightGoal, (H + areaH) / 2);
      g.stroke();

      g.fillStyle = '#f4f7fb';
      [RINK.goalLineOffset + RINK.penaltyDistance, RINK.goalLineOffset + RINK.directDistance,
        RINK.w - RINK.goalLineOffset - RINK.penaltyDistance, RINK.w - RINK.goalLineOffset - RINK.directDistance
      ].forEach(px => { g.beginPath(); g.arc(px * sx, H / 2, 0.07 * METRE * sx, 0, Math.PI * 2); g.fill(); });
    });
  }

  // Bandes de publicitat amb patrocinadors ficticis (cap marca real).
  function generateAdStripTexture(seed) {
    const sponsors = [
      { text: 'OK MANAGER 27', bg: '#0d2a5c', fg: '#ffffff', accent: '#38bdf8' },
      { text: 'HOQUEI PATINS', bg: '#111418', fg: '#facc15', accent: '#facc15' },
      { text: 'CARROT REVOLT', bg: '#c2410c', fg: '#ffffff', accent: '#fed7aa' },
      { text: 'JOC NET · FAIR PLAY', bg: '#0f5132', fg: '#ffffff', accent: '#86efac' },
      { text: '#HOQUEI', bg: '#7f1d1d', fg: '#ffffff', accent: '#fecaca' },
      { text: 'PISTA · ESTIC · BOLA', bg: '#1e293b', fg: '#e2e8f0', accent: '#94a3b8' }
    ];
    return canvasTexture(2048, 128, (g, W, H) => {
      const tile = W / 4;
      for (let i = 0; i < 4; i++) {
        const s = sponsors[(seed + i) % sponsors.length];
        g.fillStyle = s.bg; g.fillRect(i * tile, 0, tile, H);
        g.fillStyle = s.accent; g.fillRect(i * tile, H - 10, tile, 10);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(i * tile, 0, tile, H * 0.45);
        g.fillStyle = s.fg;
        g.font = '800 64px "Barlow Condensed", system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(s.text, i * tile + tile / 2, H / 2 - 2, tile - 40);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(i * tile + tile - 3, 0, 3, H);
      }
    });
  }

  function buildStands(hw, hh) {
    // Graderies en tres costats (el lateral de càmera queda lliure). Tot el públic va en
    // InstancedMesh: tres crides de dibuix, fins i tot amb un pavelló ple.
    const rows = QUALITY.crowdRows, rowDepth = 2.05, rise = 1.25, seatGap = 1.3;
    const stepMat = new THREE.MeshStandardMaterial({ color: 0x1a1f28, roughness: 0.92 });
    const stands = [
      { side: 'back', origin: new THREE.Vector3(0, 0.6, -hh - 7.2), along: new THREE.Vector3(1, 0, 0), out: new THREE.Vector3(0, 0, -1), length: 118, team: 'neutral' },
      { side: 'left', origin: new THREE.Vector3(-hw - 6.5, 0.6, 0), along: new THREE.Vector3(0, 0, 1), out: new THREE.Vector3(-1, 0, 0), length: 62, team: 'home' },
      { side: 'right', origin: new THREE.Vector3(hw + 6.5, 0.6, 0), along: new THREE.Vector3(0, 0, -1), out: new THREE.Vector3(1, 0, 0), length: 62, team: 'away' }
    ];
    const seats = [];
    for (const s of stands) {
      for (let row = 0; row < rows; row++) {
        const centre = s.origin.clone().addScaledVector(s.out, row * rowDepth);
        centre.y = s.origin.y + row * rise;
        const step = new THREE.Mesh(new THREE.BoxGeometry(s.along.x ? s.length : rowDepth, rise + 0.2, s.along.x ? rowDepth : s.length), stepMat);
        step.position.copy(centre).setY(centre.y - rise / 2 + 0.1);
        step.receiveShadow = false;
        scene.add(step);
        const count = Math.floor(s.length / seatGap);
        for (let i = 0; i < count; i++) {
          const t = (i - (count - 1) / 2) * seatGap + ((row % 2) ? seatGap * 0.35 : 0);
          const pos = centre.clone().addScaledVector(s.along, t);
          const hash = Math.abs(Math.sin(i * 12.9898 + row * 78.233 + s.length) * 43758.5453) % 1;
          seats.push({ pos, face: s.out.clone().negate(), team: s.team, occupied: hash < QUALITY.crowdDensity, hash });
        }
      }
      // Paret del fons, fosca, amb una franja de llum de pavelló.
      const back = s.origin.clone().addScaledVector(s.out, rows * rowDepth + 1.5);
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(s.along.x ? s.length + 20 : 1, 40, s.along.x ? 1 : s.length + 20),
        new THREE.MeshStandardMaterial({ color: 0x0b0e13, roughness: 1 }));
      wall.position.set(back.x, 18, back.z);
      scene.add(wall);
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(s.along.x ? s.length + 10 : 0.3, 0.5, s.along.x ? 0.3 : s.length + 10),
        new THREE.MeshBasicMaterial({ color: 0x2b6cb0 }));
      strip.position.set(back.x - s.out.x * 0.7, rows * rise + 4.2, back.z - s.out.z * 0.7);
      scene.add(strip);
    }

    const seatGeo = new THREE.BoxGeometry(0.95, 0.45, 0.85);
    const seatMesh = new THREE.InstancedMesh(seatGeo, new THREE.MeshLambertMaterial({ color: 0x5d636c }), seats.length);
    const bodyGeo = new THREE.CylinderGeometry(0.46, 0.4, 1.2, 6);
    bodyGeo.scale(1, 1, 0.72);
    const headGeo = new THREE.SphereGeometry(0.3, 8, 6);
    const fans = seats.filter(s => s.occupied);
    const bodyMesh = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0x777c85 }), fans.length);
    const headMesh = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: 0x858a92 }), fans.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    const palettes = {
      home: ['#1d3f99', '#8b1d3a', '#1d3f99', '#a3203f', '#f2f2f2', '#14254f', '#c9a227'],
      away: ['#c81e1e', '#111111', '#c81e1e', '#f2f2f2', '#7a1010', '#2a2a2a'],
      neutral: ['#1d3f99', '#8b1d3a', '#c81e1e', '#f2f2f2', '#3b4252', '#1f2937', '#c9a227', '#0f766e', '#6b7280']
    };
    const skins = ['#f1c9a5', '#e0ac69', '#c68642', '#8d5524', '#f6d7b8'];
    seats.forEach((s, i) => {
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), s.face);
      m.compose(s.pos.clone().setY(s.pos.y + 0.22), q, one);
      seatMesh.setMatrixAt(i, m);
      col.set(s.team === 'away' ? '#5b1a1a' : s.team === 'home' ? '#1b2c57' : '#2a3342').convertSRGBToLinear();
      seatMesh.setColorAt(i, col);
    });
    const fanData = new Float32Array(fans.length * 6);
    fans.forEach((s, i) => {
      const pal = palettes[s.team];
      col.set(pal[Math.floor(s.hash * 997) % pal.length]).convertSRGBToLinear();
      bodyMesh.setColorAt(i, col);
      col.set(skins[Math.floor(s.hash * 7919) % skins.length]).convertSRGBToLinear();
      headMesh.setColorAt(i, col);
      fanData[i * 6] = s.pos.x + (s.hash - 0.5) * 0.35; fanData[i * 6 + 1] = s.pos.y + ((s.hash * 13.7) % 1 - 0.5) * 0.25; fanData[i * 6 + 2] = s.pos.z + ((s.hash * 7.3) % 1 - 0.5) * 0.3;
      fanData[i * 6 + 3] = s.hash * Math.PI * 2;
      fanData[i * 6 + 4] = s.team === 'home' ? 1 : s.team === 'away' ? 2 : (s.hash < 0.55 ? 1 : 2);
      fanData[i * 6 + 5] = Math.atan2(s.face.x, s.face.z);
    });
    [seatMesh, bodyMesh, headMesh].forEach(mesh => { mesh.castShadow = false; mesh.receiveShadow = false; scene.add(mesh); });
    arenaDynamic.crowd = { bodyMesh, headMesh, fanData, count: fans.length, excitement: { 1: 0, 2: 0 }, frame: 0 };
    updateCrowd(0, true);
  }

  // Animació del públic: balanceig suau i salts quan el seu equip marca o té una ocasió.
  function updateCrowd(dt, force = false) {
    const crowd = arenaDynamic.crowd;
    if (!crowd) return;
    crowd.frame++;
    for (const k of [1, 2]) crowd.excitement[k] = Math.max(0, crowd.excitement[k] - dt * 0.28);
    if (!force && crowd.frame % QUALITY.crowdEvery) return;
    const t = performance.now() * 0.001;
    const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    const d = crowd.fanData;
    for (let i = 0; i < crowd.count; i++) {
      const phase = d[i * 6 + 3], ex = crowd.excitement[d[i * 6 + 4]];
      q.setFromAxisAngle(up, d[i * 6 + 5] + Math.sin(t * 0.7 + phase) * 0.15);
      const idle = Math.sin(t * 1.6 + phase) * 0.04;
      const jump = ex > 0.02 ? Math.max(0, Math.sin(t * (7 + (phase % 2)) + phase)) * 0.75 * ex : 0;
      pos.set(d[i * 6], d[i * 6 + 1] + 0.95 + idle + jump, d[i * 6 + 2]);
      m.compose(pos, q, scale);
      crowd.bodyMesh.setMatrixAt(i, m);
      pos.y += 0.92;
      m.compose(pos, q, scale);
      crowd.headMesh.setMatrixAt(i, m);
    }
    crowd.bodyMesh.instanceMatrix.needsUpdate = true;
    crowd.headMesh.instanceMatrix.needsUpdate = true;
  }

  function cheerCrowd(team, amount = 1) {
    const crowd = arenaDynamic.crowd;
    if (!crowd) return;
    const k = team === 'home' ? 1 : 2;
    crowd.excitement[k] = Math.min(1.4, crowd.excitement[k] + amount);
  }

  function drawJumbotron(g, W, H) {
    const mins = Math.floor(state.timeRemaining / 60), secs = String(Math.floor(state.timeRemaining % 60)).padStart(2, '0');
    g.fillStyle = '#05070b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0c1220'; g.fillRect(8, 8, W - 16, H - 16);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = TEAMS.home.primary; g.fillRect(24, 28, W * 0.36, 52);
    g.fillStyle = TEAMS.away.primary; g.fillRect(W - 24 - W * 0.36, 28, W * 0.36, 52);
    g.fillStyle = '#ffffff';
    g.font = '800 40px "Barlow Condensed", system-ui, sans-serif';
    g.fillText(TEAMS.home.short, 24 + W * 0.18, 56);
    g.fillText(TEAMS.away.short, W - 24 - W * 0.18, 56);
    g.font = '800 120px "Barlow Condensed", system-ui, sans-serif';
    g.fillText(String(state.score.home), 24 + W * 0.18, 160);
    g.fillText(String(state.score.away), W - 24 - W * 0.18, 160);
    g.fillStyle = '#fbbf24';
    g.font = '700 64px "Barlow Condensed", system-ui, sans-serif';
    g.fillText(`${mins}:${secs}`, W / 2, 110);
    g.fillStyle = '#94a3b8';
    g.font = '700 30px "Barlow Condensed", system-ui, sans-serif';
    g.fillText(state.period + 'a PART', W / 2, 170);
  }

  function updateArenaScreens() {
    const jumbo = arenaDynamic.jumbotron;
    if (jumbo) {
      const key = state.score.home + '-' + state.score.away + '-' + state.period + '-' + Math.floor(state.timeRemaining);
      if (key !== arenaDynamic.lastJumbo) {
        arenaDynamic.lastJumbo = key;
        drawJumbotron(jumbo.ctx, jumbo.canvas.width, jumbo.canvas.height);
        jumbo.texture.needsUpdate = true;
      }
    }
    const value = state.neutralPossession ? '--' : String(Math.ceil(state.possessionClock));
    if (value !== arenaDynamic.lastPossession) {
      arenaDynamic.lastPossession = value;
      for (const board of arenaDynamic.possessionBoards) {
        const g = board.ctx;
        g.fillStyle = '#05070b'; g.fillRect(0, 0, 128, 96);
        g.fillStyle = Number(value) <= 10 ? '#ef4444' : '#fbbf24';
        g.font = '800 70px "Barlow Condensed", system-ui, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(value, 64, 52);
        board.texture.needsUpdate = true;
      }
    }
  }

  function build3DRinkArena() {
    courtTextures.blue = generateCourtTexture('blue');
    courtTextures.wood = generateCourtTexture('wood');

    const floorMat = new THREE.MeshStandardMaterial({ map: courtTextures.blue, roughness: 0.34, metalness: 0.0, envMapIntensity: 0.6 });
    courtFloorMesh = new THREE.Mesh(new THREE.PlaneGeometry(RINK.w * S, RINK.h * S), floorMat);
    courtFloorMesh.rotation.x = -Math.PI / 2;
    courtFloorMesh.receiveShadow = true;
    scene.add(courtFloorMesh);

    const outerFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 220),
      new THREE.MeshStandardMaterial({ color: 0x161c26, roughness: 0.75, envMapIntensity: 0.4 }));
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.02;
    outerFloor.receiveShadow = true;
    scene.add(outerFloor);

    const cr = RINK.cornerRadius * S, hw = (RINK.w * S) / 2, hh = (RINK.h * S) / 2;
    const perimPts = [];
    const corners = [
      { cx: hw - cr, cz: -hh + cr, a0: -Math.PI / 2, a1: 0 },
      { cx: hw - cr, cz: hh - cr, a0: 0, a1: Math.PI / 2 },
      { cx: -hw + cr, cz: hh - cr, a0: Math.PI / 2, a1: Math.PI },
      { cx: -hw + cr, cz: -hh + cr, a0: Math.PI, a1: Math.PI * 1.5 }
    ];
    for (const c of corners) {
      for (let i = 0; i <= 14; i++) {
        const a = c.a0 + (c.a1 - c.a0) * (i / 14);
        perimPts.push(new THREE.Vector2(c.cx + Math.cos(a) * cr, c.cz + Math.sin(a) * cr));
      }
    }

    // Tanques d'1 m: blanques, sòcol fosc i passamà. El lateral de càmera és translúcid.
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xeef1f5, roughness: 0.42, envMapIntensity: 0.7 });
    const boardMatFront = new THREE.MeshStandardMaterial({ color: 0xeef1f5, transparent: true, opacity: 0.16, depthWrite: false, roughness: 0.3 });
    const kickMat = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.6 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.35, metalness: 0.3 });
    const railMatFront = new THREE.MeshStandardMaterial({ color: 0x2a3140, transparent: true, opacity: 0.35, depthWrite: false });
    for (let i = 0; i < perimPts.length; i++) {
      const p1 = perimPts[i], p2 = perimPts[(i + 1) % perimPts.length];
      const dx = p2.x - p1.x, dz = p2.y - p1.y, segLen = Math.hypot(dx, dz);
      if (segLen < 0.05) continue;
      const midX = (p1.x + p2.x) * 0.5, midZ = (p1.y + p2.y) * 0.5, ang = Math.atan2(dz, dx);
      const isFrontSide = midZ > hh * 0.55;
      const board = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.06, 2.5, 0.3), isFrontSide ? boardMatFront : boardMat);
      board.position.set(midX, 1.25, midZ);
      board.rotation.y = -ang;
      board.castShadow = !isFrontSide;
      board.receiveShadow = !isFrontSide;
      scene.add(board);
      if (!isFrontSide) {
        const kick = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.08, 0.32, 0.34), kickMat);
        kick.position.set(midX, 0.16, midZ);
        kick.rotation.y = -ang;
        scene.add(kick);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.1, 0.16, 0.42), isFrontSide ? railMatFront : railMat);
      rail.position.set(midX, 2.56, midZ);
      rail.rotation.y = -ang;
      scene.add(rail);
    }

    // Publicitat a la cara interior de les tanques (fons i dos fons de pista).
    const adMat = seed => new THREE.MeshStandardMaterial({ map: generateAdStripTexture(seed), roughness: 0.55 });
    const backLen = (hw - cr) * 2 - 0.4;
    [[-backLen / 4, 0], [backLen / 4, 2]].forEach(([x, seed]) => {
      const ad = new THREE.Mesh(new THREE.PlaneGeometry(backLen / 2, 1.7), adMat(seed));
      ad.position.set(x, 1.32, -hh + 0.16);
      scene.add(ad);
    });
    const endLen = (hh - cr) * 2 - 0.4;
    [[-1, 4], [1, 1]].forEach(([side, seed]) => {
      const ad = new THREE.Mesh(new THREE.PlaneGeometry(endLen, 1.7), adMat(seed));
      ad.position.set(side * (hw - 0.16), 1.32, 0);
      ad.rotation.y = -side * Math.PI / 2;
      scene.add(ad);
    });

    // Xarxes de protecció darrere les porteries.
    const netTex = canvasTexture(256, 256, (g, W, H) => {
      g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(20,24,30,0.9)'; g.lineWidth = 2;
      for (let i = 0; i <= W; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); }
    });
    netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
    netTex.repeat.set(12, 3);
    [-1, 1].forEach(side => {
      const net = new THREE.Mesh(new THREE.PlaneGeometry(hh * 2 - 4, 5.2),
        new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      net.position.set(side * (hw + 0.05), 2.6 + 2.6, 0);
      net.rotation.y = Math.PI / 2;
      scene.add(net);
      [-1, 1].forEach(zs => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.4, 8), railMat);
        pole.position.set(side * (hw + 0.05), 5.2, zs * (hh - 2));
        scene.add(pole);
      });
    });

    // --- MESA DE CONTROL, TORRES LLUMINOSES, BANQUETES I MARCADORS DE 45 s (Bases RFEP 5.1, 10.7, 11.4, 30.1.3) ---
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.55 });
    const tableFront = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.5), new THREE.MeshStandardMaterial({ map: generateAdStripTexture(0), roughness: 0.5 }));
    const mesaControl = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.8, 1.8), tableMat);
    mesaControl.position.set(0, 0.9, -hh - 1.6);
    scene.add(mesaControl);
    tableFront.position.set(0, 0.95, -hh - 0.69);
    scene.add(tableFront);
    const officialSuitMat = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.7 });
    const officialSkinMat = new THREE.MeshStandardMaterial({ color: 0xe9bf98, roughness: 0.6 });
    [-1.2, 1.2].forEach(ox => {
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.3, 10), officialSuitMat);
      torso.position.set(ox, 2.15, -hh - 2.15);
      scene.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), officialSkinMat);
      head.position.set(ox, 3.05, -hh - 2.15);
      scene.add(head);
    });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b95a3, metalness: 0.6, roughness: 0.3 });
    [-2.3, 2.3].forEach((tx, idx) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 10), poleMat);
      pole.position.set(tx, 3.1, -hh - 1.2);
      scene.add(pole);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
      const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 16), bulbMat);
      bulb.position.set(tx, 4.6, -hh - 1.2);
      scene.add(bulb);
      if (idx === 0) torreBulbs.home = bulbMat; else torreBulbs.away = bulbMat;
    });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.14, depthWrite: false, roughness: 0.1 });
    [-16, 16].forEach((bx, i) => {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.1, 1.4), tableMat);
      bench.position.set(bx, 0.55, -hh - 1.8);
      scene.add(bench);
      const shield = new THREE.Mesh(new THREE.BoxGeometry(9.8, 3.2, 0.12), glassMat);
      shield.position.set(bx, 2.9, -hh - 2.6);
      scene.add(shield);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.14, 1.9),
        new THREE.MeshStandardMaterial({ color: i ? 0x7f1d1d : 0x1e3a8a, roughness: 0.5 }));
      roof.position.set(bx, 4.55, -hh - 1.75);
      scene.add(roof);
    });
    [-hw + 4.5, hw - 4.5].forEach(px => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.2, 8), poleMat);
      post.position.set(px, 2.6, -hh - 1.5);
      scene.add(post);
      const c = document.createElement('canvas'); c.width = 128; c.height = 96;
      const texture = new THREE.CanvasTexture(c);
      arenaDynamic.possessionBoards.push({ ctx: c.getContext('2d'), texture });
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 0.35),
        [0, 0, 0, 0, 1, 1].map(i => i ? new THREE.MeshBasicMaterial({ map: texture }) : new THREE.MeshBasicMaterial({ color: 0x090d16 })));
      box.position.set(px, 5.6, -hh - 1.5);
      scene.add(box);
    });

    buildStands(hw, hh);

    // Sostre: fileres de focus i marcador central penjat (jumbotron).
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff9ec });
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x202733, roughness: 0.6, metalness: 0.4 });
    for (let ix = -2; ix <= 2; ix++) {
      const truss = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 70), trussMat);
      truss.position.set(ix * 22, 52, 0);
      scene.add(truss);
      for (let iz = -2; iz <= 2; iz++) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 1.2), lampMat);
        lamp.position.set(ix * 22, 51.5, iz * 13);
        scene.add(lamp);
      }
    }
    const jc = document.createElement('canvas'); jc.width = 512; jc.height = 256;
    const jtex = new THREE.CanvasTexture(jc);
    arenaDynamic.jumbotron = { canvas: jc, ctx: jc.getContext('2d'), texture: jtex };
    const screenMat = new THREE.MeshBasicMaterial({ map: jtex });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0b0f16, roughness: 0.5, metalness: 0.4 });
    const jumbo = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 14), [screenMat, screenMat, frameMat, frameMat, screenMat, screenMat]);
    jumbo.position.set(0, 40, 0);
    scene.add(jumbo);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 6), trussMat);
    cable.position.set(0, 48, 0);
    scene.add(cable);
    updateArenaScreens();
  }

  // ============================================================================
  // 3. PORTERIES OFICIALS D'HOQUEI PATINS EN 3D REAL
  // ============================================================================
  function createOfficialRollerHockeyGoal3D(side) {
    const isLeft = side === 'left';
    const gx = (isLeft ? RINK.goalLineOffset - 500 : 500 - RINK.goalLineOffset) * S;
    const dir = isLeft ? -1 : 1;
    const halfW = (RINK.goalWidth * S) / 2 + RINK.postRadius*S;
    const gh = (RINK.goalHeight+RINK.postRadius) * S;
    const depth = RINK.goalDepth * S;

    const goalGroup = new THREE.Group();
    goalGroup.position.set(gx, 0, 0);

    const orangePostMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.3, metalness: 0.2 });
    const whiteMetalMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.2 });
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide });

    const postRadius = RINK.postRadius*S;

    [-halfW, halfW].forEach(zPos => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, gh, 16), orangePostMat);
      post.position.set(0, gh / 2, zPos);
      post.castShadow = true;
      goalGroup.add(post);

      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 1.08, postRadius * 1.08, 0.75, 16), whiteMetalMat);
      sleeve.position.set(0, 0.38, zPos);
      goalGroup.add(sleeve);

      const corner = new THREE.Mesh(new THREE.SphereGeometry(postRadius * 1.05, 12, 12), orangePostMat);
      corner.position.set(0, gh, zPos);
      goalGroup.add(corner);
    });

    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, halfW * 2, 16), orangePostMat);
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(0, gh, 0);
    crossbar.castShadow = true;
    goalGroup.add(crossbar);

    const arcSegments = 20;
    const skirtHeight = 0.20*METRE*S;
    const skirtPositions = [];
    const skirtIndices = [];
    const netPositions = [];
    const netIndices = [];

    for (let i = 0; i <= arcSegments; i++) {
      const t = i / arcSegments;
      const ang = (t - 0.5) * Math.PI;
      const bx = dir * depth * Math.cos(ang);
      const bz = halfW * Math.sin(ang);

      if (i < arcSegments) {
        const nextAng = ((i + 1) / arcSegments - 0.5) * Math.PI;
        const nbx = dir * depth * Math.cos(nextAng);
        const nbz = halfW * Math.sin(nextAng);
        const segLen = Math.hypot(nbx - bx, nbz - bz);
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, segLen, 8), whiteMetalMat);
        tube.position.set((bx + nbx) * 0.5, 0.14, (bz + nbz) * 0.5);
        tube.rotation.z = Math.PI / 2;
        tube.rotation.y = -Math.atan2(nbz - bz, nbx - bx);
        goalGroup.add(tube);
      }

      skirtPositions.push(bx, 0, bz);
      skirtPositions.push(bx, skirtHeight, bz);

      const frontZ = -halfW + t * (halfW * 2);
      netPositions.push(0, gh, frontZ);
      netPositions.push(bx * 0.82, gh * 0.58, bz * 0.92);
      netPositions.push(bx, skirtHeight, bz);
    }

    for (let i = 0; i < arcSegments; i++) {
      const a = i * 2;
      skirtIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);

      const n = i * 3;
      netIndices.push(
        n, n + 1, n + 3,
        n + 1, n + 4, n + 3,
        n + 1, n + 2, n + 4,
        n + 2, n + 5, n + 4
      );
    }

    const skirtGeo = new THREE.BufferGeometry();
    skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPositions, 3));
    skirtGeo.setIndex(skirtIndices);
    skirtGeo.computeVertexNormals();
    goalGroup.add(new THREE.Mesh(skirtGeo, skirtMat));

    [-1, 1].forEach(sideSign => {
      const start = new THREE.Vector3(0, gh, sideSign * halfW);
      const end = new THREE.Vector3(dir * depth * 0.72, skirtHeight, sideSign * halfW * 0.72);
      const diff = new THREE.Vector3().subVectors(end, start);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, diff.length(), 10), whiteMetalMat);
      bar.position.copy(start).addScaledVector(diff, 0.5);
      bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.clone().normalize());
      goalGroup.add(bar);
    });

    const netGeo = new THREE.BufferGeometry();
    netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPositions, 3));
    netGeo.setIndex(netIndices);
    netGeo.computeVertexNormals();

    const netSolidMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    const netWireMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      wireframe: true,
      transparent: true,
      opacity: 0.48
    });
    goalGroup.add(new THREE.Mesh(netGeo, netSolidMat));
    goalGroup.add(new THREE.Mesh(netGeo, netWireMat));

    scene.add(goalGroup);
    return goalGroup;
  }

  // ============================================================================
  // 4. MODELS 3D ARTICULATS DE JUGADORS I PORTERS D'HOQUEI PATINS
  // ============================================================================
  function createJerseyTexture(team, num, name = '') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = team.primary;
    g.fillRect(0, 0, 512, 256);
    // Ratlles verticals de la segona equipació de color.
    g.fillStyle = team.secondary;
    for (let i = 0; i < 6; i++) g.fillRect(i * 85.33 + 42, 0, 42, 256);
    // Plecs i ombrejat de teixit.
    const shade = g.createLinearGradient(0, 0, 0, 256);
    shade.addColorStop(0, 'rgba(255,255,255,0.10)');
    shade.addColorStop(0.55, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = shade;
    g.fillRect(0, 0, 512, 256);
    // Coll i punys.
    g.fillStyle = team.secondary;
    g.fillRect(0, 0, 512, 12);
    const drawNumber = (x, y, size) => {
      g.font = `800 ${size}px "Barlow Condensed", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = size * 0.1;
      g.strokeStyle = 'rgba(10,15,25,0.85)';
      g.strokeText(String(num), x, y);
      g.fillStyle = '#ffffff';
      g.fillText(String(num), x, y);
    };
    drawNumber(128, 118, 74);   // davant (u = 0,25)
    drawNumber(384, 140, 110);  // esquena (u = 0,75)
    if (name) {
      g.font = '700 30px "Barlow Condensed", system-ui, sans-serif';
      g.fillStyle = '#ffffff';
      g.fillText(name, 384, 58, 150);
    }
    return new THREE.CanvasTexture(c);
  }

  function buildSkater3DMesh(p, team) {
    const group = new THREE.Group(), bodyPivot = new THREE.Group();
    group.add(bodyPivot);
    bodyPivot.rotation.order = 'YXZ'; // caigudes i inclinacions sobre l'eix del propi jugador
    const material = (color,roughness=0.78) => new THREE.MeshStandardMaterial({color,roughness});
    const jerseyTex=createJerseyTexture(team,p.num,p.name);jerseyTex.anisotropy=4;jerseyTex.encoding=THREE.sRGBEncoding;
    const jersey=new THREE.MeshStandardMaterial({map:jerseyTex,roughness:0.82,envMapIntensity:0.5});
    const shorts=material(team.shorts),socks=material(team.socks||team.primary);
    const skin=material(team.skin,0.85),boot=material(0x171c24,0.65);
    const pad=material(0xd6dde3),glove=material(team.shorts),wood=material(0xb99560);
    const rubber=material(0x242a30),wheelMat=material(0xd8c8a5,0.72);
    const metal=new THREE.MeshStandardMaterial({color:0x7b8794,roughness:0.48,metalness:0.6});
    const mesh=(geometry,mat,parent,x=0,y=0,z=0)=>{
      const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);
      m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
    };
    const sphere=(r,mat,parent,x,y,z)=>mesh(new THREE.SphereGeometry(r,12,8),mat,parent,x,y,z);
    const segment=(r1,r2,mat,parent)=>mesh(new THREE.CylinderGeometry(r1,r2,1,10),mat,parent);
    const ringMat=new THREE.MeshBasicMaterial({color:0x38bdf8,side:THREE.DoubleSide,transparent:true,opacity:0});
    const ringMesh=mesh(new THREE.RingGeometry(1.3,1.48,40),ringMat,group,0,0.035,0);
    ringMesh.rotation.x=-Math.PI/2;ringMesh.castShadow=false;
    // Separate pelvis and upper body: leaning never tips the skates into the floor.
    const pelvis=mesh(new THREE.CylinderGeometry(0.43,0.37,0.48,12),shorts,bodyPivot);
    pelvis.scale.set(0.68,1,1);
    const upper=new THREE.Group();bodyPivot.add(upper);
    const torso=mesh(new THREE.CylinderGeometry(0.57,0.4,1.14,16),jersey,upper,0,0.65,0);
    torso.scale.set(0.62,1,1.05);
    mesh(new THREE.CylinderGeometry(0.14,0.16,0.23,10),skin,upper,0,1.31,0);
    const headGroup=new THREE.Group();headGroup.position.set(0,1.65,0);upper.add(headGroup);
    const head=sphere(0.32,skin,headGroup,0,0,0);head.scale.set(0.91,1.12,0.9);
    const hair=material([0x251e1a,0x4e362a,0x171a1e][(p.rosterIndex??p.idx)%3]);
    mesh(new THREE.SphereGeometry(0.325,12,8,0,Math.PI*2,0,Math.PI*0.5),hair,headGroup,-0.025,0.06,0);
    sphere(0.055,skin,headGroup,0,-0.01,-0.30);sphere(0.055,skin,headGroup,0,-0.01,0.30);
    const nose=sphere(0.052,skin,headGroup,0.29,0,0);nose.scale.set(1.1,1,0.7);
    const eyeMat=material(0x242323);
    [-0.11,0.11].forEach(z=>sphere(0.023,eyeMat,headGroup,0.285,0.07,z));
    const collar=mesh(new THREE.TorusGeometry(0.18,0.035,6,16),material(team.secondary),upper,0,1.2,0);
    collar.rotation.x=Math.PI/2;
    function leg(side) {
      const thigh=segment(0.19,0.15,shorts,bodyPivot),shin=segment(0.145,0.11,socks,bodyPivot);
      const knee=sphere(0.17,pad,bodyPivot,0,0,0);knee.scale.set(0.8,1,0.9);
      const skate=new THREE.Group();bodyPivot.add(skate);
      const shoe=sphere(1,boot,skate,0.08,0,0);shoe.scale.set(0.34,0.145,0.15);
      sphere(0.13,boot,skate,-0.13,0.04,0);
      mesh(new THREE.BoxGeometry(0.54,0.045,0.27),metal,skate,0.07,-0.16,0);
      const stopper=mesh(new THREE.CylinderGeometry(0.075,0.085,0.09,8),rubber,skate,0.38,-0.16,0);
      stopper.rotation.z=-0.25;
      const wheels=[];
      for(const x of [-0.14,0.27])for(const z of [-0.16,0.16]) {
        const pivot=new THREE.Group();pivot.position.set(x,-0.22,z);skate.add(pivot);
        const wheel=mesh(new THREE.CylinderGeometry(0.105,0.105,0.075,12),wheelMat,pivot);
        wheel.rotation.x=Math.PI/2;
        const hub=mesh(new THREE.CylinderGeometry(0.045,0.045,0.078,8),metal,pivot);
        hub.rotation.x=Math.PI/2;wheels.push(pivot);
      }
      return {side,thigh,shin,knee,skate,wheels};
    }
    function arm(side) {
      return {side,shoulder:sphere(0.16,jersey,bodyPivot,0,0,0),upper:segment(0.13,0.115,jersey,bodyPivot),
        forearm:segment(0.10,0.085,skin,bodyPivot),
        elbow:sphere(0.115,glove,bodyPivot,0,0,0),
        hand:mesh(new THREE.BoxGeometry(0.20,0.23,0.21),glove,bodyPivot)};
    }
    const leftLeg=leg(-1),rightLeg=leg(1),leftArm=arm(-1),rightArm=arm(1);
    const shaft=segment(0.038,0.043,wood,bodyPivot);
    const blade=mesh(new THREE.BoxGeometry(0.53,0.15,0.065),rubber,bodyPivot);
    const anim={phase:p.skatePhase||0,drive:0,lean:0,sway:0,celebrate:0,hit:0};
    // Proporcions més esveltes: una mica més alt i cap més petit.
    group.scale.setScalar(1.12);headGroup.scale.setScalar(0.86);
    scene.add(group);
    return {group,bodyPivot,upper,pelvis,headGroup,leftLeg,rightLeg,leftArm,rightArm,shaft,blade,ringMesh,ringMat,anim};
  }

  function fitVisualSegment(mesh, a, b) {
    const delta=new THREE.Vector3().subVectors(b,a);
    mesh.position.copy(a).addScaledVector(delta,0.5);
    mesh.scale.y=delta.length();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  }

  function visualJoint(a,b,upper,lower,bend) {
    const delta=new THREE.Vector3().subVectors(b,a),d=Math.max(0.001,Math.min(upper+lower-0.001,delta.length()));
    const axis=delta.normalize(),along=(upper*upper-lower*lower+d*d)/(2*d);
    const side=bend.clone().addScaledVector(axis,-bend.dot(axis)).normalize();
    return a.clone().addScaledVector(axis,along).addScaledVector(side,Math.sqrt(Math.max(0,upper*upper-along*along)));
  }

  // Gest de cada patinador segons la situació: joc, espera, aturada, gol o caiguda.
  function skaterGesture(p, hasBall) {
    if (p.fallTimer > 0) return 'fall';
    if (replayState.active) return 'play';
    const mode = state.mode, st = state.stoppage;
    if (mode === 'goal_celebration' && state.lastGoal) {
      if (state.lastGoal.team !== p.team) return 'dejected';
      const scorer = st && st.scorer;
      if (scorer && scorer !== p && Math.hypot(scorer.x - p.x, scorer.y - p.y) < 55) return 'hug';
      return 'celebrate';
    }
    if (mode === 'whistle_pause' && st) {
      if (st.offender === p) return st.type === 'card' ? 'dejected' : 'raiseHand';
      if (st.protesters && st.protesters.includes(p)) return st.t > 0.3 ? 'protest' : 'idle';
      return 'idle';
    }
    if (mode === 'halftime' || mode === 'finished') return 'idle';
    const waiting = mode === 'free_hit' || mode === 'kickoff' || (mode === 'direct_foul' && !state.setPieceReady) ||
      (mode === 'booling' && state.booling && state.booling.phase !== 'live');
    if (waiting && !hasBall && Math.hypot(p.vx, p.vy) < 0.5) return 'ready';
    return 'play';
  }

  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // Postura objectiu d'un gest (coordenades locals del jugador: x endavant, z costat, y amunt).
  function gesturePose(p, type, t) {
    const idx = (p.rosterIndex ?? p.idx) || 0;
    switch (type) {
      case 'idle': {
        const hip = 1.8 + Math.sin(t * 2.1 + idx) * 0.012;
        if (idx % 2 === 0) {
          const top = V3(0.62, hip + 0.92, 0.14);
          return { hip, lean: 0.12, roll: 0, twist: 0, headTilt: 0.04, top, blade: V3(1.0, 0.12, 0.22),
            lHand: top.clone().add(V3(0, 0.06, -0.09)), rHand: top.clone().add(V3(-0.02, -0.02, 0.09)) };
        }
        const rHand = V3(-0.02, hip + 0.6, 0.55);
        return { hip, lean: 0.06, roll: 0, twist: 0, headTilt: 0.02, top: rHand.clone(), blade: V3(0.75, 0.12, 1.0),
          lHand: V3(-0.04, hip + 0.6, -0.55), rHand };
      }
      case 'ready':
        return { hip: 1.5, lean: 0.36, roll: 0, twist: 0, headTilt: 0.2, top: V3(0.45, 2.0, 0.24), blade: V3(1.55, 0.13, 0.32) };
      case 'raiseHand': {
        const hip = 1.79, rHand = V3(0.25, hip + 0.72, 0.62);
        return { hip, lean: 0.05, roll: 0.04, twist: 0, headTilt: 0.06, top: rHand.clone(), blade: V3(1.0, 0.13, 0.95),
          lHand: V3(0.18, hip + 2.15, -0.4), rHand };
      }
      case 'protest': {
        const hip = 1.76, o = Math.sin(t * 6.5) * 0.18;
        const rHand = V3(0.62, hip + 1.2 - o, 1.02);
        return { hip, lean: 0.14, roll: 0, twist: Math.sin(t * 3) * 0.08, headTilt: 0.08, headShake: Math.sin(t * 8) * 0.25,
          top: rHand.clone(), blade: V3(1.05, hip + 0.45, 1.75), lHand: V3(0.68, hip + 1.2 + o, -1.02), rHand };
      }
      case 'celebrate': {
        const hip = 1.74, bounce = Math.abs(Math.sin(t * 7.5 + idx * 1.3)) * 0.2;
        if (idx % 3 === 0) {
          const top = V3(0.12, hip + 0.68 + bounce, 0.3);
          return { hip, lean: -0.14, roll: 0, twist: 0, headTilt: 0.32, top, blade: V3(0.3, hip + 1.9 + bounce, 0.8) };
        }
        if (idx % 3 === 1) {
          const pump = Math.max(0, Math.sin(t * 9 + idx)) * 0.32, rHand = V3(0.25, hip + 0.8, 0.62);
          return { hip, lean: -0.08, roll: 0.06, twist: 0.12, headTilt: 0.3, top: rHand.clone(), blade: V3(1.0, 0.25, 1.2),
            lHand: V3(0.28, hip + 1.75 + pump, -0.42), rHand };
        }
        const rHand = V3(0.12, hip + 1.95 + bounce * 0.5, 0.95);
        return { hip, lean: -0.16, roll: 0, twist: 0, headTilt: 0.36, top: rHand.clone(), blade: V3(0.55, hip + 2.95, 1.65),
          lHand: V3(0.12, hip + 1.95 + bounce * 0.5, -0.95), rHand };
      }
      case 'hug': {
        const hip = 1.7, rHand = V3(0.78, hip + 1.15, 0.3);
        return { hip, lean: 0.22, roll: 0, twist: 0, headTilt: 0.08, top: rHand.clone(), blade: V3(0.6, 0.15, 1.3),
          lHand: V3(0.82, hip + 1.2, -0.32), rHand };
      }
      case 'dejected': {
        const hip = 1.74, top = V3(0.62, hip + 0.55, 0.14);
        return { hip, lean: 0.48, roll: 0, twist: 0, headTilt: -0.42, headShake: Math.sin(t * 1.6) * 0.25,
          top, blade: V3(1.75, 0.12, 0.3), lHand: top.clone().add(V3(0, 0.05, -0.09)), rHand: top.clone().add(V3(-0.03, -0.03, 0.09)) };
      }
      case 'fall': {
        // 0–0,25 caiguda, 0,25–0,6 a terra, 0,6–1 s'aixeca.
        const u = Math.max(0, Math.min(1, 1 - p.fallTimer / 2));
        const down = u < 0.2 ? Math.sin(u / 0.2 * Math.PI / 2) : u < 0.62 ? 1 : 1 - (u - 0.62) / 0.38;
        const side = idx % 2 ? 1 : -1;
        return { hip: 1.75 - down * 0.55, lean: 0.25 + down * 0.35, roll: side * down * 1.25, twist: 0, headTilt: -0.1,
          top: V3(0.5, 2.1 - down * 0.4, 0.3), blade: V3(1.4, 0.13, 0.6 + down * 0.5), fallDrop: down,
          lHand: V3(0.5, 1.5 - down * 0.5, -0.9), rHand: null };
      }
      default:
        return null;
    }
  }

  function lerpPose(a, b, w) {
    if (!b || w <= 0.001) return a;
    const out = { ...a };
    for (const k of ['hip', 'lean', 'roll', 'twist', 'headTilt', 'headShake', 'fallDrop']) out[k] = (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * w;
    for (const k of ['top', 'blade', 'lHand', 'rHand']) out[k] = a[k].clone().lerp(b[k], w);
    return out;
  }

  const easeOut = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

  // Vector local (x endavant, z costat) cap a un punt del món de joc vist des d'un jugador.
  function toLocal(vis, x, y) {
    const dx = x - vis.x, dy = y - vis.y, c = Math.cos(vis.dir), sn = Math.sin(vis.dir);
    return { x: (dx * c + dy * sn) * S / 1.12, z: (-dx * sn + dy * c) * S / 1.12 };
  }

  function animateSkater(p,dt,hasBall,isControlled,ctx={}) {
    const r=p.rig,a=r.anim;
    const sp=ctx.speed??Math.hypot(p.vx,p.vy);
    const pushing=ctx.pushing??p.isPushing;
    const blend=1-Math.exp(-10*dt);
    a.time=(a.time||0)+dt;

    // ---------------- LOCOMOCIÓ ----------------
    const drive=pushing?Math.min(1,sp*0.5):0;
    a.drive+=(drive-a.drive)*blend;
    a.lean+=((0.16+Math.min(0.26,sp*0.08)+a.drive*0.08)-a.lean)*blend;
    a.sway+=((p.bankAngle||0)-a.sway)*blend;
    // Cadència: gambades llargues a velocitat, més curtes en arrencar.
    a.phase+=dt*(4.2+sp*1.5)*Math.max(a.drive,0.05)*(a.drive>0.05?1:0);
    // Frenada lateral (frenada d'hoquei) quan es perd velocitat de cop sense impulsar-se.
    const decel=dt>0?((a.prevSp??sp)-sp)/dt:0;
    a.prevSp=sp;
    const stopping=!pushing&&decel>1.6&&sp>0.6?1:0;
    a.stop=(a.stop||0)+(stopping-(a.stop||0))*(1-Math.exp(-(stopping?12:4)*dt));
    if(stopping&&!a.stopSide)a.stopSide=(p.idx%2?1:-1);
    if(a.stop<0.05)a.stopSide=0;
    const turn=Math.max(-1,Math.min(1,a.sway/0.2));

    // ---------------- TEMPORITZADORS D'ACCIONS ----------------
    let u=0,action=0;
    const va=p.visualAction;
    if(va) {
      va.remaining=Math.max(0,va.remaining-dt);
      u=1-va.remaining/va.duration;
      action=Math.sin(Math.PI*u);
      if(va.remaining<=0)p.visualAction=null;
    }
    if(p.receiveTimer>0)p.receiveTimer=Math.max(0,p.receiveTimer-dt);
    if(p.hitTimer>0)p.hitTimer=Math.max(0,p.hitTimer-dt);
    if(p.fallTimer>0)p.fallTimer=Math.max(0,p.fallTimer-dt);
    const receive=p.receiveTimer>0?Math.sin(Math.PI*(1-p.receiveTimer/0.22)):0;
    const hit=p.hitTimer>0?Math.sin(Math.PI*Math.min(1,1-p.hitTimer/0.45)):0;
    const poke=p.pokeTimer>0?Math.sin(Math.PI*Math.min(1,p.pokeTimer/0.34)):0;
    // Càrrega del xut: la de l'humà o la preparació del xut de la IA.
    let charge=0,swingSide=1;
    if(isControlled&&state.chargingShot&&hasBall){charge=state.shotCharge;swingSide=state.shotGesture==='cullera'?-1:1;}
    else if(p.pendingShot&&hasBall){
      const ps=p.pendingShot;charge=Math.min(1,(1-ps.timer/ps.duration)*1.15)*(0.55+ps.power*0.45);
      swingSide=ps.gesture==='cullera'?-1:1;
    }
    if(va&&va.gesture)swingSide=va.gesture==='cullera'?-1:1;
    const shield=hasBall?Math.max(-1,Math.min(1,p.shield||0)):0,shieldK=Math.abs(shield)>0.15?Math.min(1,(Math.abs(shield)-0.15)*1.5):0;
    const shieldSide=Math.sign(shield)||1;

    // ---------------- POSTURA DE JOC ----------------
    const hip=1.66-0.15*a.drive-0.05*Math.abs(turn)*a.drive-charge*0.16-receive*0.08-poke*0.12-shieldK*0.12-a.stop*0.18;
    let lean=a.lean+poke*0.28+charge*0.08+receive*0.06+shieldK*0.06-a.stop*0.32;
    let roll=a.sway*0.4+hit*0.3*((p.idx%2)?1:-1)+shieldK*shieldSide*0.22;
    let twist=0;
    let blade,top,lHand=null,rHand=null,oneHand=false;

    // Pala per defecte: estic baix davant, a punt.
    blade=V3(1.6,0.13,0.42);
    if(hasBall&&ctx.ballLocal) {
      // Conducció: la pala acompanya la bola amb petits tocs i el canell gira cap a on va.
      blade=V3(Math.max(0.9,Math.min(2.0,ctx.ballLocal.x-0.12)),0.13,Math.max(-0.95,Math.min(0.95,ctx.ballLocal.z)));
    } else if(ctx.receiveFrom) {
      // Receptor d'una passada: ofereix l'estic cap a la bola que arriba.
      const d=ctx.receiveFrom,len=Math.hypot(d.x,d.z)||1,reach=Math.min(2.05,Math.max(1.3,len));
      blade=V3(Math.max(0.6,d.x/len*reach),0.13,d.z/len*reach*0.8);
      lean+=0.08;
    } else if(ctx.defendBall) {
      // Defensa: estic a terra cap a la bola del rival, tancant la línia de passada.
      const d=ctx.defendBall,len=Math.hypot(d.x,d.z)||1,reach=Math.min(2.15,Math.max(1.4,len*0.75));
      blade=V3(Math.max(0.8,d.x/len*reach),0.12,d.z/len*reach*0.7);
      lean+=0.1;
    } else if(!hasBall&&a.drive>0.35) {
      // Patinant sense bola: estic a una mà, balancejant amb la gambada.
      oneHand=true;
      blade=V3(1.55,0.14+Math.max(0,Math.sin(a.phase))*0.05,0.75+Math.sin(a.phase)*0.12);
    }
    top=V3(0.32,hip+0.5,0.26);
    if(receive>0) blade.x-=receive*0.32;
    if(poke>0) { blade.lerp(V3(2.25,0.12,0.12),poke); top.lerp(V3(0.62,hip+0.35,0.2),poke); }

    if(charge>0) {
      // Preparació del xut: estic aixecat enrere fins a l'alçada de l'espatlla, tronc girat de costat.
      const c=easeOut(charge);
      blade.lerp(V3(-0.45*c,0.3+2.35*c,swingSide*(0.85+0.3*c)),Math.min(1,charge*1.5));
      top.lerp(V3(0.05,hip+0.8+0.35*c,swingSide*0.18),c);
      twist+=swingSide*0.95*c;
      lean+=0.06;
    }
    if(va&&va.type==='shot') {
      // Xut: baixada ràpida fins al cop (12 %) i acabament alt pel costat contrari.
      const pw=va.power??0.6,s=swingSide;
      const start=V3(-0.45*pw,0.3+2.35*pw,s*(0.85+0.3*pw)),contact=V3(1.5,0.12,s*0.3);
      const finish=V3(1.95,0.8+2.0*pw,-s*(0.55+0.35*pw));
      const topStart=V3(0.05,hip+0.8+0.35*pw,s*0.18),topContact=V3(0.5,hip+0.42,0.18),topFinish=V3(0.72,hip+1.1+0.3*pw,-s*0.25);
      if(u<0.12){const k=u/0.12;blade=start.lerp(contact,k*k);top=topStart.lerp(topContact,k);twist+=s*0.95*(1-k);}
      else {const k=easeOut((u-0.12)/0.5);blade=contact.lerp(finish,k);top=topContact.lerp(topFinish,k);twist-=s*0.6*k;lean+=0.12*(1-k);}
    } else if(va&&va.type==='pass') {
      // Passada: petita preparació, escombrada fins al cop (18 %) i acabament apuntant al company.
      const pw=va.power??0.5,s=va.side||1;
      const start=V3(0.5,0.3+0.35*pw,s*0.85),contact=V3(1.45,0.12,s*0.25),finish=V3(2.15,0.3+0.9*pw,-s*0.1);
      const topStart=V3(0.12,hip+0.68,s*0.12),topContact=V3(0.48,hip+0.42,0.18),topFinish=V3(0.75,hip+0.62,0.0);
      if(u<0.18){const k=u/0.18;blade=start.lerp(contact,k);top=topStart.lerp(topContact,k);twist+=s*0.45*(1-k);}
      else {const k=easeOut((u-0.18)/0.55);blade=contact.lerp(finish,k);top=topContact.lerp(topFinish,k);twist-=s*0.25*k;lean+=0.1*(1-k);}
    }

    // Protecció de la bola: cos i patí entre el rival i la bola, braç lliure de barrera.
    if(shieldK>0&&charge===0&&!va) {
      twist+=shieldSide*0.42*shieldK;
      if(shieldSide<0) {
        oneHand=true;
        lHand=V3(0.35,hip+0.95,-1.05).lerp(V3(0.1,hip+0.6,-0.7),1-shieldK);
      }
    }

    // Braç lliure quan no hi ha bola (balanceig contrari a les cames).
    if(oneHand&&!lHand) {
      const sw=Math.sin(a.phase)*a.drive;
      lHand=V3(-0.05+0.5*sw,hip+0.28+0.14*Math.abs(sw),-0.62-0.18*a.drive);
    }
    if(oneHand) { rHand=V3(0.3+0.1*Math.sin(a.phase)*a.drive,hip+0.55,0.6); top=rHand.clone(); }
    if(!lHand) lHand=top.clone();
    if(!rHand) rHand=top.clone().lerp(blade,0.3);
    // Contrarrotació de les espatlles amb la gambada.
    twist+=-(Math.sin(a.phase))*0.07*a.drive;
    const play={hip,lean,roll,twist,headTilt:a.lean*0.45,top,blade,lHand,rHand};

    // ---------------- GESTOS (aturades, celebracions, caigudes) ----------------
    const type=skaterGesture(p,hasBall);
    if(type!==a.gestureType){a.gestureType=type;a.gestureStart=a.time;if(type!=='play')a.lastGesture=type;}
    a.gw=(a.gw||0)+((type==='play'?0:1)-(a.gw||0))*(1-Math.exp(-(type==='fall'?14:6)*dt));
    const target=a.gw>0.01?gesturePose(p,type==='play'?a.lastGesture:type,a.time-(a.gestureStart||0)):null;
    if(target){target.lHand=target.lHand||target.top.clone();target.rHand=target.rHand||target.top.clone().lerp(target.blade,0.27);}
    const pose=lerpPose(play,target,a.gw);
    const playW=1-a.gw;

    // ---------------- APLICACIÓ AL COS ----------------
    const hipX=0.04;
    // Pes del cos sobre la cama de suport.
    const leftPush=Math.max(0,Math.sin(a.phase))*a.drive,rightPush=Math.max(0,-Math.sin(a.phase))*a.drive;
    const shift=(rightPush-leftPush)*0.11*playW;
    r.bodyPivot.position.y=(pose.fallDrop||0)*0.25;
    r.bodyPivot.rotation.x=pose.fallDrop?pose.roll:0;
    r.bodyPivot.rotation.z=0;
    r.pelvis.position.set(hipX,pose.hip,shift);
    r.pelvis.rotation.y=-(rightPush-leftPush)*0.12*playW;
    r.upper.position.set(hipX,pose.hip+0.03,shift);
    r.upper.rotation.set(pose.fallDrop?0:pose.roll,pose.twist,-pose.lean+a.stop*0.0);
    const look=Math.max(-1.1,Math.min(1.1,ctx.lookAngle||0));
    a.headYaw=(a.headYaw||0)+((-look*0.65-pose.twist*0.6*playW+(pose.headShake||0))-(a.headYaw||0))*(1-Math.exp(-8*dt));
    r.headGroup.rotation.set(0,a.headYaw,pose.lean*0.45+pose.headTilt-a.lean*0.45);

    for(const leg of [r.leftLeg,r.rightLeg]) {
      // Cicle de cada cama: empenta cap enfora i enrere, recuperació aixecada per sota del cos.
      const phi=a.phase+(leg.side<0?0:Math.PI);
      const ext=(1-Math.cos(phi))/2*a.drive*playW;
      const recov=Math.max(0,-Math.sin(phi))*a.drive*playW;
      const pushNow=Math.max(0,Math.sin(phi))*a.drive*playW;
      let fx=0.1-0.48*ext+0.2*recov,fy=0.325+0.17*recov,fz=leg.side*(0.31+0.55*ext);
      // Encreuament als girs: la cama de fora passa per davant de la de dins.
      const outside=turn!==0&&leg.side===-Math.sign(turn);
      if(outside&&Math.abs(turn)>0.3&&a.drive>0.3) {
        const k=recov*Math.min(1,(Math.abs(turn)-0.3)*1.6);
        fz+=(Math.sign(turn)*0.32-fz)*k;fx+=0.18*k;fy+=0.06*k;
      }
      // Lliscament: peus paral·lels, el de dins del gir una mica avançat.
      if(a.drive<0.3) fx+=(leg.side===Math.sign(turn)?0.12:-0.05)*Math.abs(turn)*(1-a.drive/0.3);
      // Frenada lateral: patins de costat, cames obertes.
      if(a.stop>0.01) {
        const sd=a.stopSide||1,front=leg.side===sd;
        fx+=((front?0.35:-0.25)-fx)*a.stop;fz+=((leg.side*0.42)-fz)*a.stop;fy+=(0.325-fy)*a.stop;
      }
      // Protecció: el patí del costat del rival fa de barrera.
      if(shieldK>0&&leg.side===shieldSide) { fz+=leg.side*0.3*shieldK*playW;fx+=0.12*shieldK*playW; }
      // Estocada d'entrada i base ampla en carregar.
      if(leg.side<0) fx+=poke*0.45;
      fz+=leg.side*(charge*0.16+(pose.fallDrop?0:0));
      const gestureStance=a.gw*(type==='ready'?0.16:0.04);
      fz+=leg.side*gestureStance;
      const foot=V3(fx,fy,fz);
      const hipJoint=V3(hipX,pose.hip,leg.side*0.29+shift);
      const knee=visualJoint(hipJoint,foot,0.78,0.79,V3(1,0,leg.side*0.25));
      fitVisualSegment(leg.thigh,hipJoint,knee);fitVisualSegment(leg.shin,knee,foot);
      leg.ik={hip:hipJoint,knee,foot};
      leg.knee.position.copy(knee);leg.knee.position.x+=0.10;
      leg.skate.position.copy(foot);
      // Punta cap enfora en empènyer, cantell interior a terra, patins de costat en frenar.
      let yaw=-leg.side*(0.05+0.5*ext*(1-recov*0.6));
      if(a.stop>0.01) yaw+=((a.stopSide||1)*1.35-yaw)*a.stop;
      if(shieldK>0&&leg.side===shieldSide) yaw-=leg.side*0.35*shieldK;
      leg.skate.rotation.set(leg.side*0.22*pushNow+(a.stop>0.01?-(a.stopSide||1)*0.18*a.stop:0),yaw,-0.12*recov);
      for(const wheel of leg.wheels)wheel.rotation.z-=sp*S*60*dt/0.105*(1-recov*0.8);
    }

    fitVisualSegment(r.shaft,pose.top,pose.blade);
    r.blade.position.copy(pose.blade);
    const bladeYaw=hasBall&&ctx.ballLocal?-0.15-ctx.ballLocal.z*0.45:-0.15;
    r.blade.rotation.set(0,bladeYaw*playW+swingSide*(charge*0.7-action*0.6)*playW,charge*0.5*playW);
    const upperRot=r.upper.rotation;
    for(const arm of [r.leftArm,r.rightArm]) {
      const shoulder=V3(0.06,1.09,arm.side*0.55).applyEuler(upperRot).add(r.upper.position);
      const hand=arm.side<0?pose.lHand:pose.rHand;
      arm.shoulder.position.copy(shoulder);
      const elbow=visualJoint(shoulder,hand,0.64,0.66,V3(-0.4,-0.2,arm.side));
      fitVisualSegment(arm.upper,shoulder,elbow);fitVisualSegment(arm.forearm,elbow,hand);
      arm.ik={shoulder,elbow,hand};
      arm.elbow.position.copy(elbow);arm.hand.position.copy(hand);
      arm.hand.rotation.z=-0.3;
    }
  }

  function calibrateSceneMaterials() {
    Object.values(courtTextures).forEach(tex=>{tex.encoding=THREE.sRGBEncoding;tex.needsUpdate=true;});
    const materials=new Set();
    scene.traverse(object=>{
      for(const mat of Array.isArray(object.material)?object.material:object.material?[object.material]:[]) {
        if(materials.has(mat))continue;
        materials.add(mat);
        if(mat.color)mat.color.convertSRGBToLinear();
        if(mat.map) { mat.map.encoding=THREE.sRGBEncoding;mat.map.needsUpdate=true; }
      }
    });
  }

  function emitFx(type, data = {}) {
    fxEvents.push({ type, ...data });
    if (fxEvents.length > 48) fxEvents.shift();
  }

  function snapshotForReplay(p) {
    return { ref: p, x: p.x, y: p.y, dir: p.dir || 0, vx: p.vx || 0, vy: p.vy || 0, isPushing: !!p.isPushing,
      bankAngle: p.bankAngle || 0, gkPosture: p.gkPosture, pokeTimer: p.pokeTimer || 0, stickPhase: p.stickPhase || 0,
      visualAction: p.visualAction ? { ...p.visualAction } : null };
  }

  // Memòria circular de les últimes jugades per a la repetició del gol.
  function recordReplayFrame() {
    if (replayState.active) return;
    const recording = ['match','direct_foul','kickoff','free_hit'].includes(state.mode) ||
      (state.mode === 'goal_celebration' && replayState.goalIndex >= 0 && replayState.frames.length - replayState.goalIndex < 40);
    if (!recording) return;
    const ents = [];
    for (const p of players) ents.push(snapshotForReplay(p));
    for (const r of referees) ents.push(snapshotForReplay(r));
    replayState.frames.push({ ball: [ball.x, ball.y, ball.z, ball.owner], ents });
    if (replayState.frames.length > 260) {
      replayState.frames.shift();
      if (replayState.goalIndex > 0) replayState.goalIndex--;
    }
  }

  function captureRenderPoses() {
    for(const p of [...allPlayers(),...referees,ball])p.renderPrevious={x:p.x,y:p.y,z:p===ball?p.z:0,dir:p.dir||0};
  }

  function interpolatedPose(p,alpha) {
    const prev=p.renderPrevious;
    if(!prev||Math.hypot(p.x-prev.x,p.y-prev.y)>2*METRE)return {x:p.x,y:p.y,z:p.z||0,dir:p.dir||0};
    return {x:prev.x+(p.x-prev.x)*alpha,y:prev.y+(p.y-prev.y)*alpha,
      z:prev.z+((p.z||0)-prev.z)*alpha,dir:prev.dir+normalizeAngle((p.dir||0)-prev.dir)*alpha};
  }

  function goalkeeperPose(posture) {
    const poses={
      screen:{hip:1.42,lean:0.16,feet:[0,0.325,-0.46,0,0.325,0.46],pads:[-0.08,0.08],tilt:[0,0],glove:[0.62,1.70,-0.72],grip:[0.70,1.30,0.49]},
      out:{hip:1.51,lean:0.24,feet:[0.03,0.325,-0.65,0.03,0.325,0.65],pads:[-0.20,0.20],tilt:[0,0],glove:[0.69,2.00,-0.91],grip:[0.76,1.47,0.72]},
      knee:{hip:0.86,lean:0.21,feet:[-0.50,0.325,-0.50,0.24,0.325,0.52],pads:[-0.20,0.12],tilt:[-1.24,0],glove:[0.69,1.57,-0.74],grip:[0.77,1.11,0.48]},
      valla:{hip:0.94,lean:0.29,feet:[0.02,0.325,-0.43,0.12,0.325,0.42],pads:[-0.15,1.30],tilt:[0,0],glove:[0.75,1.39,-0.64],grip:[0.86,0.96,0.39]}
    };
    return poses[posture]||poses.screen;
  }

  function blendGoalkeeperPose(current,target,dt) {
    const t=1-Math.exp(-11*Math.max(0,dt));
    for(const key of Object.keys(target)) {
      if(Array.isArray(target[key]))current[key]=target[key].map((v,i)=>current[key][i]+(v-current[key][i])*t);
      else current[key]+=(target[key]-current[key])*t;
    }
    return current;
  }

  function buildGoalkeeper3DMesh(p,team) {
    const group=new THREE.Group(),bodyPivot=new THREE.Group();group.add(bodyPivot);
    const mat=(color,roughness=0.8)=>new THREE.MeshStandardMaterial({color,roughness});
    const fabric=mat(team.gkColor),pants=mat(0x192633),white=mat(0xe4e5df,0.72);
    const trim=mat(team.primary),black=mat(0x17212a,0.62),leather=mat(0x263441,0.75);
    const metal=new THREE.MeshStandardMaterial({color:0xaeb9c0,metalness:0.7,roughness:0.32});
    const wood=mat(0xb18e58),wheelMat=mat(0xc9bfab),skin=mat(team.skin),stitch=mat(0xb8bec0,0.92);
    const mesh=(geo,material,parent,x=0,y=0,z=0)=>{
      const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);
      m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
    };
    const sphere=(radius,material,parent,x=0,y=0,z=0)=>mesh(new THREE.SphereGeometry(radius,14,10),material,parent,x,y,z);
    const segment=(r1,r2,material,parent)=>mesh(new THREE.CylinderGeometry(r1,r2,1,12),material,parent);
    // Rounded protection profile extruded along X, with a soft stitched edge.
    function protection(width,height,depth,material,parent,x=0,y=0,z=0,radius=0.09) {
      const w=width/2,h=height/2,r=Math.min(radius,w,h),shape=new THREE.Shape();
      shape.moveTo(-w+r,-h);shape.lineTo(w-r,-h);shape.quadraticCurveTo(w,-h,w,-h+r);
      shape.lineTo(w,h-r);shape.quadraticCurveTo(w,h,w-r,h);shape.lineTo(-w+r,h);
      shape.quadraticCurveTo(-w,h,-w,h-r);shape.lineTo(-w,-h+r);shape.quadraticCurveTo(-w,-h,-w+r,-h);
      const geo=new THREE.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:4,bevelEnabled:true,
        bevelThickness:0.025,bevelSize:0.025,bevelSegments:2});
      geo.translate(0,0,-depth/2);geo.rotateY(Math.PI/2);
      return mesh(geo,material,parent,x,y,z);
    }
    const ringMat=new THREE.MeshBasicMaterial({color:0x38bdf8,side:THREE.DoubleSide,transparent:true,opacity:0});
    const ringMesh=mesh(new THREE.RingGeometry(1.35,1.53,40),ringMat,group,0,0.035,0);
    ringMesh.rotation.x=-Math.PI/2;ringMesh.castShadow=false;
    const pelvis=mesh(new THREE.CylinderGeometry(0.48,0.40,0.45,14),pants,bodyPivot);
    pelvis.scale.set(0.77,1,1.08);
    const upper=new THREE.Group();bodyPivot.add(upper);
    const jerseyTex=createJerseyTexture({...team,primary:team.gkColor,secondary:team.gkColor},p.num);
    const jersey=new THREE.MeshStandardMaterial({map:jerseyTex,roughness:0.92});
    const chest=mesh(new THREE.SphereGeometry(1,18,12),jersey,upper,0,0.58,0);
    chest.scale.set(0.42,0.64,0.68);
    const neck=mesh(new THREE.CylinderGeometry(0.18,0.20,0.20,10),black,upper,0,1.12,0);
    const headGroup=new THREE.Group();headGroup.position.set(0,1.42,0);upper.add(headGroup);
    const helmet=sphere(0.38,trim,headGroup);helmet.scale.set(1.02,1.10,0.98);
    const face=sphere(0.28,skin,headGroup,0.20,-0.025,0);face.scale.set(0.55,0.88,0.88);
    const opening=sphere(0.25,black,headGroup,0.345,0.005,0);opening.scale.set(0.16,0.78,1.03);
    protection(0.41,0.16,0.19,white,headGroup,0.29,-0.27,0,0.06);
    const cage=new THREE.Group();headGroup.add(cage);
    // Open metal face cage: bars, not an opaque box covering the head.
    for(const y of [-0.12,0.01,0.14]) {
      const bar=segment(0.014,0.014,metal,cage);
      fitVisualSegment(bar,new THREE.Vector3(0.43,y,-0.25),new THREE.Vector3(0.43,y,0.25));
    }
    for(const z of [-0.22,0,0.22]) {
      const bar=segment(0.012,0.012,metal,cage);
      fitVisualSegment(bar,new THREE.Vector3(0.435,-0.21,z),new THREE.Vector3(0.415,0.21,z));
    }
    // Compact shoulder caps and two-link arms lead all the way to the gloves.
    function arm(side) {
      const shoulder=sphere(0.22,fabric,bodyPivot);shoulder.scale.set(0.9,0.85,1);
      const hand=new THREE.Group();bodyPivot.add(hand);
      if(side<0) {
        protection(0.48,0.62,0.16,white,hand,0.06,0,0,0.12);
        protection(0.34,0.38,0.18,leather,hand,0.09,-0.01,0,0.09);
        sphere(0.12,leather,hand,-0.02,-0.16,0.20);
      } else {
        protection(0.29,0.30,0.23,leather,hand,0,0,0,0.09);
        protection(0.25,0.12,0.25,white,hand,-0.015,0.13,0,0.04);
      }
      return {side,shoulder,upper:segment(0.17,0.14,fabric,bodyPivot),
        forearm:segment(0.14,0.12,fabric,bodyPivot),elbow:sphere(0.16,leather,bodyPivot),hand};
    }
    function leg(side) {
      const skate=new THREE.Group();bodyPivot.add(skate);
      const shoe=sphere(1,black,skate,0.06,0,0);shoe.scale.set(0.34,0.15,0.18);
      mesh(new THREE.BoxGeometry(0.55,0.045,0.29),metal,skate,0.06,-0.16,0);
      const wheels=[];
      for(const x of [-0.14,0.25])for(const z of [-0.18,0.18]) {
        const pivot=new THREE.Group();pivot.position.set(x,-0.22,z);skate.add(pivot);
        const wheel=mesh(new THREE.CylinderGeometry(0.105,0.105,0.08,12),wheelMat,pivot);wheel.rotation.x=Math.PI/2;
        const hub=mesh(new THREE.CylinderGeometry(0.04,0.04,0.085,8),metal,pivot);hub.rotation.x=Math.PI/2;
        wheels.push(pivot);
      }
      const pad=new THREE.Group();bodyPivot.add(pad);
      protection(0.57,1.17,0.27,white,pad,0.14,0.56,0,0.13);
      for(const y of [0.25,0.51,0.77,1.00])protection(0.49,0.012,0.01,stitch,pad,0.301,y,0,0.006);
      protection(0.12,0.94,0.025,trim,pad,0.303,0.58,-0.20,0.03);
      pad.updateMatrixWorld(true);
      const restBounds=new THREE.Box3().setFromObject(pad);
      return {side,skate,pad,wheels,restBounds,rotatedBounds:restBounds.clone(),padRotation:new THREE.Matrix4(),
        thigh:segment(0.23,0.19,pants,bodyPivot),shin:segment(0.16,0.12,black,bodyPivot)};
    }
    const leftLeg=leg(-1),rightLeg=leg(1),leftArm=arm(-1),rightArm=arm(1);
    const shaft=segment(0.036,0.043,wood,bodyPivot);
    const blade=protection(0.70,0.14,0.075,black,bodyPivot,0,0,0,0.045);
    const anim={pose:JSON.parse(JSON.stringify(goalkeeperPose('screen'))),lastX:p.x,lastY:p.y,shuffle:0,wheel:0};
    group.scale.setScalar(1.12);
    scene.add(group);
    return {group,bodyPivot,pelvis,upper,chest,neck,headGroup,cage,leftLeg,rightLeg,leftArm,rightArm,shaft,blade,ringMesh,ringMat,anim};
  }

  function animateGoalkeeper(p,dt) {
    const r=p.rig,a=r.anim;
    a.time=(a.time||0)+dt;
    const goal=state.mode==='goal_celebration'&&state.lastGoal&&!replayState.active?state.lastGoal:null;
    const mood=goal?(goal.team===p.team?'celebrate':'frustrated'):null;
    if(mood!==a.mood){a.mood=mood;a.moodStart=a.time;}
    const moodT=a.time-(a.moodStart||0);
    const posture=mood==='frustrated'&&moodT<1.6?'knee':mood?'screen':p.gkPosture;
    const pose=blendGoalkeeperPose(a.pose,goalkeeperPose(posture),dt);
    const dx=p.x-a.lastX,dy=p.y-a.lastY,distance=Math.hypot(dx,dy);
    const lateral=dt>0?Math.max(-1,Math.min(1,(-Math.sin(p.dir)*dx+Math.cos(p.dir)*dy)/(dt*60))):0;
    a.lateral=(a.lateral||0)+(lateral-(a.lateral||0))*(1-Math.exp(-10*dt));
    const moving=distance<2*METRE&&dt>0?Math.min(1,distance/(dt*60)):0;
    a.shuffle+=(moving-a.shuffle)*(1-Math.exp(-10*dt));
    if(dt>0) {a.lastX=p.x;a.lastY=p.y;a.wheel+=distance*S/0.105;}
    r.pelvis.position.set(0,pose.hip,0);r.upper.position.set(0.02,pose.hip+0.02,0);
    r.upper.rotation.z=-pose.lean;
    r.upper.rotation.x=-a.lateral*0.12;
    r.headGroup.rotation.z=pose.lean*0.48;
    const angle=normalizeAngle(Math.atan2(ball.y-p.y,ball.x-p.x)-p.dir);
    r.headGroup.rotation.y=-Math.max(-0.28,Math.min(0.28,angle))*0.6;
    for(const [i,leg] of [r.leftLeg,r.rightLeg].entries()) {
      const foot=new THREE.Vector3(...pose.feet.slice(i*3,i*3+3));
      const hip=new THREE.Vector3(0,pose.hip,leg.side*0.30);
      const knee=visualJoint(hip,foot,0.67,0.70,new THREE.Vector3(1,0,0));
      fitVisualSegment(leg.thigh,hip,knee);fitVisualSegment(leg.shin,knee,foot);
      leg.ik={hip,knee,foot};
      leg.skate.position.copy(foot);leg.skate.rotation.y=-leg.side*(0.08+a.shuffle*0.08);
      leg.pad.position.copy(foot);leg.pad.rotation.x=pose.pads[i];leg.pad.rotation.z=pose.tilt[i];
      // Keep the entire rounded protection above the floor throughout a save,
      // including the stitched edge while rotating into a kneeling posture.
      leg.padRotation.makeRotationFromEuler(leg.pad.rotation);
      leg.rotatedBounds.copy(leg.restBounds).applyMatrix4(leg.padRotation);
      leg.pad.position.y=Math.max(foot.y,0.008-leg.rotatedBounds.min.y);
      for(const wheel of leg.wheels)wheel.rotation.z=-a.wheel;
    }
    const glove=new THREE.Vector3(...pose.glove),grip=new THREE.Vector3(...pose.grip);
    let blade=new THREE.Vector3(0.98,0.13,0.08);
    // Reacció d'aturada: estirada cap al costat de la bola (guant o estic).
    if(p.saveAnim&&p.saveAnim.timer>0) {
      p.saveAnim.timer=Math.max(0,p.saveAnim.timer-dt);
      const k=Math.sin(Math.PI*(1-p.saveAnim.timer/p.saveAnim.duration)),side=p.saveAnim.side;
      r.upper.rotation.x+=side*k*0.38;
      if(side<0) glove.lerp(new THREE.Vector3(0.55,pose.hip+(p.saveAnim.high?1.3:0.35),-1.25),k);
      else { grip.lerp(new THREE.Vector3(0.6,pose.hip+(p.saveAnim.high?1.1:0.3),1.15),k); blade.lerp(new THREE.Vector3(0.9,0.13,1.5),k); }
    }
    if(mood==='celebrate') {
      const pump=Math.abs(Math.sin(moodT*7))*0.15;
      glove.lerp(new THREE.Vector3(0.3,pose.hip+1.75+pump,-0.75),Math.min(1,moodT*4));
      grip.lerp(new THREE.Vector3(0.3,pose.hip+1.75+pump,0.75),Math.min(1,moodT*4));
      blade=blade.lerp(new THREE.Vector3(0.7,pose.hip+2.6,1.3),Math.min(1,moodT*4));
    } else if(mood==='frustrated') {
      r.headGroup.rotation.z-=0.45;
      if(moodT>1.6){ const tap=Math.max(0,Math.sin(moodT*6))*0.25; grip.y-=tap; blade.y+=tap*0.4; }
    }
    fitVisualSegment(r.shaft,mood==='celebrate'?grip.clone():grip.clone().add(new THREE.Vector3(-0.10,0.22,0.08)),blade);
    r.blade.position.copy(blade);r.blade.rotation.y=0.15;
    for(const arm of [r.leftArm,r.rightArm]) {
      const shoulder=new THREE.Vector3(0.10+pose.lean*0.6,pose.hip+0.92,arm.side*0.60);
      const hand=arm.side<0?glove:grip;
      const elbow=visualJoint(shoulder,hand,0.67,0.69,new THREE.Vector3(-0.6,0,arm.side));
      arm.shoulder.position.copy(shoulder);fitVisualSegment(arm.upper,shoulder,elbow);
      fitVisualSegment(arm.forearm,elbow,hand);arm.elbow.position.copy(elbow);arm.hand.position.copy(hand);
      arm.ik={shoulder,elbow,hand:hand.clone().add(new THREE.Vector3(-0.1,0,0))};
      arm.hand.rotation.z=arm.side<0?-0.14:0.20;
      arm.hand.rotation.y=arm.side<0?-0.12:0;
    }
  }

  function createRefereeJerseyTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');

    // Uniforme oficial d'àrbitre OK Liga / WSE: groc fluor amb espatlles i detalls negres
    g.fillStyle = '#facc15';
    g.fillRect(0, 0, 256, 256);

    g.fillStyle = '#0f172a';
    g.fillRect(0, 0, 256, 38);
    g.fillRect(24, 38, 16, 218);
    g.fillRect(216, 38, 16, 218);

    // Cordill i xiulet al pit + insígnia RFEP
    g.strokeStyle = '#0f172a';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(96, 36);
    g.lineTo(128, 110);
    g.lineTo(160, 36);
    g.stroke();

    g.fillStyle = '#0f172a';
    g.font = '900 34px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('RFEP', 128, 148);

    return new THREE.CanvasTexture(c);
  }

  // Àrbitre articulat (mateix sistema de cinemàtica inversa que els jugadors) amb gestos reglamentaris.
  function buildReferee3DMesh(ref) {
    const group=new THREE.Group(),bodyPivot=new THREE.Group();group.add(bodyPivot);
    bodyPivot.rotation.order='YXZ';
    const mat=(color,roughness=0.75)=>new THREE.MeshStandardMaterial({color,roughness});
    const shirtTex=createRefereeJerseyTexture();shirtTex.encoding=THREE.sRGBEncoding;
    const shirt=new THREE.MeshStandardMaterial({map:shirtTex,roughness:0.65});
    const sleeve=mat(0xfacc15,0.65),trousers=mat(0x14171c,0.7),skin=mat(0xe8b98f,0.8);
    const boot=mat(0x111317,0.55),wheelMat=mat(0xd8c8a5,0.7);
    const metal=new THREE.MeshStandardMaterial({color:0x9aa4ae,metalness:0.7,roughness:0.3});
    const hairMat=mat(ref.id===0?0x1e1b18:0x4a3426,0.85);
    const mesh=(geo,material,parent,x=0,y=0,z=0)=>{
      const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
    };
    const sphere=(radius,material,parent,x=0,y=0,z=0)=>mesh(new THREE.SphereGeometry(radius,12,10),material,parent,x,y,z);
    const segment=(r1,r2,material,parent)=>mesh(new THREE.CylinderGeometry(r1,r2,1,10),material,parent);
    const pelvis=mesh(new THREE.CylinderGeometry(0.44,0.39,0.5,12),trousers,bodyPivot);pelvis.scale.set(0.7,1,1);
    const upper=new THREE.Group();bodyPivot.add(upper);
    const torso=mesh(new THREE.CylinderGeometry(0.58,0.42,1.16,16),shirt,upper,0,0.66,0);torso.scale.set(0.64,1,1.05);
    mesh(new THREE.CylinderGeometry(0.14,0.16,0.22,10),skin,upper,0,1.32,0);
    // Xiulet penjat del coll.
    const whistle=mesh(new THREE.BoxGeometry(0.1,0.08,0.16),metal,upper,0.38,0.95,0.08);
    const headGroup=new THREE.Group();headGroup.position.set(0,1.64,0);upper.add(headGroup);
    const head=sphere(0.31,skin,headGroup);head.scale.set(0.92,1.1,0.9);
    mesh(new THREE.SphereGeometry(0.315,12,8,0,Math.PI*2,0,Math.PI*0.48),hairMat,headGroup,-0.03,0.07,0);
    const nose=sphere(0.05,skin,headGroup,0.29,0,0);nose.scale.set(1.1,1,0.7);
    [-0.11,0.11].forEach(z=>sphere(0.022,mat(0x242323),headGroup,0.28,0.07,z));
    [-0.29,0.29].forEach(z=>sphere(0.055,skin,headGroup,0,-0.01,z));
    function leg(side) {
      const thigh=segment(0.19,0.155,trousers,bodyPivot),shin=segment(0.15,0.12,trousers,bodyPivot);
      const knee=sphere(0.16,trousers,bodyPivot);
      const skate=new THREE.Group();bodyPivot.add(skate);
      const shoe=sphere(1,boot,skate,0.08,0,0);shoe.scale.set(0.34,0.15,0.15);
      mesh(new THREE.BoxGeometry(0.54,0.045,0.27),metal,skate,0.07,-0.16,0);
      const wheels=[];
      for(const x of [-0.14,0.27])for(const z of [-0.16,0.16]) {
        const pivot=new THREE.Group();pivot.position.set(x,-0.22,z);skate.add(pivot);
        const wheel=mesh(new THREE.CylinderGeometry(0.105,0.105,0.075,12),wheelMat,pivot);wheel.rotation.x=Math.PI/2;
        wheels.push(pivot);
      }
      return {side,thigh,shin,knee,skate,wheels};
    }
    function arm(side) {
      return {side,shoulder:sphere(0.17,sleeve,bodyPivot),upper:segment(0.13,0.115,sleeve,bodyPivot),
        forearm:segment(0.105,0.09,sleeve,bodyPivot),elbow:sphere(0.11,sleeve,bodyPivot),hand:sphere(0.12,skin,bodyPivot)};
    }
    const leftLeg=leg(-1),rightLeg=leg(1),leftArm=arm(-1),rightArm=arm(1);
    const cardMat=new THREE.MeshBasicMaterial({color:0x2563eb});
    const card=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.42,0.3),cardMat);card.visible=false;bodyPivot.add(card);
    group.scale.setScalar(1.12);
    scene.add(group);
    return {group,bodyPivot,upper,pelvis,headGroup,whistle,leftLeg,rightLeg,leftArm,rightArm,card,cardMat,
      anim:{phase:ref.skatePhase||0,drive:0,lean:0,time:0,gesture:'',gestureStart:0}};
  }

  // Vector local (x endavant, z costat) cap a un angle del món de joc.
  function localDirection(fromDir, worldAngle) {
    const rel=normalizeAngle(worldAngle-fromDir);
    return V3(Math.cos(rel),0,Math.sin(rel));
  }

  function animateReferee(ref,dt,ctx={}) {
    const r=ref.rig,a=r.anim;
    const sp=ctx.speed??Math.hypot(ref.vx,ref.vy);
    const blend=1-Math.exp(-10*dt);
    a.time+=dt;
    a.drive+=((ref.isPushing||sp>0.4?Math.min(1,sp*0.6):0)-a.drive)*blend;
    a.lean+=((0.12+Math.min(0.2,sp*0.06))-a.lean)*blend;
    a.phase+=dt*(4.5+sp*1.6)*a.drive;
    const wave=Math.sin(a.phase),left=Math.max(0,wave)*a.drive,right=Math.max(0,-wave)*a.drive;
    const hip=1.72-0.08*a.drive,hipX=0.04;

    // Gest segons el senyal.
    const signal=ref.signalTimer>0?ref.signalType:null;
    const elapsed=signal?(ref.signalDuration||2.6)-ref.signalTimer:0;
    let gesture='skate';
    if(signal==='blue_card'||signal==='warning_card') gesture=elapsed<0.45?'whistle':'card';
    else if(signal==='goal') gesture=elapsed<0.4?'whistle':'goal';
    else if(signal==='booling') gesture=elapsed<0.4?'whistle':'booling';
    else if(signal==='prepare') gesture='armUp';
    else if(signal) gesture=elapsed<0.55?'whistle':'point';
    if(gesture!==a.gesture){a.gesture=gesture;a.gestureStart=a.time;}

    const st=state.stoppage;
    // Direcció que assenyala: cap on ataca l'equip que treu la falta.
    let pointAngle=ref.dir;
    if(st&&st.team&&(gesture==='point'||gesture==='card')) {
      if(st.restart==='penalty'||st.restart==='direct_foul') {
        const gx=opponentGoalX(st.team),sign=attackDirection(st.team);
        const spotX=gx-sign*(st.restart==='penalty'?RINK.penaltyDistance:RINK.directDistance);
        pointAngle=Math.atan2(RINK.h/2-ref.y,spotX-ref.x);
      } else pointAngle=attackDirection(st.team)>0?0:Math.PI;
    }
    if(gesture==='goal') pointAngle=Math.atan2(RINK.h/2-ref.y,RINK.w/2-ref.x);

    r.pelvis.position.set(hipX,hip,(right-left)*0.06);
    r.upper.position.set(hipX,hip+0.03,(right-left)*0.06);
    r.upper.rotation.set((ref.bankAngle||0)*0.3,(right-left)*0.04,-(gesture==='skate'?a.lean:0.06));
    const lookTarget=ctx.lookAngle||0;
    a.headYaw=(a.headYaw||0)+((-Math.max(-1,Math.min(1,lookTarget))*0.7)-(a.headYaw||0))*(1-Math.exp(-8*dt));
    r.headGroup.rotation.set(0,a.headYaw,a.lean*0.4);

    for(const leg of [r.leftLeg,r.rightLeg]) {
      const push=leg.side<0?left:right;
      const recovery=Math.max(0,-Math.cos(a.phase)*(leg.side<0?1:-1))*push;
      const foot=V3(-0.28*push,0.325+0.05*recovery,leg.side*(0.36+0.44*push));
      const hipJoint=V3(hipX,hip,leg.side*0.28);
      const knee=visualJoint(hipJoint,foot,0.78,0.79,V3(1,0,0));
      fitVisualSegment(leg.thigh,hipJoint,knee);fitVisualSegment(leg.shin,knee,foot);
      leg.ik={hip:hipJoint,knee,foot};
      leg.knee.position.copy(knee);leg.knee.position.x+=0.08;
      leg.skate.position.copy(foot);leg.skate.rotation.y=-leg.side*(0.06+push*0.22);
      for(const wheel of leg.wheels)wheel.rotation.z-=sp*S*60*dt/0.105;
    }

    const shoulderOf=side=>V3(0.06,1.09,side*0.55).applyEuler(r.upper.rotation).add(r.upper.position);
    const restHand=side=>V3(-0.1+(side<0?wave:-wave)*a.drive*0.25,hip+0.25,side*0.68);
    const t=a.time-a.gestureStart,ease=Math.min(1,t/0.22);
    let lh=restHand(-1),rh=restHand(1);
    const mouth=V3(0.42,hip+1.55,0.06);
    if(gesture==='whistle') rh=rh.lerp(mouth,ease);
    else if(gesture==='point') {
      const d=localDirection(ref.dir,pointAngle);
      rh=rh.lerp(shoulderOf(1).add(d.multiplyScalar(1.25)).add(V3(0,0.05,0)),ease);
    } else if(gesture==='card') {
      rh=rh.lerp(shoulderOf(1).add(V3(0.15,1.22,0.08)),ease);
      if(ref.targetPlayer) {
        const d=localDirection(ref.dir,Math.atan2(ref.targetPlayer.y-ref.y,ref.targetPlayer.x-ref.x));
        lh=lh.lerp(shoulderOf(-1).add(d.multiplyScalar(1.2)),ease);
      }
    } else if(gesture==='goal') {
      const d=localDirection(ref.dir,pointAngle);
      rh=rh.lerp(shoulderOf(1).add(d.multiplyScalar(1.22)),ease);
    } else if(gesture==='booling') {
      lh=lh.lerp(shoulderOf(-1).add(V3(0.2,1.15,0.25)),ease);
      rh=rh.lerp(shoulderOf(1).add(V3(0.2,1.15,-0.25)),ease);
    } else if(gesture==='armUp') {
      rh=rh.lerp(shoulderOf(1).add(V3(0.1,1.24,0)),ease);
    }
    for(const [arm,hand] of [[r.leftArm,lh],[r.rightArm,rh]]) {
      const shoulder=shoulderOf(arm.side);
      arm.shoulder.position.copy(shoulder);
      const elbow=visualJoint(shoulder,hand,0.64,0.66,V3(-0.3,-0.4,arm.side));
      fitVisualSegment(arm.upper,shoulder,elbow);fitVisualSegment(arm.forearm,elbow,hand);
      arm.ik={shoulder,elbow,hand};
      arm.elbow.position.copy(elbow);arm.hand.position.copy(hand);
    }
    r.card.visible=gesture==='card';
    if(r.card.visible) {
      r.card.position.copy(rh).add(V3(0.02,0.24,0));
      r.cardMat.color.setHex(signal==='blue_card'?(state.cardEvent?.type==='red'?0xdc2626:0x2563eb):0xfacc15);
    }
  }

  function buildBall3DMesh() {
    const geo = new THREE.SphereGeometry(ball.radius*S, 18, 18);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.18,
      metalness: 0.15
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  }

  let aimReticleMesh = null;
  function buildAimReticleMesh() {
    const geo = new THREE.RingGeometry(0.42, 0.68, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    aimReticleMesh = new THREE.Mesh(geo, mat);
    aimReticleMesh.rotation.y = -Math.PI / 2;
    scene.add(aimReticleMesh);
  }

  // ============================================================================
  // 4b. MODELS 3D ORGÀNICS (GLB generats amb Blender, models/*.glb)
  // ============================================================================
  // Els models tenen esquelet amb les mateixes proporcions que l'esquelet procedimental: l'animació
  // del joc calcula on han d'anar malucs, genolls, peus, espatlles, colzes i mans, i aquí es
  // giren els ossos per arribar-hi (cinemàtica inversa de dos ossos). Si els fitxers no es poden
  // carregar, el joc continua amb els models geomètrics.
  const characterModels = { skater: null, goalkeeper: null, ready: false, cache: new Map() };
  const SKIN_TONES = ['#f1c9a5', '#e8b98f', '#d9a074', '#c68642', '#a96b43', '#f6d7b8', '#e0ac69', '#8d5524'];
  const HAIR_TONES = ['#1f1611', '#2c1e15', '#4a3426', '#6b4a2e', '#16130f', '#8a6a45', '#3a2a20', '#121212'];

  function loadCharacterModels() {
    if (!THREE.GLTFLoader || !THREE.SkeletonUtils || typeof Promise !== 'function') return;
    let loader;
    try { loader = new THREE.GLTFLoader(); } catch (e) { return; }
    const load = name => new Promise((resolve, reject) => loader.load('models/' + name + '.glb', g => resolve(g.scene), undefined, reject));
    Promise.all([load('skater'), load('goalkeeper')]).then(([skater, goalkeeper]) => {
      characterModels.skater = skater;
      characterModels.goalkeeper = goalkeeper;
      characterModels.ready = true;
      allPlayers().forEach(p => attachCharacterModel(p));
      referees.forEach(r => attachCharacterModel(r, true));
    }).catch(err => { if (typeof console !== 'undefined') console.warn('Models 3D no disponibles:', err); });
  }

  function linearColor(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  function faceTexture(skinHex, idx) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = skinHex; g.fillRect(0, 0, 512, 256);
    // Ombrejat suau als laterals i sota la barbeta.
    const side = g.createLinearGradient(0, 0, 512, 0);
    side.addColorStop(0, 'rgba(0,0,0,0.10)'); side.addColorStop(0.25, 'rgba(0,0,0,0)');
    side.addColorStop(0.5, 'rgba(0,0,0,0.12)'); side.addColorStop(0.75, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,0.10)');
    g.fillStyle = side; g.fillRect(0, 0, 512, 256);
    const cx = 128;
    // Barba o ombra de barba per a alguns jugadors.
    if (idx % 4 === 1) { g.fillStyle = 'rgba(40,28,20,0.35)'; g.beginPath(); g.ellipse(cx, 188, 60, 34, 0, 0, Math.PI); g.fill(); }
    // Galtes.
    g.fillStyle = 'rgba(200,90,80,0.10)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 40, 150, 16, 10, 0, 0, Math.PI * 2); g.fill(); }
    // Celles.
    g.fillStyle = 'rgba(35,24,18,0.9)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 13, 106); g.quadraticCurveTo(cx + s * 27, 99, cx + s * 42, 105);
      g.lineTo(cx + s * 41, 109); g.quadraticCurveTo(cx + s * 27, 104, cx + s * 13, 110); g.closePath(); g.fill();
    }
    // Ulls.
    for (const s of [-1, 1]) {
      const ex = cx + s * 27;
      g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(ex, 120, 10, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = ['#3b2a1e', '#2f4a63', '#4a5a2a', '#2a1d14'][idx % 4]; g.beginPath(); g.arc(ex + s * -1, 120, 4.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0b0a09'; g.beginPath(); g.arc(ex + s * -1, 120, 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(30,20,15,0.8)'; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(ex, 120, 10, 5, 0, Math.PI, 0); g.stroke();
    }
    // Nas (ombra) i boca.
    g.fillStyle = 'rgba(90,45,30,0.25)'; g.beginPath(); g.ellipse(cx, 150, 9, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(120,50,45,0.85)';
    g.beginPath(); g.moveTo(cx - 20, 170); g.quadraticCurveTo(cx, 166, cx + 20, 170); g.quadraticCurveTo(cx, 177, cx - 20, 170); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }

  function refereeShirtTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#facc15'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#111317'; g.fillRect(0, 0, 512, 14);
    for (const x of [64, 192, 320, 448]) g.fillRect(x - 6, 0, 12, 256);
    g.strokeStyle = '#111317'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(110, 12); g.lineTo(128, 70); g.lineTo(146, 12); g.stroke();
    const shade = g.createLinearGradient(0, 0, 0, 256);
    shade.addColorStop(0, 'rgba(255,255,255,0.08)'); shade.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = shade; g.fillRect(0, 0, 512, 256);
    return new THREE.CanvasTexture(c);
  }

  function characterMaterial(name, e, isRef, isGK) {
    const team = isRef ? null : TEAMS[e.team];
    const idx = (e.rosterIndex ?? e.idx ?? e.id ?? 0) + (e.team === 'away' ? 3 : 0);
    const skinHex = SKIN_TONES[(idx * 5 + (e.team === 'away' ? 2 : 0)) % SKIN_TONES.length];
    const mat = (color, rough = 0.75, extra = {}) => new THREE.MeshStandardMaterial({ color: linearColor(color), roughness: rough, skinning: true, ...extra });
    switch (name) {
      case 'Jersey': {
        let tex;
        if (isRef) tex = refereeShirtTexture();
        else if (isGK) tex = createJerseyTexture({ ...team, primary: team.gkColor, secondary: team.gkColor }, e.num, e.name);
        else tex = createJerseyTexture(team, e.num, e.name);
        tex.flipY = false; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
        return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, skinning: true, envMapIntensity: 0.5 });
      }
      case 'Sleeve': return mat(isRef ? '#facc15' : isGK ? team.gkColor : team.primary, 0.82, { envMapIntensity: 0.5 });
      case 'Shorts': return mat(isRef ? '#14171c' : isGK ? '#1b2633' : team.shorts, 0.75);
      case 'Socks': return mat(isRef ? '#14171c' : isGK ? '#1b2633' : (team.socks || team.primary), 0.85);
      case 'Skin': return mat(skinHex, 0.62);
      case 'Face': return new THREE.MeshStandardMaterial({ map: faceTexture(skinHex, idx), roughness: 0.6, skinning: true });
      case 'Hair': return mat(HAIR_TONES[idx % HAIR_TONES.length], 0.85);
      case 'Glove': return mat(isRef ? skinHex : '#16181d', 0.55);
      case 'Pad': return mat(isRef ? '#14171c' : '#e5e7ea', 0.45);
      default: return mat('#888888');
    }
  }

  function attachCharacterModel(e, isRef = false) {
    const r = e.rig;
    if (!r || r.model || !characterModels.ready) return;
    const isGK = e.role === 'GK';
    const template = isGK ? characterModels.goalkeeper : characterModels.skater;
    const root = THREE.SkeletonUtils.clone(template);
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (Array.isArray(o.material)) o.material = o.material.map(m => characterMaterial(m.name, e, isRef, isGK));
      else o.material = characterMaterial(o.material.name, e, isRef, isGK);
    });
    r.bodyPivot.add(root);
    const bones = {};
    root.traverse(o => { if (o.isBone) bones[o.name] = o; });
    root.updateMatrixWorld(true);
    const rootQinv = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const rest = new Map(), restModel = new Map();
    for (const b of Object.values(bones)) {
      rest.set(b, b.quaternion.clone());
      restModel.set(b, rootQinv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())));
    }
    r.model = { root, bones, rest, restModel };
    // Amaga el cos geomètric; es mantenen l'estic, els patins, l'anell i (al porter) casc, guardes i guants.
    const hide = o => { if (o) o.visible = false; };
    hide(r.pelvis);
    for (const leg of [r.leftLeg, r.rightLeg]) { hide(leg.thigh); hide(leg.shin); hide(leg.knee); }
    for (const arm of [r.leftArm, r.rightArm]) {
      hide(arm.shoulder); hide(arm.upper); hide(arm.forearm); hide(arm.elbow);
      if (!isGK) hide(arm.hand);
    }
    if (isGK) { hide(r.chest); hide(r.neck); }
    else hide(r.upper);
  }

  const _ikA = new THREE.Vector3(), _ikB = new THREE.Vector3(), _ikC = new THREE.Vector3();
  const _qA = new THREE.Quaternion(), _qB = new THREE.Quaternion(), _qC = new THREE.Quaternion();

  // Gira un os perquè el seu fill apunti a un punt del món.
  function aimBone(bone, child, targetW) {
    bone.getWorldPosition(_ikA);
    child.getWorldPosition(_ikB);
    const from = _ikB.sub(_ikA).normalize();
    const to = _ikC.copy(targetW).sub(_ikA).normalize();
    if (from.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) return;
    const delta = _qA.setFromUnitVectors(from, to);
    const boneW = bone.getWorldQuaternion(_qB);
    const parentW = bone.parent.getWorldQuaternion(_qC).invert();
    bone.quaternion.copy(parentW.multiply(delta.multiply(boneW)));
    bone.updateMatrixWorld(true);
  }

  // Orienta un os amb una rotació expressada a l'espai del model (el del jugador).
  function orientBone(m, bone, qModel) {
    if (!bone) return;
    const rootQ = m.root.getWorldQuaternion(_qA);
    const desiredW = rootQ.clone().multiply(qModel).multiply(m.restModel.get(bone));
    const parentW = bone.parent.getWorldQuaternion(_qB).invert();
    bone.quaternion.copy(parentW.multiply(desiredW));
    bone.updateMatrixWorld(true);
  }

  function solveLimb(r, upperBone, lowerBone, endBone, rootTarget, midTarget, endTarget) {
    if (!upperBone || !lowerBone || !endBone || !endTarget) return;
    const pivot = r.bodyPivot;
    const rootW = upperBone.getWorldPosition(new THREE.Vector3());
    const L1 = lowerBone.getWorldPosition(new THREE.Vector3()).distanceTo(rootW);
    const L2 = endBone.getWorldPosition(new THREE.Vector3()).distanceTo(lowerBone.getWorldPosition(new THREE.Vector3()));
    const endW = pivot.localToWorld(endTarget.clone());
    const hintW = pivot.localToWorld(midTarget.clone()).sub(pivot.localToWorld(rootTarget.clone()));
    const midW = visualJoint(rootW, endW, L1, L2, hintW.lengthSq() > 1e-8 ? hintW : new THREE.Vector3(0, 0, 1));
    aimBone(upperBone, lowerBone, midW);
    aimBone(lowerBone, endBone, endW);
  }

  // Trasllada la postura calculada per l'animació als ossos del model orgànic.
  function driveCharacterModel(r) {
    const m = r.model;
    if (!m || !r.leftLeg.ik) return;
    const B = m.bones;
    for (const [b, q] of m.rest) b.quaternion.copy(q);
    r.bodyPivot.updateMatrixWorld(true);
    if (B.Hips) {
      const target = r.bodyPivot.localToWorld(r.pelvis.position.clone());
      B.Hips.position.copy(B.Hips.parent.worldToLocal(target));
      B.Hips.updateMatrixWorld(true);
      orientBone(m, B.Hips, new THREE.Quaternion().setFromEuler(r.pelvis.rotation));
    }
    const upperQ = new THREE.Quaternion().setFromEuler(r.upper.rotation);
    orientBone(m, B.Spine, new THREE.Quaternion().slerp(upperQ, 0.55));
    orientBone(m, B.Chest, upperQ);
    orientBone(m, B.Neck, upperQ);
    if (B.Head && r.headGroup) orientBone(m, B.Head, upperQ.clone().multiply(new THREE.Quaternion().setFromEuler(r.headGroup.rotation)));
    for (const [leg, side] of [[r.leftLeg, 'L'], [r.rightLeg, 'R']]) {
      if (leg.ik) solveLimb(r, B['Thigh' + side], B['Shin' + side], B['Foot' + side], leg.ik.hip, leg.ik.knee, leg.ik.foot);
    }
    for (const [arm, side] of [[r.leftArm, 'L'], [r.rightArm, 'R']]) {
      if (arm.ik) solveLimb(r, B['UpperArm' + side], B['ForeArm' + side], B['Hand' + side], arm.ik.shoulder, arm.ik.elbow, arm.ik.hand);
    }
  }

  // ============================================================================
  // 5. CREACIÓ D'ENTITATS I REGLAMENT D'HOQUEI PATINS
  // ============================================================================
  function createEntities() {
    players.forEach(p => {
      if (p.rig && p.rig.group) scene.remove(p.rig.group);
    });
    players = [];

    referees.forEach(r => {
      if (r.rig && r.rig.group) scene.remove(r.rig.group);
    });
    referees = [];

    createSquads();

    // 2 Àrbitres Principals en Pista sobre patins (Sistema de doble arbitratge en diagonal OK Liga / WSE)
    referees.push(makeReferee(0, 'ÀRBITRE 1', 'top', 360, 28));
    referees.push(makeReferee(1, 'ÀRBITRE 2', 'bottom', 640, 472));

    if (!ball.mesh) ball.mesh = buildBall3DMesh();
    if (!aimReticleMesh) buildAimReticleMesh();

    resetPositions('kickoff', 'home');
  }

  function makeReferee(id, name, side, x, y) {
    const ref = {
      id,
      name,
      side, // 'top' (banda superior prop de la Mesa) | 'bottom' (banda inferior en diagonal)
      x,
      y,
      vx: 0,
      vy: 0,
      dir: side === 'top' ? Math.PI / 2 : -Math.PI / 2,
      radius: 10.5,
      isPushing: false,
      bankAngle: 0,
      skatePhase: Math.random() * Math.PI * 2,
      signalTimer: 0,
      signalType: null, // 'whistle' | 'blue_card' | 'warning_card' | 'goal'
      signalLabel: '',
      targetPlayer: null,
      rig: null
    };
    ref.rig = buildReferee3DMesh(ref);
    return ref;
  }

  function triggerRefereeSignal(signalType, nearX, nearY, label = '📣 XIULET!', targetPlayer = null, duration = 2.6) {
    if (!referees.length) return;
    let chosen = referees[0];
    let bestD = Infinity;
    referees.forEach(r => {
      const d = Math.hypot(r.x - nearX, r.y - nearY);
      if (d < bestD) {
        bestD = d;
        chosen = r;
      }
    });
    chosen.signalTimer = duration;
    chosen.signalDuration = duration;
    chosen.signalType = signalType;
    if (signalType === 'whistle' || signalType === 'prepare') emitFx('whistle');
    chosen.signalLabel = label;
    chosen.targetPlayer = targetPlayer;
  }

  function makePlayer(teamKey, data, pos, idx) {
    const team = TEAMS[teamKey];
    const p = {
      team: teamKey,
      idx,
      num: data.num,
      name: data.name,
      role: data.role,
      stats: data,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      dir: teamKey === 'home' ? 0 : Math.PI,
      homeX: pos.homeX,
      homeY: pos.homeY,
      radius: data.role === 'GK' ? 14 : 12.5,
      stamina: 100,
      onPitch: true,
      fatigue: 0,
      stealCooldown: 0,
      pokeTimer: 0,
      isRetreating: false,
      retreatTimer: 0,
      gkReactionDelay: 0,
      gkPosture: 'screen',
      isPushing: false,
      bankAngle: 0,
      aiHoldTimer: 0,
      stickPhase: Math.random() * Math.PI * 2,
      skatePhase: Math.random() * Math.PI * 2,
      rig: null
    };
    p.rig = data.role === 'GK' ? buildGoalkeeper3DMesh(p, team) : buildSkater3DMesh(p, team);
    return p;
  }

  function attackDirection(team) {
    return (team === 'home' ? 1 : -1) * (state.period === 2 ? -1 : 1);
  }

  function skatingSpeed(p, boost = 1) {
    const speedStat = ((p.stats && p.stats.speed) || 85)/85;
    return (1-p.fatigue*0.003)*(2.95+speedStat*0.95)*state.paceFactor*boost;
  }

  function ownGoalX(team) {
    return attackDirection(team) > 0 ? RINK.goalLineOffset : RINK.w - RINK.goalLineOffset;
  }

  function opponentGoalX(team) {
    return RINK.w - ownGoalX(team);
  }

  function allPlayers() {
    return [...squads.home, ...squads.away];
  }

  function eligible(p) {
    return !!p && !p.sentOff && !(p.suspensionRemaining > 0);
  }

  function activePlayers(team) {
    return players.filter(p => p.team === team && p.onPitch && eligible(p));
  }

  function vacateSlot(p) {
    const index = players.indexOf(p);
    p.onPitch = false;
    if (index >= 0) players[index] = {
      team: p.team, idx: p.idx, role: p.role, vacant: true,
      onPitch: false, sentOff: true, x: p.x, y: p.y,
      homeX: p.homeX, homeY: p.homeY, vx: 0, vy: 0
    };
  }

  function createSquads() {
    players = [];
    squads = { home: [], away: [] };
    for (const team of ['home', 'away']) {
      const reserves = [
        { num: 30, name: 'PORTER SUPLENT', role: 'GK', ovr: 79, speed: 75, shot: 45, pass: 74, def: 80, gkAcrobat: 79, gkReflexes: 81, gkPositioning: 80 },
        ...['TANCA', 'ALA', 'ALA', 'BOIA'].map((role, i) => ({ num: 31+i, name: 'RESERVA ' + (i+1), role: ['DEF','MID','FWD','FWD'][i], ovr: 79+i, speed: 82+i, shot: 79+i, pass: 80+i, def: 80, iq: 80, tackle: 80 }))
      ];
      [...TEAMS[team].players, ...reserves].forEach((data, index) => {
        const slot = index < 5 ? index : index === 5 ? 0 : (index-6)%4+1;
        const p = makePlayer(team, data, { x: 500, y: 250, homeX: 500, homeY: 250 }, slot);
        p.id = team + '-' + data.num;
        p.rosterIndex = index;
        p.demo = index >= 5;
        p.onPitch = index < 5;
        p.fatigue = 0;
        p.suspensionRemaining = p.blueCards = 0;
        p.sentOff = false;
        squads[team].push(p);
        if (p.onPitch) players.push(p);
      });
    }
    placeBench();
  }

  function placeBench() {
    for (const team of ['home', 'away']) {
      const bench = squads[team].filter(p => !p.onPitch);
      bench.forEach((p, index) => {
        p.x = (attackDirection(team) > 0 ? 340 : 660) + (index-(bench.length-1)/2)*25;
        p.y = -32;
        p.vx = p.vy = 0;
        p.dir = Math.PI/2;
        p.isPushing = false;
      });
    }
  }

  function substitute(team, outgoingId, incomingId, automatic = false) {
    const out = squads[team]?.find(p => p.id === outgoingId);
    const incoming = squads[team]?.find(p => p.id === incomingId);
    const stopped = state.paused || ['kickoff','free_hit','whistle_pause','goal_celebration','halftime'].includes(state.mode);
    if (!stopped || state.mode === 'finished' || state.mode === 'direct_foul' ||
        !out || !incoming || out === incoming || !out.onPitch || !eligible(out) ||
        incoming.onPitch || !eligible(incoming) || (out.role === 'GK') !== (incoming.role === 'GK')) return false;
    const slot = players.indexOf(out);
    if (slot < 0) return false;
    if (ball.owner === out && state.mode === 'kickoff') state.kickoffTaker = incoming;
    if (state.freeHit?.taker === out) state.freeHit.taker = incoming;
    if (state.booling?.takers[team] === out) state.booling.takers[team] = incoming;
    if(state.passFlight?.receiver===out)state.passFlight.receiver=incoming;
    if (ball.owner === out) {
      if (state.mode === 'kickoff' || state.mode === 'free_hit') ball.owner = incoming;
      else { ball.owner = null; ball.vx = ball.vy = 0; }
    }
    incoming.idx = out.idx;
    incoming.x = out.x; incoming.y = out.y;
    incoming.homeX = out.homeX; incoming.homeY = out.homeY;
    incoming.dir = out.dir; incoming.vx = incoming.vy = 0;
    incoming.stealCooldown = 0.25;
    incoming.aiHoldTimer = 0;
    out.onPitch = false;
    incoming.onPitch = true;
    players[slot] = incoming;
    state.substitutionCount[team]++;
    placeBench();
    if (!automatic) showBanner('CANVI · ' + out.name + ' → ' + incoming.name, 2);
    return true;
  }

  function rebalanceTeam(team) {
    const target = state.penalties[team].length ? 3 : 4;
    const offset = team === 'home' ? 0 : 5;
    const skaters = activePlayers(team).filter(p => p.role !== 'GK');
    if (skaters.length > target) {
      const removed = [...skaters].reverse().find(p => p !== ball.owner) || skaters.at(-1);
      vacateSlot(removed);
      if (ball.owner === removed) ball.owner = null;
    }
    for (let slot = 0; slot < 5; slot++) {
      const current = players[offset+slot];
      if (current.onPitch && eligible(current)) continue;
      current.onPitch = false;
      if (slot !== 0 && activePlayers(team).filter(p => p.role !== 'GK').length >= target) continue;
      const replacement = squads[team].filter(p => !p.onPitch && eligible(p) && (p.role === 'GK') === (slot === 0))
        .sort((a,b) => a.fatigue-b.fatigue)[0];
      if (!replacement) continue;
      replacement.idx = slot;
      replacement.onPitch = true;
      replacement.x = Math.max(30, Math.min(RINK.w-30, current.x));
      replacement.y = Math.max(30, Math.min(RINK.h-30, current.y));
      replacement.homeX = current.homeX; replacement.homeY = current.homeY;
      replacement.dir = attackDirection(team) > 0 ? 0 : Math.PI;
      replacement.vx = replacement.vy = 0;
      replacement.stealCooldown = 0.4;
      players[offset+slot] = replacement;
    }
    placeBench();
    if (!getControlledPlayer()) switchToNextPlayer();
    if (activePlayers(team).length < 4 || !activePlayers(team).some(p => p.role === 'GK')) {
      finishMatch('Partit suspès: sense quatre jugadors aptes, inclòs el porter');
    }
  }

  function updateSanctions(dt) {
    allPlayers().forEach(p => { p.suspensionRemaining = Math.max(0,(p.suspensionRemaining || 0)-dt); });
    for (const team of ['home','away']) {
      let remainingStep = dt;
      while (state.penalties[team].length && remainingStep > 0) {
        const penalty = state.penalties[team][0];
        const elapsed = Math.min(remainingStep, penalty.remaining);
        penalty.remaining = Math.max(0, penalty.remaining-elapsed);
        remainingStep -= elapsed;
        if (penalty.remaining <= 1e-8) state.penalties[team].shift();
      }
      state.exclusions[team] = state.penalties[team][0]?.remaining || 0;
      rebalanceTeam(team);
    }
  }

  // Durades reals per part, com l’opció «Durada de la part» de l’EA FC (3–20 min) més el temps real.
  // El rellotge sempre mostra 25 minuts; només canvia la velocitat a què passa.
  function realHalfOptions() { return [3,4,5,6,7,8,9,10,15,20,25]; }

  function clockScale() {
    return state.halfDuration/(state.realHalfMinutes*60);
  }

  function setRealHalfMinutes(value) {
    const minutes = Number(value);
    state.realHalfMinutes = realHalfOptions().includes(minutes) ? minutes : 25;
    syncMatchUI();
    return state.realHalfMinutes;
  }

  function updateFitness(dt, resting = false) {
    allPlayers().forEach(p => {
      const playing = p.onPitch && eligible(p) && !resting;
      p.fatigue = Math.max(0,Math.min(100,p.fatigue + dt*(playing ? (p.role === 'GK' ? 0.005 : 0.02) : -0.06)));
      if (!playing) p.stamina = Math.min(100,p.stamina+dt*10);
    });
  }

  function autoSubstitute(team) {
    const out = activePlayers(team).filter(p => p.role !== 'GK').sort((a,b) => b.fatigue-a.fatigue)[0];
    const incoming = squads[team].filter(p => !p.onPitch && eligible(p) && p.role !== 'GK').sort((a,b) => a.fatigue-b.fatigue)[0];
    if (out && incoming && out.fatigue >= 18 && out.fatigue-incoming.fatigue > 8) substitute(team,out.id,incoming.id,true);
  }

  function endPeriod() {
    state.passFlight=null;state.passBlockedPlayer=null;
    state.booling=null;state.neutralPossession=false;
    state.pendingRestart = null;
    state.endPeriodAfterSetPiece = false;
    state.timeRemaining = 0;
    ball.owner = null;
    ball.vx = ball.vy = ball.vz = 0;
    clearInput();
    if (state.period === 2) { finishMatch(); return; }
    state.mode = 'halftime';
    state.halftimeRemaining = 600;
    state.bannerTimer = 0;
    emitFx('whistle', { long: true });
    syncMatchUI();
  }

  function beginSecondHalf() {
    if (state.mode !== 'halftime') return false;
    updateFitness(state.halftimeRemaining,true);
    state.period = 2;
    state.halftimeRemaining = 0;
    state.timeRemaining = state.halfDuration;
    state.paused = false;
    state.endPeriodAfterSetPiece = false;
    allPlayers().forEach(p => { p.vx = p.vy = 0; p.isRetreating = false; });
    resetPositions('kickoff','away');
    syncMatchUI();
    return true;
  }

  function syncMatchUI() {
    const next = document.getElementById('btnSecondHalf');
    if (next) next.hidden = state.mode !== 'halftime';
    const format = document.getElementById('matchFormat');
    if (format) format.textContent = '2 × ' + state.halfDuration/60 + ' min' +
      (state.realHalfMinutes*60 === state.halfDuration ? ' · temps real' : ' · ' + state.realHalfMinutes + ' min reals/part');
    const duration = document.getElementById('matchDuration');
    if (duration && 'value' in duration && Number(duration.value) !== state.realHalfMinutes) duration.value = String(state.realHalfMinutes);
    const pause = document.getElementById('btnPause');
    if (pause) {
      pause.setAttribute('aria-pressed',String(state.paused));
      if (pause.dataset) pause.dataset.state = state.paused ? 'paused' : 'playing';
    }
    updateOverlays();
  }

  function renderBench() {
    const outSelect = document.getElementById('benchOut');
    const inSelect = document.getElementById('benchIn');
    const roster = document.getElementById('benchRoster');
    if (!outSelect || !inSelect || !roster) return;
    const previousOut = outSelect.value;
    outSelect.replaceChildren();
    for (const p of activePlayers('home')) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = '#' + p.num + ' ' + p.name + (p.role === 'GK' ? ' · porter' : '') + ' · frescor ' + Math.round(100-p.fatigue) + '%';
      outSelect.appendChild(option);
    }
    if (activePlayers('home').some(p => p.id === previousOut)) outSelect.value = previousOut;
    const outgoing = squads.home.find(p => p.id === outSelect.value) || activePlayers('home')[0];
    inSelect.replaceChildren();
    for (const p of squads.home.filter(p => !p.onPitch && eligible(p) && (p.role === 'GK') === (outgoing?.role === 'GK'))) {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = '#' + p.num + ' ' + p.name + ' · frescor ' + Math.round(100-p.fatigue) + '%';
      inSelect.appendChild(option);
    }
    roster.replaceChildren();
    for (const p of squads.home) {
      const row = document.createElement('li');
      const status = p.sentOff ? 'Expulsat' : p.suspensionRemaining > 0 ? 'Suspès ' + Math.ceil(p.suspensionRemaining) + ' s' : p.onPitch ? 'En pista' : 'Banqueta';
      row.textContent = '#' + p.num + ' ' + p.name + ' · ' + status + ' · frescor ' + Math.round(100-p.fatigue) + '%' + (p.demo ? ' · demo' : '');
      roster.appendChild(row);
    }
    const apply = document.getElementById('btnApplySub');
    if (apply) apply.disabled = !outgoing || !inSelect.value || state.mode === 'finished' || state.mode === 'direct_foul';
    const summary = document.getElementById('benchSummary');
    if (summary) summary.textContent = 'Canvis: ' + state.substitutionCount.home + ' · Inferioritat: ' + Math.ceil(state.exclusions.home) + ' s' +
      (state.penalties.home.length > 1 ? ' · ' + (state.penalties.home.length-1) + ' sanció(ns) pendent(s)' : '');
  }

  function openBench() {
    state.benchWasPaused = state.paused;
    renderBench();
    const dialog = document.getElementById('benchDialog');
    if (dialog && !dialog.open) dialog.showModal();
    setPaused(true);
  }

  function closeBench() {
    document.getElementById('benchDialog')?.close();
    setPaused(state.benchWasPaused);
  }

  function scheduleRestart(action, seconds) {
    state.pendingRestart = { action, remaining: seconds };
  }

  function playerUnavailable(p) {
    return !p || !p.onPitch || !eligible(p);
  }

  function clearInput() {
    Object.keys(keys).forEach(k => { keys[k] = false; });
    touchInput.active = false;
    touchInput.dx = touchInput.dy = 0;
    touchInput.sprint = false;
    state.chargingShot = false;
    state.shotCharge = 0;
    const stick = document.getElementById('joyStick');
    if (stick) stick.style.transform = 'translate(0px, 0px)';
  }

  function setPaused(paused) {
    if (state.mode === 'finished') return;
    state.paused = paused;
    clearInput();
    syncMatchUI();
  }

  function finishMatch(reason = 'Temps exhaurit') {
    state.mode = 'finished';
    state.pendingRestart = null;
    ball.owner = null;
    ball.vx = ball.vy = ball.vz = 0;
    clearInput();
    ui.finishReason = reason;
    state.bannerTimer = 0;
    emitFx('whistle', { long: true });
    syncMatchUI();
  }

  function newMatch() {
    state.mode = 'kickoff';
    state.paused = false;
    state.halfDuration = 1500;
    setRealHalfMinutes(document.getElementById('matchDuration')?.value);
    state.period = 1;
    state.timeRemaining = state.halfDuration;
    state.halftimeRemaining = 0;
    state.endPeriodAfterSetPiece = false;
    state.pendingRestart = null;
    state.cardEvent = null;
    state.lastPassTime = -Infinity;
    state.lastGoal = null;
    state.lastShooter = null;
    state.stoppage = null;
    state.saves.home = state.saves.away = state.blueCards.home = state.blueCards.away = 0;
    replayState.active = false;
    replayState.frames.length = 0;
    replayState.goalIndex = -1;
    replayState.pendingAt = 0;
    fxEvents.length = 0;
    players = [];
    for (const team of ['home','away']) {
      state.score[team] = state.shots[team] = state.fouls[team] = state.exclusions[team] = state.substitutionCount[team] = 0;
      state.penalties[team] = [];
      state.excludedPlayers[team] = null;
      squads[team].forEach(p => {
        p.suspensionRemaining = p.blueCards = p.stealCooldown = p.pokeTimer = p.fatigue = 0;
        p.sentOff = false;
        p.stamina = 100;
        p.aiHoldTimer = 0;
        p.onPitch = p.rosterIndex < 5;
        if (p.onPitch) { p.idx = p.rosterIndex; players.push(p); }
      });
    }
    clearInput();
    resetPositions('kickoff','home');
    syncMatchUI();
  }

  function boolingPoint(reason, x, y, goalX = null) {
    if (reason === 'ceiling') return { x: RINK.w/2, y: RINK.h/2 };
    const goal = goalX ?? (x < RINK.w/2 ? RINK.goalLineOffset : RINK.w-RINK.goalLineOffset);
    const sign = goal < RINK.w/2 ? 1 : -1;
    if (reason === 'pads' || reason === 'net' ||
        ((x-goal)*sign < 0 && Math.abs(y-RINK.h/2) <= RINK.areaWidth/2)) {
      return { x: goal + sign*RINK.areaDepth,
        y: RINK.h/2 + (y <= RINK.h/2 ? -1 : 1)*RINK.areaWidth/2 };
    }
    const point = { x, y, radius: 1.4*METRE, vx: 0, vy: 0 };
    constrainToRink(point,0);
    return { x: point.x, y: point.y };
  }

  function callBooling(reason, x = ball.x, y = ball.y, goalX = null) {
    if (state.paused || state.mode !== 'match') return false;
    state.passFlight=null;state.passBlockedPlayer=null;
    const point = boolingPoint(reason,x,y,goalX);
    state.passFlight=null;
    state.mode = 'whistle_pause';
    state.stoppage = { type: 'booling', t: 0, protesters: [], x: point.x, y: point.y };
    state.booling = null;
    state.indirectTaker = null;
    state.neutralPossession = true;
    state.chargingShot = false;
    state.shotCharge = 0;
    ball.owner = null;
    ball.vx = ball.vy = ball.vz = ball.z = 0;
    players.forEach(p => { p.vx = p.vy = 0; });
    const reasons = { pads: 'Bola retinguda al porter', net: 'Bola retinguda a la porteria',
      ceiling: 'La bola ha tocat el sostre', simultaneous: 'Faltes simultànies de la mateixa gravetat',
      unknown: 'Interrupció sense possessió definida' };
    triggerRefereeSignal('booling',point.x,point.y,'BOOLING · REPRESA NEUTRAL',null,2);
    showBanner('BOOLING',1.2,reasons[reason] || reasons.unknown);
    scheduleRestart(() => startBooling(point,reason),1.2);
    return true;
  }

  function startBooling(point, reason) {
    state.mode = 'booling';
    state.freeHit = null;
    state.indirectTaker = null;
    state.directShooter = null;
    state.neutralPossession = true;
    state.possessionClock = 45;
    state.halfCourtClock = 10;
    state.backCourtClock = 5;
    state.crossedHalfCourt = false;
    const takers = {};
    for (const team of ['home','away']) {
      takers[team] = activePlayers(team).filter(p => p.role !== 'GK')
        .sort((a,b) => Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0];
    }
    if (!takers.home || !takers.away) { finishMatch('Sense jugadors per disputar el booling'); return; }
    players.forEach(p => {
      p.vx = p.vy = 0; p.pokeTimer = 0; p.stealCooldown = 0;
      if (p === takers[p.team]) {
        const sign = attackDirection(p.team);
        // Body-to-stick offset plus 20 cm between the stick and stationary ball.
        p.x = point.x-sign*(15.5+0.2*METRE);p.y = point.y;
        p.dir = sign>0 ? 0 : Math.PI;
      } else keepBoolingDistance(p,point);
    });
    ball.owner = null;
    ball.x = point.x;ball.y = point.y;
    ball.vx = ball.vy = ball.vz = ball.z = 0;
    ball.shotByTeam = null;ball.reboundedReset = false;
    state.booling = { ...point, reason, takers, phase: 'waiting', remaining: 1.8,
      reaction: 0.22+Math.random()*0.16 };
    state.controlledIdx = players.indexOf(takers.home);
    triggerRefereeSignal('booling',point.x,point.y,'BOOLING · ESPERA EL XIULET',null,1.8);
    showBanner('BOOLING · ESPERA EL XIULET',1.8,'Un jugador per equip · La resta a 3 metres');
  }

  function keepBoolingDistance(p, point) {
    const radius = 3*METRE+p.radius;
    if (Math.hypot(p.x-point.x,p.y-point.y) >= radius) return;
    let best = null, cost = Infinity;
    for (let i=0;i<72;i++) {
      const a = i*Math.PI/36;
      const q = { x: point.x+Math.cos(a)*radius, y: point.y+Math.sin(a)*radius,
        radius: p.radius, vx: 0, vy: 0 };
      constrainToRink(q,0);
      if (Math.hypot(q.x-point.x,q.y-point.y)<radius-1e-6) continue;
      const d = Math.hypot(q.x-p.x,q.y-p.y);
      if (d<cost) { best=q;cost=d; }
    }
    if (best) { p.x=best.x;p.y=best.y; }
  }

  function updateBooling(dt) {
    const b = state.booling;
    if (!b || b.phase !== 'waiting') return;
    players.forEach(p => {
      p.vx=p.vy=0;
      if (p !== b.takers[p.team] && !playerUnavailable(p)) keepBoolingDistance(p,b);
    });
    ball.x=b.x;ball.y=b.y;ball.vx=ball.vy=ball.vz=ball.z=0;
    b.remaining=Math.max(0,b.remaining-dt);
    if (b.remaining<=1e-8) {
      b.phase='live';state.mode='match';
      triggerRefereeSignal('whistle',b.x,b.y,'XIULET · DISPUTA!',null,1.2);
      showBanner('BOOLING · DISPUTA!',1.2,'Prem Passa / Roba o patina cap a la bola');
    }
  }

  function checkNeutralStoppage() {
    if (state.mode !== 'match' || ball.owner) return false;
    if (ball.z >= 8*METRE) return callBooling('ceiling');
    if (ball.z>2 || Math.hypot(ball.vx,ball.vy)>0.65) return false;
    for (const gx of [RINK.goalLineOffset,RINK.w-RINK.goalLineOffset]) {
      const sign = gx<RINK.w/2 ? 1 : -1;
      if ((ball.x-gx)*sign>=0) continue;
      const norm = Math.hypot((ball.x-gx)/RINK.goalDepth,(ball.y-RINK.h/2)/(RINK.goalWidth/2));
      if (norm<=1.15 && norm>0.5) return callBooling('net',ball.x,ball.y,gx);
    }
    return false;
  }

  function registerSimultaneousFouls(home, away) {
    if (state.paused || state.mode !== 'match' || playerUnavailable(home) || playerUnavailable(away) ||
        home.team !== 'home' || away.team !== 'away') return false;
    // Equal team fouls. An uncancelled accumulation direct hit takes precedence.
    const homeDirect = ++state.fouls.home % 5 === 0 && state.fouls.home >= 10;
    const awayDirect = ++state.fouls.away % 5 === 0 && state.fouls.away >= 10;
    if (homeDirect !== awayDirect) {
      const team = homeDirect ? 'away' : 'home';
      state.passFlight=null;state.mode='whistle_pause';ball.owner=null;ball.vx=ball.vy=ball.vz=0;
      state.stoppage={type:'foul',team,offender:null,victim:null,protesters:[home,away],x:ball.x,y:ball.y,t:0,restart:'direct_foul'};
      showBanner('FALTES SIMULTÀNIES',2,'Preval la falta directa per acumulació');
      triggerRefereeSignal('whistle',ball.x,ball.y,'FALTA DIRECTA PER ACUMULACIÓ');
      scheduleRestart(()=>resetPositions('direct_foul',team),2);
      return true;
    }
    return callBooling('simultaneous');
  }

  function restartFreeHit(team, x, y) {
    resetPositions('free_hit', team);
    const taker = players.find(p => p.team === team && p.role !== 'GK' && !playerUnavailable(p));
    if (!taker) return finishMatch('Sense jugadors disponibles');
    // Article 27: stationary ball, at least 70 cm from the boards.
    const point = { x, y, radius: 0.7 * METRE, vx: 0, vy: 0 };
    constrainToRink(point, 0);
    taker.dir = attackDirection(team) > 0 ? 0 : Math.PI;
    taker.x = point.x - Math.cos(taker.dir) * 15.5;
    taker.y = point.y;
    constrainToRink(taker, 0);
    taker.aiHoldTimer = 0;
    setBallOwner(taker);
    state.freeHit = { team, taker, x: point.x, y: point.y };
    holdFreeHit();
    triggerRefereeSignal('whistle',ball.x,ball.y,'LLIURE INDIRECTE',null,3);
    state.crossedHalfCourt = isInAttackingHalf(team, ball.x);
    showBanner('LLIURE INDIRECTE · ' + TEAMS[team].short, 3, 'Rivals a 3 metres · Prem Passa per posar la bola en joc');
  }

  function holdFreeHit() {
    const restart = state.freeHit;
    if (!restart) return;
    ball.x = restart.x; ball.y = restart.y;
    ball.vx = ball.vy = ball.vz = ball.z = 0;
    players.forEach(p => {
      p.vx = p.vy = 0;
      if (playerUnavailable(p) || p.team === restart.team) return;
      const distance = 3 * METRE + p.radius;
      if (Math.hypot(p.x-restart.x,p.y-restart.y) >= distance) return;
      // Try positions around the restart and project each into the rounded rink.
      // Choose the closest legal one; clamping a single radial push can leave
      // defenders too close to the ball beside boards or in a corner.
      let best = null, cost = Infinity;
      for (let i=0; i<72; i++) {
        const angle = i * Math.PI / 36;
        const candidate = { x: restart.x + Math.cos(angle)*distance,
          y: restart.y + Math.sin(angle)*distance, radius: p.radius, vx: 0, vy: 0 };
        constrainToRink(candidate,0);
        if (Math.hypot(candidate.x-restart.x,candidate.y-restart.y) < distance-1e-6) continue;
        const score = Math.hypot(candidate.x-p.x,candidate.y-p.y);
        if (score < cost) { best = candidate; cost = score; }
      }
      if (best) { p.x = best.x; p.y = best.y; }
    });
  }

  function releaseFreeHit() {
    state.indirectTaker = state.freeHit.taker;
    state.freeHit = null;
    state.mode = 'match';
    showBanner('BOLA EN JOC!',1);
  }

  function startSetPiece(mode, team) {
    state.setPieceType = mode;
    state.setPieceWait = 1.8;
    state.setPieceReady = false;
    state.mode = 'direct_foul';
    state.possessionTeam = team;
    const sign = attackDirection(team);
    const goalX = opponentGoalX(team);
    const shooter = players.filter(p => p.team === team && p.role !== 'GK' && !playerUnavailable(p)).at(-1);
    if (!shooter) return finishMatch('Sense executor disponible');
    state.directShooter = shooter;
    shooter.aiHoldTimer = 0;
    players.forEach(p => {
      p.vx = p.vy = 0;
      if (p === shooter) {
        p.x = goalX - sign * (mode === 'penalty' ? RINK.penaltyDistance : RINK.directDistance);
        p.y = RINK.h / 2;
        p.dir = sign > 0 ? 0 : Math.PI;
      } else if (p.role === 'GK' && p.team !== team) {
        p.x = goalX; p.y = RINK.h / 2;
      } else {
        p.x = ownGoalX(team) + sign*(RINK.areaDepth*0.35 + (p.team === team ? 0 : 45));
        p.y = RINK.h/2 - RINK.areaWidth/2 + 25 + p.idx*35;
      }
    });
    // Una represa al final de la part sempre té uns 5 segons reals per executar-se.
    const lastPlay = Math.min(state.halfDuration, 5*clockScale());
    if (state.timeRemaining < Math.min(3, lastPlay)) {
      state.timeRemaining = lastPlay;
      state.endPeriodAfterSetPiece = true;
    }
    ball.x = shooter.x; ball.y = shooter.y;
    ball.owner = shooter;
    state.possessionClock = 45;
    state.crossedHalfCourt = true;
    if (team === 'home') state.controlledIdx = players.indexOf(shooter);
    else switchToNextPlayer();
    showBanner((mode === 'penalty' ? 'PENAL!' : 'FALTA DIRECTA!') + ' · ' + TEAMS[team].short,
      1.8, 'Espera el xiulet · Tots els jugadors han de quedar quiets');
    triggerRefereeSignal('prepare',ball.x,ball.y,'ESPERA EL XIULET',null,1.8);
  }

  function defensiveSwitchScore(p) {
    const sign=attackDirection('home');
    const carrier=ball.owner;
    const tx=Math.max(30,Math.min(RINK.w-30,ball.x+(carrier?carrier.vx:ball.vx)*8));
    const ty=Math.max(30,Math.min(RINK.h-30,ball.y+(carrier?carrier.vy:ball.vy)*8));
    const behind=Math.max(0,(p.x-ball.x)*sign);
    return Math.hypot(p.x-tx,p.y-ty)+behind*1.2+(behind>12?80:0)-(p.role==='DEF'?15:0);
  }

  function nextSwitchPlayer(excludeCurrent=true) {
    const current=getControlledPlayer();
    const visited=state.switchWindow>0?state.switchVisited:[];
    let candidates=activePlayers('home').filter(p=>p.role!=='GK'&&p!==state.passBlockedPlayer&&(!excludeCurrent||p!==current));
    const fresh=candidates.filter(p=>!visited.includes(p.id));
    if(fresh.length)candidates=fresh;
    const goalSide=candidates.filter(p=>(p.x-ball.x)*attackDirection('home')<=12);
    if(ball.owner?.team==='away'&&goalSide.length)candidates=goalSide;
    candidates.sort((a,b)=>defensiveSwitchScore(a)-defensiveSwitchScore(b)||players.indexOf(a)-players.indexOf(b));
    return candidates[0]||null;
  }

  function controlPlayer(p) {
    if(playerUnavailable(p)||p.team!=='home'||p.role==='GK')return false;
    const previous=getControlledPlayer();
    if(previous===p){p.isRetreating=false;p.retreatTimer=0;return true;}
    if(previous&&state.possessionTeam==='away'&&isInAttackingHalf('home',previous.x)) {
      previous.isRetreating=true;previous.retreatTimer=3.6;
    }
    state.controlledIdx=players.indexOf(p);
    p.isRetreating=false;p.retreatTimer=0;
    state.chargingShot=false;state.shotCharge=0;
    return true;
  }

  function defensiveRecoveryTarget(p) {
    const sign=attackDirection(p.team),goal=ownGoalX(p.team);
    const fromGoal=(ball.x-goal)*sign;
    return {x:goal+sign*Math.max(45,Math.min(430,fromGoal-100)),
      y:Math.max(65,Math.min(RINK.h-65,p.homeY*0.65+ball.y*0.35))};
  }

  function updateDefensiveRecovery(p,dt) {
    if(!p.isRetreating)return false;
    if(state.possessionTeam===p.team) {p.isRetreating=false;p.retreatTimer=0;return false;}
    const target=defensiveRecoveryTarget(p),dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy);
    p.retreatTimer=Math.max(0,p.retreatTimer-dt);
    // Reaching a useful defensive position, not a short timer, ends recovery.
    if(d<35&&(p.x-ball.x)*attackDirection(p.team)<-25) {p.isRetreating=false;return false;}
    if(d<12) {p.vx*=0.8;p.vy*=0.8;p.isPushing=false;return true;}
    const nx=dx/d,ny=dy/d;
    const braking=p.vx*nx+p.vy*ny<0?0.85:0.962;
    p.vx=(p.vx+nx*0.20*state.paceFactor)*braking;
    p.vy=(p.vy+ny*0.20*state.paceFactor)*braking;
    const speed=Math.hypot(p.vx,p.vy),limit=skatingSpeed(p,1.18);
    if(speed>limit){p.vx*=limit/speed;p.vy*=limit/speed;}
    const angle=normalizeAngle(Math.atan2(dy,dx)-p.dir);
    p.dir=normalizeAngle(p.dir+Math.max(-0.14,Math.min(0.14,angle*0.24)));
    p.bankAngle=p.bankAngle*0.85+Math.max(-0.26,Math.min(0.26,angle*0.42))*0.15;
    p.isPushing=true;
    return true;
  }

  function setBallOwner(p) {
    if (state.mode === 'booling') return;
    if (p && playerUnavailable(p)) return;
    if (state.mode === 'direct_foul' && !state.setPieceReady) return;
    if (state.mode === 'free_hit' && state.freeHit && p !== state.freeHit.taker) return;
    if (p && (p === state.indirectTaker || p === state.passBlockedPlayer)) return;
    const lostPlayer=ball.owner||state.passFlight?.passer||getControlledPlayer();
    if (p) clearPassOnTouch(p);
    if (p) state.indirectTaker = null;
    if (p && state.mode === 'direct_foul' && state.setPieceReady && p !== state.directShooter) state.mode = 'match';
    const prevOwner = ball.owner;
    const prevTeam = state.possessionTeam;
    ball.owner = p;
    if (!p) return;

    state.booling = null;
    p.aiHoldTimer = 0;
    p.receiveTimer = 0.22;
    ball.shotByTeam = null;
    if (prevTeam !== p.team || ball.reboundedReset || state.neutralPossession) {
      ball.reboundedReset = false;
      state.possessionTeam = p.team;
      state.possessionClock = 45;
      state.halfCourtClock = 10;
      state.backCourtClock = 5;
      state.crossedHalfCourt = isInAttackingHalf(p.team, p.x);

      // Si l'usuari humà ('home') perd la bola a camp contrari, canvi automàtic al defensor més proper + replegament!
      if (prevTeam === 'home' && p.team === 'away') {
        onHumanLostBallInAttack(lostPlayer);
      }
    }
    state.neutralPossession = false;
    if (p.team === 'home' && p.role !== 'GK') {
      if(prevTeam!=='home')activePlayers('home').forEach(other=>{other.isRetreating=false;other.retreatTimer=0;});
      controlPlayer(p);state.switchVisited=[];state.switchWindow=0;
    }
  }

  // REPLEGAMENT DEFENTSIU I AUTO-SWITCH:
  // Quan perdem la bola a camp rival, el davanter replega ràpid i prenem el control del jugador més proper a la bola/defensa
  function onHumanLostBallInAttack(lostPlayer=null) {
    if(state.possessionTeam!=='away')return;
    state.switchVisited=[];state.switchWindow=0;
    for(const p of activePlayers('home')) {
      if(p.role==='GK')continue;
      if(isInAttackingHalf('home',p.x)||((p.x-ball.x)*attackDirection('home')>-70)) {
        p.isRetreating=true;p.retreatTimer=3.6;
      }
    }
    const defender=nextSwitchPlayer(false);
    if(defender)controlPlayer(defender);
  }

  function isInAttackingHalf(teamKey, xPos) {
    return (xPos-RINK.w/2)*attackDirection(teamKey) > 0;
  }

  function isInOwnHalf(teamKey, xPos) {
    return (xPos-RINK.w/2)*attackDirection(teamKey) < 0;
  }

  function callRuleViolation(title, subtitle, nextTeam, restartX = RINK.w / 2, restartY = RINK.h / 2) {
    if (state.mode === 'whistle_pause' || state.mode === 'goal_celebration') return;
    state.passFlight=null;
    state.mode = 'whistle_pause';
    state.stoppage = { type: 'violation', team: nextTeam, x: restartX, y: restartY, t: 0, protesters: [], restart: 'free_hit' };
    triggerRefereeSignal('whistle', ball.x, ball.y, 'INFRACCIÓ');
    showBanner(title, 2.2, subtitle);

    ball.owner = null;
    ball.vx = 0;
    ball.vy = 0;
    ball.x = restartX;
    ball.y = restartY;

    scheduleRestart(() => {
      restartFreeHit(nextTeam, restartX, restartY);
    }, 1.75);
  }

  function resetPositions(mode = 'kickoff', possession = 'home') {
    state.pendingRestart = null;
    state.switchVisited=[];state.switchWindow=0;
    state.passFlight=null;state.passBlockedPlayer=null;
    state.booling = null;
    state.neutralPossession = false;
    state.freeHit = null;
    state.indirectTaker = null;
    state.directShooter = null;
    state.setPieceWait = 0;
    state.setPieceReady = false;
    state.mode = mode;
    state.shotCharge = 0;
    state.chargingShot = false;
    ball.owner = null;
    ball.vx = ball.vy = ball.vz = ball.z = 0;
    ball.shotByTeam = null;
    ball.reboundedReset = false;
    if (mode === 'kickoff') { autoSubstitute('away'); }
    for (const team of ['home','away']) rebalanceTeam(team);
    if (state.mode === 'finished') return;
    players.forEach(p => {
      p.visualAction=null;p.renderPrevious=null;
      const sign = attackDirection(p.team);
      const canonicalX = p.idx === 0 ? RINK.goalLineOffset+10 : [0,270,365,365,405][p.idx];
      p.x = sign > 0 ? canonicalX : RINK.w-canonicalX;
      p.y = p.idx === 2 ? 135 : p.idx === 3 ? 365 : 250;
      p.homeX = p.x; p.homeY = p.y;
      p.vx = p.vy = 0;
      p.dir = sign > 0 ? 0 : Math.PI;
      p.isRetreating = false; p.retreatTimer = 0;
    });
    if (mode === 'direct_foul' || mode === 'penalty') {
      startSetPiece(mode,possession);
      placeBench();
      return;
    }
    const taker = activePlayers(possession).filter(p => p.role !== 'GK').at(-1);
    if (!taker) return finishMatch('Sense executor disponible');
    const sign = attackDirection(possession);
    taker.x = RINK.w/2 - sign*15.5;
    taker.y = RINK.h/2;
    taker.aiHoldTimer = 0;
    state.kickoffTaker = taker;
    ball.owner = taker;
    ball.x = RINK.w/2; ball.y = RINK.h/2;
    state.possessionTeam = possession;
    if (possession === 'home') state.controlledIdx = players.indexOf(taker);
    else if (!getControlledPlayer()) switchToNextPlayer();
    state.possessionClock = 45;
    state.halfCourtClock = 10;
    state.backCourtClock = 5;
    state.crossedHalfCourt = false;
    placeBench();
    triggerRefereeSignal('whistle',500,250,'SERVEI DE CENTRE',null,1.8);
    showBanner(possession === 'home' ? 'SERVEI DE CENTRE: PASSA A UN COMPANY!' : 'SERVEI DE CENTRE DEL RIVAL',
      2.4, state.period + 'a part · Atac cap a ' + (attackDirection('home') > 0 ? 'la dreta' : 'l’esquerra'));
  }

  function showBanner(text, seconds = 2.0, subText = '') {
    state.bannerText = text;
    state.bannerSubText = subText;
    state.bannerTimer = seconds;
    state.bannerSeq++;
  }

  // ============================================================================
  // 6. CÀMERA 3D WEBGL REAL
  // ============================================================================
  function updateWebGLCamera(dt) {
    const me = players[state.controlledIdx] || ball;
    const fx = ((ball.x * 0.65 + me.x * 0.35) - 500) * S;
    const fz = ((ball.y * 0.65 + me.y * 0.35) - 250) * S;
    const zMul = state.zoomAdjust;

    let targetPos = new THREE.Vector3();
    let targetLook = new THREE.Vector3();

    if (replayState.active && replayState.focus) {
      // Càmera de repetició: baixa, a la cantonada de la porteria on s'ha marcat.
      const side = replayState.goalSide > 500 ? 1 : -1;
      const bx = (replayState.focus.x - 500) * S, bz = (replayState.focus.y - 250) * S;
      targetPos.set(side * 34, 7.5, bz * 0.35 + 17);
      targetLook.set(bx * 0.75 + side * 6, 1.2, bz * 0.8);
      camPosCurr.lerp(targetPos, Math.min(1, dt * 3));
      camLookCurr.lerp(targetLook, Math.min(1, dt * 8));
      camera.position.copy(camPosCurr);
      camera.lookAt(camLookCurr);
      return;
    }

    if (state.camera === 'nhl_side') {
      const cx = Math.max(-28, Math.min(28, fx));
      const cz = fz * 0.35;
      targetPos.set(cx - 2.5, 21 * zMul, cz + 33 * zMul);
      targetLook.set(cx + 1.5, 0.8, cz - 1.5);
    } else if (state.camera === 'nhl_iso') {
      const cx = Math.max(-26, Math.min(26, fx));
      const cz = fz * 0.4;
      targetPos.set(cx - 22 * zMul, 22 * zMul, cz + 31 * zMul);
      targetLook.set(cx + 6, 1.0, cz - 1.5);
    } else if (state.camera === 'end3d') {
      const cx = Math.max(-36, Math.min(20, fx));
      const cz = fz * 0.55;
      targetPos.set(cx - attackDirection('home')*33*zMul, 20.5*zMul, cz);
      targetLook.set(cx + attackDirection('home')*18, 1.2, cz*0.4);
    } else {
      // Fit the complete rink, including the near-side corners, at any aspect ratio.
      const tanHalfFov = Math.tan(camera.fov*Math.PI/360);
      const halfWidth = RINK.w*S/2 + 5;
      const halfHeight = RINK.h*S/2*0.75 + 6;
      const distance = Math.max(halfWidth/(tanHalfFov*camera.aspect),halfHeight/tanHalfFov) + RINK.h*S/2*0.66;
      targetPos.set(0, distance*0.75*zMul, distance*0.66*zMul);
      targetLook.set(0, 0, 0);
    }

    const lerp = Math.min(1, dt * 6.5);
    camPosCurr.lerp(targetPos, lerp);
    camLookCurr.lerp(targetLook, lerp);
    camera.position.copy(camPosCurr);
    if (cameraFx.shake > 0.005) {
      const t = performance.now() * 0.05;
      camera.position.x += Math.sin(t * 1.7) * cameraFx.shake * 0.6;
      camera.position.y += Math.sin(t * 2.3 + 1) * cameraFx.shake * 0.4;
    }
    camera.lookAt(camLookCurr);
  }

  function getInputVector() {
    let sx = 0, sy = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) sx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) sx += 1;
    if (keys['ArrowUp'] || keys['KeyW']) sy -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) sy += 1;

    if (touchInput.active && (Math.abs(touchInput.dx) > 0.08 || Math.abs(touchInput.dy) > 0.08)) {
      sx = touchInput.dx;
      sy = touchInput.dy;
    }

    const len = Math.hypot(sx, sy);
    if (len < 0.05) return { dx: 0, dy: 0, len: 0 };

    const nx = sx / len;
    const ny = sy / len;

    if (state.camera === 'end3d') {
      const sign = attackDirection('home');
      return { dx: -ny*sign, dy: nx*sign, len: Math.min(1,len) };
    }

    return { dx: nx, dy: ny, len: Math.min(1, len) };
  }

  // APUNTAT MANUAL EQUILIBRAT:
  // - Si NO prems Amunt/Avall (W/S), el xut va al centre de la porteria (on el porter està col·locat i l'atura gairebé sempre!).
  // - Per marcar als pals, HAS D'APUNTAR amb W/S (Amunt/Avall) cap al pal obert!
  function computeAimTargetY(shooter) {
    const inp = getInputVector();
    const goalCenterY = RINK.h / 2;
    const topCornerY = goalCenterY - RINK.goalWidth * 0.38;
    const botCornerY = goalCenterY + RINK.goalWidth * 0.38;

    if (inp.dy < -0.25) return topCornerY;
    if (inp.dy > 0.25) return botCornerY;

    // Sense apuntar amunt/avall -> va cap al cos del porter / zona central
    const slightOffset = (shooter ? (shooter.y - goalCenterY) : 0) * 0.12;
    return goalCenterY + Math.max(-12, Math.min(12, slightOffset));
  }

  // ============================================================================
  // 7. FÍSICA DE LA PISTA, REGLAMENT I IA EQUILIBRADA
  // ============================================================================
  function constrainToRink(entity, bounce = 0.72) {
    const r = entity.radius || 6;
    const cr = RINK.cornerRadius;

    if (entity.y >= cr && entity.y <= RINK.h - cr) {
      if (entity.x < r) {
        entity.x = r;
        entity.vx = Math.abs(entity.vx) * bounce;
      } else if (entity.x > RINK.w - r) {
        entity.x = RINK.w - r;
        entity.vx = -Math.abs(entity.vx) * bounce;
      }
    }
    if (entity.x >= cr && entity.x <= RINK.w - cr) {
      if (entity.y < r) {
        entity.y = r;
        entity.vy = Math.abs(entity.vy) * bounce;
      } else if (entity.y > RINK.h - r) {
        entity.y = RINK.h - r;
        entity.vy = -Math.abs(entity.vy) * bounce;
      }
    }

    const corners = [
      { cx: cr, cy: cr },
      { cx: RINK.w - cr, cy: cr },
      { cx: cr, cy: RINK.h - cr },
      { cx: RINK.w - cr, cy: RINK.h - cr }
    ];
    for (const c of corners) {
      const inX = (c.cx === cr && entity.x < cr) || (c.cx > cr && entity.x > RINK.w - cr);
      const inY = (c.cy === cr && entity.y < cr) || (c.cy > cr && entity.y > RINK.h - cr);
      if (inX && inY) {
        const dx = entity.x - c.cx;
        const dy = entity.y - c.cy;
        const dist = Math.hypot(dx, dy);
        const maxDist = cr - r;
        if (dist > maxDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          entity.x = c.cx + nx * maxDist;
          entity.y = c.cy + ny * maxDist;
          const dot = entity.vx * nx + entity.vy * ny;
          if (dot > 0) {
            entity.vx -= (1 + bounce) * dot * nx;
            entity.vy -= (1 + bounce) * dot * ny;
          }
        }
      }
    }
  }

  function collideWithGoalFrames(entity, isBall = false) {
    const gyTop = RINK.h / 2 - RINK.goalWidth / 2 - RINK.postRadius;
    const gyBot = RINK.h / 2 + RINK.goalWidth / 2 + RINK.postRadius;
    const leftLineX = RINK.goalLineOffset;
    const rightLineX = RINK.w - RINK.goalLineOffset;

    const posts = [
      { x: leftLineX, y: gyTop },
      { x: leftLineX, y: gyBot },
      { x: rightLineX, y: gyTop },
      { x: rightLineX, y: gyBot }
    ];

    for (const post of posts) {
      const dx = entity.x - post.x;
      const dy = entity.y - post.y;
      const dist = Math.hypot(dx, dy);
      const minDist = (entity.radius || 6) + RINK.postRadius;
      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        entity.x = post.x + nx * minDist;
        entity.y = post.y + ny * minDist;

        if (isBall) {
          state.passFlight=null;
          if (state.endPeriodAfterSetPiece) { endPeriod(); return; }
          state.possessionClock = 45;
          ball.reboundedReset = true;
          ball.shotByTeam = null;
        }

        const dot = entity.vx * nx + entity.vy * ny;
        if (dot < 0) {
          const b = isBall ? 0.82 : 0.25;
          entity.vx -= (1 + b) * dot * nx;
          entity.vy -= (1 + b) * dot * ny;
          if (isBall) { showBanner('Al pal!', 0.9); emitFx('post'); }
        }
      }
    }

    const goals = [
      { gx: leftLineX, dir: -1 },
      { gx: rightLineX, dir: 1 }
    ];

    for (const g of goals) {
      const r = entity.radius || 6;
      const isBehindLine = g.dir === -1 ? (entity.x < g.gx) : (entity.x > g.gx);
      if (isBehindLine) {
        const dx = (entity.x - g.gx) / RINK.goalDepth;
        const dy = (entity.y - RINK.h / 2) / (RINK.goalWidth * 0.5);
        const normDist = Math.hypot(dx, dy);
        const minNorm = 1 + (r / RINK.goalDepth);
        if (normDist < minNorm && normDist > 0.01) {
          if (!isBall) {
            const nx = dx / normDist;
            const ny = dy / normDist;
            entity.x = g.gx + nx * RINK.goalDepth * minNorm;
            entity.y = RINK.h / 2 + ny * (RINK.goalWidth * 0.5) * minNorm;
            entity.vx *= -0.25;
            entity.vy *= -0.25;
          } else {
            const comingFromBehind = g.dir === -1 ? (entity.x < g.gx - RINK.goalDepth * 0.85) : (entity.x > g.gx + RINK.goalDepth * 0.85);
            if (comingFromBehind) {
              if (Math.hypot(entity.vx,entity.vy)<0.65 && entity.z<2 &&
                  callBooling('net',entity.x,entity.y,g.gx)) return;
              const nx = dx / normDist;
              const ny = dy / normDist;
              entity.x = g.gx + nx * RINK.goalDepth * minNorm;
              entity.y = RINK.h / 2 + ny * (RINK.goalWidth * 0.5) * minNorm;
              entity.vx *= -0.35;
              entity.vy *= -0.35;
            }
          }
        }
      }
    }
  }

  function getControlledPlayer() {
    const p = players[state.controlledIdx];
    return playerUnavailable(p) ? null : p;
  }

  function switchToNextPlayer() {
    if(state.paused||['finished','halftime','booling','free_hit'].includes(state.mode))return;
    // In possession, retain the carrier. During a pass, retain its receiver.
    const carrier=ball.owner?.team==='home'&&ball.owner.role!=='GK'&&!playerUnavailable(ball.owner)?ball.owner:null;
    const receiver=state.passFlight?.passer.team==='home'&&!playerUnavailable(state.passFlight.receiver)?state.passFlight.receiver:null;
    if(carrier||receiver) {controlPlayer(carrier||receiver);return;}
    const current=getControlledPlayer(),next=nextSwitchPlayer(true);
    if(!next)return;
    if(state.switchWindow<=0||state.switchVisited.includes(next.id))state.switchVisited=current?[current.id]:[];
    else if(current&&!state.switchVisited.includes(current.id))state.switchVisited.push(current.id);
    state.switchVisited.push(next.id);state.switchWindow=1.25;
    controlPlayer(next);
  }

  // Acció de TREURE LA BOLA amb l'estic (tant amb el botó de Passa/Roba com amb Entrada Forta)
  function attemptTakeBall(p, isHardTackle = false) {
    if (!p || playerUnavailable(p) || p === state.indirectTaker || p === state.passBlockedPlayer || state.paused || state.mode === 'free_hit' || state.mode === 'booling' || (state.mode === 'direct_foul' && !state.setPieceReady) || p.stealCooldown > 0) return;
    const defStat = ((p.stats && (p.stats.tackle || p.stats.def)) || 85) / 85;
    p.stealCooldown = (isHardTackle ? 0.58 : 0.38) / Math.max(0.7, defStat);
    p.pokeTimer = isHardTackle ? 0.34 : 0.26;

    // Orienta el patinador cap a la bola i allarga l'estic amb un impuls ràpid
    const angToBall = Math.atan2(ball.y - p.y, ball.x - p.x);
    p.dir = angToBall;
    const lungeSpeed = (isHardTackle ? 2.6 : 1.85) * state.paceFactor;
    p.vx += Math.cos(angToBall) * lungeSpeed;
    p.vy += Math.sin(angToBall) * lungeSpeed;

    const dBall = Math.hypot(ball.x - p.x, ball.y - p.y);
    const reach = (isHardTackle ? 50 : 44) * (0.85 + defStat * 0.18);
    if (dBall < reach) {
      if (ball.owner && ball.owner.team === 'away') {
        const carrier = ball.owner;
        const behind = Math.cos(p.dir - carrier.dir) > 0.45;
        // Un millor atribut de defensa/tackle redueix el risc de falta d'estic
        const foulChance = (isHardTackle ? (behind ? 0.48 : 0.24) : (behind ? 0.24 : 0.08)) / defStat;
        if (Math.random() < foulChance) {
          registerFoul('home', isHardTackle && behind && Math.random() < 0.55, p);
          return;
        }
        carrier.stealCooldown = 0.68;
      }
      if (ball.owner && ball.owner !== p) ball.owner.hitTimer = 0.45;
      setBallOwner(p);
      emitFx('tackle');
      showBanner(isHardTackle ? 'Entrada neta!' : 'Bola robada!', 0.85);
    }
  }

  function selectPassReceiver(passer, aimAngle) {
    const mates=activePlayers(passer.team).filter(p=>p!==passer&&p.role!=='GK');
    let best=null,bestScore=-Infinity;
    for(const p of mates) {
      const distance=Math.hypot(p.x-passer.x,p.y-passer.y);
      const angle=Math.abs(normalizeAngle(Math.atan2(p.y-passer.y,p.x-passer.x)-aimAngle));
      if(angle>Math.PI*0.65)continue;
      const score=Math.cos(angle)*2.2-distance/450;
      if(score>bestScore){best=p;bestScore=score;}
    }
    return best||mates.sort((a,b)=>Math.hypot(a.x-passer.x,a.y-passer.y)-Math.hypot(b.x-passer.x,b.y-passer.y))[0]||null;
  }

  function beginPass(passer,receiver) {
    if(playerUnavailable(passer)||playerUnavailable(receiver)||passer===receiver||passer.team!==receiver.team)return false;
    const distance=Math.hypot(receiver.x-passer.x,receiver.y-passer.y);
    const angle=Math.atan2(receiver.y-passer.y,receiver.x-passer.x);
    const stat=((passer.stats&&passer.stats.pass)||85)/85;
    const speed=Math.min(11.4,Math.max(7.5,7+distance*0.01))*state.paceFactor*(0.93+stat*0.1);
    const passSide=(-(ball.x-passer.x)*Math.sin(passer.dir)+(ball.y-passer.y)*Math.cos(passer.dir))<-2?-1:1;
    state.passFlight={passer,receiver,speed,age:0};
    state.passBlockedPlayer=passer;
    ball.owner=null;ball.shotByTeam=null;ball.reboundedReset=false;
    ball.x=passer.x+Math.cos(angle)*16;ball.y=passer.y+Math.sin(angle)*16;
    ball.vx=Math.cos(angle)*speed;ball.vy=Math.sin(angle)*speed;
    ball.z=ball.vz=0;
    state.lastPassTime=performance.now();
    passer.dir=angle;passer.stealCooldown=0.22;passer.aiHoldTimer=0;
    passer.visualAction={type:'pass',side:passSide,power:Math.min(1,distance/420),duration:0.45,remaining:0.45};
    emitFx('pass',{team:passer.team});
    if(passer.team==='home'){controlPlayer(receiver);state.switchVisited=[];state.switchWindow=0;}
    return true;
  }

  function updatePassFlight(dt) {
    const pass=state.passFlight;
    if(!pass||ball.owner)return;
    pass.age+=dt;
    if(pass.age>4.5||playerUnavailable(pass.receiver)) {state.passFlight=null;return;}
    // Aim at the actual receiver, with bounded correction if they change direction.
    const desired=Math.atan2(pass.receiver.y-ball.y,pass.receiver.x-ball.x);
    const current=Math.atan2(ball.vy,ball.vx);
    const turn=Math.max(-0.08,Math.min(0.08,normalizeAngle(desired-current)));
    const speed=Math.min(pass.speed,Math.max(2.5,Math.hypot(pass.receiver.x-ball.x,pass.receiver.y-ball.y)));
    ball.vx=Math.cos(current+turn)*speed;ball.vy=Math.sin(current+turn)*speed;
    ball.z=ball.vz=0;
  }

  function receivePass() {
    const pass=state.passFlight;
    if(!pass||ball.owner)return false;
    const candidates=players.filter(p=>!playerUnavailable(p)&&p.role!=='GK'&&p!==state.passBlockedPlayer&&p!==state.indirectTaker&&
      (p.stealCooldown<=0||p===pass.receiver)&&
      Math.hypot(p.x-ball.x,p.y-ball.y)<p.radius+ball.radius+(p===pass.receiver?12:4.5));
    // The nearest real contact wins: an opponent in the passing lane can intercept.
    candidates.sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y));
    if(!candidates.length)return false;
    setBallOwner(candidates[0]);
    return ball.owner===candidates[0];
  }

  function clearPassOnTouch(p) {
    state.passFlight=null;
    if(p&&p!==state.passBlockedPlayer)state.passBlockedPlayer=null;
  }

  function performPassOrSwitch() {
    if (state.paused || state.mode === 'direct_foul') return;
    if (!['match','kickoff','free_hit'].includes(state.mode)) return;
    if (['kickoff','free_hit'].includes(state.mode) && state.possessionTeam !== 'home') return;
    if (state.mode === 'free_hit') state.controlledIdx = players.indexOf(state.freeHit.taker);
    const me = getControlledPlayer();
    if (!me) return;
    if(!ball.owner&&state.passFlight?.passer.team==='home') {
      const receiver=state.passFlight.receiver;controlPlayer(receiver);
      if(Math.hypot(receiver.x-ball.x,receiver.y-ball.y)<44)attemptTakeBall(receiver,false);
      return;
    }

    if (ball.owner === me) {
      const input=getInputVector();
      const angle=input.len>0.15?Math.atan2(input.dy,input.dx):me.dir;
      const receiver=selectPassReceiver(me,angle);
      if(!receiver) {showBanner('CAP COMPANY DISPONIBLE',1);return;}
      if(state.mode==='free_hit')releaseFreeHit();
      else if(state.mode==='kickoff') {
        state.mode='match';
        triggerRefereeSignal('whistle',500,RINK.h/2,'BOLA EN JOC',null,1.2);
        showBanner('BOLA EN JOC!',1);
      }
      beginPass(me,receiver);
    } else {
      // SENSE BOLA: El botó de Passa serveix per TREURE LA BOLA amb l'estic (i si estàs molt lluny, canvia al defensor més proper i posa l'estic!)
      const dMe = Math.hypot(ball.x - me.x, ball.y - me.y);
      let bestIdx = state.controlledIdx;
      let bestDist = dMe;
      players.forEach((p, idx) => {
        if (p.team === 'home' && p.role !== 'GK') {
          if (playerUnavailable(p)||p===state.passBlockedPlayer) return;
          const d = Math.hypot(p.x - ball.x, p.y - ball.y);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        }
      });

      if (dMe < 62 || bestIdx === state.controlledIdx) {
        attemptTakeBall(me, false);
      } else {
        controlPlayer(players[bestIdx]);
        const newMe = players[bestIdx];
        if (newMe && bestDist < 52) {
          attemptTakeBall(newMe, false);
        }
      }
    }
  }

  function startShootOrSteal() {
    if (state.paused || (state.mode === 'direct_foul' && !state.setPieceReady)) return;
    if (state.mode === 'kickoff') {
      showBanner('HAS DE PASSAR PER SACAR!', 1.4, 'El reglament d\'hoquei obliga a iniciar el joc passant a un company');
      return;
    }
    if (state.mode !== 'match' && state.mode !== 'direct_foul') return;
    const me = getControlledPlayer();
    if (!me) return;
    if (ball.owner === me) {
      if(state.chargingShot)return;
      state.chargingShot = true;
      state.shotCharge = 0.15;
      state.shotGesture = chooseShotGesture(me,Math.atan2(computeAimTargetY(me)-me.y,opponentGoalX(me.team)-me.x));
    } else {
      // Entrada forta d'estic (més abast però més risc de falta / Targeta Blava)
      attemptTakeBall(me, true);
    }
  }

  // Demo players share a right-side stick preference; this is not roster handedness data.
  // Use the ball's body-local side when clear, otherwise the side of the shot relative to facing.
  function chooseShotGesture(p,angle) {
    const side=ball.owner===p?-(ball.x-p.x)*Math.sin(p.dir)+(ball.y-p.y)*Math.cos(p.dir):0;
    const targetSide=Math.sin(angle-p.dir);
    return (Math.abs(side)>4?side:targetSide)<-0.12?'cullera':'pala';
  }

  function shotProfile(p,power,gesture) {
    const charge=Math.max(0.15,Math.min(1,power));
    const stat=Math.max(0,Math.min(100,p.stats.shot??90))/100;
    // Shot power remains distinct from skating pace; both gestures are equally competitive.
    const speed=(11+charge*10)*(0.90+stat*0.12)*(0.78+state.paceFactor*0.22);
    return {speed,lift:gesture==='cullera'?0.7+charge*1.5:0.35+charge*1.1};
  }

  function launchShot(p,angle,power,gesture=chooseShotGesture(p,angle)) {
    const profile=shotProfile(p,power,gesture);
    state.passFlight=null;
    ball.owner=null;ball.shotByTeam=p.team;
    ball.x=p.x+Math.cos(angle)*16;ball.y=p.y+Math.sin(angle)*16;ball.z=0;
    ball.vx=Math.cos(angle)*profile.speed;ball.vy=Math.sin(angle)*profile.speed;ball.vz=profile.lift;
    p.visualAction={type:'shot',gesture,power:Math.max(0.15,Math.min(1,power)),duration:0.42,remaining:0.42};
    p.stealCooldown=0.4;p.dir=angle;
    state.shots[p.team]++;
    state.lastShooter=p;
    emitFx('shot',{power:Math.max(0.15,Math.min(1,power)),team:p.team});
  }

  function releaseShot() {
    if (state.paused || (state.mode === 'direct_foul' && !state.setPieceReady) || !['match', 'direct_foul'].includes(state.mode) || !state.chargingShot) return;
    const me = getControlledPlayer();
    state.chargingShot = false;
    if (ball.owner !== me) {
      state.shotCharge = 0;
      return;
    }

    const power = Math.min(1, Math.max(0.15, state.shotCharge));
    state.shotCharge = 0;

    const goalX = opponentGoalX('home');
    const targetY = computeAimTargetY(me);
    state.aimTargetY = targetY;

    const distToGoal = Math.hypot(goalX - me.x, targetY - me.y);
    const isOneTimer = (performance.now() - state.lastPassTime) < 1600;
    const isSweetSpot = power >= 0.52 && power <= 0.88;
    const isOvercharged = power > 0.91;

    // Dispersió realista segons distància, pressió defensiva i si has clavat la barra en verd (Sweet Spot)
    let spread = 14 + Math.max(0, (distToGoal - 180) * 0.08);
    if (isSweetSpot) spread *= 0.45;
    if (isOneTimer) spread *= 0.6;
    if (isOvercharged) spread *= 2.1; // Passar-se de força al vermell fa que el xut pugui marxar al pal o fora!

    const jitterY = (Math.random() - 0.5) * spread;
    const shotAngle = Math.atan2((targetY + jitterY) - me.y, goalX - me.x);

    // Temps de reacció del porter rival calibrat segons la dificultat, distància i si és al primer toc
    const diffCfg = GK_DIFFICULTY[state.gkDiff] || GK_DIFFICULTY.balanced;
    const awayGk = players.find(p => p.team === 'away' && p.role === 'GK');
    if (awayGk) {
      let delay = distToGoal < 210 ? diffCfg.closeDelay : diffCfg.farDelay;
      if (isOneTimer) delay += 0.08; // Una passada al 2n pal agafa el porter a contrapeu!
      if (!isSweetSpot && power < 0.4) delay = 0; // Xut fluixet -> el porter l'atura fàcil
      awayGk.gkReactionDelay = delay;
    }

    const gesture=state.shotGesture||chooseShotGesture(me,shotAngle);
    launchShot(me,shotAngle,power,gesture);
    if (state.mode === 'direct_foul') state.mode = 'match';

    if (isOvercharged) showBanner('XUT MASSA FORÇAT!', 0.85);
    else if (isSweetSpot && isOneTimer) showBanner('XUT AL PRIMER TOC PERFECTE!', 0.95);
    else if (isSweetSpot) showBanner(gesture==='cullera'?'BON XUT DE CULLERA!':'BON XUT DE PALA!', 0.85);
  }

  function getNextDirectFoulTarget(foulsCount) {
    if (foulsCount < 10) return 10;
    return Math.floor(foulsCount / 5) * 5 + 5;
  }

  function registerFoul(offendingTeam, forceBlueCard = false, customOffender = null) {
    if (state.paused || !['match', 'kickoff'].includes(state.mode)) return;
    const team = offendingTeam === 'home' ? 'away' : 'home';
    const x = ball.x, y = ball.y;
    const offender = customOffender || players.filter(p => p.team === offendingTeam && p.role !== 'GK' && !playerUnavailable(p))
      .sort((a, b) => Math.hypot(a.x-x, a.y-y) - Math.hypot(b.x-x, b.y-y))[0];
    if (!offender || playerUnavailable(offender)) return;
    const goalX = ownGoalX(offendingTeam);
    const inArea = (x-goalX)*attackDirection(offendingTeam) >= 0 &&
      (x-goalX)*attackDirection(offendingTeam) <= RINK.areaDepth && Math.abs(y-RINK.h/2) <= RINK.areaWidth/2;
    const carrier = ball.owner;
    const sign = attackDirection(team);
    const imminentGoal = carrier && carrier.team === team && Math.abs(x-goalX) < 230 &&
      Math.abs(y-RINK.h/2) < 90 && Math.cos(carrier.dir) * sign > 0.5 &&
      !players.some(p => p !== offender && p.team === offendingTeam && p.role !== 'GK' && !playerUnavailable(p) &&
        (p.x-x)*sign > 0 && Math.abs(p.y-y) < 65);
    let restart = inArea ? 'penalty' : imminentGoal ? 'direct_foul' : 'free_hit';
    if (!forceBlueCard && !inArea && !imminentGoal) {
      const count = ++state.fouls[offendingTeam];
      if (count >= 10 && count % 5 === 0) restart = 'direct_foul';
    }
    emitFx(forceBlueCard ? 'card' : 'whistle');
    // Coreografia de l'aturada: la víctima cau, l'infractor reconeix la falta i algun company protesta.
    const victim = carrier && carrier.team === team && !playerUnavailable(carrier) &&
      Math.hypot(carrier.x - offender.x, carrier.y - offender.y) < 70 ? carrier : null;
    if (victim && (forceBlueCard || Math.random() < 0.7)) victim.fallTimer = 2;
    const protesters = players.filter(p => p.team === offendingTeam && p !== offender && p.role !== 'GK' && !playerUnavailable(p) &&
      Math.hypot(p.x - x, p.y - y) < 280).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
      .slice(0, forceBlueCard ? 2 : 1);
    state.stoppage = { type: forceBlueCard ? 'card' : 'foul', team, offender, victim, protesters, x, y, t: 0, restart };
    if (forceBlueCard) {
      state.blueCards[offendingTeam]++;
      offender.blueCards = (offender.blueCards || 0) + 1;
      offender.sentOff = offender.blueCards >= 3;
      offender.suspensionRemaining = offender.sentOff ? 240 : 120;
      vacateSlot(offender);
      state.penalties[offendingTeam].push({ remaining: offender.sentOff ? 240 : 120 });
      state.exclusions[offendingTeam] = state.penalties[offendingTeam][0].remaining;
      state.excludedPlayers[offendingTeam] = offender;
      state.cardEvent = {
        type: offender.sentOff ? 'red' : 'blue', playerNum: offender.num, playerName: offender.name,
        teamName: TEAMS[offendingTeam].name, teamColor: TEAMS[offendingTeam].primary,
        sanction: offender.sentOff ? 'EXPULSIÓ DEFINITIVA · 3 BLAVES' : '2 MINUTS COMPLETS · SENSE REDUCCIÓ PER GOL',
        timer: 2.3, offender
      };
      if (ball.owner === offender) ball.owner = null;
      if (getControlledPlayer() === null) switchToNextPlayer();
      rebalanceTeam(offendingTeam);
      if (state.mode === 'finished') return;
    }
    state.passFlight=null;
    state.mode = 'whistle_pause';
    ball.owner = null;
    ball.vx = ball.vy = ball.vz = 0;
    state.chargingShot = false;
    triggerRefereeSignal(forceBlueCard ? 'blue_card' : 'whistle', x, y, 'FALTA · ' + offender.name, offender);
    const restartName = restart === 'penalty' ? 'Penal' : restart === 'direct_foul' ? 'Falta directa' : 'Lliure indirecte';
    showBanner(forceBlueCard ? 'Targeta ' + (offender.sentOff ? 'vermella' : 'blava') + ' a ' + offender.name : 'Falta de ' + offender.name,
      2.2, restartName + ' per al ' + TEAMS[team].name + (forceBlueCard ? ' · ' + TEAMS[offendingTeam].short + ' juga amb un menys' : ''));
    scheduleRestart(() => {
      if (restart === 'free_hit') restartFreeHit(team, x, y);
      else resetPositions(restart, team);
    }, 2.2);
  }

  // --- IA DELS 2 ÀRBITRES PRINCIPALS EN PISTA (DOBLE ARBITRATGE EN DIAGONAL OK LIGA / WSE) ---
  function updateReferees(dt) {
    referees.forEach(ref => {
      if (ref.signalTimer > 0) {
        ref.signalTimer = Math.max(0, ref.signalTimer - dt);
        if (ref.signalTimer <= 0) {
          ref.signalType = null;
          ref.signalLabel = '';
          ref.targetPlayer = null;
        }
      }

      // Si l'àrbitre està ensenyant una Targeta Blava o Advertència a un jugador, s'acosta cap a ell mirant-lo!
      if (ref.signalTimer > 0 && ref.targetPlayer && (ref.signalType === 'blue_card' || ref.signalType === 'warning_card')) {
        const tp = ref.targetPlayer;
        const approachY = ref.side === 'top' ? Math.max(24, tp.y - 36) : Math.min(RINK.h - 24, tp.y + 36);
        ref.x += (tp.x - ref.x) * 0.08;
        ref.y += (approachY - ref.y) * 0.08;
        ref.vx = 0;
        ref.vy = 0;
        ref.isPushing = false;
        ref.dir = Math.atan2(tp.y - ref.y, tp.x - ref.x);
        return;
      }

      if (state.mode === 'direct_foul') {
        // En Falta Directa, un àrbitre controla la línia del punt de 7,40m i l'altre la línia de gol
        const targetX = opponentGoalX(state.possessionTeam) - attackDirection(state.possessionTeam)*(ref.side === 'top' ? 125 : 35);
        const targetY = ref.side === 'top' ? 68 : 432;
        ref.x += (targetX - ref.x) * 0.1;
        ref.y += (targetY - ref.y) * 0.1;
        ref.vx = 0;
        ref.vy = 0;
        ref.isPushing = false;
        ref.dir = Math.atan2(ball.y - ref.y, ball.x - ref.x);
        return;
      }

      // Posicionament en diagonal per les bandes sense interferir en el joc interior:
      // Àrbitre 1 (Banda Superior, y ~ 26..36) cobreix meitat esquerra i acompanya l'atac fins x=610
      // Àrbitre 2 (Banda Inferior, y ~ 464..474) cobreix meitat dreta en diagonal oposada (x=390..845)
      let targetX, targetY;
      if (ref.side === 'top') {
        targetX = Math.max(155, Math.min(615, ball.x * 0.68 + 95));
        targetY = ball.y < 110 ? 22 : 30;
      } else {
        targetX = Math.max(385, Math.min(845, ball.x * 0.68 + 235));
        targetY = ball.y > 390 ? 478 : 470;
      }

      // Evasions suaus si un jugador o la bola passa molt a prop de la banda on és l'àrbitre
      players.forEach(p => {
        const d = Math.hypot(ref.x - p.x, ref.y - p.y);
        if (d < 46 && d > 1) {
          targetX += ((ref.x - p.x) / d) * 28;
        }
      });

      const dx = targetX - ref.x;
      const dy = targetY - ref.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 10) {
        ref.isPushing = true;
        const maxSp = 2.35 * state.paceFactor;
        const accel = 0.105 * state.paceFactor;
        ref.vx = (ref.vx + (dx / dist) * accel) * 0.95;
        ref.vy = (ref.vy + (dy / dist) * accel) * 0.95;
        const sp = Math.hypot(ref.vx, ref.vy);
        if (sp > maxSp) {
          ref.vx = (ref.vx / sp) * maxSp;
          ref.vy = (ref.vy / sp) * maxSp;
        }
      } else {
        ref.isPushing = false;
        ref.vx *= 0.94;
        ref.vy *= 0.94;
      }

      ref.x = Math.max(125, Math.min(RINK.w - 125, ref.x + ref.vx));
      ref.y = ref.side === 'top'
        ? Math.max(18, Math.min(52, ref.y + ref.vy))
        : Math.max(RINK.h - 52, Math.min(RINK.h - 18, ref.y + ref.vy));

      const sp = Math.hypot(ref.vx, ref.vy);
      if (ref.isPushing && sp > 0.14) {
        ref.skatePhase = (ref.skatePhase + 0.045 + sp * 0.025) % (Math.PI * 2);
      } else {
        ref.skatePhase -= Math.sin(ref.skatePhase) * 0.14;
      }

      // L'àrbitre sempre orienta el pit/mirada cap a on és la bola mentre patina per la banda
      const angToBall = Math.atan2(ball.y - ref.y, ball.x - ref.x);
      ref.dir = normalizeAngle(ref.dir + normalizeAngle(angToBall - ref.dir) * 0.16);
      ref.bankAngle = ref.bankAngle * 0.85 + Math.max(-0.18, Math.min(0.18, -ref.vx * 0.06)) * 0.15;
    });
  }

  // --- IA DEL PORTER EQUILIBRADA AMB POSICIONS D'HOQUEI PATINS (PANTALLA, PAS DE VALLA, MITJA SORTIDA, GENOLL A TERRA) ---
  function updateGoalkeeper(gk, dt) {
    const isHome = gk.team === 'home';
    const diffCfg = GK_DIFFICULTY[state.gkDiff] || GK_DIFFICULTY.balanced;
    const goalX = ownGoalX(gk.team);
    const goalY = RINK.h / 2;
    const sign = attackDirection(gk.team);

    const stats = gk.stats || {};
    const posStat = (stats.gkPositioning || 88) / 100;
    const refStat = (stats.gkReflexes || 88) / 100;
    const acroStat = (stats.gkAcrobat || 88) / 100;

    if (gk.gkReactionDelay > 0) {
      gk.gkReactionDelay = Math.max(0, gk.gkReactionDelay - dt);
    }

    const distBallToGoal = Math.hypot(ball.x - goalX, ball.y - goalY);
    const ballBehindGoal = (ball.x-goalX)*sign < 0;
    const ballNearWing = Math.abs(ball.y - goalY) > RINK.goalWidth * 0.52 && Math.abs(ball.x - goalX) < 145;
    const ballMovingToGoal = ball.vx*sign < -2.4 && (ball.x-500)*sign < 0;

    let targetX = goalX + sign * 14;
    let targetY = goalY;

    // DETERMINACIÓ DE LA POSICIÓ OFICIAL DEL PORTER D'HOQUEI PATINS:
    if ((state.mode === 'direct_foul' && gk.team !== state.possessionTeam) || (ball.owner && distBallToGoal < 135 && Math.abs(ball.y - goalY) < 110)) {
      // 1. MITJA SORTIDA: El porter surt 1.5m fora de la línia per reduir tot l'angle de xut a l'atacant!
      gk.gkPosture = 'out';
      targetX = goalX + sign * 25;
      targetY = goalY + (ball.y - goalY) * 0.45;
    } else if (ballBehindGoal || ballNearWing) {
      // 2. GENOLL A TERRA (Mitja papallona al pal curt): Tanca el pal curt sense deixar passar cap bola d'escaire
      gk.gkPosture = 'knee';
      const nearPostY = ball.y < goalY ? (goalY - RINK.goalWidth * 0.36) : (goalY + RINK.goalWidth * 0.36);
      targetX = goalX + sign * 9;
      targetY = nearPostY;
    } else if (ballMovingToGoal && !ball.owner) {
      // 3. PAS DE VALLA (Pas de tanca): Guarda estirada de pal a pal arran de parquet i estic escombrant ras!
      gk.gkPosture = 'valla';
      if (gk.gkReactionDelay <= 0) {
        const t = (goalX - ball.x) / (ball.vx || 1);
        const predY = (t > 0 && t < 72) ? (ball.y + ball.vy * t) : ball.y;
        targetY = Math.max(goalY - RINK.goalWidth * 0.42, Math.min(goalY + RINK.goalWidth * 0.42, predY));
      } else {
        targetY = gk.y;
      }
    } else {
      // 4. PANTALLA: Posició bàsica d'espera baixa amb genolls en A, guardes tancant la base i estic pla tapant el five-hole
      gk.gkPosture = 'screen';
      const clampedY = Math.max(-RINK.goalWidth * 0.36, Math.min(RINK.goalWidth * 0.36, (ball.y - goalY) * (0.34 * posStat)));
      targetX = goalX + sign * 14;
      targetY = goalY + clampedY;
    }

    const baseLatSpeed = isHome ? 2.55 : diffCfg.lateralSpeed;
    const maxLateralStep = baseLatSpeed * refStat * state.paceFactor;
    const dy = targetY - gk.y;
    if (Math.abs(dy) > maxLateralStep) {
      gk.y += Math.sign(dy) * maxLateralStep;
    } else {
      gk.y += dy * 0.28;
    }
    gk.x += (targetX - gk.x) * 0.18;
    gk.dir = Math.atan2(ball.y - gk.y, ball.x - gk.x);

    if (ball.owner !== gk) {
      const dist = Math.hypot(ball.x - gk.x, ball.y - gk.y);
      const baseRadius = isHome ? 10.5 : diffCfg.saveRadius;
      // Els atributs de porter influeixen directament en l'abast d'aturada de les guardes i l'escut
      const saveRadius = baseRadius * (0.85 + acroStat * 0.22);
      if (dist < saveRadius + ball.radius && ball.z <= RINK.goalHeight) {
        if (state.endPeriodAfterSetPiece) { endPeriod(); return; }
        if (!ball.owner && ball.z<2 && Math.hypot(ball.vx,ball.vy)<0.65 &&
            callBooling('pads',ball.x,ball.y,ownGoalX(gk.team))) return;
        clearPassOnTouch(gk);
        state.indirectTaker = null; // A goalkeeper touch also releases the taker.
        if (ball.owner && ball.owner.team !== gk.team) {
          ball.owner.stealCooldown = 0.55;
          ball.owner = null;
        }
        if (state.endPeriodAfterSetPiece) { endPeriod(); return; }
        if (ball.shotByTeam && ball.shotByTeam !== gk.team) { state.saves[gk.team]++; emitFx('save',{team:gk.team}); }
        {
          const rel=normalizeAngle(Math.atan2(ball.y-gk.y,ball.x-gk.x)-gk.dir);
          gk.saveAnim={timer:0.6,duration:0.6,side:Math.sin(rel)>=0?1:-1,high:ball.z>RINK.goalHeight*0.45};
        }
        state.possessionClock = 45;
        ball.reboundedReset = true;
        ball.shotByTeam = null;

        const nx = (ball.x - gk.x) / (dist || 1);
        const ny = (ball.y - gk.y) / (dist || 1);
        const speed = Math.max(4.2 * state.paceFactor, Math.hypot(ball.vx, ball.vy) * 0.62);
        const deflectY = ny >= 0 ? Math.max(0.5, ny) : Math.min(-0.5, ny);
        ball.vx = sign * Math.abs(nx + 0.5) * speed * 0.75;
        ball.vy = deflectY * speed;
        ball.x = gk.x + nx * (saveRadius + ball.radius + 2);
        ball.y = gk.y + ny * (saveRadius + ball.radius + 2);

        const posNames = {
          out: 'MITJA SORTIDA',
          knee: 'GENOLL A TERRA',
          valla: 'PAS DE VALLA',
          screen: 'PANTALLA'
        };
        const postureLabel = posNames[gk.gkPosture] || 'ATURADA';

        if (state.mode === 'direct_foul') state.mode = 'match';
        showBanner('Aturada de ' + gk.name + ' · ' + postureLabel.toLowerCase(), 1.1);
      }
    }
  }

  // Comprova si el passadís entre dos punts està lliure de defensors rivals (per trobar el forat o línia de passada)
  function isLaneClear(x1, y1, x2, y2, defendingTeam, clearance = 28) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) return true;
    for (const d of players) {
      if (playerUnavailable(d) || d.team !== defendingTeam || d.role === 'GK') continue;
      const t = Math.max(0.08, Math.min(0.92, ((d.x - x1) * dx + (d.y - y1) * dy) / lenSq));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      if (Math.hypot(d.x - projX, d.y - projY) < clearance) {
        return false;
      }
    }
    return true;
  }

  function execAIPass(passer,mate) {
    if(playerUnavailable(mate)||mate===passer||mate.team!==passer.team)return false;
    if(state.mode==='free_hit')releaseFreeHit();
    return beginPass(passer,mate);
  }

  function aiProfile(p) {
    return p.team === 'away' ? (AI_LEVELS[state.aiLevel] || AI_LEVELS.balanced) : AI_LEVELS.balanced;
  }

  // Qualitat d'una posició de xut (0-1): distància, angle i línies lliures cap als pals.
  function shotQuality(team, x, y) {
    const sign = attackDirection(team), gx = opponentGoalX(team), gy = RINK.h / 2;
    const depth = (gx - x) * sign;
    if (depth < 18) return 0;
    const dist = Math.hypot(gx - x, gy - y);
    const angle = Math.atan2(Math.abs(y - gy), depth);
    let q = (1 - Math.max(0, dist - 90) / 270) * Math.max(0, Math.cos(angle * 1.15));
    const opp = team === 'home' ? 'away' : 'home';
    const laneA = isLaneClear(x, y, gx, gy - RINK.goalWidth * 0.35, opp, 15);
    const laneB = isLaneClear(x, y, gx, gy + RINK.goalWidth * 0.35, opp, 15);
    if (!laneA && !laneB) q *= 0.25;
    else if (!laneA || !laneB) q *= 0.72;
    return Math.max(0, Math.min(1, q));
  }

  function nearestOpponentDistance(team, x, y) {
    let best = Infinity;
    for (const d of players) {
      if (d.team === team || d.role === 'GK' || playerUnavailable(d)) continue;
      best = Math.min(best, Math.hypot(d.x - x, d.y - y));
    }
    return best;
  }

  function passOptionScore(p, mate) {
    const d = Math.hypot(mate.x - p.x, mate.y - p.y);
    if (d < 60 || d > 460) return -Infinity;
    const opp = p.team === 'home' ? 'away' : 'home';
    if (!isLaneClear(p.x, p.y, mate.x, mate.y, opp, 20 + d * 0.03)) return -Infinity;
    const open = Math.min(120, nearestOpponentDistance(p.team, mate.x, mate.y));
    const progress = (mate.x - p.x) * attackDirection(p.team);
    return shotQuality(p.team, mate.x, mate.y) * 1.4 + open / 120 * 0.6 + progress / 500;
  }

  // Defensa individual: cada defensor (menys el que pressiona) agafa l'atacant lliure més proper.
  function markAssignments(team) {
    if (aiMarkCache.frame === state.simFrame && aiMarkCache.team === team) return aiMarkCache.map;
    const map = new Map();
    const attackers = players.filter(a => a.team !== team && a.role !== 'GK' && !playerUnavailable(a) && a !== ball.owner);
    const defenders = players.filter(d => d.team === team && d.role !== 'GK' && !playerUnavailable(d))
      .sort((a, b) => a.idx - b.idx);
    const goal = ownGoalX(team);
    attackers.sort((a, b) => Math.abs(a.x - goal) - Math.abs(b.x - goal));
    const free = new Set(defenders);
    for (const a of attackers) {
      let best = null, bestD = Infinity;
      for (const d of free) {
        const dist = Math.hypot(d.x - a.x, d.y - a.y);
        if (dist < bestD) { bestD = dist; best = d; }
      }
      if (best) { map.set(best, a); free.delete(best); }
    }
    aiMarkCache.frame = state.simFrame; aiMarkCache.team = team; aiMarkCache.map = map;
    return map;
  }

  function updateAISkater(p, dt = 0.016) {
    if(state.passFlight?.receiver===p&&!ball.owner&&!playerUnavailable(p)) {
      const dx=ball.x-p.x,dy=ball.y-p.y,d=Math.hypot(dx,dy);
      const speed=Math.min(skatingSpeed(p),d*0.06);
      p.vx=p.vx*0.75+(dx/Math.max(1,d))*speed*0.25;
      p.vy=p.vy*0.75+(dy/Math.max(1,d))*speed*0.25;
      p.dir=Math.atan2(dy,dx);p.isPushing=d>30;
      return;
    }
    if (state.booling?.phase === 'live' && p === state.booling.takers.away) {
      state.booling.reaction = Math.max(0,state.booling.reaction-dt);
      if (state.booling.reaction>0) { p.vx=p.vy=0; return; }
    }
    const isHome = p.team === 'home';
    const oppTeam = isHome ? 'away' : 'home';
    const diffCfg = GK_DIFFICULTY[state.gkDiff] || GK_DIFFICULTY.balanced;
    const attackDir = attackDirection(p.team);
    const oppGoalX = opponentGoalX(p.team);
    const ownGoal = ownGoalX(p.team);
    const now = performance.now() * 0.001;

    if (state.mode === 'direct_foul' && p === state.directShooter) { p.vx = p.vy = 0; return; }
    if ((state.mode === 'direct_foul' && !state.setPieceReady) || state.mode === 'kickoff') {
      p.vx *= 0.85;
      p.vy *= 0.85;
      return;
    }

    // Base 23.1 RFEP 26/27: Jugador exclòs 2 minuts per Targeta Blava (s'espera a la banqueta d'exclosos al costat de la Mesa de Control)
    if (playerUnavailable(p)) {
      const benchX = isHome ? 465 : 535;
      const benchY = 14;
      p.x += (benchX - p.x) * 0.18;
      p.y += (benchY - p.y) * 0.18;
      p.vx = 0;
      p.vy = 0;
      p.isPushing = false;
      p.dir = Math.PI / 2;
      return;
    }

    let tx = p.homeX;
    let ty = p.homeY;
    let sprint = false;

    if(updateDefensiveRecovery(p,dt))return;

    // Comprova quin jugador del mateix equip és el més proper a la bola
    const distToBall = Math.hypot(ball.x - p.x, ball.y - p.y);
    let isClosestTeammateToBall = p!==state.passBlockedPlayer && (!state.passFlight||state.passFlight.passer.team!==p.team);
    players.forEach((other, oIdx) => {
      if (other.team === p.team && other !== p && other.role !== 'GK' && oIdx !== state.controlledIdx) {
        if (playerUnavailable(other)||other===state.passBlockedPlayer) return;
        if (Math.hypot(ball.x - other.x, ball.y - other.y) < distToBall) {
          isClosestTeammateToBall = false;
        }
      }
    });

    // =========================================================================
    // A) JUGADOR DE LA IA AMB BOLA: Circular, passar o entrar pel forat!
    // =========================================================================
    if (ball.owner === p && p.pendingShot) {
      const ps = p.pendingShot;
      ps.timer -= dt;
      p.vx *= 0.97; p.vy *= 0.97;
      p.dir = normalizeAngle(p.dir + normalizeAngle(ps.angle - p.dir) * 0.2);
      if (ps.timer <= 0) { p.pendingShot = null; launchShot(p, ps.angle, ps.power, ps.gesture); }
      return;
    }
    if (p.pendingShot && ball.owner !== p) p.pendingShot = null;
    if (ball.owner === p) {
      p.aiHoldTimer = (p.aiHoldTimer || 0) + dt;
      const inOwnHalf = isInOwnHalf(p.team, p.x);

      const lvl = aiProfile(p);
      const pressure = nearestOpponentDistance(p.team, p.x, p.y);
      p.aiDecisionTimer = (p.aiDecisionTimer ?? lvl.reaction) - dt;

      if (inOwnHalf) {
        // A pista pròpia: prioritat a travessar la divisòria (regles dels 10 s i 5 s).
        tx = RINK.w / 2 + attackDir * 115;
        ty = p.y < RINK.h / 2 ? 145 : 355;
        sprint = true;
      } else {
        // A pista d'atac: entrar pel forat si n'hi ha; si no, circular per fora (ferradura).
        const slotX = oppGoalX - attackDir * 85;
        const slotY = RINK.h / 2 + (p.y < RINK.h / 2 ? -28 : 28);
        const hasOpenLaneToGoal = isLaneClear(p.x, p.y, slotX, slotY, oppTeam, 32);
        if (hasOpenLaneToGoal && pressure > 62) {
          tx = slotX; ty = slotY; sprint = true;
        } else {
          tx = oppGoalX - attackDir * 225;
          ty = RINK.h / 2 + Math.sin(now * 1.4 + p.idx * 1.7) * 145;
          sprint = false;
        }
      }

      // Protegeix la bola: s'allunya del defensor més proper mentre avança.
      if (pressure < 70) {
        let nearest = null;
        for (const d of players) {
          if (d.team === p.team || d.role === 'GK' || playerUnavailable(d)) continue;
          if (!nearest || Math.hypot(d.x - p.x, d.y - p.y) < Math.hypot(nearest.x - p.x, nearest.y - p.y)) nearest = d;
        }
        if (nearest) {
          const away = Math.atan2(p.y - nearest.y, p.x - nearest.x);
          const push = (70 - pressure) * 1.6;
          tx += Math.cos(away) * push;
          ty += Math.sin(away) * push;
        }
      }

      // Decisions amb temps de reacció (segons la dificultat): xutar, passar o seguir conduint.
      if (p.aiDecisionTimer <= 0) {
        p.aiDecisionTimer = lvl.reaction * (0.8 + Math.random() * 0.4);
        const myShot = inOwnHalf ? 0 : shotQuality(p.team, p.x, p.y);
        const distToGoal = Math.hypot(oppGoalX - p.x, RINK.h / 2 - p.y);
        const urgency = (state.possessionClock < 10 ? 0.22 : 0) + Math.min(0.15, p.aiHoldTimer * 0.04);
        const threshold = 0.52 - lvl.shootBias - urgency;
        if (myShot > threshold && distToGoal < 270 && p.aiHoldTimer > 0.25) {
          // Apunta al pal que el porter deixa més obert, amb error segons la dificultat.
          const keeper = players.find(k => k.team === oppTeam && k.role === 'GK' && !playerUnavailable(k));
          const offset = keeper ? keeper.y - RINK.h / 2 : 0;
          const side = Math.abs(offset) > 3 && Math.random() < 0.7 ? -Math.sign(offset) : (Math.random() < 0.5 ? -1 : 1);
          const error = (Math.random() - 0.5) * RINK.goalWidth * lvl.aimError * 2;
          const aimY = RINK.h / 2 + side * RINK.goalWidth * 0.3 + error;
          // Preparació visible del xut (l'estic s'aixeca) abans de disparar.
          const angle = Math.atan2(aimY - p.y, oppGoalX - p.x);
          const power = Math.min(0.95, 0.58 + myShot * 0.3 + Math.random() * 0.1);
          p.pendingShot = { angle, power, gesture: chooseShotGesture(p, angle), timer: 0.3, duration: 0.3 };
          return;
        }
        let bestMate = null, bestScore = -Infinity;
        for (const mate of players) {
          if (mate.team !== p.team || mate === p || mate.role === 'GK' || playerUnavailable(mate)) continue;
          const score = passOptionScore(p, mate) + Math.random() * 0.12;
          if (score > bestScore) { bestScore = score; bestMate = mate; }
        }
        const holdValue = myShot * 1.4 + Math.min(pressure, 120) / 120 * 0.6;
        const mustRelease = p.aiHoldTimer > 2.6 || (inOwnHalf && state.halfCourtClock < 3 && pressure < 60);
        if (bestMate && bestScore > -Infinity &&
            (bestScore > holdValue + 0.25 || (pressure < 40 && bestScore > holdValue - 0.15) || mustRelease) &&
            p.aiHoldTimer > 0.35) {
          execAIPass(p, bestMate);
          return;
        }
      }
    }
    // =========================================================================
    // B) COMPANYS EN ATAC SENSE BOLA: Ocupar ales, distribuïdor i tallar als forats!
    // =========================================================================
    else if (state.possessionTeam === p.team) {
      if (!ball.owner && isClosestTeammateToBall) {
        // Només el receptor més proper va a buscar la passada / bola solta!
        tx = ball.x + ball.vx * 8;
        ty = ball.y + ball.vy * 8;
        sprint = true;
      } else {
        // Estructura d'atac posicional 4v4 d'Hoquei Patins (Ferradura 1-2-1 + Talls al 2n pal)
        const cutCycle = Math.sin(now * 1.15 + p.idx * 2.1);
        if (p.idx === 1) {
          // TANCA / DISTRIBUÏDOR: A la frontal alta per donar línia de passada de seguretat i canviar de banda
          tx = RINK.w / 2 + attackDir * 115;
          ty = RINK.h / 2 + Math.sin(now * 0.9) * 65;
        } else if (p.idx === 2) {
          // ALA SUPERIOR (Esquerra): Obert a la banda, i quan la bola és a l'altra banda fa tall diagonal al 2n pal!
          const cuttingIn = ball.y > 275 && cutCycle > 0.25;
          tx = oppGoalX - attackDir * (cuttingIn ? 92 : 185);
          ty = cuttingIn ? 175 : (95 + Math.sin(now * 1.1) * 22);
          sprint = cuttingIn;
        } else if (p.idx === 3) {
          // ALA INFERIOR (Dreta): Obert a la banda inferior, i quan la bola és a dalt talla al 2n pal!
          const cuttingIn = ball.y < 225 && cutCycle > 0.25;
          tx = oppGoalX - attackDir * (cuttingIn ? 92 : 185);
          ty = cuttingIn ? 325 : (405 + Math.cos(now * 1.1) * 22);
          sprint = cuttingIn;
        } else {
          // BOIA / INTERIOR: Es mou entre la mitja lluna i el pal contrari buscant l'esquena del quadre defensiu
          tx = oppGoalX - attackDir * (110 + Math.sin(now * 1.4) * 30);
          ty = ball.y > RINK.h / 2 ? 170 : 330;
        }

        // Regla d'espaiat (Spacing): Si el portador de la bola s'acosta a la teva zona, rota i obre espai!
        const carrier = ball.owner;
        if (carrier && carrier.team === p.team) {
          const dCarrier = Math.hypot(tx - carrier.x, ty - carrier.y);
          if (dCarrier < 115) {
            ty = carrier.y > RINK.h / 2 ? Math.max(85, ty - 110) : Math.min(415, ty + 110);
            tx = 500 + attackDir*Math.max(45,Math.min(390,(tx-500)*attackDir-45));
          }
        }
      }
    }
    // =========================================================================
    // C) EQUIP EN DEFENSA: Quadre Defensiu Zonal (2-2) + Només 1 surt a tapar forat!
    // =========================================================================
    else {
      const dirFromOwnGoal = attackDir;
      const lvl = aiProfile(p);
      const trailingLate = state.period === 2 && state.timeRemaining < 300 &&
        state.score[p.team] < state.score[oppTeam];
      const highPress = (lvl.highPress && p.team === 'away') || trailingLate;
      const ballInDefHalf = (ball.x-500)*attackDir < (highPress ? 160 : 65);

      // Quadre defensiu base (2 defensors tancant l'àrea + 2 puntes), desplaçat cap a la bola.
      const shiftY = (ball.y - RINK.h / 2) * 0.34;
      const lineUp = highPress && !((ball.x-500)*attackDir < 0) ? 70 : 0;
      let zoneX = ownGoal + dirFromOwnGoal * (115 + lineUp);
      let zoneY = RINK.h / 2;
      if (p.idx === 1) { zoneX = ownGoal + dirFromOwnGoal * (92 + lineUp); zoneY = 190 + shiftY * 0.75; }
      else if (p.idx === 2) { zoneX = ownGoal + dirFromOwnGoal * (92 + lineUp); zoneY = 310 + shiftY * 0.75; }
      else if (p.idx === 3) { zoneX = ownGoal + dirFromOwnGoal * (185 + lineUp); zoneY = 165 + shiftY; }
      else { zoneX = ownGoal + dirFromOwnGoal * (185 + lineUp); zoneY = 335 + shiftY; }

      // Qui és el defensor més ben situat per tallar la passada en curs?
      let interceptPoint = null;
      const pass = state.passFlight;
      if (pass && !ball.owner && pass.passer.team !== p.team && Math.random() < lvl.intercept + 0.15) {
        const lx = pass.receiver.x - ball.x, ly = pass.receiver.y - ball.y, len2 = lx * lx + ly * ly || 1;
        let best = null, bestD = Infinity, bestPoint = null;
        for (const d of players) {
          if (d.team !== p.team || d.role === 'GK' || playerUnavailable(d) || players.indexOf(d) === state.controlledIdx) continue;
          const t = Math.max(0.15, Math.min(0.9, ((d.x - ball.x) * lx + (d.y - ball.y) * ly) / len2));
          const px = ball.x + lx * t, py = ball.y + ly * t;
          const dd = Math.hypot(d.x - px, d.y - py);
          if (dd < bestD) { bestD = dd; best = d; bestPoint = { x: px, y: py }; }
        }
        if (best === p && bestD < 120 * lvl.intercept) interceptPoint = bestPoint;
      }

      if (interceptPoint) {
        tx = interceptPoint.x; ty = interceptPoint.y; sprint = true;
      } else if (!ball.owner && isClosestTeammateToBall && distToBall < 220) {
        // Bola dividida a prop: només el defensor més proper surt a recuperar-la.
        tx = ball.x; ty = ball.y; sprint = true;
      } else if (isClosestTeammateToBall && ballInDefHalf) {
        // Pressió al portador per la línia bola-porteria (tapa el forat central).
        const toGoal = Math.atan2(RINK.h / 2 - ball.y, ownGoal - ball.x);
        const gap = distToBall > 60 ? 26 : 14;
        tx = ball.x + Math.cos(toGoal) * gap;
        ty = ball.y + Math.sin(toGoal) * gap;
        sprint = distToBall > 45;

        if (p.team === 'away' && distToBall < 25 && p.stealCooldown <= 0 && ball.owner) {
          p.stealCooldown = 1.05 - (lvl.steal - 0.34);
          p.pokeTimer = 0.26;
          const carrierSkill = ((ball.owner.stats && (ball.owner.stats.pass || ball.owner.stats.ovr)) || 85) / 85;
          const tackleSkill = ((p.stats && (p.stats.tackle || p.stats.def)) || 85) / 85;
          if (Math.random() < lvl.foul) {
            registerFoul('away', false, p);
          } else if (Math.random() < lvl.steal * tackleSkill / carrierSkill) {
            ball.owner.stealCooldown = 0.55;
            ball.owner.hitTimer = 0.45;
            setBallOwner(p);
            emitFx('tackle');
          }
        }
      } else {
        // Marcatge a l'home amb forma zonal: costat de porteria del seu atacant, sense desfer el quadre.
        const mark = markAssignments(p.team).get(p);
        if (mark) {
          const gx = ownGoal - mark.x, gy = RINK.h / 2 - mark.y, len = Math.hypot(gx, gy) || 1;
          const gap = 30 + Math.min(40, len * 0.08);
          const mx = mark.x + gx / len * gap, my = mark.y + gy / len * gap;
          const weight = ballInDefHalf ? 0.65 : 0.35;
          tx = mx * weight + zoneX * (1 - weight);
          ty = my * weight + zoneY * (1 - weight);
          sprint = Math.hypot(tx - p.x, ty - p.y) > 70;
        } else {
          tx = zoneX; ty = zoneY; sprint = false;
        }
      }
    }

    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 14) {
      p.isPushing = true;
      const teamHandicap = p.team === 'away' ? diffCfg.defSpeedMul : 1.0;
      const sprintBoost = sprint ? 1.18 : 1;
      const maxSp = skatingSpeed(p,sprintBoost)*teamHandicap;
      const targetAngle = Math.atan2(dy, dx);
      const diffAng = normalizeAngle(targetAngle - p.dir);
      // Gir en corba progressiu sobre patins amb inclinació lateral (cantells)
      p.dir = normalizeAngle(p.dir + Math.max(-0.11, Math.min(0.11, diffAng * 0.22)));
      p.bankAngle = p.bankAngle * 0.85 + Math.max(-0.26, Math.min(0.26, diffAng * 0.42)) * 0.15;

      const pushAccel = 0.15 * state.paceFactor * sprintBoost;
      p.vx = (p.vx + (dx / dist) * pushAccel) * 0.962;
      p.vy = (p.vy + (dy / dist) * pushAccel) * 0.962;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > maxSp) {
        p.vx = (p.vx / sp) * maxSp;
        p.vy = (p.vy / sp) * maxSp;
      }
    } else {
      // Fase de lliscament sobre les 8 rodes (sense pedalar les cames)
      p.isPushing = false;
      p.vx *= 0.968;
      p.vy *= 0.968;
      p.bankAngle *= 0.85;
      // Si està aturat al quadre o a l'ala sense bola, mira cap a la bola a punt per rebre o interceptar
      const angToBall = Math.atan2(ball.y - p.y, ball.x - p.x);
      p.dir = normalizeAngle(p.dir + normalizeAngle(angToBall - p.dir) * 0.12);
    }
  }

  // Moviment dels jugadors durant les aturades (xiulet i celebració de gol): ningú queda congelat.
  function updateStoppage(dt) {
    const st = state.stoppage;
    if (st) st.t = (st.t || 0) + dt;
    const ref = referees.length ? referees.reduce((best, r) =>
      Math.hypot(r.x - ball.x, r.y - ball.y) < Math.hypot(best.x - ball.x, best.y - ball.y) ? r : best) : null;
    for (const p of players) {
      if (playerUnavailable(p)) continue;
      if (p.stealCooldown > 0) p.stealCooldown = Math.max(0, p.stealCooldown - dt);
      if (p.pokeTimer > 0) p.pokeTimer = Math.max(0, p.pokeTimer - dt);
      if (p.role === 'GK') { p.vx *= 0.85; p.vy *= 0.85; continue; }
      let tx = null, ty = null, speed = 0, face = null;
      if (st && st.type === 'goal') {
        const scorer = st.scorer && !playerUnavailable(st.scorer) ? st.scorer : null;
        if (p.team === st.team) {
          if (p === scorer) { tx = st.cx; ty = st.cy; speed = 1.7; }
          else if (scorer && st.t > 0.3) {
            const ang = Math.atan2(p.y - scorer.y, p.x - scorer.x);
            tx = scorer.x + Math.cos(ang) * 30; ty = scorer.y + Math.sin(ang) * 30; speed = 2.0;
            face = scorer;
          }
        } else if (st.t > 0.9) {
          tx = 500 + (p.homeX - 500) * 0.4; ty = p.homeY; speed = 0.55;
        }
      } else if (st && (st.type === 'foul' || st.type === 'card')) {
        if (p === st.victim) { p.vx *= 0.82; p.vy *= 0.82; }
        else if (st.protesters && st.protesters.includes(p) && st.t > 0.35 && ref) {
          const ang = Math.atan2(p.y - ref.y, p.x - ref.x);
          tx = ref.x + Math.cos(ang) * 46; ty = ref.y + Math.sin(ang) * 46; speed = 1.25; face = ref;
        } else face = ref;
      } else face = ref;

      if (tx !== null) {
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        if (d > 10) {
          p.isPushing = true;
          const maxSp = speed * state.paceFactor * 1.6;
          p.vx = (p.vx + dx / d * 0.12 * state.paceFactor) * 0.95;
          p.vy = (p.vy + dy / d * 0.12 * state.paceFactor) * 0.95;
          const sp = Math.hypot(p.vx, p.vy);
          if (sp > maxSp) { p.vx *= maxSp / sp; p.vy *= maxSp / sp; }
          p.dir = normalizeAngle(p.dir + normalizeAngle(Math.atan2(p.vy, p.vx) - p.dir) * 0.15);
        } else tx = null;
      }
      if (tx === null) {
        p.isPushing = false;
        p.vx *= 0.94; p.vy *= 0.94;
        if (face && Math.hypot(p.vx, p.vy) < 0.6) {
          p.dir = normalizeAngle(p.dir + normalizeAngle(Math.atan2(face.y - p.y, face.x - p.x) - p.dir) * 0.06);
        }
      }
      p.bankAngle = (p.bankAngle || 0) * 0.9;
      p.x += p.vx; p.y += p.vy;
      constrainToRink(p, 0.25);
      collideWithGoalFrames(p, false);
    }
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i], b = players[j];
        if (playerUnavailable(a) || playerUnavailable(b)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), minDist = a.radius + b.radius;
        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) * 0.5, nx = dx / dist, ny = dy / dist;
          if (a.role !== 'GK') { a.x -= nx * overlap; a.y -= ny * overlap; }
          if (b.role !== 'GK') { b.x += nx * overlap; b.y += ny * overlap; }
        }
      }
    }
  }

  // ============================================================================
  // 8. BUCLE D'ACTUALITZACIÓ I REGLES D'HOQUEI PATINS (WSE / RFEP)
  // ============================================================================
  function update(dt) {
    if (state.paused || state.mode === 'finished' || replayState.active) return;
    state.simFrame = (state.simFrame || 0) + 1;
    state.switchWindow=Math.max(0,state.switchWindow-dt);
    if (state.mode === 'halftime') {
      const rest = Math.min(dt*clockScale(),state.halftimeRemaining);
      state.halftimeRemaining = Math.max(0,state.halftimeRemaining-rest);
      updateFitness(rest,true);
      if (state.halftimeRemaining <= 0) beginSecondHalf();
      return;
    }
    if (state.pendingRestart) {
      state.pendingRestart.remaining -= dt;
      if (state.pendingRestart.remaining <= 0) {
        const action = state.pendingRestart.action;
        state.pendingRestart = null;
        action();
        if (['free_hit','direct_foul','booling'].includes(state.mode)) return;
      }
    }

    if (state.bannerTimer > 0) state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.cardEvent) {
      state.cardEvent.timer = Math.max(0, state.cardEvent.timer - dt);
      if (state.cardEvent.timer <= 0) state.cardEvent = null;
    }

    if (state.mode === 'whistle_pause' || state.mode === 'goal_celebration') {
      updateStoppage(dt);
      updateReferees(dt);
      return;
    }

    if (state.mode === 'booling') { updateBooling(dt);updateReferees(dt);return; }
    if (checkNeutralStoppage()) return;

    if (state.mode === 'free_hit') {
      holdFreeHit();
      const restart = state.freeHit;
      if (restart.team === 'away') {
        restart.taker.aiHoldTimer += dt;
        if (restart.taker.aiHoldTimer > 1.1) {
          const mate = players.find(p => p.team === restart.team && p !== restart.taker && p.role !== 'GK' && !playerUnavailable(p));
          execAIPass(restart.taker,mate);
        }
      }
      updateReferees(dt);
      return;
    }

    if (state.mode === 'direct_foul' && !state.setPieceReady) {
      players.forEach(p => { p.vx = p.vy = 0; });
      ball.vx = ball.vy = ball.vz = ball.z = 0;
      state.chargingShot = false;
      state.shotCharge = 0;
      state.setPieceWait = Math.max(0,state.setPieceWait-dt);
      if (state.setPieceWait <= 1e-8) {
        state.setPieceReady = true;
        triggerRefereeSignal('whistle',ball.x,ball.y,'XIULET · BOLA EN JOC',null,1.5);
        showBanner('XIULET · BOLA EN JOC!',1.5,'Ja pots executar · La resta de jugadors poden sortir de l’àrea');
      }
      updateReferees(dt);
      return;
    }

    if (state.mode === 'match' || state.mode === 'direct_foul') {
      // El rellotge de partit (i les sancions i el desgast que en depenen) corre accelerat
      // segons la durada triada; el joc i els comptadors de 45/10/5 s segueixen en segons reals.
      const elapsed = Math.min(dt*clockScale(),state.timeRemaining);
      state.timeRemaining = Math.max(0, state.timeRemaining - elapsed);
      updateSanctions(elapsed);
      updateFitness(elapsed);
      if (state.mode === 'finished') return;
      if (state.timeRemaining <= 1e-8) { endPeriod(); return; }
    }
    if (state.mode === 'match' && !state.neutralPossession) {
      state.possessionClock = Math.max(0, state.possessionClock - dt);

      const posTeam = state.possessionTeam;
      const nextTeam = posTeam === 'home' ? 'away' : 'home';

      // 1) REGLA DELS 10 SEGONS (Sortida inicial de pista pròpia cap a pista contrària)
      if (!state.crossedHalfCourt) {
        if (isInAttackingHalf(posTeam, ball.x)) {
          state.crossedHalfCourt = true;
          state.backCourtClock = 5;
        } else {
          state.halfCourtClock = Math.max(0, state.halfCourtClock - dt);
          if (state.halfCourtClock <= 0) {
            callRuleViolation(
              '⚠️ 10 SEGONS EN CAMP PROPI!',
              'Quan surts del teu camp tens 10 segons màxim per travessar la línia divisòria',
              nextTeam,
              RINK.w / 2,
              RINK.h / 2
            );
            return;
          }
        }
      } else {
        // 2) REGLA DELS 5 SEGONS QUAN ES TORNA A CAMP PROPI (Retorn a pista pròpia un cop ja s'havia creuat)
        // Si la bola torna al camp propi per un rebot del porter o del pal (reboundedReset), s'inicia cicle nou de 10s
        if (ball.reboundedReset && isInOwnHalf(posTeam, ball.x)) {
          ball.reboundedReset = false;
          state.crossedHalfCourt = false;
          state.halfCourtClock = 10;
          state.backCourtClock = 5;
        } else if (isInOwnHalf(posTeam, ball.x) && !ball.shotByTeam) {
          state.backCourtClock = Math.max(0, state.backCourtClock - dt);
          if (state.backCourtClock <= 0) {
            callRuleViolation(
              '⚠️ 5 SEGONS EN CAMP PROPI (CAMP ENRERE)!',
              'Quan tornes al teu camp tens 5 segons per tornar a pista contrària',
              nextTeam,
              RINK.w / 2,
              Math.max(100, Math.min(400, ball.y))
            );
            return;
          }
        } else if (isInAttackingHalf(posTeam, ball.x)) {
          // Ha tornat a pista contrària dins dels 5 segons reglamentaris!
          state.backCourtClock = 5;
        }
      }

      // 4) REGLA DE POSSESSIÓ DE 45 SEGONS
      if (state.possessionClock <= 0) {
        callRuleViolation(
          '⚠️ POSSESSIÓ DE 45 SEGONS EXHAURIDA!',
          'Canvi de possessió per límit de 45s sense xut a porteria',
          nextTeam,
          RINK.w / 2,
          RINK.h / 2
        );
        return;
      }
    } else if (state.mode === 'direct_foul') {
      const shooter = state.directShooter;
      if (shooter && shooter.team === 'away' && ball.owner === shooter) {
        shooter.aiHoldTimer += dt;
        if (shooter.aiHoldTimer >= 1.2) {
          const angle = Math.atan2(RINK.h/2 + (Math.random()-0.5)*RINK.goalWidth*0.6 - shooter.y, opponentGoalX('away')-shooter.x);
          launchShot(shooter,angle,0.78);
          state.mode = 'match';
        }
      }
    } else if (state.mode === 'kickoff') {
      // Si és el rival qui sac de centre, fa la passada inicial automàticament al cap d'1s
      if (state.possessionTeam === 'away' && ball.owner === state.kickoffTaker) {
        state.kickoffTaker.aiHoldTimer = (state.kickoffTaker.aiHoldTimer || 0) + dt;
        if (state.kickoffTaker.aiHoldTimer > 1.1) {
          state.kickoffTaker.aiHoldTimer = 0;
          state.mode = 'match';
          const mate = Math.random() < 0.5 ? players[7] : players[8];
          execAIPass(state.kickoffTaker, playerUnavailable(mate) || mate === state.kickoffTaker ? players.find(p => p.team === 'away' && p !== state.kickoffTaker && p.role !== 'GK' && !playerUnavailable(p)) : mate);
          triggerRefereeSignal('whistle', 500, RINK.h / 2, '📣 BOLA EN JOC!', null, 1.2);
          showBanner('BOLA EN JOC!', 1.0);
        }
      }
    }

    const me = getControlledPlayer();
    const inp = getInputVector();
    const sprinting = keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyL'] || keys['KeyC'] || touchInput.sprint;

    if (state.chargingShot) {
      state.shotCharge = Math.min(1, state.shotCharge + dt * 1.05);
    }

    if (me) {
      if (state.mode === 'kickoff' && me === state.kickoffTaker) {
        // En servei de centre el servidor no pot creuar a camp contrari abans de passar
        const sign = attackDirection('home');
        me.x = 500 + sign*Math.max(-24,Math.min(-12,(me.x-500)*sign));
      }
      if (ball.owner === me) {
        state.aimTargetY = computeAimTargetY(me);
      }
      const boost = (sprinting && me.stamina > 8) ? 1.22 : 1.0;
      if (sprinting && inp.len > 0.2) me.stamina = Math.max(0, me.stamina - dt * 15);
      else me.stamina = Math.min(100, me.stamina + dt * 12);

      // FÍSICA DE PATINATGE SOBRE 4 RODES (Impuls progressiu + Lliscament amb inèrcia + Gir en corba)
      const maxSpeed = skatingSpeed(me,boost)*(state.chargingShot ? 0.82 : 1);

      if (inp.len > 0.12) {
        me.isPushing = true;
        const targetDir = Math.atan2(inp.dy, inp.dx);
        const angleDiff = normalizeAngle(targetDir - me.dir);

        // Gir sobre patins suau amb inclinació del cos (carving)
        const turnStep = Math.max(-0.14, Math.min(0.14, angleDiff * 0.28));
        me.dir = normalizeAngle(me.dir + turnStep);
        me.bankAngle = me.bankAngle * 0.82 + Math.max(-0.28, Math.min(0.28, angleDiff * 0.45)) * 0.18;

        // Si patines a contrapèl de la inèrcia actual, els patins frenen primer (frenada en T / cantells)
        const currSp0 = Math.hypot(me.vx, me.vy);
        const dotVel = currSp0 > 0.2 ? ((me.vx * inp.dx + me.vy * inp.dy) / currSp0) : 1;
        const skateFriction = dotVel < -0.25 ? 0.915 : 0.962;
        const pushAccel = 0.15 * state.paceFactor * boost;

        me.vx = (me.vx + inp.dx * pushAccel) * skateFriction;
        me.vy = (me.vy + inp.dy * pushAccel) * skateFriction;
      } else {
        // Quan deixes anar el comandament, el jugador LLISCA sobre les rodes mantenint la posició flexionada!
        me.isPushing = false;
        me.vx *= 0.978;
        me.vy *= 0.978;
        me.bankAngle *= 0.85;
        const currSp0 = Math.hypot(me.vx, me.vy);
        if (currSp0 > 0.35) {
          const velDir = Math.atan2(me.vy, me.vx);
          me.dir = normalizeAngle(me.dir + normalizeAngle(velDir - me.dir) * 0.15);
        }
      }

      const currSp = Math.hypot(me.vx, me.vy);
      if (currSp > maxSpeed) {
        me.vx = (me.vx / currSp) * maxSpeed;
        me.vy = (me.vy / currSp) * maxSpeed;
      }
    }

    players.forEach((p, idx) => {
      if (p.stealCooldown > 0) p.stealCooldown = Math.max(0, p.stealCooldown - dt);
      if (p.pokeTimer > 0) p.pokeTimer = Math.max(0, p.pokeTimer - dt);
      if (playerUnavailable(p)) {
        p.vx = p.vy = 0;
        return;
      }
      if (p.role === 'GK') updateGoalkeeper(p, dt);
      else if (idx !== state.controlledIdx && state.mode !== 'whistle_pause') updateAISkater(p, dt);

      if (p.role !== 'GK') {
        p.x += p.vx;
        p.y += p.vy;
        const sp = Math.hypot(p.vx, p.vy);
        // Cadència pausada d'impuls de patinatge (només quan s'impulsa activament; si llisca, manté els dos patins a terra)
        if (p.isPushing && sp > 0.15) {
          p.skatePhase = (p.skatePhase + 0.048 + sp * 0.026) % (Math.PI * 2);
        } else {
          // Suavitza la fase cap a la posició de lliscament neutra amb els dos patins paral·lels
          const sinVal = Math.sin(p.skatePhase);
          p.skatePhase -= sinVal * 0.14;
        }
        p.stickPhase += (0.035 + sp * 0.025);
        constrainToRink(p, 0.25);
        collideWithGoalFrames(p, false);
      }
    });

    if (['halftime','finished','whistle_pause'].includes(state.mode)) return;
    updateReferees(dt);

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i];
        const b = players[j];
        if (playerUnavailable(a) || playerUnavailable(b)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (state.mode === 'match' && (ball.x>RINK.goalLineOffset+RINK.areaDepth && ball.x<RINK.w-RINK.goalLineOffset-RINK.areaDepth || Math.abs(ball.y-RINK.h/2)>RINK.areaWidth/2) && a.team!==b.team && a.role!=='GK' && b.role!=='GK' &&
            a.pokeTimer>0 && b.pokeTimer>0 && dist<minDist+3 &&
            Math.hypot(a.x-ball.x,a.y-ball.y)<40 && Math.hypot(b.x-ball.x,b.y-ball.y)<40 &&
            ((a.vx-b.vx)*dx+(a.vy-b.vy)*dy)/Math.max(1,dist)>1.2) {
          registerSimultaneousFouls(a.team==='home'?a:b,a.team==='away'?a:b);
          return;
        }
        if (dist < minDist && dist > 0.001) {
          if (a.team !== b.team && Math.hypot(a.vx - b.vx, a.vy - b.vy) > 1.6) {
            if (!(a.hitTimer > 0)) a.hitTimer = 0.3;
            if (!(b.hitTimer > 0)) b.hitTimer = 0.3;
          }
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          if (a.role !== 'GK') { a.x -= nx * overlap; a.y -= ny * overlap; }
          if (b.role !== 'GK') { b.x += nx * overlap; b.y += ny * overlap; }
        }
      }
    }

    if (ball.owner) {
      const o = ball.owner;
      // Protecció de la bola: si un rival s'acosta per un costat, la bola passa al costat lliure.
      let shieldTarget = 0;
      if (o.role !== 'GK' && state.mode === 'match') {
        let best = 66;
        for (const d of players) {
          if (d.team === o.team || d.role === 'GK' || playerUnavailable(d)) continue;
          const dx = d.x - o.x, dy = d.y - o.y, dist = Math.hypot(dx, dy);
          const fwd = dx * Math.cos(o.dir) + dy * Math.sin(o.dir);
          if (dist < best && fwd > -25) {
            best = dist;
            const lat = -dx * Math.sin(o.dir) + dy * Math.cos(o.dir);
            shieldTarget = (lat >= 0 ? 1 : -1) * Math.min(1, (1 - dist / 66) * 1.8);
          }
        }
      }
      o.shield = (o.shield || 0) + (shieldTarget - (o.shield || 0)) * 0.12;
      const sk = Math.abs(o.shield);
      const dribbleWobble = Math.sin(o.stickPhase * 1.3) * 3.4 * (1 - sk * 0.7) - o.shield * 8;
      const reachFwd = 15.5 - sk * 3;
      const perpAngle = o.dir + Math.PI / 2;
      ball.x = o.x + Math.cos(o.dir) * reachFwd + Math.cos(perpAngle) * dribbleWobble;
      ball.y = o.y + Math.sin(o.dir) * reachFwd + Math.sin(perpAngle) * dribbleWobble;
      ball.vx = o.vx;
      ball.vy = o.vy;
      ball.z = 0;
    } else {
      updatePassFlight(dt);
      const steps = 2;
      for (let s = 0; s < steps; s++) {
        const previous = { x: ball.x, y: ball.y, z: ball.z };
        ball.x += ball.vx / steps;
        ball.y += ball.vy / steps;
        checkGoalScored(previous);
        if (!['match','direct_foul','kickoff'].includes(state.mode)) { return;
        }
      }
      ball.z = Math.max(0, ball.z + ball.vz);
      if (ball.z > 0) ball.vz -= 0.15;
      else ball.vz = 0;

      // Fregament suau del parquet sobre la bola de cautxú quan roda arran de terra
      const floorFriction = state.passFlight ? 1 : ball.z === 0 ? 0.982 : 0.988;
      ball.vx *= floorFriction;
      ball.vy *= floorFriction;

      if (checkNeutralStoppage()) return;
      const passVx=ball.vx,passVy=ball.vy;
      constrainToRink(ball, 0.72);
      if(ball.vx!==passVx||ball.vy!==passVy){state.passFlight=null;emitFx('board',{power:Math.hypot(passVx,passVy)/18});}
      collideWithGoalFrames(ball, true);
      if (['halftime','finished','whistle_pause'].includes(state.mode)) return;

      if(state.passFlight)receivePass();

      // Recepció de passades amb l'estic i blocatges defensius de xuts
      players.forEach(p => {
        if (state.booling?.phase === 'live' && p === state.booling.takers.away && state.booling.reaction>0) return;
        if (playerUnavailable(p) || p === state.indirectTaker || p === state.passBlockedPlayer || p.role === 'GK' || p.stealCooldown > 0 || ball.owner) return;
        const d = Math.hypot(ball.x - p.x, ball.y - p.y);
        const reachRadius = p.radius + ball.radius + (ball.shotByTeam ? 2 : 4.5);
        if (d < reachRadius && ball.z < 13) {
          const ballSp = Math.hypot(ball.vx, ball.vy);
          if (ball.shotByTeam && ballSp > 5.2 && p.team !== ball.shotByTeam) {
            clearPassOnTouch(p);
            state.indirectTaker = null;
            // Blocatge defensiu d'un xut fort!
            ball.vx *= -0.42;
            ball.vy += (Math.random() - 0.5) * 2.8;
            ball.shotByTeam = null;
            p.stealCooldown = 0.4;
            showBanner(`XUT BLOCAT PER ${p.name}!`, 0.9);
          } else {
            setBallOwner(p);
          }
        }
      });
    }
  }

  function checkGoalScored(previous) {
    if (!previous || !['match', 'direct_foul'].includes(state.mode)) return;
    const r = ball.radius;
    for (const team of ['home', 'away']) {
      const sign = attackDirection(team);
      const line = opponentGoalX(team);
      const plane = line + sign*r;
      if ((previous.x-plane)*sign > 0 || (ball.x-plane)*sign <= 0 || (ball.x-previous.x)*sign <= 0) continue;
      const t = (plane-previous.x)/(ball.x-previous.x);
      const y = previous.y + (ball.y-previous.y)*t;
      const z = previous.z + (ball.z-previous.z)*t;
      if (Math.abs(y-RINK.h/2) + r < RINK.goalWidth/2 && z+2*r < RINK.goalHeight) {
        onGoal(team);
        return;
      }
    }
  }

  function onGoal(scoringTeam) {
    if (state.mode === 'direct_foul' && !state.setPieceReady) return;
    if (!['match', 'direct_foul'].includes(state.mode)) return;
    state.passFlight=null;state.passBlockedPlayer=null;
    state.booling=null;state.neutralPossession=false;
    state.score[scoringTeam]++;
    const scorer=state.lastShooter&&!playerUnavailable(state.lastShooter)?state.lastShooter:state.lastShooter;
    state.lastGoal={team:scoringTeam,scorer:scorer||null,ownGoal:!!scorer&&scorer.team!==scoringTeam,seq:++state.goalSeq};
    emitFx('goal',{team:scoringTeam});
    {
      const sc=scorer&&scorer.team===scoringTeam&&!playerUnavailable(scorer)?scorer:null;
      const sign=attackDirection(scoringTeam);
      state.stoppage={type:'goal',team:scoringTeam,scorer:sc,t:0,
        cx:opponentGoalX(scoringTeam)-sign*(150+Math.random()*60),cy:sc&&sc.y<RINK.h/2?70:RINK.h-70};
    }
    if (state.endPeriodAfterSetPiece) { endPeriod(); return; }
    state.mode = 'goal_celebration';
    ball.vx *= 0.15;
    ball.vy *= 0.15;
    // World Skate 2027 art. 31: a goal does not shorten the inferiority.
    triggerRefereeSignal('goal', ball.x, ball.y, '📣 GOL VALIDAT!');
    const teamName = TEAMS[scoringTeam].name;
    showBanner(`Gol del ${teamName}!`, 3.2, `${state.score.home} – ${state.score.away}`);

    scheduleRestart(() => {
      resetPositions('kickoff', scoringTeam === 'home' ? 'away' : 'home');
    }, 3.4);
  }

  // ============================================================================
  // 9. SINCRONITZACIÓ D'ANIMACIONS DELS MODELS 3D (THREE.JS)
  // ============================================================================
  // Posició dibuixada: quan el motor recol·loca un jugador (represa, canvi, servei), el model hi
  // patina en lloc de teletransportar-s'hi. També suavitza els girs bruscos.
  function visualFollow(e, pose, dt) {
    let v = e.visual;
    if (!v) v = e.visual = { x: pose.x, y: pose.y, ox: 0, oy: 0, dir: pose.dir || 0, speed: 0, pushing: false };
    if (replayState.active || replayState.snap) {
      v.ox = v.oy = 0;
      const sp = dt > 0 ? Math.hypot(pose.x - v.x, pose.y - v.y) / (dt * 60) : 0;
      v.x = pose.x; v.y = pose.y; v.dir = pose.dir || 0;
      v.speed = Math.min(6, sp); v.pushing = sp > 0.3 && !!e.isPushing;
      return v;
    }
    if (Math.hypot(pose.x + v.ox - v.x, pose.y + v.oy - v.y) > 36) { v.ox = v.x - pose.x; v.oy = v.y - pose.y; }
    const off = Math.hypot(v.ox, v.oy);
    if (off > 0 && dt > 0) {
      const step = Math.max(130, off / 0.75) * dt;
      const k = off <= step ? 0 : (off - step) / off;
      v.ox *= k; v.oy *= k;
    }
    const nx = pose.x + v.ox, ny = pose.y + v.oy;
    const frameSpeed = dt > 0 ? Math.hypot(nx - v.x, ny - v.y) / (dt * 60) : 0;
    v.speed += (Math.min(6, frameSpeed) - v.speed) * (dt > 0 ? 1 - Math.exp(-14 * dt) : 0);
    const catching = Math.hypot(v.ox, v.oy) > 4;
    let targetDir = pose.dir || 0;
    if (catching) targetDir = Math.atan2(-v.oy, -v.ox);
    v.pushing = catching || !!e.isPushing;
    v.dir = normalizeAngle(v.dir + normalizeAngle(targetDir - v.dir) * (dt > 0 ? 1 - Math.exp(-(catching ? 8 : 16) * dt) : 1));
    v.x = nx; v.y = ny;
    return v;
  }

  function update3DMeshes(alpha=1,dt=1/60) {
    const visualDt=state.paused||state.mode==='finished'?0:dt;
    const me = getControlledPlayer();
    processFx(dt);
    updateCrowd(dt);
    updateArenaScreens();

    const ballPose = interpolatedPose(ball, alpha);
    const signalRef = referees.find(r => r.signalTimer > 0) || referees[0];
    const lookFor = (e, vis) => {
      let target = ballPose;
      if (state.mode === 'whistle_pause' && signalRef && e !== signalRef) target = signalRef.visual || signalRef;
      else if (state.mode === 'goal_celebration' && state.stoppage && state.stoppage.scorer && e !== state.stoppage.scorer &&
        e.team === state.stoppage.team) target = state.stoppage.scorer.visual || state.stoppage.scorer;
      else if (e.signalTimer > 0 && e.targetPlayer) target = e.targetPlayer.visual || e.targetPlayer;
      return normalizeAngle(Math.atan2(target.y - vis.y, target.x - vis.x) - vis.dir);
    };

    allPlayers().forEach(p => {
      const idx = players.indexOf(p);
      if (!p.rig) return;
      const pose = interpolatedPose(p, alpha);
      const vis = visualFollow(p, pose, visualDt);
      p.rig.group.position.set((vis.x - 500) * S, 0, (vis.y - 250) * S);
      p.rig.bodyPivot.rotation.y = -vis.dir;

      const isControlled = idx === state.controlledIdx;
      const hasBall = ball.owner === p;

      if ((isControlled || hasBall) && !replayState.active) {
        p.rig.ringMat.opacity = 0.9;
        const isSweet = state.shotCharge >= 0.52 && state.shotCharge <= 0.88;
        p.rig.ringMat.color.setHex(
          state.chargingShot && isControlled
            ? (state.shotCharge > 0.90 ? 0xef4444 : (isSweet ? 0x22c55e : 0xfacc15))
            : (isControlled ? (hasBall ? 0x22c55e : 0x38bdf8) : 0xf43f5e)
        );
      } else {
        p.rig.ringMat.opacity = 0.0;
      }

      if (p.role === 'GK') {
        animateGoalkeeper(p, visualDt);
        driveCharacterModel(p.rig);
      } else {
        const ballLocal = hasBall ? toLocal(vis, ballPose.x, ballPose.y) : null;
        let receiveFrom = null, defendBall = null;
        const live = ['match', 'direct_foul'].includes(state.mode) && !replayState.active || replayState.active;
        if (live && !hasBall && state.passFlight && state.passFlight.receiver === p && !ball.owner) receiveFrom = toLocal(vis, ballPose.x, ballPose.y);
        else if (live && !hasBall && ball.owner && ball.owner.team !== p.team && Math.hypot(ballPose.x - vis.x, ballPose.y - vis.y) < 95) defendBall = toLocal(vis, ballPose.x, ballPose.y);
        animateSkater(p, visualDt, hasBall, isControlled,
          { speed: vis.speed, pushing: vis.pushing, ballLocal, receiveFrom, defendBall, lookAngle: lookFor(p, vis) });
        driveCharacterModel(p.rig);
      }
    });

    // Àrbitres: locomoció i gestos reglamentaris.
    referees.forEach(ref => {
      if (!ref.rig) return;
      const pose = interpolatedPose(ref, alpha);
      const vis = visualFollow(ref, pose, visualDt);
      ref.rig.group.position.set((vis.x - 500) * S, 0, (vis.y - 250) * S);
      ref.rig.bodyPivot.rotation.y = -vis.dir;
      animateReferee(ref, visualDt, { speed: vis.speed, lookAngle: lookFor(ref, vis) });
      driveCharacterModel(ref.rig);
    });
    replayState.snap = false;

    if (ball.mesh) {
      const pose=interpolatedPose(ball,alpha);
      ball.mesh.position.set(
        (pose.x - 500) * S,
        (ball.radius + pose.z) * S,
        (pose.y - 250) * S
      );
      // Fins al moment del cop, la bola segueix a la pala de qui passa o xuta.
      const kicker = !ball.owner ? (state.passFlight ? state.passFlight.passer : ball.shotByTeam ? state.lastShooter : null) : null;
      const kva = kicker && kicker.visualAction;
      if (kva && kicker.rig && (kva.type === 'pass' || kva.type === 'shot')) {
        const contactU = kva.type === 'pass' ? 0.18 : 0.12;
        const uu = 1 - kva.remaining / kva.duration;
        const k = uu < contactU ? 0 : Math.min(1, (uu - contactU) * kva.duration / 0.08);
        if (k < 1) {
          kicker.rig.group.updateMatrixWorld(true);
          const bladePos = kicker.rig.blade.getWorldPosition(new THREE.Vector3());
          bladePos.y = ball.radius * S;
          ball.mesh.position.lerp(bladePos, 1 - k);
        }
      }
    }

    // Actualització de les 2 Torres Lluminoses a la Mesa de Control (Base 5.1 / 10.7 / 11.4 RFEP)
    const blink = Math.sin(performance.now() * 0.012) > 0;
    if (torreBulbs.home) {
      const hWarn = state.fouls.home >= getNextDirectFoulTarget(state.fouls.home) - 1;
      torreBulbs.home.color.setHex(hWarn ? (blink ? 0xef4444 : 0xfacc15) : 0x334155);
    }
    if (torreBulbs.away) {
      const aWarn = state.fouls.away >= getNextDirectFoulTarget(state.fouls.away) - 1;
      torreBulbs.away.color.setHex(aWarn ? (blink ? 0xef4444 : 0xfacc15) : 0x334155);
    }

    if (aimReticleMesh) {
      if (me && ball.owner === me && me.x > 400 && state.mode !== 'goal_celebration') {
        aimReticleMesh.visible = true;
        const gx = (opponentGoalX('home') - 500) * S;
        const gz = (state.aimTargetY - 250) * S;
        const gy = state.chargingShot ? (1.0 + state.shotCharge * 1.8) : 1.4;
        aimReticleMesh.position.set(gx, gy, gz);
        const aimingCorner = Math.abs(state.aimTargetY - RINK.h / 2) > 20;
        aimReticleMesh.material.color.setHex(aimingCorner ? 0x22c55e : 0xfacc15);
      } else {
        aimReticleMesh.visible = false;
      }
    }
  }

  // ============================================================================
  // 10. HUD 2D BROADCAST (INFOGRAFIA OFICIAL RFEP OK LIGA 26/27 — BASE 14.6)
  // ============================================================================
  const HUD_DISPLAY = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
  const HUD_UI = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
  const hudState = { dpr: 1, cssW: 1, cssH: 1, bannerSeq: -1, bannerStart: 0, bannerTotal: 0, goalStart: 0, goalKey: '' };

  function hudRoundRect(x, y, w, h, r) {
    hudCtx.beginPath();
    if (hudCtx.roundRect) hudCtx.roundRect(x, y, w, h, r);
    else hudCtx.rect(x, y, w, h);
  }

  function hudProject(x, y, height, W, H) {
    const v = new THREE.Vector3((x - 500) * S, height, (y - 250) * S);
    v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, visible: v.z < 1 && v.z > -1 };
  }

  function cleanHudText(text) {
    return String(text || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B1B}-\u{2B55}]️?\s*/gu, '').trim();
  }

  function formatClock(seconds) {
    const s = Math.max(0, Math.ceil(seconds - 1e-6));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function hudChevron(x, y, size, fill, stroke = 'rgba(5,8,14,0.85)') {
    hudCtx.beginPath();
    hudCtx.moveTo(x - size, y - size * 1.1);
    hudCtx.lineTo(x + size, y - size * 1.1);
    hudCtx.lineTo(x, y);
    hudCtx.closePath();
    hudCtx.lineWidth = 2;
    hudCtx.strokeStyle = stroke;
    hudCtx.stroke();
    hudCtx.fillStyle = fill;
    hudCtx.fill();
  }

  // Marcador de retransmissió: equips, gols, rellotge, faltes i 45 segons.
  function renderScoreboard() {
    const c = hudCtx, x = 16, y = 14, h = 36;
    const chip = 5, teamW = 52, scoreW = 34, clockW = 104;
    const w = chip + teamW + scoreW + 2 + scoreW + teamW + chip + clockW;
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 18; c.shadowOffsetY = 4;
    c.fillStyle = 'rgba(8,11,18,0.94)';
    hudRoundRect(x, y, w, h, 8); c.fill();
    c.restore();
    c.save();
    hudRoundRect(x, y, w, h, 8); c.clip();
    let cx = x;
    const teamBlock = (team, align) => {
      const info = TEAMS[team];
      if (align === 'left') { c.fillStyle = info.primary; c.fillRect(cx, y, chip, h); cx += chip; }
      c.fillStyle = '#ffffff';
      c.font = `700 19px ${HUD_DISPLAY}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(info.short, cx + teamW / 2, y + h / 2 + 1);
      if (state.possessionTeam === team && !state.neutralPossession && ['match', 'kickoff', 'free_hit', 'direct_foul'].includes(state.mode)) {
        c.fillStyle = '#f5b301';
        c.fillRect(cx + 12, y + h - 4, teamW - 24, 3);
      }
      cx += teamW;
    };
    const scoreBlock = team => {
      c.fillStyle = 'rgba(255,255,255,0.10)';
      c.fillRect(cx, y, scoreW, h);
      c.fillStyle = '#ffffff';
      c.font = `800 24px ${HUD_DISPLAY}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(state.score[team]), cx + scoreW / 2, y + h / 2 + 1);
      cx += scoreW;
    };
    teamBlock('home', 'left');
    scoreBlock('home');
    c.fillStyle = 'rgba(8,11,18,0.94)'; c.fillRect(cx, y, 2, h); cx += 2;
    scoreBlock('away');
    teamBlock('away', 'right');
    c.fillStyle = TEAMS.away.primary; c.fillRect(cx, y, chip, h); cx += chip;
    c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(cx, y, clockW, h);
    c.fillStyle = '#f5b301';
    c.font = `700 14px ${HUD_DISPLAY}`;
    c.textAlign = 'left';
    c.fillText(state.period + 'a', cx + 10, y + h / 2 + 1);
    c.fillStyle = '#ffffff';
    c.font = `700 22px ${HUD_DISPLAY}`;
    c.textAlign = 'right';
    c.fillText(formatClock(state.timeRemaining), cx + clockW - 10, y + h / 2 + 1, clockW - 38);
    c.restore();

    // Fila secundària: faltes d'equip i rellotge de possessió.
    const y2 = y + h + 4, h2 = 20;
    c.save();
    c.fillStyle = 'rgba(8,11,18,0.82)';
    hudRoundRect(x, y2, w, h2, 6); c.fill();
    c.font = `600 10px ${HUD_UI}`;
    c.textBaseline = 'middle';
    const homeTarget = getNextDirectFoulTarget(state.fouls.home), awayTarget = getNextDirectFoulTarget(state.fouls.away);
    const homeWarn = state.fouls.home >= homeTarget - 1, awayWarn = state.fouls.away >= awayTarget - 1;
    c.textAlign = 'left';
    c.fillStyle = homeWarn ? '#fbbf24' : '#94a3b8';
    c.fillText('FALTES ' + state.fouls.home, x + 10, y2 + h2 / 2 + 0.5);
    c.textAlign = 'right';
    c.fillStyle = awayWarn ? '#fbbf24' : '#94a3b8';
    c.fillText(state.fouls.away + ' FALTES', x + w - clockW - 8, y2 + h2 / 2 + 0.5);
    // 45 segons
    const px = x + w - clockW + 10, pw = clockW - 44;
    const frac = state.neutralPossession ? 0 : Math.max(0, Math.min(1, state.possessionClock / 45));
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(px, y2 + h2 / 2 - 2, pw, 4);
    c.fillStyle = state.possessionClock <= 10 ? '#ef4444' : TEAMS[state.possessionTeam]?.primary || '#38bdf8';
    if (state.possessionClock > 10) c.fillStyle = '#e2e8f0';
    c.fillRect(px, y2 + h2 / 2 - 2, pw * frac, 4);
    c.fillStyle = state.possessionClock <= 10 && !state.neutralPossession ? '#f87171' : '#e2e8f0';
    c.font = `700 13px ${HUD_DISPLAY}`;
    c.textAlign = 'right';
    c.fillText(state.neutralPossession ? '—' : String(Math.ceil(state.possessionClock)), x + w - 10, y2 + h2 / 2 + 1);
    c.restore();

    // Avisos de reglament sota el marcador.
    const pills = [];
    if (state.neutralPossession) pills.push({ text: state.booling?.phase === 'live' ? 'BOOLING · BOLA EN DISPUTA' : 'BOOLING · ESPERA EL XIULET', color: '#f5b301' });
    else if (state.mode === 'match' && !state.crossedHalfCourt) {
      pills.push({ text: 'SORTIDA · ' + Math.ceil(state.halfCourtClock) + ' s per passar el mig camp', color: state.halfCourtClock <= 4 ? '#ef4444' : '#f5b301' });
    } else if (state.mode === 'match' && isInOwnHalf(state.possessionTeam, ball.x) && !ball.shotByTeam) {
      pills.push({ text: 'CAMP PROPI · ' + Math.ceil(state.backCourtClock) + ' s per tornar', color: state.backCourtClock <= 2.2 ? '#ef4444' : '#f59e0b' });
    }
    if (state.exclusions.home > 0 || state.exclusions.away > 0) {
      const homeCount = players.filter(p => p.team === 'home' && p.role !== 'GK' && !playerUnavailable(p)).length;
      const awayCount = players.filter(p => p.team === 'away' && p.role !== 'GK' && !playerUnavailable(p)).length;
      const parts = [];
      if (state.exclusions.home > 0) parts.push(TEAMS.home.short + ' ' + formatClock(state.exclusions.home));
      if (state.exclusions.away > 0) parts.push(TEAMS.away.short + ' ' + formatClock(state.exclusions.away));
      pills.push({ text: homeCount + ' CONTRA ' + awayCount + ' · ' + parts.join(' · '), color: '#3b82f6' });
    }
    let py = y2 + h2 + 6;
    for (const pill of pills) {
      c.save();
      c.font = `600 11px ${HUD_UI}`;
      const tw = c.measureText(pill.text).width + 22;
      c.fillStyle = 'rgba(8,11,18,0.88)';
      hudRoundRect(x, py, tw, 22, 6); c.fill();
      c.fillStyle = pill.color; c.fillRect(x, py + 4, 3, 14);
      c.fillStyle = '#f1f5f9'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(pill.text, x + 12, py + 11.5);
      c.restore();
      py += 26;
    }
  }

  function renderPlayerPanel(W, H) {
    const p = getControlledPlayer();
    if (!p) return;
    const touch = isTouchLayout();
    if (touch && W < 640) return;
    const width = 220, height = 46;
    const x = touch ? W / 2 - width / 2 : 16, y = H - height - (touch ? 14 : 16);
    const team = TEAMS[p.team];
    const stamina = Math.max(0, Math.min(100, p.stamina));
    const c = hudCtx;
    c.save();
    c.fillStyle = 'rgba(8,11,18,0.88)';
    hudRoundRect(x, y, width, height, 8); c.fill();
    c.fillStyle = team.primary;
    hudRoundRect(x + 6, y + 6, 34, 34, 6); c.fill();
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 20px ${HUD_DISPLAY}`;
    c.fillText(String(p.num), x + 23, y + 24);
    c.textAlign = 'left';
    c.font = `700 17px ${HUD_DISPLAY}`;
    c.fillText(p.name, x + 50, y + 17, width - 60);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(x + 50, y + 31, width - 62, 4);
    c.fillStyle = stamina < 25 ? '#f87171' : stamina < 50 ? '#fbbf24' : '#4ade80';
    c.fillRect(x + 50, y + 31, (width - 62) * stamina / 100, 4);
    c.restore();
  }

  // Indicadors sobre els jugadors: controlat, pròxim canvi, receptor de la passada i càrrega del xut.
  function renderPlayerMarkers(W, H) {
    const me = getControlledPlayer();
    const live = ['match', 'kickoff', 'free_hit', 'direct_foul'].includes(state.mode) && !replayState.active;
    const vp = e => e.visual || e;
    if (me && live) {
      const head = hudProject(vp(me).x, vp(me).y, 5.4, W, H);
      if (head.visible) hudChevron(head.x, head.y, 7, ball.owner === me ? '#4ade80' : '#7dd3fc');
      if (state.chargingShot && ball.owner === me) {
        const foot = hudProject(vp(me).x, vp(me).y, 0.1, W, H);
        const r = 30, a0 = Math.PI * 0.75, span = Math.PI * 1.5;
        hudCtx.save();
        hudCtx.lineCap = 'round';
        hudCtx.lineWidth = 6;
        hudCtx.strokeStyle = 'rgba(8,11,18,0.75)';
        hudCtx.beginPath(); hudCtx.arc(foot.x, foot.y, r, a0, a0 + span); hudCtx.stroke();
        hudCtx.strokeStyle = 'rgba(74,222,128,0.45)';
        hudCtx.beginPath(); hudCtx.arc(foot.x, foot.y, r, a0 + span * 0.52, a0 + span * 0.88); hudCtx.stroke();
        hudCtx.lineWidth = 4;
        hudCtx.strokeStyle = state.shotCharge > 0.9 ? '#ef4444' : state.shotCharge >= 0.52 ? '#4ade80' : '#fbbf24';
        hudCtx.beginPath(); hudCtx.arc(foot.x, foot.y, r, a0, a0 + span * state.shotCharge); hudCtx.stroke();
        hudCtx.restore();
      }
      // Receptor previst de la passada.
      if (ball.owner === me && !state.chargingShot && ['match', 'kickoff', 'free_hit'].includes(state.mode)) {
        const input = getInputVector();
        const receiver = selectPassReceiver(me, input.len > 0.15 ? Math.atan2(input.dy, input.dx) : me.dir);
        if (receiver) {
          const r = hudProject(vp(receiver).x, vp(receiver).y, 5.2, W, H);
          if (r.visible) {
            hudCtx.save();
            hudCtx.globalAlpha = 0.9;
            hudCtx.strokeStyle = '#4ade80';
            hudCtx.lineWidth = 2;
            hudCtx.beginPath(); hudCtx.arc(r.x, r.y - 6, 7, 0, Math.PI * 2); hudCtx.stroke();
            hudCtx.fillStyle = '#4ade80';
            hudCtx.beginPath(); hudCtx.arc(r.x, r.y - 6, 2.5, 0, Math.PI * 2); hudCtx.fill();
            hudCtx.restore();
          }
        }
      }
    }
    if (live) renderNextPlayerHint(W, H);

    // Jugador sancionat: targeta sobre el cap.
    if (state.cardEvent && state.cardEvent.offender) {
      const o = state.cardEvent.offender;
      const head = hudProject(vp(o).x, vp(o).y, 5.8, W, H);
      if (head.visible) {
        hudCtx.save();
        hudCtx.fillStyle = state.cardEvent.type === 'blue' ? '#2563eb' : '#ef4444';
        hudCtx.strokeStyle = '#ffffff'; hudCtx.lineWidth = 2;
        hudRoundRect(head.x - 9, head.y - 30, 18, 25, 3); hudCtx.fill(); hudCtx.stroke();
        hudCtx.restore();
      }
    }
    // Àrbitres: només quan senyalitzen.
    referees.forEach(ref => {
      if (!(ref.signalTimer > 0) || !ref.signalLabel) return;
      const p = hudProject(vp(ref).x, vp(ref).y, 5.6, W, H);
      if (!p.visible) return;
      const text = cleanHudText(ref.signalLabel);
      hudCtx.save();
      hudCtx.font = `700 11px ${HUD_UI}`;
      const tw = hudCtx.measureText(text).width + 16;
      const isBlue = ref.signalType === 'blue_card';
      hudCtx.fillStyle = isBlue ? 'rgba(29,78,216,0.95)' : 'rgba(8,11,18,0.9)';
      hudRoundRect(p.x - tw / 2, p.y - 22, tw, 18, 9); hudCtx.fill();
      hudCtx.fillStyle = isBlue ? '#ffffff' : '#fde68a';
      hudCtx.textAlign = 'center'; hudCtx.textBaseline = 'middle';
      hudCtx.fillText(text, p.x, p.y - 12.5);
      hudCtx.restore();
    });
  }

  function renderNextPlayerHint(W,H) {
    if(state.mode!=='match'||(ball.owner?.team==='home')||state.passFlight?.passer.team==='home')return;
    const next=nextSwitchPlayer(true);
    if(!next)return;
    const p=hudProject((next.visual||next).x,(next.visual||next).y,5.2,W,H);
    if(!p.visible)return;
    hudCtx.save();
    hudCtx.globalAlpha=0.85;
    hudCtx.beginPath();hudCtx.moveTo(p.x-6,p.y-7);hudCtx.lineTo(p.x+6,p.y-7);hudCtx.lineTo(p.x,p.y);hudCtx.closePath();
    hudCtx.lineWidth=2;hudCtx.strokeStyle='#e2e8f0';hudCtx.stroke();
    hudCtx.restore();
  }

  // Punt de represa a la pista: on es treu la falta, cap on ataca i la distància de 3 m dels rivals.
  function renderRestartMarker(W, H, now) {
    let spot = null, label = '', team = null, showDistance = false;
    const st = state.stoppage;
    if (state.mode === 'whistle_pause' && st && st.type !== 'goal' && st.x !== undefined) {
      spot = { x: st.x, y: st.y }; team = st.team;
      label = st.type === 'booling' ? 'Booling' : st.restart === 'penalty' ? 'Penal' : st.restart === 'direct_foul' ? 'Falta directa' : 'Lliure indirecte';
    } else if (state.mode === 'free_hit' && state.freeHit) {
      spot = { x: state.freeHit.x, y: state.freeHit.y }; team = state.freeHit.team; label = 'Lliure indirecte'; showDistance = true;
    } else if (state.mode === 'direct_foul' && !state.setPieceReady) {
      spot = { x: ball.x, y: ball.y }; team = state.possessionTeam; label = 'Falta directa';
    }
    if (!spot) return;
    const pulse = 0.5 + 0.5 * Math.sin(now / 220);
    const ring = (radius, h = 0.05) => {
      hudCtx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i / 40 * Math.PI * 2;
        const q = hudProject(spot.x + Math.cos(a) * radius, spot.y + Math.sin(a) * radius, h, W, H);
        if (i === 0) hudCtx.moveTo(q.x, q.y); else hudCtx.lineTo(q.x, q.y);
      }
    };
    hudCtx.save();
    const color = team ? TEAMS[team].primary : '#f5b301';
    if (showDistance) {
      hudCtx.setLineDash([6, 6]);
      hudCtx.strokeStyle = 'rgba(255,255,255,0.45)';
      hudCtx.lineWidth = 1.5;
      ring(3 * METRE);
      hudCtx.stroke();
      hudCtx.setLineDash([]);
    }
    hudCtx.strokeStyle = '#ffffff';
    hudCtx.globalAlpha = 0.55 + pulse * 0.45;
    hudCtx.lineWidth = 2.5;
    ring(10 + pulse * 4);
    hudCtx.stroke();
    hudCtx.globalAlpha = 1;
    if (team && label !== 'Booling') {
      const dir = attackDirection(team);
      const a1 = hudProject(spot.x + dir * 22, spot.y, 0.05, W, H), a2 = hudProject(spot.x + dir * 70, spot.y, 0.05, W, H);
      const ang = Math.atan2(a2.y - a1.y, a2.x - a1.x);
      hudCtx.strokeStyle = color; hudCtx.fillStyle = color; hudCtx.lineWidth = 4;
      hudCtx.beginPath(); hudCtx.moveTo(a1.x, a1.y); hudCtx.lineTo(a2.x, a2.y); hudCtx.stroke();
      hudCtx.beginPath();
      hudCtx.moveTo(a2.x + Math.cos(ang) * 8, a2.y + Math.sin(ang) * 8);
      hudCtx.lineTo(a2.x + Math.cos(ang + 2.4) * 10, a2.y + Math.sin(ang + 2.4) * 10);
      hudCtx.lineTo(a2.x + Math.cos(ang - 2.4) * 10, a2.y + Math.sin(ang - 2.4) * 10);
      hudCtx.closePath(); hudCtx.fill();
    }
    const top = hudProject(spot.x, spot.y, 0.05, W, H);
    const text = label + (team ? ' · ' + TEAMS[team].short : '');
    hudCtx.font = `700 13px ${HUD_DISPLAY}`;
    const tw = hudCtx.measureText(text.toUpperCase()).width + 18;
    hudCtx.fillStyle = 'rgba(8,11,18,0.88)';
    hudRoundRect(top.x - tw / 2, top.y + 14, tw, 20, 10); hudCtx.fill();
    hudCtx.fillStyle = '#ffffff'; hudCtx.textAlign = 'center'; hudCtx.textBaseline = 'middle';
    hudCtx.fillText(text.toUpperCase(), top.x, top.y + 24.5);
    hudCtx.restore();
  }

  // Rètols: avisos importants (centre, estil retransmissió) i notificacions breus (peu de pantalla).
  function renderBanner(W, H, now) {
    if (state.bannerSeq !== hudState.bannerSeq) {
      hudState.bannerSeq = state.bannerSeq;
      hudState.bannerStart = now;
      hudState.bannerTotal = state.bannerTimer;
    }
    if (!(state.bannerTimer > 0) || !state.bannerText || state.bannerTimer > 60) return;
    if (state.mode === 'goal_celebration' && state.lastGoal) return;
    const title = cleanHudText(state.bannerText), sub = cleanHudText(state.bannerSubText);
    const age = (now - hudState.bannerStart) / 1000;
    const fadeIn = Math.min(1, age / 0.18), fadeOut = Math.min(1, state.bannerTimer / 0.25);
    const alpha = Math.min(fadeIn, fadeOut);
    const c = hudCtx;
    c.save();
    c.globalAlpha = alpha;
    if (hudState.bannerTotal <= 1.25 && !sub) {
      // Notificació breu.
      c.font = `700 15px ${HUD_DISPLAY}`;
      const tw = c.measureText(title).width + 30;
      const y = H - (isTouchLayout() ? 190 : 92) + (1 - fadeIn) * 8;
      c.fillStyle = 'rgba(8,11,18,0.88)';
      hudRoundRect(W / 2 - tw / 2, y, tw, 28, 14); c.fill();
      c.fillStyle = '#f1f5f9'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(title.toUpperCase(), W / 2, y + 15);
    } else {
      const bw = Math.min(W - 32, 540), bh = sub ? 62 : 46;
      const x = W / 2 - bw / 2, y = Math.max(108, H * 0.17) - (1 - fadeIn) * 10;
      const accent = /BLAVA/.test(title) ? '#3b82f6' : /VERMELLA|EXPULS/.test(title) ? '#ef4444' : '#f5b301';
      c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 20; c.shadowOffsetY = 6;
      c.fillStyle = 'rgba(8,11,18,0.94)';
      hudRoundRect(x, y, bw, bh, 10); c.fill();
      c.shadowColor = 'transparent';
      c.fillStyle = accent;
      c.fillRect(x, y + 8, 5, bh - 16);
      c.fillStyle = '#ffffff';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `800 24px ${HUD_DISPLAY}`;
      c.fillText(title.toUpperCase(), W / 2, y + (sub ? 22 : bh / 2 + 1), bw - 40);
      if (sub) {
        c.fillStyle = '#94a3b8';
        c.font = `500 12.5px ${HUD_UI}`;
        c.fillText(sub, W / 2, y + 45, bw - 40);
      }
    }
    c.restore();
  }

  // Grafisme de gol.
  function renderGoalGraphic(W, H, now) {
    const goal = state.lastGoal;
    if (!goal || !(state.mode === 'goal_celebration' || replayState.active)) { hudState.goalKey = ''; return; }
    const key = goal.seq + (replayState.active ? 'r' : 'l');
    if (key !== hudState.goalKey) { hudState.goalKey = key; hudState.goalStart = now; }
    const t = (now - hudState.goalStart) / 1000;
    const c = hudCtx;
    if (replayState.active) {
      // Mosca de repetició.
      c.save();
      const x = W - 168, y = 66;
      c.fillStyle = 'rgba(8,11,18,0.9)';
      hudRoundRect(x, y, 152, 30, 8); c.fill();
      c.fillStyle = Math.sin(now / 250) > 0 ? '#ef4444' : '#7f1d1d';
      c.beginPath(); c.arc(x + 16, y + 15, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff'; c.font = `700 16px ${HUD_DISPLAY}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('REPETICIÓ', x + 30, y + 16);
      c.font = `500 11px ${HUD_UI}`; c.fillStyle = '#94a3b8'; c.textAlign = 'center';
      c.fillText(isTouchLayout() ? 'Toca la pantalla per saltar-la' : 'Prem qualsevol tecla per saltar-la', W / 2, H - 24);
      c.restore();
      return;
    }
    const grow = Math.min(1, t / 0.35), ease = 1 - Math.pow(1 - grow, 3);
    const team = TEAMS[goal.team];
    const scorerText = goal.scorer ? goal.scorer.name + ' #' + goal.scorer.num + (goal.ownGoal ? ' (en pròpia)' : '') : team.name;
    if (t > 1.7) {
      // Després del gran rètol, un rètol inferior deixa veure la celebració.
      const k = Math.min(1, (t - 1.7) / 0.25);
      const text = 'GOL · ' + scorerText + '   ' + state.score.home + ' – ' + state.score.away;
      c.save();
      c.globalAlpha = k;
      c.font = `700 18px ${HUD_DISPLAY}`;
      const tw = c.measureText(text).width + 40, y0 = H - (isTouchLayout() ? 200 : 100) + (1 - k) * 12;
      c.fillStyle = 'rgba(8,11,18,0.92)';
      hudRoundRect(W / 2 - tw / 2, y0, tw, 34, 8); c.fill();
      c.fillStyle = team.primary; c.fillRect(W / 2 - tw / 2, y0 + 6, 5, 22);
      c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, W / 2 + 2, y0 + 18);
      c.restore();
      return;
    }
    const bandH = 96, y = H * 0.36;
    c.save();
    c.globalAlpha = Math.min(1, t / 0.15) * Math.min(1, (1.7 - t) / 0.2);
    const grad = c.createLinearGradient(0, y, W, y);
    grad.addColorStop(0, 'rgba(8,11,18,0)');
    grad.addColorStop(0.18, 'rgba(8,11,18,0.92)');
    grad.addColorStop(0.82, 'rgba(8,11,18,0.92)');
    grad.addColorStop(1, 'rgba(8,11,18,0)');
    c.fillStyle = grad;
    c.fillRect(0, y, W, bandH * ease);
    c.fillStyle = team.primary;
    c.fillRect(W * 0.18, y, W * 0.64 * ease, 4);
    c.fillRect(W * 0.18, y + bandH - 4, W * 0.64 * ease, 4);
    if (ease > 0.6) {
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      c.fillStyle = '#ffffff';
      c.font = `800 ${Math.round(Math.min(64, W * 0.09))}px ${HUD_DISPLAY}`;
      c.fillText('GOOOL!', W / 2, y + 36);
      c.font = `600 14px ${HUD_UI}`;
      c.fillStyle = '#cbd5e1';
      const scorer = goal.scorer ? goal.scorer.name + ' #' + goal.scorer.num + (goal.ownGoal ? ' (en pròpia)' : '') : team.name;
      c.fillText(team.name + ' · ' + scorer + '   ' + state.score.home + ' – ' + state.score.away, W / 2, y + 72, W * 0.6);
    }
    c.restore();
  }

  function renderCardPanel(W) {
    if (!state.cardEvent || !(state.cardEvent.timer > 0)) return;
    const ce = state.cardEvent, isBlue = ce.type === 'blue';
    const cw = Math.min(330, W - 32), ch = 64, cx = W - cw - 16, cy = 66;
    const c = hudCtx;
    c.save();
    c.fillStyle = 'rgba(8,11,18,0.94)';
    hudRoundRect(cx, cy, cw, ch, 10); c.fill();
    c.fillStyle = isBlue ? '#2563eb' : '#ef4444';
    c.strokeStyle = '#ffffff'; c.lineWidth = 2;
    hudRoundRect(cx + 12, cy + 12, 28, 40, 4); c.fill(); c.stroke();
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = isBlue ? '#93c5fd' : '#fca5a5';
    c.font = `700 11px ${HUD_UI}`;
    c.fillText(isBlue ? 'TARGETA BLAVA' : 'TARGETA VERMELLA', cx + 52, cy + 16);
    c.fillStyle = '#ffffff';
    c.font = `700 19px ${HUD_DISPLAY}`;
    c.fillText('#' + ce.playerNum + ' ' + ce.playerName + ' · ' + ce.teamName, cx + 52, cy + 34, cw - 62);
    c.fillStyle = '#94a3b8';
    c.font = `500 11px ${HUD_UI}`;
    c.fillText(ce.sanction, cx + 52, cy + 51, cw - 62);
    c.restore();
  }

  function isTouchLayout() {
    const wrap = document.getElementById('stageWrap');
    return !!(wrap && wrap.classList && wrap.classList.contains && wrap.classList.contains('touch') === true);
  }

  function renderHUD() {
    const dpr = hudState.dpr;
    const cssW = hudState.cssW, cssH = hudState.cssH;
    const hudScale = Math.min(1, cssW / 560, cssH / 470);
    const W = cssW / hudScale, H = cssH / hudScale;
    const now = performance.now();
    hudCtx.setTransform(1, 0, 0, 1, 0, 0);
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    hudCtx.setTransform(dpr * hudScale, 0, 0, dpr * hudScale, 0, 0);
    if (ui.intro) return;
    const overlay = state.paused || state.mode === 'halftime' || state.mode === 'finished';
    if (!overlay) renderRestartMarker(W, H, now);
    renderPlayerMarkers(W, H);
    renderScoreboard();
    if (!overlay) {
      renderPlayerPanel(W, H);
      renderCardPanel(W);
      renderGoalGraphic(W, H, now);
      renderBanner(W, H, now);
    }
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  const CAMERA_ORDER = ['nhl_side', 'nhl_iso', 'end3d', 'wide3d'];
  const CAMERA_NAMES = { nhl_side: 'Càmera TV lateral', nhl_iso: 'Càmera diagonal', end3d: 'Càmera darrere l’atac', wide3d: 'Càmera panoràmica' };

  function setCameraMode(mode) {
    state.camera = mode;
    document.querySelectorAll('[data-cam]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-cam') === mode);
    });
    saveSettings();
    if (!state.paused) showBanner(CAMERA_NAMES[mode] || mode, 1.1);
  }

  function resizeAll() {
    const wrap = document.getElementById('stageWrap');
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    hudState.dpr = dpr; hudState.cssW = w; hudState.cssH = h;
    hudCanvas.width = Math.round(w * dpr);
    hudCanvas.height = Math.round(h * dpr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // ============================================================================
  // 11. SENSACIONS DE JOC: SO SINTETITZAT, VIBRACIÓ, SACSEJADA I PÚBLIC
  // ============================================================================
  // Tot el so es genera amb Web Audio: cap fitxer extern ni cap mostra amb drets.
  const Sfx = (() => {
    let ctx = null, master = null, crowdGain = null, noiseBuf = null, enabled = true;
    const AC = typeof window.AudioContext === 'function' ? window.AudioContext
      : typeof window.webkitAudioContext === 'function' ? window.webkitAudioContext : null;
    function init() {
      if (ctx || !AC) return;
      try { ctx = new AC(); } catch (e) { ctx = null; return; }
      master = ctx.createGain();
      master.gain.value = enabled ? 0.75 : 0;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // Ambient de pavelló: murmuri continu del públic.
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 650; band.Q.value = 0.5;
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 1800;
      crowdGain = ctx.createGain(); crowdGain.gain.value = 0.045;
      src.connect(band); band.connect(low); low.connect(crowdGain); crowdGain.connect(master);
      src.start();
    }
    function now() { return ctx.currentTime; }
    function envelope(gainNode, t0, peak, attack, decay) {
      gainNode.gain.setValueAtTime(0.0001, t0);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    }
    function noise({ freq = 1000, q = 1, type = 'bandpass', gain = 0.3, attack = 0.002, decay = 0.08, delay = 0 }) {
      if (!ctx) return;
      const t0 = now() + delay;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); envelope(g, t0, gain, attack, decay);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0, Math.random() * 1.5); src.stop(t0 + attack + decay + 0.05);
    }
    function tone({ freq = 440, type = 'sine', gain = 0.2, attack = 0.004, decay = 0.2, slideTo = 0, delay = 0, filter = 0 }) {
      if (!ctx) return;
      const t0 = now() + delay;
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + attack + decay);
      const g = ctx.createGain(); envelope(g, t0, gain, attack, decay);
      let node = o;
      if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
      node.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + attack + decay + 0.05);
    }
    return {
      unlock() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
      setEnabled(value) {
        enabled = value;
        if (master) master.gain.setTargetAtTime(value ? 0.75 : 0, now(), 0.05);
      },
      get enabled() { return enabled; },
      crowd(level) { if (crowdGain) crowdGain.gain.setTargetAtTime(0.035 + level * 0.11, now(), 0.4); },
      stick(power = 0.5) {
        noise({ freq: 2600 + power * 1800, q: 1.4, gain: 0.18 + power * 0.42, decay: 0.05 + power * 0.03 });
        tone({ freq: 210 + power * 140, type: 'triangle', gain: 0.1 + power * 0.22, decay: 0.07 });
      },
      board(power = 0.5) {
        tone({ freq: 95, slideTo: 60, type: 'sine', gain: 0.18 + power * 0.35, decay: 0.22 });
        noise({ freq: 380, q: 0.8, gain: 0.12 + power * 0.25, decay: 0.12 });
      },
      post() {
        tone({ freq: 1240, gain: 0.22, decay: 0.9 });
        tone({ freq: 1873, gain: 0.12, decay: 0.6 });
        tone({ freq: 3120, gain: 0.06, decay: 0.3 });
        noise({ freq: 600, q: 0.7, gain: 0.25, attack: 0.08, decay: 0.7, delay: 0.05 });
      },
      whistle(long = false) {
        if (!ctx) return;
        const t0 = now(), dur = long ? 0.85 : 0.32;
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 2850;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 32;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 70;
        lfo.connect(lfoGain); lfoGain.connect(o.frequency);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2900; f.Q.value = 6;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
        g.gain.setValueAtTime(0.16, t0 + dur - 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(f); f.connect(g); g.connect(master);
        o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.02); lfo.stop(t0 + dur + 0.02);
      },
      save() { noise({ freq: 480, q: 1.6, gain: 0.28, attack: 0.15, decay: 0.9 }); },
      goal() {
        noise({ freq: 900, q: 0.35, gain: 0.55, attack: 0.25, decay: 3.2 });
        noise({ freq: 2200, q: 0.5, gain: 0.25, attack: 0.3, decay: 2.6 });
        [233, 294, 349].forEach(f => tone({ freq: f, type: 'sawtooth', gain: 0.07, attack: 0.05, decay: 1.4, filter: 1600, delay: 0.1 }));
      }
    };
  })();

  function haptic(pattern) {
    try { if (typeof navigator !== 'undefined' && navigator.vibrate && isTouchLayout()) navigator.vibrate(pattern); } catch (e) {}
  }

  const cameraFx = { shake: 0 };

  // Consumeix els esdeveniments que el motor de joc deixa a fxEvents.
  function processFx(dt) {
    while (fxEvents.length) {
      const e = fxEvents.shift();
      switch (e.type) {
        case 'shot':
          Sfx.stick(e.power);
          if (e.power > 0.7) cameraFx.shake = Math.max(cameraFx.shake, 0.18);
          cheerCrowd(e.team, 0.2);
          if (e.team === 'home') haptic(12);
          break;
        case 'pass': Sfx.stick(0.12); break;
        case 'tackle': Sfx.stick(0.3); haptic(8); break;
        case 'board': if (e.power > 0.15) Sfx.board(Math.min(1, e.power)); break;
        case 'post':
          Sfx.post();
          cameraFx.shake = Math.max(cameraFx.shake, 0.35);
          cheerCrowd('home', 0.3); cheerCrowd('away', 0.3);
          break;
        case 'save': Sfx.save(); cheerCrowd(e.team, 0.35); break;
        case 'goal':
          Sfx.whistle(false);
          Sfx.goal();
          cameraFx.shake = Math.max(cameraFx.shake, 0.55);
          cheerCrowd(e.team, 1.4);
          haptic([30, 40, 70]);
          if (settings.replay) scheduleReplay();
          break;
        case 'whistle': Sfx.whistle(!!e.long); break;
        case 'card': Sfx.whistle(true); break;
      }
    }
    const crowd = arenaDynamic.crowd;
    if (crowd) Sfx.crowd(Math.max(crowd.excitement[1], crowd.excitement[2]));
    cameraFx.shake *= Math.exp(-dt * 5);
  }

  // ============================================================================
  // 12. REPETICIÓ DE GOL (CÀMERA LENTA AMB CÀMERA DE FONS)
  // ============================================================================
  function scheduleReplay() {
    replayState.goalIndex = replayState.frames.length - 1;
    replayState.pendingAt = performance.now() + 2800;
  }

  function startReplay() {
    const frames = replayState.frames;
    if (frames.length < 40 || replayState.goalIndex < 0) return;
    replayState.start = Math.max(0, replayState.goalIndex - 150);
    replayState.end = Math.min(frames.length - 1, replayState.goalIndex + 36);
    replayState.cursor = replayState.start;
    replayState.active = true;
    replayState.snap = true;
    replayState.pendingAt = 0;
    const goal = state.lastGoal;
    replayState.goalSide = goal ? opponentGoalX(goal.team) : RINK.w;
    clearInput();
  }

  function stopReplay() {
    if (!replayState.active) return;
    replayState.active = false;
    replayState.snap = true;
    replayState.frames.length = 0;
    replayState.goalIndex = -1;
  }

  function renderReplayFrame(dt) {
    const frames = replayState.frames;
    replayState.cursor += dt * 60 * replayState.speed;
    if (replayState.cursor >= replayState.end) { stopReplay(); return false; }
    const i = Math.floor(replayState.cursor), t = replayState.cursor - i;
    const a = frames[i], b = frames[Math.min(i + 1, replayState.end)];
    const saved = [];
    a.ents.forEach((ea, k) => {
      const eb = b.ents[k] || ea, p = ea.ref;
      saved.push([p, p.x, p.y, p.dir, p.vx, p.vy, p.isPushing, p.bankAngle, p.gkPosture, p.visualAction, p.pokeTimer, p.stickPhase, p.renderPrevious]);
      p.x = ea.x + (eb.x - ea.x) * t; p.y = ea.y + (eb.y - ea.y) * t;
      p.dir = ea.dir + normalizeAngle(eb.dir - ea.dir) * t;
      p.vx = ea.vx; p.vy = ea.vy; p.isPushing = ea.isPushing; p.bankAngle = ea.bankAngle;
      p.gkPosture = ea.gkPosture; p.pokeTimer = ea.pokeTimer; p.stickPhase = ea.stickPhase;
      p.visualAction = ea.visualAction ? { ...ea.visualAction } : null;
      p.renderPrevious = null;
    });
    const ballSaved = [ball.x, ball.y, ball.z, ball.owner, ball.renderPrevious];
    ball.x = a.ball[0] + (b.ball[0] - a.ball[0]) * t;
    ball.y = a.ball[1] + (b.ball[1] - a.ball[1]) * t;
    ball.z = a.ball[2] + (b.ball[2] - a.ball[2]) * t;
    ball.owner = a.ball[3];
    ball.renderPrevious = null;
    replayState.focus = { x: ball.x, y: ball.y, z: ball.z };
    update3DMeshes(1, dt * replayState.speed);
    for (const s of saved) {
      const p = s[0];
      [, p.x, p.y, p.dir, p.vx, p.vy, p.isPushing, p.bankAngle, p.gkPosture, p.visualAction, p.pokeTimer, p.stickPhase, p.renderPrevious] = s;
    }
    [ball.x, ball.y, ball.z, ball.owner, ball.renderPrevious] = ballSaved;
    return true;
  }

  // ============================================================================
  // 13. INTERFÍCIE: PRESENTACIÓ, PAUSA, DESCANS/FINAL I OPCIONS
  // ============================================================================
  function loadSettings() {
    const defaults = { diff: 'balanced', pace: 'normal', court: 'blue', sound: true, replay: true, camera: 'nhl_side' };
    try {
      const saved = JSON.parse(localStorage.getItem('okm27.arcade.settings') || '{}');
      return { ...defaults, ...saved };
    } catch (e) { return defaults; }
  }

  function saveSettings() {
    settings.diff = state.gkDiff; settings.pace = state.paceMode; settings.court = state.courtStyle; settings.camera = state.camera;
    try { localStorage.setItem('okm27.arcade.settings', JSON.stringify(settings)); } catch (e) {}
  }

  function applyDifficulty(key) {
    if (!GK_DIFFICULTY[key]) return;
    state.gkDiff = key;
    state.aiLevel = key;
  }
  function applyPace(key) {
    const mode = PACE_MODES.find(m => m.key === key);
    if (!mode) return;
    state.paceMode = mode.key;
    state.paceFactor = mode.factor;
  }
  function applyCourt(key) {
    state.courtStyle = key === 'wood' ? 'wood' : 'blue';
    if (courtFloorMesh) {
      courtFloorMesh.material.map = courtTextures[state.courtStyle];
      courtFloorMesh.material.needsUpdate = true;
    }
  }

  function syncOptionButtons() {
    if (typeof document.querySelectorAll !== 'function') return;
    let quality = 'auto';
    try { quality = localStorage.getItem('okm27.arcade.quality') || 'auto'; } catch (e) {}
    const current = {
      diff: state.gkDiff, pace: state.paceMode, court: state.courtStyle, cam: state.camera,
      sound: settings.sound ? 'on' : 'off', replay: settings.replay ? 'on' : 'off', quality,
      duration: String(state.realHalfMinutes)
    };
    for (const attr of Object.keys(current)) {
      document.querySelectorAll('[data-' + attr + ']').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-' + attr) === current[attr]);
      });
    }
  }

  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
  function setHidden(id, hidden) { const el = document.getElementById(id); if (el) el.hidden = hidden; }

  function renderResultStats() {
    const box = document.getElementById('resultStats');
    if (!box || typeof box.replaceChildren !== 'function') return;
    box.replaceChildren();
    const rows = [
      ['Xuts', state.shots.home, state.shots.away],
      ['Aturades', state.saves.home, state.saves.away],
      ['Faltes', state.fouls.home, state.fouls.away],
      ['Targetes blaves', state.blueCards.home, state.blueCards.away]
    ];
    for (const [label, h, a] of rows) {
      const total = Math.max(1, h + a);
      const row = document.createElement('div');
      row.className = 'stat';
      const left = document.createElement('span'); left.textContent = String(h);
      const mid = document.createElement('div'); mid.className = 'bar';
      const name = document.createElement('small'); name.textContent = label;
      const track = document.createElement('div'); track.className = 'track';
      const hb = document.createElement('b'); hb.className = 'h'; hb.style.width = (h / total * 100) + '%';
      const ab = document.createElement('b'); ab.className = 'a'; ab.style.width = (a / total * 100) + '%';
      track.appendChild(hb); track.appendChild(ab);
      mid.appendChild(name); mid.appendChild(track);
      const right = document.createElement('span'); right.textContent = String(a);
      row.appendChild(left); row.appendChild(mid); row.appendChild(right);
      box.appendChild(row);
    }
  }

  // Decideix quina capa es veu segons l'estat del partit.
  function updateOverlays() {
    const benchOpen = !!document.getElementById('benchDialog')?.open;
    let show = null;
    if (ui.intro) show = 'introScreen';
    else if (state.mode === 'finished' || state.mode === 'halftime') show = benchOpen ? null : 'resultScreen';
    else if (state.paused && !benchOpen) show = 'pauseMenu';
    for (const id of ['introScreen', 'pauseMenu', 'resultScreen']) setHidden(id, show !== id);
    if (show === 'pauseMenu') {
      setText('pauseScoreHome', String(state.score.home));
      setText('pauseScoreAway', String(state.score.away));
      setText('pauseMeta', state.period + 'a part · ' + formatClock(state.timeRemaining) + ' · ' + TEAMS.home.short + ' – ' + TEAMS.away.short);
      syncOptionButtons();
    }
    if (show === 'resultScreen' && ui.lastResult !== state.mode + state.period) {
      ui.lastResult = state.mode + state.period;
      const final = state.mode === 'finished';
      setText('resultEyebrow', final ? 'Final del partit' : 'Descans · 1a part acabada');
      const h = state.score.home, a = state.score.away;
      setText('resultTitle', final ? (ui.finishReason && ui.finishReason !== 'Temps exhaurit' ? ui.finishReason :
        h > a ? 'Victòria del ' + TEAMS.home.name : h < a ? 'Victòria del ' + TEAMS.away.name : 'Empat') : 'Pots fer canvis a la banqueta o començar ja la segona part');
      setText('resultHome', String(h));
      setText('resultAway', String(a));
      setHidden('btnSecondHalf', final);
      setHidden('btnResultBench', final);
      setHidden('btnRematch', !final);
      renderResultStats();
    }
    if (show !== 'resultScreen') ui.lastResult = '';
  }

  function startMatchFromIntro() {
    if (!ui.intro) return;
    ui.intro = false;
    Sfx.unlock();
    Sfx.setEnabled(settings.sound);
    state.paused = false;
    clearInput();
    showBanner('Servei de centre', 2.2, 'Passa a un company per posar la bola en joc · Atac cap a la dreta');
    Sfx.whistle(false);
    syncMatchUI();
  }

  function rematch() {
    newMatch();
    state.paused = false;
    Sfx.unlock();
    showBanner('Servei de centre', 2, 'Passa a un company per posar la bola en joc');
    syncMatchUI();
  }

  ui.intro = true;
  state.paused = true;

  window.addEventListener('resize', resizeAll);
  window.addEventListener('blur', () => { if (!ui.intro) setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !ui.intro) setPaused(true); });
  document.getElementById('btnPause')?.addEventListener('click', () => { if (!ui.intro) setPaused(!state.paused); });
  document.getElementById('btnResume')?.addEventListener('click', () => setPaused(false));
  document.getElementById('btnStart')?.addEventListener('click', startMatchFromIntro);
  document.getElementById('btnRematch')?.addEventListener('click', rematch);
  document.getElementById('btnCamera')?.addEventListener('click', () => {
    setCameraMode(CAMERA_ORDER[(CAMERA_ORDER.indexOf(state.camera) + 1) % CAMERA_ORDER.length]);
  });
  document.getElementById('btnBench')?.addEventListener('click', openBench);
  document.getElementById('btnResultBench')?.addEventListener('click', openBench);
  document.getElementById('btnCloseBench')?.addEventListener('click', closeBench);
  document.getElementById('benchDialog')?.addEventListener('cancel', e => { e.preventDefault(); closeBench(); });
  document.getElementById('benchOut')?.addEventListener('change', renderBench);
  document.getElementById('btnApplySub')?.addEventListener('click', () => {
    const outId = document.getElementById('benchOut').value;
    const inId = document.getElementById('benchIn').value;
    if (substitute('home',outId,inId)) renderBench();
  });
  document.getElementById('btnSecondHalf')?.addEventListener('click', beginSecondHalf);
  document.getElementById('matchDuration')?.addEventListener('change', event => {
    setRealHalfMinutes(event.target.value);
    try { localStorage.setItem('okm27.arcade.realHalfMinutes', String(state.realHalfMinutes)); } catch (e) {}
    syncOptionButtons();
  });
  try {
    const saved = localStorage.getItem('okm27.arcade.realHalfMinutes');
    if (saved && realHalfOptions().includes(Number(saved))) setRealHalfMinutes(saved);
  } catch (e) {}

  document.querySelectorAll('[data-duration]').forEach(btn => btn.addEventListener('click', () => {
    setRealHalfMinutes(btn.getAttribute('data-duration'));
    try { localStorage.setItem('okm27.arcade.realHalfMinutes', String(state.realHalfMinutes)); } catch (e) {}
    syncOptionButtons();
  }));
  document.querySelectorAll('[data-diff]').forEach(btn => btn.addEventListener('click', () => {
    applyDifficulty(btn.getAttribute('data-diff')); saveSettings(); syncOptionButtons();
  }));
  document.querySelectorAll('[data-pace]').forEach(btn => btn.addEventListener('click', () => {
    applyPace(btn.getAttribute('data-pace')); saveSettings(); syncOptionButtons();
  }));
  document.querySelectorAll('[data-court]').forEach(btn => btn.addEventListener('click', () => {
    applyCourt(btn.getAttribute('data-court')); saveSettings(); syncOptionButtons();
  }));
  document.querySelectorAll('[data-sound]').forEach(btn => btn.addEventListener('click', () => {
    settings.sound = btn.getAttribute('data-sound') === 'on';
    Sfx.unlock(); Sfx.setEnabled(settings.sound); saveSettings(); syncOptionButtons();
  }));
  document.querySelectorAll('[data-replay]').forEach(btn => btn.addEventListener('click', () => {
    settings.replay = btn.getAttribute('data-replay') === 'on'; saveSettings(); syncOptionButtons();
  }));
  document.querySelectorAll('[data-quality]').forEach(btn => btn.addEventListener('click', () => {
    const value = btn.getAttribute('data-quality');
    try {
      if (value === 'auto') localStorage.removeItem('okm27.arcade.quality');
      else localStorage.setItem('okm27.arcade.quality', value);
    } catch (e) {}
    syncOptionButtons();
    if (value !== 'auto' && value !== QUALITY.tier && typeof location !== 'undefined' && location.reload) location.reload();
  }));
  document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-tab');
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.getAttribute('data-panel') !== tab; });
  }));
  document.querySelectorAll('[data-cam]').forEach(btn => {
    btn.addEventListener('click', () => setCameraMode(btn.getAttribute('data-cam')));
  });

  applyDifficulty(settings.diff);
  applyPace(settings.pace);
  if (CAMERA_ORDER.includes(settings.camera)) state.camera = settings.camera;

  // Controls tàctils només en pantalles tàctils.
  const stageWrap = document.getElementById('stageWrap');
  function enableTouchLayout() {
    if (stageWrap && stageWrap.classList) stageWrap.classList.add('touch');
    const hint = document.getElementById('introHint');
    if (hint) hint.textContent = 'Joystick a l’esquerra per patinar · PASSA, XUTA (mantén), SPRINT i CANVI a la dreta';
  }
  if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) enableTouchLayout();
  window.addEventListener('touchstart', () => { if (!isTouchLayout()) enableTouchLayout(); }, { passive: true });
  stageWrap?.addEventListener('pointerdown', e => {
    if (replayState.active && e.target && e.target.id !== 'btnPause') stopReplay();
  });

  window.addEventListener('wheel', e => {
    const delta = e.deltaY > 0 ? 0.08 : -0.08;
    state.zoomAdjust = Math.max(0.6, Math.min(1.45, state.zoomAdjust + delta));
  }, { passive: true });

  window.addEventListener('keydown', e => {
    if (document.getElementById('benchDialog')?.open) return;
    if (ui.intro) {
      if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) { e.preventDefault(); startMatchFromIntro(); }
      return;
    }
    if (replayState.active && !e.repeat) { stopReplay(); return; }
    if (state.mode === 'finished') {
      if (e.code === 'Enter' && !e.repeat) rematch();
      return;
    }
    if (e.code === 'KeyB' && !e.repeat) { openBench(); return; }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (!e.repeat && state.mode !== 'halftime') setPaused(!state.paused);
      return;
    }
    if (state.mode === 'halftime') {
      if (e.code === 'Enter' && !e.repeat) beginSecondHalf();
      return;
    }
    if (state.paused) return;
    keys[e.code] = true;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'Digit1') setCameraMode('nhl_side');
    if (e.code === 'Digit2') setCameraMode('nhl_iso');
    if (e.code === 'Digit3') setCameraMode('end3d');
    if (e.code === 'Digit4') setCameraMode('wide3d');
    if (e.code === 'Equal' || e.code === 'NumpadAdd') state.zoomAdjust = Math.max(0.6, state.zoomAdjust - 0.08);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') state.zoomAdjust = Math.min(1.45, state.zoomAdjust + 0.08);
    if ((e.code === 'KeyQ' || e.code === 'Tab') && !e.repeat) switchToNextPlayer();
    if ((e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyZ') && !e.repeat) performPassOrSwitch();
    if ((e.code === 'KeyK' || e.code === 'KeyX' || e.code === 'Enter') && !e.repeat) startShootOrSteal();
  });

  window.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'KeyK' || e.code === 'KeyX' || e.code === 'Enter') releaseShot();
  });

  const joyZone = document.getElementById('joyZone');
  const joyStick = document.getElementById('joyStick');

  if (joyZone) {
    const handlePointerStart = e => {
      e.preventDefault();
      const rect = joyZone.getBoundingClientRect();
      if (state.paused || state.mode === 'finished') return;
      touchInput.pointerId = e.pointerId;
      joyZone.setPointerCapture(e.pointerId);
      touchInput.active = true;
      touchInput.originX = rect.left + rect.width / 2;
      touchInput.originY = rect.top + rect.height / 2;
      handlePointerMove(e);
    };
    const handlePointerMove = e => {
      if (!touchInput.active || e.pointerId !== touchInput.pointerId) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - touchInput.originX;
      const dy = pt.clientY - touchInput.originY;
      const maxR = 46;
      const dist = Math.min(maxR, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      const ox = Math.cos(ang) * dist;
      const oy = Math.sin(ang) * dist;
      touchInput.dx = ox / maxR;
      touchInput.dy = oy / maxR;
      if (joyStick) joyStick.style.transform = `translate(${ox}px, ${oy}px)`;
    };
    const handlePointerEnd = e => {
      if (e.pointerId !== touchInput.pointerId) return;
      touchInput.active = false;
      touchInput.dx = 0;
      touchInput.dy = 0;
      if (joyStick) joyStick.style.transform = 'translate(0px, 0px)';
    };
    joyZone.addEventListener('pointerdown', handlePointerStart);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
  }

  const pressFx = (el, on) => { if (el && el.classList) el.classList.toggle('pressed', on); };
  const btnSwitch = document.getElementById('btnSwitch');
  if (btnSwitch) btnSwitch.addEventListener('pointerdown', e => { e.preventDefault(); switchToNextPlayer(); });
  const btnPass = document.getElementById('btnPass');
  const btnShoot = document.getElementById('btnShoot');
  const btnSprint = document.getElementById('btnSprint');
  const btnBlueCard = document.getElementById('btnBlueCard');
  const btnDirectFoul = document.getElementById('btnDirectFoul');
  const btnReset = document.getElementById('btnReset');

  if (btnPass) btnPass.addEventListener('pointerdown', e => { e.preventDefault(); haptic(6); performPassOrSwitch(); });
  if (btnShoot) {
    btnShoot.addEventListener('pointerdown', e => { e.preventDefault(); pressFx(btnShoot, true); startShootOrSteal(); });
    btnShoot.addEventListener('pointerup', e => { e.preventDefault(); pressFx(btnShoot, false); releaseShot(); });
    btnShoot.addEventListener('pointerleave', () => { pressFx(btnShoot, false); if (state.chargingShot) releaseShot(); });
    btnShoot.addEventListener('pointercancel', () => { pressFx(btnShoot, false); state.chargingShot = false; state.shotCharge = 0; });
  }
  if (btnSprint) {
    btnSprint.addEventListener('pointerdown', e => { e.preventDefault(); pressFx(btnSprint, true); touchInput.sprint = true; });
    btnSprint.addEventListener('pointerup', e => { e.preventDefault(); pressFx(btnSprint, false); touchInput.sprint = false; });
    btnSprint.addEventListener('pointerleave', () => { pressFx(btnSprint, false); touchInput.sprint = false; });
    btnSprint.addEventListener('pointercancel', () => { pressFx(btnSprint, false); touchInput.sprint = false; });
  }
  if (btnBlueCard) {
    btnBlueCard.addEventListener('click', () => { setPaused(false); registerFoul('away', true); });
  }
  if (btnDirectFoul) {
    btnDirectFoul.addEventListener('click', () => {
      setPaused(false);
      if (['match','kickoff'].includes(state.mode)) resetPositions('direct_foul', 'home');
    });
  }
  if (btnReset) btnReset.addEventListener('click', rematch);

  build3DRinkArena();
  loadCharacterModels();
  createOfficialRollerHockeyGoal3D('left');
  createOfficialRollerHockeyGoal3D('right');
  createEntities();
  resizeAll();
  newMatch();
  state.paused = true;
  applyCourt(settings.court);
  calibrateSceneMaterials();
  update3DMeshes();
  updateWebGLCamera(1);
  syncMatchUI();
  syncOptionButtons();

  // Accés de depuració només amb ?debug a l'adreça (proves visuals automàtiques).
  if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search || '')) {
    window.__okArcade = { state, ball, get players() { return players; }, launchShot, endPeriod, finishMatch, registerFoul, setBallOwner, opponentGoalX };
  }

  let lastTime = performance.now();
  let accumulator = 0;
  const fixedStep = 1 / 60;
  function loop(now) {
    const dt = Math.min(0.2, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (replayState.pendingAt && now >= replayState.pendingAt && !state.paused) startReplay();
    accumulator += dt;
    while (accumulator + 1e-9 >= fixedStep) {
      captureRenderPoses();
      update(fixedStep);
      recordReplayFrame();
      accumulator = Math.max(0, accumulator - fixedStep);
    }
    // Visuals stay responsive while the match clock and physics are paused.
    if (!(replayState.active && renderReplayFrame(dt))) update3DMeshes(state.paused?1:accumulator/fixedStep,dt);
    updateWebGLCamera(dt);
    renderer.render(scene, camera);
    renderHUD();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
