/**
 * Per-disease country risk data for the world map visualisation.
 *
 * Country names match world-atlas@2 topojson `properties.name` exactly.
 *
 * ── How risk levels are classified ──────────────────────────────────────────
 *
 *   HIGH (red)
 *     Disease is endemic to the region; vaccination is REQUIRED for entry
 *     or is STRONGLY RECOMMENDED for all travellers by WHO / CDC / ECDC.
 *     Example: Yellow Fever is required to enter many Sub-Saharan African
 *     countries; malaria transmission is perennial.
 *
 *   MODERATE (amber)
 *     Disease is present in parts of the country or vaccination is
 *     RECOMMENDED for specific traveller types (rural/adventure travel,
 *     extended stays, healthcare workers, unvaccinated children).
 *     Example: Hepatitis B in Eastern Europe; Rabies in Gulf states.
 *
 *   LOW / NONE (grey)
 *     No significant risk for typical travellers — disease is absent,
 *     eradicated, or risk is negligible.
 *
 * ── Data sources ─────────────────────────────────────────────────────────────
 *   · CDC Travelers' Health destination pages (2024)
 *   · WHO International Travel and Health (2024 ed.)
 *   · WHO Weekly Epidemiological Record
 *   · ECDC Communicable Disease Threats Reports
 *   · GPEI (Global Polio Eradication Initiative)
 *   · WHO Global Tuberculosis Report 2023
 *
 * NOTE: Risk classifications are guidance for travel vaccination decisions.
 *       Always consult a travel medicine clinic for personalised advice —
 *       local outbreaks can change risk rapidly.
 *
 * NOTE: Admin-managed overrides are stored in Firestore (Disease_Risk/{entryId}).
 *       Firestore data takes precedence over the static entries below.
 *       These static entries serve as fallback when no Firestore doc exists.
 */

export interface DiseaseRisk {
  /** High endemic risk — vaccination required for entry or strongly recommended */
  high: string[]
  /** Moderate / regional risk — vaccination recommended for some travellers or areas */
  medium: string[]
  /**
   * Optional contextual note rendered below the map.
   * Use for eradicated diseases, globally-uniform risk, or special cases.
   */
  note?: string
}

// Country name aliases that differ between world-atlas names and common usage
const NAME_ALIASES: Record<string, string> = {
  'democratic republic of the congo': 'Dem. Rep. Congo',
  'republic of the congo': 'Congo',
  "ivory coast": "Côte d'Ivoire",
  'cote divoire': "Côte d'Ivoire",
  'south sudan': 'S. Sudan',
  'czech republic': 'Czechia',
  'united states': 'United States of America',
  'swaziland': 'eSwatini',
  'north macedonia': 'Macedonia',
  'cape verde': 'Cabo Verde',
  'east timor': 'Timor-Leste',
  'sao tome': 'São Tomé and Príncipe',
  'west bank': 'Palestine',
}

/**
 * Maps lowercase disease-target substrings → risk data.
 * Matched with `diseaseTarget.toLowerCase().includes(key)`.
 * More specific keys should appear before general ones if ambiguity exists.
 */
