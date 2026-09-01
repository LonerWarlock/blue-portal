import { reportProductionEnvironment } from '@/lib/envValidation';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    reportProductionEnvironment();
  }
}
