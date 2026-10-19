import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../arcade.js', import.meta.url), 'utf8');

// Run the production simulation functions and state without requiring a GPU.
// Rendering and mesh construction alone are replaced; rules, AI and physics are real.
function game(duration=25) {
  const globals = source.slice(source.indexOf('  const S ='), source.indexOf('  const scene ='));
  const functions = [...source.matchAll(/^  function \w+\([^]*?^  }/gm)].map(m => m[0]).join('\n');
  const context = vm.createContext({
    console, performance: { now: () => 10000 },
    document: { getElementById: id => id==='matchDuration' ? {value:String(duration)} : null },
    requestAnimationFrame: () => {},
  });
  let randomSeed=123456789;
  const seededMath=Object.create(Math);
  seededMath.random=()=>{randomSeed=(1664525*randomSeed+1013904223)>>>0;return randomSeed/4294967296;};
  context.Math=seededMath;
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
      chooseShotGesture, shotProfile, launchShot, startShootOrSteal, releaseShot, playerUnavailable, getNextDirectFoulTarget, loop,
      attackDirection, ownGoalX, opponentGoalX, endPeriod, beginSecondHalf, substitute, clockScale, setRealHalfMinutes,
      activePlayers, updateSanctions, updateFitness, autoSubstitute, rebalanceTeam, eligible, getInputVector,
      PACE_MODES, skatingSpeed, restartFreeHit, attemptTakeBall, execAIPass, updateGoalkeeper,
      callBooling, startBooling, boolingPoint, checkNeutralStoppage, registerSimultaneousFouls,
      captureRenderPoses, interpolatedPose, goalkeeperPose, blendGoalkeeperPose,
      beginPass, selectPassReceiver, updatePassFlight, receivePass, collideWithGoalFrames,
      nextSwitchPlayer, defensiveSwitchScore, controlPlayer, defensiveRecoveryTarget, updateDefensiveRecovery, updateAISkater,
      isolatePass(team='home',distance=400){
        updateSanctions=()=>{};
        const offset=team==='home'?0:5,passer=players[offset+4],receiver=players[offset+1];
        players.forEach(p=>{p.onPitch=p===passer||p===receiver;p.vx=p.vy=0;p.stealCooldown=0;});
        state.mode='match';state.possessionTeam=team;state.crossedHalfCourt=true;
        passer.x=team==='home'?200:800;passer.y=250;passer.dir=team==='home'?0:Math.PI;
        receiver.x=passer.x+(team==='home'?1:-1)*distance;receiver.y=250;receiver.dir=passer.dir;
        state.controlledIdx=4;ball.x=passer.x;ball.y=passer.y;setBallOwner(passer);
        return {passer,receiver};
      },
      isolateSkating(ai=false){
        updateSanctions=()=>{};
        state.mode='match';state.possessionTeam='home';state.crossedHalfCourt=true;
        const p=players[ai?1:4];
        players.forEach(other=>{if(other!==p)other.onPitch=false;});
        p.x=250;p.y=250;p.dir=0;p.vx=p.vy=0;
        ball.x=750;ball.y=250;ball.owner=ai?null:p;
        keys.ArrowRight=!ai;
        return p;
      },
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
      for(let i=0;i<185;i++) g.update(1/60);
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
  assert.ok(Math.abs(g.ball.x-600)<3);
});

test('blue card suspends actual offender for 120 seconds, without adding team foul or automatic direct hit', () => {
  const g=game(); foul(g,'away',{blue:true,idx:3});
  assert.equal(g.squads.away[3].suspensionRemaining,120);
  assert.equal(g.playerUnavailable(g.players[6]),false);
  assert.equal(g.state.fouls.away,0);
  g.update(2.3);
  assert.equal(g.state.mode,'free_hit');
  assert.equal(g.ball.owner.team,'home');
  assert.equal(g.squads.away[3].suspensionRemaining,120);
  g.performPassOrSwitch();g.update(1/60);
  assert.ok(g.squads.away[3].suspensionRemaining<120);
});

