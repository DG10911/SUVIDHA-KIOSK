import { db } from "../db";
import { indianStates, indianCities, indianWards, locationStaffAssignments, users, staffProfiles } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "AP", type: "state" },
  { name: "Arunachal Pradesh", code: "AR", type: "state" },
  { name: "Assam", code: "AS", type: "state" },
  { name: "Bihar", code: "BR", type: "state" },
  { name: "Chhattisgarh", code: "CG", type: "state" },
  { name: "Goa", code: "GA", type: "state" },
  { name: "Gujarat", code: "GJ", type: "state" },
  { name: "Haryana", code: "HR", type: "state" },
  { name: "Himachal Pradesh", code: "HP", type: "state" },
  { name: "Jharkhand", code: "JH", type: "state" },
  { name: "Karnataka", code: "KA", type: "state" },
  { name: "Kerala", code: "KL", type: "state" },
  { name: "Madhya Pradesh", code: "MP", type: "state" },
  { name: "Maharashtra", code: "MH", type: "state" },
  { name: "Manipur", code: "MN", type: "state" },
  { name: "Meghalaya", code: "ML", type: "state" },
  { name: "Mizoram", code: "MZ", type: "state" },
  { name: "Nagaland", code: "NL", type: "state" },
  { name: "Odisha", code: "OD", type: "state" },
  { name: "Punjab", code: "PB", type: "state" },
  { name: "Rajasthan", code: "RJ", type: "state" },
  { name: "Sikkim", code: "SK", type: "state" },
  { name: "Tamil Nadu", code: "TN", type: "state" },
  { name: "Telangana", code: "TG", type: "state" },
  { name: "Tripura", code: "TR", type: "state" },
  { name: "Uttar Pradesh", code: "UP", type: "state" },
  { name: "Uttarakhand", code: "UK", type: "state" },
  { name: "West Bengal", code: "WB", type: "state" },
  { name: "Delhi", code: "DL", type: "ut" },
  { name: "Jammu and Kashmir", code: "JK", type: "ut" },
  { name: "Ladakh", code: "LA", type: "ut" },
  { name: "Chandigarh", code: "CH", type: "ut" },
  { name: "Puducherry", code: "PY", type: "ut" },
  { name: "Andaman and Nicobar Islands", code: "AN", type: "ut" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "DN", type: "ut" },
  { name: "Lakshadweep", code: "LD", type: "ut" },
];

interface CityData {
  name: string;
  stateCode: string;
  district: string;
  lat: number;
  lng: number;
  wards: { name: string; wardNumber: number; lat: number; lng: number }[];
}

