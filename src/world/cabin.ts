import * as THREE from 'three';
import { CABIN, elevation, random, WATER_LEVEL } from './config';
import { weatheredMaterial } from './materials';
import { batchStaticParts } from './optimize';
import type { NatureUniforms } from './terrain';
import type { WorldTextures } from './textures';

type Material = THREE.Material | THREE.Material[];

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: Material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent: THREE.Object3D, material: Material, size: [number, number, number], position: [number, number, number]) {
  return mesh(parent, new THREE.BoxGeometry(...size), material, ...position);
}

function beam(parent: THREE.Object3D, material: Material, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const object = mesh(parent, new THREE.CylinderGeometry(radius * 0.84, radius, direction.length(), 9), material);
  object.position.copy(a).add(b).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return object;
}

export function buildCabin(root: THREE.Group, textures: WorldTextures, uniforms: NatureUniforms) {
  const rand = random(839);
  const wood = weatheredMaterial({
    map: textures.wood, bumpMap: textures.wood, bumpScale: 0.047,
    color: '#b5a58a', roughness: 0.96,
  }, uniforms, 0.25);
  const darkWood = weatheredMaterial({ map: textures.wood, color: '#7e6e52', roughness: 1 }, uniforms, 0.15);
  const trim = new THREE.MeshStandardMaterial({ map: textures.wood, color: '#897654', roughness: 0.87 });
  const dark = new THREE.MeshStandardMaterial({ color: '#24281e', roughness: 0.96 });
  const stone = weatheredMaterial({ map: textures.rock, bumpMap: textures.rock, bumpScale: 0.065, color: '#a5a695', roughness: 1 }, uniforms, 0.45);
  const roofMat = weatheredMaterial({ map: textures.wood, bumpMap: textures.wood, bumpScale: 0.065, roughness: 0.96 }, uniforms, 0.85);
  const glass = new THREE.MeshStandardMaterial({ color: '#b2934d', emissive: '#da9c38', emissiveIntensity: 0.55, roughness: 0.24, metalness: 0.15 });
  const cabin = new THREE.Group();
  cabin.position.set(CABIN.x, 0.94, CABIN.z);
  root.add(cabin);

  box(cabin, dark, [2.86, 1.27, 2.08], [0, 0.72, 0]);
  box(cabin, stone, [3.02, 0.23, 2.27], [0, 0.05, 0]);
  const stoneGeo = new THREE.IcosahedronGeometry(1, 1);
  const foundation = new THREE.InstancedMesh(stoneGeo, stone, 54);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 54; i++) {
    const side = i % 4;
    const t = Math.floor(i / 4) / 13;
    dummy.position.set(side === 0 ? -1.45 + t * 2.9 : side === 1 ? 1.47 : side === 2 ? 1.45 - t * 2.9 : -1.47, 0.08, side === 0 ? -1.08 : side === 1 ? -1.03 + t * 2.06 : side === 2 ? 1.08 : 1.03 - t * 2.06);
    dummy.rotation.set(rand() * 0.3, rand() * 6.28, rand() * 0.2);
    dummy.scale.set(0.18 + rand() * 0.09, 0.12, 0.12);
    dummy.updateMatrix();
    foundation.setMatrixAt(i, dummy.matrix);
  }
  foundation.castShadow = true;
  cabin.add(foundation);

  const longLog = new THREE.CylinderGeometry(0.075, 0.083, 3.13, 12);
  const sideLog = new THREE.CylinderGeometry(0.074, 0.079, 2.37, 12);
  for (let row = 0; row < 9; row++) {
    const y = 0.23 + row * 0.132;
    const shift = row % 2 === 0 ? 0.025 : -0.025;
    for (const side of [-1, 1]) {
      mesh(cabin, longLog, wood, shift, y, side * 1.04).rotation.z = Math.PI / 2;
      mesh(cabin, sideLog, wood, side * 1.43, y + 0.013, -shift).rotation.x = Math.PI / 2;
    }
  }
  for (let row = 0; row < 7; row++) {
    const width = 2.8 * (1 - row / 7.5);
    const geometry = new THREE.CylinderGeometry(0.07, 0.072, width, 10);
    for (const side of [-1, 1]) mesh(cabin, geometry, wood, 0, 1.4 + row * 0.113, side * 1.04).rotation.z = Math.PI / 2;
  }

  const half = 1.71;
  const rise = 0.89;
  const pitch = Math.atan2(rise, half);
  const slope = Math.hypot(half, rise);
  for (const side of [-1, 1]) {
    const roof = box(cabin, darkWood, [slope + 0.06, 0.055, 2.76], [side * half / 2, 2.21 - rise / 2, 0]);
    roof.rotation.z = -side * pitch;
  }
  const shingles = new THREE.InstancedMesh(new THREE.BoxGeometry(slope / 8 + 0.038, 0.044, 0.25), roofMat, 192);
  const color = new THREE.Color();
  let shingle = 0;
  for (const side of [-1, 1]) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 12; col++) {
        const t = (row + 0.5) / 8;
        dummy.position.set(side * half * t, 2.245 - rise * t + (rand() - 0.5) * 0.016, -1.35 + (col + 0.5) * 0.225);
        dummy.rotation.set((rand() - 0.5) * 0.035, 0, -side * pitch + (rand() - 0.5) * 0.025);
        dummy.scale.set(1, 1, 0.91 + rand() * 0.14);
        dummy.updateMatrix();
        shingles.setMatrixAt(shingle, dummy.matrix);
        color.setHSL(0.135 + rand() * 0.075, 0.12 + rand() * 0.15, 0.23 + rand() * 0.15);
        shingles.setColorAt(shingle++, color);
      }
    }
  }
  shingles.castShadow = true;
  shingles.receiveShadow = true;
  cabin.add(shingles);
  mesh(cabin, new THREE.CylinderGeometry(0.066, 0.066, 2.83, 9), darkWood, 0, 2.27, 0).rotation.x = Math.PI / 2;

  box(cabin, dark, [0.57, 0.95, 0.055], [0.1, 0.63, 1.135]);
  for (let i = 0; i < 5; i++) box(cabin, i % 2 ? darkWood : trim, [0.094, 0.89, 0.03], [-0.1 + i * 0.102, 0.62, 1.173]);
  box(cabin, trim, [0.065, 1.03, 0.08], [-0.21, 0.65, 1.175]);
  box(cabin, trim, [0.065, 1.03, 0.08], [0.41, 0.65, 1.175]);
  box(cabin, trim, [0.68, 0.069, 0.085], [0.1, 1.15, 1.175]);
  mesh(cabin, new THREE.SphereGeometry(0.023, 8, 6), dark, 0.27, 0.62, 1.212);

  const windowAt = (x: number, y: number, z: number, rotation = 0) => {
    const window = new THREE.Group();
    window.position.set(x, y, z);
    window.rotation.y = rotation;
    cabin.add(window);
    box(window, dark, [0.57, 0.57, 0.065], [0, 0, 0]);
    box(window, glass, [0.43, 0.42, 0.019], [0, 0, 0.045]);
    for (const side of [-1, 1]) {
      box(window, trim, [0.049, 0.57, 0.072], [side * 0.26, 0, 0.04]);
      box(window, trim, [0.55, 0.05, 0.072], [0, side * 0.26, 0.04]);
    }
    box(window, trim, [0.033, 0.48, 0.055], [0, 0, 0.06]);
    box(window, trim, [0.48, 0.033, 0.055], [0, 0, 0.06]);
    box(window, wood, [0.67, 0.055, 0.16], [0, -0.3, 0.05]);
  };
  windowAt(-0.87, 0.89, 1.135);
  windowAt(1.515, 0.89, 0.03, Math.PI / 2);

  for (let i = 0; i < 12; i++) box(cabin, i % 3 === 0 ? darkWood : wood, [0.24, 0.06, 0.88], [-1.36 + i * 0.249, 0.18, 1.6]);
  for (const x of [-1.32, 1.32]) {
    box(cabin, darkWood, [0.1, 0.45, 0.11], [x, 0.04, 1.93]);
    box(cabin, wood, [0.075, 0.64, 0.075], [x, 0.49, 1.95]);
  }
  box(cabin, wood, [0.095, 0.065, 0.78], [-1.32, 0.78, 1.59]);
  box(cabin, wood, [0.095, 0.065, 0.78], [1.32, 0.78, 1.59]);
  for (let i = 0; i < 3; i++) box(cabin, wood, [0.94, 0.095, 0.28], [0.1, 0.16 - i * 0.065, 2.03 + i * 0.17]);

  const chimney = new THREE.Group();
  chimney.position.set(0.89, 1.53, -0.49);
  cabin.add(chimney);
  box(chimney, dark, [0.38, 1.19, 0.37], [0, 0.53, 0]);
  const chimneyStones = new THREE.InstancedMesh(new THREE.BoxGeometry(0.21, 0.13, 0.16), stone, 64);
  for (let row = 0; row < 8; row++) {
    for (let side = 0; side < 4; side++) {
      for (let j = 0; j < 2; j++) {
        const t = (j - 0.5) * 0.205 + (row % 2 ? 0.02 : -0.015);
        dummy.position.set(side % 2 ? (side === 1 ? 0.17 : -0.17) : t, row * 0.137, side % 2 ? t : side === 0 ? 0.17 : -0.17);
        dummy.rotation.set(rand() * 0.035, side * Math.PI / 2, (rand() - 0.5) * 0.07);
        dummy.scale.set(0.88 + rand() * 0.21, 0.9 + rand() * 0.1, 1);
        dummy.updateMatrix();
        chimneyStones.setMatrixAt(row * 8 + side * 2 + j, dummy.matrix);
      }
    }
  }
  chimneyStones.castShadow = true;
  chimney.add(chimneyStones);
  box(chimney, stone, [0.49, 0.1, 0.47], [0, 1.08, 0]);
  box(chimney, dark, [0.22, 0.012, 0.22], [0, 1.136, 0]);

  const logs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.065, 0.073, 0.58, 9), wood, 24);
  for (let i = 0; i < 24; i++) {
    const row = Math.floor(i / 6);
    dummy.position.set(1.67 + (i % 6) * 0.125 - row * 0.025, 0.13 + row * 0.119, 0.53 + rand() * 0.045);
    dummy.rotation.set(Math.PI / 2, 0, (rand() - 0.5) * 0.14);
    dummy.scale.setScalar(0.91 + rand() * 0.13);
    dummy.updateMatrix();
    logs.setMatrixAt(i, dummy.matrix);
  }
  logs.castShadow = true;
  cabin.add(logs);
  buildWell(root, wood, stone, dark, roofMat);
  buildFence(root, wood);
  buildDeadwood(root, wood, darkWood);

  const staticGroups: THREE.Group[] = [];
  root.traverse(object => { if (object instanceof THREE.Group) staticGroups.push(object); });
  staticGroups.reverse().forEach(batchStaticParts);

  return { smokeOrigin: new THREE.Vector3(CABIN.x + 0.89, 0.94 + 2.69, CABIN.z - 0.49) };
}

