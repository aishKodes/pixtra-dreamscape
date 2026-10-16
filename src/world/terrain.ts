import * as THREE from 'three';
import { CABIN, elevation, FLOOR, HALF, n2, pathX, random, shore, WATER_LEVEL } from './config';
import type { WorldTextures } from './textures';

export type NatureUniforms = {
  time: { value: number };
  autumn: { value: number };
  winter: { value: number };
  summer: { value: number };
  rain: { value: number };
  cloud: { value: number };
};

export function buildTerrain(root: THREE.Group, textures: WorldTextures, uniforms: NatureUniforms) {
  const resolution = 210;
  const geometry = new THREE.PlaneGeometry(HALF * 2, HALF * 2, resolution, resolution);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    positions.setY(i, elevation(x, z));
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0, map: textures.ground });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRock = { value: textures.rock };
    shader.uniforms.uWinter = uniforms.winter;
    shader.uniforms.uAutumn = uniforms.autumn;
    shader.uniforms.uSummer = uniforms.summer;
    shader.uniforms.uRain = uniforms.rain;
    shader.vertexShader = 'varying vec3 vLand; varying vec3 vLandNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLand = position; vLandNormal = normal;');
    shader.fragmentShader = `
      varying vec3 vLand;
      varying vec3 vLandNormal;
      uniform sampler2D uRock;
      uniform float uWinter, uAutumn, uSummer, uRain;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 meadow = texture2D(map, vLand.xz * 0.24).rgb;
      vec3 rock = texture2D(uRock, vLand.xz * 0.31 + vLand.yy * 0.17).rgb;
      vec3 detail = texture2D(uRock, vLand.xz * 2.5).rgb;
      meadow *= mix(vec3(1.09, 1.04, 0.88), vec3(0.8, 0.93, 0.72), uSummer);
      meadow = mix(meadow, meadow * vec3(1.32, 0.96, 0.6), uAutumn * 0.85);
      float cliff = max(smoothstep(1.85, 4.6, vLand.y), smoothstep(0.63, 0.9, 1.0 - vLandNormal.y));
      vec3 base = mix(meadow, rock * vec3(0.9, 0.94, 0.9), cliff);
      float bank = 1.0 - smoothstep(0.2, 0.61, vLand.y);
      base = mix(base, rock * vec3(0.86, 0.81, 0.57), bank);
      float snowline = mix(5.55 + uSummer * 0.8, 0.25, uWinter);
      float snow = smoothstep(snowline - 0.32, snowline + 0.35, vLand.y + (rock.g - 0.26) * 2.6);
      snow *= smoothstep(0.19, 0.72, vLandNormal.y + uWinter * 0.22);
      base = mix(base, vec3(0.88, 0.91, 0.9) * (0.9 + detail.r * 0.27), snow);
      base *= 1.0 - uRain * 0.16;
      diffuseColor.rgb *= base;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor -= uRain * 0.19;');
  };
  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  root.add(terrain);

  const sidePositions: number[] = [];
  const sideUVs: number[] = [];
  const sideIndices: number[] = [];
  const steps = 160;
  for (let side = 0; side < 4; side++) {
    const start = sidePositions.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = -HALF + (i / steps) * HALF * 2;
      const x = side === 0 ? t : side === 1 ? HALF : side === 2 ? -t : -HALF;
      const z = side === 0 ? -HALF : side === 1 ? t : side === 2 ? HALF : -t;
      const top = elevation(x, z);
      for (let row = 0; row <= 4; row++) {
        const y = FLOOR + (top - FLOOR) * row / 4;
        sidePositions.push(x, y, z);
        sideUVs.push(i / steps * 4, (y - FLOOR) * 0.5);
      }
      if (i < steps) {
        for (let row = 0; row < 4; row++) {
          const a = start + i * 5 + row;
          sideIndices.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
        }
      }
    }
  }
  const sidesGeometry = new THREE.BufferGeometry();
  sidesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sidePositions, 3));
  sidesGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(sideUVs, 2));
  sidesGeometry.setIndex(sideIndices);
  sidesGeometry.computeVertexNormals();
  const sides = new THREE.Mesh(sidesGeometry, new THREE.MeshStandardMaterial({
    map: textures.soil, bumpMap: textures.soil, bumpScale: 0.08,
    color: '#b1a189', roughness: 1, side: THREE.DoubleSide,
  }));
  sides.castShadow = true;
  sides.receiveShadow = true;
  root.add(sides);

  const bottom = new THREE.Mesh(new THREE.BoxGeometry(24, 0.09, 24), new THREE.MeshStandardMaterial({ color: '#3d3b2d', roughness: 1 }));
  bottom.position.y = FLOOR;
  bottom.castShadow = true;
  root.add(bottom);
  buildLakeEdges(root);
  buildPath(root, textures);
  return terrain;
}

function buildLakeEdges(root: THREE.Group) {
  const vertices: number[] = [];
  const colors: number[] = [];
  const top = new THREE.Color('#65aaa0');
  const deep = new THREE.Color('#21574d');
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 160; i++) {
      const a = -HALF + i / 160 * 24;
      const b = -HALF + (i + 1) / 160 * 24;
      const x1 = side === 0 ? a : side === 1 ? HALF : side === 2 ? -a : -HALF;
      const z1 = side === 0 ? -HALF : side === 1 ? a : side === 2 ? HALF : -a;
      const x2 = side === 0 ? b : side === 1 ? HALF : side === 2 ? -b : -HALF;
      const z2 = side === 0 ? -HALF : side === 1 ? b : side === 2 ? HALF : -b;
      if (z1 < shore(x1) || z2 < shore(x2)) continue;
      const y1 = elevation(x1, z1);
      const y2 = elevation(x2, z2);
      vertices.push(x1, WATER_LEVEL, z1, x1, y1, z1, x2, WATER_LEVEL, z2, x2, WATER_LEVEL, z2, x1, y1, z1, x2, y2, z2);
      [top, deep, top, top, deep, deep].forEach(c => colors.push(c.r, c.g, c.b));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const edges = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.17, metalness: 0.05, transparent: true, opacity: 0.83,
    side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 0.7,
  }));
  root.add(edges);
}

function buildPath(root: THREE.Group, textures: WorldTextures) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const rand = random(471);
  const count = 120;
  for (let i = 0; i <= count; i++) {
    const z = 1.35 + i / count * 8.25;
    const x = pathX(z);
    const width = 0.28 + n2(z * 2, 0) * 0.09;
    for (let side = -1; side <= 1; side += 2) {
      const px = x + side * width + (rand() - 0.5) * 0.06;
      positions.push(px, elevation(px, z) + 0.025, z);
      uvs.push(side === -1 ? 0 : 1, i / count * 9);
    }
    if (i < count) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const path = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: textures.rock, color: '#b9a98a', roughness: 1, side: THREE.DoubleSide,
    transparent: true, opacity: 0.85,
  }));
  path.receiveShadow = true;
  root.add(path);

  const patch = new THREE.Mesh(new THREE.CircleGeometry(1.05, 48), new THREE.MeshStandardMaterial({ map: textures.ground, color: '#a69c72', roughness: 1 }));
  patch.rotation.x = -Math.PI / 2;
  patch.scale.set(1.5, 0.7, 1);
  patch.position.set(CABIN.x, 0.95, CABIN.z + 1.2);
  patch.receiveShadow = true;
  root.add(patch);
}