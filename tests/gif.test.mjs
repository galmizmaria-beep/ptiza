import assert from 'node:assert/strict';
import {Buffer,Blob} from 'node:buffer';
import {createEditor} from './harness.mjs';
const {env,run,element}=await createEditor();
class MiniCanvas {
 width=0;height=0;pixels=null;
 getContext(){const c=this;const ensure=()=>{if(!c.pixels||c.pixels.length!==c.width*c.height*4)c.pixels=new Uint8ClampedArray(c.width*c.height*4);};return {
  clearRect(x,y,w,h){ensure();for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)c.pixels.fill(0,(j*c.width+i)*4,(j*c.width+i)*4+4)},
  getImageData(){ensure();return {data:new Uint8ClampedArray(c.pixels),width:c.width,height:c.height}},
  putImageData(data){c.pixels=new Uint8ClampedArray(data.data)},
  drawImage(src,x,y,w=src.width,h=src.height){ensure();for(let j=0;j<h;j++)for(let i=0;i<w;i++){const si=(Math.floor(j*src.height/h)*src.width+Math.floor(i*src.width/w))*4,di=((j+y)*c.width+i+x)*4;if(src.pixels[si+3])c.pixels.set(src.pixels.subarray(si,si+4),di);}}
 };}
}
env.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height})}};
env.document.createElement=tag=>tag==='canvas'?new MiniCanvas():element(tag);
env.FileReader=class{async readAsDataURL(blob){this.result='data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');this.onload();}};
env.setTimeout=fn=>{fn();return 0};
// Transparent GIF with finite looping, unequal frame durations and frame disposal.
const encoder=env.gifenc.GIFEncoder();const palette=[[255,0,0,255],[0,255,0,255],[0,0,0,0]];
encoder.writeFrame(new Uint8Array([0,2,0,2]),2,2,{palette,delay:70,repeat:3,transparent:true,transparentIndex:2,dispose:2});
encoder.writeFrame(new Uint8Array([2,1,2,1]),2,2,{palette,delay:130,repeat:3,transparent:true,transparentIndex:2,dispose:2});encoder.finish();
env.gifFile=new Blob([encoder.bytes()],{type:'image/gif'});
const output=await run('compressGIF(gifFile,{maxDim:2,quality:0.5})');
const parsed=env.gifuct.parseGIF(Uint8Array.from(Buffer.from(output.split(',')[1],'base64')).buffer);
const frames=env.gifuct.decompressFrames(parsed,true);assert.equal(frames.length,2);assert.deepEqual(Array.from(frames,f=>f.delay),[70,130]);assert(frames.every(f=>f.transparentIndex!==undefined));env.testGif=parsed;assert.equal(run('gifLoopCount(testGif)'),3);
const chosen=await run('compressImage(gifFile,{maxDim:1,quality:0.5})');assert(chosen.startsWith('data:image/gif;base64,'));assert(chosen.length<=('data:image/gif;base64,'+Buffer.from(encoder.bytes()).toString('base64')).length);
console.log('PASS: GIF frames, frame durations, finite loop count, transparency, automatic compression, retaining smaller original.');