function buildWell(root: THREE.Group, wood: Material, stone: Material, dark: Material, roof: Material) {
  const well = new THREE.Group();
  well.position.set(-7.1, elevation(-7.1, 1.6), 1.6);
  root.add(well);
  mesh(well, new THREE.CylinderGeometry(0.29, 0.29, 0.035, 24), dark, 0, 0.20, 0);
  const stones = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.115, 0.14), stone, 48);
  const dummy = new THREE.Object3D();
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2 + row % 2 * Math.PI / 12;
      dummy.position.set(Math.cos(angle) * 0.32, 0.045 + row * 0.114, Math.sin(angle) * 0.32);
      dummy.rotation.set(0, -angle - Math.PI / 2, 0);
      dummy.updateMatrix();
      stones.setMatrixAt(row * 12 + i, dummy.matrix);
    }
  }
  stones.castShadow = true;
  well.add(stones);
  for (const x of [-0.4, 0.4]) box(well, wood, [0.074, 1.04, 0.073], [x, 0.55, 0]);
  mesh(well, new THREE.CylinderGeometry(0.04, 0.04, 0.94, 10), wood, 0, 0.82, 0).rotation.z = Math.PI / 2;
  beam(well, dark, new THREE.Vector3(0, 0.83, 0), new THREE.Vector3(0, 0.25, 0), 0.008);
  for (const side of [-1, 1]) {
    const part = box(well, roof, [0.6, 0.06, 0.82], [side * 0.24, 1.15, 0]);
    part.rotation.z = -side * 0.42;
  }
  mesh(well, new THREE.CylinderGeometry(0.085, 0.065, 0.13, 10), wood, 0.57, 0.09, 0.12);
}

