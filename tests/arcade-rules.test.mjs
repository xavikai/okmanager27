import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../arcade.js', import.meta.url), 'utf8');

// Run the production simulation functions and state without requiring a GPU.
// Rendering and mesh construction alone are replaced; rules, AI and physics are real.
function game(duration=1500) {
  const globals = source.slice(source.indexOf('  const S ='), source.indexOf('  const scene ='));
  const functions = [...source.matchAll(/^  function \w+\([^]*?^  }/gm)].map(m => m[0]).join('\n');
  const context = vm.createContext({
    console, performance: { now: () => 10000 },
    document: { getElementById: id => id==='matchDuration' ? {value:String(duration)} : null },
    requestAnimationFrame: () => {},
  });
  vm.runInContext(`(() => {
    ${globals}
    ${functions}
    buildSkater3DMesh = buildGoalkeeper3DMesh = () => ({});
    let meshRefreshes = 0, cameraRefreshes = 0;
    update3DMeshes = () => { meshRefreshes++; };
    updateWebGLCamera = () => { cameraRefreshes++; };
    updateReferees = triggerRefereeSignal = () => {};
    renderHUD = () => {};
    const renderer = { render() {} }, scene = {}, camera = {};
    let lastTime = 10000, accumulator = 0;
    const fixedStep = 1/60;
    createSquads();
    newMatch();
    globalThis.game = { state, ball, get players(){return players;}, squads, RINK, METRE, keys, touchInput, update, newMatch,
      resetPositions, registerFoul, onGoal, setPaused, scheduleRestart, setBallOwner,
      getControlledPlayer, switchToNextPlayer, checkGoalScored, performPassOrSwitch,
      startShootOrSteal, releaseShot, playerUnavailable, getNextDirectFoulTarget, loop,
      attackDirection, ownGoalX, opponentGoalX, endPeriod, beginSecondHalf, substitute,
      activePlayers, updateSanctions, updateFitness, autoSubstitute, rebalanceTeam, eligible, getInputVector,
      get meshRefreshes(){return meshRefreshes;}, get cameraRefreshes(){return cameraRefreshes;} };
  })()`, context);
  return context.game;
}

function foul(g, team, { blue = false, idx = 2, x = 500, y = 80 } = {}) {
  g.state.mode = 'match';
  g.ball.owner = null;
  g.ball.x = x; g.ball.y = y;
  g.registerFoul(team, blue, g.players[(team === 'home' ? 0 : 5) + idx]);
}

function advance(g, seconds) {
  for(let i=0;i<Math.ceil(seconds*60);i++) g.update(1/60);
}

test('new match clears scores, shots, fouls, cards, clock and pending restart', () => {
  const g=game();
  foul(g,'away',{blue:true});
  g.state.score.home=4; g.state.shots.away=9; g.state.fouls.home=14; g.state.timeRemaining=1;
  g.newMatch();
  assert.equal(g.state.timeRemaining,1500);
  assert.equal(g.state.pendingRestart,null);
  assert.equal(g.state.cardEvent,null);
  for (const team of ['home','away']) for(const key of ['score','shots','fouls','exclusions']) assert.equal(g.state[key][team],0);
  assert.ok(g.players.every(p=>!g.playerUnavailable(p)&&p.blueCards===0));
});

test('zero clock ends play and rejects later goals', () => {
  const g=game(); g.state.period=2; g.state.mode='match'; g.state.timeRemaining=0.01;
  g.update(1/60);
  assert.equal(g.state.mode,'finished');
  g.onGoal('away'); g.update(1);
  assert.equal(g.state.score.away,0);
  assert.equal(g.state.timeRemaining,0);
});

test('pause freezes timers and pending restarts, and releases held controls', () => {
  const g=game(); foul(g,'away');
  const remaining=g.state.pendingRestart.remaining;
  g.keys.KeyW=true; g.touchInput.sprint=true; g.state.chargingShot=true;
  g.setPaused(true); g.update(10);
  assert.equal(g.state.pendingRestart.remaining,remaining);
  assert.equal(g.keys.KeyW,false); assert.equal(g.touchInput.sprint,false);
  assert.equal(g.state.chargingShot,false);
  g.setPaused(false); g.update(2.3);
  assert.equal(g.state.possessionTeam,'home');
});