const MAJOR_CITIES: CityData[] = [
  {
    name: "Raipur", stateCode: "CG", district: "Raipur", lat: 21.2514, lng: 81.6296,
    wards: [
      { name: "Civil Lines", wardNumber: 1, lat: 21.2450, lng: 81.6350 },
      { name: "Moudhapara", wardNumber: 2, lat: 21.2510, lng: 81.6330 },
      { name: "Malviya Nagar", wardNumber: 3, lat: 21.2380, lng: 81.6210 },
      { name: "Shankar Nagar", wardNumber: 4, lat: 21.2550, lng: 81.6180 },
      { name: "Telibandha", wardNumber: 5, lat: 21.2430, lng: 81.6470 },
      { name: "Devendra Nagar", wardNumber: 6, lat: 21.2570, lng: 81.6250 },
      { name: "Tatibandh", wardNumber: 7, lat: 21.2650, lng: 81.5950 },
      { name: "Kota", wardNumber: 8, lat: 21.2230, lng: 81.6600 },
      { name: "Gudhiyari", wardNumber: 9, lat: 21.2300, lng: 81.6050 },
      { name: "Sundernagar", wardNumber: 10, lat: 21.2700, lng: 81.6400 },
      { name: "Amanaka", wardNumber: 11, lat: 21.2490, lng: 81.6420 },
      { name: "Purani Basti", wardNumber: 12, lat: 21.2560, lng: 81.6350 },
      { name: "Byron Bazar", wardNumber: 13, lat: 21.2490, lng: 81.6280 },
      { name: "Pandri", wardNumber: 14, lat: 21.2410, lng: 81.6310 },
      { name: "Samta Colony", wardNumber: 15, lat: 21.2340, lng: 81.6350 },
      { name: "Shastri Nagar", wardNumber: 16, lat: 21.2640, lng: 81.6280 },
      { name: "Nehru Nagar", wardNumber: 17, lat: 21.2530, lng: 81.6150 },
      { name: "Avanti Vihar", wardNumber: 18, lat: 21.2470, lng: 81.6100 },
      { name: "Bhatagaon", wardNumber: 19, lat: 21.2750, lng: 81.6450 },
      { name: "Mathpurena", wardNumber: 20, lat: 21.2800, lng: 81.6300 },
    ],
  },
  {
    name: "Delhi", stateCode: "DL", district: "New Delhi", lat: 28.6139, lng: 77.2090,
    wards: [
      { name: "Connaught Place", wardNumber: 1, lat: 28.6315, lng: 77.2167 },
      { name: "Karol Bagh", wardNumber: 2, lat: 28.6519, lng: 77.1900 },
      { name: "Chandni Chowk", wardNumber: 3, lat: 28.6507, lng: 77.2334 },
      { name: "Lajpat Nagar", wardNumber: 4, lat: 28.5700, lng: 77.2400 },
      { name: "Dwarka", wardNumber: 5, lat: 28.5921, lng: 77.0460 },
      { name: "Rohini", wardNumber: 6, lat: 28.7495, lng: 77.0565 },
      { name: "Saket", wardNumber: 7, lat: 28.5244, lng: 77.2066 },
      { name: "Vasant Kunj", wardNumber: 8, lat: 28.5197, lng: 77.1574 },
      { name: "Janakpuri", wardNumber: 9, lat: 28.6219, lng: 77.0813 },
      { name: "Shahdara", wardNumber: 10, lat: 28.6736, lng: 77.2893 },
    ],
  },
  {
    name: "Mumbai", stateCode: "MH", district: "Mumbai", lat: 19.0760, lng: 72.8777,
    wards: [
      { name: "Colaba", wardNumber: 1, lat: 18.9067, lng: 72.8147 },
      { name: "Bandra", wardNumber: 2, lat: 19.0596, lng: 72.8295 },
      { name: "Andheri", wardNumber: 3, lat: 19.1136, lng: 72.8697 },
      { name: "Dadar", wardNumber: 4, lat: 19.0178, lng: 72.8478 },
      { name: "Borivali", wardNumber: 5, lat: 19.2307, lng: 72.8567 },
      { name: "Malad", wardNumber: 6, lat: 19.1874, lng: 72.8484 },
      { name: "Goregaon", wardNumber: 7, lat: 19.1663, lng: 72.8526 },
      { name: "Kurla", wardNumber: 8, lat: 19.0726, lng: 72.8793 },
      { name: "Powai", wardNumber: 9, lat: 19.1176, lng: 72.9060 },
      { name: "Worli", wardNumber: 10, lat: 19.0000, lng: 72.8155 },
    ],
  },
  {
    name: "Bangalore", stateCode: "KA", district: "Bangalore Urban", lat: 12.9716, lng: 77.5946,
    wards: [
      { name: "MG Road", wardNumber: 1, lat: 12.9758, lng: 77.6045 },
      { name: "Koramangala", wardNumber: 2, lat: 12.9352, lng: 77.6245 },
      { name: "Whitefield", wardNumber: 3, lat: 12.9698, lng: 77.7500 },
      { name: "Jayanagar", wardNumber: 4, lat: 12.9308, lng: 77.5838 },
      { name: "Indiranagar", wardNumber: 5, lat: 12.9784, lng: 77.6408 },
      { name: "HSR Layout", wardNumber: 6, lat: 12.9116, lng: 77.6474 },
      { name: "Electronic City", wardNumber: 7, lat: 12.8441, lng: 77.6593 },
      { name: "Rajajinagar", wardNumber: 8, lat: 12.9914, lng: 77.5565 },
      { name: "Yelahanka", wardNumber: 9, lat: 13.1007, lng: 77.5963 },
      { name: "Banashankari", wardNumber: 10, lat: 12.9255, lng: 77.5468 },
    ],
  },
  {
    name: "Hyderabad", stateCode: "TG", district: "Hyderabad", lat: 17.3850, lng: 78.4867,
    wards: [
      { name: "Secunderabad", wardNumber: 1, lat: 17.4399, lng: 78.4983 },
      { name: "Banjara Hills", wardNumber: 2, lat: 17.4138, lng: 78.4472 },
      { name: "Madhapur", wardNumber: 3, lat: 17.4400, lng: 78.3919 },
      { name: "Kukatpally", wardNumber: 4, lat: 17.4849, lng: 78.3900 },
      { name: "Charminar", wardNumber: 5, lat: 17.3616, lng: 78.4747 },
      { name: "Gachibowli", wardNumber: 6, lat: 17.4401, lng: 78.3489 },
      { name: "Ameerpet", wardNumber: 7, lat: 17.4375, lng: 78.4483 },
      { name: "Dilsukhnagar", wardNumber: 8, lat: 17.3688, lng: 78.5247 },
      { name: "Begumpet", wardNumber: 9, lat: 17.4436, lng: 78.4746 },
      { name: "LB Nagar", wardNumber: 10, lat: 17.3496, lng: 78.5512 },
    ],
  },
  {
    name: "Chennai", stateCode: "TN", district: "Chennai", lat: 13.0827, lng: 80.2707,
    wards: [
      { name: "T. Nagar", wardNumber: 1, lat: 13.0418, lng: 80.2341 },
      { name: "Anna Nagar", wardNumber: 2, lat: 13.0850, lng: 80.2101 },
      { name: "Adyar", wardNumber: 3, lat: 13.0012, lng: 80.2565 },
      { name: "Velachery", wardNumber: 4, lat: 12.9815, lng: 80.2180 },
      { name: "Tambaram", wardNumber: 5, lat: 12.9249, lng: 80.1000 },
      { name: "Mylapore", wardNumber: 6, lat: 13.0368, lng: 80.2676 },
      { name: "Nungambakkam", wardNumber: 7, lat: 13.0569, lng: 80.2425 },
      { name: "Egmore", wardNumber: 8, lat: 13.0732, lng: 80.2609 },
      { name: "Porur", wardNumber: 9, lat: 13.0382, lng: 80.1564 },
      { name: "Ambattur", wardNumber: 10, lat: 13.1143, lng: 80.1548 },
    ],
  },
  {
    name: "Kolkata", stateCode: "WB", district: "Kolkata", lat: 22.5726, lng: 88.3639,
    wards: [
      { name: "Park Street", wardNumber: 1, lat: 22.5529, lng: 88.3506 },
      { name: "Salt Lake", wardNumber: 2, lat: 22.5958, lng: 88.4078 },
      { name: "Howrah", wardNumber: 3, lat: 22.5958, lng: 88.2636 },
      { name: "New Town", wardNumber: 4, lat: 22.5922, lng: 88.4847 },
      { name: "Ballygunge", wardNumber: 5, lat: 22.5283, lng: 88.3626 },
      { name: "Dum Dum", wardNumber: 6, lat: 22.6527, lng: 88.4219 },
      { name: "Behala", wardNumber: 7, lat: 22.4990, lng: 88.3100 },
      { name: "Tollygunge", wardNumber: 8, lat: 22.4988, lng: 88.3474 },
      { name: "Gariahat", wardNumber: 9, lat: 22.5193, lng: 88.3669 },
      { name: "Alipore", wardNumber: 10, lat: 22.5332, lng: 88.3359 },
    ],
  },
  {
    name: "Pune", stateCode: "MH", district: "Pune", lat: 18.5204, lng: 73.8567,
    wards: [
      { name: "Shivajinagar", wardNumber: 1, lat: 18.5314, lng: 73.8446 },
      { name: "Kothrud", wardNumber: 2, lat: 18.5074, lng: 73.8077 },
      { name: "Hinjewadi", wardNumber: 3, lat: 18.5912, lng: 73.7389 },
      { name: "Wakad", wardNumber: 4, lat: 18.5985, lng: 73.7623 },
      { name: "Viman Nagar", wardNumber: 5, lat: 18.5679, lng: 73.9143 },
      { name: "Hadapsar", wardNumber: 6, lat: 18.5089, lng: 73.9260 },
      { name: "Baner", wardNumber: 7, lat: 18.5590, lng: 73.7868 },
      { name: "Deccan", wardNumber: 8, lat: 18.5195, lng: 73.8407 },
      { name: "Pimpri", wardNumber: 9, lat: 18.6298, lng: 73.7997 },
      { name: "Magarpatta", wardNumber: 10, lat: 18.5148, lng: 73.9280 },
    ],
  },
  {
    name: "Ahmedabad", stateCode: "GJ", district: "Ahmedabad", lat: 23.0225, lng: 72.5714,
    wards: [
      { name: "Maninagar", wardNumber: 1, lat: 23.0060, lng: 72.6059 },
      { name: "Navrangpura", wardNumber: 2, lat: 23.0369, lng: 72.5612 },
      { name: "Satellite", wardNumber: 3, lat: 23.0170, lng: 72.5130 },
      { name: "Vastrapur", wardNumber: 4, lat: 23.0360, lng: 72.5260 },
      { name: "SG Highway", wardNumber: 5, lat: 23.0508, lng: 72.5024 },
      { name: "Bopal", wardNumber: 6, lat: 23.0350, lng: 72.4649 },
      { name: "Chandkheda", wardNumber: 7, lat: 23.1077, lng: 72.5820 },
      { name: "Gota", wardNumber: 8, lat: 23.1015, lng: 72.5438 },
      { name: "Paldi", wardNumber: 9, lat: 23.0128, lng: 72.5630 },
      { name: "Thaltej", wardNumber: 10, lat: 23.0505, lng: 72.4982 },
    ],
  },
  {
    name: "Jaipur", stateCode: "RJ", district: "Jaipur", lat: 26.9124, lng: 75.7873,
    wards: [
      { name: "C-Scheme", wardNumber: 1, lat: 26.9124, lng: 75.7873 },
      { name: "Malviya Nagar", wardNumber: 2, lat: 26.8553, lng: 75.8051 },
      { name: "Vaishali Nagar", wardNumber: 3, lat: 26.9120, lng: 75.7280 },
      { name: "Mansarovar", wardNumber: 4, lat: 26.8691, lng: 75.7603 },
      { name: "Raja Park", wardNumber: 5, lat: 26.9000, lng: 75.8118 },
      { name: "Tonk Road", wardNumber: 6, lat: 26.8705, lng: 75.7941 },
      { name: "Jagatpura", wardNumber: 7, lat: 26.8320, lng: 75.8526 },
      { name: "Sodala", wardNumber: 8, lat: 26.9182, lng: 75.7643 },
      { name: "Jhotwara", wardNumber: 9, lat: 26.9340, lng: 75.7475 },
      { name: "Sanganer", wardNumber: 10, lat: 26.8252, lng: 75.7876 },
    ],
  },
  {
    name: "Lucknow", stateCode: "UP", district: "Lucknow", lat: 26.8467, lng: 80.9462,
    wards: [
      { name: "Hazratganj", wardNumber: 1, lat: 26.8530, lng: 80.9493 },
      { name: "Gomti Nagar", wardNumber: 2, lat: 26.8520, lng: 81.0048 },
      { name: "Aliganj", wardNumber: 3, lat: 26.8886, lng: 80.9464 },
      { name: "Indira Nagar", wardNumber: 4, lat: 26.8774, lng: 80.9894 },
      { name: "Aminabad", wardNumber: 5, lat: 26.8423, lng: 80.9254 },
      { name: "Chowk", wardNumber: 6, lat: 26.8609, lng: 80.9149 },
      { name: "Mahanagar", wardNumber: 7, lat: 26.8700, lng: 80.9500 },
      { name: "Vikas Nagar", wardNumber: 8, lat: 26.8400, lng: 80.9700 },
      { name: "Rajajipuram", wardNumber: 9, lat: 26.8500, lng: 80.8900 },
      { name: "Jankipuram", wardNumber: 10, lat: 26.9200, lng: 80.9400 },
    ],
  },
  {
    name: "Bhopal", stateCode: "MP", district: "Bhopal", lat: 23.2599, lng: 77.4126,
    wards: [
      { name: "MP Nagar", wardNumber: 1, lat: 23.2332, lng: 77.4300 },
      { name: "Arera Colony", wardNumber: 2, lat: 23.2136, lng: 77.4400 },
      { name: "Habibganj", wardNumber: 3, lat: 23.2298, lng: 77.4370 },
      { name: "Kolar", wardNumber: 4, lat: 23.1739, lng: 77.4189 },
      { name: "Bairagarh", wardNumber: 5, lat: 23.2708, lng: 77.3484 },
      { name: "Shahpura", wardNumber: 6, lat: 23.1953, lng: 77.4473 },
      { name: "TT Nagar", wardNumber: 7, lat: 23.2420, lng: 77.4160 },
      { name: "Lalghati", wardNumber: 8, lat: 23.2700, lng: 77.4050 },
      { name: "Govindpura", wardNumber: 9, lat: 23.2820, lng: 77.4600 },
      { name: "Misrod", wardNumber: 10, lat: 23.1800, lng: 77.4700 },
    ],
  },
];

