/** Reuse only the original admission allowance; this never creates a new hold. */
export function organizationTaskReplayAllowance(task:{organization_id?:string|null;device_hash:string;payload_hash:string;requested_blue_credits:number|string},expected:{organizationId:string;deviceHash:string;payloadHash:string}):number {
 if(task.organization_id!==expected.organizationId||task.device_hash!==expected.deviceHash||task.payload_hash!==expected.payloadHash)throw new Error('This task belongs to a different billing context or runtime request');
 const amount=Number(task.requested_blue_credits);if(!Number.isFinite(amount)||amount<=0)throw new Error('The saved Organization task has no paid allowance');return amount;
}
