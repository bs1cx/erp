# Database Setup Instructions

## Step 1: Access Supabase SQL Editor

1. Log in to your Supabase project dashboard
2. Navigate to the **SQL Editor** in the left sidebar
3. Click **New Query** to create a new SQL script

## Step 2: Run the Schema

### Option A: Fresh Installation (No Tables Exist Yet)

If you're starting fresh, copy the **entire contents** of `database/schema.sql` and paste it into the SQL Editor, then click **Run** (or press Ctrl+Enter).

### Option B: Tables Already Exist (You Get "relation already exists" Error)

If you already have `companies`, `users`, and `permissions` tables, use the incremental script instead:

1. Copy the **entire contents** of `database/schema_additional_tables.sql`
2. Paste it into the SQL Editor
3. Click **Run** (or press Ctrl+Enter)

This script only creates the new ITSM tables (`it_assets`, `knowledge_articles`, `it_tickets`, `sla_metrics`) without trying to recreate existing tables.

## Step 3: Verify Tables Created

After running the SQL, verify that the following tables were created:

1. ✅ `companies`
2. ✅ `permissions`
3. ✅ `users`
4. ✅ `it_assets`
5. ✅ `knowledge_articles`
6. ✅ `it_tickets`
7. ✅ `sla_metrics`

## Step 4: Verify Functions Created

Verify these functions exist:

1. ✅ `hash_password(plain_password VARCHAR)`
2. ✅ `verify_user_password(user_email VARCHAR, user_company_id UUID, plain_password VARCHAR)`
3. ✅ `generate_user_token(...)`
4. ✅ `generate_ticket_number()`

## Step 5: Insert Initial Data (Optional)

You may want to insert some initial data:

```sql
-- Insert sample permissions/roles
INSERT INTO permissions (role, access_hr, access_finance, access_it) VALUES
('IT_ADMIN', false, false, true),
('HR_USER', true, false, false),
('FINANCE_MANAGER', false, true, false);

-- Insert a sample company (replace with your actual company data)
INSERT INTO companies (company_code, name) VALUES
('ACQTEST', 'Acquisition Test Company');

-- Note: You'll need to create users through the application or manually insert them
-- with properly hashed passwords using the hash_password() function
```

## Troubleshooting

### Error: "Could not find the table 'public.it_assets'"
- **Solution**: The SQL schema hasn't been run yet. Run the complete `database/schema.sql` file in Supabase SQL Editor.

### Error: "Could not find the function public.hash_password"
- **Solution**: The function definitions in the schema haven't been executed. Make sure you ran the entire schema file, including all function definitions.

### Error: "relation already exists"
- **Solution**: Some tables may already exist. You can either:
  - Drop existing tables and re-run the schema
  - Or use `CREATE TABLE IF NOT EXISTS` (though the current schema uses `CREATE TABLE`)

### After Running Schema, Still Getting 404 Errors
- **Solution**: Clear your browser cache and refresh the application. Supabase may need a moment to refresh its schema cache.

## Important Notes

- All tables include `company_id` foreign keys for multi-tenant isolation
- All IDs use UUID type
- The `hash_password()` function uses bcrypt (pgcrypto extension)
- The `verify_user_password()` function uses the same bcrypt verification
- Indexes are created for optimal query performance

## Next Steps

After running the schema:
1. Create your first company through the application or SQL
2. Create an IT_ADMIN user through the application (User Management tab)
3. Log in and start using the system

