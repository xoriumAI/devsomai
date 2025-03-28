# Supabase Client Implementation

## Overview

This directory contains the Supabase client implementations used across the application. To address build issues and improve consistency, we've created a new unified implementation.

## New Architecture

The new unified implementation is in `supabase-unified.ts`, which provides:

1. A single source of truth for Supabase client instances
2. Consistent environment variable handling
3. Proper client/server detection
4. Type exports independent of the Supabase package
5. Backward compatibility with existing code

## Available Clients

The new implementation provides the following clients:

### Client-side (Browser)

```typescript
import { getSupabaseClient, supabase } from '@/lib/supabase-unified';

// In client components:
const supabase = getSupabaseClient();
// OR use the singleton instance directly:
// import { supabase } from '@/lib/supabase-unified';
```

### Server Components

```typescript
import { getSupabaseServer } from '@/lib/supabase-unified';

// In server components:
const supabase = getSupabaseServer();
```

### API Routes / Route Handlers

```typescript
import { getSupabaseRouteHandler } from '@/lib/supabase-unified';

// In API route or route handler:
const supabase = getSupabaseRouteHandler();
```

### Admin Client (Server-side only)

```typescript
import { getSupabaseAdmin, supabaseAdmin } from '@/lib/supabase-unified';

// In server-side code:
const supabaseAdmin = getSupabaseAdmin();
// OR use the singleton instance directly:
// import { supabaseAdmin } from '@/lib/supabase-unified';
```

## Types

The unified implementation exports all necessary types directly, so you don't need to import from `@supabase/supabase-js`:

```typescript
import { User, Session, AuthChangeEvent, AuthError } from '@/lib/supabase-unified';
```

## Migration Guide

### Before

```typescript
// Client-side
import { supabase } from '@/lib/supabase';
// or
import { supabase } from '@/lib/supabase-client';

// Types
import { User, Session } from '@supabase/supabase-js';

// Server-side
import { getSupabaseServer } from '@/lib/supabase-server';

// Admin
import { supabaseAdmin } from '@/lib/supabase-db';
```

### After

```typescript
// Client-side
import { supabase } from '@/lib/supabase-unified';

// Types
import { User, Session } from '@/lib/supabase-unified';

// Server-side
import { getSupabaseServer } from '@/lib/supabase-unified';

// Admin
import { supabaseAdmin } from '@/lib/supabase-unified';
```

## Legacy Files

The following files are being deprecated and should be migrated to use the new unified implementation:

- `supabase.ts` - Old client-side implementation
- `supabase-client.ts` - Alternative client-side implementation
- `supabase-server.ts` - Server component implementation
- `supabase-db.ts` - Admin client and database operations

## Environment Variables

The unified implementation checks for the following environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous API key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)

For local development, these can be set in `.env.local`. For production, ensure they are properly set in your deployment environment. 