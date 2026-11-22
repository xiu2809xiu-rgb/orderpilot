/** The short click when a person switches it, a triangle tone that slides up (to day) or down (to night). */
export interface Click {
  /** Plays the click for the state the switch has just moved to. */
  play: (checked: boolean) => void;
  close: () => void;
}

export function createClick(): Click {
  let audio: AudioContext | undefined;
  return {
    play(checked) {
      if (typeof AudioContext === "undefined") return;
      try {
        audio ??= new AudioContext();
        if (audio.state === "suspended")
          void audio.resume().catch(() => undefined);
        const tone = audio.createOscillator();
        const volume = audio.createGain();
        const start = audio.currentTime;
        tone.type = "triangle";
        tone.frequency.setValueAtTime(checked ? 1500 : 900, start);
        tone.frequency.exponentialRampToValueAtTime(
          checked ? 2300 : 480,
          start + 0.06,
        );
        volume.gain.setValueAtTime(1e-4, start);
        volume.gain.exponentialRampToValueAtTime(0.1, start + 5e-3);
        volume.gain.exponentialRampToValueAtTime(1e-4, start + 0.09);
        tone.connect(volume).connect(audio.destination);
        tone.onended = () => {
          tone.disconnect();
          volume.disconnect();
        };
        tone.start(start);
        tone.stop(start + 0.1);
      } catch {
        // A browser that refuses audio (autoplay rules, no device) just stays quiet.
      }
    },
    close() {
      if (audio) void audio.close().catch(() => undefined);
      audio = undefined;
    },
  };
}
