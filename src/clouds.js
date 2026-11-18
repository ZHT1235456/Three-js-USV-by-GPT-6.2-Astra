import * as THREE from 'three';

// This layer is enabled on the viewer camera only. The water's mirror camera
// keeps its original sky colour and lighting.
export const cloudLayer = 1;

function cloudNoise() {
  const size = 64;
  let seed = 1163;
  const grids = [4, 8, 16, 32].map((n) => {
    const values = new Float32Array(n ** 3);
    for (let i = 0; i < values.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      values[i] = seed / 4294967296;
    }
    return { n, values };
  });
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  function sample({ n, values }, x, y, z) {
    const scale = n / size;
    const px = x * scale,
      py = y * scale,
      pz = z * scale;
    const ix = Math.floor(px),
      iy = Math.floor(py),
      iz = Math.floor(pz);
    const x1 = (ix + 1) % n,
      y1 = (iy + 1) % n,
      z1 = (iz + 1) % n;
    const fx = smooth(px - ix),
      fy = smooth(py - iy),
      fz = smooth(pz - iz);
    const z0n = iz * n * n,
      z1n = z1 * n * n,
      y0n = iy * n,
      y1n = y1 * n;
    const front = lerp(
      lerp(values[z0n + y0n + ix], values[z0n + y0n + x1], fx),
      lerp(values[z0n + y1n + ix], values[z0n + y1n + x1], fx),
      fy
    );
    const back = lerp(
      lerp(values[z1n + y0n + ix], values[z1n + y0n + x1], fx),
      lerp(values[z1n + y1n + ix], values[z1n + y1n + x1], fx),
      fy
    );
    return lerp(front, back, fz);
  }
  const data = new Uint8Array(size ** 3);
  let index = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        data[index++] = Math.round(
          255 *
            (sample(grids[0], x, y, z) * 0.54 +
              sample(grids[1], x, y, z) * 0.27 +
              sample(grids[2], x, y, z) * 0.13 +
              sample(grids[3], x, y, z) * 0.06)
        );
      }
    }
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

export function createCloudSky() {
  const uniforms = {
    shape: { value: cloudNoise() },
    offset: { value: new THREE.Vector2() },
    sun: { value: new THREE.Vector3(-1.9, 5.4, -2.6).normalize() },
    horizon: { value: new THREE.Color(0xb9d3d3) },
    zenith: { value: new THREE.Color(0x80b0d7) },
    cloudBase: { value: new THREE.Color(0x92a6b4) },
    cloudLight: { value: new THREE.Color(0xfffcf3) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 ray;
      void main() {
        ray = position;
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);
        gl_Position = clip.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform highp sampler3D shape;
      uniform vec2 offset;
      uniform vec3 sun, horizon, zenith, cloudBase, cloudLight;
      varying vec3 ray;
      const float floorY = 160., ceilingY = 325.;
      float density(vec3 p) {
        float h = (p.y - floorY) / (ceilingY - floorY);
        float body = smoothstep(0., .16, h) * (1. - smoothstep(.48, 1., h));
        vec3 q = p * vec3(.00095, .00145, .00095);
        float weather = texture(shape, vec3(p.x*.00029+.18, .43, p.z*.00029-.34)).r;
        float broad = texture(shape, q + vec3(.63,.14,.29)).r;
        float detail = texture(shape, q*2.63 + vec3(.22,.07,.81)).r;
        float threshold = mix(.61, .45, smoothstep(.33,.69,weather)) + .16*(1.-body);
        return clamp((broad*.80 + detail*.20 - threshold) * 4.8, 0., 1.) * body;
      }
      void main() {
        vec3 dir = normalize(ray);
        vec3 sky = mix(horizon, zenith, smoothstep(-.015,.38,dir.y));
        vec3 result = sky;
        if (dir.y > .02) {
          vec3 eye = vec3(cameraPosition.x+offset.x, cameraPosition.y, cameraPosition.z+offset.y);
          float enter = max(0., (floorY-eye.y)/dir.y);
          float leave = min(7500., (ceilingY-eye.y)/dir.y);
          if (leave > enter) {
            float stride = (leave-enter)/32.;
            float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
            vec3 p = eye + dir*(enter+stride*(.28+.44*jitter));
            float transmittance = 1.;
            vec3 scatter = vec3(0.);
            for (int i=0;i<32;i++) {
              float d = density(p);
              if (d > .006) {
                float opticalDepth = density(p+sun*29.)*1.6 + density(p+sun*73.)*1.2;
                float direct = exp(-opticalDepth);
                float height = clamp((p.y-floorY)/(ceilingY-floorY),0.,1.);
                vec3 lighting = mix(cloudBase,cloudLight,clamp(.09+.70*direct+.18*height,0.,1.));
                float alpha = 1.-exp(-d*stride*.026);
                scatter += transmittance*alpha*lighting;
                transmittance *= 1.-alpha;
              }
              if (transmittance < .018) break;
              p += dir*stride;
            }
            float haze = smoothstep(.022,.084,dir.y)*(.94-.27*smoothstep(1500.,6500.,enter));
            result = mix(sky, scatter+transmittance*sky, haze);
          }
        }
        gl_FragColor = vec4(result,1.);
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), material);
  sky.layers.set(cloudLayer);
  sky.frustumCulled = false;
  sky.renderOrder = 1000;
  return sky;
}
