export function assertSafeStorageKey(key: string) {
  if (!key || typeof key !== "string") throw new Error("Invalid storageKey");
  if (key.length > 1024) throw new Error("Invalid storageKey");
  if (key.trim() !== key) throw new Error("Invalid storageKey");

  // Prevent prefix escape / traversal.
  if (key.startsWith("/") || key.includes("\\") || key.includes("..")) {
    throw new Error("Invalid storageKey");
  }

  // Avoid control characters.
  for (let i = 0; i < key.length; i += 1) {
    const c = key.charCodeAt(i);
    if (c < 32 || c === 127) throw new Error("Invalid storageKey");
  }
}

export function assertStorageKeyOwnedByUser(args: { storageKey: string; userId: string }) {
  if (!args.userId) throw new Error("Invalid userId");
  const expectedPrefix = `u/${args.userId}/`;
  if (!args.storageKey.startsWith(expectedPrefix)) {
    throw new Error("storageKey does not belong to current user");
  }
}
