import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { asyncHandler, validate } from '../lib/http.js';
import { createProduct, listCategories, listProducts, updateProduct } from '../models/products.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await listProducts(db, {
    category: String(req.query.category || 'All'),
    q: String(req.query.q || ''),
    includeInactive: req.query.all === '1',
  }));
}));

router.get('/categories', asyncHandler(async (_req, res) => {
  res.json(await listCategories(db));
}));

const productSchema = z.object({
  sku: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  price_cents: z.number().int().min(0).max(10_000_000),
  tax_bps: z.number().int().min(0).max(5000).optional(),
  icon: z.string().max(12).optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
});

router.post('/', validate(productSchema), asyncHandler(async (req, res) => {
  const product = await db.tx((t) => createProduct(t, req.body, 'admin'));
  res.status(201).json(product);
}));

const patchSchema = productSchema.partial().extend({ active: z.boolean().optional() });
router.patch('/:id', validate(patchSchema), asyncHandler(async (req, res) => {
  res.json(await db.tx((t) => updateProduct(t, req.params.id, req.body)));
}));

export default router;
