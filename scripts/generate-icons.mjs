import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import sharp from 'sharp';

const base=new URL('../public/',import.meta.url);
const svg=readFileSync(new URL('icons/cosmomemo.svg',base),'utf8');
const opaque=svg.replace('rx="112"','rx="0"');
mkdirSync(new URL('icons/',base),{recursive:true});
for(const size of [192,512]){
 const png=await sharp(Buffer.from(svg)).resize(size,size).png().toBuffer();
 writeFileSync(new URL(`icons/cosmomemo-${size}.png`,base),png);
}
for(const [size,name]of [[180,'cosmomemo-apple-180'],[512,'cosmomemo-maskable-512']]){
 const png=await sharp(Buffer.from(opaque)).resize(size,size).png().toBuffer();
 writeFileSync(new URL(`icons/${name}.png`,base),png);
}
const frames=[];
for(const size of [16,32,48])frames.push({size,png:await sharp(Buffer.from(svg)).resize(size,size).png().toBuffer()});
const header=Buffer.alloc(6+frames.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
let offset=header.length;
for(const [i,{size,png}]of frames.entries()){
 const entry=6+i*16;header[entry]=size;header[entry+1]=size;header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(png.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=png.length;
}
writeFileSync(new URL('favicon.ico',base),Buffer.concat([header,...frames.map(f=>f.png)]));
writeFileSync(new URL('favicon.svg',base),svg);
writeFileSync(new URL('icons/cosmomemo-32.png',base),frames[1].png);
console.log('Icone generate: favicon 16/32/48, Apple 180, app 192/512 e Android maskable.');
