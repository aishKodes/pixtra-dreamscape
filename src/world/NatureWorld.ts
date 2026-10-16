import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Water } from 'three/addons/objects/Water.js';
import { buildAtmosphere, buildWater } from './atmosphere';
import { buildCabin } from './cabin';
import { FLOOR } from './config';
import type { Environment } from './config';
import { buildForest, buildMeadow, buildShore } from './foliage';
import { buildTerrain } from './terrain';
import type { NatureUniforms } from './terrain';
import { makeEnvironment } from './textures';
import type { WorldTextures } from './textures';
import { buildWildlife } from './wildlife';

export class NatureWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(23, 1, 0.1, 500);
  private controls: OrbitControls;
  private root = new THREE.Group();
  private sun = new THREE.DirectionalLight('#fff1c7', 3.25);
  private fill = new THREE.DirectionalLight('#dce9ef', 0.55);
  private ambient = new THREE.HemisphereLight('#e9eed7', '#52573d', 1.45);
  private environmentTarget: THREE.WebGLRenderTarget;
  private water: Water;
  private forest: ReturnType<typeof buildForest>;
  private meadow: ReturnType<typeof buildMeadow>;
  private shore: ReturnType<typeof buildShore>;
  private animateWildlife: ReturnType<typeof buildWildlife>;
  private animateAtmosphere: ReturnType<typeof buildAtmosphere>;
  private settings: Environment = { season: 'spring', weather: 'sunny' };
  private frame = 0;
  private lastTime = 0;
  private time = 0;
  private frameCount = 0;
  private disposed = false;
  private ready = false;
  private fitDistance = 75;
  private observer: ResizeObserver;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private warmSun = new THREE.Color('#fff0c2');
  private coolSun = new THREE.Color('#d5e4ed');
  private warmAmbient = new THREE.Color('#e9eed7');
  private coolAmbient = new THREE.Color('#c4d5e1');
  private targetColor = new THREE.Color();
  private uniforms: NatureUniforms = {
    time: { value: 0 }, autumn: { value: 0 }, winter: { value: 0 },
    summer: { value: 0 }, rain: { value: 0 }, cloud: { value: 0 },
  };

  constructor(
    private host: HTMLElement,
    private textures: WorldTextures,
    private onReady: (ready: boolean) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setClearColor('#c5d0be', 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', '\u53ef\u4ea4\u4e92\u7684\u5fae\u7f29\u81ea\u7136\u4e16\u754c\u3002\u62d6\u62fd\u65cb\u8f6c\uff0c\u6eda\u8f6e\u7f29\u653e\uff0c\u53f3\u952e\u62d6\u62fd\u5e73\u79fb\u3002\u65b9\u5411\u952e\u65cb\u8f6c\uff0c\u52a0\u51cf\u952e\u7f29\u653e\uff0cHome \u952e\u6216\u53cc\u51fb\u6062\u590d\u5168\u666f\u3002');
    host.appendChild(this.renderer.domElement);

    this.camera.position.set(28, 24, 32).normalize().multiplyScalar(this.fitDistance);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.rotateSpeed = 0.52;
    this.controls.zoomSpeed = 0.75;
    this.controls.panSpeed = 0.65;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 170;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = 1.34;
    this.controls.maxTargetRadius = 8;
    this.controls.screenSpacePanning = true;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.update();

    this.scene.fog = new THREE.FogExp2('#c3d1bd', 0.0036);
    this.environmentTarget = makeEnvironment(this.renderer);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.46;
    this.scene.add(this.root);
    this.setUpLighting();

    const compact = host.clientWidth < 700;
    buildTerrain(this.root, textures, this.uniforms);
    this.forest = buildForest(this.root, textures, this.uniforms);
    this.meadow = buildMeadow(this.root, this.uniforms, compact);
    this.shore = buildShore(this.root, textures, this.uniforms);
    const cabin = buildCabin(this.root, textures, this.uniforms);
    this.animateWildlife = buildWildlife(this.root, this.uniforms);
    this.water = buildWater(this.root, textures, this.uniforms, compact);
    this.animateAtmosphere = buildAtmosphere(this.root, textures, this.uniforms, cabin.smokeOrigin, compact);
    this.forest.update(this.camera);

    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
    this.renderer.domElement.addEventListener('dblclick', this.resetView);
    this.renderer.domElement.addEventListener('keydown', this.onKeyDown);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    this.renderer.shadowMap.needsUpdate = true;
    this.frame = requestAnimationFrame(this.tick);
  }

  private setUpLighting() {
    this.sun.position.set(-18, 28, 13);
    this.sun.castShadow = true;
    const shadowSize = this.host.clientWidth < 700 ? 2048 : 4096;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.camera.left = -21;
    this.sun.shadow.camera.right = 21;
    this.sun.shadow.camera.top = 21;
    this.sun.shadow.camera.bottom = -21;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 75;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.radius = 3;
    this.fill.position.set(12, 12, -8);
    this.scene.add(this.sun, this.sun.target, this.fill, this.ambient);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShadowMaterial({ color: '#40543e', opacity: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR - 0.11;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const contact = new THREE.Mesh(new THREE.PlaneGeometry(33, 31), new THREE.MeshBasicMaterial({
      map: this.textures.cloud, transparent: true, color: '#344531', opacity: 0.55, depthWrite: false,
    }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = FLOOR - 0.10;
    this.scene.add(contact);
  }

  setEnvironment(settings: Environment) {
    this.settings = settings;
    this.meadow.setSeason(settings.season);
    this.shore.setSeason(settings.season);
    this.forest.setWinter(settings.season === 'winter' || this.uniforms.winter.value > 0.02);
    this.renderer.shadowMap.needsUpdate = true;
  }

  private resize = () => {
    if (this.disposed) return;
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const distance = 75 * Math.max(1, 1.43 / aspect);
    const ratio = distance / this.fitDistance;
    this.camera.position.sub(this.controls.target).multiplyScalar(ratio).add(this.controls.target);
    this.fitDistance = distance;
    this.controls.maxDistance = Math.max(100, distance * 2.15);
    this.camera.far = Math.max(350, distance * 3);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.controls.update();
  };

  private resetView = () => {
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(28, 24, 32).normalize().multiplyScalar(this.fitDistance);
    this.controls.update();
    this.renderer.shadowMap.needsUpdate = true;
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= 0.085;
    else if (event.key === 'ArrowRight') spherical.theta += 0.085;
    else if (event.key === 'ArrowUp') spherical.phi = Math.max(this.controls.minPolarAngle, spherical.phi - 0.065);
    else if (event.key === 'ArrowDown') spherical.phi = Math.min(this.controls.maxPolarAngle, spherical.phi + 0.065);
    else if (event.key === '+' || event.key === '=') spherical.radius = Math.max(this.controls.minDistance, spherical.radius * 0.9);
    else if (event.key === '-') spherical.radius = Math.min(this.controls.maxDistance, spherical.radius * 1.1);
    else if (event.key === 'Home') { this.resetView(); event.preventDefault(); return; }
    else return;
    event.preventDefault();
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    this.controls.update();
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(this.frame);
    this.ready = false;
    this.onReady(false);
  };

  private onContextRestored = () => {
    this.lastTime = 0;
    this.renderer.shadowMap.needsUpdate = true;
    this.frame = requestAnimationFrame(this.tick);
  };

  private tick = (now: number) => {
    if (this.disposed) return;
    const delta = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.05) : 0.016;
    this.lastTime = now;
    this.time += delta * (this.reducedMotion ? 0.24 : 1);
    this.frameCount++;
    this.uniforms.time.value = this.time;
    const { season, weather } = this.settings;
    const targets = {
      winter: season === 'winter' ? 1 : 0,
      autumn: season === 'autumn' ? 1 : 0,
      summer: season === 'summer' ? 1 : 0,
      rain: weather === 'rainy' ? 1 : 0,
      cloud: weather === 'sunny' ? 0 : weather === 'cloudy' ? 0.68 : 1,
    };
    (Object.keys(targets) as (keyof typeof targets)[]).forEach(key => {
      this.uniforms[key].value = THREE.MathUtils.damp(this.uniforms[key].value, targets[key], 1.4, delta);
    });
    const cloudy = this.uniforms.cloud.value;
    const winter = this.uniforms.winter.value;
    this.sun.intensity = 3.25 * (1 - cloudy * 0.84) * (1 - winter * 0.12);
    this.sun.color.copy(this.warmSun).lerp(this.coolSun, Math.min(1, cloudy * 0.82 + winter * 0.65));
    this.ambient.intensity = 1.45 - cloudy * 0.31;
    this.ambient.color.copy(this.warmAmbient).lerp(this.coolAmbient, Math.min(1, cloudy * 0.88 + winter * 0.54));
    this.fill.intensity = 0.55 + cloudy * 0.12;
    this.renderer.toneMappingExposure = 0.88 - cloudy * 0.075 + winter * 0.025;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.density = (0.0036 + cloudy * 0.0028) * 75 / this.fitDistance;
    this.targetColor.set(cloudy > 0.3 ? '#a5b8b9' : winter > 0.3 ? '#ccd9de' : '#c3d1bd');
    fog.color.lerp(this.targetColor, delta * 0.7);
    this.water.material.uniforms.time.value = this.time * 0.28;
    this.water.material.uniforms.sunColor.value.copy(this.sun.color).multiplyScalar(1 - cloudy * 0.44);
    this.water.material.uniforms.distortionScale.value = 1.15 + this.uniforms.rain.value * 0.8;

    this.controls.update();
    this.forest.update(this.camera);
    this.animateWildlife(this.time, delta);
    this.animateAtmosphere(this.time, this.camera);
    if (this.frameCount % 18 === 0) {
      this.renderer.shadowMap.needsUpdate = true;
      this.forest.setWinter(winter > 0.01 || season === 'winter');
    }
    this.renderer.render(this.scene, this.camera);
    if (!this.ready && this.frameCount > 1) {
      this.ready = true;
      this.onReady(true);
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('dblclick', this.resetView);
    this.renderer.domElement.removeEventListener('keydown', this.onKeyDown);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        if (Array.isArray(object.material)) object.material.forEach(m => materials.add(m));
        else materials.add(object.material);
        if (object instanceof THREE.Mesh && object.customDepthMaterial) materials.add(object.customDepthMaterial);
      } else if (object instanceof THREE.Sprite) materials.add(object.material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    this.water.userData.releaseRefraction?.();
    Object.values(this.textures).forEach(texture => texture.dispose());
    this.environmentTarget.dispose();
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.renderer.forceContextLoss();
  }
}