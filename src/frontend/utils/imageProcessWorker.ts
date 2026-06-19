import { AdjustmentState, CurvesState, PresetType } from './imageProcess';

let worker: Worker | null = null;
let currentGeneration = 0;
const pending = new Map<number, {
  resolve: (result: Uint8ClampedArray | null) => void;
  generation: number;
}>();

const WORKER_SOURCE = /* js */`
function hslToRgb(h,s,l){h/=360;var r=l,g=l,b=l;if(s!==0){var q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q,hr=function(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<0.5)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};r=hr(p,q,h+1/3);g=hr(p,q,h);b=hr(p,q,h-1/3);}return[Math.round(r*255),Math.round(g*255),Math.round(b*255)];}
function calcLUT(pts){var lut=new Uint8Array(256),s=pts.slice().sort(function(a,b){return a.x-b.x;});if(!s.length){for(var i=0;i<256;i++)lut[i]=i;return lut;}if(s[0].x>0)s.unshift({x:0,y:s[0].y});if(s[s.length-1].x<1)s.push({x:1,y:s[s.length-1].y});var n=s.length,x=s.map(function(p){return p.x;}),y=s.map(function(p){return p.y;}),h=[],m=[];for(var i=0;i<n-1;i++){h[i]=x[i+1]-x[i];m[i]=(y[i+1]-y[i])/h[i];}var d=[m[0]];for(var i=1;i<n-1;i++)d.push((m[i-1]+m[i])/2);d.push(m[n-2]);for(var i=0;i<n-1;i++){if(m[i]===0){d[i]=0;d[i+1]=0;}else{var a=d[i]/m[i],be=d[i+1]/m[i],tau=Math.sqrt(a*a+be*be);if(tau>3){d[i]=(3/tau)*a*m[i];d[i+1]=(3/tau)*be*m[i];}}}for(var i=0;i<256;i++){var v=i/255,idx=0;while(idx<n-2&&v>x[idx+1])idx++;var t=(v-x[idx])/h[idx],res=(2*t*t*t-3*t*t+1)*y[idx]+(t*t*t-2*t*t+t)*h[idx]*d[idx]+(-2*t*t*t+3*t*t)*y[idx+1]+(t*t*t-t*t)*h[idx]*d[idx+1];lut[i]=Math.max(0,Math.min(255,Math.round(res*255)));}return lut;}
function bH(s,d,w,h,r){var f=1/(r+r+1);for(var i=0;i<h;i++){var ti=i*w,li=ti,ri=ti+r,fv=s[ti],lv=s[ti+w-1],val=(r+1)*fv;for(var j=0;j<r;j++)val+=s[ti+j];for(var j=0;j<=r;j++){val+=s[ri++]-fv;d[ti++]=val*f;}for(var j=r+1;j<w-r;j++){val+=s[ri++]-s[li++];d[ti++]=val*f;}for(var j=w-r;j<w;j++){val+=lv-s[li++];d[ti++]=val*f;}}}
function bT(s,d,w,h,r){var f=1/(r+r+1);for(var i=0;i<w;i++){var ti=i,li=ti,ri=ti+r*w,fv=s[ti],lv=s[ti+(h-1)*w],val=(r+1)*fv;for(var j=0;j<r;j++)val+=s[ti+j*w];for(var j=0;j<=r;j++){val+=s[ri]-fv;d[ti]=val*f;ri+=w;ti+=w;}for(var j=r+1;j<h-r;j++){val+=s[ri]-s[li];d[ti]=val*f;li+=w;ri+=w;ti+=w;}for(var j=h-r;j<h;j++){val+=lv-s[li];d[ti]=val*f;li+=w;ti+=w;}}}
function boxBlur(src,w,h,r){var dest=new Uint8ClampedArray(src.length),sz=w*h;for(var c=0;c<3;c++){var t1=new Uint8ClampedArray(sz),t2=new Uint8ClampedArray(sz);for(var i=0;i<sz;i++)t1[i]=src[i*4+c];bH(t1,t2,w,h,r);bT(t2,t1,w,h,r);bH(t1,t2,w,h,r);for(var i=0;i<sz;i++)dest[i*4+c]=t2[i];}for(var i=0;i<sz;i++)dest[i*4+3]=src[i*4+3];return dest;}
function exHL(src,w,h,thr){var dest=new Uint8ClampedArray(src.length),lim=thr*255;for(var i=0;i<src.length;i+=4){var r=src[i],g=src[i+1],b=src[i+2],l=0.299*r+0.587*g+0.114*b;if(l>lim){dest[i]=r;dest[i+1]=g;dest[i+2]=b;}else{dest[i]=0;dest[i+1]=0;dest[i+2]=0;}dest[i+3]=src[i+3];}return dest;}

function processPixels(src,w,h,adj,curves,preset,mask){
  var dest=new Uint8ClampedArray(src.length);
  var lRGB=calcLUT(curves.rgb),lR=calcLUT(curves.red),lG=calcLUT(curves.green),lB=calcLUT(curves.blue);
  var exp=Math.pow(2,adj.exposure),con=adj.contrast,sat=adj.saturation,hi=adj.highlights,sh=adj.shadows;
  var temp=adj.temperature||0,tintV=adj.tint||0,grI=adj.grainIntensity||0,grS=adj.grainSize||1;
  var vig=adj.vignetteIntensity||0,chr=adj.chromaticAberration||0,shp=adj.sharpening||0,den=adj.denoise||0,cla=adj.clarity||0,deh=adj.dehaze||0;
  var tSR=0,tSG=0,tSB=0,tMR=0,tMG=0,tMB=0,tHR=0,tHG=0,tHB=0;
  if(adj.colorGradingShadowsSat>0){var c=hslToRgb(adj.colorGradingShadowsHue,adj.colorGradingShadowsSat,0.5);tSR=(c[0]-128)*0.4;tSG=(c[1]-128)*0.4;tSB=(c[2]-128)*0.4;}
  if(adj.colorGradingMidtonesSat>0){var c=hslToRgb(adj.colorGradingMidtonesHue,adj.colorGradingMidtonesSat,0.5);tMR=(c[0]-128)*0.4;tMG=(c[1]-128)*0.4;tMB=(c[2]-128)*0.4;}
  if(adj.colorGradingHighlightsSat>0){var c=hslToRgb(adj.colorGradingHighlightsHue,adj.colorGradingHighlightsSat,0.5);tHR=(c[0]-128)*0.4;tHG=(c[1]-128)*0.4;tHB=(c[2]-128)*0.4;}
  var ctrs=[0,30,60,120,180,240,285,330,360];
  var hSh=[adj.hslHueRed||0,adj.hslHueOrange||0,adj.hslHueYellow||0,adj.hslHueGreen||0,adj.hslHueAqua||0,adj.hslHueBlue||0,adj.hslHuePurple||0,adj.hslHueMagenta||0,adj.hslHueRed||0];
  var sSh=[adj.hslSatRed||0,adj.hslSatOrange||0,adj.hslSatYellow||0,adj.hslSatGreen||0,adj.hslSatAqua||0,adj.hslSatBlue||0,adj.hslSatPurple||0,adj.hslSatMagenta||0,adj.hslSatRed||0];
  var lSh=[adj.hslLumRed||0,adj.hslLumOrange||0,adj.hslLumYellow||0,adj.hslLumGreen||0,adj.hslLumAqua||0,adj.hslLumBlue||0,adj.hslLumPurple||0,adj.hslLumMagenta||0,adj.hslLumRed||0];
  var hasHsl=hSh.some(function(v){return v!==0;})||sSh.some(function(v){return v!==0;})||lSh.some(function(v){return v!==0;});
  var bloom=null;
  if(adj.bloomIntensity>0&&adj.bloomRadius>0)bloom=boxBlur(exHL(src,w,h,adj.bloomThreshold),w,h,adj.bloomRadius);
  for(var i=0;i<src.length;i+=4){
    var xC=(i/4)%w,yC=Math.floor((i/4)/w),oR=src[i],oG=src[i+1],oB=src[i+2],oA=src[i+3];
    if(chr>0){var s2=Math.round(chr),rX=Math.max(0,Math.min(w-1,xC-s2)),bX=Math.max(0,Math.min(w-1,xC+s2));oR=src[(yC*w+rX)*4];oB=src[(yC*w+bX)*4+2];}
    if(shp>0||den>0){var lI=xC>0?i-4:i,rI=xC<w-1?i+4:i,tI=yC>0?i-w*4:i,bI=yC<h-1?i+w*4:i,lR2=src[lI],lG2=src[lI+1],lB2=src[lI+2],rR2=src[rI],rG2=src[rI+1],rB2=src[rI+2],tR2=src[tI],tG2=src[tI+1],tB2=src[tI+2],bR2=src[bI],bG2=src[bI+1],bB2=src[bI+2];if(shp>0){oR+=shp*0.4*(4*oR-lR2-rR2-tR2-bR2);oG+=shp*0.4*(4*oG-lG2-rG2-tG2-bG2);oB+=shp*0.4*(4*oB-lB2-rB2-tB2-bB2);}if(den>0){oR+=den*((lR2+rR2+tR2+bR2+4*oR)/8-oR);oG+=den*((lG2+rG2+tG2+bG2+4*oG)/8-oG);oB+=den*((lB2+rB2+tB2+bB2+4*oB)/8-oB);}}
    if(deh!==0){oR=(oR-127)*(1+deh*0.15)+127-deh*10;oG=(oG-127)*(1+deh*0.15)+127-deh*10;oB=(oB-127)*(1+deh*0.15)+127-deh*10;var dL=0.299*oR+0.587*oG+0.114*oB;oR=dL+(oR-dL)*(1+deh*0.2);oG=dL+(oG-dL)*(1+deh*0.2);oB=dL+(oB-dL)*(1+deh*0.2);}
    if(cla!==0){var cL=(0.299*oR+0.587*oG+0.114*oB)/255,wM=Math.sin(Math.PI*cL),cs=(cL-0.5)*cla*0.25*wM*255;oR+=cs;oG+=cs;oB+=cs;}
    var r=oR,g=oG,b=oB;
    if(preset==='mono'){var lV=0.299*r+0.587*g+0.114*b,cV=(lV/255-0.5)*1.6+0.5,fV=Math.max(0,Math.min(255,Math.round(cV*255)))*0.95;r=fV;g=fV;b=fV;}
    else if(preset==='matte'){var lV=(0.299*r+0.587*g+0.114*b)/255;lV=(lV-0.5)*0.75+0.5;if(lV<0.2)lV=lV*0.5+0.05;r=r*0.3+lV*255*0.7;g=g*0.3+lV*255*0.7;b=b*0.3+lV*255*0.7;}
    else if(preset==='brutalist'){r=Math.min(255,Math.max(0,(r-127)*1.3+127+15));g=Math.min(255,Math.max(0,(g-127)*1.3+127));b=Math.min(255,Math.max(0,(b-127)*1.3+127-15));}
    if(exp!==1){r*=exp;g*=exp;b*=exp;}
    if(con!==1){r=Math.max(0,Math.min(255,((r/255-0.5)*con+0.5)*255));g=Math.max(0,Math.min(255,((g/255-0.5)*con+0.5)*255));b=Math.max(0,Math.min(255,((b/255-0.5)*con+0.5)*255));}
    var lV=0.299*r+0.587*g+0.114*b;
    if(sat!==1){r=lV+(r-lV)*sat;g=lV+(g-lV)*sat;b=lV+(b-lV)*sat;lV=0.299*r+0.587*g+0.114*b;}
    var nL=lV/255;
    if(hi!==0){var wH=Math.pow(Math.max(0,Math.min(1,(nL-0.5)*2)),2);r+=r*hi*0.5*wH;g+=g*hi*0.5*wH;b+=b*hi*0.5*wH;}
    if(sh!==0){var wS=Math.pow(Math.max(0,Math.min(1,(0.5-nL)*2)),2);r+=r*sh*0.5*wS;g+=g*sh*0.5*wS;b+=b*sh*0.5*wS;}
    r=lRGB[Math.max(0,Math.min(255,Math.round(r)))];g=lRGB[Math.max(0,Math.min(255,Math.round(g)))];b=lRGB[Math.max(0,Math.min(255,Math.round(b)))];
    r=lR[r];g=lG[g];b=lB[b];
    if(temp!==0){r+=temp*25;b-=temp*25;}if(tintV!==0){g+=tintV*20;r-=tintV*10;b-=tintV*10;}
    if(hasHsl){var rN=r/255,gN=g/255,bN=b/255,mx=rN>gN?(rN>bN?rN:bN):(gN>bN?gN:bN),mn=rN<gN?(rN<bN?rN:bN):(gN<bN?gN:bN),hH=0,hS=0,hL=(mx+mn)/2;if(mx!==mn){var d=mx-mn;hS=hL>0.5?d/(2-mx-mn):d/(mx+mn);if(mx===rN)hH=(gN-bN)/d+(gN<bN?6:0);else if(mx===gN)hH=(bN-rN)/d+2;else hH=(rN-gN)/d+4;hH*=60;}var j=0;while(j<8&&hH>ctrs[j+1])j++;var t2=(hH-ctrs[j])/(ctrs[j+1]-ctrs[j]),hs=(1-t2)*hSh[j]+t2*hSh[j+1],sm=(1-t2)*sSh[j]+t2*sSh[j+1],ls=(1-t2)*lSh[j]+t2*lSh[j+1],nH=(hH+hs*30+360)%360,nS=Math.max(0,Math.min(1,hS*(1+sm))),nL2=Math.max(0,Math.min(1,hL+ls*0.4)),hS2=nH/360,r2=nL2,g2=nL2,b2=nL2;if(nS!==0){var qq=nL2<0.5?nL2*(1+nS):nL2+nS-nL2*nS,pp=2*nL2-qq,tR=hS2+1/3,tG=hS2,tB=hS2-1/3;var hfn=function(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<0.5)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};r2=hfn(pp,qq,tR);g2=hfn(pp,qq,tG);b2=hfn(pp,qq,tB);}r=r2*255;g=g2*255;b=b2*255;lV=0.299*r+0.587*g+0.114*b;}
    var bal=adj.colorGradingBalance||0,lBal=Math.max(0,Math.min(1,(lV/255)-bal*0.25)),wSh=Math.max(0,Math.min(1,1-lBal*2)),wHi=Math.max(0,Math.min(1,(lBal-0.5)*2)),wMi=Math.max(0,Math.min(1,1-wSh-wHi));
    r+=wSh*tSR+wMi*tMR+wHi*tHR;g+=wSh*tSG+wMi*tMG+wHi*tHG;b+=wSh*tSB+wMi*tMB+wHi*tHB;
    if(bloom){var br=bloom[i],bg2=bloom[i+1],bb2=bloom[i+2];if(adj.bloomColor){var tr=adj.bloomColor[0],tg=adj.bloomColor[1],tb=adj.bloomColor[2],tw=0.7,bL=0.299*br+0.587*bg2+0.114*bb2;r+=(bL*(tr/255)*tw+br*(1-tw))*adj.bloomIntensity;g+=(bL*(tg/255)*tw+bg2*(1-tw))*adj.bloomIntensity;b+=(bL*(tb/255)*tw+bb2*(1-tw))*adj.bloomIntensity;}else{r+=br*adj.bloomIntensity;g+=bg2*adj.bloomIntensity;b+=bb2*adj.bloomIntensity;}}
    if(vig>0){var dx=(xC-w/2)/(w/2),dy=(yC-h/2)/(h/2),dt=Math.sqrt(dx*dx+dy*dy),vf=1-vig*Math.min(1,Math.pow(dt,2));r*=vf;g*=vf;b*=vf;}
    if(grI>0){var pr=Math.sin(Math.floor(xC/grS)*12.9898+Math.floor(yC/grS)*78.233)*43758.5453,ns=((pr-Math.floor(pr))-0.5)*grI*255;r+=ns;g+=ns;b+=ns;}
    r=Math.max(0,Math.min(255,Math.round(r)));g=Math.max(0,Math.min(255,Math.round(g)));b=Math.max(0,Math.min(255,Math.round(b)));
    if(mask){var mw=mask[i/4]/255;dest[i]=Math.round((1-mw)*oR+mw*r);dest[i+1]=Math.round((1-mw)*oG+mw*g);dest[i+2]=Math.round((1-mw)*oB+mw*b);dest[i+3]=oA;}
    else{dest[i]=r;dest[i+1]=g;dest[i+2]=b;dest[i+3]=oA;}
  }
  return dest;
}

function computeGeometry(type, w, h, sx, sy, ex, ey, feather) {
  var buf = new Uint8ClampedArray(w * h);
  if (type === 'radial') {
    var cx=sx,cy=sy,r=Math.hypot(ex-cx,ey-cy),hard=1-feather;
    if(r<=1) return buf;
    for(var y=0;y<h;y++){for(var x=0;x<w;x++){var d=Math.hypot(x-cx,y-cy),val=0;if(d<=r){if(d<=r*hard)val=255;else val=255*(1-(d-r*hard)/(r*(1-hard)));}buf[y*w+x]=Math.round(val);}}
  } else if (type === 'linear') {
    var vx=ex-sx,vy=ey-sy,lenSq=vx*vx+vy*vy;
    if(lenSq<=10) return buf;
    for(var y=0;y<h;y++){for(var x=0;x<w;x++){var px=x-sx,py=y-sy,t=(px*vx+py*vy)/lenSq;buf[y*w+x]=Math.round(255*Math.max(0,Math.min(1,1-t)));}}
  }
  return buf;
}

self.onmessage = function(e) {
  var d = e.data;
  if (d.type === 'full') {
    var processed = new Uint8ClampedArray(d.origPixels);
    for (var mi = 0; mi < d.masks.length; mi++) {
      var m = d.masks[mi];
      if (m.visible && m.id !== d.activeMaskId) {
        processed = processPixels(processed, d.w, d.h, m.adjustments, m.curves, 'none', m.buffer);
      }
    }
    var activeMask = null;
    for (var mi = 0; mi < d.masks.length; mi++) {
      if (d.masks[mi].id === d.activeMaskId) { activeMask = d.masks[mi]; break; }
    }
    if (activeMask && activeMask.visible) {
      processed = processPixels(processed, d.w, d.h, d.adj, d.curves, d.preset, activeMask.buffer);
    } else if (!d.activeMaskId) {
      processed = processPixels(processed, d.w, d.h, d.adj, d.curves, d.preset, null);
    }
    self.postMessage({ id: d.id, type: 'full', result: processed }, [processed.buffer]);
  } else if (d.type === 'geometry') {
    var buf = computeGeometry(d.geoType, d.w, d.h, d.sx, d.sy, d.ex, d.ey, d.feather);
    self.postMessage({ id: d.id, type: 'geometry', result: buf }, [buf.buffer]);
  }
};
`;

