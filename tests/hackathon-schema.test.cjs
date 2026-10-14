const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('real historical schema rejects solo; repair allows solo and preserves old teams', async () => {
  const db = new PGlite();
  try {
    const old = fs.readFileSync(path.join(__dirname, '../supabase/migrations/006_hackathon_registrations.sql'), 'utf8');
    await db.exec(old.split('-- RLS')[0]);
    const insert = `insert into hackathon_registrations (team_name,team_size,leader_first_name,
      leader_last_name,leader_email,leader_phone,leader_branch,leader_year,degree,payment_amount,payment_status)
      values ('Test',$1,'Test','Participant','test@example.invalid','0000000000','Test','1st','B.Tech',1,'success')`;
    await assert.rejects(db.query(insert, [1]), /team_size_check/);
    await db.query(insert, [5]);
    const repair = fs.readFileSync(path.join(__dirname, '../supabase/migrations/029_hackathon_solo_registration.sql'), 'utf8');
    await db.exec(repair);
    await db.exec(repair);
    for (const size of [1, 2, 3, 4]) await db.query(insert, [size]);
    assert.equal((await db.query('select count(*)::int as n from hackathon_registrations')).rows[0].n, 5);
    for (const size of [0, 6]) await assert.rejects(db.query(insert, [size]), /team_size_check/);
  } finally { await db.close(); }
});
