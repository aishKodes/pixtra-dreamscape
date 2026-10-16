import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merge static parts locally, keeping the groups used as animation joints intact.
export function batchStaticParts(group: THREE.Group) {
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  group.children.forEach(child => {
    if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || Array.isArray(child.material)) return;
    const batch = batches.get(child.material) ?? [];
    batch.push(child);
    batches.set(child.material, batch);
  });
  batches.forEach((meshes, material) => {
    if (meshes.length < 2) return;
    const preserveUV = meshes.every(mesh => Boolean(mesh.geometry.attributes.uv));
    const geometries = meshes.map(mesh => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      Object.keys(geometry.attributes).forEach(name => {
        if (name !== 'position' && name !== 'normal' && !(preserveUV && name === 'uv')) geometry.deleteAttribute(name);
      });
      return geometry;
    });
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(geometry => geometry.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.forEach(original => group.remove(original));
    group.add(mesh);
  });
}