function getWorker(): Worker {
  if (!worker) {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e: MessageEvent<{ id: number; type: string; result: Uint8ClampedArray }>) => {
      const job = pending.get(e.data.id);
      if (job) {
        pending.delete(e.data.id);
        if (e.data.id >= currentGeneration - 1) {
          job.resolve(new Uint8ClampedArray(e.data.result));
        } else {
          job.resolve(null);
        }
      }
    };
    worker.onerror = () => {
      pending.forEach(j => j.resolve(null));
      pending.clear();
    };
  }
  return worker;
}

let jobId = 0;

interface MaskPayload {
  id: string;
  visible: boolean;
  adjustments: AdjustmentState;
  curves: CurvesState;
  buffer: Uint8ClampedArray;
}

export function renderFullPipeline(
  origPixels: Uint8ClampedArray,
  w: number,
  h: number,
  adj: AdjustmentState,
  curves: CurvesState,
  preset: PresetType,
  masks: MaskPayload[],
  activeMaskId: string | null
): Promise<Uint8ClampedArray | null> {
  currentGeneration = ++jobId;
  const id = currentGeneration;

  pending.forEach((_, k) => { if (k < id - 1) pending.delete(k); });

  return new Promise((resolve) => {
    pending.set(id, { resolve, generation: id });

    const origCopy = new Uint8ClampedArray(origPixels);
    const transferables: Transferable[] = [origCopy.buffer];

    const maskPayloads = masks.map(m => {
      const bufCopy = new Uint8ClampedArray(m.buffer);
      transferables.push(bufCopy.buffer);
      return { id: m.id, visible: m.visible, adjustments: m.adjustments, curves: m.curves, buffer: bufCopy };
    });

    getWorker().postMessage(
      { id, type: 'full', origPixels: origCopy, w, h, adj, curves, preset, masks: maskPayloads, activeMaskId },
      transferables
    );
  });
}

export function computeGeometryAsync(
  geoType: 'radial' | 'linear',
  w: number,
  h: number,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  feather: number
): Promise<Uint8ClampedArray | null> {
  const id = ++jobId;

  return new Promise((resolve) => {
    pending.set(id, { resolve, generation: id });
    getWorker().postMessage({ id, type: 'geometry', geoType, w, h, sx, sy, ex, ey, feather });
  });
}
