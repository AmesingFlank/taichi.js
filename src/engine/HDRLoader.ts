import * as ti from "../taichi"
import { error } from "../utils/Logging";
import { Texture } from "../api/Textures";


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

let radiancePattern = "#\\?RADIANCE"
let commentPattern = "#.*"
let gammaPattern = "GAMMA=";
let exposurePattern = "EXPOSURE=\\s*([0-9]*[.][0-9]*)";
let formatPattern = "FORMAT=32-bit_rle_rgbe";
let widthHeightPattern = "-Y ([0-9]+) \\+X ([0-9]+)";

//http://croquetweak.blogspot.co.uk/2014/08/deconstructing-floats-frexp-and-ldexp.html
function ldexp(mantissa: number, exponent: number) {
    return exponent > 1023 // avoid multiplying by infinity
        ? mantissa * Math.pow(2, 1023) * Math.pow(2, exponent - 1023)
        : exponent < -1074 // avoid multiplying by zero
            ? mantissa * Math.pow(2, -1074) * Math.pow(2, exponent + 1074)
            : mantissa * Math.pow(2, exponent);
}

function readPixelsRawRLE(buffer: Uint8Array, data: Uint8Array | number[], offset: number, fileOffset: number, scanline_width: number, num_scanlines: number) {
    let rgbe: number[] = new Array(4);
    let scanline_buffer: number[] | null = null;
    let ptr;
    let ptr_end;
    let count;
    let buf = new Array(2);
    let bufferLength = buffer.length;

    function readBuf(buf: number[]) {
        let bytesRead = 0;
        do {
            buf[bytesRead++] = buffer[fileOffset];
        } while (++fileOffset < bufferLength && bytesRead < buf.length);
        return bytesRead;
    }

    function readBufOffset(buf: Uint8Array | number[], offset: number, length: number) {
        let bytesRead = 0;
        do {
            buf[offset + bytesRead++] = buffer[fileOffset];
        } while (++fileOffset < bufferLength && bytesRead < length);
        return bytesRead;
    }

    function readPixelsRaw(buffer: Uint8Array, data: Uint8Array | number[], offset: number, numpixels: number) {
        let numExpected = 4 * numpixels;
        let numRead = readBufOffset(data, offset, numExpected);
        if (numRead < numExpected) {
            throw new Error('Error reading raw pixels: got ' + numRead + ' bytes, expected ' + numExpected);
        }
    }

    while (num_scanlines > 0) {
        if (readBuf(rgbe) < rgbe.length) {
            throw new Error("Error reading bytes: expected " + rgbe.length);
        }

        if ((rgbe[0] != 2) || (rgbe[1] != 2) || ((rgbe[2] & 0x80) != 0)) {
            //this file is not run length encoded
            data[offset++] = rgbe[0];
            data[offset++] = rgbe[1];
            data[offset++] = rgbe[2];
            data[offset++] = rgbe[3];
            readPixelsRaw(buffer, data, offset, scanline_width * num_scanlines - 1);
            return;
        }

        if ((((rgbe[2] & 0xFF) << 8) | (rgbe[3] & 0xFF)) != scanline_width) {
            throw new Error("Wrong scanline width " + (((rgbe[2] & 0xFF) << 8) | (rgbe[3] & 0xFF)) + ", expected " + scanline_width);
        }

        if (scanline_buffer == null) {
            scanline_buffer = new Array(4 * scanline_width);
        }

        ptr = 0;
        /* read each of the four channels for the scanline into the buffer */
        for (let i = 0; i < 4; i++) {
            ptr_end = (i + 1) * scanline_width;
            while (ptr < ptr_end) {
                if (readBuf(buf) < buf.length) {
                    throw new Error("Error reading 2-byte buffer");
                }
                if ((buf[0] & 0xFF) > 128) {
                    /* a run of the same value */
                    count = (buf[0] & 0xFF) - 128;
                    if ((count == 0) || (count > ptr_end - ptr)) {
                        throw new Error("Bad scanline data");
                    }
                    while (count-- > 0)
                        scanline_buffer[ptr++] = buf[1];
                }
                else {
                    /* a non-run */
                    count = buf[0] & 0xFF;
                    if ((count == 0) || (count > ptr_end - ptr)) {
                        throw new Error("Bad scanline data");
                    }
                    scanline_buffer[ptr++] = buf[1];
                    if (--count > 0) {
                        if (readBufOffset(scanline_buffer, ptr, count) < count) {
                            throw new Error("Error reading non-run data");
                        }
                        ptr += count;
                    }
                }
            }
        }

        /* copy byte data to output */
        for (let i = 0; i < scanline_width; i++) {
            data[offset + 0] = scanline_buffer[i];
            data[offset + 1] = scanline_buffer[i + scanline_width];
            data[offset + 2] = scanline_buffer[i + 2 * scanline_width];
            data[offset + 3] = scanline_buffer[i + 3 * scanline_width];
            offset += 4;
        }

        num_scanlines--;
    }

}

