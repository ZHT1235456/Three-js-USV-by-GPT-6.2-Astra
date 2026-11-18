import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createVessel } from './vessel.js';
import { makeOcean } from './ocean.js';
import { cloudLayer, createCloudSky } from './clouds.js';

const UP = new THREE.Vector3(0, 1, 0);
const CAMERA = {
  follow: { target: [0.02, 0.35, 0], direction: [1.83, 1.78, -2.45], width: 3.2, height: 1.65 },
  top: { target: [0, 0, 0], direction: [-0.0001, 1, 0], width: 3.6, height: 3.45 },
  stern: { target: [-0.1, 0.2, 0], direction: [-2.55, 1.12, -1.25], width: 2.78, height: 1.47 },
  horizon: { target: [0, 0.36, 0], direction: [1.42, 0.115, -2.86], width: 3.72, height: 1.75 },
  whole: { target: [0, 0.37, 0], direction: [1.76, 1.41, -2.58], width: 3.15, height: 1.68 },
  drive: { target: [-1.025, -0.196, 0], direction: [-1.77, -0.47, -2.25], width: 0.83, height: 0.47 },
  mast: { target: [-0.15, 0.735, 0], direction: [1.85, 0.59, -2.1], width: 0.96, height: 0.86 },
  deck: { target: [-0.1, 0.26, 0], direction: [-0.82, 1.83, -1.18], width: 2.3, height: 1.42 },
};

function framingHeight(preset, aspect) {
  const widthFactor = THREE.MathUtils.lerp(0.88, 1, THREE.MathUtils.smoothstep(aspect, 0.95, 1.5));
  return Math.max(preset.height, (preset.width * widthFactor) / aspect);
}

function studioGround() {
  const ground = new THREE.Group();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ opacity: 0.17, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.373;
  shadow.receiveShadow = true;
  const grid = new THREE.GridHelper(10, 50, 0x8caaaf, 0x9fb6b9);
  grid.material.transparent = true;
  grid.material.opacity = 0.33;
  grid.material.depthWrite = false;
  grid.position.y = -0.375;
  ground.add(shadow, grid);
  return ground;
}

