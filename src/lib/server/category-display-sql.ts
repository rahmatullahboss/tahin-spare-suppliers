export const CATEGORY_DISPLAY_ROWS_SQL = `
    SELECT 'category' AS row_kind, id, name, slug, image_url, image_key, parent_id, created_at,
           NULL::text AS category_slug, NULL::text AS label, NULL::integer AS sort_order
    FROM categories WHERE parent_id IS NULL
    UNION ALL
    SELECT 'presentation', NULL, NULL, NULL, image_url, image_key, NULL, NULL,
           category_slug, label, sort_order
    FROM category_presentations
    ORDER BY row_kind, name
  `;
