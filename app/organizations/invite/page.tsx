import OrganizationClient from '../OrganizationClient';
import {privatePageMetadata} from '@/lib/seo';
export const metadata=privatePageMetadata('Organization invitation');
export default function Page(){return <OrganizationClient invitation/>;}