//Returns data as floats and flipped along Y by default
function parseHdr(buffer: Uint8Array) {
    buffer = buffer as Uint8Array

    let fileOffset = 0;
    let bufferLength = buffer.length;

    let NEW_LINE = 10;

    function readLine() {
        let buf = "";
        do {
            let b = buffer[fileOffset];
            if (b == NEW_LINE) {
                ++fileOffset
                break;
            }
            buf += String.fromCharCode(b);
        } while (++fileOffset < bufferLength);
        return buf;
    }

    let width = 0;
    let height = 0;
    let exposure = 1;
    let gamma = 1;
    let rle = false;

    for (let i = 0; i < 20; i++) {
        let line = readLine();
        let match;
        if (match = line.match(radiancePattern)) {
        }
        else if (match = line.match(formatPattern)) {
            rle = true;
        }
        else if (match = line.match(exposurePattern)) {
            exposure = Number(match[1]);
        }
        else if (match = line.match(commentPattern)) {
        }
        else if (match = line.match(widthHeightPattern)) {
            height = Number(match[1]);
            width = Number(match[2]);
            break;
        }
    }

    if (!rle) {
        throw new Error("File is not run length encoded!");
    }

    let data = new Uint8Array(width * height * 4);
    let scanline_width = width;
    let num_scanlines = height;

    readPixelsRawRLE(buffer, data, 0, fileOffset, scanline_width, num_scanlines);

    //TODO: Should be Float16
    let floatData = new Float32Array(width * height * 4);
    for (let offset = 0; offset < data.length; offset += 4) {
        let r = data[offset + 0] / 255;
        let g = data[offset + 1] / 255;
        let b = data[offset + 2] / 255;
        let e = data[offset + 3];
        let f = Math.pow(2.0, e - 128.0)

        r *= f;
        g *= f;
        b *= f;

        let floatOffset = offset;

        floatData[floatOffset + 0] = r;
        floatData[floatOffset + 1] = g;
        floatData[floatOffset + 2] = b;
        floatData[floatOffset + 3] = 1.0;
    }

    return {
        shape: [width, height],
        exposure: exposure,
        gamma: gamma,
        data: floatData
    }
}

export class HdrTexture {
    constructor(
        public texture: Texture,
        public exposure: number
    ) {

    }
}

export class HdrLoader {

    private static getImgFieldToTextureKernel(): ((...args: any[]) => void) {
        if (!this.imgFieldToTexture) {
            this.imgFieldToTexture = ti.kernel(
                { imgField: ti.template(), imgTexture: ti.template() },
                `
                (imgField, imgTexture) => {
                    for(let I of ti.ndrange(imgField.dimensions[0], imgField.dimensions[1])){
                        let x = I.y
                        let y = imgField.dimensions[0] - I.x
                        ti.textureStore(imgTexture, [x,y], imgField[I])
                    }
                }
                `
            )
        }
        return this.imgFieldToTexture
    }
    private static imgFieldToTexture: ((...args: any[]) => void) | undefined = undefined

    static async loadFromURL(url: string): Promise<HdrTexture> {
        let hdr = await fetch(url)
        let rawBuffer: ArrayBuffer = await hdr.arrayBuffer()
        let d8: Uint8Array = new Uint8Array(rawBuffer)

        let parseResult = parseHdr(d8)
        let width = parseResult.shape[0]
        let height = parseResult.shape[1]

        let floatData = Array.from(parseResult.data)
        let imgField = ti.Vector.field(4, ti.f32, [height, width])
        await imgField.fromArray1D(floatData)
        let imgTexture = ti.texture(4, [width, height])
        let k = this.getImgFieldToTextureKernel()
        k(imgField, imgTexture)
        return new HdrTexture(imgTexture, parseResult.exposure)
    }
}
