/* Distàncies i imports aproximats per a l'economia del joc, no tarifes reals.
   Coordenades de referència dels clubs; no depenen de noms editats o de l'idioma. */
const TRAVEL_LOCATIONS={"FPTC":[40.6,-3.71],"FPLR":[40.49,-3.87],"FPMI":[43.25,-5.77],"FPTV":[42.23,-8.72],"FPRS":[38.4,-0.53],"FPBE":[42.88,-8.55],"FPAC":[40.35,-3.83],"FPALC":[40.48,-3.36],"FPCV":[40.41,-3.88],"FPCO":[40.42,-3.56],"FPPO":[42.17,-8.5],"FPOV":[43.36,-5.85],"FPGI":[43.36,-2.87],"FPST":[43.25,-2.92],"BAR":[41.39,2.17],"IGU":[41.58,1.62],"LIC":[43.36,-8.41],"REU":[41.15,1.11],"CAL":[41.2,1.57],"NOI":[41.42,1.79],"LLE":[41.62,0.62],"VOL":[42.02,2.24],"CLD":[41.63,2.16],"LLO":[41.7,2.85],"ALC":[38.7,-0.47],"RIV":[40.33,-3.52],"VIL":[41.35,1.7],"MAC":[41.78,2.73],"PGEG":[41.98,2.82],"PRCJ":[43.35,-3.01],"PACO":[42.43,-8.64],"POVR":[43.36,-5.85],"PLUB":[43.21,-8.69],"PBAR":[41.39,2.17],"PDOM":[43.36,-8.41],"PCPT":[41.7,2.72],"PREU":[41.15,1.11],"PCDM":[43.36,-8.41],"PCON":[41.39,2.17],"PCHO":[42.18,2.49],"PCHV":[41.11,1.15],"PPSC":[41.47,2.08],"PPAL":[41.92,3.16],"PSHA":[38.7,-0.47],"PNOI":[41.42,1.79],"PIGU":[41.58,1.62],"PESP":[41.39,2.17],"PVIL":[41.22,1.73],"PMOL":[41.63,0.89],"PMAT":[41.54,2.44],"PVIC":[41.93,2.25],"PSJU":[41.38,2.08],"PALB":[40.54,-3.64],"PCER":[41.49,2.14],"PMAN":[42,2.28],"PVEN":[41.22,1.53],"FCP":[41.15,-8.61],"SLB":[38.72,-9.14],"SCP":[38.72,-9.14],"FOL":[42.92,10.76],"NOV":[45.45,8.62],"VIA":[43.87,10.26],"SOM":[50.75,2.25],"UDO":[40.84,-8.48],"OCB":[41.54,-8.62],"TRI":[45.56,11.38],"SAR":[44.11,9.96],"GRO":[42.76,11.11],"FPAL":[41.59,2.18],"FVOL":[42.02,2.24],"FMAR":[43.36,-8.41],"FTEL":[43.54,-5.66],"FMAT":[41.54,2.44],"FFRA":[41.52,0.35],"FPSC":[41.47,2.08],"FALP":[41.67,0.56],"FBEM":[42.62,-6.41],"FIVA":[41.66,0.93],"FCER":[41.49,2.14],"FMAN":[42,2.28],"FBIG":[41.68,2.21],"FRAX":[42.88,-8.55],"VBAR":[41.54,-8.62],"VFSLB":[38.72,-9.14],"VFSCP":[38.72,-9.14],"VFITA":[45.45,8.62],"VFFRA":[50.75,2.25]};
function travelEstimate(from,to,playerCount=12,reputation=3){
  const a=TRAVEL_LOCATIONS[from],b=TRAVEL_LOCATIONS[to];
  let km=350;
  if(a&&b){const rad=Math.PI/180,dlat=(b[0]-a[0])*rad,dlon=(b[1]-a[1])*rad;
    const h=Math.sin(dlat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlon/2)**2;
    km=Math.round(6371*2*Math.asin(Math.sqrt(Math.min(1,h)))*1.2)}
  const people=Math.max(12,Math.min(16,playerCount+4));
  const scale=[.45,.55,.7,.9,1.05][Math.max(0,Math.min(4,Math.round(reputation)-1))];
  const flight=km>=900,nights=km>=450?1:0;
  const transportEuros=flight?people*145+180:80+km*2*.85;
  const mealsEuros=people*(nights?36:km>=150?18:6);
  const hotelEuros=people*nights*50;
  const k=x=>Math.round(x*scale)/1000;
  const transport=k(transportEuros),meals=k(mealsEuros),hotel=k(hotelEuros);
  return {km,people,flight,nights,transport,meals,hotel,total:Math.round((transport+meals+hotel)*1000)/1000,estimated:!a||!b};
}
