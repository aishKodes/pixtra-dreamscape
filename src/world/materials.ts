import * as THREE from 'three';
import type { NatureUniforms } from './terrain';

export function weatheredMaterial(
  options: THREE.MeshStandardMaterialParameters,
  uniforms: NatureUniforms,
  moss = 0,
) {
  const material = new THREE.MeshStandardMaterial(options);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWinter = uniforms.winter;
    shader.uniforms.uRain = uniforms.rain;
    shader.uniforms.uMoss = { value: moss };
    shader.vertexShader = 'varying vec3 vNatureNormal; varying vec3 vNaturePosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 weatherNormal = normal;
      #ifdef USE_INSTANCING
        weatherNormal = mat3(instanceMatrix) * weatherNormal;
      #endif
      vNatureNormal = normalize(mat3(modelMatrix) * weatherNormal);
      vNaturePosition = position;
    `);
    shader.fragmentShader = 'uniform float uWinter, uRain, uMoss; varying vec3 vNatureNormal; varying vec3 vNaturePosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float facing = smoothstep(0.15, 0.82, vNatureNormal.y);
      float mottled = sin(vNaturePosition.x * 17.0 + sin(vNaturePosition.z * 14.0)) * 0.5 + 0.5;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.64, 0.86, 0.38), facing * mottled * uMoss);
      diffuseColor.rgb *= 1.0 - uRain * 0.2;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.91, 0.9), facing * uWinter);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = max(0.3, roughnessFactor - uRain * 0.24);
    `);
  };
  material.customProgramCacheKey = () => `weathered-${moss}`;
  return material;
}

export function swayMaterial(
  options: THREE.MeshStandardMaterialParameters,
  uniforms: NatureUniforms,
  strength: number,
) {
  const material = new THREE.MeshStandardMaterial(options);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.time;
    shader.uniforms.uRain = uniforms.rain;
    shader.uniforms.uWinter = uniforms.winter;
    shader.uniforms.uAutumn = uniforms.autumn;
    shader.uniforms.uSummer = uniforms.summer;
    shader.uniforms.uSway = { value: strength };
    shader.vertexShader = 'uniform float uTime, uRain, uWinter, uSway;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 origin = vec3(0.0);
      #ifdef USE_INSTANCING
        origin = instanceMatrix[3].xyz;
      #endif
      float bend = max(0.0, position.y);
      transformed.x += sin(uTime * 1.45 + origin.x * 0.6 + origin.z * 0.85) * bend * bend * uSway * (1.0 + uRain * 1.8);
      transformed.z += cos(uTime * 1.1 + origin.z * 0.66) * bend * bend * uSway * 0.5;
      transformed.y *= 1.0 - uWinter * 0.5;
    `);
    shader.fragmentShader = 'uniform float uWinter, uAutumn, uSummer;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      diffuseColor.rgb *= mix(vec3(1.0), vec3(1.43, 0.88, 0.53), uAutumn);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.83, 0.96, 0.74), uSummer);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.83, 0.79), uWinter * 0.85);
    `);
  };
  material.customProgramCacheKey = () => `sway-${strength}`;
  return material;
}