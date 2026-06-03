#!/usr/bin/env node
/**
 * Seed script — adds sample vaccine library entries to Firestore.
 * Uses the Google OAuth access token stored by the Firebase CLI.
 * Run: node scripts/seed-vaccine-library.js
 */

const https = require('https')
const fs    = require('fs')

// ── Config ────────────────────────────────────────────────────────────────────
const PROJECT_ID = 'vaccine-passport-973a7'

// Load the CLI-stored token and refresh if needed
const cfgPath = `${process.env.HOME}/.config/configstore/firebase-tools.json`
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
let { access_token, refresh_token, expires_at } = cfg.tokens

// ── Token refresh ─────────────────────────────────────────────────────────────
async function refreshToken () {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8uo8weLLRTLnmbFrr',
      refresh_token,
    }).toString()

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        const parsed = JSON.parse(data)
        if (parsed.error) return reject(new Error(parsed.error_description ?? parsed.error))
        resolve(parsed.access_token)
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Firestore REST write ───────────────────────────────────────────────────────
function toFirestoreValue (v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number')  return { doubleValue: v }
  if (typeof v === 'string')  return { stringValue: v }
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFirestoreValue) } }
  if (typeof v === 'object')  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, toFirestoreValue(val)])) } }
  return { stringValue: String(v) }
}

function toFirestoreDoc (obj) {
  return { fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toFirestoreValue(v)])) }
}

