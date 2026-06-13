import { useState, useEffect } from 'react'
import { APP_VERSION, RELEASE_DATE } from '../version'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { updateUserProfile } from '../services/userService'
import type { AppMode } from '../types/user'
import { uploadFile } from '../services/storageService'
import { getPractitionerByUid, getPractitionerByEmail, selfRegisterPractitioner } from '../services/practitionersService'
import { createPeerVerificationRequest, getMyPeerVerificationRequests } from '../services/peerVerificationService'
import type { Practitioner, PeerVerification } from '../types/admin'
import { VERIFICATION_LEVEL_LABELS, VERIFICATION_LEVEL_COLOURS } from '../types/admin'
import { PageShell } from '../components/layout/PageShell'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { CountryPicker } from '../components/ui/CountryPicker'
import { useNavigate } from 'react-router-dom'
import { HEALTH_CONDITION_LABELS, type HealthCondition } from '../utils/contraindications'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'

export function ProfilePage() {
  const { isDark, toggleTheme } = useTheme()
  const { user, profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const { permissionState, tokenState, errorMessage, requestPermission } = usePushNotifications(user?.uid)
  const unreadCount = useUnreadNotifications(user?.uid)
  const [editing, setEditing] = useState(false)
  const [savingHealth, setSavingHealth] = useState(false)
  const [saving, setSaving] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const [form, setForm] = useState({
    Full_Name: profile?.Full_Name ?? '',
    Username: profile?.Username ?? '',
    Phone_Number: profile?.Phone_Number ?? '',
    Date_of_Birth: profile?.Date_of_Birth ?? '',
    Passport_Number: profile?.Passport_Number ?? '',
    Passport_Issuing_Country: profile?.Passport_Issuing_Country ?? '',
    currentCountry: profile?.currentCountry ?? '',
    gender: profile?.gender ?? '',
    biologicalSex: profile?.biologicalSex ?? '',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  // Health conditions — stored as array in profile
  const [selectedConditions, setSelectedConditions] = useState<HealthCondition[]>(
    (profile?.healthConditions ?? []) as HealthCondition[]
  )

  // ── Practitioner state ──────────────────────────────────────────────────
  const [practitioner, setPractitioner] = useState<Practitioner | null | undefined>(undefined)
  const [practLoading, setPractLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [regSpeciality, setRegSpeciality] = useState('')
  const [myRequests, setMyRequests] = useState<PeerVerification[]>([])
  const [showUpgradeForm, setShowUpgradeForm] = useState(false)
  const [upgradeApproverEmail, setUpgradeApproverEmail] = useState('')
  const [upgradeNotes, setUpgradeNotes] = useState('')
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false)

  useEffect(() => {
    if (!user) return
    async function loadPractitioner() {
      setPractLoading(true)
      try {
        // First look for self-registered doc (ID = uid)
        let p = await getPractitionerByUid(user!.uid)
        // Fallback: admin-added by email
        if (!p && user!.email) p = await getPractitionerByEmail(user!.email)
        setPractitioner(p)
        if (p) {
          try {
            const reqs = await getMyPeerVerificationRequests(user!.uid)
            setMyRequests(reqs)
          } catch (reqErr) {
            // Peer_Verifications query may fail if composite index isn't built yet — harmless
            console.warn('Could not load peer requests (index may be building):', reqErr)
          }
        }
      } catch (e) {
        console.error('Practitioner load error:', e)
        setPractitioner(null)
      } finally {
        setPractLoading(false)
      }
    }
    loadPractitioner()
  }, [user])

  async function handleSelfRegister() {
    if (!user || !profile?.Full_Name || !user.email) return
    setRegistering(true)
    try {
      await selfRegisterPractitioner(user.uid, {
        name: profile.Full_Name,
        email: user.email,
        speciality: regSpeciality,
      })
      const p = await getPractitionerByUid(user.uid)
      setPractitioner(p)
    } catch (e) {
      console.error('Self-register error:', e)
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Registration failed:\n${msg}`)
    } finally {
      setRegistering(false)
    }
  }

  async function handleRequestUpgrade() {
    if (!user || !profile || !practitioner) return
    if (!upgradeApproverEmail.trim()) { alert('Enter the approver\'s email.'); return }
    setSubmittingUpgrade(true)
    try {
      await createPeerVerificationRequest({
        requesterUid: user.uid,
        requesterEmail: user.email ?? '',
        requesterName: profile.Full_Name,
        approverEmail: upgradeApproverEmail.trim(),
        targetLevel: practitioner.verificationLevel + 1,
        notes: upgradeNotes,
      })
      const reqs = await getMyPeerVerificationRequests(user.uid)
      setMyRequests(reqs)
      setShowUpgradeForm(false)
      setUpgradeApproverEmail('')
      setUpgradeNotes('')
      alert(`Upgrade request sent to ${upgradeApproverEmail.trim()}. They will see it in their Peer Verification Inbox.`)
    } catch (e) {
      console.error('Upgrade request error:', e)
      alert('Error submitting upgrade request. Please try again.')
    } finally {
      setSubmittingUpgrade(false)
    }
  }

  function update(f: string, v: string) { setForm(p => ({ ...p, [f]: v })) }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function toggleCondition(c: HealthCondition) {
    setSelectedConditions(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    )
  }

  async function saveHealthConditions() {
    if (!user) return
    setSavingHealth(true)
    try {
      await updateUserProfile(user.uid, { healthConditions: selectedConditions })
      await refreshProfile()
    } catch (e) {
      console.error(e)
      alert('Error saving health profile.')
    } finally {
      setSavingHealth(false)
    }
  }

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      let imageUrl = profile?.Profile_Image ?? ''
      if (photoFile) {
        try {
          imageUrl = await uploadFile(user.uid, photoFile, 'profile')
        } catch (storageErr) {
          console.warn('Photo upload failed:', storageErr)
        }
      }
      await updateUserProfile(user.uid, { ...form, Profile_Image: imageUrl })
      await refreshProfile()
      setEditing(false)
    } catch (e) {
      console.error('Profile save error:', e)
      alert('Error saving profile.')
    } finally {
      setSaving(false)
    }
  }

  const avatarSrc = photoPreview ?? profile?.Profile_Image ?? null

  return (
    <PageShell title="Profile" onBack={() => navigate('/')} action={
      !editing
        ? <button onClick={() => setEditing(true)} className="text-blue-600 text-sm font-medium">Edit</button>
        : <button onClick={() => setEditing(false)} className="text-gray-500 text-sm">Cancel</button>
    }>
      {/* Avatar */}
      <div className="flex flex-col items-center pt-4 pb-6">
        <label className={`relative ${editing ? 'cursor-pointer' : ''}`}>
          <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
            {avatarSrc
              ? <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
              : <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12a5 5 0 110-10 5 5 0 010 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/>
                </svg>
            }
          </div>
          {editing && (
            <>
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </>
          )}
          {/* Practitioner verification badge */}
          {!editing && practitioner && practitioner.verificationLevel >= 1 && (
            <div
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center shadow"
              title={`Verified Practitioner · Level ${practitioner.verificationLevel}`}
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </label>
        <p className="mt-3 font-semibold text-gray-900 dark:text-white">{profile?.Full_Name}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">{profile?.Email}</p>
        {profile?.Admin && (
          <span className="mt-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">Admin</span>
        )}
      </div>

      {/* ── EDIT MODE ── */}
      {editing ? (
        <div className="flex flex-col gap-4">
          <Input label="Full Name" value={form.Full_Name} onChange={e => update('Full_Name', e.target.value)} />
          <Input label="Username" value={form.Username} onChange={e => update('Username', e.target.value)} />
          <Input label="Phone Number" value={form.Phone_Number} onChange={e => update('Phone_Number', e.target.value)} type="tel" />
          <Input label="Date of Birth" value={form.Date_of_Birth} onChange={e => update('Date_of_Birth', e.target.value)} type="date" />
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Gender</label>
            <select
              value={form.gender ?? ''}
              onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Biological Sex</label>
            <select
              value={form.biologicalSex ?? ''}
              onChange={e => setForm(f => ({ ...f, biologicalSex: e.target.value }))}
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="intersex">Intersex</option>
            </select>
          </div>
          <Input label="Passport Number" value={form.Passport_Number} onChange={e => update('Passport_Number', e.target.value)} />
          <CountryPicker label="Passport Country" value={form.Passport_Issuing_Country} onChange={v => update('Passport_Issuing_Country', v)} />
          <CountryPicker label="Current Country" value={form.currentCountry} onChange={v => update('currentCountry', v)} placeholder="Where are you now? (optional)" />
          <Button size="lg" fullWidth loading={saving} onClick={save}>Save Changes</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Profile details */}
          {[
            { label: 'Username', value: profile?.Username },
            { label: 'Phone', value: profile?.Phone_Number },
            { label: 'Date of Birth', value: profile?.Date_of_Birth ? new Date(profile.Date_of_Birth).toLocaleDateString() : undefined },
            { label: 'Passport Number', value: profile?.Passport_Number ? '••••••••' : undefined },
            { label: 'Passport Country', value: profile?.Passport_Issuing_Country },
            ...(profile?.currentCountry ? [{ label: 'Current Country', value: profile.currentCountry }] : []),
            ...(profile?.gender ? [{ label: 'Gender', value: profile.gender }] : []),
            ...(profile?.biologicalSex ? [{ label: 'Biological Sex', value: profile.biologicalSex }] : []),
          ].map(row => (
            <div key={row.label} className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{row.value || '—'}</span>
            </div>
          ))}

          {/* ── Health Profile ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm mt-2 overflow-hidden">
            <button
              onClick={() => setHealthOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-4"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Health Profile</p>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${healthOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {healthOpen && (
              <div className="px-4 pb-4">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  Select any conditions that apply. This enables contraindication warnings in the vaccine library.
                  This is informational only — always consult your doctor.
                </p>
                <div className="flex flex-col gap-2">
                  {(Object.entries(HEALTH_CONDITION_LABELS) as [HealthCondition, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <div
                        onClick={() => toggleCondition(key)}
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                          selectedConditions.includes(key)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {selectedConditions.includes(key) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  fullWidth
                  loading={savingHealth}
                  onClick={saveHealthConditions}
                  className="mt-4"
                >
                  Save Health Profile
                </Button>
              </div>
            )}
          </div>

          {/* ── Practitioner / Honour Chain ── */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm mt-2">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Practitioner Status</p>
            </div>

            {practLoading ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">Loading…</p>
            ) : practitioner ? (
              <div className="space-y-3">
                {/* Current level badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm px-3 py-1 rounded-full font-semibold ${VERIFICATION_LEVEL_COLOURS[practitioner.verificationLevel]}`}>
                    Level {practitioner.verificationLevel} · {VERIFICATION_LEVEL_LABELS[practitioner.verificationLevel]}
                  </span>
                  {!practitioner.active && (
                    <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactive</span>
                  )}
                </div>
                {practitioner.verifiedBy && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Verified by {practitioner.verifiedBy}</p>
                )}

                {/* Vaccines you verify get this level */}
                <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                  Vaccines you approve receive trust level <strong>{Math.min(practitioner.verificationLevel + 1, 5)}</strong>
                </p>

                {/* Pending upgrade requests */}
                {myRequests.filter(r => r.status === 'pending').length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 border border-amber-100 dark:border-amber-700">
                    <p className="text-xs font-semibold text-amber-800">
                      {myRequests.filter(r => r.status === 'pending').length} upgrade request{myRequests.filter(r => r.status === 'pending').length !== 1 ? 's' : ''} pending
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">Waiting for your approver to respond</p>
                  </div>
                )}

                {/* Last approved */}
                {myRequests.filter(r => r.status === 'approved').length > 0 && (
                  <p className="text-xs text-green-600">✓ Last upgrade approved</p>
                )}

                {/* Request upgrade (only if not already at max or level 4 is admin-only) */}
                {practitioner.verificationLevel < 3 && (
                  <>
                    {showUpgradeForm ? (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Request Level {practitioner.verificationLevel + 1} upgrade
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Enter the email of a Level {practitioner.verificationLevel + 2}+ practitioner who will vouch for you.
                        </p>
                        <input
                          type="email"
                          value={upgradeApproverEmail}
                          onChange={e => setUpgradeApproverEmail(e.target.value)}
                          placeholder="Approver's email address"
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
                        />
                        <textarea
                          value={upgradeNotes}
                          onChange={e => setUpgradeNotes(e.target.value)}
                          placeholder="Optional: explain your credentials / why you qualify…"
                          rows={2}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:placeholder-gray-400"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" fullWidth onClick={() => setShowUpgradeForm(false)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            fullWidth
                            loading={submittingUpgrade}
                            onClick={handleRequestUpgrade}
                            disabled={!upgradeApproverEmail.trim()}
                          >
                            Send Request
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowUpgradeForm(true)}
                        className="text-xs text-blue-600 font-medium hover:underline"
                      >
                        + Request level upgrade
                      </button>
                    )}
                  </>
                )}
                {practitioner.verificationLevel === 3 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Level 4 (highest trust) is granted by administrators only.</p>
                )}

                {/* Peer verification inbox link for level 2+ */}
                {practitioner.verificationLevel >= 2 && (
                  <button
                    onClick={() => navigate('/peer-verify')}
                    className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    Peer Verification Inbox
                  </button>
                )}
              </div>
            ) : (
              /* Not registered */
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Register as a medical practitioner to verify vaccines for others.
                  You start at <strong>Level 1 (Self-registered)</strong> — vaccines you approve get trust level 2.
                  Higher-level practitioners can upgrade you via the peer verification chain.
                </p>
                <input
                  type="text"
                  value={regSpeciality}
                  onChange={e => setRegSpeciality(e.target.value)}
                  placeholder="Speciality (e.g. General Practitioner) — optional"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-400"
                />
                <Button
                  size="sm"
                  fullWidth
                  loading={registering}
                  onClick={handleSelfRegister}
                >
                  Register as Practitioner (Level 1)
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 flex flex-col gap-1">
            <Button variant="ghost" fullWidth onClick={() => navigate('/health/sexual')} className="justify-start text-violet-700 dark:text-violet-400">
              🔒 Private Health Records
            </Button>
            <Button variant="ghost" fullWidth onClick={() => navigate('/notifications')} className="justify-start">
              <span className="flex items-center gap-2 w-full">
                <span>🔔 Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {unreadCount}
                  </span>
                )}
              </span>
            </Button>
            <Button variant="ghost" fullWidth onClick={() => navigate('/validate')} className="justify-start">
              Validation Inbox
            </Button>
            <Button variant="ghost" fullWidth onClick={() => navigate('/share-invites')} className="justify-start">
              Share Invites
            </Button>
            <Button variant="ghost" fullWidth onClick={() => navigate('/transfer/claim')} className="justify-start">
              Claim Transfer
            </Button>
            <Button variant="ghost" fullWidth onClick={() => navigate('/report')} className="justify-start">
              📄 Download Vaccination Report
            </Button>
            {profile?.Admin && (
              <Button variant="ghost" fullWidth onClick={() => navigate('/admin')} className="justify-start text-purple-700">
                🛠 Admin Panel
              </Button>
            )}
          </div>

          {/* Push Notifications */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Push Notifications</p>
            {permissionState === 'unsupported' ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">Push notifications are not supported in this browser.</p>
            ) : permissionState === 'denied' ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Notifications blocked. Enable them in your browser or device settings, then return here.</p>
            ) : permissionState === 'granted' && tokenState === 'saved' ? (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <p className="text-sm text-gray-700 dark:text-gray-300">Notifications enabled &amp; registered ✓</p>
              </div>
            ) : permissionState === 'granted' && tokenState === 'saving' ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">Registering device…</p>
            ) : permissionState === 'granted' && tokenState === 'error' ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Permission granted, but registration failed</p>
                </div>
                {errorMessage && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">{errorMessage}</p>
                )}
                <button
                  onClick={requestPermission}
                  className="w-full py-2 rounded-xl border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            ) : (
              <button
                onClick={requestPermission}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Enable Push Notifications
              </button>
            )}
          </div>

          {/* App Mode switcher */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">App Mode</span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {profile?.appMode === 'farm' ? 'Farm & Commercial interface' : 'Personal & Pets interface'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {([['personal', '🏠', 'Personal & Pets'], ['farm', '🌾', 'Farm & Commercial']] as [AppMode, string, string][]).map(([mode, emoji, label]) => (
                <button
                  key={mode}
                  onClick={async () => {
                    if (!user) return
                    await updateUserProfile(user.uid, { appMode: mode })
                    await refreshProfile()
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                    (profile?.appMode ?? 'personal') === mode
                      ? mode === 'farm'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span>{emoji}</span>{label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl px-4 py-3.5 shadow-sm">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</span>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDark ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <Button variant="danger" size="lg" fullWidth onClick={signOut} className="mt-2">
            Sign Out
          </Button>

          {/* Version badge */}
          <div className="mt-6 flex flex-col items-center gap-1 pb-2">
            <span className="text-xs font-mono text-gray-300 dark:text-gray-600 select-all">
              v{APP_VERSION}
            </span>
            <span className="text-[10px] text-gray-300 dark:text-gray-700">
              Released {RELEASE_DATE}
            </span>
          </div>
        </div>
      )}
    </PageShell>
  )
}
