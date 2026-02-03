import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import UAClient from './ua';

interface CachedSchema {
  fields: string[];
  fetchedAt: number;
}

const CACHE_TTL_MS = Number(process.env.EVENTS_SCHEMA_TTL_MS || 15 * 60 * 1000);
const FALLBACK_PATH = process.env.EVENTS_SCHEMA_PATH || path.resolve(process.cwd(), 'data', 'events-schema.json');

let cache: CachedSchema | null = null;

const loadFallback = (): string[] => {
  try {
    if (!fs.existsSync(FALLBACK_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(FALLBACK_PATH, 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return data.map(String);
    }
    if (Array.isArray(data?.fields)) {
      return data.fields.map(String);
    }
    return [];
  } catch (error: any) {
    logger.error(`Failed to load events schema fallback: ${error.message}`);
    return [];
  }
};

const parseFields = (result: any): string[] => {
  if (!result) {
    return [];
  }
  const rows = result?.data || result?.rows || result?.result || result?.results;
  if (Array.isArray(rows)) {
    const fields = rows.map((row) => row.Field || row.field || row.COLUMN_NAME || row.column || row.name).filter(Boolean);
    return fields.map(String);
  }
  if (Array.isArray(result?.columns)) {
    return result.columns.map(String);
  }
  return [];
};

export const getEventsSchemaFields = async (uaClient: UAClient): Promise<string[]> => {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.fields;
  }

  try {
    const query = 'DESCRIBE Event.Events';
    const result = await uaClient.queryDatabase(query);
    const fields = parseFields(result);
    if (fields.length > 0) {
      cache = { fields, fetchedAt: now };
      return fields;
    }
  } catch (error: any) {
    logger.error(`Failed to fetch Events schema from UA: ${error.message}`);
  }

  const fallback = loadFallback();
  cache = { fields: fallback, fetchedAt: now };
  return fallback;
};
