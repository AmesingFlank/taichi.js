/**
 * HDRImage - wrapper that exposes default Image like interface for HDR imgaes. (till extending HTMLCanvasElement actually works ..)
 * @returns {HDRImage} a html HDR image element
 */
declare function _exports(): {
    (): any;
    floatToRgbe: (buffer: any, res?: Uint8Array | undefined) => Uint8Array;
    rgbeToFloat: (buffer: Uint8Array, res?: Float32Array | undefined) => Float32Array;
    floatToRgb9_e5: (buffer: any, res?: Uint32Array | undefined) => Uint32Array;
    rgb9_e5ToFloat: (buffer: any, res?: Float32Array | undefined) => Float32Array;
    rgbeToLDR: (buffer: Uint8Array, exposure?: any, gamma?: any, res?: any[] | undefined) => any[] | undefined;
    floatToLDR: (buffer: Float32Array, exposure?: any, gamma?: any, res?: any[] | undefined) => any[] | undefined;
};
declare namespace _exports {
    export { floatToRgbe };
    export { rgbeToFloat };
    export { floatToRgb9_e5 };
    export { rgb9_e5ToFloat };
    export { rgbeToLDR };
    export { floatToLDR };
}
export = _exports;
/** Convert a float buffer to a RGBE buffer.
  * @param {Float32Array} Buffer Floating point input buffer (96 bits/pixel).
  * @param {Uint8Array} [res] Optional output buffer with 32 bit RGBE per pixel.
  * @returns {Uint8Array} A 32bit uint8 array in RGBE
  */
declare function floatToRgbe(buffer: any, res?: Uint8Array | undefined): Uint8Array;
/** Convert an RGBE buffer to a Float buffer.
  * @param {Uint8Array} buffer The input buffer in RGBE format. (as returned from loadHDR)
  * @param {Float32Array} [res] Optional result buffer containing 3 floats per pixel.
  * @returns {Float32Array} A floating point buffer with 96 bits per pixel (32 per channel, 3 channels).
  */
declare function rgbeToFloat(buffer: Uint8Array, res?: Float32Array | undefined): Float32Array;
/** Convert a float buffer to a RGB9_E5 buffer. (ref https://www.khronos.org/registry/OpenGL/extensions/EXT/EXT_texture_shared_exponent.txt)
  * @param {Float32Array} Buffer Floating point input buffer (96 bits/pixel).
  * @param {Uint32Array} [res] Optional output buffer with 32 bit RGB9_E5 per pixel.
  * @returns {Uint32Array} A 32bit uint32 array in RGB9_E5
  */
declare function floatToRgb9_e5(buffer: any, res?: Uint32Array | undefined): Uint32Array;
/** Convert an RGB9_E5 buffer to a Float buffer.
  * @param {Uint32Array} Buffer in RGB9_E5 format. (Uint32 buffer).
  * @param {Float32Array} [res] Optional float output buffer.
  * @returns {Float32Array} A Float32Array.
  */
declare function rgb9_e5ToFloat(buffer: any, res?: Float32Array | undefined): Float32Array;
/** Convert an RGBE buffer to LDR with given exposure and display gamma.
  * @param {Uint8Array} buffer The input buffer in RGBE format. (as returned from loadHDR)
  * @param {float} [exposure=1] Optional exposure value. (1=default, 2=1 step up, 3=2 steps up, -2 = 3 steps down)
  * @param {float} [gamma=2.2]  Optional display gamma to respect. (1.0 = linear, 2.2 = default monitor)
  * @param {Array} [res] res Optional result buffer.
  */
declare function rgbeToLDR(buffer: Uint8Array, exposure?: any, gamma?: any, res?: any[] | undefined): any[] | undefined;
/** Convert an float buffer to LDR with given exposure and display gamma.
  * @param {Float32Array} buffer The input buffer in floating point format.
  * @param {float} [exposure=1] Optional exposure value. (1=default, 2=1 step up, 3=2 steps up, -2 = 3 steps down)
  * @param {float} [gamma=2.2]  Optional display gamma to respect. (1.0 = linear, 2.2 = default monitor)
  * @param {Array} [res] res Optional result buffer.
  */
declare function floatToLDR(buffer: Float32Array, exposure?: any, gamma?: any, res?: any[] | undefined): any[] | undefined;
