"use client";
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowUpRight,Building2,ChevronDown,MoreHorizontal,Plus,RefreshCw,X} from 'lucide-react';
import PageLayout from '@/app/components/PageLayout';
import {useAuth} from '@/app/contexts/AuthContext';
import styles from '@/app/components/dashboard.module.css';
import WorkspaceSwitcher from '@/app/components/WorkspaceSwitcher';

type Organization={id:string;name:string;owner:boolean;available:number;held:number;purchased:number;spent:number;seat_limit:number;member_spent:number;member_held:number;spend_cap:number|null};
type Member={user_id:string;email:string;active:boolean;spent:number;held:number;spend_cap:number|null};
type Invitation={id:string;email:string;expires_at:string};
type Snapshot={organization:Organization;members?:Member[];invitations?:Invitation[];checkout?:{payu_test_enabled:boolean}};
type Ledger={events:{id:string;created_at:string;kind:string;credits:number;actor_id:string|null}[];payments:{id:string;created_at:string;credits_purchased:number;amount_paid:number;currency:string;status:string}[]};
type Stored={snapshot:Snapshot;list:Organization[];ledger?:Ledger};
let cacheOwner:string|null=null;
const memory=new Map<string,Stored>();
const credit=(n:number)=>Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:4});
const date=(s:string)=>new Date(s).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
function remembered(userId:string){try{return localStorage.getItem('blue.organization.last.'+userId);}catch{return null;}}
function remember(userId:string,id:string){try{localStorage.setItem('blue.organization.last.'+userId,id);}catch{/* Storage is optional. */}}

