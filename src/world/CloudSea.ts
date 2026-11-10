import * as THREE from 'three';

export const CLOUD_Y = -9;

/** The sea of clouds below the islands. Animated shader or static lambert. */
export class CloudSea {
  mesh: THREE.Mesh;
  private animMat: THREE.ShaderMaterial;
  private staticMat: THREE.MeshLambertMaterial;
  private puffs: THREE.InstancedMesh;
  private time = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(1200, 1200, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.animMat = new THREE.ShaderMaterial({
      transparent: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uCol: { value: new THREE.Color('#ffffff') }, uShade: { value: new THREE.Color('#b8c8e8') } },
      ]),
      vertexShader: `
        #include <fog_pars_vertex>
        varying vec2 vW;
        void main(){
          vec4 wp = modelMatrix * vec4(position,1.0);
          vW = wp.xz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float uTime; uniform vec3 uCol; uniform vec3 uShade;
        varying vec2 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 p = vW*0.035;
          float v = n(p + vec2(uTime*0.05, uTime*0.02))*0.55 + n(p*2.3 - vec2(uTime*0.04,0.0))*0.3 + n(p*5.0)*0.15;
          vec3 c = mix(uShade, uCol, smoothstep(0.25, 0.8, v));
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }`,
    });
    this.staticMat = new THREE.MeshLambertMaterial({ color: '#e8eef8' });
    this.mesh = new THREE.Mesh(geo, this.animMat);
    this.mesh.position.y = CLOUD_Y;
    scene.add(this.mesh);

    // puffy cloud blobs floating around
    const pg = new THREE.IcosahedronGeometry(1, 1);
    this.puffs = new THREE.InstancedMesh(pg, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), 90);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 260;
      const s = 3 + Math.random() * 7;
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, CLOUD_Y + 0.5 + Math.random(), Math.sin(a) * r),
        new THREE.Quaternion(),
        new THREE.Vector3(s, s * 0.45, s * (0.8 + Math.random() * 0.6)),
      );
      this.puffs.setMatrixAt(i, m);
    }
    scene.add(this.puffs);
  }

  setAnimated(on: boolean): void {
    this.mesh.material = on ? this.animMat : this.staticMat;
  }

  update(dt: number, center: THREE.Vector3, light: THREE.Color, night: number): void {
    this.time += dt;
    this.animMat.uniforms.uTime.value = this.time;
    const col = new THREE.Color('#ffffff').lerp(light, 0.5).lerp(new THREE.Color('#3a4580'), night * 0.7);
    this.animMat.uniforms.uCol.value.copy(col);
    this.animMat.uniforms.uShade.value.copy(col).multiplyScalar(0.78);
    this.staticMat.color.copy(col);
    (this.puffs.material as THREE.MeshLambertMaterial).color.copy(col).multiplyScalar(1.05);
    this.mesh.position.x = Math.round(center.x / 50) * 50;
    this.mesh.position.z = Math.round(center.z / 50) * 50;
  }
}
