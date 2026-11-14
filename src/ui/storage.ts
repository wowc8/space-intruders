export interface Preferences { muted: boolean; volume: number }
export interface SaveData { version: 1; highScore: number; preferences: Preferences }

const KEY = 'space-intruders.save.v1';
export const DEFAULT_SAVE: SaveData = { version: 1, highScore: 0, preferences: { muted: false, volume: 0.45 } };
const defaultSave = (): SaveData => ({ version: 1, highScore: 0, preferences: { ...DEFAULT_SAVE.preferences } });

export function parseSave(raw: string | null): SaveData {
  if (!raw) return defaultSave();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return defaultSave();
    const record = value as Record<string, unknown>;
    const prefs = record.preferences as Record<string, unknown> | undefined;
    if (record.version !== 1 || !prefs) return defaultSave();
    const highScore = record.highScore;
    const volume = prefs.volume;
    return {
      version: 1,
      highScore: typeof highScore === 'number' && Number.isSafeInteger(highScore) && highScore >= 0 ? highScore : 0,
      preferences: {
        muted: typeof prefs.muted === 'boolean' ? prefs.muted : false,
        volume: typeof volume === 'number' && Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : DEFAULT_SAVE.preferences.volume,
      },
    };
  } catch { return defaultSave(); }
}

export function loadSave(storage?: Pick<Storage, 'getItem'>): SaveData {
  try { return parseSave((storage ?? globalThis.localStorage).getItem(KEY)); }
  catch { return defaultSave(); }
}

export function writeSave(data: SaveData, storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? globalThis.localStorage).setItem(KEY, JSON.stringify(data)); }
  catch { /* Private mode and unavailable storage still allow play. */ }
}