export default function OrganizationClient({id,invitation=false}:{id?:string;invitation?:boolean}) {
 const {session,user,loading}=useAuth(),router=useRouter(),userId=user?.id as string|undefined;
 const sessionRef=useRef(session);sessionRef.current=session;
 const generation=useRef(0),screen=useRef({userId,id});screen.current={userId,id};
 const [data,setData]=useState<(Stored&{owner:string})|null>(null);
 const [ready,setReady]=useState(false),[refreshing,setRefreshing]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[inviteLink,setInviteLink]=useState('');
 const [tab,setTab]=useState<'members'|'billing'>('members');
 const [modal,setModal]=useState<'create'|'invite'|null>(null),[name,setName]=useState(''),[email,setEmail]=useState('');
 const [quantity,setQuantity]=useState('50'),[currency,setCurrency]=useState<'INR'|'USD'>('INR'),[phone,setPhone]=useState('');
 const [ledgerBusy,setLedgerBusy]=useState(false);
 const current=data&&data.owner===userId&&data.snapshot.organization.id===id?data:null;
 const org=current?.snapshot.organization;
 const api=useCallback(async(path:string,body?:Record<string,unknown>)=>{
  const active=sessionRef.current;if(!active?.access_token||active.user?.id!==userId)throw Error('Sign in to continue.');
  const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+active.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const value=await response.json();if(!response.ok)throw Error(value.error||'This step could not be completed.');
  if(sessionRef.current?.user?.id!==userId)throw Error('Account changed.');return value;
 },[userId]);
 const refresh=useCallback(async(includeLedger=false)=>{
  if(!userId||invitation)return;
  const run=++generation.current;setRefreshing(true);setError('');
  try{
   const [listing,snapshot,ledger]=await Promise.all([api('organizations'),id?api('organizations/'+id):Promise.resolve(null),id&&includeLedger?api('organizations/'+id+'/ledger'):Promise.resolve(undefined)]);
   if(run!==generation.current||screen.current.userId!==userId||screen.current.id!==id)return;
   const list:Organization[]=listing.organizations;
   if(!id){
    const createRequested=new URLSearchParams(window.location.search).get('new')==='1';
    const target=list.find(o=>o.id===remembered(userId))||list[0];
    if(target&&!createRequested){router.replace('/organizations/'+target.id+'/admin'+window.location.search);return;}
    setReady(true);return;
   }
   const stored={snapshot,list,...(ledger?{ledger}:memory.get(id)?.ledger?{ledger:memory.get(id)!.ledger}:{})};
   memory.set(id,stored);setData({...stored,owner:userId});remember(userId,id);setReady(true);
  }catch(e){if(run===generation.current){setError(e instanceof Error?e.message:'Could not load Organization');setReady(true);}}
  finally{if(run===generation.current)setRefreshing(false);}
 },[api,id,invitation,router,userId]);
 useEffect(()=>{
  if(cacheOwner!==userId){memory.clear();cacheOwner=userId||null;}
  setData(null);setReady(false);setError('');setNotice('');setInviteLink('');setModal(null);setTab('members');
  setName('');setEmail('');setPhone('');setLedgerBusy(false);
  const choice=new URLSearchParams(window.location.search),credits=Number(choice.get('credits'));
  setQuantity(Number.isSafeInteger(credits)&&credits>=50&&credits<=1000?String(credits):'50');setCurrency(choice.get('currency')==='USD'?'USD':'INR');
  if(choice.has('credits')&&id)setTab('billing');
  if(!userId||invitation)return;
  const paymentReturn=new URLSearchParams(window.location.search).has('payment');
  const saved=id?memory.get(id):null;
  if(saved&&!paymentReturn){setData({...saved,owner:userId});setReady(true);}else void refresh();
  if(paymentReturn)setNotice(new URLSearchParams(window.location.search).get('payment')==='success'?'Payment received. Your balance is updated below.':'Payment is being checked. Use Refresh to check its status.');
  return()=>{generation.current++;};
 },[userId,id,invitation,refresh]);
 useEffect(()=>{
  if(tab!=='billing'||!org?.owner||current?.ledger||ledgerBusy)return;
  const target=id,owner=userId;setLedgerBusy(true);
  void api('organizations/'+id+'/ledger').then(ledger=>{
   if(screen.current.id!==target||screen.current.userId!==owner)return;
   const saved=memory.get(target!);if(saved){const next={...saved,ledger};memory.set(target!,next);setData({...next,owner:owner!});}
  }).catch(e=>{if(screen.current.id===target&&screen.current.userId===owner)setError(e.message);}).finally(()=>setLedgerBusy(false));
 },[tab,org?.owner,current?.ledger,api,id,userId]);
 async function act(action:Record<string,unknown>){
  setBusy(true);setError('');setNotice('');const target=id,owner=userId;
  try{const value=await api('organizations/'+id,action);if(screen.current.id!==target||screen.current.userId!==owner)return false;
   setInviteLink(value.invite_url||'');setNotice(value.notice||'Changes saved.');setModal(null);setEmail('');await refresh(!!current?.ledger);return true;
  }catch(e){if(screen.current.id===target&&screen.current.userId===owner)setError(e instanceof Error?e.message:'Update failed');return false;}finally{setBusy(false);}
 }
 async function create(){setBusy(true);setError('');try{const value=await api('organizations',{name});remember(userId!,value.id);setModal(null);router.push('/organizations/'+value.id+'/admin'+window.location.search);}catch(e){setError(e instanceof Error?e.message:'Could not create Organization');}finally{setBusy(false);}}
 async function purchase(){setBusy(true);setError('');try{
  if(currency==='INR'&&!/^\+?[0-9]{10,15}$/.test(phone.trim()))throw Error('Enter your phone number for PayU (10–15 digits).');
  const amount=Number(quantity);if(!Number.isSafeInteger(amount)||amount<50||amount>1000)throw Error('Choose 50 to 1,000 whole credits.');
  const value=await api('blue-pro/'+(currency==='USD'?'paypal/create-order':'payu/create-hash'),{organization_id:id,packId:'custom',customCredits:amount,returnUrl:window.location.origin+'/organizations/'+id+'/admin'});
  if(currency==='USD'){window.location.assign(value.approveUrl);return;}
  const form=document.createElement('form');form.method='POST';form.action=value.payuUrl;
  const fields={...Object.fromEntries(['key','txnid','amount','productinfo','firstname','email','hash'].map(key=>[key,value[key]])),surl:window.location.origin+'/api/blue-pro/payu/callback',furl:window.location.origin+'/api/blue-pro/payu/callback',phone:phone.trim()};
  for(const [key,value]of Object.entries(fields)){const input=document.createElement('input');input.type='hidden';input.name=key;input.value=String(value);form.appendChild(input);}document.body.appendChild(form);form.submit();
 }catch(e){setError(e instanceof Error?e.message:'Checkout unavailable');setBusy(false);}}
 async function accept(){setBusy(true);setError('');try{const value=await api('organizations/accept',{token:window.location.hash.slice(1)});window.history.replaceState(null,'',window.location.pathname);remember(userId!,value.id);router.replace('/organizations/'+value.id+'/admin');}catch(e){setError(e instanceof Error?e.message:'Invitation unavailable');setBusy(false);}}
 const chooseTab=(value:'members'|'billing',focus=false)=>{setTab(value);if(focus)document.getElementById(value==='members'?'members-tab':'billing-tab')?.focus();};
 const amount=Number(quantity),valid=Number.isSafeInteger(amount)&&amount>=50&&amount<=1000;
 const payuTest=!!current?.snapshot.checkout?.payu_test_enabled&&currency==='INR'&&amount===50;
 const seats=(current?.snapshot.members?.filter(m=>m.active).length||0)+(current?.snapshot.invitations?.length||0);
 const creation=<form onSubmit={e=>{e.preventDefault();void create();}} className={styles.form}><label>Organization name<input required maxLength={100} autoComplete="organization" value={name} onChange={e=>setName(e.target.value)} placeholder="Your company"/></label><p className={styles.muted}>Start with 50 credits and 5 seats. ₹5,750 or US$57.50. No separate seat subscription.</p><button className={styles.primary} disabled={busy||!name.trim()}>{busy?'Creating…':'Create organization'}</button></form>;
 return <PageLayout><section className={styles.dashboard}>
  <header className={styles.header}><div className={styles.identity}>
   {org?<><WorkspaceSwitcher activeId={org.id} organizations={current?.list.some(o=>o.id===org.id)?current.list:[...(current?.list||[]),org]} disabled={busy} onSelect={next=>{if(next==='personal'){router.push('/console');return;}if(next==='new'){setModal('create');return;}remember(userId!,next);router.push('/organizations/'+next+'/admin');}}/><span className={styles.badge}>{org.owner?'Owner':'Member'}</span><span className={styles.muted}>{org.owner?`${seats} of ${org.seat_limit} seats used`:`${org.seat_limit} member seats`}</span></>:<h1>Organizations</h1>}
   </div><div className={styles.actions}><Link className={styles.secondary} href="/console">Personal console <ArrowUpRight size={14}/></Link>{org?.owner&&<><button className={styles.secondary} onClick={()=>{setTab('billing');document.getElementById('organization-billing')?.scrollIntoView({behavior:'smooth',block:'start'});}}>Add Credits</button><button className={styles.primary} disabled={busy} onClick={()=>{setInviteLink('');setModal('invite');}}><Plus size={15}/>Invite Member</button></>}<button className={styles.iconButton} aria-label="Refresh dashboard" title="Refresh dashboard" disabled={refreshing||busy||loading||!userId} onClick={()=>void refresh(!!current?.ledger)}><RefreshCw size={16} className={refreshing?styles.spinning:''}/></button></div>
  </header>
  {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
  {inviteLink&&<div className={styles.notice}>Invitation ready. Share this link with its intended recipient: <a href={inviteLink}>{inviteLink}</a></div>}
  {loading?<p className={styles.empty}>Checking your account…</p>:!user?<div className={styles.onboarding}><h2>Your team, one shared workspace.</h2><Link className={styles.primary} href="/console" onClick={()=>sessionStorage.setItem('redirectAfterLogin',window.location.pathname+window.location.search+window.location.hash)}>Sign in to continue</Link></div>:invitation?<div className={styles.onboarding}><h2>Join your Organization</h2><p>Use the account matching your invitation email.</p><button className={styles.primary} disabled={busy} onClick={()=>void accept()}>Accept invitation</button></div>:!id?<div className={styles.onboarding}>{ready?<><span className={styles.eyebrow}>BLUE FOR YOUR COMPANY</span><h2>Create your organization.</h2><p className={styles.muted}>Shared credits. Individual accounts. Clear spending controls.</p>{creation}</>:<p>Opening your workspace…</p>}</div>:!org?<p className={styles.empty}>{error?'Your workspace could not be loaded. Use Refresh to try again.':'Opening your workspace…'}</p>:<>
   <div className={styles.pageTitle}><span className={styles.eyebrow}>ORGANIZATION OVERVIEW</span><h1>{org.name}</h1><p className={styles.muted}>A clear view of your shared credits and the people using them.</p></div>
   <div className={styles.metrics}>{[['Available balance',org.available],['Lifetime purchased',org.purchased],['Total spent',org.spent],['Reserved in active tasks',org.held]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{credit(Number(value))}<small>cr</small></strong></div>)}</div>
   <div className={styles.tabs} role="tablist" aria-label="Organization sections"><button role="tab" tabIndex={tab==='members'?0:-1} onKeyDown={e=>{if(org.owner&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();chooseTab('billing',true);}}} aria-selected={tab==='members'} aria-controls="organization-members" id="members-tab" onClick={()=>setTab('members')}>Members</button>{org.owner&&<button role="tab" tabIndex={tab==='billing'?0:-1} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();chooseTab('members',true);}}} aria-selected={tab==='billing'} aria-controls="organization-billing" id="billing-tab" onClick={()=>setTab('billing')}>Billing & Ledger</button>}</div>
   {tab==='members'?<section role="tabpanel" id="organization-members" aria-labelledby="members-tab"><div className={styles.sectionTitle}><h2>{org.owner?'People & access':'Your usage'}</h2><p className={styles.muted}>{org.owner?'Lifetime caps include settled spending and active task reservations.':'Your personal credits are managed separately.'}</p></div>{org.owner?<div className={styles.tableWrap}><table className={styles.table}><thead><tr>{['Member','Status','Settled spend','Reserved','Spending cap',''].map((s,i)=><th key={i}>{s}</th>)}</tr></thead><tbody>{current?.snapshot.members?.map(m=><MemberRow key={m.user_id} member={m} owner={m.user_id===userId} busy={busy} onAction={act}/>)}{current?.snapshot.invitations?.map(i=><tr key={i.id}><td>{i.email}</td><td><span className={styles.badge}>Pending · 7d</span><small className={styles.subline}>Expires {date(i.expires_at)}</small></td><td>—</td><td>—</td><td>—</td><td><details className={styles.rowMenu}><summary aria-label={'Actions for '+i.email}><MoreHorizontal size={18}/></summary><div><button disabled={busy} onClick={()=>void act({action:'revoke',invitation_id:i.id})}>Revoke invitation</button></div></details></td></tr>)}</tbody></table></div>:<div className={styles.metrics}>{[['Your settled spend',org.member_spent],['Your reserved credits',org.member_held]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{credit(Number(value))}<small>cr</small></strong></div>)}<div><span>Your spending cap</span><strong>{org.spend_cap===null?'Unlimited':credit(org.spend_cap)}</strong></div></div>}</section>:org.owner&&<section role="tabpanel" id="organization-billing" aria-labelledby="billing-tab">
    <div className={styles.billingGrid}><div><span className={styles.eyebrow}>CREDIT TOP-UP</span><h2>Keep your team moving.</h2><p className={styles.muted}>₹115 or US$1.15 per credit. Each credit covers US$1 of model usage. Every 10 purchased credits unlocks a member seat.</p><Link href="/contact?topic=organization" className={styles.textLink}>Contact sales for larger orders <ArrowUpRight size={14}/></Link></div><form className={styles.form} onSubmit={e=>{e.preventDefault();void purchase();}}>{current?.snapshot.checkout?.payu_test_enabled&&<p className={styles.notice}>Temporary payment test: 50 credits cost ₹1 in INR for your account.</p>}<div className={styles.formRow}><label>Credits<input aria-label="Organization credits" type="number" min="50" max="1000" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} onBlur={()=>{if(!quantity.trim()||Number(quantity)<=0)setQuantity('50');}}/></label><label>Currency<select value={currency} onChange={e=>setCurrency(e.target.value as 'INR'|'USD')}><option value="INR">INR</option><option value="USD">USD</option></select></label></div>{currency==='INR'&&<label>Phone for payment<input aria-label="Phone for payment" type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>}<button className={styles.primary} disabled={busy||!valid}>{busy?'Opening checkout…':`Buy ${valid?(currency==='INR'?'₹'+(payuTest?1:amount*115).toLocaleString('en-IN'):'US$'+(amount*1.15).toFixed(2)):''}`}</button><p className={styles.muted}>{valid?Math.floor((Number(org.purchased)+amount)/10):org.seat_limit} seats after purchase. Credits and seats do not expire.</p></form></div>
    <div className={styles.sectionTitle}><h2>Purchases</h2><p className={styles.muted}>Your 50 most recent payment records.</p></div>{ledgerBusy?<p>Loading billing records…</p>:current?.ledger?<><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Date</th><th>Credits</th><th>Amount</th><th>Status</th></tr></thead><tbody>{current.ledger.payments.map(p=><tr key={p.id}><td>{date(p.created_at)}</td><td>{credit(p.credits_purchased)} cr</td><td>{new Intl.NumberFormat(undefined,{style:'currency',currency:p.currency}).format(p.amount_paid)}</td><td><span className={styles.badge}>{p.status}</span></td></tr>)}</tbody></table>{!current.ledger.payments.length&&<p className={styles.empty}>No purchases yet.</p>}</div><div className={styles.sectionTitle}><h2>Credit activity</h2><p className={styles.muted}>The 100 most recent reservations, settlements and account changes.</p></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Date</th><th>Activity</th><th>Credits</th></tr></thead><tbody>{current.ledger.events.map(e=><tr key={e.id}><td>{date(e.created_at)}</td><td>{e.kind.replaceAll('_',' ')}</td><td>{credit(e.credits)} cr</td></tr>)}</tbody></table>{!current.ledger.events.length&&<p className={styles.empty}>No credit activity yet.</p>}</div></>:<button className={styles.secondary} onClick={()=>void refresh(true)}>Load billing records</button>}
   </section>}
  </>}
  {modal&&<Modal title={modal==='create'?'New Organization':'Invite a member'} close={()=>{if(!busy)setModal(null);}}>{error&&<p role="alert" className={styles.error}>{error}</p>}{modal==='create'?creation:<form className={styles.form} onSubmit={e=>{e.preventDefault();void act({action:'invite',email});}}><p className={styles.muted}>Invitations use a seat for seven days. You can revoke one at any time.</p><label>Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="colleague@company.com"/></label><button className={styles.primary} disabled={busy||!email.trim()}>{busy?'Inviting…':'Send invitation'}</button></form>}</Modal>}
 </section></PageLayout>;
}