test('new match cancels an old goal celebration restart', () => {
  const g=game(); g.state.mode='match'; g.onGoal('home');
  assert.ok(g.state.pendingRestart);
  g.newMatch(); g.update(3);
  assert.equal(g.state.possessionTeam,'home'); assert.equal(g.state.mode,'kickoff');
});

for(const team of ['home','away']) {
  test(`${team}: direct free hit uses its own shooter, attacking direction and AI`, () => {
    const g=game(); g.resetPositions('direct_foul',team);
    assert.equal(g.ball.owner.team,team);
    assert.equal(g.state.possessionTeam,team);
    assert.equal(g.ball.x, g.opponentGoalX(team)-g.attackDirection(team)*g.RINK.directDistance);
    assert.equal(g.state.possessionClock,45);
    g.performPassOrSwitch(); assert.equal(g.ball.owner,g.state.directShooter);
    if(team==='away') {
      for(let i=0;i<74;i++) g.update(1/60);
      assert.equal(g.state.shots.away,1);
      assert.ok(g.ball.vx<0);
      assert.equal(g.state.mode,'match');
    }
  });
  test(`${team}: 10th and 15th team fouls award a direct free hit to the opponent`, () => {
    for(const previous of [9,14,19]) {
      const g=game(); g.state.fouls[team]=previous;
      foul(g,team); advance(g,2.22);
      assert.equal(g.state.fouls[team],previous+1);
      assert.equal(g.state.mode,'direct_foul');
      assert.equal(g.state.possessionTeam,team==='home'?'away':'home');
    }
  });
}

test('ordinary foul changes possession at the foul location', () => {
  const g=game(); foul(g,'home',{x:600,y:70}); g.update(2.3);
  assert.equal(g.state.possessionTeam,'away');
  assert.equal(g.ball.owner.team,'away');
  assert.ok(Math.abs(g.ball.owner.x-600)<3);
});

test('blue card suspends actual offender for 120 seconds, without adding team foul or automatic direct hit', () => {
  const g=game(); foul(g,'away',{blue:true,idx:3});
  assert.equal(g.squads.away[3].suspensionRemaining,120);
  assert.equal(g.playerUnavailable(g.players[6]),false);
  assert.equal(g.state.fouls.away,0);
  g.update(2.3);
  assert.equal(g.state.mode,'match');
  assert.equal(g.ball.owner.team,'home');
  assert.ok(g.squads.away[3].suspensionRemaining<120);
});

test('goal does not shorten player suspension or team inferiority', () => {
  const g=game(); foul(g,'away',{blue:true}); g.update(2.3);
  const remaining=g.squads.away[2].suspensionRemaining;
  g.onGoal('home');
  assert.equal(g.squads.away[2].suspensionRemaining,remaining);
  assert.equal(g.state.exclusions.away,remaining);
});

test('a suspended human is replaced in control and cannot receive the ball', () => {
  const g=game(); g.state.controlledIdx=3; foul(g,'home',{blue:true,idx:3});
  assert.notEqual(g.state.controlledIdx,3);
  assert.ok(g.getControlledPlayer());
  const owner=g.ball.owner;
  g.setBallOwner(g.players[3]); assert.equal(g.ball.owner,owner);
});

test('kickoff chooses an eligible taker if the usual taker is suspended', () => {
  const g=game(); foul(g,'away',{blue:true,idx:4});
  g.resetPositions('kickoff','away');
  assert.notEqual(g.ball.owner,g.players[9]);
  assert.equal(g.ball.owner.team,'away');
  for(let i=0;i<70;i++)g.update(1/60);
  assert.equal(g.state.mode,'match');
});

test('penalty-area foul awards a penalty without adding a team foul', () => {
  const g=game(); foul(g,'away',{x:800,y:250}); advance(g,2.22);
  assert.equal(g.state.setPieceType,'penalty');
  assert.equal(g.ball.owner.team,'home'); assert.equal(g.state.directShooter.x,g.opponentGoalX('home')-g.RINK.penaltyDistance);
  assert.equal(g.state.fouls.away,0);
});

