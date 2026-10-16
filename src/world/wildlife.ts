import * as THREE from 'three';
import { elevation, random, WATER_LEVEL } from './config';
import { batchStaticParts } from './optimize';
import type { NatureUniforms } from './terrain';

const sphere = new THREE.SphereGeometry(1, 14, 10);
const up = new THREE.Vector3(0, 1, 0);

function ellipsoid(parent: THREE.Object3D, material: THREE.Material, position: number[], scale: number[]) {
  const mesh = new THREE.Mesh(sphere, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function bone(parent: THREE.Object3D, material: THREE.Material, a: number[], b: number[], radius: number) {
  const start = new THREE.Vector3(...a as [number, number, number]);
  const end = new THREE.Vector3(...b as [number, number, number]);
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.65, radius, direction.length(), 7), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(up, direction.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeDeer(male: boolean, fawn: boolean) {
  const group = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: fawn ? '#9a7345' : '#927153', roughness: 1 });
  const pale = new THREE.MeshStandardMaterial({ color: '#c7b797', roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#37332b', roughness: 0.88 });
  const antlerMaterial = new THREE.MeshStandardMaterial({ color: '#897d5e', roughness: 1 });
  ellipsoid(group, fur, [0, 0.65, 0], [0.39, 0.205, 0.145]);
  ellipsoid(group, pale, [-0.075, 0.555, 0], [0.29, 0.11, 0.124]);
  const haunch = ellipsoid(group, fur, [-0.23, 0.61, 0], [0.18, 0.225, 0.157]);
  haunch.rotation.z = -0.18;
  ellipsoid(group, pale, [-0.37, 0.735, 0], [0.11, 0.044, 0.065]).rotation.z = -0.5;
  const legs: THREE.Group[] = [];
  for (const x of [-0.25, 0.24]) {
    for (const z of [-0.105, 0.105]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.6, z);
      group.add(leg);
      bone(leg, fur, [0, 0, 0], [x < 0 ? 0.035 : -0.015, -0.29, 0], 0.035);
      bone(leg, fur, [x < 0 ? 0.035 : -0.015, -0.29, 0], [0, -0.555, 0], 0.018);
      ellipsoid(leg, dark, [0.015, -0.565, 0], [0.038, 0.031, 0.027]);
      legs.push(leg);
    }
  }
  const head = new THREE.Group();
  head.position.set(0.245, 0.72, 0);
  group.add(head);
  ellipsoid(head, fur, [0.055, 0.205, 0], [0.112, 0.295, 0.106]).rotation.z = -0.2;
  ellipsoid(head, fur, [0.14, 0.485, 0], [0.17, 0.115, 0.091]);
  ellipsoid(head, fur, [0.255, 0.453, 0], [0.123, 0.07, 0.07]);
  ellipsoid(head, dark, [0.356, 0.452, 0], [0.034, 0.036, 0.053]);
  for (const side of [-1, 1]) {
    const ear = ellipsoid(head, fur, [0.055, 0.602, side * 0.087], [0.043, 0.123, 0.041]);
    ear.rotation.x = side * 0.54;
    ear.rotation.z = 0.37;
    ellipsoid(head, dark, [0.207, 0.507, side * 0.078], [0.012, 0.013, 0.005]);
    if (male) {
      const branch = [[0.075, 0.57, side * 0.055], [0.012, 0.76, side * 0.095], [-0.1, 0.93, side * 0.16], [-0.17, 1.05, side * 0.2]];
      for (let i = 0; i < branch.length - 1; i++) bone(head, antlerMaterial, branch[i], branch[i + 1], 0.019 - i * 0.004);
      bone(head, antlerMaterial, branch[1], [0.135, 0.92, side * 0.16], 0.012);
      bone(head, antlerMaterial, branch[2], [-0.005, 1.09, side * 0.2], 0.01);
    }
  }
  if (fawn) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) ellipsoid(group, pale, [-0.25 + i % 5 * 0.10, 0.69 + Math.floor(i / 5) * 0.075, side * 0.133], [0.019, 0.014, 0.007]);
    }
  }
  group.scale.setScalar(fawn ? 0.56 : 0.82);
  batchStaticParts(group);
  batchStaticParts(head);
  legs.forEach(batchStaticParts);
  return { group, head, legs };
}

