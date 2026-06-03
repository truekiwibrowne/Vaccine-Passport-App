#!/usr/bin/env node
/**
 * Seed script — adds sample vaccine library entries to Firestore.
 * Uses the service account key for authentication.
 * Run: node scripts/seed-vaccine-library.cjs
 */

const https  = require('https')
const fs     = require('fs')
const crypto = require('crypto')
const path   = require('path')

// ── Config ────────────────────────────────────────────────────────────────────
const PROJECT_ID     = 'vaccine-passport-973a7'
const SA_KEY_PATH    = path.join(__dirname, '../../serviceAccountKey.json')
const COLLECTION     = 'Vaccine_Library'
const FIRESTORE_HOST = 'firestore.googleapis.com'

// ── Load service account ──────────────────────────────────────────────────────
const sa = JSON.parse(fs.readFileSync(SA_KEY_PATH, 'utf8'))

// ── JWT helpers ───────────────────────────────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header  = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss:   sa.client_email,
    sub:   sa.client_email,
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  }

  const sigInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(sigInput)
  const sig = b64url(sign.sign(sa.private_key))
  const jwt = `${sigInput}.${sig}`

  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }).toString()

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path:     '/token',
      method:   'POST',
      headers:  { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        const j = JSON.parse(data)
        if (j.access_token) resolve(j.access_token)
        else reject(new Error(JSON.stringify(j)))
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Firestore REST helpers ────────────────────────────────────────────────────
function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean')        return { booleanValue: v }
  if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string')         return { stringValue: v }
  if (Array.isArray(v))              return { arrayValue: { values: v.map(toFsValue) } }
  if (typeof v === 'object')         return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, toFsValue(val)])) } }
  return { stringValue: String(v) }
}

function toFsDoc(obj) {
  return { fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFsValue(v)])) }
}

