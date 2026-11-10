// A playable match on the simulation's 3D field, against an AI, plus weather for the field (sim-match.css).
// You lead your team (the one selected on the tactics board): WASD / arrows to run, Shift to sprint,
// Space to pass, F to shoot, Q to switch to the player nearest the ball. Everyone else is played by the AI.
// Ratings from the dossiers matter: PAC speed, SHO shot power and aim, PAS pass accuracy, DRI ball control,
// DEF tackles, PHY shoulder strength. Weather changes the ball and the legs.
(() => {
  'use strict';
  const view = document.getElementById('simulationView'), viewport = document.getElementById('simViewport');
  const cameraSelect = document.getElementById('simCamera');
  if (!view || !viewport || !cameraSelect) return;
  const AXES = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
  const PREFIX = {fearCard: 'fear', wahCard: 'wah', frogCard: 'frog', swarggyCard: 'swarggy', emilianoCard: 'emiliano', yoruCard: 'yoru'};
  const WEATHER = [['clear', 'ЯСНО'], ['rain', 'ДОЖДЬ'], ['snow', 'СНЕГ'], ['night', 'НОЧЬ'], ['fog', 'ТУМАН'], ['storm', 'ГРОЗА']];
  const WEATHER_KEY = 'hyperborea_sim_weather_v1';
  const MATCH_SECONDS = 180;

  // ── Controls next to «Ракурс»: weather and the match button ──
  const bar = cameraSelect.closest('label')?.parentElement;
  const weatherLabel = document.createElement('label');
  weatherLabel.innerHTML = 'ПОГОДА<select id="simWeather">' + WEATHER.map(([v, n]) => `<option value="${v}">${n}</option>`).join('') + '</select>';
  const playButton = document.createElement('button');
  playButton.type = 'button'; playButton.id = 'simMatchStart'; playButton.className = 'sim-match-start'; playButton.textContent = '⚽ МАТЧ С ИИ';
  bar?.append(weatherLabel, playButton);
  const weatherSelect = weatherLabel.querySelector('select');
  try { weatherSelect.value = localStorage.getItem(WEATHER_KEY) || 'clear'; } catch {}
  const weather = () => weatherSelect.value;
  function applyWeather() { window.Simulation?.renderer?.setWeather?.(weather()); }
  weatherSelect.addEventListener('change', () => { try { localStorage.setItem(WEATHER_KEY, weather()); } catch {} applyWeather(); });
  // A new field is made each time the simulation opens; give it the chosen weather once it exists.
  new MutationObserver(() => {
    if (view.hidden) { stop(false); return; }
    let tries = 0; const wait = () => { if (window.Simulation?.renderer) applyWeather(); else if (tries++ < 40) setTimeout(wait, 150); }; wait();
  }).observe(view, {attributes: true, attributeFilter: ['hidden']});

  // ── The scoreboard and help shown during a match ──
  const hud = document.createElement('div');
  hud.className = 'sim-match-hud'; hud.hidden = true;
  hud.innerHTML = '<div class="sim-match-score"><span class="team-a">A</span><b data-score>0 : 0</b><span class="team-b">B</span><output data-clock>3:00</output></div>'
    + '<p class="sim-match-help">WASD / СТРЕЛКИ — бег · SHIFT — рывок · ПРОБЕЛ — пас · F — удар · Q — сменить игрока</p>'
    + '<p class="sim-match-call" data-call aria-live="polite"></p>'
    + '<button type="button" class="sim-match-stop">✕ ЗАВЕРШИТЬ МАТЧ</button>';
  viewport.append(hud);
  const scoreEl = hud.querySelector('[data-score]'), clockEl = hud.querySelector('[data-clock]'), callEl = hud.querySelector('[data-call]');
  hud.querySelector('.sim-match-stop').addEventListener('click', () => stop(true));

  const rand = Math.random, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const len = (x, z) => Math.hypot(x, z) || 1e-6;
  function rating(id, axis) {
    const n = parseInt(document.getElementById((PREFIX[id] || '') + 'Stat' + axis)?.value, 10);
    return Number.isFinite(n) ? clamp(n, 1, 99) : 62;
  }

  let game = null;
  function start() {
    const sim = window.Simulation, r = sim?.renderer, lineup = sim?.lineup;
    if (!r || !lineup || game) return;
    const W = r.field.width, L = r.field.length, mode = lineup.mode, size = Number(mode);
    const human = lineup.selectedTeam === 'b' ? 'b' : 'a';
    // Missing players on either side are filled with AI bots in a mirrored formation.
    const players = lineup.players.map(p => ({...p}));
    for (const team of ['a', 'b']) {
      const have = players.filter(p => p.team === team), other = players.filter(p => p.team !== team);
      for (let i = have.length; i < size; i++) {
        const model = other[i] || other[i % Math.max(1, other.length)] || {x: 50, y: 70};
        players.push({key: team + ':bot' + i, team, name: 'БОТ ' + (i + 1), role: i === 0 ? 'GK' : '', x: 100 - model.x, y: 100 - model.y, image: null, id: 'bot'});
      }
    }
    r.setPlayers(players);
    r.setAnnotations?.([]);
    const toWorld = p => ({x: (p.x - 50) * W / 100, z: (p.y - 50) * L / 100});
    const goalHalf = 3.66 * W / 68, goalLine = L / 2;
    const wet = weather() === 'rain' || weather() === 'storm', snow = weather() === 'snow';
    game = {
      r, W, L, human, goalHalf, goalLine, time: MATCH_SECONDS, score: {a: 0, b: 0}, pause: 0, last: performance.now(), frame: 0, keys: new Set(), lastTouch: null,
      friction: wet ? 0.55 : snow ? 1.6 : 0.95, legs: snow ? 0.85 : wet ? 0.95 : 1,
      ball: {x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, owner: null},
      players: players.map(p => {
        const home = toWorld(p), stats = Object.fromEntries(AXES.map(a => [a, rating(p.id, a)]));
        const gk = /GK/.test(p.role || '') || (p.team === 'a' ? p.y : 100 - p.y) > 90;
        return {key: p.key, team: p.team, name: p.name, home, x: home.x, z: home.z, vx: 0, vz: 0, heading: 0, stats, gk, cooldown: 0};
      })
    };
    game.controlled = game.players.filter(p => p.team === human && !p.gk).sort((a, b) => len(a.x, a.z) - len(b.x, b.z))[0];
    kickoff(human === 'a' ? 'b' : 'a');
    view.classList.add('is-match'); hud.hidden = false; playButton.disabled = true;
    say('МАТЧ НАЧАЛСЯ', 1.4);
    viewport.focus({preventScroll: true});
    game.frame = requestAnimationFrame(tick);
  }
  function stop(restore = true) {
    if (!game) return;
    cancelAnimationFrame(game.frame);
    const r = game.r; game = null;
    view.classList.remove('is-match'); hud.hidden = true; playButton.disabled = false;
    if (restore && window.Simulation?.renderer === r) {
      r.cameraTarget.set(0, 0, 0); r._updateCamera?.();
      r.setPlayers(window.Simulation.lineup.players);
      document.getElementById('simReset')?.click();
    }
  }
  function say(text, seconds = 1.6) { callEl.textContent = text; callEl.classList.add('is-on'); clearTimeout(say.t); say.t = setTimeout(() => callEl.classList.remove('is-on'), seconds * 1000); }
  // Everyone back home; the team that conceded (or kicks off) gets the ball at the centre.
  function kickoff(team) {
    for (const p of game.players) { p.x = p.home.x; p.z = p.home.z * (p.gk ? 1 : 0.55); p.vx = p.vz = 0; }
    const taker = game.players.filter(p => p.team === team && !p.gk).sort((a, b) => len(a.x, a.z) - len(b.x, b.z))[0];
    taker.x = 0; taker.z = (team === 'a' ? 1 : -1) * 1.2;
    Object.assign(game.ball, {x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, owner: taker});
    if (team === game.human) game.controlled = taker;
    game.pause = 1;
  }
  // Where a team attacks: team a towards −Z (the goal at y = 0), team b towards +Z.
  const attackDir = team => team === 'a' ? -1 : 1;
  const speedOf = p => (5.2 + p.stats.PAC / 100 * 3.2) * game.legs;

  function kick(p, tx, tz, power, lift = 0, error = 0) {
    const b = game.ball, dx = tx - b.x, dz = tz - b.z, d = len(dx, dz), wobble = (rand() - .5) * error;
    const ux = dx / d, uz = dz / d, ex = ux * Math.cos(wobble) - uz * Math.sin(wobble), ez = ux * Math.sin(wobble) + uz * Math.cos(wobble);
    Object.assign(b, {owner: null, vx: ex * power, vz: ez * power, vh: lift});
    game.lastTouch = p.team; p.cooldown = 0.35;
  }
  function pass(p, target) {
    const b = game.ball, lead = 0.35, tx = target.x + target.vx * lead, tz = target.z + target.vz * lead;
    const d = len(tx - b.x, tz - b.z), error = (1 - p.stats.PAS / 110) * 0.35 * (game.friction < 0.8 ? 1.35 : 1);
    kick(p, tx, tz, clamp(d * 1.6 + 6, 8, 26), d > 18 ? 3.2 : 0, error);
  }
  function shoot(p) {
    const dir = attackDir(p.team), aim = (rand() - .5) * game.goalHalf * 1.6;
    const error = (1 - p.stats.SHO / 105) * 0.3, power = 18 + p.stats.SHO / 100 * 12;
    kick(p, aim, dir * game.goalLine, power, 2.2 + rand() * 2.2, error);
    if (p.team === game.human) say('УДАР!', 0.8);
  }
  function bestPassTarget(p, prefer) {
    const dir = attackDir(p.team);
    let best = null, score = -Infinity;
    for (const q of game.players) {
      if (q.team !== p.team || q === p) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = len(dx, dz);
      if (d < 3 || d > 40) continue;
      let s = -d * 0.15 + (dz * dir) * 0.12;
      if (prefer) s += ((dx * prefer.x + dz * prefer.z) / d) * 6;
      // Open players are better: penalise defenders close to the line.
      for (const o of game.players) if (o.team !== p.team) { const t = clamp(((o.x - p.x) * dx + (o.z - p.z) * dz) / (d * d), 0, 1); const cx = p.x + dx * t - o.x, cz = p.z + dz * t - o.z; if (len(cx, cz) < 2.2) s -= 4; }
      if (q.gk) s -= 3;
      if (s > score) { score = s; best = q; }
    }
    return best;
  }
  // The AI for one player: the ball owner dribbles, passes or shoots; the rest press, support or hold shape.
  function think(p, dt) {
    const b = game.ball, dir = attackDir(p.team), mine = b.owner?.team === p.team;
    let tx = p.home.x, tz = p.home.z;
    if (p.gk) {
      tx = clamp(b.x * 0.4, -game.goalHalf, game.goalHalf); tz = -dir * (game.goalLine - 1.5);
      if (!b.owner && len(b.x - p.x, b.z - p.z) < 8 && Math.sign(b.z) === -dir) { tx = b.x; tz = b.z; }
    } else if (b.owner === p) {
      const goalDist = len(0 - p.x, dir * game.goalLine - p.z);
      const pressed = game.players.some(o => o.team !== p.team && len(o.x - p.x, o.z - p.z) < 3.2 && (o.z - p.z) * dir > -0.5);
      if (p.cooldown <= 0) {
        if (goalDist < Math.min(24, game.L * 0.32) && rand() < dt * 2.4) { shoot(p); return; }
        if (pressed && rand() < dt * 3) { const t = bestPassTarget(p); if (t) { pass(p, t); return; } }
        if (rand() < dt * 0.35) { const t = bestPassTarget(p); if (t && (t.z - p.z) * dir > 4) { pass(p, t); return; } }
      }
      tx = p.x * 0.6 + (rand() - .5) * 4; tz = dir * game.goalLine;
    } else if (!mine) {
      // The two nearest chase the ball; the others fall back in shape, leaning towards it.
      const chasers = game.players.filter(q => q.team === p.team && !q.gk).sort((m, n) => len(m.x - b.x, m.z - b.z) - len(n.x - b.x, n.z - b.z));
      if (chasers.indexOf(p) < (game.L > 80 ? 2 : 1) + (b.owner ? 0 : 1)) { tx = b.x + b.vx * 0.3; tz = b.z + b.vz * 0.3; }
      else { tx = p.home.x * 0.8 + b.x * 0.2; tz = p.home.z * 0.75 + b.z * 0.25 - dir * 3; }
    } else {
      // Support: move up the pitch around the ball carrier.
      tx = p.home.x * 0.75 + b.x * 0.25; tz = p.home.z * 0.35 + b.z * 0.65 + dir * 8;
    }
    steer(p, tx, tz, dt, b.owner === p ? 0.88 : 1);
  }
  function steer(p, tx, tz, dt, factor = 1) {
    const dx = tx - p.x, dz = tz - p.z, d = len(dx, dz), max = speedOf(p) * factor * (d < 1.5 ? d / 1.5 : 1);
    const k = 1 - Math.exp(-8 * dt);
    p.vx += (dx / d * max - p.vx) * k; p.vz += (dz / d * max - p.vz) * k;
  }
  function human(p, dt) {
    const k = game.keys;
    let mx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0), mz = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
    // Screen-relative: rotate the input by the camera's angle so "up" always runs away from the viewer.
    const a = game.r.cameraState?.azimuth || 0, cx = mx * Math.cos(a) + mz * Math.sin(a), cz = -mx * Math.sin(a) + mz * Math.cos(a);
    const d = len(cx, cz), sprint = k.has('sprint') ? 1.22 : 1, max = speedOf(p) * sprint * (game.ball.owner === p ? 0.9 : 1);
    const kk = 1 - Math.exp(-10 * dt);
    p.vx += ((mx || mz ? cx / d * max : 0) - p.vx) * kk; p.vz += ((mx || mz ? cz / d * max : 0) - p.vz) * kk;
    p.aim = mx || mz ? {x: cx / d, z: cz / d} : p.aim;
  }
  function tick(now) {
    if (!game) return;
    const g = game, dt = Math.min(0.05, (now - g.last) / 1000); g.last = now;
    g.frame = requestAnimationFrame(tick);
    if (document.hidden) return;
    if (g.pause > 0) g.pause -= dt; else g.time -= dt;
    const b = g.ball;
    for (const p of g.players) {
      p.cooldown -= dt;
      if (g.pause > 0) { p.vx *= 0.8; p.vz *= 0.8; continue; }
      if (p === g.controlled) human(p, dt); else think(p, dt);
      p.x = clamp(p.x + p.vx * dt, -g.W / 2 - 2, g.W / 2 + 2); p.z = clamp(p.z + p.vz * dt, -g.L / 2 - 2, g.L / 2 + 2);
      if (len(p.vx, p.vz) > 0.4) p.heading = Math.atan2(p.vx, p.vz);
    }
    // Players do not stand inside each other.
    for (let i = 0; i < g.players.length; i++) for (let j = i + 1; j < g.players.length; j++) {
      const p = g.players[i], q = g.players[j], dx = q.x - p.x, dz = q.z - p.z, d = len(dx, dz);
      if (d < 1.6) { const push = (1.6 - d) / 2; p.x -= dx / d * push; p.z -= dz / d * push; q.x += dx / d * push; q.z += dz / d * push; }
    }
    if (b.owner) {
      const o = b.owner, hx = Math.sin(o.heading), hz = Math.cos(o.heading);
      b.x = o.x + hx * 1.05; b.z = o.z + hz * 1.05; b.h = 0; b.vx = o.vx; b.vz = o.vz;
      // Tackles: a defender close to the carrier can win the ball; DEF against DRI and PHY.
      for (const d of g.players) {
        if (d.team === o.team || d.cooldown > 0 || len(d.x - b.x, d.z - b.z) > 1.3) continue;
        const chance = (0.9 + (d.stats.DEF - (o.stats.DRI + o.stats.PHY) / 2) / 60) * dt * 2.2;
        if (rand() < chance) { b.owner = d; d.cooldown = 0.5; o.cooldown = 0.6; g.lastTouch = d.team; if (d.team === g.human) g.controlled = d; break; }
      }
    } else {
      b.x += b.vx * dt; b.z += b.vz * dt; b.vh -= 9.8 * dt; b.h = Math.max(0, b.h + b.vh * dt);
      if (b.h === 0) { if (b.vh < -2) b.vh *= -0.35; else b.vh = 0; const f = Math.exp(-g.friction * dt); b.vx *= f; b.vz *= f; }
      // Anyone near a low, slow enough ball takes it; the keeper also catches shots.
      for (const p of g.players) {
        if (p.cooldown > 0 || b.h > (p.gk ? 2.6 : 1.1)) continue;
        const reach = p.gk ? 1.9 : 1.2, speed = len(b.vx, b.vz);
        if (len(p.x - b.x, p.z - b.z) < reach && (speed < 15 + p.stats.DRI / 10 || p.gk && rand() < 0.55 + p.stats.DEF / 250)) {
          b.owner = p; g.lastTouch = p.team; if (p.team === g.human && !p.gk) g.controlled = p;
          if (p.gk && speed > 12) say(p.team === g.human ? 'СЕЙВ!' : 'ВРАТАРЬ ЛОВИТ', 1);
          break;
        }
      }
      // Goal, or out of play.
      if (Math.abs(b.z) > g.goalLine) {
        const team = b.z < 0 ? 'a' : 'b';
        if (Math.abs(b.x) < g.goalHalf && b.h < 3.0) { g.score[team]++; goal(team); return; }
        const keeper = g.players.find(p => p.gk && attackDir(p.team) === Math.sign(b.z) * -1) || g.players[0];
        Object.assign(b, {owner: keeper, vx: 0, vz: 0, h: 0}); keeper.x = clamp(b.x, -4, 4); keeper.z = Math.sign(b.z) * (g.goalLine - 2);
        g.pause = 0.6; say('ОТ ВОРОТ', 0.9);
      } else if (Math.abs(b.x) > g.W / 2) {
        const side = Math.sign(b.x), team = g.lastTouch === 'a' ? 'b' : 'a';
        const taker = g.players.filter(p => p.team === team && !p.gk).sort((m, n) => len(m.x - b.x, m.z - b.z) - len(n.x - b.x, n.z - b.z))[0];
        taker.x = side * (g.W / 2 - 0.5); taker.z = clamp(b.z, -g.L / 2 + 2, g.L / 2 - 2);
        Object.assign(b, {owner: taker, vx: 0, vz: 0, h: 0}); if (team === g.human) g.controlled = taker;
        g.pause = 0.6; say('АУТ', 0.8);
      }
    }
    if (g.time <= 0) { finish(); return; }
    // Camera follows the ball softly.
    const target = g.r.cameraTarget; target.x += (b.x * 0.6 - target.x) * (1 - Math.exp(-2 * dt)); target.z += (b.z * 0.75 - target.z) * (1 - Math.exp(-2 * dt));
    g.r._updateCamera?.();
    const toPoint = (x, z) => ({x: x / g.W * 100 + 50, y: z / g.L * 100 + 50});
    g.r.setPose({
      players: g.players.map(p => ({key: p.key, ...toPoint(p.x, p.z), heading: p.heading, effect: p === g.controlled ? 0.55 : 0})),
      ball: {...toPoint(b.x, b.z), height: b.h}
    });
    scoreEl.textContent = `${g.score.a} : ${g.score.b}`;
    const t = Math.max(0, Math.ceil(g.time)); clockEl.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }
  function goal(team) {
    say(team === game.human ? 'ГОЛ! ⚽' : 'ГОЛ СОПЕРНИКА', 2);
    const goalEl = document.getElementById('simGoal'); if (goalEl) { goalEl.hidden = false; setTimeout(() => { goalEl.hidden = true; }, 1600); }
    kickoff(team === 'a' ? 'b' : 'a'); game.pause = 1.8;
    scoreEl.textContent = `${game.score.a} : ${game.score.b}`;
  }
  function finish() {
    const s = game.score, h = game.human, other = h === 'a' ? 'b' : 'a';
    say(s[h] > s[other] ? `ПОБЕДА ${s.a} : ${s.b}` : s[h] < s[other] ? `ПОРАЖЕНИЕ ${s.a} : ${s.b}` : `НИЧЬЯ ${s.a} : ${s.b}`, 4);
    game.time = 0; cancelAnimationFrame(game.frame);
    setTimeout(() => stop(true), 3500);
  }
  // Keys: only while a match runs; they never reach the editor underneath.
  const KEYS = {KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint'};
  const keyName = e => e.code || ({w: 'KeyW', s: 'KeyS', a: 'KeyA', d: 'KeyD', f: 'KeyF', q: 'KeyQ', ' ': 'Space', ц: 'KeyW', ы: 'KeyS', ф: 'KeyA', в: 'KeyD', а: 'KeyF', й: 'KeyQ'})[e.key?.toLowerCase()] || e.key;
  window.addEventListener('keydown', e => {
    if (!game) return;
    const code = keyName(e);
    if (code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stop(true); return; }
    if (KEYS[code]) { game.keys.add(KEYS[code]); e.preventDefault(); e.stopImmediatePropagation(); return; }
    const p = game.controlled, b = game.ball;
    if (code === 'Space' || code === 'KeyF' || code === 'KeyQ') { e.preventDefault(); e.stopImmediatePropagation(); }
    if (e.repeat || game.pause > 0) return;
    if (code === 'Space' && b.owner === p) { const t = bestPassTarget(p, p.aim); if (t) { pass(p, t); game.controlled = t; } }
    else if (code === 'KeyF' && b.owner === p) shoot(p);
    else if (code === 'KeyQ') { game.controlled = game.players.filter(q => q.team === game.human && !q.gk).sort((m, n) => len(m.x - b.x, m.z - b.z) - len(n.x - b.x, n.z - b.z))[0]; }
  }, true);
  window.addEventListener('keyup', e => { if (!game) return; const k = KEYS[keyName(e)]; if (k) { game.keys.delete(k); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  window.addEventListener('blur', () => game?.keys.clear());
  playButton.addEventListener('click', start);
  window.SimMatch = {start, stop, get state() { return game ? {score: {...game.score}, time: game.time, controlled: game.controlled?.key, owner: game.ball.owner?.key || null} : null; }};
})();
