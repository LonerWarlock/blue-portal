import OrganizationClient from './OrganizationClient';
import {createPageMetadata} from '@/lib/seo';
export const metadata=createPageMetadata('/organizations','Blue Organization Plan','Shared Blue Credits, individual member accounts and Organization spending controls.');
export default function Page(){return <OrganizationClient/>;}
