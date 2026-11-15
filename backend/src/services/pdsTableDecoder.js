import { XMLParser, XMLValidator } from 'fast-xml-parser';

const MAX_LABEL_BYTES = 1_000_000;
const MAX_DATA_BYTES = 16_000_000;
const MAX_RECORDS = 100_000;
const MAX_DISPLAY_SAMPLES = 600;
const pdsHosts = ['.nasa.gov', '.wustl.edu', '.seti.org', '.nmsu.edu'];
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

export class PdsDecodeError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.name = 'PdsDecodeError';
    this.status = status;
  }
}

function assertArchiveUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new PdsDecodeError('NASA PDS returned an invalid product URL.', 502);
  }
  if (url.protocol !== 'https:' || url.username || url.password
    || !pdsHosts.some((suffix) => url.hostname === suffix.slice(1) || url.hostname.endsWith(suffix))) {
    throw new PdsDecodeError('This PDS product is hosted outside the supported NASA planetary archive hosts.');
  }
  return url;
}

async function fetchPdsBytes(urlValue, maxBytes, timeoutMs) {
  let url = assertArchiveUrl(urlValue);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      headers: { accept: 'application/xml,text/plain,text/csv;q=0.9,*/*;q=0.1' },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === 3) throw new PdsDecodeError('NASA PDS redirected too many times while fetching this product.', 502);
      url = assertArchiveUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) {
      const error = new Error(`NASA PDS product fetch returned HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new PdsDecodeError('The PDS resource exceeds TERRA’s safe decoding size limit.');
    }
    let bytes;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          throw new PdsDecodeError('The PDS resource exceeds TERRA’s safe decoding size limit.');
        }
        chunks.push(Buffer.from(value));
      }
      bytes = Buffer.concat(chunks, totalBytes);
    } else {
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (bytes.length > maxBytes) throw new PdsDecodeError('The PDS resource exceeds TERRA’s safe decoding size limit.');
    return bytes;
  }
  throw new PdsDecodeError('NASA PDS did not provide a usable product URL.', 502);
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function integerValue(value, label, maximum = MAX_RECORDS) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new PdsDecodeError(`The PDS label contains an unsupported ${label}.`);
  }
  return parsed;
}

function getSingleTable(labelText) {
  if (labelText.byteLength > MAX_LABEL_BYTES) throw new PdsDecodeError('The PDS label exceeds TERRA’s safe decoding size limit.');
  const xml = labelText.toString('utf8');
  if (/<!DOCTYPE/i.test(xml) || XMLValidator.validate(xml) !== true) {
    throw new PdsDecodeError('NASA PDS returned an invalid or unsupported product label.', 502);
  }
  const parsed = xmlParser.parse(xml);
  const areas = asArray(parsed?.Product_Observational?.File_Area_Observational);
  const tables = areas.flatMap((area) => asArray(area?.Table_Delimited));
  if (tables.length !== 1) throw new PdsDecodeError('TERRA can decode only PDS4 labels with exactly one delimited observation table.');

  const files = areas.flatMap((area) => asArray(area?.File));
  if (files.length !== 1 || typeof files[0]?.file_name !== 'string') {
    throw new PdsDecodeError('The PDS observation table does not identify one unambiguous data file.');
  }
  const fileName = files[0].file_name;
  if (!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(fileName) || fileName.includes('..')) {
    throw new PdsDecodeError('The PDS label contains an unsupported data filename.', 502);
  }

  return { table: tables[0], fileName, parsed };
}

function delimiterValue(value, type) {
  const delimiters = type === 'field'
    ? { Comma: ',', Tab: '\t', Semicolon: ';', 'Vertical Bar': '|' }
    : { 'Carriage-Return Line-Feed': '\r\n', Line_Feed: '\n', 'Line Feed': '\n', Carriage_Return: '\r', 'Carriage Return': '\r' };
  const delimiter = delimiters[value];
  if (!delimiter) throw new PdsDecodeError(`The PDS ${type} delimiter "${value || 'missing'}" is not supported.`);
  return delimiter;
}

function makeFieldParser(field) {
  const constants = new Set(Object.values(field.Special_Constants || {}).flatMap((item) => asArray(item))
    .map((item) => typeof item === 'object' && item !== null ? item['#text'] : item)
    .filter((item) => item !== undefined && item !== null)
    .map(String));
  return (raw) => {
    const value = raw.trim();
    if (!value || constants.has(value)) return null;
    if (field.data_type === 'ASCII_Integer' || field.data_type === 'ASCII_Real') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new PdsDecodeError(`The PDS table contains an invalid ${field.data_type} value.`, 502);
      return parsed;
    }
    return value;
  };
}

function fieldInfo(field) {
  return {
    name: field.name,
    dataType: field.data_type || null,
    unit: field.unit || null,
    description: field.description || null,
  };
}

function decodeTable(label, dataBytes, { recordType, limit }) {
  const { table } = label;
  const record = table.Record_Delimited;
  const expectedRecords = integerValue(table.records, 'record count');
  const offset = integerValue(table.offset?.['#text'] ?? table.offset, 'table byte offset', MAX_DATA_BYTES);
  const recordDelimiter = delimiterValue(table.record_delimiter, 'record');
  const fieldDelimiter = delimiterValue(table.field_delimiter, 'field');
  const fixedFields = asArray(record?.Field_Delimited);
  const declaredFields = integerValue(record?.fields, 'field count');
  if (!expectedRecords || fixedFields.length !== declaredFields
    || fixedFields.some((field) => typeof field?.name !== 'string' || typeof field?.data_type !== 'string')
    || new Set(fixedFields.map((field) => field.name)).size !== fixedFields.length) {
    throw new PdsDecodeError('The PDS label has an inconsistent or unsupported record-field schema.', 502);
  }

  const groups = asArray(record?.Group_Field_Delimited);
  if (groups.length > 1 || groups.some((group) => integerValue(group.groups || 0, 'nested group count') !== 0
    || integerValue(group.fields, 'group field count') !== 1
    || asArray(group.Field_Delimited).length !== 1)) {
    throw new PdsDecodeError('TERRA supports only one flat repeated PDS numeric field group.');
  }
  const group = groups[0] || null;
  const repeatedField = group ? asArray(group.Field_Delimited)[0] : null;
  if (repeatedField && !['ASCII_Integer', 'ASCII_Real'].includes(repeatedField.data_type)) {
    throw new PdsDecodeError('TERRA supports only numeric repeated fields in PDS sample groups.');
  }
  const repetitions = group ? integerValue(group.repetitions, 'sample count') : 0;
  if (group && repetitions === 0) throw new PdsDecodeError('The PDS repeated field has no declared samples.');

  const content = dataBytes.subarray(offset).toString('utf8');
  if (content.includes('"')) throw new PdsDecodeError('Quoted PDS delimited fields are not supported by this decoder.');
  const rows = content.split(recordDelimiter).filter((line) => line.length > 0);
  if (rows.length !== expectedRecords) {
    throw new PdsDecodeError('The PDS data-file record count does not match the product label.', 502);
  }

  const expectedColumns = fixedFields.length + repetitions;
  const parseFixedFields = fixedFields.map(makeFieldParser);
  const parseSamples = repeatedField ? makeFieldParser(repeatedField) : null;
  const hasRecordType = fixedFields.some((field) => field.name === 'record_type');
  const recordTypeField = fixedFields.find((field) => field.name === 'record_type');
  const recordTypeLabels = recordTypeField?.description
    ? [...recordTypeField.description.matchAll(/(\d+)\s*=\s*([^,;]+)/g)]
      .map((match) => ({ value: Number(match[1]), label: match[2].trim() }))
    : [];
  const parsedRequestedType = recordType ?? (recordTypeLabels.some((item) => /active sounding/i.test(item.label))
    ? recordTypeLabels.find((item) => /active sounding/i.test(item.label)).value
    : undefined);
  const decodedRows = [];
  const availableSampleTypes = new Set();
  let matchedRows = 0;

  for (const line of rows) {
    const columns = line.split(fieldDelimiter);
    if (columns.length !== expectedColumns) {
      throw new PdsDecodeError('A PDS data row does not match the field and repeated-sample counts in its label.', 502);
    }
    const values = fixedFields.map((_field, index) => parseFixedFields[index](columns[index]));
    if (parsedRequestedType !== undefined) {
      const typeIndex = fixedFields.findIndex((field) => field.name === 'record_type');
      if (typeIndex < 0) throw new PdsDecodeError('This PDS product has no record_type field to filter.');
      if (values[typeIndex] !== parsedRequestedType) continue;
    }
    const hasSamples = repeatedField && columns.slice(fixedFields.length).some((value) => value.trim() !== '');
    if (repeatedField && !hasSamples) continue;
    if (hasSamples && hasRecordType) availableSampleTypes.add(values[fixedFields.findIndex((field) => field.name === 'record_type')]);
    matchedRows += 1;
    if (decodedRows.length >= limit) continue;

    const valuesByName = Object.fromEntries(fixedFields.map((field, index) => [field.name, values[index]]));
    if (repeatedField) {
      const sampleValues = columns.slice(fixedFields.length).map(parseSamples);
      const sampleCount = sampleValues.length;
      const stride = Math.max(1, Math.ceil(sampleCount / MAX_DISPLAY_SAMPLES));
      const samples = [];
      for (let index = 0; index < sampleCount; index += stride) {
        const amplitude = sampleValues[index];
        if (amplitude !== null) samples.push({ sampleIndex: index, amplitude });
      }
      if (sampleCount > 0 && (sampleCount - 1) % stride !== 0) {
        const finalIndex = sampleCount - 1;
        const amplitude = sampleValues[finalIndex];
        if (amplitude !== null) samples.push({ sampleIndex: finalIndex, amplitude });
      }
      decodedRows.push({
        recordNumber: valuesByName.record_number ?? decodedRows.length + 1,
        recordType: valuesByName.record_type ?? null,
        timeUtc: valuesByName.utc ?? null,
        sampleCount,
        sampleStride: stride,
        sampleInterval: valuesByName.sample_time_increment ?? null,
        sampleIntervalUnit: fixedFields.find((field) => field.name === 'sample_time_increment')?.unit || null,
        sampleUnit: repeatedField.unit || null,
        samples,
        fields: valuesByName,
      });
    } else {
      decodedRows.push(valuesByName);
    }
  }

  if (!matchedRows) throw new PdsDecodeError('The PDS product has no records matching the selected record type.');
  const selectedFields = group
    ? fixedFields.map(fieldInfo)
    : [...fixedFields.map(fieldInfo)];
  if (repeatedField) selectedFields.push(fieldInfo(repeatedField));
  return {
    kind: repeatedField ? 'sample-series' : 'table',
    schema: selectedFields,
    recordCount: matchedRows,
    returnedCount: decodedRows.length,
    recordLimit: limit,
    selectedRecordType: parsedRequestedType ?? null,
    availableRecordTypes: recordTypeLabels.filter((item) => !repeatedField || availableSampleTypes.has(item.value)),
    recordTypeField: hasRecordType ? 'record_type' : null,
    group: repeatedField ? {
      field: repeatedField.name,
      repetitions,
      unit: repeatedField.unit || null,
      description: repeatedField.description || null,
    } : null,
    rows: decodedRows,
  };
}

export async function decodePdsDelimitedProduct({ labelUrl, recordType, limit, timeoutMs }) {
  const labelBytes = await fetchPdsBytes(labelUrl, MAX_LABEL_BYTES, timeoutMs);
  const label = getSingleTable(labelBytes);
  const labelUrlObject = assertArchiveUrl(labelUrl);
  const dataUrl = new URL(label.fileName, labelUrlObject);
  assertArchiveUrl(dataUrl.href);
  const dataBytes = await fetchPdsBytes(dataUrl.href, MAX_DATA_BYTES, timeoutMs);
  const decoded = decodeTable(label, dataBytes, { recordType, limit });
  const observation = label.parsed.Product_Observational?.Observation_Area || {};
  const target = observation.Target_Identification?.name;
  return {
    ...decoded,
    dataUrl: dataUrl.href,
    observation: {
      startTime: observation.Time_Coordinates?.start_date_time || null,
      stopTime: observation.Time_Coordinates?.stop_date_time || null,
      target: typeof target === 'string' ? target : null,
    },
  };
}

export const PDS_DECODE_LIMITS = Object.freeze({ labelBytes: MAX_LABEL_BYTES, dataBytes: MAX_DATA_BYTES });
export { assertArchiveUrl, fetchPdsBytes };
