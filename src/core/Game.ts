import * as THREE from 'three';
import { Input } from './Input';
import { clock } from './Clock';
import { gfx, saveGraphics, applyPreset, guessPreset } from './Graphics';
import { audio } from './Audio';
import { events, toast } from './events';
import { setupNativeApp, haptic } from './Platform';
import { Sky } from '../world/Sky';
import { CloudSea } from '../world/CloudSea';
import { WeatherFx } from '../world/Weather';
import { World } from '../world/World';
import { LIGHTHOUSE_POS } from '../world/Lighthouse';
import { Player, ActorManager, type Actor } from '../entities/Actors';
import { UI } from '../ui/UI';
import { Menu } from '../ui/Menu';
import { BuildMode } from '../build/BuildMode';
import { gs, type PlacedBuilding } from '../systems/State';
import {
  ensureStarter,
  processNewDay,
  updateCrops,
  feedResident,
  talkResident,
  giftResident,
  friendLevel,
  inviteVisitor,
  fulfillSpirit,
  feedPet,
  petPet,
  petLevel,
  addFuel,
  plant,
  water,
  harvest,
  cropRemaining,
  emptyHomes,
  claimFestival,
} from '../systems/Life';
import { activeFestival } from '../data/festivals';
import { getBuildingDef, centerOf, footprint } from '../build/Placeable';
import { getItem, isFood, TASTE_LABEL } from '../data/items';
import { getResident, PERSONALITY_LABEL } from '../data/residents';
import { getSpirit } from '../data/spirits';
import { getSpecies } from '../data/species';
import { greeting, VISITOR_LINES } from '../data/dialogue';
import { Fishing } from '../minigames/Fishing';
import { Cooking } from '../minigames/Cooking';
import { StarCatch } from '../minigames/StarCatch';
import { FlowerPuzzle } from '../minigames/FlowerPuzzle';
import { PET_FORM_LABEL, petForm } from '../entities/CharacterFactory';
import { BIOME_LABEL } from '../world/Islands';
import { formatNum } from './levels';

interface Interactable {
  label: string;
  icon: string;
  act: () => void;
}

