import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { completeOnboarding, checkPassportTaken } from '../services/userService'
import { uploadFile } from '../services/storageService'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { CountryPicker } from '../components/ui/CountryPicker'
import type { AppMode } from '../types/user'

// Step 0: Mode  |  Step 1: Personal  |  Step 2: Passport  |  Step 3: Photo
const STEPS = ['Mode', 'Personal', 'Passport', 'Photo']

export function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [appMode, setAppMode] = useState<AppMode>('personal')

  const [form, setForm] = useState({
    Full_Name: profile?.Full_Name ?? '',
    Username: profile?.Username ?? '',
    Phone_Number: profile?.Phone_Number ?? '',
    Date_of_Birth: profile?.Date_of_Birth ?? '',
    Passport_Number: profile?.Passport_Number ?? '',
    Passport_Issuing_Country: profile?.Passport_Issuing_Country ?? '',
    Profile_Image: profile?.Profile_Image ?? '',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  function update(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function finish() {
    if (!user) return
    setSaving(true)
    try {
      if (form.Passport_Number.trim()) {
        const takenBy = await checkPassportTaken(form.Passport_Number.trim(), user.uid)
        if (takenBy) {
          alert('That passport number is already registered to another account. If you believe this is an error, please contact support.')
          setSaving(false)
          return
        }
      }

      let imageUrl = form.Profile_Image
      if (photoFile) {
        try {
          imageUrl = await uploadFile(user.uid, photoFile, 'profile')
        } catch (storageErr) {
          console.warn('Profile photo upload failed:', storageErr)
        }
      }

      await completeOnboarding(user.uid, { ...form, Profile_Image: imageUrl, appMode })
      await refreshProfile()
      navigate('/')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Onboarding error:', e)
      alert(`Error saving profile: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const stepTitles = ['How will you use the app?', 'Your details', 'Passport info', 'Profile photo']
  const stepSubtitles = [
    'Choose the experience that fits your needs',
    'Tell us about yourself',
    'Used for travel verification',
    'Optional — helps identify you',
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Progress bar */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i <= step ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}`}>{i + 1}</div>
              <div className={`h-1 flex-1 rounded-full ${i < step ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-700'} ${i === STEPS.length - 1 ? 'hidden' : ''}`} />
            </div>
          ))}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{stepTitles[step]}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{stepSubtitles[step]}</p>
      </div>

      <div className="flex-1 px-6">
        {/* ── Step 0: Mode selection ── */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            {/* Personal & Pets card */}
            <button
              type="button"
              onClick={() => setAppMode('personal')}
              className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                appMode === 'personal'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl leading-none flex-shrink-0">🏠</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 dark:text-white text-base">Personal & Pets</p>
                    {appMode === 'personal' && (
                      <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    Track your own vaccinations, family members, and companion animals (dogs, cats, birds, etc.).
                  </p>
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {['👤 Personal vaccines', '👶 Dependents', '🐶 Pets', '🛂 Passport QR'].map(t => (
                      <span key={t} className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>

            {/* Farm & Commercial card */}
            <button
              type="button"
              onClick={() => setAppMode('farm')}
              className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                appMode === 'farm'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl leading-none flex-shrink-0">🌾</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 dark:text-white text-base">Farm & Commercial</p>
                    {appMode === 'farm' && (
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    Manage livestock vaccination records by herd, flock, or batch. Animals identified by tag number and/or RFID chip.
                  </p>
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {['🐄 Herds & flocks', '🏷️ Tag numbers', '📡 RFID chips', '📊 Batch records'].map(t => (
                      <span key={t} className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>

            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
              You can always change this later in your profile settings
            </p>
          </div>
        )}

        {/* ── Step 1: Personal details ── */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Input label="Full name" value={form.Full_Name} onChange={e => update('Full_Name', e.target.value)} placeholder="Jane Smith" />
            <Input label="Username" value={form.Username} onChange={e => update('Username', e.target.value)} placeholder="janesmith" />
            <Input label="Phone number" value={form.Phone_Number} onChange={e => update('Phone_Number', e.target.value)} placeholder="+1 555 000 0000" type="tel" />
            <Input label="Date of birth" value={form.Date_of_Birth} onChange={e => update('Date_of_Birth', e.target.value)} type="date" />
          </div>
        )}

        {/* ── Step 2: Passport ── */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Input label="Passport number" value={form.Passport_Number} onChange={e => update('Passport_Number', e.target.value)} placeholder="AB1234567" />
            <CountryPicker
              label="Passport issuing country"
              value={form.Passport_Issuing_Country}
              onChange={v => update('Passport_Issuing_Country', v)}
              placeholder="Select your country…"
            />
          </div>
        )}

        {/* ── Step 3: Photo ── */}
        {step === 3 && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-28 h-28 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
              {photoPreview
                ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                : <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12a5 5 0 110-10 5 5 0 010 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/></svg>
              }
            </div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              <span className="text-blue-600 font-medium text-sm">Choose photo</span>
            </label>
          </div>
        )}
      </div>

      <div className="px-6 pb-10 pb-safe flex flex-col gap-3 mt-8">
        {step < STEPS.length - 1 ? (
          <Button size="lg" fullWidth onClick={() => setStep(s => s + 1)}>Continue</Button>
        ) : (
          <Button size="lg" fullWidth loading={saving} onClick={finish}>Get Started</Button>
        )}
        {step > 0 && (
          <Button variant="ghost" fullWidth onClick={() => setStep(s => s - 1)}>Back</Button>
        )}
        {step === 3 && (
          <Button variant="ghost" fullWidth onClick={finish} disabled={saving}>Skip for now</Button>
        )}
      </div>
    </div>
  )
}
