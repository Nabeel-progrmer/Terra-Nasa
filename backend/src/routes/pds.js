import { Router } from 'express';
import { z } from 'zod';
import { cached } from '../services/providerCache.js';
import { fetchJson } from '../services/providerFetch.js';
import env from '../config/env.js';
import { decodePdsDelimitedProduct, PdsDecodeError } from '../services/pdsTableDecoder.js';

const router = Router();
const PDS_SEARCH_BASE = 'https://pds.mcp.nasa.gov/api/search/1/';
const PAGE_SIZE = 25;
const pdsLidSchema = z.string()
  .trim()
  .min(16)
  .max(240)
  .regex(/^urn:nasa:pds:[a-z0-9][a-z0-9._:-]*$/i)
  .refine((value) => !value.includes('::'));
const archiveQuery = z.object({
  lid: pdsLidSchema,
  cursor: pdsLidSchema.optional(),
}).strict();
const decodeQuery = z.object({
  lid: pdsLidSchema,
  recordType: z.coerce.number().int().min(0).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(3),
}).strict();

function isPdsLid(value) {
  return typeof value === 'string' && pdsLidSchema.safeParse(value).success;
}

function safeHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function usableDate(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  const year = new Date(value).getUTCFullYear();
  return year >= 1800 && year <= 2200 ? value : null;
}

function normalizeProduct(product) {
  const lid = product?.properties?.lid?.[0] || product?.id?.split('::')[0];
  if (!isPdsLid(lid) || typeof product.title !== 'string' || typeof product.type !== 'string') {
    const error = new Error('NASA PDS returned an incomplete archive product.');
    error.status = 502;
    throw error;
  }

  return {
    lid,
    title: product.title,
    productType: product.type,
    version: product.metadata?.version || product.properties?.vid?.[0] || null,
    startDate: usableDate(product.start_date_time),
    stopDate: usableDate(product.stop_date_time),
    updatedAt: usableDate(product.metadata?.update_date_time),
    labelUrl: safeHttpsUrl(product.metadata?.label_url),
  };
}

function makeProductUrl(lid, suffix = '') {
  return new URL(`products/${encodeURIComponent(lid)}${suffix}`, PDS_SEARCH_BASE);
}

router.get('/space/planetary-archive', async (req, res) => {
  const parsed = archiveQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid NASA PDS archive request',
      message: 'Provide a NASA PDS product LID and, when paging, a valid PDS product cursor.',
    });
  }

  const { lid, cursor } = parsed.data;
  try {
    const result = await cached(`pds-archive:${lid}:${cursor || ''}`, 600, async () => {
      let rawProduct;
      try {
        rawProduct = await fetchJson(makeProductUrl(lid));
      } catch (error) {
        if (error.status === 404) error.pdsProductNotFound = true;
        throw error;
      }

      const product = normalizeProduct(rawProduct);
      let members = { total: 0, limit: PAGE_SIZE, items: [], nextCursor: null };
      if (product.productType === 'Product_Bundle' || product.productType === 'Product_Collection') {
        const url = makeProductUrl(product.lid, '/members');
        const searchParams = new URLSearchParams({
          limit: String(PAGE_SIZE + 1),
          fields: 'lid,title,type,vid',
          sort: 'lid',
        });
        if (cursor) searchParams.set('search-after', cursor);
        url.search = searchParams;
        const payload = await fetchJson(url);
        if (!Number.isInteger(payload?.summary?.hits) || !Array.isArray(payload.data)) {
          const error = new Error('NASA PDS returned an incomplete archive member list.');
          error.status = 502;
          throw error;
        }
        const items = payload.data.slice(0, PAGE_SIZE).map(normalizeProduct);
        const hasMore = payload.data.length > PAGE_SIZE;
        members = {
          total: payload.summary.hits,
          limit: PAGE_SIZE,
          items,
          nextCursor: hasMore ? items.at(-1)?.lid || null : null,
        };
      }

      return {
        source: 'NASA Planetary Data System Registry',
        sourceUrl: 'https://pds.mcp.nasa.gov/api/search/1/api-docs',
        dataType: 'Archive catalog metadata, not decoded science measurements',
        retrievedAt: new Date().toISOString(),
        product,
        members,
      };
    });

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json(result);
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    const notFound = error.pdsProductNotFound === true;
    const rateLimited = error.status === 429;
    return res.status(notFound ? 404 : timedOut ? 504 : rateLimited ? 503 : 502).json({
      error: notFound ? 'NASA PDS product not found' : rateLimited ? 'NASA PDS rate limited' : 'NASA PDS archive unavailable',
      message: notFound
        ? 'NASA PDS did not find a product with that LID. Check the identifier in the PDS catalog.'
        : timedOut
          ? 'NASA PDS did not respond before the request timeout.'
          : rateLimited
            ? 'NASA PDS is temporarily rate limiting archive requests. Wait before trying again.'
            : 'NASA PDS could not provide archive metadata right now. Try again later.',
      source: 'NASA Planetary Data System Registry',
    });
  }
});

