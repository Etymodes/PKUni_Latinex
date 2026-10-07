export const communityAvatarPresets = [
  { id: 'cat', emoji: '🐱', zh: '猫', en: 'Cat' },
  { id: 'dog', emoji: '🐶', zh: '狗', en: 'Dog' },
  { id: 'fox', emoji: '🦊', zh: '狐狸', en: 'Fox' },
  { id: 'rabbit', emoji: '🐰', zh: '兔子', en: 'Rabbit' },
  { id: 'panda', emoji: '🐼', zh: '熊猫', en: 'Panda' },
  { id: 'owl', emoji: '🦉', zh: '猫头鹰', en: 'Owl' },
  { id: 'apple', emoji: '🍎', zh: '苹果', en: 'Apple' },
  { id: 'strawberry', emoji: '🍓', zh: '草莓', en: 'Strawberry' },
  { id: 'cherry', emoji: '🍒', zh: '樱桃', en: 'Cherry' },
  { id: 'lemon', emoji: '🍋', zh: '柠檬', en: 'Lemon' },
  { id: 'peach', emoji: '🍑', zh: '桃子', en: 'Peach' },
  { id: 'grapes', emoji: '🍇', zh: '葡萄', en: 'Grapes' },
] as const;

export type CommunityAvatar = { kind: 'initials'; value: string } | { kind: 'preset'; value: typeof communityAvatarPresets[number]['id'] };
export const defaultCommunityAvatar: CommunityAvatar = { kind: 'preset', value: 'cat' };

export function isCommunityAvatar(value: unknown): value is CommunityAvatar {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2
    || Object.keys(value).some(key => key !== 'kind' && key !== 'value')) return false;
  const avatar = value as { kind?: unknown; value?: unknown };
  if (typeof avatar.value !== 'string') return false;
  if (avatar.kind === 'preset') return communityAvatarPresets.some(preset => preset.id === avatar.value);
  // Matching the whole returned span also rejects the trailing newline allowed by JavaScript's $ anchor.
  return avatar.kind === 'initials' && avatar.value.match(/^(?:[A-Z]{1,2}|[A-Z][a-z]{1,2})$/)?.[0] === avatar.value;
}

export function normalizeCommunityAvatar(value: unknown): CommunityAvatar {
  return isCommunityAvatar(value) ? { ...value } : { ...defaultCommunityAvatar };
}

export function communityAvatarText(value: unknown): string {
  const avatar = normalizeCommunityAvatar(value);
  return avatar.kind === 'initials' ? avatar.value : communityAvatarPresets.find(preset => preset.id === avatar.value)!.emoji;
}