test('no invented five-second rule behind the goal', () => {
  const g=game();g.state.mode='match';g.state.crossedHalfCourt=true;
  g.ball.owner=null; g.ball.x=950; g.ball.y=70;
  g.update(5.1);
  assert.notEqual(g.state.mode,'whistle_pause');
});

test('second blue uses a substitute and queues another inferiority period', () => {
  const g=game(); foul(g,'away',{blue:true,idx:2});
  foul(g,'away',{blue:true,idx:3});
  assert.notEqual(g.state.mode,'finished');
  assert.equal(g.activePlayers('away').length,4);
  assert.equal(g.state.penalties.away.length,2);
});

test('goal requires whole-ball crossing from the front and rejects side-net, back-net and high shots', () => {
  const g=game();const line=g.RINK.w-g.RINK.goalLineOffset;
  const attempt=(previous,current)=>{
    g.state.mode='match';Object.assign(g.ball,current);g.checkGoalScored(previous);
  };
  attempt({x:line-5,y:250,z:0},{x:line+g.ball.radius/2,y:250,z:0});
  assert.equal(g.state.score.home,0,'partial crossing');
  attempt({x:line+10,y:300,z:0},{x:line+12,y:250,z:0});
  assert.equal(g.state.score.home,0,'side net');
  attempt({x:line+30,y:250,z:0},{x:line+10,y:250,z:0});
  assert.equal(g.state.score.home,0,'back net');
  attempt({x:line-5,y:250,z:50},{x:line+5,y:250,z:50});
  assert.equal(g.state.score.home,0,'above crossbar');
  attempt({x:line-5,y:250,z:0},{x:line+5,y:250,z:0});
  assert.equal(g.state.score.home,1,'legal goal');
  g.checkGoalScored({x:line-5,y:250,z:0});
  assert.equal(g.state.score.home,1,'no double-count');
});

test('left goal crossing awards away goal',()=>{
  const g=game();g.state.mode='match';
  Object.assign(g.ball,{x:g.RINK.goalLineOffset-5,y:250,z:0});
  g.checkGoalScored({x:g.RINK.goalLineOffset+5,y:250,z:0});
  assert.equal(g.state.score.away,1);
});

test('30, 60 and 144 FPS produce the same skating distance and match time',()=>{
  const results=[30,60,144].map(fps=>{
    const g=game();g.state.mode='match';g.keys.ArrowUp=true;
    for(let frame=1;frame<=fps;frame++)g.loop(10000+frame*1000/fps);
    return {y:g.players[4].y,time:g.state.timeRemaining};
  });
  assert.ok(Math.max(...results.map(r=>r.y))-Math.min(...results.map(r=>r.y))<2);
  assert.ok(Math.max(...results.map(r=>r.time))-Math.min(...results.map(r=>r.time))<0.02);
});

test('each squad has ten unique players, two keepers, five on court and five on the bench',()=>{
  const g=game();
  for(const team of ['home','away']) {
    assert.equal(g.squads[team].length,10);
    assert.equal(new Set(g.squads[team].map(p=>p.id)).size,10);
    assert.equal(g.squads[team].filter(p=>p.role==='GK').length,2);
    assert.equal(g.activePlayers(team).length,5);
    assert.equal(g.squads[team].filter(p=>!p.onPitch).length,5);
    assert.ok(g.squads[team].filter(p=>p.demo).every(p=>!p.onPitch));
  }
});

test('substitutions preserve formation, control, score and clock; players can re-enter',()=>{
  const g=game();const out=g.players[4],incoming=g.squads.home[6];
  g.state.score.home=2;g.state.timeRemaining=1200;
  assert.equal(g.substitute('home',out.id,incoming.id),true);
  assert.equal(g.players[4],incoming);
  assert.equal(g.getControlledPlayer(),incoming);
  assert.equal(g.ball.owner,incoming,'kickoff remains ready with the new taker');
  assert.equal(g.activePlayers('home').length,5);
  assert.equal(out.onPitch,false);assert.equal(incoming.idx,4);
  assert.equal(g.state.score.home,2);assert.equal(g.state.timeRemaining,1200);
  assert.equal(g.substitute('home',incoming.id,out.id),true);
  assert.equal(g.players[4],out);assert.equal(g.state.substitutionCount.home,2);
});

