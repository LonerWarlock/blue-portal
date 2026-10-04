import { BLUE_SUBSCRIPTION_PLANS, bluePlanSavings, type BlueBillingCycle } from '@/lib/blueSubscriptionPlans';
import styles from './billing-cycle.module.css';
import { motion } from 'motion/react';

export default function BillingCycleSelector({ value, onChange, disabled }: {
  value: BlueBillingCycle; onChange: (cycle: BlueBillingCycle) => void; disabled?: boolean;
}) {
  return (
    <fieldset className={styles.selector} disabled={disabled}>
      <legend className="sr-only">Blue subscription duration</legend>
      {(Object.keys(BLUE_SUBSCRIPTION_PLANS) as BlueBillingCycle[]).map(cycle => (
        <label key={cycle} className={styles.option}>
          <input type="radio" name="blue-billing-cycle" value={cycle} checked={value === cycle}
            onChange={() => onChange(cycle)} className={styles.input} />
          <span className={`${styles.choice} ${value === cycle ? styles.choiceSelected : ''}`}>
            {value === cycle && <motion.span aria-hidden="true" className={styles.pill} layoutId="blue-pricing-cycle" transition={{ type: 'spring', stiffness: 450, damping: 35 }} />}
            <span>{BLUE_SUBSCRIPTION_PLANS[cycle].label}</span>
            {cycle !== 'monthly' && <span className={styles.saving}>{`Save ${bluePlanSavings(cycle)}%`}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