function makeSwan() {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#eeeede', roughness: 0.73 });
  const feather = new THREE.MeshStandardMaterial({ color: '#f8f5e8', roughness: 0.9 });
  const black = new THREE.MeshStandardMaterial({ color: '#242c27', roughness: 0.6 });
  const orange = new THREE.MeshStandardMaterial({ color: '#b87542', roughness: 0.8 });
  ellipsoid(group, white, [0, 0.12, 0], [0.34, 0.15, 0.185]);
  ellipsoid(group, feather, [-0.03, 0.205, 0], [0.29, 0.099, 0.155]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const mesh = ellipsoid(group, feather, [-0.11 + i * 0.026, 0.22 + i * 0.008, side * (0.12 - i * 0.014)], [0.235 - i * 0.018, 0.035, 0.036]);
      mesh.rotation.y = side * 0.12;
    }
  }
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.22, 0.15, 0), new THREE.Vector3(0.245, 0.28, 0),
    new THREE.Vector3(0.24, 0.47, 0), new THREE.Vector3(0.30, 0.58, 0),
    new THREE.Vector3(0.395, 0.57, 0),
  ]);
  const neck = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.041, 8, false), white);
  neck.castShadow = true;
  group.add(neck);
  ellipsoid(group, white, [0.395, 0.565, 0], [0.071, 0.054, 0.047]);
  ellipsoid(group, black, [0.447, 0.553, 0], [0.032, 0.033, 0.035]);
  ellipsoid(group, orange, [0.487, 0.548, 0], [0.059, 0.022, 0.027]);
  for (const side of [-1, 1]) ellipsoid(group, black, [0.417, 0.581, side * 0.041], [0.007, 0.008, 0.006]);
  batchStaticParts(group);
  return group;
}

function makeRabbit(squirrel = false) {
  const group = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: squirrel ? '#875f3a' : '#8b806b', roughness: 1 });
  const light = new THREE.MeshStandardMaterial({ color: '#bfb79f', roughness: 1 });
  const eye = new THREE.MeshStandardMaterial({ color: '#262923', roughness: 0.4 });
  ellipsoid(group, fur, [0, 0.15, 0], [0.21, 0.145, 0.11]);
  ellipsoid(group, fur, [0.165, 0.25, 0], [0.095, 0.094, 0.077]);
  for (const side of [-1, 1]) {
    ellipsoid(group, fur, [0.13, 0.375, side * 0.046], [0.029, squirrel ? 0.052 : 0.124, 0.027]).rotation.z = -0.16;
    ellipsoid(group, eye, [0.205, 0.265, side * 0.064], [0.009, 0.01, 0.006]);
    ellipsoid(group, fur, [-0.13, 0.075, side * 0.095], [0.088, 0.073, 0.053]);
    ellipsoid(group, fur, [0.12, 0.055, side * 0.068], [0.074, 0.035, 0.032]);
  }
  if (squirrel) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.17, 0.18, 0), new THREE.Vector3(-0.36, 0.35, 0), new THREE.Vector3(-0.29, 0.55, 0), new THREE.Vector3(-0.13, 0.53, 0)]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.067, 8, false), fur));
  } else ellipsoid(group, light, [-0.2, 0.2, 0], [0.065, 0.063, 0.063]);
  batchStaticParts(group);
  return group;
}

function makeBird() {
  const group = new THREE.Group();
  const feather = new THREE.MeshStandardMaterial({ color: '#454b42', roughness: 1, side: THREE.DoubleSide });
  ellipsoid(group, feather, [0, 0, 0], [0.12, 0.042, 0.046]);
  ellipsoid(group, feather, [0.10, 0.029, 0], [0.051, 0.036, 0.033]);
  const wings: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0.06, 0, 0, -0.07, 0, side * 0.08, -0.16, 0, side * 0.31,
      0.06, 0, 0, -0.16, 0, side * 0.31, 0.035, 0, side * 0.22,
    ], 3));
    geometry.computeVertexNormals();
    const wing = new THREE.Mesh(geometry, feather);
    group.add(wing);
    wings.push(wing);
  }
  return { group, wings };
}

