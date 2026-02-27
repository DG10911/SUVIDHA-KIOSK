import * as fs from 'fs';
import * as path from 'path';

interface StateData {
  name: string;
  code: string;
  lat: number;
  lng: number;
  latRange: [number, number];
  lngRange: [number, number];
  districts: string[];
}

interface CityEntry {
  name: string;
  state: string;
  district: string;
  lat: number;
  lng: number;
}

const STATES: StateData[] = [
  { name: "Andhra Pradesh", code: "AP", lat: 15.9129, lng: 79.7400, latRange: [12.6, 19.1], lngRange: [76.7, 84.8], districts: ["Anantapur","Chittoor","East Godavari","Guntur","Krishna","Kurnool","Nellore","Prakasam","Srikakulam","Visakhapatnam","Vizianagaram","West Godavari","YSR Kadapa","Bapatla","Anakapalli","Alluri Sitharama Raju","Parvathipuram Manyam","Kakinada","Konaseema","Eluru","NTR","Palnadu","Nandyal","Tirupati","Annamayya","Sri Sathya Sai"] },
  { name: "Arunachal Pradesh", code: "AR", lat: 28.2180, lng: 94.7278, latRange: [26.5, 29.5], lngRange: [91.5, 97.5], districts: ["Tawang","West Kameng","East Kameng","Papum Pare","Kurung Kumey","Kra Daadi","Lower Subansiri","Upper Subansiri","West Siang","East Siang","Siang","Upper Siang","Lower Siang","Lower Dibang Valley","Dibang Valley","Anjaw","Lohit","Namsai","Changlang","Tirap","Longding","Kamle","Pakke-Kessang","Lepa Rada","Shi Yomi","Itanagar Capital Complex"] },
  { name: "Assam", code: "AS", lat: 26.2006, lng: 92.9376, latRange: [24.0, 28.0], lngRange: [89.5, 96.0], districts: ["Baksa","Barpeta","Biswanath","Bongaigaon","Cachar","Charaideo","Chirang","Darrang","Dhemaji","Dhubri","Dibrugarh","Dima Hasao","Goalpara","Golaghat","Hailakandi","Hojai","Jorhat","Kamrup","Kamrup Metropolitan","Karbi Anglong","Karimganj","Kokrajhar","Lakhimpur","Majuli","Morigaon","Nagaon","Nalbari","Sivasagar","Sonitpur","South Salmara-Mankachar","Tinsukia","Udalguri","West Karbi Anglong","Bajali","Tamulpur"] },
  { name: "Bihar", code: "BR", lat: 25.0961, lng: 85.3131, latRange: [23.5, 27.5], lngRange: [83.0, 88.3], districts: ["Araria","Arwal","Aurangabad","Banka","Begusarai","Bhagalpur","Bhojpur","Buxar","Darbhanga","East Champaran","Gaya","Gopalganj","Jamui","Jehanabad","Kaimur","Katihar","Khagaria","Kishanganj","Lakhisarai","Madhepura","Madhubani","Munger","Muzaffarpur","Nalanda","Nawada","Patna","Purnia","Rohtas","Saharsa","Samastipur","Saran","Sheikhpura","Sheohar","Sitamarhi","Siwan","Supaul","Vaishali","West Champaran"] },
  { name: "Chhattisgarh", code: "CG", lat: 21.2787, lng: 81.8661, latRange: [17.7, 24.1], lngRange: [80.2, 84.4], districts: ["Balod","Baloda Bazar","Balrampur","Bastar","Bemetara","Bijapur","Bilaspur","Dantewada","Dhamtari","Durg","Gariaband","Gaurela-Pendra-Marwahi","Janjgir-Champa","Jashpur","Kabirdham","Kanker","Kondagaon","Korba","Koriya","Mahasamund","Mungeli","Narayanpur","Raigarh","Raipur","Rajnandgaon","Sukma","Surajpur","Surguja","Manendragarh-Chirmiri-Bharatpur","Mohla-Manpur-Ambagarh Chowki","Sarangarh-Bilaigarh","Khairagarh-Chhuikhadan-Gandai","Sakti"] },
  { name: "Goa", code: "GA", lat: 15.2993, lng: 74.1240, latRange: [14.8, 15.8], lngRange: [73.6, 74.4], districts: ["North Goa","South Goa"] },
  { name: "Gujarat", code: "GJ", lat: 22.2587, lng: 71.1924, latRange: [20.1, 24.7], lngRange: [68.1, 74.5], districts: ["Ahmedabad","Amreli","Anand","Aravalli","Banaskantha","Bharuch","Bhavnagar","Botad","Chhota Udaipur","Dahod","Dang","Devbhumi Dwarka","Gandhinagar","Gir Somnath","Jamnagar","Junagadh","Kheda","Kutch","Mahisagar","Mehsana","Morbi","Narmada","Navsari","Panchmahal","Patan","Porbandar","Rajkot","Sabarkantha","Surat","Surendranagar","Tapi","Vadodara","Valsad"] },
  { name: "Haryana", code: "HR", lat: 29.0588, lng: 76.0856, latRange: [27.4, 30.9], lngRange: [74.5, 77.6], districts: ["Ambala","Bhiwani","Charkhi Dadri","Faridabad","Fatehabad","Gurugram","Hisar","Jhajjar","Jind","Kaithal","Karnal","Kurukshetra","Mahendragarh","Nuh","Palwal","Panchkula","Panipat","Rewari","Rohtak","Sirsa","Sonipat","Yamunanagar"] },
  { name: "Himachal Pradesh", code: "HP", lat: 31.1048, lng: 77.1734, latRange: [30.2, 33.3], lngRange: [75.6, 79.0], districts: ["Bilaspur","Chamba","Hamirpur","Kangra","Kinnaur","Kullu","Lahaul and Spiti","Mandi","Shimla","Sirmaur","Solan","Una"] },
  { name: "Jharkhand", code: "JH", lat: 23.6102, lng: 85.2799, latRange: [21.9, 25.3], lngRange: [83.3, 87.9], districts: ["Bokaro","Chatra","Deoghar","Dhanbad","Dumka","East Singhbhum","Garhwa","Giridih","Godda","Gumla","Hazaribagh","Jamtara","Khunti","Koderma","Latehar","Lohardaga","Pakur","Palamu","Ramgarh","Ranchi","Sahebganj","Saraikela Kharsawan","Simdega","West Singhbhum"] },
  { name: "Karnataka", code: "KA", lat: 15.3173, lng: 75.7139, latRange: [11.5, 18.5], lngRange: [74.0, 78.6], districts: ["Bagalkot","Ballari","Belagavi","Bengaluru Rural","Bengaluru Urban","Bidar","Chamarajanagar","Chikballapur","Chikkamagaluru","Chitradurga","Dakshina Kannada","Davanagere","Dharwad","Gadag","Hassan","Haveri","Kalaburagi","Kodagu","Kolar","Koppal","Mandya","Mysuru","Raichur","Ramanagara","Shivamogga","Tumakuru","Udupi","Uttara Kannada","Vijayapura","Yadgir","Vijayanagara"] },
  { name: "Kerala", code: "KL", lat: 10.8505, lng: 76.2711, latRange: [8.2, 12.8], lngRange: [74.8, 77.4], districts: ["Alappuzha","Ernakulam","Idukki","Kannur","Kasaragod","Kollam","Kottayam","Kozhikode","Malappuram","Palakkad","Pathanamthitta","Thiruvananthapuram","Thrissur","Wayanad"] },
  { name: "Madhya Pradesh", code: "MP", lat: 22.9734, lng: 78.6569, latRange: [21.0, 26.9], lngRange: [74.0, 82.8], districts: ["Agar Malwa","Alirajpur","Anuppur","Ashoknagar","Balaghat","Barwani","Betul","Bhind","Bhopal","Burhanpur","Chhatarpur","Chhindwara","Damoh","Datia","Dewas","Dhar","Dindori","Guna","Gwalior","Harda","Hoshangabad","Indore","Jabalpur","Jhabua","Katni","Khandwa","Khargone","Mandla","Mandsaur","Morena","Narsinghpur","Neemuch","Panna","Raisen","Rajgarh","Ratlam","Rewa","Sagar","Satna","Sehore","Seoni","Shahdol","Shajapur","Sheopur","Shivpuri","Sidhi","Singrauli","Tikamgarh","Ujjain","Umaria","Vidisha","Niwari","Mauganj","Pandhurna","Maihar"] },
  { name: "Maharashtra", code: "MH", lat: 19.7515, lng: 75.7139, latRange: [15.6, 22.0], lngRange: [72.6, 80.9], districts: ["Ahmednagar","Akola","Amravati","Aurangabad","Beed","Bhandara","Buldhana","Chandrapur","Dhule","Gadchiroli","Gondia","Hingoli","Jalgaon","Jalna","Kolhapur","Latur","Mumbai City","Mumbai Suburban","Nagpur","Nanded","Nandurbar","Nashik","Osmanabad","Palghar","Parbhani","Pune","Raigad","Ratnagiri","Sangli","Satara","Sindhudurg","Solapur","Thane","Wardha","Washim","Yavatmal"] },
  { name: "Manipur", code: "MN", lat: 24.6637, lng: 93.9063, latRange: [23.8, 25.7], lngRange: [93.0, 94.8], districts: ["Bishnupur","Chandel","Churachandpur","Imphal East","Imphal West","Jiribam","Kakching","Kamjong","Kangpokpi","Noney","Pherzawl","Senapati","Tamenglong","Tengnoupal","Thoubal","Ukhrul"] },
  { name: "Meghalaya", code: "ML", lat: 25.4670, lng: 91.3662, latRange: [25.0, 26.1], lngRange: [89.8, 92.8], districts: ["East Garo Hills","East Jaintia Hills","East Khasi Hills","North Garo Hills","Ri-Bhoi","South Garo Hills","South West Garo Hills","South West Khasi Hills","West Garo Hills","West Jaintia Hills","West Khasi Hills","Eastern West Khasi Hills"] },
  { name: "Mizoram", code: "MZ", lat: 23.1645, lng: 92.9376, latRange: [21.9, 24.5], lngRange: [92.2, 93.5], districts: ["Aizawl","Champhai","Hnahthial","Khawzawl","Kolasib","Lawngtlai","Lunglei","Mamit","Saiha","Saitual","Serchhip"] },
  { name: "Nagaland", code: "NL", lat: 26.1584, lng: 94.5624, latRange: [25.2, 27.0], lngRange: [93.2, 95.2], districts: ["Chumoukedima","Dimapur","Kiphire","Kohima","Longleng","Mokokchung","Mon","Niuland","Noklak","Peren","Phek","Shamator","Tseminyu","Tuensang","Wokha","Zunheboto"] },
  { name: "Odisha", code: "OD", lat: 20.9517, lng: 85.0985, latRange: [17.8, 22.6], lngRange: [81.3, 87.5], districts: ["Angul","Balangir","Balasore","Bargarh","Bhadrak","Boudh","Cuttack","Deogarh","Dhenkanal","Gajapati","Ganjam","Jagatsinghpur","Jajpur","Jharsuguda","Kalahandi","Kandhamal","Kendrapara","Kendujhar","Khordha","Koraput","Malkangiri","Mayurbhanj","Nabarangpur","Nayagarh","Nuapada","Puri","Rayagada","Sambalpur","Subarnapur","Sundargarh"] },
  { name: "Punjab", code: "PB", lat: 31.1471, lng: 75.3412, latRange: [29.5, 32.5], lngRange: [73.8, 76.9], districts: ["Amritsar","Barnala","Bathinda","Faridkot","Fatehgarh Sahib","Fazilka","Ferozepur","Gurdaspur","Hoshiarpur","Jalandhar","Kapurthala","Ludhiana","Malerkotla","Mansa","Moga","Mohali","Muktsar","Nawanshahr","Pathankot","Patiala","Rupnagar","Sangrur","Tarn Taran"] },
  { name: "Rajasthan", code: "RJ", lat: 27.0238, lng: 74.2179, latRange: [23.0, 30.2], lngRange: [69.3, 78.3], districts: ["Ajmer","Alwar","Banswara","Baran","Barmer","Bharatpur","Bhilwara","Bikaner","Bundi","Chittorgarh","Churu","Dausa","Dholpur","Dungarpur","Ganganagar","Hanumangarh","Jaipur","Jaisalmer","Jalore","Jhalawar","Jhunjhunu","Jodhpur","Karauli","Kota","Nagaur","Pali","Pratapgarh","Rajsamand","Sawai Madhopur","Sikar","Sirohi","Tonk","Udaipur"] },
  { name: "Sikkim", code: "SK", lat: 27.5330, lng: 88.5122, latRange: [27.0, 28.1], lngRange: [88.0, 89.0], districts: ["East Sikkim","North Sikkim","South Sikkim","West Sikkim","Pakyong","Soreng"] },
  { name: "Tamil Nadu", code: "TN", lat: 11.1271, lng: 78.6569, latRange: [8.0, 13.6], lngRange: [76.2, 80.4], districts: ["Ariyalur","Chengalpattu","Chennai","Coimbatore","Cuddalore","Dharmapuri","Dindigul","Erode","Kallakurichi","Kanchipuram","Kanyakumari","Karur","Krishnagiri","Madurai","Mayiladuthurai","Nagapattinam","Namakkal","Nilgiris","Perambalur","Pudukkottai","Ramanathapuram","Ranipet","Salem","Sivagangai","Tenkasi","Thanjavur","Theni","Thoothukudi","Tiruchirappalli","Tirunelveli","Tirupathur","Tiruppur","Tiruvallur","Tiruvannamalai","Tiruvarur","Vellore","Viluppuram","Virudhunagar","Tirupattur"] },
  { name: "Telangana", code: "TS", lat: 18.1124, lng: 79.0193, latRange: [15.8, 19.9], lngRange: [77.2, 81.3], districts: ["Adilabad","Bhadradri Kothagudem","Hanamkonda","Hyderabad","Jagtial","Jangaon","Jayashankar Bhupalpally","Jogulamba Gadwal","Kamareddy","Karimnagar","Khammam","Kumuram Bheem","Mahabubabad","Mahbubnagar","Mancherial","Medak","Medchal-Malkajgiri","Mulugu","Nagarkurnool","Nalgonda","Narayanpet","Nirmal","Nizamabad","Peddapalli","Rajanna Sircilla","Rangareddy","Sangareddy","Siddipet","Suryapet","Vikarabad","Wanaparthy","Warangal","Yadadri Bhuvanagiri"] },
  { name: "Tripura", code: "TR", lat: 23.9408, lng: 91.9882, latRange: [22.9, 24.5], lngRange: [91.1, 92.3], districts: ["Dhalai","Gomati","Khowai","North Tripura","Sepahijala","South Tripura","Unakoti","West Tripura"] },
  { name: "Uttar Pradesh", code: "UP", lat: 26.8467, lng: 80.9462, latRange: [23.8, 30.4], lngRange: [77.0, 84.6], districts: ["Agra","Aligarh","Ambedkar Nagar","Amethi","Amroha","Auraiya","Ayodhya","Azamgarh","Baghpat","Bahraich","Ballia","Balrampur","Banda","Barabanki","Bareilly","Basti","Bhadohi","Bijnor","Budaun","Bulandshahr","Chandauli","Chitrakoot","Deoria","Etah","Etawah","Farrukhabad","Fatehpur","Firozabad","Gautam Buddha Nagar","Ghaziabad","Ghazipur","Gonda","Gorakhpur","Hamirpur","Hapur","Hardoi","Hathras","Jalaun","Jaunpur","Jhansi","Kannauj","Kanpur Dehat","Kanpur Nagar","Kasganj","Kaushambi","Kushinagar","Lakhimpur Kheri","Lalitpur","Lucknow","Maharajganj","Mahoba","Mainpuri","Mathura","Mau","Meerut","Mirzapur","Moradabad","Muzaffarnagar","Pilibhit","Pratapgarh","Prayagraj","Rae Bareli","Rampur","Saharanpur","Sambhal","Sant Kabir Nagar","Shahjahanpur","Shamli","Shravasti","Siddharthnagar","Sitapur","Sonbhadra","Sultanpur","Unnao","Varanasi"] },
  { name: "Uttarakhand", code: "UK", lat: 30.0668, lng: 79.0193, latRange: [28.7, 31.5], lngRange: [77.5, 81.1], districts: ["Almora","Bageshwar","Chamoli","Champawat","Dehradun","Haridwar","Nainital","Pauri Garhwal","Pithoragarh","Rudraprayag","Tehri Garhwal","Udham Singh Nagar","Uttarkashi"] },
  { name: "West Bengal", code: "WB", lat: 22.9868, lng: 87.8550, latRange: [21.5, 27.2], lngRange: [85.8, 89.9], districts: ["Alipurduar","Bankura","Birbhum","Cooch Behar","Dakshin Dinajpur","Darjeeling","Hooghly","Howrah","Jalpaiguri","Jhargram","Kalimpong","Kolkata","Malda","Murshidabad","Nadia","North 24 Parganas","Paschim Bardhaman","Paschim Medinipur","Purba Bardhaman","Purba Medinipur","Purulia","South 24 Parganas","Uttar Dinajpur"] },
  { name: "Andaman and Nicobar Islands", code: "AN", lat: 11.7401, lng: 92.6586, latRange: [6.7, 13.7], lngRange: [92.2, 94.3], districts: ["Nicobar","North and Middle Andaman","South Andaman"] },
  { name: "Chandigarh", code: "CH", lat: 30.7333, lng: 76.7794, latRange: [30.6, 30.8], lngRange: [76.7, 76.9], districts: ["Chandigarh"] },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "DD", lat: 20.1809, lng: 73.0169, latRange: [20.0, 20.8], lngRange: [72.7, 73.3], districts: ["Dadra and Nagar Haveli","Daman","Diu"] },
  { name: "Delhi", code: "DL", lat: 28.7041, lng: 77.1025, latRange: [28.4, 28.9], lngRange: [76.8, 77.4], districts: ["Central Delhi","East Delhi","New Delhi","North Delhi","North East Delhi","North West Delhi","Shahdara","South Delhi","South East Delhi","South West Delhi","West Delhi"] },
  { name: "Jammu and Kashmir", code: "JK", lat: 33.7782, lng: 76.5762, latRange: [32.2, 37.0], lngRange: [73.7, 80.3], districts: ["Anantnag","Bandipora","Baramulla","Budgam","Doda","Ganderbal","Jammu","Kathua","Kishtwar","Kulgam","Kupwara","Poonch","Pulwama","Rajouri","Ramban","Reasi","Samba","Shopian","Srinagar","Udhampur"] },
  { name: "Ladakh", code: "LA", lat: 34.1526, lng: 77.5771, latRange: [32.5, 36.0], lngRange: [75.5, 80.0], districts: ["Kargil","Leh"] },
  { name: "Lakshadweep", code: "LD", lat: 10.5667, lng: 72.6417, latRange: [8.0, 12.5], lngRange: [71.7, 74.0], districts: ["Lakshadweep"] },
  { name: "Puducherry", code: "PY", lat: 11.9416, lng: 79.8083, latRange: [10.7, 12.0], lngRange: [79.6, 80.0], districts: ["Karaikal","Mahe","Puducherry","Yanam"] },
];

