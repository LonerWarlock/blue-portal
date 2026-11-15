import OrganizationClient from '../../OrganizationClient';
import {privatePageMetadata} from '@/lib/seo';
export const metadata=privatePageMetadata('Organization admin');
export default function Page({params}:{params:{id:string}}){return <OrganizationClient id={params.id}/>;}