test('goalkeepers can be changed only for another eligible goalkeeper',()=>{
  const g=game();const keeper=g.players[0],reserve=g.squads.home[5];
  assert.equal(g.substitute('home',keeper.id,g.squads.home[6].id),false);
  assert.equal(g.substitute('home',g.players[1].id,reserve.id),false);
  assert.equal(g.substitute('home',keeper.id,reserve.id),true);
  assert.equal(g.players[0],reserve);
  assert.equal(g.activePlayers('home').filter(p=>p.role==='GK').length,1);
});

test('live play and set pieces reject substitutions; a tactical pause permits them',()=>{
  const g=game(),out=g.players[3],incoming=g.squads.home[6];
  g.state.mode='match';
  assert.equal(g.substitute('home',out.id,incoming.id),false);
  g.setPaused(true);
  assert.equal(g.substitute('home',out.id,incoming.id),true);
  g.state.mode='direct_foul';
  assert.equal(g.substitute('home',incoming.id,out.id),false);
  g.state.mode='finished';
  assert.equal(g.substitute('home',incoming.id,out.id),false);
});

test('suspended, expelled, already active and opposing players cannot enter',()=>{
  const g=game(),out=g.players[3],reserve=g.squads.home[6];
  reserve.suspensionRemaining=1;
  assert.equal(g.substitute('home',out.id,reserve.id),false);
  reserve.suspensionRemaining=0;reserve.sentOff=true;
  assert.equal(g.substitute('home',out.id,reserve.id),false);
  assert.equal(g.substitute('home',out.id,g.players[2].id),false);
  assert.equal(g.substitute('home',out.id,g.squads.away[6].id),false);
});

test('bench players cannot take possession and stay outside the playing surface',()=>{
  const g=game(),owner=g.ball.owner;
  for(const p of [...g.squads.home,...g.squads.away].filter(p=>!p.onPitch)) {
    assert.ok(p.y<0);g.setBallOwner(p);assert.equal(g.ball.owner,owner);
    assert.equal(g.playerUnavailable(p),true);
  }
});

test('personal suspension and consecutive team penalties use separate clocks',()=>{
  const g=game(),first=g.players[7],second=g.players[8];
  foul(g,'away',{blue:true,idx:2});foul(g,'away',{blue:true,idx:3});
  assert.equal(g.activePlayers('away').length,4);
  g.updateSanctions(120);
  assert.equal(first.suspensionRemaining,0);assert.equal(second.suspensionRemaining,0);
  assert.equal(g.state.penalties.away.length,1);
  assert.equal(g.state.exclusions.away,120);
  assert.equal(g.activePlayers('away').length,4);
  g.updateSanctions(120);
  assert.equal(g.state.penalties.away.length,0);
  assert.equal(g.state.exclusions.away,0);
  assert.equal(g.activePlayers('away').length,5);
});

test('a blue to the goalkeeper brings the reserve keeper and removes one skater',()=>{
  const g=game();g.state.mode='match';g.ball.x=500;g.ball.y=70;g.ball.owner=null;
  const keeper=g.players[0];g.registerFoul('home',true,keeper);
  assert.equal(keeper.onPitch,false);assert.equal(keeper.suspensionRemaining,120);
  assert.equal(g.activePlayers('home').length,4);
  assert.equal(g.activePlayers('home').filter(p=>p.role==='GK').length,1);
  assert.equal(g.players[0],g.squads.home[5]);
});

test('third blue expels a player permanently and imposes four minutes of team inferiority',()=>{
  const g=game();g.players[2].blueCards=2;
  const offender=g.players[2];foul(g,'home',{blue:true,idx:2});
  assert.equal(offender.sentOff,true);assert.equal(g.state.exclusions.home,240);
  g.updateSanctions(240);
  assert.equal(g.activePlayers('home').length,5);
  assert.equal(offender.onPitch,false);assert.equal(g.eligible(offender),false);
});

test('bench rest improves freshness and away AI rotates a tired skater at a stoppage',()=>{
  const g=game(),out=g.players[8];out.fatigue=50;
  const reserve=g.squads.away[6];reserve.fatigue=10;
  g.autoSubstitute('away');
  assert.equal(out.onPitch,false);assert.equal(g.state.substitutionCount.away,1);
  const oldFatigue=out.fatigue;g.updateFitness(10);
  assert.ok(out.fatigue<oldFatigue);
});

