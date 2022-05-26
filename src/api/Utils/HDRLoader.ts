import * as ti from "../../taichi"
import { error } from "../../utils/Logging";
import { Texture } from "../Textures";


function rgbeToFloat(buffer: Uint8Array): Float32Array {
    let l = buffer.byteLength >> 2
    let res = new Float32Array(l * 4);
    for (let i = 0; i < l; i++) {
        let s = Math.pow(2, buffer[i * 4 + 3] - (128 + 8));
        res[i * 4] = buffer[i * 4] * s;
        res[i * 4 + 1] = buffer[i * 4 + 1] * s;
        res[i * 4 + 2] = buffer[i * 4 + 2] * s;
        res[i * 4 + 3] = 1.0;
    }
    return res;
}

export class HdrLoader {

    private static getImgFieldToTextureKernel(): ((...args: any[]) => void) {
        if (!this.imgFieldToTexture) {
            this.imgFieldToTexture = ti.kernel(
                { imgField: ti.template(), imgTexture: ti.template() },
                `
                (imgField, imgTexture) => {
                    for(let I of ti.ndrange(imgField.dimensions[0], imgField.dimensions[1])){
                        ti.textureStore(imgTexture, I, imgField[I])
                    }
                }
                `
            )
        }
        return this.imgFieldToTexture
    }
    private static imgFieldToTexture: ((...args: any[]) => void) | undefined = undefined

    static async loadFromURL(url: string): Promise<Texture> {
        let hdr = await fetch(url)
        let rawBuffer: ArrayBuffer = await hdr.arrayBuffer()
        let d8: Uint8Array = new Uint8Array(rawBuffer)
        let header = '', pos = 0, format = "";
        // read header.  
        while (!header.match(/\n\n[^\n]+\n/g)) header += String.fromCharCode(d8[pos++]);
        // check format. 
        format = header.match(/FORMAT=(.*)$/m)![1];
        if (format != '32-bit_rle_rgbe') {
            error(`unknown format: ${format}`)
        }
        // parse resolution
        let rez = header.split(/\n/).reverse()[1].split(' ')
        let width = Number(rez[3])
        let height = Number(rez[1])
        // Create image.
        let img = new Uint8Array(width * height * 4), ipos = 0;
        // Read all scanlines
        let i:number = -1234
        for (let j = 0; j < height; j++) {
            let rgbe = d8.slice(pos, pos += 4), scanline = [];
            if (rgbe[0] != 2 || (rgbe[1] != 2) || (rgbe[2] & 0x80)) {
                let len = width, rs = 0; pos -= 4; while (len > 0) {
                    img.set(d8.slice(pos, pos += 4), ipos);
                    if (img[ipos] == 1 && img[ipos + 1] == 1 && img[ipos + 2] == 1) {
                        console.log(i)
                        for (img[ipos+3]<<rs; i > 0; i--) {
                            img.set(img.slice(ipos - 4, ipos), ipos);
                            ipos += 4;
                            len--
                        }
                        rs += 8;
                    } else { len--; ipos += 4; rs = 0; }
                }
            } else {
                if ((rgbe[2] << 8) + rgbe[3] != width) {
                    error('HDR line mismatch ..')
                }
                for (i = 0; i < 4; i++) {
                    let ptr = i * width, ptr_end = (i + 1) * width, buf, count;
                    while (ptr < ptr_end) {
                        buf = d8.slice(pos, pos += 2);
                        if (buf[0] > 128) { count = buf[0] - 128; while (count-- > 0) scanline[ptr++] = buf[1]; }
                        else { count = buf[0] - 1; scanline[ptr++] = buf[1]; while (count-- > 0) scanline[ptr++] = d8[pos++]; }
                    }
                }
                for ( i = 0; i < width; i++) { img[ipos++] = scanline[i]; img[ipos++] = scanline[i + width]; img[ipos++] = scanline[i + 2 * width]; img[ipos++] = scanline[i + 3 * width]; }
            }
        }

        let floatData = Array.from(rgbeToFloat(img))
        let imgField = ti.Vector.field(4, ti.f32, [width, height])
        await imgField.fromArray1D(floatData)
        let imgTexture = ti.texture(4, [width, height])
        let k = this.getImgFieldToTextureKernel()
        k(imgField, imgTexture)
        return imgTexture
    }
}
