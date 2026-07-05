import mysql from 'mysql2/promise';
import fs from 'fs';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '4CtfDUMzvSsZL7c.root', password: '41ZOclbIOnTLB8tF',
  database: 'test', ssl: { rejectUnauthorized: true }
});

console.log('=== GEO-ENRICHMENT ENGINE STARTING ===\n');

// ==========================================
// STEP 1: Add geographic columns
// ==========================================
console.log('[1/8] Adding geographic columns...');
const newCols = [
  'state VARCHAR(100)',
  'city VARCHAR(100)',
  'town VARCHAR(100)',
  'area VARCHAR(100)',
  'pincode VARCHAR(10)',
  'latitude DECIMAL(10,8)',
  'longitude DECIMAL(11,8)',
  'country VARCHAR(50) DEFAULT "India"',
];
for (const col of newCols) {
  const colName = col.split(' ')[0];
  try {
    await conn.query(`ALTER TABLE contacts ADD COLUMN ${col}`);
    console.log(`   + Added column: ${colName}`);
  } catch (e) {
    if (e.message.includes('Duplicate')) console.log(`   ✓ ${colName} already exists`);
    else console.log(`   ⚠️ ${colName}: ${e.message}`);
  }
}

// ==========================================
// STEP 2: INDIAN PHONE PREFIX → STATE MAPPING
// ==========================================
console.log('\n[2/8] Mapping phone prefixes to states...');
const PHONE_STATE = {
  // Andhra Pradesh / Telangana (shared circle)
  '9848': 'Telangana', '9849': 'Telangana', '9866': 'Telangana',
  '9700': 'Telangana', '9701': 'Telangana', '9703': 'Telangana',
  '9704': 'Telangana', '9705': 'Telangana',
  '9390': 'Andhra Pradesh', '9391': 'Andhra Pradesh', '9392': 'Andhra Pradesh',
  '9393': 'Andhra Pradesh', '9394': 'Andhra Pradesh', '9395': 'Andhra Pradesh',
  '9396': 'Andhra Pradesh', '9397': 'Andhra Pradesh', '9398': 'Andhra Pradesh', '9399': 'Andhra Pradesh',
  '9550': 'Telangana', '9551': 'Telangana',
  '7702': 'Telangana', '7703': 'Telangana',
  '8297': 'Telangana', '8298': 'Telangana',
  '9989': 'Telangana', '9985': 'Andhra Pradesh', '9986': 'Telangana',
  '9000': 'Telangana', '9001': 'Telangana', '9010': 'Andhra Pradesh',
  '9246': 'Telangana', '9247': 'Telangana', '9248': 'Telangana',
  '9959': 'Andhra Pradesh', '9963': 'Telangana', '9966': 'Telangana',
  '7032': 'Telangana', '7033': 'Telangana', '7036': 'Telangana',
  '8121': 'Telangana', '8122': 'Telangana', '8125': 'Telangana',
  '9346': 'Telangana', '9347': 'Telangana', '9348': 'Telangana',
  '9440': 'Andhra Pradesh', '9441': 'Telangana', '9442': 'Telangana',
  '9908': 'Telangana', '9909': 'Telangana',
  '8500': 'Andhra Pradesh', '7382': 'Andhra Pradesh',
  '9676': 'Andhra Pradesh', '8978': 'Telangana',
  // Karnataka
  '9880': 'Karnataka', '9886': 'Karnataka', '9844': 'Karnataka',
  '9845': 'Karnataka', '9632': 'Karnataka', '9900': 'Karnataka',
  '9901': 'Karnataka', '9902': 'Karnataka', '9008': 'Karnataka',
  '9535': 'Karnataka', '9538': 'Karnataka', '9035': 'Karnataka',
  '9036': 'Karnataka', '9686': 'Karnataka', '9844': 'Karnataka',
  // Tamil Nadu
  '9840': 'Tamil Nadu', '9841': 'Tamil Nadu', '9884': 'Tamil Nadu',
  '9962': 'Tamil Nadu', '9176': 'Tamil Nadu', '9381': 'Tamil Nadu',
  // Maharashtra
  '9860': 'Maharashtra', '9867': 'Maharashtra', '9850': 'Maharashtra',
  '9881': 'Maharashtra', '9967': 'Maharashtra', '9970': 'Maharashtra',
  '9223': 'Maharashtra', '9226': 'Maharashtra', '9322': 'Maharashtra',
  // Gujarat
  '9825': 'Gujarat', '9824': 'Gujarat', '9879': 'Gujarat',
  // Kerala
  '9847': 'Kerala', '9744': 'Kerala', '9846': 'Kerala',
  // West Bengal
  '9830': 'West Bengal', '9831': 'West Bengal', '9832': 'West Bengal',
  // Delhi/NCR
  '9810': 'Delhi', '9811': 'Delhi', '9818': 'Delhi',
  '9711': 'Delhi', '9910': 'Delhi', '9911': 'Delhi',
  '9999': 'Delhi', '9289': 'Delhi', '8130': 'Delhi',
  // Rajasthan
  '9829': 'Rajasthan', '9950': 'Rajasthan', '9314': 'Rajasthan',
  // Punjab
  '9814': 'Punjab', '9815': 'Punjab', '9872': 'Punjab',
  // UP
  '9837': 'Uttar Pradesh', '9838': 'Uttar Pradesh', '9935': 'Uttar Pradesh',
  '9450': 'Uttar Pradesh', '9412': 'Uttar Pradesh',
  // Madhya Pradesh
  '9826': 'Madhya Pradesh', '9827': 'Madhya Pradesh', '9300': 'Madhya Pradesh',
  // Bihar
  '9835': 'Bihar', '9934': 'Bihar', '9801': 'Bihar',
  // Jharkhand
  '9838': 'Jharkhand', '9608': 'Jharkhand', '9204': 'Jharkhand',
  // Odisha
  '9861': 'Odisha', '9938': 'Odisha', '9090': 'Odisha',
  // Chhattisgarh
  '9826': 'Chhattisgarh', '9300': 'Chhattisgarh',
  // Haryana
  '9812': 'Haryana', '9813': 'Haryana', '9466': 'Haryana',
  // Assam
  '9864': 'Assam', '9957': 'Assam', '9706': 'Assam',
  // Goa
  '9822': 'Goa', '9850': 'Goa',
  // J&K
  '9419': 'Jammu & Kashmir', '9796': 'Jammu & Kashmir',
  // Himachal
  '9805': 'Himachal Pradesh', '9806': 'Himachal Pradesh',
  // Uttarakhand
  '9837': 'Uttarakhand', '9634': 'Uttarakhand',
  // North East
  '9612': 'North East', '9854': 'North East', '9774': 'North East',
};

