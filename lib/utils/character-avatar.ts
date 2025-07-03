/**
 * Get character avatar image path from character name
 */
export function getCharacterAvatarPath(characterName: string): string {
  const nameToFileMap: Record<string, string> = {
    '鈴木 ハジメ': 'suzuki-hajime.png',
    '星野 推子': 'hoshino-suiko.png',
    'スマイリー中村': 'smiley-nakamura.png',
    'カズママ': 'kazu-mama.png',
    'さとり和尚': 'satori-osho.png',
    '本田 菜': 'honda-na.png',
    '織田 ノブ': 'oda-nobu.png',
    'ミーコ': 'meeko.png'
  };

  const fileName = nameToFileMap[characterName];
  if (fileName) {
    return `/characters/${fileName}`;
  }
  
  // Fallback - return empty string to trigger text avatar
  return '';
}