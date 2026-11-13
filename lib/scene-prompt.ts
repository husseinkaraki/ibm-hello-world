/** Client-safe: preview this exact composition, then POST the base prompt and focusWord separately. */
export function composeScenePrompt(prompt: string, focusWord?: string, options: { generateAudio?: boolean; castReferences?: boolean } = {}): string {
  if (options.castReferences) {
    prompt = `${prompt.trim()}\n\nCAST REFERENCES: Reference image 1 is the learner: use that person's face and hair only for the adult protagonist [name]. Reference image 2 is Lucy: use the central foreground woman's face and hair only for Lucy, the same recurring co-star across every shot in which she appears. Ignore the background people in her photo. Keep [name] and Lucy distinct; never swap, blend, or duplicate their faces. Leo and Jules remain separate scripted characters, not people from Lucy's background. Follow the scripted hackathon wardrobe, setting, camera, and action rather than the reference photos' clothing or backgrounds.`;
  }
  if (!focusWord) return prompt;
  if (options.generateAudio === false) {
    return `${prompt.trim()}\n\nAUDIO SETTING: Generate a silent clip with no audio track. This explicit audio setting overrides any soundtrack requests in the scene description. PICTURE DIRECTION: The adult protagonist [name] visibly mouths the focus word ${JSON.stringify(focusWord)}. Follow the scripted action and performance.`;
  }
  return `${prompt.trim()}\n\nAUDIO DIRECTION: Generate normal audible dialogue, natural ambience, sound effects, and a subtle dramatic music bed. The adult protagonist [name] visibly mouths only the focus word ${JSON.stringify(focusWord)} without vocalizing that word. Keep the protagonist's other words and all other characters' dialogue audible. Do not mute the whole scene. Follow the scripted action and performance.`;
}
