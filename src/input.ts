export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
}

export class Input {
  readonly state: InputState = {
    forward: false, back: false, left: false, right: false,
    jump: false, sprint: false,
  };

  yaw = 0;
  pitch = 0;
  mouseButton = -1;
  locked = false;

  onWheel: (dir: number) => void = () => {};
  onBreak: () => void = () => {}; // إعادة التمرير لاستخدامه في زر الماوس الأيسر
  onPlace: () => void = () => {};
  onSelect: (index: number) => void = () => {};

  private actionCooldown = 0;
  private softMode = false;
  private canvas: HTMLCanvasElement;
  private overlay: HTMLElement;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.attach();
  }

  private attach(): void {
    // بدء اللعبة بالضغط على الغطاء
    this.overlay.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.start();
    });
    this.overlay.addEventListener("click", (e) => {
      e.preventDefault();
      this.start();
    });

    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("pointerlockerror", () => this.fallback());

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      const lim = Math.PI / 2 - 0.01;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    });

    // إضافة استماع لعجلة الماوس (Wheel)
    window.addEventListener("wheel", (e) => {
      if (!this.locked) return;
      const dir = Math.sign(e.deltaY); // 1 للتمرير للأسفل، -1 للأعلى
      this.onWheel(dir);
    }, { passive: true });

    this.canvas.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      e.preventDefault();
      this.mouseButton = e.button;
      this.actionCooldown = 0.28;
      if (e.button === 0) this.onBreak();
      else if (e.button === 2) this.onPlace();
    });

    document.addEventListener("mouseup", () => { this.mouseButton = -1; });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    window.addEventListener("keydown", (e) => {
      this.setKey(e.code, true);
      const n = parseInt(e.key);
      if (n >= 1 && n <= 9) this.onSelect(n - 1);

      if (e.code === "Escape" && this.softMode) {
        this.softMode = false;
        this.locked = false;
        this.mouseButton = -1;
        this.clearKeys();
        this.overlay.classList.remove("hidden");
      }

      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => this.setKey(e.code, false));
  }

  private start(): void {
    this.overlay.classList.add("hidden");

    if (this.softMode || !this.canvas.requestPointerLock) {
      this.softMode = true;
      this.locked = true;
      return;
    }

    try {
      const p = this.canvas.requestPointerLock() as Promise<void> | void;
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => this.fallback());
      }
    } catch {
      this.fallback();
    }
  }

  private fallback(): void {
    this.softMode = true;
    this.locked = true;
    this.overlay.classList.add("hidden");
  }

  private onLockChange = (): void => {
    if (document.pointerLockElement === this.canvas) {
      this.locked = true;
      this.overlay.classList.add("hidden");
    } else if (!this.softMode) {
      this.locked = false;
      this.mouseButton = -1;
      this.clearKeys();
      this.overlay.classList.remove("hidden");
    }
  };

  private setKey(code: string, pressed: boolean): void {
    switch (code) {
      case "KeyW": case "ArrowUp":    this.state.forward = pressed; break;
      case "KeyS": case "ArrowDown":  this.state.back = pressed;    break;
      case "KeyA": case "ArrowLeft":  this.state.left = pressed;    break;
      case "KeyD": case "ArrowRight": this.state.right = pressed;   break;
      case "Space":                   this.state.jump = pressed;    break;
      case "ShiftLeft": case "ShiftRight": this.state.sprint = pressed; break;
    }
  }

  private clearKeys(): void {
    for (const k of Object.keys(this.state) as (keyof InputState)[]) {
      this.state[k] = false;
    }
  }

  /** استدعها كل إطار لتكرار الكسر/الوضع عند الاستمرار بالضغط */
  update(dt: number): void {
    if (!this.locked) return;
    if (this.mouseButton === 0 || this.mouseButton === 2) {
      this.actionCooldown -= dt;
      if (this.actionCooldown <= 0) {
        this.actionCooldown = 0.16;
        if (this.mouseButton === 0) this.onBreak();
        else this.onPlace();
      }
    }
  }
}