function buildFence(root: THREE.Group, wood: Material) {
  const points = [[-8.35, 0.35], [-8.25, 1.22], [-8.15, 2.1], [-8.37, 2.97], [-8.7, 3.7]];
  points.forEach(([x, z], i) => {
    const y = elevation(x, z);
    const post = box(root, wood, [0.071, 0.6, 0.075], [x, y + 0.25, z]);
    post.rotation.z = i % 2 ? 0.035 : -0.045;
    if (i > 0) {
      const [px, pz] = points[i - 1];
      for (const h of [0.19, 0.42]) beam(root, wood, new THREE.Vector3(px, elevation(px, pz) + h, pz), new THREE.Vector3(x, y + h, z), 0.027);
    }
  });
}

function buildDeadwood(root: THREE.Group, wood: Material, darkWood: Material) {
  const rand = random(36);
  const logs = [[-2.0, 3.55, 1.6, 0.44], [7.3, 4.55, 2.5, -0.45], [-9.0, -0.9, 1.9, 1.15], [4.3, -1.2, 1.35, 0.4], [-10.25, 6.4, 1.45, -0.85], [7.6, -4.0, 2, 0.73]];
  for (const [x, z, length, angle] of logs) {
    const ground = elevation(x, z);
    const y = Math.max(ground + 0.13, WATER_LEVEL + 0.035);
    const direction = new THREE.Vector3(Math.cos(angle), 0.035, Math.sin(angle));
    const center = new THREE.Vector3(x, y, z);
    const a = center.clone().addScaledVector(direction, -length / 2);
    const b = center.clone().addScaledVector(direction, length / 2);
    beam(root, wood, a, b, 0.13);
    for (let i = 0; i < 4; i++) {
      const start = a.clone().lerp(b, 0.1 + rand() * 0.8);
      const end = start.clone().add(new THREE.Vector3((rand() - 0.5) * 0.5, rand() * 0.34, (rand() - 0.5) * 0.6));
      beam(root, darkWood, start, end, 0.035);
    }
  }
  for (const [x, z] of [[-6.4, -1.7], [-10.4, 5.2], [5.5, -3.0]]) {
    const y = elevation(x, z);
    mesh(root, new THREE.CylinderGeometry(0.16, 0.23, 0.36, 11), wood, x, y + 0.16, z);
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2;
      beam(root, darkWood, new THREE.Vector3(x, y + 0.1, z), new THREE.Vector3(x + Math.cos(angle) * 0.43, y + 0.01, z + Math.sin(angle) * 0.43), 0.045);
    }
  }
}