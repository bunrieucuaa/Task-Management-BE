SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_prisma_migrations'
  ) AS has_prisma_migrations_table;

SELECT *
FROM "_prisma_migrations"
ORDER BY finished_at DESC NULLS LAST, started_at DESC
LIMIT 20;