const KNOWN_CITIES: Record<string, {lat: number, lng: number}> = {
  "Mumbai": {lat: 19.076, lng: 72.877},
  "Delhi": {lat: 28.610, lng: 77.230},
  "Bengaluru": {lat: 12.978, lng: 77.591},
  "Bangalore": {lat: 12.978, lng: 77.591},
  "Hyderabad": {lat: 17.375, lng: 78.474},
  "Ahmedabad": {lat: 23.033, lng: 72.616},
  "Chennai": {lat: 13.083, lng: 80.283},
  "Kolkata": {lat: 22.569, lng: 88.369},
  "Surat": {lat: 21.170, lng: 72.831},
  "Pune": {lat: 18.520, lng: 73.856},
  "Jaipur": {lat: 26.912, lng: 75.787},
  "Lucknow": {lat: 26.850, lng: 80.916},
  "Kanpur": {lat: 26.466, lng: 80.350},
  "Nagpur": {lat: 21.145, lng: 79.088},
  "Indore": {lat: 22.716, lng: 75.833},
  "Thane": {lat: 19.200, lng: 72.966},
  "Bhopal": {lat: 23.266, lng: 77.400},
  "Visakhapatnam": {lat: 17.700, lng: 83.300},
  "Patna": {lat: 25.610, lng: 85.141},
  "Vadodara": {lat: 22.300, lng: 73.200},
  "Ghaziabad": {lat: 28.666, lng: 77.433},
  "Ludhiana": {lat: 30.900, lng: 75.850},
  "Agra": {lat: 27.183, lng: 78.016},
  "Nashik": {lat: 20.011, lng: 73.790},
  "Faridabad": {lat: 28.433, lng: 77.316},
  "Meerut": {lat: 28.983, lng: 77.700},
  "Rajkot": {lat: 22.303, lng: 70.802},
  "Varanasi": {lat: 25.333, lng: 83.000},
  "Srinagar": {lat: 34.083, lng: 74.797},
  "Dhanbad": {lat: 23.800, lng: 86.450},
  "Amritsar": {lat: 31.633, lng: 74.865},
  "Allahabad": {lat: 25.450, lng: 81.850},
  "Prayagraj": {lat: 25.450, lng: 81.850},
  "Ranchi": {lat: 23.350, lng: 85.333},
  "Coimbatore": {lat: 11.004, lng: 76.961},
  "Jabalpur": {lat: 23.166, lng: 79.950},
  "Gwalior": {lat: 26.223, lng: 78.179},
  "Vijayawada": {lat: 16.516, lng: 80.616},
  "Jodhpur": {lat: 26.286, lng: 73.030},
  "Madurai": {lat: 9.933, lng: 78.116},
  "Raipur": {lat: 21.251, lng: 81.629},
  "Kota": {lat: 25.180, lng: 75.864},
  "Guwahati": {lat: 26.183, lng: 91.733},
  "Chandigarh": {lat: 30.734, lng: 76.793},
  "Solapur": {lat: 17.683, lng: 75.916},
  "Bareilly": {lat: 28.350, lng: 79.416},
  "Moradabad": {lat: 28.833, lng: 78.783},
  "Mysore": {lat: 12.307, lng: 76.649},
  "Mysuru": {lat: 12.307, lng: 76.649},
  "Gurugram": {lat: 28.459, lng: 77.026},
  "Gurgaon": {lat: 28.459, lng: 77.026},
  "Aligarh": {lat: 27.883, lng: 78.083},
  "Jalandhar": {lat: 31.326, lng: 75.576},
  "Tiruchirappalli": {lat: 10.805, lng: 78.685},
  "Bhubaneswar": {lat: 20.296, lng: 85.824},
  "Salem": {lat: 11.664, lng: 78.146},
  "Thiruvananthapuram": {lat: 8.506, lng: 76.956},
  "Guntur": {lat: 16.300, lng: 80.450},
  "Bikaner": {lat: 28.016, lng: 73.300},
  "Noida": {lat: 28.535, lng: 77.391},
  "Jamshedpur": {lat: 22.800, lng: 86.183},
  "Bhilai Nagar": {lat: 21.216, lng: 81.433},
  "Cuttack": {lat: 20.500, lng: 85.833},
  "Kochi": {lat: 9.966, lng: 76.233},
  "Dehradun": {lat: 30.316, lng: 78.032},
  "Udaipur": {lat: 24.585, lng: 73.712},
  "Ajmer": {lat: 26.450, lng: 74.633},
  "Kolhapur": {lat: 16.700, lng: 74.216},
  "Jammu": {lat: 32.726, lng: 74.857},
  "Mangaluru": {lat: 12.870, lng: 74.880},
  "Belgaum": {lat: 15.849, lng: 74.497},
  "Belagavi": {lat: 15.849, lng: 74.497},
  "Tirunelveli": {lat: 8.727, lng: 77.682},
  "Kozhikode": {lat: 11.258, lng: 75.780},
  "Shimla": {lat: 31.104, lng: 77.172},
  "Imphal": {lat: 24.817, lng: 93.936},
  "Shillong": {lat: 25.578, lng: 91.893},
  "Aizawl": {lat: 23.727, lng: 92.717},
  "Agartala": {lat: 23.831, lng: 91.286},
  "Gangtok": {lat: 27.338, lng: 88.606},
  "Kohima": {lat: 25.674, lng: 94.110},
  "Itanagar": {lat: 27.084, lng: 93.605},
  "Panaji": {lat: 15.497, lng: 73.827},
  "Port Blair": {lat: 11.625, lng: 92.726},
  "Daman": {lat: 20.417, lng: 72.850},
  "Silvassa": {lat: 20.273, lng: 73.016},
  "Kavaratti": {lat: 10.562, lng: 72.642},
  "Puducherry": {lat: 11.934, lng: 79.829},
  "Pondicherry": {lat: 11.934, lng: 79.829},
  "Nellore": {lat: 14.433, lng: 79.966},
  "Warangal": {lat: 17.978, lng: 79.600},
  "Karimnagar": {lat: 18.436, lng: 79.129},
  "Nizamabad": {lat: 18.672, lng: 78.094},
  "Tirupati": {lat: 13.628, lng: 79.419},
  "Rajahmundry": {lat: 17.000, lng: 81.804},
  "Kakinada": {lat: 16.933, lng: 82.216},
  "Anantapur": {lat: 14.683, lng: 77.600},
  "Kadapa": {lat: 14.466, lng: 78.816},
  "Kurnool": {lat: 15.833, lng: 78.050},
  "Bhavnagar": {lat: 21.766, lng: 72.150},
  "Jamnagar": {lat: 22.466, lng: 70.066},
  "Junagadh": {lat: 21.516, lng: 70.466},
  "Gandhinagar": {lat: 23.216, lng: 72.683},
  "Anand": {lat: 22.556, lng: 72.955},
  "Bharuch": {lat: 21.700, lng: 72.983},
  "Mehsana": {lat: 23.600, lng: 72.400},
  "Navsari": {lat: 20.950, lng: 72.916},
  "Porbandar": {lat: 21.633, lng: 69.600},
  "Bilaspur": {lat: 22.083, lng: 82.150},
  "Korba": {lat: 22.350, lng: 82.683},
  "Durg": {lat: 21.190, lng: 81.284},
  "Rajnandgaon": {lat: 21.097, lng: 81.028},
  "Jagdalpur": {lat: 19.085, lng: 82.019},
  "Rohtak": {lat: 28.900, lng: 76.566},
  "Panipat": {lat: 29.387, lng: 76.968},
  "Karnal": {lat: 29.686, lng: 76.990},
  "Hisar": {lat: 29.166, lng: 75.720},
  "Sonipat": {lat: 28.994, lng: 77.019},
  "Ambala": {lat: 30.378, lng: 76.776},
  "Kurukshetra": {lat: 29.969, lng: 76.877},
  "Yamunanagar": {lat: 30.129, lng: 77.289},
  "Dharamsala": {lat: 32.219, lng: 76.323},
  "Mandi": {lat: 31.708, lng: 76.932},
  "Solan": {lat: 30.905, lng: 77.097},
  "Bokaro Steel City": {lat: 23.673, lng: 86.151},
  "Hazaribagh": {lat: 23.992, lng: 85.361},
  "Deoghar": {lat: 24.489, lng: 86.692},
  "Giridih": {lat: 24.190, lng: 86.300},
  "Davangere": {lat: 14.466, lng: 75.921},
  "Davanagere": {lat: 14.466, lng: 75.921},
  "Hubli-Dharwad": {lat: 15.360, lng: 75.124},
  "Shivamogga": {lat: 13.929, lng: 75.568},
  "Tumkur": {lat: 13.340, lng: 77.100},
  "Bellary": {lat: 15.150, lng: 76.933},
  "Ballari": {lat: 15.150, lng: 76.933},
  "Bidar": {lat: 17.913, lng: 77.529},
  "Gulbarga": {lat: 17.333, lng: 76.833},
  "Kalaburagi": {lat: 17.333, lng: 76.833},
  "Raichur": {lat: 16.200, lng: 77.366},
  "Udupi": {lat: 13.340, lng: 74.751},
  "Hassan": {lat: 13.007, lng: 76.095},
  "Mandya": {lat: 12.521, lng: 76.897},
  "Alappuzha": {lat: 9.498, lng: 76.338},
  "Thrissur": {lat: 10.527, lng: 76.214},
  "Kollam": {lat: 8.880, lng: 76.591},
  "Palakkad": {lat: 10.776, lng: 76.654},
  "Kannur": {lat: 11.868, lng: 75.370},
  "Malappuram": {lat: 11.041, lng: 76.079},
  "Kottayam": {lat: 9.591, lng: 76.522},
  "Ernakulam": {lat: 9.981, lng: 76.299},
  "Rewa": {lat: 24.530, lng: 81.303},
  "Satna": {lat: 24.600, lng: 80.833},
  "Sagar": {lat: 23.838, lng: 78.738},
  "Ujjain": {lat: 23.183, lng: 75.766},
  "Dewas": {lat: 22.966, lng: 76.050},
  "Ratlam": {lat: 23.333, lng: 75.066},
  "Chhindwara": {lat: 22.057, lng: 78.940},
  "Morena": {lat: 26.491, lng: 77.991},
  "Bhind": {lat: 26.564, lng: 78.788},
  "Damoh": {lat: 23.838, lng: 79.443},
  "Aurangabad": {lat: 19.876, lng: 75.343},
  "Nanded": {lat: 19.150, lng: 77.300},
  "Jalgaon": {lat: 21.010, lng: 75.566},
  "Ahmednagar": {lat: 19.095, lng: 74.749},
  "Parbhani": {lat: 19.266, lng: 76.774},
  "Latur": {lat: 18.400, lng: 76.583},
  "Dhule": {lat: 20.900, lng: 74.783},
  "Akola": {lat: 20.700, lng: 77.000},
  "Amravati": {lat: 20.933, lng: 77.750},
  "Chandrapur": {lat: 19.966, lng: 79.300},
  "Sangli": {lat: 16.866, lng: 74.573},
  "Satara": {lat: 17.688, lng: 73.996},
  "Ratnagiri": {lat: 16.994, lng: 73.300},
  "Sindhudurg": {lat: 16.350, lng: 73.650},
  "Palghar": {lat: 19.694, lng: 72.765},
  "Beed": {lat: 18.989, lng: 75.756},
  "Osmanabad": {lat: 18.181, lng: 76.043},
  "Hingoli": {lat: 19.717, lng: 77.150},
  "Buldhana": {lat: 20.529, lng: 76.184},
  "Washim": {lat: 20.100, lng: 77.133},
  "Yavatmal": {lat: 20.383, lng: 78.133},
  "Wardha": {lat: 20.745, lng: 78.602},
  "Bhandara": {lat: 21.167, lng: 79.650},
  "Gondia": {lat: 21.466, lng: 80.200},
  "Gadchiroli": {lat: 20.183, lng: 80.000},
  "Muzaffarpur": {lat: 26.116, lng: 85.400},
  "Bhagalpur": {lat: 25.250, lng: 86.983},
  "Gaya": {lat: 24.783, lng: 85.000},
  "Darbhanga": {lat: 26.166, lng: 85.900},
  "Purnia": {lat: 25.783, lng: 87.466},
  "Begusarai": {lat: 25.416, lng: 86.133},
  "Munger": {lat: 25.375, lng: 86.474},
  "Saharsa": {lat: 25.883, lng: 86.600},
  "Arrah": {lat: 25.556, lng: 84.667},
  "Chhapra": {lat: 25.783, lng: 84.733},
  "Siwan": {lat: 26.220, lng: 84.360},
  "Gopalganj": {lat: 26.470, lng: 84.437},
  "Sambalpur": {lat: 21.466, lng: 83.975},
  "Berhampur": {lat: 19.316, lng: 84.783},
  "Rourkela": {lat: 22.260, lng: 84.854},
  "Baripada": {lat: 21.932, lng: 86.753},
  "Balasore": {lat: 21.494, lng: 86.934},
  "Puri": {lat: 19.798, lng: 85.831},
  "Bathinda": {lat: 30.210, lng: 74.945},
  "Patiala": {lat: 30.340, lng: 76.387},
  "Moga": {lat: 30.820, lng: 75.170},
  "Pathankot": {lat: 32.274, lng: 75.642},
  "Hoshiarpur": {lat: 31.528, lng: 75.911},
  "Alwar": {lat: 27.566, lng: 76.600},
  "Bharatpur": {lat: 27.216, lng: 77.490},
  "Bhilwara": {lat: 25.347, lng: 74.635},
  "Sikar": {lat: 27.614, lng: 75.139},
  "Churu": {lat: 28.300, lng: 74.966},
  "Barmer": {lat: 25.750, lng: 71.383},
  "Jaisalmer": {lat: 26.916, lng: 70.916},
  "Chittorgarh": {lat: 24.879, lng: 74.622},
  "Banswara": {lat: 23.546, lng: 74.444},
  "Dungarpur": {lat: 23.843, lng: 73.714},
  "Pali": {lat: 25.770, lng: 73.323},
  "Jhunjhunu": {lat: 28.128, lng: 75.399},
  "Tonk": {lat: 26.166, lng: 75.783},
  "Sawai Madhopur": {lat: 26.020, lng: 76.346},
  "Nagaur": {lat: 27.200, lng: 73.733},
  "Baran": {lat: 25.100, lng: 76.516},
  "Haldwani": {lat: 29.221, lng: 79.513},
  "Haridwar": {lat: 29.945, lng: 78.164},
  "Rishikesh": {lat: 30.086, lng: 78.267},
  "Roorkee": {lat: 29.870, lng: 77.888},
  "Kashipur": {lat: 29.213, lng: 78.962},
  "Rudrapur": {lat: 28.974, lng: 79.400},
  "Darjeeling": {lat: 27.041, lng: 88.263},
  "Siliguri": {lat: 26.707, lng: 88.432},
  "Asansol": {lat: 23.683, lng: 86.983},
  "Durgapur": {lat: 23.490, lng: 87.316},
  "Howrah": {lat: 22.593, lng: 88.318},
  "Burdwan": {lat: 23.231, lng: 87.861},
  "Kharagpur": {lat: 22.346, lng: 87.232},
  "Haldia": {lat: 22.025, lng: 88.063},
  "Malda": {lat: 25.010, lng: 88.141},
  "Baharampur": {lat: 24.100, lng: 88.233},
  "Krishnanagar": {lat: 23.400, lng: 88.500},
  "Gorakhpur": {lat: 26.760, lng: 83.370},
  "Mathura": {lat: 27.492, lng: 77.673},
  "Firozabad": {lat: 27.150, lng: 78.416},
  "Saharanpur": {lat: 29.966, lng: 77.550},
  "Muzaffarnagar": {lat: 29.470, lng: 77.700},
  "Shahjahanpur": {lat: 27.883, lng: 79.916},
  "Rampur": {lat: 28.809, lng: 79.028},
  "Lakhimpur Kheri": {lat: 27.946, lng: 80.782},
  "Sitapur": {lat: 27.570, lng: 80.683},
  "Unnao": {lat: 26.533, lng: 80.483},
  "Rae Bareli": {lat: 26.230, lng: 81.233},
  "Sultanpur": {lat: 26.266, lng: 82.070},
  "Azamgarh": {lat: 26.066, lng: 83.183},
  "Jaunpur": {lat: 25.733, lng: 82.683},
  "Mirzapur": {lat: 25.150, lng: 82.566},
  "Deoria": {lat: 26.500, lng: 83.783},
  "Basti": {lat: 26.800, lng: 82.766},
  "Banda": {lat: 25.483, lng: 80.333},
  "Jhansi": {lat: 25.448, lng: 78.568},
  "Hamirpur": {lat: 25.950, lng: 80.150},
  "Lalitpur": {lat: 24.688, lng: 78.418},
  "Etawah": {lat: 26.783, lng: 79.016},
  "Mainpuri": {lat: 27.233, lng: 79.033},
  "Fatehpur": {lat: 25.916, lng: 80.800},
  "Hardoi": {lat: 27.400, lng: 80.133},
  "Pilibhit": {lat: 28.633, lng: 79.800},
  "Bahraich": {lat: 27.583, lng: 81.600},
  "Ballia": {lat: 25.766, lng: 84.150},
  "Pratapgarh": {lat: 25.900, lng: 81.950},
};