test('first period ends in a ten-minute break without changing score, fouls or sanctions',()=>{
  const g=game();foul(g,'home',{blue:true});g.state.pendingRestart=null;
  g.state.mode='match';g.state.timeRemaining=0.01;g.state.score.home=3;g.state.fouls.away=9;
  g.update(1/60);
  assert.equal(g.state.mode,'halftime');assert.equal(g.state.period,1);
  assert.equal(g.state.halftimeRemaining,600);assert.equal(g.state.pendingRestart,null);
  const suspension=g.squads.home[2].suspensionRemaining;
  const inferiority=g.state.exclusions.home;
  advance(g,2);
  assert.equal(g.state.timeRemaining,0);assert.equal(g.state.score.home,3);assert.equal(g.state.fouls.away,9);
  assert.equal(g.squads.home[2].suspensionRemaining,suspension);assert.equal(g.state.exclusions.home,inferiority);
  assert.ok(g.state.halftimeRemaining<600);
});

test('second half swaps both goals, keeps the match state and gives the kickoff to the other team',()=>{
  const g=game();g.state.score.home=1;g.state.fouls.away=14;g.endPeriod();
  assert.equal(g.beginSecondHalf(),true);
  assert.equal(g.state.period,2);assert.equal(g.state.mode,'kickoff');assert.equal(g.state.timeRemaining,1500);
  assert.equal(g.state.possessionTeam,'away');assert.equal(g.ball.owner.team,'away');
  assert.equal(g.attackDirection('home'),-1);assert.equal(g.attackDirection('away'),1);
  assert.equal(g.ownGoalX('home'),g.RINK.w-g.RINK.goalLineOffset);
  assert.equal(g.ownGoalX('away'),g.RINK.goalLineOffset);
  assert.equal(g.state.score.home,1);assert.equal(g.state.fouls.away,14);
  assert.equal(g.beginSecondHalf(),false);
});

test('the break can expire automatically, and skipping it grants equivalent rest',()=>{
  const g=game();g.players[1].fatigue=40;g.endPeriod();
  g.state.halftimeRemaining=0.01;g.update(1/60);
  assert.equal(g.state.period,2);assert.equal(g.state.mode,'kickoff');
  const skipped=game();skipped.players[1].fatigue=40;skipped.endPeriod();skipped.beginSecondHalf();
  assert.equal(skipped.players[1].fatigue,4);
});

test('both short periods are played and the final whistle never starts a third period',()=>{
  const g=game(180);assert.equal(g.state.halfDuration,180);
  g.state.mode='match';g.state.timeRemaining=0.01;g.update(1/60);
  assert.equal(g.state.mode,'halftime');g.beginSecondHalf();
  assert.equal(g.state.timeRemaining,180);
  g.state.mode='match';g.state.timeRemaining=0.01;g.update(1/60);
  assert.equal(g.state.mode,'finished');assert.equal(g.state.period,2);
  assert.equal(g.beginSecondHalf(),false);
});

test('new match restores original lineup, first-period direction, sanctions and substitution counters',()=>{
  const g=game();g.substitute('home',g.players[4].id,g.squads.home[6].id);g.endPeriod();g.beginSecondHalf();
  g.newMatch();
  assert.equal(g.state.period,1);assert.equal(g.state.halftimeRemaining,0);assert.equal(g.attackDirection('home'),1);
  assert.equal(g.state.substitutionCount.home,0);
  assert.equal(g.players[4],g.squads.home[4]);
  assert.equal(g.state.penalties.home.length,0);
  assert.equal(g.squads.home.filter(p=>p.onPitch).length,5);
});

test('physical rink dimensions and penalty/direct positions use a single metre scale',()=>{
  const g=game(),m=g.METRE,r=g.RINK;
  assert.equal(r.w/m,40);assert.equal(r.h/m,20);assert.equal(r.cornerRadius/m,3);
  assert.equal(r.goalWidth/m,1.7);assert.equal(r.goalHeight/m,1.05);
  assert.equal(r.areaDepth/m,5.4);assert.equal(r.areaWidth/m,9);
  assert.equal(r.goalLineOffset/m,2.7);assert.equal(r.postRadius*2/m,0.075);
  for(const period of [1,2]) for(const team of ['home','away']) for(const type of ['direct_foul','penalty']) {
    g.state.period=period;g.resetPositions(type,team);
    const distance=Math.abs(g.state.directShooter.x-g.opponentGoalX(team))/m;
    assert.equal(distance,type==='penalty'?5.4:7.4);
  }
});