router.get('/space/planetary-archive/decode', async (req, res) => {
  const parsed = decodeQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid NASA PDS decode request',
      message: 'Provide a NASA PDS observational product LID, an optional record type, and a row limit from 1 to 10.',
    });
  }

  const { lid, recordType, limit } = parsed.data;
  try {
    const result = await cached(`pds-decode:${lid}:${recordType ?? 'label-default'}:${limit}`, 900, async () => {
      let rawProduct;
      try {
        rawProduct = await fetchJson(makeProductUrl(lid));
      } catch (error) {
        if (error.status === 404) error.pdsProductNotFound = true;
        throw error;
      }
      const product = normalizeProduct(rawProduct);
      if (product.productType !== 'Product_Observational' || !product.labelUrl) {
        const error = new PdsDecodeError('Choose an observational PDS product that provides a public product label.');
        error.status = 422;
        throw error;
      }
      const decoded = await decodePdsDelimitedProduct({
        labelUrl: product.labelUrl,
        recordType,
        limit,
        timeoutMs: env.PROVIDER_TIMEOUT_MS,
      });
      return {
        source: 'NASA Planetary Data System',
        sourceUrl: product.labelUrl,
        registryUrl: makeProductUrl(lid).href,
        dataType: decoded.kind === 'sample-series'
          ? 'PDS4 repeated numeric samples decoded from the archived observation table'
          : 'PDS4 delimited observation table decoded from the archived product',
        retrievedAt: new Date().toISOString(),
        product,
        observation: decoded.observation,
        dataUrl: decoded.dataUrl,
        kind: decoded.kind,
        schema: decoded.schema,
        group: decoded.group,
        recordCount: decoded.recordCount,
        returnedCount: decoded.returnedCount,
        recordLimit: decoded.recordLimit,
        selectedRecordType: decoded.selectedRecordType,
        availableRecordTypes: decoded.availableRecordTypes,
        recordTypeField: decoded.recordTypeField,
        rows: decoded.rows,
        limitations: 'Values are decoded from the product’s PDS4 label and delimited data file. Repeated samples are decimated for display when needed; the returned sample indices preserve their positions in the source array.',
      };
    });
    res.set('Cache-Control', 'private, max-age=300');
    return res.json(result);
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    const notFound = error.pdsProductNotFound === true;
    const rateLimited = error.status === 429;
    const status = notFound ? 404 : timedOut ? 504 : rateLimited ? 503 : error.status === 422 ? 422 : 502;
    return res.status(status).json({
      error: notFound ? 'NASA PDS product not found' : 'NASA PDS decoding unavailable',
      message: notFound
        ? 'NASA PDS did not find a product with that LID.'
        : timedOut
          ? 'NASA PDS did not respond before the decoding timeout.'
          : rateLimited
            ? 'NASA PDS is temporarily rate limiting product requests. Wait before trying again.'
            : error.status === 422
              ? error.message
              : 'NASA PDS returned a product that TERRA could not decode. Check the product label or try a supported PDS4 delimited table.',
      source: 'NASA Planetary Data System',
    });
  }
});

export default router;