export const DISEASE_RISK_DATA: Record<string, DiseaseRisk> = {

  // ── Yellow Fever ────────────────────────────────────────────────────────────
  // Source: WHO yellow fever vaccination requirements + risk areas map (2024)
  'yellow fever': {
    high: [
      // Sub-Saharan Africa — endemic zones
      'Angola', 'Benin', 'Burkina Faso', 'Burundi', 'Cameroon',
      'Central African Rep.', 'Chad', 'Congo', 'Dem. Rep. Congo',
      "Côte d'Ivoire", 'Eq. Guinea', 'Ethiopia', 'Gabon', 'Gambia',
      'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Liberia',
      'Madagascar', 'Mali', 'Mauritania', 'Mozambique', 'Niger',
      'Nigeria', 'Rwanda', 'Senegal', 'Sierra Leone', 'Somalia',
      'S. Sudan', 'Sudan', 'Tanzania', 'Togo', 'Uganda', 'Zambia', 'Zimbabwe',
      // South America — Amazon and tropical zones
      'Bolivia', 'Brazil', 'Colombia', 'Ecuador', 'Guyana',
      'Peru', 'Suriname', 'Trinidad and Tobago', 'Venezuela',
    ],
    medium: [
      // Fringe / border-area risk
      'Argentina', 'Paraguay', 'Panama', 'Belize', 'Eritrea', 'Djibouti', 'Malawi',
    ],
  },

  // ── Mpox / Monkeypox ───────────────────────────────────────────────────────
  // Source: WHO MPOX situation reports (2024); clade I in Central Africa,
  // clade II global spread 2022–2024. Smallpox vaccine (JYNNEOS) is
  // the approved prevention for MPOX.
  'mpox': {
    high: [
      // Clade I endemic — Central/West Africa
      'Dem. Rep. Congo', 'Central African Rep.', 'Cameroon', 'Congo',
      'Gabon', 'Eq. Guinea',
    ],
    medium: [
      // Active clade II transmission or spillover
      'Nigeria', 'Ghana', "Côte d'Ivoire", 'Liberia', 'Sierra Leone',
      'Uganda', 'Rwanda', 'Kenya', 'S. Sudan', 'Burundi',
      // 2022–2024 global spread — ongoing low-level transmission
      'United States of America', 'United Kingdom', 'Germany', 'France',
      'Spain', 'Brazil', 'Colombia', 'Mexico',
    ],
    note: 'Mpox (formerly monkeypox) has two clades: Clade I is endemic in Central Africa with higher severity; Clade II caused a 2022–2024 global outbreak with ongoing low-level transmission in many countries. The JYNNEOS/Imvamune vaccine is approved for both mpox and smallpox prevention.',
  },

  // ── Smallpox ───────────────────────────────────────────────────────────────
  // Smallpox (Variola) was certified eradicated globally in 1980.
  // The vaccinia-based vaccine is now primarily used to protect against
  // mpox (monkeypox) — see mpox entry — and for bioterrorism preparedness.
  'smallpox': {
    high: [],
    medium: [],
    note: 'Smallpox (Variola virus) was certified globally eradicated by the WHO in 1980 — there is no current geographic risk from smallpox. Vaccination is used today for mpox (monkeypox) prevention in Central/West Africa and for bioterrorism preparedness for select high-risk personnel.',
  },

  // ── Variola (alias for smallpox Disease Target field) ─────────────────────
  'variola': {
    high: [],
    medium: [],
    note: 'Smallpox (Variola virus) was certified globally eradicated by the WHO in 1980 — there is no current geographic risk. The vaccine is now used for mpox prevention and bioterrorism preparedness.',
  },

  // ── Dengue ─────────────────────────────────────────────────────────────────
  // Source: CDC dengue; WHO dengue and severe dengue fact sheet (2024)
  'dengue': {
    high: [
      // Southeast Asia — highest burden
      'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar', 'Philippines',
      'Thailand', 'Vietnam', 'Timor-Leste', 'Singapore',
      // South Asia
      'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal',
      // East Asia
      'China',
      // Pacific
      'Papua New Guinea', 'Fiji', 'Vanuatu', 'Solomon Is.',
      // Latin America
      'Brazil', 'Colombia', 'Venezuela', 'Ecuador', 'Peru', 'Bolivia',
      'Paraguay', 'Nicaragua', 'Honduras', 'Costa Rica', 'Panama',
      'Guatemala', 'El Salvador', 'Belize', 'Mexico', 'Cuba',
      'Dominican Rep.', 'Haiti', 'Trinidad and Tobago',
      // Sub-Saharan Africa
      'Nigeria', 'Ethiopia', 'Kenya', 'Tanzania', 'Mozambique',
      'Angola', 'Somalia', 'Sudan', 'S. Sudan', "Côte d'Ivoire",
      'Ghana', 'Cameroon', 'Senegal', 'Burkina Faso',
      // East Africa
      'Uganda', 'Rwanda', 'Burundi',
    ],
    medium: [
      // Parts of Africa with sporadic transmission
      'South Africa', 'Madagascar', 'Malawi', 'Zambia', 'Zimbabwe',
      'Djibouti', 'Eritrea', 'Gambia', 'Guinea', 'Mali', 'Niger',
      // Indian subcontinent fringes
      'Afghanistan',
      // Middle East
      'Saudi Arabia', 'Yemen', 'Oman',
      // Pacific
      'Tonga', 'Samoa', 'Marshall Is.',
      // Caribbean
      'Jamaica', 'Barbados', 'Martinique', 'Guadeloupe',
    ],
    note: 'Dengue is transmitted by Aedes mosquitoes and is endemic in tropical and subtropical regions. Risk is elevated during the rainy season. No treatment exists — prevention via mosquito precautions and vaccination (where available) is key.',
  },

  // ── Malaria ─────────────────────────────────────────────────────────────────
  // Source: WHO World Malaria Report 2023. R21/Matrix-M vaccine approved 2023
  // for children in endemic areas. Traveller vaccination is separate from
  // chemoprophylaxis recommendations.
  'malaria': {
    high: [
      // Sub-Saharan Africa — 95% of global malaria deaths
      'Angola', 'Benin', 'Burkina Faso', 'Burundi', 'Cameroon',
      'Central African Rep.', 'Chad', 'Congo', 'Dem. Rep. Congo',
      "Côte d'Ivoire", 'Eq. Guinea', 'Ethiopia', 'Gabon', 'Gambia',
      'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Liberia',
      'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mozambique',
      'Niger', 'Nigeria', 'Rwanda', 'Senegal', 'Sierra Leone',
      'Somalia', 'S. Sudan', 'Sudan', 'Tanzania', 'Togo', 'Uganda',
      'Zambia', 'Zimbabwe', 'South Africa', 'Botswana', 'Namibia',
      // South/Southeast Asia
      'India', 'Pakistan', 'Bangladesh', 'Myanmar', 'Cambodia',
      'Laos', 'Papua New Guinea', 'Solomon Is.', 'Timor-Leste',
    ],
    medium: [
      // Latin America — lower transmission
      'Brazil', 'Colombia', 'Venezuela', 'Peru', 'Bolivia', 'Ecuador',
      'Guyana', 'Suriname', 'Paraguay', 'Nicaragua', 'Honduras',
      'Panama', 'Guatemala', 'Belize', 'Mexico', 'Haiti',
      // Middle East / Central Asia
      'Afghanistan', 'Iran', 'Saudi Arabia', 'Yemen',
      'Tajikistan', 'Uzbekistan',
      // Southeast Asia fringe
      'Thailand', 'Vietnam', 'Malaysia', 'Indonesia', 'Philippines',
    ],
    note: 'The RTS,S/AS01 (Mosquirix) and R21/Matrix-M vaccines are WHO-recommended for young children in Sub-Saharan Africa. Travellers typically rely on antimalarial chemoprophylaxis plus mosquito bite prevention rather than vaccination. Always consult a travel clinic before visiting endemic areas.',
  },

  // ── Rabies ──────────────────────────────────────────────────────────────────
  // Source: CDC Rabies around the world; WHO rabies fact sheet (2023)
  'rabies': {
    high: [
      // South Asia — highest global burden
      'India', 'Pakistan', 'Bangladesh', 'Nepal', 'Bhutan', 'Sri Lanka',
      // Southeast Asia
      'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar', 'Philippines',
      'Thailand', 'Vietnam', 'Timor-Leste',
      // East / Central Asia
      'China', 'Mongolia', 'Russia',
      'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan',
      // Middle East / North Africa
      'Afghanistan', 'Algeria', 'Egypt', 'Iran', 'Iraq', 'Jordan', 'Lebanon',
      'Libya', 'Morocco', 'Syria', 'Tunisia', 'Turkey', 'Yemen',
      // Sub-Saharan Africa
      'Angola', 'Cameroon', 'Central African Rep.', 'Chad', 'Congo', 'Dem. Rep. Congo',
      "Côte d'Ivoire", 'Ethiopia', 'Gabon', 'Ghana', 'Guinea', 'Kenya',
      'Liberia', 'Madagascar', 'Malawi', 'Mali', 'Mozambique', 'Niger',
      'Nigeria', 'Rwanda', 'Senegal', 'Sierra Leone', 'Somalia', 'South Africa',
      'S. Sudan', 'Sudan', 'Tanzania', 'Togo', 'Uganda', 'Zambia', 'Zimbabwe',
      // Latin America
      'Bolivia', 'Brazil', 'Colombia', 'Cuba', 'Dominican Rep.', 'Ecuador',
      'El Salvador', 'Guatemala', 'Haiti', 'Honduras', 'Mexico', 'Nicaragua',
      'Panama', 'Peru', 'Venezuela',
    ],
    medium: [
      // Eastern Europe — present but lower incidence; bat rabies in Western Europe
      'Belarus', 'Bulgaria', 'Croatia', 'Georgia', 'Hungary', 'Moldova',
      'Poland', 'Romania', 'Serbia', 'Ukraine',
      // Gulf / Arabian Peninsula
      'Saudi Arabia', 'United Arab Emirates', 'Oman', 'Kuwait',
    ],
  },

  // ── Typhoid ─────────────────────────────────────────────────────────────────
  // Source: CDC typhoid fever; WHO position paper on typhoid vaccines (2018)
  'typhoid': {
    high: [
      // South Asia
      'India', 'Pakistan', 'Bangladesh', 'Nepal', 'Bhutan', 'Sri Lanka',
      // Southeast Asia
      'Cambodia', 'Indonesia', 'Laos', 'Myanmar', 'Philippines', 'Thailand', 'Vietnam',
      // East Asia
      'China',
      // Central Asia
      'Afghanistan', 'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Uzbekistan',
      // Sub-Saharan Africa
      'Angola', 'Burundi', 'Cameroon', 'Central African Rep.', 'Chad',
      'Congo', 'Dem. Rep. Congo', "Côte d'Ivoire", 'Ethiopia', 'Ghana',
      'Guinea', 'Kenya', 'Liberia', 'Madagascar', 'Malawi', 'Mali',
      'Mozambique', 'Niger', 'Nigeria', 'Rwanda', 'Senegal', 'Sierra Leone',
      'Somalia', 'S. Sudan', 'Sudan', 'Tanzania', 'Togo', 'Uganda',
      'Zambia', 'Zimbabwe',
      // North Africa / Middle East
      'Algeria', 'Egypt', 'Iran', 'Iraq', 'Jordan', 'Lebanon', 'Libya',
      'Morocco', 'Syria', 'Tunisia', 'Turkey', 'Yemen',
      // Latin America
      'Bolivia', 'Colombia', 'Dominican Rep.', 'Ecuador', 'El Salvador',
      'Guatemala', 'Haiti', 'Honduras', 'Mexico', 'Nicaragua', 'Panama', 'Peru',
    ],
    medium: [
      'Moldova', 'Romania', 'Russia', 'Ukraine', 'Papua New Guinea', 'Solomon Is.',
    ],
  },

  // ── Hepatitis A ─────────────────────────────────────────────────────────────
  'hepatitis a': {
    high: [
      'India', 'Pakistan', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Afghanistan',
      'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar', 'Philippines',
      'Thailand', 'Vietnam', 'Timor-Leste', 'China', 'Mongolia',
      'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan',
      'Angola', 'Benin', 'Burkina Faso', 'Burundi', 'Cameroon', 'Central African Rep.',
      'Chad', 'Congo', 'Dem. Rep. Congo', "Côte d'Ivoire", 'Djibouti', 'Eritrea',
      'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau',
      'Kenya', 'Liberia', 'Madagascar', 'Malawi', 'Mali', 'Mauritania',
      'Mozambique', 'Niger', 'Nigeria', 'Rwanda', 'Senegal', 'Sierra Leone',
      'Somalia', 'South Africa', 'S. Sudan', 'Sudan', 'Tanzania', 'Togo',
      'Uganda', 'Zambia', 'Zimbabwe',
      'Algeria', 'Egypt', 'Iran', 'Iraq', 'Jordan', 'Lebanon', 'Libya',
      'Morocco', 'Syria', 'Tunisia', 'Turkey', 'Yemen', 'Saudi Arabia',
      'Bolivia', 'Brazil', 'Colombia', 'Cuba', 'Dominican Rep.', 'Ecuador',
      'El Salvador', 'Guatemala', 'Haiti', 'Honduras', 'Mexico', 'Nicaragua',
      'Panama', 'Paraguay', 'Peru', 'Venezuela',
      'Papua New Guinea', 'Solomon Is.',
    ],
    medium: [
      'Albania', 'Belarus', 'Bosnia and Herz.', 'Bulgaria', 'Croatia',
      'Georgia', 'Hungary', 'Moldova', 'Poland', 'Romania', 'Russia',
      'Serbia', 'Ukraine',
      'Trinidad and Tobago', 'Jamaica',
    ],
  },

  // ── Hepatitis B ─────────────────────────────────────────────────────────────
  'hepatitis b': {
    high: [
      'Angola', 'Benin', 'Burkina Faso', 'Burundi', 'Cameroon',
      'Central African Rep.', 'Chad', 'Congo', 'Dem. Rep. Congo',
      "Côte d'Ivoire", 'Djibouti', 'Eritrea', 'Ethiopia', 'Gabon',
      'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Liberia',
      'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mozambique',
      'Niger', 'Nigeria', 'Rwanda', 'Senegal', 'Sierra Leone',
      'Somalia', 'S. Sudan', 'Sudan', 'Tanzania', 'Togo', 'Uganda',
      'Zambia', 'Zimbabwe', 'South Africa', 'Botswana', 'Lesotho', 'eSwatini',
      'China', 'South Korea', 'Vietnam', 'Indonesia', 'Philippines',
      'Laos', 'Cambodia', 'Myanmar', 'Mongolia', 'Papua New Guinea',
      'Solomon Is.', 'Vanuatu',
    ],
    medium: [
      'India', 'Pakistan', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Afghanistan',
      'Iran', 'Iraq', 'Jordan', 'Lebanon', 'Saudi Arabia', 'Syria', 'Turkey',
      'Yemen', 'Egypt', 'Libya', 'Algeria', 'Morocco', 'Tunisia',
      'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan',
      'Russia', 'Ukraine', 'Belarus', 'Moldova', 'Romania', 'Bulgaria',
      'Bolivia', 'Brazil', 'Colombia', 'Haiti', 'Honduras', 'Peru', 'Venezuela',
      'Dominican Rep.', 'Ecuador', 'Guatemala', 'Mexico', 'Nicaragua', 'Panama',
      'El Salvador', 'Paraguay',
      'Thailand', 'Malaysia', 'Bhutan',
    ],
  },

  // ── Hepatitis C ─────────────────────────────────────────────────────────────
  // No approved vaccine; included for library completeness / risk awareness.
  // Source: WHO Global Hepatitis Report 2024
  'hepatitis c': {
    high: [
      'Egypt', 'Pakistan', 'China', 'India', 'Russia', 'Indonesia',
      'Nigeria', 'Vietnam', 'Ethiopia', 'Mongolia',
      'Dem. Rep. Congo', 'Cameroon', 'Gabon', 'Central African Rep.',
      'Uzbekistan', 'Tajikistan', 'Kyrgyzstan', 'Kazakhstan',
    ],
    medium: [
      'Iran', 'Iraq', 'Syria', 'Libya', 'Algeria', 'Morocco', 'Tunisia',
      'Brazil', 'Colombia', 'Mexico', 'Bolivia', 'Peru',
      'Ukraine', 'Moldova', 'Romania', 'Bulgaria', 'Georgia',
      'Thailand', 'Cambodia', 'Myanmar', 'Laos', 'Philippines',
    ],
    note: 'There is currently no approved vaccine for Hepatitis C. Risk data is provided for traveller awareness. Transmission is primarily through blood contact (unsafe injections, tattooing, etc.). Highly effective antiviral treatments are available.',
  },

  // ── Tuberculosis / BCG ──────────────────────────────────────────────────────
  // Source: WHO Global TB Report 2023. BCG is one of the world's most-used
  // vaccines; it primarily protects children from severe TB disease.
  // High-burden countries account for 87% of new TB cases.
  'tuberculosis': {
    high: [
      // WHO 30 high-burden TB countries
      'India', 'China', 'Indonesia', 'Philippines', 'Pakistan',
      'Nigeria', 'Bangladesh', 'Myanmar', 'Dem. Rep. Congo', 'Ethiopia',
      'Kenya', 'Mozambique', 'Angola', 'Tanzania', 'Zambia',
      'South Africa', 'Uganda', 'Papua New Guinea', 'Cambodia', 'Laos',
      'Viet Nam', 'Vietnam', 'North Korea', 'Russia',
      'Lesotho', 'eSwatini', 'Namibia', 'Botswana', 'Sierra Leone', 'Liberia',
    ],
    medium: [
      'Brazil', 'Peru', 'Bolivia', 'Colombia', 'Venezuela', 'Haiti',
      'Afghanistan', 'Nepal', 'Bhutan', 'Sri Lanka',
      'Tajikistan', 'Uzbekistan', 'Kyrgyzstan', 'Kazakhstan', 'Turkmenistan',
      'Ukraine', 'Moldova', 'Romania', 'Belarus',
      'Somalia', 'Sudan', 'S. Sudan', 'Mali', 'Niger', 'Chad', 'Cameroon',
      'Eritrea', 'Djibouti', 'Malawi', 'Zimbabwe', 'Madagascar',
      'Iran', 'Iraq', 'Yemen', 'Jordan', 'Georgia', 'Azerbaijan', 'Armenia',
      'Mongolia', 'Thailand', 'Malaysia',
    ],
    note: 'BCG vaccination is recommended for children travelling to or born in high-burden countries, and for adults with close contact with TB patients. Drug-resistant TB (MDR/XDR-TB) is a growing concern, particularly in Russia, Eastern Europe, and parts of Asia.',
  },

  // Alias for BCG field in library
  'bcg': {
    high: [
      'India', 'China', 'Indonesia', 'Philippines', 'Pakistan',
      'Nigeria', 'Bangladesh', 'Myanmar', 'Dem. Rep. Congo', 'Ethiopia',
      'Kenya', 'Mozambique', 'Angola', 'Tanzania', 'Zambia',
      'South Africa', 'Uganda', 'Papua New Guinea', 'Cambodia', 'Vietnam',
      'North Korea', 'Russia', 'Lesotho', 'eSwatini', 'Namibia', 'Botswana',
      'Sierra Leone', 'Liberia',
    ],
    medium: [
      'Brazil', 'Peru', 'Bolivia', 'Colombia', 'Venezuela', 'Haiti',
      'Afghanistan', 'Nepal', 'Sri Lanka',
      'Tajikistan', 'Uzbekistan', 'Kyrgyzstan', 'Kazakhstan',
      'Ukraine', 'Moldova', 'Romania', 'Belarus',
      'Somalia', 'Sudan', 'S. Sudan', 'Mali', 'Niger', 'Chad',
    ],
    note: 'BCG (Bacille Calmette-Guérin) is a vaccine against Tuberculosis. It is recommended for infants and young children in high-burden countries, and for unvaccinated adults with occupational or travel exposure risk.',
  },

  // ── Measles (and MMR) ───────────────────────────────────────────────────────
  // Source: WHO measles surveillance data (2024). Measles cases are rising
  // globally due to declining vaccination coverage post-COVID.
  'measles': {
    high: [
      // Sub-Saharan Africa — persistent transmission
      'Nigeria', 'Ethiopia', 'Dem. Rep. Congo', 'Angola', 'South Africa',
      'Kenya', 'Tanzania', 'Uganda', 'Cameroon', 'Mali', 'Niger', 'Chad',
      'Guinea', 'Sierra Leone', 'Liberia', "Côte d'Ivoire", 'Ghana',
      'Mozambique', 'Madagascar', 'Zambia', 'Zimbabwe', 'Somalia',
      // South / SE Asia
      'India', 'Pakistan', 'Bangladesh', 'Indonesia', 'Philippines',
      'Afghanistan', 'Myanmar', 'Papua New Guinea', 'Timor-Leste',
      // High-profile outbreak / low coverage
      'Yemen', 'Syria', 'Iraq',
    ],
    medium: [
      // Eastern Europe / Caucasus — outbreak-prone
      'Ukraine', 'Russia', 'Romania', 'Georgia', 'Kazakhstan', 'Kyrgyzstan',
      // SE Asia lower coverage
      'Cambodia', 'Laos', 'Vietnam', 'Thailand', 'Nepal',
      // Middle East
      'Iran', 'Egypt', 'Sudan', 'Libya',
      // Latin America
      'Brazil', 'Venezuela', 'Colombia', 'Bolivia', 'Haiti',
    ],
    note: 'Measles is highly contagious. Unvaccinated travellers are at risk in any country with ongoing transmission. Two doses of MMR vaccine provide ~97% protection. Global measles cases surged after COVID-19 disrupted vaccination programmes.',
  },

  'mmr': {
    high: [
      'Nigeria', 'Ethiopia', 'Dem. Rep. Congo', 'Angola', 'South Africa',
      'Kenya', 'Tanzania', 'Uganda', 'Cameroon', 'Mali', 'Niger',
      'India', 'Pakistan', 'Bangladesh', 'Indonesia', 'Philippines',
      'Afghanistan', 'Myanmar', 'Yemen', 'Syria',
    ],
    medium: [
      'Ukraine', 'Russia', 'Romania', 'Georgia', 'Kazakhstan',
      'Cambodia', 'Laos', 'Vietnam', 'Nepal',
      'Brazil', 'Venezuela', 'Colombia', 'Haiti',
    ],
    note: 'MMR covers Measles, Mumps, and Rubella. Two doses are recommended for all unvaccinated travellers. Outbreaks can occur in any country with low vaccination coverage.',
  },

  // ── Ebola ───────────────────────────────────────────────────────────────────
  // Source: WHO Ebola situation reports. rVSV-ZEBOV (Ervebo) approved 2019.
  'ebola': {
    high: [
      'Dem. Rep. Congo',           // Largest outbreak history; clade Zaire
      'Uganda',                    // Sudan clade outbreaks
      'Guinea', 'Sierra Leone', 'Liberia',  // 2014–16 West Africa epidemic
    ],
    medium: [
      'Central African Rep.', 'Congo', 'Gabon', 'Cameroon',
      'Rwanda', 'Burundi', 'South Sudan', 'Nigeria',
    ],
    note: 'The Ervebo (rVSV-ZEBOV) vaccine protects against Ebola virus (Zaire species) and is used in ring vaccination campaigns during outbreaks. Risk for travellers is generally very low unless visiting outbreak zones or providing healthcare in endemic areas.',
  },

  // ── Zika ────────────────────────────────────────────────────────────────────
  // No approved vaccine as of 2024. Included for awareness.
  'zika': {
    high: [
      // Americas — peak 2015–2016 outbreak; ongoing low-level transmission
      'Brazil', 'Colombia', 'Venezuela', 'Ecuador', 'Peru', 'Bolivia',
      'Paraguay', 'Guyana', 'Suriname',
      'Mexico', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua',
      'Costa Rica', 'Panama', 'Belize',
      'Dominican Rep.', 'Haiti', 'Cuba', 'Trinidad and Tobago', 'Jamaica',
      // Southeast Asia
      'Thailand', 'Vietnam', 'Cambodia', 'Indonesia', 'Philippines',
      'Malaysia', 'Singapore', 'Myanmar', 'Laos',
    ],
    medium: [
      // Pacific Islands
      'Papua New Guinea', 'Fiji', 'Vanuatu', 'Samoa', 'Tonga',
      // Africa — sporadic cases
      'Nigeria', "Côte d'Ivoire", 'Senegal', 'Uganda', 'Tanzania',
      'Central African Rep.', 'Gabon', 'Cameroon',
      // South Asia
      'India', 'Bangladesh', 'Pakistan',
    ],
    note: 'There is no approved vaccine for Zika virus as of 2024. Prevention relies on mosquito bite precautions. Zika poses serious risks during pregnancy (microcephaly, brain defects). Pregnant travellers should avoid high-risk areas.',
  },

  // ── Cholera ─────────────────────────────────────────────────────────────────
  'cholera': {
    high: [
      'Angola', 'Burundi', 'Cameroon', 'Central African Rep.', 'Chad',
      'Congo', 'Dem. Rep. Congo', 'Djibouti', 'Ethiopia', 'Ghana',
      'Guinea', 'Guinea-Bissau', 'Kenya', 'Malawi', 'Mozambique',
      'Niger', 'Nigeria', 'Sierra Leone', 'Somalia', 'S. Sudan', 'Sudan',
      'Tanzania', 'Togo', 'Uganda', 'Zambia', 'Zimbabwe',
      'Haiti', 'India', 'Pakistan', 'Bangladesh', 'Yemen',
    ],
    medium: [
      'Cambodia', 'Indonesia', 'Laos', 'Myanmar', 'Philippines', 'Vietnam',
      'Papua New Guinea', 'Bolivia', 'Peru', 'Egypt',
    ],
  },

  // ── Japanese Encephalitis ───────────────────────────────────────────────────
  'japanese encephalitis': {
    high: [
      'India', 'Nepal', 'Sri Lanka', 'Bangladesh',
      'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar',
      'Philippines', 'Thailand', 'Timor-Leste', 'Vietnam',
      'China', 'South Korea', 'Pakistan',
    ],
    medium: [
      'Japan', 'North Korea', 'Papua New Guinea', 'Bhutan',
    ],
  },

  // ── Tick-Borne Encephalitis ─────────────────────────────────────────────────
  'tick-borne encephalitis': {
    high: [
      'Russia', 'Belarus', 'Ukraine', 'Lithuania', 'Latvia', 'Estonia',
      'Poland', 'Czechia', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria',
      'Austria', 'Germany', 'Switzerland', 'Finland', 'Sweden', 'Norway',
      'Kazakhstan', 'Mongolia',
    ],
    medium: [
      'Moldova', 'Serbia', 'Croatia', 'Slovenia', 'Bosnia and Herz.',
      'Macedonia', 'Albania', 'Kyrgyzstan', 'France', 'Italy', 'Denmark',
    ],
  },

  // ── Meningococcal ───────────────────────────────────────────────────────────
  'meningococcal': {
    high: [
      // Meningitis belt
      'Benin', 'Burkina Faso', 'Cameroon', 'Central African Rep.', 'Chad',
      "Côte d'Ivoire", 'Djibouti', 'Eritrea', 'Ethiopia', 'Gambia',
      'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Mali', 'Mauritania',
      'Niger', 'Nigeria', 'Rwanda', 'Senegal', 'Sierra Leone',
      'S. Sudan', 'Sudan', 'Tanzania', 'Togo', 'Uganda',
      'Saudi Arabia',  // required for Hajj / Umrah
    ],
    medium: [
      'India', 'Pakistan', 'South Africa', 'Zimbabwe', 'Malawi', 'Zambia', 'Mongolia',
    ],
  },

  // ── Polio ───────────────────────────────────────────────────────────────────
  'polio': {
    high: [
      'Afghanistan', 'Pakistan',  // wild poliovirus (WPV1) endemic
    ],
    medium: [
      // Circulating vaccine-derived poliovirus (cVDPV) outbreaks
      'Nigeria', 'Chad', 'Central African Rep.', 'Dem. Rep. Congo',
      'Ethiopia', 'Cameroon', 'Somalia', 'S. Sudan', 'Niger',
      'Mozambique', 'Madagascar', 'Tanzania', 'Yemen',
    ],
  },

  // ── Influenza ──────────────────────────────────────────────────────────────
  // Influenza is seasonal and globally present. The map reflects countries
  // with higher clinical burden, year-round transmission, or limited
  // healthcare access where disease is more severe.
  'influenza': {
    high: [],
    medium: [
      // Year-round / tropical influenza (no defined season)
      'India', 'Bangladesh', 'Indonesia', 'Philippines', 'Vietnam',
      'Cambodia', 'Laos', 'Myanmar', 'Thailand', 'Malaysia',
      'Nigeria', 'Ethiopia', 'Kenya', 'Tanzania', 'Uganda', 'Cameroon',
      'Dem. Rep. Congo', 'Ghana', 'Senegal', 'Mali', 'Niger',
      'Brazil', 'Colombia', 'Venezuela', 'Peru', 'Bolivia',
      'Mexico', 'Guatemala', 'Honduras', 'Nicaragua', 'Haiti',
      'Pakistan', 'Afghanistan', 'Nepal', 'China', 'Egypt', 'Sudan',
    ],
    note: 'Influenza circulates globally year-round in tropical regions and seasonally in temperate regions (Oct–Mar northern hemisphere; Apr–Sep southern hemisphere). Annual vaccination is recommended for all travellers, especially those visiting large gatherings or immunocompromised individuals.',
  },

  // Alias for "flu" in disease target fields
  'flu': {
    high: [],
    medium: [
      'India', 'Bangladesh', 'Indonesia', 'Philippines', 'Vietnam',
      'Nigeria', 'Ethiopia', 'Kenya', 'Tanzania',
      'Brazil', 'Colombia', 'Peru',
      'China', 'Egypt',
    ],
    note: 'Influenza circulates globally. Annual vaccination is recommended for all travellers. See also: Influenza.',
  },

  // ── COVID-19 ────────────────────────────────────────────────────────────────
  // COVID-19 is endemic globally as of 2024. No single high-risk destination
  // applies; risk is modulated by local vaccination coverage, variant
  // prevalence, and healthcare system capacity.
  'covid': {
    high: [],
    medium: [
      // Countries with lower vaccination coverage and limited healthcare access
      'Nigeria', 'Ethiopia', 'Dem. Rep. Congo', 'Tanzania', 'Uganda',
      'Niger', 'Mali', 'Chad', 'Cameroon', 'Guinea', 'Sierra Leone',
      'Afghanistan', 'Yemen', 'Syria', 'Somalia', 'S. Sudan', 'Haiti',
      'Papua New Guinea', 'Timor-Leste',
      // High population density / variant emergence
      'India', 'Pakistan', 'Bangladesh', 'Indonesia', 'Philippines',
      'Vietnam', 'Myanmar', 'Cambodia', 'China',
      'Brazil', 'Colombia', 'Peru', 'Bolivia',
      'Russia', 'Ukraine',
    ],
    note: 'COVID-19 is now endemic worldwide. The map highlights countries with lower vaccination coverage or more limited healthcare infrastructure where illness may be more severe. Up-to-date COVID-19 vaccination is recommended before international travel regardless of destination.',
  },

  // ── Rotavirus ──────────────────────────────────────────────────────────────
  // Source: WHO rotavirus bulletin. Rotavirus is a leading cause of severe
  // childhood diarrhoea globally; highest burden in low/middle-income countries.
  'rotavirus': {
    high: [
      'India', 'Pakistan', 'Bangladesh', 'Nigeria', 'Ethiopia', 'Dem. Rep. Congo',
      'Uganda', 'Kenya', 'Tanzania', 'Mozambique', 'Angola', 'Niger', 'Mali',
      'Burkina Faso', 'Chad', 'Guinea', 'Sierra Leone', "Côte d'Ivoire",
      'Ghana', 'Cameroon', 'Central African Rep.', 'Somalia', 'Sudan',
      'Afghanistan', 'Myanmar', 'Indonesia', 'Philippines', 'Papua New Guinea',
      'Haiti', 'Bolivia', 'Peru', 'Guatemala', 'Honduras', 'Nicaragua',
    ],
    medium: [
      'China', 'Vietnam', 'Cambodia', 'Laos', 'Thailand', 'Malaysia',
      'Sri Lanka', 'Nepal', 'Bhutan',
      'Brazil', 'Colombia', 'Ecuador', 'Venezuela', 'Paraguay',
      'Egypt', 'Jordan', 'Iraq', 'Yemen', 'Libya', 'Algeria', 'Morocco',
      'South Africa', 'Namibia', 'Botswana', 'Zambia', 'Zimbabwe', 'Malawi',
      'Madagascar',
    ],
    note: 'Rotavirus is the leading cause of severe diarrhoea in children under 5 worldwide. Vaccination (Rotarix / RotaTeq) is strongly recommended for infants. Travellers with young unvaccinated children should be especially cautious in high-burden areas.',
  },

  // ── Typhus ─────────────────────────────────────────────────────────────────
  // Scrub typhus: South/Southeast Asia, Western Pacific
  // Murine typhus: global tropics/subtropics
  'typhus': {
    high: [
      // Scrub typhus belt — South/SE Asia
      'India', 'Pakistan', 'Nepal', 'Sri Lanka', 'Bangladesh',
      'Thailand', 'Vietnam', 'Cambodia', 'Laos', 'Myanmar', 'Indonesia',
      'Philippines', 'China', 'South Korea', 'Japan', 'Taiwan',
      'Papua New Guinea', 'Timor-Leste',
    ],
    medium: [
      // Murine typhus — tropics globally
      'Nigeria', 'Ethiopia', 'Kenya', 'Tanzania', 'Mozambique',
      'Brazil', 'Colombia', 'Peru', 'Mexico', 'Guatemala',
      'Egypt', 'Iran', 'Iraq', 'Turkey', 'Yemen',
      'Russia', 'Kazakhstan', 'Tajikistan',
    ],
    note: 'Scrub typhus (Orientia tsutsugamushi) is endemic in the "tsutsugamushi triangle" of South and Southeast Asia. Murine typhus occurs in tropical and subtropical regions globally. Prevention: insect repellents and protective clothing.',
  },

  // ── HPV ─────────────────────────────────────────────────────────────────────
  // HPV-associated cancers have the highest burden in low-income countries
  // with limited screening programmes.
  'hpv': {
    high: [
      // Highest cervical cancer burden
      'Zambia', 'Zimbabwe', 'Malawi', 'Tanzania', 'Mozambique', 'Uganda',
      'Rwanda', 'Burundi', 'Kenya', 'Ethiopia', 'South Africa', 'eSwatini',
      'Lesotho', 'Botswana', 'Namibia', 'Angola', 'Cameroon', 'Nigeria',
      'Dem. Rep. Congo', 'Central African Rep.', 'Guinea', 'Mali',
      'Sierra Leone', "Côte d'Ivoire", 'Ghana', 'Senegal',
      // South / SE Asia
      'India', 'Bangladesh', 'Myanmar', 'Papua New Guinea',
      // Latin America
      'Bolivia', 'Paraguay', 'Guatemala', 'Honduras', 'Nicaragua', 'Haiti',
    ],
    medium: [
      'Brazil', 'Colombia', 'Peru', 'Ecuador', 'Venezuela', 'Mexico',
      'Indonesia', 'Philippines', 'Vietnam', 'Cambodia', 'Laos',
      'Pakistan', 'Nepal', 'Afghanistan', 'Sri Lanka',
      'Egypt', 'Morocco', 'Algeria', 'Libya', 'Sudan', 'Somalia',
      'Madagascar', 'Niger', 'Chad',
      'Russia', 'Ukraine', 'Moldova', 'Romania',
    ],
    note: 'HPV vaccination prevents cervical, throat, anal, and other HPV-associated cancers. Recommended for all adolescents regardless of travel plans. Countries with limited cervical screening programmes have significantly higher cervical cancer incidence.',
  },

  // ── Anthrax ─────────────────────────────────────────────────────────────────
  // Source: USDA/CDC anthrax global data. Primarily occupational/agricultural risk.
  'anthrax': {
    high: [
      // Highest veterinary anthrax / soil contamination
      'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Uzbekistan', 'Turkmenistan',
      'Russia', 'Georgia', 'Azerbaijan',
      'Pakistan', 'Afghanistan', 'Iran', 'Iraq', 'Turkey',
      'Chad', 'Niger', 'Mali', 'Nigeria', 'Ethiopia', 'Kenya', 'Tanzania',
      'Zimbabwe', 'Zambia', 'South Africa',
    ],
    medium: [
      'Mongolia', 'China', 'India', 'Bangladesh',
      'Brazil', 'Colombia', 'Bolivia',
      'Romania', 'Ukraine', 'Hungary', 'Serbia',
    ],
    note: 'Anthrax is primarily an occupational risk for those working with livestock, animal hides/wool, or in affected soil. Travel vaccination is recommended only for specific high-risk occupations. Human cases from natural exposure are rare.',
  },

  // ── Plague ──────────────────────────────────────────────────────────────────
  // Source: WHO plague fact sheet (2024)
  'plague': {
    high: [
      'Madagascar',        // majority of global cases
      'Dem. Rep. Congo',
      'Peru',
    ],
    medium: [
      'Tanzania', 'Mozambique', 'Uganda', 'Zambia', 'Zimbabwe',
      'Bolivia', 'Ecuador', 'Colombia',
      'Mongolia', 'China', 'Russia', 'Kazakhstan',
      'United States of America',  // western US rodent reservoirs
    ],
    note: 'Plague (Yersinia pestis) is rare in travellers. Madagascar accounts for most reported cases. No widely available commercial vaccine exists in most countries. Prevention: avoid sick or dead rodents and their fleas.',
  },


  // ══════════════════════════════════════════════════════════════════════════════
  // ANIMAL / VETERINARY DISEASES
  // Sources: OIE/WOAH World Animal Health Information System (2024),
  //          FAO EMPRES Global Animal Disease Information System,
  //          USDA APHIS animal health status reports.
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Foot-and-Mouth Disease (FMD) ────────────────────────────────────────────
  'foot-and-mouth': {
    high: [
      // FMD endemic belt — OIE zone 2 (not FMD-free)
      'Afghanistan', 'Pakistan', 'India', 'Nepal', 'Bangladesh', 'Sri Lanka',
      'Iran', 'Iraq', 'Turkey', 'Syria', 'Lebanon', 'Jordan', 'Saudi Arabia',
      'Yemen', 'Oman', 'UAE', 'Qatar', 'Kuwait', 'Bahrain',
      'Ethiopia', 'Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Burundi',
      'Dem. Rep. Congo', 'South Sudan', 'Sudan', 'Somalia', 'Djibouti',
      'Mozambique', 'Zimbabwe', 'Zambia', 'Malawi', 'Angola', 'Namibia',
      'Nigeria', 'Niger', 'Chad', 'Cameroon', 'Burkina Faso', 'Mali',
      'Senegal', 'Guinea', 'Guinea-Bissau', 'Gambia', "Côte d'Ivoire",
      'Ghana', 'Togo', 'Benin', 'Liberia', 'Sierra Leone',
      'Egypt', 'Libya', 'Algeria', 'Morocco', 'Tunisia',
      'China', 'Myanmar', 'Thailand', 'Laos', 'Vietnam', 'Cambodia',
      'Indonesia', 'Malaysia', 'Philippines',
      'Mongolia', 'Russia', 'Kazakhstan', 'Kyrgyzstan',
      'Bolivia', 'Peru', 'Colombia', 'Venezuela', 'Ecuador',
    ],
    medium: [
      'South Africa', 'Botswana', 'Lesotho', 'Swaziland',
      'Brazil', 'Argentina', 'Paraguay', 'Uruguay',
      'Georgia', 'Azerbaijan', 'Armenia',
      'Japan',  // occasional outbreaks
      'South Korea',
    ],
    note: 'Foot-and-Mouth Disease (FMD) is one of the most economically significant livestock diseases globally. Many developed countries (EU, USA, Canada, Australia, NZ) are FMD-free. Vaccination of livestock is mandatory or strongly recommended in endemic zones. Movement restrictions may apply to animals entering FMD-free countries.',
  },

  // ── Bovine Viral Diarrhoea (BVD) / Bovine Respiratory Syncytial Virus ───────
  'bovine viral diarrhoea': {
    high: [],
    medium: [
      // BVD is present worldwide in cattle populations; highest impact in intensively farmed regions
      'United Kingdom', 'Ireland', 'Germany', 'France', 'Netherlands', 'Belgium',
      'Denmark', 'Norway', 'Sweden', 'Finland',
      'United States of America', 'Canada', 'Brazil', 'Argentina',
      'Australia', 'New Zealand', 'Japan',
    ],
    note: 'Bovine Viral Diarrhoea (BVD) occurs worldwide in cattle. Risk is highest in intensively farmed dairy and beef systems. Several EU countries have active national eradication programmes. Vaccination is widely used to prevent Persistently Infected (PI) calves.',
  },

  // ── Infectious Bovine Rhinotracheitis (IBR) ──────────────────────────────────
  'infectious bovine rhinotracheitis': {
    high: [],
    medium: [
      'United States of America', 'Canada', 'Brazil', 'Argentina',
      'Australia', 'United Kingdom', 'Ireland', 'Germany', 'France',
      'Netherlands', 'Belgium', 'Spain', 'Italy', 'Poland',
    ],
    note: 'IBR (caused by Bovine Herpesvirus 1, BoHV-1) occurs worldwide. Several EU/EEA countries have official IBR-free or eradication status. Vaccination is commonly used for control; some countries require marker vaccines to allow trade movement.',
  },

  // ── Newcastle Disease (ND / Avian Paramyxovirus) ────────────────────────────
  'newcastle disease': {
    high: [
      // Endemic — routine vaccination required
      'Nigeria', 'Ghana', 'Ethiopia', 'Kenya', 'Tanzania', 'Uganda',
      'Cameroon', 'Dem. Rep. Congo', 'Burkina Faso', 'Senegal', 'Niger',
      'Egypt', 'Sudan', 'Ethiopia', 'Somalia',
      'India', 'Bangladesh', 'Pakistan', 'Nepal', 'Sri Lanka',
      'Indonesia', 'Philippines', 'Vietnam', 'Myanmar', 'Cambodia', 'Laos',
      'China', 'Mongolia',
      'Russia', 'Kazakhstan', 'Ukraine',
      'Colombia', 'Venezuela', 'Peru', 'Bolivia',
    ],
    medium: [
      'Morocco', 'Algeria', 'Libya', 'Tunisia',
      'Saudi Arabia', 'Iran', 'Iraq', 'Turkey',
      'South Africa', 'Zimbabwe', 'Zambia',
      'Brazil', 'Argentina', 'Mexico',
      'United States of America',  // outbreaks in backyard flocks
      'Australia',
    ],
    note: 'Newcastle Disease is one of the most significant poultry diseases worldwide. Vaccination is required in most endemic regions. Velogenic strains can cause near 100% flock mortality. Report outbreaks to the national veterinary authority immediately.',
  },

  // ── Avian Influenza (Highly Pathogenic — HPAI) ─────────────────────────────
  'avian influenza': {
    high: [
      // Active HPAI H5N1 or H5Nx circulation (WOAH 2023-24)
      'China', 'Vietnam', 'Indonesia', 'Cambodia', 'Laos', 'Bangladesh',
      'India', 'Nepal', 'Myanmar', 'Thailand',
      'Nigeria', 'Egypt', 'Burkina Faso', 'Niger', 'Ghana', 'Cameroon',
      'Ethiopia', 'Kenya', 'Uganda', 'Dem. Rep. Congo',
      'Russia', 'Kazakhstan', 'Mongolia',
    ],
    medium: [
      // Seasonal/migratory outbreaks
      'United Kingdom', 'Ireland', 'France', 'Germany', 'Netherlands', 'Belgium',
      'Poland', 'Sweden', 'Denmark', 'Finland', 'Norway',
      'Japan', 'South Korea', 'Taiwan',
      'United States of America', 'Canada',
      'Morocco', 'Algeria', 'Libya',
      'Iran', 'Iraq', 'Turkey',
    ],
    note: 'Highly Pathogenic Avian Influenza (HPAI) is a serious threat to both commercial and backyard poultry. H5N1 clade 2.3.4.4b is currently circulating globally via migratory wild birds. Vaccination of poultry is practised in many endemic countries. Some strains can infect mammals (including cattle in the USA, 2024). Human risk from direct contact with infected birds is low but not zero.',
  },

  // ── Equine Influenza ─────────────────────────────────────────────────────────
  'equine influenza': {
    high: [],
    medium: [
      // Equine influenza is globally distributed; highest risk where horses congregate
      'United Kingdom', 'Ireland', 'France', 'Germany', 'United States of America',
      'Australia', 'Japan', 'South Africa', 'Brazil', 'Argentina',
    ],
    note: 'Equine influenza occurs worldwide and spreads rapidly at events (racecourses, shows). Annual or bi-annual vaccination is standard in most equine disciplines. Some FEI competitions require proof of vaccination. Australia experienced its first outbreak in 2007; it is now equine influenza-free again.',
  },

  // ── Equine Herpesvirus (EHV / Rhinopneumonitis) ──────────────────────────────
  'equine herpesvirus': {
    high: [],
    medium: [
      'United Kingdom', 'Ireland', 'Germany', 'France', 'Netherlands',
      'United States of America', 'Canada', 'Brazil', 'Australia',
    ],
    note: 'EHV-1 and EHV-4 are widespread globally in horse populations. EHV-1 can cause neurological disease (Equine Herpesvirus Myeloencephalopathy — EHM), abortion and respiratory illness. Vaccination reduces viral shedding and the risk of abortion. No vaccine fully prevents neurological disease.',
  },

  // ── Canine Distemper ─────────────────────────────────────────────────────────
  'canine distemper': {
    high: [
      // Highest prevalence in unvaccinated populations
      'India', 'Bangladesh', 'Pakistan', 'Nepal', 'Sri Lanka',
      'Ethiopia', 'Kenya', 'Nigeria', 'Tanzania', 'Uganda',
      'Dem. Rep. Congo', 'Sudan', 'South Sudan',
      'Indonesia', 'Philippines', 'Vietnam', 'Myanmar',
      'Haiti', 'Bolivia', 'Peru', 'Ecuador',
    ],
    medium: [
      'Brazil', 'Colombia', 'Venezuela', 'Argentina', 'Mexico',
      'China', 'Russia', 'Ukraine', 'Romania',
      'Morocco', 'Egypt', 'South Africa',
    ],
    note: 'Canine distemper is a leading cause of death in unvaccinated dogs worldwide. Core vaccine for dogs globally. Wildlife populations (wolves, foxes, lions, seals) can also be affected. Highly contagious via aerosol and direct contact.',
  },

  // ── Canine Parvovirus ────────────────────────────────────────────────────────
  'canine parvovirus': {
    high: [
      // Mortality high where vaccination is low
      'India', 'Bangladesh', 'Pakistan', 'Nepal',
      'Nigeria', 'Kenya', 'Tanzania', 'Ethiopia', 'Uganda',
      'Indonesia', 'Philippines', 'Vietnam',
      'Haiti', 'Bolivia', 'Peru',
      'Russia', 'Ukraine', 'Romania', 'Bulgaria',
    ],
    medium: [
      'Brazil', 'Colombia', 'Mexico', 'Argentina',
      'China', 'South Africa', 'Morocco', 'Egypt',
      'United States of America', 'United Kingdom',  // outbreaks in under-vaccinated pups
    ],
    note: 'Canine parvovirus (CPV-2) causes severe haemorrhagic gastroenteritis and is highly environmentally stable. Core vaccine for all dogs. Puppies are most at risk. Outbreak risk is elevated where street-dog populations are large and vaccination rates are low.',
  },

  // ── Feline Panleukopenia (FPV / Cat Distemper) ──────────────────────────────
  'feline panleukopenia': {
    high: [
      'India', 'Bangladesh', 'Nepal', 'Sri Lanka',
      'Nigeria', 'Kenya', 'Tanzania', 'Ethiopia',
      'Indonesia', 'Philippines', 'Vietnam',
      'Haiti', 'Bolivia', 'Peru',
      'Russia', 'Ukraine', 'Romania',
    ],
    medium: [
      'Brazil', 'Colombia', 'Mexico', 'Argentina',
      'China', 'South Africa', 'Egypt',
    ],
    note: 'Feline panleukopenia (FPV) is a highly contagious and often fatal disease in unvaccinated cats. Core vaccine for all domestic cats. The virus is extremely environmentally persistent. Feral and shelter cat populations are at highest risk.',
  },

  // ── Leptospirosis (multi-species) ────────────────────────────────────────────
  'leptospirosis': {
    high: [
      // Hyperendemic — high rainfall, flooding, livestock/dog contact
      'India', 'Sri Lanka', 'Bangladesh', 'Nepal', 'Myanmar',
      'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Malaysia',
      'Brazil', 'Colombia', 'Peru', 'Bolivia', 'Ecuador', 'Venezuela',
      'Trinidad and Tobago', 'Barbados', 'Jamaica', 'Haiti',
      'Nigeria', 'Ghana', 'Cameroon', 'Dem. Rep. Congo',
      'Kenya', 'Tanzania', 'Uganda', 'Ethiopia',
      'Seychelles', 'Reunion',
    ],
    medium: [
      'Argentina', 'Uruguay', 'Paraguay', 'Mexico',
      'South Africa', 'Zimbabwe', 'Zambia', 'Mozambique',
      'Russia', 'Ukraine', 'Poland', 'Romania',
      'China', 'Pakistan', 'Iran',
      'United Kingdom', 'Ireland', 'Netherlands',  // cattle/dog occupational risk
      'United States of America', 'Australia',
    ],
    note: 'Leptospirosis affects a wide range of mammals including dogs, cattle, pigs, horses and rodents. Core or non-core vaccine for dogs depending on local prevalence. Cattle vaccination is practised widely in endemic regions. A zoonosis — humans can be infected from animal urine. Risk is highest after flooding events.',
  },

  // ── Bovine Brucellosis (Brucella abortus) ───────────────────────────────────
  'brucellosis': {
    high: [
      // OIE-listed countries without official brucellosis-free status
      'India', 'Pakistan', 'Afghanistan', 'Iran', 'Iraq', 'Turkey',
      'Saudi Arabia', 'Yemen', 'Syria', 'Jordan', 'Lebanon',
      'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Uzbekistan', 'Turkmenistan',
      'Russia', 'Ukraine', 'Georgia', 'Azerbaijan', 'Armenia',
      'Ethiopia', 'Kenya', 'Uganda', 'Tanzania', 'Nigeria',
      'Sudan', 'South Sudan', 'Chad', 'Niger', 'Mali',
      'Egypt', 'Libya', 'Algeria', 'Morocco', 'Tunisia',
      'China', 'Mongolia',
      'Mexico', 'Brazil', 'Colombia', 'Peru', 'Bolivia',
    ],
    medium: [
      'Spain', 'Portugal', 'Italy', 'Greece',
      'Poland', 'Romania', 'Bulgaria', 'Serbia',
      'South Africa', 'Zimbabwe', 'Zambia', 'Mozambique',
    ],
    note: 'Brucellosis (Brucella abortus in cattle and B. melitensis in small ruminants) causes abortion and reproductive failure in livestock. Vaccination with S19 or RB51 (cattle) or Rev.1 (small ruminants) is used in endemic areas. A serious zoonosis — humans are infected via unpasteurised dairy products or contact with aborted material.',
  },

  // ── Porcine Reproductive & Respiratory Syndrome (PRRS) ──────────────────────
  'prrs': {
    high: [
      'China', 'Vietnam', 'Thailand', 'Philippines', 'South Korea', 'Japan',
      'United States of America', 'Canada', 'Mexico', 'Brazil', 'Colombia',
    ],
    medium: [
      'Germany', 'Netherlands', 'Belgium', 'Denmark', 'Spain', 'France',
      'Poland', 'Russia', 'Ukraine',
      'South Africa', 'Australia',
    ],
    note: 'PRRS is one of the most economically significant pig diseases worldwide, causing reproductive failure and respiratory disease. Vaccination is widely used but does not provide complete cross-protection due to high viral genetic diversity. The US and Asia are particularly affected.',
  },

  // ── Classical Swine Fever (CSF / Hog Cholera) ───────────────────────────────
  'classical swine fever': {
    high: [
      'China', 'Vietnam', 'Cambodia', 'Laos', 'Myanmar', 'Thailand', 'Indonesia',
      'Philippines', 'Mongolia',
      'India', 'Bangladesh', 'Nepal', 'Sri Lanka',
      'Russia', 'Ukraine', 'Belarus', 'Moldova',
      'Brazil', 'Colombia', 'Peru', 'Bolivia', 'Ecuador', 'Venezuela',
      'Haiti', 'Dominican Republic', 'Cuba',
      'Nigeria', 'Dem. Rep. Congo', 'Ethiopia', 'Kenya', 'Tanzania',
    ],
    medium: [
      'Romania', 'Hungary', 'Serbia', 'Croatia', 'Slovakia',
      'South Korea', 'Japan',
      'South Africa', 'Zimbabwe', 'Zambia',
    ],
    note: 'Classical Swine Fever (CSF) is a highly contagious viral disease of pigs. Many countries (EU, USA, Australia, Canada) maintain CSF-free status through strict surveillance and no-vaccination policies. In endemic zones vaccination is the primary control measure.',
  },

}

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Finds risk data for a disease by matching the vaccine's Disease Target field.
 * Uses substring matching (case-insensitive) to handle variations like
 * "Hepatitis A Virus (HAV)" or "SARS-CoV-2 (COVID-19)".
 */
export function getRiskForDisease(diseaseTarget: string): DiseaseRisk | null {
  const dl = diseaseTarget.toLowerCase()
  for (const [key, data] of Object.entries(DISEASE_RISK_DATA)) {
    if (dl.includes(key)) return data
  }
  return null
}

/**
 * Returns the risk level for a given world-atlas country name.
 */
export function getCountryRisk(
  countryName: string,
  risk: DiseaseRisk,
): 'high' | 'medium' | 'none' {
  if (risk.high.includes(countryName)) return 'high'
  if (risk.medium.includes(countryName)) return 'medium'
  // Try alias lookup
  const canonical = NAME_ALIASES[countryName.toLowerCase()]
  if (canonical) {
    if (risk.high.includes(canonical)) return 'high'
    if (risk.medium.includes(canonical)) return 'medium'
  }
  return 'none'
}
