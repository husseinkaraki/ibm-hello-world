/** Client-safe: preview this exact composition, then POST the base prompt and focusWord separately. */
export function composeScenePrompt(prompt: string, focusWord?: string, options: { generateAudio?: boolean } = {}): string {
  if (!focusWord) return prompt;
  if (options.generateAudio === false) {
    return `${prompt.trim()}\n\nAUDIO SETTING: Generate a silent clip with no audio track. This explicit audio setting overrides any soundtrack requests in the scene description. PICTURE DIRECTION: The adult protagonist [name] visibly mouths the focus word ${JSON.stringify(focusWord)}. No precise word timing is required.`;
  }
  return `${prompt.trim()}\n\nAUDIO DIRECTION: Generate normal audible dialogue, natural ambience, sound effects, and a subtle dramatic music bed. The adult protagonist [name] visibly mouths only the focus word ${JSON.stringify(focusWord)} without vocalizing that word. Keep the protagonist's other words and all other characters' dialogue audible. Do not mute the whole scene. Follow the action naturally; no precise word timing is required.`;
}
