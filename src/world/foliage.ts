import * as THREE from 'three';
import { elevation, nearCabin, nearPath, n2, onLand, random, shore, WATER_LEVEL } from './config';
import type { Season } from './config';
import { swayMaterial, weatheredMaterial } from './materials';
import type { NatureUniforms } from './terrain';
import type { WorldTextures } from './textures';

type TreePosition = { x: number; y: number; z: number; height: number; width: number };

const mirroredTreeUV = `
  #include <uv_vertex>
  #ifdef USE_MAP
    float mirrorSeed = fract(sin(instanceMatrix[3].x * 12.9898 + instanceMatrix[3].z * 78.233) * 43758.5453);
    if (mirrorSeed > 0.5) vMapUv.x = 1.0 - vMapUv.x;
  #endif
`;

export function buildForest(root: THREE.Group, textures: WorldTextures, uniforms: NatureUniforms) {
  const rand = random(16173);
  const pinePositions: TreePosition[] = [];
  const birchPositions: TreePosition[] = [];
  const occupied: { x: number; z: number }[] = [];
  for (let tries = 0; tries < 13000 && occupied.length < 237; tries++) {
    const x = (rand() - 0.5) * 22.1;
    const z = (rand() - 0.5) * 21.8;
    if (!onLand(x, z, 0.85) || nearCabin(x, z, 1.0) || nearPath(x, z, 0.8)) continue;
    const y = elevation(x, z);
    if (y > 4.05 || z > shore(x) - 1.15) continue;
    const forest = z < -2.5 || x < -7.7 || (x > 3 && z < 0.8) || (x < -5.8 && z < 0.1);
    if (!forest && rand() > 0.045) continue;
    if (occupied.some(p => Math.hypot(p.x - x, p.z - z) < 0.66)) continue;
    occupied.push({ x, z });
    const pine = rand() < (z < -3.3 ? 0.86 : 0.5);
    const height = (pine ? 2.9 : 3.0) + rand() * (pine ? 1.85 : 1.15) - Math.max(0, y - 1.6) * 0.36;
    const data = { x, y: y - 0.10, z, height, width: height * (pine ? 0.58 : 0.69) * (0.85 + rand() * 0.25) };
    (pine ? pinePositions : birchPositions).push(data);
  }

  const geometry = new THREE.PlaneGeometry(1, 1, 3, 8);
  geometry.translate(0, 0.475, 0);
  const make = (texture: THREE.Texture, type: 'pine' | 'birch' | 'bare', positions: TreePosition[]) => {
    const material = new THREE.MeshStandardMaterial({
      map: texture, alphaTest: 0.34, side: THREE.DoubleSide, roughness: 1,
      color: type === 'pine' ? '#c8d0b4' : '#dedec7',
      emissive: '#26341c', emissiveIntensity: 0.13,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.time;
      shader.uniforms.uWinter = uniforms.winter;
      shader.uniforms.uAutumn = uniforms.autumn;
      shader.uniforms.uSummer = uniforms.summer;
      shader.uniforms.uRain = uniforms.rain;
      shader.vertexShader = 'uniform float uTime, uRain;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', mirroredTreeUV);
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float phase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z;
        transformed.x += sin(uTime * 0.7 + phase) * pow(max(position.y, 0.0), 2.0) * (0.014 + uRain * 0.018);
      `);
      shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', `
        #include <defaultnormal_vertex>
        transformedNormal = normalize(normalMatrix * vec3(0.0, 0.92, 0.39));
      `);
      shader.fragmentShader = 'uniform float uWinter, uAutumn, uSummer;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        diffuseColor.rgb *= 0.8 + smoothstep(0.06, 0.52, vMapUv.y) * 0.2;
        float leafMask = smoothstep(0.01, 0.09, diffuseColor.g - diffuseColor.b);
        float luminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        ${type === 'birch' ? `
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(luminance * 1.67, luminance * 0.7, luminance * 0.18), leafMask * uAutumn);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.76, 0.93, 0.67), uSummer);
          diffuseColor.a *= 1.0 - uWinter;
        ` : type === 'pine' ? `
          float snow = smoothstep(0.023, 0.12, luminance) * 0.87;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.83, 0.81), snow * uWinter);
        ` : 'diffuseColor.a *= uWinter;'}
      `);
    };
    material.customProgramCacheKey = () => `tree-${type}`;
    const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
    const depthMaterial = new THREE.MeshDepthMaterial({
      map: texture, alphaTest: 0.34, depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide,
    });
    depthMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uWinter = uniforms.winter;
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', mirroredTreeUV);
      shader.fragmentShader = 'uniform float uWinter;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
        ${type === 'birch' ? 'diffuseColor.a *= 1.0 - uWinter;' : type === 'bare' ? 'diffuseColor.a *= uWinter;' : ''}
        #include <alphatest_fragment>
      `);
    };
    depthMaterial.customProgramCacheKey = () => `tree-depth-${type}`;
    mesh.customDepthMaterial = depthMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  };
  const pines = make(textures.spruce, 'pine', pinePositions);
  const birches = make(textures.birch, 'birch', birchPositions);
  const bare = make(textures.bare, 'bare', birchPositions);
  bare.visible = false;
  const dummy = new THREE.Object3D();
  let lastAngle = 100;
  const update = (camera: THREE.Camera) => {
    const angle = Math.atan2(camera.position.x, camera.position.z);
    if (Math.abs(angle - lastAngle) < 0.001) return;
    lastAngle = angle;
    const orient = (mesh: THREE.InstancedMesh, positions: TreePosition[]) => {
      positions.forEach((tree, i) => {
        dummy.position.set(tree.x, tree.y, tree.z);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(tree.width, tree.height, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    orient(pines, pinePositions);
    orient(birches, birchPositions);
    orient(bare, birchPositions);
  };
  return { update, setWinter: (winter: boolean) => { bare.visible = winter; } };
}

function bladeGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.025, 0, 0, 0.025, 0, 0,
    -0.016, 0.14, 0.012, 0.018, 0.14, 0.012,
    -0.003, 0.25, 0.032, 0.014, 0.25, 0.032,
    0.025, 0.34, 0.066,
  ], 3));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  geometry.computeVertexNormals();
  const normal = geometry.attributes.normal;
  for (let i = 0; i < normal.count; i++) normal.setXYZ(i, 0, 0.85, 0.35);
  return geometry;
}

export function flowerGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const petal = new THREE.Color('#f5f2e8');
  const center = new THREE.Color('#d7b44e');
  for (let i = 0; i < 6; i++) {
    const angle = i / 6 * Math.PI * 2;
    const left = angle - 0.29;
    const right = angle + 0.29;
    positions.push(0, 0, 0, Math.cos(left) * 0.067, 0.018, Math.sin(left) * 0.067, Math.cos(angle) * 0.089, 0.025, Math.sin(angle) * 0.089);
    positions.push(0, 0, 0, Math.cos(angle) * 0.089, 0.025, Math.sin(angle) * 0.089, Math.cos(right) * 0.067, 0.018, Math.sin(right) * 0.067);
    for (let j = 0; j < 6; j++) colors.push(petal.r, petal.g, petal.b);
    positions.push(0, 0.018, 0, Math.cos(angle) * 0.026, 0.019, Math.sin(angle) * 0.026, Math.cos(angle + Math.PI / 3) * 0.026, 0.019, Math.sin(angle + Math.PI / 3) * 0.026);
    for (let j = 0; j < 3; j++) colors.push(center.r, center.g, center.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildMeadow(root: THREE.Group, uniforms: NatureUniforms, compact: boolean) {
  const rand = random(8924);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const blade = bladeGeometry();
  const count = compact ? 22000 : 46000;
  const grass = new THREE.InstancedMesh(blade, swayMaterial({
    color: '#c5c9aa', side: THREE.DoubleSide, roughness: 1,
  }, uniforms, 1.1), count);
  let i = 0;
  while (i < count) {
    const x = (rand() - 0.5) * 23.8;
    const z = (rand() - 0.5) * 23.8;
    const y = elevation(x, z);
    if (!onLand(x, z, 0.12) || y > 3.4 || nearCabin(x, z, 0.15) || nearPath(x, z, 0.26)) continue;
    const scale = 0.44 + rand() * 0.9;
    dummy.position.set(x, y - 0.015, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, (rand() - 0.5) * 0.15);
    dummy.scale.set(scale, scale * (0.7 + rand() * 0.7), scale);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    const forestShade = x < -7.5 || z < -2 ? -0.035 : 0.025;
    color.setHSL(0.205 + rand() * 0.075, 0.26 + rand() * 0.17, 0.19 + rand() * 0.105 + forestShade);
    grass.setColorAt(i, color);
    i++;
  }
  grass.receiveShadow = true;
  root.add(grass);

  const flowerCount = compact ? 1450 : 2600;
  const flowers = new THREE.InstancedMesh(flowerGeometry(), swayMaterial({
    color: '#ffffff', vertexColors: true, roughness: 0.9, side: THREE.DoubleSide,
  }, uniforms, 1.1), flowerCount);
  i = 0;
  while (i < flowerCount) {
    const x = -11.5 + rand() * 14.5;
    const z = -2.0 + rand() * 13;
    if (!onLand(x, z, 0.45) || nearCabin(x, z, 0.3) || nearPath(x, z, 0.4) || elevation(x, z) > 1.8) continue;
    if (n2(x * 0.8, z * 0.8) > 0.16 && rand() < 0.85) continue;
    const size = 0.43 + rand() * 0.55;
    dummy.position.set(x, elevation(x, z) + 0.13 + rand() * 0.16, z);
    dummy.rotation.set((rand() - 0.5) * 0.55, rand() * 6.28, (rand() - 0.5) * 0.6);
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    const c = rand();
    color.set(c < 0.58 ? '#fffdf1' : c < 0.76 ? '#efd571' : c < 0.91 ? '#dca3ba' : '#9fafd1');
    flowers.setColorAt(i, color);
    i++;
  }
  flowers.receiveShadow = true;
  root.add(flowers);
  buildFerns(root, uniforms);
  return {
    setSeason: (season: Season) => {
      flowers.count = Math.round(flowerCount * ({ spring: 1, summer: 0.63, autumn: 0.09, winter: 0 }[season]));
    },
  };
}

function buildFerns(root: THREE.Group, uniforms: NatureUniforms) {
  const positions: number[] = [];
  for (let frond = 0; frond < 7; frond++) {
    const angle = frond / 7 * Math.PI * 2;
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      const length = (1 - t) * 0.14;
      const x = t * 0.47;
      const y = Math.sin(t * 2.3) * 0.44;
      for (const side of [-1, 1]) {
        const local = [[x - 0.045, y - 0.012, 0], [x + 0.04, y + 0.03, side * length], [x + 0.055, y + 0.01, 0]];
        local.forEach(([px, py, pz]) => positions.push(px * Math.cos(angle) - pz * Math.sin(angle), py, px * Math.sin(angle) + pz * Math.cos(angle)));
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const ferns = new THREE.InstancedMesh(geometry, swayMaterial({ color: '#4b6731', roughness: 1, side: THREE.DoubleSide }, uniforms, 0.15), 330);
  const rand = random(8483);
  const dummy = new THREE.Object3D();
  let i = 0;
  while (i < 330) {
    const x = (rand() - 0.5) * 22.8;
    const z = (rand() - 0.5) * 21;
    if (!onLand(x, z, 0.7) || nearCabin(x, z, 0.3) || nearPath(x, z, 0.6) || elevation(x, z) > 2.8) continue;
    dummy.position.set(x, elevation(x, z), z);
    dummy.rotation.set(0, rand() * 6.28, 0);
    dummy.scale.setScalar(0.45 + rand() * 0.85);
    dummy.updateMatrix();
    ferns.setMatrixAt(i++, dummy.matrix);
  }
  ferns.receiveShadow = true;
  root.add(ferns);
}

export function buildShore(root: THREE.Group, textures: WorldTextures, uniforms: NatureUniforms) {
  const rand = random(1712);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const rockGeometry = new THREE.IcosahedronGeometry(1, 2);
  const pos = rockGeometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const d = 0.86 + n2(x * 2.7 + y, z * 2.7) * 0.28;
    pos.setXYZ(i, x * d, y * d, z * d);
  }
  rockGeometry.computeVertexNormals();
  const rocks = new THREE.InstancedMesh(rockGeometry, weatheredMaterial({
    map: textures.rock, bumpMap: textures.rock, bumpScale: 0.13, roughness: 0.95,
  }, uniforms, 0.8), 1250);
  for (let i = 0; i < 1250; i++) {
    let x: number, z: number;
    if (i < 940) {
      x = -11.8 + rand() * 23.6;
      z = Math.min(11.85, shore(x) + (rand() - 0.5) * 1.6);
    } else {
      x = (rand() - 0.5) * 23.7;
      z = (rand() - 0.5) * 23.7;
    }
    const size = i < 65 ? 0.19 + rand() * 0.35 : 0.027 + Math.pow(rand(), 2) * 0.14;
    dummy.position.set(x, elevation(x, z) + size * 0.28, z);
    dummy.rotation.set(rand() * 2, rand() * 6.28, rand());
    dummy.scale.set(size * (1 + rand() * 0.5), size * (0.5 + rand() * 0.4), size);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.13 + rand() * 0.08, 0.06 + rand() * 0.10, 0.36 + rand() * 0.18);
    rocks.setColorAt(i, color);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  root.add(rocks);

  const boulders = [[7.8, 5.4, 0.8], [8.75, 5.7, 0.45], [-1.4, 3.8, 0.52], [2.6, 1.95, 0.48], [-9.9, 8.5, 0.58], [9.5, -3.7, 0.74], [-8.6, 1.5, 0.47]];
  boulders.forEach(([x, z, size]) => {
    const rock = new THREE.Mesh(rockGeometry, rocks.material);
    rock.scale.set(size * 1.35, size * 0.78, size);
    rock.position.set(x, Math.max(elevation(x, z) + size * 0.25, WATER_LEVEL - size * 0.05), z);
    rock.rotation.set(0.12, rand() * 6.28, 0.14);
    rock.castShadow = true;
    rock.receiveShadow = true;
    root.add(rock);
  });

  const reeds = new THREE.InstancedMesh(bladeGeometry(), swayMaterial({ color: '#7d854a', roughness: 1, side: THREE.DoubleSide }, uniforms, 0.7), 1300);
  const heads = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.018, 0.14, 3, 5), new THREE.MeshStandardMaterial({ color: '#655039', roughness: 1 }), 120);
  let index = 0;
  for (let clump = 0; clump < 130; clump++) {
    const x = -11.3 + rand() * 22.2;
    const z = shore(x) - 0.1 + rand() * 0.26;
    for (let blade = 0; blade < 10; blade++) {
      const px = x + (rand() - 0.5) * 0.3;
      const pz = z + (rand() - 0.5) * 0.3;
      const y = Math.max(elevation(px, pz), -0.15);
      dummy.position.set(px, y, pz);
      dummy.rotation.set(0, rand() * 6.28, (rand() - 0.5) * 0.24);
      const height = 1.7 + rand() * 1.5;
      dummy.scale.set(0.65 + rand() * 0.7, height, 1);
      dummy.updateMatrix();
      reeds.setMatrixAt(index++, dummy.matrix);
      if (blade === 0 && clump < 120) {
        dummy.position.y += 0.31 * height;
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        heads.setMatrixAt(clump, dummy.matrix);
      }
    }
  }
  reeds.receiveShadow = true;
  root.add(reeds, heads);

  const pads = new THREE.InstancedMesh(new THREE.CircleGeometry(0.17, 24, 0.14, Math.PI * 2 - 0.28), new THREE.MeshStandardMaterial({
    color: '#436940', roughness: 0.44, side: THREE.DoubleSide,
  }), 105);
  const lilies = new THREE.InstancedMesh(flowerGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, color: '#f0d8df', roughness: 0.58, side: THREE.DoubleSide }), 28);
  for (let i = 0; i < 105; i++) {
    const cluster = i % 3;
    const x = [-1.5, 8.6, -8.0][cluster] + (rand() - 0.5) * 2.3;
    const z = shore(x) + 0.5 + rand() * 1.4;
    dummy.position.set(x, WATER_LEVEL + 0.02 + rand() * 0.006, z);
    dummy.rotation.set(-Math.PI / 2, 0, rand() * 6.28);
    dummy.scale.setScalar(0.48 + rand() * 0.9);
    dummy.updateMatrix();
    pads.setMatrixAt(i, dummy.matrix);
    if (i < 28) {
      dummy.position.y += 0.04;
      dummy.rotation.set(0, rand() * 6.28, 0);
      dummy.scale.setScalar(0.72);
      dummy.updateMatrix();
      lilies.setMatrixAt(i, dummy.matrix);
    }
  }
  pads.receiveShadow = true;
  root.add(pads, lilies);
  return {
    setSeason: (season: Season) => {
      pads.visible = season !== 'winter';
      lilies.visible = season === 'spring' || season === 'summer';
      heads.visible = season !== 'winter';
    },
  };
}