// Migrations reach the production database slightly before the new bundle
// deploys, so a tab loaded before that window keeps writing the old columns.
// PostgREST answers those writes with PGRST204 ("Could not find the 'x'
// column of 'y' in the schema cache"); reads are unaffected because the
// query layer self-heals selects by dropping missing columns and retrying.
// Detecting the error lets callers swap the cryptic DB message for a
// "refresh the page" instruction.
export function isSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { code?: unknown }).code === "PGRST204") return true;
  const message = (error as { message?: unknown }).message;
  return (
    typeof message === "string" &&
    /could not find the '.+' column of '.+' in the schema cache/i.test(message)
  );
}