let phoneStateUpdated = 0;
for (const [prefix, state] of Object.entries(PHONE_STATE)) {
  const [r] = await conn.query(
    'UPDATE contacts SET state = ? WHERE state IS NULL AND phone LIKE ?',
    [state, prefix + '%']
  );
  phoneStateUpdated += r.affectedRows;
}
console.log(`   ✅ ${phoneStateUpdated.toLocaleString()} contacts mapped to states by phone prefix`);

// ==========================================
// STEP 3: PINCODE EXTRACTION FROM ADDRESS
// ==========================================
console.log('\n[3/8] Extracting pincodes from addresses...');
const [pincodeUpdated] = await conn.query(
  "UPDATE contacts SET pincode = REGEXP_SUBSTR(address, '[0-9]{6}') WHERE pincode IS NULL AND address REGEXP '[0-9]{6}'"
);
console.log(`   ✅ ${(pincodeUpdated.affectedRows || 0).toLocaleString()} pincodes extracted`);

// ==========================================
// STEP 4: DISTRICT EXTRACTION FROM ADDRESS
// ==========================================
console.log('\n[4/8] Extracting districts/cities from addresses...');

const DISTRICTS = [
  // Telangana
  ['Hyderabad','Secunderabad','Ranga Reddy','Medchal','Sangareddy','Siddipet'],
  ['Warangal','Hanamkonda','Karimnagar','Nizamabad','Khammam','Nalgonda'],
  ['Mahbubnagar','Medak','Adilabad','Nirmal','Jagtial','Peddapalli'],
  ['Suryapet','Mahabubabad','Kothagudem','Jayashankar','Mancherial'],
  ['Komaram Bheem','Rajanna Sircilla','Vikarabad','Wanaparthy','Narayanpet'],
  ['Kamareddy','Yadadri Bhuvanagiri','Jangaon','Bhadradri'],
  // Andhra Pradesh
  ['Visakhapatnam','Vijayawada','Guntur','Nellore','Kurnool','Rajahmundry'],
  ['Tirupati','Kakinada','Kadapa','Anantapur','Vizianagaram','Srikakulam'],
  ['Eluru','Ongole','Chittoor','Machilipatnam','Tenali'],
  // Karnataka
  ['Bangalore','Bengaluru','Mysore','Mangalore','Hubli','Belgaum'],
  ['Dharwad','Gulbarga','Bellary','Davangere','Shimoga','Tumkur'],
  // Tamil Nadu
  ['Chennai','Coimbatore','Madurai','Trichy','Salem','Tirunelveli'],
  // Maharashtra
  ['Mumbai','Pune','Nagpur','Nashik','Aurangabad','Thane'],
  ['Kolhapur','Solapur','Amravati','Navi Mumbai','Sangli'],
  // Other states
  ['Kolkata','Howrah','Delhi','New Delhi','Gurgaon','Noida','Faridabad'],
  ['Jaipur','Jodhpur','Udaipur','Kota','Ahmedabad','Surat','Vadodara'],
  ['Lucknow','Kanpur','Agra','Varanasi','Allahabad','Ghaziabad'],
  ['Patna','Ranchi','Bhubaneswar','Cuttack','Raipur','Bhilai'],
  ['Indore','Bhopal','Jabalpur','Gwalior','Guwahati','Shillong'],
  ['Chandigarh','Ludhiana','Amritsar','Jalandhar','Dehradun'],
  ['Kochi','Thiruvananthapuram','Kozhikode','Thrissur'],
  ['Panaji','Margao','Pondicherry','Port Blair'],
];

