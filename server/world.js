import { Noise, createRNG } from './noise.js';

const CH = 64;
const CW = 16;

const B = {
  GRASS: 1, DIRT: 2, STONE: 3, COBBLESTONE: 4,
  SAND: 5, GRAVEL: 6, OAK_LOG: 7, OAK_LEAVES: 8,
  OAK_PLANKS: 9, COAL_ORE: 10, IRON_ORE: 11, GOLD_ORE: 12,
  DIAMOND_ORE: 13, BEDROCK: 14, SNOW: 15, SANDSTONE: 16,
  OBSIDIAN: 17, SPRUCE_LOG: 18, SPRUCE_LEAVES: 19,
  BIRCH_LOG: 20, BIRCH_LEAVES: 21, NETHERRACK: 23,
  GLOWSTONE: 24, STONE_BRICKS: 25, MOSSY_COBBLESTONE: 26,
  DEEPSLATE: 27, COBBLED_DEEPSLATE: 28, MUD: 29,
  PACKED_MUD: 30, MUD_BRICKS: 31, TUFF: 32, CALCITE: 33,
  MAGMA: 34, END_STONE: 35, PURPUR: 36, COARSE_DIRT: 37,
  PODZOL: 38, MYCELIUM: 39, RED_SAND: 40, RED_SANDSTONE: 41,
  GOLD_BLOCK: 42, IRON_BLOCK: 43, DIAMOND_BLOCK: 44,
  NETHERITE_BLOCK: 45, BRICK: 46, MOSSY_STONE_BRICKS: 47,
};

export { B };

export class World {
  constructor(seed = 42) {
    this.noise = new Noise(seed);
    this.chunks = new Map();
  }

  idx(x, y, z) { return x + z * CW + y * CW * CW; }

  getBlock(gx, gy, gz) {
    const cx = Math.floor(gx / CW), cz = Math.floor(gz / CW);
    const lx = ((gx % CW) + CW) % CW, lz = ((gz % CW) + CW) % CW;
    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return 0;
    if (gy < 0 || gy >= CH) return 0;
    return chunk[this.idx(lx, gy, lz)] || 0;
  }

  setBlock(gx, gy, gz, type) {
    const cx = Math.floor(gx / CW), cz = Math.floor(gz / CW);
    const lx = ((gx % CW) + CW) % CW, lz = ((gz % CW) + CW) % CW;
    const key = `${cx},${cz}`;
    let chunk = this.chunks.get(key);
    if (!chunk && type !== 0) {
      chunk = this.generateChunk(cx, cz);
    }
    if (!chunk) return;
    if (gy < 0 || gy >= CH) return;
    chunk[this.idx(lx, gy, lz)] = type;
  }

  getOrGenerate(cx, cz) {
    const key = `${cx},${cz}`;
    if (!this.chunks.has(key)) this.chunks.set(key, this.generateChunk(cx, cz));
    return this.chunks.get(key);
  }

  generateChunk(cx, cz) {
    const blocks = new Uint8Array(CW * CH * CW);
    const bx = cx * CW, bz = cz * CW;
    const rng = createRNG(cx * 7919 + cz * 9733 + 42);

    for (let lx = 0; lx < CW; lx++) {
      for (let lz = 0; lz < CW; lz++) {
        const wx = bx + lx, wz = bz + lz;

        const height = Math.max(1, Math.min(CH - 2,
          Math.floor(this.noise.octave(wx * 0.025, wz * 0.025, 4) * 8 + 8)));
        const moisture = this.noise.octave(wx * 0.01 + 500, wz * 0.01 + 500, 3);
        const biome = moisture > 0.6 ? 'desert' : moisture < -0.4 ? 'taiga' : 'plains';
        const treeRand = rng();

        for (let y = 0; y < CH; y++) {
          const i = this.idx(lx, y, lz);
          if (y === 0) { blocks[i] = B.BEDROCK; }
          else if (y < height - 4) { blocks[i] = B.STONE; }
          else if (y < height - 2) { blocks[i] = y < 10 ? B.DEEPSLATE : B.STONE; }
          else if (y < height - 1) { blocks[i] = biome === 'desert' ? B.SAND : B.DIRT; }
          else if (y === height - 1) {
            if (biome === 'desert') blocks[i] = B.SAND;
            else if (biome === 'taiga') blocks[i] = B.SNOW;
            else if (moisture > 0.2) blocks[i] = B.GRASS;
            else blocks[i] = B.DIRT;
          }

          // Ores
          if (blocks[i] === B.STONE && rng() < 0.0008) blocks[i] = B.DIAMOND_ORE;
          else if (blocks[i] === B.STONE && rng() < 0.002 && y < 40) blocks[i] = B.IRON_ORE;
          else if (blocks[i] === B.STONE && rng() < 0.002 && y < 50) blocks[i] = B.COAL_ORE;
          else if (blocks[i] === B.STONE && rng() < 0.001 && y < 35) blocks[i] = B.GOLD_ORE;
          else if (blocks[i] === B.STONE && rng() < 0.0005) blocks[i] = B.MOSSY_COBBLESTONE;
          else if (blocks[i] === B.STONE && rng() < 0.0003) blocks[i] = B.TUFF;
          else if (blocks[i] === B.STONE && rng() < 0.0003) blocks[i] = B.CALCITE;
          else if (blocks[i] === B.STONE && rng() < 0.0003) blocks[i] = B.MAGMA;
          else if (blocks[i] === B.STONE && rng() < 0.0002) blocks[i] = B.OBSIDIAN;
          else if (blocks[i] === B.DEEPSLATE && rng() < 0.001) blocks[i] = B.COBBLED_DEEPSLATE;
        }

        // Trees
        if (biome !== 'desert' && treeRand < 0.05 && height < CH - 6) {
          const logType = biome === 'taiga' ? B.SPRUCE_LOG : B.OAK_LOG;
          const leafType = biome === 'taiga' ? B.SPRUCE_LEAVES : B.OAK_LEAVES;
          const trunkH = biome === 'taiga' ? 6 : 4;
          for (let h = 1; h <= trunkH; h++) {
            blocks[this.idx(lx, height + h, lz)] = logType;
          }
          const leafStart = trunkH - 1;
          const leafR = biome === 'taiga' ? 1 : 2;
          for (let dy = leafStart; dy <= trunkH + 1; dy++) {
            for (let dx = -leafR; dx <= leafR; dx++) {
              for (let dz = -leafR; dz <= leafR; dz++) {
                const tx = lx + dx, tz = lz + dz;
                if (tx < 0 || tx >= CW || tz < 0 || tz >= CW) continue;
                if (Math.abs(dx) === leafR && Math.abs(dz) === leafR && rng() > 0.5) continue;
                const idx = this.idx(tx, height + dy, tz);
                if (blocks[idx] === 0) blocks[idx] = leafType;
              }
            }
          }
        }
      }
    }
    return blocks;
  }

  getChunkData(cx, cz) {
    const chunk = this.getOrGenerate(cx, cz);
    return { cx, cz, data: chunk.buffer.slice(0) };
  }
}