test('goal does not shorten player suspension or team inferiority', () => {
  const g=game(); foul(g,'away',{blue:true}); g.update(2.3);
  g.performPassOrSwitch();
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

test('10, 30, 60 and 144 FPS produce the same skating distance and match time',()=>{
  const results=[10,30,60,144].map(fps=>{
    const g=game();const p=g.isolateSkating();
    for(let frame=1;frame<=fps;frame++)g.loop(10000+frame*1000/fps);
    return {x:p.x,time:g.state.timeRemaining};
  });
  assert.ok(Math.max(...results.map(r=>r.x))-Math.min(...results.map(r=>r.x))<0.001);
  assert.ok(Math.max(...results.map(r=>r.time))-Math.min(...results.map(r=>r.time))<0.001);
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

test('a short real half still shows 25 minutes and runs the clock faster, like FIFA',()=>{
  const g=game(5);assert.equal(g.state.halfDuration,1500);assert.equal(g.state.realHalfMinutes,5);
  assert.equal(g.state.timeRemaining,1500);assert.equal(g.clockScale(),5);
  g.state.mode='match';const possession=g.state.possessionClock;
  g.update(1/60);
  assert.ok(Math.abs(1500-g.state.timeRemaining-5/60)<1e-9,'one real frame advances five game frames');
  assert.ok(Math.abs(possession-g.state.possessionClock-1/60)<1e-9,'the 45 s possession clock stays in real seconds');
  g.state.timeRemaining=0.01;g.update(1/60);
  assert.equal(g.state.mode,'halftime');
  g.update(1);assert.ok(Math.abs(600-5-g.state.halftimeRemaining)<1e-9,'the break also runs on the match clock');
  g.beginSecondHalf();assert.equal(g.state.timeRemaining,1500);
  g.state.mode='match';g.state.timeRemaining=0.01;g.update(1/60);
  assert.equal(g.state.mode,'finished');assert.equal(g.state.period,2);
  assert.equal(g.beginSecondHalf(),false);
});

test('half length accepts the FIFA-style options and can change mid-match',()=>{
  const g=game(10);assert.equal(g.clockScale(),2.5);
  assert.equal(g.setRealHalfMinutes(3),3);assert.ok(Math.abs(g.clockScale()-1500/180)<1e-9);
  assert.equal(g.setRealHalfMinutes(25),25);assert.equal(g.clockScale(),1);
  assert.equal(g.setRealHalfMinutes(2),25,'unknown values fall back to real time');
  assert.equal(g.setRealHalfMinutes(180),25,'old second-based values are ignored');
  const fast=game(5);fast.state.timeRemaining=2;fast.resetPositions('direct_foul','home');
  assert.equal(fast.state.timeRemaining,25,'a last set piece keeps about five real seconds');
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
  advance(g,1.85);g.onGoal('home');assert.equal(g.state.score.home,1);assert.equal(g.state.mode,'halftime');
  assert.equal(g.state.pendingRestart,null);
  g.beginSecondHalf();g.state.timeRemaining=1;g.resetPositions('penalty','away');
  advance(g,1.85);g.onGoal('away');assert.equal(g.state.mode,'finished');assert.equal(g.state.score.away,1);
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

test('balanced pace covers 20 metres in about four seconds, between the relaxed and fast settings',()=>{
  const times=[];
  for(const mode of game().PACE_MODES){
    const g=game(),p=g.isolateSkating();g.state.paceFactor=mode.factor;
    let frames=0;while(p.x<750&&frames<1200){g.update(1/60);frames++;}
    times.push(frames/60);
  }
  assert.ok(times[0]>times[1]&&times[1]>times[2]);
  assert.ok(times[1]>3.6&&times[1]<4.4,'default pace stays responsive without an excessive speed increase');
});

test('AI closes a 20-metre loose-ball chase without the old sluggish movement',()=>{
  const g=game(),p=g.isolateSkating(true);
  let frames=0;while(p.x<750&&frames<600){g.update(1/60);frames++;}
  assert.ok(frames/60>2.8&&frames/60<4.5);
});

for (const team of ['home','away']) for (const period of [1,2]) {
  test(team+' period '+period+': free hit keeps opponents 3m from a stationary ball at centre, boards and rounded corners',()=>{
    for(const [x,y] of [[500,250],[0,250],[1000,250],[500,0],[500,500],[0,0],[1000,0],[0,500],[1000,500]]) {
      const g=game();g.state.period=period;g.restartFreeHit(team,x,y);
      const point={x:g.ball.x,y:g.ball.y},taker=g.ball.owner,time=g.state.timeRemaining;
      const opponent=g.players.find(p=>p.team!==team&&p.role!=='GK');
      opponent.x=point.x;opponent.y=point.y;opponent.vx=10;
      g.keys.ArrowRight=true;g.update(1/60);
      for(const p of g.players.filter(p=>p.team!==team&&!g.playerUnavailable(p))) {
        assert.ok(Math.hypot(p.x-point.x,p.y-point.y)-p.radius>=3*g.METRE-1e-6);
      }
      g.attemptTakeBall(opponent);g.setBallOwner(opponent);
      assert.equal(g.ball.owner,taker);assert.equal(g.ball.x,point.x);assert.equal(g.ball.y,point.y);
      assert.equal(g.state.timeRemaining,time);assert.equal(taker.vx,0);
      if(team==='home') {
        advance(g,5);assert.equal(g.state.mode,'free_hit');
        g.startShootOrSteal();assert.equal(g.state.chargingShot,false);
        g.performPassOrSwitch();
      } else advance(g,1.15);
      assert.equal(g.state.mode,'match');assert.equal(g.state.freeHit,null);
      assert.ok(Math.hypot(g.ball.vx,g.ball.vy)>0);
    }
  });
}

test('free-hit taker can be substituted and the restart is cleared on a new match',()=>{
  const g=game();g.restartFreeHit('home',500,250);
  const out=g.ball.owner,incoming=g.squads.home.find(p=>!p.onPitch&&p.role!=='GK');
  assert.ok(g.substitute('home',out.id,incoming.id));
  assert.equal(g.state.freeHit.taker,incoming);assert.equal(g.ball.owner,incoming);
  g.performPassOrSwitch();assert.equal(g.state.mode,'match');
  g.restartFreeHit('home',500,250);g.newMatch();assert.equal(g.state.freeHit,null);
});

for (const team of ['home','away']) {
  test(team+': an indirect taker cannot collect their own pass after the cooldown or a board rebound',()=>{
    const g=game();g.restartFreeHit(team,500,250);const taker=g.ball.owner;
    const mate=g.players.find(p=>p.team===team&&p!==taker&&p.role!=='GK');
    if(team==='home')g.performPassOrSwitch();else g.execAIPass(taker,mate);
    assert.equal(g.state.indirectTaker,taker);
    g.players.forEach(p=>{if(p!==taker){p.x=100;p.y=100;}});
    taker.stealCooldown=0;g.ball.owner=null;g.ball.x=taker.x;g.ball.y=taker.y;
    g.ball.vx=g.ball.vy=g.ball.vz=g.ball.z=0;
    g.ball.reboundedReset=true; // A rebound or elapsed cooldown cannot unlock the taker.
    g.attemptTakeBall(taker);g.setBallOwner(taker);g.update(1/60);
    assert.equal(g.ball.owner,null);assert.equal(g.state.indirectTaker,taker);
    g.setBallOwner(mate);assert.equal(g.state.indirectTaker,null);
    g.setBallOwner(taker);assert.equal(g.ball.owner,taker);
  });
}

test('an indirect pass selects a teammate even when aiming away from every receiver',()=>{
  const g=game();g.restartFreeHit('home',500,250);const taker=g.ball.owner;
  for(const p of g.players.filter(p=>p.team==='home'&&p!==taker)){p.x=250;p.y=250;}
  g.keys.ArrowRight=true;g.performPassOrSwitch();
  assert.equal(g.state.mode,'match');assert.equal(g.ball.owner,null);
  assert.ok(g.ball.vx<0,'the restart goes towards a teammate instead of empty space');
  assert.notEqual(g.getControlledPlayer(),taker);
});

test('a goalkeeper touch releases the indirect taker and a new restart clears the restriction',()=>{
  const g=game();g.restartFreeHit('home',500,250);g.performPassOrSwitch();
  const keeper=g.players.find(p=>p.team==='away'&&p.role==='GK');
  g.ball.x=keeper.x;g.ball.y=keeper.y;g.ball.z=0;
  g.updateGoalkeeper(keeper,1/60);assert.equal(g.state.indirectTaker,null);
  g.restartFreeHit('home',500,250);g.performPassOrSwitch();g.newMatch();
  assert.equal(g.state.indirectTaker,null);
});

function neutralFixture(g,x=500,y=250) {
  g.state.mode='match';g.ball.owner=null;g.ball.x=x;g.ball.y=y;
  g.ball.z=g.ball.vx=g.ball.vy=g.ball.vz=0;
}

for(const period of [1,2]) for(const team of ['home','away']) {
  test(team+' period '+period+': trapped goalkeeper ball automatically leads to a neutral corner restart',()=>{
    const g=game();g.state.period=period;g.resetPositions('match',team);
    const keeper=g.players.find(p=>p.team===team&&p.role==='GK');
    neutralFixture(g,keeper.x,keeper.y);g.update(1/60);
    assert.equal(g.state.mode,'whistle_pause');assert.equal(g.ball.owner,null);
    const time=g.state.timeRemaining,penalties=g.state.exclusions[team];
    advance(g,1.25);assert.equal(g.state.mode,'booling');
    const b=g.state.booling;
    assert.equal(b.reason,'pads');assert.equal(g.state.timeRemaining,time);
    assert.equal(b.x,g.ownGoalX(team)+g.attackDirection(team)*g.RINK.areaDepth);
    assert.equal(Math.abs(b.y-250),g.RINK.areaWidth/2);
    assert.equal(g.state.exclusions[team],penalties);
    for(const side of ['home','away']) {
      const p=b.takers[side];assert.equal(p.team,side);assert.notEqual(p.role,'GK');
      assert.ok(!g.playerUnavailable(p));
      assert.ok(Math.abs(Math.abs(p.x-b.x)-15.5-0.2*g.METRE)<1e-8);
      assert.equal(Math.cos(p.dir),g.attackDirection(side));
    }
    for(const p of g.players.filter(p=>p!==b.takers[p.team]&&!g.playerUnavailable(p)))
      assert.ok(Math.hypot(p.x-b.x,p.y-b.y)-p.radius>=3*g.METRE-1e-6);
    g.performPassOrSwitch();g.startShootOrSteal();g.attemptTakeBall(b.takers.home);
    g.setBallOwner(b.takers.away);g.keys.ArrowRight=true;
    const positions=g.players.map(p=>[p.x,p.y]);advance(g,0.5);
    assert.equal(g.ball.owner,null);assert.equal(g.state.chargingShot,false);
    assert.deepEqual(g.players.map(p=>[p.x,p.y]),positions);
    g.setPaused(true);g.update(10);assert.equal(g.state.mode,'booling');g.setPaused(false);
    g.keys.ArrowRight=false;advance(g,1.3);
    assert.equal(g.state.mode,'match');assert.equal(g.ball.owner,null);
    assert.equal(g.state.booling.phase,'live');assert.equal(g.state.neutralPossession,true);
    g.attemptTakeBall(b.takers.home);
    assert.equal(g.ball.owner,b.takers.home,'human can win with a timed stick action');
    assert.equal(g.state.booling,null);assert.equal(g.state.neutralPossession,false);
    assert.equal(g.state.possessionTeam,'home');assert.equal(g.state.possessionClock,45);
  });
}

test('AI can win the neutral contest when the human does not react',()=>{
  const g=game();neutralFixture(g);g.callBooling('unknown');advance(g,3.85);
  assert.equal(g.ball.owner?.team,'away');assert.equal(g.state.neutralPossession,false);
  assert.equal(g.state.booling,null);
});

test('a moving loose ball, open-court stationary ball and normal goalkeeper rebound do not cause booling',()=>{
  const g=game();neutralFixture(g);assert.equal(g.checkNeutralStoppage(),false);
  const keeper=g.players[0];g.ball.x=keeper.x;g.ball.y=keeper.y;g.ball.vx=5;
  g.updateGoalkeeper(keeper,1/60);assert.equal(g.state.mode,'match');
  assert.equal(g.state.pendingRestart,null);assert.ok(Math.hypot(g.ball.vx,g.ball.vy)>0);
});

test('retention on either exterior goal and the virtual ceiling trigger automatic booling at the right spot',()=>{
  for(const gx of [67.5,932.5]) {
    const g=game(),sign=gx<500?1:-1;
    neutralFixture(g,gx-sign*g.RINK.goalDepth*1.04,250);g.update(1/60);
    assert.equal(g.state.mode,'whistle_pause');advance(g,1.25);
    assert.equal(g.state.booling.reason,'net');assert.equal(g.state.booling.x,gx+sign*g.RINK.areaDepth);
  }
  const g=game();neutralFixture(g,600,100);g.ball.z=8*g.METRE;g.update(1/60);advance(g,1.25);
  assert.equal(g.state.booling.reason,'ceiling');assert.equal(g.ball.x,500);assert.equal(g.ball.y,250);
});

test('two real opposing stick lunges with a frontal collision trigger simultaneous equal fouls',()=>{
  const g=game();neutralFixture(g);const home=g.players[4],away=g.players[9];
  home.x=488;away.x=512;home.y=away.y=250;home.vx=1.8;away.vx=-1.8;
  home.pokeTimer=away.pokeTimer=0.34;home.stealCooldown=away.stealCooldown=1;
  g.update(1/60);
  assert.equal(g.state.mode,'whistle_pause');assert.equal(g.state.fouls.home,1);assert.equal(g.state.fouls.away,1);
  advance(g,1.25);assert.equal(g.state.booling.reason,'simultaneous');
});

test('equal fouls preserve direct-hit accumulation precedence, including cancellation of two directs',()=>{
  for(const [h,a,mode,team] of [[9,0,'direct_foul','away'],[0,9,'direct_foul','home'],[9,9,'booling',null],[0,0,'booling',null]]) {
    const g=game();neutralFixture(g);g.state.fouls.home=h;g.state.fouls.away=a;
    assert.equal(g.registerSimultaneousFouls(g.players[4],g.players[9]),true);advance(g,2.1);
    assert.equal(g.state.mode,mode);
    if(team)assert.equal(g.state.possessionTeam,team);
    assert.equal(g.state.fouls.home,h+1);assert.equal(g.state.fouls.away,a+1);
  }
});

test('booling excludes suspended players, supports replacing a taker, and clears on reset and halftime',()=>{
  const g=game();neutralFixture(g);g.players[4].suspensionRemaining=120;
  g.callBooling('unknown');advance(g,1.25);
  const out=g.state.booling.takers.home;assert.notEqual(out,g.players[4]);
  g.setPaused(true);const incoming=g.squads.home.find(p=>!p.onPitch&&p.role!=='GK');
  assert.ok(g.substitute('home',out.id,incoming.id));assert.equal(g.state.booling.takers.home,incoming);
  g.newMatch();assert.equal(g.state.booling,null);assert.equal(g.state.neutralPossession,false);
  neutralFixture(g);g.callBooling('unknown');advance(g,1.25);g.endPeriod();
  assert.equal(g.state.booling,null);assert.equal(g.state.pendingRestart,null);
});

test('ordinary booling points fit both participants and maintain 3m clearance at every boundary',()=>{
  for(const [x,y] of [[0,0],[1000,0],[0,500],[1000,500],[0,250],[1000,250],[500,0],[500,500]]) {
    const g=game();neutralFixture(g,x,y);g.callBooling('unknown');advance(g,1.25);
    const b=g.state.booling;
    for(const p of g.players.filter(p=>!g.playerUnavailable(p))) {
      assert.ok(p.x>=p.radius&&p.x<=1000-p.radius);assert.ok(p.y>=p.radius&&p.y<=500-p.radius);
      if(p!==b.takers[p.team])assert.ok(Math.hypot(p.x-b.x,p.y-b.y)-p.radius>=75-1e-6);
    }
  }
});

for(const type of ['penalty','direct_foul']) for(const team of ['home','away']) for(const period of [1,2]) {
  test(type+' '+team+' period '+period+': whistle releases shooter, goalkeeper, waiting players and match clock together',()=>{
    const g=game();g.state.period=period;g.resetPositions(type,team);
    const shooter=g.state.directShooter,time=g.state.timeRemaining;
    const snapshot=g.players.map(p=>({x:p.x,y:p.y}));
    g.keys.ArrowRight=true;g.startShootOrSteal();g.releaseShot();
    assert.equal(g.state.chargingShot,false);assert.equal(g.ball.owner,shooter);
    g.onGoal(team);assert.equal(g.state.score[team],0);
    advance(g,1.5);
    assert.equal(g.state.setPieceReady,false);assert.equal(g.state.timeRemaining,time);
    g.players.forEach((p,i)=>{assert.equal(p.x,snapshot[i].x);assert.equal(p.y,snapshot[i].y);});
    g.setPaused(true);g.update(5);assert.equal(g.state.setPieceReady,false);g.setPaused(false);
    advance(g,0.35);assert.equal(g.state.setPieceReady,true);
    assert.ok(g.state.timeRemaining<time);assert.equal(g.ball.owner,shooter,'release does not require a shot');
    const runners=g.players.filter(p=>p.role!=='GK'&&p!==shooter);
    assert.ok(runners.some(p=>Math.hypot(p.vx,p.vy)>0),'waiting players already skate before the shot');
    if(team==='home') {
      g.keys.ArrowRight=true;const x=shooter.x;advance(g,0.3);assert.notEqual(shooter.x,x);
      g.startShootOrSteal();assert.equal(g.state.chargingShot,true);g.releaseShot();
      assert.equal(g.state.shots.home,1);
    } else {advance(g,1.25);assert.equal(g.state.shots.away,1);}
  });
}


test('a retained goalkeeper save on a final set piece ends the period instead of scheduling a booling',()=>{
  const g=game();g.state.timeRemaining=2;g.resetPositions('penalty','home');advance(g,1.85);
  const keeper=g.players.find(p=>p.team==='away'&&p.role==='GK');
  Object.assign(g.ball,{owner:null,x:keeper.x,y:keeper.y,z:0,vx:0,vy:0,vz:0});
  g.updateGoalkeeper(keeper,1/60);
  assert.equal(g.state.mode,'halftime');assert.equal(g.state.pendingRestart,null);
  assert.equal(g.state.booling,null);
});

test('visual interpolation blends snapshots without changing physics and turns across the shortest angle',()=>{
  const g=game(),p=g.getControlledPlayer();p.dir=Math.PI-0.1;
  const x=p.x,y=p.y;g.captureRenderPoses();p.x+=8;p.y+=4;p.dir=-Math.PI+0.1;
  const pose=g.interpolatedPose(p,0.25);
  assert.equal(pose.x,x+2);assert.equal(pose.y,y+1);
  assert.ok(Math.abs(pose.dir-(Math.PI-0.05))<1e-8);
  assert.equal(p.x,x+8);assert.equal(p.y,y+4);
  const paused=g.interpolatedPose(p,1);assert.equal(paused.x,p.x);assert.equal(paused.y,p.y);
});

test('visual interpolation snaps large restart/substitution relocations and interpolates ball height',()=>{
  const g=game(),p=g.getControlledPlayer();g.captureRenderPoses();p.x+=100;
  assert.equal(g.interpolatedPose(p,0.1).x,p.x);
  g.ball.z=0;g.captureRenderPoses();g.ball.z=4;
  assert.equal(g.interpolatedPose(g.ball,0.5).z,2);
});


test('goalkeeper posture blending is continuous, pause-safe and independent of 30/60/144 FPS',()=>{
  const g=game(),endpoints=[];
  for(const fps of [30,60,144]) {
    const current=JSON.parse(JSON.stringify(g.goalkeeperPose('screen'))),target=g.goalkeeperPose('valla');
    const before=JSON.stringify(current);g.blendGoalkeeperPose(current,target,0);assert.equal(JSON.stringify(current),before);
    g.blendGoalkeeperPose(current,target,1/fps);
    assert.ok(current.hip>target.hip&&current.hip<g.goalkeeperPose('screen').hip);
    for(let i=1;i<fps;i++)g.blendGoalkeeperPose(current,target,1/fps);
    endpoints.push(current);
  }
  for(const current of endpoints.slice(1)) {
    assert.ok(Math.abs(current.hip-endpoints[0].hip)<1e-9);
    assert.ok(Math.abs(current.pads[1]-endpoints[0].pads[1])<1e-9);
  }
});

test('cycling goalkeeper saves returns every joint parameter to its ready posture',()=>{
  const g=game(),current=JSON.parse(JSON.stringify(g.goalkeeperPose('screen')));
  for(const posture of ['valla','knee','out','screen'])for(let i=0;i<120;i++)g.blendGoalkeeperPose(current,g.goalkeeperPose(posture),1/60);
  const ready=g.goalkeeperPose('screen');
  assert.ok(Math.abs(current.hip-ready.hip)<1e-7);
  for(const key of ['feet','pads','tilt','glove','grip'])for(let i=0;i<ready[key].length;i++)assert.ok(Math.abs(current[key][i]-ready[key][i])<1e-7);
});

for(const team of ['home','away'])for(const distance of [80,300,650]) {
  test(team+' pass at '+distance+' units reaches the intended teammate before losing its speed',()=>{
    const g=game(),{passer,receiver}=g.isolatePass(team,distance);
    assert.ok(g.beginPass(passer,receiver));const speed=Math.hypot(g.ball.vx,g.ball.vy);
    let frames=0;while(!g.ball.owner&&frames++<240)g.update(1/60);
    assert.equal(g.ball.owner,receiver);assert.equal(g.state.passBlockedPlayer,null);
    assert.equal(g.state.passFlight,null);assert.ok(frames<180);
    assert.ok(speed>g.skatingSpeed(passer));
  });
}

test('a moving human-controlled receiver can turn across the incoming pass and still control it',()=>{
  const g=game(),{receiver}=g.isolatePass('home',500);
  g.performPassOrSwitch();assert.equal(g.getControlledPlayer(),receiver);
  g.keys.ArrowDown=true;
  let frames=0;while(!g.ball.owner&&frames++<240){if(frames===30){g.keys.ArrowDown=false;g.keys.ArrowUp=true;}g.update(1/60);}
  assert.equal(g.ball.owner,receiver);assert.ok(frames<180);
});

test('every human pass targets an eligible teammate even when there is nobody in the aimed sector',()=>{
  const g=game(),{passer,receiver}=g.isolatePass('home',300);passer.dir=Math.PI;
  g.performPassOrSwitch();assert.equal(g.state.passFlight.receiver,receiver);
  assert.ok(g.ball.vx>0);assert.equal(g.getControlledPlayer(),receiver);
});

test('the passer cannot retake their pass by waiting, tackling or automatic pickup',()=>{
  const g=game(),{passer,receiver}=g.isolatePass('home',500);g.performPassOrSwitch();
  // Deliberately cancel assistance and leave the ball at the passer after the old cooldown.
  g.state.passFlight=null;passer.stealCooldown=0;
  Object.assign(g.ball,{owner:null,x:passer.x,y:passer.y,vx:0,vy:0,z:0,vz:0});
  g.setBallOwner(passer);g.attemptTakeBall(passer);g.update(1/60);
  assert.equal(g.ball.owner,null);assert.equal(g.state.passBlockedPlayer,passer);
  g.setBallOwner(receiver);assert.equal(g.state.passBlockedPlayer,null);
  g.setBallOwner(passer);assert.equal(g.ball.owner,passer);
});

test('a real opponent in the passing lane intercepts before the assisted receiver',()=>{
  const g=game(),{passer,receiver}=g.isolatePass('home',400),opponent=g.players[7];
  opponent.onPitch=true;opponent.x=400;opponent.y=250;opponent.vx=opponent.vy=0;opponent.stealCooldown=0;
  g.beginPass(passer,receiver);
  Object.assign(g.ball,{x:opponent.x,y:opponent.y,vx:6,vy:0});
  receiver.x=opponent.x+22; // Inside the assisted reception radius, but further than the defender.
  assert.ok(g.receivePass());assert.equal(g.ball.owner,opponent);
  assert.equal(g.state.passBlockedPlayer,null);assert.equal(g.state.passFlight,null);
});

test('keeper contact, unavailable receiver, new match and a whistle cannot leave a guided ghost pass',()=>{
  const g=game(),{passer,receiver}=g.isolatePass('home',400);g.beginPass(passer,receiver);
  const keeper=g.players[5];keeper.onPitch=true;
  g.ball.x=keeper.x;g.ball.y=keeper.y;g.ball.vx=5;g.ball.vy=0;g.updateGoalkeeper(keeper,1/60);
  assert.equal(g.state.passFlight,null);assert.equal(g.state.passBlockedPlayer,null);
  g.beginPass(passer,receiver);receiver.onPitch=false;g.updatePassFlight(1/60);
  assert.equal(g.state.passFlight,null);assert.equal(g.state.passBlockedPlayer,passer);
  g.newMatch();assert.equal(g.state.passBlockedPlayer,null);assert.equal(g.state.passFlight,null);
  g.state.mode='match';g.beginPass(g.players[4],g.players[1]);g.registerFoul('away');
  assert.equal(g.state.mode,'whistle_pause');assert.equal(g.state.passFlight,null);
  g.update(2.3);assert.equal(g.state.passBlockedPlayer,null);
});

test('directed reception does not reset the possession clock for a same-team pass',()=>{
  const g=game(),{passer,receiver}=g.isolatePass('home',300);g.state.possessionClock=20;
  g.beginPass(passer,receiver);
  let frames=0;while(!g.ball.owner&&frames++<180)g.update(1/60);
  assert.equal(g.ball.owner,receiver);assert.ok(g.state.possessionClock<20);assert.ok(g.state.possessionClock>15);
});

function turnoverFixture(g,period=1) {
  g.state.period=period;g.state.mode='match';g.state.possessionTeam='home';
  const mirror=x=>period===1?x:1000-x;
  const attacker=g.players[4],defender=g.players[1],opponent=g.players[6];
  attacker.x=mirror(850);attacker.y=250;attacker.vx=g.attackDirection('home')*2;attacker.vy=0;
  defender.x=mirror(700);defender.y=250;defender.vx=defender.vy=0;
  g.players[2].x=mirror(400);g.players[2].y=135;
  g.players[3].x=mirror(550);g.players[3].y=365;
  opponent.x=mirror(830);opponent.y=250;opponent.vx=opponent.vy=0;
  g.ball.x=opponent.x;g.ball.y=250;g.ball.owner=attacker;g.state.controlledIdx=4;
  return {attacker,defender,opponent};
}

for(const period of [1,2]) {
  test('period '+period+': losing the ball selects the goal-side defender and the abandoned attacker really skates back',()=>{
    const g=game(),{attacker,defender,opponent}=turnoverFixture(g,period),sign=g.attackDirection('home');
    g.setBallOwner(opponent);
    assert.equal(g.getControlledPlayer(),defender);assert.equal(attacker.isRetreating,true);
    assert.equal(defender.isRetreating,false);
    const x=attacker.x;
    attacker.retreatTimer=0; // Recovery must not stop just because the old 3.6s timer expired.
    for(let i=0;i<90;i++){g.updateAISkater(attacker,1/60);attacker.x+=attacker.vx;attacker.y+=attacker.vy;}
    assert.ok((attacker.x-x)*sign<-90);assert.ok(attacker.vx*sign<0);
    assert.ok((attacker.x-g.ownGoalX('home'))*sign<700,'the attacker has left the opposing goal area');
  });
}

test('an intercepted pass triggers defensive selection even though the ball had no owner in flight',()=>{
  const g=game(),{attacker,defender,opponent}=turnoverFixture(g);
  g.players[3].x=750;g.players[3].y=350;
  g.beginPass(attacker,g.players[3]);g.ball.x=830;g.ball.y=250;
  assert.equal(g.ball.owner,null);g.setBallOwner(opponent);
  assert.equal(g.getControlledPlayer(),defender);assert.equal(attacker.isRetreating,true);
  assert.equal(g.players[3].isRetreating,true);
});

test('manual changes follow the preview and repeated Q cycles available players instead of bouncing between two',()=>{
  const g=game(),{opponent}=turnoverFixture(g);g.setBallOwner(opponent);
  const selected=new Set([g.getControlledPlayer().id]);
  for(let i=0;i<3;i++) {
    const preview=g.nextSwitchPlayer(true);g.switchToNextPlayer();
    assert.equal(g.getControlledPlayer(),preview);assert.ok(!selected.has(preview.id));selected.add(preview.id);
  }
  assert.equal(selected.size,4);
});

test('defending control remains stable through enemy passes and recovery ends when home wins the ball',()=>{
  const g=game(),{defender,opponent}=turnoverFixture(g);g.setBallOwner(opponent);
  g.switchToNextPlayer();const chosen=g.getControlledPlayer();
  g.setBallOwner(g.players[7]);g.setBallOwner(g.players[8]);assert.equal(g.getControlledPlayer(),chosen);
  g.setBallOwner(defender);assert.equal(g.getControlledPlayer(),defender);
  assert.ok(g.activePlayers('home').every(p=>!p.isRetreating));
});

test('switch keeps the ball carrier and the intended pass receiver in attack',()=>{
  const g=game(),{passer,receiver}=g.isolatePass('home',400);
  g.switchToNextPlayer();assert.equal(g.getControlledPlayer(),passer);
  g.performPassOrSwitch();g.switchToNextPlayer();assert.equal(g.getControlledPlayer(),receiver);
  g.performPassOrSwitch();assert.equal(g.getControlledPlayer(),receiver);assert.equal(g.ball.owner,null);
});

test('switch never picks unavailable players, goalkeepers or the locked passer',()=>{
  const g=game(),{opponent}=turnoverFixture(g);g.setBallOwner(opponent);
  g.players[2].suspensionRemaining=10;g.state.passBlockedPlayer=g.players[3];
  const candidate=g.nextSwitchPlayer(true);
  assert.equal(candidate,g.players[4]);
  g.switchToNextPlayer();assert.equal(g.getControlledPlayer(),g.players[4]);
});

test('manual handoff clears a charged shot and returns an advanced outgoing player to defensive AI',()=>{
  const g=game(),{attacker,opponent}=turnoverFixture(g);
  g.state.possessionTeam='away';g.ball.owner=opponent;g.state.chargingShot=true;g.state.shotCharge=0.8;
  const target=g.nextSwitchPlayer(true);g.switchToNextPlayer();
  assert.equal(g.getControlledPlayer(),target);assert.equal(attacker.isRetreating,true);
  assert.equal(g.state.chargingShot,false);assert.equal(g.state.shotCharge,0);
  g.setPaused(true);const remaining=g.state.switchWindow;g.update(5);assert.equal(g.state.switchWindow,remaining);
  g.newMatch();assert.equal(g.state.switchWindow,0);assert.equal(g.state.switchVisited.length,0);
});

test('shots have clear power progression and remain faster than a pass at every skating pace',()=>{
  const g=game(),p=g.players[4];
  for(const pace of [0.48,0.62,0.76]){
    g.state.paceFactor=pace;
    const tap=g.shotProfile(p,0.15,'pala'),charged=g.shotProfile(p,0.75,'pala');
    assert.ok(tap.speed>10);assert.ok(charged.speed>16);assert.ok(charged.speed>tap.speed*1.4);
    assert.equal(charged.speed,g.shotProfile(p,0.75,'cullera').speed);
    assert.ok(g.shotProfile(p,1,'cullera').lift**2/0.3+2.2<g.RINK.goalHeight);
  }
});

test('one shoot control automatically selects both gestures on opposite flanks in either half',()=>{
  for(const period of [1,2])for(const y of [120,380]){
    const g=game();g.isolatePass();const p=g.players[4];g.state.period=period;
    p.x=period===1?700:300;p.y=y;p.dir=period===1?0:Math.PI;
    g.ball.x=p.x+Math.cos(p.dir)*15.5;g.ball.y=p.y;
    g.startShootOrSteal();const gesture=g.state.shotGesture;
    assert.equal(gesture,((y<250)===(period===1))?'pala':'cullera');
    g.state.shotCharge=0.75;g.releaseShot();
    assert.equal(p.visualAction.gesture,gesture);assert.equal(g.state.shots.home,1);
    assert.ok(g.ball.vx*g.attackDirection('home')>0);
    assert.ok(Math.hypot(g.ball.vx,g.ball.vy)>16);
    g.releaseShot();assert.equal(g.state.shots.home,1);
  }
});

test('gesture stays stable through a held key and dribble jitter; body-local ball side takes priority',()=>{
  const g=game();g.isolatePass();const p=g.players[4];p.y=380;g.ball.x=p.x+15.5;g.ball.y=p.y;
  g.startShootOrSteal();assert.equal(g.state.shotGesture,'cullera');
  g.state.shotCharge=0.7;p.y=120;g.ball.y=p.y+3.4;g.startShootOrSteal();
  assert.equal(g.state.shotGesture,'cullera');assert.equal(g.state.shotCharge,0.7);
  g.releaseShot();assert.equal(p.visualAction.gesture,'cullera');
  g.setBallOwner(p);p.dir=0;g.ball.x=p.x+12;g.ball.y=p.y-8;
  assert.equal(g.chooseShotGesture(p,0.4),'cullera');
});

test('shared AI shot launch uses the same power, gesture, forward release and single counter',()=>{
  for(const team of ['home','away'])for(const period of [1,2]){
    const g=game(),p=g.players[team==='home'?4:9];g.state.period=period;
    g.state.mode='match';g.setBallOwner(p);p.dir=g.attackDirection(team)>0?0:Math.PI;
    const angle=p.dir;g.launchShot(p,angle,0.78);
    assert.ok(Math.hypot(g.ball.vx,g.ball.vy)>16);assert.equal(g.state.shots[team],1);
    assert.equal(g.ball.owner,null);assert.equal(g.ball.shotByTeam,team);assert.equal(g.ball.z,0);
    assert.ok(g.ball.vx*g.attackDirection(team)>0);assert.ok(['pala','cullera'].includes(p.visualAction.gesture));
  }
});

test('powerful shots from both flanks traverse ten metres and score through live physics without tunnelling',()=>{
  for(const y of [125,375]){
    const g=game();g.isolatePass();const p=g.players[4];g.players[1].onPitch=false;
    p.x=g.opponentGoalX('home')-250;p.y=y;p.dir=0;g.ball.x=p.x+15.5;g.ball.y=y;
    g.startShootOrSteal();g.state.shotCharge=0.75;g.releaseShot();advance(g,0.55);
    assert.equal(g.state.score.home,1);assert.equal(g.state.shots.home,1);
  }
});

test('a goalkeeper in the shooting lane still saves powerful shots of either gesture',()=>{
  for(const gesture of ['pala','cullera']){
    const g=game();g.isolatePass();const p=g.players[4],keeper=g.players[5];
    g.players[1].onPitch=false;keeper.onPitch=true;keeper.x=g.opponentGoalX('home')-14;keeper.y=250;
    keeper.gkReactionDelay=0;p.x=keeper.x-240;p.y=250;
    g.launchShot(p,0,0.75,gesture);advance(g,0.55);
    assert.equal(g.state.score.home,0);assert.equal(g.ball.reboundedReset,true);
  }
});