export class VesselViewer {
  constructor(host, initial, reducedMotion) {
    this.host = host;
    this.reducedMotion = reducedMotion;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.012, 190);
    this.camera.layers.enable(cloudLayer);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !reducedMotion;
    this.controls.dampingFactor = 0.105;
    this.controls.enablePan = false;
    this.controls.minDistance = 0.24;
    this.controls.maxDistance = 9;
    this.controls.rotateSpeed = 0.68;
    this.controls.zoomSpeed = 0.85;
    this.controls.addEventListener('start', () => {
      this.flight = null;
    });
    this.scene.add(new THREE.HemisphereLight(0xe2f1fa, 0x8aafae, 1.34));
    this.sun = new THREE.DirectionalLight(0xfff3de, 2.36);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -1.85,
      right: 1.85,
      top: 1.65,
      bottom: -1.65,
      near: 0.2,
      far: 12,
    });
    this.sun.shadow.normalBias = 0.003;
    this.sun.shadow.bias = -0.0002;
    this.scene.add(this.sun, this.sun.target);
    const studio = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(studio, 0.03);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.68;
    studio.dispose();
    pmrem.dispose();
    Object.assign(this, createVessel());
    this.carrier = new THREE.Group();
    this.carrier.add(this.root);
    this.scene.add(this.carrier);
    this.water = makeOcean();
    this.cloudSky = createCloudSky();
    this.ground = studioGround();
    this.scene.add(this.water, this.ground, this.cloudSky);
    this.mode = 'trial';
    this.view = 'follow';
    this.flight = null;
    this.lastHeading = initial.heading;
    this.waterTime = initial.time;
    this.studioPropAngle = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.setMode('trial', initial);
  }

  resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    const old = this.camera.aspect;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    // Preserve the user's orbital angle and zoom while fitting a narrower screen.
    const lens = CAMERA[this.view];
    if (lens && old && this.camera.position.lengthSq() > 0.01 && old !== this.camera.aspect) {
      this.camera.position
        .sub(this.controls.target)
        .multiplyScalar(framingHeight(lens, this.camera.aspect) / framingHeight(lens, old))
        .add(this.controls.target);
    }
  }

  setMode(mode, s) {
    this.mode = mode;
    const trial = mode === 'trial';
    this.scene.background = new THREE.Color(trial ? 0xb9d3d3 : 0xdce5e6);
    this.water.visible = trial;
    this.cloudSky.visible = trial;
    this.ground.visible = !trial;
    this.controls.maxPolarAngle = trial ? Math.PI * 0.496 : Math.PI * 0.938;
    this.controls.minPolarAngle = 0.00005;
    this.lastHeading = s.heading;
    this.carrier.rotation.y = trial ? -s.heading : 0;
    this.root.rotation.set(0, 0, 0);
    this.root.position.set(0, 0, 0);
    this.setView(trial ? 'follow' : 'whole', s, true);
  }

  setView(view, s, immediate = false) {
    const preset = CAMERA[view];
    if (!preset) return;
    this.view = view;
    const { target, direction } = preset;
    const look = new THREE.Vector3(...target),
      dir = new THREE.Vector3(...direction).normalize();
    if (this.mode === 'trial' && view !== 'top') {
      dir.applyAxisAngle(UP, -s.heading);
      look.applyAxisAngle(UP, -s.heading);
    }
    const fitHeight = framingHeight(preset, this.camera.aspect);
    const eye = dir
      .multiplyScalar(fitHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))))
      .add(look);
    // Clear any remaining orbital damping before moving to a part preset.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = damping;
    if (immediate || this.reducedMotion) {
      this.flight = null;
      this.controls.target.copy(look);
      this.camera.position.copy(eye);
      this.controls.update();
    } else {
      this.flight = {
        fromEye: this.camera.position.clone(),
        fromLook: this.controls.target.clone(),
        eye,
        look,
        elapsed: 0,
      };
    }
  }

  render(s, cmd, dt, advanced) {
    const trial = this.mode === 'trial';
    const yaw = trial ? -s.heading : 0;
    if (trial && this.view !== 'top' && !this.flight) {
      const turn = this.lastHeading - s.heading;
      this.camera.position.applyAxisAngle(UP, turn);
      this.controls.target.applyAxisAngle(UP, turn);
    }
    this.lastHeading = s.heading;
    this.carrier.rotation.y = yaw;
    if (trial) {
      this.waterTime = s.time;
      const motion = this.reducedMotion ? 0 : 1;
      this.root.position.y = motion * (0.006 * Math.sin(s.time * 1.35) + 0.003 * Math.sin(s.time * 2.27));
      this.root.rotation.x = motion * (0.01 * Math.sin(s.time * 1.29) - s.yawRate * s.surge * 0.047);
      this.root.rotation.z = motion * (0.006 * Math.sin(s.time * 0.98) + s.surge * 0.005);
      const u = this.water.material.uniforms;
      u.clock.value = this.waterTime;
      u.travel.value.set(s.north, s.east);
      this.cloudSky.material.uniforms.offset.value.set(s.north + s.time * 0.9, s.east + s.time * 0.34);
      u.forward.value.set(Math.cos(s.heading), Math.sin(s.heading));
      u.speed.value = Math.hypot(s.surge, s.sway);
      u.curvature.value = s.yawRate / Math.max(0.35, s.surge);
    } else {
      this.root.position.y = 0;
      this.root.rotation.set(0, 0, 0);
    }
    this.rudder.rotation.y = THREE.MathUtils.degToRad(trial ? s.rudder : cmd.rudder);
    // Advance in simulated seconds in trial mode; inspection previews the command.
    const propDt = trial ? advanced : dt;
    this.studioPropAngle =
      (this.studioPropAngle + (((trial ? s.rpm : cmd.rpm) * Math.PI) / 30) * propDt) % (2 * Math.PI);
    this.propeller.rotation.x = this.studioPropAngle;
    if (trial) this.sun.position.set(-1.9, 5.4, -2.6);
    else this.sun.position.set(2.2, 4.8, -2.1);
    if (this.flight) {
      const f = this.flight;
      f.elapsed += dt;
      const p = Math.min(1, f.elapsed / 0.52),
        ease = p * p * (3 - 2 * p);
      this.camera.position.lerpVectors(f.fromEye, f.eye, ease);
      this.controls.target.lerpVectors(f.fromLook, f.look, ease);
      if (p === 1) this.flight = null;
    }
    this.controls.update();
    if (!trial) this.ground.visible = this.camera.position.y > -0.365;
    this.renderer.render(this.scene, this.camera);
  }

  compassAngle() {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    return (Math.atan2(right.x, up.x) * 180) / Math.PI;
  }

  async exportGlb() {
    const model = this.root.clone(true);
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.getObjectByName('Rudder').rotation.set(0, 0, 0);
    model.getObjectByName('Propeller').rotation.set(0, 0, 0);
    const bytes = await new GLTFExporter().parseAsync(model, { binary: true });
    return new Blob([bytes], { type: 'model/gltf-binary' });
  }
}
