/**
 * Custom parsers for non-standard medical data files
 * Handles multi-line records, fixed-width formats, and tabular data
 */

import * as XLSX from "xlsx";

// ==========================================
// PARSER 1: Nephrologist PDF text format
// Multi-line records with doctor name, address, phone, email
// District/city headers appear before groups of doctors
// ==========================================

export function parseNephrologistPDF(text: string): Array<Record<string, string | null>> {
  const records: Array<Record<string, string | null>> = [];
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim());

  const TELANGANA_CITIES = [
    'Hyderabad', 'Secunderabad', 'Warangal', 'Karimnagar', 'Nizamabad',
    'Khammam', 'Nalgonda', 'Mahbubnagar', 'Medak', 'Adilabad',
    'Kakinada', 'Rajahmundry', 'Vijayawada', 'Vishakapatnam', 'Tirupati',
    'Guntur', 'Nellore', 'Kurnool', 'Kadapa', 'Anantapur',
    'Chittoor', 'Ongole', 'Bhimavaram', 'Eluru', 'Srikakulam',
  ];

  const ANDHRA_CITIES = [
    'Andhra Pradesh', 'Karnataka', 'Telangana',
  ];

  let currentDistrict = '';
  let currentState = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip header lines and page markers
    if (trimmed.includes('Doctor Name') || trimmed.includes('Landline') || trimmed.includes('Mobile No')) {
      i++;
      continue;
    }

    // Detect state headers (Karnataka, Andhra Pradesh, Telangana)
    const foundState = ANDHRA_CITIES.find(s => trimmed.toLowerCase().includes(s.toLowerCase()));
    if (foundState && trimmed.length < 40) {
      currentState = foundState;
      i++;
      continue;
    }

    // Detect city/district headers
    const foundCity = TELANGANA_CITIES.find(c =>
      trimmed.toLowerCase() === c.toLowerCase() ||
      (trimmed.length < 35 && trimmed.toLowerCase().startsWith(c.toLowerCase()))
    );
    if (foundCity && trimmed.length < 40) {
      currentDistrict = foundCity;
      i++;
      continue;
    }

    // Try to extract a doctor record from current position
    const record = extractNephrologistRecord(lines, i, currentDistrict);
    if (record && record.name) {
      records.push(record);
      i = record._nextIndex || i + 1;
    } else {
      i++;
    }
  }

  return records;
}

function extractNephrologistRecord(lines: string[], startIdx: number, district: string): any {
  // Look ahead up to 4 lines for a complete record
  const chunk = lines.slice(startIdx, Math.min(startIdx + 5, lines.length)).join(' ');

  // Extract mobile number (10 digits starting with 7/8/9)
  const mobileMatch = chunk.match(/\b([7-9]\d{9})\b/);
  if (!mobileMatch) return null;

  const mobile = mobileMatch[1];

  // Extract name - usually at the start of the first line, before address
  // Name patterns: starts with capital letter, contains doctor's name
  const firstLine = lines[startIdx];
  let name = '';
  let address = '';

  // Check if first line has phone numbers
  const phoneInFirstLine = firstLine.match(/(\d{3,}[-\s]?\d+)/);

  if (phoneInFirstLine) {
    // Name is before the phone number
    const beforePhone = firstLine.substring(0, firstLine.indexOf(phoneInFirstLine[0])).trim();
    if (beforePhone.length > 2) {
      name = cleanName(beforePhone);
      address = firstLine.substring(firstLine.indexOf(phoneInFirstLine[0]) + phoneInFirstLine[0].length).trim();
    }
  }

  // If no name found, check if it's on a separate line before
  if (!name && startIdx > 0) {
    const prevLine = lines[startIdx - 1].trim();
    if (prevLine.length > 2 && prevLine.length < 60 && !prevLine.match(/^\d/) && !prevLine.includes('@')) {
      name = cleanName(prevLine);
    }
  }

  // Collect address from subsequent lines until we hit another record
  let nextIdx = startIdx + 1;
  const addressLines: string[] = address ? [address] : [];

  while (nextIdx < lines.length && nextIdx < startIdx + 4) {
    const line = lines[nextIdx].trim();
    // Stop if we hit a new record indicator
    if (line.match(/^[A-Z][a-z]+\s+[A-Z]/)) break;
    if (line.match(/^\d{10}\b/)) break;
    if (line.length < 60 && line.match(/^[A-Z][a-zA-Z\s]{2,30}$/)) break;
    if (line.includes('Doctor Name')) break;

    addressLines.push(line);
    nextIdx++;
  }

  address = addressLines.join(', ').replace(/,\s*,/g, ',').trim();

  // Extract email
  const emailMatch = chunk.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  // Extract landline
  const landlineMatch = chunk.match(/(\d{3,5}[-\s]?\d{6,8})/);
  const landline = landlineMatch && landlineMatch[0].replace(/\s/g, '').length >= 8 ? landlineMatch[0] : '';

  if (!name || name.length < 3) return null;

  return {
    name,
    phone: mobile,
    email: email || null,
    address: address || null,
    district: district || null,
    specialty: 'Nephrology',
    hospital: extractHospital(address) || null,
    designation: 'Doctor',
    _nextIndex: nextIdx,
  };
}

function cleanName(name: string): string {
  return name
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[,;]\s*$/, '')
    .trim();
}