async function addDoc (token, collectionId, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(toFirestoreDoc(data))
    const path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}`
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        const parsed = JSON.parse(d)
        if (res.statusCode >= 300) return reject(new Error(parsed.error?.message ?? JSON.stringify(parsed)))
        resolve(parsed)
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Vaccine data ───────────────────────────────────────────────────────────────

// Shared base
const base = {
  'Short Description': '',
  'Long Description': '',
  'Brand Name': '',
  Manufacturer: '',
  'Type/Technology': '',
  Administration: 'Injection (subcutaneous or intramuscular)',
  'Dosing Schedule': '',
  'Storage Requirements': 'Refrigerated 2–8°C, do not freeze',
  'Efficacy Rate': '',
  'Age Group': '',
  'Target Population': '',
  'Geographic Priority': '',
  'Disease Prevalence': 'Worldwide',
  'Special Notes': '',
  status: 'available',
}

const vaccines = [

  // ─── PETS (category: animal) ────────────────────────────────────────────────

  {
    ...base,
    Vac_Name: 'Rabies Vaccine (Canine/Feline)',
    'Disease Target': 'Rabies',
    'Short Description': 'Core vaccine protecting dogs and cats against the fatal rabies virus.',
    'Long Description': 'Rabies is a fatal zoonotic viral disease affecting the central nervous system. Vaccination is legally required in many jurisdictions and is critical for public health. Both dogs and cats should be vaccinated starting from 12 weeks of age.',
    'Brand Name': 'Nobivac Rabies / Rabisin',
    Manufacturer: 'MSD Animal Health / Boehringer Ingelheim',
    'Type/Technology': 'Inactivated',
    'Dosing Schedule': 'Initial dose at 12 weeks; booster at 1 year; then every 1–3 years depending on product and local regulation',
    'Efficacy Rate': '>98%',
    'Age Group': '12 weeks+',
    'Target Population': 'Dogs, cats',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide (except island nations with strict import controls)',
    'Special Notes': 'Legally mandated in many countries. Required for international travel. Fatal to unvaccinated animals.',
    category: 'animal',
    animalTypes: 'dog, cat',
  },

  {
    ...base,
    Vac_Name: 'DA2PP (Distemper, Adenovirus, Parvovirus, Parainfluenza) — Canine',
    'Disease Target': 'Canine Distemper, Parvovirus, Adenovirus, Parainfluenza',
    'Short Description': 'Core combination vaccine covering the four most serious canine infectious diseases.',
    'Long Description': 'The DA2PP combination vaccine is considered the core vaccine for all dogs. Distemper is a multi-systemic disease with high mortality; parvovirus causes severe hemorrhagic gastroenteritis especially in puppies; adenovirus causes hepatitis; parainfluenza contributes to kennel cough.',
    'Brand Name': 'Nobivac DHPPi / Vanguard Plus 5',
    Manufacturer: 'MSD Animal Health / Zoetis',
    'Type/Technology': 'Modified Live Virus (MLV)',
    'Dosing Schedule': 'Puppy series: 6, 9, 12 weeks; booster at 1 year; then every 3 years',
    'Efficacy Rate': '>95%',
    'Age Group': '6 weeks+',
    'Target Population': 'Dogs',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Core vaccine — recommended for all dogs regardless of lifestyle. Puppies require a series for full protection.',
    category: 'animal',
    animalTypes: 'dog',
  },

  {
    ...base,
    Vac_Name: 'Feline FVRCP (Herpesvirus, Calicivirus, Panleukopenia)',
    'Disease Target': 'Feline Herpesvirus, Calicivirus, Panleukopenia',
    'Short Description': 'Core combination vaccine for cats covering three major infectious diseases.',
    'Long Description': 'Feline viral rhinotracheitis (herpesvirus) and calicivirus together cause the majority of upper respiratory infections in cats. Feline panleukopenia (feline distemper) is a highly contagious and often fatal disease. This trivalent vaccine is considered essential for all cats.',
    'Brand Name': 'Felocell 3 / Nobivac Tricat',
    Manufacturer: 'Zoetis / MSD Animal Health',
    'Type/Technology': 'Modified Live Virus (MLV)',
    'Dosing Schedule': 'Kitten series: 8, 12, 16 weeks; booster at 1 year; then every 3 years',
    'Efficacy Rate': '>95%',
    'Age Group': '8 weeks+',
    'Target Population': 'Cats (indoor and outdoor)',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Core vaccine for all cats. Even indoor cats should receive this vaccine.',
    category: 'animal',
    animalTypes: 'cat',
  },

  {
    ...base,
    Vac_Name: 'Feline Leukaemia Virus (FeLV) Vaccine',
    'Disease Target': 'Feline Leukaemia Virus',
    'Short Description': 'Protects cats against FeLV, a leading cause of feline cancer and immune suppression.',
    'Long Description': 'FeLV is a retrovirus that can cause immune deficiency, anemia, and various cancers in cats. It is transmitted through saliva, urine, and close contact. Vaccination is strongly recommended for cats with outdoor access or multi-cat households.',
    'Brand Name': 'Leucofeligen / Purevax FeLV',
    Manufacturer: 'Virbac / Boehringer Ingelheim',
    'Type/Technology': 'Recombinant canarypox vector',
    'Dosing Schedule': '8 weeks and 12 weeks; annual booster for cats at risk',
    'Efficacy Rate': '~85–90%',
    'Age Group': '8 weeks+',
    'Target Population': 'Cats with outdoor access or multi-cat households',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Strongly recommended for outdoor cats and cats in shelters. Test for FeLV before vaccinating.',
    category: 'animal',
    animalTypes: 'cat',
  },

  {
    ...base,
    Vac_Name: 'Bordetella (Kennel Cough) Vaccine',
    'Disease Target': 'Bordetella bronchiseptica / Kennel Cough',
    'Short Description': 'Protects dogs against the main bacterial cause of kennel cough (infectious tracheobronchitis).',
    'Long Description': 'Kennel cough is a highly contagious respiratory disease complex in dogs. Bordetella bronchiseptica is the primary bacterial pathogen. Dogs in kennels, groomers, or dog parks are at highest risk. Vaccines are available as injectable, oral, or intranasal formulations.',
    'Brand Name': 'Nobivac KC / Bronchi-Shield',
    Manufacturer: 'MSD Animal Health / Elanco',
    'Type/Technology': 'Live attenuated / Intranasal',
    Administration: 'Intranasal or oral (some injectable forms available)',
    'Dosing Schedule': 'Single dose intranasally 3+ days before exposure; annual booster; some kennels require every 6 months',
    'Efficacy Rate': '~80–90%',
    'Age Group': '3 weeks+',
    'Target Population': 'Dogs in contact with other dogs (boarding, shows, parks)',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Required by most boarding kennels and groomers. Best given at least 72 hours before boarding.',
    category: 'animal',
    animalTypes: 'dog',
  },

  {
    ...base,
    Vac_Name: 'Leptospirosis Vaccine (Canine)',
    'Disease Target': 'Leptospira spp.',
    'Short Description': 'Protects dogs against leptospirosis, a zoonotic bacterial disease spread through contaminated water.',
    'Long Description': 'Leptospirosis is caused by Leptospira bacteria found in soil and water contaminated by wildlife urine. It causes kidney and liver failure and is transmissible to humans. Dogs that spend time outdoors, near water, or in rural areas are at increased risk.',
    'Brand Name': 'Nobivac L4 / Vanguard L4',
    Manufacturer: 'MSD Animal Health / Zoetis',
    'Type/Technology': 'Inactivated (bacterin)',
    'Dosing Schedule': 'Two doses 4 weeks apart; annual booster',
    'Efficacy Rate': '>90% against covered serovars',
    'Age Group': '8 weeks+',
    'Target Population': 'Dogs with outdoor access, especially near water or wildlife',
    'Geographic Priority': 'Europe, Americas, Asia, Australasia',
    'Disease Prevalence': 'Worldwide, higher in tropical/subtropical regions',
    'Special Notes': 'Zoonotic — protects both the dog and human family members. Annual booster essential as immunity wanes.',
    category: 'animal',
    animalTypes: 'dog',
  },

  {
    ...base,
    Vac_Name: 'Rabbit Viral Haemorrhagic Disease (RHD1 & RHD2)',
    'Disease Target': 'Rabbit Viral Haemorrhagic Disease (calicivirus)',
    'Short Description': 'Protects rabbits against two strains of the highly fatal viral haemorrhagic disease.',
    'Long Description': 'RHDV1 and RHDV2 are caliciviruses causing acute liver failure and rapid death in rabbits. RHDV2 has emerged as the dominant strain globally. Wild rabbits can carry the virus and contaminate the environment. Vaccination is essential for all pet rabbits.',
    'Brand Name': 'Filavac VHD K C+V / Nobivac Myxo-RHD Plus',
    Manufacturer: 'Filavie / MSD Animal Health',
    'Type/Technology': 'Inactivated',
    'Dosing Schedule': 'From 10 weeks; annual booster (some regions recommend 6-monthly)',
    'Efficacy Rate': '>95%',
    'Age Group': '10 weeks+',
    'Target Population': 'Domestic rabbits (indoor and outdoor)',
    'Geographic Priority': 'Europe, Australia, Americas',
    'Disease Prevalence': 'Europe, Australia, North America, spreading globally',
    'Special Notes': 'No treatment exists for RHD. Annual vaccination is critical. Separate rabbitry hygiene measures also recommended.',
    category: 'animal',
    animalTypes: 'rabbit',
  },

  {
    ...base,
    Vac_Name: 'Equine Influenza Vaccine',
    'Disease Target': 'Equine Influenza Virus',
    'Short Description': 'Core equine vaccine protecting against highly contagious equine influenza.',
    'Long Description': 'Equine influenza is one of the most common respiratory diseases in horses worldwide, causing fever, cough, and nasal discharge. Outbreaks cause significant disruption in racing, competitions, and transport. Many equestrian bodies and competition rules mandate vaccination.',
    'Brand Name': 'Equip Flu-Te / Proteqflu',
    Manufacturer: 'Zoetis / Boehringer Ingelheim',
    'Type/Technology': 'Inactivated / ISCOM adjuvanted',
    'Dosing Schedule': 'Primary course: 3 injections over 6 months; annual booster; competition rules may require 6-monthly',
    'Efficacy Rate': '>90%',
    'Age Group': '6 months+',
    'Target Population': 'Horses, especially those in contact with other horses',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Required by FEI and most national equestrian federations for competition. Check specific interval requirements.',
    category: 'animal',
    animalTypes: 'horse',
  },

  {
    ...base,
    Vac_Name: 'Avian Newcastle Disease Vaccine',
    'Disease Target': 'Newcastle Disease (Avian paramyxovirus type 1)',
    'Short Description': 'Protects poultry flocks against Newcastle disease, a serious and notifiable respiratory/neurological disease.',
    'Long Description': 'Newcastle disease causes respiratory, nervous, and digestive signs in poultry with high mortality in susceptible flocks. It is a notifiable disease worldwide. Vaccination is commonly practiced in commercial and backyard poultry.',
    'Brand Name': 'Nobilis ND / Hipraviar B1',
    Manufacturer: 'MSD Animal Health / Hipra',
    'Type/Technology': 'Live attenuated / Lentogenic strain',
    Administration: 'Drinking water, spray, or eye drop',
    'Dosing Schedule': 'Day 1–7 of life; repeat at 3–4 weeks; booster every 3–6 months',
    'Efficacy Rate': '>90% against clinical disease',
    'Age Group': 'Day-old chicks+',
    'Target Population': 'Commercial broilers, layers, backyard poultry',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Notifiable disease in most countries. Live vaccines require careful biosecurity during administration.',
    category: 'animal',
    animalTypes: 'poultry',
  },

  {
    ...base,
    Vac_Name: 'Canine Influenza Vaccine (H3N2 / H3N8)',
    'Disease Target': 'Canine Influenza Virus (H3N2 and H3N8)',
    'Short Description': 'Protects dogs against two strains of canine influenza virus causing respiratory illness.',
    'Long Description': 'Canine influenza viruses H3N8 and H3N2 cause respiratory disease in dogs with symptoms similar to kennel cough. H3N2 has spread widely in Asia and the USA. Dogs in high-contact environments (kennels, dog parks, shows) are at highest risk.',
    'Brand Name': 'Vanguard CIV H3N2+H3N8 / Nobivac Canine Flu Bivalent',
    Manufacturer: 'Zoetis / MSD Animal Health',
    'Type/Technology': 'Inactivated bivalent',
    'Dosing Schedule': 'Two doses 2–4 weeks apart; annual booster',
    'Efficacy Rate': '~80–85%',
    'Age Group': '7 weeks+',
    'Target Population': 'Dogs in kennels, shelters, shows, dog parks',
    'Geographic Priority': 'USA, South Korea, China, Europe',
    'Disease Prevalence': 'USA, Asia, expanding to Europe and Australasia',
    'Special Notes': 'Particularly important in areas where outbreaks have been reported. Reduces severity even if infection occurs.',
    category: 'animal',
    animalTypes: 'dog',
  },

  // ─── CHILDREN (category: human_child) ─────────────────────────────────────

  {
    ...base,
    Vac_Name: 'DTaP (Diphtheria, Tetanus, Pertussis) — Paediatric',
    'Disease Target': 'Diphtheria, Tetanus, Pertussis (Whooping Cough)',
    'Short Description': 'Core infant vaccine protecting against three serious childhood bacterial diseases.',
    'Long Description': 'DTaP combines protection against diphtheria (throat/airway infection), tetanus (muscle spasms), and pertussis (whooping cough). Pertussis is particularly dangerous in infants under 6 months. Part of every national childhood immunisation schedule.',
    'Brand Name': 'Infanrix / Daptacel',
    Manufacturer: 'GSK / Sanofi',
    'Type/Technology': 'Acellular subunit',
    'Dosing Schedule': '2, 4, 6 months; booster at 15–18 months and 4–6 years',
    'Efficacy Rate': '>95% for diphtheria/tetanus; ~80–85% for pertussis',
    'Age Group': '6 weeks – 6 years',
    'Target Population': 'Infants and children',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Tdap (adult formulation) is recommended for adolescents and adults needing booster. Pregnant women should receive Tdap in each pregnancy.',
    category: 'human_child',
  },

  {
    ...base,
    Vac_Name: 'MMR (Measles, Mumps, Rubella)',
    'Disease Target': 'Measles, Mumps, Rubella',
    'Short Description': 'Essential childhood vaccine against three highly contagious viral diseases.',
    'Long Description': 'Measles can cause pneumonia, encephalitis, and death; mumps causes salivary gland swelling and can lead to deafness; rubella during pregnancy can cause severe birth defects. The MMR vaccine has dramatically reduced all three diseases globally.',
    'Brand Name': 'M-M-R II / Priorix',
    Manufacturer: 'Merck / GSK',
    'Type/Technology': 'Live attenuated',
    'Dosing Schedule': 'First dose at 12–15 months; second dose at 4–6 years',
    'Efficacy Rate': '97% for measles; 88% for mumps; >97% for rubella (2 doses)',
    'Age Group': '12 months+',
    'Target Population': 'All children',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide; outbreaks in under-vaccinated communities',
    'Special Notes': 'Two doses required for full protection. Do not give to immunocompromised individuals. Contains live virus — important for timing around other live vaccines.',
    category: 'human_child',
  },

  {
    ...base,
    Vac_Name: 'IPV (Inactivated Poliovirus Vaccine)',
    'Disease Target': 'Poliovirus types 1, 2, 3',
    'Short Description': 'Protects children against poliomyelitis, a potentially paralysing viral disease.',
    'Long Description': 'Polio can cause permanent paralysis or death. The inactivated polio vaccine (IPV) has replaced oral OPV in most developed countries due to a small risk of vaccine-derived polio with OPV. Crucial for maintaining global polio eradication progress.',
    'Brand Name': 'Ipol / Imovax Polio',
    Manufacturer: 'Sanofi',
    'Type/Technology': 'Inactivated (killed virus)',
    'Dosing Schedule': '2, 4, 6–18 months; booster at 4–6 years',
    'Efficacy Rate': '>99% after complete schedule',
    'Age Group': '6 weeks+',
    'Target Population': 'All children',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Endemic: Pakistan, Afghanistan (wild type); vaccine-derived outbreaks in Africa/Asia',
    'Special Notes': 'Often combined with DTaP as part of a pentavalent or hexavalent vaccine.',
    category: 'human_child',
  },

  {
    ...base,
    Vac_Name: 'Rotavirus Vaccine',
    'Disease Target': 'Rotavirus gastroenteritis',
    'Short Description': 'Oral vaccine protecting infants against rotavirus, the leading cause of severe childhood diarrhoea.',
    'Long Description': 'Rotavirus causes severe, dehydrating gastroenteritis and is responsible for hundreds of thousands of childhood deaths annually, mainly in low-income countries. The oral vaccine has dramatically reduced hospitalisations in vaccinated populations.',
    'Brand Name': 'Rotarix / RotaTeq',
    Manufacturer: 'GSK / Merck',
    'Type/Technology': 'Live attenuated oral vaccine',
    Administration: 'Oral (drops)',
    'Dosing Schedule': 'Rotarix: 2 and 4 months. RotaTeq: 2, 4, 6 months',
    'Efficacy Rate': '~85–98% against severe disease',
    'Age Group': '6 weeks – 32 weeks (must complete before 8 months)',
    'Target Population': 'Infants',
    'Geographic Priority': 'Worldwide; especially high-income impact in high-burden countries',
    'Disease Prevalence': 'Worldwide; highest burden in sub-Saharan Africa and South Asia',
    'Special Notes': 'Must be started before 15 weeks of age (Rotarix) or 12 weeks (RotaTeq). Cannot be given after 8 months. Oral administration only.',
    category: 'human_child',
  },

  {
    ...base,
    Vac_Name: 'Hepatitis B Vaccine (Paediatric)',
    'Disease Target': 'Hepatitis B Virus (HBV)',
    'Short Description': 'Prevents chronic hepatitis B infection, which can lead to cirrhosis and liver cancer.',
    'Long Description': 'Hepatitis B is a bloodborne and sexually transmitted virus that causes chronic liver disease in ~5% of infected adults but ~90% of infected infants. Vaccination at birth prevents vertical transmission and provides long-term protection.',
    'Brand Name': 'Engerix-B (paediatric) / Recombivax HB',
    Manufacturer: 'GSK / Merck',
    'Type/Technology': 'Recombinant subunit (HBsAg)',
    'Dosing Schedule': 'Birth dose within 24 hours; second dose at 1–2 months; third dose at 6 months',
    'Efficacy Rate': '>95%',
    'Age Group': 'Birth onwards',
    'Target Population': 'All newborns; unvaccinated children and adolescents',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide; endemic in Asia, Africa, Pacific Islands',
    'Special Notes': 'Birth dose is critical to prevent mother-to-child transmission. Immune memory persists for decades; booster not routinely recommended.',
    category: 'human_child',
  },

  {
    ...base,
    Vac_Name: 'Pneumococcal Conjugate Vaccine (PCV13/PCV15) — Paediatric',
    'Disease Target': 'Streptococcus pneumoniae (13–15 serotypes)',
    'Short Description': 'Protects young children against the most dangerous forms of pneumococcal disease including meningitis and pneumonia.',
    'Long Description': 'Streptococcus pneumoniae causes pneumonia, meningitis, bacteraemia, and ear infections. Invasive pneumococcal disease can be fatal or result in permanent disability. PCV13 covers 13 serotypes including the most virulent; PCV15 adds two additional serotypes.',
    'Brand Name': 'Prevnar 13 / Vaxneuvance',
    Manufacturer: 'Pfizer / Merck',
    'Type/Technology': 'Polysaccharide-protein conjugate',
    'Dosing Schedule': '2, 4, 6 months; booster at 12–15 months',
    'Efficacy Rate': '>80% against vaccine-type invasive disease',
    'Age Group': '6 weeks – 5 years',
    'Target Population': 'All infants and young children',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Has dramatically reduced childhood meningitis caused by S. pneumoniae. Also provides herd protection to unvaccinated adults.',
    category: 'human_child',
  },

  {
    ...base,
    Vac_Name: 'Haemophilus influenzae type b (Hib) Vaccine',
    'Disease Target': 'Haemophilus influenzae type b',
    'Short Description': 'Protects infants against a leading cause of bacterial meningitis and epiglottitis.',
    'Long Description': 'Before vaccination, Hib was the most common cause of bacterial meningitis in children under 5 and a leading cause of deafness and intellectual disability. The vaccine has dramatically reduced Hib disease in vaccinated populations.',
    'Brand Name': 'ActHIB / PedvaxHIB',
    Manufacturer: 'Sanofi / Merck',
    'Type/Technology': 'Polysaccharide-protein conjugate',
    'Dosing Schedule': '2, 4, 6 months; booster at 12–15 months',
    'Efficacy Rate': '>95%',
    'Age Group': '6 weeks – 5 years',
    'Target Population': 'All infants',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide; higher burden in low-income countries',
    'Special Notes': 'Often given as part of pentavalent or hexavalent combination vaccines. Disease is now rare in countries with routine vaccination.',
    category: 'human_child',
  },

  {
    ...base,
    Vac_Name: 'Varicella (Chickenpox) Vaccine',
    'Disease Target': 'Varicella-Zoster Virus (VZV)',
    'Short Description': 'Prevents chickenpox and reduces the risk of later shingles (herpes zoster).',
    'Long Description': 'Varicella causes widespread, itchy blistering rash and can lead to bacterial superinfection, pneumonia, encephalitis, or death in severe cases. The VZV virus remains latent and can reactivate as shingles in adulthood. Vaccination significantly reduces both primary disease and later zoster.',
    'Brand Name': 'Varivax / Varilrix',
    Manufacturer: 'Merck / GSK',
    'Type/Technology': 'Live attenuated',
    'Dosing Schedule': 'First dose at 12–15 months; second dose at 4–6 years',
    'Efficacy Rate': '~90–95% against any varicella; >98% against severe disease',
    'Age Group': '12 months+',
    'Target Population': 'All children without prior varicella infection',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Also available as MMRV (combined with MMR). Do not give within 28 days of another live vaccine unless on the same day.',
    category: 'human_child',
  },

  {
    ...base,
    Vac_Name: 'Meningococcal Conjugate Vaccine (MenACWY) — Paediatric',
    'Disease Target': 'Neisseria meningitidis serogroups A, C, W, Y',
    'Short Description': 'Protects children and adolescents against bacterial meningitis caused by the four most common serogroups.',
    'Long Description': 'Meningococcal disease can cause meningitis and septicaemia with rapid onset and can be fatal within 24 hours. The conjugate vaccine provides durable immune memory against serogroups A, C, W, and Y. Serogroup B requires a separate vaccine.',
    'Brand Name': 'Menactra / Menveo / Nimenrix',
    Manufacturer: 'Sanofi / GSK / Pfizer',
    'Type/Technology': 'Polysaccharide-protein conjugate',
    'Dosing Schedule': 'Dose at 11–12 years; booster at 16. Earlier series for high-risk children (2+ months)',
    'Efficacy Rate': '>80–90%',
    'Age Group': '2 months+ (risk groups); 11 years+ (routine adolescent)',
    'Target Population': 'All adolescents; high-risk infants; travellers to sub-Saharan Africa',
    'Geographic Priority': 'Worldwide; mandatory for Hajj pilgrims',
    'Disease Prevalence': 'Worldwide; meningitis belt in sub-Saharan Africa',
    'Special Notes': 'Separate MenB vaccine (Bexsero/Trumenba) needed for serogroup B coverage. Required for travellers to meningitis belt countries.',
    category: 'human_child',
  },

  {
    ...base,
    Vac_Name: 'Human Papillomavirus (HPV) Vaccine — Adolescent',
    'Disease Target': 'Human Papillomavirus (types 6, 11, 16, 18 and others)',
    'Short Description': 'Prevents HPV infection and its long-term consequences including cervical cancer.',
    'Long Description': 'HPV is the most common sexually transmitted infection worldwide. Persistent infection with high-risk types (16, 18) causes cervical, oropharyngeal, anal, penile, and other cancers. Vaccination before first exposure provides maximum benefit and is most effective in adolescents aged 9–14.',
    'Brand Name': 'Gardasil 9 / Cervarix',
    Manufacturer: 'Merck / GSK',
    'Type/Technology': 'Recombinant virus-like particle (VLP)',
    'Dosing Schedule': '9–14 years: 2 doses 6 months apart. 15+ years: 3 doses (0, 1–2, 6 months)',
    'Efficacy Rate': '>90% for covered HPV types',
    'Age Group': '9–26 years (routine); up to 45 years in some guidelines',
    'Target Population': 'Pre-adolescents and adolescents; recommended for all genders',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Most effective before sexual debut. Gardasil 9 covers 9 HPV types. Also protects against genital warts (types 6 & 11).',
    category: 'human_child',
  },

  // ─── FARM ANIMALS (category: animal — livestock) ───────────────────────────

  {
    ...base,
    Vac_Name: 'Clostridial (7-in-1 / 8-in-1) Vaccine — Cattle & Sheep',
    'Disease Target': 'Clostridium perfringens types C & D, Cl. novyi, Cl. septicum, Cl. tetani, Cl. chauvoei, Cl. haemolyticum (blackleg, tetanus, pulpy kidney, etc.)',
    'Short Description': 'Broad-spectrum clostridial protection covering the most important enteric and gangrenous diseases of cattle and sheep.',
    'Long Description': 'Clostridial diseases include blackleg, tetanus, pulpy kidney, black disease, malignant oedema, and others. They are caused by toxins from Clostridium bacteria in soil and are often fatal with little warning. Annual vaccination is a cornerstone of livestock health programmes.',
    'Brand Name': 'Covexin 8 / Ultravac 7in1',
    Manufacturer: 'MSD Animal Health / Zoetis',
    'Type/Technology': 'Toxoid / Inactivated bacterin',
    'Dosing Schedule': 'Primary: 2 doses 4–6 weeks apart; annual booster; ewes/cows: booster 4–6 weeks pre-parturition for passive immunity transfer',
    'Efficacy Rate': '>90% when primary course completed',
    'Age Group': 'From 6 weeks',
    'Target Population': 'Cattle, sheep, goats',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide; endemic in areas with rich soil',
    'Special Notes': 'Pre-lambing/calving booster is critical to protect neonates through colostrum. Deaths can be sudden — do not delay vaccination of at-risk animals.',
    category: 'animal',
    animalTypes: 'cattle, sheep',
  },

  {
    ...base,
    Vac_Name: 'Bovine Respiratory Disease (BRD) Vaccine — Cattle',
    'Disease Target': 'IBR (BHV-1), BVDV, PI3, BRSV, Mannheimia haemolytica',
    'Short Description': 'Combination vaccine protecting cattle against the major pathogens causing bovine respiratory disease complex.',
    'Long Description': 'BRD (shipping fever) is the most costly disease in beef and dairy cattle worldwide. It involves viral pathogens (IBR, BVD, PI3, BRSV) that damage the respiratory tract and predispose to secondary bacterial pneumonia. Vaccination significantly reduces morbidity and mortality.',
    'Brand Name': 'Bovi-Shield Gold / Pyramid 5',
    Manufacturer: 'Zoetis / Boehringer Ingelheim',
    'Type/Technology': 'Modified Live Virus (MLV) + bacterin',
    'Dosing Schedule': 'Primary: 2 doses 3–4 weeks apart; annual booster; pre-weaning and pre-shipping boosters recommended',
    'Efficacy Rate': '>80% reduction in clinical BRD',
    'Age Group': '6 months+',
    'Target Population': 'Beef and dairy cattle, particularly at weaning and transport',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Modified live virus vaccines should not be used in pregnant cows without label guidance. Timing pre-stress events (weaning, transport) is key for best protection.',
    category: 'animal',
    animalTypes: 'cattle',
  },

  {
    ...base,
    Vac_Name: 'Foot and Mouth Disease (FMD) Vaccine',
    'Disease Target': 'Foot-and-Mouth Disease Virus (O, A, SAT serotypes)',
    'Short Description': 'Controls the highly contagious FMD virus in cattle, sheep, pigs, and other cloven-hoofed animals.',
    'Long Description': 'FMD is one of the most economically devastating livestock diseases globally. It affects all cloven-hoofed animals causing vesicular lesions on feet and mouth, leading to lameness and production losses. Vaccination is used in endemic regions; FMD-free countries rely on slaughter and biosecurity.',
    'Brand Name': 'Aftovaxpur DOE / Fendamouth',
    Manufacturer: 'Boehringer Ingelheim / Elanco',
    'Type/Technology': 'Inactivated oil-adjuvanted',
    'Dosing Schedule': 'Primary: 2 doses 4 weeks apart; booster every 4–6 months in endemic areas',
    'Efficacy Rate': '70–90% (serotype dependent)',
    'Age Group': 'From 2 months',
    'Target Population': 'Cattle, sheep, goats, pigs in endemic regions',
    'Geographic Priority': 'Sub-Saharan Africa, Middle East, Asia, South America',
    'Disease Prevalence': 'Endemic in Asia, Africa, South America, Middle East',
    'Special Notes': 'Not used in FMD-free countries. Serotype matching is critical. Regulatory controls apply to movement of vaccinated animals in some jurisdictions.',
    category: 'animal',
    animalTypes: 'cattle, sheep, pig',
  },

  {
    ...base,
    Vac_Name: 'Porcine Reproductive and Respiratory Syndrome (PRRS) Vaccine',
    'Disease Target': 'PRRS Virus',
    'Short Description': 'Reduces reproductive failure and respiratory disease caused by PRRS virus in pigs.',
    'Long Description': 'PRRS causes reproductive failure in sows (late-term abortion, stillbirths, weak piglets) and respiratory disease in growing pigs. It is one of the most economically significant diseases in commercial pig production globally.',
    'Brand Name': 'Ingelvac PRRS MLV / Porcilis PRRS',
    Manufacturer: 'Boehringer Ingelheim / MSD Animal Health',
    'Type/Technology': 'Modified Live Virus (MLV)',
    'Dosing Schedule': 'Gilts/sows: vaccinate at least 4 weeks pre-breeding; growing pigs: single dose at weaning',
    'Efficacy Rate': '~60–80% reduction in clinical signs; significant reduction in viraemia',
    'Age Group': 'Weaning (3 weeks+)',
    'Target Population': 'Commercial pigs, breeding stock',
    'Geographic Priority': 'North America, Europe, Asia',
    'Disease Prevalence': 'North America, Europe, Asia; near-worldwide in commercial production',
    'Special Notes': 'MLV vaccine can spread to naive animals — important biosecurity consideration. North American and European strains differ; choose vaccine accordingly.',
    category: 'animal',
    animalTypes: 'pig',
  },

  {
    ...base,
    Vac_Name: 'Bovine Viral Diarrhoea (BVD) Vaccine',
    'Disease Target': 'Bovine Viral Diarrhoea Virus (BVDV types 1 & 2)',
    'Short Description': 'Prevents reproductive losses, immunosuppression, and the creation of persistently infected (PI) cattle.',
    'Long Description': 'BVDV causes a range of diseases including mucosal disease, respiratory disease, and reproductive failure. Most critically, cows infected in early pregnancy can produce persistently infected calves which shed virus for life and act as major reservoirs. Vaccination is key to control and eradication.',
    'Brand Name': 'Bovilis BVD / Cattlemaster Gold',
    Manufacturer: 'MSD Animal Health / Zoetis',
    'Type/Technology': 'Inactivated or Modified Live Virus',
    'Dosing Schedule': 'Inactivated: 2 doses pre-breeding, annual booster. MLV: single dose, annual booster',
    'Efficacy Rate': '>90% prevention of PI calves when used correctly',
    'Age Group': 'From 6 months',
    'Target Population': 'Dairy and beef cattle, particularly breeding stock',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'PI animals must be identified and removed regardless of vaccination status. Some countries have national eradication programs.',
    category: 'animal',
    animalTypes: 'cattle',
  },

  {
    ...base,
    Vac_Name: 'Sheep Clostridial + Pasteurella Combination Vaccine',
    'Disease Target': 'Clostridium spp. + Mannheimia haemolytica (Pasteurella)',
    'Short Description': 'Combination vaccine protecting sheep against clostridial diseases and pasteurellosis (pneumonia).',
    'Long Description': 'Pneumonic pasteurellosis is one of the most common causes of death in sheep, particularly in housed or stressed animals. Combined with clostridial protection, this vaccine delivers broad coverage in a single product, ideal for ewes and lambs.',
    'Brand Name': 'Heptavac-P Plus / Footvax + Heptavac',
    Manufacturer: 'MSD Animal Health',
    'Type/Technology': 'Inactivated toxoid + bacterin',
    'Dosing Schedule': 'Primary: 2 doses 4–6 weeks apart; annual booster in sheep; pre-lambing booster in ewes for passive transfer',
    'Efficacy Rate': '>85%',
    'Age Group': 'From 6 weeks',
    'Target Population': 'Sheep and lambs',
    'Geographic Priority': 'Europe, Australasia, Americas',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Pre-lambing booster in ewes is particularly important to protect lambs through colostral antibodies.',
    category: 'animal',
    animalTypes: 'sheep',
  },

  {
    ...base,
    Vac_Name: 'Swine Influenza Vaccine',
    'Disease Target': 'Swine Influenza Virus (H1N1, H1N2, H3N2)',
    'Short Description': 'Reduces respiratory disease, reproductive losses, and zoonotic risk from swine influenza.',
    'Long Description': 'Swine influenza viruses cause respiratory disease in pigs and have zoonotic importance, as pigs can act as mixing vessels for avian and human influenza viruses. Vaccination reduces clinical signs, virus shedding, and the risk of emerging pandemic strains.',
    'Brand Name': 'Respiporc Flu3 / Suvaxyn Swine Influenza',
    Manufacturer: 'IDT Biologika / Zoetis',
    'Type/Technology': 'Inactivated (whole virus)',
    'Dosing Schedule': 'Sows: 2 doses pre-farrowing; annual booster. Piglets: 2 doses 3–4 weeks apart from 6 weeks',
    'Efficacy Rate': '>80% against homologous strains',
    'Age Group': 'From 6 weeks',
    'Target Population': 'Commercial pigs, especially breeding sows',
    'Geographic Priority': 'North America, Europe, Asia',
    'Disease Prevalence': 'Worldwide in commercial pig production',
    'Special Notes': 'Strain matching is important. Both H1 and H3 strains circulate; bivalent or trivalent vaccines provide broader coverage.',
    category: 'animal',
    animalTypes: 'pig',
  },

  {
    ...base,
    Vac_Name: 'Brucellosis Vaccine (Cattle) — Brucella abortus S19 / RB51',
    'Disease Target': 'Brucella abortus',
    'Short Description': 'Prevents brucellosis, a major cause of abortion storms in cattle with significant zoonotic risk to humans.',
    'Long Description': 'Bovine brucellosis causes late-term abortion, reduced fertility, and significant economic losses. It is also a major zoonotic disease (undulant fever in humans). Vaccination of heifers is the cornerstone of national control and eradication programmes.',
    'Brand Name': 'Strain 19 (S19) / RB51 (Strain RB51)',
    Manufacturer: 'Various governmental / Zoetis',
    'Type/Technology': 'Live attenuated',
    'Dosing Schedule': 'Single dose in calves/heifers aged 3–8 months; in some programmes, reduced adult dose',
    'Efficacy Rate': '65–75%',
    'Age Group': '3–8 months heifers (calves)',
    'Target Population': 'Beef and dairy cattle heifers; in high-prevalence areas, all female cattle',
    'Geographic Priority': 'Africa, Middle East, Asia, Latin America, Eastern Europe',
    'Disease Prevalence': 'Worldwide; brucellosis-free status in some countries (Scandinavia, Australia)',
    'Special Notes': 'Zoonotic hazard to humans. Vaccination must be performed under veterinary supervision. Tattooing/tagging to identify vaccinated animals required in many jurisdictions. S19 can cause abortion if used in adult pregnant cattle.',
    category: 'animal',
    animalTypes: 'cattle',
  },

  {
    ...base,
    Vac_Name: 'Avian Infectious Bronchitis (IB) Vaccine',
    'Disease Target': 'Infectious Bronchitis Virus (IBV — Gammacoronavirus)',
    'Short Description': 'Protects poultry flocks against infectious bronchitis, a highly contagious respiratory coronavirus.',
    'Long Description': 'Infectious bronchitis is caused by a coronavirus and is one of the most economically important poultry diseases worldwide, causing respiratory disease in broilers and severe drops in egg production and quality in layers. Multiple IBV serotypes circulate globally.',
    'Brand Name': 'Nobilis IB Multi + Clone 30 / Poulvac IB',
    Manufacturer: 'MSD Animal Health / Zoetis',
    'Type/Technology': 'Live attenuated',
    Administration: 'Drinking water, spray, or eye drop',
    'Dosing Schedule': 'Day 1 of life with Mass serotype; repeat at 2–3 weeks; booster with local variant vaccine',
    'Efficacy Rate': '>85% protection against homologous serotypes',
    'Age Group': 'Day-old chicks+',
    'Target Population': 'Commercial broilers, layers, breeders',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide',
    'Special Notes': 'Multiple serotypes exist with limited cross-protection. Match vaccine serotype to circulating field strains. IBV is a coronavirus (not related to SARS-CoV-2).',
    category: 'animal',
    animalTypes: 'poultry',
  },

  {
    ...base,
    Vac_Name: 'Equine Tetanus Toxoid',
    'Disease Target': 'Tetanus (Clostridium tetani)',
    'Short Description': 'Core equine vaccine providing protection against the often-fatal tetanus disease in horses.',
    'Long Description': 'Horses are highly susceptible to tetanus compared to most other species. The Clostridium tetani bacterium in soil produces a neurotoxin causing progressive muscle rigidity and death. Tetanus toxoid provides highly effective and long-lasting protection and is considered a core equine vaccine.',
    'Brand Name': 'Tetanus Toxoid / Equip T',
    Manufacturer: 'Zoetis / Boehringer Ingelheim',
    'Type/Technology': 'Toxoid',
    'Dosing Schedule': 'Primary: 2 doses 4–8 weeks apart; booster at 12 months; then every 3 years (or annually if combined with flu)',
    'Efficacy Rate': '>95%',
    'Age Group': '3 months+',
    'Target Population': 'All horses, ponies, donkeys',
    'Geographic Priority': 'Worldwide',
    'Disease Prevalence': 'Worldwide; C. tetani spores ubiquitous in soil',
    'Special Notes': 'Unvaccinated horses with wounds should receive tetanus antitoxin (passive immunity) in addition to starting primary vaccination course. Often combined with equine influenza.',
    category: 'animal',
    animalTypes: 'horse',
  },
]

// ── Main ───────────────────────────────────────────────────────────────────────

async function main () {
  // Refresh the access token
  console.log('Refreshing access token…')
  try {
    access_token = await refreshToken()
    console.log('Token refreshed.')
  } catch (e) {
    console.warn('Token refresh failed, using cached token:', e.message)
  }

  console.log(`\nSeeding ${vaccines.length} vaccines to Vaccine_Library…\n`)

  for (const vaccine of vaccines) {
    try {
      const result = await addDoc(access_token, 'Vaccine_Library', vaccine)
      const name   = result.name?.split('/').pop() ?? '?'
      console.log(`  ✓  ${vaccine.Vac_Name.substring(0, 60).padEnd(62)} [${vaccine.category}]  id=${name}`)
    } catch (e) {
      console.error(`  ✗  ${vaccine.Vac_Name}: ${e.message}`)
    }
  }

  console.log('\nDone.')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