export class Game {
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
  private canvas: HTMLCanvasElement;
  input!: Input;
  sky!: Sky;
  clouds!: CloudSea;
  weather!: WeatherFx;
  world!: World;
  player!: Player;
  actors!: ActorManager;
  ui!: UI;
  menu!: Menu;
  build!: BuildMode;
  private camYaw = 0.6;
  private camPitch = 0.72;
  private camDist = 11;
  private camTarget = new THREE.Vector3();
  private paused = false;
  private lastFrame = 0;
  private fps = 60;
  private fpsT = 0;
  private fpsN = 0;
  private time = 0;
  private interactT = 0;
  private current: Interactable | null = null;
  private saveT = 0;
  private minigameOpen = false;
  private lastSeason = clock.season();
  private lastDayKey = clock.dayKey();
  private dayCheckT = 0;
  private autoDetect: { t: number; frames: number } | null = null;

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
  }

  async start(firstRun: boolean): Promise<void> {
    this.createRenderer();
    this.ui = new UI();
    this.input = new Input(this.canvas, this.ui.root);
    this.sky = new Sky(this.scene);
    this.clouds = new CloudSea(this.scene);
    this.weather = new WeatherFx(this.scene);
    this.scene.fog = new THREE.Fog(0xcfeeff, 30, gfx.drawDistance * 1.4);

    ensureStarter();
    this.world = new World(this.scene);
    this.world.init();
    this.player = new Player(this.scene);
    if (!this.world.walkable(this.player.pos.x, this.player.pos.z)) this.player.pos.set(0, 0, 4);
    this.actors = new ActorManager(this.scene, this.world);
    this.actors.sync(true);
    this.menu = new Menu(this.ui, {
      applyGraphics: (reload) => this.applyGraphics(reload),
      setTimeOverride: (o) => {
        clock.override = o;
        this.onTimeChanged();
      },
      resetSave: () => void gs.reset().then(() => location.reload()),
      rebuildPlayer: () => this.player.rebuild(),
      islands: () => this.world.islands.map((i) => ({ name: i.name, biome: i.biome })),
      debugLevelUp: import.meta.env.DEV ? () => this.debugLighthouse() : undefined,
    });
    this.build = new BuildMode(this.scene, this.world, this.ui, this.camera);
    this.build.onExit = () => {
      this.ui.setGameplayVisible(true);
      this.actors.sync();
    };
    this.ui.onAction = () => this.doAction();
    this.ui.onMenu = () => {
      audio.sfx('click');
      this.menu.open();
    };
    this.ui.onBuild = () => {
      audio.sfx('click');
      this.enterBuild();
    };
    this.input.onTap = (x, y) => this.build.tap(x, y);
    this.input.onKey = (k) => {
      if (k === 'e' || k === ' ' || k === 'enter') {
        if (!this.ui.dialogOpen && !this.ui.sheetOpen && !this.minigameOpen && !this.build.active) this.doAction();
      }
      if (k === 'b' && !this.ui.sheetOpen && !this.minigameOpen) this.build.active ? this.build.exit() : this.enterBuild();
      if (k === 'm' && !this.minigameOpen) this.ui.sheetOpen ? this.ui.closeSheet() : this.menu.open();
      if (k === 'escape') this.ui.back();
    };

    events.on('buildingsChanged', () => this.actors.sync());
    events.on('residentsChanged', () => this.actors.sync());
    events.on('islandAdded', () => this.onIslandAdded());
    events.on('inventoryChanged', () => gs.markDirty());

    window.addEventListener('resize', () => this.resize());
    this.resize();
    await setupNativeApp({
      onBack: () => this.ui.back(),
      onPause: () => this.pause(),
      onResume: () => this.resume(),
    });

    const msgs = processNewDay();
    this.world.spawnCollectibles();
    this.actors.sync();
    for (const c of updateCrops()) this.world.updateCropVisual(c);
    this.applyGraphics(false);
    if (!gfx.autoDetected) this.autoDetect = { t: 0, frames: 0 };

    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });

    this.lastFrame = performance.now();
    requestAnimationFrame(this.loop);

    setTimeout(() => {
      if (firstRun) this.intro();
      else if (msgs.length) this.ui.say('灯台日誌', msgs.join('\n'));
    }, 400);
  }

  private createRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: gfx.antialias, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    if (!gfx.autoDetected) {
      const p = guessPreset(this.renderer.getContext());
      applyPreset(p);
    }
  }

  applyGraphics(reload: boolean): void {
    if (reload) {
      void gs.save().then(() => location.reload());
      return;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1) * gfx.resolution;
    this.renderer.setPixelRatio(Math.max(0.5, dpr));
    this.resize();
    const real = gfx.shadows === 'real';
    this.renderer.shadowMap.enabled = real;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const sun = this.sky.sun;
    sun.castShadow = real;
    sun.shadow.mapSize.set(gfx.shadowRes, gfx.shadowRes);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = cam.bottom = -18;
    cam.right = cam.top = 18;
    cam.near = 1;
    cam.far = 120;
    cam.updateProjectionMatrix();
    sun.shadow.bias = -0.0015;
    sun.shadow.normalBias = 0.03;
    this.camera.far = gfx.drawDistance * 2 + 400;
    this.camera.updateProjectionMatrix();
    (this.scene.fog as THREE.Fog).far = gfx.drawDistance * 1.4;
    this.clouds.setAnimated(gfx.cloudAnim);
    this.weather.setDensity(gfx.particles);
    // shadow flags on existing objects
    this.world.rebuildAllBuildings();
    for (const isl of this.world.islands) this.world.rebuildPropMesh(isl);
    this.player.rebuild();
    this.actors.sync(true);
    this.renderer.compile(this.scene, this.camera);
  }

  private resize(): void {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private pause(): void {
    this.paused = true;
    audio.pause();
    void gs.save();
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    audio.resume();
    this.lastFrame = performance.now();
    this.checkDay(true);
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    if (this.paused) return;
    requestAnimationFrame(this.loop);
    const minDt = 1000 / gfx.fps - 1.5;
    const elapsed = now - this.lastFrame;
    if (elapsed < minDt) return;
    this.lastFrame = now;
    const dt = Math.min(0.1, elapsed / 1000);
    this.fpsN++;
    this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.fps = this.fpsN / this.fpsT;
      this.fpsN = 0;
      this.fpsT = 0;
    }
    if (this.minigameOpen) {
      // world paused under minigame overlays (saves battery)
      audio.update();
      return;
    }
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number): void {
    this.time += dt;
    const blocked = this.ui.dialogOpen || this.ui.sheetOpen || this.build.active;
    const move = blocked ? { x: 0, y: 0 } : this.input.getMove();
    const cam = this.input.consumeCam();
    if (this.build.active) {
      // pan camera with drag
      const s = this.camDist * 0.0022;
      const fx = -Math.sin(this.camYaw),
        fz = -Math.cos(this.camYaw);
      const rx = Math.cos(this.camYaw),
        rz = -Math.sin(this.camYaw);
      this.camTarget.x += (-cam.px * rx + cam.py * fx * -1) * s;
      this.camTarget.z += (-cam.px * rz + cam.py * fz * -1) * s;
      this.camDist = Math.max(8, Math.min(34, this.camDist + cam.zoom));
      if (this.input.isDown('q')) this.camYaw -= dt * 1.5;
      if (this.input.isDown('r')) this.camYaw += dt * 1.5;
    } else {
      this.camYaw -= cam.yaw;
      this.camPitch = Math.max(0.35, Math.min(1.25, this.camPitch + cam.pitch));
      this.camDist = Math.max(5, Math.min(24, this.camDist + cam.zoom));
    }
    this.player.update(dt, move, this.camYaw, this.world);
    if (!this.build.active) this.camTarget.lerp(new THREE.Vector3(this.player.pos.x, this.player.pos.y + 0.8, this.player.pos.z), Math.min(1, dt * 6));
    const pitch = this.build.active ? Math.max(this.camPitch, 0.95) : this.camPitch;
    const cp = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.camYaw) * Math.cos(pitch)).multiplyScalar(this.camDist);
    this.camera.position.copy(this.camTarget).add(cp);
    this.camera.lookAt(this.camTarget);

    const season = clock.season();
    const w = clock.weather();
    const night = clock.isNight();
    this.sky.update(dt, this.camera.position, w, season);
    (this.scene.fog as THREE.Fog).color.copy(this.sky.fogColor);
    this.clouds.update(dt, this.camTarget, this.sky.fogColor, this.sky.nightFactor);
    this.weather.update(dt, this.camTarget, season, w, night, true);
    this.world.update(dt, this.camTarget, this.sky.nightFactor, this.time);
    this.actors.update(dt, this.player, this.camTarget);
    this.build.update(this.camTarget, this.time);
    audio.setMood(clock.timeOfDay(), season);
    audio.update();

    // interactions (throttled)
    this.interactT -= dt;
    if (this.interactT <= 0 && !this.build.active) {
      this.interactT = 0.12;
      this.pickupNearby();
      this.current = blocked ? null : this.findInteraction();
      this.ui.setAction(this.current?.label ?? null, this.current?.icon);
    }
    this.ui.updateHud(this.fps);

    // periodic tasks
    this.dayCheckT -= dt;
    if (this.dayCheckT <= 0) {
      this.dayCheckT = 20;
      this.checkDay(false);
      for (const c of updateCrops()) this.world.updateCropVisual(c);
    }
    if (season !== this.lastSeason) {
      this.lastSeason = season;
      this.world.setSeason(season);
    }
    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = 15;
      gs.d.player.x = this.player.pos.x;
      gs.d.player.z = this.player.pos.z;
      if (gs.dirty) void gs.save();
    }
    if (this.autoDetect) this.runAutoDetect(dt);
  }

  /** Measure FPS during the first seconds and step down the preset if needed. */
  private runAutoDetect(dt: number): void {
    const a = this.autoDetect!;
    a.t += dt;
    a.frames++;
    if (a.t < 6) return;
    const fps = a.frames / a.t;
    this.autoDetect = null;
    gfx.autoDetected = true;
    if (fps < 24 && gfx.preset !== 'low') {
      const next = gfx.preset === 'high' ? 'mid' : 'low';
      applyPreset(next);
      this.applyGraphics(false);
      toast(`動作を軽くするため画質を「${next === 'low' ? '省電力' : '標準'}」にしました（設定で変更可）`, '⚙️');
    }
    saveGraphics();
  }

  private checkDay(force: boolean): void {
    const key = clock.dayKey();
    if (key !== this.lastDayKey || force) {
      this.lastDayKey = key;
      const msgs = processNewDay();
      this.world.spawnCollectibles();
      this.actors.sync();
      if (msgs.length) this.ui.say('灯台日誌', msgs.join('\n'));
    }
  }

  private onTimeChanged(): void {
    const s = clock.season();
    if (s !== this.lastSeason) {
      this.lastSeason = s;
      this.world.setSeason(s);
    }
  }

  private onIslandAdded(): void {
    const isl = this.world.raiseIsland();
    audio.sfx('levelup');
    void haptic('heavy');
    setTimeout(() => this.ui.say('灯台日誌', `灯台の光が強くなり、雲海から新しい浮島「${isl.name}」（${BIOME_LABEL[isl.biome]}）が浮かび上がった！虹の橋を渡って行ってみよう。`), 800);
    gs.markDirty();
  }

  private debugLighthouse(): void {
    gs.d.lighthouseXp += 2000;
    gs.d.islands++;
    events.emit('islandAdded', { index: gs.d.islands });
  }

  private enterBuild(): void {
    if (this.minigameOpen) return;
    this.ui.closeDialog();
    this.ui.closeSheet();
    this.ui.setGameplayVisible(false);
    this.input.reset();
    this.camTarget.set(this.player.pos.x, 0, this.player.pos.z);
    this.build.enter(this.player.pos.x, this.player.pos.z);
  }

  private openMinigame(m: { open: (cb: () => void) => void }): void {
    this.minigameOpen = true;
    this.ui.closeDialog();
    this.ui.setGameplayVisible(false);
    this.input.reset();
    m.open(() => {
      this.minigameOpen = false;
      this.ui.setGameplayVisible(true);
      this.lastFrame = performance.now();
      void gs.save();
    });
  }

  // ---------- interactions ----------
  private pickupNearby(): void {
    for (const c of this.world.collectibles) {
      if (Math.hypot(c.x - this.player.pos.x, c.z - this.player.pos.z) < 0.9) {
        this.world.pickCollectible(c);
        gs.add(c.item, 1);
        gs.addSkill('gathering', 5);
        audio.sfx('pick');
        break;
      }
    }
  }

  private findInteraction(): Interactable | null {
    const p = this.player.pos;
    const a = this.actors.nearest(p, 1.7, true);
    if (a) return this.actorInteraction(a);
    // buildings
    let best: { pb: PlacedBuilding; d: number } | null = null;
    for (const pb of gs.d.buildings) {
      const def = getBuildingDef(pb.type);
      if (!def.fn || def.fn === 'none') continue;
      const [cx, cz] = centerOf(def, pb.x, pb.z, pb.rot);
      const [w, d] = footprint(def, pb.rot);
      const dx = Math.max(0, Math.abs(p.x - cx) - w / 2),
        dz = Math.max(0, Math.abs(p.z - cz) - d / 2);
      const dist = Math.hypot(dx, dz);
      const lim = def.walkable ? 0.05 : 0.8;
      if (dist < lim && (!best || dist < best.d)) best = { pb, d: dist };
    }
    if (best) {
      const it = this.buildingInteraction(best.pb);
      if (it) return it;
    }
    const [lx, lz] = LIGHTHOUSE_POS;
    if (Math.hypot(p.x - lx, p.z - lz) < 3.6) return { label: '灯台', icon: '🗼', act: () => this.lighthouseMenu() };
    // natural props
    for (const pr of this.world.props.values()) {
      if (Math.hypot(pr.x - p.x, pr.z - p.z) < 1.3) {
        const today = clock.dayKey();
        const done = gs.d.propHarvest[pr.id] === today;
        const isTree = pr.kind === 'tree' || pr.kind === 'pine' || pr.kind === 'fruit';
        if (pr.kind === 'bush') continue;
        return {
          label: done ? (isTree ? '木' : '岩') : isTree ? 'ゆらす' : 'たたく',
          icon: isTree ? '🌳' : '🪨',
          act: () => {
            if (done) return toast('今日はもう何も出てこないみたい', '🍃');
            gs.d.propHarvest[pr.id] = today;
            this.harvestProp(pr.kind);
          },
        };
      }
    }
    const edge = this.world.nearIslandEdge(p.x, p.z);
    if (edge && !this.world.onBridge(p.x, p.z)) return { label: '釣りをする', icon: '🎣', act: () => this.openMinigame(new Fishing(this.ui, edge.isl.biome)) };
    const pet = this.actors.nearest(p, 1.6);
    if (pet) return this.actorInteraction(pet);
    return null;
  }

  private harvestProp(kind: string): void {
    audio.sfx('pick');
    void haptic('light');
    const r = Math.random();
    const skill = gs.skillLevel('gathering');
    const extra = Math.random() < skill * 0.02 ? 1 : 0;
    if (kind === 'fruit') gs.add(r < 0.5 ? 'apple' : 'pear', 2 + extra);
    else if (kind === 'tree') gs.add(r < 0.15 ? 'apple' : r < 0.25 ? 'mushroom' : 'wood', r < 0.25 ? 1 : 2 + extra);
    else if (kind === 'pine') gs.add(r < 0.15 ? 'mushroom' : 'wood', r < 0.15 ? 1 : 2 + extra);
    else if (kind === 'rock') gs.add(r < 0.1 ? 'skyore' : 'stone', r < 0.1 ? 1 : 2 + extra);
    else if (kind === 'orerock') gs.add(r < 0.6 ? 'skyore' : 'stone', 1 + extra);
    gs.addSkill('gathering', 8);
  }

  doAction(): void {
    audio.unlock();
    if (this.current) {
      audio.sfx('click');
      this.current.act();
    }
  }

  private actorInteraction(a: Actor): Interactable {
    if (a.kind === 'pet') return { label: `${a.name}`, icon: '☁️', act: () => this.petMenu(a) };
    if (a.kind === 'visitor') return { label: `${a.name}と話す`, icon: '💬', act: () => this.visitorTalk(a) };
    return { label: `${a.name}と話す`, icon: '💬', act: () => this.residentTalk(a) };
  }

  private residentTalk(a: Actor): void {
    const def = getResident(a.id);
    const r = gs.resident(a.id);
    if (!r) return;
    const lv = friendLevel(r.xp).level;
    const got = talkResident(a.id);
    if (got) a.showEmote('♪');
    const sub = `${getSpecies(def.species).name}・${PERSONALITY_LABEL[def.personality]}・なかよしLv.${friendLevel(r.xp).level}`;
    const menu = (text: string) =>
      this.ui.dialog(def.name, sub, text, [
        {
          label: '🍙 食べものをあげる',
          cls: 'primary',
          act: () =>
            this.ui.pickItem(`${def.name}に食べものをあげる`, (_, id) => isFood(id), (id) => {
              const res = feedResident(a.id, id);
              this.ui.closeSheet();
              if (res.xp > 0) {
                a.showEmote(res.kind === 'fav' ? '💖' : res.kind === 'like' ? '❤' : res.kind === 'dislike' ? '💧' : '♪');
                audio.sfx(res.kind === 'dislike' ? 'miss' : 'success');
              }
              menu(res.text + (res.xp ? `（なかよし +${res.xp}）` : ''));
            }, (d) => (d.taste ? (d.taste === def.likes ? '好き♪ ' : d.taste === def.dislikes ? '苦手… ' : '') + TASTE_LABEL[d.taste] : '')),
        },
        {
          label: '🎁 プレゼント',
          act: () =>
            this.ui.pickItem(`${def.name}にプレゼント`, () => true, (id) => {
              const xp = giftResident(a.id, id);
              this.ui.closeSheet();
              if (xp < 0) return menu('きょうはもうもらったよ。ありがとう！');
              a.showEmote('🎁');
              menu(`わあ、${getItem(id).name}！大事にするね（なかよし +${xp}）`);
            }),
        },
        { label: 'またね', act: () => this.ui.closeDialog() },
      ]);
    menu(greeting(def, lv));
  }

  private visitorTalk(a: Actor): void {
    const v = gs.d.visitors.find((x) => x.id === a.id && !x.done);
    if (!v) return;
    v.talks++;
    if (v.kind === 'spirit') {
      const sp = getSpirit(a.id)!;
      if (!gs.d.spiritsMet.includes(sp.id)) {
        gs.d.spiritsMet.push(sp.id);
        toast(`精霊図鑑に「${sp.title} ${sp.name}」を登録`, '📖');
      }
      this.ui.dialog(sp.name, sp.title, `${sp.line}\nお願い：${sp.want.label}がほしいな。`, [
        {
          label: `✨ ${sp.want.label}をわたす`,
          cls: 'primary',
          act: () => {
            const msg = fulfillSpirit(sp.id);
            if (!msg) return this.ui.say(sp.name, 'まだ足りないみたい…集まったらまた来てね。');
            a.showEmote('✨');
            this.ui.say(sp.name, `ありがとう！${msg}をあげるね。また次の${sp.season === 'winter' ? '冬' : sp.season === 'spring' ? '春' : sp.season === 'summer' ? '夏' : '秋'}に会おうね。`);
          },
        },
        { label: 'またね', act: () => this.ui.closeDialog() },
      ]);
      return;
    }
    const def = getResident(a.id);
    const homes = emptyHomes().length;
    const line = v.talks <= 1 ? VISITOR_LINES[a.id.length % VISITOR_LINES.length] : `この島、すっかり気に入っちゃった。${TASTE_LABEL[def.likes]}の食べものが好きなんだ${def.phrase ? '、' + def.phrase : ''}。`;
    this.ui.dialog(def.name, `旅人・${getSpecies(def.species).name}`, line, [
      {
        label: `🏠 島に住まない？（空き家 ${homes}）`,
        cls: 'primary',
        act: () => {
          if (v.talks < 2) return this.ui.say(def.name, 'うーん、まだこの島のことよく知らないから…もう少しお話ししよう？');
          const msg = inviteVisitor(a.id);
          this.ui.say(def.name, msg);
        },
      },
      {
        label: '🍙 食べものをあげる',
        act: () =>
          this.ui.pickItem(`${def.name}に食べものをあげる`, (_, id) => isFood(id), (id) => {
            gs.remove(id, 1);
            v.talks += 2;
            this.ui.closeSheet();
            a.showEmote('❤');
            this.ui.say(def.name, 'ありがとう！あなたって優しいね。');
          }),
      },
      { label: 'またね', act: () => this.ui.closeDialog() },
    ]);
  }

  private petMenu(a: Actor): void {
    const p = gs.d.pets.find((x) => String(x.id) === a.id);
    if (!p) return;
    const lv = petLevel(p.xp).level;
    const form = petForm(lv, p.traits);
    this.ui.dialog(p.name, `${PET_FORM_LABEL[form]} Lv.${lv}・まんぷく${Math.floor(p.fullness)}%`, form === 'egg' ? 'たまごの中で、ふわふわ動いている…。ごはんをあげると早く生まれるかも。' : 'ふわもち〜♪（うれしそうに跳ねている）', [
      {
        label: '🍙 ごはん',
        cls: 'primary',
        act: () =>
          this.ui.pickItem(`${p.name}にごはん`, (_, id) => isFood(id), (id) => {
            const msg = feedPet(p, id);
            this.ui.closeSheet();
            a.showEmote('💕');
            this.ui.say(p.name, msg);
          }, (d) => (d.taste ? TASTE_LABEL[d.taste] : '')),
      },
      {
        label: '🤚 なでる',
        act: () => {
          const msg = petPet(p);
          a.showEmote('♪');
          audio.sfx('pick');
          this.ui.say(p.name, msg);
        },
      },
      { label: '📋 ようす', act: () => (this.ui.closeDialog(), this.menu.open('pets')) },
      { label: 'またね', act: () => this.ui.closeDialog() },
    ]);
  }

  private lighthouseMenu(): void {
    const lv = gs.lighthouseLevel();
    const lit = gs.d.fuelDay === clock.dayKey() && gs.d.fuelTonight > 0;
    const text = `灯台 Lv.${lv}。今夜の灯り：${lit ? `${gs.d.fuelTonight}（ともっている）` : 'まだ灯っていない'}\n星屑・料理・虫などを燃料にくべると灯台が育ち、翌日には光に導かれた旅人や精霊がやってくる。`;
    this.ui.dialog('灯台', `次のレベルで新しい浮島が現れる`, text, [
      {
        label: '🔥 燃料をくべる',
        cls: 'primary',
        act: () =>
          this.ui.pickItem(
            '灯台に燃料をくべる',
            (d) => (d.fuel ?? 0) > 0,
            (id) => {
              const all = gs.count(id);
              const n = Math.max(1, Math.min(all, getItem(id).cat === 'material' ? all : 1));
              const f = addFuel(id, n);
              if (f) {
                toast(`${getItem(id).name}×${n} をくべた（灯り +${f}）`, '🔥');
                void haptic('medium');
              }
            },
            (d) => `灯り +${d.fuel}`,
            true,
          ),
      },
      { label: 'またね', act: () => this.ui.closeDialog() },
    ]);
  }

  private buildingInteraction(pb: PlacedBuilding): Interactable | null {
    const def = getBuildingDef(pb.type);
    switch (def.fn) {
      case 'kitchen':
        return { label: '料理する', icon: '🍳', act: () => this.openMinigame(new Cooking(this.ui)) };
      case 'starhill':
        return {
          label: '星集め',
          icon: '🌠',
          act: () => (clock.isNight() ? this.openMinigame(new StarCatch(this.ui)) : this.ui.say(def.name, '星集めは夜（19時〜5時）にできるよ。夕方になったらまた来よう。')),
        };
      case 'flowerbed':
      case 'greenhouse':
        return { label: '花パズル', icon: '🌷', act: () => this.openMinigame(new FlowerPuzzle(this.ui)) };
      case 'sell':
        return { label: '売る', icon: '🪙', act: () => this.sellMenu() };
      case 'farm':
        if (pb.type !== 'field') return null;
        return { label: pb.crop ? ((pb.crop.stage ?? 0) >= 3 ? '収穫する' : '畑') : '種をまく', icon: '🌱', act: () => this.farmMenu(pb) };
      case 'home':
        if (pb.owner === 'player') return { label: 'わが家', icon: '🏠', act: () => this.ui.dialog('わが家', '', 'ほっとする我が家。着せかえや色ぬりはここから。', [{ label: '👕 着せかえ', cls: 'primary', act: () => (this.ui.closeDialog(), this.menu.open('style')) }, { label: '💤 ひとやすみ（セーブ）', act: () => void gs.save().then(() => this.ui.say('わが家', 'セーブしました。ゆっくり休めた！')) }, { label: 'とじる', act: () => this.ui.closeDialog() }]) };
        if (pb.owner) {
          const def2 = getResident(pb.owner);
          return { label: `${def2.name}の家`, icon: '🏠', act: () => this.ui.say(`${def2.name}の家`, `${def2.name}が住んでいる家（Lv.${pb.level}）。なかよくなると増築されていくよ。`) };
        }
        return { label: '空き家', icon: '🏠', act: () => this.ui.say('空き家', '誰も住んでいない家。旅人に「島に住まない？」と誘ってみよう。') };
      case 'board':
        return { label: '掲示板', icon: '📋', act: () => this.boardInfo() };
      case 'bench':
        return {
          label: 'すわる',
          icon: '🪑',
          act: () => {
            for (const p of gs.d.pets) p.xp += 3;
            this.ui.say(def.name, `ひと休み…${clock.isNight() ? '星がきれい。' : '雲がゆっくり流れていく。'}ソラモチたちも寄ってきた。`);
          },
        };
      case 'tree':
        return {
          label: 'ゆらす',
          icon: '🌳',
          act: () => {
            const today = clock.dayKey();
            if (pb.harvestDay === today) return toast('今日はもう何も落ちてこない', '🍃');
            pb.harvestDay = today;
            gs.add(pb.type === 'apple_tree' ? 'apple' : pb.type === 'pear_tree' ? 'pear' : 'wood', 2);
            audio.sfx('pick');
          },
        };
      default:
        return null;
    }
  }

  private sellMenu(): void {
    this.ui.pickItem(
      '出荷する（タップで1つ売る）',
      (d) => d.cat !== 'seed',
      (id) => {
        const d = getItem(id);
        if (gs.remove(id, 1)) {
          gs.addCoins(d.price, true);
          audio.sfx('coin');
          toast(`${d.name} を ${d.price} 灯貨で売った（所持 ${formatNum(gs.d.coins)}）`, '🪙');
        }
      },
      (d) => `${d.price}灯貨`,
      true,
    );
    // seed shop inside sell box
    setTimeout(() => {
      const body = document.querySelector('.sheet-body');
      if (!body) return;
      const shop = document.createElement('div');
      shop.innerHTML = '<div class="section-title">種を買う</div>';
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const sid of ['seed_cloudberry', 'seed_skywheat', 'seed_mooncarrot', 'seed_pumpkin', 'seed_teaherb']) {
        const d = getItem(sid);
        const b = document.createElement('button');
        b.className = 'card';
        b.innerHTML = `<span class="ic">${d.icon}</span>${d.name}<small>${d.price * 2}灯貨</small>`;
        b.onclick = () => {
          if (gs.d.coins < d.price * 2) return toast('灯貨がたりない', '💦');
          gs.addCoins(-d.price * 2, true);
          gs.add(sid, 1, true);
          audio.sfx('coin');
          toast(`${d.name}を買った（所持 ${gs.count(sid)}）`, '🌱');
        };
        grid.append(b);
      }
      shop.append(grid);
      body.prepend(shop);
    }, 0);
  }

  private farmMenu(pb: PlacedBuilding): void {
    if (!pb.crop) {
      this.ui.pickItem('種をまく', (d) => d.cat === 'seed', (id) => {
        if (plant(pb, id)) {
          this.world.updateCropVisual(pb);
          audio.sfx('pick');
          toast(`${getItem(id).name}をまいた`, '🌱');
        }
        this.ui.closeSheet();
      });
      return;
    }
    if ((pb.crop.stage ?? 0) >= 3) {
      const n = harvest(pb);
      this.world.updateCropVisual(pb);
      audio.sfx('success');
      void haptic('medium');
      toast(`収穫！ ×${n}`, '🧺');
      return;
    }
    const crop = getItem(pb.crop.id);
    this.ui.dialog('畑', crop.name, `${crop.name}が育っている。${cropRemaining(pb)}（現実の時間で育つよ）`, [
      {
        label: '💧 水をやる',
        cls: 'blue',
        act: () => {
          water(pb);
          this.world.updateCropVisual(pb);
          for (const c of updateCrops()) this.world.updateCropVisual(c);
          this.ui.say('畑', `水をやった。成長が早くなる！${cropRemaining(pb)}`);
        },
      },
      { label: 'とじる', act: () => this.ui.closeDialog() },
    ]);
  }

  private boardInfo(): void {
    const fest = activeFestival();
    if (fest) {
      const msg = claimFestival();
      if (msg) {
        this.ui.say(`${fest.icon} ${fest.name}`, `${fest.desc}\n${msg}`, () => this.boardInfo2());
        return;
      }
    }
    this.boardInfo2();
  }

  private boardInfo2(): void {
    const lines: string[] = [];
    const vis = gs.d.visitors.filter((v) => !v.done);
    lines.push(vis.length ? `今日の訪問者：${vis.map((v) => (v.kind === 'spirit' ? getSpirit(v.id)?.name : getResident(v.id).name)).join('、')}` : '今日は旅人はいないみたい。夜に灯台を灯そう。');
    lines.push(`空き家：${emptyHomes().length}軒 ／ 住民：${gs.d.residents.length}人`);
    const bdays = gs.d.residents.filter((r) => getResident(r.id).birthday === clock.dayKey().slice(5));
    if (bdays.length) lines.push(`🎂 今日は${bdays.map((r) => getResident(r.id).name).join('、')}の誕生日！`);
    const tips = ['島のふちで「釣りをする」ができる', '夜は星見のベンチで星集め', '花壇で花パズル。新しい色は色ぬりに使える', '畑は現実の時間で育つ。水をやると早くなる', '灯台に燃料をくべると浮島が増える', '建設モードで建物を選んでタップすると色ぬり・強化ができる'];
    lines.push('💡 ' + tips[Math.floor(Date.now() / 60000) % tips.length]);
    this.ui.say('掲示板', lines.join('\n'));
  }

  private intro(): void {
    const steps = [
      'ようこそ、雲海の灯台守さん。ここは雲の上に浮かぶ「はじまりの島」。',
      '夜になったら灯台に星屑や料理をくべて灯そう。光に導かれて、旅人や季節の精霊がやってくるよ。',
      '旅人と仲良くなって家を建てれば、島に住んでくれる。食べものをあげるとなかよしレベルがどんどん上がる（上限なし）。',
      'ソラモチのたまごもあずかったよ。ごはんをあげて育ててね。食べたもので姿が変わるみたい。',
      '右上の🔨で建設、📖でメニュー。建物はタップして好きな色にぬれるよ。それでは、のんびりどうぞ！',
    ];
    let i = 0;
    const next = () => {
      if (i >= steps.length) return this.ui.closeDialog();
      const t = steps[i++];
      this.ui.dialog('灯台の手紙', `${i}/${steps.length}`, t, [{ label: i < steps.length ? 'つぎへ' : 'はじめる', cls: 'primary', act: next }]);
    };
    next();
  }
}