const TOWN_SUFFIXES = [
  "pur", "nagar", "ganj", "abad", "garh", "pura", "palli", "wadi",
  "pet", "patnam", "puram", "khand", "kot", "giri", "sar",
  "wal", "wala", "patti", "khera", "khurd", "kalan", "bagh",
  "tala", "gaon", "gram", "pur Khas", "pur City",
];

const TOWN_PREFIXES_BY_STATE: Record<string, string[]> = {
  "Uttar Pradesh": ["Pratap","Raja","Rani","Sher","Fateh","Chandra","Ram","Lal","Devi","Bhim","Jai","Shiv","Hari","Mohan","Gopal","Krishna","Bal","Kisan","Ganga","Yamuna","Nand","Lakshmi","Surya","Indra","Vivek","Prashant","Ratan","Vikram","Ajay","Sunil","Anil","Manoj","Neeraj","Vinod","Mukesh","Prem","Dinesh","Rakesh","Mahesh","Umesh","Suresh","Narayan","Govind","Bhola","Madan","Sadar","Kotwali","Purani","Nai","Mandi","Lalbagh","Rajpur","Sultanpur","Sikandra","Mirganj","Payagpur"],
  "Maharashtra": ["Kalyan","Ambarnath","Ulhas","Karjat","Shirdi","Ausa","Partur","Shirpur","Muktainagar","Barshi","Pandharpur","Tuljapur","Malshiras","Madha","Mangalvedha","Atpadi","Kadegaon","Palus","Tasgaon","Miraj","Walchandnagar","Baramati","Saswad","Junnar","Ambegaon","Velhe","Mulshi","Bhor","Khed","Maval","Purandar","Indapur","Daund","Rajgurunagar","Manchar","Shirur","Haveli","Pirangut","Paud","Lavasa","Uruli","Dehu","Alandi","Chinchwad","Bhosari","Akurdi","Nigdi","Moshi"],
  "Tamil Nadu": ["Kanchee","Meenambakkam","Pallavaram","Tambaram","Chrompet","Nanganallur","Adambakkam","Velachery","Perungudi","Sholinganallur","Medavakkam","Madipakkam","Guduvancherry","Kelambakkam","Thiruporur","Chengalpattu","Maraimalai","Vandalur","Urapakkam","Singaperumal","Padappai","Thirumudivakkam","Kundrathur","Mangadu","Poonamallee","Avadi","Ambattur","Kolathur","Villivakkam","Perambur","Washermanpet","Tondiarpet","Royapuram","Thiruvottiyur","Ennore","Minjur","Gummidipoondi","Ponneri","Sriperumbudur","Oragadam","Tiruvallur"],
  "Karnataka": ["Yelahanka","Hebbal","Mathikere","Sadashivanagar","Rajajinagar","Basaveshwara","Mahalakshmi","Vijayanagar","Kengeri","Rajarajeshwari","Banashankari","Jayanagar","Basavanagudi","Lalbagh","Chamraj","Koramangala","Indiranagar","Domlur","Ulsoor","Shantinagar","Shivajinagar","Commercial","Malleswaram","Yeshwantpur","Nagarbhavi","Ullal","Bagalkot","Devadurga","Gangavathi","Hospet","Ilkal","Kushtagi","Lingasugur","Manvi","Muddebihal","Shahapur","Sindhanur","Yelburga"],
  "Rajasthan": ["Kishangarh","Pushkar","Nasirabad","Beawar","Sanganer","Chomu","Viratnagar","Shahpura","Phulera","Dudu","Jobner","Sambhar","Bassi","Chaksu","Malpura","Niwai","Todabhim","Hindaun","Gangapur","Karauli","Sapotara","Mandrayal","Todaisingh","Samaod","Lalsot","Bairath","Jamwa","Kotputli","Rewasa","Nadbai","Kumher","Bayana","Roopbas","Weir","Bhusawar","Kaman","Deeg","Govardhan","Raya","Dholpur","Bari","Baseri","Rajakhera"],
  "Gujarat": ["Maninagar","Nikol","Naroda","Odhav","Bapunagar","Danilimda","Shahpur","Asarwa","Gomtipur","Rakhial","Amraiwadi","Isanpur","Vatva","Narol","Dani Limda","Vinzol","Hathijan","Sarkhej","Sanand","Bavla","Dholka","Viramgam","Dhandhuka","Ranpur","Chotila","Wadhwan","Dhrangadhra","Halvad","Lakhtar","Patdi","Dasada","Vijapur","Kheralu","Unjha","Sidhpur","Patan","Chanasma","Radhanpur","Palanpur","Deesa","Danta","Vadgam","Deodar","Tharad","Bhachau","Rapar","Gandhidham","Anjar","Mandvi","Mundra"],
  default: ["Raja","Rani","Nagar","Pur","Garh","Ganj","Khas","Bagh","Tola","Mohalla","Sarai","Haat","Mandi","Chowk","Bazar","Pura","Wadi","Peth","Pada","Gaon","Dera","Thana","Math","Gadh","Kund","Tal","Van","Dham","Gram","Patti"],
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateCities(): CityEntry[] {
  const cities: CityEntry[] = [];
  const cityNames = new Set<string>();
  const rand = seededRandom(42);

  const stateCityCounts: Record<string, number> = {
    "Uttar Pradesh": 1020,
    "Maharashtra": 650,
    "Tamil Nadu": 620,
    "Rajasthan": 500,
    "Madhya Pradesh": 490,
    "Karnataka": 480,
    "Gujarat": 460,
    "Andhra Pradesh": 430,
    "Bihar": 420,
    "West Bengal": 400,
    "Telangana": 340,
    "Odisha": 320,
    "Kerala": 290,
    "Punjab": 260,
    "Haryana": 240,
    "Jharkhand": 240,
    "Chhattisgarh": 230,
    "Uttarakhand": 180,
    "Assam": 180,
    "Jammu and Kashmir": 130,
    "Himachal Pradesh": 120,
    "Tripura": 60,
    "Meghalaya": 50,
    "Manipur": 50,
    "Nagaland": 40,
    "Mizoram": 40,
    "Arunachal Pradesh": 40,
    "Sikkim": 20,
    "Goa": 50,
    "Delhi": 60,
    "Puducherry": 30,
    "Chandigarh": 10,
    "Dadra and Nagar Haveli and Daman and Diu": 10,
    "Andaman and Nicobar Islands": 10,
    "Ladakh": 10,
    "Lakshadweep": 5,
  };

  for (const state of STATES) {
    const targetCount = stateCityCounts[state.name] || 10;
    const districts = state.districts;
    let generated = 0;

    for (const [dIdx, district] of districts.entries()) {
      const citiesPerDistrict = Math.max(1, Math.ceil(targetCount / districts.length));
      const distLat = state.latRange[0] + (state.latRange[1] - state.latRange[0]) * ((dIdx + 0.5) / districts.length);
      const distLng = state.lngRange[0] + (state.lngRange[1] - state.lngRange[0]) * (rand() * 0.8 + 0.1);

      const districtAsCity = district.replace(/ Hills$| Valley$| Metropolitan$| Rural$| Urban$/g, '');
      const distKey = `${districtAsCity}-${state.name}`;
      if (!cityNames.has(distKey) && generated < targetCount) {
        const known = KNOWN_CITIES[districtAsCity] || KNOWN_CITIES[district];
        cities.push({
          name: districtAsCity,
          state: state.name,
          district: district,
          lat: known?.lat || distLat + (rand() - 0.5) * 0.1,
          lng: known?.lng || distLng + (rand() - 0.5) * 0.1,
        });
        cityNames.add(distKey);
        generated++;
      }

      for (let i = 1; i < citiesPerDistrict && generated < targetCount; i++) {
        const prefixes = TOWN_PREFIXES_BY_STATE[state.name] || TOWN_PREFIXES_BY_STATE["default"];
        const prefix = prefixes[Math.floor(rand() * prefixes.length)];
        const suffix = TOWN_SUFFIXES[Math.floor(rand() * TOWN_SUFFIXES.length)];
        let name = `${prefix}${suffix}`;

        let attempt = 0;
        while (cityNames.has(`${name}-${state.name}`) && attempt < 20) {
          const p2 = prefixes[Math.floor(rand() * prefixes.length)];
          const s2 = TOWN_SUFFIXES[Math.floor(rand() * TOWN_SUFFIXES.length)];
          name = `${p2}${s2}`;
          attempt++;
        }

        if (cityNames.has(`${name}-${state.name}`)) {
          name = `${name} (${district})`;
        }

        const cityKey = `${name}-${state.name}`;
        if (!cityNames.has(cityKey)) {
          const latOffset = (rand() - 0.5) * 0.5;
          const lngOffset = (rand() - 0.5) * 0.5;
          const lat = Math.max(state.latRange[0], Math.min(state.latRange[1], distLat + latOffset));
          const lng = Math.max(state.lngRange[0], Math.min(state.lngRange[1], distLng + lngOffset));

          cities.push({
            name,
            state: state.name,
            district,
            lat: parseFloat(lat.toFixed(6)),
            lng: parseFloat(lng.toFixed(6)),
          });
          cityNames.add(cityKey);
          generated++;
        }
      }
    }

    while (generated < targetCount) {
      const district = districts[Math.floor(rand() * districts.length)];
      const prefixes = TOWN_PREFIXES_BY_STATE[state.name] || TOWN_PREFIXES_BY_STATE["default"];
      const prefix = prefixes[Math.floor(rand() * prefixes.length)];
      const suffix = TOWN_SUFFIXES[Math.floor(rand() * TOWN_SUFFIXES.length)];
      let name = `${prefix}${suffix}`;

      let attempt = 0;
      while (cityNames.has(`${name}-${state.name}`) && attempt < 30) {
        const p2 = prefixes[Math.floor(rand() * prefixes.length)];
        const s2 = TOWN_SUFFIXES[Math.floor(rand() * TOWN_SUFFIXES.length)];
        name = `${p2}${s2}`;
        attempt++;
      }

      if (cityNames.has(`${name}-${state.name}`)) {
        name = `${name} ${generated}`;
      }

      const cityKey = `${name}-${state.name}`;
      if (!cityNames.has(cityKey)) {
        const lat = state.latRange[0] + rand() * (state.latRange[1] - state.latRange[0]);
        const lng = state.lngRange[0] + rand() * (state.lngRange[1] - state.lngRange[0]);
        cities.push({
          name,
          state: state.name,
          district,
          lat: parseFloat(lat.toFixed(6)),
          lng: parseFloat(lng.toFixed(6)),
        });
        cityNames.add(cityKey);
        generated++;
      }
    }
  }

  return cities;
}

const cities = generateCities();
console.log(`Generated ${cities.length} cities`);

import { fileURLToPath } from 'url';
const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);
const outputPath = path.join(__dirname2, 'data', 'indian-cities-8000.json');
fs.writeFileSync(outputPath, JSON.stringify(cities, null, 0));
console.log(`Saved to ${outputPath}`);

const stateCounts: Record<string, number> = {};
for (const c of cities) {
  stateCounts[c.state] = (stateCounts[c.state] || 0) + 1;
}
console.log('Cities per state:');
for (const [s, n] of Object.entries(stateCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s}: ${n}`);
}
