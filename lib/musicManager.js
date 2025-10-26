// musicManager.js

import { useRef, useEffect } from "react";

export class MusicManager {
  constructor() {
    this.audio = null;
    this.userInteracted = false;
  }

  init() {
    if (typeof window !== "undefined" && typeof Audio !== "undefined" && !this.audio) {
      this.audio = new window.Audio('/music/background.mp3');
      this.audio.loop = true;
      this.audio.volume = 1.0;
    }
  }

  initOnUserInteraction() {
    if (!this.userInteracted && this.audio) {
      const playAudio = () => {
        this.audio.play().catch(() => {});
        this.userInteracted = true;
        document.removeEventListener("click", playAudio);
      };
      document.addEventListener("click", playAudio);
    }
  }

  mute() {
    if (this.audio) this.audio.muted = true;
  }

  unmute() {
    if (this.audio) this.audio.muted = false;
  }

  isMuted() {
    return this.audio ? this.audio.muted : true;
  }
}

// Usage example in page.jsx

// import { useEffect, useRef } from "react";
// const musicRef = useRef(null);
// useEffect(() => {
//   const setupMusic = async () => {
//     if (typeof window === "undefined") return;
//     const { MusicManager } = await import("../../lib/musicManager");
//     const mgr = new MusicManager();
//     mgr.init();
//     mgr.initOnUserInteraction();
//     musicRef.current = mgr;
//   };
//   setupMusic();
// }, []);

// Button example:
// <button
//   onClick={() => {
//     const mgr = musicRef.current;
//     if (mgr) mgr.isMuted() ? mgr.unmute() : mgr.mute();
//   }}
//   className="text-green-400 hover:text-green-200"
// >
//   🎵 Toggle Music
// </button>