function MemberRow({member:m,owner,busy,onAction}:{member:Member;owner:boolean;busy:boolean;onAction:(value:Record<string,unknown>)=>Promise<boolean>}){
 const [cap,setCap]=useState(m.spend_cap===null?'':String(m.spend_cap));const popover=useRef<HTMLDetailsElement>(null);
 useEffect(()=>setCap(m.spend_cap===null?'':String(m.spend_cap)),[m.spend_cap]);
 const valid=cap.trim()===''||(Number.isFinite(Number(cap))&&Number(cap)>=Number(m.spent)+Number(m.held));
 return <tr><td><strong>{m.email}</strong>{owner&&<small className={styles.subline}>Owner</small>}</td><td><span className={styles.badge}>{m.active?'Active':'Removed'}</span></td><td>{credit(m.spent)} cr</td><td>{credit(m.held)} cr</td><td><details ref={popover} className={styles.capPopover}><summary aria-label={'Edit spending cap for '+m.email}>{m.spend_cap===null?'Unlimited':credit(m.spend_cap)+' cr'}</summary><form className={styles.form} onSubmit={async e=>{e.preventDefault();const saved=await onAction({action:'cap',user_id:m.user_id,cap:cap.trim()===''?null:Number(cap)});if(saved&&popover.current)popover.current.open=false;}}><label>Lifetime cap<input aria-label={'Spending cap for '+m.email} inputMode="decimal" placeholder="Unlimited" value={cap} onChange={e=>setCap(e.target.value)}/></label><small>Leave blank for unlimited. Minimum {credit(Number(m.spent)+Number(m.held))} cr.</small><button className={styles.primary} disabled={busy||!valid}>Save cap</button></form></details></td><td>{m.active&&!owner&&<details className={styles.rowMenu}><summary aria-label={'Actions for '+m.email}><MoreHorizontal size={18}/></summary><div><button disabled={busy} onClick={()=>void onAction({action:'remove',user_id:m.user_id})}>Remove member</button></div></details>}</td></tr>;
}
function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current,previous=document.activeElement as HTMLElement|null;dialog?.showModal();return()=>{dialog?.close();previous?.focus();};},[]);
 return <dialog ref={ref} className={styles.modal} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}} aria-labelledby="organization-dialog-title"><div className={styles.modalHeader}><h2 id="organization-dialog-title">{title}</h2><button className={styles.iconButton} aria-label="Close dialog" onClick={close}><X size={18}/></button></div>{children}</dialog>;
}
