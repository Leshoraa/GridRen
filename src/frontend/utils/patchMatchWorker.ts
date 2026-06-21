export interface PatchMatchParams {
  patchRadius: number;
  iterations: number;
  levels: number;
  searchAlpha: number;
}

let worker: Worker | null = null;
let currentGeneration = 0;
const pending = new Map<number, { resolve: (result: Uint8ClampedArray | null) => void }>();

const WORKER_SOURCE = /* js */`
function clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v;}
function countMP(m,t){t=t||128;var n=0;for(var i=0;i<m.length;i++)if(m[i]>=t)n++;return n;}
function dilate(m,w,h,r){if(r<=0)return new Uint8ClampedArray(m);var c=new Uint8ClampedArray(m);for(var s=0;s<r;s++){var n=new Uint8ClampedArray(c.length);for(var y=0;y<h;y++){var y0=Math.max(0,y-1),y1=Math.min(h-1,y+1);for(var x=0;x<w;x++){var x0=Math.max(0,x-1),x1=Math.min(w-1,x+1);var a=0;for(var yy=y0;yy<=y1&&!a;yy++)for(var xx=x0;xx<=x1;xx++)if(c[yy*w+xx]>=128){a=1;break;}n[y*w+x]=a?255:0;}}c=n;}return c;}
function dsI(s,w,h){var nw=Math.max(1,w>>1),nh=Math.max(1,h>>1),d=new Uint8ClampedArray(nw*nh*4);for(var y=0;y<nh;y++)for(var x=0;x<nw;x++){var s0=x*2,t0=y*2,s1=Math.min(w-1,s0+1),t1=Math.min(h-1,t0+1);for(var c=0;c<4;c++)d[(y*nw+x)*4+c]=(s[(t0*w+s0)*4+c]+s[(t0*w+s1)*4+c]+s[(t1*w+s0)*4+c]+s[(t1*w+s1)*4+c])>>2;}return{img:d,w:nw,h:nh};}
function dsM(s,w,h){var nw=Math.max(1,w>>1),nh=Math.max(1,h>>1),d=new Uint8ClampedArray(nw*nh);for(var y=0;y<nh;y++)for(var x=0;x<nw;x++){var s0=x*2,t0=y*2,s1=Math.min(w-1,s0+1),t1=Math.min(h-1,t0+1);d[y*nw+x]=(s[t0*w+s0]>=128||s[t0*w+s1]>=128||s[t1*w+s0]>=128||s[t1*w+s1]>=128)?255:0;}return{m:d,w:nw,h:nh};}
function bP(img,msk,w,h,rl){var lv=rl;if(lv<=0){lv=1;var d=Math.max(w,h);while(d>128){lv++;d>>=1;}lv=Math.max(1,lv);}var py=[];var ci=img,cm=msk,cw=w,ch=h;py.unshift({w:cw,h:ch,image:ci,mask:cm});for(var l=1;l<lv;l++){var di=dsI(ci,cw,ch),dm=dsM(cm,cw,ch);if(di.w<=2||di.h<=2)break;ci=di.img;cw=di.w;ch=di.h;cm=dm.m;py.unshift({w:cw,h:ch,image:ci,mask:cm});}return py;}
function cG(img,w,h){var g=new Float32Array(w*h*2),l=new Float32Array(w*h);for(var i=0;i<w*h;i++)l[i]=0.299*img[i*4]+0.587*img[i*4+1]+0.114*img[i*4+2];for(var y=0;y<h;y++)for(var x=0;x<w;x++){var xm=Math.max(0,x-1),xp=Math.min(w-1,x+1),ym=Math.max(0,y-1),yp=Math.min(h-1,y+1);var gx=-l[ym*w+xm]-2*l[y*w+xm]-l[yp*w+xm]+l[ym*w+xp]+2*l[y*w+xp]+l[yp*w+xp],gy=-l[ym*w+xm]-2*l[ym*w+x]-l[ym*w+xp]+l[yp*w+xm]+2*l[yp*w+x]+l[yp*w+xp];var idx=(y*w+x)*2;g[idx]=Math.hypot(gx,gy);g[idx+1]=Math.atan2(gy,gx);}return g;}
function pD(img,g,v,w,h,px,py,qx,qy,pr,co){var sum=0,cnt=0;for(var dy=-pr;dy<=pr;dy++)for(var dx=-pr;dx<=pr;dx++){var qx2=clamp(qx+dx,0,w-1),qy2=clamp(qy+dy,0,h-1);if(v[qy2*w+qx2]<128)return Infinity;var px2=clamp(px+dx,0,w-1),py2=clamp(py+dy,0,h-1);var i1=(py2*w+px2)*4,i2=(qy2*w+qx2)*4;var dr=img[i1]-img[i2],dg=img[i1+1]-img[i2+1],db=img[i1+2]-img[i2+2];sum+=dr*dr+dg*dg+db*db;cnt++;if(sum>co*cnt)return sum/Math.max(1,cnt);}return cnt>0?sum/cnt:Infinity;}
function rn(r){var s=r.s;s^=s<<13;s^=s>>>17;s^=s<<5;r.s=s>>>0;return r.s/4294967296;}
function rI(nx,ny,e,img,g,v,w,h,ho,pr,rng){var vi=[];for(var i=0;i<w*h;i++)if(v[i]>=128)vi.push(i);if(!vi.length)return;for(var y=0;y<h;y++)for(var x=0;x<w;x++){var idx=y*w+x;if(!ho[idx])continue;var pk=vi[(rn(rng)*vi.length)|0];nx[idx]=pk%w;ny[idx]=(pk/w)|0;e[idx]=pD(img,g,v,w,h,x,y,nx[idx],ny[idx],pr,Infinity);}}
function uN(sx,sy,sw,sh,dw,dh){var dx=new Int32Array(dw*dh),dy=new Int32Array(dw*dh);for(var y=0;y<dh;y++){var sy=Math.min(sh-1,y>>1);for(var x=0;x<dw;x++){var sxi=Math.min(sw-1,x>>1);var si=sy*sw+sxi;dx[y*dw+x]=clamp(sx[si]*2,0,dw-1);dy[y*dw+x]=clamp(sy[si]*2,0,dh-1);}}return{x:dx,y:dy};}
function rL(img,v,ho,w,h,nx,ny,e,p,rng,it){var g=cG(img,w,h),ws=Math.max(w,h),hs=[];for(var i=0;i<w*h;i++)if(ho[i])hs.push(i);for(var it2=0;it2<it;it2++){var rev=(it2&1)===1;for(var k=0;k<hs.length;k++){var idx=rev?hs[hs.length-1-k]:hs[k];var x=idx%w,y=(idx/w)|0;var bx=nx[idx],by=ny[idx],be=e[idx];var nb=rev?[[x+1,y],[x,y+1]]:[[x-1,y],[x,y-1]];for(var ni=0;ni<nb.length;ni++){var nnx=nb[ni][0],nny=nb[ni][1];if(nnx<0||nny<0||nnx>=w||nny>=h)continue;var ni2=nny*w+nnx;if(!ho[ni2])continue;var ox=x+(nx[ni2]-nnx),oy=y+(ny[ni2]-nny);if(ox<0||oy<0||ox>=w||oy>=h||v[oy*w+ox]<128)continue;var d=pD(img,g,v,w,h,x,y,ox,oy,p.patchRadius,be);if(d<be){be=d;bx=ox;by=oy;}}var rad=ws;while(rad>=1){var rx=bx+Math.round((rn(rng)*2-1)*rad),ry=by+Math.round((rn(rng)*2-1)*rad);if(rx>=0&&ry>=0&&rx<w&&ry<h&&v[ry*w+rx]>=128){var d2=pD(img,g,v,w,h,x,y,rx,ry,p.patchRadius,be);if(d2<be){be=d2;bx=rx;by=ry;}}rad*=p.searchAlpha;}nx[idx]=bx;ny[idx]=by;e[idx]=be;}}}
function fB(img,nx,ny,om,dm,w,h){var o=new Uint8ClampedArray(img.length);o.set(img);for(var y=0;y<h;y++)for(var x=0;x<w;x++){var idx=y*w+x;if(om[idx]>=128){var sx=clamp(nx[idx],0,w-1),sy=clamp(ny[idx],0,h-1);var si=(sy*w+sx)*4,di=idx*4;o[di]=img[si];o[di+1]=img[si+1];o[di+2]=img[si+2];o[di+3]=img[si+3];}else if(dm[idx]>=128){var sx2=clamp(nx[idx],0,w-1),sy2=clamp(ny[idx],0,h-1);var si2=(sy2*w+sx2)*4,di2=idx*4;o[di2]=Math.round(0.5*img[di2]+0.5*img[si2]);o[di2+1]=Math.round(0.5*img[di2+1]+0.5*img[si2+1]);o[di2+2]=Math.round(0.5*img[di2+2]+0.5*img[si2+2]);o[di2+3]=img[di2+3];}}return o;}
function rPM(img,msk,w,h,pi){var p={patchRadius:4,iterations:5,levels:0,searchAlpha:0.5};if(pi)for(var k in pi)if(pi[k]!==undefined)p[k]=pi[k];if(countMP(msk)===0)return new Uint8ClampedArray(img);var dt=dilate(msk,w,h,p.patchRadius),py=bP(img,dt,w,h,p.levels);var nx=null,ny=null,pw=0,ph=0;for(var li=0;li<py.length;li++){var lv=py[li],np=lv.w*lv.h;var v=new Uint8Array(np),ho=new Uint8Array(np);for(var i=0;i<np;i++){var ih=lv.mask[i]>=128;ho[i]=ih?1:0;v[i]=ih?0:255;}var er=new Float32Array(np);var rng={s:(0x9e3779b9^(lv.w*7919+lv.h))|1};if(nx===null){nx=new Int32Array(np);ny=new Int32Array(np);rI(nx,ny,er,lv.image,cG(lv.image,lv.w,lv.h),v,lv.w,lv.h,ho,p.patchRadius,rng);}else{var up=uN(nx,ny,pw,ph,lv.w,lv.h);nx=up.x;ny=up.y;for(var j=0;j<np;j++)er[j]=Infinity;}rL(lv.image,v,ho,lv.w,lv.h,nx,ny,er,p,rng,p.iterations);pw=lv.w;ph=lv.h;}return fB(img,nx,ny,msk,dt,w,h);}

self.onmessage=function(e){var d=e.data;if(d.type==='patchmatch'){var img=new Uint8ClampedArray(d.image),msk=new Uint8ClampedArray(d.mask);var res=rPM(img,msk,d.w,d.h,d.params);self.postMessage({id:d.id,type:'patchmatch',result:res},[res.buffer]);}};
`;

function getWorker(): Worker {
  if (!worker) {
    const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e: MessageEvent<{ id: number; type: string; result: Uint8ClampedArray }>) => {
      const job = pending.get(e.data.id);
      if (job) {
        pending.delete(e.data.id);
        job.resolve(e.data.id >= currentGeneration - 1 ? new Uint8ClampedArray(e.data.result) : null);
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

export function runPatchMatchInWorker(
  image: Uint8ClampedArray, mask: Uint8ClampedArray,
  w: number, h: number, params?: Partial<PatchMatchParams>
): Promise<Uint8ClampedArray | null> {
  currentGeneration = ++jobId;
  const id = currentGeneration;
  pending.forEach((_, k) => { if (k < id - 1) pending.delete(k); });
  return new Promise((resolve) => {
    pending.set(id, { resolve });
    const imgCopy = new Uint8ClampedArray(image);
    const maskCopy = new Uint8ClampedArray(mask);
    getWorker().postMessage(
      { id, type: 'patchmatch', image: imgCopy, mask: maskCopy, w, h, params: params || {} },
      [imgCopy.buffer, maskCopy.buffer]
    );
  });
}