let districtUpdated = 0;
for (const stateGroup of DISTRICTS) {
  for (const district of stateGroup) {
    const [r] = await conn.query(
      'UPDATE contacts SET city = ? WHERE city IS NULL AND (address LIKE ? OR hospital LIKE ? OR district LIKE ?)',
      [district, `%${district}%`, `%${district}%`, `%${district}%`]
    );
    districtUpdated += r.affectedRows || 0;
  }
}
console.log(`   ✅ ${districtUpdated.toLocaleString()} cities/towns extracted`);

// ==========================================
// STEP 5: STATE FROM CITY/ADDRESS
// ==========================================
console.log('\n[5/8] Filling states from known cities...');

const STATE_CITY_MAP = {
  'Telangana': ['Hyderabad','Secunderabad','Warangal','Karimnagar','Nizamabad','Khammam','Nalgonda','Mahbubnagar','Medak','Adilabad','Sangareddy','Siddipet','Ranga Reddy','Medchal','Hanamkonda','Suryapet','Mahabubabad','Kothagudem','Mancherial','Jagtial','Peddapalli','Vikarabad','Kamareddy','Yadadri','Jangaon'],
  'Andhra Pradesh': ['Visakhapatnam','Vijayawada','Guntur','Nellore','Kurnool','Tirupati','Kakinada','Kadapa','Anantapur','Rajahmundry','Vizianagaram','Srikakulam','Eluru','Ongole','Chittoor','Machilipatnam'],
  'Karnataka': ['Bangalore','Bengaluru','Mysore','Mangalore','Hubli','Belgaum','Dharwad','Gulbarga','Bellary','Davangere','Shimoga','Tumkur','Bijapur'],
  'Tamil Nadu': ['Chennai','Coimbatore','Madurai','Trichy','Salem','Tirunelveli'],
  'Maharashtra': ['Mumbai','Pune','Nagpur','Nashik','Aurangabad','Thane','Kolhapur','Solapur','Navi Mumbai'],
  'Kerala': ['Kochi','Thiruvananthapuram','Kozhikode','Thrissur'],
  'West Bengal': ['Kolkata','Howrah'],
  'Delhi': ['Delhi','New Delhi'],
  'Gujarat': ['Ahmedabad','Surat','Vadodara'],
  'Rajasthan': ['Jaipur','Jodhpur','Udaipur','Kota'],
  'Uttar Pradesh': ['Lucknow','Kanpur','Agra','Varanasi','Allahabad','Ghaziabad','Noida'],
  'Bihar': ['Patna'],
  'Jharkhand': ['Ranchi'],
  'Odisha': ['Bhubaneswar','Cuttack'],
  'Madhya Pradesh': ['Indore','Bhopal','Jabalpur','Gwalior'],
  'Punjab': ['Ludhiana','Amritsar','Jalandhar','Chandigarh'],
  'Haryana': ['Gurgaon','Faridabad'],
  'Assam': ['Guwahati'],
  'Chhattisgarh': ['Raipur'],
  'Goa': ['Panaji'],
};