for(const team of ['home','away']) {
  test(`${team}: goals and direct hits target the correct end in the second half`,()=>{
    const g=game();g.endPeriod();g.beginSecondHalf();
    g.resetPositions('direct_foul',team);
    assert.equal(g.ball.owner.team,team);
    const sign=g.attackDirection(team),line=g.opponentGoalX(team);
    g.state.mode='match';Object.assign(g.ball,{x:line+sign*5,y:250,z:0});
    g.checkGoalScored({x:line-sign*5,y:250,z:0});
    assert.equal(g.state.score[team],1);
  });
}

test('halfway possession rules and vertical camera controls mirror in the second half',()=>{
  const g=game();g.state.camera='end3d';g.keys.ArrowUp=true;
  assert.equal(g.getInputVector().dx,1);
  g.endPeriod();g.beginSecondHalf();g.keys.ArrowUp=true;
  assert.equal(g.getInputVector().dx,-1);
});

test('a final set piece gets five seconds and its goal ends the period without a kickoff',()=>{
  const g=game();g.state.timeRemaining=2;g.resetPositions('direct_foul','home');
  assert.equal(g.state.timeRemaining,5);assert.equal(g.state.endPeriodAfterSetPiece,true);
  g.onGoal('home');assert.equal(g.state.score.home,1);assert.equal(g.state.mode,'halftime');
  assert.equal(g.state.pendingRestart,null);
  g.beginSecondHalf();g.state.timeRemaining=1;g.resetPositions('penalty','away');
  g.onGoal('away');assert.equal(g.state.mode,'finished');assert.equal(g.state.score.away,1);
});

test('an eligible suspended player can re-enter another slot without duplicating an active identity',()=>{
  const g=game(),first=g.players[7],second=g.players[8];
  foul(g,'away',{blue:true,idx:2});foul(g,'away',{blue:true,idx:3});
  g.updateSanctions(120);
  assert.equal(g.eligible(first),true);assert.equal(g.eligible(second),true);
  const incoming=[first,second].find(p=>!p.onPitch);
  const outgoing=g.activePlayers('away').find(p=>p.role!=='GK');
  g.state.mode='kickoff';
  assert.equal(g.substitute('away',outgoing.id,incoming.id),true);
  assert.equal(g.activePlayers('away').length,4);
  assert.equal(new Set(g.activePlayers('away')).size,4);
  g.updateSanctions(120);
  assert.equal(g.activePlayers('away').length,5);
  assert.equal(new Set(g.activePlayers('away')).size,5);
});

test('a final second-half goal stops the simulation immediately and leaves the clock at zero',()=>{
  const g=game();g.endPeriod();g.beginSecondHalf();
  g.state.mode='match';g.state.timeRemaining=5;g.state.endPeriodAfterSetPiece=true;
  g.state.crossedHalfCourt=true;g.state.possessionTeam='home';
  g.players.forEach((p,i)=>{p.x=500;p.y=50+i*35;});
  Object.assign(g.ball,{owner:null,x:g.opponentGoalX('home')+5,y:250,z:0,vx:-20,vy:0,vz:0});
  g.update(1/60);
  assert.equal(g.state.mode,'finished');assert.equal(g.state.score.home,1);
  assert.equal(g.state.timeRemaining,0);assert.equal(g.ball.owner,null);
  assert.equal(g.state.pendingRestart,null);
});

test('paused animation refreshes models and camera without advancing the match',()=>{
  const g=game();g.state.mode='match';g.setPaused(true);
  const time=g.state.timeRemaining,y=g.players[4].y;
  g.loop(10020);g.loop(10040);
  assert.equal(g.state.timeRemaining,time);assert.equal(g.players[4].y,y);
  assert.ok(g.meshRefreshes>=2);assert.ok(g.cameraRefreshes>=2);
});
