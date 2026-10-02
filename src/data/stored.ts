// A row as stored on the phone. Kept free of Dexie so server code (the
// reminder Edge Function) can share the sync mapping.
// updatedAt: when this row was last edited (on any device), for last-edit-wins.
// dirty: edited on this phone and not yet sent. deleted: a tombstone.
export type Stored<T> = T & { updatedAt: number; deleted?: 1; dirty?: 1 };
