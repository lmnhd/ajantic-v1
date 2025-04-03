'use client'

import { z } from 'zod'

export const EditUserProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
})

export type UserProfile = z.infer<typeof EditUserProfileSchema>

export type ProfileFormProps = {
  user: UserProfile;
  onUpdate?: (name: string) => Promise<void>;
}

// Component is currently not in use - uncomment and update when needed
// export default function ProfileForm({ user, onUpdate }: ProfileFormProps) {
//   // Implementation here
// }