let stateFromCity = 0;
for (const [state, cities] of Object.entries(STATE_CITY_MAP)) {
  for (const city of cities) {
    const [r] = await conn.query(
      'UPDATE contacts SET state = ? WHERE state IS NULL AND (city = ? OR address LIKE ? OR hospital LIKE ?)',
      [state, city, `%${city}%`, `%${city}%`]
    );
    stateFromCity += r.affectedRows || 0;
  }
}
console.log(`   ✅ ${stateFromCity.toLocaleString()} states filled from cities`);

// ==========================================
// STEP 6: AREA/LOCALITY EXTRACTION
// ==========================================
console.log('\n[6/8] Extracting areas/localities...');

const AREA_PATTERNS = [
  'Road','Nagar','Colony','Layout','Circle','Cross','Block','Phase',
  'Sector','Enclave','Extension','Bazaar','Market','Chowk','Galli',
  'Street','Lane','Avenue','Highway','Bypass','Estate','Industrial',
  'Hills','Plaza','Complex','Society','Apartment','Residency','Village',
  'Mandal','Tehsil','Taluka','Gram','Panchayat',
];

let areaUpdated = 0;
for (const pattern of AREA_PATTERNS) {
  const [r] = await conn.query(
    "UPDATE contacts SET area = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(address, ?, 1), ',', -1)) WHERE area IS NULL AND address LIKE ? AND LENGTH(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(address, ?, 1), ',', -1))) > 3 AND LENGTH(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(address, ?, 1), ',', -1))) < 50",
    [`%${pattern}%`, `%${pattern}%`, `%${pattern}%`, `%${pattern}%`]
  );
  areaUpdated += r.affectedRows || 0;
}
console.log(`   ✅ ${areaUpdated.toLocaleString()} areas extracted`);

// ==========================================
// STEP 7: DEFAULT STATE FOR TELANGANA/AP
// ==========================================
console.log('\n[7/8] Setting default states...');
const [defaultState] = await conn.query(
  "UPDATE contacts SET state = 'Telangana' WHERE state IS NULL AND (district LIKE '%Hyderabad%' OR district LIKE '%Telangana%' OR district LIKE '%Warangal%' OR district LIKE '%Karimnagar%')"
);
console.log(`   ✅ ${(defaultState.affectedRows || 0).toLocaleString()} defaulted to Telangana`);

// Mark remaining unknown
const [unknownState] = await conn.query(
  "UPDATE contacts SET state = 'Unknown' WHERE state IS NULL"
);
console.log(`   ✅ ${(unknownState.affectedRows || 0).toLocaleString()} marked as Unknown`);

