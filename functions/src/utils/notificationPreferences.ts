export type NotificationPreferenceKey =
  | "newMatches"
  | "newMessages"
  | "likedMe";

export const isNotificationPreferenceEnabled = (
  preferences: unknown,
  key: NotificationPreferenceKey
): boolean => {
  if (!isRecord(preferences)) {
    return true;
  }

  return preferences[key] !== false;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
