import type { Pet, PetSpecies } from '../../types/pet'
import { PET_SPECIES_EMOJI } from '../../types/pet'

interface PetAvatarProps {
  pet: Pick<Pet, 'species' | 'profileImage'>
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Shows the pet's profile photo if available, otherwise falls back to the
 * species emoji.  Used in list cards and detail page headers.
 *
 * Sizes:
 *   sm  — 40×40  (w-10 h-10)  thumbnail in compact lists
 *   md  — 56×56  (w-14 h-14)  standard card avatar
 *   lg  — 80×80  (w-20 h-20)  large detail / info-card display
 */
export function PetAvatar({ pet, size = 'md', className = '' }: PetAvatarProps) {
  const dim =
    size === 'sm' ? 'w-10 h-10 text-2xl' :
    size === 'lg' ? 'w-20 h-20 text-5xl' :
                   'w-14 h-14 text-3xl'

  if (pet.profileImage) {
    return (
      <div className={`${dim} rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 ${className}`}>
        <img src={pet.profileImage} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className={`${dim} rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 ${className}`}>
      <span>{PET_SPECIES_EMOJI[pet.species as PetSpecies]}</span>
    </div>
  )
}
