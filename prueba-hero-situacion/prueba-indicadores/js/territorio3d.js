// El territorio en 3D (Three.js, copiado a vendor/): cada municipio se levanta y se colorea según la capa elegida. La
// escena de Situación solo mueve números en `state` (el peso de cada capa y la cámara); el bucle de dibujo los lee en
// cada fotograma. No sabe de qué territorio se trata: las capas llegan hechas. Si no hay WebGL, devuelve false y quien lo
// llama pone el mapa en SVG.
import { reduced } from "./comun.js";
import { projection, rings } from "./mapa.js";

const REST = "#c9d6e2", LINE = 0x221e41, HMAX = 12;

/** Estado inicial: w[i] = peso de la capa i (la 0 es el relieve de la población) y cam = de lejos (0) a cerca (1). */
export const newState = (layers) => ({ w: layers.map((_, i) => (i === 0 ? 1 : 0)), cam: 0 });

/**
 * @param {HTMLElement} host donde va el lienzo
 * @param {object} geo GeoJSON de los municipios
 * @param {{color: (code: string) => string|null, height: (code: string) => number}[]} layers alturas de 0 a 1
 * @param {{state: {w: number[], cam: number}}} o
 */
export async function territory3d(host, geo, layers, { state }) {
  let THREE, renderer;
  try {
    THREE = await import("../vendor/three/three.module.min.js");
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch { return false; }
  const { P, W, H } = projection(geo);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.append(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  camera.up.set(0, 0, 1);
  scene.add(new THREE.HemisphereLight(0xffffff, LINE, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1); sun.position.set(-60, -90, 140); scene.add(sun);
  const meshes = [];
  for (const f of geo.features) {
    const code = f.properties.code;
    const shapes = rings(f.geometry).map((poly) => {
      const s = new THREE.Shape(poly[0].map((c) => new THREE.Vector2(...P(c))));
      for (const hole of poly.slice(1)) s.holes.push(new THREE.Path(hole.map((c) => new THREE.Vector2(...P(c)))));
      return s;
    });
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: REST, roughness: 0.9, metalness: 0 }));
    for (const poly of rings(f.geometry)) {
      mesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(poly[0].map((c) => new THREE.Vector3(...P(c), 1.001))),
        new THREE.LineBasicMaterial({ color: LINE, transparent: true, opacity: 0.4 })));
    }
    mesh.userData = { c: layers.map((l) => new THREE.Color(l.color(code) ?? REST)), h: layers.map((l) => Math.max(0.08, l.height(code) * HMAX)) };
    scene.add(mesh); meshes.push(mesh);
  }
  const size = Math.max(W, H);
  const far = new THREE.Vector3(0, -size * 0.95, size * 1.15), near = new THREE.Vector3(0, -size * 0.75, size * 0.6);
  let w = 0, h = 0, visible = true;
  const resize = () => { w = host.clientWidth; h = host.clientHeight; if (w && h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver((entries) => { visible = entries.at(-1).isIntersecting; }).observe(host);
  resize();
  renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); renderer.setAnimationLoop(null); host.dispatchEvent(new CustomEvent("sin3d")); });
  const clock = new THREE.Clock(), pos = new THREE.Vector3(), target = new THREE.Vector3(0, size * 0.04, 0);
  renderer.setAnimationLoop(() => {
    if (!visible || !w) return;
    const k = Math.max(0, Math.min(1, state.cam)), fit = Math.max(1, 1.25 / Math.min(1.25, w / h));
    pos.lerpVectors(far, near, k * k * (3 - 2 * k)).multiplyScalar(fit);
    if (!reduced()) pos.applyAxisAngle(camera.up, Math.sin(clock.getElapsedTime() * 0.15) * 0.05);
    camera.position.copy(pos); camera.lookAt(target);
    const sum = state.w.reduce((a, b) => a + b, 0) || 1;
    for (const m of meshes) {
      const u = m.userData, col = m.material.color;
      let z = 0; col.setRGB(0, 0, 0);
      state.w.forEach((wt, j) => {
        if (!wt) return;
        const f = wt / sum;
        z += u.h[j] * f; col.r += u.c[j].r * f; col.g += u.c[j].g * f; col.b += u.c[j].b * f;
      });
      m.scale.z = Math.max(0.05, z);
    }
    renderer.render(scene, camera);
  });
  return true;
}