const DEPARTMENTS = [
  "CSPDCL - Raipur Division",
  "Gas Authority - Chhattisgarh",
  "PHE Department - Raipur",
  "Municipal Corp - Sanitation Dept",
  "Municipal Corp - Engineering Dept",
  "General Administration",
];

function getDepartmentsForCity(cityName: string): string[] {
  const cityDepts: Record<string, string[]> = {
    "Delhi": ["BSES - Delhi Division", "IGL Gas - Delhi", "DJB - Delhi Jal Board", "MCD - Sanitation Dept", "MCD - Engineering Dept", "General Administration"],
    "Mumbai": ["BEST - Mumbai Division", "MGL Gas - Mumbai", "BMC - Water Supply", "BMC - Sanitation Dept", "BMC - Engineering Dept", "General Administration"],
    "Bangalore": ["BESCOM - Bangalore", "GAIL Gas - Karnataka", "BWSSB - Water Board", "BBMP - Sanitation Dept", "BBMP - Engineering Dept", "General Administration"],
    "Hyderabad": ["TSSPDCL - Hyderabad", "GAIL Gas - Telangana", "HMWSSB - Water Board", "GHMC - Sanitation Dept", "GHMC - Engineering Dept", "General Administration"],
    "Chennai": ["TANGEDCO - Chennai", "IGL Gas - Tamil Nadu", "CMWSSB - Water Board", "Chennai Corp - Sanitation", "Chennai Corp - Engineering", "General Administration"],
    "Kolkata": ["CESC - Kolkata", "GAIL Gas - West Bengal", "KMC - Water Supply", "KMC - Sanitation Dept", "KMC - Engineering Dept", "General Administration"],
    "Pune": ["MSEDCL - Pune", "MGL Gas - Pune", "PMC - Water Supply", "PMC - Sanitation Dept", "PMC - Engineering Dept", "General Administration"],
    "Ahmedabad": ["UGVCL - Ahmedabad", "GSG Gas - Gujarat", "AMC - Water Supply", "AMC - Sanitation Dept", "AMC - Engineering Dept", "General Administration"],
    "Jaipur": ["JVVNL - Jaipur", "IGL Gas - Rajasthan", "PHED - Water Supply", "JMC - Sanitation Dept", "JMC - Engineering Dept", "General Administration"],
    "Lucknow": ["LESA - Lucknow", "IGL Gas - UP", "Jal Nigam - Lucknow", "LMC - Sanitation Dept", "LMC - Engineering Dept", "General Administration"],
    "Bhopal": ["MPMKVVCL - Bhopal", "GAIL Gas - MP", "BMC - Water Supply", "BMC - Sanitation Dept", "BMC - Engineering Dept", "General Administration"],
  };
  return cityDepts[cityName] || DEPARTMENTS;
}

