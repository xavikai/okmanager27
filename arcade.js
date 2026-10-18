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

  // --- ESTAT DEL PARTIT I REGLAMENT D'HOQUEI PATINS ---
  const state = {
    mode: 'match',
    camera: 'nhl_side',
    courtStyle: 'blue',
    gkDiff: 'balanced',
    paceMode: 'realistic',
    paceFactor: 0.45,
    zoomAdjust: 1.0,
    paused: false,
    timeRemaining: 25*60,
    halfDuration: 25*60,
    period: 1,
    halftimeRemaining: 0,
    endPeriodAfterSetPiece: false,
    penalties: { home: [], away: [] },
    substitutionCount: { home: 0, away: 0 },
    benchWasPaused: false,
    pendingRestart: null,
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
    excludedPlayers: { home: null, away: null },
    shotCharge: 0,
    chargingShot: false,
    lastPassTime: 0, // Per premiar el "One-Timer" (passada al 2n pal + xut ràpid!)
    aimTargetY: RINK.h / 2,
    bannerText: '',
    bannerSubText: '',
    bannerTimer: 0,
    cardEvent: null // { type: 'blue' | 'warning', playerNum, playerName, teamName, teamColor, sanction, timer, offender }
  };

  let torreBulbs = { home: null, away: null };

  const keys = {};
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
  scene.background = new THREE.Color(0x060a14);
  scene.fog = new THREE.FogExp2(0x060a14, 0.0042);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 400);
  const camPosCurr = new THREE.Vector3(0, 26, 42);
  const camLookCurr = new THREE.Vector3(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.68);
  scene.add(ambientLight);

  const mainSpot = new THREE.DirectionalLight(0xffffff, 0.92);
  mainSpot.position.set(12, 48, 22);
  mainSpot.castShadow = true;
  mainSpot.shadow.mapSize.width = 2048;
  mainSpot.shadow.mapSize.height = 2048;
  mainSpot.shadow.camera.near = 10;
  mainSpot.shadow.camera.far = 120;
  mainSpot.shadow.camera.left = -55;
  mainSpot.shadow.camera.right = 55;
  mainSpot.shadow.camera.top = 32;
  mainSpot.shadow.camera.bottom = -32;
  scene.add(mainSpot);

  const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
  fillLight.position.set(-20, 30, -25);
  scene.add(fillLight);

  // ============================================================================
  // 2. PISTA D'HOQUEI PATINS 3D, TANQUES CORBES, METACRILAT I GRADERIES
  // ============================================================================
  let courtFloorMesh = null;
  let courtTextures = {};

  function generateCourtTexture(style) {
    const c = document.createElement('canvas');
    c.width = 2048;
    c.height = 1024;
    const g = c.getContext('2d');
    const W = c.width;
    const H = c.height;
    const sx = W / RINK.w;
    const sy = H / RINK.h;

    if (style === 'blue') {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0f5ec9');
      grad.addColorStop(0.5, '#1971e6');
      grad.addColorStop(1, '#0d55b8');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);

      for (let i = 0; i < 20; i++) {
        g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.025)';
        g.fillRect(i * (W / 20), 0, W / 20, H);
      }
    } else {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#d08f45');
      grad.addColorStop(0.5, '#dea057');
      grad.addColorStop(1, '#c07e36');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);

      for (let y = 0; y < H; y += 24) {
        g.fillStyle = (y / 24) % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(92,45,12,0.06)';
        g.fillRect(0, y, W, 24);
      }
      for (let i = 0; i < 20; i++) {
        g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)';
        g.fillRect(i * (W / 20), 0, W / 20, H);
      }
    }

    g.fillStyle = style === 'blue' ? 'rgba(245, 158, 11, 0.55)' : 'rgba(29, 78, 216, 0.45)';
    g.beginPath();
    g.arc(RINK.goalLineOffset * sx, H / 2, RINK.creaseRadius * sx, -Math.PI / 2, Math.PI / 2);
    g.closePath();
    g.fill();

    g.beginPath();
    g.arc((RINK.w - RINK.goalLineOffset) * sx, H / 2, RINK.creaseRadius * sx, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
    g.fill();

    g.strokeStyle = '#ffffff';
    g.lineWidth = 0.08*METRE*sx;

    g.beginPath();
    g.moveTo(W / 2, 0);
    g.lineTo(W / 2, H);
    g.stroke();

    g.beginPath();
    g.arc(W / 2, H / 2, RINK.centreRadius * sx, 0, Math.PI * 2);
    g.stroke();

    g.save();
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.font = '900 48px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('OK MANAGER 27', W / 2, H / 2);
    g.restore();

    const areaW = RINK.areaDepth * sx;
    const areaH = RINK.areaWidth * sy;
    g.strokeRect(RINK.goalLineOffset * sx, (H - areaH) / 2, areaW, areaH);
    g.strokeRect((RINK.w - RINK.goalLineOffset) * sx - areaW, (H - areaH) / 2, areaW, areaH);

    g.beginPath();
    g.arc(RINK.goalLineOffset * sx, H / 2, RINK.creaseRadius * sx, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    g.beginPath();
    g.arc((RINK.w - RINK.goalLineOffset) * sx, H / 2, RINK.creaseRadius * sx, Math.PI / 2, Math.PI * 1.5);
    g.stroke();

    g.strokeStyle = '#ef4444';
    g.lineWidth = 0.08*METRE*sx;
    g.beginPath();
    g.moveTo(RINK.goalLineOffset * sx, (H - areaH) / 2);
    g.lineTo(RINK.goalLineOffset * sx, (H + areaH) / 2);
    g.moveTo((RINK.w - RINK.goalLineOffset) * sx, (H - areaH) / 2);
    g.lineTo((RINK.w - RINK.goalLineOffset) * sx, (H + areaH) / 2);
    g.stroke();

    g.fillStyle = '#ffffff';
    [
      RINK.goalLineOffset + RINK.penaltyDistance,
      RINK.goalLineOffset + RINK.directDistance,
      RINK.w - RINK.goalLineOffset - RINK.penaltyDistance,
      RINK.w - RINK.goalLineOffset - RINK.directDistance
    ].forEach(px => {
      g.beginPath();
      g.arc(px * sx, H / 2, 0.05*METRE*sx, 0, Math.PI * 2);
      g.fill();
    });

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }

  function build3DRinkArena() {
    courtTextures.blue = generateCourtTexture('blue');
    courtTextures.wood = generateCourtTexture('wood');

    const floorGeo = new THREE.PlaneGeometry(RINK.w * S, RINK.h * S);
    const floorMat = new THREE.MeshStandardMaterial({
      map: courtTextures.blue,
      roughness: 0.35,
      metalness: 0.05
    });
    courtFloorMesh = new THREE.Mesh(floorGeo, floorMat);
    courtFloorMesh.rotation.x = -Math.PI / 2;
    courtFloorMesh.receiveShadow = true;
    scene.add(courtFloorMesh);

    const outerFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 140),
      new THREE.MeshStandardMaterial({ color: 0x090e1a, roughness: 0.9 })
    );
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.08;
    scene.add(outerFloor);

    const cr = RINK.cornerRadius * S;
    const hw = (RINK.w * S) / 2;
    const hh = (RINK.h * S) / 2;
    const perimPts = [];
    const corners = [
      { cx: hw - cr, cz: -hh + cr, a0: -Math.PI / 2, a1: 0 },
      { cx: hw - cr, cz: hh - cr, a0: 0, a1: Math.PI / 2 },
      { cx: -hw + cr, cz: hh - cr, a0: Math.PI / 2, a1: Math.PI },
      { cx: -hw + cr, cz: -hh + cr, a0: Math.PI, a1: Math.PI * 1.5 }
    ];
    for (const c of corners) {
      for (let i = 0; i <= 12; i++) {
        const a = c.a0 + (c.a1 - c.a0) * (i / 12);
        perimPts.push(new THREE.Vector2(c.cx + Math.cos(a) * cr, c.cz + Math.sin(a) * cr));
      }
    }

    const boardMatBack = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
    const boardMatFront = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.25 });
    const kickMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.16,
      roughness: 0.1
    });

    for (let i = 0; i < perimPts.length; i++) {
      const p1 = perimPts[i];
      const p2 = perimPts[(i + 1) % perimPts.length];
      const dx = p2.x - p1.x;
      const dz = p2.y - p1.y;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 0.05) continue;

      const midX = (p1.x + p2.x) * 0.5;
      const midZ = (p1.y + p2.y) * 0.5;
      const ang = Math.atan2(dz, dx);
      const isFrontSide = midZ > hh * 0.55;

      const bGeo = new THREE.BoxGeometry(segLen + 0.08, 2.5, 0.35);
      const bMesh = new THREE.Mesh(bGeo, isFrontSide ? boardMatFront : boardMatBack);
      bMesh.position.set(midX, 1.25, midZ);
      bMesh.rotation.y = -ang;
      bMesh.castShadow = !isFrontSide;
      bMesh.receiveShadow = true;
      scene.add(bMesh);

      if (!isFrontSide) {
        const kGeo = new THREE.BoxGeometry(segLen + 0.1, 0.55, 0.4);
        const kMesh = new THREE.Mesh(kGeo, kickMat);
        kMesh.position.set(midX, 0.28, midZ);
        kMesh.rotation.y = -ang;
        scene.add(kMesh);
      }

      const rGeo = new THREE.BoxGeometry(segLen + 0.1, 0.25, 0.42);
      const rMesh = new THREE.Mesh(rGeo, railMat);
      rMesh.position.set(midX, 2.55, midZ);
      rMesh.rotation.y = -ang;
      scene.add(rMesh);

      if (!isFrontSide) {
        const gGeo = new THREE.BoxGeometry(segLen, 3.2, 0.12);
        const gMesh = new THREE.Mesh(gGeo, glassMat);
        gMesh.position.set(midX, 4.25, midZ);
        gMesh.rotation.y = -ang;
        scene.add(gMesh);
      }
    }

    const ads = [
      { x: -30, text: 'OK MANAGER 27', bg: '#1e3a8a', fg: '#ffffff' },
      { x: -15, text: 'OK LLIGA', bg: '#dc2626', fg: '#ffffff' },
      { x: 0, text: 'HOQUEI PATINS', bg: '#0f172a', fg: '#facc15' },
      { x: 15, text: 'WSE EUROPE', bg: '#059669', fg: '#ffffff' },
      { x: 30, text: 'OK MANAGER 27', bg: '#1e3a8a', fg: '#ffffff' }
    ];
    ads.forEach(ad => {
      const ac = document.createElement('canvas');
      ac.width = 512;
      ac.height = 128;
      const ag = ac.getContext('2d');
      ag.fillStyle = ad.bg;
      ag.fillRect(0, 0, 512, 128);
      ag.strokeStyle = '#ffffff';
      ag.lineWidth = 6;
      ag.strokeRect(4, 4, 504, 120);
      ag.fillStyle = ad.fg;
      ag.font = '900 46px system-ui, sans-serif';
      ag.textAlign = 'center';
      ag.textBaseline = 'middle';
      ag.fillText(ad.text, 256, 66);

      const adTex = new THREE.CanvasTexture(ac);
      const adPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(11.5, 1.85),
        new THREE.MeshBasicMaterial({ map: adTex })
      );
      adPlane.position.set(ad.x, 1.5, -hh + 0.22);
      scene.add(adPlane);
    });

    // --- BASE 5.1, 10.7, 11.4 i 30.1.3 RFEP 2026/2027: MESA DE CONTROL, TORRES LLUMINOSES, BANQUETES PROTEGIDES I MARCADORS DE 45s ---
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const mesaControl = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.8, 1.8), tableMat);
    mesaControl.position.set(0, 0.9, -hh - 1.6);
    scene.add(mesaControl);

    // Cronometrador i Àrbitre Auxiliar asseguts a la Mesa de Control
    const officialSuitMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 });
    const officialSkinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.55 });
    [-1.2, 1.2].forEach(ox => {
      const offTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 1.35, 10), officialSuitMat);
      offTorso.position.set(ox, 2.15, -hh - 2.15);
      scene.add(offTorso);
      const offHead = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), officialSkinMat);
      offHead.position.set(ox, 3.05, -hh - 2.15);
      scene.add(offHead);
    });

    // Marcador de Faltes d'Equip sobre la valla a la Mesa de Control (Base 5.1)
    const foulBoard = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.2, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
    );
    foulBoard.position.set(0, 3.1, -hh - 1.1);
    scene.add(foulBoard);

    // Dues Torres Lluminoses (avís preventiu de 9 faltes d'equip i Temps Morts - Base 5.1 / 10.7 / 11.4)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 });
    [-2.3, 2.3].forEach((tx, idx) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 10), poleMat);
      pole.position.set(tx, 3.1, -hh - 1.2);
      scene.add(pole);

      const bulbMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
      const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.65, 14), bulbMat);
      bulb.position.set(tx, 4.6, -hh - 1.2);
      scene.add(bulb);
      if (idx === 0) torreBulbs.home = bulbMat;
      else torreBulbs.away = bulbMat;
    });

    // Proteccions de les Banquetes obligatòries (Base 30.1.3 OK Lliga Masculina)
    [-16, 16].forEach(bx => {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.1, 1.4), tableMat);
      bench.position.set(bx, 0.55, -hh - 1.8);
      scene.add(bench);
      const shield = new THREE.Mesh(new THREE.BoxGeometry(9.8, 3.4, 0.15), glassMat);
      shield.position.set(bx, 2.9, -hh - 2.5);
      scene.add(shield);
    });

    // Dos Marcadors de 45 Segons de Possessió als fons de pista (Base 10.7 / 11.4)
    [-hw + 4.5, hw - 4.5].forEach(sx => {
      const post45 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 5.2, 8), poleMat);
      post45.position.set(sx, 2.6, -hh - 1.5);
      scene.add(post45);
      const box45 = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 1.6, 0.35),
        new THREE.MeshBasicMaterial({ color: 0x090d16 })
      );
      box45.position.set(sx, 5.6, -hh - 1.5);
      scene.add(box45);
    });

    const standMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
    const fanColors = [0x1d4ed8, 0xdc2626, 0xfacc15, 0xe2e8f0, 0x334155, 0x10b981];
    const headMat = new THREE.MeshLambertMaterial({ color: 0xf1c27d });

    for (let row = 0; row < 5; row++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(116, 1.8, 3.2), standMat);
      step.position.set(0, 1.2 + row * 2.1, -hh - 4.5 - row * 3.1);
      scene.add(step);

      for (let fx = -48; fx <= 48; fx += 2.8) {
        if ((Math.abs(fx * 13 + row * 7) % 5) === 0) continue;
        const bodyMat = new THREE.MeshLambertMaterial({
          color: fanColors[Math.abs(Math.floor(fx) + row * 3) % fanColors.length]
        });
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.3, 8), bodyMat);
        torso.position.set(fx + (row % 2) * 0.9, 2.5 + row * 2.1, -hh - 4.4 - row * 3.1);
        scene.add(torso);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 8), headMat);
        head.position.set(torso.position.x, torso.position.y + 0.9, torso.position.z);
        scene.add(head);
      }
    }
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
  function createJerseyTexture(team, num) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');

    g.fillStyle = team.primary;
    g.fillRect(0, 0, 256, 256);

    g.fillStyle = team.secondary;
    g.fillRect(50, 0, 45, 256);
    g.fillRect(160, 0, 45, 256);

    g.fillStyle = '#ffffff';
    g.strokeStyle = '#0f172a';
    g.lineWidth = 8;
    g.font = '900 92px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeText(String(num), 128, 130);
    g.fillText(String(num), 128, 130);

    return new THREE.CanvasTexture(c);
  }

  function buildSkater3DMesh(p, team) {
    const group = new THREE.Group();

    const jerseyTex = createJerseyTexture(team, p.num);
    const jerseyMat = new THREE.MeshStandardMaterial({ map: jerseyTex, roughness: 0.55 });
    const shortsMat = new THREE.MeshStandardMaterial({ color: team.shorts, roughness: 0.65 });
    const socksMat = new THREE.MeshStandardMaterial({ color: team.socks || team.primary, roughness: 0.6 });
    const skinMat = new THREE.MeshStandardMaterial({ color: team.skin, roughness: 0.52 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
    const browMat = new THREE.MeshBasicMaterial({ color: p.idx % 2 === 0 ? 0x1c1917 : 0x451a03 });
    const whitePadMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 });
    const darkBootMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });
    const truckMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.25 });
    const stopperMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: team.shorts, roughness: 0.45 });
    const stickWoodMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.35 });
    const stickTapeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });

    // Anell de selecció / possessió
    const ringGeo = new THREE.RingGeometry(1.45, 1.85, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.06;
    group.add(ringMesh);

    const bodyPivot = new THREE.Group();
    group.add(bodyPivot);

    // 1. MALUCS I PANTALÓ D'HOQUEI PATINS
    const hips = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.68, 0.88), shortsMat);
    hips.position.y = 1.45;
    hips.castShadow = true;
    bodyPivot.add(hips);

    // 2. TORS ATLÈTIC AMB ESPATLLERES INTERIORS
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.58, 1.48, 14), jerseyMat);
    torso.position.y = 2.45;
    torso.scale.set(0.76, 1, 1.10);
    torso.castShadow = true;
    bodyPivot.add(torso);

    const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.76, 12), jerseyMat);
    shoulders.rotation.x = Math.PI / 2;
    shoulders.position.set(0, 3.02, 0);
    bodyPivot.add(shoulders);

    // 3. COLL I CAP EXPRESSIU AMB ROSTRE HUMÀ
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.38, 10), skinMat);
    neck.position.y = 3.28;
    bodyPivot.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.y = 3.72;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), skinMat);
    head.scale.set(0.94, 1.05, 0.94);
    head.castShadow = true;
    headGroup.add(head);

    // Orelles
    [-0.43, 0.43].forEach(zPos => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), skinMat);
      ear.position.set(0, 0, zPos);
      ear.scale.set(0.5, 1, 0.8);
      headGroup.add(ear);
    });

    // Ulls i Celles expressives
    [-0.15, 0.15].forEach(zPos => {
      // Ull (sclera)
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeWhiteMat);
      eye.position.set(0.40, 0.05, zPos);
      headGroup.add(eye);

      // Pupil·la
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), pupilMat);
      pupil.position.set(0.44, 0.05, zPos);
      headGroup.add(pupil);

      // Cella
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.12), browMat);
      brow.position.set(0.41, 0.13, zPos);
      brow.rotation.x = (zPos > 0 ? 0.12 : -0.12);
      headGroup.add(brow);
    });

    // Nas anatòmic
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6), skinMat);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(0.46, -0.02, 0);
    headGroup.add(nose);

    // Boca
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.15), browMat);
    mouth.position.set(0.42, -0.16, 0);
    headGroup.add(mouth);

    // Pentinat personalitzat o cinta de cabell
    const hairColor = p.idx % 3 === 0 ? 0x1e1b18 : (p.idx % 3 === 1 ? 0x78350f : 0x0f172a);
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85 });
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.47, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    hair.position.set(-0.02, 0.06, 0);
    hair.rotation.z = 0.12;
    headGroup.add(hair);

    // Cinta atlètica de cabell de l'equip
    const headbandMat = new THREE.MeshStandardMaterial({ color: team.secondary, roughness: 0.6 });
    const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.10, 16), headbandMat);
    headband.position.set(0, 0.12, 0);
    headGroup.add(headband);

    bodyPivot.add(headGroup);

    // 4. CAMES ARTICULADES AMB GENOLLERES I PATINS DE 4 RODES (QUAD SKATES)
    function createLeg(zOffset) {
      const legPivot = new THREE.Group();
      legPivot.position.set(0, 1.35, zOffset);

      // Cuixa
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.65, 10), shortsMat);
      thigh.position.y = -0.32;
      thigh.castShadow = true;
      legPivot.add(thigh);

      // Genollera gran d'hoquei patins
      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), whitePadMat);
      kneePad.position.set(0.08, -0.62, 0);
      legPivot.add(kneePad);

      // Canya amb mitgeta del club
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.17, 0.65, 10), socksMat);
      shin.position.y = -0.92;
      shin.castShadow = true;
      legPivot.add(shin);

      // Bota reforçada de cuir negre amb llengüeta alta
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.34), darkBootMat);
      boot.position.set(0.09, -1.22, 0);
      boot.castShadow = true;
      legPivot.add(boot);

      // Planxa metàl·lica dels patins (truck plate)
      const truck = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.26), truckMat);
      truck.position.set(0.08, -1.38, 0);
      legPivot.add(truck);

      // Tac de fre davanter d'hoquei patins (stopper taronja)
      const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.12, 8), stopperMat);
      stopper.position.set(0.40, -1.38, 0);
      legPivot.add(stopper);

      // 4 Rodes de poliuretà amb eixos
      [[-0.18, -0.19], [0.24, -0.19], [-0.18, 0.19], [0.24, 0.19]].forEach(([wx, wz]) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.09, 12), wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx + 0.08, -1.41, wz);
        legPivot.add(wheel);
      });

      return legPivot;
    }

    const leftLeg = createLeg(-0.35);
    const rightLeg = createLeg(0.35);
    bodyPivot.add(leftLeg);
    bodyPivot.add(rightLeg);

    // 5. DOS BRAÇOS ARTICULATS:
    // A) Braç esquerre (braç d'equilibri amb guant lliure que obre en patinar)
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(0.05, 2.95, -0.66);

    const leftArmUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.65, 10), jerseyMat);
    leftArmUpper.position.set(0, -0.32, 0);
    leftArmPivot.add(leftArmUpper);

    const leftForearmPivot = new THREE.Group();
    leftForearmPivot.position.set(0, -0.65, 0);
    leftArmPivot.add(leftForearmPivot);

    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.62, 10), skinMat);
    leftForearm.position.set(0.08, -0.30, 0);
    leftForearm.rotation.z = -0.28;
    leftForearmPivot.add(leftForearm);

    const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.30, 0.28), gloveMat);
    leftGlove.position.set(0.18, -0.62, 0);
    leftForearmPivot.add(leftGlove);

    bodyPivot.add(leftArmPivot);

    // B) Braç dret (braç principal de subjecció de l'estic)
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.15, 2.95, 0.66);

    const rightArmUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.65, 10), jerseyMat);
    rightArmUpper.position.set(0.08, -0.32, 0);
    rightArmPivot.add(rightArmUpper);

    const stickPivot = new THREE.Group();
    stickPivot.position.set(0.18, -0.62, 0);
    rightArmPivot.add(stickPivot);

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.62, 10), skinMat);
    rightForearm.position.set(0.16, -0.28, -0.1);
    rightForearm.rotation.z = -0.42;
    stickPivot.add(rightForearm);

    const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.30), gloveMat);
    rightGlove.position.set(0.35, -0.62, -0.15);
    stickPivot.add(rightGlove);

    // Estic tradicional d'hoquei patins (mànec corbat i pala encintada)
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.65, 8), stickWoodMat);
    shaft.position.set(0.95, -1.35, -0.15);
    shaft.rotation.z = 0.55;
    shaft.castShadow = true;
    stickPivot.add(shaft);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.24, 0.12), stickTapeMat);
    blade.position.set(1.78, -2.24, -0.05);
    blade.rotation.y = -0.22;
    blade.castShadow = true;
    stickPivot.add(blade);

    bodyPivot.add(rightArmPivot);

    scene.add(group);
    return { group, bodyPivot, leftLeg, rightLeg, leftArmPivot, rightArmPivot, stickPivot, ringMesh, ringMat };
  }

  function buildGoalkeeper3DMesh(p, team) {
    const group = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(1.5, 1.9, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.06;
    group.add(ringMesh);

    const bodyPivot = new THREE.Group();
    group.add(bodyPivot);

    const padMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const strapMat = new THREE.MeshStandardMaterial({ color: team.primary, roughness: 0.5 });
    const chestMat = new THREE.MeshStandardMaterial({ color: team.gkColor, roughness: 0.45 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const cageMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });
    const darkBootMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });

    // 1. PETO MASSÍU I CUIRASSA DE PORTER D'HOQUEI PATINS
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.55, 1.52), chestMat);
    chest.position.set(0.05, 1.92, 0);
    chest.castShadow = true;
    bodyPivot.add(chest);

    // Muscleres amples d'amortiment
    const shoulderPads = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.95, 12), chestMat);
    shoulderPads.rotation.x = Math.PI / 2;
    shoulderPads.position.set(0.04, 2.55, 0);
    bodyPivot.add(shoulderPads);

    // 2. CASCO INTEGRAL AMB CARETA I REIXA D'ACER
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), strapMat);
    helmet.position.set(0.08, 3.12, 0);
    helmet.scale.set(1.05, 1.08, 1.02);
    helmet.castShadow = true;
    bodyPivot.add(helmet);

    // Careta de reixa metàl·lica amb barres d'acer
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 0.55), cageMat);
    cage.position.set(0.52, 3.08, 0);
    bodyPivot.add(cage);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.08, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
    );
    visor.position.set(0.50, 3.36, 0);
    bodyPivot.add(visor);

    // 3. BRAÇ ESQUERRE: GUANT-ESCUT / MANOPLA DE PORTER (Blocker Shield)
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(0.12, 2.35, -0.92);

    const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.85, 10), chestMat);
    leftArmMesh.position.set(0.12, -0.40, 0);
    leftArmMesh.rotation.z = -0.35;
    leftArmPivot.add(leftArmMesh);

    // Gran escut d'aturada de porter d'hoquei patins
    const blockerShield = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.95, 0.72), gloveMat);
    blockerShield.position.set(0.34, -0.72, 0);
    blockerShield.castShadow = true;
    leftArmPivot.add(blockerShield);
    bodyPivot.add(leftArmPivot);

    // 4. BRAÇ DRET: GUANT D'ESTIC I ESTIC OFICIAL DE PORTER
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.12, 2.35, 0.92);

    const rightArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.85, 10), chestMat);
    rightArmMesh.position.set(0.12, -0.40, 0);
    rightArmMesh.rotation.z = -0.35;
    rightArmPivot.add(rightArmMesh);

    const gkGlove = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.32), gloveMat);
    gkGlove.position.set(0.32, -0.75, 0);
    rightArmPivot.add(gkGlove);

    // Estic oficial de porter d'hoquei patins (mànec curt + pala plana ampla)
    const gkStickPivot = new THREE.Group();
    gkStickPivot.position.set(0.42, -0.75, 0);

    const gkShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 1.35, 8),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 })
    );
    gkShaft.position.set(0.15, -0.45, 0);
    gkShaft.rotation.z = 0.42;
    gkStickPivot.add(gkShaft);

    const gkBlade = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.32, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 })
    );
    gkBlade.position.set(0.35, -1.05, 0);
    gkBlade.rotation.y = -0.18;
    gkBlade.castShadow = true;
    gkStickPivot.add(gkBlade);

    rightArmPivot.add(gkStickPivot);
    bodyPivot.add(rightArmPivot);

    // 5. GUARDES D'HOQUEI PATINS ARTICULADES
    function createGkLeg(zOffset) {
      const padGroup = new THREE.Group();
      padGroup.position.set(0.15, 0, zOffset);

      // Gran guarda d'hoquei patins vertical
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.42, 0.68), padMat);
      pad.position.set(0, 0.72, 0);
      pad.castShadow = true;
      padGroup.add(pad);

      // Tires de protecció de color del club a la guarda
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.16, 0.70), strapMat);
      stripe.position.set(0, 0.72, 0);
      padGroup.add(stripe);

      // Bota i patins sota la guarda
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.32, 0.36), darkBootMat);
      boot.position.set(0.04, 0.16, 0);
      padGroup.add(boot);

      [[-0.18, -0.19], [0.22, -0.19], [-0.18, 0.19], [0.22, 0.19]].forEach(([wx, wz]) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx + 0.04, -0.02, wz);
        padGroup.add(wheel);
      });

      return padGroup;
    }

    const leftPadGroup = createGkLeg(-0.52);
    const rightPadGroup = createGkLeg(0.52);
    bodyPivot.add(leftPadGroup);
    bodyPivot.add(rightPadGroup);

    scene.add(group);
    return {
      group,
      bodyPivot,
      leftPadGroup,
      rightPadGroup,
      leftArmPivot,
      rightArmPivot,
      gkStickPivot,
      ringMesh,
      ringMat
    };
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

  function buildReferee3DMesh(ref) {
    const group = new THREE.Group();
    const bodyPivot = new THREE.Group();
    group.add(bodyPivot);

    const jerseyTex = createRefereeJerseyTexture();
    const jerseyMat = new THREE.MeshStandardMaterial({ map: jerseyTex, roughness: 0.5 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.55 });
    const darkBootMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
    const whistleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });

    const hips = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.65, 0.82), pantsMat);
    hips.position.y = 1.45;
    hips.castShadow = true;
    bodyPivot.add(hips);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.56, 1.45, 14), jerseyMat);
    torso.position.y = 2.45;
    torso.scale.set(0.75, 1, 1.02);
    torso.castShadow = true;
    bodyPivot.add(torso);

    const whistle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.22), whistleMat);
    whistle.position.set(0.46, 2.55, 0);
    bodyPivot.add(whistle);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), skinMat);
    head.position.y = 3.55;
    head.castShadow = true;
    bodyPivot.add(head);

    const hairMat = new THREE.MeshStandardMaterial({ color: ref.id === 0 ? 0x1e293b : 0x451a03, roughness: 0.8 });
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.47, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 3.6;
    hair.rotation.z = 0.15;
    bodyPivot.add(hair);

    function createRefLeg(zOffset) {
      const legPivot = new THREE.Group();
      legPivot.position.set(0, 1.35, zOffset);

      // Pantaló llarg negre d'àrbitre d'hoquei patins
      const trouser = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.98, 10), pantsMat);
      trouser.position.y = -0.5;
      trouser.castShadow = true;
      legPivot.add(trouser);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.30, 0.34), darkBootMat);
      boot.position.set(0.08, -1.05, 0);
      boot.castShadow = true;
      legPivot.add(boot);

      [[-0.18, -0.18], [0.24, -0.18], [-0.18, 0.18], [0.24, 0.18]].forEach(([wx, wz]) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx + 0.06, -1.24, wz);
        legPivot.add(wheel);
      });

      return legPivot;
    }

    const leftLeg = createRefLeg(-0.33);
    const rightLeg = createRefLeg(0.33);
    bodyPivot.add(leftLeg);
    bodyPivot.add(rightLeg);

    // Braç esquerre (per assenyalar direcció de possessió o gol)
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(0.1, 2.85, -0.58);
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.95, 10), jerseyMat);
    leftArm.position.set(0.1, -0.42, 0);
    leftArmPivot.add(leftArm);
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), skinMat);
    leftHand.position.set(0.12, -0.92, 0);
    leftArmPivot.add(leftHand);
    bodyPivot.add(leftArmPivot);

    // Braç dret (per aixecar el braç de falta o mostrar la Targeta Blava 3D!)
    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.1, 2.85, 0.58);
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.95, 10), jerseyMat);
    rightArm.position.set(0.1, -0.42, 0);
    rightArmPivot.add(rightArm);
    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), skinMat);
    rightHand.position.set(0.12, -0.92, 0);
    rightArmPivot.add(rightHand);

    // Targeta 3D oficial a la mà dreta de l'àrbitre (Blava 2' d'exclusió o Groga d'amonestació)
    const cardMat = new THREE.MeshBasicMaterial({ color: 0x2563eb });
    const blueCardMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.85, 0.58),
      cardMat
    );
    blueCardMesh.position.set(0.18, -1.28, 0);
    blueCardMesh.visible = false;
    rightArmPivot.add(blueCardMesh);

    bodyPivot.add(rightArmPivot);

    scene.add(group);
    return { group, bodyPivot, leftLeg, rightLeg, leftArmPivot, rightArmPivot, blueCardMesh, cardMat };
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
    chosen.signalType = signalType;
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
    const stopped = state.paused || ['kickoff','whistle_pause','goal_celebration','halftime'].includes(state.mode);
    if (!stopped || state.mode === 'finished' || state.mode === 'direct_foul' ||
        !out || !incoming || out === incoming || !out.onPitch || !eligible(out) ||
        incoming.onPitch || !eligible(incoming) || (out.role === 'GK') !== (incoming.role === 'GK')) return false;
    const slot = players.indexOf(out);
    if (slot < 0) return false;
    if (ball.owner === out && state.mode === 'kickoff') state.kickoffTaker = incoming;
    if (ball.owner === out) {
      if (state.mode === 'kickoff') ball.owner = incoming;
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
    state.pendingRestart = null;
    state.endPeriodAfterSetPiece = false;
    state.timeRemaining = 0;
    ball.owner = null;
    ball.vx = ball.vy = ball.vz = 0;
    clearInput();
    if (state.period === 2) { finishMatch(); return; }
    state.mode = 'halftime';
    state.halftimeRemaining = 600;
    showBanner('DESCANS · ' + state.score.home + ' — ' + state.score.away, 3600,
      '10 minuts · Pots fer canvis o saltar el descans');
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
    if (format) format.textContent = '2 × ' + state.halfDuration/60 + ' min';
    const pause = document.getElementById('btnPause');
    if (pause) {
      pause.textContent = state.paused ? '▶ Continua' : '⏸ Pausa';
      pause.setAttribute('aria-pressed',String(state.paused));
    }
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
    setPaused(true);
    renderBench();
    document.getElementById('benchDialog')?.showModal();
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
    const button = document.getElementById('btnPause');
    if (button) {
      button.textContent = paused ? '▶ Continua' : '⏸ Pausa';
      button.setAttribute('aria-pressed', String(paused));
    }
    if (paused) showBanner('PARTIT EN PAUSA', 3600, 'Prem P o Continua per reprendre el joc');
    else if (state.mode === 'halftime') showBanner('DESCANS · ' + state.score.home + ' — ' + state.score.away,3600,
      'Pots fer canvis o saltar el descans');
    else state.bannerTimer = 0;
  }

  function finishMatch(reason = 'Temps exhaurit') {
    state.mode = 'finished';
    state.pendingRestart = null;
    ball.owner = null;
    ball.vx = ball.vy = ball.vz = 0;
    clearInput();
    showBanner('FINAL · ' + state.score.home + ' — ' + state.score.away,
      3600, reason + ' · Prem Nou partit per tornar a jugar');
    syncMatchUI();
  }

  function newMatch() {
    state.mode = 'kickoff';
    state.paused = false;
    const requested = Number(document.getElementById('matchDuration')?.value);
    state.halfDuration = [180,1500].includes(requested) ? requested : 1500;
    state.period = 1;
    state.timeRemaining = state.halfDuration;
    state.halftimeRemaining = 0;
    state.endPeriodAfterSetPiece = false;
    state.pendingRestart = null;
    state.cardEvent = null;
    state.lastPassTime = -Infinity;
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

  function restartFreeHit(team, x, y) {
    resetPositions('match', team);
    const taker = players.find(p => p.team === team && p.role !== 'GK' && !playerUnavailable(p));
    if (!taker) return finishMatch('Sense jugadors disponibles');
    taker.x = Math.max(25, Math.min(RINK.w - 25, x));
    taker.y = Math.max(25, Math.min(RINK.h - 25, y));
    taker.dir = attackDirection(team) > 0 ? 0 : Math.PI;
    players.forEach(p => {
      if (p === taker || playerUnavailable(p)) return;
      const dx = p.x - taker.x, dy = p.y - taker.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 75) {
        p.x = taker.x + (dx / (distance || 1) || (attackDirection(team))) * 80;
        p.y = taker.y + dy / (distance || 1) * 80;
        constrainToRink(p, 0);
      }
    });
    ball.x = taker.x;
    ball.y = taker.y;
    setBallOwner(taker);
    state.crossedHalfCourt = isInAttackingHalf(team, ball.x);
    showBanner('LLIURE INDIRECTE · ' + TEAMS[team].short, 1.5, 'Represa simplificada: bola al jugador executor');
  }

  function startSetPiece(mode, team) {
    state.setPieceType = mode;
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
        p.x = ownGoalX(team) + sign*RINK.areaDepth*0.5;
        p.y = RINK.h/2 - RINK.areaWidth/2 + 25 + p.idx*35;
      }
    });
    if (state.timeRemaining < 3) {
      state.timeRemaining = 5;
      state.endPeriodAfterSetPiece = true;
    }
    ball.x = shooter.x; ball.y = shooter.y;
    ball.owner = shooter;
    state.possessionClock = 45;
    state.crossedHalfCourt = true;
    if (team === 'home') state.controlledIdx = players.indexOf(shooter);
    else switchToNextPlayer();
    showBanner((mode === 'penalty' ? 'PENAL!' : 'FALTA DIRECTA!') + ' · ' + TEAMS[team].short,
      2.2, 'Apunta i xuta · La passada no està permesa');
  }

  function setBallOwner(p) {
    if (p && playerUnavailable(p)) return;
    const prevOwner = ball.owner;
    const prevTeam = state.possessionTeam;
    ball.owner = p;
    if (!p) return;

    p.aiHoldTimer = 0;
    ball.shotByTeam = null;
    if (prevTeam !== p.team || ball.reboundedReset) {
      ball.reboundedReset = false;
      state.possessionTeam = p.team;
      state.possessionClock = 45;
      state.halfCourtClock = 10;
      state.backCourtClock = 5;
      state.crossedHalfCourt = isInAttackingHalf(p.team, p.x);

      // Si l'usuari humà ('home') perd la bola a camp contrari, canvi automàtic al defensor més proper + replegament!
      if (prevTeam === 'home' && p.team === 'away' && prevOwner && prevOwner.team === 'home') {
        onHumanLostBallInAttack(prevOwner);
      }
    }
    if (p.team === 'home' && p.role !== 'GK') {
      state.controlledIdx = players.indexOf(p);
    }
  }

  // REPLEGAMENT DEFENTSIU I AUTO-SWITCH:
  // Quan perdem la bola a camp rival, el davanter replega ràpid i prenem el control del jugador més proper a la bola/defensa
  function onHumanLostBallInAttack(lostPlayer = null) {
    const controlled = lostPlayer || players[state.controlledIdx];
    if (!controlled || controlled.team !== 'home') return;

    if ((controlled.x-RINK.w/2)*attackDirection('home') > -25) {
      controlled.isRetreating = true;
      controlled.retreatTimer = 3.6;

      let bestIdx = -1;
      let bestScore = 99999;
      players.forEach((p, idx) => {
        if (p.team === 'home' && p.role !== 'GK' && p !== controlled) {
          if (playerUnavailable(p)) return;
          const dBall = Math.hypot(p.x - ball.x, p.y - ball.y);
          // Donem prioritat al jugador més proper a la jugada i al propi camp per tallar la contra
          const score = dBall + ((p.x-RINK.w/2)*attackDirection('home') > 0 ? 65 : 0);
          if (score < bestScore) {
            bestScore = score;
            bestIdx = idx;
          }
        }
      });

      if (bestIdx !== -1) {
        state.controlledIdx = bestIdx;
        showBanner(`🛡️ REPLEGAMENT! Control: ${players[bestIdx].name}`, 1.2);
      }
    }
  }

  function isInAttackingHalf(teamKey, xPos) {
    return (xPos-RINK.w/2)*attackDirection(teamKey) > 0;
  }

  function isInOwnHalf(teamKey, xPos) {
    return (xPos-RINK.w/2)*attackDirection(teamKey) < 0;
  }

  function callRuleViolation(title, subtitle, nextTeam, restartX = RINK.w / 2, restartY = RINK.h / 2) {
    if (state.mode === 'whistle_pause' || state.mode === 'goal_celebration') return;
    state.mode = 'whistle_pause';
    triggerRefereeSignal('whistle', ball.x, ball.y, '📣 INFRACCIÓ!');
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
    state.directShooter = null;
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

    if (state.camera === 'nhl_side') {
      const cx = Math.max(-28, Math.min(28, fx));
      const cz = fz * 0.35;
      targetPos.set(cx - 2.5, 23.5 * zMul, cz + 36.5 * zMul);
      targetLook.set(cx + 1.5, 0.8, cz - 2.0);
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
          if (isBall) showBanner('AL PAL! (Reinici a 45s)', 0.9);
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
    if (state.paused || state.mode === 'finished') return;
    let bestIdx = state.controlledIdx;
    let bestDist = 99999;
    players.forEach((p, idx) => {
      if (p.team === 'home' && p.role !== 'GK' && idx !== state.controlledIdx) {
        if (playerUnavailable(p)) return;
        const d = Math.hypot(p.x - ball.x, p.y - ball.y);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      }
    });
    state.controlledIdx = bestIdx;
  }

  // Acció de TREURE LA BOLA amb l'estic (tant amb el botó de Passa/Roba com amb Entrada Forta)
  function attemptTakeBall(p, isHardTackle = false) {
    if (!p || playerUnavailable(p) || state.paused || p.stealCooldown > 0) return;
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
      setBallOwner(p);
      showBanner(isHardTackle ? '🏑 ENTRADA D\'ESTIC NETA!' : '🏑 BOLA ROBADA!', 0.85);
    }
  }

  function performPassOrSwitch() {
    if (state.paused || state.mode === 'direct_foul') return;
    if (state.mode !== 'match' && state.mode !== 'kickoff') return;
    if (state.mode === 'kickoff' && state.possessionTeam !== 'home') return;
    const me = getControlledPlayer();
    if (!me) return;

    if (ball.owner === me) {
      if (state.mode === 'kickoff') {
        state.mode = 'match';
        triggerRefereeSignal('whistle', 500, RINK.h / 2, '📣 BOLA EN JOC!', null, 1.2);
        showBanner('BOLA EN JOC!', 1.0);
      }

      const inp = getInputVector();
      const aimAngle = inp.len > 0.15 ? Math.atan2(inp.dy, inp.dx) : me.dir;

      let bestMate = null;
      let bestScore = -999;
      players.forEach((p, idx) => {
        if (p.team === 'home' && p !== me && p.role !== 'GK') {
          if (playerUnavailable(p)) return;
          const dx = p.x - me.x;
          const dy = p.y - me.y;
          const dist = Math.hypot(dx, dy);
          const angleToMate = Math.atan2(dy, dx);
          const angleDiff = Math.abs(normalizeAngle(angleToMate - aimAngle));
          if (angleDiff < Math.PI * 0.65) {
            const score = Math.cos(angleDiff) * 2.2 - dist / 450;
            if (score > bestScore) {
              bestScore = score;
              bestMate = { p, idx };
            }
          }
        }
      });

      ball.owner = null;
      ball.shotByTeam = null;
      state.lastPassTime = performance.now();
      let passAngle = aimAngle;
      // Velocitat de passada calibrada segons l'atribut de passada del jugador (pass)
      const passStat = ((me.stats && me.stats.pass) || 85) / 85;
      let passSpeed = 7.2 * state.paceFactor * (0.85 + passStat * 0.22);
      if (bestMate) {
        const rawDist = Math.hypot(bestMate.p.x - me.x, bestMate.p.y - me.y);
        passSpeed = Math.min(9.8, Math.max(6.2, 5.2 + rawDist * 0.014)) * state.paceFactor * (0.85 + passStat * 0.22);
        const estFrames = Math.min(20, rawDist / Math.max(2.2, passSpeed)) * 0.55;
        const tx = bestMate.p.x + bestMate.p.vx * estFrames;
        const ty = bestMate.p.y + bestMate.p.vy * estFrames;
        passAngle = Math.atan2(ty - me.y, tx - me.x);
        state.controlledIdx = bestMate.idx;
      }

      ball.x = me.x + Math.cos(passAngle) * 16;
      ball.y = me.y + Math.sin(passAngle) * 16;
      ball.vx = Math.cos(passAngle) * passSpeed;
      ball.vy = Math.sin(passAngle) * passSpeed;
      ball.vz = 0.15;
      me.stealCooldown = 0.32;
    } else {
      // SENSE BOLA: El botó de Passa serveix per TREURE LA BOLA amb l'estic (i si estàs molt lluny, canvia al defensor més proper i posa l'estic!)
      const dMe = Math.hypot(ball.x - me.x, ball.y - me.y);
      let bestIdx = state.controlledIdx;
      let bestDist = dMe;
      players.forEach((p, idx) => {
        if (p.team === 'home' && p.role !== 'GK') {
          if (playerUnavailable(p)) return;
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
        state.controlledIdx = bestIdx;
        const newMe = players[bestIdx];
        if (newMe && bestDist < 52) {
          attemptTakeBall(newMe, false);
        }
      }
    }
  }

  function startShootOrSteal() {
    if (state.paused) return;
    if (state.mode === 'kickoff') {
      showBanner('HAS DE PASSAR PER SACAR!', 1.4, 'El reglament d\'hoquei obliga a iniciar el joc passant a un company');
      return;
    }
    if (state.mode !== 'match' && state.mode !== 'direct_foul') return;
    const me = getControlledPlayer();
    if (!me) return;
    if (ball.owner === me) {
      state.chargingShot = true;
      state.shotCharge = 0.15;
    } else {
      // Entrada forta d'estic (més abast però més risc de falta / Targeta Blava)
      attemptTakeBall(me, true);
    }
  }

  function releaseShot() {
    if (state.paused || !['match', 'direct_foul'].includes(state.mode) || !state.chargingShot) return;
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

    // Velocitat de xut calibrada estil NHL (~3.6x - 4.8x la velocitat del patinador: potent però visible!)
    const shotStat = (me.stats.shot || 90) / 100;
    const shotScale = 0.48 + state.paceFactor * 0.36;
    const speed = (8.2 + power * 5.2) * (0.88 + shotStat * 0.14) * shotScale;

    // Temps de reacció del porter rival calibrat segons la dificultat, distància i si és al primer toc
    const diffCfg = GK_DIFFICULTY[state.gkDiff] || GK_DIFFICULTY.balanced;
    const awayGk = players.find(p => p.team === 'away' && p.role === 'GK');
    if (awayGk) {
      let delay = distToGoal < 210 ? diffCfg.closeDelay : diffCfg.farDelay;
      if (isOneTimer) delay += 0.08; // Una passada al 2n pal agafa el porter a contrapeu!
      if (!isSweetSpot && power < 0.4) delay = 0; // Xut fluixet -> el porter l'atura fàcil
      awayGk.gkReactionDelay = delay;
    }

    ball.owner = null;
    ball.shotByTeam = 'home';
    if (state.mode === 'direct_foul') state.mode = 'match';

    ball.x = me.x + Math.cos(shotAngle) * 16;
    ball.y = me.y + Math.sin(shotAngle) * 16;
    ball.vx = Math.cos(shotAngle) * speed;
    ball.vy = Math.sin(shotAngle) * speed;
    ball.vz = power > 0.65 ? 1.8 : 0.85;
    me.stealCooldown = 0.35;
    me.dir = shotAngle;

    state.shots.home++;
    if (isOvercharged) showBanner('XUT MASSA FORÇAT!', 0.85);
    else if (isSweetSpot && isOneTimer) showBanner('XUT AL PRIMER TOC PERFECTE!', 0.95);
    else if (isSweetSpot) showBanner('BON XUT DE PALA!', 0.85);
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
    if (forceBlueCard) {
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
    state.mode = 'whistle_pause';
    ball.owner = null;
    ball.vx = ball.vy = ball.vz = 0;
    state.chargingShot = false;
    triggerRefereeSignal(forceBlueCard ? 'blue_card' : 'whistle', x, y, 'FALTA · ' + offender.name, offender);
    showBanner(forceBlueCard ? 'TARGETA ' + (offender.sentOff ? 'VERMELLA' : 'BLAVA') : 'FALTA D’EQUIP',
      2.2, restart === 'penalty' ? 'Penal' : restart === 'direct_foul' ? 'Falta directa' : 'Lliure indirecte');
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
        if (ball.owner && ball.owner.team !== gk.team) {
          ball.owner.stealCooldown = 0.55;
          ball.owner = null;
        }
        if (state.endPeriodAfterSetPiece) { endPeriod(); return; }
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
        showBanner('ATURADA DE ' + gk.name + '! (' + postureLabel + ')', 1.1);
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

  function execAIPass(passer, mate) {
    ball.owner = null;
    ball.shotByTeam = null;
    state.lastPassTime = performance.now();
    // Proporció NHL: passada IA a ~2.2x-2.5x la velocitat del patinador (escalada amb paceFactor)
    const rawDist = Math.hypot(mate.x - passer.x, mate.y - passer.y);
    const passSpeed = Math.min(9.4, Math.max(6.0, 5.0 + rawDist * 0.014)) * state.paceFactor;
    const estFrames = Math.min(20, rawDist / Math.max(2.2, passSpeed)) * 0.55;
    const leadX = mate.x + mate.vx * estFrames;
    const leadY = mate.y + mate.vy * estFrames;
    const passAngle = Math.atan2(leadY - passer.y, leadX - passer.x);

    ball.x = passer.x + Math.cos(passAngle) * 16;
    ball.y = passer.y + Math.sin(passAngle) * 16;
    ball.vx = Math.cos(passAngle) * passSpeed;
    ball.vy = Math.sin(passAngle) * passSpeed;
    ball.vz = 0.08;
    passer.stealCooldown = 0.42;
    passer.aiHoldTimer = 0;
    passer.dir = passAngle;
  }

  function updateAISkater(p, dt = 0.016) {
    const isHome = p.team === 'home';
    const oppTeam = isHome ? 'away' : 'home';
    const diffCfg = GK_DIFFICULTY[state.gkDiff] || GK_DIFFICULTY.balanced;
    const attackDir = attackDirection(p.team);
    const oppGoalX = opponentGoalX(p.team);
    const ownGoal = ownGoalX(p.team);
    const now = performance.now() * 0.001;

    if (state.mode === 'direct_foul' || state.mode === 'kickoff') {
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

    // REPLEGAMENT DEFENTSIU (el davanter que ha perdut la bola a camp contrari torna a màxima velocitat a defensar!)
    if (p.isRetreating) {
      p.retreatTimer = Math.max(0, p.retreatTimer - dt);
      if (p.retreatTimer <= 0 || state.possessionTeam === p.team) {
        p.isRetreating = false;
      } else {
        tx = 500 + attackDir*Math.min(-120,(ball.x-500)*attackDir-70);
        ty = p.homeY;
        sprint = true;
      }
    }

    // Comprova quin jugador del mateix equip és el més proper a la bola
    const distToBall = Math.hypot(ball.x - p.x, ball.y - p.y);
    let isClosestTeammateToBall = true;
    players.forEach((other, oIdx) => {
      if (other.team === p.team && other !== p && other.role !== 'GK' && oIdx !== state.controlledIdx) {
        if (playerUnavailable(other)) return;
        if (Math.hypot(ball.x - other.x, ball.y - other.y) < distToBall) {
          isClosestTeammateToBall = false;
        }
      }
    });

    // =========================================================================
    // A) JUGADOR DE LA IA AMB BOLA: Circular, passar o entrar pel forat!
    // =========================================================================
    if (ball.owner === p) {
      p.aiHoldTimer = (p.aiHoldTimer || 0) + dt;
      const inOwnHalf = isInOwnHalf(p.team, p.x);

      // Si és a pista pròpia, prioritat absoluta a travessar la divisòria (regla 10s / 5s)
      if (inOwnHalf) {
        tx = RINK.w / 2 + attackDir * 115;
        ty = p.y < RINK.h / 2 ? 145 : 355;
        sprint = true;
      } else {
        // Està a pista d'atac: comprovem si té FORAT OBERT cap a porteria o si té un defensor a sobre
        const slotX = oppGoalX - attackDir * 85;
        const slotY = RINK.h / 2 + (p.y < RINK.h / 2 ? -28 : 28);
        const hasOpenLaneToGoal = isLaneClear(p.x, p.y, slotX, slotY, oppTeam, 32);

        let closestDefDist = 9999;
        players.forEach(d => {
          if (d.team === oppTeam && d.role !== 'GK') {
            const dd = Math.hypot(d.x - p.x, d.y - p.y);
            if (dd < closestDefDist) closestDefDist = dd;
          }
        });

        const distToGoal = Math.hypot(oppGoalX - p.x, RINK.h / 2 - p.y);

        if (hasOpenLaneToGoal && closestDefDist > 62) {
          // HI HA FORAT! Entra decidit cap a l'interior per atacar la porteria
          tx = slotX;
          ty = slotY;
          sprint = true;
        } else {
          // DEFENSA TANCADA: Circula per fora del quadre (ferradura) buscant obrir angle
          const perimX = oppGoalX - attackDir * 225;
          const waveY = RINK.h / 2 + Math.sin(now * 1.4 + p.idx * 1.7) * 145;
          tx = perimX;
          ty = waveY;
          sprint = false;
        }

        // Si ja porta un moment conduint i no té forat clar (o veu un company tallant sol al 2n pal), PASSA LA BOLA!
        const shouldLookForPass = (!hasOpenLaneToGoal && p.aiHoldTimer > 0.55) || p.aiHoldTimer > 1.35;
        if (shouldLookForPass) {
          let bestMate = null;
          let bestPassScore = -999;
          players.forEach(mate => {
            if (mate.team === p.team && mate !== p && mate.role !== 'GK') {
              if (playerUnavailable(mate)) return;
              const dMate = Math.hypot(mate.x - p.x, mate.y - p.y);
              if (dMate > 70 && dMate < 420 && isInAttackingHalf(p.team, mate.x)) {
                if (isLaneClear(p.x, p.y, mate.x, mate.y, oppTeam, 25)) {
                  const mateDistGoal = Math.hypot(oppGoalX - mate.x, RINK.h / 2 - mate.y);
                  const mateOpen = isLaneClear(mate.x, mate.y, oppGoalX - attackDir * 60, RINK.h / 2, oppTeam, 26) ? 55 : 0;
                  const score = (340 - mateDistGoal) + mateOpen + (Math.random() * 25);
                  if (score > bestPassScore) {
                    bestPassScore = score;
                    bestMate = mate;
                  }
                }
              }
            }
          });

          if (bestMate) {
            execAIPass(p, bestMate);
            return;
          }
        }

        // Xut a porteria quan ha trobat el forat o té angle de tir!
        const canShootNow = (hasOpenLaneToGoal && distToGoal < 235 && p.aiHoldTimer > 0.28) ||
                            (distToGoal < 165 && Math.abs(p.y - RINK.h / 2) < 130);
        if (canShootNow && Math.random() < 0.045 * state.paceFactor) {
          ball.owner = null;
          ball.shotByTeam = p.team;
          const aimY = RINK.h / 2 + (Math.random() < 0.5 ? -1 : 1)*RINK.goalWidth*0.32;
          const ang = Math.atan2(aimY - p.y, oppGoalX - p.x);
          // Proporció NHL: xut de la IA escalat (~3.6x-4.4x velocitat patinador)
          const sp = (9.5 + Math.random() * 2.5) * (0.48 + state.paceFactor * 0.36);
          ball.vx = Math.cos(ang) * sp;
          ball.vy = Math.sin(ang) * sp;
          ball.vz = 1.05;
          p.stealCooldown = 0.45;
          state.shots[p.team]++;
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
      const ballInDefHalf = (ball.x-500)*attackDir < 65;

      // Posicions base del Quadre Defensiu (2 defensors tancant l'àrea + 2 puntes tancant línies exteriors)
      const shiftY = (ball.y - RINK.h / 2) * 0.34;
      let zoneX = ownGoal + dirFromOwnGoal * 115;
      let zoneY = RINK.h / 2;

      if (p.idx === 1) {
        // Defensa Baix Superior (tanca el primer pal / interior alt)
        zoneX = ownGoal + dirFromOwnGoal * 92;
        zoneY = 190 + shiftY * 0.75;
      } else if (p.idx === 2) {
        // Defensa Baix Inferior (tanca el segon pal / interior baix)
        zoneX = ownGoal + dirFromOwnGoal * 92;
        zoneY = 310 + shiftY * 0.75;
      } else if (p.idx === 3) {
        // Punta Exterior Superior
        zoneX = ownGoal + dirFromOwnGoal * 185;
        zoneY = 165 + shiftY;
      } else {
        // Punta Exterior Inferior
        zoneX = ownGoal + dirFromOwnGoal * 185;
        zoneY = 335 + shiftY;
      }

      if (!ball.owner && isClosestTeammateToBall && distToBall < 220) {
        // Bola dividida a prop: només el defensor més proper surt a recuperar-la
        tx = ball.x;
        ty = ball.y;
        sprint = true;
      } else if (isClosestTeammateToBall && ballInDefHalf) {
        // PRESSIÓ INDIVIDUAL AL PORTADOR: Només 1 defensor surt de la seva zona per tapar el forat entre bola i porteria!
        // Això deixa un forat darrere seu si l'atacant mou ràpid la bola!
        const pressX = ball.x - dirFromOwnGoal * 20;
        const pressY = ball.y + (RINK.h / 2 - ball.y) * 0.12;
        tx = pressX;
        ty = pressY;
        sprint = distToBall > 45;

        if (p.team === 'away' && distToBall < 25 && p.stealCooldown <= 0 && ball.owner) {
          p.stealCooldown = 1.05;
          p.pokeTimer = 0.26;
          if (Math.random() < 0.28) {
            registerFoul('away', false, p);
          } else if (Math.random() < 0.36) {
            const victim = ball.owner;
            ball.owner.stealCooldown = 0.55;
            setBallOwner(p);
            if (victim && victim.team === 'home') {
              onHumanLostBallInAttack(victim);
            }
          }
        }
      } else {
        // ELS ALTRES 3 DEFENSORS MANTENEN EL QUADRE ZONAL (no persegueixen la bola!)
        tx = zoneX;
        ty = zoneY;
        sprint = false;
      }
    }

    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 14) {
      p.isPushing = true;
      const teamHandicap = p.team === 'away' ? diffCfg.defSpeedMul : 1.0;
      const maxSp = (1-p.fatigue*0.003)*((p.stats.speed || 85) / 100) * (sprint ? 3.05 : 2.45) * state.paceFactor * teamHandicap;
      const targetAngle = Math.atan2(dy, dx);
      const diffAng = normalizeAngle(targetAngle - p.dir);
      // Gir en corba progressiu sobre patins amb inclinació lateral (cantells)
      p.dir = normalizeAngle(p.dir + Math.max(-0.11, Math.min(0.11, diffAng * 0.22)));
      p.bankAngle = p.bankAngle * 0.85 + Math.max(-0.26, Math.min(0.26, diffAng * 0.42)) * 0.15;

      const pushAccel = 0.115 * state.paceFactor;
      p.vx = (p.vx + (dx / dist) * pushAccel) * 0.958;
      p.vy = (p.vy + (dy / dist) * pushAccel) * 0.958;
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

  // ============================================================================
  // 8. BUCLE D'ACTUALITZACIÓ I REGLES D'HOQUEI PATINS (WSE / RFEP)
  // ============================================================================
  function update(dt) {
    if (state.paused || state.mode === 'finished') return;
    if (state.mode === 'halftime') {
      state.halftimeRemaining = Math.max(0,state.halftimeRemaining-dt);
      updateFitness(dt,true);
      if (state.halftimeRemaining <= 0) beginSecondHalf();
      return;
    }
    if (state.pendingRestart) {
      state.pendingRestart.remaining -= dt;
      if (state.pendingRestart.remaining <= 0) {
        const action = state.pendingRestart.action;
        state.pendingRestart = null;
        action();
      }
    }

    if (state.bannerTimer > 0) state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.cardEvent) {
      state.cardEvent.timer = Math.max(0, state.cardEvent.timer - dt);
      if (state.cardEvent.timer <= 0) state.cardEvent = null;
    }

    if (state.mode === 'whistle_pause' || state.mode === 'goal_celebration') {
      updateReferees(dt);
      return;
    }

    if (state.mode === 'match' || state.mode === 'direct_foul') {
      const elapsed = Math.min(dt,state.timeRemaining);
      state.timeRemaining = Math.max(0, state.timeRemaining - elapsed);
      updateSanctions(elapsed);
      updateFitness(elapsed);
      if (state.mode === 'finished') return;
      if (state.timeRemaining <= 1e-8) { endPeriod(); return; }
    }
    if (state.mode === 'match') {
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
          ball.owner = null;
          ball.shotByTeam = 'away';
          ball.vx = Math.cos(angle)*7.5;
          ball.vy = Math.sin(angle)*7.5;
          ball.vz = 0.85;
          shooter.stealCooldown = 0.4;
          state.shots.away++;
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
      const speedStat = ((me.stats && me.stats.speed) || 85) / 85;
      const boost = (sprinting && me.stamina > 8) ? 1.22 : 1.0;
      if (sprinting && inp.len > 0.2) me.stamina = Math.max(0, me.stamina - dt * 15);
      else me.stamina = Math.min(100, me.stamina + dt * 12);

      // FÍSICA DE PATINATGE SOBRE 4 RODES (Impuls progressiu + Lliscament amb inèrcia + Gir en corba)
      const maxSpeed = (1-me.fatigue*0.003)*(2.95 + speedStat * 0.95) * boost * (state.chargingShot ? 0.82 : 1) * state.paceFactor;

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
        const pushAccel = 0.135 * state.paceFactor * boost;

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
      else if (idx !== state.controlledIdx) updateAISkater(p, dt);

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

    if (state.mode === 'halftime' || state.mode === 'finished') { return;
    }
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
        if (dist < minDist && dist > 0.001) {
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
      const dribbleWobble = Math.sin(o.stickPhase * 1.3) * 3.4;
      const perpAngle = o.dir + Math.PI / 2;
      ball.x = o.x + Math.cos(o.dir) * 15.5 + Math.cos(perpAngle) * dribbleWobble;
      ball.y = o.y + Math.sin(o.dir) * 15.5 + Math.sin(perpAngle) * dribbleWobble;
      ball.vx = o.vx;
      ball.vy = o.vy;
      ball.z = 0;
    } else {
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
      const floorFriction = ball.z === 0 ? 0.982 : 0.988;
      ball.vx *= floorFriction;
      ball.vy *= floorFriction;

      constrainToRink(ball, 0.72);
      collideWithGoalFrames(ball, true);
      if (state.mode === 'halftime' || state.mode === 'finished') { return;
      }

      // Recepció de passades amb l'estic i blocatges defensius de xuts
      players.forEach(p => {
        if (playerUnavailable(p) || p.role === 'GK' || p.stealCooldown > 0 || ball.owner) return;
        const d = Math.hypot(ball.x - p.x, ball.y - p.y);
        const reachRadius = p.radius + ball.radius + (ball.shotByTeam ? 2 : 4.5);
        if (d < reachRadius && ball.z < 13) {
          const ballSp = Math.hypot(ball.vx, ball.vy);
          if (ball.shotByTeam && ballSp > 5.2 && p.team !== ball.shotByTeam) {
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
    if (!['match', 'direct_foul'].includes(state.mode)) return;
    state.score[scoringTeam]++;
    if (state.endPeriodAfterSetPiece) { endPeriod(); return; }
    state.mode = 'goal_celebration';
    ball.vx *= 0.15;
    ball.vy *= 0.15;
    // World Skate 2027 art. 31: a goal does not shorten the inferiority.
    triggerRefereeSignal('goal', ball.x, ball.y, '📣 GOL VALIDAT!');
    const teamName = TEAMS[scoringTeam].name;
    showBanner(`GOOOOL DEL ${teamName}! (${state.score.home} - ${state.score.away})`, 2.4);

    scheduleRestart(() => {
      resetPositions('kickoff', scoringTeam === 'home' ? 'away' : 'home');
    }, 2.2);
  }

  // ============================================================================
  // 9. SINCRONITZACIÓ D'ANIMACIONS DELS MODELS 3D (THREE.JS)
  // ============================================================================
  function update3DMeshes() {
    const me = getControlledPlayer();

    allPlayers().forEach(p => {
      const idx = players.indexOf(p);
      if (!p.rig) return;
      const wx = (p.x - 500) * S;
      const wz = (p.y - 250) * S;
      p.rig.group.position.set(wx, 0, wz);
      p.rig.bodyPivot.rotation.y = -p.dir;

      const isControlled = idx === state.controlledIdx;
      const hasBall = ball.owner === p;

      if (isControlled || hasBall) {
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
        const posture = p.gkPosture || 'screen';
        if (posture === 'valla') {
          // 1. PAS DE VALLA / PAS DE TANCA: Guarda estirada horitzontalment de pal a pal arran de parquet
          p.rig.rightPadGroup.rotation.z = Math.PI / 2.05;
          p.rig.rightPadGroup.position.set(0.18, 0.24, 0.96);
          p.rig.leftPadGroup.rotation.z = 0.08;
          p.rig.leftPadGroup.position.set(0.12, 0.12, -0.42);
          p.rig.bodyPivot.position.y = -0.36;
          p.rig.bodyPivot.rotation.x = 0.05;
          p.rig.leftArmPivot.rotation.x = -0.35; // Manopla tapant
          p.rig.rightArmPivot.rotation.x = 0.42;
          p.rig.gkStickPivot.rotation.z = 0.82; // Estic escombrant pla
        } else if (posture === 'knee') {
          // 2. GENOLL A TERRA (Mitja papallona hermètica al pal curt)
          p.rig.leftPadGroup.rotation.x = 0.55;
          p.rig.leftPadGroup.position.set(0.15, 0.16, -0.48);
          p.rig.rightPadGroup.rotation.x = -0.22;
          p.rig.rightPadGroup.position.set(0.15, 0.44, 0.48);
          p.rig.bodyPivot.position.y = -0.32;
          p.rig.bodyPivot.rotation.x = -0.16;
          p.rig.leftArmPivot.rotation.x = 0.42; // Manopla alta
          p.rig.rightArmPivot.rotation.x = 0.25;
          p.rig.gkStickPivot.rotation.z = 0.38;
        } else if (posture === 'out') {
          // 3. MITJA SORTIDA (1 contra porter / Falta Directa: porter avançat fent-se gegant)
          p.rig.leftPadGroup.rotation.z = 0.20;
          p.rig.rightPadGroup.rotation.z = -0.20;
          p.rig.leftPadGroup.position.set(0.15, 0.24, -0.62);
          p.rig.rightPadGroup.position.set(0.15, 0.24, 0.62);
          p.rig.bodyPivot.position.y = -0.14;
          p.rig.bodyPivot.rotation.x = 0.22; // Inclinació atlètica endavant
          p.rig.leftArmPivot.rotation.z = 0.68; // Gran manopla oberta
          p.rig.rightArmPivot.rotation.z = 0.68; // Estic obert per cobrir angle
          p.rig.gkStickPivot.rotation.z = 0.18;
        } else {
          // 4. PANTALLA (Posició bàsica d'hoquei patins: guardes tancant la base en A i estic pla tapant el five-hole)
          p.rig.leftPadGroup.rotation.z = -0.09;
          p.rig.rightPadGroup.rotation.z = 0.09;
          p.rig.leftPadGroup.position.set(0.15, 0.14, -0.44);
          p.rig.rightPadGroup.position.set(0.15, 0.14, 0.44);
          p.rig.bodyPivot.position.y = -0.22;
          p.rig.bodyPivot.rotation.x = 0.14; // Inclinació d'espera
          p.rig.leftArmPivot.rotation.z = 0.35;
          p.rig.rightArmPivot.rotation.z = 0.35;
          p.rig.gkStickPivot.rotation.z = 0.52; // Estic pla a terra tocant el parquet davant dels patins
        }
      } else {
        // ANIMACIÓ AUTÈNTICA DE PATINATGE SOBRE 4 RODES (Impuls lateral en V + Fase de lliscament amb genolls flexionats)
        const sp = Math.hypot(p.vx, p.vy);
        const rawWave = Math.sin(p.skatePhase);
        const pushFactor = p.isPushing ? Math.min(1, sp * 0.55) : 0;

        // Cicle amb pausa de lliscament entre impuls esquerre i impuls dret (no moviment de tisora de córrer!)
        const leftPush = rawWave > 0.22 ? ((rawWave - 0.22) / 0.78) * pushFactor : 0;
        const rightPush = rawWave < -0.22 ? ((-rawWave - 0.22) / 0.78) * pushFactor : 0;

        // Quan una cama empeny en diagonal cap enfora (X i Z), l'altra cama es manté sota el cos lliscant sobre les 4 rodes
        p.rig.leftLeg.rotation.x = -0.05 - leftPush * 0.42;
        p.rig.leftLeg.rotation.z = 0.06 - leftPush * 0.22;
        p.rig.leftLeg.rotation.y = leftPush * 0.28;

        p.rig.rightLeg.rotation.x = 0.05 + rightPush * 0.42;
        p.rig.rightLeg.rotation.z = 0.06 - rightPush * 0.22;
        p.rig.rightLeg.rotation.y = -rightPush * 0.28;

        // Posició flexionada d'hoquei patins + inclinació lateral (carving) en els girs + balanç de maluc
        const activePush = Math.max(leftPush, rightPush);
        p.rig.bodyPivot.position.y = -0.07 - activePush * 0.06;
        p.rig.bodyPivot.rotation.z = -0.14 - Math.min(0.14, sp * 0.05);
        p.rig.bodyPivot.rotation.x = (p.bankAngle || 0) + (leftPush - rightPush) * 0.07;

        // DINÀMICA DE DOS BRAÇOS I ESTIC
        const pokeAmt = p.pokeTimer > 0 ? Math.sin((p.pokeTimer / 0.34) * Math.PI) : 0;
        p.rig.stickPivot.position.x = 0.18 + pokeAmt * 0.92;

        if (isControlled && state.chargingShot) {
          // Càrrega de xut: braç esquerre s'obre enrere i dret prepara el fuet de pala
          p.rig.rightArmPivot.rotation.z = 0.35 + state.shotCharge * 0.45;
          p.rig.leftArmPivot.rotation.z = -0.30 - state.shotCharge * 0.65;
          p.rig.stickPivot.rotation.y = state.shotCharge * 1.15;
          p.rig.stickPivot.rotation.z = -state.shotCharge * 0.65;
        } else if (pokeAmt > 0.01) {
          // Estirada d'estic endavant per treure la bola!
          p.rig.rightArmPivot.rotation.z = 0.65 * pokeAmt;
          p.rig.leftArmPivot.rotation.z = 0.45 * pokeAmt;
          p.rig.stickPivot.rotation.y = -0.38 * pokeAmt;
          p.rig.stickPivot.rotation.z = 0.32 * pokeAmt;
        } else if (hasBall) {
          // Conducció de bola: ambdues mans agafant l'estic fent el dribling
          p.rig.rightArmPivot.rotation.z = 0.22;
          p.rig.leftArmPivot.rotation.z = 0.48;
          p.rig.leftArmPivot.rotation.x = 0.32 + Math.sin(p.stickPhase) * 0.15;
          p.rig.stickPivot.rotation.y = Math.sin(p.stickPhase) * 0.22;
          p.rig.stickPivot.rotation.z = 0;
        } else {
          // Patinatge lliure: balanceig natural del braç esquerre en oposició a les cames
          p.rig.rightArmPivot.rotation.z = 0.15;
          p.rig.leftArmPivot.rotation.z = 0.20 + pushFactor * 0.32;
          p.rig.leftArmPivot.rotation.x = (rightPush - leftPush) * 0.45;
          p.rig.stickPivot.rotation.y = Math.sin(p.stickPhase) * 0.12;
          p.rig.stickPivot.rotation.z = 0;
        }
      }
    });

    // Sincronització 3D dels 2 Àrbitres Principals en Pista
    referees.forEach(ref => {
      if (!ref.rig) return;
      const wx = (ref.x - 500) * S;
      const wz = (ref.y - 250) * S;
      ref.rig.group.position.set(wx, 0, wz);
      ref.rig.bodyPivot.rotation.y = -ref.dir;

      const sp = Math.hypot(ref.vx, ref.vy);
      const rawWave = Math.sin(ref.skatePhase);
      const pushFactor = ref.isPushing ? Math.min(1, sp * 0.55) : 0;
      const leftPush = rawWave > 0.22 ? ((rawWave - 0.22) / 0.78) * pushFactor : 0;
      const rightPush = rawWave < -0.22 ? ((-rawWave - 0.22) / 0.78) * pushFactor : 0;

      ref.rig.leftLeg.rotation.x = -0.04 - leftPush * 0.36;
      ref.rig.leftLeg.rotation.z = 0.04 - leftPush * 0.18;
      ref.rig.rightLeg.rotation.x = 0.04 + rightPush * 0.36;
      ref.rig.rightLeg.rotation.z = 0.04 - rightPush * 0.18;

      const activePush = Math.max(leftPush, rightPush);
      ref.rig.bodyPivot.position.y = -0.04 - activePush * 0.05;
      ref.rig.bodyPivot.rotation.z = -0.08 - Math.min(0.10, sp * 0.04);
      ref.rig.bodyPivot.rotation.x = (ref.bankAngle || 0);

      // Senyalització de l'àrbitre amb els braços i Targeta Blava / Groga 3D
      if (ref.signalTimer > 0) {
        if (ref.signalType === 'blue_card' || ref.signalType === 'warning_card') {
          ref.rig.rightArmPivot.rotation.z = 2.92; // Braç dret ben alt mostrant la Targeta!
          ref.rig.leftArmPivot.rotation.z = 1.35;  // Braç esquerre assenyalant el jugador sancionat
          ref.rig.cardMat.color.setHex(ref.signalType === 'blue_card' ? 0x2563eb : 0xfacc15);
          ref.rig.blueCardMesh.visible = true;
        } else if (ref.signalType === 'goal') {
          ref.rig.rightArmPivot.rotation.z = 1.55; // Assenyalant el centre de la pista
          ref.rig.leftArmPivot.rotation.z = 1.45;
          ref.rig.blueCardMesh.visible = false;
        } else {
          ref.rig.rightArmPivot.rotation.z = 2.65; // Braç aixecat indicant falta o infracció!
          ref.rig.leftArmPivot.rotation.z = 0.35;
          ref.rig.blueCardMesh.visible = false;
        }
      } else {
        ref.rig.rightArmPivot.rotation.z = 0.18 + Math.sin(ref.skatePhase) * 0.12;
        ref.rig.leftArmPivot.rotation.z = 0.18 - Math.sin(ref.skatePhase) * 0.12;
        ref.rig.blueCardMesh.visible = false;
      }
    });

    if (ball.mesh) {
      ball.mesh.position.set(
        (ball.x - 500) * S,
        (ball.radius + ball.z) * S,
        (ball.y - 250) * S
      );
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
  function renderHUD() {
    const hudScale = Math.min(1, hudCanvas.width / 480);
    const W = hudCanvas.width / hudScale;
    const H = hudCanvas.height / hudScale;
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    hudCtx.save();
    hudCtx.scale(hudScale, hudScale);

    players.forEach((p, idx) => {
      if (p.vacant) return;
      const isControlled = idx === state.controlledIdx;
      const hasBall = ball.owner === p;
      const isExcluded = playerUnavailable(p);
      const isCardedNow = state.cardEvent && state.cardEvent.offender === p;
      if (!isControlled && !hasBall && !isExcluded && !isCardedNow) return;

      const worldVec = new THREE.Vector3((p.x - 500) * S, 0.1, (p.y - 250) * S);
      worldVec.project(camera);
      if (worldVec.z > 1) return;

      const sx = (worldVec.x * 0.5 + 0.5) * W;
      const sy = (-worldVec.y * 0.5 + 0.5) * H + 20;

      hudCtx.save();
      hudCtx.font = '800 11px system-ui, sans-serif';
      hudCtx.textAlign = 'center';
      const label = isExcluded
        ? `🟦 ${p.num} ${p.name} (${Math.ceil(p.suspensionRemaining || 0)}s)`
        : `${p.num} ${p.name}`;
      const tw = hudCtx.measureText(label).width + 12;
      hudCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      hudCtx.strokeStyle = isExcluded ? '#3b82f6' : (isControlled ? '#38bdf8' : '#f43f5e');
      hudCtx.lineWidth = 1.5;
      hudCtx.beginPath();
      hudCtx.roundRect(sx - tw / 2, sy, tw, 18, 5);
      hudCtx.fill();
      hudCtx.stroke();

      hudCtx.fillStyle = '#ffffff';
      hudCtx.fillText(label, sx, sy + 13);

      // Si l'àrbitre li està ensenyant una targeta ara mateix, dibuixa la targeta física sobre el cap del jugador!
      if (isCardedNow) {
        const isBlue = state.cardEvent.type === 'blue';
        hudCtx.fillStyle = isBlue ? '#2563eb' : (state.cardEvent.type === 'red' ? '#ef4444' : '#facc15');
        hudCtx.strokeStyle = '#ffffff';
        hudCtx.lineWidth = 2;
        hudCtx.beginPath();
        hudCtx.roundRect(sx - 10, sy - 64, 20, 28, 3);
        hudCtx.fill();
        hudCtx.stroke();
      }

      // Barra de potència amb ZONA VERDA (Sweet Spot: 52% - 88%)
      if (isControlled && state.chargingShot) {
        const barW = 60;
        const bx0 = sx - barW / 2;
        const by0 = sy - 12;
        hudCtx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        hudCtx.fillRect(bx0, by0, barW, 7);
        // Marca de la zona òptima
        hudCtx.fillStyle = 'rgba(34, 197, 94, 0.35)';
        hudCtx.fillRect(bx0 + barW * 0.52, by0, barW * 0.36, 7);

        const isSweet = state.shotCharge >= 0.52 && state.shotCharge <= 0.88;
        hudCtx.fillStyle = state.shotCharge > 0.90 ? '#ef4444' : (isSweet ? '#22c55e' : '#facc15');
        hudCtx.fillRect(bx0 + 1, by0 + 1, (barW - 2) * state.shotCharge, 5);
      }

      // Avís flotant de 5 segons per tornar a camp contrari quan recules a camp propi
      if (hasBall && state.mode === 'match' && state.crossedHalfCourt && isInOwnHalf(state.possessionTeam, ball.x)) {
        hudCtx.font = '900 11px system-ui, sans-serif';
        hudCtx.fillStyle = state.backCourtClock <= 2.2 ? '#ef4444' : '#f59e0b';
        hudCtx.fillText(`⏱ TORNAR: ${Math.ceil(state.backCourtClock)}s`, sx, sy - 16);
      }
      hudCtx.restore();
    });

    // Etiqueta dels 2 Àrbitres Principals en Pista (i targeta física quan xiulen o mostren Targeta Blava / Groga)
    referees.forEach(ref => {
      const worldVec = new THREE.Vector3((ref.x - 500) * S, 4.1, (ref.y - 250) * S);
      worldVec.project(camera);
      if (worldVec.z > 1) return;

      const sx = (worldVec.x * 0.5 + 0.5) * W;
      const sy = (-worldVec.y * 0.5 + 0.5) * H - 6;

      hudCtx.save();
      const isSignaling = ref.signalTimer > 0;
      const isCardSignal = isSignaling && (ref.signalType === 'blue_card' || ref.signalType === 'warning_card');

      // Dibuixa la targeta física aixecada sobre la mà de l'àrbitre!
      if (isCardSignal) {
        const isBlue = ref.signalType === 'blue_card';
        hudCtx.fillStyle = isBlue ? '#2563eb' : '#facc15';
        hudCtx.strokeStyle = '#ffffff';
        hudCtx.lineWidth = 2;
        hudCtx.beginPath();
        hudCtx.roundRect(sx - 9, sy - 42, 18, 25, 3);
        hudCtx.fill();
        hudCtx.stroke();
      }

      const text = isSignaling ? ref.signalLabel : ref.name;
      hudCtx.font = isSignaling ? '900 11px system-ui, sans-serif' : '700 9.5px system-ui, sans-serif';
      hudCtx.textAlign = 'center';
      const tw = hudCtx.measureText(text).width + 10;
      hudCtx.fillStyle = isSignaling
        ? (ref.signalType === 'blue_card' ? 'rgba(30, 64, 175, 0.96)' : 'rgba(250, 204, 21, 0.96)')
        : 'rgba(15, 23, 42, 0.72)';
      hudCtx.strokeStyle = isSignaling
        ? (ref.signalType === 'blue_card' ? '#93c5fd' : '#0f172a')
        : 'rgba(250, 204, 21, 0.55)';
      hudCtx.lineWidth = 1.2;
      hudCtx.beginPath();
      hudCtx.roundRect(sx - tw / 2, sy - 14, tw, 16, 4);
      hudCtx.fill();
      hudCtx.stroke();

      hudCtx.fillStyle = isSignaling
        ? (ref.signalType === 'blue_card' ? '#ffffff' : '#0f172a')
        : '#fde047';
      hudCtx.fillText(text, sx, sy - 2.5);
      hudCtx.restore();
    });

    hudCtx.save();
    const bx = 18, by = 14, bw = 435, bh = 58;
    hudCtx.fillStyle = 'rgba(11, 18, 32, 0.92)';
    hudCtx.strokeStyle = 'rgba(255,255,255,0.18)';
    hudCtx.lineWidth = 1.5;
    hudCtx.beginPath();
    hudCtx.roundRect(bx, by, bw, bh, 10);
    hudCtx.fill();
    hudCtx.stroke();

    hudCtx.fillStyle = TEAMS.home.primary;
    hudCtx.beginPath();
    hudCtx.roundRect(bx + 6, by + 7, 92, 20, 5);
    hudCtx.fill();
    hudCtx.fillStyle = '#ffffff';
    hudCtx.font = '800 12px system-ui, sans-serif';
    hudCtx.textAlign = 'left';
    hudCtx.fillText(TEAMS.home.short, bx + 14, by + 21);
    hudCtx.textAlign = 'right';
    hudCtx.font = '900 14px system-ui, sans-serif';
    hudCtx.fillText(String(state.score.home), bx + 92, by + 21);

    hudCtx.fillStyle = TEAMS.away.primary;
    hudCtx.beginPath();
    hudCtx.roundRect(bx + 6, by + 31, 92, 20, 5);
    hudCtx.fill();
    hudCtx.fillStyle = '#ffffff';
    hudCtx.font = '800 12px system-ui, sans-serif';
    hudCtx.textAlign = 'left';
    hudCtx.fillText(TEAMS.away.short, bx + 14, by + 45);
    hudCtx.textAlign = 'right';
    hudCtx.font = '900 14px system-ui, sans-serif';
    hudCtx.fillText(String(state.score.away), bx + 92, by + 45);

    const homeFoulTarget = getNextDirectFoulTarget(state.fouls.home);
    const awayFoulTarget = getNextDirectFoulTarget(state.fouls.away);
    hudCtx.textAlign = 'left';
    hudCtx.font = '700 10px system-ui, sans-serif';
    const homeWarn = state.fouls.home >= homeFoulTarget - 1;
    const awayWarn = state.fouls.away >= awayFoulTarget - 1;
    hudCtx.fillStyle = homeWarn ? '#facc15' : '#94a3b8';
    hudCtx.fillText(`${homeWarn ? '🚨' : ''}FALTES: ${state.fouls.home}/${homeFoulTarget}`, bx + 105, by + 20);
    hudCtx.fillStyle = awayWarn ? '#facc15' : '#94a3b8';
    hudCtx.fillText(`${awayWarn ? '🚨' : ''}FALTES: ${state.fouls.away}/${awayFoulTarget}`, bx + 105, by + 44);

    const mins = Math.floor(state.timeRemaining / 60);
    const secs = String(Math.floor(state.timeRemaining % 60)).padStart(2, '0');
    hudCtx.fillStyle = '#f8fafc';
    hudCtx.font = '900 17px system-ui, sans-serif';
    hudCtx.textAlign = 'center';
    hudCtx.fillText(`${state.period}a ${mins}:${secs}`, bx + 232, by + 26);

    hudCtx.fillStyle = state.possessionClock <= 10 ? '#ef4444' : '#38bdf8';
    hudCtx.font = '800 11px system-ui, sans-serif';
    hudCtx.fillText(`45s: ${Math.ceil(state.possessionClock)}s`, bx + 232, by + 46);

    hudCtx.textAlign = 'center';
    if (!state.crossedHalfCourt) {
      hudCtx.fillStyle = state.halfCourtClock <= 4 ? '#ef4444' : '#facc15';
      hudCtx.font = '800 9.5px system-ui, sans-serif';
      hudCtx.fillText(`SORTIDA (10s)`, bx + 318, by + 22);
      hudCtx.font = '900 13px system-ui, sans-serif';
      hudCtx.fillText(`${Math.ceil(state.halfCourtClock)}s`, bx + 318, by + 43);
    } else if (isInOwnHalf(state.possessionTeam, ball.x)) {
      hudCtx.fillStyle = state.backCourtClock <= 2.2 ? '#ef4444' : '#f59e0b';
      hudCtx.font = '800 9.5px system-ui, sans-serif';
      hudCtx.fillText(`TORNAR (5s)`, bx + 318, by + 22);
      hudCtx.font = '900 13px system-ui, sans-serif';
      hudCtx.fillText(`${Math.ceil(state.backCourtClock)}s`, bx + 318, by + 43);
    } else {
      hudCtx.fillStyle = '#34d399';
      hudCtx.font = '800 9.5px system-ui, sans-serif';
      hudCtx.fillText(`PISTA ATAC`, bx + 318, by + 23);
      hudCtx.fillStyle = '#94a3b8';
      hudCtx.font = '700 9px system-ui, sans-serif';
      hudCtx.fillText(`(5s si recules)`, bx + 318, by + 42);
    }

    hudCtx.fillStyle = '#cbd5e1';
    hudCtx.font = '700 10px system-ui, sans-serif';
    hudCtx.fillText(`XUTS`, bx + 390, by + 22);
    hudCtx.font = '800 12px system-ui, sans-serif';
    hudCtx.fillText(`${state.shots.home}-${state.shots.away}`, bx + 390, by + 42);

    // Indicador de Power Play 4v3 per Targeta Blava (Base 23.1 RFEP)
    if (state.exclusions.home > 0 || state.exclusions.away > 0) {
      const ppY = by + bh + 6;
      hudCtx.fillStyle = 'rgba(30, 58, 138, 0.92)';
      hudCtx.strokeStyle = '#60a5fa';
      hudCtx.lineWidth = 1.5;
      hudCtx.beginPath();
      hudCtx.roundRect(bx, ppY, 240, 22, 6);
      hudCtx.fill();
      hudCtx.stroke();
      hudCtx.fillStyle = '#eff6ff';
      hudCtx.font = '800 10.5px system-ui, sans-serif';
      hudCtx.textAlign = 'left';
      const homeCount = players.filter(p => p.team === 'home' && p.role !== 'GK' && !playerUnavailable(p)).length;
      const awayCount = players.filter(p => p.team === 'away' && p.role !== 'GK' && !playerUnavailable(p)).length;
      const exclTxt = `${homeCount}v${awayCount} · FCB ${Math.ceil(state.exclusions.home)}s / REU ${Math.ceil(state.exclusions.away)}s`;
      hudCtx.fillText(exclTxt, bx + 10, ppY + 14);
    }

    // Mosca oficial de retransmissió a la cantonada superior dreta (Base 14.6 RFEP 26/27)
    const logoW = 148, logoH = 34;
    const lx = W - logoW - 18, ly = W < 650 ? 160 : 14;
    hudCtx.fillStyle = 'rgba(11, 18, 32, 0.85)';
    hudCtx.strokeStyle = 'rgba(255,255,255,0.22)';
    hudCtx.lineWidth = 1.2;
    hudCtx.beginPath();
    hudCtx.roundRect(lx, ly, logoW, logoH, 8);
    hudCtx.fill();
    hudCtx.stroke();
    hudCtx.fillStyle = '#ef4444';
    hudCtx.beginPath();
    hudCtx.arc(lx + 16, ly + 17, 5, 0, Math.PI * 2);
    hudCtx.fill();
    hudCtx.fillStyle = '#f8fafc';
    hudCtx.font = '900 11px system-ui, sans-serif';
    hudCtx.textAlign = 'left';
    hudCtx.fillText('OK LIGA 26/27', lx + 28, ly + 15);
    hudCtx.fillStyle = '#94a3b8';
    hudCtx.font = '700 8.5px system-ui, sans-serif';
    hudCtx.fillText('RFEP · TV DIRECTE', lx + 28, ly + 27);

    // GRAFISME OFICIAL TV DE TARGETA D'ÀRBITRE (Targeta Blava Base 23.1 o Advertència Oficial)
    if (state.cardEvent && state.cardEvent.timer > 0) {
      const ce = state.cardEvent;
      const isBlue = ce.type === 'blue';
      const cw = 350, ch = 82;
      const cx = W - cw - 18, cy = 58;

      hudCtx.fillStyle = 'rgba(11, 18, 32, 0.96)';
      hudCtx.strokeStyle = isBlue ? '#3b82f6' : '#ef4444';
      hudCtx.lineWidth = 2.5;
      hudCtx.beginPath();
      hudCtx.roundRect(cx, cy, cw, ch, 12);
      hudCtx.fill();
      hudCtx.stroke();

      // Targeta física gran dibuixada a l'esquerra del panell
      hudCtx.fillStyle = isBlue ? '#2563eb' : '#ef4444';
      hudCtx.strokeStyle = '#ffffff';
      hudCtx.lineWidth = 2;
      hudCtx.beginPath();
      hudCtx.roundRect(cx + 14, cy + 12, 40, 58, 5);
      hudCtx.fill();
      hudCtx.stroke();

      hudCtx.fillStyle = isBlue ? '#93c5fd' : '#fef08a';
      hudCtx.font = '900 11px system-ui, sans-serif';
      hudCtx.textAlign = 'left';
      hudCtx.fillText(isBlue ? 'DECISIÓ ARBITRAL · TARGETA BLAVA' : 'DECISIÓ ARBITRAL · TARGETA VERMELLA', cx + 66, cy + 25);

      hudCtx.fillStyle = '#ffffff';
      hudCtx.font = '900 15px system-ui, sans-serif';
      hudCtx.fillText(`#${ce.playerNum} ${ce.playerName} (${ce.teamName})`, cx + 66, cy + 46);

      hudCtx.fillStyle = '#cbd5e1';
      hudCtx.font = '700 10.5px system-ui, sans-serif';
      hudCtx.fillText(ce.sanction, cx + 66, cy + 66);
    }

    if (state.mode === 'halftime') {
      state.bannerSubText = 'Descans ' + Math.ceil(state.halftimeRemaining/60) + ' min · Pots fer canvis o saltar-lo';
    }
    if (state.bannerTimer > 0 && state.bannerText) {
      const bw2 = Math.min(W - 40, 480);
      const bh2 = state.bannerSubText ? 56 : 42;
      hudCtx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      hudCtx.strokeStyle = '#facc15';
      hudCtx.lineWidth = 2.5;
      hudCtx.beginPath();
      hudCtx.roundRect(W / 2 - bw2 / 2, 82, bw2, bh2, 12);
      hudCtx.fill();
      hudCtx.stroke();

      hudCtx.fillStyle = '#fef08a';
      hudCtx.font = '900 17px system-ui, sans-serif';
      hudCtx.textAlign = 'center';
      hudCtx.textBaseline = 'middle';
      hudCtx.fillText(state.bannerText, W / 2, state.bannerSubText ? 101 : 103, bw2 - 20);

      if (state.bannerSubText) {
        hudCtx.fillStyle = '#cbd5e1';
        hudCtx.font = '600 12px system-ui, sans-serif';
        hudCtx.fillText(state.bannerSubText, W / 2, 123, bw2 - 20);
      }
    }

    hudCtx.restore();
    hudCtx.restore();
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function setCameraMode(mode) {
    state.camera = mode;
    document.querySelectorAll('[data-cam]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-cam') === mode);
    });
    const names = {
      nhl_side: 'CÀMERA 1: TV HORITZONTAL ZOOM 3D',
      nhl_iso: 'CÀMERA 2: DIAGONAL NHL 3D',
      end3d: 'CÀMERA 3: VERTICAL ATAC 3D',
      wide3d: 'CÀMERA 4: PANORÀMICA 3D'
    };
    showBanner(names[mode] || mode, 1.3);
  }

  function resizeAll() {
    const wrap = document.getElementById('stageWrap');
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    hudCanvas.width = w;
    hudCanvas.height = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener('resize', resizeAll);
  window.addEventListener('blur', () => setPaused(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  document.getElementById('btnPause')?.addEventListener('click', () => setPaused(!state.paused));
  document.getElementById('btnBench')?.addEventListener('click', openBench);
  document.getElementById('btnCloseBench')?.addEventListener('click', closeBench);
  document.getElementById('benchDialog')?.addEventListener('cancel', e => { e.preventDefault(); closeBench(); });
  document.getElementById('benchOut')?.addEventListener('change', renderBench);
  document.getElementById('btnApplySub')?.addEventListener('click', () => {
    const outId = document.getElementById('benchOut').value;
    const inId = document.getElementById('benchIn').value;
    if (substitute('home',outId,inId)) renderBench();
  });
  document.getElementById('btnSecondHalf')?.addEventListener('click', beginSecondHalf);

  window.addEventListener('wheel', e => {
    const delta = e.deltaY > 0 ? 0.08 : -0.08;
    state.zoomAdjust = Math.max(0.65, Math.min(1.45, state.zoomAdjust + delta));
  }, { passive: true });

  window.addEventListener('keydown', e => {
    if (document.getElementById('benchDialog')?.open) return;
    if (e.code === 'KeyB' && !e.repeat) { openBench(); return; }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (!e.repeat) setPaused(!state.paused);
      return;
    }
    if (state.paused || state.mode === 'finished' || state.mode === 'halftime') return;
    keys[e.code] = true;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'Digit1') setCameraMode('nhl_side');
    if (e.code === 'Digit2') setCameraMode('nhl_iso');
    if (e.code === 'Digit3') setCameraMode('end3d');
    if (e.code === 'Digit4') setCameraMode('wide3d');
    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      state.zoomAdjust = Math.max(0.65, state.zoomAdjust - 0.08);
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      state.zoomAdjust = Math.min(1.45, state.zoomAdjust + 0.08);
    }

    if ((e.code === 'KeyQ' || e.code === 'Tab') && !e.repeat) {
      switchToNextPlayer();
    }
    if ((e.code === 'Space' || e.code === 'KeyJ' || e.code === 'KeyZ') && !e.repeat) {
      performPassOrSwitch();
    }
    if ((e.code === 'KeyK' || e.code === 'KeyX' || e.code === 'Enter') && !e.repeat) {
      startShootOrSteal();
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'KeyK' || e.code === 'KeyX' || e.code === 'Enter') {
      releaseShot();
    }
  });

  document.querySelectorAll('[data-cam]').forEach(btn => {
    btn.addEventListener('click', () => setCameraMode(btn.getAttribute('data-cam')));
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
      const maxR = 42;
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

  const btnPass = document.getElementById('btnPass');
  const btnShoot = document.getElementById('btnShoot');
  const btnSprint = document.getElementById('btnSprint');
  const btnDiff = document.getElementById('btnDiff');
  const btnPace = document.getElementById('btnPace');
  const btnCourt = document.getElementById('btnCourt');
  const btnBlueCard = document.getElementById('btnBlueCard');
  const btnDirectFoul = document.getElementById('btnDirectFoul');
  const btnReset = document.getElementById('btnReset');

  if (btnPass) btnPass.addEventListener('pointerdown', e => { e.preventDefault(); performPassOrSwitch(); });
  if (btnShoot) {
    btnShoot.addEventListener('pointerdown', e => { e.preventDefault(); startShootOrSteal(); });
    btnShoot.addEventListener('pointerup', e => { e.preventDefault(); releaseShot(); });
    btnShoot.addEventListener('pointerleave', () => { if (state.chargingShot) releaseShot(); });
    btnShoot.addEventListener('pointercancel', () => { state.chargingShot = false; state.shotCharge = 0; });
  }
  if (btnSprint) {
    btnSprint.addEventListener('pointerdown', e => { e.preventDefault(); touchInput.sprint = true; });
    btnSprint.addEventListener('pointerup', e => { e.preventDefault(); touchInput.sprint = false; });
    btnSprint.addEventListener('pointerleave', () => { touchInput.sprint = false; });
    btnSprint.addEventListener('pointercancel', () => { touchInput.sprint = false; });
  }
  if (btnDiff) {
    btnDiff.addEventListener('click', () => {
      const order = ['balanced', 'hard', 'easy'];
      const next = order[(order.indexOf(state.gkDiff) + 1) % order.length];
      state.gkDiff = next;
      btnDiff.textContent = GK_DIFFICULTY[next].label;
      showBanner(GK_DIFFICULTY[next].label.toUpperCase(), 1.2);
    });
  }
  if (btnPace) {
    btnPace.addEventListener('click', () => {
      const modes = [
        { key: 'realistic', factor: 0.45, label: '⏱ Ritme: Pausat (Realista)' },
        { key: 'normal', factor: 0.56, label: '⏱ Ritme: Mitjà' },
        { key: 'fast', factor: 0.68, label: '⏱ Ritme: Ràpid' }
      ];
      const currIdx = modes.findIndex(m => m.key === state.paceMode);
      const next = modes[(currIdx + 1) % modes.length];
      state.paceMode = next.key;
      state.paceFactor = next.factor;
      btnPace.textContent = next.label;
      showBanner(next.label.toUpperCase(), 1.2);
    });
  }
  if (btnCourt) {
    btnCourt.addEventListener('click', () => {
      state.courtStyle = state.courtStyle === 'blue' ? 'wood' : 'blue';
      if (courtFloorMesh) {
        courtFloorMesh.material.map = courtTextures[state.courtStyle];
        courtFloorMesh.material.needsUpdate = true;
      }
      btnCourt.textContent = state.courtStyle === 'blue' ? 'Pista: Blava WSE' : 'Pista: Parquet Fusta';
    });
  }
  if (btnBlueCard) {
    btnBlueCard.addEventListener('click', () => registerFoul('away', true));
  }
  if (btnDirectFoul) {
    btnDirectFoul.addEventListener('click', () => { if (!state.paused && ['match','kickoff'].includes(state.mode)) resetPositions('direct_foul', 'home'); });
  }
  if (btnReset) {
    btnReset.addEventListener('click', newMatch);
  }

  build3DRinkArena();
  createOfficialRollerHockeyGoal3D('left');
  createOfficialRollerHockeyGoal3D('right');
  createEntities();
  resizeAll();
  newMatch();
  update3DMeshes();
  updateWebGLCamera(1);

  let lastTime = performance.now();
  let accumulator = 0;
  const fixedStep = 1 / 60;
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    accumulator += dt;
    while (accumulator >= fixedStep) {
      update(fixedStep);
      accumulator -= fixedStep;
    }
    // Visuals stay responsive while the match clock and physics are paused.
    update3DMeshes();
    updateWebGLCamera(dt);
    renderer.render(scene, camera);
    renderHUD();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
