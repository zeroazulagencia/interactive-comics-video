// Voces del narrador (minimax/speech-02-hd) que se ofrecen en el estudio.

export type Voice = { id: string; name: string; group: "Hombre" | "Mujer" };

export const DEFAULT_VOICE_ID = "Spanish_ReliableMan";
export const DEFAULT_VOICE_SPEED = 1.15;

export const VOICES: Voice[] = [
  { id: "Spanish_ReliableMan", name: "Confiable", group: "Hombre" },
  { id: "Spanish_Narrator", name: "Narrador", group: "Hombre" },
  { id: "Spanish_CaptivatingStoryteller", name: "Cuentacuentos", group: "Hombre" },
  { id: "Spanish_Deep-tonedMan", name: "Voz grave", group: "Hombre" },
  { id: "Spanish_WiseScholar", name: "Erudito", group: "Hombre" },
  { id: "Spanish_ThoughtfulMan", name: "Reflexivo", group: "Hombre" },
  { id: "Spanish_SereneElder", name: "Anciano sereno", group: "Hombre" },
  { id: "Spanish_Steadymentor", name: "Mentor", group: "Hombre" },
  { id: "Spanish_SereneWoman", name: "Serena", group: "Mujer" },
  { id: "Spanish_ConfidentWoman", name: "Segura", group: "Mujer" },
  { id: "Spanish_SophisticatedLady", name: "Sofisticada", group: "Mujer" },
  { id: "Spanish_ThoughtfulLady", name: "Reflexiva", group: "Mujer" },
  { id: "Spanish_Wiselady", name: "Sabia", group: "Mujer" },
  { id: "Spanish_Kind-heartedGirl", name: "Joven amable", group: "Mujer" },
  { id: "Spanish_CompellingGirl", name: "Joven intensa", group: "Mujer" },
];

export function voiceName(id: string): string {
  const v = VOICES.find((x) => x.id === id);
  return v ? `${v.name} (${v.group.toLowerCase()})` : id;
}

// Identifica con qué voz y velocidad se generó un audio, para detectar los que
// quedaron con una voz anterior.
export function voiceKey(voiceId: string, speed: number): string {
  return `${voiceId}@${speed.toFixed(2)}`;
}

export const VOICE_SAMPLE_TEXT =
  "Había una vez, en un pueblo junto al mar, una historia que nadie se atrevía a contar.";
