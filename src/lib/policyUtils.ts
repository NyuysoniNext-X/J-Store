/**
 * Clean and convert pseudo-HTML/XML tags in policy content to proper markdown
 * Removes <cite> tags and other HTML-like syntax that may be in the database
 */
export function cleanPolicyContent(content: string): string {
  if (!content) return "";

  return (
    content
      // Remove cite tags but keep content
      .replace(/<\/?cite[^>]*>/gi, "")
      // Clean up any other stray HTML-like tags
      .replace(/<\/?[a-z][^>]*>/gi, "")
      // Normalize line breaks
      .replace(/\r\n/g, "\n")
      // Clean up extra whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
