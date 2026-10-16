import * as THREE from 'three';
import { Refractor } from 'three/addons/objects/Refractor.js';
import { Water } from 'three/addons/objects/Water.js';
import { elevation, random, WATER_LEVEL } from './config';
import type { NatureUniforms } from './terrain';
import type { WorldTextures } from './textures';

export function buildWater(root: THREE.Group, textures: WorldTextures, uniforms: NatureUniforms, compact: boolean) {
  const water = new Water(new THREE.PlaneGeometry(24, 24), {
    textureWidth: compact ? 512 : 1024,
    textureHeight: compact ? 512 : 1024,
    waterNormals: textures.waterNormal,
    sunDirection: new THREE.Vector3(-18, 28, 13).normalize(),
    sunColor: '#fff3cf',
    waterColor: '#428c78',
    distortionScale: 1.15,
    alpha: 0.98,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.material.transparent = true;
  water.material.depthWrite = false;
  water.material.uniforms.size.value = 10;
  water.material.uniforms.uRain = uniforms.rain;
  water.material.uniforms.uWinter = uniforms.winter;
  const refractor = new Refractor(water.geometry, {
    textureWidth: compact ? 384 : 768,
    textureHeight: compact ? 384 : 768,
    multisample: 0,
    clipBias: 0.002,
  });
  refractor.matrixAutoUpdate = false;
  water.material.uniforms.uRefractionSampler = { value: refractor.getRenderTarget().texture };
  water.material.uniforms.uRefractionMatrix = refractor.material.uniforms.textureMatrix;
  water.material.vertexShader = 'uniform mat4 uRefractionMatrix; varying vec4 vRefractionCoord;\n' + water.material.vertexShader;
  water.material.vertexShader = water.material.vertexShader.replace('mirrorCoord = modelMatrix * vec4( position, 1.0 );', `
    vRefractionCoord = uRefractionMatrix * vec4(position, 1.0);
    mirrorCoord = modelMatrix * vec4( position, 1.0 );
  `);
  water.material.fragmentShader = 'uniform float uRain, uWinter; uniform sampler2D uRefractionSampler; varying vec4 vRefractionCoord;\n' + water.material.fragmentShader;
  water.material.fragmentShader = water.material.fragmentShader.replace('return noise * 0.5 - 1.0;', `
    vec4 result = noise * 0.5 - 1.0;
    vec2 p = uv * 0.25;
    vec2 cell = floor(p);
    float seed = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
    float age = fract(time * 2.3 + seed);
    vec2 center = vec2(0.22 + seed * 0.56, 0.2 + fract(seed * 13.7) * 0.6);
    vec2 offset = fract(p) - center;
    float distanceToDrop = length(offset);
    float ring = exp(-pow((distanceToDrop - age * 0.6) * 42.0, 2.0));
    result.xy += normalize(offset + 0.001) * ring * (1.0 - age) * uRain * 0.46;
    return result;
  `);
  water.material.fragmentShader = water.material.fragmentShader.replace('float rf0 = 0.02;', 'float rf0 = 0.12;');
  water.material.fragmentShader = water.material.fragmentShader.replace(
    'vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), reflectionSample + specularLight, reflectance );',
    `
      vec2 refractionUV = vRefractionCoord.xy / vRefractionCoord.w + distortion * 0.28;
      vec3 refracted = texture2D(uRefractionSampler, refractionUV).rgb;
      vec3 transmitted = mix(refracted * vec3(0.52, 0.87, 0.72), (scatter + sunColor * diffuseLight * 0.14) * getShadowMask(), 0.4);
      vec3 albedo = mix(transmitted, reflectionSample + specularLight, reflectance);
    `,
  );
  water.material.fragmentShader = water.material.fragmentShader.replace('vec3 outgoingLight = albedo;', `
    vec3 outgoingLight = albedo;
    float shoreline = 2.8 - worldPosition.x * 0.55 + 1.4 * sin(worldPosition.x * 0.38) + 0.65 * sin(worldPosition.x * 0.85 + 1.3);
    float edge = worldPosition.z - shoreline;
    float foam = exp(-pow((edge - 0.045) * 28.0, 2.0)) * (0.55 + 0.45 * sin(worldPosition.x * 19.0 + time * 0.7));
    outgoingLight = mix(outgoingLight, vec3(0.39, 0.48, 0.36), foam * 0.38);
    outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.86, 1.05, 1.15), uWinter * 0.6);
  `);
  // Capture the submerged scene separately, so fish and stones refract with the waves.
  const renderReflection = water.onBeforeRender.bind(water);
  water.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
    renderReflection(renderer, scene, camera, geometry, material, group);
    water.visible = false;
    refractor.matrixWorld.copy(water.matrixWorld);
    refractor.onBeforeRender(renderer, scene, camera, geometry, refractor.material, group);
    water.visible = true;
  };
  water.userData.releaseRefraction = () => refractor.dispose();
  water.receiveShadow = true;
  root.add(water);
  return water;
}

export function buildAtmosphere(
  root: THREE.Group,
  textures: WorldTextures,
  uniforms: NatureUniforms,
  smokeOrigin: THREE.Vector3,
  compact: boolean,
) {
  const rand = random(5918);
  const mists: { sprite: THREE.Sprite; x: number; z: number; y: number; phase: number; mountain: boolean }[] = [];
  for (let i = 0; i < 24; i++) {
    const mountain = i < 12;
    const material = new THREE.SpriteMaterial({
      map: textures.cloud, color: '#e6e9d9', transparent: true, opacity: mountain ? 0.38 : 0.23,
      depthWrite: false, fog: true,
    });
    const sprite = new THREE.Sprite(material);
    const x = mountain ? -10 + rand() * 20 : -5 + rand() * 15;
    const z = mountain ? -6.1 - rand() * 3.3 : 3.5 + rand() * 5;
    const y = mountain ? 3.15 + rand() * 1.55 : 0.44 + rand() * 0.20;
    sprite.position.set(x, y, z);
    const width = mountain ? 5.7 + rand() * 4 : 4 + rand() * 4.3;
    sprite.scale.set(width, mountain ? 1.1 + rand() * 1.1 : 0.4 + rand() * 0.55, 1);
    root.add(sprite);
    mists.push({ sprite, x, z, y, phase: rand() * 6.28, mountain });
  }

  const clouds = Array.from({ length: 7 }, (_, i) => {
    const material = new THREE.SpriteMaterial({ map: textures.cloud, color: '#bac8c5', transparent: true, opacity: 0, depthWrite: false, fog: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(-8 + i * 2.6, 8.0 + Math.sin(i) * 0.9, -8.4);
    sprite.scale.set(9 + rand() * 4, 2.7 + rand() * 1.2, 1);
    root.add(sprite);
    return sprite;
  });
  const sunbeams = buildSunbeams(root, uniforms);

  const smoke = Array.from({ length: 23 }, (_, i) => {
    const material = new THREE.SpriteMaterial({ map: textures.cloud, color: '#dce0d0', transparent: true, opacity: 0.3, depthWrite: false, fog: true });
    const sprite = new THREE.Sprite(material);
    sprite.material.rotation = i * 0.4;
    root.add(sprite);
    return sprite;
  });

  const motes = Array.from({ length: compact ? 22 : 42 }, (_, i) => {
    const material = new THREE.SpriteMaterial({ map: textures.glow, color: '#e7df99', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(0.035 + rand() * 0.045);
    const x = -10.5 + rand() * 14;
    const z = -2 + rand() * 8;
    root.add(sprite);
    return { sprite, x, z, y: elevation(x, z) + 0.35 + rand() * 0.8, phase: i * 0.89 };
  });

  const rain = buildPrecipitation(root, uniforms, compact);
  return (time: number, camera: THREE.Camera) => {
    const cloudy = uniforms.cloud.value;
    const wet = uniforms.rain.value;
    const winter = uniforms.winter.value;
    const summer = uniforms.summer.value;
    mists.forEach((mist, i) => {
      mist.sprite.position.x = mist.x + Math.sin(time * 0.029 + mist.phase) * 0.65;
      mist.sprite.position.z = mist.z + Math.cos(time * 0.035 + mist.phase) * 0.27;
      mist.sprite.position.y = mist.y + Math.sin(time * 0.09 + i) * 0.04;
      mist.sprite.material.opacity = (mist.mountain ? 0.36 + cloudy * 0.20 : 0.22 - summer * 0.12 + cloudy * 0.09) * (0.86 + Math.sin(time * 0.11 + mist.phase) * 0.14);
      mist.sprite.material.color.setRGB(0.82 - cloudy * 0.12, 0.86 - cloudy * 0.1, 0.78 + winter * 0.1);
    });
    clouds.forEach((cloud, i) => {
      cloud.position.x = -8 + i * 2.6 + Math.sin(time * 0.019 + i) * 1.1;
      cloud.material.opacity = cloudy * 0.53;
    });
    sunbeams(camera);
    smoke.forEach((puff, i) => {
      const age = (time * 0.085 + i / smoke.length) % 1;
      const lift = age * (2.0 + winter * 0.7);
      puff.position.set(
        smokeOrigin.x + Math.pow(age, 1.3) * (0.65 + wet * 1.2) + Math.sin(age * 10 + i) * age * 0.07,
        smokeOrigin.y + lift,
        smokeOrigin.z + age * 0.28 + Math.sin(age * 9 + i) * 0.035,
      );
      puff.scale.setScalar(0.15 + age * 0.93);
      puff.material.opacity = Math.sin(age * Math.PI) * (0.27 + winter * 0.17 + wet * 0.09);
    });
    motes.forEach((mote) => {
      mote.sprite.position.set(mote.x + Math.sin(time * 0.13 + mote.phase) * 0.29, mote.y + Math.sin(time * 0.31 + mote.phase) * 0.13, mote.z + Math.cos(time * 0.12 + mote.phase) * 0.25);
      mote.sprite.material.opacity = (0.28 + Math.sin(time * 0.9 + mote.phase) * 0.20) * (1 - wet) * (1 - winter);
    });
    rain.lines.visible = wet > 0.01 && winter < 0.99;
    rain.snow.visible = wet > 0.01 && winter > 0.01;
  };
}

function buildSunbeams(root: THREE.Group, uniforms: NatureUniforms) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uCloud: uniforms.cloud, uWinter: uniforms.winter },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uCloud, uWinter;
      void main() {
        float feather = pow(max(0.0, sin(vUv.x * 3.14159)), 2.5);
        float ends = smoothstep(0.0, 0.23, vUv.y) * (1.0 - smoothstep(0.65, 1.0, vUv.y));
        gl_FragColor = vec4(0.87, 0.84, 0.55, feather * ends * (1.0 - uCloud) * (1.0 - uWinter * 0.8) * 0.035);
      }
    `,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const direction = new THREE.Vector3(-18, 28, 13).normalize();
  const beams = [[-6.6, -0.8, 0.42], [-8.3, 3.1, 0.31], [-1.2, -1.5, 0.27], [3.7, -3.9, 0.36]].map(([x, z, width]) => {
    const bottom = new THREE.Vector3(x, elevation(x, z) + 0.03, z);
    const top = bottom.clone().addScaledVector(direction, 6.5);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    root.add(mesh);
    return { bottom, top, geometry, width };
  });
  const side = new THREE.Vector3();
  const view = new THREE.Vector3();
  return (camera: THREE.Camera) => {
    beams.forEach(beam => {
      view.subVectors(camera.position, beam.bottom).normalize();
      side.crossVectors(direction, view).normalize();
      const positions = beam.geometry.attributes.position;
      for (let i = 0; i < 4; i++) {
        const point = i < 2 ? beam.bottom : beam.top;
        const sign = i % 2 === 0 ? -1 : 1;
        const width = beam.width * (i < 2 ? 1 : 0.48);
        positions.setXYZ(i, point.x + side.x * width * sign, point.y + side.y * width * sign, point.z + side.z * width * sign);
      }
      positions.needsUpdate = true;
    });
  };
}

function buildPrecipitation(root: THREE.Group, uniforms: NatureUniforms, compact: boolean) {
  const rand = random(941);
  const count = compact ? 1200 : 2300;
  const positions: number[] = [];
  const seeds: number[] = [];
  const tips: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rand() - 0.5) * 23.6;
    const z = (rand() - 0.5) * 23.6;
    const seed = rand();
    positions.push(x, 0, z, x, 0, z);
    seeds.push(seed, seed);
    tips.push(0, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('aTip', new THREE.Float32BufferAttribute(tips, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.time, uRain: uniforms.rain, uWinter: uniforms.winter },
    vertexShader: `
      uniform float uTime;
      attribute float aSeed, aTip;
      varying float vTip;
      void main() {
        vec3 p = position;
        float age = fract(aSeed - uTime * 0.78);
        p.y = age * 15.0 - aTip * 0.43;
        p.x += age * 0.68 - aTip * 0.028;
        p.z += age * 0.24;
        vTip = aTip;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uRain, uWinter;
      varying float vTip;
      void main() {
        gl_FragColor = vec4(0.69, 0.78, 0.81, uRain * (1.0 - uWinter) * (0.13 + vTip * 0.13));
      }
    `,
    transparent: true, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.visible = false;
  root.add(lines);

  const snowPositions: number[] = [];
  const snowSeeds: number[] = [];
  for (let i = 0; i < count / 2; i++) {
    snowPositions.push((rand() - 0.5) * 23, 0, (rand() - 0.5) * 23);
    snowSeeds.push(rand());
  }
  const snowGeometry = new THREE.BufferGeometry();
  snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(snowPositions, 3));
  snowGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(snowSeeds, 1));
  const snowMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.time, uRain: uniforms.rain, uWinter: uniforms.winter },
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      void main() {
        vec3 p = position;
        p.y = fract(aSeed - uTime * 0.039) * 14.0;
        p.x += sin(uTime * 0.41 + aSeed * 56.0) * 0.45;
        p.z += cos(uTime * 0.33 + aSeed * 17.0) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((90.0 + aSeed * 45.0) / -mv.z, 1.0, 4.5);
      }
    `,
    fragmentShader: `
      uniform float uRain, uWinter;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = (1.0 - smoothstep(0.1, 0.5, d)) * uRain * uWinter * 0.76;
        gl_FragColor = vec4(0.89, 0.94, 0.95, alpha);
      }
    `,
    transparent: true, depthWrite: false,
  });
  const snow = new THREE.Points(snowGeometry, snowMaterial);
  snow.frustumCulled = false;
  snow.visible = false;
  root.add(snow);
  return { lines, snow };
}