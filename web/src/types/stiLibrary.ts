export interface STILibraryEntry {
  id: string
  condition: string          // matches SHCondition key or custom
  name: string               // display name e.g. "HIV (Human Immunodeficiency Virus)"
  curability: 'curable' | 'clearable' | 'lifelong'
  shortDescription: string   // 1-2 sentence summary
  symptoms: string[]         // bullet points
  transmission: string[]     // how it spreads
  treatment: string          // how it's treated
  preventionTips: string[]   // prevention advice
  whenToTest: string         // frequency / triggers for testing
  resources: { label: string; url: string }[]  // external links
  Created: string
  Updated: string
}
