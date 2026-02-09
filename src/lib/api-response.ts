import { NextResponse } from "next/server";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data } satisfies ApiOk<T>, init);
}

export function err(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, details } } satisfies ApiErr,
    { status }
  );
}
