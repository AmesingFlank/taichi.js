

// async function loadHDR(url: string): Array[] {
//     let hdr = await fetch(url)
//     let rawBuffer: ArrayBuffer = await hdr.arrayBuffer()
//     let d8: Uint8Array = new Uint8Array(rawBuffer)
//     let header = '', pos = 0, format = "";
//     // read header.  
//     while (!header.match(/\n\n[^\n]+\n/g)) header += String.fromCharCode(d8[pos++]);
//     // check format. 
//     format = header.match(/FORMAT=(.*)$/m)![1];
//     if (format != '32-bit_rle_rgbe') return console.warn('unknown format : ' + format), this.onerror();
//     // parse resolution
//     var rez = header.split(/\n/).reverse()[1].split(' '), width = rez[3] * 1, height = rez[1] * 1;
//     // Create image.
//     var img = new Uint8Array(width * height * 4), ipos = 0;
//     // Read all scanlines
//     for (var j = 0; j < height; j++) {
//         var rgbe = d8.slice(pos, pos += 4), scanline = [];
//         if (rgbe[0] != 2 || (rgbe[1] != 2) || (rgbe[2] & 0x80)) {
//             var len = width, rs = 0; pos -= 4; while (len > 0) {
//                 img.set(d8.slice(pos, pos += 4), ipos);
//                 if (img[ipos] == 1 && img[ipos + 1] == 1 && img[ipos + 2] == 1) {
//                     for (img[ipos + 3] << rs; i > 0; i--) {
//                         img.set(img.slice(ipos - 4, ipos), ipos);
//                         ipos += 4;
//                         len--
//                     }
//                     rs += 8;
//                 } else { len--; ipos += 4; rs = 0; }
//             }
//         } else {
//             if ((rgbe[2] << 8) + rgbe[3] != width) return console.warn('HDR line mismatch ..'), this.onerror();
//             for (var i = 0; i < 4; i++) {
//                 var ptr = i * width, ptr_end = (i + 1) * width, buf, count;
//                 while (ptr < ptr_end) {
//                     buf = d8.slice(pos, pos += 2);
//                     if (buf[0] > 128) { count = buf[0] - 128; while (count-- > 0) scanline[ptr++] = buf[1]; }
//                     else { count = buf[0] - 1; scanline[ptr++] = buf[1]; while (count-- > 0) scanline[ptr++] = d8[pos++]; }
//                 }
//             }
//             for (var i = 0; i < width; i++) { img[ipos++] = scanline[i]; img[ipos++] = scanline[i + width]; img[ipos++] = scanline[i + 2 * width]; img[ipos++] = scanline[i + 3 * width]; }
//         }
//     }
// }