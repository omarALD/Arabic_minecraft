import * as THREE from "three";
import type { World } from "./world";
import type { Input } from "./input";
import type { BlockId } from "./core";
import {
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE,
  GRAVITY, JUMP_SPEED, WALK_SPEED, SPRINT_SPEED, REACH,
} from "./core";
import { moveAxis, raycastVoxel } from "./physics";

export class Player {
  readonly pos = new THREE.Vector3(0.5, 30, 0.5);
  readonly vel = new THREE.Vector3();
  onGround = false;

  constructor(private world: World, private input: Input) {}

  update(dt: number): void {
    const s = this.input.state;
    const speed = s.sprint ? SPRINT_SPEED : WALK_SPEED;

    const fx = -Math.sin(this.input.yaw);
    const fz = -Math.cos(this.input.yaw);
    const rx =  Math.cos(this.input.yaw);
    const rz = -Math.sin(this.input.yaw);

    let mx = 0, mz = 0;
    if (s.forward) { mx += fx; mz += fz; }
    if (s.back)    { mx -= fx; mz -= fz; }
    if (s.right)   { mx += rx; mz += rz; }
    if (s.left)    { mx -= rx; mz -= rz; }

    const len = Math.hypot(mx, mz);
    if (len > 0) { mx = (mx / len) * speed; mz = (mz / len) * speed; }

    this.vel.x = mx;
    this.vel.z = mz;

    if (s.jump && this.onGround) {
      this.vel.y = JUMP_SPEED;
      this.onGround = false;
    }

    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -55) this.vel.y = -55;

    moveAxis(this.world, this.pos, "x", this.vel.x * dt);
    moveAxis(this.world, this.pos, "z", this.vel.z * dt);
    const movedY = moveAxis(this.world, this.pos, "y", this.vel.y * dt);

    if (movedY === 0 && this.vel.y < 0) {
      this.onGround = true;
      this.vel.y = 0;
    }

    if (this.pos.y < -20) {
      this.pos.set(0.5, 40, 0.5);
      this.vel.set(0, 0, 0);
    }
  }

  eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + PLAYER_EYE, this.pos.z);
  }

  lookDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.input.pitch, this.input.yaw, 0, "YXZ"));
    return dir;
  }


placeBlock(blockId: BlockId): boolean {
  const hit = raycastVoxel(this.world, this.eyePosition(), this.lookDirection(), REACH);
  if (!hit) return false;
  const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
  if (this.world.getBlock(x, y, z) !== 0) return false;
  if (this.overlapsSelf(x, y, z)) return false;
  this.world.setBlock(x, y, z, blockId);
  return true;
}

  private overlapsSelf(bx: number, by: number, bz: number): boolean {
    const hw = PLAYER_WIDTH / 2;
    const p = this.pos;
    return bx + 1 > p.x - hw && bx < p.x + hw &&
           by + 1 > p.y     && by < p.y + PLAYER_HEIGHT &&
           bz + 1 > p.z - hw && bz < p.z + hw;
  }
}