import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

const [targetFile] = process.argv.slice(2);

if (!targetFile) {
  // eslint-disable-next-line no-console
  console.error('Usage: validate_fcom_schema <path-to-fcom-json>');
  process.exit(1);
}

const schemaPath = path.resolve(process.cwd(), 'schema', 'fcom.schema.json');
const rawSchema = fs.readFileSync(schemaPath, 'utf-8');
const schema = JSON.parse(rawSchema);

const rawJson = fs.readFileSync(path.resolve(targetFile), 'utf-8');
const json = JSON.parse(rawJson);

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const valid = validate(json);

if (valid) {
  // eslint-disable-next-line no-console
  console.log('Schema validation passed');
  process.exit(0);
}

const errors = (validate.errors || []).map((err) => ({
  path: err.instancePath || '/',
  message: err.message || 'Invalid value',
}));

// eslint-disable-next-line no-console
console.error(`Schema validation failed: ${errors.length} issue(s)`);
errors.forEach((err) => {
  // eslint-disable-next-line no-console
  console.error(`${err.path} ${err.message}`);
});

process.exit(2);
