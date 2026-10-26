import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..', import.meta.url));
const {data,info}=await sharp(root+'/public/assets/mobile/about-partner-2.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
// The mobile export contains the full black logo on solid #ffb3e0.
// Its red channel is 255 in the background and 0 in the logo:
// invert it into alpha to retain the original antialiased black artwork.
const ink=Buffer.alloc(info.width*info.height*4);
for(let i=0;i<data.length;i+=4)ink[i+3]=Math.round((255-data[i])*data[i+3]/255);
const fullLogo=await sharp(ink,{raw:{width:info.width,height:info.height,channels:4}}).trim().png().toBuffer();
const logo=await sharp(fullLogo).resize({width:194,height:114,fit:'inside'}).png().toBuffer();
const whiteCard=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="230" height="150"><rect width="230" height="150" rx="20" fill="white"/></svg>');
const card=sharp(whiteCard).composite([{input:logo,gravity:'centre'}]);
await card.clone().png().toFile(root+'/public/assets/figma/partner-2.png');
await card.clone().webp({lossless:true}).toFile(root+'/public/assets/figma/partner-2.webp');
