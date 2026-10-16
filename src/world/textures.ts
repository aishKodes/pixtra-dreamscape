import * as THREE from 'three';
import { fbm, n2, random } from './config';

export type WorldTextures = {
  ground: THREE.Texture;
  rock: THREE.Texture;
  wood: THREE.Texture;
  spruce: THREE.Texture;
  birch: THREE.Texture;
  bare: THREE.Texture;
  cloud: THREE.Texture;
  glow: THREE.Texture;
  waterNormal: THREE.Texture;
  soil: THREE.Texture;
};

function canvas(size: number, height = size) {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = height;
  const ctx = element.getContext('2d')!;
  return { element, ctx };
}

function textureFrom(element: HTMLCanvasElement, repeat = false) {
  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

async function loadTexture(url: string, keyed = false) {
  const image = new Image();
  image.src = url;
  await image.decode();
  if (!keyed) {
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }

  const { element, ctx } = canvas(image.width, image.height);
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, element.width, element.height);
  const data = pixels.data;
  // Remove the photographic asset's chroma backdrop, including fine leaf edges.
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = Math.max(0, Math.min(1, Math.min((r - g - 19) / 34, (b - g - 9) / 25)));
    data[i + 3] = Math.round(255 * (1 - key));
    if (key > 0.02) {
      data[i] = Math.min(r, g * 1.18 + 14);
      data[i + 2] = Math.min(b, g + 10);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return textureFrom(element);
}

function makeCloud() {
  const { element, ctx } = canvas(256);
  const pixels = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = (x - 128) / 124;
      const dy = (y - 128) / 124;
      const falloff = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      const value = Math.pow(falloff, 1.7) * (0.55 + fbm(x * 0.028, y * 0.028) * 0.75);
      const i = (y * 256 + x) * 4;
      pixels.data[i] = 240;
      pixels.data[i + 1] = 243;
      pixels.data[i + 2] = 232;
      pixels.data[i + 3] = Math.max(0, value * 255);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return textureFrom(element);
}

function makeGlow() {
  const { element, ctx } = canvas(64);
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.13)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return textureFrom(element);
}

function makeWaterNormal() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = n2(x * 0.15, y * 0.15) * 0.45 + Math.sin(x * 0.45 + Math.sin(y * 0.12) * 2) * 0.2;
      const ny = n2(x * 0.15 + 4, y * 0.15 + 4) * 0.45 + Math.cos(y * 0.4 + x * 0.07) * 0.18;
      const i = (y * size + x) * 4;
      data[i] = 128 + nx * 95;
      data[i + 1] = 128 + ny * 95;
      data[i + 2] = 249;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function makeSoil() {
  const { element, ctx } = canvas(512, 256);
  const pixels = ctx.createImageData(512, 256);
  const rand = random(992);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 512; x++) {
      const grain = rand() * 21;
      const strata = Math.sin(y * 0.28 + fbm(x * 0.014, y * 0.024) * 5) * 8;
      const mottling = fbm(x * 0.085, y * 0.09) * 42;
      const root = Math.pow(Math.max(0, Math.sin(x * 0.54 + Math.sin(y * 0.09) * 0.8)), 22) * 16;
      const value = 57 + grain + strata + mottling - root;
      const i = (y * 512 + x) * 4;
      pixels.data[i] = value * 1.13;
      pixels.data[i + 1] = value * 0.98;
      pixels.data[i + 2] = value * 0.73;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return textureFrom(element, true);
}

function fallbackTexture(color: string) {
  const { element, ctx } = canvas(16);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 16, 16);
  return textureFrom(element, true);
}

function fallbackTree(evergreen: boolean) {
  const { element, ctx } = canvas(256, 512);
  const rand = random(46);
  ctx.fillStyle = '#5a503b';
  ctx.fillRect(124, 95, 9, 410);
  for (let i = 0; i < 3000; i++) {
    const y = 30 + rand() * (evergreen ? 410 : 330);
    const radius = evergreen ? y * 0.23 : Math.sqrt(Math.max(0, 1 - Math.pow((y - 190) / 165, 2))) * 102;
    const x = 128 + (rand() - 0.5) * radius * 2;
    ctx.fillStyle = `hsl(${evergreen ? 112 : 83}, ${22 + rand() * 20}%, ${16 + rand() * 29}%)`;
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + rand() * 6, 2 + rand() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return textureFrom(element);
}

export async function loadWorldTextures(): Promise<WorldTextures> {
  const results = await Promise.allSettled([
    loadTexture('/textures/ground.jpg'),
    loadTexture('/textures/rock.jpg'),
    loadTexture('/textures/wood.jpg'),
    loadTexture('/textures/spruce.png', true),
    loadTexture('/textures/birch.png', true),
    loadTexture('/textures/birch-winter.png', true),
  ]);
  const pick = (index: number, fallback: () => THREE.Texture) => {
    const result = results[index];
    return result.status === 'fulfilled' ? result.value : fallback();
  };
  return {
    ground: pick(0, () => fallbackTexture('#6f7d45')),
    rock: pick(1, () => fallbackTexture('#777b72')),
    wood: pick(2, () => fallbackTexture('#665642')),
    spruce: pick(3, () => fallbackTree(true)),
    birch: pick(4, () => fallbackTree(false)),
    bare: pick(5, () => fallbackTree(false)),
    cloud: makeCloud(),
    glow: makeGlow(),
    waterNormal: makeWaterNormal(),
    soil: makeSoil(),
  };
}

export function makeEnvironment(renderer: THREE.WebGLRenderer) {
  const { element, ctx } = canvas(1024, 512);
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#9fb9c5');
  gradient.addColorStop(0.35, '#dce4db');
  gradient.addColorStop(0.52, '#eeebd5');
  gradient.addColorStop(0.61, '#78876b');
  gradient.addColorStop(1, '#3b4a32');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);
  const sun = ctx.createRadialGradient(230, 165, 0, 230, 165, 100);
  sun.addColorStop(0, 'rgba(255,250,224,1)');
  sun.addColorStop(0.05, 'rgba(255,248,212,1)');
  sun.addColorStop(0.3, 'rgba(255,247,220,0.2)');
  sun.addColorStop(1, 'rgba(255,248,230,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 1024, 512);
  const texture = textureFrom(element);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromEquirectangular(texture);
  texture.dispose();
  generator.dispose();
  return target;
}