function extractHospital(address: string): string | null {
  if (!address) return null;
  const hospitalMatch = address.match(/([A-Za-z\s]+(?:Hospital|Clinic|Centre|Center|Institute|Foundation|Care|Medical))/i);
  return hospitalMatch ? hospitalMatch[1].trim() : null;
}

// ==========================================
// PARSER 2: Gynecology tabular format
// S.No | Name of Candidate | Mobile Number | Reg No | DOB | ...
// ==========================================

export function parseGynecologyText(text: string): Array<Record<string, string | null>> {
  const records: Array<Record<string, string | null>> = [];
  const lines = text.split('\n').filter(l => l.trim());

  for (const line of lines) {
    // Match lines that start with a number (S.No) followed by name and mobile
    // Pattern: optional number, then name (mixed case), then 10-digit mobile
    const match = line.match(/^\s*\d+\s+([A-Za-z\s.]+?)\s+([6-9]\d{9})\s+(\d+)/);
    if (match) {
      const name = match[1].trim();
      const mobile = match[2];

      // Skip header-like entries
      if (name.toLowerCase().includes('name of candidate') || name.toLowerCase().includes('s.no')) continue;
      if (name.length < 3) continue;

      records.push({
        name,
        phone: mobile,
        email: null,
        address: null,
        district: null,
        specialty: 'Obstetrics & Gynecology',
        hospital: null,
        designation: 'Doctor',
      });
    }
  }

  return records;
}

// ==========================================
// PARSER 3: Gynecology Excel
// Multi-header rows, data starts at row 4
// ==========================================

export function parseGynecologyExcel(buffer: Buffer): Array<Record<string, string | null>> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  const records: Array<Record<string, string | null>> = [];

  // Find the row with actual data (skip header rows)
  // Data columns: S.No, Name of Candidate, Mobile Number, Reg No, DOB, Gender, Social Status, Qualification, ...
  let dataStarted = false;

  for (const row of rows) {
    if (!row || row.length < 3) continue;

    // Skip until we see a row with a number in first column
    const firstCol = String(row[0] || '').trim();
    if (!dataStarted) {
      if (firstCol === '1') {
        dataStarted = true;
      } else {
        continue;
      }
    }

    // Extract name and mobile
    let name = '';
    let mobile = '';

    // Column 1 is usually S.No, Column 2 is Name, Column 3 is Mobile
    for (let i = 1; i < row.length; i++) {
      const val = String(row[i] || '').trim();
      if (!name && val.length > 2 && val.match(/[a-zA-Z]{2,}/) && !val.match(/^\d+$/)) {
        name = val;
      } else if (!mobile && val.match(/^[6-9]\d{9}$/)) {
        mobile = val;
      }
      if (name && mobile) break;
    }

    if (name && mobile && name.length > 2) {
      records.push({
        name,
        phone: mobile,
        email: null,
        address: null,
        district: null,
        specialty: 'Obstetrics & Gynecology',
        hospital: null,
        designation: 'Doctor',
      });
    }
  }

  return records;
}

// ==========================================
// UNIVERSAL PHONE EXTRACTOR
// Fallback: extract all phone numbers with names from any text
// ==========================================

export function extractPhonesWithNames(text: string): Array<Record<string, string | null>> {
  const records: Array<Record<string, string | null>> = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mobileMatch = line.match(/[6-9]\d{9}/);
    if (!mobileMatch) continue;

    const mobile = mobileMatch[0];

    // Look for name on same line or previous line
    let name = '';

    // Try current line - name is usually before the phone
    const beforePhone = line.substring(0, line.indexOf(mobile)).trim();
    if (beforePhone.length > 2 && beforePhone.match(/[a-zA-Z]{2,}/)) {
      name = cleanName(beforePhone);
    }

    // If no name, try previous line
    if (!name && i > 0) {
      const prev = lines[i - 1].trim();
      if (prev.length > 2 && prev.length < 60 && prev.match(/[a-zA-Z]{2,}/) && !prev.match(/\d{5}/)) {
        name = cleanName(prev);
      }
    }

    if (name && name.length > 2) {
      // Detect specialty from context
      const context = `${line} ${lines[i - 1] || ''} ${lines[i + 1] || ''}`.toLowerCase();
      let specialty = null;
      if (context.includes('nephro')) specialty = 'Nephrology';
      else if (context.includes('gynec') || context.includes('obg')) specialty = 'Obstetrics & Gynecology';
      else if (context.includes('cardio')) specialty = 'Cardiology';
      else if (context.includes('ortho')) specialty = 'Orthopedic Surgery';

      records.push({
        name,
        phone: mobile,
        email: null,
        address: null,
        district: null,
        specialty,
        hospital: null,
        designation: 'Doctor',
      });
    }
  }

  return records;
}

// ==========================================
// MAIN ROUTER: Detect file type and parse
// ==========================================

export function detectAndParse(fileName: string, text: string): Array<Record<string, string | null>> {
  const lower = fileName.toLowerCase();

  // Detect Nephrologist file
  if (lower.includes('nephrologist') || lower.includes('nephro')) {
    return parseNephrologistPDF(text);
  }

  // Detect Gynecology file
  if (lower.includes('gynec') || lower.includes('obg') || lower.includes('gynaec')) {
    return parseGynecologyText(text);
  }

  // Fallback: generic phone extractor
  return extractPhonesWithNames(text);
}