function addDoc(token, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(toFsDoc(data))
    const req = https.request({
      hostname: FIRESTORE_HOST,
      path:     `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization':  `Bearer ${token}`,
      },
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        const j = JSON.parse(d)
        if (res.statusCode === 200) resolve(j)
        else reject(new Error(j.error?.message ?? d))
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Vaccine data ──────────────────────────────────────────────────────────────
const vaccines = [

  // ══════════════════ PET VACCINES (category: animal) ══════════════════
  {
    Vac_Name:              'Rabies Vaccine (Canine/Feline)',
    'Disease Target':      'Rabies',
    'Brand Name':          'Nobivac Rabies / IMRAB 3',
    Manufacturer:          'MSD Animal Health / Boehringer Ingelheim',
    'Type/Technology':     'Inactivated',
    Administration:        'SC or IM injection',
    'Dosing Schedule':     'Primary dose at 12 weeks, booster at 1 year, then every 1–3 years',
    'Age Group':           '12 weeks and older',
    'Target Population':   'Dogs and cats',
    'Efficacy Rate':       '>99%',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'Core vaccine protecting dogs and cats against fatal rabies virus infection.',
    'Long Description':    'Rabies is a zoonotic viral disease that is nearly always fatal once clinical signs appear. Vaccination is mandatory in many jurisdictions and is considered a core vaccine for both dogs and cats. Annual or triennial boosters are required depending on local regulations and product label.',
    'Special Notes':       'Legally required in many countries. Proof of vaccination essential for international travel with pets.',
    'Geographic Priority': 'Global',
    'Disease Prevalence':  'Africa, Asia, Latin America, parts of Europe',
    status:                'available',
    category:              'animal',
    animalTypes:           'dog, cat',
  },
  {
    Vac_Name:              'DA2PP (Distemper, Adenovirus, Parvovirus, Parainfluenza) — Canine',
    'Disease Target':      'Canine Distemper, Adenovirus Type 2, Parvovirus, Parainfluenza',
    'Brand Name':          'Nobivac DHPPi / Vanguard Plus 5',
    Manufacturer:          'MSD Animal Health / Zoetis',
    'Type/Technology':     'Modified live virus (MLV) combination',
    Administration:        'SC injection',
    'Dosing Schedule':     'Puppy series: 6–8, 10–12, 14–16 weeks; booster at 1 year, then every 3 years',
    'Age Group':           '6 weeks and older',
    'Target Population':   'Dogs (puppies and adults)',
    'Efficacy Rate':       '>95% against parvovirus and distemper',
    'Storage Requirements':'2–8 °C',
    'Short Description':   'Core combination vaccine protecting dogs against four serious viral diseases.',
    'Long Description':    'The DA2PP combination (also called DHPP or DAPP) is considered the core canine vaccine. Distemper and parvovirus are highly contagious and frequently fatal in unvaccinated puppies. The puppy series is critical because maternal antibodies can interfere with earlier doses.',
    'Special Notes':       'Core vaccine — recommended for all dogs regardless of lifestyle.',
    'Geographic Priority': 'Global',
    'Disease Prevalence':  'Worldwide',
    status:                'available',
    category:              'animal',
    animalTypes:           'dog',
  },
  {
    Vac_Name:              'Feline FVRCP (Herpesvirus, Calicivirus, Panleukopenia)',
    'Disease Target':      'Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia',
    'Brand Name':          'Nobivac Tricat / Purevax RCPCh',
    Manufacturer:          'MSD Animal Health / Boehringer Ingelheim',
    'Type/Technology':     'Modified live virus (MLV) combination',
    Administration:        'SC injection',
    'Dosing Schedule':     'Kitten series: 8, 12, 16 weeks; booster at 1 year, then every 3 years',
    'Age Group':           '8 weeks and older',
    'Target Population':   'Cats (kittens and adults)',
    'Efficacy Rate':       '>95%',
    'Storage Requirements':'2–8 °C',
    'Short Description':   'Core feline vaccine protecting against three common upper respiratory and systemic diseases.',
    'Long Description':    'FVRCP is the cornerstone of feline vaccination. Panleukopenia (feline parvovirus) can cause severe gastrointestinal disease and death, particularly in kittens. Herpesvirus and calicivirus are the leading causes of upper respiratory disease in cats.',
    'Special Notes':       'Core vaccine for all cats. Indoor-only cats still require FVRCP.',
    'Geographic Priority': 'Global',
    'Disease Prevalence':  'Worldwide',
    status:                'available',
    category:              'animal',
    animalTypes:           'cat',
  },
  {
    Vac_Name:              'Feline Leukaemia Virus (FeLV) Vaccine',
    'Disease Target':      'Feline Leukaemia Virus',
    'Brand Name':          'Leucogen / Purevax FeLV',
    Manufacturer:          'Virbac / Boehringer Ingelheim',
    'Type/Technology':     'Recombinant subunit / canarypox-vectored',
    Administration:        'SC injection',
    'Dosing Schedule':     'Two doses 3–4 weeks apart from 8 weeks of age; annual booster',
    'Age Group':           '8 weeks and older',
    'Target Population':   'Cats with outdoor access or multi-cat households',
    'Efficacy Rate':       '~90%',
    'Storage Requirements':'2–8 °C',
    'Short Description':   'Non-core feline vaccine strongly recommended for cats with outdoor exposure.',
    'Long Description':    'FeLV is a retrovirus causing immunosuppression, anaemia, and lymphoma in cats. Transmission occurs through close contact (mutual grooming, shared food bowls). Vaccination is highly recommended for cats that go outdoors or live with FeLV-positive cats.',
    'Special Notes':       'Test cats for existing FeLV infection before vaccination.',
    'Geographic Priority': 'Europe, North America, Australia',
    'Disease Prevalence':  'Worldwide — higher prevalence in feral/outdoor populations',
    status:                'available',
    category:              'animal',
    animalTypes:           'cat',
  },
  {
    Vac_Name:              'Bordetella (Kennel Cough) Vaccine',
    'Disease Target':      'Bordetella bronchiseptica, Parainfluenza',
    'Brand Name':          'Nobivac KC / Bronchicine CAe',
    Manufacturer:          'MSD Animal Health / Zoetis',
    'Type/Technology':     'Modified live bacterial / intranasal',
    Administration:        'Intranasal or oral drops',
    'Dosing Schedule':     'Single dose; booster every 12 months or before boarding/kennelling',
    'Age Group':           '3 weeks and older',
    'Target Population':   'Dogs in kennels, shows, dog parks, or daycare',
    'Efficacy Rate':       '>85% against clinical disease',
    'Storage Requirements':'2–8 °C',
    'Short Description':   'Non-core vaccine for dogs at risk of kennel cough through social contact.',
    'Long Description':    'Kennel cough (infectious tracheobronchitis) is a highly contagious respiratory disease complex. Bordetella bronchiseptica is the most common bacterial cause. Intranasal administration provides rapid local mucosal immunity and is preferred over injectable formulations for quick protection before kennelling.',
    'Special Notes':       'Required by most boarding kennels. Administer at least 3–5 days before kennelling.',
    'Geographic Priority': 'Global',
    'Disease Prevalence':  'Worldwide',
    status:                'available',
    category:              'animal',
    animalTypes:           'dog',
  },
  {
    Vac_Name:              'Leptospirosis Vaccine (Canine)',
    'Disease Target':      'Leptospira spp. (4-serovar)',
    'Brand Name':          'Nobivac L4 / Vanguard L4',
    Manufacturer:          'MSD Animal Health / Zoetis',
    'Type/Technology':     'Inactivated bacterin',
    Administration:        'SC injection',
    'Dosing Schedule':     'Two doses 4 weeks apart; annual booster required',
    'Age Group':           '8 weeks and older',
    'Target Population':   'Dogs with outdoor access, especially near water/wildlife',
    'Efficacy Rate':       '>90% against covered serovars',
    'Storage Requirements':'2–8 °C',
    'Short Description':   'Zoonotic risk vaccine protecting dogs and their owners from leptospirosis.',
    'Long Description':    'Leptospirosis is a bacterial zoonosis transmitted through urine of infected wildlife and contaminated water. It can cause acute kidney and liver failure in dogs and is transmissible to humans. The 4-serovar vaccine (L4) offers broader protection than older bivalent products.',
    'Special Notes':       'Annual booster is mandatory — immunity wanes within 12 months. Public health significance as zoonosis.',
    'Geographic Priority': 'Europe, Americas, Asia',
    'Disease Prevalence':  'Worldwide — highest in tropical and subtropical regions',
    status:                'available',
    category:              'animal',
    animalTypes:           'dog',
  },
  {
    Vac_Name:              'Rabbit Viral Haemorrhagic Disease (RHD1 & RHD2)',
    'Disease Target':      'Rabbit Haemorrhagic Disease Virus 1 and 2',
    'Brand Name':          'Filavac VHD K C+V / Nobivac Myxo-RHD Plus',
    Manufacturer:          'Filavac / MSD Animal Health',
    'Type/Technology':     'Inactivated / Recombinant canarypox-vectored',
    Administration:        'SC injection',
    'Dosing Schedule':     'From 5 weeks of age; annual booster',
    'Age Group':           '5 weeks and older',
    'Target Population':   'Pet and commercial rabbits',
    'Efficacy Rate':       '>95%',
    'Storage Requirements':'2–8 °C',
    'Short Description':   'Essential vaccine protecting rabbits against two strains of the fatal haemorrhagic disease virus.',
    'Long Description':    'RHD is a highly contagious calicivirus causing acute haemorrhagic disease in rabbits with near-100% mortality in unvaccinated animals. RHD2 (a new variant) emerged in Europe and has now spread globally. Combined vaccination against both strains is strongly recommended.',
    'Special Notes':       'RHD2 (variant) is now widespread. Ensure vaccine covers both RHDV1 and RHDV2.',
    'Geographic Priority': 'Europe, Australia, New Zealand',
    'Disease Prevalence':  'Europe, Australia, spreading globally',
    status:                'available',
    category:              'animal',
    animalTypes:           'rabbit',
  },
  {
    Vac_Name:              'Equine Influenza Vaccine',
    'Disease Target':      'Equine Influenza A (H3N8, H7N7)',
    'Brand Name':          'ProteqFlu / Equilis Prequenza',
    Manufacturer:          'Boehringer Ingelheim / MSD Animal Health',
    'Type/Technology':     'Recombinant canarypox-vectored / Inactivated subunit',
    Administration:        'IM injection',
    'Dosing Schedule':     'Primary series: 0, 4, and 6 months; boosters every 6–12 months',
    'Age Group':           'Foals from 4 months',
    'Target Population':   'Horses and ponies, especially competition animals',
    'Efficacy Rate':       '>90% against matched strains',
    'Storage Requirements':'2–8 °C',
    'Short Description':   'Core equine vaccine preventing highly contagious respiratory influenza in horses.',
    'Long Description':    'Equine influenza is one of the most important respiratory diseases in horses, causing significant economic losses in the industry. It spreads rapidly through aerosol transmission at competitions and sales. Many equestrian federations (including FEI) mandate vaccination for competing horses.',
    'Special Notes':       'FEI and many national federations require vaccination within 6 months of competition.',
    'Geographic Priority': 'Global',
    'Disease Prevalence':  'Worldwide',
    status:                'available',
    category:              'animal',
    animalTypes:           'horse',
  },
  {
    Vac_Name:              'Avian Newcastle Disease Vaccine',
    'Disease Target':      'Newcastle Disease (Avian Paramyxovirus type 1)',
    'Brand Name':          'Hitchner B1 / La Sota strain',
    Manufacturer:          'Multiple manufacturers (MSD, Boehringer, Ceva)',
    'Type/Technology':     'Modified live virus (MLV) — lentogenic strain',
    Administration:        'Drinking water, spray, or eye drop',
    'Dosing Schedule':     'Day-old chicks; repeat at 2–3 weeks and 6–8 weeks; boosters as per flock program',
    'Age Group':           'Day-old chicks and older',
    'Target Population':   'Backyard and commercial poultry (chickens, turkeys)',
    'Efficacy Rate':       '>85%',
    'Storage Requirements':'2–8 °C or -20 °C (lyophilised)',
    'Short Description':   'Essential poultry vaccine protecting flocks against one of the most devastating avian diseases.',
    'Long Description':    'Newcastle disease causes severe respiratory, neurological, and enteric disease in poultry with mortality up to 100% in unvaccinated susceptible flocks. It is listed as a notifiable disease by the WOAH. Vaccination is a cornerstone of poultry health programs worldwide.',
    'Special Notes':       'Notifiable disease — outbreaks must be reported to authorities. Booster frequency depends on endemic pressure.',
    'Geographic Priority': 'Africa, Asia, Middle East, South America',
    'Disease Prevalence':  'Worldwide — endemic in many developing countries',
    status:                'available',
    category:              'animal',
    animalTypes:           'poultry',
  },
  {
    Vac_Name:              'Canine Influenza Vaccine (H3N2 / H3N8)',
    'Disease Target':      'Canine Influenza Virus H3N2 and H3N8',
    'Brand Name':          'Vanguard CIV H3N2+H3N8 / Nobivac Canine Flu Bivalent',
    Manufacturer:          'Zoetis / MSD Animal Health',
    'Type/Technology':     'Inactivated bivalent',
    Administration:        'SC injection',
    'Dosing Schedule':     'Two doses 2–4 weeks apart; annual booster',
    'Age Group':           '6 weeks and older',
    'Target Population':   'Dogs in kennels, shows, daycares, or shelters',
    'Efficacy Rate':       '>80% reduction in severity and shedding',
    'Storage Requirements':'2–8 °C',
    'Short Description':   'Non-core vaccine for social dogs at risk of canine influenza exposure.',
    'Long Description':    'Canine influenza is a highly contagious respiratory disease caused by two strains: H3N8 (equine-origin, circulating in the US since 2004) and H3N2 (avian-origin, emerged in Asia and North America). The bivalent vaccine provides protection against both strains and is recommended for dogs with frequent social contact.',
    'Special Notes':       'H3N2 is the currently dominant strain in North America and Asia. Required by some boarding facilities.',
    'Geographic Priority': 'North America, South Korea, China',
    'Disease Prevalence':  'North America, Asia',
    status:                'available',
    category:              'animal',
    animalTypes:           'dog',
  },

  // ══════════════════ CHILDREN VACCINES (category: human_child) ══════════════════
  {
    Vac_Name:              'DTaP (Diphtheria, Tetanus, Pertussis) — Paediatric',
    'Disease Target':      'Diphtheria, Tetanus, Whooping Cough (Pertussis)',
    'Brand Name':          'Infanrix / Daptacel / Pediarix',
    Manufacturer:          'GSK / Sanofi / GSK',
    'Type/Technology':     'Toxoid + Acellular subunit',
    Administration:        'IM injection',
    'Dosing Schedule':     '2, 4, 6 months; booster at 15–18 months and 4–6 years',
    'Age Group':           '6 weeks to 6 years',
    'Target Population':   'Infants and young children',
    'Efficacy Rate':       '~85–90% against pertussis; >99% against diphtheria and tetanus',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'Cornerstone paediatric vaccine protecting against three serious bacterial diseases.',
    'Long Description':    'DTaP is a core childhood vaccine. Diphtheria can cause airway obstruction and heart damage; tetanus causes painful muscle spasms; pertussis (whooping cough) is most dangerous in infants under 6 months. The acellular pertussis component replaced the whole-cell DTP due to a better safety profile.',
    'Special Notes':       'Tdap booster (reduced antigen formulation) recommended for adolescents and adults. Recommended for pregnant women to protect newborns.',
    'Geographic Priority': 'Global',
    'Disease Prevalence':  'Worldwide — pertussis remains endemic globally',
    status:                'available',
    category:              'human_child',
    animalTypes:           '',
  },
  {
    Vac_Name:              'MMR (Measles, Mumps, Rubella)',
    'Disease Target':      'Measles, Mumps, Rubella',
    'Brand Name':          'M-M-R II / Priorix',
    Manufacturer:          'Merck / GSK',
    'Type/Technology':     'Live attenuated trivalent',
    Administration:        'SC injection',
    'Dosing Schedule':     '12–15 months; second dose at 4–6 years',
    'Age Group':           '12 months and older',
    'Target Population':   'Children; susceptible adolescents and adults',
    'Efficacy Rate':       '97% against measles, 88% mumps, 97% rubella after 2 doses',
    'Storage Requirements':'2–8 °C; protect from light',
    'Short Description':   'Essential two-dose vaccine protecting against three viral diseases with serious complications.',
    'Long Description':    'Measles is one of the most contagious human viruses and can cause pneumonia, encephalitis, and death, particularly in malnourished children. Rubella during pregnancy causes congenital rubella syndrome. The MMR is among the most effective vaccines ever developed; two doses achieve >97% efficacy against measles.',
    'Special Notes':       'Contraindicated in immunocompromised individuals. Do not give during pregnancy. MMRV (with varicella) available as combined option.',
    'Geographic Priority': 'Global',
    'Disease Prevalence':  'Worldwide — outbreaks continue in areas with <95% coverage',
    status:                'available',
    category:              'human_child',
    animalTypes:           '',
  },
  {
    Vac_Name:              'IPV (Inactivated Poliovirus Vaccine)',
    'Disease Target':      'Poliomyelitis (Poliovirus types 1, 2, 3)',
    'Brand Name':          'IPOL / Poliorix',
    Manufacturer:          'Sanofi Pasteur / GSK',
    'Type/Technology':     'Inactivated trivalent',
    Administration:        'SC or IM injection',
    'Dosing Schedule':     '2, 4, 6–18 months; booster at 4–6 years',
    'Age Group':           '6 weeks and older',
    'Target Population':   'Infants and children',
    'Efficacy Rate':       '>99% against paralytic polio after 3 doses',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'Core vaccine protecting children against paralytic polio — one of the most successful vaccine programs in history.',
    'Long Description':    'Polio paralysis results from viral invasion of motor neurons. The switch from oral polio vaccine (OPV) to IPV in high-income countries eliminates any risk of vaccine-derived poliovirus. IPV is preferred in countries near eradication. Wild poliovirus type 2 was eradicated in 1999; type 3 in 2019; type 1 eradication is ongoing.',
    'Special Notes':       'Often given as combination vaccine (e.g., in Pediarix or Pentacel). Countries maintaining wild-polio transmission still use OPV.',
    'Geographic Priority': 'Global — critical in Afghanistan, Pakistan',
    'Disease Prevalence':  'Near eradication globally; wild poliovirus persists in Afghanistan and Pakistan',
    status:                'available',
    category:              'human_child',
    animalTypes:           '',
  },
  {
    Vac_Name:              'Rotavirus Vaccine',
    'Disease Target':      'Rotavirus gastroenteritis',
    'Brand Name':          'Rotarix / RotaTeq',
    Manufacturer:          'GSK / Merck',
    'Type/Technology':     'Live attenuated / Pentavalent live reassortant (oral)',
    Administration:        'Oral drops',
    'Dosing Schedule':     'Rotarix: 2 doses at 2 and 4 months. RotaTeq: 3 doses at 2, 4, 6 months.',
    'Age Group':           '6 weeks to 32 weeks (first dose must start before 15 weeks)',
    'Target Population':   'Infants',
    'Efficacy Rate':       '85–98% against severe rotavirus gastroenteritis',
    'Storage Requirements':'2–8 °C; some formulations require -20 °C',
    'Short Description':   'Oral vaccine preventing severe diarrhoea — the leading cause of infant diarrhoea-related death globally.',
    'Long Description':    'Rotavirus is the most common cause of severe diarrhoeal disease in children under 5 worldwide, responsible for approximately 200,000 deaths annually. The oral vaccine has dramatically reduced hospitalisations. It cannot be administered after 32 weeks of age due to intussusception risk in older infants.',
    'Special Notes':       'Oral administration — do not inject. Age restrictions are strict due to intussusception risk.',
    'Geographic Priority': 'Africa, Asia, Latin America',
    'Disease Prevalence':  'Worldwide — highest burden in low-income countries',
    status:                'available',
    category:              'human_child',
    animalTypes:           '',
  },
  {
    Vac_Name:              'Hepatitis B Vaccine (Paediatric)',
    'Disease Target':      'Hepatitis B',
    'Brand Name':          'Engerix-B (Paediatric) / Recombivax HB (Paediatric)',
    Manufacturer:          'GSK / Merck',
    'Type/Technology':     'Recombinant subunit (HBsAg)',
    Administration:        'IM injection',
    'Dosing Schedule':     'Birth, 1–2 months, 6 months (3-dose series). Birth dose within 24 hours critical.',
    'Age Group':           'Birth and older',
    'Target Population':   'All newborns and unvaccinated children',
    'Efficacy Rate':       '>95% after complete 3-dose series',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'Critical birth-dose vaccine preventing chronic hepatitis B and liver cancer.',
    'Long Description':    'Hepatitis B virus (HBV) causes acute and chronic liver infection. Chronic infection acquired in infancy leads to cirrhosis and liver cancer in ~25% of cases. The birth dose (within 24 hours) is critical to prevent mother-to-child transmission. Universal newborn vaccination has reduced chronic HBV carrier rates from 8–15% to less than 1% in vaccinated cohorts.',
    'Special Notes':       'Birth dose must be given within 24 hours for optimal prevention of perinatal transmission. HBIG also given to infants of HBsAg-positive mothers.',
    'Geographic Priority': 'Global — especially Sub-Saharan Africa, East Asia',
    'Disease Prevalence':  'Worldwide — 296 million chronic carriers globally',
    status:                'available',
    category:              'human_child',
    animalTypes:           '',
  },
  {
    Vac_Name:              'Pneumococcal Conjugate Vaccine (PCV13/PCV15) — Paediatric',
    'Disease Target':      'Streptococcus pneumoniae (13–15 serotypes)',
    'Brand Name':          'Prevnar 13 / Prevnar 15',
    Manufacturer:          'Pfizer',
    'Type/Technology':     'Polysaccharide-protein conjugate',
    Administration:        'IM injection',
    'Dosing Schedule':     '2, 4, 6 months; booster at 12–15 months (4-dose series)',
    'Age Group':           '6 weeks to 5 years',
    'Target Population':   'Infants and young children',
    'Efficacy Rate':       '45–75% against pneumonia; >80% against invasive disease from covered serotypes',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'Essential infant vaccine preventing pneumococcal meningitis, pneumonia, and sepsis.',
    'Long Description':    'Streptococcus pneumoniae is the leading cause of bacterial meningitis and community-acquired pneumonia in children under 5. PCV13 covers 13 of the most clinically important serotypes. Introduction of PCV has caused dramatic reductions in invasive pneumococcal disease and also provides herd protection for unvaccinated individuals.',
    'Special Notes':       'PCV15 (Prevnar 15) covers 2 additional serotypes. PCV20 now available for adults. High-risk children may need PPSV23 after age 2.',
    'Geographic Priority': 'Global',
    'Disease Prevalence':  'Worldwide — highest burden in Africa and South-East Asia',
    status:                'available',
    category:              'human_child',
    animalTypes:           '',
  },
  {
    Vac_Name:              'Haemophilus influenzae type b (Hib) Vaccine',
    'Disease Target':      'Haemophilus influenzae type b',
    'Brand Name':          'ActHIB / Hiberix / PedvaxHIB',
    Manufacturer:          'Sanofi / GSK / Merck',
    'Type/Technology':     'Polysaccharide-protein conjugate',
    Administration:        'IM injection',
    'Dosing Schedule':     '2, 4, 6 months; booster at 12–15 months',
    'Age Group':           '6 weeks to 5 years',
    'Target Population':   'Infants and young children',
    'Efficacy Rate':       '>95% against invasive Hib disease',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'Core infant vaccine virtually eliminating bacterial meningitis and epiglottitis caused by Hib.',
    'Long Description':    'Before the Hib vaccine, Haemophilus influenzae type b was the leading cause of bacterial meningitis in children under 5, often resulting in deafness, brain damage, or death. Introduction of the conjugate vaccine has reduced invasive Hib disease by more than 99% in vaccinated populations. It is often given as a combination product.',
    'Special Notes':       'Usually given as combination (e.g., Pentacel = DTaP-IPV-Hib). Not needed routinely after age 5.',
    'Geographic Priority': 'Global — particularly important in Africa, Asia',
    'Disease Prevalence':  'Worldwide — near elimination in countries with vaccination programs',
    status:                'available',
    category:              'human_child',
    animalTypes:           '',
  },
  {
    Vac_Name:              'Varicella (Chickenpox) Vaccine',
    'Disease Target':      'Varicella-zoster virus (Chickenpox)',
    'Brand Name':          'Varivax / Varilrix',
    Manufacturer:          'Merck / GSK',
    'Type/Technology':     'Live attenuated (Oka strain)',
    Administration:        'SC injection',
    'Dosing Schedule':     '12–15 months; second dose at 4–6 years',
    'Age Group':           '12 months to 12 years (catch-up for susceptible older children and adults)',
    'Target Population':   'Children; susceptible adolescents and adults',
    'Efficacy Rate':       '98% after 2 doses against any varicella; near 100% against severe disease',
    'Storage Requirements':'-15 °C to -50 °C (frozen storage required)',
    'Short Description':   'Two-dose vaccine preventing chickenpox and reducing lifetime risk of shingles.',
    'Long Description':    'Chickenpox is usually mild in healthy children but can cause bacterial skin infections, pneumonia, and encephalitis. Immunocompromised individuals are at high risk of severe disease. The Oka vaccine strain establishes latent infection like wild-type VZV but reactivates as shingles far less frequently. Also available combined as MMRV (ProQuad).',
    'Special Notes':       'Frozen storage required. Contraindicated in pregnancy and immunocompromised patients. MMRV not recommended for the first dose in children 12–47 months due to slightly higher febrile seizure risk.',
    'Geographic Priority': 'High-income countries',
    'Disease Prevalence':  'Worldwide',
    status:                'available',
    category:              'human_child',
    animalTypes:           '',
  },
  {
    Vac_Name:              'Meningococcal Conjugate Vaccine (MenACWY) — Paediatric',
    'Disease Target':      'Neisseria meningitidis serogroups A, C, W, Y',
    'Brand Name':          'Menactra / Menveo / MenQuadfi',
    Manufacturer:          'Sanofi / GSK / Sanofi',
    'Type/Technology':     'Polysaccharide-protein conjugate',
    Administration:        'IM injection',
    'Dosing Schedule':     '11–12 years with booster at 16 years; high-risk infants from 2 months',
    'Age Group':           '2 months and older (schedule varies by product)',
    'Target Population':   'Adolescents; infants and children at high risk; travellers to endemic regions',
    'Efficacy Rate':       '>80% against covered serogroups',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'Essential adolescent vaccine preventing bacterial meningitis and septicaemia.',
    'Long Description':    'Meningococcal disease can progress from headache to death within 24 hours. Adolescents are at highest risk due to social behaviour (close contact, dormitory living). Serogroup B vaccine (MenB) is separate and increasingly recommended. MenACWY is mandatory for Hajj pilgrims.',
    'Special Notes':       'MenB vaccine (Bexsero/Trumenba) should also be considered for adolescents — it covers serogroup B which is not in MenACWY. Mandatory for Hajj.',
    'Geographic Priority': 'Sub-Saharan Africa (meningitis belt), Global for adolescents',
    'Disease Prevalence':  'Worldwide — highest in Sub-Saharan meningitis belt',
    status:                'available',
    category:              'human_child',
    animalTypes:           '',
  },
  {
    Vac_Name:              'Human Papillomavirus (HPV) Vaccine — Adolescent',
    'Disease Target':      'Human Papillomavirus (types 6, 11, 16, 18, 31, 33, 45, 52, 58)',
    'Brand Name':          'Gardasil 9',
    Manufacturer:          'Merck',
    'Type/Technology':     'Recombinant VLP subunit (9-valent)',
    Administration:        'IM injection',
    'Dosing Schedule':     '9–14 years: 2-dose series (0, 6–12 months). 15+ years: 3-dose series (0, 1–2, 6 months)',
    'Age Group':           '9–45 years (primary target: 9–14 years)',
    'Target Population':   'Pre-adolescent girls and boys before sexual debut',
    'Efficacy Rate':       '>97% against cervical pre-cancer caused by covered HPV types',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'Transformative vaccine preventing cervical cancer and other HPV-related cancers in adolescents.',
    'Long Description':    'HPV types 16 and 18 cause approximately 70% of cervical cancers globally. The 9-valent vaccine (Gardasil 9) covers types responsible for approximately 90% of cervical cancers and 90% of genital warts. Countries with high vaccination coverage are on track to eliminate cervical cancer as a public health problem within decades. Vaccination is most effective before HPV exposure.',
    'Special Notes':       'Best administered before sexual debut. Boys should be vaccinated equally as HPV causes oropharyngeal, anal, and penile cancers. 2-dose schedule only for those who start before age 15.',
    'Geographic Priority': 'Global — particularly important in Sub-Saharan Africa and South Asia',
    'Disease Prevalence':  'Worldwide — 570,000 cervical cancer cases annually, 311,000 deaths',
    status:                'available',
    category:              'human_child',
    animalTypes:           '',
  },

  // ══════════════════ FARM ANIMAL VACCINES (category: animal) ══════════════════
  {
    Vac_Name:              'Clostridial (7-in-1 / 8-in-1) Vaccine — Cattle & Sheep',
    'Disease Target':      'Clostridium chauvoei, septicum, novyi, perfringens types C and D, tetani',
    'Brand Name':          'Covexin 8 / Ultravac 7in1',
    Manufacturer:          'MSD Animal Health / Zoetis',
    'Type/Technology':     'Inactivated multivalent toxoid',
    Administration:        'SC injection',
    'Dosing Schedule':     'Primary: 2 doses 4–6 weeks apart; annual booster before high-risk periods (lambing/calving)',
    'Age Group':           '6 weeks and older; pre-breeding and pre-lambing in adults',
    'Target Population':   'Cattle, sheep',
    'Efficacy Rate':       '>90% against covered clostridial diseases',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'Foundation farm vaccine protecting cattle and sheep against multiple sudden-death clostridial diseases.',
    'Long Description':    'Clostridial diseases (blackleg, pulpy kidney, tetanus, black disease, etc.) are peracute bacterial infections — animals are often found dead with no premonitory signs. The multivalent clostridial vaccine is considered the single most important routine vaccine for beef and sheep producers. Annual boosters and boosters pre-lambing/pre-calving are essential for passive protection of offspring via colostrum.',
    'Special Notes':       'Pre-lambing booster in ewes is critical for passive immunity (via colostrum) to protect lambs in the first weeks of life. Lumps at injection sites are common — inject SC, not IM.',
    'Geographic Priority': 'Australia, New Zealand, UK, Europe, Americas',
    'Disease Prevalence':  'Worldwide — particularly high risk on lush pastures',
    status:                'available',
    category:              'animal',
    animalTypes:           'cattle, sheep',
  },
  {
    Vac_Name:              'Bovine Respiratory Disease (BRD) Vaccine — Cattle',
    'Disease Target':      'IBR (BHV-1), BVDV 1 and 2, BRSV, PI3, Pasteurella/Mannheimia',
    'Brand Name':          'Bovi-Shield Gold 5 / Pyramid 5+Presponse SQ',
    Manufacturer:          'Zoetis / Boehringer Ingelheim',
    'Type/Technology':     'Modified live virus (MLV) + Bacterial (inactivated)',
    Administration:        'SC or IM injection',
    'Dosing Schedule':     'Pre-weaning and pre-conditioning; booster at weaning; annual revaccination',
    'Age Group':           'Calves from 3 months',
    'Target Population':   'Beef and dairy cattle, especially feedlot-entry and stocker cattle',
    'Efficacy Rate':       '70–85% reduction in BRD morbidity',
    'Storage Requirements':'2–8 °C; some MLV products lyophilised',
    'Short Description':   'Key combination vaccine protecting cattle against the most economically important respiratory disease complex.',
    'Long Description':    'Bovine Respiratory Disease (BRD) is the most costly disease in the beef cattle industry, responsible for over US$800 million in losses annually in North America alone. The "shipping fever" complex involves multiple viral pathogens (IBR, BVDV, BRSV, PI3) that predispose to secondary bacterial pneumonia. Timely vaccination prior to weaning or feedlot entry is critical.',
    'Special Notes':       'MLV vaccines give superior immunity but are contraindicated in pregnant cattle and BVD PI cattle. Modified-live IBR vaccines may cause abortion — use killed in pregnant cows unless using marker vaccines.',
    'Geographic Priority': 'North America, Australia, Europe',
    'Disease Prevalence':  'Worldwide — highest economic impact in beef-producing regions',
    status:                'available',
    category:              'animal',
    animalTypes:           'cattle',
  },
  {
    Vac_Name:              'Foot and Mouth Disease (FMD) Vaccine',
    'Disease Target':      'Foot and Mouth Disease Virus (multiple serotypes)',
    'Brand Name':          'Aftopor / Aftopur DOE',
    Manufacturer:          'Boehringer Ingelheim / Ceva',
    'Type/Technology':     'Inactivated multivalent (serotype-matched)',
    Administration:        'IM injection',
    'Dosing Schedule':     'Two doses 4 weeks apart; boosters every 4–6 months in endemic zones',
    'Age Group':           '3 months and older',
    'Target Population':   'Cattle, sheep, pigs, goats in FMD-endemic regions',
    'Efficacy Rate':       '70–90% (depends on serotype match)',
    'Storage Requirements':'2–8 °C, do not freeze. Cold chain critical.',
    'Short Description':   'Strategically critical vaccine for FMD — one of the most economically devastating livestock diseases globally.',
    'Long Description':    'FMD is a highly contagious OIE/WOAH List A disease that devastates cattle, pig, and sheep industries. Seven serotypes (O, A, C, SAT1, SAT2, SAT3, Asia1) exist; vaccine must match circulating serotype. FMD-free countries (US, Australia, UK) prohibit FMD vaccination; endemic countries rely on mass vaccination programs. A single outbreak can close export markets for years.',
    'Special Notes':       'Vaccine serotype MUST match circulating strain — contact national veterinary authorities for correct serotype. FMD is a notifiable disease with strict outbreak protocols.',
    'Geographic Priority': 'Sub-Saharan Africa, South Asia, Middle East, South America',
    'Disease Prevalence':  'Endemic in much of Africa, Asia, Middle East',
    status:                'available',
    category:              'animal',
    animalTypes:           'cattle, sheep, pig',
  },
  {
    Vac_Name:              'Porcine Reproductive and Respiratory Syndrome (PRRS) Vaccine',
    'Disease Target':      'PRRS Virus (Type 1 EU-strain / Type 2 NA-strain)',
    'Brand Name':          'Ingelvac PRRS MLV / Pyrsvac-183',
    Manufacturer:          'Boehringer Ingelheim / Syva',
    'Type/Technology':     'Modified live virus (MLV) or Inactivated',
    Administration:        'IM injection or intranasal',
    'Dosing Schedule':     'Gilts and sows: pre-breeding; booster every 4 months. Piglets: 3–4 weeks of age.',
    'Age Group':           '3 weeks and older',
    'Target Population':   'Pigs in commercial production (sows, gilts, boars, piglets)',
    'Efficacy Rate':       '70–90% reduction in reproductive failure; approximately 50% reduction in respiratory disease',
    'Storage Requirements':'2–8 °C (MLV); 2–8 °C inactivated',
    'Short Description':   'Essential swine vaccine targeting the most economically significant disease in the global pork industry.',
    'Long Description':    'PRRS is the most economically important swine disease worldwide, estimated to cost the US pork industry alone approximately $664 million annually. In sows, it causes reproductive failure (late-term abortions, mummified fetuses, stillbirths, weak piglets). In growing pigs, it causes respiratory disease and secondary infections. Vaccine strains must be chosen based on predominant local circulating strains.',
    'Special Notes':       'MLV vaccines should not be used in PRRS-negative herds (risk of reversion to virulence). Herd PRRS status must be known before vaccination decision.',
    'Geographic Priority': 'North America, Europe, Asia',
    'Disease Prevalence':  'Worldwide — particularly prevalent in intensive pork production regions',
    status:                'available',
    category:              'animal',
    animalTypes:           'pig',
  },
  {
    Vac_Name:              'Bovine Viral Diarrhoea (BVD) Vaccine',
    'Disease Target':      'Bovine Viral Diarrhoea Virus (BVDV) types 1 and 2',
    'Brand Name':          'Bovela / Pregsure BVD',
    Manufacturer:          'Boehringer Ingelheim / Zoetis',
    'Type/Technology':     'Modified live double-attenuated / Inactivated',
    Administration:        'SC or IM injection',
    'Dosing Schedule':     'Cows and heifers: before breeding; annual booster. Calves: from 8 weeks.',
    'Age Group':           '8 weeks and older',
    'Target Population':   'Breeding cattle — heifers and cows',
    'Efficacy Rate':       '>90% prevention of foetal infection when vaccinated before breeding (MLV)',
    'Storage Requirements':'2–8 °C',
    'Short Description':   'Critical vaccine preventing persistently infected (PI) calves — the engine of BVD spread in a herd.',
    'Long Description':    'BVD is insidious: the main source of herd-level virus is persistently infected (PI) cattle — animals infected in the first trimester of pregnancy that shed virus for life. Vaccination before breeding prevents PI calf production. BVD also causes immunosuppression, increasing susceptibility to other diseases including BRD. National eradication programs operate in Scandinavia and Scotland.',
    'Special Notes':       'PI cattle must be identified and removed from herd — vaccination alone is insufficient without testing and culling PI animals. MLV vaccines contraindicated in pregnancy.',
    'Geographic Priority': 'Europe, North America, Australia',
    'Disease Prevalence':  'Worldwide',
    status:                'available',
    category:              'animal',
    animalTypes:           'cattle',
  },
  {
    Vac_Name:              'Sheep Clostridial + Pasteurella Combination Vaccine',
    'Disease Target':      'Clostridial diseases + Pasteurella (Mannheimia) haemolytica',
    'Brand Name':          'Heptavac-P Plus / Covexin Plus',
    Manufacturer:          'MSD Animal Health',
    'Type/Technology':     'Inactivated multivalent toxoid + bacterial',
    Administration:        'SC injection',
    'Dosing Schedule':     'Primary: 2 doses 4–6 weeks apart; annual booster 4–6 weeks pre-lambing',
    'Age Group':           '6 weeks and older',
    'Target Population':   'Sheep (ewes and lambs)',
    'Efficacy Rate':       '>90% against covered clostridial types; >70% against pasteurellosis',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'All-in-one sheep vaccine combining clostridial and pasteurella protection in a single injection.',
    'Long Description':    'Pneumonic pasteurellosis (ovine respiratory disease) is the most common cause of sudden death in sheep over 6 months. Combining clostridial and pasteurella antigens in one product improves compliance and reduces handling stress. Pre-lambing vaccination in ewes protects lambs for the critical first 12 weeks of life via colostral antibodies.',
    'Special Notes':       'Timing of pre-lambing booster is critical — too early reduces colostral antibody levels at lambing. Aim for 4–6 weeks before lambing.',
    'Geographic Priority': 'UK, Ireland, Australia, New Zealand, Europe',
    'Disease Prevalence':  'Worldwide sheep-producing regions',
    status:                'available',
    category:              'animal',
    animalTypes:           'sheep',
  },
  {
    Vac_Name:              'Swine Influenza Vaccine',
    'Disease Target':      'Influenza A virus in pigs (H1N1, H1N2, H3N2 subtypes)',
    'Brand Name':          'Respiporc FLU3 / Ingelvac Swine Influenza H3N2',
    Manufacturer:          'IDT Biologika / Boehringer Ingelheim',
    'Type/Technology':     'Inactivated multivalent',
    Administration:        'IM injection',
    'Dosing Schedule':     'Gilts and sows: 2 doses before breeding, booster pre-farrowing. Piglets: from 8 weeks.',
    'Age Group':           '8 weeks and older',
    'Target Population':   'Commercial pigs — sows, gilts, and growing pigs in high-health herds',
    'Efficacy Rate':       '70–85% reduction in clinical signs against matched strains',
    'Storage Requirements':'2–8 °C',
    'Short Description':   'Important swine vaccine reducing influenza-related respiratory losses and zoonotic risk.',
    'Long Description':    'Swine influenza A viruses are highly antigenically diverse and regularly reassort. Pigs serve as "mixing vessels" for avian and human influenza strains. Clinical disease causes fever, coughing, and production losses. H1N1pdm09 (the 2009 pandemic strain) is now established in pig populations globally. Vaccination reduces clinical disease and theoretical zoonotic transmission.',
    'Special Notes':       'Frequent strain surveillance needed — vaccine strains may drift from circulating strains. Public health significance: zoonotic transmission possible. Consult local veterinary authorities for current prevalent subtypes.',
    'Geographic Priority': 'Europe, North America, Asia',
    'Disease Prevalence':  'Worldwide',
    status:                'available',
    category:              'animal',
    animalTypes:           'pig',
  },
  {
    Vac_Name:              'Brucellosis Vaccine (Cattle) — Brucella abortus RB51',
    'Disease Target':      'Brucella abortus (bovine brucellosis)',
    'Brand Name':          'RB51 Strain Vaccine',
    Manufacturer:          'Zoetis / USDA licensed',
    'Type/Technology':     'Modified live attenuated bacteria',
    Administration:        'SC injection (by licensed/accredited veterinarians only)',
    'Dosing Schedule':     'Single dose in heifers aged 4–12 months. Not routinely given to adult cows.',
    'Age Group':           '4–12 months (heifers only)',
    'Target Population':   'Beef and dairy heifers in brucellosis-control programs',
    'Efficacy Rate':       '60–70% protection against abortion; reduces shedding',
    'Storage Requirements':'-20 °C to -70 °C (frozen)',
    'Short Description':   'Regulatory-controlled vaccine targeting bovine brucellosis — a major zoonotic and trade-impacting disease.',
    'Long Description':    'Brucellosis causes abortion storms in cattle and is transmissible to humans (undulant fever). RB51 replaced S19 as the preferred vaccine as it does not interfere with serological testing (B-ELISA) used in eradication programs. Vaccination is tightly controlled and can only be administered by accredited veterinarians in most jurisdictions as part of national eradication programs.',
    'Special Notes':       'Administration restricted to accredited/licensed veterinarians. Zoonotic hazard to humans — avoid needle-stick injury. RB51 can cause infection in humans. Mandatory reporting of brucellosis in most countries.',
    'Geographic Priority': 'Sub-Saharan Africa, South Asia, Middle East, Latin America',
    'Disease Prevalence':  'Endemic in much of Africa, Asia, Middle East, Mediterranean',
    status:                'available',
    category:              'animal',
    animalTypes:           'cattle',
  },
  {
    Vac_Name:              'Avian Infectious Bronchitis (IB) Vaccine',
    'Disease Target':      'Infectious Bronchitis Virus (IBV) — Gammacoronavirus',
    'Brand Name':          'Nobilis IB Multi / AviPro IB H120',
    Manufacturer:          'MSD Animal Health / Elanco',
    'Type/Technology':     'Modified live virus (MLV) / Inactivated (boosters)',
    Administration:        'Drinking water, eye drop, or spray',
    'Dosing Schedule':     'Day-old or 1st week live priming; inactivated booster at 14–16 weeks for layers',
    'Age Group':           'Day-old chicks and older',
    'Target Population':   'Broilers, layers, and breeders — all commercial poultry',
    'Efficacy Rate':       '75–90% (depends on strain match)',
    'Storage Requirements':'2–8 °C or -20 °C (MLV lyophilised)',
    'Short Description':   'Essential poultry vaccine controlling infectious bronchitis — a leading cause of production losses in chickens.',
    'Long Description':    'Infectious bronchitis is caused by a coronavirus that is highly contagious in poultry, spreading by aerosol. It causes respiratory disease, reduced egg production, and egg quality problems in layers, and nephritis in broilers. IB viruses mutate rapidly and multiple variant strains circulate globally, making strain selection critical. Multivalent vaccines or combination programs are used in endemic areas.',
    'Special Notes':       'Multiple IBV variant strains (Massachusetts, 4/91, QX, etc.) circulate globally. Vaccine strain must match predominant local strains — consult with regional poultry veterinarian.',
    'Geographic Priority': 'Global',
    'Disease Prevalence':  'Worldwide — ubiquitous in commercial poultry production',
    status:                'available',
    category:              'animal',
    animalTypes:           'poultry',
  },
  {
    Vac_Name:              'Equine Tetanus Toxoid',
    'Disease Target':      'Clostridium tetani (Tetanus)',
    'Brand Name':          'Equilis Tetanus / Tetanus Toxoid (Pfizer)',
    Manufacturer:          'MSD Animal Health / Zoetis',
    'Type/Technology':     'Purified toxoid (inactivated toxin)',
    Administration:        'IM injection',
    'Dosing Schedule':     'Primary: 2 doses 4–6 weeks apart; first booster at 12 months; then every 2 years. Mares: booster 4–6 weeks pre-foaling.',
    'Age Group':           'Foals from 4–6 months',
    'Target Population':   'All horses and ponies',
    'Efficacy Rate':       '>99% after primary course',
    'Storage Requirements':'2–8 °C, do not freeze',
    'Short Description':   'Core equine vaccine preventing tetanus — a frequently fatal disease in horses exposed to soil and wounds.',
    'Long Description':    'Horses are highly susceptible to Clostridium tetani, which proliferates in anaerobic wound conditions (castration, shoeing injuries, wire cuts). Tetanus causes progressive muscle spasm and rigidity, usually leading to death or euthanasia. The toxoid vaccine is highly effective and inexpensive. Unvaccinated horses sustaining wounds should receive tetanus antitoxin as emergency prophylaxis.',
    'Special Notes':       'Tetanus antitoxin (equine origin) for emergency prophylaxis in unvaccinated horses. Pre-foaling booster in mares gives passive protection to foals via colostrum. Often given as combination with equine influenza.',
    'Geographic Priority': 'Global',
    'Disease Prevalence':  'Worldwide — especially in horses managed on pasture or handled regularly',
    status:                'available',
    category:              'animal',
    animalTypes:           'horse',
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────
;(async () => {
  console.log('Obtaining access token from service account…')
  let token
  try {
    token = await getAccessToken()
    console.log('Token obtained ✓\n')
  } catch (e) {
    console.error('Failed to obtain token:', e.message)
    process.exit(1)
  }

  console.log(`Seeding ${vaccines.length} vaccines to ${COLLECTION}…\n`)
  let ok = 0, fail = 0

  for (const v of vaccines) {
    try {
      await addDoc(token, v)
      console.log(`  ✓  ${v.Vac_Name}`)
      ok++
    } catch (e) {
      console.log(`  ✗  ${v.Vac_Name}: ${e.message}`)
      fail++
    }
    // Slight throttle to avoid overwhelming Firestore
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\nDone. ${ok} added, ${fail} failed.`)
})()
