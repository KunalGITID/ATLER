// Only for typechecking (see tsconfig.json); Deno provides the real things.
declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Response | Promise<Response>): void };
declare module 'npm:web-push@3.6.7' { const w: any; export default w; }
declare module 'npm:@supabase/supabase-js@2' { export * from '@supabase/supabase-js'; }
