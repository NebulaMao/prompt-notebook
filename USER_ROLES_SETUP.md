# User Role Management Setup

This document explains how to set up and use the user role management system.

## Database Schema

The `database_2.sql` file contains a comprehensive user role management system with the following features:

### User Roles

1. **normal** - Default role for all new users
2. **vip** - VIP users with expiration tracking
3. **svip** - Super VIP users with expiration tracking
4. **admin** - Administrators with full backend access

### Key Features

- **Automatic Profile Creation**: When a user signs up, a profile with `normal` role is automatically created
- **Expiration System**: VIP and SVIP roles have an `expires_at` field that tracks membership expiration
- **Admin Access Control**: Only users with `admin` role can access the `/admin` route
- **Helper Functions**: SQL functions to check role status and expiration

## Setup Instructions

### 1. Run the SQL Script

Execute the `database_2.sql` file in your Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `database_2.sql`
4. Paste and run the script

### 2. Create Your First Admin User

After running the script, you need to manually set at least one user to admin role:

```sql
-- Replace 'user-uuid-here' with your actual user ID
UPDATE public.user_profiles
SET role = 'admin'
WHERE user_id = 'user-uuid-here';
```

To find your user ID:
1. Sign up/login to your app
2. In Supabase dashboard, go to **Authentication** > **Users**
3. Copy the UUID of your user
4. Run the UPDATE query above

### 3. Verify the Setup

Check that everything is working:

```sql
-- View all user profiles
SELECT * FROM public.user_profiles;

-- View active user roles (with expiration considered)
SELECT * FROM public.active_user_roles;

-- Test the admin check function
SELECT public.is_admin('your-user-uuid');
```

## Usage

### TypeScript Types

The following types are now available in `app/lib/supabase.ts`:

```typescript
type UserRole = 'normal' | 'vip' | 'svip' | 'admin';

interface UserProfile {
    id: string;
    user_id: string;
    role: UserRole;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
}
```

### Helper Functions

```typescript
// Check if user is admin
const isAdmin = await isUserAdmin(userId);

// Get user's effective role (considering expiration)
const role = await getUserEffectiveRole(userId);

// Check if user's role is active (not expired)
const isActive = await isUserRoleActive(userId);
```

### Managing User Roles

#### Promote User to VIP

```sql
UPDATE public.user_profiles
SET 
    role = 'vip',
    expires_at = NOW() + INTERVAL '30 days'  -- 30 days from now
WHERE user_id = 'user-uuid';
```

#### Promote User to SVIP

```sql
UPDATE public.user_profiles
SET 
    role = 'svip',
    expires_at = NOW() + INTERVAL '90 days'  -- 90 days from now
WHERE user_id = 'user-uuid';
```

#### Set Permanent Admin

```sql
UPDATE public.user_profiles
SET 
    role = 'admin',
    expires_at = NULL  -- Admins don't expire
WHERE user_id = 'user-uuid';
```

#### Extend Membership

```sql
UPDATE public.user_profiles
SET expires_at = expires_at + INTERVAL '30 days'
WHERE user_id = 'user-uuid' AND role IN ('vip', 'svip');
```

## Database Views

### active_user_roles View

This view automatically calculates the effective role based on expiration:

```sql
SELECT * FROM public.active_user_roles
WHERE user_id = 'your-uuid';
```

Columns:
- `effective_role`: The current active role (expired VIP/SVIP becomes 'normal')
- `assigned_role`: The originally assigned role
- `is_active`: Boolean indicating if the role is currently active
- `expires_at`: Expiration timestamp for VIP/SVIP

## Row Level Security (RLS)

The following policies are in place:

1. **Users can read their own profile**
2. **Admins can read all profiles**
3. **Users can update their own profile** (but not role/expiration)
4. **Admins can manage all profiles**

## Integration with Frontend

The `/admin` route now checks for admin role:

1. User logs in
2. System checks if user has `admin` role
3. If not admin, user is redirected to home with an error message
4. If admin, user gains access to the admin dashboard

## Notes

- **Normal** and **Admin** roles don't have expiration
- **VIP** and **SVIP** roles automatically revert to **normal** when expired
- The expiration check is performed at query time using the `active_user_roles` view
- All new users start with the **normal** role by default
