# Migrating to the Unified Supabase Implementation

This document provides a step-by-step guide for migrating from the multiple Supabase implementation files to the new unified implementation in `supabase-unified.ts`.

## Migration Strategy

We recommend an incremental migration approach:

1. Update imports in one component or module at a time
2. Test thoroughly after each change
3. Add any missing functionality to the unified implementation as needed
4. Once all code is migrated, remove the legacy implementations

## Common Migration Patterns

### Client-side Components

#### Before:
```typescript
import { supabase } from '@/lib/supabase';
// OR
import { supabase } from '@/lib/supabase-client';
import { User, Session } from '@supabase/supabase-js';
```

#### After:
```typescript
import { supabase, User, Session } from '@/lib/supabase-unified';
```

### Server Components

#### Before:
```typescript
import { getSupabaseServer } from '@/lib/supabase-server';
import { User, Session } from '@supabase/supabase-js';
```

#### After:
```typescript
import { getSupabaseServer, User, Session } from '@/lib/supabase-unified';
```

### API Routes / Route Handlers

#### Before:
```typescript
import { getSupabaseRouteHandler } from '@/lib/supabase-server';
import { User, Session } from '@supabase/supabase-js';
```

#### After:
```typescript
import { getSupabaseRouteHandler, User, Session } from '@/lib/supabase-unified';
```

### Admin Operations

#### Before:
```typescript
import { supabaseAdmin } from '@/lib/supabase-db';
// OR
import { getSupabaseAdmin } from '@/lib/supabase-client';
```

#### After:
```typescript
import { supabaseAdmin } from '@/lib/supabase-unified';
// OR
import { getSupabaseAdmin } from '@/lib/supabase-unified';
```

## Special Cases

### Auth Context

The auth context in `contexts/auth-context.tsx` will require special attention:

1. Update the imports to use the unified client and types
2. Use environment checks to handle client/server rendering
3. Update the subscription handling to use the unified client's patterns

### Database Operations

Some database operations in `lib/supabase-db.ts` will need to be migrated:

1. Create a new file `lib/database.ts` for database operations
2. Import the admin client from the unified implementation
3. Migrate database operations one by one
4. Update imports across the codebase to use the new database service

## Testing

After migrating each module:

1. Test in the development environment
2. Test in the Docker build environment
3. Verify that types are correctly inferred
4. Ensure that authentication works correctly

## Final Steps

Once all code has been migrated:

1. Update the Docker build configuration to remove any workarounds
2. Remove the legacy Supabase implementation files
3. Update the CI/CD pipeline to ensure proper environment variable handling
4. Document the new architecture in the project documentation

## Timeline

Suggested migration timeline:

1. **Week 1**: Migrate core components and contexts
2. **Week 2**: Migrate API routes and server components
3. **Week 3**: Migrate database operations
4. **Week 4**: Testing and cleanup

## Support

If you encounter any issues during migration, refer to the `README.md` in the `lib` directory or contact the architecture team for assistance. 