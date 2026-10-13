UPDATE public.policies
SET content = regexp_replace(
  regexp_replace(
    replace(content, 'Effective Date: [Insert Date]', ''),
    '</?cite[^>]*>',
    '',
    'gi'
  ),
  E'\n{3,}',
  E'\n\n',
  'g'
),
updated_at = now()
WHERE content ~* '</?cite[^>]*>'
   OR position('Effective Date: [Insert Date]' IN content) > 0;