const DESIGNATIONS_BY_ROLE: Record<string, string> = {
  staff: "Field Officer",
  authority: "Department Head",
  head: "District Collector",
  admin: "System Administrator",
};

export async function seedIndianLocations(): Promise<{ success: boolean; message: string }> {
  try {
    const existing = await db.select({ count: sql<number>`count(*)::int` }).from(indianStates);
    const existingCities = await db.select({ count: sql<number>`count(*)::int` }).from(indianCities);
    const cityCount = existingCities[0]?.count || 0;

    if (existing[0]?.count > 0 && cityCount > 1000) {
      return { success: true, message: "Locations already seeded" };
    }

    if (existing[0]?.count > 0 && cityCount <= 1000) {
      console.log(`[Seed] Found ${cityCount} cities, need to add bulk cities...`);
      const stateRows = await db.select().from(indianStates);
      const stateMap: Record<string, number> = {};
      for (const s of stateRows) {
        const stateData = INDIAN_STATES.find(is => is.name === s.name);
        if (stateData) stateMap[stateData.code] = s.id;
      }

      const stateNameToId: Record<string, number> = {};
      for (const s of INDIAN_STATES) {
        stateNameToId[s.name] = stateMap[s.code];
      }

      const majorCityNames = new Set(MAJOR_CITIES.map(c => c.name));
      let bulkCitiesInserted = 0;

      try {
        const __filename2 = fileURLToPath(import.meta.url);
        const __dirname2 = path.dirname(__filename2);
        const jsonPath = path.join(__dirname2, 'data', 'indian-cities-8000.json');

        if (fs.existsSync(jsonPath)) {
          console.log("[Seed] Loading bulk cities data...");
          const rawData = fs.readFileSync(jsonPath, 'utf-8');
          const allCities: { name: string; state: string; district: string; lat: number; lng: number }[] = JSON.parse(rawData);

          const citiesToInsert = allCities.filter(c => !majorCityNames.has(c.name) && stateNameToId[c.state]);

          console.log(`[Seed] Inserting ${citiesToInsert.length} additional cities in batches...`);
          const BATCH_SIZE = 200;
          for (let i = 0; i < citiesToInsert.length; i += BATCH_SIZE) {
            const batch = citiesToInsert.slice(i, i + BATCH_SIZE);
            const values = batch.map(c => ({
              name: c.name,
              stateId: stateNameToId[c.state],
              district: c.district,
              latitude: c.lat,
              longitude: c.lng,
            }));

            try {
              await db.insert(indianCities).values(values);
              bulkCitiesInserted += batch.length;
            } catch (e: any) {
              for (const v of values) {
                try {
                  await db.insert(indianCities).values(v);
                  bulkCitiesInserted++;
                } catch {}
              }
            }

            if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= citiesToInsert.length) {
              console.log(`[Seed] Progress: ${Math.min(i + BATCH_SIZE, citiesToInsert.length)}/${citiesToInsert.length} cities...`);
            }
          }
          console.log(`[Seed] Bulk cities inserted: ${bulkCitiesInserted}`);
        }
      } catch (e: any) {
        console.error("[Seed] Bulk city insert error:", e.message);
      }

      return { success: true, message: `Added ${bulkCitiesInserted} bulk cities` };
    }

    console.log("[Seed] Seeding Indian states...");
    const stateMap: Record<string, number> = {};
    for (const s of INDIAN_STATES) {
      const [inserted] = await db.insert(indianStates).values({
        name: s.name, code: s.code, type: s.type,
      }).returning();
      stateMap[s.code] = inserted.id;
    }
    console.log(`[Seed] Inserted ${INDIAN_STATES.length} states/UTs`);

    let totalWards = 0;
    let totalStaff = 0;

    for (const city of MAJOR_CITIES) {
      const stateId = stateMap[city.stateCode];
      if (!stateId) { console.error(`[Seed] State ${city.stateCode} not found`); continue; }

      const [insertedCity] = await db.insert(indianCities).values({
        name: city.name, stateId, district: city.district,
        latitude: city.lat, longitude: city.lng,
      }).returning();
      const cityId = insertedCity.id;

      const wardIds: number[] = [];
      for (const w of city.wards) {
        const [insertedWard] = await db.insert(indianWards).values({
          name: w.name, wardNumber: w.wardNumber, cityId,
          latitude: w.lat, longitude: w.lng,
        }).returning();
        wardIds.push(insertedWard.id);
        totalWards++;
      }

      const cityDepts = getDepartmentsForCity(city.name);
      const cityCode = city.name.substring(0, 3).toUpperCase();

      for (let wi = 0; wi < Math.min(city.wards.length, 6); wi++) {
        const dept = cityDepts[wi % cityDepts.length];
        const wardData = city.wards[wi];
        const username = `staff_${cityCode.toLowerCase()}_w${wardData.wardNumber}`;
        const staffName = `${wardData.name} Officer - ${city.name}`;

        try {
          const [staffUser] = await db.insert(users).values({
            username,
            password: username,
            name: staffName,
            phone: `9${String(cityId).padStart(2, "0")}${String(wardData.wardNumber).padStart(3, "0")}0001`,
            role: "staff",
            suvidhaId: `STF-${cityCode}-${wardData.wardNumber}`,
          }).returning();

          await db.insert(staffProfiles).values({
            userId: staffUser.id, department: dept,
            designation: "Field Officer",
            employeeId: `EMP-${cityCode}-${wardData.wardNumber}`,
            ward: wardData.name, phone: staffUser.phone || "",
          });

          await db.insert(locationStaffAssignments).values({
            userId: staffUser.id, roleType: "staff",
            department: dept, stateId, cityId, wardId: wardIds[wi],
          });
          totalStaff++;
        } catch (e: any) {
          if (!e.message?.includes("duplicate")) console.error(`[Seed] Staff ${username}:`, e.message);
        }
      }

      for (let di = 0; di < cityDepts.length; di++) {
        const dept = cityDepts[di];
        const deptShort = dept.split(" - ")[0].substring(0, 6).replace(/\s/g, "");
        const username = `auth_${cityCode.toLowerCase()}_${deptShort.toLowerCase()}`;
        const authName = `${dept.split(" - ")[0]} Authority - ${city.name}`;

        try {
          const [authUser] = await db.insert(users).values({
            username,
            password: username,
            name: authName,
            phone: `7${String(cityId).padStart(2, "0")}${String(di).padStart(3, "0")}0002`,
            role: "authority",
            suvidhaId: `AUTH-${cityCode}-${di + 1}`,
          }).returning();

          await db.insert(staffProfiles).values({
            userId: authUser.id, department: dept,
            designation: "Department Head",
            employeeId: `DH-${cityCode}-${di + 1}`,
            ward: "All Wards", phone: authUser.phone || "",
          });

          await db.insert(locationStaffAssignments).values({
            userId: authUser.id, roleType: "authority",
            department: dept, stateId, cityId,
          });
          totalStaff++;
        } catch (e: any) {
          if (!e.message?.includes("duplicate")) console.error(`[Seed] Authority ${username}:`, e.message);
        }
      }

      const headUsername = `head_${cityCode.toLowerCase()}`;
      try {
        const [headUser] = await db.insert(users).values({
          username: headUsername,
          password: headUsername,
          name: `District Collector - ${city.name}`,
          phone: `7${String(cityId).padStart(2, "0")}0000003`,
          role: "head",
          suvidhaId: `HEAD-${cityCode}-1`,
        }).returning();

        await db.insert(locationStaffAssignments).values({
          userId: headUser.id, roleType: "head",
          stateId, cityId,
        });
        totalStaff++;
      } catch (e: any) {
        if (!e.message?.includes("duplicate")) console.error(`[Seed] Head ${headUsername}:`, e.message);
      }

      const adminUsername = `admin_${cityCode.toLowerCase()}`;
      try {
        const [adminUser] = await db.insert(users).values({
          username: adminUsername,
          password: adminUsername,
          name: `City Admin - ${city.name}`,
          phone: `7${String(cityId).padStart(2, "0")}0000004`,
          role: "admin",
          suvidhaId: `ADM-${cityCode}-1`,
        }).returning();

        await db.insert(locationStaffAssignments).values({
          userId: adminUser.id, roleType: "admin",
          stateId, cityId,
        });
        totalStaff++;
      } catch (e: any) {
        if (!e.message?.includes("duplicate")) console.error(`[Seed] Admin ${adminUsername}:`, e.message);
      }

      console.log(`[Seed] ${city.name}: ${city.wards.length} wards seeded with staff`);
    }

    console.log(`[Seed] Major cities done: ${MAJOR_CITIES.length} cities, ${totalWards} wards, ${totalStaff} staff/authority/head/admin users`);

    const majorCityNames = new Set(MAJOR_CITIES.map(c => c.name));

    let bulkCitiesInserted = 0;
    try {
      const __filename2 = fileURLToPath(import.meta.url);
      const __dirname2 = path.dirname(__filename2);
      const jsonPath = path.join(__dirname2, 'data', 'indian-cities-8000.json');

      if (fs.existsSync(jsonPath)) {
        console.log("[Seed] Loading bulk cities data...");
        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        const allCities: { name: string; state: string; district: string; lat: number; lng: number }[] = JSON.parse(rawData);

        const stateNameToId: Record<string, number> = {};
        for (const s of INDIAN_STATES) {
          stateNameToId[s.name] = stateMap[s.code];
        }

        const citiesToInsert = allCities.filter(c => {
          return !majorCityNames.has(c.name) && stateNameToId[c.state];
        });

        console.log(`[Seed] Inserting ${citiesToInsert.length} additional cities in batches...`);
        const BATCH_SIZE = 200;
        for (let i = 0; i < citiesToInsert.length; i += BATCH_SIZE) {
          const batch = citiesToInsert.slice(i, i + BATCH_SIZE);
          const values = batch.map(c => ({
            name: c.name,
            stateId: stateNameToId[c.state],
            district: c.district,
            latitude: c.lat,
            longitude: c.lng,
          }));

          try {
            await db.insert(indianCities).values(values);
            bulkCitiesInserted += batch.length;
          } catch (e: any) {
            for (const v of values) {
              try {
                await db.insert(indianCities).values(v);
                bulkCitiesInserted++;
              } catch {}
            }
          }

          if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= citiesToInsert.length) {
            console.log(`[Seed] Progress: ${Math.min(i + BATCH_SIZE, citiesToInsert.length)}/${citiesToInsert.length} cities...`);
          }
        }

        console.log(`[Seed] Bulk cities inserted: ${bulkCitiesInserted}`);
      } else {
        console.log("[Seed] No bulk cities JSON found at", jsonPath);
      }
    } catch (e: any) {
      console.error("[Seed] Bulk city insert error:", e.message);
    }

    const totalCities = MAJOR_CITIES.length + bulkCitiesInserted;
    console.log(`[Seed] Total: ${INDIAN_STATES.length} states, ${totalCities} cities, ${totalWards} wards, ${totalStaff} role users`);
    return { success: true, message: `Seeded ${INDIAN_STATES.length} states, ${totalCities} cities, ${totalWards} wards, ${totalStaff} role users` };
  } catch (error: any) {
    console.error("[Seed Locations] Error:", error.message);
    return { success: false, message: error.message };
  }
}