// ==========================================
// STEP 8: QUALITY SCORE RECALCULATION
// ==========================================
console.log('\n[8/8] Recalculating quality scores...');
await conn.query(`
  UPDATE contacts SET quality_score = LEAST(100, 
    20 + 
    IF(phone IS NOT NULL AND LENGTH(phone) >= 10, 25, 0) + 
    IF(hospital IS NOT NULL AND LENGTH(hospital) > 2, 15, 0) + 
    IF(district IS NOT NULL AND LENGTH(district) > 1, 10, 0) + 
    IF(city IS NOT NULL AND LENGTH(city) > 1, 5, 0) + 
    IF(state IS NOT NULL AND state != 'Unknown', 5, 0) + 
    IF(specialty IS NOT NULL AND LENGTH(specialty) > 1, 10, 0) + 
    IF(email IS NOT NULL AND email LIKE '%@%', 10, 0) + 
    IF(division IS NOT NULL AND division != 'unknown', 5, 0) +
    IF(pincode IS NOT NULL, 5, 0)
  )
`);
console.log('   ✅ Quality scores recalculated');

// ==========================================
// FINAL STATS
// ==========================================
console.log('\n╔══════════════════════════════════════════╗');
console.log('║     🌍 ENRICHMENT COMPLETE              ║');
console.log('╚══════════════════════════════════════════╝');

const statsQueries = [
  ['Total Contacts', 'SELECT COUNT(*) as c FROM contacts'],
  ['With State', 'SELECT COUNT(*) as c FROM contacts WHERE state IS NOT NULL AND state != "Unknown"'],
  ['Telangana', 'SELECT COUNT(*) as c FROM contacts WHERE state = "Telangana"'],
  ['Andhra Pradesh', 'SELECT COUNT(*) as c FROM contacts WHERE state = "Andhra Pradesh"'],
  ['Karnataka', 'SELECT COUNT(*) as c FROM contacts WHERE state = "Karnataka"'],
  ['Maharashtra', 'SELECT COUNT(*) as c FROM contacts WHERE state = "Maharashtra"'],
  ['Tamil Nadu', 'SELECT COUNT(*) as c FROM contacts WHERE state = "Tamil Nadu"'],
  ['Delhi/NCR', 'SELECT COUNT(*) as c FROM contacts WHERE state IN ("Delhi","Haryana")'],
  ['Other States', 'SELECT COUNT(*) as c FROM contacts WHERE state NOT IN ("Telangana","Andhra Pradesh","Karnataka","Maharashtra","Tamil Nadu","Delhi","Haryana","Unknown")'],
  ['Unknown State', 'SELECT COUNT(*) as c FROM contacts WHERE state = "Unknown"'],
  ['With City', 'SELECT COUNT(*) as c FROM contacts WHERE city IS NOT NULL'],
  ['With Pincode', 'SELECT COUNT(*) as c FROM contacts WHERE pincode IS NOT NULL'],
  ['With Area', 'SELECT COUNT(*) as c FROM contacts WHERE area IS NOT NULL'],
  ['High Quality (70+)', 'SELECT COUNT(*) as c FROM contacts WHERE quality_score >= 70'],
  ['OBG Doctors', 'SELECT COUNT(*) as c FROM contacts WHERE division = "gynecology"'],
  ['OBG in Telangana', 'SELECT COUNT(*) as c FROM contacts WHERE division = "gynecology" AND state = "Telangana"'],
];

for (const [label, sql] of statsQueries) {
  const [r] = await conn.query(sql);
  console.log(`${label.padEnd(25)} ${String(r[0].c).padStart(10)}`);
}

// Top 20 cities
console.log('\n=== TOP 20 CITIES ===');
const [topCities] = await conn.query('SELECT city, COUNT(*) as c FROM contacts WHERE city IS NOT NULL GROUP BY city ORDER BY c DESC LIMIT 20');
for (const c of topCities) {
  console.log(`  ${c.city.padEnd(25)} ${String(c.c).padStart(8)}`);
}

await conn.end();
console.log('\n✅ GEO-ENRICHMENT COMPLETE!');
