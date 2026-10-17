import type {VehicleType} from '../services/vehicleService';

/**
 * Makes and models the Add / Edit sheet offers, per vehicle type. Weighted to what is sold in
 * India, plus the common global makes. A make or model is picked from this list, never typed.
 */
const CARS: Record<string, string[]> = {
  'Alfa Romeo': ['Giulia', 'Stelvio', 'Tonale'],
  'Aston Martin': ['DB11', 'DB12', 'DBX', 'Vantage'],
  Audi: ['A3', 'A4', 'A6', 'A8', 'e-tron', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'RS5', 'TT'],
  Bentley: ['Bentayga', 'Continental GT', 'Flying Spur'],
  BMW: ['1 Series', '2 Series', '3 Series', '5 Series', '7 Series', 'i4', 'i7', 'iX', 'iX1', 'M3', 'M5', 'X1', 'X3', 'X5', 'X7', 'Z4'],
  BYD: ['Atto 3', 'Dolphin', 'e6', 'Seal', 'Sealion 7'],
  Chevrolet: ['Beat', 'Camaro', 'Corvette', 'Cruze', 'Enjoy', 'Malibu', 'Sail', 'Spark', 'Tahoe', 'Tavera', 'Trailblazer'],
  Citroën: ['Basalt', 'C3', 'C3 Aircross', 'C4', 'C5 Aircross', 'ë-C3'],
  Dacia: ['Duster', 'Jogger', 'Sandero', 'Spring'],
  Datsun: ['GO', 'GO+', 'redi-GO'],
  Ferrari: ['296 GTB', 'F8 Tributo', 'Purosangue', 'Roma', 'SF90'],
  Fiat: ['500', 'Linea', 'Panda', 'Punto', 'Tipo'],
  Force: ['Gurkha', 'Trax', 'Urbania'],
  Ford: ['EcoSport', 'Endeavour', 'Fiesta', 'Figo', 'Focus', 'Freestyle', 'Ikon', 'Kuga', 'Mustang', 'Ranger'],
  Honda: ['Accord', 'Amaze', 'Brio', 'City', 'Civic', 'CR-V', 'Elevate', 'HR-V', 'Jazz', 'WR-V'],
  Hyundai: ['Alcazar', 'Aura', 'Creta', 'Elantra', 'Eon', 'Exter', 'i10', 'i20', 'Ioniq 5', 'Kona', 'Santro', 'Tucson', 'Venue', 'Verna', 'Xcent'],
  Isuzu: ['D-Max', 'MU-X', 'V-Cross'],
  Jaguar: ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'XE', 'XF'],
  Jeep: ['Compass', 'Grand Cherokee', 'Meridian', 'Wrangler'],
  Kia: ['Carens', 'Carnival', 'EV6', 'EV9', 'Seltos', 'Sonet', 'Syros'],
  Lamborghini: ['Huracán', 'Revuelto', 'Urus'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  Lexus: ['ES', 'LM', 'LX', 'NX', 'RX'],
  Mahindra: ['Bolero', 'Bolero Neo', 'BE 6', 'KUV100', 'Marazzo', 'Scorpio', 'Scorpio N', 'Thar', 'Thar Roxx', 'XEV 9e', 'XUV 3XO', 'XUV300', 'XUV400', 'XUV500', 'XUV700'],
  'Maruti Suzuki': ['Alto', 'Alto K10', 'Baleno', 'Brezza', 'Celerio', 'Ciaz', 'Dzire', 'Eeco', 'Ertiga', 'Fronx', 'Grand Vitara', 'Ignis', 'Invicto', 'Jimny', 'S-Presso', 'Swift', 'Wagon R', 'XL6'],
  Maserati: ['Ghibli', 'Grecale', 'Levante', 'MC20'],
  Mazda: ['CX-3', 'CX-5', 'CX-30', 'Mazda3', 'MX-5'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'CLA', 'E-Class', 'EQA', 'EQB', 'EQE', 'EQS', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'S-Class'],
  MG: ['Astor', 'Comet EV', 'Gloster', 'Hector', 'Hector Plus', 'Windsor EV', 'ZS EV'],
  Mini: ['Cooper', 'Cooper S', 'Countryman'],
  Mitsubishi: ['Outlander', 'Pajero', 'Pajero Sport'],
  Nissan: ['Kicks', 'Magnite', 'Micra', 'Sunny', 'Terrano', 'X-Trail'],
  Opel: ['Astra', 'Corsa', 'Mokka'],
  Peugeot: ['208', '2008', '308', '3008', '5008'],
  Porsche: ['911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
  Renault: ['Captur', 'Duster', 'Kiger', 'Kwid', 'Lodgy', 'Pulse', 'Scala', 'Triber'],
  'Rolls-Royce': ['Cullinan', 'Ghost', 'Phantom', 'Spectre'],
  Seat: ['Arona', 'Ateca', 'Ibiza', 'Leon'],
  Skoda: ['Citigo', 'Fabia', 'Kodiaq', 'Kushaq', 'Kylaq', 'Laura', 'Octavia', 'Rapid', 'Slavia', 'Superb', 'Yeti'],
  Subaru: ['Forester', 'Impreza', 'Outback', 'XV'],
  Suzuki: ['Celerio', 'Ignis', 'Jimny', 'S-Cross', 'Swift', 'Vitara'],
  Tata: ['Altroz', 'Curvv', 'Harrier', 'Hexa', 'Indica', 'Indigo', 'Nano', 'Nexon', 'Nexon EV', 'Punch', 'Punch EV', 'Safari', 'Sumo', 'Tiago', 'Tiago EV', 'Tigor', 'Zest'],
  Tesla: ['Model 3', 'Model S', 'Model X', 'Model Y'],
  Toyota: ['Camry', 'Corolla', 'Corolla Altis', 'Etios', 'Fortuner', 'Glanza', 'Hilux', 'Innova', 'Innova Crysta', 'Innova Hycross', 'Land Cruiser', 'Prius', 'RAV4', 'Rumion', 'Urban Cruiser Hyryder', 'Vellfire', 'Yaris'],
  Volkswagen: ['Ameo', 'Golf', 'Jetta', 'Passat', 'Polo', 'Taigun', 'Tiguan', 'T-Roc', 'Vento', 'Virtus'],
  Volvo: ['C40 Recharge', 'EX30', 'S60', 'S90', 'XC40', 'XC60', 'XC90'],
};

const MOTORBIKES: Record<string, string[]> = {
  Aprilia: ['RS 457', 'RS 660', 'SR 125', 'SR 160', 'Tuono 660'],
  Ather: ['450S', '450X', 'Rizta'],
  Bajaj: ['Avenger', 'Chetak', 'CT 110', 'Dominar 250', 'Dominar 400', 'Freedom 125', 'Platina', 'Pulsar 125', 'Pulsar 150', 'Pulsar N160', 'Pulsar NS200', 'Pulsar RS200'],
  Benelli: ['502C', 'Imperiale 400', 'Leoncino 500', 'TRK 502'],
  BMW: ['G 310 GS', 'G 310 R', 'R 1250 GS', 'S 1000 RR'],
  Ducati: ['Monster', 'Multistrada V4', 'Panigale V4', 'Scrambler', 'Streetfighter V4'],
  'Harley-Davidson': ['Fat Boy', 'Iron 883', 'Nightster', 'Sportster S', 'Street Glide', 'X440'],
  Hero: ['Destini 125', 'Glamour', 'HF Deluxe', 'Karizma XMR', 'Maestro', 'Mavrick 440', 'Passion', 'Pleasure+', 'Splendor Plus', 'Super Splendor', 'Xoom', 'Xpulse 200', 'Xtreme 160R'],
  Honda: ['Activa', 'Activa 125', 'CB Shine', 'CB300R', 'CB350', 'CBR650R', 'Dio', 'Hness CB350', 'Hornet 2.0', 'SP 125', 'Unicorn'],
  Husqvarna: ['Svartpilen 250', 'Svartpilen 401', 'Vitpilen 250'],
  Jawa: ['42', '350', 'Perak'],
  Kawasaki: ['Ninja 300', 'Ninja 400', 'Ninja 650', 'Ninja ZX-10R', 'Versys 650', 'Vulcan S', 'Z650', 'Z900'],
  KTM: ['125 Duke', '200 Duke', '250 Adventure', '250 Duke', '390 Adventure', '390 Duke', 'RC 200', 'RC 390'],
  Ola: ['Roadster', 'S1 Air', 'S1 Pro', 'S1 X'],
  'Royal Enfield': ['Bullet 350', 'Classic 350', 'Continental GT 650', 'Guerrilla 450', 'Himalayan', 'Himalayan 450', 'Hunter 350', 'Interceptor 650', 'Meteor 350', 'Scram 411', 'Shotgun 650', 'Super Meteor 650'],
  Suzuki: ['Access 125', 'Avenis', 'Burgman Street', 'Gixxer', 'Gixxer SF', 'Hayabusa', 'V-Strom SX'],
  SWM: ['Superdual 650', 'Varez 125'],
  Triumph: ['Bonneville T100', 'Scrambler 400 X', 'Speed 400', 'Street Triple', 'Tiger 900', 'Trident 660'],
  TVS: ['Apache RR 310', 'Apache RTR 160', 'Apache RTR 200', 'iQube', 'Jupiter', 'Ntorq 125', 'Radeon', 'Raider 125', 'Ronin', 'Sport', 'XL100'],
  Yamaha: ['Aerox 155', 'Fascino 125', 'FZ', 'FZ-S', 'MT-15', 'R15', 'R3', 'Ray ZR', 'XSR 155'],
  Yezdi: ['Adventure', 'Roadster', 'Scrambler'],
};

const CATALOG: Record<VehicleType, Record<string, string[]>> = {car: CARS, motorbike: MOTORBIKES};

const sortedKeys = (record: Record<string, string[]>) => Object.keys(record).sort((a, b) => a.localeCompare(b));

export const makesFor = (type: VehicleType): string[] => sortedKeys(CATALOG[type]);

export const modelsFor = (type: VehicleType, make: string): string[] => [...(CATALOG[type][make] ?? [])].sort((a, b) => a.localeCompare(b));

/** Names that start with the query first, then ones with a word starting with it; case-insensitive. */
export const matchOptions = (options: string[], query: string, limit = 8): string[] => {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }
  const starts = options.filter((o) => o.toLowerCase().startsWith(q));
  const words = options.filter((o) => !starts.includes(o) && o.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(q)));
  return [...starts, ...words].slice(0, limit);
};
