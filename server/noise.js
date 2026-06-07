export class Noise {
  constructor(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise2D(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const p = this.perm;
    const n00 = p[p[ix & 255] + (iy & 255)] / 255;
    const n10 = p[p[(ix + 1) & 255] + (iy & 255)] / 255;
    const n01 = p[p[ix & 255] + ((iy + 1) & 255)] / 255;
    const n11 = p[p[(ix + 1) & 255] + ((iy + 1) & 255)] / 255;
    return n00 + (n10 - n00) * sx + (n01 - n00 + (n11 - n10 - n01 + n00) * sx) * sy;
  }

  octave(x, y, oct) {
    let val = 0, amp = 1, max = 0, freq = 1;
    for (let i = 0; i < oct; i++) {
      val += this.noise2D(x * freq, y * freq) * amp;
      max += amp; amp *= 0.5; freq *= 2;
    }
    return val / max;
  }
}

export function createRNG(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 4294967296; };
}
