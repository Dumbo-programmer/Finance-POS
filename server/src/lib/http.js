export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        error: 'Validation failed',
        code: 'VALIDATION',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

export function parseId(value) {
  return String(value || '').trim();
}

export function notFound(message = 'Not found') {
  return Object.assign(new Error(message), { status: 404 });
}

export function errorHandler(err, _req, res, _next) {
  const message = err?.message || 'Internal server error';
  if (!err.status || err.status >= 500) console.error('[api:error]', err);
  const status = err.status || (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505' ? 409 : 500);
  const code = err.code || (status === 409 ? 'CONFLICT' : 'ERROR');
  res.status(status).json({
    error: status >= 500 ? 'Unexpected server error' : message,
    code,
    details: err.details || undefined,
  });
}
