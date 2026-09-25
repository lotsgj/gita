export const MASTER_URL = 'data/master.csv';

export const EXPECTED_HEADERS = [
  'cid', 'snum', 'sid', 'shloka_sa', 'cname_sa', 'meaning_sa',
  'word_by_word_meaning_sa', 'shloka_transliteration_en', 'cname_en',
  'meaning_en', 'word_by_word_meaning_en', 'shloka_transliteration_kn',
  'cname_kn', 'meaning_kn', 'word_by_word_meaning_kn',
  'audio_gita_700', 'audio_gita_yoga', 'icon_gita_700'
];

function logicalRecords(text) {
  const physical = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const records = [];
  let buffer = '';
  let wrapped = false;
  physical.forEach((line) => {
    if (!buffer) {
      wrapped = line.charAt(0) === '"';
      buffer = line;
    } else {
      buffer += '\n' + line;
    }
    if (!wrapped || /"\s*$/.test(line)) {
      records.push(buffer);
      buffer = '';
      wrapped = false;
    }
  });
  if (buffer.trim()) records.push(buffer);
  return records.filter((record) => record.trim());
}

function unwrap(record) {
  const trimmed = record.trim();
  if (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"') {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return record;
}

export function decodeValue(value) {
  return String(value || '').replace(/\\n/g, '\n');
}

export function encodeValue(value) {
  const encoded = String(value == null ? '' : value).replace(/\r\n?/g, '\n').replace(/\n/g, '\\n');
  if (encoded.includes('#')) throw new Error('The # character is not allowed in master data.');
  return encoded;
}

export function parseMaster(text) {
  const records = logicalRecords(text);
  if (records.length < 2) throw new Error('The master data contains no shloka records.');
  const headers = unwrap(records.shift()).split('#').map((header) => header.trim());
  if (headers.join('#') !== EXPECTED_HEADERS.join('#')) {
    throw new Error('The selected file header does not match the required ' + EXPECTED_HEADERS.length + '-column master.csv format.');
  }

  const rows = [];
  const seen = new Set();
  const invalid = [];
  records.forEach((record, recordIndex) => {
    const values = unwrap(record).split('#');
    if (values.length !== headers.length) {
      invalid.push(recordIndex + 2);
      return;
    }
    const row = {};
    headers.forEach((header, index) => { row[header] = decodeValue(values[index]); });
    if (!row.sid || row.sid !== row.cid + '.' + row.snum) {
      throw new Error('Invalid master data record ' + (recordIndex + 2) + ': sid must equal cid.snum.');
    }
    if (seen.has(row.sid)) throw new Error('Duplicate sid in master data: ' + row.sid + '.');
    seen.add(row.sid);
    rows.push(row);
  });
  if (invalid.length) {
    throw new Error('Invalid master data records: ' + invalid.slice(0, 8).join(', ') + '. Each record must contain exactly ' + EXPECTED_HEADERS.length + ' fields.');
  }
  if (!rows.length) throw new Error('The selected file contains no usable records.');
  return { headers, rows };
}

export function serializeMaster(dataset) {
  const headers = dataset.headers || EXPECTED_HEADERS;
  if (headers.join('#') !== EXPECTED_HEADERS.join('#')) throw new Error('Cannot export an unsupported master schema.');
  const lines = [headers.join('#')];
  dataset.rows.forEach((row) => {
    lines.push(headers.map((header) => encodeValue(row[header])).join('#'));
  });
  return lines.join('\n') + '\n';
}

export async function loadMaster(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load ' + MASTER_URL + ' (HTTP ' + response.status + ').');
  return parseMaster(await response.text());
}

export async function readMasterFile(file) {
  if (!file) throw new Error('No master file was selected.');
  return parseMaster(await file.text());
}

export function value(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) return row[name] || '';
  }
  return '';
}

export function languageField(stem, language) {
  if (stem === 'transliteration') return 'shloka_transliteration_' + language;
  return stem + '_' + language;
}