export function buildWildlife(root: THREE.Group, uniforms: NatureUniforms) {
  const rand = random(7845);
  const deerPositions = [[-6.55, 4.25], [-8.3, 4.9], [-7.3, 6.0], [-9.8, 3.9], [-8.7, 6.45]];
  const deer = deerPositions.map(([x, z], i) => {
    const animal = makeDeer(i === 0, i === 2 || i === 4);
    animal.group.position.set(x, elevation(x, z), z);
    animal.group.rotation.y = i * 1.4 + 0.7;
    root.add(animal.group);
    return { ...animal, x, z, phase: rand() * 6.28 };
  });

  const swans = [[3.3, 7], [4.65, 7.7], [6.65, 3.9]].map(([x, z], i) => {
    const group = makeSwan();
    group.position.set(x, WATER_LEVEL - 0.015, z);
    group.rotation.y = -0.75;
    group.scale.setScalar(i === 2 ? 0.75 : 0.91);
    root.add(group);
    const wakes: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
    for (let j = 0; j < 3; j++) {
      const wake = new THREE.Mesh(new THREE.RingGeometry(0.39, 0.405, 52), new THREE.MeshBasicMaterial({ color: '#d5e8cf', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
      wake.rotation.x = -Math.PI / 2;
      root.add(wake);
      wakes.push(wake);
    }
    return { group, x, z, phase: i * 0.8, wakes };
  });

  const mammals = [[-9.1, 7.1], [-6.2, 2.95], [-9.7, -0.2], [3.8, -1.8]].map(([x, z], i) => {
    const group = makeRabbit(i > 1);
    root.add(group);
    return { group, x, z, phase: rand() * 6.28 };
  });
  const birds = Array.from({ length: 10 }, (_, i) => {
    const bird = makeBird();
    root.add(bird.group);
    return { ...bird, phase: i * 0.16, distance: rand() * 1.2, speed: 0.10 + rand() * 0.025 };
  });
  const perched = makeBird();
  const perchPosition = new THREE.Vector3(-8.35, elevation(-8.35, 0.35) + 0.58, 0.35);
  perched.group.position.copy(perchPosition);
  perched.group.rotation.y = -0.9;
  root.add(perched.group);
  perched.wings[0].rotation.x = 1.3;
  perched.wings[1].rotation.x = -1.3;

  const fishMaterial = new THREE.MeshStandardMaterial({ color: '#776e43', roughness: 0.52, metalness: 0.1 });
  const fishes = Array.from({ length: 24 }, (_, i) => {
    const group = new THREE.Group();
    ellipsoid(group, fishMaterial, [0, 0, 0], [0.15, 0.041, 0.041]);
    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.11, 0, 0, -0.23, 0.063, 0, -0.23, -0.063, 0], 3));
    tailGeo.computeVertexNormals();
    const tail = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color: '#8f7a4b', side: THREE.DoubleSide, roughness: 0.66 }));
    group.add(tail);
    root.add(group);
    return { group, tail, phase: i * 0.77, school: i % 2, scale: 0.55 + rand() * 0.45 };
  });

  const butterflies = Array.from({ length: 15 }, (_, i) => {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: ['#e8dba6', '#bb845d', '#a9bbcd'][i % 3], side: THREE.DoubleSide, roughness: 1 });
    const wings: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.CircleGeometry(0.055, 8), material);
      wing.geometry.translate(side * 0.038, 0, 0);
      wing.scale.y = 0.77;
      wing.rotation.x = -Math.PI / 2;
      group.add(wing);
      wings.push(wing);
    }
    root.add(group);
    return { group, wings, x: -9.6 + rand() * 8.3, z: 1.7 + rand() * 4.0, phase: i * 0.66 };
  });

  return (time: number, delta: number) => {
    const rain = uniforms.rain.value;
    const winter = uniforms.winter.value;
    deer.forEach((animal, i) => {
      const t = time * 0.18 + animal.phase;
      const walking = Math.sin(t * 0.75) > 0.36;
      const x = THREE.MathUtils.lerp(animal.x + Math.sin(t * 0.4) * 0.65, -9.7 + i * 0.43, rain);
      const z = THREE.MathUtils.lerp(animal.z + Math.cos(t * 0.37) * 0.5, -0.5 - i * 0.47, rain);
      animal.group.position.x = THREE.MathUtils.damp(animal.group.position.x, x, walking || rain > 0.2 ? 0.55 : 0.06, delta);
      animal.group.position.z = THREE.MathUtils.damp(animal.group.position.z, z, walking || rain > 0.2 ? 0.55 : 0.06, delta);
      animal.group.position.y = elevation(animal.group.position.x, animal.group.position.z);
      animal.head.rotation.z = THREE.MathUtils.damp(animal.head.rotation.z, rain > 0.4 || Math.sin(t * 0.8) > 0.7 ? -0.14 : -2.03 + Math.sin(t * 1.3) * 0.12, 1.0, delta);
      animal.head.rotation.y = Math.sin(t * 0.56) * 0.12;
      animal.legs.forEach((leg, j) => { leg.rotation.z = (walking || rain > 0.2 ? Math.sin(time * 2.2 + animal.phase + j * 2.5) * 0.065 : 0); });
    });

    swans.forEach((swan, i) => {
      const t = time * 0.042 + swan.phase;
      swan.group.position.x = swan.x + Math.sin(t) * 1.2;
      swan.group.position.z = swan.z + Math.cos(t) * 0.72;
      swan.group.position.y = WATER_LEVEL + Math.sin(time * 1.1 + i) * 0.011 - 0.02;
      swan.group.rotation.y = Math.atan2(Math.sin(t) * 0.72, Math.cos(t) * 1.2);
      swan.wakes.forEach((wake, j) => {
        const cycle = (time * 0.27 + j / 3) % 1;
        wake.position.copy(swan.group.position);
        wake.position.y = WATER_LEVEL + 0.012 + j * 0.001;
        wake.scale.set(0.8 + cycle * 2.1, 0.52 + cycle * 1.35, 1);
        wake.material.opacity = (1 - cycle) * 0.115;
      });
    });

    mammals.forEach((animal) => {
      const t = time * 0.24 + animal.phase;
      const hopping = Math.sin(t) > 0.88;
      const x = animal.x + Math.sin(t * 0.4) * 0.27 - rain * 0.8;
      const z = animal.z + Math.cos(t * 0.4) * 0.25 - rain * 1.7;
      animal.group.position.set(x, elevation(x, z) + (hopping ? Math.abs(Math.sin(time * 7)) * 0.08 : 0), z);
      animal.group.rotation.y = animal.phase + Math.sin(t * 0.35) * 0.35;
    });

    birds.forEach((bird, i) => {
      const t = time * bird.speed + bird.phase;
      const x = Math.sin(t) * (6.1 + bird.distance);
      const z = -1.8 + Math.cos(t) * (4.3 + bird.distance * 0.4);
      bird.group.position.set(x, 5.4 + Math.sin(t * 1.4) * 0.7 + i * 0.09 - rain * 1.1, z);
      bird.group.rotation.y = Math.atan2(Math.sin(t) * 4.3, Math.cos(t) * 6.1);
      const flap = Math.sin(time * 7.2 + i * 0.8) * 0.55;
      bird.wings[0].rotation.x = flap;
      bird.wings[1].rotation.x = -flap;
    });

    const perchCycle = time % 43;
    if (perchCycle > 23 && rain < 0.5) {
      const flight = (perchCycle - 23) / 20;
      const angle = flight * Math.PI * 2;
      perched.group.position.set(perchPosition.x + Math.sin(angle) * 2.1, perchPosition.y + Math.sin(flight * Math.PI) * 2.8, perchPosition.z + (1 - Math.cos(angle)) * 1.2);
      perched.group.rotation.y = -angle;
      perched.wings[0].rotation.x = Math.sin(time * 8) * 0.65;
      perched.wings[1].rotation.x = -Math.sin(time * 8) * 0.65;
    } else {
      perched.group.position.copy(perchPosition);
      perched.group.rotation.y = -0.9 + Math.sin(time * 0.6) * 0.13;
      perched.wings[0].rotation.x = 1.3;
      perched.wings[1].rotation.x = -1.3;
    }

    fishes.forEach((fish) => {
      const t = time * 0.13 + fish.phase * 0.08;
      const x = 1.4 + fish.school * 4.8 + Math.sin(t) * 1.45 + Math.sin(fish.phase) * 0.5;
      const z = 7.3 + Math.cos(t) * 1.2 + Math.cos(fish.phase * 2) * 0.45;
      fish.group.position.set(x, -0.12 - Math.sin(fish.phase) * 0.045, z);
      fish.group.rotation.y = Math.atan2(Math.sin(t) * 1.2, Math.cos(t) * 1.45);
      fish.group.scale.setScalar(fish.scale);
      fish.tail.rotation.y = Math.sin(time * 5 + fish.phase) * 0.4;
    });

    butterflies.forEach((butterfly, i) => {
      butterfly.group.visible = rain < 0.45 && winter < 0.4;
      const t = time * 0.35 + butterfly.phase;
      const x = butterfly.x + Math.sin(t * 1.7) * 0.45;
      const z = butterfly.z + Math.cos(t) * 0.35;
      butterfly.group.position.set(x, elevation(x, z) + 0.48 + Math.sin(t * 2) * 0.18, z);
      butterfly.group.rotation.y = t;
      butterfly.wings[0].rotation.y = Math.sin(time * 12 + i) * 0.9;
      butterfly.wings[1].rotation.y = -Math.sin(time * 12 + i) * 0.9;
    });
  };
}