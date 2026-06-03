export interface AnimalVaccineEntry {
  id: string
  Vac_Name: string
  Disease_Target: string
  Manufacturer?: string
  Species: string[]          // e.g. ['dog','cat'] or ['all'] or ['dog']
  Type?: string
  Dosing_Schedule?: string
  Notes?: string
  status?: 'available' | 'trial' | 'premarket'
}
