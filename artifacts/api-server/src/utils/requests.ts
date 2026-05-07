export function getParam(req: any, key: string): string {
  const value = req.params?.[key];
  if (!value) throw new Error(`Missing param: ${key}`);
  return String(value);
}

export function getBody<T = any>(req: any): T {
  return req.body as T;
}