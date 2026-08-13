export function _audit(
  req: any,
  action: string,
  entityId: string | number,
  newValue?: any,
  oldValue?: any
): void {
  const userId = req?.user?.id ?? 'anonymous';
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT] ${timestamp} | user:${userId} | action:${action} | entity:${entityId}`);
  if (newValue !== undefined) console.log(`   newValue: ${JSON.stringify(newValue)}`);
  if (oldValue !== undefined) console.log(`   oldValue: ${JSON.stringify(oldValue)}`);
}
